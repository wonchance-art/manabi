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
const BYTES_PER_CELL_UPPER_BOUND = 47;
const BBOX = Object.freeze([138.725, 35.395, 138.85, 35.55]);
const SNAPSHOT_URL = new URL('./data/kawaguchiko-osm-v21.json', import.meta.url);
const SNAPSHOT_SHA256 = '7c6e54a2432e754201acbcdd583419a7cc4c45df75aa88a44e3b7d576a99bf82';
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const FERRY_LINKS = Object.freeze([
  Object.freeze({
    id: 'lake-kawaguchi-cruise',
    mode: 'ferry',
    stopIds: Object.freeze(['funatsu-pier', 'oishi-landing']),
  }),
]);
const TILE_OVERRIDES = Object.freeze({
  kawaguchiko: Object.freeze({
    tile: Object.freeze([180, 288]),
    reason: 'deterministic-nearest-valid-marker-separation',
  }),
  fujisan: Object.freeze({
    tile: Object.freeze([319, 370]),
    reason: 'snapshot-rail-and-road-aligned-station-marker',
  }),
  shimoyoshida: Object.freeze({
    tile: Object.freeze([355, 291]),
    reason: 'snapshot-rail-and-road-aligned-station-marker',
  }),
});

const POIS = Object.freeze([
  {
    id: 'kawaguchiko-station',
    nameJa: '河口湖駅',
    yomi: 'かわぐちこえき',
    lat: 35.4986,
    lon: 138.7645,
    kind: 'station-architecture',
  },
  {
    id: 'oishi-park',
    nameJa: '大石公園',
    yomi: 'おおいしこうえん',
    lat: 35.5233,
    lon: 138.7355,
    kind: 'lakeside-park',
  },
  {
    id: 'tenjozan-park',
    nameJa: '天上山公園',
    yomi: 'てんじょうやまこうえん',
    lat: 35.5015,
    lon: 138.7688,
    kind: 'mountain-park',
  },
  {
    id: 'chureito',
    nameJa: '忠霊塔',
    yomi: 'ちゅうれいとう',
    lat: 35.5017,
    lon: 138.8011,
    kind: 'memorial-pagoda-exterior',
    representationPolicy: 'architectural-exterior-and-location-only-no-person-likeness-reproduction',
  },
  {
    id: 'arakura-sengen',
    nameJa: '新倉富士浅間神社',
    yomi: 'あらくらふじせんげんじんじゃ',
    lat: 35.504,
    lon: 138.8,
    kind: 'shrine-exterior',
    representationPolicy: 'architectural-exterior-and-location-only',
  },
  {
    id: 'oshino-hakkai',
    nameJa: '忍野八海',
    yomi: 'おしのはっかい',
    lat: 35.46,
    lon: 138.845,
    kind: 'spring-pond-landscape',
  },
  {
    id: 'kitaguchi-hongu',
    nameJa: '北口本宮冨士浅間神社',
    yomi: 'きたぐちほんぐうふじせんげんじんじゃ',
    lat: 35.4779,
    lon: 138.792,
    kind: 'shrine-exterior',
    representationPolicy: 'architectural-exterior-and-location-only',
  },
  {
    id: 'fujiyoshida-honcho',
    nameJa: '本町通り',
    yomi: 'ほんちょうどおり',
    lat: 35.487,
    lon: 138.807,
    kind: 'historic-shopping-street',
    representationPolicy: 'streetscape-only-no-brand-signage-reproduction',
  },
  {
    id: 'lake-kawaguchi',
    nameJa: '河口湖',
    yomi: 'かわぐちこ',
    lat: 35.511,
    lon: 138.753,
    kind: 'lakefront',
  },
  {
    id: 'funatsu-onsen',
    nameJa: '船津温泉街',
    yomi: 'ふなつおんせんがい',
    lat: 35.503,
    lon: 138.762,
    kind: 'hot-spring-district',
    representationPolicy: 'district-geography-only-no-brand-signage-reproduction',
  },
  {
    id: 'subaru-5th',
    nameJa: '富士スバルライン五合目',
    yomi: 'ふじすばるらいんごごうめ',
    lat: 35.3966,
    lon: 138.7327,
    kind: 'mountain-trailhead',
    representationPolicy: 'mountain-location-only-no-brand-or-person-likeness-reproduction',
  },
]);

