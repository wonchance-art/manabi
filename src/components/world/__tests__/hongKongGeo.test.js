import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildHongKongCityGeo,
} from '../../../../scripts/build-hong-kong-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { HONG_KONG_GEO } from '../cities/hong-kong.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'victoria-peak', 'star-ferry-tst', 'star-ferry-central', 'clock-tower',
  'tst-promenade', 'temple-street', 'mongkok-ladies', 'man-mo-temple',
  'mid-levels-escalator', 'central-statue-square', 'victoria-park', 'kowloon-park',
]);
const STATION_IDS = Object.freeze([
  'central', 'admiralty', 'tsim-sha-tsui', 'mong-kok',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = HONG_KONG_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / HONG_KONG_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / HONG_KONG_GEO.meta.metersPerTile,
    ];
  };
};

function reachableWithFerry(startTile) {
  const { w, h } = HONG_KONG_GEO.meta.grid;
  const seen = new Uint8Array(HONG_KONG_GEO.terrain.length);
  const queue = new Int32Array(HONG_KONG_GEO.terrain.length);
  const ferryIndexes = HONG_KONG_GEO.meta.connectivity.ferryLink.stopIds
    .map((id) => byId(HONG_KONG_GEO.pois, id).tile)
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
      if (seen[next] || isCityBlocked(HONG_KONG_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const { w, h } = HONG_KONG_GEO.meta.grid;
  const seen = new Uint8Array(HONG_KONG_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < HONG_KONG_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(HONG_KONG_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(HONG_KONG_GEO.terrain[next])) continue;
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
  const { w } = HONG_KONG_GEO.meta.grid;
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  const centerX = Math.floor(project(lon, (latRange[0] + latRange[1]) / 2)[0]);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-2, -1, 0, 1, 2]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = HONG_KONG_GEO.terrain[y * w + centerX + offset];
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

function renderHongKongPng(geo) {
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

describe('Hong Kong 상세 geo 계약', () => {
  it('20m bbox·정체 canonical·간체 companion·침사추이 입구를 고정한다', () => {
    expect(HONG_KONG_GEO.meta).toMatchObject({
      city: 'hong-kong',
      bbox: [114.10, 22.26, 114.22, 22.33],
      grid: { w: 618, h: 390 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.92524282866,
      contentLocale: 'zh',
      schema: {
        nameField: 'nameZhHant',
        companionNameField: 'nameZhHans',
        localeSlots: 'central-lookup-expandable',
      },
      localeAnchors: ['zh-Hant', 'zh-Hans'],
      source: {
        rawOverpassSha256: '3c2eb946782a2846cb7c1201db211d7fb13d8c41e3e2a81679658b2ac3e58c8a',
        snapshotSha256: '6fa69fb00e416382d17c7b526ec33967c7d82d1d95cfe11ece906fe136d87b4a',
        license: 'ODbL 1.0',
      },
      contentPolicy: {
        focus: 'tourism-architecture-food',
        politicalNarrative: 'excluded',
        brandSignage: 'generalized-no-reproduction',
        personLikeness: 'excluded',
      },
      connectivity: {
        method: 'cardinal-land-plus-star-ferry-v1',
        ferryLink: {
          id: 'star-ferry-victoria-harbour',
          mode: 'ferry',
          stopIds: ['star-ferry-tst', 'star-ferry-central'],
        },
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.084915,
        finalLandBuildingRatio: 0.114273,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 1_570,
        componentCount: 162,
        roadComponentCount: 120,
        absorbedComponentCount: 42,
        roadTileCount: 1_478,
        absorbedWaterTileCount: 67,
        absorbedRiverTileCount: 25,
        finalBridgeTileCount: 0,
      },
    });
    expect(HONG_KONG_GEO.terrain).toHaveLength(241_020);
    expect(HONG_KONG_GEO.entrance).toEqual({ x: 371, y: 180, facing: 'down' });
    expect(HONG_KONG_GEO.exitTiles).toEqual([[371, 170], [371, 171]]);
  });

  it('POI 12·역 4의 좌표와 정체/간체 이름을 전건 보존한다', () => {
    expect(HONG_KONG_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(HONG_KONG_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...HONG_KONG_GEO.pois, ...HONG_KONG_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('zh');
      expect(entry.nameZhHant, entry.id).toBeTruthy();
      expect(entry.nameZhHans, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(HONG_KONG_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(HONG_KONG_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(HONG_KONG_GEO.pois, 'tst-promenade').representationPolicy)
      .toBe('geography-only-no-handprints-or-person-likeness');
    expect(byId(HONG_KONG_GEO.pois, 'victoria-peak')).toMatchObject({
      kind: 'mountain', terrainHint: 'MOUNTAIN', trailAccess: true,
    });
    expect(HONG_KONG_GEO.transitPoints.map(({ id }) => id)).toEqual(['star-ferry-tst']);
  });

  it('취안완선의 유효 선택 순서와 4개 역 이동을 보존한다', () => {
    const route = ['central', 'admiralty', 'tsim-sha-tsui', 'mong-kok']
      .map((id) => byId(HONG_KONG_GEO.stations, id));
    expect(route.map(({ id }) => id)).toEqual(STATION_IDS);
    for (const station of route) {
      expect(station.routeId).toBe('tsuen-wan');
      expect(station.routeIds).toEqual(['tsuen-wan']);
    }
    expect(fastTravelDestinations(HONG_KONG_GEO.stations, 'tsim-sha-tsui')).toHaveLength(3);
  });

  it('지형 질량·빅토리아항 단면·BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of HONG_KONG_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 53_322,
      [CITY_TILE.SIDEWALK]: 26_906,
      [CITY_TILE.CROSSWALK]: 3_373,
      [CITY_TILE.PLAZA]: 1,
      [CITY_TILE.PARK]: 1_488,
      [CITY_TILE.WATER]: 108_711,
      [CITY_TILE.BUILDING]: 14_867,
      [CITY_TILE.RIVER]: 2_208,
      [CITY_TILE.MOUNTAIN]: 30_144,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(HONG_KONG_GEO.railways.tileCount).toBe(5_434);
    expect(verticalWaterSection(114.17, [22.278, 22.3]))
      .toEqual({ sumM: 1_220, runM: 1_160 });
  });

  it('두 실제 육지를 보존하고 스타페리 포함 4방 BFS로 전 보행 타일을 잇는다', () => {
    expect(cardinalComponentSizes()).toEqual([44_094, 40_996]);
    const seen = reachableWithFerry(byId(HONG_KONG_GEO.stations, 'tsim-sha-tsui').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < HONG_KONG_GEO.terrain.length; index += 1) {
      if (isCityBlocked(HONG_KONG_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(85_090);
    for (const entry of [...HONG_KONG_GEO.pois, ...HONG_KONG_GEO.stations]) {
      expect(seen[entry.tile[1] * HONG_KONG_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = HONG_KONG_GEO.meta.grid.w * HONG_KONG_GEO.meta.grid.h;
    const layout = cityMinimapLayout(HONG_KONG_GEO.meta.grid.w, HONG_KONG_GEO.meta.grid.h);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 618,
      sourceHeight: 390,
      width: 1_854,
      height: 1_170,
      backingBytes: 8_676_720,
    });
    expect(estimatedPeakBytes).toBe(11_327_940);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildHongKongCityGeo();
    const second = buildHongKongCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('3939fdae1e747ead6f65e2961236a2600c78cbe9a259cecd2132c9348e630ead');
    expect(hash(first.railways.mask))
      .toBe('919a3ce94c2d9c5b118213904f82c77ec9562614678dc3f380ee6384541b49b3');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(44_287);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(4_349);
    expect(first.pois).toEqual(HONG_KONG_GEO.pois);
    expect(first.stations).toEqual(HONG_KONG_GEO.stations);
    const firstPng = renderHongKongPng(first);
    const secondPng = renderHongKongPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('6e04f9c3eb1b050f2ae44ad6d419fc45063166705d878c16c2f174f47e106765');
  }, 120_000);
});
