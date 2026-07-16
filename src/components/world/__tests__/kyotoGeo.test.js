import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KYOTO_GEO } from '../cities/kyoto.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import {
  KYOTO_META,
  buildKyotoGeo,
  decodeTerrainRle,
  encodeTerrainRle,
  projectLatLonToTile,
  webMercatorMeters,
} from '../../../../scripts/build-kyoto-geo.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * KYOTO_GEO.meta.grid.w + x;
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/kyoto-osm-v21.json', import.meta.url),
  'utf8',
));

const EXPECTED_COUNTS = Object.freeze({
  [CITY_TILE.ROAD]: 170_978,
  [CITY_TILE.SIDEWALK]: 84_686,
  [CITY_TILE.CROSSWALK]: 4_348,
  [CITY_TILE.PLAZA]: 142,
  [CITY_TILE.PARK]: 88_706,
  [CITY_TILE.BRIDGE]: 26_084,
  [CITY_TILE.WATER]: 1_206,
  [CITY_TILE.BUILDING]: 36_148,
  [CITY_TILE.RIVER]: 14_554,
});

const FIXED_TILES = Object.freeze({
  pois: {
    'nijo-castle': [356, 261],
    'kyoto-imperial-palace': [419, 192],
    'fushimi-inari-taisha': [487, 517],
    'yasaka-shrine': [493, 314],
    'heian-shrine': [515, 244],
    kiyomizudera: [519, 362],
    togetsukyo: [35, 262],
    kinkakuji: [274, 115],
    ginkakuji: [584, 183],
  },
  stations: {
    kyoto: [404, 415],
    'umekoji-kyotonishi': [333, 397],
    tambaguchi: [330, 358],
    nijo: [327, 272],
    emmachi: [275, 232],
    hanazono: [217, 230],
    uzumasa: [141, 239],
    'saga-arashiyama': [52, 229],
    tofukuji: [455, 439],
    inari: [458, 518],
  },
});

const SELECTED_SOURCE_IDS = Object.freeze({
  'nijo-castle': 57_111_281,
  'kyoto-imperial-palace': 554_879_249,
  'fushimi-inari-taisha': 96_291_583,
  'yasaka-shrine': 328_903_218,
  'heian-shrine': 619_903_245,
  kiyomizudera: 336_641_107,
  togetsukyo: 519_319_727,
  kinkakuji: 98_115_917,
  ginkakuji: 105_817_561,
  kyoto: 267_316_272,
  'umekoji-kyotonishi': 5_707_708_875,
  tambaguchi: 6_877_587_476,
  nijo: 3_577_959_128,
  emmachi: 6_877_587_461,
  hanazono: 6_877_587_462,
  uzumasa: 6_877_587_465,
  'saga-arashiyama': 6_877_587_460,
  tofukuji: 3_644_796_526,
  inari: 3_644_796_532,
});

