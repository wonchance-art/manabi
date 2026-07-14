import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const BBOX = Object.freeze([135.405, 34.615, 135.545, 34.735]);
const OSM_SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('./data/osaka-osm-v21.json', import.meta.url),
  'utf8',
));

const POI_SOURCE = Object.freeze([
  {
    id: 'osaka-castle', nameJa: '大阪城', yomi: 'おおさかじょう',
    lat: 34.6873128, lon: 135.5258243, kind: 'historic',
  },
  {
    id: 'ebisubashi', nameJa: '戎橋', yomi: 'えびすばし',
    lat: 34.669055, lon: 135.5012873, kind: 'bridge-landmark',
  },
  {
    id: 'tsutenkaku', nameJa: '通天閣', yomi: 'つうてんかく',
    lat: 34.6525606, lon: 135.5062916, kind: 'landmark',
  },
  {
    id: 'kuromon-market', nameJa: '黒門市場', yomi: 'くろもんいちば',
    lat: 34.6653277, lon: 135.5069795, kind: 'market',
  },
  {
    id: 'osaka-aquarium', nameJa: '海遊館', yomi: 'かいゆうかん',
    lat: 34.6551592, lon: 135.4293788, kind: 'aquarium',
  },
  {
    id: 'nakanoshima-park', nameJa: '中之島公園', yomi: 'なかのしまこうえん',
    lat: 34.692418, lon: 135.5075474, kind: 'park',
  },
  {
    id: 'shitennoji', nameJa: '四天王寺', yomi: 'してんのうじ',
    lat: 34.6545283, lon: 135.5155184, kind: 'temple',
  },
]);

const STATION_SOURCE = Object.freeze([
  { id: 'shin-osaka', nameJa: '新大阪', yomi: 'しんおおさか', lat: 34.7335385, lon: 135.5001888, line: '東海道・山陽新幹線' },
  { id: 'osaka', nameJa: '大阪', yomi: 'おおさか', lat: 34.7022133, lon: 135.4955732, line: '大阪環状線' },
  { id: 'fukushima', nameJa: '福島', yomi: 'ふくしま', lat: 34.6972584, lon: 135.4868438, line: '大阪環状線' },
  { id: 'nishikujo', nameJa: '西九条', yomi: 'にしくじょう', lat: 34.6822701, lon: 135.4663099, line: '大阪環状線' },
  { id: 'bentencho', nameJa: '弁天町', yomi: 'べんてんちょう', lat: 34.670288, lon: 135.4618301, line: '大阪環状線' },
  { id: 'taisho', nameJa: '大正', yomi: 'たいしょう', lat: 34.665439, lon: 135.4803368, line: '大阪環状線' },
  { id: 'shin-imamiya', nameJa: '新今宮', yomi: 'しんいまみや', lat: 34.6501425, lon: 135.5002187, line: '大阪環状線' },
  { id: 'tennoji', nameJa: '天王寺', yomi: 'てんのうじ', lat: 34.6473432, lon: 135.5152413, line: '大阪環状線' },
  { id: 'tsuruhashi', nameJa: '鶴橋', yomi: 'つるはし', lat: 34.6654037, lon: 135.5302101, line: '大阪環状線' },
  { id: 'morinomiya', nameJa: '森ノ宮', yomi: 'もりのみや', lat: 34.6804474, lon: 135.5340047, line: '大阪環状線' },
  { id: 'kyobashi', nameJa: '京橋', yomi: 'きょうばし', lat: 34.6960819, lon: 135.5342674, line: '大阪環状線' },
  { id: 'sakuranomiya', nameJa: '桜ノ宮', yomi: 'さくらのみや', lat: 34.7048406, lon: 135.5202911, line: '大阪環状線' },
  { id: 'temma', nameJa: '天満', yomi: 'てんま', lat: 34.7049249, lon: 135.5123175, line: '大阪環状線' },
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
  return {
    southWest,
    northEast,
    correction,
    grid: {
      w: Math.ceil(((northEast.x - southWest.x) * correction) / metersPerTile),
      h: Math.ceil(((northEast.y - southWest.y) * correction) / metersPerTile),
    },
  };
}

const METRICS = projectionMetrics();

export const OSAKA_META = Object.freeze({
  city: 'osaka',
  bbox: BBOX,
  grid: Object.freeze(METRICS.grid),
  metersPerTile: METERS_PER_TILE,
  projection: 'webmercator',
  aspectCorrection: Number(METRICS.correction.toFixed(12)),
  source: Object.freeze({ ...OSM_SNAPSHOT.source }),
});

export function projectLatLonToGrid(lat, lon, meta = OSAKA_META) {
  const metrics = meta === OSAKA_META ? METRICS : projectionMetrics(meta.bbox, meta.metersPerTile);
  const point = webMercatorMeters(lon, lat);
  return {
    x: ((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile,
    y: ((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile,
  };
}

export function projectLatLonToTile(lat, lon, meta = OSAKA_META) {
  const point = projectLatLonToGrid(lat, lon, meta);
  return [
    Math.max(0, Math.min(meta.grid.w - 1, Math.floor(point.x))),
    Math.max(0, Math.min(meta.grid.h - 1, Math.floor(point.y))),
  ];
}

function assertSnapshotContract() {
  if (JSON.stringify(OSM_SNAPSHOT.bbox) !== JSON.stringify(OSAKA_META.bbox)) {
    throw new Error('Osaka OSM snapshot bbox mismatch');
  }
  if (OSM_SNAPSHOT.grid.w !== OSAKA_META.grid.w || OSM_SNAPSHOT.grid.h !== OSAKA_META.grid.h) {
    throw new Error('Osaka OSM snapshot grid mismatch');
  }
}

function fillCircle(grid, cx, cy, radius, code) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    if (y < 0 || y >= OSAKA_META.grid.h) continue;
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      if (x < 0 || x >= OSAKA_META.grid.w) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > (radius + 0.35) ** 2) continue;
      grid[y * OSAKA_META.grid.w + x] = code;
    }
  }
}

function fillEllipse(grid, lat, lon, radiusX, radiusY, code) {
  const center = projectLatLonToGrid(lat, lon);
  for (let y = Math.floor(center.y - radiusY); y <= Math.ceil(center.y + radiusY); y += 1) {
    if (y < 0 || y >= OSAKA_META.grid.h) continue;
    for (let x = Math.floor(center.x - radiusX); x <= Math.ceil(center.x + radiusX); x += 1) {
      if (x < 0 || x >= OSAKA_META.grid.w) continue;
      if (((x - center.x) / radiusX) ** 2 + ((y - center.y) / radiusY) ** 2 > 1) continue;
      grid[y * OSAKA_META.grid.w + x] = code;
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
    const index = y * OSAKA_META.grid.w + x;
    if (roadMask[index] >= 2 && grid[index] === CITY_TILE.ROAD) grid[index] = CITY_TILE.CROSSWALK;
  }
}

function paintLandmarkPlazas(grid) {
  const ebisubashi = POI_SOURCE.find((entry) => entry.id === 'ebisubashi');
  const bridgePoint = projectLatLonToGrid(ebisubashi.lat, ebisubashi.lon);
  fillCircle(grid, bridgePoint.x, bridgePoint.y, 2.1, CITY_TILE.CROSSWALK);
  fillEllipse(grid, 34.7022133, 135.4955732, 5.5, 4.5, CITY_TILE.PLAZA);
  fillEllipse(grid, 34.7335385, 135.5001888, 4.5, 3.2, CITY_TILE.PLAZA);
  fillEllipse(grid, 34.6551592, 135.4293788, 2.8, 2.8, CITY_TILE.PLAZA);
}

function ensureWalkableAnchor(grid, entry) {
  const [x, y] = projectLatLonToTile(entry.lat, entry.lon);
  const { w, h } = OSAKA_META.grid;
  const index = y * w + x;
  if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.PLAZA;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < w && ny < h && !isCityBlocked(grid[ny * w + nx]);
  })) return;
  const nx = x > 0 ? x - 1 : x + 1;
  grid[y * w + nx] = CITY_TILE.PLAZA;
}

