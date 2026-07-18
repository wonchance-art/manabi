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
const BBOX = Object.freeze([5.32, 43.245, 5.42, 43.325]);
const SNAPSHOT_URL = new URL('./data/marseille-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = '94d19706d74a3adf8b7ae299bbf8812eb6aef01bfde8c018cff552a3f1745adf';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const FERRY_LINKS = Object.freeze([
  Object.freeze({
    id: 'vieux-port-chateau-dif',
    mode: 'ferry',
    stopIds: Object.freeze(['vieux-port-quay', 'chateau-dif-landing']),
  }),
  Object.freeze({
    id: 'vieux-port-ferry-boat',
    mode: 'ferry',
    stopIds: Object.freeze(['ferry-boat-south', 'ferry-boat-north']),
  }),
]);

const POIS = Object.freeze([
  {
    id: 'vieux-port',
    nameFr: 'Vieux-Port',
    lat: 43.2946,
    lon: 5.3745,
    kind: 'historic-harbour',
  },
  {
    id: 'notre-dame-de-la-garde',
    nameFr: 'Notre-Dame de la Garde',
    lat: 43.284,
    lon: 5.3714,
    kind: 'hilltop-basilica',
    representationPolicy: 'architectural-exterior-only-no-person-likeness-reproduction',
  },
  {
    id: 'le-panier',
    nameFr: 'Le Panier',
    lat: 43.2995,
    lon: 5.369,
    kind: 'historic-district',
  },
  {
    id: 'mucem',
    nameFr: 'MuCEM',
    lat: 43.2967,
    lon: 5.361,
    kind: 'museum-exterior',
    representationPolicy: 'architectural-exterior-only-no-collection-or-exhibit-reproduction',
  },
  {
    id: 'fort-saint-jean',
    nameFr: 'Fort Saint-Jean',
    lat: 43.2953,
    lon: 5.362,
    kind: 'historic-fort',
    representationPolicy: 'architectural-exterior-only',
  },
  {
    id: 'cathedrale-la-major',
    nameFr: 'Cathédrale de la Major',
    lat: 43.2996,
    lon: 5.3646,
    kind: 'cathedral',
    representationPolicy: 'architectural-exterior-only',
  },
  {
    id: 'chateau-dif',
    nameFr: "Château d'If",
    lat: 43.2795,
    lon: 5.3252,
    kind: 'island-fort',
    representationPolicy: 'architectural-exterior-and-location-only-no-character-likeness-reproduction',
  },
  {
    id: 'vallon-des-auffes',
    nameFr: 'Vallon des Auffes',
    lat: 43.2803,
    lon: 5.3495,
    kind: 'fishing-harbour',
  },
  {
    id: 'plage-des-catalans',
    nameFr: 'Plage des Catalans',
    lat: 43.2896,
    lon: 5.3532,
    kind: 'beach',
  },
  {
    id: 'palais-longchamp',
    nameFr: 'Palais Longchamp',
    lat: 43.3044,
    lon: 5.3946,
    kind: 'historic-palace-and-fountain',
    representationPolicy: 'architectural-exterior-and-fountain-only',
  },
  {
    id: 'cours-julien',
    nameFr: 'Cours Julien',
    lat: 43.2937,
    lon: 5.383,
    kind: 'street-art-district',
    representationPolicy: 'district-atmosphere-only-no-specific-artwork-or-graffiti-reproduction',
  },
  {
    id: 'stade-velodrome',
    nameFr: 'Stade Vélodrome',
    lat: 43.2697,
    lon: 5.3959,
    kind: 'stadium-exterior',
    representationPolicy: 'architectural-exterior-only-no-match-club-brand-or-team-reproduction',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'saint-charles',
    nameFr: 'Saint-Charles',
    lat: 43.3027,
    lon: 5.3806,
    line: 'M1·M2',
    routeId: 'metro-m1',
    routeIds: Object.freeze(['marseille-mainline', 'metro-m1', 'metro-m2']),
  },
  {
    id: 'vieux-port-metro',
    nameFr: 'Vieux-Port',
    lat: 43.2955,
    lon: 5.3743,
    line: 'M1',
    routeId: 'metro-m1',
    routeIds: Object.freeze(['metro-m1']),
  },
  {
    id: 'castellane',
    nameFr: 'Castellane',
    lat: 43.2865,
    lon: 5.3833,
    line: 'M1·M2',
    routeId: 'metro-m1',
    routeIds: Object.freeze(['metro-m1', 'metro-m2']),
  },
  {
    id: 'joliette',
    nameFr: 'Joliette',
    lat: 43.3054,
    lon: 5.3663,
    line: 'M2',
    routeId: 'metro-m2',
    routeIds: Object.freeze(['metro-m2']),
  },
]);