function reachableFrom(terrain, startTile) {
  const { w, h } = KYOTO_GEO.meta.grid;
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

describe('교토 실지형 데이터 계약', () => {
  it('20m 고정 축척과 아라시야마→후시미이나리 코어의 단일 격자를 고정한다', () => {
    expect(KYOTO_GEO.meta).toEqual(KYOTO_META);
    expect(KYOTO_GEO.meta.bbox).toEqual([135.67, 34.94, 135.81, 35.06]);
    expect(KYOTO_GEO.meta.grid).toEqual({ w: 639, h: 668 });
    expect(KYOTO_GEO.meta.metersPerTile).toBe(20);
    expect(KYOTO_GEO.meta.projection).toBe('webmercator');
    expect(KYOTO_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(KYOTO_GEO.terrain.length).toBe(426_852);
  });

  it('위경도 → 보정 Web Mercator 투영이 결정적이며 방향을 보존한다', () => {
    expect(webMercatorMeters(135.75, 35)).toEqual(webMercatorMeters(135.75, 35));
    expect(projectLatLonToTile(35, 135.75)).toEqual(projectLatLonToTile(35, 135.75));
    expect(projectLatLonToTile(35.04, 135.75)[1]).toBeLessThan(projectLatLonToTile(34.96, 135.75)[1]);
    expect(projectLatLonToTile(35, 135.69)[0]).toBeLessThan(projectLatLonToTile(35, 135.79)[0]);
  });

  it('모든 POI·역 tile은 위경도 투영값이며 마커끼리 3타일 이상 떨어진다', () => {
    const entries = [...KYOTO_GEO.pois, ...KYOTO_GEO.stations];
    for (const entry of entries) {
      expect(entry.tile, entry.id).toEqual(projectLatLonToTile(entry.lat, entry.lon));
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(3);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(3);
      expect(entry.tile[0], entry.id).toBeLessThan(KYOTO_GEO.meta.grid.w - 3);
      expect(entry.tile[1], entry.id).toBeLessThan(KYOTO_GEO.meta.grid.h - 3);
      const source = SNAPSHOT.namedFeatures.find((feature) => feature.id === SELECTED_SOURCE_IDS[entry.id]);
      expect(source?.name, entry.id).toBe(entry.nameJa);
      expect(Number(source?.lat.toFixed(7)), entry.id).toBe(entry.lat);
      expect(Number(source?.lon.toFixed(7)), entry.id).toBe(entry.lon);
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
      expect(byId(KYOTO_GEO.pois, id)?.tile, id).toEqual(tile);
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      expect(byId(KYOTO_GEO.stations, id)?.tile, id).toEqual(tile);
    }
  });
});

describe('교토 지형 충실도·도시 구조·철도', () => {
  it('아라시야마→도심→히가시야마와 북사찰→후시미의 상대 배치를 보존한다', () => {
    const bridge = byId(KYOTO_GEO.pois, 'togetsukyo');
    const castle = byId(KYOTO_GEO.pois, 'nijo-castle');
    const ginkakuji = byId(KYOTO_GEO.pois, 'ginkakuji');
    const kinkakuji = byId(KYOTO_GEO.pois, 'kinkakuji');
    const inariShrine = byId(KYOTO_GEO.pois, 'fushimi-inari-taisha');
    const kyoto = byId(KYOTO_GEO.stations, 'kyoto');
    expect(bridge.tile[0]).toBeLessThan(castle.tile[0]);
    expect(castle.tile[0]).toBeLessThan(ginkakuji.tile[0]);
    expect(kinkakuji.tile[1]).toBeLessThan(kyoto.tile[1]);
    expect(kyoto.tile[1]).toBeLessThan(inariShrine.tile[1]);
  });

  it('표준 지형 코드와 OSM 철도 마스크를 구분해 보존한다', () => {
    const counts = new Map();
    for (const code of KYOTO_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    for (const code of [
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.CROSSWALK, CITY_TILE.PLAZA,
      CITY_TILE.BUILDING, CITY_TILE.PARK, CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.BRIDGE,
    ]) {
      expect(counts.get(code)).toBeGreaterThan(0);
      expect(counts.get(code), code).toBe(EXPECTED_COUNTS[code]);
    }
    expect(counts.get(CITY_TILE.BUILDING)).toBeGreaterThan(30_000);
    expect(counts.get(CITY_TILE.ROAD)).toBeGreaterThan(80_000);
    expect(counts.get(CITY_TILE.ROAD) / KYOTO_GEO.terrain.length).toBeLessThan(0.48);
    expect(counts.get(CITY_TILE.SIDEWALK) / KYOTO_GEO.terrain.length).toBeLessThan(0.4);
    expect(counts.get(CITY_TILE.PARK)).toBeGreaterThan(80_000);
    expect(KYOTO_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(KYOTO_GEO.railways.mask.length).toBe(KYOTO_GEO.terrain.length);
    expect(KYOTO_GEO.railways.tileCount).toBe(12_157);
  });

  it('가쓰라가와·가모가와 수계와 동서 산지 수림을 내륙 지형으로 보존한다', () => {
    const { w, h } = KYOTO_GEO.meta.grid;
    const ratio = (codePredicate, x0, x1, y0, y1) => {
      let matches = 0;
      let cells = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const code = KYOTO_GEO.terrain[y * w + x];
          matches += Number(codePredicate(code));
          cells += 1;
        }
      }
      return matches / cells;
    };
    const isWater = (code) => code === CITY_TILE.WATER || code === CITY_TILE.RIVER;
    expect(ratio(isWater, 0, 180, 220, 650)).toBeGreaterThan(0.04);
    expect(ratio(isWater, 440, 480, 80, 580)).toBeGreaterThan(0.035);
    expect(ratio(isWater, 250, 400, 80, 580)).toBeLessThan(0.025);
    expect(ratio(isWater, 0, w, 0, h)).toBeLessThan(0.05);
    expect(ratio((code) => code === CITY_TILE.PARK, 0, 120, 0, h)).toBeGreaterThan(0.3);
    expect(ratio((code) => code === CITY_TILE.PARK, 540, w, 0, h)).toBeGreaterThan(0.3);
    for (const id of ['kyoto', 'saga-arashiyama', 'inari']) {
      const station = byId(KYOTO_GEO.stations, id);
      expect(isCityBlocked(KYOTO_GEO.terrain[tileIndex(station.tile)]), id).toBe(false);
    }
    const castle = byId(KYOTO_GEO.pois, 'nijo-castle');
    expect(isCityBlocked(KYOTO_GEO.terrain[tileIndex(castle.tile)])).toBe(false);
  });

  it('모든 POI·역과 전체 보행 타일이 다리를 포함한 단일 BFS 성분이다', () => {
    const seen = reachableFrom(KYOTO_GEO.terrain, byId(KYOTO_GEO.stations, 'kyoto').tile);
    for (const entry of [...KYOTO_GEO.pois, ...KYOTO_GEO.stations]) {
      const index = tileIndex(entry.tile);
      expect(isCityBlocked(KYOTO_GEO.terrain[index]), entry.id).toBe(false);
      expect(seen[index], entry.id).toBe(1);
      const [x, y] = entry.tile;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= KYOTO_GEO.meta.grid.w || ny >= KYOTO_GEO.meta.grid.h) return false;
        return !isCityBlocked(KYOTO_GEO.terrain[ny * KYOTO_GEO.meta.grid.w + nx]);
      }), entry.id).toBe(true);
    }
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < KYOTO_GEO.terrain.length; index += 1) {
      if (isCityBlocked(KYOTO_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(walkable).toBe(374_944);
    expect(reached).toBe(walkable);
  });
});

