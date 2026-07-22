import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const BBOX = Object.freeze([135.67, 34.94, 135.81, 35.06]);
const OSM_SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('./data/kyoto-osm-v21.json', import.meta.url),
  'utf8',
));

const POI_SOURCE = Object.freeze([
  {
    id: 'nijo-castle', nameJa: '二条城', yomi: 'にじょうじょう',
    lat: 35.01309948695653, lon: 135.74829422608693, kind: 'historic',
  },
  {
    id: 'kyoto-imperial-palace', nameJa: '京都御所', yomi: 'きょうとごしょ',
    lat: 35.025360791666664, lon: 135.76209431111113, kind: 'historic',
  },
  {
    id: 'fushimi-inari-taisha', nameJa: '伏見稲荷大社', yomi: 'ふしみいなりたいしゃ',
    lat: 34.967078204137934, lon: 135.7769542434483, kind: 'shrine',
  },
  {
    id: 'yasaka-shrine', nameJa: '八坂神社', yomi: 'やさかじんじゃ',
    lat: 35.00344454615385, lon: 135.7782280846154, kind: 'shrine',
  },
  {
    id: 'heian-shrine', nameJa: '平安神宮', yomi: 'へいあんじんぐう',
    lat: 35.01610115, lon: 135.78296435555552, kind: 'shrine',
  },
  {
    id: 'kiyomizudera', nameJa: '清水寺', yomi: 'きよみずでら',
    lat: 34.99483154210526, lon: 135.78403700789468, kind: 'temple',
  },
  {
    id: 'togetsukyo', nameJa: '渡月橋', yomi: 'とげつきょう',
    lat: 35.0128084, lon: 135.6777499909091, kind: 'bridge-landmark',
  },
  {
    id: 'kinkakuji', nameJa: '金閣寺', yomi: 'きんかくじ',
    lat: 35.03932921212121, lon: 135.7301919909091, kind: 'temple',
  },
  {
    id: 'ginkakuji', nameJa: '銀閣寺', yomi: 'ぎんかくじ',
    lat: 35.02705148913044, lon: 135.79815509782608, kind: 'temple',
  },
  // 인기 POI 보강 라운드(오너 상시 지시) — geo 재생성 후 단일 진실원 계약 유지
  {
    id: 'nishiki-market', nameJa: '錦市場', yomi: 'にしきいちば',
    lat: 35.0050300, lon: 135.7647100, kind: 'market',
  },
]);

