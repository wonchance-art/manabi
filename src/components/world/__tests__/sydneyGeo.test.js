import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildSydneyCityGeo } from '../../../../scripts/build-sydney-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { SYDNEY_GEO } from '../cities/sydney.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'opera-house',
  'harbour-bridge',
  'the-rocks',
  'circular-quay',
  'royal-botanic-garden',
  'darling-harbour',
  'barangaroo',
  'qvb',
  'chinatown',
  'newtown-king-st',
  'paddington',
  'bondi-beach',
  'manly',
  'watsons-bay',
]);
const STATION_IDS = Object.freeze([
  'central',
  'town-hall',
  'circular-quay-station',
  'martin-place',
  'bondi-junction',
]);
const FERRY_STOP_IDS = Object.freeze([
  'circular-quay-ferry',
  'manly-ferry',
  'taronga-ferry',
  'watsons-bay-ferry',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = SYDNEY_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / SYDNEY_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / SYDNEY_GEO.meta.metersPerTile,
    ];
  };
};

function ferryAdjacency() {
  const { w } = SYDNEY_GEO.meta.grid;
  const stopIndex = new Map(SYDNEY_GEO.transitPoints.map(({ id, tile }) => (
    [id, tile[1] * w + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of SYDNEY_GEO.meta.connectivity.ferryLinks) {
    const [left, right] = stopIds.map((id) => stopIndex.get(id));
    if (!adjacency.has(left)) adjacency.set(left, []);
    if (!adjacency.has(right)) adjacency.set(right, []);
    adjacency.get(left).push(right);
    adjacency.get(right).push(left);
  }
  return adjacency;
}

function reachableWithFerries(startTile) {
  const { w, h } = SYDNEY_GEO.meta.grid;
  const seen = new Uint8Array(SYDNEY_GEO.terrain.length);
  const queue = new Int32Array(SYDNEY_GEO.terrain.length);
  const adjacency = ferryAdjacency();
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
      if (seen[next] || isCityBlocked(SYDNEY_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const { w, h } = SYDNEY_GEO.meta.grid;
  const seen = new Uint8Array(SYDNEY_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < SYDNEY_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(SYDNEY_GEO.terrain[start])) continue;
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      const x = index % w;
      const y = Math.floor(index / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const next = ny * w + nx;
        if (seen[next] || isCityBlocked(SYDNEY_GEO.terrain[next])) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    sizes.push(queue.length);
  }
  return sizes.sort((left, right) => right - left);
}

function verticalWaterSection(lon, latRange) {
  const project = projector();
  const { w } = SYDNEY_GEO.meta.grid;
  const centerX = Math.floor(project(lon, latRange[0])[0]);
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = SYDNEY_GEO.terrain[y * w + centerX + offset];
      if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) {
        sum += 1;
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else run = 0;
    }
    const result = { sumM: sum * 20, runM: maxRun * 20 };
    if (result.sumM > best.sumM
      || (result.sumM === best.sumM && result.runM > best.runM)) best = result;
  }
  return best;
}

function hasRoadNear(lon, lat, radius = 6) {
  const [centerX, centerY] = projector()(lon, lat).map(Math.floor);
  const { w, h } = SYDNEY_GEO.meta.grid;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const code = SYDNEY_GEO.terrain[y * w + x];
      if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK) return true;
    }
  }
  return false;
}