const STATIONS = Object.freeze([
  {
    id: 'kawaguchiko',
    nameJa: '河口湖',
    yomi: 'かわぐちこ',
    lat: 35.4983,
    lon: 138.7649,
    line: '富士急行線',
    routeId: 'fujikyuko-line',
    routeIds: Object.freeze(['fujikyuko-line']),
  },
  {
    id: 'fujisan',
    nameJa: '富士山',
    yomi: 'ふじさん',
    lat: 35.4879,
    lon: 138.7999,
    line: '富士急行線',
    routeId: 'fujikyuko-line',
    routeIds: Object.freeze(['fujikyuko-line']),
  },
  {
    id: 'shimoyoshida',
    nameJa: '下吉田',
    yomi: 'しもよしだ',
    lat: 35.4849,
    lon: 138.7947,
    line: '富士急行線',
    routeId: 'fujikyuko-line',
    routeIds: Object.freeze(['fujikyuko-line']),
  },
]);

const FERRY_STOPS = Object.freeze([
  {
    id: 'funatsu-pier',
    nameJa: '船津船着場',
    yomi: 'ふなつふなつきば',
    lat: 35.5069,
    lon: 138.7577,
    kind: 'lake-ferry-pier',
    routeIds: Object.freeze(['lake-kawaguchi-cruise']),
  },
  {
    id: 'oishi-landing',
    nameJa: '大石船着場',
    yomi: 'おおいしふなつきば',
    lat: 35.5205,
    lon: 138.7387,
    kind: 'lake-ferry-landing',
    routeIds: Object.freeze(['lake-kawaguchi-cruise']),
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
  const projectedTile = projectLatLonToTile(entry.lat, entry.lon, meta, metrics);
  const override = TILE_OVERRIDES[entry.id];
  return {
    ...entry,
    contentLocale: meta.contentLocale,
    lat: Number(entry.lat.toFixed(7)),
    lon: Number(entry.lon.toFixed(7)),
    tile: override ? [...override.tile] : projectedTile,
    ...(override ? {
      projectedTile,
      tileAdjustment: override.reason,
    } : {}),
  };
}

function markerAvailable(tile, claimed, meta, minDistance = 2) {
  const [x, y] = tile;
  return x >= 0 && y >= 0 && x < meta.grid.w && y < meta.grid.h
    && claimed.every(([claimedX, claimedY]) => (
      Math.max(Math.abs(x - claimedX), Math.abs(y - claimedY)) >= minDistance
    ));
}

function separateMarkerTiles(entries, meta) {
  const claimed = [];
  for (const entry of entries) {
    if (!markerAvailable(entry.tile, claimed, meta)) {
      const [originX, originY] = entry.tile;
      const candidates = [];
      for (let radius = 1; radius <= 8; radius += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const tile = [originX + dx, originY + dy];
            if (!markerAvailable(tile, claimed, meta)) continue;
            candidates.push({
              tile,
              squaredDistance: dx * dx + dy * dy,
              radius,
            });
          }
        }
        if (candidates.length > 0) break;
      }
      candidates.sort((left, right) => (
        left.squaredDistance - right.squaredDistance
        || left.radius - right.radius
        || left.tile[1] - right.tile[1]
        || left.tile[0] - right.tile[0]
      ));
      if (candidates.length === 0) {
        throw new Error(`Unable to separate Kawaguchiko marker ${entry.id}`);
      }
      entry.tile = candidates[0].tile;
      entry.tileAdjustment = entry.tileAdjustment ?? 'deterministic-nearest-valid-marker-separation';
    }
    claimed.push(entry.tile);
  }
}

function nearestMaskTile(mask, origin, meta, maxRadius) {
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = origin[0] + dx;
        const y = origin[1] + dy;
        if (x < 0 || y < 0 || x >= meta.grid.w || y >= meta.grid.h) continue;
        if (!mask[y * meta.grid.w + x]) continue;
        candidates.push({
          tile: [x, y],
          squaredDistance: dx * dx + dy * dy,
        });
      }
    }
    if (candidates.length === 0) continue;
    candidates.sort((left, right) => (
      left.squaredDistance - right.squaredDistance
      || left.tile[1] - right.tile[1]
      || left.tile[0] - right.tile[0]
    ));
    return candidates[0].tile;
  }
  return null;
}

