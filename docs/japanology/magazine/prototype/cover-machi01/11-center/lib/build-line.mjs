// 一つの町 01 富士吉田 표지 「一本の線」 — 판면(A4 mm) 직접 투영 (2026-10-15 KST, 지도 제작 2단계)
// 11-center 사본: 10-mh/covers/lib/build-line.mjs와 같다(프로필 mh). 이 폴더의 build.mjs가 金鳥居 y·꼭짓점 y를 넘긴다.
// 10-mh/covers 사본: 05-compose/build-line.mjs에 프로필 mh 추가. mh = v3 기하(축척 11.3·평탄 7.7·필렛 2.5·선 3.4·능선 1.6)에서
//   金鳥居 판면 y와 산 꼭짓점 y만 인자로 옮긴다(평행 이동 — 실측 형상·방위·축척 불변). 사용: node build-line.mjs <fy.json> <outDir> mh <toriiY> <apexY>
// 05-compose 사본: 02-map/build-line.mjs에서 SUMMIT·ORIGIN 주석만 바꿈(산정 = 국토지리원 剣ヶ峯 CSV 값). 나머지 코드 동일.
// 입력: Overpass JSON (out geom) — build-map.mjs와 같은 스냅샷(osm_base 2026-07-28 11:16 KST).
// 사용: node build-line.mjs <fy.json> <outDir>
// 데이터: © OpenStreetMap contributors, ODbL 1.0.
//
// 투영은 build-map.mjs와 동일: 金鳥居 원점 국소 정거(미터) → 剣ヶ峰 방위가 판면 위(-y).
// 다른 점은 상수뿐: 원점을 판면 (126,200)mm에, 축척은 富士みち 남단(上宿 교차점)이 y≈118에
// 오도록 역산(아래 M_PER_MM 주석). 판면 좌표 = mm, 왼쪽 위 원점, 재단 포함 -3..213 × -3..300.
import fs from 'node:fs';
import path from 'node:path';

const [file, outDir = '.', profileName = 'v1', argToriiY, argApexY] = process.argv.slice(2);
// 판본 상수(v1 = 2026-10-15 1차 조립, v2 = 편집장 수정 지시: 축척 11.3·산 y56·평탄 7.7·선 3.0·능선 1.4). 기본값 v1 → v1 출력은 바이트 동일.
const PROFILES = {
  v1: { mPerMm: 12.9, topTargetY: 118, apexY: 46, flat: 8, lineW: 2.4, ridgeW: 1 },
  v2: { mPerMm: 11.3, topTargetY: 106, apexY: 56, flat: 7.7, lineW: 3, ridgeW: 1.4 },
  // v3(07-refine ①, 2026-10-15 KST): 선 3.4·능선 1.6(굵기 비 2.1 유지), 평탄부 양 모서리 원호 필렛 반경 2.5mm. 기하·축척은 v2와 같다.
  v3: { mPerMm: 11.3, topTargetY: 106, apexY: 56, flat: 7.7, lineW: 3.4, ridgeW: 1.6, filletR: 2.5 },
  mh: { mPerMm: 11.3, topTargetY: +argToriiY - 93.4, apexY: +argApexY, flat: 7.7, lineW: 3.4, ridgeW: 1.6, filletR: 2.5, toriiY: +argToriiY },
};
const PF = PROFILES[profileName];
if (!PF) throw new Error('profile: v1 | v2 | v3');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const ORIGIN = { lat: 35.4832112, lon: 138.7979629 }; // 金鳥居 — OSM way 1482786848 두 기둥 중점(04-factcheck §4)
const SUMMIT = { lat: 35.360738, lon: 138.727373 };   // 剣ヶ峯 — 국토지리원 「日本の主な山岳標高（1003山）」 CSV 2026-03-31판 396행(편집장 결정 2026-10-15 KST, 04-factcheck §1)
const CRATER = { lat: 35.3627, lon: 138.7310 };       // 분화구(大内院) 중심 근사(±100m) — 팩트 검수 5용
const KITAGUCHI = { lat: 35.47101, lon: 138.79264 };  // 北口本宮冨士浅間神社 (Nominatim, build-map.mjs와 동일)
const PAGE = { x: 126, y: PF.toriiY || 200 };                      // 金鳥居의 판면 위치(AD §3)
const TOP_TARGET_Y = PF.topTargetY;                             // 선 끝(富士みち 남단)의 판면 y(AD §3)
const BLEED = { x0: -3, y0: -3, x1: 213, y1: 300 };   // 재단 포함 판면(위·좌 -3, 아래 300, 우 213)
// 축척: 金鳥居 y=200과 선 끝 y≈118 두 조건에서 역산한 값은 1055.0m/82mm = 12.87m/mm.
// AD의 1mm≈17.5m로는 선 끝이 y≈139.7에 오고 아래 재단에 下吉田 꺾임(下吉田停車場線 교차, y≈281)이
// 들어오므로 두 위치 조건과 「아래 끝은 꺾임점 위」 조건을 모두 깨뜨린다. 위치 조건을 우선해 12.9로 둔다.
const M_PER_MM = PF.mPerMm; // v1 12.9 · v2 11.3(편집장 수정 지시 2: 上宿를 산 쪽으로, 下吉田 굽음을 재단 밖으로)

