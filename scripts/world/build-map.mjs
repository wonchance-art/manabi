// 🗺️ 학습 월드 광장 맵 빌더 — 한반도+일본 열도 실비율 도트 맵 + 수계·DMZ·교량.
//
// 파이프라인: Natural Earth 벡터(해안선 실데이터) → 등장방형 투영 → 448×384 격자
// point-in-polygon 래스터화(land/sea) → 소도서 정리 → 수계(강·호수) 오버레이 →
// DMZ 철조망 래스터화 → 영종대교 오버레이 → 다치(多値) RLE 인코딩 →
// src/components/world/mapData.js 산출.
//
// 결정적: 같은 입력 → 같은 출력. `node scripts/world/build-map.mjs` 로 재실행 가능.
//
// 지형 코드 계약(게임플레이 그룹과 합의된 고정):
//   0=sea(차단) 1=land 2=river(통행 가능 물) 3=lake(통행 가능 물)
//   4=fence(DMZ, 차단) 5=bridge(바다 위 통행). isBlocked = 0·4 만 true.
//   6=mountain 7=peak(고산/설산) 8=plain — 순수 시각 질감 레이어(전부 walkable · isBlocked 무변경).
//   질감은 NOAA ETOPO 2022 고도(ERDDAP griddap CSV) → land 타일 분류. 실패 시 하드코딩 산맥 폴리라인 폴백.
//
// 데이터 출처(우선순위):
//   육지: Natural Earth 10m → 50m → 110m admin_0_countries (KR·KP·JP 피처)
//         · 10m 를 우선한다 — 50m 엔 강화도·영종도 등 경기만 소도서가 없다.
//         · 모두 실패 시 하드코딩 폴백 폴리곤(파일 하단 FALLBACK — 근사·경고).
//   수계: ne_10m_rivers_lake_centerlines(한강·낙동강·압록강·두만강·도네가와) + ne_10m_lakes(비와호·수풍호)
//         · bbox 필터 + 이름 화이트리스트. 실패 시 해당 수계 생략(경고) — 육지/DMZ/교량은 유지.
//   DMZ 철조망·영종대교: 하드코딩 지오메트리(네트워크 무관·항상 적용).
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

// 지형 코드 (게임플레이 그룹과 합의된 고정 계약).
// 0~5 는 불변. 6·7·8 은 순수 시각 질감 레이어(전부 walkable — isBlocked 무변경).
//   6=mountain(산지) 7=peak(고산/설산) 8=plain(평야). land 타일 위에만 얹는다.
const TERRAIN = {
  SEA: 0, LAND: 1, RIVER: 2, LAKE: 3, FENCE: 4, BRIDGE: 5,
  MOUNTAIN: 6, PEAK: 7, PLAIN: 8,
};

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
const NE = (name) => `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${name}.geojson`;

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

// GeoJSON geometry → 투영된 라인(폴리라인) 목록. 각 라인 = [[x,y],…].
function geomToLines(geom, out) {
  if (!geom) return;
  const projLine = (line) => line.map(([lon, lat]) => projF(lon, lat));
  if (geom.type === 'LineString') out.push(projLine(geom.coordinates));
  else if (geom.type === 'MultiLineString') for (const line of geom.coordinates) out.push(projLine(line));
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

// 폴리곤들 → 448×384 land 마스크 래스터화(타일 중심 = 정수 타일좌표에서 표본). bbox 컬링으로 가속.
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
// (제주·쓰시마·시코쿠·영종도(≈6타일) 등 주요 영토는 충분히 크므로 유지된다.)
function removeSmallIslands(grid) {
  const seen = new Uint8Array(MAP_W * MAP_H);
  const stack = [];
  let removed = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 1 || seen[i]) continue;
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

// ── 폴리라인 래스터화 (4-연결 연속 · 구멍 0) ──
// 두 부동소수 타일점 사이를 잇는 타일 목록. 대각 이동 시 중간 타일을 끼워 4-연결을 보장한다.
function lineTiles(x0, y0, x1, y1, out) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
  let px = Math.round(x0), py = Math.round(y0);
  out.push([px, py]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x0 + dx * t), cy = Math.round(y0 + dy * t);
    if (cx === px && cy === py) continue;
    if (cx !== px && cy !== py) out.push([cx, py]); // 대각 → 4-연결 보강
    out.push([cx, cy]);
    px = cx; py = cy;
  }
}
// 정점 배열(폴리라인) → 4-연결 타일 목록.
function polylineTiles(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    lineTiles(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], out);
  }
  return out;
}

