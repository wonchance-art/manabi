// 🗺️ 학습 월드 광장 맵 빌더 — 한반도+일본 열도 실비율 도트 맵.
//
// 파이프라인: Natural Earth 벡터(해안선 실데이터) → 등장방형 투영 → 448×384 격자
// point-in-polygon 래스터화('sea'|'land') → 소도서 정리 → RLE 인코딩 →
// src/components/world/mapData.js 산출.
//
// 결정적: 같은 입력 → 같은 출력. `node scripts/world/build-map.mjs` 로 재실행 가능.
//
// 데이터 출처(우선순위):
//   1) Natural Earth 50m admin_0_countries.geojson (KR·KP·JP 피처 필터)
//   2) 실패 시 110m
//   3) 둘 다 실패 시 하드코딩 폴백 폴리곤(파일 하단 FALLBACK — 후속 교체 대상)
// 네트워크는 curl(프록시·CA 번들 자동 적용) 경유. 어떤 경로였는지 콘솔에 보고.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '..', 'src', 'components', 'world', 'mapData.js');

// ── 오너 확정 지리 상수 (불변) ──
// 스케일 1타일 = 4.5km. 등장방형(위도 고정 cos38°).
//   x = (lon − 123.5) × 19.5,  y = (46.0 − lat) × 24.7  (타일 단위)
const LON0 = 123.5, LAT0 = 46.0, KX = 19.5, KY = 24.7;
const MAP_W = 448, MAP_H = 384;
const MIN_ISLAND = 4; // 이 타일 수 미만의 고립 land 덩어리는 소도서로 간주해 제거(주요 영토만 유지)

// 투영: [lon,lat] → 부동소수 타일 좌표(래스터화용, 반올림 전).
function projF(lon, lat) {
  return [(lon - LON0) * KX, (LAT0 - lat) * KY];
}
// 투영: 반올림 타일 좌표(주요 지점·검산용).
function projR(lon, lat) {
  return { x: Math.round((lon - LON0) * KX), y: Math.round((LAT0 - lat) * KY) };
}

// ── 네트워크: curl 로 GeoJSON 텍스트 취득(프록시·CA 자동). 실패 시 null. ──
function fetchText(url) {
  try {
    const out = execFileSync('curl', ['-sSL', '--fail', '--max-time', '180', url], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    });
    return out && out.length > 100 ? out : null;
  } catch (e) {
    console.warn(`  · fetch 실패: ${url}\n    ${String(e.message).slice(0, 200)}`);
    return null;
  }
}

// KR·KP·JP 피처만 추출. Natural Earth 속성명 편차(ADM0_A3 / ISO_A2 / NAME) 모두 대응.
const WANT_A3 = new Set(['KOR', 'PRK', 'JPN']);
const WANT_A2 = new Set(['KR', 'KP', 'JP']);
const WANT_NAME = new Set(['South Korea', 'North Korea', 'Japan', 'Republic of Korea', "Dem. Rep. Korea"]);
function wantFeature(f) {
  const p = f.properties || {};
  const a3 = p.ADM0_A3 || p.adm0_a3 || p.SOV_A3 || p.GU_A3;
  const a2 = p.ISO_A2 || p.iso_a2 || p.ISO_A2_EH;
  const nm = p.NAME || p.name || p.NAME_LONG || p.ADMIN || p.admin;
  return (a3 && WANT_A3.has(a3)) || (a2 && WANT_A2.has(a2)) || (nm && WANT_NAME.has(nm));
}

// GeoJSON geometry → 투영된 폴리곤 목록. 각 폴리곤 = [outerRing, hole1, …] (ring = [[x,y],…]).
function geomToPolys(geom, out) {
  if (!geom) return;
  const projRing = (ring) => ring.map(([lon, lat]) => projF(lon, lat));
  if (geom.type === 'Polygon') {
    out.push(geom.coordinates.map(projRing));
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) out.push(poly.map(projRing));
  }
}

