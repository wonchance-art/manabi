import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LONDON_GEO } from '../cities/london.geo.js';
import { CITY_TILE, fastTravelDestinations, isCityBlocked } from '../cities/terrain.js';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { buildFrenchCityGeo } from '../../../../scripts/build-french-city-geo.mjs';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'westminster-abbey', 'houses-of-parliament', 'buckingham-palace', 'tower-of-london',
  'tower-bridge', 'st-pauls', 'british-museum', 'trafalgar-square', 'covent-garden',
  'piccadilly-circus', 'london-eye', 'tate-modern', 'borough-market', 'the-shard',
  'camden-town', 'notting-hill', 'hyde-park', 'natural-history-museum', 'greenwich',
  'kew-gardens', 'wimbledon', 'hampstead-heath', 'wembley', 'olympic-park',
]);
const STATION_IDS = Object.freeze([
  'st-pancras', 'kings-cross', 'paddington', 'victoria', 'waterloo',
  'liverpool-street', 'london-bridge', 'westminster', 'greenwich-station',
]);

const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = LONDON_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / LONDON_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / LONDON_GEO.meta.metersPerTile,
    ];
  };
};

function reachableFrom(startTile) {
  const { w, h } = LONDON_GEO.meta.grid;
  const seen = new Uint8Array(LONDON_GEO.terrain.length);
  const queue = new Int32Array(LONDON_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(LONDON_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function thamesSection(lon, latRange) {
  const project = projector();
  const { w } = LONDON_GEO.meta.grid;
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-2, -1, 0, 1, 2]) {
    const x = Math.floor(project(lon, latRange[0])[0]) + offset;
    const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]));
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = LONDON_GEO.terrain[y * w + x];
      if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) {
        sum += 1;
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else run = 0;
    }
    const result = { sumM: sum * 20, runM: maxRun * 20 };
    if (result.sumM > best.sumM || (result.sumM === best.sumM && result.runM > best.runM)) best = result;
  }
  return best;
}

function terrainAt(lon, lat) {
  const [fx, fy] = projector()(lon, lat);
  return LONDON_GEO.terrain[Math.floor(fy) * LONDON_GEO.meta.grid.w + Math.floor(fx)];
}

describe('London 상세 geo 계약', () => {
  it('20m bbox·영어 스키마·St Pancras 입구를 고정한다', () => {
    expect(LONDON_GEO.meta).toMatchObject({
      city: 'london', bbox: [-0.30, 51.42, 0.05, 51.60], grid: { w: 1213, h: 1002 },
      metersPerTile: 20, projection: 'webmercator', aspectCorrection: 0.622378036266,
      contentLocale: 'en', schema: { nameField: 'nameEn', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        finalRatioRange: [0.10, 0.12], generatedTileCount: 0,
        finalLandBuildingRatio: 0.11039,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1', sourceBridgeTileCount: 2_540,
        componentCount: 749, roadComponentCount: 684, absorbedComponentCount: 65,
        roadTileCount: 2_417, absorbedWaterTileCount: 21, absorbedRiverTileCount: 102,
        finalBridgeTileCount: 0,
      },
    });
    expect(LONDON_GEO.terrain).toHaveLength(1_215_426);
    expect(LONDON_GEO.entrance).toEqual({ x: 603, y: 381, facing: 'down' });
    expect(LONDON_GEO.exitTiles).toEqual([[603, 371], [603, 372]]);
  });

  it('POI 24·역 9의 ID·좌표·locale slot과 bounds를 보존한다', () => {
    expect(LONDON_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(LONDON_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...LONDON_GEO.pois, ...LONDON_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(Math.SQRT2);
      expect(entry.contentLocale, entry.id).toBe('en');
      expect(entry.nameEn, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(LONDON_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(LONDON_GEO.meta.grid.h);
    }
    for (const poi of LONDON_GEO.pois) {
      expect(poi.nameKo, poi.id).toBeTruthy();
      expect(poi, poi.id).not.toHaveProperty('desc');
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
  });

  it('국제철도·Circle/District·Jubilee·DLR 축을 역 metadata로 보존한다', () => {
    expect(byId(LONDON_GEO.stations, 'st-pancras').routeIds).toEqual(['london-international']);
    expect(byId(LONDON_GEO.stations, 'westminster').routeIds)
      .toEqual(['circle-district', 'jubilee']);
    expect(byId(LONDON_GEO.stations, 'london-bridge').routeIds)
      .toEqual(['circle-district', 'jubilee']);
    expect(byId(LONDON_GEO.stations, 'greenwich-station').routeIds).toEqual(['dlr']);
    expect(fastTravelDestinations(LONDON_GEO.stations, 'st-pancras')).toHaveLength(8);
  });

  it('최종 terrain 질량과 BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of LONDON_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 471_019, [CITY_TILE.SIDEWALK]: 423_294,
      [CITY_TILE.CROSSWALK]: 31_408, [CITY_TILE.PLAZA]: 29,
      [CITY_TILE.PARK]: 107_656, [CITY_TILE.WATER]: 28_810,
      [CITY_TILE.BUILDING]: 128_249, [CITY_TILE.RIVER]: 24_961,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(LONDON_GEO.railways.tileCount).toBe(52_749);
  });

  it('Thames 2단면과 Westminster·Tower Bridge 차도 pin을 통과한다', () => {
    expect(thamesSection(-0.121, [51.51, 51.49])).toEqual({ sumM: 1_360, runM: 660 });
    expect(thamesSection(-0.0756, [51.515, 51.495])).toEqual({ sumM: 200, runM: 200 });
    expect(terrainAt(-0.1218, 51.5008)).toBe(CITY_TILE.ROAD);
    expect(terrainAt(-0.0754, 51.5055)).toBe(CITY_TILE.ROAD);
  });

  it('POI·역과 모든 보행 타일이 St Pancras 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(byId(LONDON_GEO.stations, 'st-pancras').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < LONDON_GEO.terrain.length; index += 1) {
      if (isCityBlocked(LONDON_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    for (const entry of [...LONDON_GEO.pois, ...LONDON_GEO.stations]) {
      expect(seen[entry.tile[1] * LONDON_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('재생성은 byte-equivalent terrain·railway와 고정 RLE를 만든다', () => {
    const first = buildFrenchCityGeo('london');
    const second = buildFrenchCityGeo('london');
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain)).toBe('7f2f2720f800e3dec2476c22618640d4b13504195ca728c206bf96dfdfa6ae6f');
    expect(hash(first.railways.mask)).toBe('07255586283dcd53c871604936b33ad2e25fab05ad5d13e67276a1a60b9325fb');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(520_062);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(36_049);
    expect(first.pois).toEqual(LONDON_GEO.pois);
    expect(first.stations).toEqual(LONDON_GEO.stations);
  }, 120_000);
});
