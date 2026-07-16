import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MONT_SAINT_MICHEL_GEO } from '../cities/mont-saint-michel.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import { buildKoreanCityGeo, encodeTerrainRle } from '../../../../scripts/build-korean-city-geo.mjs';

const hash = (values) => createHash('sha256').update(values).digest('hex');
const byId = (entries, id) => entries.find((entry) => entry.id === id);
const SNAPSHOT = JSON.parse(fs.readFileSync(
  new URL('../../../../scripts/data/mont-saint-michel-osm-v21.json', import.meta.url),
  'utf8',
));
const FIXED_POIS = Object.freeze({
  abbey: [286, 164],
  'grande-rue': [303, 172],
  ramparts: [317, 161],
  'causeway-shuttle': [380, 840],
});

function reachableFrom(startTile) {
  const { w, h } = MONT_SAINT_MICHEL_GEO.meta.grid;
  const seen = new Uint8Array(MONT_SAINT_MICHEL_GEO.terrain.length);
  const queue = new Int32Array(MONT_SAINT_MICHEL_GEO.terrain.length);
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
      if (seen[next] || isCityBlocked(MONT_SAINT_MICHEL_GEO.terrain[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

describe('Mont-Saint-Michel precision geo contract', () => {
  it('pins the approved bbox, 4m grid, French schema, and shuttle entrance', () => {
    expect(MONT_SAINT_MICHEL_GEO.meta).toMatchObject({
      city: 'mont-saint-michel', bbox: [-1.527, 48.611, -1.503, 48.642],
      grid: { w: 442, h: 863 }, metersPerTile: 4, projection: 'webmercator', contentLocale: 'fr',
      schema: { nameField: 'nameFr', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        publicDatasetProbe: { provider: 'OpenStreetMap', outcome: 'fixed-offline-snapshot' },
        finalRatioRange: [0.005, 0.012], generatedTileCount: 0, finalLandBuildingRatio: 0.007629,
      },
    });
    expect(MONT_SAINT_MICHEL_GEO.tileSkins).toEqual({ beach: 'mudflat' });
    expect(MONT_SAINT_MICHEL_GEO.terrain).toHaveLength(381_446);
    expect(MONT_SAINT_MICHEL_GEO.entrance).toEqual({ x: 380, y: 840, facing: 'down' });
    expect(MONT_SAINT_MICHEL_GEO.exitTiles).toEqual([[380, 830], [380, 831]]);
  });

  it('preserves the four approved POI ids, tiles, French names, and no stations', () => {
    expect(MONT_SAINT_MICHEL_GEO.pois).toHaveLength(4);
    expect(MONT_SAINT_MICHEL_GEO.stations).toEqual([]);
    for (const [id, tile] of Object.entries(FIXED_POIS)) {
      const entry = byId(MONT_SAINT_MICHEL_GEO.pois, id);
      expect(entry?.tile, id).toEqual(tile);
      expect(typeof entry?.nameFr, id).toBe('string');
      expect(entry?.contentLocale, id).toBe('fr');
      expect(entry, id).not.toHaveProperty('desc');
    }
  });

  it('pins the official OSM snapshot, static tidal flat, and terrain mass', () => {
    expect(SNAPSHOT).toMatchObject({
      city: 'mont-saint-michel', bbox: [-1.527, 48.611, -1.503, 48.642],
      metersPerTile: 4, grid: { w: 442, h: 863 },
      source: {
        providers: ['api.openstreetmap.org'], queryCount: 1,
        mergeStrategy: 'official-osm-xml-conversion-v1',
        rawOverpassSha256: '127ab483c9232cfc45db615e050f187c74af409671cec0ed990fff5b7110dbb3',
        sourceArtifactSha256: '3224e38d4993d78bb82f0d77e60a4539c9d5d5f5ac0ff2d639c79c189c8730ce',
        buildingWays: 173, roadWays: 755, waterAreas: 3, riverWays: 44,
        parkAreas: 47, coastlineWays: 9, bridgeWays: 7, tidalFlatAreas: 1,
      },
    });
    expect(SNAPSHOT.hashes.tidalFlatRle)
      .toBe('2b23179ce6aeb67af11abcaab6b409537fc00f8718af72bdcd13afa7eda8b8f6');
    expect(SNAPSHOT.hashes.waterRle)
      .toBe('284082ab157b5872c25710ae3838c6ebb404a6ef1ebb23e6c7b9ab7a0a6f4011');
    const counts = {};
    for (const code of MONT_SAINT_MICHEL_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 339, [CITY_TILE.SIDEWALK]: 1_997, [CITY_TILE.PLAZA]: 5,
      [CITY_TILE.PARK]: 744, [CITY_TILE.BRIDGE]: 730, [CITY_TILE.WATER]: 258_575,
      [CITY_TILE.BUILDING]: 925, [CITY_TILE.RIVER]: 1_620, [CITY_TILE.BEACH]: 116_511,
    });
    expect(MONT_SAINT_MICHEL_GEO.railways.tileCount).toBe(0);
  });

  it('keeps every POI and walkable tile in the entrance 4-way BFS component', () => {
    const seen = reachableFrom(byId(MONT_SAINT_MICHEL_GEO.pois, 'causeway-shuttle').tile);
    let walkable = 0;
    let reached = 0;
    for (let index = 0; index < MONT_SAINT_MICHEL_GEO.terrain.length; index += 1) {
      if (isCityBlocked(MONT_SAINT_MICHEL_GEO.terrain[index])) continue;
      walkable += 1;
      reached += seen[index];
    }
    expect(reached).toBe(walkable);
    for (const entry of MONT_SAINT_MICHEL_GEO.pois) {
      expect(seen[entry.tile[1] * MONT_SAINT_MICHEL_GEO.meta.grid.w + entry.tile[0]], entry.id).toBe(1);
    }
  });

  it('regenerates byte-equivalent terrain, railway, and fixed RLE', () => {
    const first = buildKoreanCityGeo('mont-saint-michel');
    const second = buildKoreanCityGeo('mont-saint-michel');
    expect(hash(first.terrain)).toBe(hash(second.terrain));
    expect(hash(first.terrain)).toBe('4cc184c2a82a6b2f0e3710df0d74a4009eeacca2eb835f1ab7b3145c2fdfce7f');
    expect(hash(first.railways.mask)).toBe('5b45b5b0f704e3c4a529a1fb253547dc87673e7ac95c0024ce619b40a9661b48');
    expect(encodeTerrainRle(first.terrain)).toHaveLength(5_634);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(1);
    expect(first.pois).toEqual(MONT_SAINT_MICHEL_GEO.pois);
  });
});
