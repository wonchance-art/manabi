import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildMelbourneCityGeo,
} from '../../../../scripts/build-melbourne-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { MELBOURNE_GEO } from '../cities/melbourne.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'flinders-street-station',
  'federation-square',
  'hosier-lane',
  'queen-victoria-market',
  'state-library',
  'carlton-gardens',
  'lygon-street',
  'fitzroy-brunswick-st',
  'royal-botanic-gardens',
  'shrine-of-remembrance',
  'mcg',
  'st-kilda',
]);
const STATION_IDS = Object.freeze([
  'flinders-street',
  'southern-cross',
  'melbourne-central',
  'parliament',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = MELBOURNE_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / MELBOURNE_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / MELBOURNE_GEO.meta.metersPerTile,
    ];
  };
};

function cardinalComponentSizes() {
  const { w, h } = MELBOURNE_GEO.meta.grid;
  const seen = new Uint8Array(MELBOURNE_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < MELBOURNE_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(MELBOURNE_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(MELBOURNE_GEO.terrain[next])) continue;
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
  const { w } = MELBOURNE_GEO.meta.grid;
  const centerX = Math.floor(project(lon, latRange[0])[0]);
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (let offset = -8; offset <= 8; offset += 1) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = MELBOURNE_GEO.terrain[y * w + centerX + offset];
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
  const { w, h } = MELBOURNE_GEO.meta.grid;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const code = MELBOURNE_GEO.terrain[y * w + x];
      if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK) return true;
    }
  }
  return false;
}

function nearestRailDistance(tile) {
  const { w } = MELBOURNE_GEO.meta.grid;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < MELBOURNE_GEO.railways.mask.length; index += 1) {
    if (!MELBOURNE_GEO.railways.mask[index]) continue;
    const x = index % w;
    const y = Math.floor(index / w);
    best = Math.min(best, Math.max(
      Math.abs(x - tile[0]),
      Math.abs(y - tile[1]),
    ));
  }
  return best;
}

