// 한국(+향후 유럽) 도시 geo 인수 게이트 — Claude(검수)와 Codex(구현)가 공유하는 단일 기준.
//
// 원칙: 모든 게이트는 **최종 terrain(플레이어가 보는 그리드)** 기준이다. 스냅샷 마스크가
// 통과해도 최종 지형에서 도로가 하천을 덮으면 FAIL — 실제로 이 괴리가 부산 온천천에서
// 발생했다(#151). 핸드오프(CODEX_DONE) 전 이 스크립트가 green이어야 한다.
//
// 사용: node scripts/verify-city-geo.mjs --city busan [--file <geo.js 경로>]
// 종료코드: 게이트 전부 통과 0, 하나라도 FAIL 1. report 항목은 판정에 미포함(참고 수치).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EARTH = 6378137;
const DEG = Math.PI / 180;
const T = { ROAD: 0, SIDEWALK: 1, CROSSWALK: 2, PARK: 4, BRIDGE: 5, WATER: 8, BUILDING: 9, ISLAND: 10, RIVER: 11, MOUNTAIN: 13 };
const isWaterTile = (v) => v === T.WATER || v === T.RIVER;

// ── 도시별 게이트 정의 ─────────────────────────────────────────────────────
// riverSections: 단면 스캔 — sumMinM(수면 합계)·runMinM(최대 연속) 둘 다 충족.
// streamCourses: 유로 보간 샘플 ±windowTiles 내 수면 존재율 ≥ presenceMin.
// downtown: 도심 4km(200×200타일) 가시도로 비율 — report 전용(버퍼 정책 변경에 민감).
const CITY_GATES = {
  busan: {
    file: 'src/components/world/cities/busan.geo.js',
    snapshot: 'scripts/data/busan-osm-v21.json',
    buildingPct: [9, 11],
    greenMinPct: 20,
    poiMaxDevTiles: 2.5,
    downtown: { label: '서면', lon: 129.0593, lat: 35.1579 },
    riverSections: [
      { name: '낙동강(을숙도 단면)', lat: 35.10, lonRange: [128.90, 129.00], sumMinM: 1200, runMinM: 600 },
    ],
    streamCourses: [
      {
        // 유로 점은 OSM 중심선 굴곡을 따라 조밀하게 pin(직선 보간이 굽은 구간을 벗어나지
        // 않도록 — Codex #156 P1 반영). 종점은 수영강 합류부 직전(relation bbox 내)까지만.
        name: '온천천', presenceMin: 0.8, windowTiles: 4,
        pts: [[129.0895, 35.2295], [129.0855, 35.2195], [129.0845, 35.2120], [129.0865, 35.2050], [129.0885, 35.2000], [129.0900, 35.1950], [129.0950, 35.1900], [129.1000, 35.1870], [129.1050, 35.1830]],
      },
    ],
    reportCourses: [
      { name: '수영강(참고)', windowTiles: 3, pts: [[129.1150, 35.1900], [129.1180, 35.1730], [129.1230, 35.1640]] },
      { name: '동천(참고)', windowTiles: 3, pts: [[129.0590, 35.1560], [129.0550, 35.1450], [129.0480, 35.1330]] },
    ],
    // 오너 지시(2026-07-16): KR 도시에서 BRIDGE(5) 잔존 0 — 진짜 교량은 차도(ROAD)로,
    // 강심 고립·애매 조각은 수면/도로 중 자연스러운 쪽으로 흡수. 교량 회랑 생존은 pin으로 검증.
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '광안대교', lon: 129.1150, lat: 35.1470, windowTiles: 5 },
    ],
  },
  seoul: {
    file: 'src/components/world/cities/seoul.geo.js',
    snapshot: 'scripts/data/seoul-osm-v21.json',
    buildingPct: [9, 11],
    greenMinPct: 20,
    poiMaxDevTiles: 2.5,
    downtown: { label: '시청', lon: 126.9779, lat: 37.5657 },
    riverSections: [
      { name: '한강(반포 단면)', lon: 126.99, latRange: [37.60, 37.47], sumMinM: 800, runMinM: 600 },
    ],
    streamCourses: [],
    reportCourses: [
      { name: '청계천(참고)', windowTiles: 3, pts: [[126.9787, 37.5692], [127.0093, 37.5713], [127.0400, 37.5610]] },
    ],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '마포대교', lon: 126.9480, lat: 37.5285, windowTiles: 5 },
      { name: '반포대교', lon: 126.9965, lat: 37.5125, windowTiles: 5 },
    ],
  },
};

// ── 투영(도시 geo 생성 계약과 동일: webmercator + aspectCorrection) ─────────
function makeProjector(bbox, metersPerTile) {
  const wm = (lon, lat) => ({ x: EARTH * lon * DEG, y: EARTH * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)) });
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const sw = wm(minLon, minLat);
  const ne = wm(maxLon, maxLat);
  const corr = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    tile: (lon, lat) => {
      const p = wm(lon, lat);
      return [((p.x - sw.x) * corr) / metersPerTile, ((ne.y - p.y) * corr) / metersPerTile];
    },
  };
}

