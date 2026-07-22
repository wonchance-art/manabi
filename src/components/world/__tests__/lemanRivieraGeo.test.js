import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildLemanRivieraCityGeo,
} from '../../../../scripts/build-leman-riviera-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { LEMAN_RIVIERA_GEO } from '../cities/leman-riviera.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'lausanne-cathedral',
  'lausanne-gare',
  'flon',
  'ouchy',
  'lutry-vieux-bourg',
  'cully',
  'epesses-lavaux',
  'st-saphorin',
  'vevey-grande-place',
  'montreux-quai',
  'chillon',
  'vevey-marche',
]);
const STATION_IDS = Object.freeze([
  'lausanne',
  'lutry',
  'cully',
  'rivaz',
  'vevey',
  'montreux',
  'veytaux-chillon',
]);
const FERRY_STOP_IDS = Object.freeze([
  'ouchy-landing',
  'cully-landing',
  'vevey-landing',
  'montreux-landing',
  'chillon-landing',
]);
const STATION_SPEC_TILES = Object.freeze([
  [112, 130],
  [332, 172],
  [485, 275],
  [665, 343],
  [934, 430],
  [1191, 578],
  [1254, 690],
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);

const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});

const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = LEMAN_RIVIERA_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction)
        / LEMAN_RIVIERA_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction)
        / LEMAN_RIVIERA_GEO.meta.metersPerTile,
    ];
  };
};

