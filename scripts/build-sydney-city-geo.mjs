import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTerrainFromSnapshot,
  decodeTerrainRle,
  encodeTerrainRle,
} from './build-french-city-geo-core.mjs';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const BBOX = Object.freeze([151.17, -33.93, 151.31, -33.79]);
const SNAPSHOT_URL = new URL('./data/sydney-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = '05ef072f5cd19d2767dcb86ef7b66dfdf03e5505623f341cf8a200f6d2160b32';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const BRIDGE_CONTRACT = Object.freeze({
  method: 'korean-bridge-three-way-mirror-v1',
  roadRule: 'two-land-contact-components-or-road-contact',
  absorptionRule: 'river-before-water',
});
const FERRY_LINKS = Object.freeze([
  Object.freeze({
    id: 'f1-circular-quay-manly',
    mode: 'ferry',
    stopIds: Object.freeze(['circular-quay-ferry', 'manly-ferry']),
  }),
  Object.freeze({
    id: 'f2-circular-quay-taronga',
    mode: 'ferry',
    stopIds: Object.freeze(['circular-quay-ferry', 'taronga-ferry']),
  }),
  Object.freeze({
    id: 'f9-circular-quay-watsons-bay',
    mode: 'ferry',
    stopIds: Object.freeze(['circular-quay-ferry', 'watsons-bay-ferry']),
  }),
]);

const POIS = Object.freeze([
  {
    id: 'opera-house',
    nameEn: 'Sydney Opera House',
    nameKo: '시드니 오페라하우스',
    lat: -33.8568,
    lon: 151.2153,
    kind: 'performing-arts-building',
    representationPolicy: 'architectural-exterior-silhouette-only-no-performance-or-brand-reproduction',
  },
  {
    id: 'harbour-bridge',
    nameEn: 'Sydney Harbour Bridge',
    nameKo: '시드니 하버브리지',
    lat: -33.8523,
    lon: 151.2108,
    kind: 'historic-bridge',
    terrainHint: 'ROAD',
    representationPolicy: 'architectural-exterior-only',
  },
  {
    id: 'the-rocks',
    nameEn: 'The Rocks',
    nameKo: '록스',
    lat: -33.8599,
    lon: 151.2086,
    kind: 'historic-district',
  },
  {
    id: 'circular-quay',
    nameEn: 'Circular Quay',
    nameKo: '서큘러키',
    lat: -33.8611,
    lon: 151.2111,
    kind: 'harbour-quay',
  },
  {
    id: 'royal-botanic-garden',
    nameEn: 'Royal Botanic Garden',
    nameKo: '왕립식물원',
    lat: -33.8642,
    lon: 151.2160,
    kind: 'garden',
  },
  {
    id: 'darling-harbour',
    nameEn: 'Darling Harbour',
    nameKo: '달링하버',
    lat: -33.8747,
    lon: 151.2008,
    kind: 'harbour',
  },
  {
    id: 'barangaroo',
    nameEn: 'Barangaroo',
    nameKo: '바랑가루',
    lat: -33.8626,
    lon: 151.2014,
    kind: 'waterfront-district',
  },
  {
    id: 'qvb',
    nameEn: 'Queen Victoria Building',
    nameKo: '퀸빅토리아빌딩',
    lat: -33.8718,
    lon: 151.2067,
    kind: 'historic-building',
    representationPolicy: 'architectural-exterior-only-no-brand-reproduction',
  },
  {
    id: 'chinatown',
    nameEn: 'Chinatown',
    nameKo: '차이나타운',
    lat: -33.8799,
    lon: 151.2045,
    kind: 'district',
  },
  {
    id: 'newtown-king-st',
    nameEn: 'King Street, Newtown',
    nameKo: '뉴타운 킹스트리트',
    lat: -33.8971,
    lon: 151.1829,
    kind: 'main-street',
  },
  {
    id: 'paddington',
    nameEn: 'Paddington',
    nameKo: '패딩턴',
    lat: -33.8845,
    lon: 151.2260,
    kind: 'district',
  },
  {
    id: 'bondi-beach',
    nameEn: 'Bondi Beach',
    nameKo: '본다이비치',
    lat: -33.8915,
    lon: 151.2740,
    kind: 'beach',
  },
  {
    id: 'manly',
    nameEn: 'Manly',
    nameKo: '맨리',
    lat: -33.7972,
    lon: 151.2885,
    kind: 'beach-and-corso',
  },
  {
    id: 'watsons-bay',
    nameEn: 'Watsons Bay',
    nameKo: '왓슨스베이',
    lat: -33.8430,
    lon: 151.2821,
    kind: 'harbour-bay',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'central',
    nameEn: 'Central station',
    nameKo: '센트럴역',
    lat: -33.8830,
    lon: 151.2067,
    line: 'City Circle and Eastern Suburbs lines',
    routeId: 'city-circle',
    routeIds: Object.freeze(['city-circle', 'eastern-suburbs']),
  },
  {
    id: 'town-hall',
    nameEn: 'Town Hall station',
    nameKo: '타운홀역',
    lat: -33.8731,
    lon: 151.2068,
    line: 'City Circle and Eastern Suburbs lines',
    routeId: 'city-circle',
    routeIds: Object.freeze(['city-circle', 'eastern-suburbs']),
  },
  {
    id: 'circular-quay-station',
    nameEn: 'Circular Quay station',
    nameKo: '서큘러키역',
    lat: -33.8614,
    lon: 151.2111,
    line: 'City Circle',
    routeId: 'city-circle',
    routeIds: Object.freeze(['city-circle']),
  },
  {
    id: 'martin-place',
    nameEn: 'Martin Place station',
    nameKo: '마틴플레이스역',
    lat: -33.8679,
    lon: 151.2112,
    line: 'Eastern Suburbs line',
    routeId: 'eastern-suburbs',
    routeIds: Object.freeze(['eastern-suburbs']),
  },
  {
    id: 'bondi-junction',
    nameEn: 'Bondi Junction station',
    nameKo: '본다이정션역',
    lat: -33.8910,
    lon: 151.2470,
    line: 'Eastern Suburbs line',
    routeId: 'eastern-suburbs',
    routeIds: Object.freeze(['eastern-suburbs']),
  },
]);

