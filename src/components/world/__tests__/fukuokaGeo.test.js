import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FUKUOKA_GEO } from '../cities/fukuoka.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import {
  FUKUOKA_META,
  buildFukuokaGeo,
  decodeTerrainRle,
  encodeTerrainRle,
  projectLatLonToTile,
  webMercatorMeters,
} from '../../../../scripts/build-fukuoka-geo.mjs';

const terrainHash = (terrain) => createHash('sha256').update(terrain).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const tileIndex = ([x, y]) => y * FUKUOKA_GEO.meta.grid.w + x;
const terrainAt = (tile) => FUKUOKA_GEO.terrain[tileIndex(tile)];

const PRESERVED_TILES = Object.freeze({
  pois: {
    'momochi-seaside': [13, 115], 'fukuoka-tower': [17, 125], marizon: [14, 115],
    'paypay-dome': [65, 115], 'fukuoka-museum': [23, 146], 'ohori-park': [132, 167],
    'fukuoka-castle': [160, 175], 'acros-fukuoka': [252, 136], nakasu: [268, 128],
    'kushida-jinja': [290, 127], 'canal-city': [293, 146], 'hakata-port-tower': [217, 69],
    'bayside-place': [235, 65],
  },
  stations: {
    tojinmachi: [103, 143], 'ohori-koen': [142, 144], akasaka: [196, 149],
    tenjin: [234, 137], 'nishitetsu-fukuoka': [238, 148], 'tenjin-minami': [252, 152],
    'nakasu-kawabata': [270, 118], gofukumachi: [286, 100],
    'kushida-jinja-mae': [294, 137], gion: [307, 120], hakata: [335, 144],
  },
});