// ── 다치(多値) 행 단위 RLE ──
// 각 행 = 런들, 런 = `<value 1자리><length base36>`, 런은 ',' · 행은 ';' 구분.
// 첫 문자로 값(0~5)을, 나머지로 런 길이를 읽는다(단일값 XOR 방식보다 일반화).
function encodeRLE(grid) {
  const rows = [];
  for (let y = 0; y < MAP_H; y++) {
    const runs = [];
    let val = grid[y * MAP_W], count = 0;
    for (let x = 0; x < MAP_W; x++) {
      const v = grid[y * MAP_W + x];
      if (v === val) { count++; }
      else { runs.push(String(val) + count.toString(36)); val = v; count = 1; }
    }
    runs.push(String(val) + count.toString(36));
    rows.push(runs.join(','));
  }
  return rows.join(';');
}
function decodeRLE(rle) {
  const grid = new Uint8Array(MAP_W * MAP_H);
  const rows = rle.split(';');
  for (let y = 0; y < MAP_H; y++) {
    let x = 0;
    for (const tok of rows[y].split(',')) {
      const val = tok.charCodeAt(0) - 48;
      const n = parseInt(tok.slice(1), 36);
      for (let i = 0; i < n; i++) grid[y * MAP_W + x++] = val;
    }
  }
  return grid;
}

// ── 지형 질감(고도) 파이프라인 — 순수 시각 레이어(통행 규칙 무변경) ─────────────
// 조건 셀(예: 바다·강)로부터 4-연결 최단 타일 거리(BFS). 조건 셀=0, 도달 불가=0xffff.
function bfsDist(isSource) {
  const dist = new Uint16Array(MAP_W * MAP_H).fill(0xffff);
  const q = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (isSource(x, y)) { const i = y * MAP_W + x; dist[i] = 0; q.push(i); }
    }
  }
  let head = 0;
  while (head < q.length) {
    const idx = q[head++];
    const x = idx % MAP_W, y = (idx / MAP_W) | 0, d = dist[idx];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx;
      if (dist[ni] > d + 1) { dist[ni] = d + 1; q.push(ni); }
    }
  }
  return dist;
}

// 1순위: NOAA ETOPO 2022(60초 그리드)를 ERDDAP griddap bbox 서브셋 CSV로 취득.
// bbox: 위 46.0 / 아래 30.5 / 좌 123.5 / 우 146.5 (맵 커버 영역). ETOPO 위도 방향 편차 대비 두 방향 시도.
const ETOPO_URLS = [
  'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.csv?z%5B(46.0):(30.5)%5D%5B(123.5):(146.5)%5D',
  'https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.csv?z%5B(30.5):(46.0)%5D%5B(123.5):(146.5)%5D',
  // 대체 ERDDAP 미러(동일/유사 ETOPO 데이터셋).
  'https://upwell.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.csv?z%5B(46.0):(30.5)%5D%5B(123.5):(146.5)%5D',
];

// ERDDAP CSV(0=컬럼명,1=단위,2~=데이터: latitude,longitude,z) → 타일별 평균 고도(m). 실패 시 null.
function parseEtopoCsv(csv) {
  const lines = csv.split('\n');
  if (lines.length < 3) return null;
  const header = lines[0].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
  const iLat = header.indexOf('latitude'), iLon = header.indexOf('longitude'), iZ = header.indexOf('z');
  if (iLat < 0 || iLon < 0 || iZ < 0) return null;
  const sum = new Float64Array(MAP_W * MAP_H);
  const cnt = new Uint32Array(MAP_W * MAP_H);
  let n = 0;
  for (let li = 2; li < lines.length; li++) {
    const row = lines[li];
    if (!row) continue;
    const parts = row.split(',');
    const lat = parseFloat(parts[iLat]), lon = parseFloat(parts[iLon]), z = parseFloat(parts[iZ]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(z)) continue;
    const tx = Math.round((lon - LON0) * KX), ty = Math.round((LAT0 - lat) * KY);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
    const idx = ty * MAP_W + tx;
    sum[idx] += z; cnt[idx] += 1; n++;
  }
  if (n < 1000) return null;
  const elev = new Float32Array(MAP_W * MAP_H);
  for (let i = 0; i < elev.length; i++) elev[i] = cnt[i] ? sum[i] / cnt[i] : NaN;
  return elev;
}