const FERRY_STOPS = Object.freeze([
  {
    id: 'circular-quay-ferry',
    nameEn: 'Circular Quay ferry wharves',
    nameKo: '서큘러키 페리 부두',
    lat: -33.8615,
    lon: 151.2114,
    kind: 'ferry-terminal',
    routeIds: Object.freeze(FERRY_LINKS.map(({ id }) => id)),
  },
  {
    id: 'manly-ferry',
    nameEn: 'Manly Wharf',
    nameKo: '맨리 부두',
    lat: -33.8007,
    lon: 151.2859,
    kind: 'ferry-terminal',
    routeIds: Object.freeze(['f1-circular-quay-manly']),
  },
  {
    id: 'taronga-ferry',
    nameEn: 'Taronga Zoo Wharf',
    nameKo: '타롱가 부두',
    lat: -33.8464,
    lon: 151.2414,
    kind: 'ferry-wharf',
    routeIds: Object.freeze(['f2-circular-quay-taronga']),
    representationPolicy: 'wharf-location-only-no-exhibit-reproduction',
  },
  {
    id: 'watsons-bay-ferry',
    nameEn: 'Watsons Bay Wharf',
    nameKo: '왓슨스베이 부두',
    lat: -33.8431,
    lon: 151.2813,
    kind: 'ferry-wharf',
    routeIds: Object.freeze(['f9-circular-quay-watsons-bay']),
  },
]);

function webMercatorMeters(lon, lat) {
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + limitedLat * DEG / 2)),
  };
}

