import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildBordeauxCityGeo } from '../../../../scripts/build-bordeaux-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { BORDEAUX_GEO } from '../cities/bordeaux.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const POI_SPEC = Object.freeze({
  'place-de-la-bourse': Object.freeze(['Place de la Bourse', '부르스 광장(물의 거울)', -0.5693, 44.8414]),
  'grosse-cloche': Object.freeze(['Grosse Cloche', '그로스 클로슈 종루', -0.5714, 44.8360]),
  'cathedrale-saint-andre': Object.freeze(['Cathédrale Saint-André', '생탕드레 대성당', -0.5776, 44.8378]),
  'place-des-quinconces': Object.freeze(['Place des Quinconces', '캥콩스 광장', -0.5740, 44.8450]),
  'cite-du-vin': Object.freeze(['La Cité du Vin', '와인 문화관', -0.5500, 44.8620]),
  'rue-sainte-catherine': Object.freeze(['Rue Sainte-Catherine', '생트카트린 거리', -0.5730, 44.8390]),
  'pont-de-pierre': Object.freeze(['Pont de Pierre', '피에르 다리', -0.5620, 44.8380]),
  'jardin-public': Object.freeze(['Jardin Public', '퍼블릭 정원', -0.5770, 44.8480]),
  chartrons: Object.freeze(['Les Chartrons', '샤르트롱(와인 상인 지구)', -0.5710, 44.8530]),
});
const STATION_SPEC = Object.freeze({
  'bordeaux-saint-jean': Object.freeze(['Bordeaux-Saint-Jean', -0.5560, 44.8256]),
});
const hash = (value) => createHash('sha256').update(value).digest('hex');

function projector() {
  const [minLon, minLat, maxLon, maxLat] = BORDEAUX_GEO.meta.bbox;
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
      ((point.x - southWest.x) * correction) / BORDEAUX_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / BORDEAUX_GEO.meta.metersPerTile,
    ];
  };
}

function byId(entries, id) {
  return entries.find((entry) => entry.id === id);
}

