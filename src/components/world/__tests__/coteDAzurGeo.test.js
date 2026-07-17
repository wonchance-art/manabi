import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { COTE_DAZUR_GEO } from '../cities/cote-dazur.geo.js';
import { CITY_TILE, fastTravelDestinations, isCityBlocked } from '../cities/terrain.js';
import { encodeTerrainRle } from '../../../../scripts/build-french-city-geo-core.mjs';
import {
  buildFrenchCityGeo,
  normalizeFrenchBridgeTerrain,
} from '../../../../scripts/build-french-city-geo.mjs';

const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const EXPECTED_POI_NAMES = Object.freeze({
  'promenade-des-anglais': 'Promenade des Anglais',
  'place-massena': 'Place Masséna',
  'vieux-nice': 'Vieux Nice',
  'castle-hill': 'Colline du Château',
  'musee-chagall': 'Musée Marc Chagall',
  'musee-matisse': 'Musée Matisse',
  'nice-airport': "Aéroport Nice Côte d'Azur",
  'antibes-picasso': 'Musée Picasso (Château Grimaldi)',
  'fort-carre': 'Fort Carré',
  'saint-paul-de-vence': 'Saint-Paul-de-Vence',
  'fondation-maeght': 'Fondation Maeght',
  'cagnes-renoir': 'Musée Renoir (Les Collettes)',
  'villefranche-sur-mer': 'Villefranche-sur-Mer',
  'eze-village': 'Èze',
  'monaco-palace': 'Palais Princier',
  'oceanographic-museum': 'Musée Océanographique',
  'port-hercule': 'Port Hercule',
  'monte-carlo-casino': 'Casino de Monte-Carlo',
});
const FIXED_COORDS = Object.freeze({
  pois: Object.freeze({
    'promenade-des-anglais': [7.2620, 43.6950], 'place-massena': [7.2700, 43.6975],
    'vieux-nice': [7.2755, 43.6955], 'castle-hill': [7.2800, 43.6945],
    'musee-chagall': [7.2700, 43.7095], 'musee-matisse': [7.2755, 43.7195],
    'nice-airport': [7.2150, 43.6650], 'antibes-picasso': [7.1290, 43.5805],
    'fort-carre': [7.1230, 43.5900], 'saint-paul-de-vence': [7.1225, 43.6970],
    'fondation-maeght': [7.1205, 43.7010], 'cagnes-renoir': [7.1560, 43.6620],
    'villefranche-sur-mer': [7.3070, 43.7040], 'eze-village': [7.3615, 43.7275],
    'monaco-palace': [7.4200, 43.7315], 'oceanographic-museum': [7.4255, 43.7305],
    'port-hercule': [7.4240, 43.7350], 'monte-carlo-casino': [7.4280, 43.7395],
  }),
  stations: Object.freeze({
    antibes: [7.1230, 43.5860], 'cagnes-sur-mer': [7.1490, 43.6585],
    'nice-ville': [7.2620, 43.7045], 'villefranche-sur-mer': [7.3105, 43.7060],
    'eze-sur-mer': [7.3555, 43.7180], 'monaco-monte-carlo': [7.4195, 43.7385],
  }),
});
const FIXED_TILES = Object.freeze({
  pois: Object.freeze({
    'promenade-des-anglais': [813, 306], 'place-massena': [845, 292], 'vieux-nice': [867, 303],
    'castle-hill': [886, 309], 'musee-chagall': [845, 225], 'musee-matisse': [867, 170],
    'nice-airport': [624, 473], 'antibes-picasso': [277, 943], 'fort-carre': [253, 890],
    'saint-paul-de-vence': [251, 295], 'fondation-maeght': [243, 273],
    'cagnes-renoir': [386, 490], 'villefranche-sur-mer': [994, 256], 'eze-village': [1214, 125],
    'monaco-palace': [1449, 103], 'oceanographic-museum': [1472, 108],
    'port-hercule': [1466, 83], 'monte-carlo-casino': [1482, 58],
  }),
  stations: Object.freeze({
    antibes: [253, 913], 'cagnes-sur-mer': [358, 509], 'nice-ville': [813, 253],
    'villefranche-sur-mer': [1008, 245], 'eze-sur-mer': [1190, 178],
    'monaco-monte-carlo': [1447, 64],
  }),
});

