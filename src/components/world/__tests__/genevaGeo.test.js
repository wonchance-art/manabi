import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildGenevaCityGeo,
} from '../../../../scripts/build-geneva-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { GENEVA_GEO } from '../cities/geneva.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'jet-deau',
  'cathedrale-saint-pierre',
  'jardin-anglais',
  'bains-des-paquis',
  'palais-des-nations',
  'plainpalais',
  'carouge',
  'parc-des-bastions',
  'gare-cornavin',
  'vieille-ville',
]);
const FIXED_COORDS = Object.freeze({
  pois: Object.freeze({
    'jet-deau': [46.2074, 6.1561],
    'cathedrale-saint-pierre': [46.201, 6.1488],
    'jardin-anglais': [46.2038, 6.152],
    'bains-des-paquis': [46.2117, 6.1547],
    'palais-des-nations': [46.2266, 6.14],
    plainpalais: [46.197, 6.142],
    carouge: [46.181, 6.139],
    'parc-des-bastions': [46.1995, 6.145],
    'gare-cornavin': [46.2104, 6.1425],
    'vieille-ville': [46.2005, 6.1495],
  }),
  stations: Object.freeze({
    cornavin: [46.2104, 6.1425],
  }),
  transitPoints: Object.freeze({
    'paquis-jetee': [46.211, 6.1535],
    'eaux-vives-landing': [46.2065, 6.159],
  }),
});
const CARDINAL = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = GENEVA_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / GENEVA_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / GENEVA_GEO.meta.metersPerTile,
    ];
  };
};

