import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTerrainFromSnapshot,
  decodeTerrainRle,
  encodeTerrainRle,
} from './build-french-city-geo-core.mjs';
import { normalizeFrenchBridgeTerrain } from './build-french-city-geo.mjs';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const BBOX = Object.freeze([6.105, 46.175, 6.185, 46.240]);
const SNAPSHOT_URL = new URL('./data/geneva-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = 'd60e7a789cfcae39db6d2971ef4ae6cda0ab6b661be917d3444205e3ff66012b';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const FERRY_LINKS = Object.freeze([
  Object.freeze({
    id: 'geneva-lake-shuttle',
    mode: 'ferry',
    stopIds: Object.freeze(['paquis-jetee', 'eaux-vives-landing']),
  }),
]);

const POIS = Object.freeze([
  {
    id: 'jet-deau',
    nameFr: "Jet d'Eau",
    lat: 46.2074,
    lon: 6.1561,
    kind: 'public-fountain',
    representationPolicy: 'location-and-public-fountain-form-only',
  },
  {
    id: 'cathedrale-saint-pierre',
    nameFr: 'Cathédrale Saint-Pierre',
    lat: 46.201,
    lon: 6.1488,
    kind: 'cathedral',
    representationPolicy: 'architectural-exterior-only',
  },
  {
    id: 'jardin-anglais',
    nameFr: 'Jardin Anglais',
    lat: 46.2038,
    lon: 6.152,
    kind: 'park',
  },
  {
    id: 'bains-des-paquis',
    nameFr: 'Bains des Pâquis',
    lat: 46.2117,
    lon: 6.1547,
    kind: 'public-lakeside-baths',
  },
  {
    id: 'palais-des-nations',
    nameFr: 'Palais des Nations',
    lat: 46.2266,
    lon: 6.14,
    kind: 'institutional-building-exterior',
    representationPolicy: 'architectural-exterior-only-no-emblem-flag-or-symbol-reproduction',
  },
  {
    id: 'plainpalais',
    nameFr: 'Plaine de Plainpalais',
    lat: 46.197,
    lon: 6.142,
    kind: 'public-square',
  },
  {
    id: 'carouge',
    nameFr: 'Carouge',
    lat: 46.181,
    lon: 6.139,
    kind: 'historic-district',
  },
  {
    id: 'parc-des-bastions',
    nameFr: 'Parc des Bastions',
    lat: 46.1995,
    lon: 6.145,
    kind: 'park',
  },
  {
    id: 'gare-cornavin',
    nameFr: 'Gare Cornavin',
    lat: 46.2104,
    lon: 6.1425,
    kind: 'railway-station-exterior',
  },
  {
    id: 'vieille-ville',
    nameFr: 'Vieille Ville',
    lat: 46.2005,
    lon: 6.1495,
    kind: 'historic-district',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'cornavin',
    poiId: 'gare-cornavin',
    nameFr: 'Gare Cornavin',
    lat: 46.2104,
    lon: 6.1425,
    line: 'Grandes lignes',
    routeId: 'geneva-mainline',
    routeIds: Object.freeze(['geneva-mainline']),
  },
]);

