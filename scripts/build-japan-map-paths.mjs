/**
 * world-atlas 110m 스냅샷 → 일본학 지도용 일본 윤곽 SVG path 생성.
 * 소스: scripts/data/world-atlas-countries-110m.json (build-world-map-paths.mjs와 동일 스냅샷)
 * 출력: src/components/japanMapPaths.js (생성물 — 직접 편집 금지)
 * 투영: 위도 보정 equirectangular — x=(lng-LNG0)*K*COS38, y=(LAT1-lat)*K.
 *   본토 4도 bbox(lng 129~146.2, lat 30.8~45.8) 기준. 핀도 같은 projectJp()로 찍는다.
 * 재생성: node scripts/build-japan-map-paths.mjs (결정적)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/world-atlas-countries-110m.json'), 'utf8'));
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

// 투영 상수 — 뷰와 핀이 공유
const LNG0 = 129, LAT1 = 45.8, K = 40, COS38 = 0.788;
const W = Math.round((146.2 - LNG0) * K * COS38); // 542
const H = Math.round((LAT1 - 30.8) * K);          // 600
const proj = ([lng, lat]) => [((lng - LNG0) * K * COS38), ((LAT1 - lat) * K)];

function ringPoints(arcIdxs) {
  const pts = [];
  for (const i of arcIdxs) {
    const seg = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
    for (let j = pts.length ? 1 : 0; j < seg.length; j += 1) pts.push(seg[j]);
  }
  return pts;
}

const fmt = (v) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};

function ringToPath(lonlats) {
  // bbox 밖 링(오키나와 등 남서 제도) 제외 — 본토 지도를 좁게 유지
  if (!lonlats.some(([lng, lat]) => lng >= LNG0 && lng <= 146.2 && lat >= 30.8 && lat <= LAT1)) return '';
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
  return d + 'Z';
}

const polys = japan.type === 'MultiPolygon' ? japan.arcs : [japan.arcs];
const dParts = [];
for (const poly of polys) for (const ring of poly) {
  const d = ringToPath(ringPoints(ring));
  if (d) dParts.push(d);
}

const out = `// 생성물 — scripts/build-japan-map-paths.mjs 가 만든다. 직접 편집 금지.
// 소스: world-atlas 110m 스냅샷(Natural Earth 유래 — 퍼블릭 도메인)의 일본 geometry.
export const JP_VIEW = { w: ${W}, h: ${H} };
// 핀 좌표도 같은 투영을 쓴다 — 윤곽과 핀의 기준이 하나여야 어긋나지 않는다.
export function projectJp(lng, lat) {
  return [(lng - ${LNG0}) * ${K} * ${COS38}, (${LAT1} - lat) * ${K}];
}
export const JAPAN_PATH = ${JSON.stringify(dParts.join(''))};
`;
fs.writeFileSync(path.join(ROOT, 'src/components/japanMapPaths.js'), out);
console.log(`일본 윤곽 생성: 링 ${dParts.length}개, path ${dParts.join('').length}자, viewBox ${W}×${H}`);