// ETOPO 우선 → 미러 → null(폴백으로). 반환 { elev, source } | null.
function fetchElevation() {
  for (const url of ETOPO_URLS) {
    console.log(`  · 고도 시도: ${url.split('?')[0]} …`);
    const csv = fetchText(url);
    if (!csv) continue;
    const elev = parseEtopoCsv(csv);
    if (elev) return { elev, source: url.split('/griddap/')[0].replace('https://', '') };
    console.warn('    ETOPO CSV 파싱 실패 — 다음 후보로');
  }
  return null;
}

// ── 폴백 산맥 폴리라인 (하드코딩 · 근사 · 후속 교체 대상) ──
// ETOPO 실패 시에만 사용. 주요 산맥 능선을 [lon,lat]로 근사하고 좌우 brush 타일로 land 위에 그린다.
// 태백·소백·낭림·함경·개마고원·일본 알프스·오우·규슈·히다카 — 실측 DEM 아님(경고 출력).
const MOUNTAIN_RANGES = [
  [[128.40, 38.60], [128.47, 38.12], [128.54, 37.79], [128.70, 37.40], [128.92, 37.09], [129.00, 36.60], [128.90, 36.10]], // 태백
  [[128.50, 36.96], [128.10, 36.45], [127.90, 35.95], [127.73, 35.34]],                                                     // 소백(→지리산)
  [[126.50, 41.50], [126.70, 41.00], [126.95, 40.50], [127.05, 40.00], [127.15, 39.50]],                                    // 낭림
  [[129.50, 41.50], [128.80, 41.20], [128.30, 41.00], [127.80, 40.70], [127.30, 40.40]],                                    // 함경
  [[126.80, 41.30], [127.30, 41.40], [127.80, 41.30], [128.20, 41.10]],                                                     // 개마고원(고원)
  [[127.10, 40.90], [127.60, 40.85], [128.00, 40.80]],                                                                       // 개마고원 남연
  [[137.60, 36.90], [137.85, 36.50], [137.95, 36.15], [138.20, 35.90], [138.40, 35.60]],                                    // 일본 알프스
  [[140.80, 40.50], [140.75, 39.90], [140.80, 39.30], [140.60, 38.70], [140.50, 38.10]],                                    // 오우(도호쿠)
  [[130.80, 33.20], [131.10, 32.88], [131.30, 32.60], [131.05, 32.30]],                                                     // 규슈 산지
  [[142.90, 43.30], [142.80, 42.80], [143.00, 42.40]],                                                                       // 히다카(홋카이도)
];
const MOUNTAIN_BRUSH = 2; // 능선 좌우 반경(타일) → 폭 ~2·brush+1
// 폴백 고봉(설산) — 이 좌표 주변 1링을 PEAK 로 승격(설악·지리·아소·일본알프스 최고봉 근사).
const PEAK_POINTS_FALLBACK = [[128.47, 38.12], [127.73, 35.34], [131.10, 32.88], [138.10, 36.30]];
// 랜드마크 고봉 — 타일+1링 PEAK 보장 + POI. (백두산·후지산)
const LANDMARKS = [
  { key: 'BAEKDU', name: '백두산', lon: 128.056, lat: 42.006 },
  { key: 'FUJI', name: '후지산', lon: 138.727, lat: 35.361 },
];

