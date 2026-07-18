import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildKawaguchikoCityGeo,
} from '../../../../scripts/build-kawaguchiko-city-geo.mjs';
import {
  encodeTerrainRle,
} from '../../../../scripts/build-french-city-geo-core.mjs';
import { renderCityPng } from '../../../../scripts/world/render-city-map.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { KAWAGUCHIKO_GEO } from '../cities/kawaguchiko.geo.js';
import {
  CITY_TILE,
  fastTravelDestinations,
  isCityBlocked,
} from '../cities/terrain.js';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'kawaguchiko-station',
  'oishi-park',
  'tenjozan-park',
  'chureito',
  'arakura-sengen',
  'oshino-hakkai',
  'kitaguchi-hongu',
  'fujiyoshida-honcho',
  'lake-kawaguchi',
  'funatsu-onsen',
  'subaru-5th',
]);
const STATION_IDS = Object.freeze([
  'kawaguchiko',
  'fujisan',
  'shimoyoshida',
]);
const FERRY_STOP_IDS = Object.freeze([
  'funatsu-pier',
  'oishi-landing',
]);
const FIXED_COORDS = Object.freeze({
  pois: Object.freeze({
    'kawaguchiko-station': [35.4986, 138.7645],
    'oishi-park': [35.5233, 138.7355],
    'tenjozan-park': [35.5015, 138.7688],
    chureito: [35.5017, 138.8011],
    'arakura-sengen': [35.504, 138.8],
    'oshino-hakkai': [35.46, 138.845],
    'kitaguchi-hongu': [35.4779, 138.792],
    'fujiyoshida-honcho': [35.487, 138.807],
    'lake-kawaguchi': [35.511, 138.753],
    'funatsu-onsen': [35.503, 138.762],
    'subaru-5th': [35.3966, 138.7327],
  }),
  stations: Object.freeze({
    kawaguchiko: [35.4983, 138.7649],
    fujisan: [35.4879, 138.7999],
    shimoyoshida: [35.4849, 138.7947],
  }),
  transitPoints: Object.freeze({
    'funatsu-pier': [35.5069, 138.7577],
    'oishi-landing': [35.5205, 138.7387],
  }),
});
const TILE_OVERRIDES = Object.freeze({
  kawaguchiko: Object.freeze({
    projectedTile: Object.freeze([180, 287]),
    tile: Object.freeze([180, 288]),
    tileAdjustment: 'deterministic-nearest-valid-marker-separation',
  }),
  fujisan: Object.freeze({
    projectedTile: Object.freeze([339, 345]),
    tile: Object.freeze([319, 370]),
    tileAdjustment: 'snapshot-rail-and-road-aligned-station-marker',
  }),
  shimoyoshida: Object.freeze({
    projectedTile: Object.freeze([315, 362]),
    tile: Object.freeze([355, 291]),
    tileAdjustment: 'snapshot-rail-and-road-aligned-station-marker',
  }),
});

const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = KAWAGUCHIKO_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / KAWAGUCHIKO_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / KAWAGUCHIKO_GEO.meta.metersPerTile,
    ];
  };
};

function nearestMaskDistance(mask, tile, maxRadius = 24) {
  const { w, h } = KAWAGUCHIKO_GEO.meta.grid;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (mask[y * w + x]) return radius;
      }
    }
  }
  return Infinity;
}

function nearestWaterDistance(tile, maxRadius = 24) {
  const { w, h } = KAWAGUCHIKO_GEO.meta.grid;
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = tile[0] + dx;
        const y = tile[1] + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const code = KAWAGUCHIKO_GEO.terrain[y * w + x];
        if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) return radius;
      }
    }
  }
  return Infinity;
}

function ferryAdjacency() {
  const { w } = KAWAGUCHIKO_GEO.meta.grid;
  const stopIndexes = new Map(KAWAGUCHIKO_GEO.transitPoints.map(({ id, tile }) => (
    [id, tile[1] * w + tile[0]]
  )));
  const adjacency = new Map();
  for (const { stopIds } of KAWAGUCHIKO_GEO.meta.connectivity.ferryLinks) {
    const [left, right] = stopIds.map((id) => stopIndexes.get(id));
    if (!adjacency.has(left)) adjacency.set(left, []);
    if (!adjacency.has(right)) adjacency.set(right, []);
    adjacency.get(left).push(right);
    adjacency.get(right).push(left);
  }
  return adjacency;
}

