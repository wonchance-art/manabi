import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildCanberraCityGeo,
} from '../../../../scripts/build-canberra-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { CANBERRA_GEO } from '../cities/canberra.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'parliament-house',
  'old-parliament-house',
  'australian-war-memorial',
  'lake-burley-griffin',
  'captain-cook-jet',
  'national-library',
  'questacon',
  'commonwealth-park',
  'mount-ainslie',
  'braddon',
]);
const STATION_IDS = Object.freeze([
  'canberra-station',
  'alinga-street',
  'dickson',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = CANBERRA_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / CANBERRA_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / CANBERRA_GEO.meta.metersPerTile,
    ];
  };
};

function cardinalComponentSizes() {
  const { w, h } = CANBERRA_GEO.meta.grid;
  const seen = new Uint8Array(CANBERRA_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < CANBERRA_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(CANBERRA_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(CANBERRA_GEO.terrain[next])) continue;
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
  const { w } = CANBERRA_GEO.meta.grid;
  const centerX = Math.floor(project(lon, latRange[0])[0]);
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (let offset = -8; offset <= 8; offset += 1) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = CANBERRA_GEO.terrain[y * w + centerX + offset];
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
  const { w, h } = CANBERRA_GEO.meta.grid;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const code = CANBERRA_GEO.terrain[y * w + x];
      if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK) return true;
    }
  }
  return false;
}

function nearestRailDistance(tile) {
  const { w } = CANBERRA_GEO.meta.grid;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < CANBERRA_GEO.railways.mask.length; index += 1) {
    if (!CANBERRA_GEO.railways.mask[index]) continue;
    const x = index % w;
    const y = Math.floor(index / w);
    best = Math.min(best, Math.max(
      Math.abs(x - tile[0]),
      Math.abs(y - tile[1]),
    ));
  }
  return best;
}