// ── 하드코딩 폴백 폴리곤 (출처 없음 · 손그림 근사 · 후속 교체 대상) ──
// 네트워크 실패 시에만 사용. 주요 해안 정점 수십 개로 대륙 실루엣만 근사한다.
// [lon,lat] 시계열 — 실데이터가 아니므로 정확도 보장 안 함(경고 출력).
const FALLBACK = [
  [[124.4, 39.9], [125.1, 38.6], [126.6, 37.8], [126.4, 37.0], [126.6, 36.0], [126.5, 34.6],
   [127.8, 34.3], [129.1, 35.1], [129.4, 36.0], [129.5, 37.0], [128.4, 38.6], [127.5, 39.8],
   [126.0, 40.9], [124.4, 40.1]],
  [[126.2, 33.5], [126.9, 33.5], [126.9, 33.2], [126.2, 33.2]],
  [[129.2, 34.7], [129.5, 34.7], [129.5, 34.1], [129.2, 34.1]],
  [[129.6, 33.5], [131.0, 33.7], [131.9, 33.3], [131.7, 32.0], [130.6, 31.0], [130.2, 31.5],
   [129.6, 32.6]],
  [[132.4, 33.5], [134.7, 34.2], [134.6, 33.5], [133.0, 32.7]],
  [[130.9, 34.4], [132.5, 34.4], [135.0, 34.6], [137.0, 34.6], [139.7, 35.0], [140.9, 35.7],
   [141.0, 38.3], [140.0, 39.9], [140.0, 41.2], [139.0, 41.5], [137.2, 37.4], [136.0, 37.3],
   [133.3, 35.5], [131.6, 34.7]],
  [[140.0, 41.8], [141.6, 42.6], [144.2, 42.9], [145.8, 43.4], [145.2, 44.3], [143.0, 44.4],
   [141.6, 45.5], [140.4, 43.3], [140.0, 42.3]],
].map((ring) => [ring.map(([lon, lat]) => projF(lon, lat))]);

// ── 수계 화이트리스트 (ne_10m 이름). 규모 되는 것만 — 자잘한 지류 제외. ──
// 주의: ne_10m 에는 금강·영산강·섬진강·대동강·소양호·충주호·팔당호가 없다(하단 리스크 참고).
const RIVER_NAMES = new Set(['Han', 'Namhan', 'Nakdong', 'Yalu', 'Tumen', 'Tone']);
const LAKE_NAMES = new Set(['Biwa Ko', 'Supung Reservoir']);
// 맵 bbox(경위도) — 수계 피처 컬링용.
const inBBox = (lon, lat) => lon >= 122 && lon <= 147 && lat >= 29 && lat <= 47;

// ── DMZ 철조망 폴리라인 (오너 스펙 · [lon,lat]) ──
// 서→동 휴전선 근사. 양끝은 종단 세그먼트 방향으로 연장해 해안 sea 까지 닿게 한다.
const DMZ = [[126.68, 37.96], [127.0, 38.30], [127.5, 38.32], [128.1, 38.33], [128.35, 38.61]];
const DMZ_EXTEND = 20; // 타일 — 양끝을 종단 방향으로 이만큼 늘려 해안(sea) 밖까지 앵커.

// ── 영종대교: 영종도 ↔ 본토(인천 서구)를 잇는 bridge 라인 ([lon,lat]) ──
// 바다 위 통행 가능 타일. 실제 대교와 유사한 북동향 1라인.
const YEONGJONG_BRIDGE = [[126.53, 37.50], [126.62, 37.49]];

// ── 실행 ──
console.log('🗺️  build-map: 한반도+일본 열도 실비율 도트 맵 + 수계·DMZ·교량 생성');

// 1) 육지 소스 (10m 우선)
let source = 'FALLBACK(하드코딩 · 근사)';
let polys = null;
for (const [label, name] of [
  ['ne_10m', 'ne_10m_admin_0_countries'],
  ['ne_50m', 'ne_50m_admin_0_countries'],
  ['ne_110m', 'ne_110m_admin_0_countries'],
]) {
  console.log(`  · 시도: Natural Earth ${label} …`);
  const txt = fetchText(NE(name));
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
const usedFallback = !polys;
if (usedFallback) {
  console.warn('  ⚠️  네트워크 데이터 실패 → 하드코딩 폴백 사용(근사치 · 강화도/영종도 없음 · 후속 교체 필요)');
  polys = FALLBACK;
}
console.log(`  · 육지 데이터 경로: ${source}`);

const grid = rasterize(polys);
const removed = removeSmallIslands(grid);
let landCount = 0; for (const v of grid) if (v) landCount++;
console.log(`  · 래스터화: land ${landCount} 타일 / ${MAP_W * MAP_H} (소도서 ${removed} 타일 제거)`);

const setTile = (x, y, v) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) grid[y * MAP_W + x] = v; };
const getTile = (x, y) => (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) ? grid[y * MAP_W + x] : 0;

