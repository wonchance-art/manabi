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
const BBOX = Object.freeze([121.49, 25.02, 121.58, 25.11]);
const SNAPSHOT_URL = new URL('./data/taipei-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = 'be26a6e1c81dee432e67002ee630d20662c9337b79e281b3461a9ed2ec58856b';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const BRIDGE_CONTRACT = Object.freeze({
  method: 'korean-bridge-three-way-mirror-v1',
  roadRule: 'two-land-contact-components-or-road-contact',
  absorptionRule: 'river-before-water',
});

const POIS = Object.freeze([
  {
    id: 'taipei-101',
    nameZhHant: '臺北101',
    nameZhHans: '台北101',
    lat: 25.0339,
    lon: 121.5645,
    kind: 'landmark',
  },
  {
    id: 'longshan-temple',
    nameZhHant: '龍山寺',
    nameZhHans: '龙山寺',
    lat: 25.0372,
    lon: 121.4999,
    kind: 'historic',
  },
  {
    id: 'ximending',
    nameZhHant: '西門町',
    nameZhHans: '西门町',
    lat: 25.0421,
    lon: 121.5070,
    kind: 'district',
  },
  {
    id: 'cks-memorial',
    nameZhHant: '中正紀念堂',
    nameZhHans: '中正纪念堂',
    lat: 25.0347,
    lon: 121.5217,
    kind: 'landmark',
    representationPolicy: 'architecture-and-plaza-only-no-politics',
  },
  {
    id: 'national-palace-museum',
    nameZhHant: '國立故宮博物院',
    nameZhHans: '国立故宫博物院',
    lat: 25.1024,
    lon: 121.5485,
    kind: 'museum',
    representationPolicy: 'exterior-only-no-collection',
  },
  {
    id: 'shilin-market',
    nameZhHant: '士林夜市',
    nameZhHans: '士林夜市',
    lat: 25.0880,
    lon: 121.5245,
    kind: 'market',
  },
  {
    id: 'raohe-market',
    nameZhHant: '饒河街觀光夜市',
    nameZhHans: '饶河街观光夜市',
    lat: 25.0510,
    lon: 121.5776,
    kind: 'market',
  },
  {
    id: 'dihua-street',
    nameZhHant: '迪化街',
    nameZhHans: '迪化街',
    lat: 25.0570,
    lon: 121.5100,
    kind: 'district',
  },
  {
    id: 'bopiliao',
    nameZhHant: '剝皮寮歷史街區',
    nameZhHans: '剥皮寮历史街区',
    lat: 25.0369,
    lon: 121.5018,
    kind: 'historic',
  },
  {
    id: 'daan-park',
    nameZhHant: '大安森林公園',
    nameZhHans: '大安森林公园',
    lat: 25.0300,
    lon: 121.5360,
    kind: 'park',
  },
  {
    id: 'huashan-1914',
    nameZhHant: '華山1914文化創意產業園區',
    nameZhHans: '华山1914文化创意产业园区',
    lat: 25.0440,
    lon: 121.5290,
    kind: 'district',
  },
  {
    id: 'elephant-mountain',
    nameZhHant: '象山',
    nameZhHans: '象山',
    lat: 25.0270,
    lon: 121.5710,
    kind: 'mountain',
    terrainHint: 'MOUNTAIN',
    trailAccess: true,
  },
  {
    id: 'presidential-office',
    nameZhHant: '總統府',
    nameZhHans: '总统府',
    lat: 25.0400,
    lon: 121.5120,
    kind: 'landmark',
    representationPolicy: 'exterior-only-no-politics',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'taipei-main',
    nameZhHant: '台北車站',
    nameZhHans: '台北车站',
    lat: 25.0478,
    lon: 121.5170,
    line: '淡水信義線 · 板南線 · 臺鐵 · 台灣高鐵',
    routeId: 'tamsui-xinyi',
    routeIds: Object.freeze(['tamsui-xinyi', 'bannan']),
  },
  {
    id: 'ximen',
    nameZhHant: '西門站',
    nameZhHans: '西门站',
    lat: 25.0420,
    lon: 121.5083,
    line: '板南線',
    routeId: 'bannan',
    routeIds: Object.freeze(['bannan']),
  },
  {
    id: 'taipei-101-station',
    nameZhHant: '台北101／世貿站',
    nameZhHans: '台北101／世贸站',
    lat: 25.0330,
    lon: 121.5622,
    line: '淡水信義線',
    routeId: 'tamsui-xinyi',
    routeIds: Object.freeze(['tamsui-xinyi']),
  },
  {
    id: 'shilin',
    nameZhHant: '士林站',
    nameZhHans: '士林站',
    lat: 25.0937,
    lon: 121.5262,
    line: '淡水信義線',
    routeId: 'tamsui-xinyi',
    routeIds: Object.freeze(['tamsui-xinyi']),
  },
  {
    id: 'zhongxiao-fuxing',
    nameZhHant: '忠孝復興站',
    nameZhHans: '忠孝复兴站',
    lat: 25.0417,
    lon: 121.5440,
    line: '板南線',
    routeId: 'bannan',
    routeIds: Object.freeze(['bannan']),
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

function separateMarkerTiles(entries, meta, minDistance = 3) {
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
    if (!snapped) throw new Error(`Unable to separate Taipei marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
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

function normalizeTaipeiBridgeTerrain(sourceTerrain, meta) {
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
    throw new Error(`Taipei bridge normalization left ${report.finalBridgeTileCount} bridge tiles`);
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

function connectToMain(grid, start, mainSeen, meta) {
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
      parent[next] = index;
      if (mainSeen[next]) {
        target = next;
        break;
      }
      queue[tail++] = next;
    }
  }
  if (target < 0) throw new Error('Unable to connect Taipei walkable component');
  for (let index = target; index !== start; index = parent[index]) {
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER
      ? CITY_TILE.BRIDGE
      : CITY_TILE.ROAD;
  }
}

function normalizeWalkableComponents(grid, protectedTiles, mainTile, meta) {
  const mainStart = mainTile[1] * meta.grid.w + mainTile[0];
  const protectedIndexes = new Set(protectedTiles.map(([x, y]) => y * meta.grid.w + x));
  let mainSeen = reachableFrom(grid, mainStart, meta);
  const visited = mainSeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited, meta);
    const protectedComponent = component.some((tileIndex) => protectedIndexes.has(tileIndex));
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    connectToMain(grid, component[0], mainSeen, meta);
    mainSeen = reachableFrom(grid, mainStart, meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (mainSeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
}

function assertSingleWalkableComponent(grid, mainTile, meta) {
  const seen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !seen[index]) {
      throw new Error(`Disconnected Taipei walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`);
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

function normalizeTaipeiTerrain(terrain, protectedEntries, mainStation, entrance, exitTiles, meta) {
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    terrain[y * meta.grid.w + entrance.x] = CITY_TILE.ROAD;
  }
  normalizeWalkableComponents(
    terrain,
    protectedEntries.map((entry) => entry.tile),
    mainStation.tile,
    meta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
}

function validateLocaleCoverage(entries) {
  for (const entry of entries) {
    for (const field of ['nameZhHant', 'nameZhHans']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`Taipei missing ${field} for ${entry.id}`);
      }
    }
  }
}

export function buildTaipeiCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Taipei snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'taipei',
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
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Taipei OSM snapshot projection contract mismatch');
  }

  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations]);
  separateMarkerTiles([...pois, ...stations], baseMeta);
  const mainStation = stations.find((entry) => entry.id === 'taipei-main');
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(sourceTerrain);
  normalizeTaipeiTerrain(
    sourceTerrain,
    [...pois, ...stations],
    mainStation,
    entrance,
    exitTiles,
    baseMeta,
  );
  const bridges = normalizeTaipeiBridgeTerrain(sourceTerrain, baseMeta);
  assertSingleWalkableComponent(bridges.terrain, mainStation.tile, baseMeta);
  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
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
  return `// Generated by scripts/build-taipei-city-geo.mjs. Do not edit by hand.
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

export const TAIPEI_GEO = Object.freeze({
  meta: META,
  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),
  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),
  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),
  entrance: Object.freeze(${JSON.stringify(geo.entrance)}),
  exitTiles: Object.freeze(${JSON.stringify(geo.exitTiles)}),
  railways: Object.freeze({
    mask: decodeTerrain(RAILWAY_RLE, LENGTH),
    tileCount: ${geo.railways.tileCount},
  }),
});
`;
}

export function writeTaipeiCityGeo() {
  const geo = buildTaipeiCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/taipei.geo.js',
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
  console.log(JSON.stringify(writeTaipeiCityGeo()));
}
