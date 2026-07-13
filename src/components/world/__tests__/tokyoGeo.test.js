import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TOKYO_GEO } from '../cities/tokyo.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import {
  TOKYO_META,
  buildTokyoGeo,
  decodeTerrainRle,
  encodeTerrainRle,
  projectLatLonToTile,
  webMercatorMeters,
} from '../../../../scripts/build-tokyo-geo.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * TOKYO_GEO.meta.grid.w + x;

const FIXED_TILES = Object.freeze({
  pois: {
    'haneda-airport': [405, 644],
    'shinagawa-station': [194, 206],
    'shibuya-scramble': [25, 30],
    'tokyo-tower': [228, 35],
    'rainbow-bridge': [307, 157],
    'odaiba-seaside-park': [378, 195],
    'hamarikyu-gardens': [315, 30],
    zojoji: [241, 43],
    'ebisu-garden-place': [84, 128],
  },
  stations: {
    shibuya: [30, 38],
    ebisu: [68, 103],
    meguro: [93, 172],
    gotanda: [129, 215],
    osaki: [151, 253],
    shinagawa: [194, 206],
    'takanawa-gateway': [206, 164],
    tamachi: [238, 107],
    hamamatsucho: [280, 55],
  },
});

function reachableFrom(terrain, startTile) {
  const { w, h } = TOKYO_GEO.meta.grid;
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

describe('도쿄 실지형 데이터 계약', () => {
  it('20m 고정 축척과 코어 bbox의 단일 격자를 고정한다', () => {
    expect(TOKYO_GEO.meta).toEqual(TOKYO_META);
    expect(TOKYO_GEO.meta.bbox).toEqual([139.695, 35.545, 139.842, 35.665]);
    expect(TOKYO_GEO.meta.grid).toEqual({ w: 666, h: 668 });
    expect(TOKYO_GEO.meta.metersPerTile).toBe(20);
    expect(TOKYO_GEO.meta.projection).toBe('webmercator');
    expect(TOKYO_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(TOKYO_GEO.terrain.length).toBe(444_888);
  });

  it('위경도 → 보정 Web Mercator 투영이 결정적이며 방향을 보존한다', () => {
    expect(webMercatorMeters(139.74, 35.63)).toEqual(webMercatorMeters(139.74, 35.63));
    expect(projectLatLonToTile(35.63, 139.74)).toEqual(projectLatLonToTile(35.63, 139.74));
    expect(projectLatLonToTile(35.65, 139.74)[1]).toBeLessThan(projectLatLonToTile(35.61, 139.74)[1]);
    expect(projectLatLonToTile(35.63, 139.72)[0]).toBeLessThan(projectLatLonToTile(35.63, 139.78)[0]);
  });

  it('모든 POI·역 타일이 저장 위경도의 동일 투영 결과다', () => {
    for (const entry of [...TOKYO_GEO.pois, ...TOKYO_GEO.stations]) {
      expect(entry.tile).toEqual(projectLatLonToTile(entry.lat, entry.lon));
      expect(entry.lon).toBeGreaterThanOrEqual(TOKYO_GEO.meta.bbox[0]);
      expect(entry.lon).toBeLessThanOrEqual(TOKYO_GEO.meta.bbox[2]);
      expect(entry.lat).toBeGreaterThanOrEqual(TOKYO_GEO.meta.bbox[1]);
      expect(entry.lat).toBeLessThanOrEqual(TOKYO_GEO.meta.bbox[3]);
    }
  });

  it('Claude 배선용 POI·역 tile 확정값을 고정한다', () => {
    for (const [id, tile] of Object.entries(FIXED_TILES.pois)) {
      expect(byId(TOKYO_GEO.pois, id).tile, id).toEqual(tile);
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      expect(byId(TOKYO_GEO.stations, id).tile, id).toEqual(tile);
    }
  });

  it('필수 POI와 코어 구간 山手線 fast-travel 역을 포함한다', () => {
    expect(TOKYO_GEO.pois.map((poi) => poi.id)).toEqual(expect.arrayContaining([
      'haneda-airport', 'shinagawa-station', 'shibuya-scramble', 'tokyo-tower',
      'rainbow-bridge', 'odaiba-seaside-park',
    ]));
    expect(TOKYO_GEO.stations.map((station) => station.id)).toEqual([
      'shibuya', 'ebisu', 'meguro', 'gotanda', 'osaki', 'shinagawa',
      'takanawa-gateway', 'tamachi', 'hamamatsucho',
    ]);
    expect(TOKYO_GEO.stations.every((station) => station.line === '山手線')).toBe(true);
  });
});

describe('도쿄 지형 충실도·도시 구조·철도', () => {
  it('하네다→시나가와→시부야와 도쿄만 핵심 지점의 상대 배치를 보존한다', () => {
    const haneda = byId(TOKYO_GEO.pois, 'haneda-airport');
    const shinagawa = byId(TOKYO_GEO.stations, 'shinagawa');
    const shibuya = byId(TOKYO_GEO.stations, 'shibuya');
    const tower = byId(TOKYO_GEO.pois, 'tokyo-tower');
    const odaiba = byId(TOKYO_GEO.pois, 'odaiba-seaside-park');
    expect(haneda.tile[1]).toBeGreaterThan(shinagawa.tile[1]);
    expect(shinagawa.tile[1]).toBeGreaterThan(shibuya.tile[1]);
    expect(shibuya.tile[0]).toBeLessThan(shinagawa.tile[0]);
    expect(shinagawa.tile[0]).toBeLessThan(odaiba.tile[0]);
    expect(tower.tile[0]).toBeLessThan(odaiba.tile[0]);
  });

  it('표준 지형 코드와 OSM 철도 마스크를 구분해 보존한다', () => {
    const counts = new Map();
    for (const code of TOKYO_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    for (const code of [
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.CROSSWALK, CITY_TILE.PLAZA,
      CITY_TILE.BUILDING, CITY_TILE.PARK, CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.BRIDGE,
    ]) {
      expect(counts.get(code)).toBeGreaterThan(0);
    }
    expect(counts.get(CITY_TILE.BUILDING)).toBeGreaterThan(35_000);
    expect(counts.get(CITY_TILE.ROAD)).toBeGreaterThan(120_000);
    expect(counts.get(CITY_TILE.ROAD) / TOKYO_GEO.terrain.length).toBeLessThan(0.4);
    expect(counts.get(CITY_TILE.SIDEWALK) / TOKYO_GEO.terrain.length).toBeLessThan(0.3);
    expect(TOKYO_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(TOKYO_GEO.railways.mask.length).toBe(TOKYO_GEO.terrain.length);
    expect(TOKYO_GEO.railways.tileCount).toBe(20_154);
  });

  it('도쿄만·스미다/아라카와 하구 수역은 동·남측에 집중되고 서측 코어는 육지다', () => {
    const { w, h } = TOKYO_GEO.meta.grid;
    const waterRatio = (x0, x1, y0, y1) => {
      let water = 0;
      let cells = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const code = TOKYO_GEO.terrain[y * w + x];
          water += Number(code === CITY_TILE.WATER || code === CITY_TILE.RIVER);
          cells += 1;
        }
      }
      return water / cells;
    };
    expect(waterRatio(Math.floor(w * 0.75), w, 0, h)).toBeGreaterThan(0.55);
    expect(waterRatio(0, w, Math.floor(h * 0.75), h)).toBeGreaterThan(0.3);
    expect(waterRatio(0, Math.floor(w * 0.25), 0, h)).toBeLessThan(0.02);
  });

  it('OSM 건물·도로·해안·철도 스냅샷과 핵심 간선 계층을 고정한다', () => {
    expect(TOKYO_GEO.meta.source).toMatchObject({
      buildingWays: 218_863,
      buildingRelations: 1_478,
      roadWays: 47_994,
      crossingNodes: 8_678,
      coastlineWays: 123,
      riverWays: 138,
      railwayWays: 2_208,
      namedRoadWays: {
        '第一京浜': 193,
        '東京湾岸道路': 151,
        '海岸通り': 108,
        '桜田通り': 90,
        '山手通り': 73,
        '明治通り': 58,
      },
      namedRailwayWays: { '山手線': 149, '東京モノレール': 52 },
    });
    const snapshot = JSON.parse(fs.readFileSync(
      new URL('../../../../scripts/data/tokyo-osm-v21.json', import.meta.url),
      'utf8',
    ));
    expect(snapshot.hashes).toEqual({
      building: '06f5a1cdfd218f7dad511a66dcf7ec76fb1e7d9e2d8b4b18acac970f0f2ae9bd',
      road: 'df0afa1ecd69dfcc4a4acaf195f43ca706cc831c3be14c609fc0da39149df6c8',
      water: 'd5ccb4c96ccbab6f793a6cb3e9cea4d7c2450be972157fbe9ac0e1672262e87c',
      river: 'cc17badffbdd7d33c60a8e29b3b4811c5b0eaed64333aeda7605b15d91bada3a',
      park: '3c63bd39ee6da95e18a49f0f7fda036f54e17ff4cf5638bd1e2108915080cd13',
      railway: 'bd71b1a988d2d34f472b6f9115ff2d4dc00e792683f73d1c200a84ab9638e010',
    });
  });

  it('모든 POI·역과 전체 보행 타일이 다리를 포함한 단일 BFS 성분이다', () => {
    const seen = reachableFrom(TOKYO_GEO.terrain, byId(TOKYO_GEO.stations, 'shinagawa').tile);
    for (const entry of [...TOKYO_GEO.pois, ...TOKYO_GEO.stations]) {
      const index = tileIndex(entry.tile);
      expect(isCityBlocked(TOKYO_GEO.terrain[index]), entry.id).toBe(false);
      expect(seen[index], entry.id).toBe(1);
      const [x, y] = entry.tile;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= TOKYO_GEO.meta.grid.w || ny >= TOKYO_GEO.meta.grid.h) return false;
        return !isCityBlocked(TOKYO_GEO.terrain[ny * TOKYO_GEO.meta.grid.w + nx]);
      }), entry.id).toBe(true);
    }
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < TOKYO_GEO.terrain.length; index += 1) {
      if (isCityBlocked(TOKYO_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(walkable).toBe(266_627);
    expect(reached).toBe(walkable);
  });
});