// 주요 지점(투영 산출) — 도시·공항·항만 + 랜드마크 고봉. 질감 분류 보호(POI 타일은 LAND 유지)에
// 미리 필요하므로 오버레이 이전에 정의한다. 검산은 실행 후반부에서 수행.
const POI = {
  SEOUL: projR(126.98, 37.57),
  INCHEON: projR(126.44, 37.46),        // 인천국제공항 (영종도)
  BUSAN: projR(129.07, 35.18),
  FUKUOKA: projR(130.40, 33.59),
  TOKYO: projR(139.69, 35.68),
  HANEDA: projR(139.78, 35.55),         // 하네다 공항
  GIMHAE_AIR: projR(128.938, 35.179),   // 김해국제공항
  BUSAN_TERMINAL: projR(129.040, 35.101), // 부산국제여객터미널
  FUKUOKA_PORT: projR(130.40, 33.60),   // 후쿠오카항
  BAEKDU: projR(128.056, 42.006),       // 백두산(설산 랜드마크 · DMZ 북측 · 도달 불가)
  FUJI: projR(138.727, 35.361),         // 후지산(설산 랜드마크)
};

// 2) 호수 오버레이 (code 3) — 폴리곤 래스터화.
let lakeCount = 0;
{
  const txt = fetchText(NE('ne_10m_lakes'));
  if (txt) {
    let gj = null; try { gj = JSON.parse(txt); } catch { /* noop */ }
    const lakePolys = [];
    for (const f of (gj?.features || [])) {
      if (!LAKE_NAMES.has(f.properties?.name)) continue;
      geomToPolys(f.geometry, lakePolys);
    }
    const lakeMask = rasterize(lakePolys);
    for (let i = 0; i < lakeMask.length; i++) if (lakeMask[i]) { grid[i] = TERRAIN.LAKE; lakeCount++; }
    console.log(`  · 호수: ${lakePolys.length}개 폴리곤 → ${lakeCount} 타일 (${[...LAKE_NAMES].join(', ')})`);
  } else {
    console.warn('  ⚠️  ne_10m_lakes 실패 → 호수 생략(육지/DMZ/교량은 유지)');
  }
}

// 3) 강 오버레이 (code 2) — 폴리라인 래스터화. land 위에만 그린다(바다로 새지 않게).
let riverCount = 0;
{
  const txt = fetchText(NE('ne_10m_rivers_lake_centerlines'));
  if (txt) {
    let gj = null; try { gj = JSON.parse(txt); } catch { /* noop */ }
    let lineN = 0;
    for (const f of (gj?.features || [])) {
      if (!RIVER_NAMES.has(f.properties?.name)) continue;
      const lines = [];
      geomToLines(f.geometry, lines);
      for (const line of lines) {
        // bbox 밖 라인 컬링(동명이하천 방지 — 중국 漢江 등).
        const lonlat = f.geometry.type === 'LineString'
          ? f.geometry.coordinates
          : f.geometry.coordinates.flat();
        if (!lonlat.some(([lo, la]) => inBBox(lo, la))) continue;
        lineN++;
        for (const [x, y] of polylineTiles(line)) {
          if (getTile(x, y) === TERRAIN.LAND) { setTile(x, y, TERRAIN.RIVER); riverCount++; }
        }
      }
    }
    console.log(`  · 강: ${lineN}개 라인 → ${riverCount} 타일 (${[...RIVER_NAMES].join(', ')})`);
  } else {
    console.warn('  ⚠️  ne_10m_rivers_lake_centerlines 실패 → 강 생략(육지/DMZ/교량은 유지)');
  }
}

// 4) DMZ 철조망 (code 4) — 하드코딩 폴리라인, 양끝 sea 앵커, land/river 위를 덮어씀.
let fenceCount = 0;
{
  const pts = DMZ.map(([lo, la]) => projF(lo, la));
  const extend = (far, near, dist) => {
    const dx = far[0] - near[0], dy = far[1] - near[1];
    const L = Math.hypot(dx, dy) || 1;
    return [far[0] + (dx / L) * dist, far[1] + (dy / L) * dist];
  };
  const chain = [
    extend(pts[0], pts[1], DMZ_EXTEND),
    ...pts,
    extend(pts[pts.length - 1], pts[pts.length - 2], DMZ_EXTEND),
  ];
  for (const [x, y] of polylineTiles(chain)) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    if (getTile(x, y) !== TERRAIN.FENCE) { setTile(x, y, TERRAIN.FENCE); fenceCount++; }
  }
  console.log(`  · DMZ 철조망: ${fenceCount} 타일 (서→동 연속)`);
}

