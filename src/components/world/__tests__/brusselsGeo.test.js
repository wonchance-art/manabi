import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BRUSSELS_GEO } from '../cities/brussels.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import { buildFrenchCityGeo } from '../../../../scripts/build-french-city-geo.mjs';

const EARTH_RADIUS = 6378137;
const DEG = Math.PI / 180;
const POI_IDS = Object.freeze([
  'grand-place', 'manneken-pis', 'galeries-royales', 'cathedral', 'mont-des-arts',
  'magritte-museum', 'sablon', 'royal-palace', 'parc-cinquantenaire', 'eu-quarter',
  'comics-museum', 'atomium',
]);
const STATION_IDS = Object.freeze([
  'bruxelles-midi', 'bruxelles-central', 'bruxelles-nord', 'schuman',
]);
const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const webMercator = (lon, lat) => ({
  x: EARTH_RADIUS * lon * DEG,
  y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)),
});
const projector = () => {
  const [minLon, minLat, maxLon, maxLat] = BRUSSELS_GEO.meta.bbox;
  const southWest = webMercator(minLon, minLat);
  const northEast = webMercator(maxLon, maxLat);
  const correction = Math.cos(((minLat + maxLat) / 2) * DEG);
  return (lon, lat) => {
    const point = webMercator(lon, lat);
    return [
      ((point.x - southWest.x) * correction) / BRUSSELS_GEO.meta.metersPerTile,
      ((northEast.y - point.y) * correction) / BRUSSELS_GEO.meta.metersPerTile,
    ];
  };
};