function renderCanberraPng(geo) {
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

describe('Canberra 상세 geo 계약', () => {
  it('20m bbox·영어 schema·남반구 투영·Canberra station 입구를 고정한다', () => {
    expect(CANBERRA_GEO.meta).toMatchObject({
      city: 'canberra',
      bbox: [149.06, -35.33, 149.18, -35.24],
      grid: { w: 546, h: 501 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.816288844882,
      contentLocale: 'en',
      schema: {
        nameField: 'nameEn',
        companionNameField: 'nameKo',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: '80df8d0f2d8ee26ffca7f90067204414266b589fc54f683e9d93afefa422ed30',
        snapshotSha256: '45963e9c508bf6b468ddd33a065da4e21a6456674d3918d42d39223c722624ec',
        license: 'ODbL 1.0',
      },
      southernHemisphereProjection: {
        method: 'signed-mid-latitude-positive-cosine-v1',
        midLatitude: -35.285,
        correctionIsPositive: true,
        northProjectsUp: true,
      },
      connectivity: {
        method: 'cardinal-land-single-component-v1',
      },
      contentPolicy: {
        politicalNarrative: 'excluded',
        militaryNarrative: 'excluded',
        brandSignage: 'generalized-no-reproduction',
        personLikeness: 'excluded',
        exhibitionReproduction: 'excluded',
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.058385,
        finalLandBuildingRatio: 0.065346,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 321,
        componentCount: 82,
        roadComponentCount: 75,
        absorbedComponentCount: 7,
        roadTileCount: 310,
        absorbedWaterTileCount: 8,
        absorbedRiverTileCount: 3,
        finalBridgeTileCount: 0,
      },
    });
    expect(CANBERRA_GEO.terrain).toHaveLength(273_546);
    expect(CANBERRA_GEO.entrance).toEqual({ x: 405, y: 441, facing: 'down' });
    expect(CANBERRA_GEO.exitTiles).toEqual([[405, 431], [405, 432]]);
    expect(projector()(149.13, -35.25)[1])
      .toBeLessThan(projector()(149.13, -35.32)[1]);
  });

  it('POI 10·역/라이트레일 3의 좌표와 en/ko 이름을 보존한다', () => {
    expect(CANBERRA_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(CANBERRA_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...CANBERRA_GEO.pois, ...CANBERRA_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('en');
      expect(entry.nameEn, entry.id).toBeTruthy();
      expect(entry.nameKo, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(CANBERRA_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(CANBERRA_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(CANBERRA_GEO.pois, 'parliament-house').representationPolicy)
      .toContain('no-political-narrative');
    expect(byId(CANBERRA_GEO.pois, 'australian-war-memorial').representationPolicy)
      .toContain('no-military-or-exhibition-narrative');
  });

  it('Alinga Street↔Dickson 라이트레일 유효 구간과 Canberra station을 분리 보존한다', () => {
    const lightRail = ['alinga-street', 'dickson']
      .map((id) => byId(CANBERRA_GEO.stations, id));
    for (const station of lightRail) {
      expect(station.routeIds).toEqual(['canberra-light-rail']);
      expect(nearestRailDistance(station.tile), station.id).toBeLessThanOrEqual(8);
    }
    expect(lightRail[1].tile).toEqual([335, 58]);
    expect(lightRail[1].tile[1]).toBeLessThan(lightRail[0].tile[1]);
    expect(fastTravelDestinations(CANBERRA_GEO.stations, 'alinga-street')
      .map(({ id }) => id)).toContain('dickson');
    expect(byId(CANBERRA_GEO.stations, 'canberra-station').routeIds)
      .toEqual(['nsw-trainlink']);
    expect(CANBERRA_GEO.transitPoints.map(({ id }) => id))
      .toEqual(['canberra-station']);
  });

  it('지형 질량·벌리그리핀호 단면·BRIDGE=0·두 교량 차도 회랑을 고정한다', () => {
    const counts = {};
    for (const code of CANBERRA_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 64_641,
      [CITY_TILE.SIDEWALK]: 102_045,
      [CITY_TILE.CROSSWALK]: 4_351,
      [CITY_TILE.PLAZA]: 6,
      [CITY_TILE.PARK]: 63_931,
      [CITY_TILE.WATER]: 15_612,
      [CITY_TILE.BUILDING]: 16_428,
      [CITY_TILE.RIVER]: 6_532,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(CANBERRA_GEO.railways.tileCount).toBe(522);
    expect(verticalWaterSection(149.1, [-35.315, -35.275]))
      .toEqual({ sumM: 1_560, runM: 1_560 });
    expect(hasRoadNear(149.126, -35.298)).toBe(true);
    expect(hasRoadNear(149.142, -35.301)).toBe(true);
  });

  it('모든 보행 타일과 보호 마커를 단일 4방 성분으로 잇는다', () => {
    expect(cardinalComponentSizes()).toEqual([234_974]);
    const { w, h } = CANBERRA_GEO.meta.grid;
    const seen = new Uint8Array(CANBERRA_GEO.terrain.length);
    const queue = [CANBERRA_GEO.entrance.y * w + CANBERRA_GEO.entrance.x];
    seen[queue[0]] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      const x = index % w;
      const y = Math.floor(index / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const next = ny * w + nx;
        if (seen[next] || isCityBlocked(CANBERRA_GEO.terrain[next])) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    expect(queue).toHaveLength(234_974);
    for (const entry of [...CANBERRA_GEO.pois, ...CANBERRA_GEO.stations]) {
      expect(seen[entry.tile[1] * w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = CANBERRA_GEO.meta.grid.w * CANBERRA_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      CANBERRA_GEO.meta.grid.w,
      CANBERRA_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 546,
      sourceHeight: 501,
      width: 1_638,
      height: 1_503,
      backingBytes: 9_847_656,
    });
    expect(estimatedPeakBytes).toBe(12_856_662);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildCanberraCityGeo();
    const second = buildCanberraCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('138737274646fd57aaa19d3632fc0725fe4624357d3bd373806d3d6dab1239e0');
    expect(hash(first.railways.mask))
      .toBe('58fbf18c6edc7da890caddb5aa7d184688066b1a7651c167a71656d0f6cefd0b');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(87_180);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(657);
    expect(first.pois).toEqual(CANBERRA_GEO.pois);
    expect(first.stations).toEqual(CANBERRA_GEO.stations);
    const firstPng = renderCanberraPng(first);
    const secondPng = renderCanberraPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('2275cfeb2dee1e2141db86204a7bc75f999cf7b26870efe9fe35645f2f966fb8');
  }, 120_000);
});
