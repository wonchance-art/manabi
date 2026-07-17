import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildShanghaiCityGeo,
} from '../../../../scripts/build-shanghai-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { SHANGHAI_GEO } from '../cities/shanghai.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'the-bund', 'oriental-pearl', 'shanghai-tower', 'lujiazui', 'yu-garden',
  'nanjing-road', 'peoples-square', 'xintiandi', 'tianzifang', 'waibaidu-bridge',
]);
const STATION_IDS = Object.freeze([
  'peoples-square-station', 'nanjing-east-station', 'lujiazui-station',
  'yuyuan-station',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = SHANGHAI_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / SHANGHAI_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / SHANGHAI_GEO.meta.metersPerTile,
    ];
  };
};

function reachableWithFerry(startTile) {
  const { w, h } = SHANGHAI_GEO.meta.grid;
  const seen = new Uint8Array(SHANGHAI_GEO.terrain.length);
  const queue = new Int32Array(SHANGHAI_GEO.terrain.length);
  const ferryIndexes = SHANGHAI_GEO.meta.connectivity.ferryLink.stopIds
    .map((id) => byId(SHANGHAI_GEO.pois, id).tile)
    .map(([x, y]) => y * w + x);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * w + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    for (let ferryIndex = 0; ferryIndex < ferryIndexes.length; ferryIndex += 1) {
      if (index !== ferryIndexes[ferryIndex]) continue;
      const other = ferryIndexes[1 - ferryIndex];
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
      if (seen[next] || isCityBlocked(SHANGHAI_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const { w, h } = SHANGHAI_GEO.meta.grid;
  const seen = new Uint8Array(SHANGHAI_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < SHANGHAI_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(SHANGHAI_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(SHANGHAI_GEO.terrain[next])) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    sizes.push(queue.length);
  }
  return sizes.sort((left, right) => right - left);
}

function horizontalWaterSection(lat, lonRange) {
  const project = projector();
  const { w } = SHANGHAI_GEO.meta.grid;
  const [x0, x1] = lonRange.map((lon) => Math.floor(project(lon, lat)[0]))
    .sort((left, right) => left - right);
  const centerY = Math.floor(project((lonRange[0] + lonRange[1]) / 2, lat)[1]);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let x = x0; x <= x1; x += 1) {
      const code = SHANGHAI_GEO.terrain[(centerY + offset) * w + x];
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

function renderShanghaiPng(geo) {
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

describe('Shanghai 상세 geo 계약', () => {
  it('20m bbox·정체 canonical·간체 companion·인민광장 입구를 고정한다', () => {
    expect(SHANGHAI_GEO.meta).toMatchObject({
      city: 'shanghai',
      bbox: [121.45, 31.19, 121.54, 31.26],
      grid: { w: 429, h: 390 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.85513814682,
      contentLocale: 'zh',
      schema: {
        nameField: 'nameZhHant',
        companionNameField: 'nameZhHans',
        localeSlots: 'central-lookup-expandable',
      },
      localeAnchors: ['zh-Hant', 'zh-Hans'],
      source: {
        rawOverpassSha256: '9062c2ad174f48899328994e54fcbc011361c2f0305cce9dd760895d0ca10ef0',
        snapshotSha256: '24f8fcf9c14add0c2d771c7397fc7c587c871cdd5273479e1ec5a065dd01dbb2',
        license: 'ODbL 1.0',
      },
      contentPolicy: {
        focus: 'tourism-architecture-food',
        politicalNarrative: 'excluded',
        brandSignage: 'generalized-no-reproduction',
        personLikeness: 'excluded',
      },
      connectivity: {
        method: 'cardinal-land-plus-huangpu-ferry-v1',
        ferryLink: {
          id: 'huangpu-river-ferry',
          mode: 'ferry',
          stopIds: ['the-bund', 'lujiazui'],
        },
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.119871,
        finalLandBuildingRatio: 0.127238,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 718,
        componentCount: 107,
        roadComponentCount: 97,
        absorbedComponentCount: 10,
        roadTileCount: 703,
        absorbedWaterTileCount: 0,
        absorbedRiverTileCount: 15,
        finalBridgeTileCount: 0,
      },
    });
    expect(SHANGHAI_GEO.terrain).toHaveLength(167_310);
    expect(SHANGHAI_GEO.entrance).toEqual({ x: 111, y: 150, facing: 'down' });
    expect(SHANGHAI_GEO.exitTiles).toEqual([[111, 140], [111, 141]]);
  });

  it('POI 10·역 4의 좌표와 정체/간체 이름을 전건 보존한다', () => {
    expect(SHANGHAI_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(SHANGHAI_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...SHANGHAI_GEO.pois, ...SHANGHAI_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('zh');
      expect(entry.nameZhHant, entry.id).toBeTruthy();
      expect(entry.nameZhHans, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(SHANGHAI_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(SHANGHAI_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(SHANGHAI_GEO.pois, 'peoples-square').representationPolicy)
      .toBe('plaza-and-museum-exterior-only-no-politics');
    expect(byId(SHANGHAI_GEO.pois, 'waibaidu-bridge')).toMatchObject({
      kind: 'historic-bridge',
      terrainHint: 'ROAD',
      representationPolicy: 'poi-marker-only-road-terrain',
    });
    expect(SHANGHAI_GEO.transitPoints.map(({ id }) => id)).toEqual(['the-bund']);
  });

  it('2호선·10호선의 유효 순서와 난징둥루 환승을 보존한다', () => {
    const line2 = [
      'peoples-square-station',
      'nanjing-east-station',
      'lujiazui-station',
    ]
      .map((id) => byId(SHANGHAI_GEO.stations, id));
    const line10 = ['yuyuan-station', 'nanjing-east-station']
      .map((id) => byId(SHANGHAI_GEO.stations, id));
    for (const station of line2) expect(station.routeIds).toContain('line-2');
    for (const station of line10) expect(station.routeIds).toContain('line-10');
    expect(byId(SHANGHAI_GEO.stations, 'nanjing-east-station').routeIds)
      .toEqual(['line-2', 'line-10']);
    expect(fastTravelDestinations(SHANGHAI_GEO.stations, 'peoples-square-station'))
      .toHaveLength(3);
  });

  it('지형 질량·황푸강 단면·BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of SHANGHAI_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 64_431,
      [CITY_TILE.SIDEWALK]: 62_660,
      [CITY_TILE.CROSSWALK]: 572,
      [CITY_TILE.PLAZA]: 2,
      [CITY_TILE.PARK]: 3_514,
      [CITY_TILE.WATER]: 12_795,
      [CITY_TILE.BUILDING]: 19_167,
      [CITY_TILE.RIVER]: 3_876,
      [CITY_TILE.MOUNTAIN]: 293,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(SHANGHAI_GEO.railways.tileCount).toBe(6_958);
    expect(horizontalWaterSection(31.24, [121.485, 121.515]))
      .toEqual({ sumM: 520, runM: 420 });
  });

  it('황푸강 도로교량과 ferry edge를 보존하며 전 보행 타일을 잇는다', () => {
    expect(cardinalComponentSizes()).toEqual([131_179]);
    const seen = reachableWithFerry(
      byId(SHANGHAI_GEO.stations, 'peoples-square-station').tile,
    );
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < SHANGHAI_GEO.terrain.length; index += 1) {
      if (isCityBlocked(SHANGHAI_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(131_179);
    for (const entry of [...SHANGHAI_GEO.pois, ...SHANGHAI_GEO.stations]) {
      expect(seen[entry.tile[1] * SHANGHAI_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = SHANGHAI_GEO.meta.grid.w * SHANGHAI_GEO.meta.grid.h;
    const layout = cityMinimapLayout(SHANGHAI_GEO.meta.grid.w, SHANGHAI_GEO.meta.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 429,
      sourceHeight: 390,
      width: 1_287,
      height: 1_170,
      backingBytes: 6_023_160,
    });
    expect(estimatedPeakBytes).toBe(7_863_570);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildShanghaiCityGeo();
    const second = buildShanghaiCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('15cdfabc29561dff2d56e924af77fd0027f2fe4b739f4822c907b706ac6a02c0');
    expect(hash(first.railways.mask))
      .toBe('46b69fec8b3840418c9733f4926d7d49dc18e715ad42bb50af16032c533fd4cc');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(48_581);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(5_937);
    expect(first.pois).toEqual(SHANGHAI_GEO.pois);
    expect(first.stations).toEqual(SHANGHAI_GEO.stations);
    const firstPng = renderShanghaiPng(first);
    const secondPng = renderShanghaiPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('0377701ee29e37c345b0091a23391bd4a566c4aa2627e83d33a89fe4b6434c9d');
  }, 120_000);
});