function terrainShares(geo) {
  const counts = {};
  for (const v of geo.terrain) counts[v] = (counts[v] || 0) + 1;
  const land = geo.terrain.length - (counts[T.WATER] || 0) - (counts[T.RIVER] || 0) - (counts[T.ISLAND] || 0);
  const pct = (t) => (100 * (counts[t] || 0)) / land;
  return { counts, land, pct };
}

function scanSection(geo, proj, section) {
  const W = geo.meta.grid.w;
  const mpt = geo.meta.metersPerTile;
  const runs = [];
  let run = 0;
  let sum = 0;
  const push = (v) => {
    if (isWaterTile(v)) { sum += 1; run += 1; } else if (run > 0) { runs.push(run); run = 0; }
  };
  if (section.lat != null) { // 가로 단면(고정 위도, 경도 스캔)
    const y = Math.floor(proj.tile(section.lonRange[0], section.lat)[1]);
    const [x0, x1] = section.lonRange.map((lon) => Math.floor(proj.tile(lon, section.lat)[0]));
    for (let x = x0; x <= x1; x += 1) push(geo.terrain[y * W + x]);
  } else { // 세로 단면(고정 경도, 위도 스캔 — latRange는 북→남)
    const x = Math.floor(proj.tile(section.lon, section.latRange[0])[0]);
    const [y0, y1] = section.latRange.map((lat) => Math.floor(proj.tile(section.lon, lat)[1]));
    for (let y = y0; y <= y1; y += 1) push(geo.terrain[y * W + x]);
  }
  if (run > 0) runs.push(run);
  return { sumM: sum * mpt, runM: Math.max(0, ...runs) * mpt };
}

function coursePresence(geo, proj, course) {
  const { w: W, h: H } = geo.meta.grid;
  const win = course.windowTiles;
  let hit = 0;
  let total = 0;
  for (let i = 0; i < course.pts.length - 1; i += 1) {
    const [lon1, lat1] = course.pts[i];
    const [lon2, lat2] = course.pts[i + 1];
    for (let t = 0; t <= 20; t += 1) {
      const [fx, fy] = proj.tile(lon1 + ((lon2 - lon1) * t) / 20, lat1 + ((lat2 - lat1) * t) / 20);
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      let found = 0;
      for (let dy = -win; dy <= win; dy += 1) {
        for (let dx = -win; dx <= win; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue; // 경계 wrap 방지(#156 P2)
          const v = geo.terrain[ny * W + nx];
          if (isWaterTile(v) || v === T.BRIDGE) found = 1; // 하천 위 다리는 수면 증거로 인정
        }
      }
      hit += found;
      total += 1;
    }
  }
  return hit / total;
}

function downtownRoadPct(geo, proj, downtown) {
  const { w: W, h: H } = geo.meta.grid;
  const [fx, fy] = proj.tile(downtown.lon, downtown.lat);
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  let road = 0;
  let land = 0;
  for (let y = Math.max(0, cy - 100); y < Math.min(H, cy + 100); y += 1) {
    for (let x = Math.max(0, cx - 100); x < Math.min(W, cx + 100); x += 1) {
      const v = geo.terrain[y * W + x];
      if (v === T.WATER || v === T.RIVER || v === T.ISLAND) continue;
      land += 1;
      if (v === T.ROAD || v === T.CROSSWALK || v === T.BRIDGE) road += 1;
    }
  }
  return (100 * road) / land;
}