function carveMountainAnchorCorridor(grid, entry, roadMask, mountainMask, meta) {
  const start = entry.tile[1] * meta.grid.w + entry.tile[0];
  if (!mountainMask[start]) return null;
  const targetTile = nearestMaskTile(roadMask, entry.tile, meta, 12);
  if (!targetTile) throw new Error(`No bounded road corridor for ${entry.id}`);
  const target = targetTile[1] * meta.grid.w + targetTile[0];
  const parent = new Int32Array(grid.length).fill(-1);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  parent[start] = start;
  while (head < tail && parent[target] < 0) {
    const index = queue[head++];
    const x = index % meta.grid.w;
    const y = Math.floor(index / meta.grid.w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
      const next = ny * meta.grid.w + nx;
      if (parent[next] >= 0) continue;
      if (next !== target && !mountainMask[next]) continue;
      parent[next] = index;
      queue[tail++] = next;
    }
  }
  if (parent[target] < 0) throw new Error(`Unable to route bounded mountain corridor for ${entry.id}`);
  const changed = [];
  for (let index = target; ; index = parent[index]) {
    if (isCityBlocked(grid[index])) {
      grid[index] = index === start ? CITY_TILE.PLAZA : CITY_TILE.ROAD;
      changed.push(index);
    }
    if (index === start) break;
  }
  return {
    targetTile,
    changed,
  };
}

function cardinalizeRoadPathToPrimary(grid, roadMask, startTile, primaryTiles, meta) {
  const primarySeen = combinedPrimarySeen(grid, primaryTiles, meta);
  const start = startTile[1] * meta.grid.w + startTile[0];
  if (primarySeen[start]) return [];
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
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= meta.grid.w || ny >= meta.grid.h) continue;
        const next = ny * meta.grid.w + nx;
        if (parent[next] >= 0 || !roadMask[next]) continue;
        parent[next] = index;
        if (primarySeen[next]) {
          target = next;
          break;
        }
        queue[tail++] = next;
      }
      if (target >= 0) break;
    }
  }
  if (target < 0) return null;
  const path = [];
  for (let index = target; ; index = parent[index]) {
    path.push(index);
    if (index === start) break;
  }
  path.reverse();
  const changed = [];
  for (let offset = 1; offset < path.length; offset += 1) {
    const previous = path[offset - 1];
    const current = path[offset];
    const px = previous % meta.grid.w;
    const py = Math.floor(previous / meta.grid.w);
    const cx = current % meta.grid.w;
    const cy = Math.floor(current / meta.grid.w);
    if (px === cx || py === cy) continue;
    const candidates = [
      cy * meta.grid.w + px,
      py * meta.grid.w + cx,
    ].sort((left, right) => left - right);
    const bridge = candidates.find((index) => (
      grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER
    ));
    if (bridge === undefined) return null;
    if (isCityBlocked(grid[bridge])) {
      grid[bridge] = CITY_TILE.ROAD;
      changed.push(bridge);
    }
  }
  return changed;
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
  const candidates = CARDINAL
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < meta.grid.w && ny < meta.grid.h);
  if (candidates.length === 0) throw new Error(`No walkable neighbor for ${x},${y}`);
  const [nx, ny] = candidates[0];
  grid[ny * meta.grid.w + nx] = CITY_TILE.PLAZA;
}

