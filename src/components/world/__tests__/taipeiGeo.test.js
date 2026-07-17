import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildTaipeiCityGeo,
} from '../../../../scripts/build-taipei-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { TAIPEI_GEO } from '../cities/taipei.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'taipei-101', 'longshan-temple', 'ximending', 'cks-memorial',
  'national-palace-museum', 'shilin-market', 'raohe-market', 'dihua-street',
  'bopiliao', 'daan-park', 'huashan-1914', 'elephant-mountain',
  'presidential-office',
]);
const STATION_IDS = Object.freeze([
  'taipei-main', 'ximen', 'taipei-101-station', 'shilin', 'zhongxiao-fuxing',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = TAIPEI_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / TAIPEI_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / TAIPEI_GEO.meta.metersPerTile,
    ];
  };
};

function reachableFrom(startTile) {
  const { w, h } = TAIPEI_GEO.meta.grid;
  const seen = new Uint8Array(TAIPEI_GEO.terrain.length);
  const queue = new Int32Array(TAIPEI_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(TAIPEI_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function horizontalWaterSection(lat, lonRange) {
  const project = projector();
  const { w } = TAIPEI_GEO.meta.grid;
  const [x0, x1] = lonRange.map((lon) => Math.floor(project(lon, lat)[0]));
  const centerY = Math.floor(project((lonRange[0] + lonRange[1]) / 2, lat)[1]);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-2, -1, 0, 1, 2]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let x = x0; x <= x1; x += 1) {
      const code = TAIPEI_GEO.terrain[(centerY + offset) * w + x];
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

function verticalWaterSection(lon, latRange) {
  const project = projector();
  const { w } = TAIPEI_GEO.meta.grid;
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  const centerX = Math.floor(project(lon, (latRange[0] + latRange[1]) / 2)[0]);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-2, -1, 0, 1, 2]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = TAIPEI_GEO.terrain[y * w + centerX + offset];
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

function renderTaipeiPng(geo) {
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

describe('Taipei 상세 geo 계약', () => {
  it('20m bbox·정체 canonical·간체 companion·Taipei Main 입구를 고정한다', () => {
    expect(TAIPEI_GEO.meta).toMatchObject({
      city: 'taipei',
      bbox: [121.49, 25.02, 121.58, 25.11],
      grid: { w: 454, h: 501 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.905827758717,
      contentLocale: 'zh',
      schema: {
        nameField: 'nameZhHant',
        companionNameField: 'nameZhHans',
        localeSlots: 'central-lookup-expandable',
      },
      localeAnchors: ['zh-Hant', 'zh-Hans'],
      source: {
        rawOverpassSha256: 'eb200f5c37289af93785f103eaff5c5dddce9faefd44c9c20cd67fa98d987674',
        snapshotSha256: 'be26a6e1c81dee432e67002ee630d20662c9337b79e281b3461a9ed2ec58856b',
        license: 'ODbL 1.0',
      },
      contentPolicy: {
        focus: 'tourism-architecture-food',
        politicalNarrative: 'excluded',
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.094421,
        finalLandBuildingRatio: 0.105273,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 1_442,
        componentCount: 157,
        roadComponentCount: 148,
        absorbedComponentCount: 9,
        roadTileCount: 1_425,
        absorbedWaterTileCount: 0,
        absorbedRiverTileCount: 17,
        finalBridgeTileCount: 0,
      },
    });
    expect(TAIPEI_GEO.terrain).toHaveLength(227_454);
    expect(TAIPEI_GEO.entrance).toEqual({ x: 136, y: 346, facing: 'down' });
    expect(TAIPEI_GEO.exitTiles).toEqual([[136, 336], [136, 337]]);
  });

  it('POI 13·역 5의 좌표와 정체/간체 이름을 전건 보존한다', () => {
    expect(TAIPEI_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(TAIPEI_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...TAIPEI_GEO.pois, ...TAIPEI_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('zh');
      expect(entry.nameZhHant, entry.id).toBeTruthy();
      expect(entry.nameZhHans, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(TAIPEI_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(TAIPEI_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(TAIPEI_GEO.pois, 'cks-memorial').representationPolicy)
      .toBe('architecture-and-plaza-only-no-politics');
    expect(byId(TAIPEI_GEO.pois, 'national-palace-museum').representationPolicy)
      .toBe('exterior-only-no-collection');
    expect(byId(TAIPEI_GEO.pois, 'presidential-office').representationPolicy)
      .toBe('exterior-only-no-politics');
    expect(byId(TAIPEI_GEO.pois, 'elephant-mountain')).toMatchObject({
      kind: 'mountain', terrainHint: 'MOUNTAIN', trailAccess: true,
    });
  });

  it('실제 MRT 유효 순서와 두 노선의 Taipei Main 환승을 보존한다', () => {
    const red = ['shilin', 'taipei-main', 'taipei-101-station']
      .map((id) => byId(TAIPEI_GEO.stations, id));
    const blue = ['ximen', 'taipei-main', 'zhongxiao-fuxing']
      .map((id) => byId(TAIPEI_GEO.stations, id));
    expect(red.map(({ tile }) => tile[1])).toEqual([90, 346, 428]);
    expect(blue.map(({ tile }) => tile[0])).toEqual([92, 136, 272]);
    for (const station of red) expect(station.routeIds).toContain('tamsui-xinyi');
    for (const station of blue) expect(station.routeIds).toContain('bannan');
    expect(byId(TAIPEI_GEO.stations, 'taipei-main').routeIds)
      .toEqual(['tamsui-xinyi', 'bannan']);
    expect(fastTravelDestinations(TAIPEI_GEO.stations, 'taipei-main')).toHaveLength(4);
  });

  it('지형 질량·단수이강/지룽강 단면·BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of TAIPEI_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 98_316,
      [CITY_TILE.SIDEWALK]: 54_980,
      [CITY_TILE.CROSSWALK]: 7_556,
      [CITY_TILE.PLAZA]: 10,
      [CITY_TILE.PARK]: 7_684,
      [CITY_TILE.WATER]: 10_056,
      [CITY_TILE.BUILDING]: 22_338,
      [CITY_TILE.RIVER]: 5_206,
      [CITY_TILE.MOUNTAIN]: 21_308,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(TAIPEI_GEO.railways.tileCount).toBe(6_111);
    expect(horizontalWaterSection(25.06, [121.49, 121.515]))
      .toEqual({ sumM: 480, runM: 480 });
    expect(verticalWaterSection(121.53, [25.07, 25.095]))
      .toEqual({ sumM: 240, runM: 160 });
  });

  it('POI·역과 모든 보행 타일이 Taipei Main 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(byId(TAIPEI_GEO.stations, 'taipei-main').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < TAIPEI_GEO.terrain.length; index += 1) {
      if (isCityBlocked(TAIPEI_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(168_546);
    for (const entry of [...TAIPEI_GEO.pois, ...TAIPEI_GEO.stations]) {
      expect(seen[entry.tile[1] * TAIPEI_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = TAIPEI_GEO.meta.grid.w * TAIPEI_GEO.meta.grid.h;
    const layout = cityMinimapLayout(TAIPEI_GEO.meta.grid.w, TAIPEI_GEO.meta.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 454,
      sourceHeight: 501,
      width: 1_362,
      height: 1_503,
      backingBytes: 8_188_344,
    });
    expect(estimatedPeakBytes).toBe(10_690_338);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildTaipeiCityGeo();
    const second = buildTaipeiCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('6f322f268986b6da2d3bf3007db93479fa0ef4e1561a8c505ac8f3a387127e0d');
    expect(hash(first.railways.mask))
      .toBe('b4a41f18b6fc851f31fd5a628547aeadb799795b0cb84c9be9e03919b0e58725');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(77_290);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(3_505);
    expect(first.pois).toEqual(TAIPEI_GEO.pois);
    expect(first.stations).toEqual(TAIPEI_GEO.stations);
    const firstPng = renderTaipeiPng(first);
    const secondPng = renderTaipeiPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('5cab5cadda87b76b4f5017ae8e09976446c3556bef5e0613b630aab8d6815667');
  }, 120_000);
});
