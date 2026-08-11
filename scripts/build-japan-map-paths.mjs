/**
 * 일본학 지도 윤곽 생성 — 해안선(50m) + 현 경계(10m 라인).
 * 소스(전부 Natural Earth 유래 — 퍼블릭 도메인, 스냅샷 SHA-256은 PR 기록):
 *   scripts/data/world-atlas-countries-50m.json          (world-atlas@2.0.2 50m)
 *   scripts/data/ne-10m-japan-admin1-lines.json          (ne_10m admin_1 lines에서 ADM0_A3==JPN 추출)
 * 출력: src/components/japanMapPaths.js (생성물 — 직접 편집 금지)
 * 투영: 위도 보정 equirectangular — 본토 bbox(lng 129~146.2, lat 30.8~45.8). 핀도 projectJp 공유.
 * 재생성: node scripts/build-japan-map-paths.mjs (결정적)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/world-atlas-countries-50m.json'), 'utf8'));
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

const japan = topo.objects.countries.geometries.find((g) => g.id === '392');
if (!japan) throw new Error('일본(392) geometry 없음');

const LNG0 = 129, LNG1 = 146.2, LAT0 = 30.8, LAT1 = 45.8, K = 40, COS38 = 0.788;
const W = Math.round((LNG1 - LNG0) * K * COS38);
const H = Math.round((LAT1 - LAT0) * K);
const proj = ([lng, lat]) => [((lng - LNG0) * K * COS38), ((LAT1 - lat) * K)];
const inBbox = ([lng, lat]) => lng >= LNG0 && lng <= LNG1 && lat >= LAT0 && lat <= LAT1;

const fmt = (v) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

function ringPoints(arcIdxs) {
  const pts = [];
  for (const i of arcIdxs) {
    const seg = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
    for (let j = pts.length ? 1 : 0; j < seg.length; j += 1) pts.push(seg[j]);
  }
  return pts;
}

/** 좌표열 → 상대좌표 path (closed=true면 Z로 닫음). bbox 밖 전용 조각은 빈 문자열. */
function toPath(lonlats, closed) {
  if (!lonlats.some(inBbox)) return '';
  const pts = lonlats.map(proj);
  let d = `M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  let [px, py] = [Math.round(pts[0][0] * 10) / 10, Math.round(pts[0][1] * 10) / 10];
  for (let i = 1; i < pts.length; i += 1) {
    const cx = Math.round(pts[i][0] * 10) / 10, cy = Math.round(pts[i][1] * 10) / 10;
    const dx = Math.round((cx - px) * 10) / 10, dy = Math.round((cy - py) * 10) / 10;
    if (dx === 0 && dy === 0) continue;
    d += `l${fmt(dx)},${fmt(dy)}`;
    px = cx; py = cy;
  }
  return closed ? d + 'Z' : d;
}

// ① 해안선(면) — 50m 일본, 작은 낙도는 3점 미만·bbox 밖에서 자연 탈락
const polys = japan.type === 'MultiPolygon' ? japan.arcs : [japan.arcs];
const coastParts = [];
for (const poly of polys) for (const ring of poly) {
  const d = toPath(ringPoints(ring), true);
  if (d) coastParts.push(d);
}

// ② 현 경계(선) — 10m admin1 lines 일본 추출본
const pref = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/ne-10m-japan-admin1-lines.json'), 'utf8'));
const prefParts = [];
for (const f of pref.features) {
  const g = f.geometry;
  const lines = g.type === 'MultiLineString' ? g.coordinates : [g.coordinates];
  for (const line of lines) {
    const d = toPath(line, false);
    if (d) prefParts.push(d);
  }
}

const out = `// 생성물 — scripts/build-japan-map-paths.mjs 가 만든다. 직접 편집 금지.
// 소스: Natural Earth 유래(퍼블릭 도메인) — 해안 50m·현 경계 10m 라인(일본 추출).
export const JP_VIEW = { w: ${W}, h: ${H} };
// 핀 좌표도 같은 투영을 쓴다 — 윤곽과 핀의 기준이 하나여야 어긋나지 않는다.
export function projectJp(lng, lat) {
  return [(lng - ${LNG0}) * ${K} * ${COS38}, (${LAT1} - lat) * ${K}];
}
export const JAPAN_PATH = ${JSON.stringify(coastParts.join(''))};
export const JP_PREF_LINES = ${JSON.stringify(prefParts.join(''))};
`;
fs.writeFileSync(path.join(ROOT, 'src/components/japanMapPaths.js'), out);
console.log(`해안 링 ${coastParts.length}·${coastParts.join('').length}자 / 현 경계 조각 ${prefParts.length}·${prefParts.join('').length}자 / viewBox ${W}×${H}`);