// 점(px,py)이 링 내부인지 — ray casting.
function inRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// 점이 폴리곤(외곽∧¬구멍) 내부인지.
function inPoly(px, py, poly) {
  if (!inRing(px, py, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(px, py, poly[h])) return false;
  return true;
}

// 폴리곤들 → 448×384 격자 래스터화(타일 중심 = 정수 타일좌표에서 표본). bbox 컬링으로 가속.
function rasterize(polys) {
  const grid = new Uint8Array(MAP_W * MAP_H); // 0=sea, 1=land
  for (const poly of polys) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const ring of poly) for (const [x, y] of ring) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    const x0 = Math.max(0, Math.floor(minx)), x1 = Math.min(MAP_W - 1, Math.ceil(maxx));
    const y0 = Math.max(0, Math.floor(miny)), y1 = Math.min(MAP_H - 1, Math.ceil(maxy));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (grid[ty * MAP_W + tx]) continue;
        if (inPoly(tx, ty, poly)) grid[ty * MAP_W + tx] = 1;
      }
    }
  }
  return grid;
}

// 소도서 정리: 연결요소(4-이웃) 라벨링 → MIN_ISLAND 미만 land 덩어리 제거.
// (제주·쓰시마·시코쿠 등 주요 영토는 충분히 크므로 유지된다.)
function removeSmallIslands(grid) {
  const seen = new Uint8Array(MAP_W * MAP_H);
  const stack = [];
  let removed = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 1 || seen[i]) continue;
    // BFS/DFS 로 덩어리 수집
    const comp = [];
    stack.length = 0; stack.push(i); seen[i] = 1;
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const x = idx % MAP_W, y = (idx / MAP_W) | 0;
      const nb = [];
      if (x > 0) nb.push(idx - 1);
      if (x < MAP_W - 1) nb.push(idx + 1);
      if (y > 0) nb.push(idx - MAP_W);
      if (y < MAP_H - 1) nb.push(idx + MAP_W);
      for (const n of nb) if (grid[n] === 1 && !seen[n]) { seen[n] = 1; stack.push(n); }
    }
    if (comp.length < MIN_ISLAND) { for (const idx of comp) grid[idx] = 0; removed += comp.length; }
  }
  return removed;
}

// 행 단위 RLE 인코딩: 각 행을 sea(0)부터 시작하는 런길이 배열로(교차), base36·','·';'.
function encodeRLE(grid) {
  const rows = [];
  for (let y = 0; y < MAP_H; y++) {
    const runs = [];
    let val = 0, count = 0;
    for (let x = 0; x < MAP_W; x++) {
      const v = grid[y * MAP_W + x];
      if (v === val) { count++; }
      else { runs.push(count.toString(36)); val = v; count = 1; }
    }
    runs.push(count.toString(36));
    rows.push(runs.join(','));
  }
  return rows.join(';');
}

// 검산용 디코더(스크립트 내부에서 왕복 확인).
function decodeRLE(rle) {
  const grid = new Uint8Array(MAP_W * MAP_H);
  const rows = rle.split(';');
  for (let y = 0; y < MAP_H; y++) {
    let x = 0, val = 0;
    for (const c of rows[y].split(',')) {
      const n = parseInt(c, 36);
      for (let i = 0; i < n; i++) grid[y * MAP_W + x++] = val;
      val ^= 1;
    }
  }
  return grid;
}