function reachableFrom(startTile, withFerry = false) {
  const { w, h } = KAWAGUCHIKO_GEO.meta.grid;
  const seen = new Uint8Array(KAWAGUCHIKO_GEO.terrain.length);
  const queue = new Int32Array(KAWAGUCHIKO_GEO.terrain.length);
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
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || isCityBlocked(KAWAGUCHIKO_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function cardinalComponentSizes() {
  const { w, h } = KAWAGUCHIKO_GEO.meta.grid;
  const seen = new Uint8Array(KAWAGUCHIKO_GEO.terrain.length);
  const sizes = [];
  for (let start = 0; start < KAWAGUCHIKO_GEO.terrain.length; start += 1) {
    if (seen[start] || isCityBlocked(KAWAGUCHIKO_GEO.terrain[start])) continue;
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
        if (seen[next] || isCityBlocked(KAWAGUCHIKO_GEO.terrain[next])) continue;
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
  const { w } = KAWAGUCHIKO_GEO.meta.grid;
  const centerY = Math.floor(project(lonRange[0], lat)[1]);
  const [x0, x1] = lonRange.map((lon) => Math.floor(project(lon, lat)[0]))
    .sort((left, right) => left - right);
  let best = { sumM: 0, runM: 0 };
  for (let offset = -8; offset <= 8; offset += 1) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    for (let x = x0; x <= x1; x += 1) {
      const code = KAWAGUCHIKO_GEO.terrain[(centerY + offset) * w + x];
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

function renderKawaguchikoPng(geo) {
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

describe('가와구치코 상세 geo 계약', () => {
  it('오너 확정 bbox·20m·일본어 schema·24MiB 계약을 고정한다', () => {
    expect(KAWAGUCHIKO_GEO.meta).toMatchObject({
      city: 'kawaguchiko',
      bbox: [138.725, 35.395, 138.85, 35.55],
      grid: { w: 567, h: 863 },
      metersPerTile: 20,
      projection: 'webmercator',
      aspectCorrection: 0.814394141983,
      contentLocale: 'ja',
      schema: {
        nameField: 'nameJa',
        readingField: 'yomi',
        localeSlots: 'central-lookup-expandable',
      },
      source: {
        rawOverpassSha256: '10ab0bd5d0484c47013298d9bd0331e2420a27822090dd2397369d2b79e961b1',
        snapshotSha256: '7c6e54a2432e754201acbcdd583419a7cc4c45df75aa88a44e3b7d576a99bf82',
        license: 'ODbL 1.0',
        partitionCount: 16,
        queryCount: 48,
      },
      memory: {
        method: '47-byte-per-cell-upper-bound-v1',
        estimatedBytes: 22_998_087,
        limitBytes: 25_165_824,
      },
      buildingTexture: {
        method: 'osm-existing-buildings-report-only',
        initialLandBuildingRatio: 0.021474,
        finalLandBuildingRatio: 0.05609,
      },
      bridgeNormalization: {
        method: 'kawaguchiko-bridge-zero-normalization-v1',
        sourceBridgeTileCount: 996,
        finalBridgeTileCount: 0,
      },
    });
    expect(KAWAGUCHIKO_GEO.terrain).toHaveLength(489_321);
    expect(KAWAGUCHIKO_GEO.entrance).toEqual({ x: 180, y: 288, facing: 'down' });
    expect(KAWAGUCHIKO_GEO.exitTiles).toEqual([[180, 278], [180, 279]]);
  });

  it('POI 11·역 3·페리 2의 SPEC 좌표와 nameJa/yomi를 보존한다', () => {
    expect(KAWAGUCHIKO_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(KAWAGUCHIKO_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    expect(KAWAGUCHIKO_GEO.transitPoints.map(({ id }) => id)).toEqual(FERRY_STOP_IDS);
    for (const [group, entries] of Object.entries(FIXED_COORDS)) {
      for (const [id, [lat, lon]] of Object.entries(entries)) {
        expect(byId(KAWAGUCHIKO_GEO[group], id), id).toMatchObject({ lat, lon });
      }
    }
    const project = projector();
    const markers = [
      ...KAWAGUCHIKO_GEO.pois,
      ...KAWAGUCHIKO_GEO.stations,
      ...KAWAGUCHIKO_GEO.transitPoints,
    ];
    for (const entry of markers) {
      expect(entry.contentLocale, entry.id).toBe('ja');
      expect(entry.nameJa, entry.id).toBeTruthy();
      expect(entry.yomi, entry.id).toBeTruthy();
      expect(entry, entry.id).not.toHaveProperty('nameEn');
      expect(entry, entry.id).not.toHaveProperty('nameKo');
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(KAWAGUCHIKO_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(KAWAGUCHIKO_GEO.meta.grid.h);
      if (!TILE_OVERRIDES[entry.id]) {
        const [expectedX, expectedY] = project(entry.lon, entry.lat);
        expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
          .toBeLessThanOrEqual(2.5);
      }
    }
    for (const [id, expected] of Object.entries(TILE_OVERRIDES)) {
      expect(byId(KAWAGUCHIKO_GEO.stations, id)).toMatchObject(expected);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
  });

  it('후지급행 3역 fast-travel 순서와 snapshot rail 정합을 고정한다', () => {
    for (const station of KAWAGUCHIKO_GEO.stations) {
      expect(station.routeId).toBe('fujikyuko-line');
      expect(station.routeIds).toEqual(['fujikyuko-line']);
    }
    expect(fastTravelDestinations(KAWAGUCHIKO_GEO.stations, 'kawaguchiko')
      .map(({ id }) => id)).toEqual(['fujisan', 'shimoyoshida']);
    expect(KAWAGUCHIKO_GEO.stations
      .map(({ tile }) => nearestMaskDistance(KAWAGUCHIKO_GEO.railways.mask, tile)))
      .toEqual([8, 0, 0]);
  });

  it('북사면 마커만 bounded road 회랑으로 잇고 5합목 별도 성분을 허용한다', () => {
    expect(KAWAGUCHIKO_GEO.meta.mountainAnchorCorridors).toMatchObject({
      method: 'snapshot-road-mask-preservation-plus-bounded-anchor-corridor-v1',
      preservedMountainRoadTileCount: 0,
      directAnchorChangedTileCount: 17,
      cardinalizedMountainRoadTileCount: 1,
      changedTileCount: 18,
    });
    expect(KAWAGUCHIKO_GEO.meta.mountainAnchorCorridors.entries
      .map(({ id, roadTargetTile, changedTileCount }) => ({
        id,
        roadTargetTile,
        changedTileCount,
      }))).toEqual([
      { id: 'chureito', roadTargetTile: [344, 270], changedTileCount: 1 },
      { id: 'arakura-sengen', roadTargetTile: [346, 256], changedTileCount: 7 },
      { id: 'subaru-5th', roadTargetTile: [38, 858], changedTileCount: 9 },
    ]);
    expect(byId(KAWAGUCHIKO_GEO.pois, 'subaru-5th').tile).toEqual([34, 853]);
    expect(cardinalComponentSizes()).toEqual([98_201, 33]);
    expect(KAWAGUCHIKO_GEO.meta.connectivity).toMatchObject({
      walkableTileCount: 98_234,
      ferryReachableTileCount: 98_201,
      fifthStationComponentTileCount: 33,
      fifthStationSeparate: true,
    });
    expect([...POI_IDS, ...STATION_IDS]).not.toContain('mount-fuji-summit');
    expect([...POI_IDS, ...STATION_IDS]).not.toContain('aokigahara');
  });

  it('가와구치호 ferry link·두 선착장 수계 근접·보행 성분을 고정한다', () => {
    expect(KAWAGUCHIKO_GEO.meta.connectivity.ferryLinks).toEqual([
      {
        id: 'lake-kawaguchi-cruise',
        mode: 'ferry',
        stopIds: ['funatsu-pier', 'oishi-landing'],
      },
    ]);
    expect(KAWAGUCHIKO_GEO.transitPoints
      .map(({ tile }) => nearestWaterDistance(tile))).toEqual([20, 5]);
    const mainTile = byId(KAWAGUCHIKO_GEO.stations, 'kawaguchiko').tile;
    const fifthTile = byId(KAWAGUCHIKO_GEO.pois, 'subaru-5th').tile;
    const seen = reachableFrom(mainTile, true);
    expect(seen.reduce((sum, value) => sum + value, 0)).toBe(98_201);
    expect(seen[fifthTile[1] * KAWAGUCHIKO_GEO.meta.grid.w + fifthTile[0]]).toBe(0);
    for (const entry of [
      ...KAWAGUCHIKO_GEO.pois.filter(({ id }) => id !== 'subaru-5th'),
      ...KAWAGUCHIKO_GEO.stations,
      ...KAWAGUCHIKO_GEO.transitPoints,
    ]) {
      expect(seen[entry.tile[1] * KAWAGUCHIKO_GEO.meta.grid.w + entry.tile[0]], entry.id)
        .toBe(1);
    }
  });

  it('가와구치호 단면·지형 질량·BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of KAWAGUCHIKO_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 49_721,
      [CITY_TILE.SIDEWALK]: 48_173,
      [CITY_TILE.CROSSWALK]: 82,
      [CITY_TILE.PLAZA]: 6,
      [CITY_TILE.PARK]: 252,
      [CITY_TILE.WATER]: 12_636,
      [CITY_TILE.BUILDING]: 25_802,
      [CITY_TILE.RIVER]: 16_678,
      [CITY_TILE.MOUNTAIN]: 335_971,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(KAWAGUCHIKO_GEO.railways.tileCount).toBe(589);
    expect(horizontalWaterSection(35.52, [138.725, 138.78]))
      .toEqual({ sumM: 2_840, runM: 2_400 });
  });

  it('핵심 배열·적응형 미니맵 추정 피크가 24MiB 안이다', () => {
    const cells = KAWAGUCHIKO_GEO.meta.grid.w * KAWAGUCHIKO_GEO.meta.grid.h;
    const layout = cityMinimapLayout(
      KAWAGUCHIKO_GEO.meta.grid.w,
      KAWAGUCHIKO_GEO.meta.grid.h,
    );
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes
      + sourceCanvasBytes * 2;
    expect(layout).toMatchObject({
      factor: 1,
      sourceWidth: 567,
      sourceHeight: 863,
      width: 1_701,
      height: 2_589,
      backingBytes: 17_615_556,
    });
    expect(estimatedPeakBytes).toBe(22_998_087);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('민감 장소는 외관·지리만 남기고 금지 콘텐츠 필드를 노출하지 않는다', () => {
    expect(KAWAGUCHIKO_GEO.meta.contentPolicy).toMatchObject({
      focus: 'lake-mountain-shrines-streetscape',
      brandSignage: 'generalized-no-reproduction',
      personLikeness: 'excluded',
      specificArtworkAndGraffitiReproduction: 'excluded',
      sportsMatchAndTeamReproduction: 'excluded',
      exhibitionReproduction: 'excluded',
      aokigahara: 'outside-bbox-and-excluded',
      mountFujiSummit: 'outside-bbox-act-scene-only',
    });
    expect(byId(KAWAGUCHIKO_GEO.pois, 'chureito').representationPolicy)
      .toContain('no-person-likeness-reproduction');
    expect(byId(KAWAGUCHIKO_GEO.pois, 'fujiyoshida-honcho').representationPolicy)
      .toContain('no-brand-signage-reproduction');
    for (const entry of KAWAGUCHIKO_GEO.pois) {
      for (const field of ['desc', 'narrative', 'story', 'exhibit', 'brand', 'team']) {
        expect(entry, `${entry.id}.${field}`).not.toHaveProperty(field);
      }
    }
  });

  it('두 번 재생성과 전체 PNG가 byte-identical이다', () => {
    const first = buildKawaguchikoCityGeo();
    const second = buildKawaguchikoCityGeo();
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain))
      .toBe('f39c90befea4a29158859ec18e91c7f7286175be7f66b2141f425b0d8b4aecd6');
    expect(hash(first.railways.mask))
      .toBe('f49fcf260f53031df1e67ecf1f94583a3b8929bd93b39f7363bd98c2a7521500');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(76_046);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(657);
    expect(first.meta).toEqual(KAWAGUCHIKO_GEO.meta);
    expect(first.pois).toEqual(KAWAGUCHIKO_GEO.pois);
    expect(first.stations).toEqual(KAWAGUCHIKO_GEO.stations);
    expect(first.transitPoints).toEqual(KAWAGUCHIKO_GEO.transitPoints);
    const firstPng = renderKawaguchikoPng(first);
    const secondPng = renderKawaguchikoPng(second);
    expect(firstPng).toEqual(secondPng);
    expect(hash(firstPng))
      .toBe('91b526d4a325f4930752e68e855e179913858aef67a2d776d7b9359694e9d85f');
  }, 120_000);
});
