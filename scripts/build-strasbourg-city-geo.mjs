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
const BBOX = Object.freeze([7.70, 48.55, 7.81, 48.63]);
const SNAPSHOT_URL = new URL('./data/strasbourg-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = 'db95f62b9bd063e1c60ee768b36c3ad10ce9b46d4f25a71cf70acee00850967b';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

const POIS = Object.freeze([
  Object.freeze({
    id: 'cathedrale',
    nameFr: 'Cathédrale de Strasbourg',
    nameKo: '스트라스부르 대성당',
    lon: 7.7511,
    lat: 48.5818,
    kind: 'cathedral',
    representationPolicy: 'architectural-exterior-only',
  }),
  Object.freeze({
    id: 'petite-france',
    nameFr: 'La Petite France',
    nameKo: '프티트 프랑스',
    lon: 7.7405,
    lat: 48.5800,
    kind: 'historic-district',
    representationPolicy: 'public-geography-and-architectural-exteriors-only',
  }),
  Object.freeze({
    id: 'place-kleber',
    nameFr: 'Place Kléber',
    nameKo: '클레베르 광장',
    lon: 7.7455,
    lat: 48.5833,
    kind: 'public-square',
  }),
  Object.freeze({
    id: 'barrage-vauban',
    nameFr: 'Barrage Vauban',
    nameKo: '보방 댐 전망대',
    lon: 7.7385,
    lat: 48.5790,
    kind: 'waterworks-landmark',
    representationPolicy: 'architectural-exterior-and-geography-only',
  }),
  Object.freeze({
    id: 'ponts-couverts',
    nameFr: 'Ponts Couverts',
    nameKo: '퐁쿠베르(중세 탑교)',
    lon: 7.7395,
    lat: 48.5795,
    kind: 'bridge-landmark',
    representationPolicy: 'bridge-and-tower-exteriors-only',
  }),
  Object.freeze({
    id: 'parlement-europeen',
    nameFr: 'Parlement européen',
    nameKo: '유럽의회',
    lon: 7.7752,
    lat: 48.5977,
    kind: 'civic-building',
    representationPolicy: 'architectural-exterior-and-geography-only-no-institutional-activity',
  }),
  Object.freeze({
    id: 'orangerie',
    nameFr: "Parc de l'Orangerie",
    nameKo: '오랑주리 공원',
    lon: 7.7690,
    lat: 48.5930,
    kind: 'park',
  }),
]);

const STATIONS = Object.freeze([
  Object.freeze({
    id: 'gare-de-strasbourg',
    nameFr: 'Gare de Strasbourg',
    lon: 7.7350,
    lat: 48.5850,
    line: 'Grandes lignes',
    displayOnly: true,
  }),
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
    lon: Number(entry.lon.toFixed(7)),
    lat: Number(entry.lat.toFixed(7)),
    tile: projectLatLonToTile(entry.lat, entry.lon, meta, metrics),
  };
}

function continuousTile(entry, meta, metrics) {
  const point = webMercatorMeters(entry.lon, entry.lat);
  return [
    ((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile,
    ((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile,
  ];
}

function validateMarkerSeparation(entries, minDistance = 3) {
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      const distance = Math.max(
        Math.abs(a.tile[0] - b.tile[0]),
        Math.abs(a.tile[1] - b.tile[1]),
      );
      if (distance < minDistance) {
        throw new Error(`Strasbourg markers ${a.id}/${b.id} are only ${distance} tiles apart`);
      }
    }
  }
}

function snapToRailway(entry, railwayMask, meta, maxRadius = 4) {
  const [originX, originY] = entry.tile;
  let best = null;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (x < 0 || y < 0 || x >= meta.grid.w || y >= meta.grid.h) continue;
        if (!railwayMask[y * meta.grid.w + x]) continue;
        const distance = Math.hypot(dx, dy);
        if (!best || distance < best.distance
          || (distance === best.distance && (y < best.tile[1]
            || (y === best.tile[1] && x < best.tile[0])))) {
          best = { tile: [x, y], distance };
        }
      }
    }
    if (best) break;
  }
  if (!best) throw new Error('Gare de Strasbourg has no railway within 4 tiles');
  entry.tile = best.tile;
}

