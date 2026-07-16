import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITY_TILE, isCityBlocked } from '../src/components/world/cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const METERS_PER_TILE = 20;
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const KOREAN_BRIDGE_CONTRACT = Object.freeze({
  method: 'korea-bridge-three-way-v1',
  roadRule: 'two-land-contact-components-or-road-contact',
  absorptionRule: 'river-before-water',
});
const BUILDING_TEXTURE_CONTRACT = Object.freeze({
  method: 'deterministic-road-block-infill',
  version: 2,
  targetLandRatio: 0.10,
  blockFillRatioMin: 0.70,
  blockFillRatioMax: 0.85,
  blockMinTiles: 12,
  blockMaxTiles: 2_000,
  seedNamespace: 'manabi-korean-city-buildings-v2',
  minorRoadClasses: Object.freeze(['service', 'footway', 'path', 'steps', 'cycleway', 'track']),
  publicDatasetProbe: Object.freeze({
    provider: 'MOLIT VWorld',
    datasetId: '30162',
    checkedAt: '2026-07-16',
    outcome: 'login-and-desktop-downloader-required',
  }),
});
const CITY_CONFIG = Object.freeze({
  busan: Object.freeze({
    bbox: Object.freeze([128.89, 35.04, 129.18, 35.24]),
    snapshot: new URL('./data/busan-osm-v21.json', import.meta.url),
    output: '../src/components/world/cities/busan.geo.js',
    exportName: 'BUSAN_GEO',
    mainStationId: 'busan',
    pois: Object.freeze([
      { id: 'haeundae', nameKo: '해운대해수욕장', lat: 35.1587, lon: 129.1604, kind: 'beach' },
      { id: 'gwangalli', nameKo: '광안리해수욕장', lat: 35.1532, lon: 129.1187, kind: 'beach' },
      { id: 'gwangan-bridge', nameKo: '광안대교', lat: 35.1470, lon: 129.1150, kind: 'bridge-landmark' },
      { id: 'jagalchi', nameKo: '자갈치시장', lat: 35.0966, lon: 129.0307, kind: 'market' },
      { id: 'gukje-market', nameKo: '국제시장', lat: 35.1010, lon: 129.0284, kind: 'market' },
      { id: 'gamcheon', nameKo: '감천문화마을', lat: 35.0977, lon: 129.0106, kind: 'village' },
      { id: 'busan-tower', nameKo: '부산타워(용두산공원)', lat: 35.1006, lon: 129.0324, kind: 'landmark' },
      { id: 'taejongdae', nameKo: '태종대', lat: 35.0532, lon: 129.0866, kind: 'coast' },
      { id: 'busan-port-intl', nameKo: '부산항국제여객터미널', lat: 35.1194, lon: 129.0403, kind: 'port' },
      { id: 'dadaepo', nameKo: '다대포해수욕장', lat: 35.0467, lon: 128.9655, kind: 'beach' },
      { id: 'eulsukdo', nameKo: '을숙도', lat: 35.1000, lon: 128.9450, kind: 'nature' },
      { id: 'dongnae-eupseong', nameKo: '동래읍성', lat: 35.2100, lon: 129.0850, kind: 'historic' },
      { id: 'pnu-street', nameKo: '부산대앞 젊음의 거리', lat: 35.2300, lon: 129.0840, kind: 'district' },
    ]),
    stations: Object.freeze([
      { id: 'busan', nameKo: '부산역', lat: 35.1151, lon: 129.0403, line: 'KTX·부산도시철도 1호선' },
      { id: 'seomyeon', nameKo: '서면역', lat: 35.1579, lon: 129.0593, line: '부산도시철도 1·2호선' },
      { id: 'nampo', nameKo: '남포역', lat: 35.0987, lon: 129.0338, line: '부산도시철도 1호선' },
      { id: 'haeundae-station', nameKo: '해운대역', lat: 35.1637, lon: 129.1443, line: '부산도시철도 2호선' },
      { id: 'dongnae-station', nameKo: '동래역', lat: 35.2050, lon: 129.0790, line: '부산도시철도 1호선' },
      { id: 'pnu-station', nameKo: '부산대역', lat: 35.2295, lon: 129.0900, line: '부산도시철도 1호선' },
      { id: 'centum-city-station', nameKo: '센텀시티역', lat: 35.1690, lon: 129.1320, line: '부산도시철도 2호선' },
    ]),
  }),
  seoul: Object.freeze({
    bbox: Object.freeze([126.79, 37.43, 127.18, 37.69]),
    snapshot: new URL('./data/seoul-osm-v21.json', import.meta.url),
    output: '../src/components/world/cities/seoul.geo.js',
    exportName: 'SEOUL_GEO',
    mainStationId: 'seoul',
    pois: Object.freeze([
      { id: 'gyeongbokgung', nameKo: '경복궁', lat: 37.5796, lon: 126.9770, kind: 'historic' },
      { id: 'gwanghwamun', nameKo: '광화문', lat: 37.5759, lon: 126.9769, kind: 'historic' },
      { id: 'n-seoul-tower', nameKo: 'N서울타워', lat: 37.5512, lon: 126.9882, kind: 'landmark' },
      { id: 'myeongdong', nameKo: '명동', lat: 37.5637, lon: 126.9850, kind: 'district' },
      { id: 'sungnyemun', nameKo: '숭례문', lat: 37.5601, lon: 126.9754, kind: 'historic' },
      { id: 'bukchon', nameKo: '북촌한옥마을', lat: 37.5826, lon: 126.9850, kind: 'village' },
      { id: 'insadong', nameKo: '인사동', lat: 37.5744, lon: 126.9857, kind: 'district' },
      { id: 'cheonggyecheon', nameKo: '청계천', lat: 37.5695, lon: 126.9827, kind: 'river-landmark' },
      { id: 'ddp', nameKo: '동대문디자인플라자', lat: 37.5670, lon: 127.0095, kind: 'landmark' },
      { id: 'heunginjimun', nameKo: '흥인지문', lat: 37.5713, lon: 127.0093, kind: 'historic' },
      { id: 'hongdae', nameKo: '홍대거리', lat: 37.5573, lon: 126.9237, kind: 'district' },
      { id: 'yeouido-63', nameKo: '63스퀘어', lat: 37.5198, lon: 126.9404, kind: 'landmark' },
      { id: 'coex', nameKo: '코엑스', lat: 37.5116, lon: 127.0587, kind: 'landmark' },
      { id: 'lotte-world-tower', nameKo: '롯데월드타워', lat: 37.5126, lon: 127.1025, kind: 'landmark' },
      { id: 'changdeokgung', nameKo: '창덕궁', lat: 37.5794, lon: 126.9910, kind: 'historic' },
      { id: 'jongmyo', nameKo: '종묘', lat: 37.5748, lon: 126.9940, kind: 'historic' },
      { id: 'seonjeongneung', nameKo: '선릉·정릉', lat: 37.5087, lon: 127.0489, kind: 'historic' },
      { id: 'gimpo-airport', nameKo: '김포공항', lat: 37.5585, lon: 126.7906, kind: 'airport' },
      { id: 'seoul-nat-univ', nameKo: '서울대학교', lat: 37.4599, lon: 126.9520, kind: 'campus' },
      { id: 'amsa-dong', nameKo: '암사동 선사유적', lat: 37.5566, lon: 127.1300, kind: 'historic' },
      { id: 'seoul-forest', nameKo: '서울숲', lat: 37.5444, lon: 127.0374, kind: 'park' },
      { id: 'itaewon', nameKo: '이태원', lat: 37.5345, lon: 126.9946, kind: 'district' },
    ]),
    stations: Object.freeze([
      { id: 'seoul', nameKo: '서울역', lat: 37.5547, lon: 126.9707, line: 'KTX·수도권 전철' },
      { id: 'city-hall', nameKo: '시청역', lat: 37.5657, lon: 126.9779, line: '수도권 전철 1·2호선' },
      { id: 'jonggak', nameKo: '종각역', lat: 37.5703, lon: 126.9832, line: '수도권 전철 1호선' },
      { id: 'dongdaemun', nameKo: '동대문역', lat: 37.5714, lon: 127.0090, line: '수도권 전철 1·4호선' },
      { id: 'hongik-university', nameKo: '홍대입구역', lat: 37.5568, lon: 126.9240, line: '수도권 전철 2호선' },
      { id: 'yeouido', nameKo: '여의도역', lat: 37.5219, lon: 126.9245, line: '수도권 전철 5·9호선' },
      { id: 'gangnam', nameKo: '강남역', lat: 37.4979, lon: 127.0276, line: '수도권 전철 2호선' },
      { id: 'samseong', nameKo: '삼성역', lat: 37.5088, lon: 127.0631, line: '수도권 전철 2호선' },
      { id: 'jamsil', nameKo: '잠실역', lat: 37.5133, lon: 127.1000, line: '수도권 전철 2·8호선' },
    ]),
  }),
});

