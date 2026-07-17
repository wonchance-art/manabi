import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildBrisbaneCityGeo,
} from '../../../../scripts/build-brisbane-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { BRISBANE_GEO } from '../cities/brisbane.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'story-bridge',
  'kangaroo-point-cliffs',
  'south-bank-parklands',
  'wheel-of-brisbane',
  'queen-street-mall',
  'brisbane-city-hall',
  'city-botanic-gardens',
  'roma-street-parkland',
  'qagoma',
  'howard-smith-wharves',
  'new-farm-park',
]);
const STATION_IDS = Object.freeze([
  'central',
  'roma-street',
  'south-brisbane',
  'fortitude-valley',
]);
const FERRY_STOP_IDS = Object.freeze(['riverside-ferry', 'south-bank-ferry']);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = BRISBANE_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / BRISBANE_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / BRISBANE_GEO.meta.metersPerTile,
    ];
  };
};

function reachableWithFerry(startTile) {
  const { w, h } = BRISBANE_GEO.meta.grid;
  const seen = new Uint8Array(BRISBANE_GEO.terrain.length);
  const queue = new Int32Array(BRISBANE_GEO.terrain.length);
  const ferryIndexes = BRISBANE_GEO.meta.connectivity.ferryLink.stopIds
    .map((id) => byId(BRISBANE_GEO.transitPoints, id).tile)
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
      if (seen[next] || isCityBlocked(BRISBANE_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const { w, h } = BRISBANE_GEO.meta.grid;
  const seen = new Uint8Array(BRISBANE_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < BRISBANE_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(BRISBANE_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(BRISBANE_GEO.terrain[next])) continue;
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
  const { w } = BRISBANE_GEO.meta.grid;
  const centerX = Math.floor(project(lon, latRange[0])[0]);
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = BRISBANE_GEO.terrain[y * w + centerX + offset];
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

function hasRoadNear(lon, lat, radius = 4) {
  const [centerX, centerY] = projector()(lon, lat).map(Math.floor);
  const { w, h } = BRISBANE_GEO.meta.grid;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const code = BRISBANE_GEO.terrain[y * w + x];
      if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK) return true;
    }
  }
  return false;
}

function renderBrisbanePng(geo) {
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

describe('Brisbane 상세 geo 계약', () => {
  it('20m bbox·영어 schema·남반구 투영·Central 입구를 고정한다', () => {
    expect(BRISBANE_GEO.meta).toMatchObject({
      city: 'brisbane',
      bbox: [152.98, -27.52, 153.09, -27.42],
      grid: { w: 544, h: 557 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.887252482586,
      contentLocale: 'en',
      schema: {
        nameField: 'nameEn',
        companionNameField: 'nameKo',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: '3ff46eb930643139266250260ec536749842de9e3b1b89925fcfa551897e6fa5',
        snapshotSha256: '5c17ba45e251ee3c0160e0f9cda3ba69d9725734b0392e505d45197b1ca338ac',
        license: 'ODbL 1.0',
      },
      southernHemisphereProjection: {
        method: 'signed-mid-latitude-positive-cosine-v1',
        midLatitude: -27.47,
        correctionIsPositive: true,
        northProjectsUp: true,
      },
      connectivity: {
        method: 'cardinal-land-plus-citycat-ferry-v1',
        ferryLink: {
          id: 'citycat-riverside-south-bank',
          mode: 'ferry',
          stopIds: FERRY_STOP_IDS,
        },
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.103381,
        finalLandBuildingRatio: 0.108885,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 1_078,
        componentCount: 195,
        roadComponentCount: 165,
        absorbedComponentCount: 30,
        roadTileCount: 996,
        absorbedWaterTileCount: 49,
        absorbedRiverTileCount: 33,
        finalBridgeTileCount: 0,
      },
    });
    expect(BRISBANE_GEO.terrain).toHaveLength(303_008);
    expect(BRISBANE_GEO.entrance).toEqual({ x: 227, y: 257, facing: 'down' });
    expect(BRISBANE_GEO.exitTiles).toEqual([[227, 247], [227, 248]]);
    const mirrorCorrection = Math.cos(27.47 * DEG);
    expect(BRISBANE_GEO.meta.aspectCorrection).toBeCloseTo(mirrorCorrection, 11);
    expect(projector()(153.026, -27.456)[1])
      .toBeLessThan(projector()(153.026, -27.466)[1]);
  });

  it('POI 11·역 4·CityCat 선착장 2의 좌표와 en/ko 이름을 보존한다', () => {
    expect(BRISBANE_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(BRISBANE_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    expect(BRISBANE_GEO.transitPoints.map(({ id }) => id)).toEqual(FERRY_STOP_IDS);
    const project = projector();
    const markers = [
      ...BRISBANE_GEO.pois,
      ...BRISBANE_GEO.stations,
      ...BRISBANE_GEO.transitPoints,
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
      expect(entry.tile[0], entry.id).toBeLessThan(BRISBANE_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(BRISBANE_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(BRISBANE_GEO.pois, 'qagoma').representationPolicy)
      .toBe('exterior-and-name-only-no-collection-reproduction');
    expect(byId(BRISBANE_GEO.pois, 'story-bridge')).toMatchObject({
      kind: 'historic-bridge',
      terrainHint: 'ROAD',
    });
  });

  it('North Coast·Merivale 철도 순서와 Roma Street 환승을 보존한다', () => {
    const northCoast = ['roma-street', 'central', 'fortitude-valley']
      .map((id) => byId(BRISBANE_GEO.stations, id));
    const merivale = ['roma-street', 'south-brisbane']
      .map((id) => byId(BRISBANE_GEO.stations, id));
    for (const station of northCoast) expect(station.routeIds).toContain('north-coast');
    for (const station of merivale) expect(station.routeIds).toContain('merivale');
    expect(byId(BRISBANE_GEO.stations, 'roma-street').routeIds)
      .toEqual(['north-coast', 'merivale']);
    expect(fastTravelDestinations(BRISBANE_GEO.stations, 'central')).toHaveLength(3);
  });

  it('지형 질량·브리즈번강 단면·BRIDGE=0·교량 차도 회랑을 고정한다', () => {
    const counts = {};
    for (const code of BRISBANE_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 101_477,
      [CITY_TILE.SIDEWALK]: 122_875,
      [CITY_TILE.CROSSWALK]: 6_823,
      [CITY_TILE.PLAZA]: 3,
      [CITY_TILE.PARK]: 19_057,
      [CITY_TILE.WATER]: 14_834,
      [CITY_TILE.BUILDING]: 30_576,
      [CITY_TILE.RIVER]: 7_363,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(BRISBANE_GEO.railways.tileCount).toBe(3_868);
    expect(verticalWaterSection(153.028, [-27.495, -27.445]))
      .toEqual({ sumM: 320, runM: 320 });
    expect(hasRoadNear(153.0358, -27.4636)).toBe(true);
    expect(hasRoadNear(153.0224, -27.4765)).toBe(true);
  });

  it('CityCat edge를 포함한 모든 보행 타일을 단일 4방 성분으로 잇는다', () => {
    expect(cardinalComponentSizes()).toEqual([250_235]);
    const seen = reachableWithFerry(byId(BRISBANE_GEO.stations, 'central').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < BRISBANE_GEO.terrain.length; index += 1) {
      if (isCityBlocked(BRISBANE_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(250_235);
    for (const entry of [
      ...BRISBANE_GEO.pois,
      ...BRISBANE_GEO.stations,
      ...BRISBANE_GEO.transitPoints,
    ]) {
      expect(seen[entry.tile[1] * BRISBANE_GEO.meta.grid.w + entry.tile[0]], entry.id)
        .toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = BRISBANE_GEO.meta.grid.w * BRISBANE_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      BRISBANE_GEO.meta.grid.w,
      BRISBANE_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 544,
      sourceHeight: 557,
      width: 1_632,
      height: 1_671,
      backingBytes: 10_908_288,
    });
    expect(estimatedPeakBytes).toBe(14_241_376);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildBrisbaneCityGeo();
    const second = buildBrisbaneCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('4dec729eda00c7b90232ce0c36546401b0465e2c6dd4d90d4fa4dcc93a00be31');
    expect(hash(first.railways.mask))
      .toBe('0584355c37b87d599e534f5f5a389b79c670ec5005a6bf57dcea3347cef60faf');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(110_793);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(2_819);
    expect(first.pois).toEqual(BRISBANE_GEO.pois);
    expect(first.stations).toEqual(BRISBANE_GEO.stations);
    expect(first.transitPoints).toEqual(BRISBANE_GEO.transitPoints);
    const firstPng = renderBrisbanePng(first);
    const secondPng = renderBrisbanePng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('64a330b62c8db437ef9551eac46340e6b8184e62ad4dada4bf0e359b92e7fb0e');
  }, 120_000);
});