function reachableFrom(grid, start) {
  const { w, h } = OSAKA_META.grid;
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
  const { w, h } = OSAKA_META.grid;
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
  const { w, h } = OSAKA_META.grid;
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
  if (target < 0) throw new Error('Unable to connect Osaka walkable component');
  for (let index = target; index !== start; index = parent[index]) {
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER
      ? CITY_TILE.BRIDGE
      : CITY_TILE.ROAD;
  }
}

function normalizeWalkableComponents(grid, protectedEntries) {
  const { w } = OSAKA_META.grid;
  const mainEntry = STATION_SOURCE.find((entry) => entry.id === 'osaka');
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
      throw new Error(`Disconnected Osaka walkable tile at ${index % w},${Math.floor(index / w)}`);
    }
  }
}

function createTerrain() {
  assertSnapshotContract();
  const length = OSAKA_META.grid.w * OSAKA_META.grid.h;
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

export function buildOsakaGeo() {
  const railwayMask = decodeTerrainRle(
    OSM_SNAPSHOT.railwayRle,
    OSAKA_META.grid.w * OSAKA_META.grid.h,
  );
  return {
    meta: OSAKA_META,
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
  return `// Generated by scripts/build-osaka-geo.mjs. Do not edit by hand.\n// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot 2026-07-10).\n\nconst META = Object.freeze(${JSON.stringify(geo.meta, null, 2)});\nconst TERRAIN_RLE = ${JSON.stringify(terrainRuns)};\nconst RAILWAY_RLE = ${JSON.stringify(railwayRuns)};\n\nfunction decodeTerrain(runs, length) {\n  const terrain = new Uint8Array(length);\n  let offset = 0;\n  for (const [code, count] of runs) {\n    terrain.fill(code, offset, offset + count);\n    offset += count;\n  }\n  if (offset !== length) throw new Error(\`terrain RLE length mismatch: \${offset} !== \${length}\`);\n  return terrain;\n}\n\nconst LENGTH = META.grid.w * META.grid.h;\n\nexport const OSAKA_GEO = Object.freeze({\n  meta: META,\n  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),\n  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),\n  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),\n  railways: Object.freeze({\n    mask: decodeTerrain(RAILWAY_RLE, LENGTH),\n    tileCount: ${geo.railways.tileCount},\n  }),\n});\n`;
}

export function writeOsakaGeo(outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/components/world/cities/osaka.geo.js',
)) {
  const geo = buildOsakaGeo();
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
  console.log(JSON.stringify(writeOsakaGeo()));
}
