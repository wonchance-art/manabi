import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const BBOX = Object.freeze([139.66, 35.545, 139.842, 35.74]);
const OSM_SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('./data/tokyo-osm-v22.json', import.meta.url),
  'utf8',
));

const POI_SOURCE = Object.freeze([
  {
    id: 'haneda-airport', nameJa: '羽田空港', yomi: 'はねだくうこう',
    lat: 35.5491583, lon: 139.7845527, kind: 'airport',
  },
  {
    id: 'shinagawa-station', nameJa: '品川駅', yomi: 'しながわえき',
    lat: 35.6286974, lon: 139.7391291, kind: 'station-landmark',
  },
  {
    id: 'shibuya-scramble', nameJa: '渋谷スクランブル交差点', yomi: 'しぶやすくらんぶるこうさてん',
    lat: 35.659482, lon: 139.700559, kind: 'crossing',
  },
  {
    id: 'tokyo-tower', nameJa: '東京タワー', yomi: 'とうきょうたわー',
    lat: 35.6585805, lon: 139.7454329, kind: 'landmark',
  },
  {
    id: 'rainbow-bridge', nameJa: 'レインボーブリッジ', yomi: 'れいんぼーぶりっじ',
    lat: 35.63667, lon: 139.76306, kind: 'bridge',
  },
  {
    id: 'odaiba-seaside-park', nameJa: 'お台場海浜公園', yomi: 'おだいばかいひんこうえん',
    lat: 35.6298721, lon: 139.7787386, kind: 'waterfront-park',
  },
  {
    id: 'hamarikyu-gardens', nameJa: '浜離宮恩賜庭園', yomi: 'はまりきゅうおんしていえん',
    lat: 35.6595766, lon: 139.7647883, kind: 'park',
  },
  {
    id: 'zojoji', nameJa: '増上寺', yomi: 'ぞうじょうじ',
    lat: 35.6572249, lon: 139.7484189, kind: 'temple',
  },
  {
    id: 'ebisu-garden-place', nameJa: '恵比寿ガーデンプレイス', yomi: 'えびすがーでんぷれいす',
    lat: 35.6419968, lon: 139.7136138, kind: 'landmark',
  },
  {
    id: 'sensoji', nameJa: '浅草寺', yomi: 'せんそうじ',
    lat: 35.71416, lon: 139.796376, kind: 'temple',
  },
  {
    id: 'tokyo-skytree', nameJa: '東京スカイツリー', yomi: 'とうきょうすかいつりー',
    lat: 35.7100456, lon: 139.8107074, kind: 'landmark',
  },
  {
    id: 'ueno-park', nameJa: '上野恩賜公園', yomi: 'うえのおんしこうえん',
    lat: 35.7140825, lon: 139.7724045, kind: 'park',
  },
  {
    id: 'tokyo-station-marunouchi', nameJa: '東京駅丸の内駅舎', yomi: 'とうきょうえきまるのうちえきしゃ',
    lat: 35.6811678, lon: 139.7659746, kind: 'station-landmark',
  },
  {
    id: 'ginza-4-chome', nameJa: '銀座四丁目', yomi: 'ぎんざよんちょうめ',
    lat: 35.6712743, lon: 139.7664472, kind: 'crossing',
  },
  {
    id: 'meiji-jingu', nameJa: '明治神宮', yomi: 'めいじじんぐう',
    lat: 35.6758626, lon: 139.7004497, kind: 'shrine',
  },
  {
    id: 'tokyo-metropolitan-government', nameJa: '東京都庁', yomi: 'とうきょうとちょう',
    lat: 35.689142, lon: 139.6920272, kind: 'landmark',
  },
  {
    id: 'ryogoku-kokugikan', nameJa: '両国国技館', yomi: 'りょうごくこくぎかん',
    lat: 35.696961, lon: 139.7932196, kind: 'landmark',
  },
  {
    id: 'nakameguro-meguro-river', nameJa: '中目黒（目黒川）', yomi: 'なかめぐろ（めぐろがわ）',
    lat: 35.6442558, lon: 139.6989794, kind: 'riverfront',
  },
  {
    id: 'kanda-myojin', nameJa: '神田明神', yomi: 'かんだみょうじん',
    lat: 35.7019993, lon: 139.7677748, kind: 'shrine',
  },
]);