function reachableFrom(grid, start, meta, adjacency = new Map()) {
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
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

function connectToPrimaryWithoutMountain(grid, start, primarySeen, meta) {
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
      if ([CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.MOUNTAIN].includes(grid[next])) continue;
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

function normalizeWalkableComponents(
  grid,
  protectedEntries,
  primaryTiles,
  allowedSeparateTile,
  meta,
) {
  const protectedByIndex = new Map(protectedEntries.map(({ id, tile: [x, y] }) => (
    [y * meta.grid.w + x, id]
  )));
  const protectedIndexes = new Set(protectedByIndex.keys());
  const allowedSeparateIndex = allowedSeparateTile[1] * meta.grid.w + allowedSeparateTile[0];
  let primarySeen = combinedPrimarySeen(grid, primaryTiles, meta);
  const visited = primarySeen.slice();
  for (let index = 0; index < grid.length; index += 1) {
    if (visited[index] || isCityBlocked(grid[index])) continue;
    const component = collectComponent(grid, index, visited, meta);
    const protectedComponent = component.some((tileIndex) => protectedIndexes.has(tileIndex));
    if (component.includes(allowedSeparateIndex)) continue;
    if (component.length < 40 && !protectedComponent) {
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.BUILDING;
      continue;
    }
    if (!connectToPrimaryWithoutMountain(grid, component[0], primarySeen, meta)) {
      if (protectedComponent) {
        const ids = component
          .map((tileIndex) => protectedByIndex.get(tileIndex))
          .filter(Boolean);
        throw new Error(
          `Unable to connect protected Kawaguchiko marker without crossing mountain or water: ${ids.join(',')}`,
        );
      }
      for (const tileIndex of component) grid[tileIndex] = CITY_TILE.MOUNTAIN;
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
    if (left === undefined || right === undefined) throw new Error('Kawaguchiko ferry stop is missing');
    if (!adjacency.has(left)) adjacency.set(left, []);
    if (!adjacency.has(right)) adjacency.set(right, []);
    adjacency.get(left).push(right);
    adjacency.get(right).push(left);
  }
  return adjacency;
}

function connectivityReport(grid, mainTile, ferryStops, fifthStationTile, meta) {
  const mainStart = mainTile[1] * meta.grid.w + mainTile[0];
  const fifthStart = fifthStationTile[1] * meta.grid.w + fifthStationTile[0];
  const ferrySeen = reachableFrom(grid, mainStart, meta, ferryAdjacency(ferryStops, meta.grid.w));
  const fifthSeen = reachableFrom(grid, fifthStart, meta);
  let walkableTileCount = 0;
  let ferryReachableTileCount = 0;
  let fifthStationComponentTileCount = 0;
  for (let index = 0; index < grid.length; index += 1) {
    if (isCityBlocked(grid[index])) continue;
    walkableTileCount += 1;
    ferryReachableTileCount += Number(Boolean(ferrySeen[index]));
    fifthStationComponentTileCount += Number(Boolean(fifthSeen[index]));
    if (!ferrySeen[index] && !fifthSeen[index]) {
      throw new Error(
        `Disconnected Kawaguchiko walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`,
      );
    }
  }
  return {
    walkableTileCount,
    ferryReachableTileCount,
    fifthStationComponentTileCount,
    fifthStationSeparate: !ferrySeen[fifthStart],
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

function validateLocaleCoverage(entries) {
  for (const entry of entries) {
    for (const field of ['nameJa', 'yomi']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`Kawaguchiko missing ${field} for ${entry.id}`);
      }
    }
  }
}

function normalizeBridges(terrain, snapshot) {
  const roadMask = decodeTerrainRle(snapshot.roadRle, terrain.length);
  const waterMask = decodeTerrainRle(snapshot.waterRle, terrain.length);
  const riverMask = decodeTerrainRle(snapshot.riverRle, terrain.length);
  let sourceBridgeTileCount = 0;
  for (let index = 0; index < terrain.length; index += 1) {
    if (terrain[index] !== CITY_TILE.BRIDGE) continue;
    sourceBridgeTileCount += 1;
    terrain[index] = roadMask[index]
      ? CITY_TILE.ROAD
      : riverMask[index]
        ? CITY_TILE.RIVER
        : waterMask[index]
          ? CITY_TILE.WATER
          : CITY_TILE.SIDEWALK;
  }
  return {
    roadMask,
    waterMask,
    riverMask,
    report: Object.freeze({
      method: 'kawaguchiko-bridge-zero-normalization-v1',
      sourceBridgeTileCount,
      finalBridgeTileCount: 0,
    }),
  };
}

export function buildKawaguchikoCityGeo() {
  const snapshotText = fs.readFileSync(SNAPSHOT_URL, 'utf8');
  const snapshotSha256 = createHash('sha256').update(snapshotText).digest('hex');
  if (snapshotSha256 !== SNAPSHOT_SHA256) {
    throw new Error(`Kawaguchiko snapshot SHA-256 mismatch: ${snapshotSha256}`);
  }
  const snapshot = JSON.parse(snapshotText);
  const metrics = projectionMetrics(BBOX);
  const baseMeta = Object.freeze({
    city: 'kawaguchiko',
    bbox: BBOX,
    grid: Object.freeze(metrics.grid),
    metersPerTile: METERS_PER_TILE,
    projection: 'webmercator',
    aspectCorrection: Number(metrics.correction.toFixed(12)),
    contentLocale: 'ja',
    schema: Object.freeze({
      nameField: 'nameJa',
      readingField: 'yomi',
      localeSlots: 'central-lookup-expandable',
    }),
    source: Object.freeze({
      ...snapshot.source,
      snapshotSha256,
    }),
    contentPolicy: Object.freeze({
      focus: 'lake-mountain-shrines-streetscape',
      brandSignage: 'generalized-no-reproduction',
      personLikeness: 'excluded',
      specificArtworkAndGraffitiReproduction: 'excluded',
      sportsMatchAndTeamReproduction: 'excluded',
      exhibitionReproduction: 'excluded',
      aokigahara: 'outside-bbox-and-excluded',
      mountFujiSummit: 'outside-bbox-act-scene-only',
    }),
    coordinatePolicy: Object.freeze({
      method: 'spec-coordinates-with-explicit-snapshot-mask-alignment-v1',
      overrides: Object.freeze(Object.fromEntries(
        Object.entries(TILE_OVERRIDES).map(([id, { tile, reason }]) => [
          id,
          Object.freeze({ tile, reason }),
        ]),
      )),
    }),
    memory: Object.freeze({
      method: '47-byte-per-cell-upper-bound-v1',
      estimatedBytes: metrics.grid.w * metrics.grid.h * BYTES_PER_CELL_UPPER_BOUND,
      limitBytes: 24 * 1024 * 1024,
    }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox)
    || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h
    || snapshot.metersPerTile !== baseMeta.metersPerTile) {
    throw new Error('Kawaguchiko OSM snapshot projection contract mismatch');
  }
  if (baseMeta.memory.estimatedBytes >= baseMeta.memory.limitBytes) {
    throw new Error('Kawaguchiko memory estimate exceeds 24MiB');
  }

  const terrain = buildTerrainFromSnapshot(snapshot);
  const initialBuildingStats = terrainStats(terrain);
  const bridgeNormalization = normalizeBridges(terrain, snapshot);
  const mountainMask = decodeTerrainRle(snapshot.mountainRle, terrain.length);
  let preservedMountainRoadTileCount = 0;
  for (let index = 0; index < terrain.length; index += 1) {
    if (!mountainMask[index] || !bridgeNormalization.roadMask[index]) continue;
    if (terrain[index] === CITY_TILE.MOUNTAIN) {
      terrain[index] = CITY_TILE.ROAD;
      preservedMountainRoadTileCount += 1;
    }
  }
  const pois = POIS.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = STATIONS.map((entry) => withTile(entry, baseMeta, metrics));
  const ferryStops = FERRY_STOPS.map((entry) => withTile(entry, baseMeta, metrics));
  validateLocaleCoverage([...pois, ...stations, ...ferryStops]);
  separateMarkerTiles([...pois, ...stations, ...ferryStops], baseMeta);

  const mountainCorridors = [];
  for (const entry of [...pois, ...stations, ...ferryStops]) {
    const corridor = carveMountainAnchorCorridor(
      terrain,
      entry,
      bridgeNormalization.roadMask,
      mountainMask,
      baseMeta,
    );
    if (corridor) {
      mountainCorridors.push({
        id: entry.id,
        roadTargetTile: corridor.targetTile,
        changedTileCount: corridor.changed.length,
        tileIndexes: corridor.changed.sort((left, right) => left - right),
        cardinalizedTileIndexes: [],
      });
    }
  }

  const protectedEntries = [...pois, ...stations, ...ferryStops];
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, baseMeta);
  const mainStation = stations.find((entry) => entry.id === 'kawaguchiko');
  const fifthStation = pois.find((entry) => entry.id === 'subaru-5th');
  const primaryTiles = [mainStation.tile, ...ferryStops.map((entry) => entry.tile)];
  for (const corridor of mountainCorridors) {
    if (corridor.id === 'subaru-5th') continue;
    const changed = cardinalizeRoadPathToPrimary(
      terrain,
      bridgeNormalization.roadMask,
      corridor.roadTargetTile,
      primaryTiles,
      baseMeta,
    );
    if (changed === null) continue;
    corridor.cardinalizedTileIndexes = changed.sort((left, right) => left - right);
  }
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) {
    terrain[y * baseMeta.grid.w + entrance.x] = CITY_TILE.ROAD;
  }
  normalizeWalkableComponents(
    terrain,
    protectedEntries,
    primaryTiles,
    fifthStation.tile,
    baseMeta,
  );
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, baseMeta);
  const connectivity = connectivityReport(
    terrain,
    mainStation.tile,
    ferryStops,
    fifthStation.tile,
    baseMeta,
  );
  const finalBuildingStats = terrainStats(terrain);
  const meta = Object.freeze({
    ...baseMeta,
    connectivity: Object.freeze({
      method: 'cardinal-land-plus-one-lake-ferry-and-optional-fifth-station-component-v1',
      ferryLinks: FERRY_LINKS,
      ...connectivity,
    }),
    mountainAnchorCorridors: Object.freeze({
      method: 'snapshot-road-mask-preservation-plus-bounded-anchor-corridor-v1',
      preservedMountainRoadTileCount,
      directAnchorChangedTileCount: mountainCorridors
        .reduce((sum, entry) => sum + entry.changedTileCount, 0),
      cardinalizedMountainRoadTileCount: mountainCorridors
        .reduce((sum, entry) => sum + entry.cardinalizedTileIndexes.length, 0),
      entries: Object.freeze(mountainCorridors.map((entry) => Object.freeze({
        ...entry,
        roadTargetTile: Object.freeze(entry.roadTargetTile),
        tileIndexes: Object.freeze(entry.tileIndexes),
        cardinalizedTileIndexes: Object.freeze(entry.cardinalizedTileIndexes),
      }))),
      changedTileCount: mountainCorridors
        .reduce((sum, entry) => (
          sum + entry.changedTileCount + entry.cardinalizedTileIndexes.length
        ), 0),
    }),
    ferryShoreContract: Object.freeze({
      method: 'fixed-coordinate-bounded-water-proximity-v1',
      maxWaterDistanceTiles: Object.freeze({
        'funatsu-pier': 20,
        'oishi-landing': 5,
      }),
    }),
    buildingTexture: Object.freeze({
      method: 'osm-existing-buildings-report-only',
      initialLandTileCount: initialBuildingStats.landTileCount,
      initialBuildingTileCount: initialBuildingStats.buildingTileCount,
      initialLandBuildingRatio: initialBuildingStats.landBuildingRatio,
      finalLandTileCount: finalBuildingStats.landTileCount,
      finalBuildingTileCount: finalBuildingStats.buildingTileCount,
      finalLandBuildingRatio: finalBuildingStats.landBuildingRatio,
    }),
    bridgeNormalization: bridgeNormalization.report,
  });
  const railwayMask = decodeTerrainRle(snapshot.railwayRle, terrain.length);
  return {
    meta,
    terrain,
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
  return `// Generated by scripts/build-kawaguchiko-city-geo.mjs. Do not edit by hand.
// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot ${geo.meta.source.snapshot}).
// Locale schema: nameJa is canonical; yomi is the reading; contentLocale remains ja.

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

export const KAWAGUCHIKO_GEO = Object.freeze({
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

export function writeKawaguchikoCityGeo() {
  const geo = buildKawaguchikoCityGeo();
  const outputPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/components/world/cities/kawaguchiko.geo.js',
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
  console.log(JSON.stringify(writeKawaguchikoCityGeo()));
}