function reachableFrom(terrain, startTile) {
  const { w, h } = FUKUOKA_GEO.meta.grid;
  const seen = new Uint8Array(terrain.length);
  const start = startTile[1] * w + startTile[0];
  const queue = new Int32Array(terrain.length);
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
      if (seen[next] || isCityBlocked(terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

describe('후쿠오카 실지형 데이터 계약', () => {
  it('20m 고정 축척·Web Mercator 보정·단일 격자를 고정한다', () => {
    expect(FUKUOKA_GEO.meta).toEqual(FUKUOKA_META);
    expect(FUKUOKA_GEO.meta.metersPerTile).toBe(20);
    expect(FUKUOKA_GEO.meta.projection).toBe('webmercator');
    expect(FUKUOKA_GEO.meta.grid).toEqual({ w: 388, h: 254 });
    expect(FUKUOKA_GEO.terrain).toBeInstanceOf(Uint8Array);
    expect(FUKUOKA_GEO.terrain.length).toBe(388 * 254);
  });

  it('위경도 → 보정 Web Mercator 투영이 결정적이며 남북 방향을 보존한다', () => {
    expect(webMercatorMeters(130.4, 33.59)).toEqual(webMercatorMeters(130.4, 33.59));
    expect(projectLatLonToTile(33.59, 130.4)).toEqual(projectLatLonToTile(33.59, 130.4));
    const north = projectLatLonToTile(33.6, 130.4);
    const south = projectLatLonToTile(33.58, 130.4);
    expect(north[1]).toBeLessThan(south[1]);
  });

  it('모든 POI·역 타일이 저장 위경도의 동일 투영 결과다', () => {
    for (const entry of [...FUKUOKA_GEO.pois, ...FUKUOKA_GEO.stations]) {
      expect(entry.tile).toEqual(projectLatLonToTile(entry.lat, entry.lon));
      expect(entry.lon).toBeGreaterThanOrEqual(FUKUOKA_GEO.meta.bbox[0]);
      expect(entry.lon).toBeLessThanOrEqual(FUKUOKA_GEO.meta.bbox[2]);
      expect(entry.lat).toBeGreaterThanOrEqual(FUKUOKA_GEO.meta.bbox[1]);
      expect(entry.lat).toBeLessThanOrEqual(FUKUOKA_GEO.meta.bbox[3]);
    }
  });

  it('주요 fast-travel 역을 포함한다', () => {
    const ids = FUKUOKA_GEO.stations.map((station) => station.id);
    expect(ids).toEqual(expect.arrayContaining([
      'hakata', 'tenjin', 'tenjin-minami', 'nishitetsu-fukuoka',
      'nakasu-kawabata', 'kushida-jinja-mae', 'gion', 'gofukumachi',
      'akasaka', 'ohori-koen', 'tojinmachi',
    ]));
  });

  it('기존 bbox·POI 13개·역 11개의 tile 좌표를 보존한다', () => {
    expect(FUKUOKA_GEO.meta.bbox).toEqual([130.348, 33.5705, 130.4315, 33.616]);
    for (const [id, tile] of Object.entries(PRESERVED_TILES.pois)) {
      expect(byId(FUKUOKA_GEO.pois, id).tile, id).toEqual(tile);
    }
    for (const [id, tile] of Object.entries(PRESERVED_TILES.stations)) {
      expect(byId(FUKUOKA_GEO.stations, id).tile, id).toEqual(tile);
    }
  });

  it('국제선 터미널과 국내선 베이사이드 터미널을 별도 POI로 둔다', () => {
    const international = byId(FUKUOKA_GEO.pois, 'hakata-port-international-terminal');
    const domestic = byId(FUKUOKA_GEO.pois, 'bayside-place');
    expect(international).toMatchObject({ nameJa: '博多港国際ターミナル', kind: 'ferry-terminal' });
    expect(domestic).toMatchObject({ nameJa: 'ベイサイドプレイス博多' });
    expect(international.tile).not.toEqual(domestic.tile);
    expect(international.tile[1]).toBeLessThan(domestic.tile[1]);
  });
});

describe('지형 충실도·도시 구조·연결성', () => {
  it('서→동 핵심 지점의 상대 배치를 보존한다', () => {
    const tower = byId(FUKUOKA_GEO.pois, 'fukuoka-tower');
    const dome = byId(FUKUOKA_GEO.pois, 'paypay-dome');
    const momochi = byId(FUKUOKA_GEO.pois, 'momochi-seaside');
    const ohori = byId(FUKUOKA_GEO.pois, 'ohori-park');
    const tenjin = byId(FUKUOKA_GEO.stations, 'tenjin');
    const nakasu = byId(FUKUOKA_GEO.pois, 'nakasu');
    const hakata = byId(FUKUOKA_GEO.stations, 'hakata');

    expect(tower.tile[0]).toBeLessThan(dome.tile[0]);
    expect(momochi.tile[1]).toBeLessThan(tower.tile[1]);
    expect(ohori.tile[0]).toBeLessThan(tenjin.tile[0]);
    expect(tenjin.tile[0]).toBeLessThan(nakasu.tile[0]);
    expect(nakasu.tile[0]).toBeLessThan(hakata.tile[0]);
    expect(hakata.tile[1]).toBeGreaterThan(tenjin.tile[1]);
  });

  it('표준 지형 코드를 갖고 건물·도로·횡단보도 밀도가 도시 블록을 드러낸다', () => {
    const counts = new Map();
    for (const code of FUKUOKA_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    for (const code of [
      CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.ROAD, CITY_TILE.CROSSWALK, CITY_TILE.BRIDGE,
      CITY_TILE.SIDEWALK, CITY_TILE.PARK, CITY_TILE.BEACH,
      CITY_TILE.BUILDING, CITY_TILE.DOCK, CITY_TILE.PLAZA,
    ]) {
      expect(counts.get(code)).toBeGreaterThan(0);
    }
    expect(counts.get(CITY_TILE.RIVER)).toBeGreaterThan(500);
    expect(counts.get(CITY_TILE.BRIDGE)).toBeGreaterThan(20);
    expect(counts.get(CITY_TILE.BUILDING)).toBeGreaterThan(10_000);
    expect(counts.get(CITY_TILE.ROAD)).toBeGreaterThan(20_000);
    expect(counts.get(CITY_TILE.CROSSWALK)).toBeGreaterThan(100);
    expect(counts.get(CITY_TILE.SIDEWALK) / FUKUOKA_GEO.terrain.length).toBeLessThan(0.5);
  });

  it('수역은 북측 하카타만과 강에 집중되고 동·남 경계는 내륙이다', () => {
    const { w, h } = FUKUOKA_GEO.meta.grid;
    const waterRatio = (x0, x1, y0, y1) => {
      let water = 0;
      let cells = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const code = FUKUOKA_GEO.terrain[y * w + x];
          water += Number(code === CITY_TILE.WATER || code === CITY_TILE.RIVER);
          cells += 1;
        }
      }
      return water / cells;
    };
    expect(waterRatio(0, w, 0, Math.floor(h * 0.35))).toBeGreaterThan(0.3);
    expect(waterRatio(0, w, Math.floor(h * 0.65), h)).toBeLessThan(0.05);
    expect(waterRatio(Math.floor(w * 0.82), w, 0, h)).toBeLessThan(0.05);
    const hakata = byId(FUKUOKA_GEO.stations, 'hakata');
    expect([CITY_TILE.WATER, CITY_TILE.RIVER]).not.toContain(terrainAt(hakata.tile));
  });

  it('OSM 간선도로·이면도로·건물 스냅샷을 고정한다', () => {
    expect(FUKUOKA_GEO.meta.source).toMatchObject({
      buildingWays: 49_525,
      roadWays: 5_595,
      crossingNodes: 1_049,
      namedRoadWays: { '大博通り': 19, '昭和通り': 79, '渡辺通り': 20 },
    });
  });

  it('캐널시티는 건물 외곽 ring 안에 보행 가능한 내부 광장을 둔다', () => {
    const [cx, cy] = byId(FUKUOKA_GEO.pois, 'canal-city').tile;
    let innerWalkable = 0;
    let innerCells = 0;
    let ringBuildings = 0;
    for (let y = cy - 10; y <= cy + 10; y += 1) {
      for (let x = cx - 7; x <= cx + 7; x += 1) {
        const code = FUKUOKA_GEO.terrain[y * FUKUOKA_GEO.meta.grid.w + x];
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        if (dx <= 3 && dy <= 4) {
          innerCells += 1;
          innerWalkable += Number(!isCityBlocked(code));
        } else if (dx >= 4 || dy >= 6) {
          ringBuildings += Number(code === CITY_TILE.BUILDING);
        }
      }
    }
    expect(innerWalkable / innerCells).toBeGreaterThan(0.9);
    expect(ringBuildings).toBeGreaterThan(35);
  });

  it('하카타역은 대형 건물 footprint와 서측 앞광장을 함께 둔다', () => {
    const [cx, cy] = byId(FUKUOKA_GEO.stations, 'hakata').tile;
    let buildings = 0;
    let plazas = 0;
    for (let y = cy - 12; y <= cy + 12; y += 1) {
      for (let x = cx - 14; x <= cx + 9; x += 1) {
        const code = FUKUOKA_GEO.terrain[y * FUKUOKA_GEO.meta.grid.w + x];
        buildings += Number(code === CITY_TILE.BUILDING);
        if (x < cx - 2) plazas += Number(code === CITY_TILE.PLAZA);
      }
    }
    expect(buildings).toBeGreaterThan(80);
    expect(plazas).toBeGreaterThan(50);
    expect(isCityBlocked(terrainAt([cx, cy]))).toBe(false);
  });

  it('다리를 통해 모든 POI·역과 전체 보행 타일이 단일 컴포넌트에 연결된다', () => {
    const tenjin = byId(FUKUOKA_GEO.stations, 'tenjin');
    const seen = reachableFrom(FUKUOKA_GEO.terrain, tenjin.tile);
    for (const entry of [...FUKUOKA_GEO.pois, ...FUKUOKA_GEO.stations]) {
      const index = tileIndex(entry.tile);
      expect(isCityBlocked(FUKUOKA_GEO.terrain[index]), entry.id).toBe(false);
      expect(seen[index], entry.id).toBe(1);
      const [x, y] = entry.tile;
      expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= FUKUOKA_GEO.meta.grid.w || ny >= FUKUOKA_GEO.meta.grid.h) return false;
        return !isCityBlocked(FUKUOKA_GEO.terrain[ny * FUKUOKA_GEO.meta.grid.w + nx]);
      }), entry.id).toBe(true);
    }

    let walkable = 0;
    let reached = 0;
    for (let i = 0; i < FUKUOKA_GEO.terrain.length; i += 1) {
      if (isCityBlocked(FUKUOKA_GEO.terrain[i])) continue;
      walkable += 1;
      reached += seen[i];
    }
    expect(reached).toBe(walkable);
  });
});