async function main() {
  const argv = process.argv.slice(2);
  const read = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const city = read('--city');
  const gates = CITY_GATES[city];
  if (!gates) throw new Error(`Usage: node scripts/verify-city-geo.mjs --city <${Object.keys(CITY_GATES).join('|')}> [--file <geo.js>]`);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = read('--file') || path.join(root, gates.file);

  const mod = await import(path.resolve(file));
  const geoKey = Object.keys(mod).find((k) => k.endsWith('_GEO'));
  const geo = mod[geoKey];
  const proj = makeProjector(geo.meta.bbox, geo.meta.metersPerTile);
  const { pct } = terrainShares(geo);

  const results = [];
  const gate = (name, pass, detail) => results.push({ name, pass, detail, hard: true });
  const report = (name, detail) => results.push({ name, pass: null, detail, hard: false });

  // ① 건물 비중
  const building = pct(T.BUILDING);
  gate(`건물 ${gates.buildingPct[0]}~${gates.buildingPct[1]}%`, building >= gates.buildingPct[0] && building <= gates.buildingPct[1], `${building.toFixed(1)}%`);

  // ② 녹지(산+공원) 질량
  const green = pct(T.MOUNTAIN) + pct(T.PARK);
  gate(`녹지(M+P) ≥${gates.greenMinPct}%`, green >= gates.greenMinPct, `${green.toFixed(1)}%`);

  // ③ POI 재투영 정합
  let worstDev = 0;
  let worstId = '';
  for (const poi of geo.pois || []) {
    if (poi.lon == null) continue;
    const [ex, ey] = proj.tile(poi.lon, poi.lat);
    const d = Math.hypot(ex - poi.tile[0], ey - poi.tile[1]);
    if (d > worstDev) { worstDev = d; worstId = poi.id; }
  }
  gate(`POI 재투영 ≤${gates.poiMaxDevTiles}타일`, worstDev <= gates.poiMaxDevTiles, `worst ${worstId} ${worstDev.toFixed(2)}타일`);

  // ④ 강 단면(합계+연속)
  for (const section of gates.riverSections) {
    const { sumM, runM } = scanSection(geo, proj, section);
    gate(`${section.name} 합계 ≥${section.sumMinM}m·연속 ≥${section.runMinM}m`, sumM >= section.sumMinM && runM >= section.runMinM, `합계 ${sumM}m / 연속 ${runM}m`);
  }

  // ⑤ 지천 유로 존재율 (최종 terrain — 마스크 아님)
  for (const course of gates.streamCourses) {
    const presence = coursePresence(geo, proj, course);
    gate(`${course.name} 유로 수면 존재율 ≥${course.presenceMin * 100}%`, presence >= course.presenceMin, `${(presence * 100).toFixed(0)}%`);
  }
  for (const course of gates.reportCourses || []) {
    report(`${course.name} 유로 수면 존재율`, `${(coursePresence(geo, proj, course) * 100).toFixed(0)}%`);
  }

  // ⑥ 교량 정리(오너 지시): BRIDGE 잔존 0 + 주요 교량이 차도 회랑으로 생존
  if (gates.bridgeMaxTiles != null) {
    const bridgeCount = (terrainShares(geo).counts[T.BRIDGE] || 0);
    gate(`BRIDGE 잔존 ≤${gates.bridgeMaxTiles}타일 (교량→차도/수면 흡수)`, bridgeCount <= gates.bridgeMaxTiles, `${bridgeCount}타일`);
    const { w: W2, h: H2 } = geo.meta.grid;
    for (const pin of gates.bridgeCrossings || []) {
      const [fx, fy] = proj.tile(pin.lon, pin.lat);
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      let paved = false;
      for (let dy = -pin.windowTiles; dy <= pin.windowTiles && !paved; dy += 1) {
        for (let dx = -pin.windowTiles; dx <= pin.windowTiles; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W2 || ny < 0 || ny >= H2) continue;
          const v = geo.terrain[ny * W2 + nx];
          if (v === T.ROAD || v === T.CROSSWALK || v === T.BRIDGE) { paved = true; break; }
        }
      }
      gate(`${pin.name} 교량 회랑 생존`, paved, paved ? '차도 확인' : `±${pin.windowTiles}타일 내 차도 없음`);
    }
  }

  // ⑦ 스냅샷·분류 계약 (파일이 있을 때만 — main 등 부재 브랜치에선 SKIP)
  const snapPath = path.join(root, gates.snapshot);
  if (fs.existsSync(snapPath)) {
    const head = fs.readFileSync(snapPath, 'utf8').slice(0, 4096);
    const version = Number((head.match(/"version"\s*:\s*(\d+)/) || [])[1] || 0);
    gate('스냅샷 계약 v2+ (가시 도로 분류)', version >= 2, `version ${version}`);
  } else {
    report('스냅샷 계약', `SKIP (${gates.snapshot} 없음)`);
  }
  try {
    const { roadStyle } = await import(path.join(root, 'scripts/build-korean-city-osm-snapshot.mjs'));
    const visible = ['residential', 'service', 'tertiary'].every((h) => roadStyle(h).value === 2);
    gate('roadStyle 계약(residential·service·tertiary 가시)', visible, visible ? 'OK' : '비가시 클래스 존재');
  } catch {
    report('roadStyle 계약', 'SKIP (스냅샷 스크립트 없음)');
  }

  // report: 도심 가시도로 (게이트 아님 — 버퍼 정책 변경에 민감해 참고 수치)
  report(`도심(${gates.downtown.label}) 4km 가시도로`, `${downtownRoadPct(geo, proj, gates.downtown).toFixed(1)}%`);

  // ── 출력 ──
  let failed = 0;
  for (const r of results) {
    const mark = r.pass === null ? '·' : r.pass ? '✅' : '❌';
    if (r.pass === false) failed += 1;
    console.log(`${mark} ${r.name} — ${r.detail}`);
  }
  console.log(failed === 0 ? `\n${city}: 전 게이트 통과` : `\n${city}: 게이트 ${failed}건 FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error.message); process.exit(2); });