// ── 하드코딩 폴백 폴리곤 (출처 없음 · 손그림 근사 · 후속 교체 대상) ──
// 네트워크 실패 시에만 사용. 주요 해안 정점 수십 개로 대륙 실루엣만 근사한다.
// [lon,lat] 시계열 — 실데이터가 아니므로 정확도 보장 안 함(경고 출력).
const FALLBACK = [
  // 한반도(대략적 외곽)
  [[124.4, 39.9], [125.1, 38.6], [126.6, 37.8], [126.4, 37.0], [126.6, 36.0], [126.5, 34.6],
   [127.8, 34.3], [129.1, 35.1], [129.4, 36.0], [129.5, 37.0], [128.4, 38.6], [127.5, 39.8],
   [126.0, 40.9], [124.4, 40.1]],
  // 제주
  [[126.2, 33.5], [126.9, 33.5], [126.9, 33.2], [126.2, 33.2]],
  // 쓰시마
  [[129.2, 34.7], [129.5, 34.7], [129.5, 34.1], [129.2, 34.1]],
  // 규슈
  [[129.6, 33.5], [131.0, 33.7], [131.9, 33.3], [131.7, 32.0], [130.6, 31.0], [130.2, 31.5],
   [129.6, 32.6]],
  // 시코쿠
  [[132.4, 33.5], [134.7, 34.2], [134.6, 33.5], [133.0, 32.7]],
  // 혼슈(대략)
  [[130.9, 34.4], [132.5, 34.4], [135.0, 34.6], [137.0, 34.6], [139.7, 35.0], [140.9, 35.7],
   [141.0, 38.3], [140.0, 39.9], [140.0, 41.2], [139.0, 41.5], [137.2, 37.4], [136.0, 37.3],
   [133.3, 35.5], [131.6, 34.7]],
  // 홋카이도(대략)
  [[140.0, 41.8], [141.6, 42.6], [144.2, 42.9], [145.8, 43.4], [145.2, 44.3], [143.0, 44.4],
   [141.6, 45.5], [140.4, 43.3], [140.0, 42.3]],
].map((ring) => [ring.map(([lon, lat]) => projF(lon, lat))]);

// ── 실행 ──
console.log('🗺️  build-map: 한반도+일본 열도 실비율 도트 맵 생성');

