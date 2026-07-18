import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildMarseilleCityGeo,
} from '../../../../scripts/build-marseille-city-geo.mjs';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { MARSEILLE_GEO } from '../cities/marseille.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'vieux-port',
  'notre-dame-de-la-garde',
  'le-panier',
  'mucem',
  'fort-saint-jean',
  'cathedrale-la-major',
  'chateau-dif',
  'vallon-des-auffes',
  'plage-des-catalans',
  'palais-longchamp',
  'cours-julien',
  'stade-velodrome',
]);
const STATION_IDS = Object.freeze([
  'saint-charles',
  'vieux-port-metro',
  'castellane',
  'joliette',
]);
const FERRY_STOP_IDS = Object.freeze([
  'vieux-port-quay',
  'chateau-dif-landing',
  'ferry-boat-south',
  'ferry-boat-north',
]);
const FIXED_COORDS = Object.freeze({
  pois: Object.freeze({
    'vieux-port': [43.2946, 5.3745],
    'notre-dame-de-la-garde': [43.284, 5.3714],
    'le-panier': [43.2995, 5.369],
    mucem: [43.2967, 5.361],
    'fort-saint-jean': [43.2953, 5.362],
    'cathedrale-la-major': [43.2996, 5.3646],
    'chateau-dif': [43.2795, 5.3252],
    'vallon-des-auffes': [43.2803, 5.3495],
    'plage-des-catalans': [43.2896, 5.3532],
    'palais-longchamp': [43.3044, 5.3946],
    'cours-julien': [43.2937, 5.383],
    'stade-velodrome': [43.2697, 5.3959],
  }),
  stations: Object.freeze({
    'saint-charles': [43.3027, 5.3806],
    'vieux-port-metro': [43.2955, 5.3743],
    castellane: [43.2865, 5.3833],
    joliette: [43.3054, 5.3663],
  }),
  transitPoints: Object.freeze({
    'vieux-port-quay': [43.2948, 5.3752],
    'chateau-dif-landing': [43.2799, 5.326],
    'ferry-boat-south': [43.2932, 5.374],
    'ferry-boat-north': [43.2963, 5.3735],
  }),
});
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = MARSEILLE_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / MARSEILLE_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / MARSEILLE_GEO.meta.metersPerTile,
    ];
  };
};

