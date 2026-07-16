import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SEOUL_GEO } from '../cities/seoul.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import { buildKoreanCityGeo, decodeTerrainRle, encodeTerrainRle } from '../../../../scripts/build-korean-city-geo.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * SEOUL_GEO.meta.grid.w + x;
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/seoul-osm-v21.json', import.meta.url),
  'utf8',
));

const FIXED_TILES = Object.freeze({
  pois: {
    gyeongbokgung: [825, 615], gwanghwamun: [824, 635], 'n-seoul-tower': [874, 773],
    myeongdong: [860, 703], sungnyemun: [818, 723], bukchon: [860, 598], insadong: [863, 644],
    cheonggyecheon: [850, 671], ddp: [968, 685], heunginjimun: [967, 661], hongdae: [589, 739],
    'yeouido-63': [663, 947], coex: [1185, 993], 'lotte-world-tower': [1378, 987],
    changdeokgung: [886, 616], jongmyo: [900, 641], seonjeongneung: [1142, 1009],
    'gimpo-airport': [2, 732], 'seoul-nat-univ': [714, 1280], 'amsa-dong': [1500, 743],
    'seoul-forest': [1091, 811], itaewon: [902, 866],
  },
  stations: {
    seoul: [797, 753], 'city-hall': [829, 692], jonggak: [852, 666], dongdaemun: [964, 658],
    'hongik-university': [591, 742], yeouido: [593, 936], gangnam: [1048, 1069],
    samseong: [1204, 1009], jamsil: [1367, 984],
  },
});