function renderSydneyPng(geo) {
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

describe('Sydney 상세 geo 계약', () => {
  it('오너 확정 20m bbox·영어 schema·남반구 투영·Central 입구를 고정한다', () => {
    expect(SYDNEY_GEO.meta).toMatchObject({
      city: 'sydney',
      bbox: [151.17, -33.93, 151.31, -33.79],
      grid: { w: 648, h: 780 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.830401462336,
      contentLocale: 'en',
      schema: {
        nameField: 'nameEn',
        companionNameField: 'nameKo',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: 'f3dad65b82ed4361cde90b81dc780151f51a135cb72f11e411b3eb495727a39e',
        snapshotSha256: '05ef072f5cd19d2767dcb86ef7b66dfdf03e5505623f341cf8a200f6d2160b32',
        license: 'ODbL 1.0',
      },
      southernHemisphereProjection: {
        method: 'signed-mid-latitude-positive-cosine-v1',
        midLatitude: -33.86,
        correctionIsPositive: true,
        northProjectsUp: true,
      },
      connectivity: {
        method: 'cardinal-land-plus-multi-harbour-ferry-v1',
        ferryLinks: [
          { id: 'f1-circular-quay-manly', stopIds: ['circular-quay-ferry', 'manly-ferry'] },
          { id: 'f2-circular-quay-taronga', stopIds: ['circular-quay-ferry', 'taronga-ferry'] },
          { id: 'f9-circular-quay-watsons-bay', stopIds: ['circular-quay-ferry', 'watsons-bay-ferry'] },
        ],
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.09285,
        finalLandBuildingRatio: 0.101495,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 806,
        componentCount: 247,
        roadComponentCount: 192,
        absorbedComponentCount: 55,
        roadTileCount: 710,
        absorbedWaterTileCount: 91,
        absorbedRiverTileCount: 5,
        finalBridgeTileCount: 0,
      },
    });
    expect(SYDNEY_GEO.terrain).toHaveLength(505_440);
    expect(SYDNEY_GEO.entrance).toEqual({ x: 169, y: 517, facing: 'down' });
    expect(SYDNEY_GEO.exitTiles).toEqual([[169, 507], [169, 508]]);
    expect(SYDNEY_GEO.meta.aspectCorrection).toBeCloseTo(Math.cos(33.86 * DEG), 11);
    expect(projector()(151.21, -33.80)[1]).toBeLessThan(projector()(151.21, -33.90)[1]);
  });

  it('POI 14·역 5·하버 부두 4의 좌표와 en/ko 이름을 보존한다', () => {
    expect(SYDNEY_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(SYDNEY_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    expect(SYDNEY_GEO.transitPoints.map(({ id }) => id)).toEqual(FERRY_STOP_IDS);
    const project = projector();
    const markers = [
      ...SYDNEY_GEO.pois,
      ...SYDNEY_GEO.stations,
      ...SYDNEY_GEO.transitPoints,
    ];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('en');
      expect(entry.nameEn, entry.id).toBeTruthy();
      expect(entry.nameKo, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(SYDNEY_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(SYDNEY_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(SYDNEY_GEO.pois, 'opera-house').representationPolicy)
      .toContain('architectural-exterior-silhouette-only');
    expect(byId(SYDNEY_GEO.transitPoints, 'taronga-ferry').representationPolicy)
      .toBe('wharf-location-only-no-exhibit-reproduction');
  });

  it('City Circle·Eastern Suburbs 철도 순서와 환승을 보존한다', () => {
    const cityCircle = ['central', 'town-hall', 'circular-quay-station']
      .map((id) => byId(SYDNEY_GEO.stations, id));
    const easternSuburbs = ['central', 'town-hall', 'martin-place', 'bondi-junction']
      .map((id) => byId(SYDNEY_GEO.stations, id));
    for (const station of cityCircle) expect(station.routeIds).toContain('city-circle');
    for (const station of easternSuburbs) expect(station.routeIds).toContain('eastern-suburbs');
    expect(byId(SYDNEY_GEO.stations, 'central').routeIds)
      .toEqual(['city-circle', 'eastern-suburbs']);
    expect(fastTravelDestinations(SYDNEY_GEO.stations, 'central')).toHaveLength(4);
  });

  it('지형 질량·포트잭슨 단면·BRIDGE=0·교량 차도 회랑을 고정한다', () => {
    const counts = {};
    for (const code of SYDNEY_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 122_057,
      [CITY_TILE.SIDEWALK]: 124_972,
      [CITY_TILE.CROSSWALK]: 9_032,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 28_544,
      [CITY_TILE.WATER]: 187_166,
      [CITY_TILE.BUILDING]: 32_149,
      [CITY_TILE.RIVER]: 1_518,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(SYDNEY_GEO.railways.tileCount).toBe(6_708);
    expect(verticalWaterSection(151.215, [-33.875, -33.835]))
      .toEqual({ sumM: 1_160, runM: 860 });
    expect(hasRoadNear(151.2108, -33.8523)).toBe(true);
    expect(hasRoadNear(151.1853, -33.8712)).toBe(true);
  });

  it('세 하버 페리 edge를 포함해 모든 보행 타일과 마커를 연결한다', () => {
    expect(cardinalComponentSizes()).toEqual([284_607]);
    const seen = reachableWithFerries(byId(SYDNEY_GEO.stations, 'central').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < SYDNEY_GEO.terrain.length; index += 1) {
      if (isCityBlocked(SYDNEY_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(284_607);
    for (const entry of [
      ...SYDNEY_GEO.pois,
      ...SYDNEY_GEO.stations,
      ...SYDNEY_GEO.transitPoints,
    ]) {
      expect(seen[entry.tile[1] * SYDNEY_GEO.meta.grid.w + entry.tile[0]], entry.id)
        .toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = SYDNEY_GEO.meta.grid.w * SYDNEY_GEO.meta.grid.h;
    const layout = cityMinimapLayout(SYDNEY_GEO.meta.grid.w, SYDNEY_GEO.meta.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 648,
      sourceHeight: 780,
      width: 1_944,
      height: 2_340,
      backingBytes: 18_195_840,
    });
    expect(estimatedPeakBytes).toBe(23_755_680);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildSydneyCityGeo();
    const second = buildSydneyCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('cacca5ed836f7a54e8775b0dd631a759dc2019ce129cc93ccd66c4ef82cb3b04');
    expect(hash(first.railways.mask))
      .toBe('0f2585b552b2ac8ca57910445bbd74d63a18dcc2bdacffd75b6934436fd2244a');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(132_150);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(5_775);
    expect(first.pois).toEqual(SYDNEY_GEO.pois);
    expect(first.stations).toEqual(SYDNEY_GEO.stations);
    expect(first.transitPoints).toEqual(SYDNEY_GEO.transitPoints);
    const firstPng = renderSydneyPng(first);
    const secondPng = renderSydneyPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('fcb4731685ea6827033e4dc5b4e884cb7c76f994f4d69d0bf6d179d353970d88');
  }, 120_000);
});
