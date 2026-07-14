import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { OSAKA_GEO } from '../cities/osaka.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import {
  OSAKA_META,
  buildOsakaGeo,
  decodeTerrainRle,
  encodeTerrainRle,
  projectLatLonToTile,
  webMercatorMeters,
} from '../../../../scripts/build-osaka-geo.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * OSAKA_GEO.meta.grid.w + x;
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/osaka-osm-v21.json', import.meta.url),
  'utf8',
));

const EXPECTED_COUNTS = Object.freeze({
  [CITY_TILE.ROAD]: 194_627,
  [CITY_TILE.SIDEWALK]: 81_040,
  [CITY_TILE.CROSSWALK]: 9_776,
  [CITY_TILE.PLAZA]: 151,
  [CITY_TILE.PARK]: 9_743,
  [CITY_TILE.BRIDGE]: 9_326,
  [CITY_TILE.WATER]: 29_122,
  [CITY_TILE.BUILDING]: 57_315,
  [CITY_TILE.RIVER]: 37_088,
});

const FIXED_TILES = Object.freeze({
  pois: {
    'osaka-castle': [553, 265],
    ebisubashi: [440, 367],
    tsutenkaku: [463, 458],
    'kuromon-market': [466, 387],
    'osaka-aquarium': [111, 444],
    'nakanoshima-park': [469, 237],
    shitennoji: [505, 448],
  },
  stations: {
    'shin-osaka': [435, 8],
    osaka: [414, 182],
    fukushima: [374, 210],
    nishikujo: [280, 293],
    bentencho: [260, 360],
    taisho: [344, 387],
    'shin-imamiya': [435, 472],
    tennoji: [504, 487],
    tsuruhashi: [573, 387],
    morinomiya: [590, 303],
    kyobashi: [591, 216],
    sakuranomiya: [527, 167],
    temma: [491, 167],
  },
});