describe('교토 생성 결정성·오프라인 계약', () => {
  it('고정 OSM 원본의 출처·객체 수·레이어 해시를 보존한다', () => {
    expect(SNAPSHOT.source).toMatchObject({
      geometry: 'OpenStreetMap contributors',
      license: 'ODbL-1.0',
      snapshot: '2026-07-10',
      rawPbfSha256: '9459cb2bd8827b8934a1c98aee7c7f747b7bd3a0fce47bb95edd9a61897f20f1',
      buildingRelations: 452,
      buildingWays: 457_188,
      crossingNodes: 6_624,
      crossingTiles: 5_210,
      parkAreas: 5_063,
      railwayWays: 1_567,
      riverAreas: 121,
      riverWays: 1_993,
      roadWays: 59_313,
      waterAreas: 1_172,
    });
    expect(SNAPSHOT.source.namedRoadWays).toMatchObject({
      '五条通': 72,
      '烏丸通': 51,
      '今出川通': 49,
      '河原町通': 46,
      '四条通': 43,
    });
    expect(SNAPSHOT.source.namedRailwayWays).toMatchObject({
      '東海道本線': 200,
      '阪急電鉄京都線': 155,
      '京都市営地下鉄烏丸線': 122,
      'JR奈良線': 62,
      'JR山陰線': 51,
    });
    expect(SNAPSHOT.hashes).toEqual({
      building: '5f7ee365897dfc6358cecfbfb83d97235329ab4dcc946247eb884499c89be781',
      road: 'f787330a7b73dd48545c8bc0b0e037e79c0a072f44e101c7b31540cfabfa7d65',
      water: '49eb6dd8ecdafbf77a93125b66d48d450333448efde8ab37a6c037155334a165',
      river: '1c66e20c8e0d65deb23be96e1469dfb97021f328518a55e62b833f68f62035a3',
      park: '0be98cfe5103171bbd64ffc055a4dc5c64ed9c4cf0c808c7a7f399167f25852b',
      railway: '7ea6513c0d2b0f1727e2d66b5d4b9ba66c3ed3099e093b50b1da7d8e6803d3f3',
    });
  });

  it('재생성 결과와 커밋 산출물의 데이터 해시가 같다', () => {
    const first = buildKyotoGeo();
    const second = buildKyotoGeo();
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(KYOTO_GEO.terrain));
    expect(terrainHash(first.railways.mask)).toBe(terrainHash(KYOTO_GEO.railways.mask));
    expect(terrainHash(first.terrain)).toBe('6d63881ec9cfc2a049aca1d5cc389dc5af52b9ed05a078a2542da898d4f8aaf2');
    expect(terrainHash(first.railways.mask)).toBe('7ea6513c0d2b0f1727e2d66b5d4b9ba66c3ed3099e093b50b1da7d8e6803d3f3');
    expect(first.pois).toEqual(KYOTO_GEO.pois);
    expect(first.stations).toEqual(KYOTO_GEO.stations);
  });

  // 전 타일 왕복 비교라 병렬 실행 시 이 호스트에서 기본 5초를 넘길 수 있다(tokyoGeo와 동일 패턴).
  it('RLE 왕복이 전체 지형·철도 타일을 보존한다', { timeout: 20_000 }, () => {
    const terrainRuns = encodeTerrainRle(KYOTO_GEO.terrain);
    const railwayRuns = encodeTerrainRle(KYOTO_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, KYOTO_GEO.terrain.length)).toEqual(KYOTO_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, KYOTO_GEO.railways.mask.length)).toEqual(KYOTO_GEO.railways.mask);
    expect(terrainRuns).toHaveLength(144_125);
    expect(railwayRuns).toHaveLength(6_539);
    expect(terrainRuns.length / KYOTO_GEO.terrain.length).toBeLessThan(0.35);
  });

  it('런타임 산출물·생성기·스냅샷에 네트워크 fetch가 없다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/kyoto.geo.js', import.meta.url), 'utf8');
    const generatorSource = fs.readFileSync(new URL('../../../../scripts/build-kyoto-geo.mjs', import.meta.url), 'utf8');
    const snapshotSource = JSON.stringify(SNAPSHOT);
    expect(generatedSource).not.toMatch(/\bfetch\s*\(/);
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/);
    expect(snapshotSource).not.toMatch(/\bfetch\s*\(/);
  });
});