function webMercatorMeters(lon, lat) {
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + limitedLat * DEG / 2)),
  };
}

function projectionMetrics(bbox, metersPerTile = METERS_PER_TILE) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const southWest = webMercatorMeters(minLon, minLat);
  const northEast = webMercatorMeters(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    southWest, northEast, correction,
    grid: {
      w: Math.ceil(((northEast.x - southWest.x) * correction) / metersPerTile),
      h: Math.ceil(((northEast.y - southWest.y) * correction) / metersPerTile),
    },
  };
}

function projectLatLonToTile(lat, lon, meta, metrics) {
  const point = webMercatorMeters(lon, lat);
  return [
    Math.max(0, Math.min(meta.grid.w - 1, Math.floor(((point.x - metrics.southWest.x) * metrics.correction) / meta.metersPerTile))),
    Math.max(0, Math.min(meta.grid.h - 1, Math.floor(((metrics.northEast.y - point.y) * metrics.correction) / meta.metersPerTile))),
  ];
}

export function encodeTerrainRle(terrain) {
  if (terrain.length === 0) return [];
  const runs = [];
  let code = terrain[0];
  let count = 1;
  for (let index = 1; index < terrain.length; index += 1) {
    if (terrain[index] === code) count += 1;
    else {
      runs.push([code, count]);
      code = terrain[index];
      count = 1;
    }
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

function ensureWalkableAnchor(grid, tile, meta) {
  const [x, y] = tile;
  const index = y * meta.grid.w + x;
  if (isCityBlocked(grid[index])) grid[index] = CITY_TILE.PLAZA;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < meta.grid.w && ny < meta.grid.h && !isCityBlocked(grid[ny * meta.grid.w + nx]);
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

function connectToMain(grid, start, mainSeen, meta, city) {
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
  if (target < 0) throw new Error(`Unable to connect ${city} walkable component`);
  for (let index = target; index !== start; index = parent[index]) {
    if (!isCityBlocked(grid[index])) continue;
    grid[index] = grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER
      ? CITY_TILE.BRIDGE
      : CITY_TILE.ROAD;
  }
}

function normalizeWalkableComponents(grid, protectedTiles, mainTile, meta, city) {
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
    connectToMain(grid, component[0], mainSeen, meta, city);
    mainSeen = reachableFrom(grid, mainStart, meta);
    for (let tileIndex = 0; tileIndex < visited.length; tileIndex += 1) {
      if (mainSeen[tileIndex]) visited[tileIndex] = 1;
    }
  }
  const finalSeen = reachableFrom(grid, mainStart, meta);
  for (let index = 0; index < grid.length; index += 1) {
    if (!isCityBlocked(grid[index]) && !finalSeen[index]) {
      throw new Error(`Disconnected ${city} walkable tile at ${index % meta.grid.w},${Math.floor(index / meta.grid.w)}`);
    }
  }
}

function applySnapshotMasks(grid, snapshot, meta) {
  const length = grid.length;
  const masks = {
    building: decodeTerrainRle(snapshot.buildingRle, length),
    road: decodeTerrainRle(snapshot.roadRle, length),
    water: decodeTerrainRle(snapshot.waterRle, length),
    river: decodeTerrainRle(snapshot.riverRle, length),
    park: decodeTerrainRle(snapshot.parkRle, length),
    mountain: decodeTerrainRle(snapshot.mountainRle, length),
  };
  for (let index = 0; index < length; index += 1) if (masks.water[index]) grid[index] = CITY_TILE.WATER;
  for (let index = 0; index < length; index += 1) if (masks.river[index]) grid[index] = CITY_TILE.RIVER;
  for (let index = 0; index < length; index += 1) {
    if (masks.mountain[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) grid[index] = CITY_TILE.MOUNTAIN;
  }
  for (let index = 0; index < length; index += 1) {
    if (masks.park[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) grid[index] = CITY_TILE.PARK;
  }
  for (let index = 0; index < length; index += 1) {
    if (masks.building[index] && grid[index] !== CITY_TILE.WATER && grid[index] !== CITY_TILE.RIVER) grid[index] = CITY_TILE.BUILDING;
  }
  for (let index = 0; index < length; index += 1) {
    const roadClass = masks.road[index];
    if (!roadClass) continue;
    if (grid[index] === CITY_TILE.WATER || grid[index] === CITY_TILE.RIVER) {
      if (roadClass >= 3) grid[index] = CITY_TILE.BRIDGE;
    }
    else if (roadClass >= 2) grid[index] = CITY_TILE.ROAD;
    else if (grid[index] !== CITY_TILE.BUILDING) grid[index] = CITY_TILE.SIDEWALK;
  }
  for (const [x, y] of snapshot.crossings) {
    const index = y * meta.grid.w + x;
    if (masks.road[index] >= 2 && grid[index] === CITY_TILE.ROAD) grid[index] = CITY_TILE.CROSSWALK;
  }
  return masks;
}

function isBridgeLandContact(code) {
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

export function normalizeKoreanBridgeTerrain(sourceTerrain, meta) {
  const terrain = sourceTerrain.slice();
  const { w: width, h: height } = meta.grid;
  const seen = new Uint8Array(terrain.length);
  const report = {
    ...KOREAN_BRIDGE_CONTRACT,
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
        if (isBridgeLandContact(code)) landContacts.add(next);
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
    throw new Error(`Korean bridge normalization left ${report.finalBridgeTileCount} bridge tiles`);
  }
  return { terrain, report: Object.freeze(report) };
}

function hashString32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tileHash32(seed, x, y) {
  let hash = seed ^ Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca6b);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function terrainBuildingStats(terrain) {
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

function collectClosedRoadBlocks(roadMask, meta, seed) {
  const { w, h } = meta.grid;
  const seen = new Uint8Array(roadMask.length);
  const queue = new Int32Array(roadMask.length);
  const blocks = [];
  for (let start = 0; start < roadMask.length; start += 1) {
    if (roadMask[start] || seen[start]) continue;
    let head = 0;
    let tail = 0;
    let touchesBoundary = false;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % w;
      const y = Math.floor(index / w);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBoundary = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const next = ny * w + nx;
        if (roadMask[next] || seen[next]) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (touchesBoundary || tail < BUILDING_TEXTURE_CONTRACT.blockMinTiles
      || tail > BUILDING_TEXTURE_CONTRACT.blockMaxTiles) continue;
    blocks.push({
      indexes: Array.from(queue.subarray(0, tail)),
      minX, minY, maxX, maxY,
      score: (tileHash32(seed, minX, minY) ^ tileHash32(seed, maxX, maxY)) >>> 0,
    });
  }
  blocks.sort((left, right) => left.score - right.score
    || left.minY - right.minY || left.minX - right.minX);
  return blocks;
}

function touchesRoad(roadMask, meta, index) {
  const { w, h } = meta.grid;
  const x = index % w;
  const y = Math.floor(index / w);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && roadMask[ny * w + nx]) return true;
    }
  }
  return false;
}

function blockFillCandidates(terrain, roadMask, meta, block) {
  const { w } = meta.grid;
  const width = block.maxX - block.minX + 1;
  const height = block.maxY - block.minY + 1;
  const alleyX = block.minX + 2 + (block.score % Math.max(1, width - 4));
  const alleyY = block.minY + 2 + ((block.score >>> 8) % Math.max(1, height - 4));
  const preserveVerticalAlley = width >= 8 && (width >= height || block.indexes.length >= 240);
  const preserveHorizontalAlley = height >= 8 && (height > width || block.indexes.length >= 240);
  const candidates = [];
  let preservedAlleyTileCount = 0;
  for (const index of block.indexes) {
    if (terrain[index] !== CITY_TILE.SIDEWALK || roadMask[index] || touchesRoad(roadMask, meta, index)) continue;
    const x = index % w;
    const y = Math.floor(index / w);
    if ((preserveVerticalAlley && x === alleyX) || (preserveHorizontalAlley && y === alleyY)) {
      preservedAlleyTileCount += 1;
      continue;
    }
    candidates.push(index);
  }
  const corner = block.score & 3;
  const anchorX = corner & 1 ? block.maxX : block.minX;
  const anchorY = corner & 2 ? block.maxY : block.minY;
  candidates.sort((left, right) => {
    const leftX = left % w;
    const leftY = Math.floor(left / w);
    const rightX = right % w;
    const rightY = Math.floor(right / w);
    const leftDistance = Math.abs(leftX - anchorX) + Math.abs(leftY - anchorY);
    const rightDistance = Math.abs(rightX - anchorX) + Math.abs(rightY - anchorY);
    return leftDistance - rightDistance || leftY - rightY || leftX - rightX;
  });
  return { candidates, preservedAlleyTileCount };
}

function augmentBuildingTexture(terrain, masks, meta, city, targetBuildingTileCount) {
  const initial = terrainBuildingStats(terrain);
  if (initial.buildingTileCount >= targetBuildingTileCount) {
    return {
      ...initial, targetBuildingTileCount, generatedTileCount: 0,
      candidateBlockCount: 0, selectedBlockCount: 0, preservedAlleyTileCount: 0,
      selectedBlockFillRatioMin: 0, selectedBlockFillRatioMax: 0,
    };
  }

  const seed = hashString32(`${BUILDING_TEXTURE_CONTRACT.seedNamespace}:${city}`);
  const blocks = collectClosedRoadBlocks(masks.road, meta, seed);
  let buildingTileCount = initial.buildingTileCount;
  let selectedBlockCount = 0;
  let preservedAlleyTileCount = 0;
  let selectedBlockFillRatioMin = 1;
  let selectedBlockFillRatioMax = 0;
  for (const block of blocks) {
    if (buildingTileCount >= targetBuildingTileCount) break;
    const { candidates, preservedAlleyTileCount: blockAlleyTileCount } = blockFillCandidates(
      terrain, masks.road, meta, block,
    );
    if (candidates.length === 0) continue;
    const minimumFill = Math.ceil(candidates.length * BUILDING_TEXTURE_CONTRACT.blockFillRatioMin);
    const maximumFill = Math.floor(candidates.length * BUILDING_TEXTURE_CONTRACT.blockFillRatioMax);
    if (minimumFill > maximumFill) continue;
    const fillCount = minimumFill + ((block.score >>> 16) % (maximumFill - minimumFill + 1));
    for (let index = 0; index < fillCount; index += 1) {
      terrain[candidates[index]] = CITY_TILE.BUILDING;
      buildingTileCount += 1;
    }
    const fillRatio = fillCount / candidates.length;
    selectedBlockFillRatioMin = Math.min(selectedBlockFillRatioMin, fillRatio);
    selectedBlockFillRatioMax = Math.max(selectedBlockFillRatioMax, fillRatio);
    preservedAlleyTileCount += blockAlleyTileCount;
    selectedBlockCount += 1;
  }
  if (buildingTileCount < targetBuildingTileCount) {
    throw new Error(`${city} building infill candidates exhausted: ${buildingTileCount} < ${targetBuildingTileCount}`);
  }
  return {
    ...initial,
    targetBuildingTileCount,
    generatedTileCount: buildingTileCount - initial.buildingTileCount,
    candidateBlockCount: blocks.length,
    selectedBlockCount,
    preservedAlleyTileCount,
    selectedBlockFillRatioMin: Number(selectedBlockFillRatioMin.toFixed(6)),
    selectedBlockFillRatioMax: Number(selectedBlockFillRatioMax.toFixed(6)),
  };
}

function withTile(entry, meta, metrics) {
  return {
    ...entry,
    contentLocale: 'ko',
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
          if (candidate[0] < 0 || candidate[1] < 0 || candidate[0] >= meta.grid.w || candidate[1] >= meta.grid.h) continue;
          if (available(candidate)) {
            snapped = candidate;
            break;
          }
        }
      }
    }
    if (!snapped) throw new Error(`Unable to separate marker ${entry.id}`);
    entry.tile = snapped;
    claimed.push(snapped);
  }
}