const FERRY_STOPS = Object.freeze([
  {
    id: 'paquis-jetee',
    nameFr: 'Jetée des Pâquis',
    lat: 46.211,
    lon: 6.1535,
    kind: 'ferry-landing',
    routeIds: Object.freeze(['geneva-lake-shuttle']),
  },
  {
    id: 'eaux-vives-landing',
    nameFr: 'Débarcadère des Eaux-Vives',
    lat: 46.2065,
    lon: 6.159,
    kind: 'ferry-landing',
    routeIds: Object.freeze(['geneva-lake-shuttle']),
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
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const available = ([x, y]) => claimed.every(([claimedX, claimedY]) => (
    Math.max(Math.abs(x - claimedX), Math.abs(y - claimedY)) >= minDistance
  ));
  for (const entry of entries) {
    if (entry.poiId && byId.has(entry.poiId)) {
      entry.tile = [...byId.get(entry.poiId).tile];
      continue;
    }
    const [originX, originY] = entry.tile;
    if (available(entry.tile)) {
      claimed.push(entry.tile);
      continue;
    }
    let snapped = null;
    for (let radius = 1; radius <= 8 && !snapped; radius += 1) {
      const candidates = [];
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = [originX + dx, originY + dy];
          if (candidate[0] < 0 || candidate[1] < 0
            || candidate[0] >= meta.grid.w || candidate[1] >= meta.grid.h) continue;
          candidates.push(candidate);
        }
      }
      candidates.sort((left, right) => (
        Math.hypot(left[0] - originX, left[1] - originY)
        - Math.hypot(right[0] - originX, right[1] - originY)
        || left[1] - right[1]
        || left[0] - right[0]
      ));
      snapped = candidates.find(available) ?? null;
    }
    if (!snapped) throw new Error(`Unable to separate Geneva marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
  }
}

function ensureWaterfrontAccess(grid, entry, meta, maxDistance = 32, targetSeen = null) {
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
    if (index !== start && !isCityBlocked(grid[index])
      && (!targetSeen || targetSeen[index])) {
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
  if (target < 0) throw new Error(`Unable to connect Geneva waterfront marker ${entry.id}`);
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
  const queue = [start];
  visited[start] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % meta.grid.w;
    const y = Math.floor(index / meta.grid.w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
      const next = ny * meta.grid.w + nx;
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
  const parent = new Int32Array(grid.length).fill(-1);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  let target = -1;
  queue[tail++] = start;
  parent[start] = start;
  while (head < tail && target < 0) {
    const index = queue[head++];
    const x = index % meta.grid.w;
    const y = Math.floor(index / meta.grid.w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
      const next = ny * meta.grid.w + nx;
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

function normalizeWalkableComponents(grid, protectedEntries, primaryTiles, meta) {
  const protectedIndexes = new Map(protectedEntries.map(({ id, tile: [x, y] }) => (
    [y * meta.grid.w + x, id]
  )));
  let primarySeen = combinedPrimarySeen(grid, primaryTiles, meta);
  const visited = primarySeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited, meta);
    const protectedIds = component
      .map((tileIndex) => protectedIndexes.get(tileIndex))
      .filter(Boolean);
    const protectedComponent = protectedIds.length > 0;
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    if (!connectToPrimaryLand(grid, component[0], primarySeen, meta)) {
      if (protectedComponent) {
        throw new Error(
          `Unable to connect protected Geneva marker without crossing water: ${protectedIds.join(',')}`,
        );
      }
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    primarySeen = combinedPrimarySeen(grid, primaryTiles, meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (primarySeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
}

function ferryAdjacency(ferryStops, width) {
  const stopIndexes = new Map(ferryStops.map(({ id, tile }) => (
    [id, tile[1] * width + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of FERRY_LINKS) {
    const [left, right] = stopIds.map((id) => stopIndexes.get(id));
    if (left === undefined || right === undefined) throw new Error('Geneva ferry stop is missing');
    adjacency.set(left, [...(adjacency.get(left) ?? []), right]);
    adjacency.set(right, [...(adjacency.get(right) ?? []), left]);
  }
  return adjacency;
}

function assertFerryConnected(grid, mainTile, ferryStops, meta) {
  const adjacency = ferryAdjacency(ferryStops, meta.grid.w);
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  const start = mainTile[1] * meta.grid.w + mainTile[0];
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
    const x = index % meta.grid.w;
    const y = Math.floor(index / meta.grid.w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
      const next = ny * meta.grid.w + nx;
      if (seen[next] || isCityBlocked(grid[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !seen[index]) {
      throw new Error(
        `Disconnected Geneva walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`,
      );
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
    if (typeof entry.nameFr !== 'string' || entry.nameFr.length === 0) {
      throw new Error(`Geneva missing nameFr for ${entry.id}`);
    }
  }
}

export function buildGenevaCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Geneva snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'geneva',
    bbox: BBOX,
    grid: Object.freeze(metrics.grid),
    metersPerTile: METERS_PER_TILE,
    projection: 'webmercator',
    aspectCorrection: Number(metrics.correction.toFixed(12)),
    contentLocale: 'fr',
    schema: Object.freeze({
      nameField: 'nameFr',
      localeSlots: 'central-lookup-expandable',
    }),
    source: Object.freeze({
      ...snapshot.source,
      snapshotSha256,
    }),
    connectivity: Object.freeze({
      method: 'cardinal-land-plus-geneva-lake-ferry-v1',
      ferryLinks: FERRY_LINKS,
    }),
    contentPolicy: Object.freeze({
      focus: 'tourism-architecture-lake-river',
      brandSignage: 'generalized-no-reproduction',
      emblemFlagAndOrganizationalSymbolReproduction: 'excluded',
      personLikeness: 'excluded',
      specificArtworkAndPublicSculptureReproduction: 'excluded',
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Geneva OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeFrenchBridgeTerrain(sourceTerrain, baseMeta);
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  const ferryStops = FERRY_STOPS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations, ...ferryStops]);
  separateMarkerTiles([...pois, ...stations, ...ferryStops], baseMeta);

  const protectedEntries = [...pois, ...stations, ...ferryStops];
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  const mainStation = stations[0];
  let waterfrontMainSeen = reachableFrom(
    bridges.terrain,
    mainStation.tile[1] * baseMeta.grid.w + mainStation.tile[0],
    baseMeta,
  );
  for (const entry of [
    ...ferryStops,
    ...['jet-deau', 'jardin-anglais', 'bains-des-paquis']
      .map((id) => pois.find((candidate) => candidate.id === id)),
  ]) {
    ensureWaterfrontAccess(bridges.terrain, entry, baseMeta, 32, waterfrontMainSeen);
    waterfrontMainSeen = reachableFrom(
      bridges.terrain,
      mainStation.tile[1] * baseMeta.grid.w + mainStation.tile[0],
      baseMeta,
    );
  }
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    bridges.terrain[y * baseMeta.grid.w + entrance.x] = CITY_TILE.ROAD;
  }
  normalizeWalkableComponents(
    bridges.terrain,
    protectedEntries,
    [mainStation.tile, ...ferryStops.map((entry) => entry.tile)],
    baseMeta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  assertFerryConnected(bridges.terrain, mainStation.tile, ferryStops, baseMeta);

  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
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
  return `// Generated by scripts/build-geneva-city-geo.mjs. Do not edit by hand.
// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot ${geo.meta.source.snapshot}).
// Locale schema: nameFr is canonical; contentLocale remains fr.

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

export const GENEVA_GEO = Object.freeze({
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

export function writeGenevaCityGeo() {
  const geo = buildGenevaCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/geneva.geo.js',
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
  console.log(JSON.stringify(writeGenevaCityGeo()));
}
