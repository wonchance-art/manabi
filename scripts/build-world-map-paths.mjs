/**
 * world-atlas 110m 스냅샷 → 교재 소개용 국가 SVG path 생성.
 * 소스: scripts/data/world-atlas-countries-110m.json
 *   (world-atlas@2.0.2, Natural Earth 유래 — 퍼블릭 도메인. 스냅샷 SHA-256은 PR 기록)
 * 출력: src/components/worldMapPaths.js (생성물 — 직접 편집 금지)
 * 투영: equirectangular, x=(lon+180)*2 · y=(90-lat)*2 (720×360), 남극(010) 제외.
 * 재생성: node scripts/build-world-map-paths.mjs (결정적 — 동일 입력 → 동일 출력)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/world-atlas-countries-110m.json'), 'utf8'));
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

// quantized arc → [lon,lat][] (델타 누적 + 역변환)
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

const proj = ([lon, lat]) => [
  Math.round((lon + 180) * 2 * 10) / 10,
  Math.round((90 - lat) * 2 * 10) / 10,
];

function ringPoints(arcIdxs) {
  const pts = [];
  for (const i of arcIdxs) {
    const seg = i >= 0 ? arcs[i] : [...arcs[~i]].reverse();
    for (let j = pts.length ? 1 : 0; j < seg.length; j += 1) pts.push(seg[j]);
  }
  return pts.map(proj);
}

function geomToPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  let d = '';
  for (const rings of polys) {
    for (const ring of rings) {
      const pts = ringPoints(ring);
      if (pts.length < 3) continue;
      d += `M${pts.map((p) => p.join(',')).join('L')}Z`;
    }
  }
  return d;
}

const out = [];
for (const g of topo.objects.countries.geometries) {
  if (g.id === '010') continue; // 남극 제외
  const d = geomToPath(g);
  if (!d) continue;
  out.push({ id: g.id ?? '', name: g.properties?.name ?? '', d });
}
out.sort((a, b) => (a.id || 'zzz').localeCompare(b.id || 'zzz'));

const body = `/**
 * 생성물 — 직접 편집 금지. scripts/build-world-map-paths.mjs 로 재생성.
 * 소스: world-atlas@2.0.2 countries-110m (Natural Earth 유래, 퍼블릭 도메인).
 * 투영: equirectangular 720×360, 남극 제외. 국가 ${out.length}개.
 */
export const WORLD_PATHS = ${JSON.stringify(out)};
`;
fs.writeFileSync(path.join(ROOT, 'src/components/worldMapPaths.js'), body);

const HIGHLIGHT_CHECK = ['840','124','826','372','036','554','356','566','404','710','288','608','250','056','756','442','332','686','384','466','854','562','768','204','324','120','266','178','180','140','148','262','450','646','108','226','504','012','788','392','156','158','702','458'];
const have = new Set(out.map((o) => o.id));
const missing = HIGHLIGHT_CHECK.filter((id) => !have.has(id));
console.log(JSON.stringify({ countries: out.length, bytes: body.length, missingHighlights: missing }));