function normalizeCityTerrain(terrain, protectedEntries, mainStation, entrance, exitTiles, meta, city) {
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
  for (let y = exitTiles[0][1]; y <= entrance.y; y += 1) terrain[y * meta.grid.w + entrance.x] = CITY_TILE.ROAD;
  normalizeWalkableComponents(terrain, protectedEntries.map((entry) => entry.tile), mainStation.tile, meta, city);
  for (const entry of protectedEntries) ensureWalkableAnchor(terrain, entry.tile, meta);
}

export function buildKoreanCityGeo(city) {
  const config = CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown city: ${city}`);
  const snapshot = JSON.parse(fs.readFileSync(config.snapshot, 'utf8'));
  const metrics = projectionMetrics(config.bbox);
  const baseMeta = Object.freeze({
    city,
    bbox: config.bbox,
    grid: Object.freeze(metrics.grid),
    metersPerTile: METERS_PER_TILE,
    projection: 'webmercator',
    aspectCorrection: Number(metrics.correction.toFixed(12)),
    contentLocale: 'ko',
    schema: Object.freeze({ nameField: 'nameKo', localeSlots: 'central-lookup-expandable' }),
    source: Object.freeze({ ...snapshot.source }),
  });
  if (JSON.stringify(snapshot.bbox) !== JSON.stringify(baseMeta.bbox) || snapshot.grid.w !== baseMeta.grid.w || snapshot.grid.h !== baseMeta.grid.h) {
    throw new Error(`${city} OSM snapshot projection contract mismatch`);
  }
  const pois = config.pois.map((entry) => withTile(entry, baseMeta, metrics));
  const stations = config.stations.map((entry) => withTile(entry, baseMeta, metrics));
  separateMarkerTiles([...pois, ...stations], baseMeta);
  const mainStation = stations.find((entry) => entry.id === config.mainStationId);
  const entrance = { x: mainStation.tile[0], y: mainStation.tile[1], facing: 'down' };
  const exitTiles = [[entrance.x, entrance.y - 10], [entrance.x, entrance.y - 9]];
  const terrain = new Uint8Array(baseMeta.grid.w * baseMeta.grid.h).fill(CITY_TILE.SIDEWALK);
  const masks = applySnapshotMasks(terrain, snapshot, baseMeta);
  const protectedEntries = [...pois, ...stations];
  const baselineTerrain = terrain.slice();
  normalizeCityTerrain(baselineTerrain, protectedEntries, mainStation, entrance, exitTiles, baseMeta, city);
  const initialBuildingStats = terrainBuildingStats(terrain);
  const baselineBuildingStats = terrainBuildingStats(baselineTerrain);
  const baselineNormalizationBuildingTiles = baselineBuildingStats.buildingTileCount - initialBuildingStats.buildingTileCount;
  const finalTargetBuildingTileCount = Math.ceil(
    baselineBuildingStats.landTileCount * BUILDING_TEXTURE_CONTRACT.targetLandRatio,
  );
  const preNormalizationTargetBuildingTileCount = Math.max(
    initialBuildingStats.buildingTileCount,
    finalTargetBuildingTileCount - baselineNormalizationBuildingTiles,
  );
  const buildingTexture = augmentBuildingTexture(
    terrain, masks, baseMeta, city, preNormalizationTargetBuildingTileCount,
  );
  normalizeCityTerrain(terrain, protectedEntries, mainStation, entrance, exitTiles, baseMeta, city);
  const bridges = normalizeKoreanBridgeTerrain(terrain, baseMeta);
  terrain.set(bridges.terrain);
  const finalBuildingStats = terrainBuildingStats(terrain);
  if (finalBuildingStats.landBuildingRatio < 0.09 || finalBuildingStats.landBuildingRatio > 0.11) {
    throw new Error(`${city} final land/building ratio outside 10%±1pp gate: ${finalBuildingStats.landBuildingRatio}`);
  }
  const meta = Object.freeze({
    ...baseMeta,
    bridgeNormalization: bridges.report,
    buildingTexture: Object.freeze({
      ...BUILDING_TEXTURE_CONTRACT,
      seed: `${BUILDING_TEXTURE_CONTRACT.seedNamespace}:${city}`,
      initialLandBuildingRatio: buildingTexture.landBuildingRatio,
      baselineNormalizationBuildingTiles,
      finalTargetBuildingTileCount,
      preNormalizationTargetBuildingTileCount: buildingTexture.targetBuildingTileCount,
      generatedTileCount: buildingTexture.generatedTileCount,
      candidateBlockCount: buildingTexture.candidateBlockCount,
      selectedBlockCount: buildingTexture.selectedBlockCount,
      preservedAlleyTileCount: buildingTexture.preservedAlleyTileCount,
      selectedBlockFillRatioMin: buildingTexture.selectedBlockFillRatioMin,
      selectedBlockFillRatioMax: buildingTexture.selectedBlockFillRatioMax,
      finalLandTileCount: finalBuildingStats.landTileCount,
      finalBuildingTileCount: finalBuildingStats.buildingTileCount,
      finalLandBuildingRatio: finalBuildingStats.landBuildingRatio,
    }),
  });
  const railwayMask = decodeTerrainRle(snapshot.railwayRle, terrain.length);
  return {
    meta, terrain, pois, stations, entrance, exitTiles,
    railways: { mask: railwayMask, tileCount: railwayMask.reduce((sum, code) => sum + Number(Boolean(code)), 0) },
  };
}

function generatedModule(city, config, geo) {
  const terrainRuns = encodeTerrainRle(geo.terrain);
  const railwayRuns = encodeTerrainRle(geo.railways.mask);
  return `// Generated by scripts/build-korean-city-geo.mjs. Do not edit by hand.\n// Geometry: © OpenStreetMap contributors, ODbL 1.0 (snapshot 2026-07-16).\n// Locale schema: nameKo/contentLocale are exact keys; reading and additional locale slots may be appended without renaming.\n\nconst META = Object.freeze(${JSON.stringify(geo.meta, null, 2)});\nconst TERRAIN_RLE = ${JSON.stringify(terrainRuns)};\nconst RAILWAY_RLE = ${JSON.stringify(railwayRuns)};\n\nfunction decodeTerrain(runs, length) {\n  const terrain = new Uint8Array(length);\n  let offset = 0;\n  for (const [code, count] of runs) {\n    terrain.fill(code, offset, offset + count);\n    offset += count;\n  }\n  if (offset !== length) throw new Error(\`terrain RLE length mismatch: \${offset} !== \${length}\`);\n  return terrain;\n}\n\nconst LENGTH = META.grid.w * META.grid.h;\n\nexport const ${config.exportName} = Object.freeze({\n  meta: META,\n  terrain: decodeTerrain(TERRAIN_RLE, LENGTH),\n  pois: Object.freeze(${JSON.stringify(geo.pois, null, 2)}),\n  stations: Object.freeze(${JSON.stringify(geo.stations, null, 2)}),\n  entrance: Object.freeze(${JSON.stringify(geo.entrance)}),\n  exitTiles: Object.freeze(${JSON.stringify(geo.exitTiles)}),\n  railways: Object.freeze({\n    mask: decodeTerrain(RAILWAY_RLE, LENGTH),\n    tileCount: ${geo.railways.tileCount},\n  }),\n});\n`;
}

export function writeKoreanCityGeo(city) {
  const config = CITY_CONFIG[city];
  if (!config) throw new Error(`Unknown city: ${city}`);
  const geo = buildKoreanCityGeo(city);
  const outputPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), config.output);
  fs.writeFileSync(outputPath, generatedModule(city, config, geo));
  return {
    outputPath, grid: geo.meta.grid, cells: geo.terrain.length,
    terrainRuns: encodeTerrainRle(geo.terrain).length,
    railwayRuns: encodeTerrainRle(geo.railways.mask).length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cityIndex = process.argv.indexOf('--city');
  if (cityIndex < 0 || !process.argv[cityIndex + 1]) throw new Error('Usage: node scripts/build-korean-city-geo.mjs --city <busan|seoul>');
  console.log(JSON.stringify(writeKoreanCityGeo(process.argv[cityIndex + 1])));
}
