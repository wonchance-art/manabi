// 一つの町 01 富士吉田 표지 3안용 지도 조각 생성기 (2026-10-15 KST)
// 입력: Overpass JSON (out geom). 질의:
//   [out:json];(way["highway"](35.462,138.775,35.505,138.825);way["waterway"](35.462,138.775,35.505,138.825);
//   way["railway"="rail"](35.462,138.775,35.505,138.825););out geom;
// 사용: node build-map.mjs <overpass.json> > map-fujiyoshida.svg.txt
// 데이터: © OpenStreetMap contributors, ODbL 1.0 (osm_base 2026-07-28 11:16 KST 판).
// 투영: 金鳥居 원점 국소 정거(미터) → 富士山頂(剣ヶ峰) 방위가 위가 되도록 회전. 1mm = 25m.
// 시각 구역 좌표계는 cover-spec.md §3과 같은 128×170mm(viewBox 단위 = mm).
import fs from 'node:fs';

const [file] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const ORIGIN = { lat: 35.4832112, lon: 138.7979629 }; // 金鳥居 (OSM/Nominatim)
const SUMMIT = { lat: 35.360556, lon: 138.7275 };     // 剣ヶ峰 (국토지리원 35°21′38″N 138°43′39″E)
const M_PER_MM = 25;
const CENTER = { x: 52, y: 84 };                       // 金鳥居의 시각 구역 내 위치(mm)
const W = 128, H = 170;

const R = 6371008, rad = Math.PI / 180;
const local = (lat, lon) => ({
  e: (lon - ORIGIN.lon) * rad * R * Math.cos(ORIGIN.lat * rad),
  n: (lat - ORIGIN.lat) * rad * R,
});
const s = local(SUMMIT.lat, SUMMIT.lon);
const beta = Math.atan2(s.e, s.n); // 북에서 시계 방향
const up = { e: Math.sin(beta), n: Math.cos(beta) };
const right = { e: Math.cos(beta), n: -Math.sin(beta) };
export const project = (lat, lon) => {
  const p = local(lat, lon);
  return {
    x: CENTER.x + (p.e * right.e + p.n * right.n) / M_PER_MM,
    y: CENTER.y - (p.e * up.e + p.n * up.n) / M_PER_MM,
  };
};

const PAD = 12; // 시각 구역 밖 12mm까지만 남김
const inside = (q) => q.x > -PAD && q.x < W + PAD && q.y > -PAD && q.y < H + PAD;
const f = (v) => v.toFixed(1).replace(/\.0$/, '');

const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'secondary_link', 'tertiary_link']);
const MINOR = new Set(['residential', 'unclassified', 'service', 'pedestrian', 'busway', 'living_street']);
const groups = { minor: [], major: [], water: [], rail: [], fujimichi: [] };

for (const el of data.elements) {
  if (el.type !== 'way' || !el.geometry) continue;
  const t = el.tags || {};
  let g = null;
  if (t.name === '富士みち') g = 'fujimichi';
  else if (t.railway === 'rail') g = 'rail';
  else if (t.waterway === 'river' || t.waterway === 'stream') g = 'water';
  else if (MAJOR.has(t.highway)) g = 'major';
  else if (MINOR.has(t.highway)) g = 'minor';
  if (!g) continue;
  const pts = el.geometry.map((p) => project(p.lat, p.lon));
  if (!pts.some(inside)) continue;
  let d = '', last = '';
  pts.forEach((q, i) => {
    const xy = `${f(q.x)} ${f(q.y)}`;
    if (xy === last) return;
    d += (i ? 'L' : 'M') + xy;
    last = xy;
  });
  groups[g].push(d);
}

const pins = {
  kitaguchi: project(35.47101, 138.79264),   // 北口本宮冨士浅間神社 (Nominatim)
  kanatorii: project(ORIGIN.lat, ORIGIN.lon),
  fujisan: project(35.48373, 138.79514),     // 富士山駅 (Nominatim)
  shimoyoshida: project(35.49773, 138.80353),// 下吉田駅 (Nominatim)
};
const out = { betaDeg: (beta / rad + 360) % 360, pins, paths: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.join('')])) };
process.stdout.write(JSON.stringify(out));
