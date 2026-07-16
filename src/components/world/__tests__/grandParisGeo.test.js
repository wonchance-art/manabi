import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GRAND_PARIS_GEO } from '../cities/grand-paris.geo.js';
import { CITY_TILE, fastTravelDestinations, isCityBlocked } from '../cities/terrain.js';
import { buildKoreanCityGeo, encodeTerrainRle } from '../../../../scripts/build-korean-city-geo.mjs';

const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const FIXED_TILES = Object.freeze({
  pois: Object.freeze({
    'eiffel-tower': [712, 454], louvre: [865, 442], 'notre-dame': [915, 484],
    'arc-de-triomphe': [714, 368], 'champs-elysees': [760, 391], 'sacre-coeur': [890, 296],
    'musee-orsay': [829, 445], pompidou: [923, 441], luxembourg: [868, 522], pantheon: [901, 522],
    invalides: [778, 467], concorde: [810, 414], 'opera-garnier': [848, 378], 'pont-neuf': [883, 464],
    marais: [955, 459], 'quartier-latin': [889, 501], 'montparnasse-tower': [812, 544],
    versailles: [74, 752], 'grande-arche': [498, 264], 'saint-denis-basilica': [951, 25],
    'bois-de-boulogne': [560, 434], vincennes: [1229, 545],
  }),
  stations: Object.freeze({
    'gare-du-nord': [934, 329], 'gare-de-lyon': [1001, 533], montparnasse: [812, 554],
    'saint-lazare': [825, 354], 'gare-de-l-est': [948, 352], chatelet: [903, 453],
    'la-defense': [505, 268], 'versailles-rive-gauche': [106, 781],
  }),
});

function reachableFrom(startTile) {
  const { w, h } = GRAND_PARIS_GEO.meta.grid;
  const seen = new Uint8Array(GRAND_PARIS_GEO.terrain.length);
  const queue = new Int32Array(GRAND_PARIS_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(GRAND_PARIS_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

describe('Grand Paris 상세 geo 계약', () => {
  it('20m bbox·프랑스어 스키마·Gare du Nord 입구를 고정한다', () => {
    expect(GRAND_PARIS_GEO.meta).toMatchObject({
      city: 'grand-paris', bbox: [2.10, 48.78, 2.47, 48.94], grid: { w: 1355, h: 891 },
      metersPerTile: 20, projection: 'webmercator', contentLocale: 'fr',
      schema: { nameField: 'nameFr', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        publicDatasetProbe: { provider: 'OpenStreetMap', outcome: 'fixed-offline-snapshot' },
        finalRatioRange: [0.14, 0.17], generatedTileCount: 0, finalLandBuildingRatio: 0.150625,
      },
    });
    expect(GRAND_PARIS_GEO.terrain).toHaveLength(1_207_305);
    expect(GRAND_PARIS_GEO.entrance).toEqual({ x: 934, y: 329, facing: 'down' });
    expect(GRAND_PARIS_GEO.exitTiles).toEqual([[934, 319], [934, 320]]);
  });

  it('확정 POI 22개·역 8개의 ID·좌표·nameFr·locale을 보존한다', () => {
    expect(GRAND_PARIS_GEO.pois).toHaveLength(22);
    expect(GRAND_PARIS_GEO.stations).toHaveLength(8);
    for (const [id, tile] of Object.entries(FIXED_TILES.pois)) {
      const entry = byId(GRAND_PARIS_GEO.pois, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameFr, id).toBe('string');
      expect(entry?.contentLocale, id).toBe('fr');
      expect(entry, id).not.toHaveProperty('desc');
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      const entry = byId(GRAND_PARIS_GEO.stations, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameFr, id).toBe('string');
      expect(entry?.contentLocale, id).toBe('fr');
    }
    const markerTiles = [...GRAND_PARIS_GEO.pois, ...GRAND_PARIS_GEO.stations].map(({ tile }) => tile.join(','));
    expect(new Set(markerTiles).size).toBe(markerTiles.length);
  });

  it('RER A 표기와 8역 fast-travel 목적지를 노출한다', () => {
    expect(GRAND_PARIS_GEO.stations.filter(({ line }) => line.includes('RER A')).map(({ id }) => id))
      .toEqual(['gare-de-lyon', 'chatelet', 'la-defense']);
    const destinations = fastTravelDestinations(GRAND_PARIS_GEO.stations, 'gare-du-nord');
    expect(destinations).toHaveLength(7);
    expect(destinations.map(({ id }) => id)).toContain('versailles-rive-gauche');
  });

  it('최종 terrain 질량과 실제 bridge 태그 결과를 고정한다', () => {
    const counts = {};
    for (const code of GRAND_PARIS_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 431_720, [CITY_TILE.SIDEWALK]: 405_007, [CITY_TILE.CROSSWALK]: 45_560,
      [CITY_TILE.PLAZA]: 13, [CITY_TILE.PARK]: 110_769, [CITY_TILE.BRIDGE]: 1_844,
      [CITY_TILE.WATER]: 18_706, [CITY_TILE.BUILDING]: 176_434, [CITY_TILE.RIVER]: 17_252,
    });
    expect(GRAND_PARIS_GEO.meta.source.bridgeWays).toBe(3_049);
    expect(GRAND_PARIS_GEO.railways.tileCount).toBe(51_813);
  });

  it('POI·역과 모든 보행 타일이 Gare du Nord 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(byId(GRAND_PARIS_GEO.stations, 'gare-du-nord').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < GRAND_PARIS_GEO.terrain.length; index += 1) {
      if (isCityBlocked(GRAND_PARIS_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    for (const entry of [...GRAND_PARIS_GEO.pois, ...GRAND_PARIS_GEO.stations]) {
      expect(seen[entry.tile[1] * GRAND_PARIS_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('재생성은 byte-equivalent terrain·railway와 고정 RLE를 만든다', () => {
    const first = buildKoreanCityGeo('grand-paris');
    const second = buildKoreanCityGeo('grand-paris');
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain)).toBe('a069ff27ec35cbf36f2737ce83edf0017bae4eabfe628cdf1588f0782873ea0a');
    expect(hash(first.railways.mask)).toBe('404de62e1c5b3f5b92e53688c8389c2a3cf37e7e80e974d60bf606b518a21e75');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(540_708);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(34_573);
    expect(first.pois).toEqual(GRAND_PARIS_GEO.pois);
    expect(first.stations).toEqual(GRAND_PARIS_GEO.stations);
  }, 120_000);
});