const STATION_SOURCE = Object.freeze([
  { id: 'kyoto', nameJa: '京都', yomi: 'きょうと', lat: 34.9853497, lon: 135.758766, line: '東海道本線' },
  { id: 'umekoji-kyotonishi', nameJa: '梅小路京都西', yomi: 'うめこうじきょうとにし', lat: 34.9886528, lon: 135.7431949, line: 'JR山陰線' },
  { id: 'tambaguchi', nameJa: '丹波口', yomi: 'たんばぐち', lat: 34.9957017, lon: 135.7423944, line: 'JR山陰線' },
  { id: 'nijo', nameJa: '二条', yomi: 'にじょう', lat: 35.0110278, lon: 135.7417298, line: 'JR山陰線' },
  { id: 'emmachi', nameJa: '円町', yomi: 'えんまち', lat: 35.0181847, lon: 135.7303521, line: 'JR山陰線' },
  { id: 'hanazono', nameJa: '花園', yomi: 'はなぞの', lat: 35.0185944, lon: 135.7177109, line: 'JR山陰線' },
  { id: 'uzumasa', nameJa: '太秦', yomi: 'うずまさ', lat: 35.0169974, lon: 135.7010879, line: 'JR山陰線' },
  { id: 'saga-arashiyama', nameJa: '嵯峨嵐山', yomi: 'さがあらしやま', lat: 35.0187788, lon: 135.6814128, line: 'JR山陰線' },
  { id: 'tofukuji', nameJa: '東福寺', yomi: 'とうふくじ', lat: 34.9809945, lon: 135.7699358, line: 'JR奈良線' },
  { id: 'inari', nameJa: '稲荷', yomi: 'いなり', lat: 34.9668055, lon: 135.77067, line: 'JR奈良線' },
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

export const KYOTO_META = Object.freeze({
  city: 'kyoto',
  bbox: BBOX,
  grid: Object.freeze(METRICS.grid),
  metersPerTile: METERS_PER_TILE,
  projection: 'webmercator',
  aspectCorrection: Number(METRICS.correction.toFixed(12)),
  source: Object.freeze({ ...OSM_SNAPSHOT.source }),
});

export function projectLatLonToGrid(lat, lon, meta = KYOTO_META) {
  const metrics = meta === KYOTO_META ? METRICS : projectionMetrics(meta.bbox, meta.metersPerTile);
  const point = webMercatorMeters(lon, lat);
  return {
    x: ((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile,
    y: ((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile,
  };
}

export function projectLatLonToTile(lat, lon, meta = KYOTO_META) {
  const point = projectLatLonToGrid(lat, lon, meta);
  return [
    Math.max(0, Math.min(meta.grid.w - 1, Math.floor(point.x))),
    Math.max(0, Math.min(meta.grid.h - 1, Math.floor(point.y))),
  ];
}

function assertSnapshotContract() {
  if (JSON.stringify(OSM_SNAPSHOT.bbox) !== JSON.stringify(KYOTO_META.bbox)) {
    throw new Error('Kyoto OSM snapshot bbox mismatch');
  }
  if (OSM_SNAPSHOT.grid.w !== KYOTO_META.grid.w || OSM_SNAPSHOT.grid.h !== KYOTO_META.grid.h) {
    throw new Error('Kyoto OSM snapshot grid mismatch');
  }
}

function fillEllipse(grid, lat, lon, radiusX, radiusY, code) {
  const center = projectLatLonToGrid(lat, lon);
  for (let y = Math.floor(center.y - radiusY); y <= Math.ceil(center.y + radiusY); y += 1) {
    if (y < 0 || y >= KYOTO_META.grid.h) continue;
    for (let x = Math.floor(center.x - radiusX); x <= Math.ceil(center.x + radiusX); x += 1) {
      if (x < 0 || x >= KYOTO_META.grid.w) continue;
      if (((x - center.x) / radiusX) ** 2 + ((y - center.y) / radiusY) ** 2 > 1) continue;
      grid[y * KYOTO_META.grid.w + x] = code;
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
    const index = y * KYOTO_META.grid.w + x;
    if (roadMask[index] >= 2 && grid[index] === CITY_TILE.ROAD) grid[index] = CITY_TILE.CROSSWALK;
  }
}

function paintLandmarkPlazas(grid) {
  fillEllipse(grid, 34.9853497, 135.758766, 5.5, 4.5, CITY_TILE.PLAZA);
  fillEllipse(grid, 35.0110278, 135.7417298, 3.5, 3, CITY_TILE.PLAZA);
  fillEllipse(grid, 35.0187788, 135.6814128, 3.2, 2.6, CITY_TILE.PLAZA);
}

function ensureWalkableAnchor(grid, entry) {
  const [x, y] = projectLatLonToTile(entry.lat, entry.lon);
  const { w, h } = KYOTO_META.grid;
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
  const { w, h } = KYOTO_META.grid;
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
  const { w, h } = KYOTO_META.grid;
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
  const { w, h } = KYOTO_META.grid;
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
  if (target < 0) throw new Error('Unable to connect Kyoto walkable component');
  for (let index = target; index !== start; index = parent[index]) {
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER
      ? CITY_TILE.BRIDGE
      : CITY_TILE.ROAD;
  }
}

function normalizeWalkableComponents(grid, protectedEntries) {
  const { w } = KYOTO_META.grid;
  const mainEntry = STATION_SOURCE.find((entry) => entry.id === 'kyoto');
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
      throw new Error(`Disconnected Kyoto walkable tile at ${index % w},${Math.floor(index / w)}`);
    }
  }
}

function createTerrain() {
  assertSnapshotContract();
  const length = KYOTO_META.grid.w * KYOTO_META.grid.h;
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

export function buildKyotoGeo() {
  const railwayMask = decodeTerrainRle(
    OSM_SNAPSHOT.railwayRle,
    KYOTO_META.grid.w * KYOTO_META.grid.h,
  );
  return {
    meta: KYOTO_META,
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
  return `// Generated by scripts/build-kyoto-geo.mjs. Do not edit by hand.\n// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot 2026-07-10).\n\nconst META = Object.freeze(${JSON.stringify(geo.meta, null, 2)});\nconst TERRAIN_RLE = ${JSON.stringify(terrainRuns)};\nconst RAILWAY_RLE = ${JSON.stringify(railwayRuns)};\n\nfunction decodeTerrain(runs, length) {\n  const terrain = new Uint8Array(length);\n  let offset = 0;\n  for (const [code, count] of runs) {\n    terrain.fill(code, offset, offset + count);\n    offset += count;\n  }\n  if (offset !== length) throw new Error(\`terrain RLE length mismatch: \${offset} !== \${length}\`);\n  return terrain;\n}\n\nconst LENGTH = META.grid.w * META.grid.h;\n\nexport const KYOTO_GEO = Object.freeze({\n  meta: META,\n  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),\n  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),\n  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),\n  railways: Object.freeze({\n    mask: decodeTerrain(RAILWAY_RLE, LENGTH),\n    tileCount: ${geo.railways.tileCount},\n  }),\n});\n`;
}

export function writeKyotoGeo(outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/components/world/cities/kyoto.geo.js',
)) {
  const geo = buildKyotoGeo();
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
  console.log(JSON.stringify(writeKyotoGeo()));
}
