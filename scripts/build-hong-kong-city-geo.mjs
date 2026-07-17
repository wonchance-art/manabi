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
const BBOX = Object.freeze([114.10, 22.26, 114.22, 22.33]);
const SNAPSHOT_URL = new URL('./data/hong-kong-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = '6fa69fb00e416382d17c7b526ec33967c7d82d1d95cfe11ece906fe136d87b4a';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const FERRY_LINK = Object.freeze({
  id: 'star-ferry-victoria-harbour',
  mode: 'ferry',
  stopIds: Object.freeze(['star-ferry-tst', 'star-ferry-central']),
});
const BRIDGE_CONTRACT = Object.freeze({
  method: 'korean-bridge-three-way-mirror-v1',
  roadRule: 'two-land-contact-components-or-road-contact',
  absorptionRule: 'river-before-water',
});

const POIS = Object.freeze([
  {
    id: 'victoria-peak',
    nameZhHant: '太平山頂',
    nameZhHans: '太平山顶',
    lat: 22.2711,
    lon: 114.1494,
    kind: 'mountain',
    terrainHint: 'MOUNTAIN',
    trailAccess: true,
  },
  {
    id: 'star-ferry-tst',
    nameZhHant: '天星碼頭（尖沙咀）',
    nameZhHans: '天星码头（尖沙咀）',
    lat: 22.2938,
    lon: 114.1690,
    kind: 'ferry-terminal',
    routeId: FERRY_LINK.id,
  },
  {
    id: 'star-ferry-central',
    nameZhHant: '天星碼頭（中環）',
    nameZhHans: '天星码头（中环）',
    lat: 22.2870,
    lon: 114.1614,
    kind: 'ferry-terminal',
    routeId: FERRY_LINK.id,
  },
  {
    id: 'clock-tower',
    nameZhHant: '前九廣鐵路鐘樓',
    nameZhHans: '前九广铁路钟楼',
    lat: 22.2937,
    lon: 114.1693,
    kind: 'historic',
  },
  {
    id: 'tst-promenade',
    nameZhHant: '尖沙咀海濱花園',
    nameZhHans: '尖沙咀海滨花园',
    lat: 22.2930,
    lon: 114.1720,
    kind: 'promenade',
    representationPolicy: 'geography-only-no-handprints-or-person-likeness',
  },
  {
    id: 'temple-street',
    nameZhHant: '廟街夜市',
    nameZhHans: '庙街夜市',
    lat: 22.3070,
    lon: 114.1700,
    kind: 'market',
  },
  {
    id: 'mongkok-ladies',
    nameZhHant: '女人街',
    nameZhHans: '女人街',
    lat: 22.3190,
    lon: 114.1710,
    kind: 'market',
  },
  {
    id: 'man-mo-temple',
    nameZhHant: '文武廟',
    nameZhHans: '文武庙',
    lat: 22.2840,
    lon: 114.1500,
    kind: 'historic',
  },
  {
    id: 'mid-levels-escalator',
    nameZhHant: '半山自動扶梯',
    nameZhHans: '半山自动扶梯',
    lat: 22.2830,
    lon: 114.1550,
    kind: 'landmark',
  },
  {
    id: 'central-statue-square',
    nameZhHant: '皇后像廣場',
    nameZhHans: '皇后像广场',
    lat: 22.2810,
    lon: 114.1600,
    kind: 'plaza',
  },
  {
    id: 'victoria-park',
    nameZhHant: '維多利亞公園',
    nameZhHans: '维多利亚公园',
    lat: 22.2820,
    lon: 114.1880,
    kind: 'park',
  },
  {
    id: 'kowloon-park',
    nameZhHant: '九龍公園',
    nameZhHans: '九龙公园',
    lat: 22.3000,
    lon: 114.1700,
    kind: 'park',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'central',
    nameZhHant: '中環站',
    nameZhHans: '中环站',
    lat: 22.2820,
    lon: 114.1580,
    line: '荃灣線',
    routeId: 'tsuen-wan',
    routeIds: Object.freeze(['tsuen-wan']),
  },
  {
    id: 'admiralty',
    nameZhHant: '金鐘站',
    nameZhHans: '金钟站',
    lat: 22.2790,
    lon: 114.1650,
    line: '荃灣線',
    routeId: 'tsuen-wan',
    routeIds: Object.freeze(['tsuen-wan']),
  },
  {
    id: 'tsim-sha-tsui',
    nameZhHant: '尖沙咀站',
    nameZhHans: '尖沙咀站',
    lat: 22.2975,
    lon: 114.1722,
    line: '荃灣線',
    routeId: 'tsuen-wan',
    routeIds: Object.freeze(['tsuen-wan']),
  },
  {
    id: 'mong-kok',
    nameZhHant: '旺角站',
    nameZhHans: '旺角站',
    lat: 22.3190,
    lon: 114.1690,
    line: '荃灣線',
    routeId: 'tsuen-wan',
    routeIds: Object.freeze(['tsuen-wan']),
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
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    southWest,
    northEast,
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
    if (!snapped) throw new Error(`Unable to separate Hong Kong marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
  }
}

function ensureWaterfrontAccess(grid, entry, meta, maxDistance = 12) {
  const { w, h } = meta.grid;
  const start = entry.tile[1] * w + entry.tile[0];
  const previous = new Int32Array(grid.length);
  previous.fill(-2);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  previous[start] = -1;
  let target = -1;
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
  if (target < 0) throw new Error(`Unable to connect Hong Kong waterfront marker ${entry.id}`);
  for (let index = previous[target]; index >= 0; index = previous[index]) {
    grid[index] = CITY_TILE.SIDEWALK;
  }
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

function normalizeHongKongBridgeTerrain(sourceTerrain, meta) {
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
    const landSides = contactComponentCount(landContacts, width, height);
    if (landSides >= 2 || roadContacts > 0) {
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
    throw new Error(`HongKong bridge normalization left ${report.finalBridgeTileCount} bridge tiles`);
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
  const component = [];
  visited[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    component.push(index);
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
  return component;
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
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = CITY_TILE.ROAD;
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
        throw new Error('Unable to connect protected Hong Kong marker without crossing water');
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

function reachableWithFerry(grid, startTile, ferryTiles, meta) {
  const { w, h } = meta.grid;
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  const ferryIndexes = ferryTiles.map(([x, y]) => y * w + x);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    if (index === ferryIndexes[0] && !seen[ferryIndexes[1]]) {
      seen[ferryIndexes[1]] = 1;
      queue[tail++] = ferryIndexes[1];
    } else if (index === ferryIndexes[1] && !seen[ferryIndexes[0]]) {
      seen[ferryIndexes[0]] = 1;
      queue[tail++] = ferryIndexes[0];
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

function assertFerryConnected(grid, mainTile, ferryTiles, meta) {
  const seen = reachableWithFerry(grid, mainTile, ferryTiles, meta);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !seen[index]) {
      throw new Error(`Disconnected Hong Kong walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`);
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

function normalizeHongKongTerrain(
  terrain,
  protectedEntries,
  ferryEntries,
  entrance,
  exitTiles,
  meta,
) {
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    terrain[y * meta.grid.w + entrance.x] = CITY_TILE.ROAD;
  }
  normalizeWalkableComponents(
    terrain,
    protectedEntries.map((entry) => entry.tile),
    ferryEntries.map((entry) => entry.tile),
    meta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
}

function validateLocaleCoverage(entries) {
  for (const entry of entries) {
    for (const field of ['nameZhHant', 'nameZhHans']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`Hong Kong missing ${field} for ${entry.id}`);
      }
    }
  }
}

export function buildHongKongCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Hong Kong snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'hong-kong',
    bbox: BBOX,
    grid: Object.freeze(metrics.grid),
    metersPerTile: METERS_PER_TILE,
    projection: 'webmercator',
    aspectCorrection: Number(metrics.correction.toFixed(12)),
    contentLocale: 'zh',
    schema: Object.freeze({
      nameField: 'nameZhHant',
      companionNameField: 'nameZhHans',
      localeSlots: 'central-lookup-expandable',
    }),
    localeAnchors: Object.freeze(['zh-Hant', 'zh-Hans']),
    source: Object.freeze({
      ...snapshot.source,
      snapshotSha256,
    }),
    contentPolicy: Object.freeze({
      focus: 'tourism-architecture-food',
      politicalNarrative: 'excluded',
      brandSignage: 'generalized-no-reproduction',
      personLikeness: 'excluded',
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Hong Kong OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeHongKongBridgeTerrain(sourceTerrain, baseMeta);
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations]);
  separateMarkerTiles([...pois, ...stations], baseMeta);
  const mainStation = stations.find((entry) => entry.id === 'tsim-sha-tsui');
  const ferryEntries = FERRY_LINK.stopIds.map((id) => pois.find((entry) => entry.id === id));
  for (const id of ['star-ferry-tst', 'star-ferry-central', 'clock-tower', 'tst-promenade']) {
    ensureWaterfrontAccess(bridges.terrain, pois.find((entry) => entry.id === id), baseMeta);
  }
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  normalizeHongKongTerrain(
    bridges.terrain,
    [...pois, ...stations],
    ferryEntries,
    entrance,
    exitTiles,
    baseMeta,
  );
  assertFerryConnected(
    bridges.terrain,
    mainStation.tile,
    ferryEntries.map((entry) => entry.tile),
    baseMeta,
  );
  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
    connectivity: Object.freeze({
      method: 'cardinal-land-plus-star-ferry-v1',
      ferryLink: FERRY_LINK,
    }),
    buildingTexture: Object.freeze({
      method: 'osm-existing-buildings-report-only',
      version: 1,
      publicDatasetProbe: Object.freeze({
        provider: 'OpenStreetMap',
        datasetId: 'building=*',
        checkedAt: '2026-07-17',
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
    transitPoints: [pois.find((entry) => entry.id === 'star-ferry-tst')],
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
  return `// Generated by scripts/build-hong-kong-city-geo.mjs. Do not edit by hand.
// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot ${geo.meta.source.snapshot}).
// Locale schema: nameZhHant is canonical; nameZhHans is the learning-track companion; contentLocale remains zh.

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

export const HONG_KONG_GEO = Object.freeze({
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

export function writeHongKongCityGeo() {
  const geo = buildHongKongCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/hong-kong.geo.js',
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
  console.log(JSON.stringify(writeHongKongCityGeo()));
}