function reachableFrom(startTile) {
  const { w, h } = BORDEAUX_GEO.meta.grid;
  const seen = new Uint8Array(BORDEAUX_GEO.terrain.length);
  const queue = new Int32Array(BORDEAUX_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(BORDEAUX_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function horizontalWaterRuns(y) {
  const { w } = BORDEAUX_GEO.meta.grid;
  const runs = [];
  let start = -1;
  for (let x = 0; x < w; x += 1) {
    const code = BORDEAUX_GEO.terrain[y * w + x];
    const water = code === CITY_TILE.WATER || code === CITY_TILE.RIVER;
    if (water && start < 0) start = x;
    if (!water && start >= 0) {
      if (x - start >= 2) runs.push([start, x - 1, (x - start) * 20]);
      start = -1;
    }
  }
  if (start >= 0 && w - start >= 2) runs.push([start, w - 1, (w - start) * 20]);
  return runs;
}

function railwayDistance(tile) {
  const { w, h } = BORDEAUX_GEO.meta.grid;
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x >= 0 && y >= 0 && x < w && y < h
          && BORDEAUX_GEO.railways.mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function renderBordeauxPng(geo) {
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

describe('보르도 상세 geo 계약', () => {
  it('확정 bbox·20m·프랑스어 schema·Saint-Jean 입구를 고정한다', () => {
    expect(BORDEAUX_GEO.meta).toMatchObject({
      city: 'bordeaux',
      bbox: [-0.64, 44.79, -0.52, 44.88],
      grid: { w: 474, h: 501 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.709140167628,
      contentLocale: 'fr',
      schema: {
        nameField: 'nameFr',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: 'bfec6174d85064d3263109d6c69ae248fa30f72b34434b3a7ee0089f245747e9',
        snapshotSha256: 'b83388fb45e662778cea4ea6ba35e49909892bcb0ddbe621eec7eb614ce8ad38',
        partitionCount: 16,
        queryCount: 48,
        license: 'ODbL 1.0',
      },
      connectivity: {
        method: 'cardinal-land-no-water-carving-v1',
        initialComponentCount: 368,
        connectedComponentCount: 0,
        collapsedSmallComponentCount: 367,
        carvedRoadTileCount: 0,
        finalComponentCount: 1,
        walkableTileCount: 190_787,
        reachedTileCount: 190_787,
      },
    });
    expect(BORDEAUX_GEO.terrain).toHaveLength(237_474);
    expect(BORDEAUX_GEO.entrance).toEqual({ x: 331, y: 302, facing: 'down' });
    expect(BORDEAUX_GEO.exitTiles).toEqual([[331, 292], [331, 293]]);
  });

  it('POI 9종·표시 전용 역 1종의 exact 명칭·좌표와 150m 이내 스냅을 보존한다', () => {
    expect(BORDEAUX_GEO.pois.map(({ id }) => id)).toEqual(Object.keys(POI_SPEC));
    expect(BORDEAUX_GEO.stations.map(({ id }) => id)).toEqual(Object.keys(STATION_SPEC));
    const project = projector();
    for (const [id, [nameFr, nameKo, lon, lat]] of Object.entries(POI_SPEC)) {
      expect(byId(BORDEAUX_GEO.pois, id)).toMatchObject({
        id, nameFr, nameKo, lon, lat, contentLocale: 'fr',
      });
    }
    for (const [id, [nameFr, lon, lat]] of Object.entries(STATION_SPEC)) {
      const entry = byId(BORDEAUX_GEO.stations, id);
      expect(entry).toMatchObject({
        id, nameFr, lon, lat, contentLocale: 'fr', displayOnly: true,
      });
      expect(railwayDistance(entry.tile), id).toBe(0);
    }
    const entries = [...BORDEAUX_GEO.pois, ...BORDEAUX_GEO.stations];
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

  it('가론강 초승달 곡류·피에르 다리 단면·BRIDGE=0을 보존한다', () => {
    expect(BORDEAUX_GEO.meta.hydrology).toEqual({
      river: 'Garonne',
      shape: 'crescent-meander',
      sourceWaterTileCount: 15_735,
      sourceRiverTileCount: 3_063,
      finalWaterTileCount: 13_199,
      finalRiverTileCount: 2_942,
      bridgeMarkerAccess: {
        method: 'pont-de-pierre-cardinal-road-access-v1',
        carvedTileCount: 3,
      },
      profileGate: 'garonne-crescent-and-pont-de-pierre',
    });
    expect(horizontalWaterRuns(60)).toContainEqual([379, 402, 480]);
    expect(horizontalWaterRuns(120)).toEqual([[331, 345, 300], [350, 367, 360]]);
    expect(horizontalWaterRuns(180)).toEqual([[277, 295, 380]]);
    expect(horizontalWaterRuns(300)).toEqual([[371, 406, 720]]);
    expect(horizontalWaterRuns(360)).toEqual([[414, 440, 540]]);
    expect(horizontalWaterRuns(233)).toContainEqual([291, 302, 240]);
    expect(horizontalWaterRuns(233)).toContainEqual([308, 320, 260]);
    expect(BORDEAUX_GEO.terrain).not.toContain(CITY_TILE.BRIDGE);
  });

  it('모든 마커·보행 타일이 단일 4방 성분에 속한다', () => {
    const seen = reachableFrom(BORDEAUX_GEO.stations[0].tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < BORDEAUX_GEO.terrain.length; index += 1) {
      if (isCityBlocked(BORDEAUX_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect({ walkable, reached }).toEqual({ walkable: 190_787, reached: 190_787 });
    for (const entry of [...BORDEAUX_GEO.pois, ...BORDEAUX_GEO.stations]) {
      expect(seen[entry.tile[1] * BORDEAUX_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('단독역은 표시 전용이며 fast-travel 목적지를 만들지 않는다', () => {
    expect(BORDEAUX_GEO.stations[0]).toMatchObject({
      id: 'bordeaux-saint-jean',
      line: 'Grandes lignes',
      displayOnly: true,
    });
    expect(fastTravelDestinations(BORDEAUX_GEO.stations, 'bordeaux-saint-jean')).toEqual([]);
    expect(BORDEAUX_GEO.railways.tileCount).toBe(6_612);
  });

  it('지형 질량·report-only 건물·일반 지명 정책을 고정한다', () => {
    const counts = {};
    for (const code of BORDEAUX_GEO.terrain) counts[code] = (counts[code] ?? 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 94_217,
      [CITY_TILE.SIDEWALK]: 77_327,
      [CITY_TILE.CROSSWALK]: 8_167,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 11_074,
      [CITY_TILE.WATER]: 13_199,
      [CITY_TILE.BUILDING]: 30_546,
      [CITY_TILE.RIVER]: 2_942,
    });
    expect(BORDEAUX_GEO.meta.buildingTexture).toMatchObject({
      method: 'osm-existing-buildings-report-only',
      initialLandBuildingRatio: 0.132503,
      finalLandBuildingRatio: 0.138009,
    });
    expect(BORDEAUX_GEO.meta.contentPolicy.chateauBrandAndMerchantReproduction)
      .toBe('excluded');
  });

  it('적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const layout = cityMinimapLayout(BORDEAUX_GEO.meta.grid.w, BORDEAUX_GEO.meta.grid.h);
    const cells = BORDEAUX_GEO.meta.grid.w * BORDEAUX_GEO.meta.grid.h;
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedPeakBytes = cells * 3 + layout.backingBytes + sourceCanvasBytes * 2;
    expect(layout).toEqual({
      factor: 1,
      sourceWidth: 474,
      sourceHeight: 501,
      width: 1_422,
      height: 1_503,
      backingBytes: 8_549_064,
    });
    expect(estimatedPeakBytes).toBe(11_161_278);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildBordeauxCityGeo();
    const second = buildBordeauxCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('5494402cf147865484f35a5d76d42592622900d78cb6ab47f1500e6904a6548a');
    expect(hash(first.railways.mask))
      .toBe('6e814e74ba7b449763f04698d68e140c38a148b6150eeeaa933f6f71c28dc2b6');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(103_792);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(6_073);
    expect(first.pois).toEqual(BORDEAUX_GEO.pois);
    expect(first.stations).toEqual(BORDEAUX_GEO.stations);
    const firstPng = renderBordeauxPng(first);
    const secondPng = renderBordeauxPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('26f08135d27d606b24c14cf4d45accc95689e07376217fbd5cd8e36ae83320eb');
  }, 120_000);
});