const R = 6371008, rad = Math.PI / 180;
const local = (lat, lon) => ({
  e: (lon - ORIGIN.lon) * rad * R * Math.cos(ORIGIN.lat * rad),
  n: (lat - ORIGIN.lat) * rad * R,
});
const s = local(SUMMIT.lat, SUMMIT.lon);
const beta = Math.atan2(s.e, s.n); // 북에서 시계 방향 = 판면 '위'의 방위
const up = { e: Math.sin(beta), n: Math.cos(beta) };
const right = { e: Math.cos(beta), n: -Math.sin(beta) };
const project = (lat, lon) => {
  const p = local(lat, lon);
  return { x: PAGE.x + (p.e * right.e + p.n * right.n) / M_PER_MM, y: PAGE.y - (p.e * up.e + p.n * up.n) / M_PER_MM };
};
const deg = (r) => r / rad;
const norm360 = (a) => ((a % 360) + 360) % 360;
// 판면 벡터 → 방위(북에서 시계 방향)
const pageBearing = (a, b) => norm360(deg(beta) + deg(Math.atan2(b.x - a.x, -(b.y - a.y))));
// 측지 초기 방위(구면) — 국소 투영 방위와 교차 확인용
const gcBearing = (a, b) => {
  const f1 = a.lat * rad, f2 = b.lat * rad, dl = (b.lon - a.lon) * rad;
  return norm360(deg(Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl))));
};
const gcDist = (a, b) => {
  const f1 = a.lat * rad, f2 = b.lat * rad, df = f2 - f1, dl = (b.lon - a.lon) * rad;
  const h = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
// 점열의 전최소제곱(주성분) 방향 → 방위(진행 방향은 first→last 쪽)
const tlsBearing = (pts) => {
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let v = { x: Math.cos(th), y: Math.sin(th) };
  const d = { x: pts.at(-1).x - pts[0].x, y: pts.at(-1).y - pts[0].y };
  if (v.x * d.x + v.y * d.y < 0) v = { x: -v.x, y: -v.y };
  return pageBearing({ x: 0, y: 0 }, v);
};
const r2 = (v, k = 2) => Number(v.toFixed(k));

// ---- 1. 富士みち 웨이 잇기(노드 공유로 사슬 구성, 남단부터) ----
const ways = data.elements.filter((e) => e.type === 'way' && e.tags?.name === '富士みち' && e.geometry);
const deg1 = new Map();
for (const w of ways) for (const n of [w.nodes[0], w.nodes.at(-1)]) deg1.set(n, (deg1.get(n) || 0) + 1);
const ends = [...deg1].filter(([, c]) => c === 1).map(([n]) => n);
// 남단 = 끝점 중 위도가 낮은 쪽
const nodePos = new Map();
for (const w of ways) w.nodes.forEach((n, i) => nodePos.set(n, w.geometry[i]));
const south = ends.sort((a, b) => nodePos.get(a).lat - nodePos.get(b).lat)[0];
const chain = []; const used = new Set(); let cur = south;
for (;;) {
  const w = ways.find((w) => !used.has(w.id) && (w.nodes[0] === cur || w.nodes.at(-1) === cur));
  if (!w) break;
  used.add(w.id);
  let idx = w.nodes.map((n, i) => ({ node: n, ...w.geometry[i], way: w.id }));
  if (idx[0].node !== cur) idx.reverse();
  chain.push(...(chain.length ? idx.slice(1) : idx));
  cur = idx.at(-1).node;
}
// 북동 끝(河口湖 반대쪽, 판면 밖 수 km)에 노드 불일치로 끊긴 웨이가 있을 수 있다 — 판면 구간과 무관하므로 기록만.
const unchained = ways.filter((w) => !used.has(w.id)).map((w) => w.id);
const wayOrder = [...used];

// 판면 투영(남단 → 북)
const P = chain.map((c) => ({ ...c, ...project(c.lat, c.lon) }));
const byNode = (n) => P.find((p) => p.node === n);
const N = { top: 2097712407, toriiJ: 286755079, shimoBend: 286755062, editorN: 286755066 };

// ---- 2. 아래 재단(y=300)에서 자르기 — 실데이터 노드 사이 보간, 연장 없음 ----
const drawn = [];
for (let i = 0; i < P.length; i++) {
  const p = P[i];
  if (p.y <= BLEED.y1) { drawn.push({ x: p.x, y: p.y, node: p.node }); continue; }
  const a = P[i - 1], t = (BLEED.y1 - a.y) / (p.y - a.y);
  drawn.push({ x: a.x + t * (p.x - a.x), y: BLEED.y1, node: `clip(${a.node}→${p.node})`, clipT: t });
  break;
}

// 金鳥居 지점을 선 위 꼭짓점으로 삽입(도로 중심선이 y=200을 지나는 점)
let toriiOnLine = null;
for (let i = 1; i < drawn.length; i++) {
  const a = drawn[i - 1], b = drawn[i];
  if ((a.y - PAGE.y) * (b.y - PAGE.y) <= 0 && a.y !== b.y) {
    const t = (PAGE.y - a.y) / (b.y - a.y);
    toriiOnLine = { x: a.x + t * (b.x - a.x), y: PAGE.y, seg: [a.node, b.node] };
    drawn.splice(i, 0, { ...toriiOnLine, node: 'torii' });
    break;
  }
}

// ---- 3. 단순화(Douglas–Peucker) + 방향 오차 검사 ----
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const keepAlways = new Set(['torii', N.top]);
const dp = (pts, eps) => {
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  pts.forEach((p, i) => { if (keepAlways.has(p.node)) keep[i] = true; });
  const rec = (i, j) => {
    let m = -1, md = 0;
    for (let k = i + 1; k < j; k++) { const d = segDist(pts[k], pts[i], pts[j]); if (d > md) { md = d; m = k; } }
    if (md > eps) { keep[m] = true; rec(i, m); rec(m, j); }
  };
  const idx = keep.map((k, i) => (k ? i : -1)).filter((i) => i >= 0);
  for (let q = 1; q < idx.length; q++) rec(idx[q - 1], idx[q]);
  return pts.filter((_, i) => keep[i]);
};
const angDiff = (a, b) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };
// 방향 오차 = 단순화 선의 각 구간 방위 vs 그 구간이 덮는 원래 점들의 주성분 방위(3점 이상일 때)
//           + 원래 구간 중 판면 길이 ≥1.5mm(≈19m)인 것의 방위 vs 그것을 덮는 단순화 구간 방위
const simplifyErr = (orig, simp) => {
  let maxDev = 0, maxAng = 0, maxAngLong = 0;
  let j = 0;
  for (let k = 1; k < simp.length; k++) {
    const a = simp[k - 1], b = simp[k];
    const i0 = orig.indexOf(a), i1 = orig.indexOf(b);
    const span = orig.slice(i0, i1 + 1);
    for (const p of span) maxDev = Math.max(maxDev, segDist(p, a, b));
    const sb = pageBearing(a, b);
    if (span.length >= 3) maxAng = Math.max(maxAng, angDiff(tlsBearing(span), sb));
    for (let q = i0 + 1; q <= i1; q++) {
      const L = Math.hypot(orig[q].x - orig[q - 1].x, orig[q].y - orig[q - 1].y);
      if (L >= 1.5) maxAngLong = Math.max(maxAngLong, angDiff(pageBearing(orig[q - 1], orig[q]), sb));
    }
    j = i1;
  }
  return { maxDevMm: maxDev, maxDevM: maxDev * M_PER_MM, maxSpanAngDeg: maxAng, maxLongSegAngDeg: maxAngLong };
};
let EPS = 0.12, simp, err;
for (;;) {
  simp = dp(drawn, EPS); err = simplifyErr(drawn, simp);
  if (err.maxSpanAngDeg <= 0.5 && err.maxLongSegAngDeg <= 0.5) break;
  EPS = +(EPS - 0.01).toFixed(3);
  if (EPS <= 0) { simp = drawn; err = simplifyErr(drawn, drawn); break; }
}

