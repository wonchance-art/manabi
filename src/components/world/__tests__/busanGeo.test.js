import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUSAN_GEO } from '../cities/busan.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import {
  buildKoreanCityGeo,
  decodeTerrainRle,
  encodeTerrainRle,
  normalizeKoreanBridgeTerrain,
} from '../../../../scripts/build-korean-city-geo.mjs';
import { buildSnapshot, isMountainTags, roadStyle } from '../../../../scripts/build-korean-city-osm-snapshot.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * BUSAN_GEO.meta.grid.w + x;
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/busan-osm-v21.json', import.meta.url),
  'utf8',
));
const OSAKA_SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/osaka-osm-v21.json', import.meta.url),
  'utf8',
));

const FIXED_TILES = Object.freeze({
  pois: {
    haeundae: [1230, 452], gwangalli: [1040, 483], 'gwangan-bridge': [1024, 517],
    jagalchi: [640, 798], 'gukje-market': [629, 773], gamcheon: [548, 792],
    'busan-tower': [648, 776], taejongdae: [894, 1039], 'busan-port-intl': [684, 671],
    dadaepo: [343, 1075], eulsukdo: [250, 779], 'dongnae-eupseong': [887, 167],
    'pnu-street': [883, 55],
  },
  stations: {
    busan: [684, 695], seomyeon: [770, 457], nampo: [654, 786], 'haeundae-station': [1157, 425],
    'dongnae-station': [860, 195], 'pnu-station': [910, 58], 'centum-city-station': [1101, 395],
  },
});