let source = 'FALLBACK(하드코딩 · 근사)';
let polys = null;
for (const [label, url] of [
  ['ne_50m', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'],
  ['ne_110m', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'],
]) {
  console.log(`  · 시도: Natural Earth ${label} …`);
  const txt = fetchText(url);
  if (!txt) continue;
  let gj;
  try { gj = JSON.parse(txt); } catch { console.warn('    JSON 파싱 실패'); continue; }
  const feats = (gj.features || []).filter(wantFeature);
  if (!feats.length) { console.warn('    KR·KP·JP 피처 0개 — 다음 후보로'); continue; }
  const acc = [];
  for (const f of feats) geomToPolys(f.geometry, acc);
  if (!acc.length) { console.warn('    폴리곤 0개 — 다음 후보로'); continue; }
  polys = acc;
  source = `Natural Earth ${label} (nvkelso/natural-earth-vector)`;
  console.log(`    ✓ ${label}: ${feats.length}개 피처 → ${acc.length}개 폴리곤`);
  break;
}
if (!polys) {
  console.warn('  ⚠️  네트워크 데이터 실패 → 하드코딩 폴백 사용(근사치 · 후속 교체 필요)');
  polys = FALLBACK;
}

console.log(`  · 데이터 경로: ${source}`);
const grid = rasterize(polys);
const removed = removeSmallIslands(grid);
let land = 0; for (const v of grid) if (v) land++;
console.log(`  · 래스터화: land ${land} 타일 / ${MAP_W * MAP_H} (소도서 ${removed} 타일 제거)`);

// 주요 지점(투영 산출) + 검산
const POI = {
  SEOUL: projR(126.98, 37.57),
  INCHEON: projR(126.45, 37.46),   // 인천국제공항 부근
  BUSAN: projR(129.07, 35.18),
  FUKUOKA: projR(130.40, 33.59),
  TOKYO: projR(139.69, 35.68),
  HANEDA: projR(139.78, 35.55),    // 하네다 공항
};
console.log('  · 주요 지점(투영):', JSON.stringify(POI));
const isLand = (p) => grid[p.y * MAP_W + p.x] === 1;
for (const [k, p] of Object.entries(POI)) {
  const tag = isLand(p) ? 'land' : 'SEA(!)';
  console.log(`    ${k}: (${p.x}, ${p.y}) → ${tag}`);
}
// 검산: 스펙 명시값
const chk = (name, got, want) => console.log(`    검산 ${name}: (${got.x},${got.y}) ${got.x === want[0] && got.y === want[1] ? '✓' : '✗ 기대 ' + want}`);
chk('서울', POI.SEOUL, [68, 208]);
chk('도쿄', POI.TOKYO, [316, 255]);
chk('부산', POI.BUSAN, [109, 267]);

// RLE 왕복 검증
const rle = encodeRLE(grid);
const back = decodeRLE(rle);
let ok = back.length === grid.length;
for (let i = 0; ok && i < grid.length; i++) if (back[i] !== grid[i]) ok = false;
console.log(`  · RLE 왕복 무결성: ${ok ? '✓' : '✗ 불일치'} · 인코딩 길이 ${rle.length}자`);
if (!ok) { console.error('RLE 왕복 실패 — 중단'); process.exit(1); }

// ── mapData.js 산출 ──
const banner = `// ⚠️ 자동 생성 파일 — 직접 수정 금지. 재생성: node scripts/world/build-map.mjs
// 한반도+일본 열도 실비율 도트 맵 (${MAP_W}×${MAP_H} 타일, 1타일=4.5km).
// 데이터 경로: ${source}
// 투영: 등장방형(위도 고정 cos38°) x=(lon-${LON0})×${KX}, y=(${LAT0}-lat)×${KY}.`;

const poiLines = Object.entries(POI)
  .map(([k, p]) => `  ${k}: { x: ${p.x}, y: ${p.y} },`).join('\n');

const js = `${banner}

// 격자 크기(타일). 1타일 = 32 월드 px (버스 계약 불변).
export const MAP_W = ${MAP_W};
export const MAP_H = ${MAP_H};

// ── 지리 상수 (등장방형 투영) ──
export const GEO = { LON0: ${LON0}, LAT0: ${LAT0}, KX: ${KX}, KY: ${KY} };

// [lon,lat] → 타일 좌표(반올림). 예) 서울(126.98,37.57)→(68,208), 도쿄(139.69,35.68)→(316,255).
export function project(lon, lat) {
  return {
    x: Math.round((lon - GEO.LON0) * GEO.KX),
    y: Math.round((GEO.LAT0 - lat) * GEO.KY),
  };
}

// 주요 지점(투영 산출값). 인천/하네다는 공항, 나머지는 도심.
export const POI = {
${poiLines}
};

// 행 단위 RLE: 각 행은 sea(0)부터 교차하는 런길이(base36), ',' 구분, 행은 ';' 구분.
export const MAP_RLE = ${JSON.stringify(rle)};

// RLE → Uint8Array(0=sea, 1=land), 길이 MAP_W*MAP_H. 결정적.
export function decodeMap() {
  const grid = new Uint8Array(MAP_W * MAP_H);
  const rows = MAP_RLE.split(';');
  for (let y = 0; y < MAP_H; y++) {
    let x = 0, val = 0;
    const parts = rows[y].split(',');
    for (let k = 0; k < parts.length; k++) {
      const n = parseInt(parts[k], 36);
      for (let i = 0; i < n; i++) grid[y * MAP_W + x++] = val;
      val ^= 1;
    }
  }
  return grid;
}

// 타일 land 여부(범위 밖 = sea).
export function isLandAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  return grid[ty * MAP_W + tx] === 1;
}
`;

writeFileSync(OUT, js);
const bytes = Buffer.byteLength(js, 'utf8');
console.log(`  · 산출: ${OUT}`);
console.log(`  · 파일 크기: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
console.log('✅ 완료');
