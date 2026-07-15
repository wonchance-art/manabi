// 🗺️ 도시 정밀맵 PNG 렌더러 — CITY_MAPS 레지스트리 전 도시를 지형 팔레트로 이미지화.
//   용도: geo/프롭 변경 후 오너 육안 확인·리뷰 자료. 의존성 0(node 내장 zlib 로 PNG 인코딩).
//   사용: node scripts/world/render-city-map.mjs [outDir] [cityId…]  (기본 outDir=./tmp-city-maps, 전 도시)
//   표기: 지형색 + 철도(적갈) + 🔴 POI 노드 + 🟡 역 + 💗 ENTRANCE. 2px/타일.

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { CITY_MAPS } from '../../src/components/world/cities/index.js';
import { CITY_TILE } from '../../src/components/world/cities/terrain.js';

const PALETTE = {
  [CITY_TILE.WATER]: [49, 86, 124],
  [CITY_TILE.RIVER]: [74, 120, 158],
  [CITY_TILE.ROAD]: [74, 80, 88],
  [CITY_TILE.SIDEWALK]: [196, 188, 168],
  [CITY_TILE.CROSSWALK]: [230, 226, 210],
  [CITY_TILE.PLAZA]: [222, 205, 160],
  [CITY_TILE.PARK]: [95, 154, 70],
  [CITY_TILE.BUILDING]: [140, 133, 120],
  [CITY_TILE.BRIDGE]: [154, 111, 66],
  [CITY_TILE.DOCK]: [122, 86, 48],
  [CITY_TILE.BEACH]: [226, 204, 150],
  [CITY_TILE.ISLAND]: [110, 110, 110],
  [CITY_TILE.EXIT]: [230, 60, 200],
};
const RAIL = [122, 64, 58];
const SCALE = 2;

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, cb]);
};

export function renderCityPng(city) {
  const W = city.cols, H = city.rows;
  const grid = city.buildGrid();
  const rail = city.railways?.mask || null;
  const px = Buffer.alloc(W * SCALE * H * SCALE * 3);
  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= W * SCALE || y >= H * SCALE) return;
    const i = (y * W * SCALE + x) * 3;
    px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const c = rail && rail[y * W + x] ? RAIL : (PALETTE[grid[y * W + x]] || [0, 0, 0]);
      for (let dy = 0; dy < SCALE; dy += 1) for (let dx = 0; dx < SCALE; dx += 1) put(x * SCALE + dx, y * SCALE + dy, c);
    }
  }
  const dot = (tx, ty, c, r = 3) => {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dy * dy <= r * r) put(tx * SCALE + dx, ty * SCALE + dy, c);
    }
  };
  for (const s of city.stations || []) dot(s.tile[0], s.tile[1], [240, 190, 40]);
  for (const n of city.nodes || []) dot(n.tile[0], n.tile[1], [210, 40, 40]);
  dot(city.entrance.x, city.entrance.y, [235, 60, 200], 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W * SCALE, 0); ihdr.writeUInt32BE(H * SCALE, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((W * SCALE * 3 + 1) * H * SCALE);
  for (let y = 0; y < H * SCALE; y += 1) {
    raw[y * (W * SCALE * 3 + 1)] = 0;
    px.copy(raw, y * (W * SCALE * 3 + 1) + 1, y * W * SCALE * 3, (y + 1) * W * SCALE * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const [outDir = './tmp-city-maps', ...only] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
for (const city of CITY_MAPS) {
  if (only.length && !only.includes(city.id)) continue;
  const png = renderCityPng(city);
  const file = path.join(outDir, `${city.id}.png`);
  fs.writeFileSync(file, png);
  console.log(`${city.id}: ${city.cols}x${city.rows} → ${file} (${(png.length / 1024).toFixed(0)}KB)`);
}