// ---- 4. 검증 수치 ----
const top = byNode(N.top), bend = byNode(N.shimoBend), edN = byNode(N.editorN);
const bottom = drawn[0] === undefined ? null : drawn.at(-1);
const T = { x: PAGE.x, y: PAGE.y };
const summitBrg = deg(beta) < 0 ? deg(beta) + 360 : deg(beta);
const crater = project(CRATER.lat, CRATER.lon);
const toriiGeo = ORIGIN;
const idxTop = 0, idxT = drawn.findIndex((p) => p.node === 'torii');
const metrics = {
  scale: { mPerMm: M_PER_MM, ratio: `1:${Math.round(M_PER_MM * 1000)}`, fitFromPositions: r2((PAGE.y - TOP_TARGET_Y) ? (-(top.y - PAGE.y) * M_PER_MM) / (PAGE.y - TOP_TARGET_Y) : 0, 3) },
  origin: { geo: ORIGIN, page: PAGE, note: '金鳥居(35.4832112,138.7979629)가 판면 (126,200)' },
  summitBearingDeg: r2(summitBrg, 2),
  summitDistM: Math.round(gcDist(ORIGIN, SUMMIT)),
  summitBearingGcDeg: r2(gcBearing(ORIGIN, SUMMIT), 2),
  craterCenterBearingDeg: r2(gcBearing(ORIGIN, CRATER), 2),
  craterVsKengamineDeg: r2(gcBearing(ORIGIN, CRATER) - gcBearing(ORIGIN, SUMMIT), 2),
  lineTopEnd: { node: N.top, geo: { lat: top.lat, lon: top.lon }, page: { x: r2(top.x), y: r2(top.y) }, note: 'OSM 富士みち 남단 = 国道138号와 만나는 교차점(上宿)' },
  kitaguchiPin: { page: (({ x, y }) => ({ x: r2(x), y: r2(y) }))(project(KITAGUCHI.lat, KITAGUCHI.lon)), distFromTopEndM: Math.round(gcDist(KITAGUCHI, { lat: top.lat, lon: top.lon })) },
  bottomClip: { page: { x: r2(bottom.x), y: r2(bottom.y) }, between: bottom.node, upM: r2(-(bottom.y - PAGE.y) * M_PER_MM, 1) },
  shimoyoshidaBend: { node: N.shimoBend, geo: { lat: bend.lat, lon: bend.lon }, page: { x: r2(bend.x), y: r2(bend.y) }, note: '下吉田停車場線 교차, 여기서 富士みち가 북동으로 꺾임 — 판면 밖' },
  toriiOnCenterline: { page: { x: r2(toriiOnLine.x, 3), y: toriiOnLine.y }, offsetFromToriiPointM: r2((toriiOnLine.x - PAGE.x) * M_PER_MM, 2) },
  bearings: {
    overallDrawn_bottomToTop: r2(pageBearing(bottom, top)),
    overallDrawn_tls: r2(tlsBearing(drawn.slice().reverse())),
    toriiToTop_chord: r2(pageBearing(T, top)),
    toriiToTop_tls: r2(tlsBearing(drawn.slice(0, idxT + 1).reverse())),
    bottomToTorii_chord: r2(pageBearing(bottom, T)),
    bottomToTorii_tls: r2(tlsBearing(drawn.slice(idxT).reverse())),
    shimoBendToTorii_chord_osm: r2(pageBearing(bend, T)),
    editor_408_to_topEnd_osm: r2(pageBearing(edN, top)),
    editor_408_to_topEnd_gc: r2(gcBearing({ lat: edN.lat, lon: edN.lon }, { lat: top.lat, lon: top.lon })),
    toriiToTop_gc: r2(gcBearing(ORIGIN, { lat: top.lat, lon: top.lon })),
  },
};
const B = metrics.bearings;
metrics.diffFromSummit = Object.fromEntries(Object.entries(B).map(([k, v]) => [k, r2(v - summitBrg)]));
// 선(또는 연장)이 꼭짓점 높이 y=46에서 어디를 지나나
const APEX = { x: 126, y: PF.apexY };
const hitAt = (a, b, y) => a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
metrics.apexMiss = {
  apex: APEX,
  topEndOffsetX: r2(top.x - APEX.x),
  extend_overallChord_atY46: r2(hitAt(bottom, top, APEX.y) - APEX.x),
  extend_toriiToTop_atY46: r2(hitAt(T, top, APEX.y) - APEX.x),
  extend_lastSegment_atY46: (() => { const a = drawn[1], b = drawn[0]; return r2(hitAt(a, b, APEX.y) - APEX.x); })(),
  note: '+ = 꼭짓점 오른쪽(mm). 略図이므로 y=46은 실거리 15.06km가 아님 — 각도만 같다고 가정한 외삽',
};