describe('도쿄 생성 결정성·오프라인 계약', () => {
  it('재생성 결과와 커밋 산출물의 데이터 해시가 같다', () => {
    const first = buildTokyoGeo();
    const second = buildTokyoGeo();
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(TOKYO_GEO.terrain));
    expect(terrainHash(first.railways.mask)).toBe(terrainHash(TOKYO_GEO.railways.mask));
    expect(first.pois).toEqual(TOKYO_GEO.pois);
    expect(first.stations).toEqual(TOKYO_GEO.stations);
  });

  it('RLE 왕복이 전체 444,888개 지형·철도 타일을 보존한다', () => {
    const terrainRuns = encodeTerrainRle(TOKYO_GEO.terrain);
    const railwayRuns = encodeTerrainRle(TOKYO_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, TOKYO_GEO.terrain.length)).toEqual(TOKYO_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, TOKYO_GEO.railways.mask.length)).toEqual(TOKYO_GEO.railways.mask);
    expect(terrainRuns.length).toBeLessThan(TOKYO_GEO.terrain.length / 3);
  });

  it('런타임 산출물·생성기·스냅샷에 네트워크 fetch가 없다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/tokyo.geo.js', import.meta.url), 'utf8');
    const generatorSource = fs.readFileSync(new URL('../../../../scripts/build-tokyo-geo.mjs', import.meta.url), 'utf8');
    const snapshotSource = fs.readFileSync(new URL('../../../../scripts/data/tokyo-osm-v21.json', import.meta.url), 'utf8');
    expect(generatedSource).not.toMatch(/\bfetch\s*\(/);
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/);
    expect(snapshotSource).not.toMatch(/\bfetch\s*\(/);
  });
});