const FERRY_STOPS = Object.freeze([
  {
    id: 'vieux-port-quay',
    nameFr: 'Quai du Vieux-Port',
    lat: 43.2948,
    lon: 5.3752,
    kind: 'ferry-terminal',
    routeIds: Object.freeze(['vieux-port-chateau-dif']),
  },
  {
    id: 'chateau-dif-landing',
    nameFr: "Embarcadère du Château d'If",
    lat: 43.2799,
    lon: 5.326,
    kind: 'island-ferry-landing',
    routeIds: Object.freeze(['vieux-port-chateau-dif']),
  },
  {
    id: 'ferry-boat-south',
    nameFr: 'Ferry-boat – rive sud',
    lat: 43.2932,
    lon: 5.374,
    kind: 'ferry-landing',
    routeIds: Object.freeze(['vieux-port-ferry-boat']),
  },
  {
    id: 'ferry-boat-north',
    nameFr: 'Ferry-boat – rive nord',
    lat: 43.2963,
    lon: 5.3735,
    kind: 'ferry-landing',
    routeIds: Object.freeze(['vieux-port-ferry-boat']),
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
    if (!snapped) throw new Error(`Unable to separate Marseille marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
  }
}

function ensureWaterfrontAccess(grid, entry, meta, maxDistance = 32) {
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
  if (target < 0) throw new Error(`Unable to connect Marseille waterfront marker ${entry.id}`);
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

function normalizeWalkableComponents(grid, protectedTiles, primaryTiles, meta) {
  const protectedIndexes = new Set(protectedTiles.map(([x, y]) => y * meta.grid.w + x));
  let primarySeen = combinedPrimarySeen(grid, primaryTiles, meta);
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
        throw new Error('Unable to connect protected Marseille marker without crossing water');
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
    if (left === undefined || right === undefined) throw new Error('Marseille ferry stop is missing');
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
  const adjacency = ferryAdjacency(ferryStops, w);
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
      throw new Error(
        `Disconnected Marseille walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`,
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
      throw new Error(`Marseille missing nameFr for ${entry.id}`);
    }
  }
}

export function buildMarseilleCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Marseille snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'marseille',
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
      method: 'cardinal-land-plus-two-marseille-ferries-v1',
      ferryLinks: FERRY_LINKS,
    }),
    contentPolicy: Object.freeze({
      focus: 'tourism-architecture-harbour-mediterranean',
      brandSignage: 'generalized-no-reproduction',
      personLikeness: 'excluded',
      specificArtworkAndGraffitiReproduction: 'excluded',
      collectionAndExhibitReproduction: 'excluded',
      sportsTeamAndMatchReproduction: 'excluded',
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Marseille OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeFrenchBridgeTerrain(sourceTerrain, baseMeta);
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  const ferryStops = FERRY_STOPS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations, ...ferryStops]);
  separateMarkerTiles([...pois, ...stations, ...ferryStops], baseMeta);

  for (const entry of ferryStops) ensureWaterfrontAccess(bridges.terrain, entry, baseMeta);
  for (const id of [
    'vieux-port',
    'mucem',
    'fort-saint-jean',
    'chateau-dif',
    'vallon-des-auffes',
    'plage-des-catalans',
  ]) {
    ensureWaterfrontAccess(
      bridges.terrain,
      pois.find((entry) => entry.id === id),
      baseMeta,
      id === 'chateau-dif' ? 20 : 32,
    );
  }

  const protectedEntries = [...pois, ...stations, ...ferryStops];
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  const mainStation = stations.find((entry) => entry.id === 'saint-charles');
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
  return `// Generated by scripts/build-marseille-city-geo.mjs. Do not edit by hand.
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

export const MARSEILLE_GEO = Object.freeze({
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

export function writeMarseilleCityGeo() {
  const geo = buildMarseilleCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/marseille.geo.js',
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
  console.log(JSON.stringify(writeMarseilleCityGeo()));
}