// 5) 영종대교 (code 5) — bridge, sea 타일만 덮어씀(육지는 유지).
let bridgeCount = 0;
{
  const pts = YEONGJONG_BRIDGE.map(([lo, la]) => projF(lo, la));
  for (const [x, y] of polylineTiles(pts)) {
    if (getTile(x, y) === TERRAIN.SEA) { setTile(x, y, TERRAIN.BRIDGE); bridgeCount++; }
  }
  console.log(`  · 영종대교: ${bridgeCount} 타일 (바다 위 통행)`);
}

// 6) 지형 질감(고도) 레이어 — 순수 시각. MOUNTAIN·PEAK·PLAIN 전부 walkable(isBlocked 무변경).
//    land 타일에만 적용. river/lake/fence/bridge 및 POI·해안(모래)은 보존(고도가 덮어쓰지 않음).
let terrainSource = '';
let mCount = 0, pkCount = 0, plCount = 0;
{
  // 해안(바다)·강까지의 4-연결 거리 — PLAIN(저지대) 판정용.
  const distCoast = bfsDist((x, y) => getTile(x, y) === TERRAIN.SEA);
  const distRiver = bfsDist((x, y) => { const c = getTile(x, y); return c === TERRAIN.RIVER || c === TERRAIN.LAKE; });
  // POI 타일 보호(도시·공항·항만·랜드마크는 질감 분류 제외 — LAND 유지, isLandAt 계약 보존).
  const protectedIdx = new Set(Object.values(POI).map((p) => p.y * MAP_W + p.x));

  const elevData = fetchElevation();
  let mountainMask = null, peakMask = null;
  if (elevData) {
    terrainSource = `NOAA ETOPO 2022 60s (${elevData.source})`;
    console.log(`  · 고도 데이터: ${terrainSource} — 실측 그리드`);
  } else {
    terrainSource = '폴백 하드코딩 산맥 폴리라인(근사 · 실측 아님 · 후속 교체 필요)';
    console.warn('  ⚠️  ETOPO 고도 데이터 실패 → 폴백 산맥 폴리라인 브러시 사용(근사치 · 후속 교체 권장)');
    mountainMask = new Uint8Array(MAP_W * MAP_H);
    peakMask = new Uint8Array(MAP_W * MAP_H);
    const paint = (mask, pts, brush) => {
      for (const [x, y] of polylineTiles(pts.map(([lo, la]) => projF(lo, la)))) {
        for (let dy = -brush; dy <= brush; dy++) for (let dx = -brush; dx <= brush; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H) mask[ny * MAP_W + nx] = 1;
        }
      }
    };
    for (const r of MOUNTAIN_RANGES) paint(mountainMask, r, MOUNTAIN_BRUSH);
    for (const [lo, la] of PEAK_POINTS_FALLBACK) {
      const { x, y } = projR(lo, la);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H) peakMask[ny * MAP_W + nx] = 1;
      }
    }
  }

  // land 타일 질감 분류: ≥1200m PEAK · ≥400m MOUNTAIN · ≤80m & (강≤3 또는 해안≤5) PLAIN.
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const idx = ty * MAP_W + tx;
      if (grid[idx] !== TERRAIN.LAND) continue;          // land 타일만(수계·철조망·교량 보존)
      if (protectedIdx.has(idx)) continue;               // POI 보호
      // 해안(바다 인접) land 는 렌더가 모래(sand)로 처리 → LAND 유지(sand 우선순위).
      const seaAdj = getTile(tx - 1, ty) === TERRAIN.SEA || getTile(tx + 1, ty) === TERRAIN.SEA
        || getTile(tx, ty - 1) === TERRAIN.SEA || getTile(tx, ty + 1) === TERRAIN.SEA;
      if (seaAdj) continue;
      let code = TERRAIN.LAND;
      if (elevData) {
        const e = elevData.elev[idx];
        if (Number.isFinite(e)) {
          if (e >= 1200) code = TERRAIN.PEAK;
          else if (e >= 400) code = TERRAIN.MOUNTAIN;
          else if (e <= 80 && (distRiver[idx] <= 3 || distCoast[idx] <= 5)) code = TERRAIN.PLAIN;
        }
      } else if (peakMask[idx]) code = TERRAIN.PEAK;
      else if (mountainMask[idx]) code = TERRAIN.MOUNTAIN;
      else if (distRiver[idx] <= 3 || distCoast[idx] <= 5) code = TERRAIN.PLAIN;
      if (code !== TERRAIN.LAND) {
        grid[idx] = code;
        if (code === TERRAIN.MOUNTAIN) mCount++; else if (code === TERRAIN.PEAK) pkCount++; else plCount++;
      }
    }
  }

  // 백두산·후지산 — 타일+1링 PEAK 보장 + POI. (DMZ 북측 백두산은 도달 불가 — 철조망 너머 보이는 설산, 의도)
  for (const lm of LANDMARKS) {
    const { x, y } = projR(lm.lon, lm.lat);
    const was = getTile(x, y);
    grid[y * MAP_W + x] = TERRAIN.PEAK;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx, c = grid[ni];
      // 1링은 land 계열만 PEAK 로(바다를 설산으로 만들지 않게). 중심은 무조건 보장.
      if (c === TERRAIN.LAND || c === TERRAIN.MOUNTAIN || c === TERRAIN.PLAIN || c === TERRAIN.PEAK) grid[ni] = TERRAIN.PEAK;
    }
    console.log(`    랜드마크 ${lm.name}: (${x},${y}) 원래코드=${was} → PEAK 보장 (${was === TERRAIN.SEA ? '⚠️ 원래 바다' : 'land'})`);
  }
  console.log(`  · 지형 질감 경로: ${terrainSource}`);
  console.log(`  · 질감 분류: MOUNTAIN=${mCount} PEAK(분류)=${pkCount} PLAIN=${plCount}`);
}