function ferryAdjacency() {
  const { w } = MARSEILLE_GEO.meta.grid;
  const stopIndexes = new Map(MARSEILLE_GEO.transitPoints.map(({ id, tile }) => (
    [id, tile[1] * w + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of MARSEILLE_GEO.meta.connectivity.ferryLinks) {
    const [left, right] = stopIds.map((id) => stopIndexes.get(id));
    if (!adjacency.has(left)) adjacency.set(left, []);
    if (!adjacency.has(right)) adjacency.set(right, []);
    adjacency.get(left).push(right);
    adjacency.get(right).push(left);
  }
  return adjacency;
}

function reachableFrom(startTile, withFerries = false) {
  const { w, h } = MARSEILLE_GEO.meta.grid;
  const seen = new Uint8Array(MARSEILLE_GEO.terrain.length);
  const queue = new Int32Array(MARSEILLE_GEO.terrain.length);
  const adjacency = withFerries ? ferryAdjacency() : new Map();
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
      if (seen[next] || isCityBlocked(MARSEILLE_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const seen = new Uint8Array(MARSEILLE_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < MARSEILLE_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(MARSEILLE_GEO.terrain[start])) continue;
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      const x = index % MARSEILLE_GEO.meta.grid.w;
      const y = Math.floor(index / MARSEILLE_GEO.meta.grid.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0
          || nx >= MARSEILLE_GEO.meta.grid.w || ny >= MARSEILLE_GEO.meta.grid.h) continue;
        const next = ny * MARSEILLE_GEO.meta.grid.w + nx;
        if (seen[next] || isCityBlocked(MARSEILLE_GEO.terrain[next])) continue;
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
  const centerX = Math.floor(project(lon, latRange[0])[0]);
  const [y0, y1] = latRange.map((lat) => Math.floor(project(lon, lat)[1]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (let offset = -8; offset <= 8; offset += 1) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
      const code = MARSEILLE_GEO.terrain[y * MARSEILLE_GEO.meta.grid.w + centerX + offset];
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
  const { w, h } = MARSEILLE_GEO.meta.grid;
  for (let radius = 0; radius <= 12; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x >= 0 && y >= 0 && x < w && y < h
          && MARSEILLE_GEO.railways.mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function renderMarseillePng(geo) {
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

describe('마르세유 상세 geo 계약', () => {
  it('오너 확정 bbox·20m·프랑스어 schema·Saint-Charles 입구를 고정한다', () => {
    expect(MARSEILLE_GEO.meta).toMatchObject({
      city: 'marseille',
      bbox: [5.32, 43.245, 5.42, 43.325],
      grid: { w: 406, h: 446 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.72795227954,
      contentLocale: 'fr',
      schema: {
        nameField: 'nameFr',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: 'a674392d79d804ce0d45e6fae2be3c3140aa276f1159663b71de1ff191c7a7d5',
        snapshotSha256: '94d19706d74a3adf8b7ae299bbf8812eb6aef01bfde8c018cff552a3f1745adf',
        license: 'ODbL 1.0',
      },
      connectivity: {
        method: 'cardinal-land-plus-two-marseille-ferries-v1',
        ferryLinks: [
          {
            id: 'vieux-port-chateau-dif',
            stopIds: ['vieux-port-quay', 'chateau-dif-landing'],
          },
          {
            id: 'vieux-port-ferry-boat',
            stopIds: ['ferry-boat-south', 'ferry-boat-north'],
          },
        ],
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.158023,
        finalLandBuildingRatio: 0.174192,
      },
      bridgeNormalization: {
        method: 'france-bridge-three-way-v1',
        sourceBridgeTileCount: 171,
        componentCount: 41,
        roadComponentCount: 36,
        absorbedComponentCount: 5,
        roadTileCount: 165,
        absorbedWaterTileCount: 0,
        absorbedRiverTileCount: 6,
        finalBridgeTileCount: 0,
      },
    });
    expect(MARSEILLE_GEO.terrain).toHaveLength(181_076);
    expect(MARSEILLE_GEO.entrance).toEqual({ x: 245, y: 124, facing: 'down' });
    expect(MARSEILLE_GEO.exitTiles).toEqual([[245, 114], [245, 115]]);
  });

  it('POI 12·역 4·페리 부두 4의 좌표와 nameFr를 보존한다', () => {
    expect(MARSEILLE_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(MARSEILLE_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    expect(MARSEILLE_GEO.transitPoints.map(({ id }) => id)).toEqual(FERRY_STOP_IDS);
    for (const [group, entries] of Object.entries(FIXED_COORDS)) {
      for (const [id, [lat, lon]] of Object.entries(entries)) {
        expect(byId(MARSEILLE_GEO[group], id), id).toMatchObject({ lat, lon });
      }
    }
    const project = projector();
    const markers = [
      ...MARSEILLE_GEO.pois,
      ...MARSEILLE_GEO.stations,
      ...MARSEILLE_GEO.transitPoints,
    ];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('fr');
      expect(entry.nameFr, entry.id).toBeTruthy();
      expect(entry, entry.id).not.toHaveProperty('nameEn');
      expect(entry, entry.id).not.toHaveProperty('nameKo');
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(MARSEILLE_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(MARSEILLE_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
  });

  it('M1·M2 환승과 Saint-Charles fast-travel 순서를 고정한다', () => {
    expect(byId(MARSEILLE_GEO.stations, 'saint-charles').routeIds)
      .toEqual(['marseille-mainline', 'metro-m1', 'metro-m2']);
    expect(byId(MARSEILLE_GEO.stations, 'vieux-port-metro').routeIds)
      .toEqual(['metro-m1']);
    expect(byId(MARSEILLE_GEO.stations, 'joliette').routeIds)
      .toEqual(['metro-m2']);
    expect(byId(MARSEILLE_GEO.stations, 'castellane').routeIds)
      .toEqual(['metro-m1', 'metro-m2']);
    expect(fastTravelDestinations(MARSEILLE_GEO.stations, 'saint-charles')
      .map(({ id }) => id)).toEqual(['vieux-port-metro', 'castellane', 'joliette']);
    expect(MARSEILLE_GEO.stations.map(({ tile }) => railwayDistance(tile)))
      .toEqual([1, 0, 1, 3]);
  });

  it('민감 POI는 외관·장소 정보만 남기고 콘텐츠 재현 필드를 노출하지 않는다', () => {
    expect(byId(MARSEILLE_GEO.pois, 'mucem').representationPolicy)
      .toBe('architectural-exterior-only-no-collection-or-exhibit-reproduction');
    expect(byId(MARSEILLE_GEO.pois, 'cours-julien').representationPolicy)
      .toContain('no-specific-artwork-or-graffiti-reproduction');
    expect(byId(MARSEILLE_GEO.pois, 'stade-velodrome').representationPolicy)
      .toContain('no-match-club-brand-or-team-reproduction');
    for (const entry of MARSEILLE_GEO.pois) {
      for (const field of ['desc', 'narrative', 'story', 'exhibit', 'brand', 'team']) {
        expect(entry, `${entry.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('구항·외해 수면과 BRIDGE=0을 보존한다', () => {
    const counts = {};
    for (const code of MARSEILLE_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 46_840,
      [CITY_TILE.SIDEWALK]: 34_260,
      [CITY_TILE.CROSSWALK]: 3_357,
      [CITY_TILE.PLAZA]: 4,
      [CITY_TILE.PARK]: 976,
      [CITY_TILE.WATER]: 75_190,
      [CITY_TILE.BUILDING]: 18_113,
      [CITY_TILE.RIVER]: 1_903,
      [CITY_TILE.MOUNTAIN]: 433,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(MARSEILLE_GEO.railways.tileCount).toBe(4_243);
    expect(verticalWaterSection(5.365, [43.285, 43.302]))
      .toEqual({ sumM: 380, runM: 300 });
    expect(verticalWaterSection(5.337, [43.26, 43.31]))
      .toEqual({ sumM: 5_580, runM: 5_580 });
  });

  it('이프성은 육로와 분리되고 두 ferry edge가 모든 보행 타일을 연결한다', () => {
    const mainTile = byId(MARSEILLE_GEO.stations, 'saint-charles').tile;
    const islandTile = byId(MARSEILLE_GEO.pois, 'chateau-dif').tile;
    const landOnly = reachableFrom(mainTile);
    expect(landOnly[islandTile[1] * MARSEILLE_GEO.meta.grid.w + islandTile[0]]).toBe(0);
    const sizes = cardinalComponentSizes();
    expect(sizes).toEqual([85_296, 141]);
    const seen = reachableFrom(mainTile, true);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < MARSEILLE_GEO.terrain.length; index += 1) {
      if (isCityBlocked(MARSEILLE_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    expect(reached).toBe(85_437);
    for (const entry of [
      ...MARSEILLE_GEO.pois,
      ...MARSEILLE_GEO.stations,
      ...MARSEILLE_GEO.transitPoints,
    ]) {
      expect(seen[entry.tile[1] * MARSEILLE_GEO.meta.grid.w + entry.tile[0]], entry.id)
        .toBe(1);
    }
  });

  it('적응형 미니맵 추정 피크가 24 MiB 안이다', () => {
    const cells = MARSEILLE_GEO.meta.grid.w * MARSEILLE_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      MARSEILLE_GEO.meta.grid.w,
      MARSEILLE_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 406,
      sourceHeight: 446,
      width: 1_218,
      height: 1_338,
      backingBytes: 6_518_736,
    });
    expect(estimatedPeakBytes).toBe(8_510_572);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildMarseilleCityGeo();
    const second = buildMarseilleCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('282b339fe173a6c0024bab3f790adf400bf854f31bb7442c4de5a45054bd7d20');
    expect(hash(first.railways.mask))
      .toBe('d706d373399e8a521ef214afe5cc9356850733e2be4c6fbe0f8e8d37eebbe2a8');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(48_909);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(3_585);
    expect(first.pois).toEqual(MARSEILLE_GEO.pois);
    expect(first.stations).toEqual(MARSEILLE_GEO.stations);
    expect(first.transitPoints).toEqual(MARSEILLE_GEO.transitPoints);
    const firstPng = renderMarseillePng(first);
    const secondPng = renderMarseillePng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('d18718931d198f133c2d9f0f62228a6c9e80d9f591a6c7413ce15f778f5b6e17');
  }, 120_000);
});
