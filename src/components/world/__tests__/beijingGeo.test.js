import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildBeijingCityGeo,
} from '../../../../scripts/build-beijing-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { BEIJING_GEO } from '../cities/beijing.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'forbidden-city', 'tiananmen-gate', 'jingshan-park', 'beihai-park',
  'qianmen', 'qianmen-street', 'wangfujing', 'nanluoguxiang', 'shichahai',
  'drum-tower', 'bell-tower', 'tiantan',
]);
const STATION_IDS = Object.freeze([
  'tiananmen-east', 'wangfujing-station', 'qianmen-station',
  'shichahai-station',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = BEIJING_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / BEIJING_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / BEIJING_GEO.meta.metersPerTile,
    ];
  };
};

function reachableCardinal(startTile) {
  const { w, h } = BEIJING_GEO.meta.grid;
  const seen = new Uint8Array(BEIJING_GEO.terrain.length);
  const queue = new Int32Array(BEIJING_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(BEIJING_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const { w, h } = BEIJING_GEO.meta.grid;
  const seen = new Uint8Array(BEIJING_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < BEIJING_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(BEIJING_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(BEIJING_GEO.terrain[next])) continue;
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
  const { w } = BEIJING_GEO.meta.grid;
  const [x0, x1] = lonRange.map((lon) => Math.floor(project(lon, lat)[0]))
    .sort((left, right) => left - right);
  const centerY = Math.floor(project((lonRange[0] + lonRange[1]) / 2, lat)[1]);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let x = x0; x <= x1; x += 1) {
      const code = BEIJING_GEO.terrain[(centerY + offset) * w + x];
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

function renderBeijingPng(geo) {
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

describe('Beijing 상세 geo 계약', () => {
  it('20m bbox·정체 canonical·간체 companion·전문 입구를 고정한다', () => {
    expect(BEIJING_GEO.meta).toMatchObject({
      city: 'beijing',
      bbox: [116.35, 39.88, 116.43, 39.95],
      grid: { w: 342, h: 390 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.766997194406,
      contentLocale: 'zh',
      schema: {
        nameField: 'nameZhHant',
        companionNameField: 'nameZhHans',
        localeSlots: 'central-lookup-expandable',
      },
      localeAnchors: ['zh-Hant', 'zh-Hans'],
      source: {
        rawOverpassSha256: '5a81f47f5821260a1392c68525965af13e55d4aff1434b44b96c7882783b2e88',
        snapshotSha256: 'a71c50da3c00b26f149a274215b187bbc02b006615a7d706c1cbf906d1795382',
        license: 'ODbL 1.0',
      },
      contentPolicy: {
        focus: 'tourism-architecture-food',
        politicalNarrative: 'excluded',
        brandSignage: 'generalized-no-reproduction',
        personLikeness: 'excluded',
        sensitiveAreaPolicy: 'no-poi-label-or-name-underlying-osm-terrain-only',
      },
      connectivity: {
        method: 'cardinal-land-single-component-v1',
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.126024,
        finalLandBuildingRatio: 0.127965,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 306,
        componentCount: 65,
        roadComponentCount: 62,
        absorbedComponentCount: 3,
        roadTileCount: 301,
        absorbedWaterTileCount: 0,
        absorbedRiverTileCount: 5,
        finalBridgeTileCount: 0,
      },
    });
    expect(BEIJING_GEO.terrain).toHaveLength(133_380);
    expect(BEIJING_GEO.entrance).toEqual({ x: 203, y: 282, facing: 'down' });
    expect(BEIJING_GEO.exitTiles).toEqual([[203, 272], [203, 273]]);
  });

  it('POI 12·역 4의 좌표와 정체/간체 이름을 전건 보존한다', () => {
    expect(BEIJING_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(BEIJING_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...BEIJING_GEO.pois, ...BEIJING_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('zh');
      expect(entry.nameZhHant, entry.id).toBeTruthy();
      expect(entry.nameZhHans, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(BEIJING_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(BEIJING_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(BEIJING_GEO.pois, 'forbidden-city').representationPolicy)
      .toBe('exterior-and-name-only-no-collection-reproduction');
    expect(byId(BEIJING_GEO.pois, 'tiananmen-gate')).toMatchObject({
      kind: 'historic-gate',
      representationPolicy: 'architectural-exterior-only-no-politics',
    });
    expect(BEIJING_GEO.transitPoints.map(({ id }) => id)).toEqual(['qianmen-station']);
    expect(JSON.stringify([...BEIJING_GEO.pois, ...BEIJING_GEO.stations]))
      .not.toMatch(/中南海|zhongnanhai/i);
  });

  it('1호선 천안문동→왕푸징 유효 순서와 단독 2·8호선을 보존한다', () => {
    const line1 = ['tiananmen-east', 'wangfujing-station']
      .map((id) => byId(BEIJING_GEO.stations, id));
    for (const station of line1) expect(station.routeIds).toContain('line-1');
    expect(byId(BEIJING_GEO.stations, 'qianmen-station').routeIds).toEqual(['line-2']);
    expect(byId(BEIJING_GEO.stations, 'shichahai-station').routeIds).toEqual(['line-8']);
    expect(fastTravelDestinations(BEIJING_GEO.stations, 'tiananmen-east')
      .map(({ id }) => id)).toEqual([
        'wangfujing-station',
        'qianmen-station',
        'shichahai-station',
      ]);
  });

  it('지형 질량·북해~십찰해 단면·BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of BEIJING_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 54_864,
      [CITY_TILE.SIDEWALK]: 52_824,
      [CITY_TILE.CROSSWALK]: 813,
      [CITY_TILE.PLAZA]: 3,
      [CITY_TILE.PARK]: 3_978,
      [CITY_TILE.WATER]: 3_719,
      [CITY_TILE.BUILDING]: 16_518,
      [CITY_TILE.RIVER]: 579,
      [CITY_TILE.MOUNTAIN]: 82,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(BEIJING_GEO.railways.tileCount).toBe(6_938);
    expect(horizontalWaterSection(39.928, [116.375, 116.405]))
      .toEqual({ sumM: 560, runM: 560 });
  });

  it('전 보행 타일을 하나의 4방 성분으로 잇는다', () => {
    expect(cardinalComponentSizes()).toEqual([112_482]);
    const seen = reachableCardinal(byId(BEIJING_GEO.stations, 'qianmen-station').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < BEIJING_GEO.terrain.length; index += 1) {
      if (isCityBlocked(BEIJING_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(112_482);
    for (const entry of [...BEIJING_GEO.pois, ...BEIJING_GEO.stations]) {
      expect(seen[entry.tile[1] * BEIJING_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = BEIJING_GEO.meta.grid.w * BEIJING_GEO.meta.grid.h;
    const layout = cityMinimapLayout(BEIJING_GEO.meta.grid.w, BEIJING_GEO.meta.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 342,
      sourceHeight: 390,
      width: 1_026,
      height: 1_170,
      backingBytes: 4_801_680,
    });
    expect(estimatedPeakBytes).toBe(6_268_860);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildBeijingCityGeo();
    const second = buildBeijingCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('747ba885fa7fc10aee4017e015d157a9fc692da3248c074955f832e3f1f14704');
    expect(hash(first.railways.mask))
      .toBe('44943432dfc19cc88c6791cf8e86c7d56c297d85a1248f4bccc2c30b32dbdd24');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(38_893);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(4_435);
    expect(first.pois).toEqual(BEIJING_GEO.pois);
    expect(first.stations).toEqual(BEIJING_GEO.stations);
    const firstPng = renderBeijingPng(first);
    const secondPng = renderBeijingPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('37b4b12e709b3dc508f2ba1d4106a0e7a27ac9565599518333c6b2f81c412c23');
  }, 120_000);
});