// 지형 타일 통계
const counts = {};
for (const v of grid) counts[v] = (counts[v] || 0) + 1;
console.log('  · 지형 통계:', JSON.stringify({
  sea: counts[0] || 0, land: counts[1] || 0, river: counts[2] || 0,
  lake: counts[3] || 0, fence: counts[4] || 0, bridge: counts[5] || 0,
  mountain: counts[6] || 0, peak: counts[7] || 0, plain: counts[8] || 0,
}));

// 주요 지점 검산(POI 는 상단에서 정의 — 질감 분류 보호용).
console.log('  · 주요 지점(투영):', JSON.stringify(POI));
const walkable = (p) => {
  const v = getTile(p.x, p.y);
  return v !== TERRAIN.SEA && v !== TERRAIN.FENCE; // isBlocked 와 동일(mountain·peak·plain 포함 통행 가능)
};
for (const [k, p] of Object.entries(POI)) {
  console.log(`    ${k}: (${p.x}, ${p.y}) → ${walkable(p) ? 'walkable' : 'BLOCKED(!)'}`);
}
// 검산: 스펙 명시값
const chk = (name, got, want) => console.log(`    검산 ${name}: (${got.x},${got.y}) ${got.x === want[0] && got.y === want[1] ? '✓' : '✗ 기대 ' + want}`);
chk('서울', POI.SEOUL, [68, 208]);
chk('도쿄', POI.TOKYO, [316, 255]);
chk('부산', POI.BUSAN, [109, 267]);
chk('인천공항(영종도)', POI.INCHEON, [57, 211]);
chk('김해공항', POI.GIMHAE_AIR, [106, 267]);
chk('부산여객터미널', POI.BUSAN_TERMINAL, [108, 269]);

// RLE 왕복 검증
const rle = encodeRLE(grid);
const back = decodeRLE(rle);
let ok = back.length === grid.length;
for (let i = 0; ok && i < grid.length; i++) if (back[i] !== grid[i]) ok = false;
console.log(`  · RLE 왕복 무결성: ${ok ? '✓' : '✗ 불일치'} · 인코딩 길이 ${rle.length}자 (${(rle.length / 1024).toFixed(1)} KB)`);
if (!ok) { console.error('RLE 왕복 실패 — 중단'); process.exit(1); }