// 金鳥居 막대: 도로 접선(±40m 노드 구간·±150m 주성분)에 직교
const tanLocal = pageBearing(...toriiOnLine.seg.map((n) => drawn.find((p) => p.node === n)).reverse());
const win = drawn.filter((p) => Math.abs(p.y - PAGE.y) * M_PER_MM <= 150);
const tanWin = tlsBearing(win.slice().reverse());
const tanRelLocal = tanLocal - summitBrg, tanRelWin = tanWin - summitBrg;
const torii = {
  geo: ORIGIN,
  page: { x: PAGE.x, y: PAGE.y },
  roadBearingDeg: { localSegment: r2(tanLocal), window150m: r2(tanWin) },
  roadAngleFromVerticalDeg: { localSegment: r2(tanRelLocal), window150m: r2(tanRelWin), sense: '+ = 위로 갈수록 오른쪽' },
  bar: {
    w: 18, h: 2.4,
    rotateDeg: r2(tanRelWin, 1),
    svg: `<rect x="-9" y="-1.2" width="18" height="2.4" transform="translate(${PAGE.x} ${PAGE.y}) rotate(${r2(tanRelWin, 1)})" fill="#d4462a"/>`,
    note: 'SVG rotate(+θ)=시계 방향. 막대 방향 = 도로 방위−90°(지리 방위 ' + r2(norm360(tanWin - 90), 1) + '°↔' + r2(norm360(tanWin + 90), 1) + '°)',
  },
};