const STATION_SOURCE = Object.freeze([
  { id: 'shibuya', nameJa: '渋谷', yomi: 'しぶや', lat: 35.65808, lon: 139.7017647, line: '山手線' },
  { id: 'ebisu', nameJa: '恵比寿', yomi: 'えびす', lat: 35.6464413, lon: 139.7102082, line: '山手線' },
  { id: 'meguro', nameJa: '目黒', yomi: 'めぐろ', lat: 35.6340669, lon: 139.7157332, line: '山手線' },
  { id: 'gotanda', nameJa: '五反田', yomi: 'ごたんだ', lat: 35.6262562, lon: 139.7236303, line: '山手線' },
  { id: 'osaki', nameJa: '大崎', yomi: 'おおさき', lat: 35.6193903, lon: 139.7284866, line: '山手線' },
  { id: 'shinagawa', nameJa: '品川', yomi: 'しながわ', lat: 35.6286974, lon: 139.7391291, line: '山手線' },
  {
    id: 'takanawa-gateway', nameJa: '高輪ゲートウェイ', yomi: 'たかなわげーとうぇい',
    lat: 35.635399, lon: 139.7406642, line: '山手線',
  },
  { id: 'tamachi', nameJa: '田町', yomi: 'たまち', lat: 35.6457358, lon: 139.7476833, line: '山手線' },
  {
    id: 'hamamatsucho', nameJa: '浜松町', yomi: 'はままつちょう',
    lat: 35.6551111, lon: 139.7570622, line: '山手線',
  },
  { id: 'shimbashi', nameJa: '新橋', yomi: 'しんばし', lat: 35.6661689, lon: 139.7582206, line: '山手線' },
  { id: 'yurakucho', nameJa: '有楽町', yomi: 'ゆうらくちょう', lat: 35.6749598, lon: 139.7630483, line: '山手線' },
  { id: 'tokyo', nameJa: '東京', yomi: 'とうきょう', lat: 35.6812546, lon: 139.766706, line: '山手線' },
  { id: 'kanda', nameJa: '神田', yomi: 'かんだ', lat: 35.6917939, lon: 139.7709112, line: '山手線' },
  { id: 'akihabara', nameJa: '秋葉原', yomi: 'あきはばら', lat: 35.6983609, lon: 139.7731217, line: '山手線' },
  { id: 'okachimachi', nameJa: '御徒町', yomi: 'おかちまち', lat: 35.7069531, lon: 139.7746303, line: '山手線' },
  { id: 'ueno', nameJa: '上野', yomi: 'うえの', lat: 35.7134128, lon: 139.7765418, line: '山手線' },
  { id: 'uguisudani', nameJa: '鶯谷', yomi: 'うぐいすだに', lat: 35.7217035, lon: 139.7779166, line: '山手線' },
  { id: 'nippori', nameJa: '日暮里', yomi: 'にっぽり', lat: 35.7281495, lon: 139.7706579, line: '山手線' },
  { id: 'nishi-nippori', nameJa: '西日暮里', yomi: 'にしにっぽり', lat: 35.7322021, lon: 139.7666684, line: '山手線' },
  { id: 'tabata', nameJa: '田端', yomi: 'たばた', lat: 35.7373723, lon: 139.761707, line: '山手線' },
  { id: 'komagome', nameJa: '駒込', yomi: 'こまごめ', lat: 35.7365848, lon: 139.7472412, line: '山手線' },
  { id: 'sugamo', nameJa: '巣鴨', yomi: 'すがも', lat: 35.7334119, lon: 139.7394273, line: '山手線' },
  { id: 'otsuka', nameJa: '大塚', yomi: 'おおつか', lat: 35.7316851, lon: 139.7285879, line: '山手線' },
  { id: 'ikebukuro', nameJa: '池袋', yomi: 'いけぶくろ', lat: 35.730185, lon: 139.7111512, line: '山手線' },
  { id: 'mejiro', nameJa: '目白', yomi: 'めじろ', lat: 35.7211919, lon: 139.7064645, line: '山手線' },
  { id: 'takadanobaba', nameJa: '高田馬場', yomi: 'たかだのばば', lat: 35.7126839, lon: 139.7036425, line: '山手線' },
  { id: 'shin-okubo', nameJa: '新大久保', yomi: 'しんおおくぼ', lat: 35.7013007, lon: 139.7002421, line: '山手線' },
  { id: 'shinjuku', nameJa: '新宿', yomi: 'しんじゅく', lat: 35.6902618, lon: 139.7005142, line: '山手線' },
  { id: 'yoyogi', nameJa: '代々木', yomi: 'よよぎ', lat: 35.6839514, lon: 139.7020806, line: '山手線' },
  { id: 'harajuku', nameJa: '原宿', yomi: 'はらじゅく', lat: 35.6702145, lon: 139.7024266, line: '山手線' },
]);