function ferryAdjacency() {
  const { w } = GENEVA_GEO.meta.grid;
  const stopIndexes = new Map(GENEVA_GEO.transitPoints.map(({ id, tile }) => (
    [id, tile[1] * w + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of GENEVA_GEO.meta.connectivity.ferryLinks) {
    const [left, right] = stopIds.map((id) => stopIndexes.get(id));
    adjacency.set(left, [...(adjacency.get(left) ?? []), right]);
    adjacency.set(right, [...(adjacency.get(right) ?? []), left]);
  }
  return adjacency;
}

function reachableFrom(startTile, withFerry = false) {
  const { w, h } = GENEVA_GEO.meta.grid;
  const seen = new Uint8Array(GENEVA_GEO.terrain.length);
  const queue = new Int32Array(GENEVA_GEO.terrain.length);
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
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(GENEVA_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function verticalWaterSection(lon, latRange) {
  const project = projector();
  const centerX = Math.floor(project(lon, latRange[0])[0]);
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (let offset = -8; offset <= 8; offset += 1) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = GENEVA_GEO.terrain[
        y * GENEVA_GEO.meta.grid.w + centerX + offset
      ];
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

function horizontalWaterSection(lat, lonRange) {
  const project = projector();
  const centerY = Math.floor(project(lonRange[0], lat)[1]);
  const [x0, x1] = lonRange.map((lon) => Math.floor(project(lon, lat)[0]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (let offset = -6; offset <= 6; offset += 1) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let x = x0; x <= x1; x += 1) {
      const code = GENEVA_GEO.terrain[
        (centerY + offset) * GENEVA_GEO.meta.grid.w + x
      ];
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

function railwayDistance(tile) {
  const { w, h } = GENEVA_GEO.meta.grid;
  for (let radius = 0; radius <= 12; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x >= 0 && y >= 0 && x < w && y < h
          && GENEVA_GEO.railways.mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function renderGenevaPng(geo) {
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

describe('제네바 상세 geo 계약', () => {
  it('확정 bbox·20m·프랑스어 schema·Cornavin 입구를 고정한다', () => {
    expect(GENEVA_GEO.meta).toMatchObject({
      city: 'geneva',
      bbox: [6.105, 46.175, 6.185, 46.240],
      grid: { w: 309, h: 362 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.692048689748,
      contentLocale: 'fr',
      schema: {
        nameField: 'nameFr',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: 'c95251f71cc182c4f0098ea18e515a5bf215fe0ceea7ee8063ad403ddc6dedf2',
        snapshotSha256: 'd60e7a789cfcae39db6d2971ef4ae6cda0ab6b661be917d3444205e3ff66012b',
        partitionCount: 16,
        queryCount: 48,
        license: 'ODbL 1.0',
      },
      connectivity: {
        method: 'cardinal-land-plus-geneva-lake-ferry-v1',
        ferryLinks: [{
          id: 'geneva-lake-shuttle',
          mode: 'ferry',
          stopIds: ['paquis-jetee', 'eaux-vives-landing'],
        }],
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.106219,
        finalLandBuildingRatio: 0.109007,
      },
      bridgeNormalization: {
        method: 'france-bridge-three-way-v1',
        sourceBridgeTileCount: 346,
        componentCount: 65,
        roadComponentCount: 50,
        absorbedComponentCount: 15,
        roadTileCount: 318,
        absorbedWaterTileCount: 6,
        absorbedRiverTileCount: 22,
        finalBridgeTileCount: 0,
      },
    });
    expect(GENEVA_GEO.terrain).toHaveLength(111_858);
    expect(GENEVA_GEO.entrance).toEqual({ x: 144, y: 164, facing: 'down' });
    expect(GENEVA_GEO.exitTiles).toEqual([[144, 154], [144, 155]]);
  });

  it('POI 10·Cornavin 역 1·페리 정류장 2의 좌표와 nameFr를 보존한다', () => {
    expect(GENEVA_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(GENEVA_GEO.stations.map(({ id }) => id)).toEqual(['cornavin']);
    expect(GENEVA_GEO.transitPoints.map(({ id }) => id))
      .toEqual(['paquis-jetee', 'eaux-vives-landing']);
    for (const [group, entries] of Object.entries(FIXED_COORDS)) {
      for (const [id, [lat, lon]] of Object.entries(entries)) {
        expect(byId(GENEVA_GEO[group], id), id).toMatchObject({ lat, lon });
      }
    }
    const project = projector();
    for (const entry of [
      ...GENEVA_GEO.pois,
      ...GENEVA_GEO.stations,
      ...GENEVA_GEO.transitPoints,
    ]) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(1.1);
      expect(entry.contentLocale, entry.id).toBe('fr');
      expect(entry.nameFr, entry.id).toBeTruthy();
      expect(entry, entry.id).not.toHaveProperty('nameEn');
      expect(entry, entry.id).not.toHaveProperty('nameKo');
    }
  });

  it('Cornavin은 POI 앵커와 단일 렌더를 공유하고 철도 mask·fast-travel 계약을 지킨다', () => {
    const station = GENEVA_GEO.stations[0];
    expect(station).toMatchObject({
      id: 'cornavin',
      poiId: 'gare-cornavin',
      routeId: 'geneva-mainline',
      routeIds: ['geneva-mainline'],
    });
    expect(station.tile).toEqual(byId(GENEVA_GEO.pois, 'gare-cornavin').tile);
    expect(railwayDistance(station.tile)).toBe(0);
    expect(fastTravelDestinations(GENEVA_GEO.stations, 'cornavin')).toEqual([]);
  });

  it('UN 건물은 외관만 남기고 엠블럼·기·조형물·서사 필드를 노출하지 않는다', () => {
    expect(byId(GENEVA_GEO.pois, 'palais-des-nations').representationPolicy)
      .toBe('architectural-exterior-only-no-emblem-flag-or-symbol-reproduction');
    expect(GENEVA_GEO.meta.contentPolicy).toMatchObject({
      emblemFlagAndOrganizationalSymbolReproduction: 'excluded',
      specificArtworkAndPublicSculptureReproduction: 'excluded',
    });
    for (const entry of GENEVA_GEO.pois) {
      for (const field of [
        'desc',
        'narrative',
        'story',
        'exhibit',
        'emblem',
        'flag',
        'sculpture',
      ]) {
        expect(entry, `${entry.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('레만호·론강 유출부와 몽블랑교 차도 회랑·BRIDGE=0을 보존한다', () => {
    const counts = {};
    for (const code of GENEVA_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 37_176,
      [CITY_TILE.SIDEWALK]: 31_160,
      [CITY_TILE.CROSSWALK]: 3_061,
      [CITY_TILE.PLAZA]: 5,
      [CITY_TILE.PARK]: 7_744,
      [CITY_TILE.WATER]: 20_554,
      [CITY_TILE.BUILDING]: 9_683,
      [CITY_TILE.RIVER]: 2_475,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(GENEVA_GEO.railways.tileCount).toBe(3_937);
    expect(verticalWaterSection(6.160, [46.202, 46.235]))
      .toEqual({ sumM: 3_240, runM: 3_240 });
    expect(horizontalWaterSection(46.204, [6.125, 6.151]))
      .toEqual({ sumM: 940, runM: 320 });
    expect(GENEVA_GEO.terrain[189 * GENEVA_GEO.meta.grid.w + 169])
      .toBe(CITY_TILE.ROAD);
  });

  it('단일 보행 성분과 양방향 ferry edge가 모든 마커·보행 타일을 연결한다', () => {
    const mainTile = GENEVA_GEO.stations[0].tile;
    const landSeen = reachableFrom(mainTile);
    const ferrySeen = reachableFrom(mainTile, true);
    let walkable = 0;
    let landReached = 0;
    let ferryReached = 0;
    for (let index = 0; index < GENEVA_GEO.terrain.length; index += 1) {
      if (isCityBlocked(GENEVA_GEO.terrain[index])) continue;
      walkable += 1;
      landReached += landSeen[index];
      ferryReached += ferrySeen[index];
    }
    expect(walkable).toBe(79_146);
    expect(landReached).toBe(walkable);
    expect(ferryReached).toBe(walkable);
    for (const entry of [
      ...GENEVA_GEO.pois,
      ...GENEVA_GEO.stations,
      ...GENEVA_GEO.transitPoints,
    ]) {
      expect(ferrySeen[entry.tile[1] * GENEVA_GEO.meta.grid.w + entry.tile[0]], entry.id)
        .toBe(1);
    }
  });

  it('적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = GENEVA_GEO.meta.grid.w * GENEVA_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      GENEVA_GEO.meta.grid.w,
      GENEVA_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 309,
      sourceHeight: 362,
      width: 927,
      height: 1_086,
      backingBytes: 4_026_888,
    });
    expect(estimatedPeakBytes).toBe(5_257_326);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildGenevaCityGeo();
    const second = buildGenevaCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('97f8230b0fb6b18f7ac47c5b368f88cadfcca6584b239900b429a6c9a7298b27');
    expect(hash(first.railways.mask))
      .toBe('23152c014c8ed226729ecc0d3208edac19dedf56b3648a2221300a01b25a50de');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(39_929);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(3_157);
    expect(first.pois).toEqual(GENEVA_GEO.pois);
    expect(first.stations).toEqual(GENEVA_GEO.stations);
    expect(first.transitPoints).toEqual(GENEVA_GEO.transitPoints);
    const firstPng = renderGenevaPng(first);
    const secondPng = renderGenevaPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('a1879fb8491ff7c9afeb5123d54977a9f6541b098018534b19114de875ecec8a');
  }, 120_000);
});
