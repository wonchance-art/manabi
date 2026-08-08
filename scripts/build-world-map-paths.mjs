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

// 날짜변경선(x 급점프 > 360px) 횡단 링은 조각으로 분할 — 지도 가로지르는 띠 방지
function ringToPath(pts) {
  const parts = [];
  let cur = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    if (Math.abs(pts[i][0] - pts[i - 1][0]) > 360) {
      parts.push(cur);
      cur = [];
    }
    cur.push(pts[i]);
  }
  parts.push(cur);
  return parts
    .filter((part) => part.length >= 3)
    .map(subpathToRelative)
    .filter(Boolean)
    .join('');
}

// 절대좌표(`M493,105.3L494.1,105.3…`)는 점마다 5~6자리를 반복해 낭비가 크다.
// 상대좌표(`m493,105.3l1.1,0…`)는 같은 도형을 절반 이하 바이트로 표현한다 — 렌더 결과는 동일.
// 누적 오차를 막으려고 **실제로 출력한 좌표**를 기준으로 다음 delta를 계산한다.
const fmt = (v) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s; // 105.0 → 105
};

function subpathToRelative(part) {
  let [cx, cy] = part[0];
  let d = `M${fmt(cx)},${fmt(cy)}`;
  cx = Number(fmt(cx));
  cy = Number(fmt(cy));
  let drawn = 0;
  for (let i = 1; i < part.length; i += 1) {
    const dx = Math.round((part[i][0] - cx) * 10) / 10;
    const dy = Math.round((part[i][1] - cy) * 10) / 10;
    if (dx === 0 && dy === 0) continue; // 반올림 후 겹친 점은 그릴 게 없다
    d += `l${fmt(dx)},${fmt(dy)}`;
    cx += dx;
    cy += dy;
    drawn += 1;
  }
  return drawn >= 2 ? `${d}Z` : ''; // 점 3개 미만으로 줄어든 조각은 면이 되지 않는다
}

function geomToPath(geom) {
  const polys = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  let d = '';
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const rings of polys) {
    for (const ring of rings) {
      const pts = ringPoints(ring);
      if (pts.length < 3) continue;
      d += ringToPath(pts);
      for (const [x, y] of pts) {
        if (x < bb[0]) bb[0] = x;
        if (y < bb[1]) bb[1] = y;
        if (x > bb[2]) bb[2] = x;
        if (y > bb[3]) bb[3] = y;
      }
    }
  }
  return { d, bb: bb.map((v) => Math.round(v * 10) / 10) };
}

const out = [];
for (const g of topo.objects.countries.geometries) {
  if (g.id === '010') continue; // 남극 제외
  const { d, bb } = geomToPath(g);
  if (!d) continue;
  out.push({ id: g.id ?? '', name: g.properties?.name ?? '', d, bb });
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
// 검증: 어떤 subpath에도 x 급점프(>360px)가 남아 있지 않아야 한다
let jumps = 0;
for (const o of out) {
  for (const sub of o.d.split('M').slice(1)) {
    const xs = sub.replace(/Z$/, '').split('L').map((pt) => parseFloat(pt));
    for (let i = 1; i < xs.length; i += 1) if (Math.abs(xs[i] - xs[i - 1]) > 360) jumps += 1;
  }
}
console.log(JSON.stringify({ countries: out.length, bytes: body.length, missingHighlights: missing, antimeridianJumps: jumps }));
