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
const BBOX = Object.freeze([144.90, -37.88, 145.01, -37.78]);
const SNAPSHOT_URL = new URL('./data/melbourne-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = '99c2a2d559eb70e932a86151d2773c52206ed669d31c27254251c2fa4e70e2da';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const BRIDGE_CONTRACT = Object.freeze({
  method: 'korean-bridge-three-way-mirror-v1',
  roadRule: 'two-land-contact-components-or-road-contact',
  absorptionRule: 'river-before-water',
});

const POIS = Object.freeze([
  {
    id: 'flinders-street-station',
    nameEn: 'Flinders Street station',
    nameKo: '플린더스 스트리트역',
    lat: -37.8183,
    lon: 144.9664,
    kind: 'historic-station-architecture',
    representationPolicy: 'architectural-exterior-dome-only-no-brand-reproduction',
  },
  {
    id: 'federation-square',
    nameEn: 'Federation Square',
    nameKo: '페더레이션 스퀘어',
    lat: -37.8179,
    lon: 144.9691,
    kind: 'public-square',
    representationPolicy: 'public-square-geography-only-no-brand-reproduction',
  },
  {
    id: 'hosier-lane',
    nameEn: 'Hosier Lane',
    nameKo: '호이지어 레인',
    lat: -37.8168,
    lon: 144.9692,
    kind: 'laneway',
    representationPolicy: 'streetscape-alley-geography-only-no-specific-artwork-reproduction',
  },
  {
    id: 'queen-victoria-market',
    nameEn: 'Queen Victoria Market',
    nameKo: '퀸빅토리아마켓',
    lat: -37.8076,
    lon: 144.9568,
    kind: 'market-architecture',
    representationPolicy: 'market-architecture-and-location-only-no-brand-reproduction',
  },
  {
    id: 'state-library',
    nameEn: 'State Library Victoria',
    nameKo: '빅토리아 주립도서관',
    lat: -37.8098,
    lon: 144.9652,
    kind: 'library',
    representationPolicy: 'architectural-exterior-only',
  },
  {
    id: 'carlton-gardens',
    nameEn: 'Carlton Gardens and Royal Exhibition Building',
    nameKo: '칼튼 가든·왕립전시관',
    lat: -37.8047,
    lon: 144.9717,
    kind: 'world-heritage-gardens-and-architecture',
    representationPolicy: 'gardens-and-world-heritage-exterior-only-no-exhibit-reproduction',
  },
  {
    id: 'lygon-street',
    nameEn: 'Lygon Street',
    nameKo: '라이곤 스트리트',
    lat: -37.7994,
    lon: 144.9661,
    kind: 'cultural-district-street',
    representationPolicy: 'streetscape-district-only-no-brand-reproduction',
  },
  {
    id: 'fitzroy-brunswick-st',
    nameEn: 'Brunswick Street, Fitzroy',
    nameKo: '피츠로이 브런즈윅 스트리트',
    lat: -37.7982,
    lon: 144.9784,
    kind: 'main-street',
    representationPolicy: 'streetscape-district-only-no-brand-reproduction',
  },
  {
    id: 'royal-botanic-gardens',
    nameEn: 'Royal Botanic Gardens Victoria',
    nameKo: '빅토리아 왕립식물원',
    lat: -37.8304,
    lon: 144.9796,
    kind: 'botanic-gardens',
    representationPolicy: 'public-garden-geography-only',
  },
  {
    id: 'shrine-of-remembrance',
    nameEn: 'Shrine of Remembrance',
    nameKo: '전쟁기념관',
    lat: -37.8305,
    lon: 144.9734,
    kind: 'memorial-architecture',
    representationPolicy: 'architectural-exterior-and-location-only-no-military-or-exhibition-narrative',
  },
  {
    id: 'mcg',
    nameEn: 'Melbourne Cricket Ground',
    nameKo: '멜버른 크리켓 그라운드',
    lat: -37.8199,
    lon: 144.9834,
    kind: 'stadium',
    representationPolicy: 'stadium-exterior-only-no-match-team-or-brand-reproduction',
  },
  {
    id: 'st-kilda',
    nameEn: 'St Kilda Beach',
    nameKo: '세인트킬다 비치',
    lat: -37.8676,
    lon: 144.9745,
    kind: 'beach',
    representationPolicy: 'beach-geography-and-generalized-gate-exterior-only-no-brand-reproduction',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'flinders-street',
    nameEn: 'Flinders Street station',
    nameKo: '플린더스 스트리트역',
    lat: -37.8183,
    lon: 144.9671,
    line: 'City Loop and City Circle tram',
    routeId: 'melbourne-city-loop',
    routeIds: Object.freeze(['melbourne-city-loop', 'city-circle-tram']),
  },
  {
    id: 'southern-cross',
    nameEn: 'Southern Cross station',
    nameKo: '서던크로스역',
    lat: -37.8183,
    lon: 144.9525,
    line: 'City Loop and City Circle tram',
    routeId: 'melbourne-city-loop',
    routeIds: Object.freeze(['melbourne-city-loop', 'city-circle-tram']),
  },
  {
    id: 'melbourne-central',
    nameEn: 'Melbourne Central station',
    nameKo: '멜버른센트럴역',
    lat: -37.8100,
    lon: 144.9628,
    line: 'City Loop and City Circle tram',
    routeId: 'melbourne-city-loop',
    routeIds: Object.freeze(['melbourne-city-loop', 'city-circle-tram']),
  },
  {
    id: 'parliament',
    nameEn: 'Parliament station',
    nameKo: '팔러먼트역',
    lat: -37.8115,
    lon: 144.9730,
    line: 'City Loop and City Circle tram',
    routeId: 'melbourne-city-loop',
    routeIds: Object.freeze(['melbourne-city-loop', 'city-circle-tram']),
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
    if (!snapped) throw new Error(`Unable to separate Melbourne marker ${entry.id}`);
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

function ensureWaterfrontAccess(grid, entry, meta, maxDistance = 40) {
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
  if (target < 0) throw new Error(`Unable to connect Melbourne waterfront marker ${entry.id}`);
  for (let index = previous[target]; index >= 0; index = previous[index]) {
    grid[index] = CITY_TILE.SIDEWALK;
  }
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

function normalizeMelbourneBridgeTerrain(sourceTerrain, meta) {
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
    throw new Error(`Melbourne bridge normalization left ${report.finalBridgeTileCount} bridge tiles`);
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

function normalizeWalkableComponents(grid, protectedTiles, mainTile, meta) {
  const protectedIndexes = new Set(protectedTiles.map(([x, y]) => y * meta.grid.w + x));
  let primarySeen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
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
        const blockedMarkers = protectedTiles
          .filter(([x, y]) => component.includes(y * meta.grid.w + x))
          .map(([x, y]) => `${x},${y}`)
          .join(';');
        throw new Error(
          `Unable to connect protected Melbourne marker without crossing water: ${blockedMarkers}`,
        );
      }
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    primarySeen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (primarySeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
}

function assertCardinalConnected(grid, mainTile, meta) {
  const seen = reachableFrom(grid, mainTile[1] * meta.grid.w + mainTile[0], meta);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !seen[index]) {
      throw new Error(`Disconnected Melbourne walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`);
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
        throw new Error(`Melbourne missing ${field} for ${entry.id}`);
      }
    }
  }
}

export function buildMelbourneCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Melbourne snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'melbourne',
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
      focus: 'laneways-markets-gardens-yarra-coast',
      militaryNarrative: 'excluded',
      brandSignage: 'generalized-no-reproduction',
      personLikeness: 'excluded',
      specificArtworkReproduction: 'excluded',
      sportsMatchAndTeamReproduction: 'excluded',
      exhibitionReproduction: 'excluded',
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Melbourne OSM snapshot projection contract mismatch');
  }

  const sourceTerrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(sourceTerrain);
  const bridges = normalizeMelbourneBridgeTerrain(sourceTerrain, baseMeta);
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations]);
  separateMarkerTiles([...pois, ...stations], baseMeta);
  const mainStation = stations.find((entry) => entry.id === 'flinders-street');
  const protectedEntries = [...pois, ...stations];
  for (const id of ['st-kilda']) {
    ensureWaterfrontAccess(
      bridges.terrain,
      pois.find((entry) => entry.id === id),
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
    protectedEntries.map((entry) => entry.tile),
    mainStation.tile,
    baseMeta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(bridges.terrain, entry.tile, baseMeta);
  assertCardinalConnected(bridges.terrain, mainStation.tile, baseMeta);

  const finalBuildingStats = terrainStats(bridges.terrain);
  const meta = Object.freeze({
    ...baseMeta,
    connectivity: Object.freeze({
      method: 'cardinal-land-single-component-v1',
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
    transitPoints: [mainStation],
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
  return `// Generated by scripts/build-melbourne-city-geo.mjs. Do not edit by hand.
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

export const MELBOURNE_GEO = Object.freeze({
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

export function writeMelbourneCityGeo() {
  const geo = buildMelbourneCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/melbourne.geo.js',
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
  console.log(JSON.stringify(writeMelbourneCityGeo()));
}