function reachableFrom(startTile) {
  const { w, h } = BRUSSELS_GEO.meta.grid;
  const seen = new Uint8Array(BRUSSELS_GEO.terrain.length);
  const queue = new Int32Array(BRUSSELS_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(BRUSSELS_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

function canalSection(lat) {
  const project = projector();
  const { w } = BRUSSELS_GEO.meta.grid;
  const [x0, x1] = [4.32, 4.35].map((lon) => Math.floor(project(lon, lat)[0]));
  const centerY = Math.floor(project(4.335, lat)[1]);
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-2, -1, 0, 1, 2]) {
    let sum = 0;
    let run = 0;
    let maxRun = 0;
    const y = centerY + offset;
    for (let x = x0; x <= x1; x += 1) {
      const code = BRUSSELS_GEO.terrain[y * w + x];
      if (code === CITY_TILE.WATER || code === CITY_TILE.RIVER) {
        sum += 1;
        run += 1;
        maxRun = Math.max(maxRun, run);
      } else run = 0;
    }
    const result = { sumM: sum * 20, runM: maxRun * 20 };
    if (result.sumM > best.sumM || (result.sumM === best.sumM && result.runM > best.runM)) best = result;
  }
  return best;
}

describe('Brussels 상세 geo 계약', () => {
  it('20m bbox·fr canonical·fr/nl 앵커·Midi 입구를 고정한다', () => {
    expect(BRUSSELS_GEO.meta).toMatchObject({
      city: 'brussels', bbox: [4.32, 50.79, 4.42, 50.90], grid: { w: 352, h: 613 },
      metersPerTile: 20, projection: 'webmercator', aspectCorrection: 0.631420467816,
      contentLocale: 'fr', schema: { nameField: 'nameFr', localeSlots: 'central-lookup-expandable' },
      localeAnchors: ['fr', 'nl'],
      buildingTexture: { generatedTileCount: 0, finalLandBuildingRatio: 0.200721 },
      bridgeNormalization: {
        method: 'france-bridge-three-way-v1', sourceBridgeTileCount: 112,
        componentCount: 49, roadComponentCount: 46, absorbedComponentCount: 3,
        roadTileCount: 109, absorbedWaterTileCount: 1, absorbedRiverTileCount: 2,
        finalBridgeTileCount: 0,
      },
    });
    expect(BRUSSELS_GEO.terrain).toHaveLength(215_776);
    expect(BRUSSELS_GEO.entrance).toEqual({ x: 54, y: 357, facing: 'down' });
    expect(BRUSSELS_GEO.exitTiles).toEqual([[54, 347], [54, 348]]);
  });

  it('POI 12·역 4의 좌표와 fr/nl 이중 이름을 전건 보존한다', () => {
    expect(BRUSSELS_GEO.pois.map(({ id }) => id)).toEqual(POI_IDS);
    expect(BRUSSELS_GEO.stations.map(({ id }) => id)).toEqual(STATION_IDS);
    const project = projector();
    const markers = [...BRUSSELS_GEO.pois, ...BRUSSELS_GEO.stations];
    for (const entry of markers) {
      const [expectedX, expectedY] = project(entry.lon, entry.lat);
      expect(Math.hypot(expectedX - entry.tile[0], expectedY - entry.tile[1]), entry.id)
        .toBeLessThanOrEqual(2.5);
      expect(entry.contentLocale, entry.id).toBe('fr');
      expect(entry.nameFr, entry.id).toBeTruthy();
      expect(entry.nameNl, entry.id).toBeTruthy();
      expect(entry.tile[0], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[1], entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.tile[0], entry.id).toBeLessThan(BRUSSELS_GEO.meta.grid.w);
      expect(entry.tile[1], entry.id).toBeLessThan(BRUSSELS_GEO.meta.grid.h);
    }
    expect(new Set(markers.map(({ tile }) => tile.join(','))).size).toBe(markers.length);
    expect(byId(BRUSSELS_GEO.pois, 'atomium')).toMatchObject({
      nameFr: 'Atomium', nameNl: 'Atomium', kind: 'landmark', renderPolicy: 'marker-only',
    });
    expect(byId(BRUSSELS_GEO.pois, 'atomium')).not.toHaveProperty('facade');
  });

  it('남북 관통선은 Midi→Central→Nord 순서이고 Schuman을 임의 편입하지 않는다', () => {
    const [midi, central, north] = BRUSSELS_GEO.stations.slice(0, 3);
    expect([midi.id, central.id, north.id]).toEqual([
      'bruxelles-midi', 'bruxelles-central', 'bruxelles-nord',
    ]);
    expect(midi.tile[1]).toBeGreaterThan(central.tile[1]);
    expect(central.tile[1]).toBeGreaterThan(north.tile[1]);
    for (const station of [midi, central, north]) {
      expect(station.routeIds).toEqual(['brussels-north-south-axis']);
    }
    expect(byId(BRUSSELS_GEO.stations, 'schuman')).not.toHaveProperty('routeId');
  });

  it('최종 terrain 질량·운하 단면·BRIDGE=0을 고정한다', () => {
    const counts = {};
    for (const code of BRUSSELS_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 73_995, [CITY_TILE.SIDEWALK]: 72_941,
      [CITY_TILE.CROSSWALK]: 10_354, [CITY_TILE.PLAZA]: 9,
      [CITY_TILE.PARK]: 12_106, [CITY_TILE.WATER]: 2_150,
      [CITY_TILE.BUILDING]: 42_543, [CITY_TILE.RIVER]: 1_678,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(BRUSSELS_GEO.railways.tileCount).toBe(15_495);
    expect(canalSection(50.825)).toEqual({ sumM: 120, runM: 80 });
  });

  it('POI·역과 모든 보행 타일이 Bruxelles-Midi 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(byId(BRUSSELS_GEO.stations, 'bruxelles-midi').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < BRUSSELS_GEO.terrain.length; index += 1) {
      if (isCityBlocked(BRUSSELS_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    for (const entry of [...BRUSSELS_GEO.pois, ...BRUSSELS_GEO.stations]) {
      expect(seen[entry.tile[1] * BRUSSELS_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('재생성은 byte-equivalent terrain·railway와 고정 RLE를 만든다', () => {
    const first = buildFrenchCityGeo('brussels');
    const second = buildFrenchCityGeo('brussels');
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain)).toBe('b91fb05265f94dba339be68c9982d7b99b28f8b9e90791d21e2bc715013f20a6');
    expect(hash(first.railways.mask)).toBe('767f87df4f4e58e049654ae3d30f1e4792e0a331e417c83425fac1ace55e74cd');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(101_371);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(12_323);
    expect(first.pois).toEqual(BRUSSELS_GEO.pois);
    expect(first.stations).toEqual(BRUSSELS_GEO.stations);
  });
});
