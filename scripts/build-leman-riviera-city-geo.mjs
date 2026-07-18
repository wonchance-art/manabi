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
const BBOX = Object.freeze([6.60, 46.40, 6.95, 46.54]);
const SNAPSHOT_URL = new URL('./data/leman-riviera-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = 'cf9ab247c4d36ec699e2d5cf6885675b3c8cfc74d95c98405a7943e93b35f36f';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const TRAIN_ROUTE_ID = 'cff-simplon';
const FERRY_ROUTE_ID = 'cgn-belle-epoque-10';
const FERRY_LINKS = Object.freeze([
  Object.freeze({
    id: FERRY_ROUTE_ID,
    mode: 'ferry',
    serviceNumber: 10,
    stopIds: Object.freeze([
      'ouchy-landing',
      'cully-landing',
      'vevey-landing',
      'montreux-landing',
      'chillon-landing',
    ]),
  }),
]);

const POIS = Object.freeze([
  {
    id: 'lausanne-cathedral',
    nameFr: 'Cathédrale de Lausanne',
    lat: 46.5225,
    lon: 6.6356,
    kind: 'cathedral',
    shoreComponent: 'west',
    representationPolicy: 'architectural-exterior-only',
  },
  {
    id: 'lausanne-gare',
    nameFr: 'Gare de Lausanne',
    lat: 46.5167,
    lon: 6.6291,
    kind: 'railway-station-exterior',
    shoreComponent: 'west',
    tileOverride: Object.freeze([112, 130]),
  },
  {
    id: 'flon',
    nameFr: 'Le Flon',
    lat: 46.5216,
    lon: 6.6293,
    kind: 'public-urban-district',
    shoreComponent: 'west',
  },
  {
    id: 'ouchy',
    nameFr: 'Ouchy',
    lat: 46.5065,
    lon: 6.6267,
    kind: 'public-lakeside-district',
    shoreComponent: 'west',
  },
  {
    id: 'lutry-vieux-bourg',
    nameFr: 'Lutry',
    lat: 46.5027,
    lon: 6.6844,
    kind: 'historic-district',
    shoreComponent: 'east',
  },
  {
    id: 'cully',
    nameFr: 'Cully',
    lat: 46.489,
    lon: 6.73,
    kind: 'public-lakeside-landing',
    shoreComponent: 'east',
  },
  {
    id: 'dezaley-lavaux',
    nameFr: 'Dézaley (Lavaux)',
    lat: 46.483,
    lon: 6.75,
    kind: 'terraced-vineyard-landscape',
    shoreComponent: 'east',
    heritageContext: 'world-heritage-landscape-geography-only',
  },
  {
    id: 'st-saphorin',
    nameFr: 'Saint-Saphorin',
    lat: 46.4712,
    lon: 6.7965,
    kind: 'historic-village',
    shoreComponent: 'east',
  },
  {
    id: 'vevey-grande-place',
    nameFr: 'Grande Place, Vevey',
    lat: 46.4603,
    lon: 6.8419,
    kind: 'public-square',
    shoreComponent: 'east',
  },
  {
    id: 'montreux-quai',
    nameFr: 'Quais de Montreux',
    lat: 46.4335,
    lon: 6.9106,
    kind: 'public-lakeside-promenade',
    shoreComponent: 'east',
    representationPolicy: 'generic-lakeside-promenade-no-event-or-festival-reproduction',
  },
  {
    id: 'chillon',
    nameFr: 'Château de Chillon',
    lat: 46.4142,
    lon: 6.9275,
    kind: 'historic-castle',
    shoreComponent: 'east',
    representationPolicy: 'architectural-exterior-and-geography-only',
  },
  {
    id: 'vevey-marche',
    nameFr: 'Place du Marché, Vevey',
    lat: 46.462,
    lon: 6.843,
    kind: 'public-market-square',
    shoreComponent: 'east',
    representationPolicy: 'generic-public-market-square-no-brand-or-company-reproduction',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'lausanne',
    poiId: 'lausanne-gare',
    nameFr: 'Lausanne',
    specTile: Object.freeze([112, 130]),
    shoreComponent: 'west',
  },
  {
    id: 'lutry',
    nameFr: 'Lutry',
    specTile: Object.freeze([332, 172]),
    shoreComponent: 'east',
  },
  {
    id: 'cully',
    nameFr: 'Cully',
    specTile: Object.freeze([485, 275]),
    shoreComponent: 'east',
  },
  {
    id: 'rivaz',
    nameFr: 'Rivaz',
    specTile: Object.freeze([665, 343]),
    shoreComponent: 'east',
  },
  {
    id: 'vevey',
    nameFr: 'Vevey',
    specTile: Object.freeze([934, 430]),
    shoreComponent: 'east',
  },
  {
    id: 'montreux',
    nameFr: 'Montreux',
    specTile: Object.freeze([1191, 578]),
    shoreComponent: 'east',
  },
  {
    id: 'veytaux-chillon',
    nameFr: 'Veytaux-Chillon',
    specTile: Object.freeze([1254, 690]),
    shoreComponent: 'east',
  },
]);

const FERRY_STOPS = Object.freeze([
  { id: 'ouchy-landing', poiId: 'ouchy', nameFr: 'Débarcadère d’Ouchy' },
  { id: 'cully-landing', poiId: 'cully', nameFr: 'Débarcadère de Cully' },
  {
    id: 'vevey-landing',
    poiId: 'vevey-grande-place',
    nameFr: 'Débarcadère de Vevey',
  },
  {
    id: 'montreux-landing',
    poiId: 'montreux-quai',
    nameFr: 'Débarcadère de Montreux',
  },
  {
    id: 'chillon-landing',
    poiId: 'chillon',
    nameFr: 'Débarcadère de Chillon',
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

function projectLatLonToPoint(lat, lon, meta, metrics) {
  const point = webMercatorMeters(lon, lat);
  return [
    ((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile,
    ((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile,
  ];
}

function projectLatLonToTile(lat, lon, meta, metrics) {
  const point = projectLatLonToPoint(lat, lon, meta, metrics);
  return [
    Math.max(0, Math.min(meta.grid.w - 1, Math.floor(point[0]))),
    Math.max(0, Math.min(meta.grid.h - 1, Math.floor(point[1]))),
  ];
}

function unprojectTileCenter(tile, meta, metrics) {
  const x = metrics.southWest.x
    + ((tile[0] + 0.5) * meta.metersPerTile) / metrics.correction;
  const y = metrics.northEast.y
    - ((tile[1] + 0.5) * meta.metersPerTile) / metrics.correction;
  return {
    lon: Number(((x / EARTH_RADIUS) / DEG).toFixed(7)),
    lat: Number(((2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) / DEG).toFixed(7)),
  };
}

function componentLabels(grid, meta) {
  const labels = new Int32Array(grid.length);
  labels.fill(-1);
  const sizes = [];
  const bounds = [];
  const queue = new Int32Array(grid.length);
  let component = 0;
  for (let start = 0; start < grid.length; start += 1) {
    if (labels[start] >= 0 || isCityBlocked(grid[start])) continue;
    let head = 0;
    let tail = 0;
    let minX = meta.grid.w;
    let minY = meta.grid.h;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    labels[start] = component;
    while (head < tail) {
      const index = queue[head++];
      const x = index % meta.grid.w;
      const y = Math.floor(index / meta.grid.w);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
        const next = ny * meta.grid.w + nx;
        if (labels[next] >= 0 || isCityBlocked(grid[next])) continue;
        labels[next] = component;
        queue[tail++] = next;
      }
    }
    sizes.push(tail);
    bounds.push({ minX, minY, maxX, maxY });
    component += 1;
  }
  return { labels, sizes, bounds };
}

function nearestTile(origin, meta, predicate, maxRadius = 64) {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = origin[0] + dx;
        const y = origin[1] + dy;
        if (x < 0 || y < 0 || x >= meta.grid.w || y >= meta.grid.h) continue;
        const index = y * meta.grid.w + x;
        if (!predicate(index, x, y)) continue;
        candidates.push({
          tile: [x, y],
          distance: Math.hypot(dx, dy),
        });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((left, right) => (
        left.distance - right.distance
        || left.tile[1] - right.tile[1]
        || left.tile[0] - right.tile[0]
      ));
      return candidates[0];
    }
  }
  return null;
}

function markerComponentIds(terrain, meta, metrics) {
  const report = componentLabels(terrain, meta);
  const westProbe = projectLatLonToTile(46.5216, 6.6293, meta, metrics);
  const eastProbe = nearestTile(
    projectLatLonToTile(46.489, 6.73, meta, metrics),
    meta,
    (index) => report.labels[index] >= 0,
    8,
  );
  const west = report.labels[westProbe[1] * meta.grid.w + westProbe[0]];
  const east = eastProbe
    ? report.labels[eastProbe.tile[1] * meta.grid.w + eastProbe.tile[0]]
    : -1;
  if (west < 0 || east < 0 || west === east) {
    throw new Error('Leman-Riviera west/east shore component probes are invalid');
  }
  return { report, west, east };
}

function withPoiTile(entry, meta, metrics, componentIds) {
  const { shoreComponent, tileOverride, ...publicEntry } = entry;
  const projectedPoint = projectLatLonToPoint(entry.lat, entry.lon, meta, metrics);
  const projectedTile = projectLatLonToTile(entry.lat, entry.lon, meta, metrics);
  let tile = tileOverride ? [...tileOverride] : projectedTile;
  const targetComponent = componentIds[shoreComponent];
  if (!tileOverride) {
    const nearest = nearestTile(
      projectedTile,
      meta,
      (index) => componentIds.report.labels[index] === targetComponent,
      32,
    );
    if (!nearest) throw new Error(`Unable to align Leman-Riviera POI ${entry.id}`);
    tile = nearest.tile;
  }
  return {
    ...publicEntry,
    contentLocale: meta.contentLocale,
    lat: Number(entry.lat.toFixed(7)),
    lon: Number(entry.lon.toFixed(7)),
    tile,
    sourceProjectedTile: projectedTile,
    alignmentDeltaTiles: Number(
      Math.hypot(tile[0] - projectedPoint[0], tile[1] - projectedPoint[1]).toFixed(3),
    ),
  };
}

function withStationTile(entry, pois, railwayMask, meta, metrics, componentIds) {
  const { shoreComponent, ...publicEntry } = entry;
  const linkedPoi = entry.poiId
    ? pois.find((candidate) => candidate.id === entry.poiId)
    : null;
  const aligned = linkedPoi
    ? { tile: [...linkedPoi.tile], distance: 0 }
    : nearestTile(
      entry.specTile,
      meta,
      (index) => railwayMask[index] !== 0,
      24,
    );
  if (!aligned) throw new Error(`Unable to align Leman-Riviera station ${entry.id}`);
  const position = linkedPoi
    ? { lat: linkedPoi.lat, lon: linkedPoi.lon }
    : unprojectTileCenter(entry.specTile, meta, metrics);
  return {
    ...publicEntry,
    contentLocale: meta.contentLocale,
    lat: position.lat,
    lon: position.lon,
    tile: aligned.tile,
    specTile: [...entry.specTile],
    railAlignmentDeltaTiles: Number(aligned.distance.toFixed(3)),
    line: 'CFF Simplon',
    routeId: TRAIN_ROUTE_ID,
    routeIds: [TRAIN_ROUTE_ID],
    componentTarget: shoreComponent === 'west' ? componentIds.west : componentIds.east,
  };
}

function withFerryTile(entry, pois, meta) {
  const linkedPoi = pois.find((candidate) => candidate.id === entry.poiId);
  if (!linkedPoi) throw new Error(`Leman-Riviera ferry POI is missing: ${entry.poiId}`);
  return {
    ...entry,
    contentLocale: meta.contentLocale,
    lat: linkedPoi.lat,
    lon: linkedPoi.lon,
    tile: [...linkedPoi.tile],
    kind: 'ferry-landing',
    routeId: FERRY_ROUTE_ID,
    routeIds: [FERRY_ROUTE_ID],
  };
}

function validateMarkerSeparation(entries, pois, minDistance = 3) {
  const poiById = new Map(pois.map((entry) => [entry.id, entry]));
  const claimed = [];
  for (const entry of entries) {
    if (entry.poiId && poiById.has(entry.poiId)) {
      const linked = poiById.get(entry.poiId);
      if (linked.tile.join(',') !== entry.tile.join(',')) {
        throw new Error(`Leman-Riviera linked marker mismatch: ${entry.id}`);
      }
      continue;
    }
    for (const other of claimed) {
      const distance = Math.max(
        Math.abs(entry.tile[0] - other.tile[0]),
        Math.abs(entry.tile[1] - other.tile[1]),
      );
      if (distance < minDistance) {
        throw new Error(`Leman-Riviera markers overlap: ${other.id},${entry.id}`);
      }
    }
    claimed.push(entry);
  }
}

function connectMarkerToComponent(grid, entry, targetComponent, initialLabels, meta, maxDistance = 32) {
  const start = entry.tile[1] * meta.grid.w + entry.tile[0];
  if (initialLabels[start] === targetComponent && !isCityBlocked(grid[start])) return;
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
    const x = index % meta.grid.w;
    const y = Math.floor(index / meta.grid.w);
    const distance = Math.abs(x - entry.tile[0]) + Math.abs(y - entry.tile[1]);
    if (initialLabels[index] === targetComponent) {
      target = index;
      break;
    }
    if (distance >= maxDistance) continue;
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
      const next = ny * meta.grid.w + nx;
      if (previous[next] !== -2) continue;
      const code = grid[next];
      if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER
        || code === CITY_TILE.MOUNTAIN || code === CITY_TILE.BRIDGE) continue;
      previous[next] = index;
      queue[tail++] = next;
    }
  }
  if (target < 0) {
    throw new Error(`Unable to connect Leman-Riviera marker ${entry.id} to its shore`);
  }
  for (let index = target; index >= 0; index = previous[index]) {
    if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.SIDEWALK;
  }
}

function ferryAdjacency(ferryStops, width) {
  const stopIndexes = new Map(ferryStops.map(({ id, tile }) => (
    [id, tile[1] * width + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of FERRY_LINKS) {
    for (let offset = 1; offset < stopIds.length; offset += 1) {
      const left = stopIndexes.get(stopIds[offset - 1]);
      const right = stopIndexes.get(stopIds[offset]);
      if (left === undefined || right === undefined) {
        throw new Error('Leman-Riviera ferry stop is missing');
      }
      if (!adjacency.has(left)) adjacency.set(left, []);
      if (!adjacency.has(right)) adjacency.set(right, []);
      adjacency.get(left).push(right);
      adjacency.get(right).push(left);
    }
  }
  return adjacency;
}

function reachable(grid, startTile, meta, adjacency = new Map()) {
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * meta.grid.w + startTile[0];
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
  return seen;
}

function connectivityReport(grid, entranceTile, protectedEntries, ferryStops, meta) {
  const landSeen = reachable(grid, entranceTile, meta);
  const ferrySeen = reachable(
    grid,
    entranceTile,
    meta,
    ferryAdjacency(ferryStops, meta.grid.w),
  );
  for (const entry of protectedEntries) {
    const index = entry.tile[1] * meta.grid.w + entry.tile[0];
    if (!ferrySeen[index]) {
      throw new Error(`Ferry-aware BFS cannot reach Leman-Riviera marker ${entry.id}`);
    }
  }
  const components = componentLabels(grid, meta);
  const protectedIndexes = new Set(protectedEntries.map(({ tile }) => (
    tile[1] * meta.grid.w + tile[0]
  )));
  const protectedComponents = new Set(
    [...protectedIndexes]
      .map((index) => components.labels[index])
      .filter((component) => component >= 0),
  );
  const southComponents = components.sizes
    .map((size, component) => ({
      component,
      size,
      bounds: components.bounds[component],
    }))
    .filter(({ component, bounds }) => (
      !protectedComponents.has(component) && bounds.maxY === meta.grid.h - 1
    ))
    .sort((left, right) => right.size - left.size || left.component - right.component);
  const countSeen = (seen) => seen.reduce((sum, value) => sum + value, 0);
  return {
    method: 'cardinal-land-plus-cgn-adjacent-stop-ferry-v1',
    landOnlyReachableTiles: countSeen(landSeen),
    ferryAwareReachableTiles: countSeen(ferrySeen),
    protectedLandComponentSizes: [...protectedComponents]
      .map((component) => components.sizes[component])
      .sort((left, right) => right - left),
    southShorePolicy: 'report-only-no-forced-connection',
    southShoreComponentCount: southComponents.length,
    southShoreTileCount: southComponents.reduce((sum, item) => sum + item.size, 0),
    largestSouthShoreComponentSize: southComponents[0]?.size ?? 0,
    cardinalComponentCount: components.sizes.length,
  };
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

function countCode(terrain, code) {
  return terrain.reduce((sum, value) => sum + Number(value === code), 0);
}

function validateLocaleCoverage(entries) {
  for (const entry of entries) {
    if (typeof entry.nameFr !== 'string' || entry.nameFr.length === 0) {
      throw new Error(`Leman-Riviera missing nameFr for ${entry.id}`);
    }
  }
}

export function buildLemanRivieraCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Leman-Riviera snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = {
    city: 'leman-riviera',
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
    contentPolicy: Object.freeze({
      focus: 'public-lakeside-geography-architecture-and-transit',
      brandAndCompanyReproduction: 'excluded',
      eventAndFestivalReproduction: 'excluded',
      personLikeness: 'excluded',
      specificArtworkReproduction: 'excluded',
      culturalDoorsAndNarrative: 'claude-owned-excluded-from-geo',
    }),
  };
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Leman-Riviera OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const sourceWaterMask = decodeTerrainRle(snapshot.waterRle, sourceTerrain.length);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeFrenchBridgeTerrain(sourceTerrain, baseMeta);
  const railwayMask = decodeTerrainRle(snapshot.railwayRle, bridges.terrain.length);
  const componentIds = markerComponentIds(bridges.terrain, baseMeta, metrics);
  const pois = POIS.map((entry) => withPoiTile(entry, baseMeta, metrics, componentIds));
  const stations = STATIONS.map((entry) => (
    withStationTile(entry, pois, railwayMask, baseMeta, metrics, componentIds)
  ));
  const ferryStops = FERRY_STOPS.map((entry) => withFerryTile(entry, pois, baseMeta));
  validateLocaleCoverage([...pois, ...stations, ...ferryStops]);
  validateMarkerSeparation([...pois, ...stations, ...ferryStops], pois);

  const targetByEntry = new Map([
    ...pois.map((entry, index) => [
      entry,
      POIS[index].shoreComponent === 'west' ? componentIds.west : componentIds.east,
    ]),
    ...stations.map((entry) => [entry, entry.componentTarget]),
    ...ferryStops.map((entry) => [
      entry,
      POIS.find((poi) => poi.id === entry.poiId).shoreComponent === 'west'
        ? componentIds.west
        : componentIds.east,
    ]),
  ]);
  for (const [entry, component] of targetByEntry) {
    connectMarkerToComponent(
      bridges.terrain,
      entry,
      component,
      componentIds.report.labels,
      baseMeta,
    );
  }
  for (const station of stations) delete station.componentTarget;

  const mainStation = stations[0];
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    const index = y * baseMeta.grid.w + entrance.x;
    if (bridges.terrain[index] !== CITY_TILE.WATER
      && bridges.terrain[index] !== CITY_TILE.RIVER
      && bridges.terrain[index] !== CITY_TILE.MOUNTAIN) {
      bridges.terrain[index] = CITY_TILE.ROAD;
    }
  }

  const protectedEntries = [...pois, ...stations, ...ferryStops];
  const connectivity = connectivityReport(
    bridges.terrain,
    mainStation.tile,
    protectedEntries,
    ferryStops,
    baseMeta,
  );
  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
    transitSystems: Object.freeze([
      Object.freeze({
        id: TRAIN_ROUTE_ID,
        mode: 'train',
        nameFr: 'Ligne du Simplon',
        stopIds: Object.freeze(stations.map(({ id }) => id)),
      }),
      Object.freeze({
        id: FERRY_ROUTE_ID,
        mode: 'ferry',
        serviceNumber: 10,
        nameFr: 'CGN Belle Époque',
        stopIds: FERRY_LINKS[0].stopIds,
      }),
    ]),
    connectivity: Object.freeze({
      ...connectivity,
      ferryLinks: FERRY_LINKS,
    }),
    hydrology: Object.freeze({
      lake: 'Lac Léman',
      sourceWaterTileCount: sourceWaterMask.reduce((sum, value) => sum + Number(Boolean(value)), 0),
      finalWaterTileCount: countCode(bridges.terrain, CITY_TILE.WATER),
      profileGate: 'report-only-round-1',
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
  return `// Generated by scripts/build-leman-riviera-city-geo.mjs. Do not edit by hand.
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

export const LEMAN_RIVIERA_GEO = Object.freeze({
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

export function writeLemanRivieraCityGeo() {
  const geo = buildLemanRivieraCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/leman-riviera.geo.js',
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
  console.log(JSON.stringify(writeLemanRivieraCityGeo()));
}