export function webMercatorMeters(lon, lat) {
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + limitedLat * DEG / 2)),
  };
}

function projectionMetrics(bbox = BBOX, metersPerTile = METERS_PER_TILE) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const southWest = webMercatorMeters(minLon, minLat);
  const northEast = webMercatorMeters(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  const widthMeters = (northEast.x - southWest.x) * correction;
  const heightMeters = (northEast.y - southWest.y) * correction;
  return {
    southWest,
    northEast,
    correction,
    widthMeters,
    heightMeters,
    grid: {
      w: Math.ceil(widthMeters / metersPerTile),
      h: Math.ceil(heightMeters / metersPerTile),
    },
  };
}

const METRICS = projectionMetrics();

export const TOKYO_META = Object.freeze({
  city: 'tokyo',
  bbox: BBOX,
  grid: Object.freeze(METRICS.grid),
  metersPerTile: METERS_PER_TILE,
  projection: 'webmercator',
  aspectCorrection: Number(METRICS.correction.toFixed(12)),
  source: Object.freeze({ ...OSM_SNAPSHOT.source }),
});

export function projectLatLonToGrid(lat, lon, meta = TOKYO_META) {
  const metrics = meta === TOKYO_META ? METRICS : projectionMetrics(meta.bbox, meta.metersPerTile);
  const point = webMercatorMeters(lon, lat);
  return {
    x: ((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile,
    y: ((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile,
  };
}

export function projectLatLonToTile(lat, lon, meta = TOKYO_META) {
  const point = projectLatLonToGrid(lat, lon, meta);
  return [
    Math.max(0, Math.min(meta.grid.w - 1, Math.floor(point.x))),
    Math.max(0, Math.min(meta.grid.h - 1, Math.floor(point.y))),
  ];
}

function assertSnapshotContract() {
  if (JSON.stringify(OSM_SNAPSHOT.bbox) !== JSON.stringify(TOKYO_META.bbox)) {
    throw new Error('Tokyo OSM snapshot bbox mismatch');
  }
  if (OSM_SNAPSHOT.grid.w !== TOKYO_META.grid.w || OSM_SNAPSHOT.grid.h !== TOKYO_META.grid.h) {
    throw new Error('Tokyo OSM snapshot grid mismatch');
  }
}

function fillCircle(grid, cx, cy, radius, code) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    if (y < 0 || y >= TOKYO_META.grid.h) continue;
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if (x < 0 || x >= TOKYO_META.grid.w) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > (radius + 0.35) ** 2) continue;
      grid[y * TOKYO_META.grid.w + x] = code;
    }
  }
}

function fillEllipse(grid, lat, lon, radiusX, radiusY, code) {
  const center = projectLatLonToGrid(lat, lon);
  for (let y = Math.floor(center.y - radiusY); y <= Math.ceil(center.y + radiusY); y += 1) {
    if (y < 0 || y >= TOKYO_META.grid.h) continue;
    for (let x = Math.floor(center.x - radiusX); x <= Math.ceil(center.x + radiusX); x += 1) {
      if (x < 0 || x >= TOKYO_META.grid.w) continue;
      if (((x - center.x) / radiusX) ** 2 + ((y - center.y) / radiusY) ** 2 > 1) continue;
      grid[y * TOKYO_META.grid.w + x] = code;
    }
  }
}