// ---- 5. 산 능선 略図 ----
// 평탄부 x 122..130 @ y46, 양 사면은 같은 함수(대칭). 기울기 30°(테두리) → 12°(왼쪽 재단 d=125).
// tanθ(d) = t1 + (t0−t1)(1−d/D)^p · 테두리 1.2mm 필렛. p는 왼쪽 재단 y=104가 되도록 이분법.
// 剣ヶ峰은 분화구 서쪽 테두리 — 金鳥居에서 보면 분화구 중심보다 오른쪽. 그 비켜남을 평탄부(=분화구 지름 약 800m로 간주)
// 안에 비례 배치해 x=126(剣ヶ峰 방위선)이 평탄부의 실제 剣ヶ峰 자리에 오게 한다(평탄 중심은 왼쪽으로 이동).
const CRATER_R_M = 400; // 火口 지름 약 800m(통설, 근사)
const kenRightM = (() => { const c = local(CRATER.lat, CRATER.lon), k = s; const dx = k.e - c.e, dn = k.n - c.n; return dx * right.e + dn * right.n; })();
const KEN_IN_FLAT_MM = (PF.flat / 2) * kenRightM / CRATER_R_M;
const RIDGE = { ken: 126, cx: 126 - KEN_IN_FLAT_MM, y: PF.apexY, flat: PF.flat, leftBleedY: PF.apexY + 58 };
const t0 = Math.tan(30 * rad), t1 = Math.tan(12 * rad);
const DL = (RIDGE.cx - RIDGE.flat / 2) - BLEED.x0; // ≈123
const DR = BLEED.x1 - (RIDGE.cx + RIDGE.flat / 2); // ≈85
const FIL = PF.filletR ? 0 : 1.2; // v1·v2: 사면 기울기를 1.2mm에 걸쳐 smoothstep. v3: 각진 모서리를 만든 뒤 아래에서 원호 필렛
const slope = (d, p) => { const sm = FIL ? Math.min(1, d / FIL) : 1; const ss = sm * sm * (3 - 2 * sm); return ss * (t1 + (t0 - t1) * Math.pow(Math.max(0, 1 - d / DL), p)); };
const drop = (D, p, step = 0.05) => { let y = 0; for (let d = 0; d < D; d += step) y += slope(d + step / 2, p) * step; return y; };
let lo = 0.05, hi = 5;
for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (drop(DL, m) > RIDGE.leftBleedY - RIDGE.y) lo = m; else hi = m; } // p↑ → 낙차↓
const pSolved = (lo + hi) / 2;
const makeRidge = (pExp) => {
  const sideTo = (D, sign) => { const out = []; let y = 0, d = 0; const step = 0.05; let next = 0;
    while (d < D - 1e-9) { if (d >= next - 1e-9) { out.push({ d, y }); next += d < 6 ? 0.5 : 2; } y += slope(d + step / 2, pExp) * step; d += step; }
    out.push({ d: D, y }); return out.map((q) => ({ x: RIDGE.cx + sign * (RIDGE.flat / 2 + q.d), y: RIDGE.y + q.y })); };
  const left = sideTo(DL, -1).reverse(), rightSide = sideTo(DR, +1);
  let d = [...left, ...rightSide].map((q, i) => `${i ? 'L' : 'M'}${r2(q.x)} ${r2(q.y)}`).join('');
  if (PF.filletR) {
    // 평탄부 양 끝 꺾임(사면 테두리 30°)에 반경 R 원호. 접선 길이 t = R·tan(θ/2). 평탄부 폭·꼭짓점·剣ヶ峯 방위선은 그대로.
    const R = PF.filletR, th = Math.atan(slope(1e-6, pExp)), t = R * Math.tan(th / 2);
    const dCut = t * Math.cos(th);                       // 사면 쪽 접점의 수평 거리(사면은 0.6mm 안에서 사실상 직선)
    const yCut = RIDGE.y + drop(dCut, pExp, 0.005);
    const xl = RIDGE.cx - RIDGE.flat / 2, xr = RIDGE.cx + RIDGE.flat / 2;
    const L0 = left.filter((q) => q.x < xl - dCut - 1e-9), R0 = rightSide.filter((q) => q.x > xr + dCut + 1e-9);
    const pt = (x, y) => `${r2(x)} ${r2(y)}`;
    d = L0.map((q, i) => `${i ? 'L' : 'M'}${pt(q.x, q.y)}`).join('') +
      `L${pt(xl - dCut, yCut)}A${R} ${R} 0 0 1 ${pt(xl + t, RIDGE.y)}L${pt(xr - t, RIDGE.y)}A${R} ${R} 0 0 1 ${pt(xr + dCut, yCut)}` +
      R0.map((q) => `L${pt(q.x, q.y)}`).join('');
  }
  const slopeAt = (dd) => deg(Math.atan(slope(dd, pExp)));
  return { d, info: {
    kengamine: { x: RIDGE.ken, y: RIDGE.y }, kenRightOfCraterCenterM: r2(kenRightM, 0), flatCenterX: r2(RIDGE.cx), flat: [r2(RIDGE.cx - RIDGE.flat / 2), r2(RIDGE.cx + RIDGE.flat / 2)],
    ...(PF.filletR ? { filletR: PF.filletR } : {}), exponentP: r2(pExp, 3), leftBleed: { x: BLEED.x0, y: r2(left[0].y) }, rightBleed: { x: BLEED.x1, y: r2(rightSide.at(-1).y) },
    slopeDeg: { rim: 30, d10: r2(slopeAt(10), 1), d40: r2(slopeAt(40), 1), rightBleed: r2(slopeAt(DR), 1), leftBleed: r2(slopeAt(DL - 0.01), 1) },
    lineExtensionHitsRidge: (() => { const k = (PAGE.x - top.x) / (PAGE.y - top.y); for (let y = RIDGE.y; y < PAGE.y; y += 0.01) { const xx = PAGE.x - (PAGE.y - y) * k; const d = xx - (RIDGE.cx + RIDGE.flat / 2); const ry = RIDGE.y + (d > 0 ? drop(d, pExp, 0.1) : 0); if (y >= ry) return { x: r2(xx), y: r2(y), rightOfKengamineMm: r2(xx - RIDGE.ken) }; } return null; })(),
    ridgeYAtLineTopEndX: r2(RIDGE.y + drop(Math.max(0, top.x - (RIDGE.cx + RIDGE.flat / 2)), pExp)),
  } };
};
// A안(본): AD 수치 그대로 — 왼쪽 재단 y=104가 되도록 p를 역산. 대칭이므로 오른쪽 재단은 y<104.
// B안(대안): p=1(기울기 탄젠트가 거리에 비례해 30°→12°) — 오목이 더 고르게 보이나 왼쪽 재단이 y≈95.
const ridgeA = makeRidge(pSolved), ridgeB = makeRidge(1);
const ridge = { recommended: 'B', A: ridgeA.info, B: ridgeB.info };