function renderMelbournePng(geo) {
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

describe('Melbourne 상세 geo 계약', () => {
  it('20m bbox·영어 schema·남반구 투영·Flinders Street 입구를 고정한다', () => {
    expect(MELBOURNE_GEO.meta).toMatchObject({
      city: 'melbourne',
      bbox: [144.90, -37.88, 145.01, -37.78],
      grid: { w: 484, h: 557 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.789833986695,
      contentLocale: 'en',
      schema: {
        nameField: 'nameEn',
        companionNameField: 'nameKo',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: '47467758025ccd49504604933fb779cc3d8c74f191277398271ab4ea5c439bc8',
        snapshotSha256: '99c2a2d559eb70e932a86151d2773c52206ed669d31c27254251c2fa4e70e2da',
        license: 'ODbL 1.0',
      },
      southernHemisphereProjection: {
        method: 'signed-mid-latitude-positive-cosine-v1',
        midLatitude: -37.83,
        correctionIsPositive: true,
        northProjectsUp: true,
      },
      connectivity: {
        method: 'cardinal-land-single-component-v1',
      },
      contentPolicy: {
        focus: 'laneways-markets-gardens-yarra-coast',
        militaryNarrative: 'excluded',
        brandSignage: 'generalized-no-reproduction',
        personLikeness: 'excluded',
        specificArtworkReproduction: 'excluded',
        sportsMatchAndTeamReproduction: 'excluded',
        exhibitionReproduction: 'excluded',
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.106982,
        finalLandBuildingRatio: 0.109775,
      },
      bridgeNormalization: {
        method: 'korean-bridge-three-way-mirror-v1',
        sourceBridgeTileCount: 1_077,
        componentCount: 157,
        roadComponentCount: 131,
        absorbedComponentCount: 26,
        roadTileCount: 1_033,
        absorbedWaterTileCount: 27,
        absorbedRiverTileCount: 17,
        finalBridgeTileCount: 0,
      },
    });
    expect(MELBOURNE_GEO.terrain).toHaveLength(269_588);
    expect(MELBOURNE_GEO.entrance).toEqual({ x: 294, y: 213, facing: 'down' });
    expect(MELBOURNE_GEO.exitTiles).toEqual([[294, 203], [294, 204]]);
    expect(projector()(144.97, -37.79)[1])
      .toBeLessThan(projector()(144.97, -37.87)[1]);
  });

  it('POI 12·역 4의 좌표·en/ko 이름·재현 제한을 보존한다', () => {
    expect(MELBOURNE_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(MELBOURNE_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...MELBOURNE_GEO.pois, ...MELBOURNE_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('en');
      expect(entry.nameEn, entry.id).toBeTruthy();
      expect(entry.nameKo, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(MELBOURNE_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(MELBOURNE_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(MELBOURNE_GEO.pois, 'hosier-lane').representationPolicy)
      .toContain('no-specific-artwork-reproduction');
    expect(byId(MELBOURNE_GEO.pois, 'carlton-gardens').representationPolicy)
      .toContain('no-exhibit-reproduction');
    expect(byId(MELBOURNE_GEO.pois, 'shrine-of-remembrance').representationPolicy)
      .toContain('no-military-or-exhibition-narrative');
    expect(byId(MELBOURNE_GEO.pois, 'mcg').representationPolicy)
      .toContain('no-match-team-or-brand-reproduction');
    expect(byId(MELBOURNE_GEO.pois, 'st-kilda').representationPolicy)
      .toContain('generalized-gate-exterior');
    for (const poi of MELBOURNE_GEO.pois) {
      expect(poi).not.toHaveProperty('desc');
      expect(poi).not.toHaveProperty('narrative');
      expect(poi).not.toHaveProperty('story');
      expect(poi).not.toHaveProperty('exhibit');
    }
  });

  it('City Loop·City Circle tram 유효 순서와 fast-travel을 고정한다', () => {
    const stations = STATION_IDS.map((id) => byId(MELBOURNE_GEO.stations, id));
    for (const station of stations) {
      expect(station.routeId).toBe('melbourne-city-loop');
      expect(station.routeIds).toEqual(['melbourne-city-loop', 'city-circle-tram']);
      expect(nearestRailDistance(station.tile), station.id).toBeLessThanOrEqual(8);
    }
    const [flinders, southernCross, melbourneCentral, parliament] = stations;
    expect(southernCross.tile[0]).toBeLessThan(flinders.tile[0]);
    expect(melbourneCentral.tile[1]).toBeLessThan(flinders.tile[1]);
    expect(parliament.tile[0]).toBeGreaterThan(melbourneCentral.tile[0]);
    expect(fastTravelDestinations(MELBOURNE_GEO.stations, 'flinders-street')
      .map(({ id }) => id)).toEqual(expect.arrayContaining(STATION_IDS.slice(1)));
    expect(MELBOURNE_GEO.transitPoints.map(({ id }) => id))
      .toEqual(['flinders-street']);
    expect(MELBOURNE_GEO.meta.connectivity).not.toHaveProperty('ferryLinks');
  });

  it('지형 질량·야라강 단면·BRIDGE=0·Princes Bridge 차도 회랑을 고정한다', () => {
    const counts = {};
    for (const code of MELBOURNE_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 93_549,
      [CITY_TILE.SIDEWALK]: 109_918,
      [CITY_TILE.CROSSWALK]: 8_704,
      [CITY_TILE.PLAZA]: 8,
      [CITY_TILE.PARK]: 13_996,
      [CITY_TILE.WATER]: 12_028,
      [CITY_TILE.BUILDING]: 27_890,
      [CITY_TILE.RIVER]: 3_495,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(MELBOURNE_GEO.railways.tileCount).toBe(12_840);
    expect(verticalWaterSection(144.958, [-37.83, -37.81]))
      .toEqual({ sumM: 160, runM: 160 });
    expect(hasRoadNear(144.9687, -37.8196)).toBe(true);
  });

  it('모든 보행 타일과 보호 마커를 단일 4방 성분으로 잇는다', () => {
    expect(cardinalComponentSizes()).toEqual([226_175]);
    const { w, h } = MELBOURNE_GEO.meta.grid;
    const seen = new Uint8Array(MELBOURNE_GEO.terrain.length);
    const queue = [MELBOURNE_GEO.entrance.y * w + MELBOURNE_GEO.entrance.x];
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
        if (seen[next] || isCityBlocked(MELBOURNE_GEO.terrain[next])) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    expect(queue).toHaveLength(226_175);
    for (const entry of [...MELBOURNE_GEO.pois, ...MELBOURNE_GEO.stations]) {
      expect(seen[entry.tile[1] * w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = MELBOURNE_GEO.meta.grid.w * MELBOURNE_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      MELBOURNE_GEO.meta.grid.w,
      MELBOURNE_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 484,
      sourceHeight: 557,
      width: 1_452,
      height: 1_671,
      backingBytes: 9_705_168,
    });
    expect(estimatedPeakBytes).toBe(12_670_636);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildMelbourneCityGeo();
    const second = buildMelbourneCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('9df642ed65d6ec95e2cf6976f7751f458b14801bc5f85e2a9f7d2553faf0a833');
    expect(hash(first.railways.mask))
      .toBe('0a37895861572486951d52c5d39f09cee0e2635f99115a6e5e8bdfd63edf851b');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(84_656);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(9_487);
    expect(first.pois).toEqual(MELBOURNE_GEO.pois);
    expect(first.stations).toEqual(MELBOURNE_GEO.stations);
    const firstPng = renderMelbournePng(first);
    const secondPng = renderMelbournePng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('fdaaf77bd194fc5e8b3a3afef41270a062b784e330bcf529c82c2d403ce0fa49');
  }, 120_000);
});