function reachableFrom(terrain, startTile) {
  const { w, h } = BUSAN_GEO.meta.grid;
  const seen = new Uint8Array(terrain.length);
  const queue = new Int32Array(terrain.length);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
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
      if (seen[next] || isCityBlocked(terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function visibleRoadRatio(snapshot, [centerX, centerY], size) {
  const length = snapshot.grid.w * snapshot.grid.h;
  const road = decodeTerrainRle(snapshot.roadRle, length);
  const water = decodeTerrainRle(snapshot.waterRle, length);
  const river = decodeTerrainRle(snapshot.riverRle, length);
  const startX = Math.max(0, Math.floor(centerX - size / 2));
  const startY = Math.max(0, Math.floor(centerY - size / 2));
  let roadTiles = 0;
  let landTiles = 0;
  for (let y = startY; y < Math.min(snapshot.grid.h, startY + size); y += 1) {
    for (let x = startX; x < Math.min(snapshot.grid.w, startX + size); x += 1) {
      const index = y * snapshot.grid.w + x;
      if (road[index] >= 2) roadTiles += 1;
      if (!water[index] && !river[index]) landTiles += 1;
    }
  }
  return roadTiles / landTiles;
}

function waterWidthAtLatitude(terrain, latitude, [minLongitude, maxLongitude]) {
  const { bbox, grid, metersPerTile, aspectCorrection } = BUSAN_GEO.meta;
  const earthRadius = 6378137;
  const radians = Math.PI / 180;
  const mercator = (longitude, lat) => ({
    x: earthRadius * longitude * radians,
    y: earthRadius * Math.log(Math.tan(Math.PI / 4 + lat * radians / 2)),
  });
  const southWest = mercator(bbox[0], bbox[1]);
  const northEast = mercator(bbox[2], bbox[3]);
  const tile = (longitude, lat) => [
    Math.max(0, Math.min(grid.w - 1, Math.floor(((mercator(longitude, lat).x - southWest.x) * aspectCorrection) / metersPerTile))),
    Math.max(0, Math.min(grid.h - 1, Math.floor(((northEast.y - mercator(longitude, lat).y) * aspectCorrection) / metersPerTile))),
  ];
  const [startX, y] = tile(minLongitude, latitude);
  const [endX] = tile(maxLongitude, latitude);
  let waterTiles = 0;
  for (let x = startX; x <= endX; x += 1) {
    const code = terrain[y * grid.w + x];
    if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) waterTiles += 1;
  }
  return waterTiles * metersPerTile;
}

describe('부산 실지형 데이터 계약', () => {
  it('한국식 교량 3분류는 횡단 회랑을 도로로, 고립 조각을 수면으로 흡수한다', () => {
    const meta = { grid: { w: 7, h: 5 } };
    const terrain = new Uint8Array(35).fill(CITY_TILE.WATER);
    terrain[2 * 7] = CITY_TILE.ROAD;
    terrain[2 * 7 + 1] = CITY_TILE.BRIDGE;
    terrain[2 * 7 + 2] = CITY_TILE.BRIDGE;
    terrain[2 * 7 + 3] = CITY_TILE.BRIDGE;
    terrain[2 * 7 + 4] = CITY_TILE.BRIDGE;
    terrain[2 * 7 + 5] = CITY_TILE.BRIDGE;
    terrain[2 * 7 + 6] = CITY_TILE.ROAD;
    terrain[3 * 7 + 3] = CITY_TILE.RIVER;
    terrain[4 * 7 + 3] = CITY_TILE.BRIDGE;

    const normalized = normalizeKoreanBridgeTerrain(terrain, meta);
    expect(Array.from(normalized.terrain.slice(2 * 7 + 1, 2 * 7 + 6)))
      .toEqual(Array(5).fill(CITY_TILE.ROAD));
    expect(normalized.terrain[4 * 7 + 3]).toBe(CITY_TILE.RIVER);
    expect(normalized.report).toMatchObject({
      method: 'korea-bridge-three-way-v1',
      sourceBridgeTileCount: 6,
      roadTileCount: 5,
      absorbedRiverTileCount: 1,
      finalBridgeTileCount: 0,
    });
  });

  it('20m bbox와 한국 로케일 스키마를 고정한다', () => {
    expect(BUSAN_GEO.meta).toMatchObject({
      city: 'busan', bbox: [128.89, 35.04, 129.18, 35.24], grid: { w: 1320, h: 1114 },
      metersPerTile: 20, projection: 'webmercator', contentLocale: 'ko',
      schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' },
      bridgeNormalization: {
        method: 'korea-bridge-three-way-v1',
        roadRule: 'two-land-contact-components-or-road-contact',
        absorptionRule: 'river-before-water',
        sourceBridgeTileCount: 4_817,
        componentCount: 469,
        roadComponentCount: 459,
        absorbedComponentCount: 10,
        roadTileCount: 4_796,
        absorbedWaterTileCount: 13,
        absorbedRiverTileCount: 8,
        finalBridgeTileCount: 0,
      },
      buildingTexture: {
        method: 'deterministic-road-block-infill', version: 2, targetLandRatio: 0.1,
        blockFillRatioMin: 0.7, blockFillRatioMax: 0.85,
        blockMinTiles: 12, blockMaxTiles: 2_000,
        minorRoadClasses: ['service', 'footway', 'path', 'steps', 'cycleway', 'track'],
        seed: 'manabi-korean-city-buildings-v2:busan', generatedTileCount: 51_834,
        baselineNormalizationBuildingTiles: 25_034, finalTargetBuildingTileCount: 103_441,
        preNormalizationTargetBuildingTileCount: 78_407,
        candidateBlockCount: 5_476, selectedBlockCount: 1_479, preservedAlleyTileCount: 5_835,
        selectedBlockFillRatioMin: 0.7, selectedBlockFillRatioMax: 0.849462,
        finalLandTileCount: 1_034_389, finalBuildingTileCount: 104_287,
        finalLandBuildingRatio: 0.10082,
      },
    });
    expect(BUSAN_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(BUSAN_GEO.terrain).toHaveLength(1_470_480);
  });

  it('POI·역의 고정 tile과 nameKo exact-key를 보존한다', () => {
    for (const [id, tile] of Object.entries(FIXED_TILES.pois)) {
      const entry = byId(BUSAN_GEO.pois, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameKo, id).toBe('string');
      expect(entry, id).not.toHaveProperty('yomi');
      expect(entry?.contentLocale, id).toBe('ko');
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      const entry = byId(BUSAN_GEO.stations, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameKo, id).toBe('string');
      expect(entry, id).not.toHaveProperty('yomi');
      expect(entry?.contentLocale, id).toBe('ko');
    }
  });

  it('항만·해안·도심 지형과 철도 마스크를 고정한다', () => {
    const counts = new Map();
    for (const code of BUSAN_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({
      [CITY_TILE.ROAD]: 274_496,
      [CITY_TILE.SIDEWALK]: 379_008,
      [CITY_TILE.CROSSWALK]: 2_040,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 29_963,
      [CITY_TILE.WATER]: 420_247,
      [CITY_TILE.BUILDING]: 104_287,
      [CITY_TILE.RIVER]: 15_844,
      [CITY_TILE.MOUNTAIN]: 244_593,
    });
    expect(counts.get(CITY_TILE.BRIDGE) || 0).toBe(0);
    expect(BUSAN_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeGreaterThanOrEqual(0.09);
    expect(BUSAN_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeLessThanOrEqual(0.11);
    const landTiles = BUSAN_GEO.terrain.length
      - counts.get(CITY_TILE.WATER) - counts.get(CITY_TILE.RIVER);
    const greenRatio = (counts.get(CITY_TILE.MOUNTAIN) + counts.get(CITY_TILE.PARK)) / landTiles;
    expect(greenRatio).toBeCloseTo(0.265428, 6);
    expect(greenRatio).toBeGreaterThanOrEqual(0.20);
    expect(BUSAN_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(BUSAN_GEO.railways.mask).toHaveLength(BUSAN_GEO.terrain.length);
    expect(BUSAN_GEO.railways.tileCount).toBe(13_315);
    expect(isCityBlocked(CITY_TILE.MOUNTAIN)).toBe(true);
  });

  it('주거·서비스·보행 이면도로를 폐블록 경계에 포함한다', () => {
    expect(roadStyle('tertiary')).toEqual({ radius: 1, value: 2 });
    for (const highway of ['residential', 'living_street', 'unclassified']) {
      expect(roadStyle(highway), highway).toEqual({ radius: 0, value: 2 });
    }
    expect(roadStyle('service')).toEqual({ radius: 0, value: 2 });
    for (const highway of ['footway', 'path', 'steps', 'cycleway', 'track']) {
      expect(roadStyle(highway), highway).toEqual({ radius: 0, value: 1 });
    }
  });

  it('수면 relation member를 고정 way geometry로 복원하고 실제 교량만 별도 표시한다', () => {
    const relationSnapshot = buildSnapshot('busan', JSON.stringify({
      elements: [
        {
          type: 'way', id: 10, geometry: [
            { lat: 35.10, lon: 129.00 }, { lat: 35.10, lon: 129.01 },
            { lat: 35.11, lon: 129.01 }, { lat: 35.11, lon: 129.00 }, { lat: 35.10, lon: 129.00 },
          ],
        },
        {
          type: 'relation', id: 20, tags: { natural: 'water', water: 'river', type: 'multipolygon' },
          members: [{ type: 'way', ref: 10, role: 'outer' }],
        },
        {
          type: 'way', id: 30, tags: { highway: 'primary', bridge: 'yes' }, geometry: [
            { lat: 35.095, lon: 129.005 }, { lat: 35.115, lon: 129.005 },
          ],
        },
        {
          type: 'way', id: 40, tags: { waterway: 'stream', tunnel: 'culvert' }, geometry: [
            { lat: 35.095, lon: 129.006 }, { lat: 35.115, lon: 129.006 },
          ],
        },
      ],
    }));
    expect(relationSnapshot.source).toMatchObject({
      waterAreas: 1, bridgeWays: 1, excludedCoveredWaterways: 1, riverWays: 0,
    });
    expect(decodeTerrainRle(
      relationSnapshot.waterRle,
      relationSnapshot.grid.w * relationSnapshot.grid.h,
    ).some(Boolean)).toBe(true);
    expect(decodeTerrainRle(
      relationSnapshot.roadRle,
      relationSnapshot.grid.w * relationSnapshot.grid.h,
    ).includes(3)).toBe(true);
  });

  it('산림·잡목·초지 태그와 relation geometry를 산지 마스크에 포함한다', () => {
    for (const tags of [
      { landuse: 'forest' }, { natural: 'wood' }, { natural: 'scrub' },
      { natural: 'heath' }, { natural: 'grassland' }, { landcover: 'trees' },
    ]) expect(isMountainTags(tags), JSON.stringify(tags)).toBe(true);
    expect(isMountainTags({ landuse: 'residential' })).toBe(false);

    const relationSnapshot = buildSnapshot('busan', JSON.stringify({
      elements: [{
        type: 'relation', id: 1, tags: { natural: 'wood', type: 'multipolygon' },
        members: [
          { type: 'way', ref: 1, role: 'outer', geometry: [
            { lat: 35.10, lon: 129.00 }, { lat: 35.10, lon: 129.01 }, { lat: 35.11, lon: 129.01 },
          ] },
          { type: 'way', ref: 2, role: 'outer', geometry: [
            { lat: 35.11, lon: 129.01 }, { lat: 35.11, lon: 129.00 }, { lat: 35.10, lon: 129.00 },
          ] },
        ],
      }],
    }));
    expect(relationSnapshot.source).toMatchObject({
      mountainAreas: 1, mountainRelations: 1, mountainRelationsWithGeometry: 1,
    });
    const relationMask = decodeTerrainRle(
      relationSnapshot.mountainRle,
      relationSnapshot.grid.w * relationSnapshot.grid.h,
    );
    expect(relationMask.some(Boolean)).toBe(true);

    const length = SNAPSHOT.grid.w * SNAPSHOT.grid.h;
    const mountainMask = decodeTerrainRle(SNAPSHOT.mountainRle, length);
    const roadMask = decodeTerrainRle(SNAPSHOT.roadRle, length);
    let mountainTrailTiles = 0;
    for (let index = 0; index < length; index += 1) {
      if (mountainMask[index] && roadMask[index] === 1) mountainTrailTiles += 1;
    }
    expect(SNAPSHOT.source.roadWaysByClass).toMatchObject({ path: 3_031, track: 619 });
    expect(mountainTrailTiles).toBe(38_163);
  });

  it('남포 4km 도심 크롭의 좁은 가시 도로 비율을 과도하지 않은 범위로 고정한다', () => {
    const busanRatio = visibleRoadRatio(SNAPSHOT, [650, 780], 200);
    const osakaRatio = visibleRoadRatio(OSAKA_SNAPSHOT, [414, 182], 200);
    expect(busanRatio).toBeCloseTo(0.488853, 6);
    expect(osakaRatio).toBeCloseTo(0.648558, 6);
    expect(busanRatio).toBeGreaterThanOrEqual(0.45);
    expect(busanRatio).toBeLessThanOrEqual(0.60);
    expect(busanRatio).toBeLessThan(osakaRatio);
  });

  it('낙동강 하구 단면과 온천천 연속 수면을 보존한다', () => {
    expect(waterWidthAtLatitude(BUSAN_GEO.terrain, 35.10, [128.89, 128.97])).toBeGreaterThanOrEqual(1_200);
    expect(SNAPSHOT.source.hydrologyQuality).toEqual({
      name: '온천천', sampleCount: 105, coveredSamples: 84, coverage: 0.8,
    });
    expect(SNAPSHOT.source.hydrologyQuality.coverage).toBeGreaterThanOrEqual(0.8);
  });

  it('모든 보행 타일과 POI·역이 부산역 기준 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(BUSAN_GEO.terrain, byId(BUSAN_GEO.stations, 'busan').tile);
    for (const entry of [...BUSAN_GEO.pois, ...BUSAN_GEO.stations]) {
      const index = tileIndex(entry.tile);
      expect(isCityBlocked(BUSAN_GEO.terrain[index]), entry.id).toBe(false);
      expect(seen[index], entry.id).toBe(1);
      const [x, y] = entry.tile;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < BUSAN_GEO.meta.grid.w && ny < BUSAN_GEO.meta.grid.h
          && !isCityBlocked(BUSAN_GEO.terrain[ny * BUSAN_GEO.meta.grid.w + nx]);
      }), entry.id).toBe(true);
    }
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < BUSAN_GEO.terrain.length; index += 1) {
      if (isCityBlocked(BUSAN_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(walkable).toBe(685_509);
    expect(reached).toBe(walkable);
  });
});

describe('부산 생성 결정성·오프라인 계약', () => {
  it('고정 Overpass 스냅샷 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.version).toBe(2);
    expect(SNAPSHOT.source).toMatchObject({
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: ['overpass-api.de', 'overpass.kumi.systems'],
      rawOverpassSha256: '906ad163b0210ffee45a65589289103b08647cb1729f2d42e5135f48c152e7b3',
      roadSelection: 'all-highway-tagged-ways',
      roadWaysByClass: {
        residential: 9_116, service: 9_178, unclassified: 577,
        living_street: 435, footway: 4_584,
      },
      buildingWays: 36_303, roadWays: 34_457, waterAreas: 202, riverWays: 211,
      mountainSelection: 'landuse=forest|natural=wood,scrub,heath,grassland|landcover=trees',
      mountainAreasByClass: {
        'landuse=forest': 167, 'natural=grassland': 49, 'natural=heath': 5,
        'natural=scrub': 29, 'natural=wood': 216,
      },
      mountainRelations: 41, mountainRelationsWithGeometry: 41,
      parkAreas: 1_047, mountainAreas: 466, railwayWays: 855, coastlineWays: 123,
      bridgeWays: 1_376, excludedCoveredWaterways: 74,
      crossingNodes: 2_186, crossingTiles: 2_186,
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'a09515f4eafb362991490dc1f5399aab5c4409115bf9e55190b4cc25a1de7f34',
      roadRle: 'a0eff03597beb02a475c5ffbe5260dcc8b03f6bdbad229d1c5ccd483b288a814',
      waterRle: 'b01f333fcf3b60d335e74589aab35c39f7abdbaf7d6a8ab33c76479f94ea174f',
      riverRle: '2295b83d4048793caea768430d309e2f375546bf76b29da35f80f754fe54d2bb',
      parkRle: '1a00655de042940268d6c38b7323db2fca198805d6c0154215fd6f065f340ccd',
      mountainRle: '9b486d4afedc3cb858e709a11e25b8b272da29d70fd3d62768138593518daa80',
      railwayRle: 'caee7f5c6fe4d57d576e87ecdc4bbc094e4e2e5ace8641cffb92c51a8c385835',
    });
  });

  it('두 번 재생성한 결과와 커밋 산출물 해시가 같다', () => {
    const first = buildKoreanCityGeo('busan');
    const second = buildKoreanCityGeo('busan');
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(BUSAN_GEO.terrain));
    expect(terrainHash(first.terrain)).toBe('d42cd6c769e9a01de4f90c0c31dfcbe386d6d57b4b56b358be7e06cb4bc5fe59');
    expect(terrainHash(first.railways.mask)).toBe('16fbb812507b2d62ab0f467ccac2659565bcc5c4185213508c140972dab9e020');
    expect(first.pois).toEqual(BUSAN_GEO.pois);
    expect(first.stations).toEqual(BUSAN_GEO.stations);
  }, 240_000);

  it('RLE 왕복이 전체 지형·철도를 보존하고 런타임 산출물은 오프라인이다', () => {
    const terrainRuns = encodeTerrainRle(BUSAN_GEO.terrain);
    const railwayRuns = encodeTerrainRle(BUSAN_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, BUSAN_GEO.terrain.length)).toEqual(BUSAN_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, BUSAN_GEO.railways.mask.length)).toEqual(BUSAN_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(275_995);
    expect(railwayRuns).toHaveLength(11_647);
    expect(fs.readFileSync(new URL('../cities/busan.geo.js', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
    expect(fs.readFileSync(new URL('../../../../scripts/build-korean-city-geo.mjs', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
  }, 60_000);
});