function reachableFrom(startTile) {
  const { w, h } = COTE_DAZUR_GEO.meta.grid;
  const seen = new Uint8Array(COTE_DAZUR_GEO.terrain.length);
  const queue = new Int32Array(COTE_DAZUR_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(COTE_DAZUR_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

describe("Côte d'Azur 상세 geo 계약", () => {
  it('20m bbox·프랑스어 스키마·Nice-Ville 입구를 고정한다', () => {
    expect(COTE_DAZUR_GEO.meta).toMatchObject({
      city: 'cote-dazur', bbox: [7.06, 43.54, 7.45, 43.75], grid: { w: 1571, h: 1169 },
      metersPerTile: 20, projection: 'webmercator', aspectCorrection: 0.723630012217,
      contentLocale: 'fr', schema: { nameField: 'nameFr', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        publicDatasetProbe: { provider: 'OpenStreetMap', outcome: 'fixed-offline-snapshot' },
        finalRatioRange: [0.07, 0.08], generatedTileCount: 0, finalLandBuildingRatio: 0.072515,
      },
      bridgeNormalization: {
        method: 'france-bridge-three-way-v1', sourceBridgeTileCount: 800,
        componentCount: 235, roadComponentCount: 219, absorbedComponentCount: 16,
        roadTileCount: 779, absorbedWaterTileCount: 1, absorbedRiverTileCount: 20,
        finalBridgeTileCount: 0,
      },
    });
    expect(COTE_DAZUR_GEO.terrain).toHaveLength(1_836_499);
    expect(COTE_DAZUR_GEO.entrance).toEqual({ x: 813, y: 253, facing: 'down' });
    expect(COTE_DAZUR_GEO.exitTiles).toEqual([[813, 243], [813, 244]]);
  });

  it('확정 POI 18개·역 6개의 ID·좌표·nameFr·locale을 보존한다', () => {
    expect(COTE_DAZUR_GEO.pois).toHaveLength(18);
    expect(COTE_DAZUR_GEO.stations).toHaveLength(6);
    for (const [id, tile] of Object.entries(FIXED_TILES.pois)) {
      const entry = byId(COTE_DAZUR_GEO.pois, id);
      expect(entry?.tile, id).toEqual(tile);
      expect([entry?.lon, entry?.lat], id).toEqual(FIXED_COORDS.pois[id]);
      expect(entry?.nameFr, id).toBe(EXPECTED_POI_NAMES[id]);
      expect(entry?.contentLocale, id).toBe('fr');
      expect(entry, id).not.toHaveProperty('desc');
    }
    for (const [id, tile] of Object.entries(FIXED_TILES.stations)) {
      const entry = byId(COTE_DAZUR_GEO.stations, id);
      expect(entry?.tile, id).toEqual(tile);
      expect([entry?.lon, entry?.lat], id).toEqual(FIXED_COORDS.stations[id]);
      expect(entry?.contentLocale, id).toBe('fr');
    }
    const markerTiles = [...COTE_DAZUR_GEO.pois, ...COTE_DAZUR_GEO.stations]
      .map(({ tile }) => tile.join(','));
    expect(new Set(markerTiles).size).toBe(markerTiles.length);
  });

  it('TER 해안선 순서와 단일 routeId를 고정하고 내륙 마을을 철도에서 제외한다', () => {
    expect(COTE_DAZUR_GEO.stations.map(({ id }) => id)).toEqual([
      'antibes', 'cagnes-sur-mer', 'nice-ville', 'villefranche-sur-mer',
      'eze-sur-mer', 'monaco-monte-carlo',
    ]);
    expect(new Set(COTE_DAZUR_GEO.stations.map(({ routeId }) => routeId)))
      .toEqual(new Set(['ter-cote-dazur']));
    expect(COTE_DAZUR_GEO.stations.map(({ id }) => id)).not.toContain('saint-paul-de-vence');
    expect(COTE_DAZUR_GEO.stations.map(({ id }) => id)).not.toContain('fondation-maeght');
    expect(fastTravelDestinations(COTE_DAZUR_GEO.stations, 'nice-ville')).toHaveLength(5);
  });

  it('카지노는 외관·명칭용 지리 marker만 노출한다', () => {
    expect(byId(COTE_DAZUR_GEO.pois, 'monte-carlo-casino')).toEqual({
      id: 'monte-carlo-casino', nameFr: 'Casino de Monte-Carlo', lat: 43.7395,
      lon: 7.428, kind: 'landmark', contentLocale: 'fr', tile: [1482, 58],
    });
  });

  it('최종 terrain 질량과 프랑스 교량 3분류 결과를 고정한다', () => {
    const counts = {};
    for (const code of COTE_DAZUR_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 194_643, [CITY_TILE.SIDEWALK]: 253_842,
      [CITY_TILE.CROSSWALK]: 7_183, [CITY_TILE.PLAZA]: 9, [CITY_TILE.PARK]: 6_043,
      [CITY_TILE.WATER]: 1_109_976, [CITY_TILE.BUILDING]: 51_604,
      [CITY_TILE.RIVER]: 14_916, [CITY_TILE.MOUNTAIN]: 198_283,
    });
    expect(counts[CITY_TILE.BRIDGE] ?? 0).toBe(0);
    expect(COTE_DAZUR_GEO.meta.source.bridgeWays).toBe(798);
    expect(COTE_DAZUR_GEO.railways.tileCount).toBe(5_353);
  });

  it('양안 접속·도로 접속·수면 고립 교량을 결정적으로 3분류한다', () => {
    const meta = { grid: { w: 5, h: 3 } };
    const crossing = new Uint8Array(15).fill(CITY_TILE.WATER);
    crossing[7] = CITY_TILE.BRIDGE;
    crossing[6] = CITY_TILE.SIDEWALK;
    crossing[8] = CITY_TILE.SIDEWALK;
    expect(normalizeFrenchBridgeTerrain(crossing, meta).terrain[7]).toBe(CITY_TILE.ROAD);

    const roadAttached = new Uint8Array(15).fill(CITY_TILE.WATER);
    roadAttached[7] = CITY_TILE.BRIDGE;
    roadAttached[6] = CITY_TILE.ROAD;
    expect(normalizeFrenchBridgeTerrain(roadAttached, meta).terrain[7]).toBe(CITY_TILE.ROAD);

    const isolated = new Uint8Array(15).fill(CITY_TILE.WATER);
    isolated[7] = CITY_TILE.BRIDGE;
    isolated[6] = CITY_TILE.SIDEWALK;
    isolated[8] = CITY_TILE.RIVER;
    expect(normalizeFrenchBridgeTerrain(isolated, meta).terrain[7]).toBe(CITY_TILE.RIVER);
  });

  it('POI·역과 모든 보행 타일이 Nice-Ville 단일 4방 BFS 성분이다', () => {
    const seen = reachableFrom(byId(COTE_DAZUR_GEO.stations, 'nice-ville').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < COTE_DAZUR_GEO.terrain.length; index += 1) {
      if (isCityBlocked(COTE_DAZUR_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    for (const entry of [...COTE_DAZUR_GEO.pois, ...COTE_DAZUR_GEO.stations]) {
      expect(seen[entry.tile[1] * COTE_DAZUR_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('재생성은 byte-equivalent terrain·railway와 고정 RLE를 만든다', () => {
    const first = buildFrenchCityGeo('cote-dazur');
    const second = buildFrenchCityGeo('cote-dazur');
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain)).toBe('d589acc06c9d3e1681d940e1c84d7c5e445d274f32e2375a450897478d4cdd59');
    expect(hash(first.railways.mask)).toBe('6bb3c0dc169a00c6c5f6f55958c8e67e1d375a908398ea0fa51ebd1cb4e66cd7');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(236_304);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(4_951);
    expect(first.pois).toEqual(COTE_DAZUR_GEO.pois);
    expect(first.stations).toEqual(COTE_DAZUR_GEO.stations);
  }, 120_000);
});