function applySnapshotMasks(grid, masks) {
  const { buildingMask, roadMask, waterMask, riverMask, parkMask } = masks;
  for (let index = 0; index < grid.length; index += 1) {
    if (waterMask[index]) grid[index] = CITY_TILE.WATER;
  }
  for (let index = 0; index < grid.length; index += 1) {
    if (riverMask[index]) grid[index] = CITY_TILE.RIVER;
  }
  for (let index = 0; index < grid.length; index += 1) {
    if (parkMask[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) {
      grid[index] = CITY_TILE.PARK;
    }
  }
  for (let index = 0; index < grid.length; index += 1) {
    if (!buildingMask[index]) continue;
    if (grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER) continue;
    grid[index] = CITY_TILE.BUILDING;
  }
  for (let index = 0; index < grid.length; index += 1) {
    const roadClass = roadMask[index];
    if (!roadClass) continue;
    const previous = grid[index];
    if (previous === CITY_TILE.WATER || previous === CITY_TILE.RIVER || previous === CITY_TILE.BRIDGE) {
      grid[index] = CITY_TILE.BRIDGE;
    } else if (roadClass >= 2) {
      grid[index] = CITY_TILE.ROAD;
    } else if (previous !== CITY_TILE.BUILDING) {
      grid[index] = CITY_TILE.SIDEWALK;
    }
  }
  for (const [x, y] of OSM_SNAPSHOT.crossings) {
    const index = y * TOKYO_META.grid.w + x;
    if (roadMask[index] >= 2 && grid[index] === CITY_TILE.ROAD) grid[index] = CITY_TILE.CROSSWALK;
  }
}

function paintLandmarkPlazas(grid) {
  const scramble = POI_SOURCE.find((entry) => entry.id === 'shibuya-scramble');
  const scramblePoint = projectLatLonToGrid(scramble.lat, scramble.lon);
  fillCircle(grid, scramblePoint.x, scramblePoint.y, 2.1, CITY_TILE.CROSSWALK);
  fillEllipse(grid, 35.6286974, 139.7391291, 4.5, 6.5, CITY_TILE.PLAZA);
  fillEllipse(grid, 35.5491583, 139.7845527, 3.8, 5.4, CITY_TILE.PLAZA);
}

function ensureWalkableAnchor(grid, entry) {
  const [x, y] = projectLatLonToTile(entry.lat, entry.lon);
  const { w, h } = TOKYO_META.grid;
  const index = y * w + x;
  if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.PLAZA;
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (neighbors.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < w && ny < h && !isCityBlocked(grid[ny * w + nx]);
  })) return;
  const [dx, dy] = x > 0 ? [-1, 0] : [1, 0];
  grid[(y + dy) * w + x + dx] = CITY_TILE.PLAZA;
}

function reachableFrom(grid, start) {
  const { w, h } = TOKYO_META.grid;
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(grid[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function collectComponent(grid, start, visited) {
  const { w, h } = TOKYO_META.grid;
  const queue = [start];
  const component = [];
  visited[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    component.push(index);
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (visited[next] || isCityBlocked(grid[next])) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  return component;
}

function connectToMain(grid, start, mainSeen) {
  const { w, h } = TOKYO_META.grid;
  const parent = new Int32Array(grid.length).fill(-1);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  let target = -1;
  queue[tail++] = start;
  parent[start] = start;
  while (head < tail && target < 0) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (parent[next] >= 0) continue;
      parent[next] = index;
      if (mainSeen[next]) {
        target = next;
        break;
      }
      queue[tail++] = next;
    }
  }
  if (target < 0) throw new Error('Unable to connect Tokyo walkable component');
  for (let index = target; index !== start; index = parent[index]) {
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER
      ? CITY_TILE.BRIDGE
      : CITY_TILE.ROAD;
  }
}

function normalizeWalkableComponents(grid, protectedEntries) {
  const { w } = TOKYO_META.grid;
  const mainEntry = STATION_SOURCE.find((entry) => entry.id === 'shinagawa');
  const [mainX, mainY] = projectLatLonToTile(mainEntry.lat, mainEntry.lon);
  const mainStart = mainY * w + mainX;
  const protectedTiles = new Set(protectedEntries.map((entry) => {
    const [x, y] = projectLatLonToTile(entry.lat, entry.lon);
    return y * w + x;
  }));
  let mainSeen = reachableFrom(grid, mainStart);
  const visited = mainSeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited);
    const protectedComponent = component.some((tileIndex) => protectedTiles.has(tileIndex));
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    connectToMain(grid, component[0], mainSeen);
    mainSeen = reachableFrom(grid, mainStart);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (mainSeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
  const finalSeen = reachableFrom(grid, mainStart);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !finalSeen[index]) {
      throw new Error(`Disconnected Tokyo walkable tile at ${index % w},${Math.floor(index / w)}`);
    }
  }
}

