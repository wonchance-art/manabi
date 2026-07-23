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
    'haneda-airport': [563, 1062],
    'shinagawa-station': [357, 619],
    'shibuya-scramble': [183, 448],
    'tokyo-tower': [386, 453],
    'rainbow-bridge': [466, 575],
    'odaiba-seaside-park': [537, 613],
    'hamarikyu-gardens': [473, 447],
    zojoji: [399, 461],
    'ebisu-garden-place': [242, 545],
    sensoji: [616, 143],
    'tokyo-skytree': [681, 166],
    'ueno-park': [508, 144],
    'tokyo-station-marunouchi': [479, 327],
    'ginza-4-chome': [481, 382],
    'meiji-jingu': [182, 357],
    'tokyo-metropolitan-government': [144, 283],
    'ryogoku-kokugikan': [602, 239],
    'nakameguro-meguro-river': [176, 533],
    'kanda-myojin': [487, 211],
    'akihabara-electric-town': [506, 222],
    'takeshita-street': [194, 381],
    'otome-road': [262, 55],
    'tsukiji-outer-market': [501, 415],
    'toyosu-market': [578, 526],
    'omoide-yokocho': [178, 262],
    'shinjuku-gyoen': [226, 305],
    'yanaka-ginza': [479, 69],
    kagurazaka: [361, 210],
    ameyoko: [517, 169],
    kappabashi: [581, 144],
    jimbocho: [438, 245],
    'sugamo-jizodori': [355, 18],
    daikanyama: [194, 509],
    shimokitazawa: [30, 438],
    'nakano-broadway': [26, 175],
    omotesando: [217, 417],
  },
  stations: {
    shibuya: [188, 456],
    ebisu: [227, 521],
    meguro: [252, 589],
    gotanda: [287, 633],
    osaki: [309, 671],
    shinagawa: [357, 619],
    'takanawa-gateway': [364, 582],
    tamachi: [396, 525],
    hamamatsucho: [439, 472],
    shimbashi: [444, 411],
    yurakucho: [466, 362],
    tokyo: [482, 327],
    kanda: [501, 268],
    akihabara: [511, 231],
    okachimachi: [518, 184],
    ueno: [527, 148],
    uguisudani: [533, 101],
    nippori: [500, 66],
    'nishi-nippori': [482, 43],
    tabata: [460, 14],
    komagome: [394, 19],
    sugamo: [359, 36],
    otsuka: [310, 46],
    ikebukuro: [231, 54],
    mejiro: [210, 104],
    takadanobaba: [197, 152],
    'shin-okubo': [182, 215],
    shinjuku: [183, 277],
    yoyogi: [190, 312],
    harajuku: [191, 388],
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
  it('20m 고정 축척과 확장 bbox의 단일 격자를 고정한다', () => {
    expect(TOKYO_GEO.meta).toEqual(TOKYO_META);
    expect(TOKYO_GEO.meta.bbox).toEqual([139.66, 35.545, 139.842, 35.74]);
    expect(TOKYO_GEO.meta.grid).toEqual({ w: 824, h: 1086 });
    expect(TOKYO_GEO.meta.metersPerTile).toBe(20);
    expect(TOKYO_GEO.meta.projection).toBe('webmercator');
    expect(TOKYO_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(TOKYO_GEO.terrain.length).toBe(894_864);
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

  it('기존 9개 ID와 OSM 확인 신규 POI, 山手線 30역 전체를 포함한다', () => {
    expect(TOKYO_GEO.pois.map((poi) => poi.id)).toEqual([
      'haneda-airport', 'shinagawa-station', 'shibuya-scramble', 'tokyo-tower',
      'rainbow-bridge', 'odaiba-seaside-park', 'hamarikyu-gardens', 'zojoji',
      'ebisu-garden-place', 'sensoji', 'tokyo-skytree', 'ueno-park',
      'tokyo-station-marunouchi', 'ginza-4-chome', 'meiji-jingu',
      'tokyo-metropolitan-government', 'ryogoku-kokugikan',
      'nakameguro-meguro-river', 'kanda-myojin',
      'akihabara-electric-town', 'takeshita-street', 'otome-road',
      'tsukiji-outer-market', 'toyosu-market', 'omoide-yokocho', 'shinjuku-gyoen', 'yanaka-ginza',
      'kagurazaka', 'ameyoko', 'kappabashi', 'jimbocho', 'sugamo-jizodori',
      'daikanyama', 'shimokitazawa', 'nakano-broadway', 'omotesando',
    ]);
    expect(TOKYO_GEO.stations.map((station) => station.id)).toEqual([
      'shibuya', 'ebisu', 'meguro', 'gotanda', 'osaki', 'shinagawa',
      'takanawa-gateway', 'tamachi', 'hamamatsucho',
      'shimbashi', 'yurakucho', 'tokyo', 'kanda', 'akihabara', 'okachimachi',
      'ueno', 'uguisudani', 'nippori', 'nishi-nippori', 'tabata', 'komagome',
      'sugamo', 'otsuka', 'ikebukuro', 'mejiro', 'takadanobaba', 'shin-okubo',
      'shinjuku', 'yoyogi', 'harajuku',
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
    expect(counts.get(CITY_TILE.BUILDING)).toBeGreaterThan(80_000);
    expect(counts.get(CITY_TILE.ROAD)).toBeGreaterThan(350_000);
    expect(counts.get(CITY_TILE.ROAD) / TOKYO_GEO.terrain.length).toBeLessThan(0.5);
    expect(counts.get(CITY_TILE.SIDEWALK) / TOKYO_GEO.terrain.length).toBeLessThan(0.3);
    expect(TOKYO_GEO.railways.mask).toBeInstanceOf(Uint8Array);
    expect(TOKYO_GEO.railways.mask.length).toBe(TOKYO_GEO.terrain.length);
    expect(TOKYO_GEO.railways.tileCount).toBe(53_798);
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
    expect(waterRatio(Math.floor(w * 0.75), w, 0, h)).toBeGreaterThan(0.35);
    expect(waterRatio(0, w, Math.floor(h * 0.75), h)).toBeGreaterThan(0.25);
    expect(waterRatio(Math.floor(w * 0.55), w, Math.floor(h * 0.55), h)).toBeGreaterThan(0.55);
    expect(waterRatio(0, Math.floor(w * 0.25), 0, h)).toBeLessThan(0.02);
  });

  it('OSM 건물·도로·해안·철도 스냅샷과 핵심 간선 계층을 고정한다', () => {
    expect(TOKYO_GEO.meta.source).toMatchObject({
      buildingWays: 678_934,
      buildingRelations: 1_478,
      roadWays: 148_558,
      crossingNodes: 25_210,
      coastlineWays: 123,
      riverWays: 316,
      railwayWays: 5_952,
      namedRoadWays: {
        '第一京浜': 198,
        '東京湾岸道路': 151,
        '海岸通り': 112,
        '桜田通り': 101,
        '山手通り': 186,
        '明治通り': 264,
      },
      namedRailwayWays: { '山手線': 395, '東京モノレール': 52 },
    });
    const snapshot = JSON.parse(fs.readFileSync(
      new URL('../../../../scripts/data/tokyo-osm-v22.json', import.meta.url),
      'utf8',
    ));
    expect(snapshot.hashes).toEqual({
      building: 'e34bc99fa9895dc5f49a59df7d4161d15ba1a9bbb8e499f4404f55ad7e3d199f',
      road: 'db10428fe3687a36eefd573289d9fc5da6bbeba7e6a7741afa90e877305ff5ba',
      water: '5fd3ed37b51f68740458e1ece1fc73cb4b6819a838ae30e64223373232be1f16',
      river: 'a72cb1ab1d97b2da4c4afdd813628ea189bdcc6478baca36c2e99c2801678266',
      park: '47262f9d1f7cd4e2cf63354f3e8d0b00ea1d7138af7e92dde0a694e3107dc921',
      railway: '4402851971f1f1bf389a9623e7d1ae53291160ce8ab5a9b53ab55917c4f26a89',
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
    // v2.4 동네 키워드 14곳 앵커 보정(+5 타일 — 재생성 실측).
    expect(walkable).toBe(655_994);
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

  it('RLE 왕복이 전체 894,864개 지형·철도 타일을 보존한다', { timeout: 20_000 }, () => {
    const terrainRuns = encodeTerrainRle(TOKYO_GEO.terrain);
    const railwayRuns = encodeTerrainRle(TOKYO_GEO.railways.mask);
    expect(decodeTerrainRle(terrainRuns, TOKYO_GEO.terrain.length)).toEqual(TOKYO_GEO.terrain);
    expect(decodeTerrainRle(railwayRuns, TOKYO_GEO.railways.mask.length)).toEqual(TOKYO_GEO.railways.mask);
    expect(terrainRuns.length).toBeLessThan(TOKYO_GEO.terrain.length / 3);
  });

  it('런타임 산출물·생성기·스냅샷에 네트워크 fetch가 없다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/tokyo.geo.js', import.meta.url), 'utf8');
    const generatorSource = fs.readFileSync(new URL('../../../../scripts/build-tokyo-geo.mjs', import.meta.url), 'utf8');
    const snapshotSource = fs.readFileSync(new URL('../../../../scripts/data/tokyo-osm-v22.json', import.meta.url), 'utf8');
    expect(generatedSource).not.toMatch(/\bfetch\s*\(/);
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/);
    expect(snapshotSource).not.toMatch(/\bfetch\s*\(/);
  });

  it('런타임 geo는 중첩 숫자쌍 대신 versioned packed RLE loader를 쓴다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/tokyo.geo.js', import.meta.url), 'utf8');
    expect(generatedSource).toContain("import { decodeCityGeoRle } from './cityGeoLoader.js'");
    expect(generatedSource).toContain('terrainPacked = null');
    expect(generatedSource).toContain('railwayPacked = null');
    expect(generatedSource).not.toMatch(/const TERRAIN_RLE = \[\[/);
    expect(Buffer.byteLength(generatedSource)).toBeLessThan(1_700_000);
  });
});
