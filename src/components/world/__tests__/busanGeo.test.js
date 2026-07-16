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
    haeundae: [730, 118], gwangalli: [540, 149], 'gwangan-bridge': [523, 183],
    jagalchi: [139, 464], 'gukje-market': [129, 439], gamcheon: [48, 458],
    'busan-tower': [147, 442], taejongdae: [394, 705], 'busan-port-intl': [183, 337],
  },
  stations: { busan: [183, 361], seomyeon: [270, 123], nampo: [153, 452], 'haeundae-station': [657, 90] },
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
      city: 'busan', bbox: [129.00, 35.04, 129.18, 35.18], grid: { w: 820, h: 780 },
      metersPerTile: 20, projection: 'webmercator', contentLocale: 'ko',
      schema: { nameField: 'nameKo', localeSlots: 'central-lookup-expandable' },
    });
    expect(BUSAN_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(BUSAN_GEO.terrain).toHaveLength(639_600);
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
      [CITY_TILE.ROAD]: 42_448,
      [CITY_TILE.SIDEWALK]: 260_422,
      [CITY_TILE.CROSSWALK]: 879,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 6_500,
      [CITY_TILE.BRIDGE]: 5_078,
      [CITY_TILE.WATER]: 303_911,
      [CITY_TILE.BUILDING]: 19_011,
      [CITY_TILE.RIVER]: 1_349,
    });
    expect(BUSAN_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(BUSAN_GEO.railways.mask).toHaveLength(BUSAN_GEO.terrain.length);
    expect(BUSAN_GEO.railways.tileCount).toBe(6_693);
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
    expect(walkable).toBe(315_329);
    expect(reached).toBe(walkable);
  });
});

describe('부산 생성 결정성·오프라인 계약', () => {
  it('고정 Overpass 스냅샷 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.source).toEqual({
      geometry: 'OpenStreetMap', license: 'ODbL 1.0', snapshot: '2026-07-16',
      providers: ['overpass.kumi.systems'],
      rawOverpassSha256: '3597636f30290c7220eaa3158ae5e87c14934d964bf19085f80bd1497bcfc222',
      buildingWays: 22_103, roadWays: 16_929, waterAreas: 37, riverWays: 47,
      parkAreas: 392, railwayWays: 620, coastlineWays: 85,
      crossingNodes: 1_370, crossingTiles: 1_370,
    });
    expect(SNAPSHOT.hashes).toEqual({
      buildingRle: 'acb5256c9bb80febd3072a68efebe9c7f52b6e12f5b5d3690078af682467b95a',
      roadRle: 'ac37836d93648bea31245fff7af13733cc1528ba6b4f27af076f7594be53c9be',
      waterRle: 'ee79419455f8d5e735505cd1ebe62e4a9470eff17c962ae733a024cb50850314',
      riverRle: '3df2daee53f7bb09c6758c9aa6fe147445459bab7642b1defd943b35665043a0',
      parkRle: 'c8d2277d6fdb7a254ee9a6e7d8554492fd2d0a111b9959fcbe79fb8dc43cfc85',
      railwayRle: '28ce17e592573f4980e6dca8243e0a3a1b73092d1a3d725c2aa6d585b596fa1e',
    });
  });

  it('두 번 재생성한 결과와 커밋 산출물 해시가 같다', () => {
    const first = buildKoreanCityGeo('busan');
    const second = buildKoreanCityGeo('busan');
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(BUSAN_GEO.terrain));
    expect(terrainHash(first.terrain)).toBe('54bd638f054836a9173b94707a75d72787322f0ecbe9e89fa7e11f9440858409');
    expect(terrainHash(first.railways.mask)).toBe('a84817e02187832373a01e9a5279f02b2f8c0bc42c5062e080859721ad47c0dd');
    expect(first.pois).toEqual(BUSAN_GEO.pois);
    expect(first.stations).toEqual(BUSAN_GEO.stations);
  });

  it('RLE 왕복이 전체 지형·철도를 보존하고 런타임 산출물은 오프라인이다', () => {
    const terrainRuns = encodeTerrainRle(BUSAN_GEO.terrain);
    const railwayRuns = encodeTerrainRle(BUSAN_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, BUSAN_GEO.terrain.length)).toEqual(BUSAN_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, BUSAN_GEO.railways.mask.length)).toEqual(BUSAN_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(46_030);
    expect(railwayRuns).toHaveLength(4_913);
    expect(fs.readFileSync(new URL('../cities/busan.geo.js', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
    expect(fs.readFileSync(new URL('../../../../scripts/build-korean-city-geo.mjs', import.meta.url), 'utf8')).not.toMatch(/\bfetch\s*\(/);
  }, 20_000);
});