// ── mapData.js 산출 ──
const banner = `// ⚠️ 자동 생성 파일 — 직접 수정 금지. 재생성: node scripts/world/build-map.mjs
// 한반도+일본 열도 실비율 도트 맵 (${MAP_W}×${MAP_H} 타일, 1타일=4.5km) + 수계·DMZ·교량·지형 질감.
// 육지 데이터 경로: ${source}
// 수계: ne_10m_rivers_lake_centerlines · ne_10m_lakes / DMZ·교량: 하드코딩 지오메트리.
// 지형 질감(산지·고산·평야) 경로: ${terrainSource}
// 투영: 등장방형(위도 고정 cos38°) x=(lon-${LON0})×${KX}, y=(${LAT0}-lat)×${KY}.`;

const poiLines = Object.entries(POI)
  .map(([k, p]) => `  ${k}: { x: ${p.x}, y: ${p.y} },`).join('\n');

const js = `${banner}

// 격자 크기(타일). 1타일 = 32 월드 px (버스 계약 불변).
export const MAP_W = ${MAP_W};
export const MAP_H = ${MAP_H};

// ── 지형 코드 (게임플레이 그룹과 합의된 고정 계약) ──
// 0=sea(차단) 1=land 2=river(통행 가능 물) 3=lake(통행 가능 물) 4=fence(DMZ, 차단) 5=bridge(바다 위 통행).
// 6=mountain 7=peak(고산/설산) 8=plain — 순수 시각 질감 레이어(전부 walkable · isBlocked 무변경).
export const TERRAIN = {
  SEA: 0, LAND: 1, RIVER: 2, LAKE: 3, FENCE: 4, BRIDGE: 5,
  MOUNTAIN: 6, PEAK: 7, PLAIN: 8,
};

// 통행 차단 여부 — sea·fence 만 막는다(river·lake·bridge·mountain·peak·plain 는 걸어서 통과 가능).
export function isBlocked(code) {
  return code === TERRAIN.SEA || code === TERRAIN.FENCE;
}

// ── 지리 상수 (등장방형 투영) ──
export const GEO = { LON0: ${LON0}, LAT0: ${LAT0}, KX: ${KX}, KY: ${KY} };

// [lon,lat] → 타일 좌표(반올림). 예) 서울(126.98,37.57)→(68,208), 도쿄(139.69,35.68)→(316,255).
export function project(lon, lat) {
  return {
    x: Math.round((lon - GEO.LON0) * GEO.KX),
    y: Math.round((GEO.LAT0 - lat) * GEO.KY),
  };
}

// 타일 좌표 → [lon, lat] — project() 의 역함수(역투영).
export function unproject(tx, ty) {
  return {
    lon: tx / GEO.KX + GEO.LON0,
    lat: GEO.LAT0 - ty / GEO.KY,
  };
}

// 주요 지점(투영 산출값). 공항·항만·도심.
export const POI = {
${poiLines}
};

// 다치 행 단위 RLE: 각 행은 런들, 런='<값 1자리><길이 base36>', 런은 ',' · 행은 ';' 구분.
export const MAP_RLE = ${JSON.stringify(rle)};

// RLE → Uint8Array(TERRAIN 코드 0~8), 길이 MAP_W*MAP_H. 결정적.
export function decodeMap() {
  const grid = new Uint8Array(MAP_W * MAP_H);
  const rows = MAP_RLE.split(';');
  for (let y = 0; y < MAP_H; y++) {
    let x = 0;
    const parts = rows[y].split(',');
    for (let k = 0; k < parts.length; k++) {
      const tok = parts[k];
      const val = tok.charCodeAt(0) - 48;
      const n = parseInt(tok.slice(1), 36);
      for (let i = 0; i < n; i++) grid[y * MAP_W + x++] = val;
    }
  }
  return grid;
}

// 타일 land(육지 1) 여부(범위 밖 = sea). river·lake·fence·bridge 는 land 가 아니다.
export function isLandAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  return grid[ty * MAP_W + tx] === TERRAIN.LAND;
}
`;

writeFileSync(OUT, js);
const bytes = Buffer.byteLength(js, 'utf8');
console.log(`  · 산출: ${OUT}`);
console.log(`  · 파일 크기: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
if (bytes > 30 * 1024) console.warn('  ⚠️  파일 30KB 초과 — 다치 RLE 인코딩 개선 검토 필요');
if (usedFallback) console.warn('  ⚠️  폴백 경로였음 — 강화도/영종도/영종대교가 실데이터가 아닐 수 있음(재실행 권장).');
console.log('✅ 완료');