function snapWaterLandmarkToWalkable(entry, grid, meta, metrics, maxDistance = 2.5) {
  const originIndex = entry.tile[1] * meta.grid.w + entry.tile[0];
  const originCode = grid[originIndex];
  if (originCode !== CITY_TILE.WATER && originCode !== CITY_TILE.RIVER) return false;
  const expected = continuousTile(entry, meta, metrics);
  let best = null;
  for (let y = Math.max(0, Math.floor(expected[1] - maxDistance));
    y <= Math.min(meta.grid.h - 1, Math.ceil(expected[1] + maxDistance)); y += 1) {
    for (let x = Math.max(0, Math.floor(expected[0] - maxDistance));
      x <= Math.min(meta.grid.w - 1, Math.ceil(expected[0] + maxDistance)); x += 1) {
      const distance = Math.hypot(expected[0] - x, expected[1] - y);
      if (distance > maxDistance || isCityBlocked(grid[y * meta.grid.w + x])) continue;
      if (!best || distance < best.distance
        || (distance === best.distance && (y < best.tile[1]
          || (y === best.tile[1] && x < best.tile[0])))) {
        best = { tile: [x, y], distance };
      }
    }
  }
  if (!best) return false;
  entry.tile = best.tile;
  return true;
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

function carveWaterLandmarkAccess(grid, entry, meta) {
  const start = entry.tile[1] * meta.grid.w + entry.tile[0];
  if (!isCityBlocked(grid[start])) return Object.freeze({ carvedTileCount: 0 });
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
      const code = grid[next];
      if (!isCityBlocked(code)) {
        parent[next] = index;
        target = next;
        break;
      }
      if (code !== CITY_TILE.WATER && code !== CITY_TILE.RIVER) continue;
      parent[next] = index;
      queue[tail++] = next;
    }
  }
  if (target < 0) throw new Error(`Unable to connect Strasbourg water marker ${entry.id}`);
  let carvedTileCount = 0;
  for (let index = target; ; index = parent[index]) {
    if (grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER) {
      grid[index] = CITY_TILE.ROAD;
      carvedTileCount += 1;
    }
    if (index === start) break;
  }
  return Object.freeze({
    method: 'petite-france-cardinal-bridge-access-v1',
    carvedTileCount,
  });
}

