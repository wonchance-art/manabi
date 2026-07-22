import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildLyonCityGeo } from '../../../../scripts/build-lyon-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { LYON_GEO } from '../cities/lyon.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const POI_SPEC = Object.freeze({
  fourviere: Object.freeze(['Basilique de Fourvière', '푸르비에르 대성당', 4.8220, 45.7623]),
  'vieux-lyon': Object.freeze(['Vieux Lyon', '리옹 구시가', 4.8270, 45.7605]),
  bellecour: Object.freeze(['Place Bellecour', '벨쿠르 광장', 4.8320, 45.7578]),
  terreaux: Object.freeze(['Place des Terreaux', '테로 광장', 4.8345, 45.7675]),
  'croix-rousse': Object.freeze(['La Croix-Rousse', '크루아루스', 4.8320, 45.7745]),
  confluence: Object.freeze(['La Confluence', '콘플루앙스', 4.8180, 45.7330]),
  'tete-dor': Object.freeze(["Parc de la Tête d'Or", '테트도르 공원', 4.8520, 45.7775]),
  halles: Object.freeze(['Halles de Lyon', '리옹 중앙시장', 4.8500, 45.7630]),
  opera: Object.freeze(['Opéra de Lyon', '리옹 오페라', 4.8367, 45.7677]),
});
const STATION_SPEC = Object.freeze({
  'part-dieu': Object.freeze(['Lyon-Part-Dieu', 4.8595, 45.7606]),
  perrache: Object.freeze(['Lyon-Perrache', 4.8260, 45.7485]),
});
const hash = (value) => createHash('sha256').update(value).digest('hex');

function projector() {
  const [minLon, minLat, maxLon, maxLat] = LYON_GEO.meta.bbox;
  const webMercator = (lon, lat) => ({
    x: EARTH_RADIUS * lon * DEG,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
  });
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / LYON_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / LYON_GEO.meta.metersPerTile,
    ];
  };
}

function byId(entries, id) {
  return entries.find((entry) => entry.id === id);
}

