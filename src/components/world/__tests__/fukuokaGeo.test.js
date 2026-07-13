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
});

describe('지형 충실도·연결성', () => {
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

  it('해안·세 강·도로·다리·공원·해변·건물·부두 코드를 실제 격자에 포함한다', () => {
    const counts = new Map();
    for (const code of FUKUOKA_GEO.terrain) counts.set(code, (counts.get(code) || 0) + 1);
    for (const code of [
      CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.ROAD, CITY_TILE.BRIDGE,
      CITY_TILE.SIDEWALK, CITY_TILE.PARK, CITY_TILE.BEACH,
      CITY_TILE.BUILDING, CITY_TILE.DOCK, CITY_TILE.PLAZA,
    ]) {
      expect(counts.get(code)).toBeGreaterThan(0);
    }
    expect(counts.get(CITY_TILE.RIVER)).toBeGreaterThan(500);
    expect(counts.get(CITY_TILE.BRIDGE)).toBeGreaterThan(20);
  });

  it('다리를 통해 모든 fast-travel 역이 하나의 보행 컴포넌트에 연결된다', () => {
    const tenjin = byId(FUKUOKA_GEO.stations, 'tenjin');
    const seen = reachableFrom(FUKUOKA_GEO.terrain, tenjin.tile);
    for (const station of FUKUOKA_GEO.stations) {
      const index = station.tile[1] * FUKUOKA_GEO.meta.grid.w + station.tile[0];
      expect(isCityBlocked(FUKUOKA_GEO.terrain[index])).toBe(false);
      expect(seen[index], station.id).toBe(1);
    }

    let mainLand = 0;
    let reachedLand = 0;
    const landCodes = new Set([
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.CROSSWALK,
      CITY_TILE.PLAZA, CITY_TILE.PARK, CITY_TILE.BRIDGE,
    ]);
    for (let i = 0; i < FUKUOKA_GEO.terrain.length; i += 1) {
      if (!landCodes.has(FUKUOKA_GEO.terrain[i])) continue;
      mainLand += 1;
      reachedLand += seen[i];
    }
    expect(reachedLand / mainLand).toBeGreaterThan(0.99);
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
    expect(runs.length).toBeLessThan(FUKUOKA_GEO.terrain.length / 10);
  });

  it('런타임 산출물과 생성기 모두 네트워크 fetch를 포함하지 않는다', () => {
    const generatedSource = fs.readFileSync(new URL('../cities/fukuoka.geo.js', import.meta.url), 'utf8');
    const generatorSource = fs.readFileSync(new URL('../../../../scripts/build-fukuoka-geo.mjs', import.meta.url), 'utf8');
    expect(generatedSource).not.toMatch(/\bfetch\s*\(/);
    expect(generatorSource).not.toMatch(/\bfetch\s*\(/);
  });
});
