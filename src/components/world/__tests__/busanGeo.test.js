import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUSAN_GEO } from '../cities/busan.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import { buildKoreanCityGeo, decodeTerrainRle, encodeTerrainRle } from '../../../../scripts/build-korean-city-geo.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * BUSAN_GEO.meta.grid.w + x;
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/busan-osm-v21.json', import.meta.url),
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

describe('부산 실지형 데이터 계약', () => {
  it('20m bbox와 한국 로케일 스키마를 고정한다', () => {
    expect(BUSAN_GEO.meta).toMatchObject({
      city: 'busan', bbox: [128.89, 35.04, 129.18, 35.24], grid: { w: 1320, h: 1114 },
      metersPerTile: 20, projection: 'webmercator', contentLocale: 'ko',
      schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        method: 'deterministic-road-block-infill', version: 1, targetLandRatio: 0.1,
        seed: 'manabi-korean-city-buildings-v1:busan', generatedTileCount: 69_306,
        baselineNormalizationBuildingTiles: 1_534, finalTargetBuildingTileCount: 105_330,
        preNormalizationTargetBuildingTileCount: 103_796,
        finalLandTileCount: 1_053_296, finalBuildingTileCount: 105_369,
        finalLandBuildingRatio: 0.100037,
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
      [CITY_TILE.ROAD]: 108_765,
      [CITY_TILE.SIDEWALK]: 787_630,
      [CITY_TILE.CROSSWALK]: 1_305,
      [CITY_TILE.PLAZA]: 4,
      [CITY_TILE.PARK]: 28_152,
      [CITY_TILE.BRIDGE]: 18_063,
      [CITY_TILE.WATER]: 394_874,
      [CITY_TILE.BUILDING]: 105_369,
      [CITY_TILE.RIVER]: 22_310,
      [CITY_TILE.MOUNTAIN]: 4_008,
    });
    expect(BUSAN_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeGreaterThanOrEqual(0.09);
    expect(BUSAN_GEO.meta.buildingTexture.finalLandBuildingRatio).toBeLessThanOrEqual(0.11);
    expect(BUSAN_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(BUSAN_GEO.railways.mask).toHaveLength(BUSAN_GEO.terrain.length);
    expect(BUSAN_GEO.railways.tileCount).toBe(13_315);
    expect(isCityBlocked(CITY_TILE.MOUNTAIN)).toBe(true);
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
    expect(walkable).toBe(943_919);
    expect(reached).toBe(walkable);
  });
});

describe('부산 생성 결정성·오프라인 계약', () => {
  it('고정 Overpass 스냅샷 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.source).toEqual({
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: ['overpass.kumi.systems'],
      rawOverpassSha256: 'b304555161b5dfa29e1baa6f82a3acd6c10d9bad143a205e0f30f29030ad0333',
      buildingWays: 36_303, roadWays: 34_457, waterAreas: 202, riverWays: 285,
      parkAreas: 1_047, mountainAreas: 173, railwayWays: 855, coastlineWays: 123,
      crossingNodes: 2_186, crossingTiles: 2_186,
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'a09515f4eafb362991490dc1f5399aab5c4409115bf9e55190b4cc25a1de7f34',
      roadRle: 'c8b82e4532e73ffc8c408d09b841c959e4868cd648c0238dbbd7a951f11b1394',
      waterRle: '1bf72a30294d614bd9161e24d7d55aa14fd67b7e1467adcf8a57a3aa84de7cf4',
      riverRle: '77c6f5bd7647d163b0f8d2e7b7f4679decbd7fe7996b37c9b404ca05eacaa9eb',
      parkRle: '4ca7579627175322cfe6307c448d12b9f0bf5359cf0ca19b7efca15526c75680',
      mountainRle: '2728b28e4749cf84a0f5a59e5655380e6b68cda98ecb83066790273a248722ef',
      railwayRle: 'caee7f5c6fe4d57d576e87ecdc4bbc094e4e2e5ace8641cffb92c51a8c385835',
    });
  });

  it('두 번 재생성한 결과와 커밋 산출물 해시가 같다', () => {
    const first = buildKoreanCityGeo('busan');
    const second = buildKoreanCityGeo('busan');
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(BUSAN_GEO.terrain));
    expect(terrainHash(first.terrain)).toBe('09b9aa8b35f38280301a64db0d91979e7e477a077d146d1685c6eadb558c2331');
    expect(terrainHash(first.railways.mask)).toBe('16fbb812507b2d62ab0f467ccac2659565bcc5c4185213508c140972dab9e020');
    expect(first.pois).toEqual(BUSAN_GEO.pois);
    expect(first.stations).toEqual(BUSAN_GEO.stations);
  }, 30_000);

  it('RLE 왕복이 전체 지형·철도를 보존하고 런타임 산출물은 오프라인이다', () => {
    const terrainRuns = encodeTerrainRle(BUSAN_GEO.terrain);
    const railwayRuns = encodeTerrainRle(BUSAN_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, BUSAN_GEO.terrain.length)).toEqual(BUSAN_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, BUSAN_GEO.railways.mask.length)).toEqual(BUSAN_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(166_060);
    expect(railwayRuns).toHaveLength(11_647);
    expect(fs.readFileSync(new URL('../cities/busan.geo.js', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
    expect(fs.readFileSync(new URL('../../../../scripts/build-korean-city-geo.mjs', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
  }, 60_000);
});