function reachableFrom(terrain, startTile) {
  const { w, h } = OSAKA_GEO.meta.grid;
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

describe('오사카 실지형 데이터 계약', () => {
  it('20m 고정 축척과 베이→신오사카 코어의 단일 격자를 고정한다', () => {
    expect(OSAKA_GEO.meta).toEqual(OSAKA_META);
    expect(OSAKA_GEO.meta.bbox).toEqual([135.405, 34.615, 135.545, 34.735]);
    expect(OSAKA_GEO.meta.grid).toEqual({ w: 641, h: 668 });
    expect(OSAKA_GEO.meta.metersPerTile).toBe(20);
    expect(OSAKA_GEO.meta.projection).toBe('webmercator');
    expect(OSAKA_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(OSAKA_GEO.terrain.length).toBe(428_188);
  });

  it('위경도 → 보정 Web Mercator 투영이 결정적이며 방향을 보존한다', () => {
    expect(webMercatorMeters(135.5, 34.7)).toEqual(webMercatorMeters(135.5, 34.7));
    expect(projectLatLonToTile(34.7, 135.5)).toEqual(projectLatLonToTile(34.7, 135.5));
    expect(projectLatLonToTile(34.72, 135.5)[1]).toBeLessThan(projectLatLonToTile(34.65, 135.5)[1]);
    expect(projectLatLonToTile(34.7, 135.44)[0]).toBeLessThan(projectLatLonToTile(34.7, 135.52)[0]);
  });

  it('모든 POI·역 tile은 위경도 투영값이며 마커끼리 3타일 이상 떨어진다', () => {
    const entries = [...OSAKA_GEO.pois, ...OSAKA_GEO.stations];
    for (const entry of entries) {
      expect(entry.tile, entry.id).toEqual(projectLatLonToTile(entry.lat, entry.lon));
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(3);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(3);
      expect(entry.tile[0], entry.id).toBeLessThan(OSAKA_GEO.meta.grid.w - 3);
      expect(entry.tile[1], entry.id).toBeLessThan(OSAKA_GEO.meta.grid.h - 3);
    }
    for (let first = 0; first < entries.length; first += 1) {
      for (let second = first + 1; second < entries.length; second += 1) {
        const dx = Math.abs(entries[first].tile[0] - entries[second].tile[0]);
        const dy = Math.abs(entries[first].tile[1] - entries[second].tile[1]);
        expect(Math.max(dx, dy), `${entries[first].id}/${entries[second].id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('Claude 배선용 POI·역 tile 좌표를 고정한다', () => {
    for (const [id, tile] of Object.entries(FIXED_TILES.pois)) {
      expect(byId(OSAKA_GEO.pois, id)?.tile, id).toEqual(tile);
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      expect(byId(OSAKA_GEO.stations, id)?.tile, id).toEqual(tile);
    }
  });
});

describe('오사카 지형 충실도·도시 구조·철도', () => {
  it('오사카만→도심→신오사카와 환경선 주요 지점의 상대 배치를 보존한다', () => {
    const aquarium = byId(OSAKA_GEO.pois, 'osaka-aquarium');
    const ebisubashi = byId(OSAKA_GEO.pois, 'ebisubashi');
    const castle = byId(OSAKA_GEO.pois, 'osaka-castle');
    const shinOsaka = byId(OSAKA_GEO.stations, 'shin-osaka');
    const osaka = byId(OSAKA_GEO.stations, 'osaka');
    const tennoji = byId(OSAKA_GEO.stations, 'tennoji');
    expect(aquarium.tile[0]).toBeLessThan(ebisubashi.tile[0]);
    expect(ebisubashi.tile[0]).toBeLessThan(castle.tile[0]);
    expect(shinOsaka.tile[1]).toBeLessThan(osaka.tile[1]);
    expect(osaka.tile[1]).toBeLessThan(ebisubashi.tile[1]);
    expect(ebisubashi.tile[1]).toBeLessThan(tennoji.tile[1]);
  });

  it('표준 지형 코드와 OSM 철도 마스크를 구분해 보존한다', () => {
    const counts = new Map();
    for (const code of OSAKA_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    for (const code of [
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.CROSSWALK, CITY_TILE.PLAZA,
      CITY_TILE.BUILDING, CITY_TILE.PARK, CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.BRIDGE,
    ]) {
      expect(counts.get(code)).toBeGreaterThan(0);
      expect(counts.get(code), code).toBe(EXPECTED_COUNTS[code]);
    }
    expect(counts.get(CITY_TILE.BUILDING)).toBeGreaterThan(30_000);
    expect(counts.get(CITY_TILE.ROAD)).toBeGreaterThan(80_000);
    expect(counts.get(CITY_TILE.ROAD) / OSAKA_GEO.terrain.length).toBeLessThan(0.48);
    expect(counts.get(CITY_TILE.SIDEWALK) / OSAKA_GEO.terrain.length).toBeLessThan(0.4);
    expect(OSAKA_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(OSAKA_GEO.railways.mask.length).toBe(OSAKA_GEO.terrain.length);
    expect(OSAKA_GEO.railways.tileCount).toBe(25_206);
  });

  it('오사카만 수역은 서측에 집중되고 우메다·오사카성·텐노지는 육지다', () => {
    const { w, h } = OSAKA_GEO.meta.grid;
    const waterRatio = (x0, x1, y0, y1) => {
      let water = 0;
      let cells = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const code = OSAKA_GEO.terrain[y * w + x];
          water += Number(code === CITY_TILE.WATER || code === CITY_TILE.RIVER);
          cells += 1;
        }
      }
      return water / cells;
    };
    expect(waterRatio(0, Math.floor(w * 0.25), 0, h)).toBeGreaterThan(0.25);
    expect(waterRatio(Math.floor(w * 0.75), w, 0, h)).toBeLessThan(0.08);
    for (const id of ['osaka', 'shin-osaka', 'tennoji']) {
      const station = byId(OSAKA_GEO.stations, id);
      expect(isCityBlocked(OSAKA_GEO.terrain[tileIndex(station.tile)]), id).toBe(false);
    }
    const castle = byId(OSAKA_GEO.pois, 'osaka-castle');
    expect(isCityBlocked(OSAKA_GEO.terrain[tileIndex(castle.tile)])).toBe(false);
  });

  it('모든 POI·역과 전체 보행 타일이 다리를 포함한 단일 BFS 성분이다', () => {
    const seen = reachableFrom(OSAKA_GEO.terrain, byId(OSAKA_GEO.stations, 'osaka').tile);
    for (const entry of [...OSAKA_GEO.pois, ...OSAKA_GEO.stations]) {
      const index = tileIndex(entry.tile);
      expect(isCityBlocked(OSAKA_GEO.terrain[index]), entry.id).toBe(false);
      expect(seen[index], entry.id).toBe(1);
      const [x, y] = entry.tile;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= OSAKA_GEO.meta.grid.w || ny >= OSAKA_GEO.meta.grid.h) return false;
        return !isCityBlocked(OSAKA_GEO.terrain[ny * OSAKA_GEO.meta.grid.w + nx]);
      }), entry.id).toBe(true);
    }
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < OSAKA_GEO.terrain.length; index += 1) {
      if (isCityBlocked(OSAKA_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(walkable).toBe(304_663);
    expect(reached).toBe(walkable);
  });
});

describe('오사카 생성 결정성·오프라인 계약', () => {
  it('고정 OSM 원본의 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.source).toMatchObject({
      geometry: 'OpenStreetMap contributors',
      license: 'ODbL-1.0',
      snapshot: '2026-07-10',
      rawPbfSha256: '9459cb2bd8827b8934a1c98aee7c7f747b7bd3a0fce47bb95edd9a61897f20f1',
      buildingRelations: 561,
      buildingWays: 383_442,
      coastlineWays: 30,
      crossingNodes: 13_977,
      crossingTiles: 10_511,
      parkAreas: 4_795,
      railwayWays: 2_914,
      riverAreas: 113,
      riverWays: 142,
      roadWays: 73_904,
      waterAreas: 307,
    });
    expect(SNAPSHOT.source.namedRoadWays).toMatchObject({
      '中央大通': 84,
      '御堂筋': 58,
      '新御堂筋': 51,
      '谷町筋': 39,
      '堺筋': 27,
    });
    expect(SNAPSHOT.source.namedRailwayWays).toMatchObject({
      '東海道本線': 221,
      '大阪環状線': 190,
      'Osaka Metro御堂筋線': 51,
    });
    expect(SNAPSHOT.hashes).toEqual({
      building: '3d7710fb3456f904d886df5836aad12898bbc9057e293b8246c4c4d01ca5cb86',
      road: '1cc8f35e44e115bb89e9bc64fdc8198339800995d4ad77149b1c0ccc820b927f',
      water: 'd234adc35f78a69411eaf91aa7734eb058b6bf924b707b650b19506cd451ad5e',
      river: '64274f256478420dca7c82768c6650f5ee090f49e369388a60e4ea22fb4707bb',
      park: 'aa039f40e42ca2d5c6ad3a590732dd55b52e62126dfa04505f11e66e1a33733b',
      railway: 'd557562b88cae070e1a9ffe0821c6ec81d03941250c8a61dd2939d1bd3200775',
    });
  });

  it('재생성 결과와 커밋 산출물의 데이터 해시가 같다', () => {
    const first = buildOsakaGeo();
    const second = buildOsakaGeo();
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(OSAKA_GEO.terrain));
    expect(terrainHash(first.railways.mask)).toBe(terrainHash(OSAKA_GEO.railways.mask));
    expect(terrainHash(first.terrain)).toBe('5a0fc6eefabcee10257924161960758ebc574a5b777c3ea910ad1414fa29aa75');
    expect(terrainHash(first.railways.mask)).toBe('d557562b88cae070e1a9ffe0821c6ec81d03941250c8a61dd2939d1bd3200775');
    expect(first.pois).toEqual(OSAKA_GEO.pois);
    expect(first.stations).toEqual(OSAKA_GEO.stations);
  });

  it('RLE 왕복이 전체 지형·철도 타일을 보존한다', () => {
    const terrainRuns = encodeTerrainRle(OSAKA_GEO.terrain);
    const railwayRuns = encodeTerrainRle(OSAKA_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, OSAKA_GEO.terrain.length)).toEqual(OSAKA_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, OSAKA_GEO.railways.mask.length)).toEqual(OSAKA_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(134_958);
    expect(railwayRuns).toHaveLength(14_523);
    expect(terrainRuns.length).toBeLessThan(OSAKA_GEO.terrain.length / 3);
  });

  it('런타임 산출물·생성기·스냅샷에 네트워크 fetch가 없다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/osaka.geo.js', import.meta.url), 'utf8');
    const generatorSource = fs.readFileSync(new URL('../../../../scripts/build-osaka-geo.mjs', import.meta.url), 'utf8');
    const snapshotSource = JSON.stringify(SNAPSHOT);
    expect(generatedSource).not.toMatch(/\bfetch\s*\(/);
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/);
    expect(snapshotSource).not.toMatch(/\bfetch\s*\(/);
  });
});