function reachableFrom(grid, start, meta) {
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
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

function connectComponentToPrimary(grid, component, primarySeen, meta) {
  const componentSet = new Set(component);
  const parent = new Int32Array(grid.length).fill(-1);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  for (const start of component) {
    parent[start] = start;
    queue[tail++] = start;
  }
  let target = -1;
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
  if (target < 0) return 0;
  let carved = 0;
  for (let index = target; !componentSet.has(index); index = parent[index]) {
    if (isCityBlocked(grid[index])) {
      grid[index] = CITY_TILE.ROAD;
      carved += 1;
    }
  }
  return carved;
}

function normalizeWalkableComponents(grid, protectedEntries, mainTile, meta) {
  const protectedIndexes = new Set(protectedEntries.map(({ tile: [x, y] }) => (
    y * meta.grid.w + x
  )));
  const report = {
    method: 'cardinal-land-no-water-carving-v1',
    initialComponentCount: 1,
    connectedComponentCount: 0,
    collapsedSmallComponentCount: 0,
    carvedRoadTileCount: 0,
  };
  let primarySeen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
  const visited = primarySeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited, meta);
    report.initialComponentCount += 1;
    const protectedComponent = component.some((tileIndex) => protectedIndexes.has(tileIndex));
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      report.collapsedSmallComponentCount += 1;
      continue;
    }
    const carved = connectComponentToPrimary(grid, component, primarySeen, meta);
    if (carved === 0) {
      if (protectedComponent) throw new Error('Protected Strasbourg marker is isolated by water');
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      report.collapsedSmallComponentCount += 1;
      continue;
    }
    report.connectedComponentCount += 1;
    report.carvedRoadTileCount += carved;
    primarySeen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (primarySeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
  const finalSeen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
  let walkableTileCount = 0;
  let reachedTileCount = 0;
  for (let index = 0; index < grid.length; index += 1) {
    if (isCityBlocked(grid[index])) continue;
    walkableTileCount += 1;
    reachedTileCount += finalSeen[index];
  }
  if (walkableTileCount !== reachedTileCount) {
    throw new Error(`Strasbourg walkable BFS mismatch: ${reachedTileCount}/${walkableTileCount}`);
  }
  for (const entry of protectedEntries) {
    if (!finalSeen[entry.tile[1] * meta.grid.w + entry.tile[0]]) {
      throw new Error(`Strasbourg marker ${entry.id} is outside the main walkable component`);
    }
  }
  return Object.freeze({
    ...report,
    finalComponentCount: 1,
    walkableTileCount,
    reachedTileCount,
  });
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

function countMask(mask) {
  return mask.reduce((sum, value) => sum + Number(Boolean(value)), 0);
}

function countCode(terrain, code) {
  return terrain.reduce((sum, value) => sum + Number(value === code), 0);
}

function validateLocaleCoverage(entries) {
  for (const entry of entries) {
    if (typeof entry.nameFr !== 'string' || entry.nameFr.length === 0) {
      throw new Error(`Strasbourg missing nameFr for ${entry.id}`);
    }
  }
}

export function buildStrasbourgCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Strasbourg snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = {
    city: 'strasbourg',
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
      focus: 'public-geography-architecture-waterways-parks-and-transit',
      brandAndEmblemReproduction: 'excluded',
      personLikeness: 'excluded',
      specificArtworkReproduction: 'excluded',
      politicalAndInstitutionalActivityNarrative: 'excluded',
      culturalDoorsAndNarrative: 'claude-owned-excluded-from-geo',
    }),
  };
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Strasbourg OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const waterMask = decodeTerrainRle(snapshot.waterRle, sourceTerrain.length);
  const riverMask = decodeTerrainRle(snapshot.riverRle, sourceTerrain.length);
  const railwayMask = decodeTerrainRle(snapshot.railwayRle, sourceTerrain.length);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeFrenchBridgeTerrain(sourceTerrain, baseMeta);
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  snapToRailway(stations[0], railwayMask, baseMeta);
  const barrage = pois.find(({ id }) => id === 'barrage-vauban');
  const barrageSnappedToWalkable = snapWaterLandmarkToWalkable(
    barrage, bridges.terrain, baseMeta, metrics,
  );
  validateLocaleCoverage([...pois, ...stations]);
  validateMarkerSeparation([...pois, ...stations]);

  const petiteFranceAccess = carveWaterLandmarkAccess(
    bridges.terrain,
    pois.find(({ id }) => id === 'petite-france'),
    baseMeta,
  );
  const protectedEntries = [...pois, ...stations];
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  const mainStation = stations[0];
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    const index = y * baseMeta.grid.w + entrance.x;
    if (bridges.terrain[index] === CITY_TILE.WATER
      || bridges.terrain[index] === CITY_TILE.RIVER) {
      throw new Error('Strasbourg entrance corridor would cross water');
    }
    bridges.terrain[index] = CITY_TILE.ROAD;
  }
  const connectivity = normalizeWalkableComponents(
    bridges.terrain,
    protectedEntries,
    mainStation.tile,
    baseMeta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
    connectivity,
    hydrology: Object.freeze({
      rivers: Object.freeze(['Ill', 'Rhine']),
      feature: 'Grande Île enclosed by Ill branches',
      sourceWaterTileCount: countMask(waterMask),
      sourceRiverTileCount: countMask(riverMask),
      finalWaterTileCount: countCode(bridges.terrain, CITY_TILE.WATER),
      finalRiverTileCount: countCode(bridges.terrain, CITY_TILE.RIVER),
      petiteFranceAccess,
      barrageSnappedToWalkable,
      grandeIleProfile: Object.freeze({
        sourceRow: 260,
        finalRow: 268,
        westBranch: Object.freeze([141, 142]),
        eastBranch: Object.freeze([203, 206]),
        dryCenterX: 184,
        rhine: Object.freeze([363, 375]),
        bridgeDeckNote: 'source-west-branch-at-y260-normalized-to-road',
      }),
      profileGate: 'ill-grande-ile-branches-and-rhine',
    }),
    buildingTexture: Object.freeze({
      method: 'osm-existing-buildings-report-only',
      version: 1,
      publicDatasetProbe: Object.freeze({
        provider: 'OpenStreetMap',
        datasetId: 'building=*',
        checkedAt: '2026-07-22',
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
    entrance,
    exitTiles,
    railways: {
      mask: railwayMask,
      tileCount: countMask(railwayMask),
    },
  };
}

function generatedModule(geo) {
  const terrainRuns = encodeTerrainRle(geo.terrain);
  const railwayRuns = encodeTerrainRle(geo.railways.mask);
  return `// Generated by scripts/build-strasbourg-city-geo.mjs. Do not edit by hand.
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

export const STRASBOURG_GEO = Object.freeze({
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

export function writeStrasbourgCityGeo() {
  const geo = buildStrasbourgCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/strasbourg.geo.js',
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
  console.log(JSON.stringify(writeStrasbourgCityGeo()));
}