describe('생성 결정성·오프라인 계약', () => {
  it('재생성 결과와 커밋 산출물의 데이터 해시가 같다', () => {
    const first = buildFukuokaGeo();
    const second = buildFukuokaGeo();
    expect(terrainHash(first.terrain)).toBe(terrainHash(second.terrain));
    expect(terrainHash(first.terrain)).toBe(terrainHash(FUKUOKA_GEO.terrain));
    expect(first.pois).toEqual(FUKUOKA_GEO.pois);
    expect(first.stations).toEqual(FUKUOKA_GEO.stations);
  });

  it('RLE 왕복이 전체 98,552개 타일을 보존한다', () => {
    const runs = encodeTerrainRle(FUKUOKA_GEO.terrain);
    expect(decodeTerrainRle(runs, FUKUOKA_GEO.terrain.length)).toEqual(FUKUOKA_GEO.terrain);
    expect(runs.length).toBeLessThan(FUKUOKA_GEO.terrain.length / 3);
  });

  it('런타임 산출물·생성기·스냅샷 모두 네트워크 fetch를 포함하지 않는다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/fukuoka.geo.js', import.meta.url), 'utf8');
    const generatorSource = fs.readFileSync(new URL('../../../../scripts/build-fukuoka-geo.mjs', import.meta.url), 'utf8');
    const snapshotSource = fs.readFileSync(new URL('../../../../scripts/data/fukuoka-osm-v21.json', import.meta.url), 'utf8');
    expect(generatedSource).not.toMatch(/\bfetch\s*\(/);
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/);
    expect(snapshotSource).not.toMatch(/\bfetch\s*\(/);
  });
});