function projectionMetrics(bbox) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const southWest = webMercatorMeters(minLon, minLat);
  const northEast = webMercatorMeters(maxLon, maxLat);
  const midLatitude = (minLat + maxLat) / 2;
  const correction = Math.cos(midLatitude * DEG);
  return {
    southWest,
    northEast,
    midLatitude,
    correction,
    grid: {
      w: Math.ceil(((northEast.x - southWest.x) * correction) / METERS_PER_TILE),
      h: Math.ceil(((northEast.y - southWest.y) * correction) / METERS_PER_TILE),
    },
  };
}

function projectLatLonToTile(lat, lon, meta, metrics) {
  const point = webMercatorMeters(lon, lat);
  return [
    Math.max(0, Math.min(
      meta.grid.w - 1,
      Math.floor(((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile),
    )),
    Math.max(0, Math.min(
      meta.grid.h - 1,
      Math.floor(((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile),
    )),
  ];
}

function withTile(entry, meta, metrics) {
  return {
    ...entry,
    contentLocale: meta.contentLocale,
    lat: Number(entry.lat.toFixed(7)),
    lon: Number(entry.lon.toFixed(7)),
    tile: projectLatLonToTile(entry.lat, entry.lon, meta, metrics),
  };
}

function separateMarkerTiles(entries, meta, minDistance = 2) {
  const claimed = [];
  for (const entry of entries) {
    const [originX, originY] = entry.tile;
    const available = ([x, y]) => claimed.every(([claimedX, claimedY]) => (
      Math.max(Math.abs(x - claimedX), Math.abs(y - claimedY)) >= minDistance
    ));
    if (available(entry.tile)) {
      claimed.push(entry.tile);
      continue;
    }
    let snapped = null;
    for (let radius = 1; radius <= 8 && !snapped; radius += 1) {
      for (let dy = -radius; dy <= radius && !snapped; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = [originX + dx, originY + dy];
          if (candidate[0] < 0 || candidate[1] < 0
            || candidate[0] >= meta.grid.w || candidate[1] >= meta.grid.h) continue;
          if (available(candidate)) {
            snapped = candidate;
            break;
          }
        }
      }
    }
    if (!snapped) throw new Error(`Unable to separate Sydney marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
  }
}

function ensureWaterfrontAccess(grid, entry, meta, maxDistance = 28, pathCode = CITY_TILE.SIDEWALK) {
  const { w, h } = meta.grid;
  const start = entry.tile[1] * w + entry.tile[0];
  const previous = new Int32Array(grid.length);
  previous.fill(-2);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  let target = -1;
  queue[tail++] = start;
  previous[start] = -1;
  while (head < tail && target < 0) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    const distance = Math.abs(x - entry.tile[0]) + Math.abs(y - entry.tile[1]);
    if (index !== start && !isCityBlocked(grid[index])) {
      target = index;
      break;
    }
    if (distance >= maxDistance) continue;
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (previous[next] !== -2) continue;
      previous[next] = index;
      queue[tail++] = next;
    }
  }
  if (target < 0) throw new Error(`Unable to connect Sydney waterfront marker ${entry.id}`);
  for (let index = previous[target]; index >= 0; index = previous[index]) grid[index] = pathCode;
}

function ensureWalkableAnchor(grid, tile, meta) {
  const [x, y] = tile;
  const index = y * meta.grid.w + x;
  if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.PLAZA;
  if (CARDINAL.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < meta.grid.w && ny < meta.grid.h
      && !isCityBlocked(grid[ny * meta.grid.w + nx]);
  })) return;
  const nx = x > 0 ? x - 1 : x + 1;
  grid[y * meta.grid.w + nx] = CITY_TILE.PLAZA;
}

function isLandContact(code) {
  return code !== CITY_TILE.WATER
    && code !== CITY_TILE.RIVER
    && code !== CITY_TILE.BUILDING
    && code !== CITY_TILE.ISLAND
    && code !== CITY_TILE.MOUNTAIN
    && code !== CITY_TILE.BRIDGE;
}

function contactComponentCount(contacts, width, height) {
  const remaining = new Set(contacts);
  let components = 0;
  while (remaining.size > 0) {
    components += 1;
    const start = remaining.values().next().value;
    remaining.delete(start);
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!remaining.delete(next)) continue;
        queue.push(next);
      }
    }
  }
  return components;
}

function normalizeSydneyBridgeTerrain(sourceTerrain, meta) {
  const terrain = sourceTerrain.slice();
  const { w: width, h: height } = meta.grid;
  const seen = new Uint8Array(terrain.length);
  const report = {
    ...BRIDGE_CONTRACT,
    sourceBridgeTileCount: 0,
    componentCount: 0,
    roadComponentCount: 0,
    absorbedComponentCount: 0,
    roadTileCount: 0,
    absorbedWaterTileCount: 0,
    absorbedRiverTileCount: 0,
    finalBridgeTileCount: 0,
  };

  for (let start = 0; start < terrain.length; start += 1) {
    if (terrain[start] !== CITY_TILE.BRIDGE || seen[start]) continue;
    report.componentCount += 1;
    const component = [start];
    const landContacts = new Set();
    seen[start] = 1;
    let roadContacts = 0;
    let riverContacts = 0;
    for (let head = 0; head < component.length; head += 1) {
      const index = component[head];
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        const code = terrain[next];
        if (code === CITY_TILE.BRIDGE) {
          if (!seen[next]) {
            seen[next] = 1;
            component.push(next);
          }
          continue;
        }
        if (isLandContact(code)) landContacts.add(next);
        if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK) roadContacts += 1;
        if (code === CITY_TILE.RIVER) riverContacts += 1;
      }
    }

    report.sourceBridgeTileCount += component.length;
    if (contactComponentCount(landContacts, width, height) >= 2 || roadContacts > 0) {
      report.roadComponentCount += 1;
      report.roadTileCount += component.length;
      for (const index of component) terrain[index] = CITY_TILE.ROAD;
      continue;
    }
    report.absorbedComponentCount += 1;
    const replacement = riverContacts > 0 ? CITY_TILE.RIVER : CITY_TILE.WATER;
    if (replacement === CITY_TILE.RIVER) report.absorbedRiverTileCount += component.length;
    else report.absorbedWaterTileCount += component.length;
    for (const index of component) terrain[index] = replacement;
  }
  for (const code of terrain) {
    if (code === CITY_TILE.BRIDGE) report.finalBridgeTileCount += 1;
  }
  if (report.finalBridgeTileCount > 0) {
    throw new Error(`Sydney bridge normalization left ${report.finalBridgeTileCount} bridge tiles`);
  }
  return { terrain, report: Object.freeze(report) };
}

function reachableFrom(grid, start, meta) {
  const { w, h } = meta.grid;
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
    for (const [dx, dy] of CARDINAL) {
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

function collectComponent(grid, start, visited, meta) {
  const { w, h } = meta.grid;
  const queue = [start];
  visited[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (visited[next] || isCityBlocked(grid[next])) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  return queue;
}

function combinedPrimarySeen(grid, primaryTiles, meta) {
  const seen = new Uint8Array(grid.length);
  for (const [x, y] of primaryTiles) {
    const component = reachableFrom(grid, y * meta.grid.w + x, meta);
    for (let index = 0; index < seen.length; index += 1) {
      if (component[index]) seen[index] = 1;
    }
  }
  return seen;
}

function connectToPrimaryLand(grid, start, primarySeen, meta) {
  const { w, h } = meta.grid;
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
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (parent[next] >= 0) continue;
      if (grid[next] === CITY_TILE.WATER || grid[next] === CITY_TILE.RIVER) continue;
      parent[next] = index;
      if (primarySeen[next]) {
        target = next;
        break;
      }
      queue[tail++] = next;
    }
  }
  if (target < 0) return false;
  for (let index = target; index !== start; index = parent[index]) {
    if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.ROAD;
  }
  return true;
}

function normalizeWalkableComponents(grid, protectedTiles, ferryTiles, meta) {
  const protectedIndexes = new Set(protectedTiles.map(([x, y]) => y * meta.grid.w + x));
  let primarySeen = combinedPrimarySeen(grid, ferryTiles, meta);
  const visited = primarySeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited, meta);
    const protectedComponent = component.some((tileIndex) => protectedIndexes.has(tileIndex));
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    if (!connectToPrimaryLand(grid, component[0], primarySeen, meta)) {
      if (protectedComponent) {
        throw new Error('Unable to connect protected Sydney marker without crossing water');
      }
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    primarySeen = combinedPrimarySeen(grid, ferryTiles, meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (primarySeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
}

function ferryAdjacency(ferryStops, ferryLinks, width) {
  const stopIndexById = new Map(ferryStops.map(({ id, tile }) => (
    [id, tile[1] * width + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of ferryLinks) {
    const [left, right] = stopIds.map((id) => stopIndexById.get(id));
    if (left === undefined || right === undefined) throw new Error('Sydney ferry stop is missing');
    if (!adjacency.has(left)) adjacency.set(left, []);
    if (!adjacency.has(right)) adjacency.set(right, []);
    adjacency.get(left).push(right);
    adjacency.get(right).push(left);
  }
  return adjacency;
}

function reachableWithFerries(grid, startTile, ferryStops, meta) {
  const { w, h } = meta.grid;
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  const adjacency = ferryAdjacency(ferryStops, FERRY_LINKS, w);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    for (const other of adjacency.get(index) ?? []) {
      if (!seen[other]) {
        seen[other] = 1;
        queue[tail++] = other;
      }
    }
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of CARDINAL) {
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

function assertFerryConnected(grid, mainTile, ferryStops, meta) {
  const seen = reachableWithFerries(grid, mainTile, ferryStops, meta);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !seen[index]) {
      throw new Error(`Disconnected Sydney walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`);
    }
  }
}

function terrainStats(terrain) {
  let landTileCount = 0;
  let buildingTileCount = 0;
  for (const code of terrain) {
    if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) continue;
    landTileCount += 1;
    if (code === CITY_TILE.BUILDING) buildingTileCount += 1;
  }
  return {
    landTileCount,
    buildingTileCount,
    landBuildingRatio: Number((buildingTileCount / landTileCount).toFixed(6)),
  };
}

function validateLocaleCoverage(entries) {
  for (const entry of entries) {
    for (const field of ['nameEn', 'nameKo']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`Sydney missing ${field} for ${entry.id}`);
      }
    }
  }
}

export function buildSydneyCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Sydney snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'sydney',
    bbox: BBOX,
    grid: Object.freeze(metrics.grid),
    metersPerTile: METERS_PER_TILE,
    projection: 'webmercator',
    aspectCorrection: Number(metrics.correction.toFixed(12)),
    contentLocale: 'en',
    schema: Object.freeze({
      nameField: 'nameEn',
      companionNameField: 'nameKo',
      localeSlots: 'central-lookup-expandable',
    }),
    source: Object.freeze({
      ...snapshot.source,
      snapshotSha256,
    }),
    southernHemisphereProjection: Object.freeze({
      method: 'signed-mid-latitude-positive-cosine-v1',
      midLatitude: Number(metrics.midLatitude.toFixed(12)),
      correctionIsPositive: metrics.correction > 0,
      northProjectsUp: true,
    }),
    contentPolicy: Object.freeze({
      focus: 'tourism-architecture-beaches-harbour',
      brandSignage: 'generalized-no-reproduction',
      personLikeness: 'excluded',
      performanceAndExhibitReproduction: 'excluded',
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Sydney OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeSydneyBridgeTerrain(sourceTerrain, baseMeta);
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  const ferryStops = FERRY_STOPS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations, ...ferryStops]);
  separateMarkerTiles([...pois, ...stations, ...ferryStops], baseMeta);

  const mainStation = stations.find((entry) => entry.id === 'central');
  for (const entry of ferryStops) ensureWaterfrontAccess(bridges.terrain, entry, baseMeta);
  for (const id of ['opera-house', 'harbour-bridge', 'circular-quay', 'darling-harbour',
    'barangaroo', 'bondi-beach', 'manly', 'watsons-bay']) {
    ensureWaterfrontAccess(
      bridges.terrain,
      pois.find((entry) => entry.id === id),
      baseMeta,
      32,
      id === 'harbour-bridge' ? CITY_TILE.ROAD : CITY_TILE.SIDEWALK,
    );
  }
  const protectedEntries = [...pois, ...stations, ...ferryStops];
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    bridges.terrain[y * baseMeta.grid.w + entrance.x] = CITY_TILE.ROAD;
  }
  normalizeWalkableComponents(
    bridges.terrain,
    protectedEntries.map((entry) => entry.tile),
    ferryStops.map((entry) => entry.tile),
    baseMeta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  assertFerryConnected(bridges.terrain, mainStation.tile, ferryStops, baseMeta);

  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
    connectivity: Object.freeze({
      method: 'cardinal-land-plus-multi-harbour-ferry-v1',
      ferryLinks: FERRY_LINKS,
    }),
    buildingTexture: Object.freeze({
      method: 'osm-existing-buildings-report-only',
      version: 1,
      publicDatasetProbe: Object.freeze({
        provider: 'OpenStreetMap',
        datasetId: 'building=*',
        checkedAt: '2026-07-18',
        outcome: 'fixed-offline-snapshot',
      }),
      initialLandTileCount: initialBuildingStats.landTileCount,
      initialBuildingTileCount: initialBuildingStats.buildingTileCount,
      initialLandBuildingRatio: initialBuildingStats.landBuildingRatio,
      finalLandTileCount: finalBuildingStats.landTileCount,
      finalBuildingTileCount: finalBuildingStats.buildingTileCount,
      finalLandBuildingRatio: finalBuildingStats.landBuildingRatio,
    }),
    bridgeNormalization: bridges.report,
  });
  const railwayMask = decodeTerrainRle(snapshot.railwayRle, bridges.terrain.length);
  return {
    meta,
    terrain: bridges.terrain,
    pois,
    stations,
    transitPoints: ferryStops,
    entrance,
    exitTiles,
    railways: {
      mask: railwayMask,
      tileCount: railwayMask.reduce((sum, code) => sum + Number(Boolean(code)), 0),
    },
  };
}

function generatedModule(geo) {
  const terrainRuns = encodeTerrainRle(geo.terrain);
  const railwayRuns = encodeTerrainRle(geo.railways.mask);
  return `// Generated by scripts/build-sydney-city-geo.mjs. Do not edit by hand.
// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot ${geo.meta.source.snapshot}).
// Locale schema: nameEn is canonical; nameKo is the optional companion; contentLocale remains en.

const META = Object.freeze(${JSON.stringify(geo.meta, null, 2)});
const TERRAIN_RLE = ${JSON.stringify(terrainRuns)};
const RAILWAY_RLE = ${JSON.stringify(railwayRuns)};

function decodeTerrain(runs, length) {
  const terrain = new Uint8Array(length);
  let offset = 0;
  for (const [code, count] of runs) {
    terrain.fill(code, offset, offset + count);
    offset += count;
  }
  if (offset !== length) throw new Error(\`terrain RLE length mismatch: \${offset} !== \${length}\`);
  return terrain;
}

const LENGTH = META.grid.w * META.grid.h;

export const SYDNEY_GEO = Object.freeze({
  meta: META,
  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),
  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),
  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),
  transitPoints: Object.freeze(${JSON.stringify(geo.transitPoints, null, 2)}),
  entrance: Object.freeze(${JSON.stringify(geo.entrance)}),
  exitTiles: Object.freeze(${JSON.stringify(geo.exitTiles)}),
  railways: Object.freeze({
    mask: decodeTerrain(RAILWAY_RLE, LENGTH),
    tileCount: ${geo.railways.tileCount},
  }),
});
`;
}

export function writeSydneyCityGeo() {
  const geo = buildSydneyCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/sydney.geo.js',
  );
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
  console.log(JSON.stringify(writeSydneyCityGeo()));
}