function createTerrain() {
  assertSnapshotContract();
  const length = TOKYO_META.grid.w * TOKYO_META.grid.h;
  const masks = {
    buildingMask: decodeTerrainRle(OSM_SNAPSHOT.buildingRle, length),
    roadMask: decodeTerrainRle(OSM_SNAPSHOT.roadRle, length),
    waterMask: decodeTerrainRle(OSM_SNAPSHOT.waterRle, length),
    riverMask: decodeTerrainRle(OSM_SNAPSHOT.riverRle, length),
    parkMask: decodeTerrainRle(OSM_SNAPSHOT.parkRle, length),
  };
  const grid = new Uint8Array(length).fill(CITY_TILE.SIDEWALK);
  applySnapshotMasks(grid, masks);
  paintLandmarkPlazas(grid);
  const protectedEntries = [...POI_SOURCE, ...STATION_SOURCE];
  for (const entry of protectedEntries) ensureWalkableAnchor(grid, entry);
  normalizeWalkableComponents(grid, protectedEntries);
  for (const entry of protectedEntries) ensureWalkableAnchor(grid, entry);
  return grid;
}

export function encodeTerrainRle(terrain) {
  if (terrain.length === 0) return [];
  const runs = [];
  let code = terrain[0];
  let count = 1;
  for (let index = 1; index < terrain.length; index += 1) {
    if (terrain[index] === code) {
      count += 1;
      continue;
    }
    runs.push([code, count]);
    code = terrain[index];
    count = 1;
  }
  runs.push([code, count]);
  return runs;
}

export function decodeTerrainRle(runs, length) {
  const terrain = new Uint8Array(length);
  let offset = 0;
  for (const [code, count] of runs) {
    terrain.fill(code, offset, offset + count);
    offset += count;
  }
  if (offset !== length) throw new Error(`terrain RLE length mismatch: ${offset} !== ${length}`);
  return terrain;
}

function withTile(entry) {
  return {
    ...entry,
    lat: Number(entry.lat.toFixed(7)),
    lon: Number(entry.lon.toFixed(7)),
    tile: projectLatLonToTile(entry.lat, entry.lon),
  };
}

export function buildTokyoGeo() {
  const railwayMask = decodeTerrainRle(
    OSM_SNAPSHOT.railwayRle,
    TOKYO_META.grid.w * TOKYO_META.grid.h,
  );
  return {
    meta: TOKYO_META,
    terrain: createTerrain(),
    pois: POI_SOURCE.map(withTile),
    stations: STATION_SOURCE.map(withTile),
    railways: {
      mask: railwayMask,
      tileCount: railwayMask.reduce((sum, code) => sum + Number(Boolean(code)), 0),
    },
  };
}

function generatedModule(geo) {
  const terrainRuns = encodeTerrainRle(geo.terrain);
  const railwayRuns = encodeTerrainRle(geo.railways.mask);
  return `// Generated by scripts/build-tokyo-geo.mjs. Do not edit by hand.\n// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot ${geo.meta.source.snapshot}).\n\nconst META = Object.freeze(${JSON.stringify(geo.meta, null, 2)});\nconst TERRAIN_RLE = ${JSON.stringify(terrainRuns)};\nconst RAILWAY_RLE = ${JSON.stringify(railwayRuns)};\n\nfunction decodeTerrain(runs, length) {\n  const terrain = new Uint8Array(length);\n  let offset = 0;\n  for (const [code, count] of runs) {\n    terrain.fill(code, offset, offset + count);\n    offset += count;\n  }\n  if (offset !== length) throw new Error(\`terrain RLE length mismatch: \${offset} !== \${length}\`);\n  return terrain;\n}\n\nconst LENGTH = META.grid.w * META.grid.h;\n\nexport const TOKYO_GEO = Object.freeze({\n  meta: META,\n  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),\n  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),\n  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),\n  railways: Object.freeze({\n    mask: decodeTerrain(RAILWAY_RLE, LENGTH),\n    tileCount: ${geo.railways.tileCount},\n  }),\n});\n`;
}

export function writeTokyoGeo(outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/components/world/cities/tokyo.geo.js',
)) {
  const geo = buildTokyoGeo();
  fs.writeFileSync(outputPath, generatedModule(geo));
  return {
    outputPath,
    grid: geo.meta.grid,
    cells: geo.terrain.length,
    terrainRuns: encodeTerrainRle(geo.terrain).length,
    railwayRuns: encodeTerrainRle(geo.railways.mask).length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(writeTokyoGeo()));
}
