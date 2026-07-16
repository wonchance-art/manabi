import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUSAN_GEO } from '../cities/busan.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import { buildKoreanCityGeo, decodeTerrainRle, encodeTerrainRle } from '../../../../scripts/build-korean-city-geo.mjs';
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

describe('부산 실지형 데이터 계약', () => {
  it('20m bbox와 한국 로케일 스키마를 고정한다', () => {
    expect(BUSAN_GEO.meta).toMatchObject({
      city: 'busan', bbox: [128.89, 35.04, 129.18, 35.24], grid: { w: 1320, h: 1114 },
      metersPerTile: 20, projection: 'webmercator', contentLocale: 'ko',
      schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        method: 'deterministic-road-block-infill', version: 2, targetLandRatio: 0.1,
        blockFillRatioMin: 0.7, blockFillRatioMax: 0.85,
        blockMinTiles: 12, blockMaxTiles: 2_000,
        minorRoadClasses: ['service', 'footway', 'path', 'steps', 'cycleway', 'track'],
        seed: 'manabi-korean-city-buildings-v2:busan', generatedTileCount: 61_488,
        baselineNormalizationBuildingTiles: 23_902, finalTargetBuildingTileCount: 105_334,
        preNormalizationTargetBuildingTileCount: 81_432,
        candidateBlockCount: 4_127, selectedBlockCount: 1_679, preservedAlleyTileCount: 6_542,
        selectedBlockFillRatioMin: 0.7, selectedBlockFillRatioMax: 0.85,
        finalLandTileCount: 1_053_329, finalBuildingTileCount: 106_181,
        finalLandBuildingRatio: 0.100805,
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
      [CITY_TILE.ROAD]: 354_319,
      [CITY_TILE.SIDEWALK]: 303_372,
      [CITY_TILE.CROSSWALK]: 2_003,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 28_179,
      [CITY_TILE.BRIDGE]: 17_919,
      [CITY_TILE.WATER]: 394_855,
      [CITY_TILE.BUILDING]: 106_181,
      [CITY_TILE.RIVER]: 22_296,
      [CITY_TILE.MOUNTAIN]: 241_354,
    });
    expect(BUSAN_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeGreaterThanOrEqual(0.09);
    expect(BUSAN_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeLessThanOrEqual(0.11);
    const landTiles = BUSAN_GEO.terrain.length
      - counts.get(CITY_TILE.WATER) - counts.get(CITY_TILE.RIVER);
    const greenRatio = (counts.get(CITY_TILE.MOUNTAIN) + counts.get(CITY_TILE.PARK)) / landTiles;
    expect(greenRatio).toBeCloseTo(0.255887, 6);
    expect(greenRatio).toBeGreaterThanOrEqual(0.20);
    expect(BUSAN_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(BUSAN_GEO.railways.mask).toHaveLength(BUSAN_GEO.terrain.length);
    expect(BUSAN_GEO.railways.tileCount).toBe(13_315);
    expect(isCityBlocked(CITY_TILE.MOUNTAIN)).toBe(true);
  });

  it('주거·서비스·보행 이면도로를 폐블록 경계에 포함한다', () => {
    for (const highway of ['tertiary', 'residential', 'living_street', 'unclassified']) {
      expect(roadStyle(highway), highway).toEqual({ radius: 1, value: 2 });
    }
    expect(roadStyle('service')).toEqual({ radius: 0, value: 2 });
    for (const highway of ['footway', 'path', 'steps', 'cycleway', 'track']) {
      expect(roadStyle(highway), highway).toEqual({ radius: 0, value: 1 });
    }
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
    expect(mountainTrailTiles).toBe(38_101);
  });

  it('남포 4km 도심 크롭의 가시 도로 비율이 오사카 도심과 5%p 이내다', () => {
    const busanRatio = visibleRoadRatio(SNAPSHOT, [650, 780], 200);
    const osakaRatio = visibleRoadRatio(OSAKA_SNAPSHOT, [414, 182], 200);
    expect(busanRatio).toBeCloseTo(0.625220, 6);
    expect(osakaRatio).toBeCloseTo(0.648558, 6);
    expect(Math.abs(busanRatio - osakaRatio)).toBeLessThanOrEqual(0.05);
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
    expect(walkable).toBe(705_794);
    expect(reached).toBe(walkable);
  });
});

describe('부산 생성 결정성·오프라인 계약', () => {
  it('고정 Overpass 스냅샷 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.version).toBe(2);
    expect(SNAPSHOT.source).toMatchObject({
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: ['overpass.kumi.systems'],
      rawOverpassSha256: '58a96ced058420b2986b7e7faa5e413c7ee85d3d66dd1605a8a9c499b7a01731',
      roadSelection: 'all-highway-tagged-ways',
      roadWaysByClass: {
        residential: 9_116, service: 9_178, unclassified: 577,
        living_street: 435, footway: 4_584,
      },
      buildingWays: 36_303, roadWays: 34_457, waterAreas: 202, riverWays: 285,
      mountainSelection: 'landuse=forest|natural=wood,scrub,heath,grassland|landcover=trees',
      mountainAreasByClass: {
        'landuse=forest': 167, 'natural=grassland': 49, 'natural=heath': 5,
        'natural=scrub': 29, 'natural=wood': 216,
      },
      mountainRelations: 41, mountainRelationsWithGeometry: 41,
      parkAreas: 1_047, mountainAreas: 466, railwayWays: 855, coastlineWays: 123,
      crossingNodes: 2_186, crossingTiles: 2_186,
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'a09515f4eafb362991490dc1f5399aab5c4409115bf9e55190b4cc25a1de7f34',
      roadRle: 'fcc400628f818c45c1c2bded91961b53c24c18e1fbe23761ae7606f3f16256a7',
      waterRle: '1bf72a30294d614bd9161e24d7d55aa14fd67b7e1467adcf8a57a3aa84de7cf4',
      riverRle: '77c6f5bd7647d163b0f8d2e7b7f4679decbd7fe7996b37c9b404ca05eacaa9eb',
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
    expect(terrainHash(first.terrain)).toBe('b135e574ba94956e64fb82108a57c4022bfcf19a48734e4b7bd355e1dc39d5da');
    expect(terrainHash(first.railways.mask)).toBe('16fbb812507b2d62ab0f467ccac2659565bcc5c4185213508c140972dab9e020');
    expect(first.pois).toEqual(BUSAN_GEO.pois);
    expect(first.stations).toEqual(BUSAN_GEO.stations);
  }, 120_000);

  it('RLE 왕복이 전체 지형·철도를 보존하고 런타임 산출물은 오프라인이다', () => {
    const terrainRuns = encodeTerrainRle(BUSAN_GEO.terrain);
    const railwayRuns = encodeTerrainRle(BUSAN_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, BUSAN_GEO.terrain.length)).toEqual(BUSAN_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, BUSAN_GEO.railways.mask.length)).toEqual(BUSAN_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(231_994);
    expect(railwayRuns).toHaveLength(11_647);
    expect(fs.readFileSync(new URL('../cities/busan.geo.js', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
    expect(fs.readFileSync(new URL('../../../../scripts/build-korean-city-geo.mjs', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
  }, 60_000);
});