function ferryAdjacency() {
  const { w } = LEMAN_RIVIERA_GEO.meta.grid;
  const stopIndexes = new Map(LEMAN_RIVIERA_GEO.transitPoints.map(({ id, tile }) => (
    [id, tile[1] * w + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of LEMAN_RIVIERA_GEO.meta.connectivity.ferryLinks) {
    for (let offset = 1; offset < stopIds.length; offset += 1) {
      const left = stopIndexes.get(stopIds[offset - 1]);
      const right = stopIndexes.get(stopIds[offset]);
      if (!adjacency.has(left)) adjacency.set(left, []);
      if (!adjacency.has(right)) adjacency.set(right, []);
      adjacency.get(left).push(right);
      adjacency.get(right).push(left);
    }
  }
  return adjacency;
}

function reachableFrom(startTile, withFerry = false) {
  const { w, h } = LEMAN_RIVIERA_GEO.meta.grid;
  const seen = new Uint8Array(LEMAN_RIVIERA_GEO.terrain.length);
  const queue = new Int32Array(LEMAN_RIVIERA_GEO.terrain.length);
  const adjacency = withFerry ? ferryAdjacency() : new Map();
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    for (const other of adjacency.get(index) ?? []) {
      if (!seen[other]) {
        seen[other] = 1;
        queue[tail++] = other;
      }
    }
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(LEMAN_RIVIERA_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function railwayDistance(tile, maxRadius = 24) {
  const { w, h } = LEMAN_RIVIERA_GEO.meta.grid;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (LEMAN_RIVIERA_GEO.railways.mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function waterfrontDistance(tile, maxRadius = 32) {
  const { w, h } = LEMAN_RIVIERA_GEO.meta.grid;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const code = LEMAN_RIVIERA_GEO.terrain[y * w + x];
        if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) return radius;
      }
    }
  }
  return Infinity;
}

function renderLemanRivieraPng(geo) {
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

describe('레만호 연안 상세 geo 계약', () => {
  it('오너 확정 bbox·20m·프랑스어 schema·로잔 입구를 고정한다', () => {
    expect(LEMAN_RIVIERA_GEO.meta).toMatchObject({
      city: 'leman-riviera',
      bbox: [6.6, 46.4, 6.95, 46.54],
      grid: { w: 1342, h: 780 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.688734286451,
      contentLocale: 'fr',
      schema: {
        nameField: 'nameFr',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: '48c729a8768ab4f9a53ad3b4f26884c1f0f364e34b2731971ddad2bf7fa96e61',
        snapshotSha256: 'cf9ab247c4d36ec699e2d5cf6885675b3c8cfc74d95c98405a7943e93b35f36f',
        license: 'ODbL 1.0',
        partitionCount: 16,
        queryCount: 48,
      },
      hydrology: {
        lake: 'Lac Léman',
        sourceWaterTileCount: 523_786,
        finalWaterTileCount: 523_505,
        profileGate: 'report-only-round-1',
      },
    });
    expect(LEMAN_RIVIERA_GEO.terrain).toHaveLength(1_046_760);
    expect(LEMAN_RIVIERA_GEO.entrance).toEqual({ x: 112, y: 130, facing: 'down' });
    expect(LEMAN_RIVIERA_GEO.exitTiles).toEqual([[112, 120], [112, 121]]);
  });

  it('POI 12·CFF 역 7·CGN 도선 정류장 5의 원좌표와 nameFr를 보존한다', () => {
    expect(LEMAN_RIVIERA_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(LEMAN_RIVIERA_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    expect(LEMAN_RIVIERA_GEO.transitPoints.map(({ id }) => id)).toEqual(FERRY_STOP_IDS);
    expect(LEMAN_RIVIERA_GEO.stations.map(({ specTile }) => specTile))
      .toEqual(STATION_SPEC_TILES);
    const project = projector();
    for (const entry of LEMAN_RIVIERA_GEO.pois) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      const error = Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]);
      expect(error, entry.id).toBeCloseTo(entry.alignmentDeltaTiles, 2);
      expect(error, entry.id).toBeLessThanOrEqual(18);
      expect(entry.contentLocale, entry.id).toBe('fr');
      expect(entry.nameFr, entry.id).toBeTruthy();
      expect(entry, entry.id).not.toHaveProperty('nameEn');
      if (entry.id === 'st-saphorin') {
        expect(entry.nameKo).toBe('생사포랭 전망(코르니슈)');
      } else {
        expect(entry, entry.id).not.toHaveProperty('nameKo');
      }
    }
    expect(byId(LEMAN_RIVIERA_GEO.pois, 'epesses-lavaux').alignmentDeltaTiles)
      .toBe(0.617);
    expect(byId(LEMAN_RIVIERA_GEO.pois, 'st-saphorin').alignmentDeltaTiles)
      .toBe(0.771);
    expect(byId(LEMAN_RIVIERA_GEO.pois, 'vevey-grande-place').tile)
      .not.toEqual(byId(LEMAN_RIVIERA_GEO.pois, 'vevey-marche').tile);
  });

  it('독립 마커 이격 3타일과 POI 연결 정류장 공유를 동시에 고정한다', () => {
    const independent = [
      ...LEMAN_RIVIERA_GEO.pois,
      ...LEMAN_RIVIERA_GEO.stations.filter(({ poiId }) => !poiId),
      ...LEMAN_RIVIERA_GEO.transitPoints.filter(({ poiId }) => !poiId),
    ];
    for (let left = 0; left < independent.length; left += 1) {
      for (let right = left + 1; right < independent.length; right += 1) {
        const distance = Math.max(
          Math.abs(independent[left].tile[0] - independent[right].tile[0]),
          Math.abs(independent[left].tile[1] - independent[right].tile[1]),
        );
        expect(distance, `${independent[left].id}/${independent[right].id}`)
          .toBeGreaterThanOrEqual(3);
      }
    }
    expect(byId(LEMAN_RIVIERA_GEO.stations, 'lausanne').tile)
      .toEqual(byId(LEMAN_RIVIERA_GEO.pois, 'lausanne-gare').tile);
    for (const stop of LEMAN_RIVIERA_GEO.transitPoints) {
      expect(stop.tile).toEqual(byId(LEMAN_RIVIERA_GEO.pois, stop.poiId).tile);
    }
  });

  it('CFF 심플론 7역의 순서·철도 마스크 정합과 fast-travel을 고정한다', () => {
    expect(LEMAN_RIVIERA_GEO.meta.transitSystems[0]).toEqual({
      id: 'cff-simplon',
      mode: 'train',
      nameFr: 'Ligne du Simplon',
      stopIds: STATION_IDS,
    });
    expect(LEMAN_RIVIERA_GEO.stations.map(({ tile }) => railwayDistance(tile)))
      .toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(LEMAN_RIVIERA_GEO.stations.map(({ railAlignmentDeltaTiles }) => (
      railAlignmentDeltaTiles
    ))).toEqual([0, 12.53, 11.402, 13.454, 1, 1, 3]);
    expect(fastTravelDestinations(LEMAN_RIVIERA_GEO.stations, 'lausanne')
      .map(({ id }) => id)).toEqual(STATION_IDS.slice(1));
  });

  it('CGN 도선 10호를 인접 4개 edge와 호안 정류장으로 고정한다', () => {
    expect(LEMAN_RIVIERA_GEO.meta.transitSystems[1]).toEqual({
      id: 'cgn-belle-epoque-10',
      mode: 'ferry',
      serviceNumber: 10,
      nameFr: 'CGN Belle Époque',
      stopIds: FERRY_STOP_IDS,
    });
    expect(LEMAN_RIVIERA_GEO.meta.connectivity.ferryLinks).toEqual([
      {
        id: 'cgn-belle-epoque-10',
        mode: 'ferry',
        serviceNumber: 10,
        stopIds: FERRY_STOP_IDS,
      },
    ]);
    expect([...ferryAdjacency().values()].reduce((sum, entries) => sum + entries.length, 0))
      .toBe(8);
    expect(LEMAN_RIVIERA_GEO.transitPoints.map(({ tile }) => waterfrontDistance(tile)))
      .toEqual([3, 7, 8, 4, 1]);
  });

  it('남안 성분은 억지 연결하지 않고 ferry-aware BFS만 북안 두 성분을 잇는다', () => {
    const mainTile = byId(LEMAN_RIVIERA_GEO.stations, 'lausanne').tile;
    const landSeen = reachableFrom(mainTile);
    const ferrySeen = reachableFrom(mainTile, true);
    const chillon = byId(LEMAN_RIVIERA_GEO.pois, 'chillon');
    const chillonIndex = chillon.tile[1] * LEMAN_RIVIERA_GEO.meta.grid.w + chillon.tile[0];
    expect(landSeen[chillonIndex]).toBe(0);
    expect(ferrySeen[chillonIndex]).toBe(1);
    expect(landSeen.reduce((sum, value) => sum + value, 0)).toBe(28_827);
    expect(ferrySeen.reduce((sum, value) => sum + value, 0)).toBe(346_379);
    expect(LEMAN_RIVIERA_GEO.meta.connectivity).toMatchObject({
      protectedLandComponentSizes: [317_552, 28_827],
      southShorePolicy: 'report-only-no-forced-connection',
      southShoreComponentCount: 18,
      southShoreTileCount: 11_877,
      largestSouthShoreComponentSize: 8_054,
      cardinalComponentCount: 2_489,
    });
    for (const entry of [
      ...LEMAN_RIVIERA_GEO.pois,
      ...LEMAN_RIVIERA_GEO.stations,
      ...LEMAN_RIVIERA_GEO.transitPoints,
    ]) {
      const index = entry.tile[1] * LEMAN_RIVIERA_GEO.meta.grid.w + entry.tile[0];
      expect(ferrySeen[index], entry.id).toBe(1);
    }
    expect(LEMAN_RIVIERA_GEO.meta.connectivity.ferryAwareReachableTiles)
      .toBeLessThan(LEMAN_RIVIERA_GEO.terrain.length);
  });

  it('레만호 수계·MOUNTAIN·BRIDGE 0과 report-only 건물 비중을 보존한다', () => {
    const counts = {};
    for (const code of LEMAN_RIVIERA_GEO.terrain) {
      counts[code] = (counts[code] || 0) + 1;
    }
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 108_869,
      [CITY_TILE.SIDEWALK]: 264_470,
      [CITY_TILE.CROSSWALK]: 2_506,
      [CITY_TILE.PARK]: 1_660,
      [CITY_TILE.WATER]: 523_505,
      [CITY_TILE.BUILDING]: 13_096,
      [CITY_TILE.RIVER]: 14_191,
      [CITY_TILE.MOUNTAIN]: 118_463,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(LEMAN_RIVIERA_GEO.railways.tileCount).toBe(4_760);
    expect(LEMAN_RIVIERA_GEO.meta.buildingTexture).toMatchObject({
      method: 'osm-existing-buildings-report-only',
      initialLandBuildingRatio: 0.02573,
      finalLandBuildingRatio: 0.025726,
    });
    expect(LEMAN_RIVIERA_GEO.meta.bridgeNormalization).toMatchObject({
      method: 'france-bridge-three-way-v1',
      sourceBridgeTileCount: 767,
      roadTileCount: 662,
      finalBridgeTileCount: 0,
    });
  });

  it('민감 장소는 건축·지리만 남기고 브랜드·행사·콘텐츠 필드를 노출하지 않는다', () => {
    expect(byId(LEMAN_RIVIERA_GEO.pois, 'chillon').representationPolicy)
      .toBe('architectural-exterior-and-geography-only');
    expect(byId(LEMAN_RIVIERA_GEO.pois, 'montreux-quai').representationPolicy)
      .toContain('no-event-or-festival-reproduction');
    expect(byId(LEMAN_RIVIERA_GEO.pois, 'vevey-marche').representationPolicy)
      .toContain('no-brand-or-company-reproduction');
    for (const entry of LEMAN_RIVIERA_GEO.pois) {
      for (const field of [
        'desc',
        'narrative',
        'story',
        'event',
        'festival',
        'brand',
        'company',
        'person',
        'artwork',
        'door',
      ]) {
        expect(entry, `${entry.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = LEMAN_RIVIERA_GEO.meta.grid.w * LEMAN_RIVIERA_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      LEMAN_RIVIERA_GEO.meta.grid.w,
      LEMAN_RIVIERA_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 2,
      sourceWidth: 671,
      sourceHeight: 390,
      width: 2_013,
      height: 1_170,
      backingBytes: 9_420_840,
    });
    expect(estimatedPeakBytes).toBe(14_654_640);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildLemanRivieraCityGeo();
    const second = buildLemanRivieraCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('06cf2c0ecfeeaff08c5d5cb43366653440f13aa0a669ec0394e81bdbbe447768');
    expect(hash(first.railways.mask))
      .toBe('88378a12b1032f6769b72f13c1121226c421251380537ffe668f75a6e655d4bb');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(139_840);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(3_581);
    expect(first.pois).toEqual(LEMAN_RIVIERA_GEO.pois);
    expect(first.stations).toEqual(LEMAN_RIVIERA_GEO.stations);
    expect(first.transitPoints).toEqual(LEMAN_RIVIERA_GEO.transitPoints);
    const firstPng = renderLemanRivieraPng(first);
    const secondPng = renderLemanRivieraPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('8ee0e4d6e2f42aa0e185ff3928bfd519f46cd257d1cbf25e134b05133821d173');
  }, 120_000);
});