function reachableFrom(startTile) {
  const { w, h } = LYON_GEO.meta.grid;
  const seen = new Uint8Array(LYON_GEO.terrain.length);
  const queue = new Int32Array(LYON_GEO.terrain.length);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(LYON_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function horizontalWaterRuns(lat) {
  const project = projector();
  const y = Math.floor(project(LYON_GEO.meta.bbox[0], lat)[1]);
  const runs = [];
  let start = -1;
  for (let x = 0; x < LYON_GEO.meta.grid.w; x += 1) {
    const code = LYON_GEO.terrain[y * LYON_GEO.meta.grid.w + x];
    const water = code === CITY_TILE.WATER || code === CITY_TILE.RIVER;
    if (water && start < 0) start = x;
    if (!water && start >= 0) {
      if (x - start >= 2) runs.push([start, x - 1, (x - start) * 20]);
      start = -1;
    }
  }
  if (start >= 0) {
    runs.push([start, LYON_GEO.meta.grid.w - 1, (LYON_GEO.meta.grid.w - start) * 20]);
  }
  return { y, runs };
}

function railwayDistance(tile) {
  const { w, h } = LYON_GEO.meta.grid;
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x >= 0 && y >= 0 && x < w && y < h
          && LYON_GEO.railways.mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function renderLyonPng(geo) {
  return renderCityPng({
    cols: geo.meta.grid.w,
    rows: geo.meta.grid.h,
    buildGrid: () => geo.terrain,
    railways: geo.railways,
    stations: geo.stations,
    nodes: geo.pois,
    entrance: geo.entrance,
  });
}

describe('리옹 상세 geo 계약', () => {
  it('확정 bbox·20m·프랑스어 schema·Part-Dieu 입구를 고정한다', () => {
    expect(LYON_GEO.meta).toMatchObject({
      city: 'lyon',
      bbox: [4.79, 45.71, 4.90, 45.80],
      grid: { w: 428, h: 501 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.697727948048,
      contentLocale: 'fr',
      schema: {
        nameField: 'nameFr',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: '6f3511956d95e2cfd3e5de183a34110234027c3226336027b94be5f38f3e3147',
        snapshotSha256: 'f49e5b1ec1d28f65a47dea4e8b1018959c4546f77804f205cbf77827302cac53',
        partitionCount: 16,
        queryCount: 48,
        license: 'ODbL 1.0',
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.133981,
        finalLandBuildingRatio: 0.14605,
      },
      connectivity: {
        method: 'cardinal-land-no-water-carving-v1',
        initialComponentCount: 452,
        connectedComponentCount: 1,
        collapsedSmallComponentCount: 450,
        carvedRoadTileCount: 2,
        finalComponentCount: 1,
        walkableTileCount: 165_074,
        reachedTileCount: 165_074,
      },
    });
    expect(LYON_GEO.terrain).toHaveLength(214_428);
    expect(LYON_GEO.entrance).toEqual({ x: 270, y: 219, facing: 'down' });
    expect(LYON_GEO.exitTiles).toEqual([[270, 209], [270, 210]]);
  });

  it('POI 9종·역 2종의 exact 명칭·좌표와 150m 이내 스냅을 보존한다', () => {
    expect(LYON_GEO.pois.map(({ id }) => id)).toEqual(Object.keys(POI_SPEC));
    expect(LYON_GEO.stations.map(({ id }) => id)).toEqual(Object.keys(STATION_SPEC));
    const project = projector();
    for (const [id, [nameFr, nameKo, lon, lat]] of Object.entries(POI_SPEC)) {
      const entry = byId(LYON_GEO.pois, id);
      expect(entry).toMatchObject({ id, nameFr, nameKo, lon, lat, contentLocale: 'fr' });
    }
    for (const [id, [nameFr, lon, lat]] of Object.entries(STATION_SPEC)) {
      const entry = byId(LYON_GEO.stations, id);
      expect(entry).toMatchObject({ id, nameFr, lon, lat, contentLocale: 'fr' });
      expect(railwayDistance(entry.tile), id).toBe(0);
    }
    const entries = [...LYON_GEO.pois, ...LYON_GEO.stations];
    for (const entry of entries) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
    }
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const distance = Math.max(
          Math.abs(entries[left].tile[0] - entries[right].tile[0]),
          Math.abs(entries[left].tile[1] - entries[right].tile[1]),
        );
        expect(distance, `${entries[left].id}/${entries[right].id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('론·손 두 강과 남단 합류·BRIDGE=0을 보존한다', () => {
    expect(LYON_GEO.meta.hydrology).toEqual({
      rivers: ['Rhône', 'Saône'],
      confluence: 'south-of-presquile',
      sourceWaterTileCount: 12_696,
      sourceRiverTileCount: 5_135,
      finalWaterTileCount: 8_206,
      finalRiverTileCount: 4_825,
      profileGate: 'two-rivers-and-confluence',
    });
    expect(LYON_GEO.meta.bridgeNormalization).toMatchObject({
      sourceBridgeTileCount: 739,
      componentCount: 92,
      roadComponentCount: 79,
      absorbedComponentCount: 13,
      roadTileCount: 720,
      absorbedWaterTileCount: 2,
      absorbedRiverTileCount: 17,
      finalBridgeTileCount: 0,
    });
    expect(horizontalWaterRuns(45.7603)).toEqual({
      y: 221,
      runs: [[149, 156, 160], [194, 195, 40]],
    });
    expect(horizontalWaterRuns(45.7500)).toEqual({
      y: 278,
      runs: [[111, 121, 220], [164, 173, 200]],
    });
    expect(horizontalWaterRuns(45.7280)).toEqual({
      y: 400,
      runs: [[104, 119, 320]],
    });
    expect(LYON_GEO.terrain).not.toContain(CITY_TILE.BRIDGE);
  });

  it('프레스킬과 모든 마커·보행 타일이 단일 4방 성분에 속한다', () => {
    const seen = reachableFrom(LYON_GEO.stations[0].tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < LYON_GEO.terrain.length; index += 1) {
      if (isCityBlocked(LYON_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect({ walkable, reached }).toEqual({ walkable: 165_074, reached: 165_074 });
    for (const entry of [...LYON_GEO.pois, ...LYON_GEO.stations]) {
      expect(seen[entry.tile[1] * LYON_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
    for (const id of ['bellecour', 'terreaux', 'opera', 'confluence']) {
      const entry = byId(LYON_GEO.pois, id);
      expect(isCityBlocked(
        LYON_GEO.terrain[entry.tile[1] * LYON_GEO.meta.grid.w + entry.tile[0]],
      ), id).toBe(false);
    }
  });

  it('역 2종의 결정적 철도축과 fast-travel을 고정한다', () => {
    expect(LYON_GEO.meta.transitSystems).toEqual([{
      id: 'lyon-mainline',
      mode: 'train',
      nameFr: 'Liaisons ferroviaires lyonnaises',
      stopIds: ['part-dieu', 'perrache'],
    }]);
    for (const station of LYON_GEO.stations) {
      expect(station).toMatchObject({
        routeId: 'lyon-mainline',
        routeIds: ['lyon-mainline'],
      });
    }
    expect(fastTravelDestinations(LYON_GEO.stations, 'part-dieu').map(({ id }) => id))
      .toEqual(['perrache']);
    expect(LYON_GEO.railways.tileCount).toBe(10_047);
  });

  it('지형 질량과 report-only 건물 계약을 고정한다', () => {
    const counts = {};
    for (const code of LYON_GEO.terrain) counts[code] = (counts[code] ?? 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 82_562,
      [CITY_TILE.SIDEWALK]: 68_586,
      [CITY_TILE.CROSSWALK]: 8_311,
      [CITY_TILE.PLAZA]: 4,
      [CITY_TILE.PARK]: 5_611,
      [CITY_TILE.WATER]: 8_206,
      [CITY_TILE.BUILDING]: 29_414,
      [CITY_TILE.RIVER]: 4_825,
      [CITY_TILE.MOUNTAIN]: 6_909,
    });
    expect(LYON_GEO.meta.buildingTexture.method)
      .toBe('osm-existing-buildings-report-only');
  });

  it('적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const layout = cityMinimapLayout(LYON_GEO.meta.grid.w, LYON_GEO.meta.grid.h);
    const cells = LYON_GEO.meta.grid.w * LYON_GEO.meta.grid.h;
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;
    expect(layout).toEqual({
      factor: 1,
      sourceWidth: 428,
      sourceHeight: 501,
      width: 1_284,
      height: 1_503,
      backingBytes: 7_719_408,
    });
    expect(estimatedPeakBytes).toBe(10_078_116);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildLyonCityGeo();
    const second = buildLyonCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('1d3036f8c0d8347946e62f2e08d22152ff07ce6f33b05909d6db3d71335835c9');
    expect(hash(first.railways.mask))
      .toBe('f47e8cf38b72af26b0b93c6943545fb2a278de5f27fc2b7facdd38b5d846d778');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(93_064);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(8_089);
    expect(first.pois).toEqual(LYON_GEO.pois);
    expect(first.stations).toEqual(LYON_GEO.stations);
    const firstPng = renderLyonPng(first);
    const secondPng = renderLyonPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('2d1aac685c8a0bd82e98f210dd2239aeaee4e9acde1b6b71b103d03ab620759e');
  }, 120_000);
});