function reachableFrom(terrain, startTile) {
  const { w, h } = SEOUL_GEO.meta.grid;
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

describe('서울 실지형 데이터 계약', () => {
  it('서울시 전역급 20m bbox와 한국 로케일 스키마를 고정한다', () => {
    expect(SEOUL_GEO.meta).toMatchObject({
      city: 'seoul', bbox: [126.79, 37.43, 127.18, 37.69], grid: { w: 1721, h: 1448 },
      metersPerTile: 20, projection: 'webmercator', contentLocale: 'ko',
      schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        method: 'deterministic-road-block-infill', version: 2, targetLandRatio: 0.1,
        blockFillRatioMin: 0.7, blockFillRatioMax: 0.85,
        blockMinTiles: 12, blockMaxTiles: 2_000,
        minorRoadClasses: ['service', 'footway', 'path', 'steps', 'cycleway', 'track'],
        seed: 'manabi-korean-city-buildings-v2:seoul', generatedTileCount: 28_732,
        baselineNormalizationBuildingTiles: 44_602, finalTargetBuildingTileCount: 237_236,
        preNormalizationTargetBuildingTileCount: 192_634,
        candidateBlockCount: 9_009, selectedBlockCount: 964, preservedAlleyTileCount: 3_172,
        selectedBlockFillRatioMin: 0.7, selectedBlockFillRatioMax: 0.85,
        finalLandTileCount: 2_372_357, finalBuildingTileCount: 237_839,
        finalLandBuildingRatio: 0.100254,
      },
    });
    expect(SEOUL_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(SEOUL_GEO.terrain).toHaveLength(2_492_008);
  });

  it('POI 22개·역 9개의 고정 tile과 nameKo exact-key를 보존한다', () => {
    expect(SEOUL_GEO.pois).toHaveLength(22);
    expect(SEOUL_GEO.stations).toHaveLength(9);
    for (const [id, tile] of Object.entries(FIXED_TILES.pois)) {
      const entry = byId(SEOUL_GEO.pois, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameKo, id).toBe('string');
      expect(entry, id).not.toHaveProperty('yomi');
      expect(entry?.contentLocale, id).toBe('ko');
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      const entry = byId(SEOUL_GEO.stations, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameKo, id).toBe('string');
      expect(entry, id).not.toHaveProperty('yomi');
      expect(entry?.contentLocale, id).toBe('ko');
    }
  });

  it('도심·한강·산지와 철도 마스크를 고정한다', () => {
    const counts = new Map();
    for (const code of SEOUL_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({
      [CITY_TILE.ROAD]: 279_974,
      [CITY_TILE.SIDEWALK]: 1_189_182,
      [CITY_TILE.CROSSWALK]: 8_464,
      [CITY_TILE.PLAZA]: 14,
      [CITY_TILE.PARK]: 58_099,
      [CITY_TILE.BRIDGE]: 57_800,
      [CITY_TILE.WATER]: 77_752,
      [CITY_TILE.BUILDING]: 237_839,
      [CITY_TILE.RIVER]: 41_899,
      [CITY_TILE.MOUNTAIN]: 540_985,
    });
    expect(SEOUL_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeGreaterThanOrEqual(0.09);
    expect(SEOUL_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeLessThanOrEqual(0.11);
    expect(SEOUL_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(SEOUL_GEO.railways.mask).toHaveLength(SEOUL_GEO.terrain.length);
    expect(SEOUL_GEO.railways.tileCount).toBe(50_983);
  });

  it('모든 보행 타일과 POI·역이 서울역 기준 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(SEOUL_GEO.terrain, byId(SEOUL_GEO.stations, 'seoul').tile);
    for (const entry of [...SEOUL_GEO.pois, ...SEOUL_GEO.stations]) {
      const index = tileIndex(entry.tile);
      expect(isCityBlocked(SEOUL_GEO.terrain[index]), entry.id).toBe(false);
      expect(seen[index], entry.id).toBe(1);
    }
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < SEOUL_GEO.terrain.length; index += 1) {
      if (isCityBlocked(SEOUL_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(walkable).toBe(1_593_533);
    expect(reached).toBe(walkable);
  });
});

describe('서울 생성 결정성·오프라인 계약', () => {
  it('분할 Overpass 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.source).toEqual({
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: ['overpass-api.de'],
      rawOverpassSha256: '21194f18f97a787578203222ac2f3bbd30e07e5ca5ce2a90be8acc2cdd79a1e5',
      partitionCount: 16, queryCount: 48, mergeStrategy: 'type-id-largest-geometry-v1',
      buildingWays: 218_847, roadWays: 163_661, waterAreas: 611, riverWays: 728,
      parkAreas: 4_855, mountainAreas: 2_174, railwayWays: 3_593, coastlineWays: 0,
      crossingNodes: 14_219, crossingTiles: 14_219,
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: '01856e33dcb6446455ffc41b1d0b4f5c15ea11f5c72909618ac6686576261a39',
      roadRle: 'f41769dcb81994666a7fc4ee962149ab801a67760e7720e66b4bf4a10a735fb6',
      waterRle: '0d59ba26c7331c1c16d2f9dbc018f980649447c7478cc531cc200741942401c1',
      riverRle: '0a0cd25c0196bb1365a1fb8a238fb4879278b519a893da287766f36410a49d9d',
      parkRle: '3baf50195fe54d7f4fe5167d8da8c6ad1e80814cfb963dfb594423a86b76149b',
      mountainRle: 'c8462b2caf4adde6340b61b9d449c8b7583b0f7cd8c459979c9272a94641274f',
      railwayRle: '47a906573d8ee6efb01cc85e27fc75b08761b501f31c07a86e80a4c4c55baa9f',
    });
  });

  it('두 번 재생성한 결과와 커밋 산출물 해시가 같다', () => {
    const first = buildKoreanCityGeo('seoul');
    const second = buildKoreanCityGeo('seoul');
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(SEOUL_GEO.terrain));
    expect(terrainHash(first.terrain)).toBe('4a79921607dc1adf4258c538957814ffb1448ed3d7395ae4a1d4cd98aaaa72e3');
    expect(terrainHash(first.railways.mask)).toBe('5a252fa3aeee8197edce6b9658807a08eb814750434f632d5977353bded6779a');
    expect(first.pois).toEqual(SEOUL_GEO.pois);
    expect(first.stations).toEqual(SEOUL_GEO.stations);
  }, 120_000);

  it('RLE 왕복이 전체 지형·철도를 보존하고 런타임 산출물은 오프라인이다', () => {
    const terrainRuns = encodeTerrainRle(SEOUL_GEO.terrain);
    const railwayRuns = encodeTerrainRle(SEOUL_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, SEOUL_GEO.terrain.length)).toEqual(SEOUL_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, SEOUL_GEO.railways.mask.length)).toEqual(SEOUL_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(492_839);
    expect(railwayRuns).toHaveLength(41_629);
    expect(fs.readFileSync(new URL('../cities/seoul.geo.js', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
  }, 30_000);
});