// ---- 6. 출력 ----
const f = (v) => v.toFixed(2).replace(/\.?0+$/, '');
const lineD = simp.slice().reverse().map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('');
// 위 끝(선 끝)부터 아래 재단까지 — 그리는 순서: 아래(재단) → 위(北口本宮 쪽)
const lineDup = simp.slice().reverse();
const lineSvg = `<!-- 富士みち 중심선 · OSM way ${wayOrder.join(',')} 중 판면 구간 · © OpenStreetMap contributors (ODbL) · osm_base 2026-07-28 11:16 KST -->\n<path d="${lineD}" fill="none" stroke="#d4462a" stroke-width="${PF.lineW}" stroke-linejoin="round" stroke-linecap="butt"/>\n`;
const ridgeSvg = (r, tag) => `<!-- 산 능선 略図 ${tag}(축척 밖) · 剣ヶ峰 ${RIDGE.ken},${RIDGE.y}(평탄 ${r2(RIDGE.cx - RIDGE.flat / 2)}–${r2(RIDGE.cx + RIDGE.flat / 2)}) · 평탄 ${RIDGE.flat}mm · 사면 30°→12° 오목·좌우 대칭 · 좌 재단 y${r.info.leftBleed.y} 우 재단 y${r.info.rightBleed.y} -->\n<path d="${r.d}" fill="none" stroke="#151b2c" stroke-width="${PF.ridgeW}" stroke-linejoin="round" stroke-linecap="butt"/>\n`;
fs.writeFileSync(path.join(outDir, 'line.svg.txt'), lineSvg);
fs.writeFileSync(path.join(outDir, 'ridge.svg.txt'), ridgeSvg(ridgeB, 'B(권장, p=1)'));
fs.writeFileSync(path.join(outDir, 'ridge-alt.svg.txt'), ridgeSvg(ridgeA, 'A(AD 수치: 좌 재단 y104)'));
fs.writeFileSync(path.join(outDir, 'torii-bar.json'), JSON.stringify(torii, null, 2) + '\n');
if (profileName !== 'v1') {
  // 아래 재단 꼬리: y≥260 구간 점들의 현(弦) 대비 최대 횡이탈, 下吉田 꺾임(宮川橋北詰)의 판면 y
  const tail = drawn.filter((p) => p.y >= 260);
  const a0 = tail[0], b0 = tail.at(-1);
  const dev = Math.max(...tail.map((p) => segDist(p, a0, b0)));
  // 재단 밖 첫 노드(잘린 점의 바깥쪽)
  const outIdx = P.findIndex((p) => p.y > BLEED.y1);
  metrics.bottomTail = { fromY260MaxDevMm: r2(dev, 3), points: tail.map((p) => [r2(p.x), r2(p.y)]), firstOutsideNode: { node: P[outIdx].node, page: [r2(P[outIdx].x), r2(P[outIdx].y)] },
    nextNodes: P.slice(outIdx, outIdx + 4).map((p) => ({ node: p.node, page: [r2(p.x), r2(p.y)] })) };
}
metrics.simplify = { eps: EPS, nOrig: drawn.length, nSimp: simp.length, ...Object.fromEntries(Object.entries(err).map(([k, v]) => [k, r2(v, 3)])) };
metrics.ridge = ridge;
metrics.osm = { ways: wayOrder, unchained, nodesChained: chain.length, south };
fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'line-points.json'), JSON.stringify(lineDup.map((p) => ({ x: r2(p.x, 3), y: r2(p.y, 3), node: p.node })), null, 1) + '\n');
console.log(JSON.stringify({ metrics, torii }, null, 1));
