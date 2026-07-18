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

function countWithinRadius(center, radius, predicate) {
  const { w, h } = MONT_SAINT_MICHEL_GEO.meta.grid;
  let count = 0;
  for (let y = Math.max(0, center[1] - radius); y <= Math.min(h - 1, center[1] + radius); y += 1) {
    for (let x = Math.max(0, center[0] - radius); x <= Math.min(w - 1, center[0] + radius); x += 1) {
      if ((x - center[0]) ** 2 + (y - center[1]) ** 2 > radius ** 2) continue;
      if (predicate(MONT_SAINT_MICHEL_GEO.terrain[y * w + x])) count += 1;
    }
  }
  return count;
}

describe('Mont-Saint-Michel precision geo contract', () => {
  it('pins the approved bbox, 4m grid, French schema, and shuttle entrance', () => {
    expect(MONT_SAINT_MICHEL_GEO.meta).toMatchObject({
      city: 'mont-saint-michel', bbox: [-1.527, 48.605, -1.503, 48.642],
      grid: { w: 442, h: 1030 }, metersPerTile: 4, projection: 'webmercator', contentLocale: 'fr',
      schema: { nameField: 'nameFr', localeSlots: 'central-lookup-expandable' },
      buildingTexture: {
        publicDatasetProbe: { provider: 'OpenStreetMap', outcome: 'fixed-offline-snapshot' },
        finalRatioRange: [0.005, 0.012], generatedTileCount: 0, finalLandBuildingRatio: 0.007701,
      },
    });
    expect(MONT_SAINT_MICHEL_GEO.tileSkins).toEqual({ beach: 'mudflat' });
    expect(MONT_SAINT_MICHEL_GEO.terrain).toHaveLength(455_260);
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
      city: 'mont-saint-michel', bbox: [-1.527, 48.605, -1.503, 48.642],
      metersPerTile: 4, grid: { w: 442, h: 1030 },
      source: {
        providers: ['api.openstreetmap.org'], queryCount: 1,
        mergeStrategy: 'official-osm-xml-conversion-v1',
        sourceUrl: 'https://api.openstreetmap.org/api/0.6/map?bbox=-1.527,48.605,-1.503,48.642',
        rawOverpassSha256: 'e5357b422164bf4327f8363e7a7a7b9eefddde207242e9f1c40761af219c5b98',
        sourceArtifactSha256: 'f0ca5b97cdebeb8e7fad99e3826d18776b9a33291c923a1ef47dc69645477c68',
        parkSelection: 'leisure=park|landuse=farmland,grass,meadow,recreation_ground',
        coastlineMainland: {
          method: 'coastline-mainland-side-v1', side: 'south', minYFraction: 0.5,
          recoveredTileCount: 192_556, boundaryMinY: 516, boundaryMaxY: 687,
        },
        buildingWays: 189, roadWays: 827, waterAreas: 4, riverWays: 44,
        parkAreas: 83, coastlineWays: 9, bridgeWays: 10, tidalFlatAreas: 1,
      },
    });
    expect(SNAPSHOT.hashes.tidalFlatRle)
      .toBe('315f91fc951f8be210a951ba8ddbdb97a6d30c346d22165b4706bb130b5913d4');
    expect(SNAPSHOT.hashes.waterRle)
      .toBe('1a093197de4a129046c76a01376dd2c31d0c6ae0c80f9154a19207cdf6794e1c');
    const counts = {};
    for (const code of MONT_SAINT_MICHEL_GEO.terrain) counts[code] = (counts[code] || 0) + 1;
    expect(counts).toEqual({
      [CITY_TILE.ROAD]: 4_840, [CITY_TILE.SIDEWALK]: 47_384, [CITY_TILE.CROSSWALK]: 5,
      [CITY_TILE.PLAZA]: 4, [CITY_TILE.PARK]: 140_878, [CITY_TILE.BRIDGE]: 412,
      [CITY_TILE.WATER]: 140_699, [CITY_TILE.BUILDING]: 2_406,
      [CITY_TILE.RIVER]: 2_114, [CITY_TILE.BEACH]: 116_518,
    });
    expect(MONT_SAINT_MICHEL_GEO.railways.tileCount).toBe(0);
  });

  it('keeps the island isolated while restoring La Caserne and salt-meadow mass', () => {
    const abbey = byId(MONT_SAINT_MICHEL_GEO.pois, 'abbey').tile;
    let ringTiles = 0;
    let waterOrMudflatTiles = 0;
    for (let y = abbey[1] - 55; y <= abbey[1] + 55; y += 1) {
      for (let x = abbey[0] - 55; x <= abbey[0] + 55; x += 1) {
        const distance = Math.hypot(x - abbey[0], y - abbey[1]);
        if (distance < 40 || distance > 55) continue;
        ringTiles += 1;
        const code = MONT_SAINT_MICHEL_GEO.terrain[y * MONT_SAINT_MICHEL_GEO.meta.grid.w + x];
        if ([CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.BEACH].includes(code)) waterOrMudflatTiles += 1;
      }
    }
    const entrance = [MONT_SAINT_MICHEL_GEO.entrance.x, MONT_SAINT_MICHEL_GEO.entrance.y];
    expect(waterOrMudflatTiles / ringTiles).toBeGreaterThanOrEqual(0.9);
    expect(countWithinRadius(entrance, 30, (code) => code === CITY_TILE.BUILDING)).toBeGreaterThanOrEqual(40);
    expect(countWithinRadius(entrance, 75, (code) => code === CITY_TILE.PARK)).toBeGreaterThanOrEqual(1_000);
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
    expect(hash(first.terrain)).toBe('31191d0a7e34e175b1a40ab071d81886137affe2cb5dceeb53393ec5e295a75d');
    expect(hash(first.railways.mask)).toBe('39e13945e587b244868de8b50a3d03f4ca810ffb89d6b88cccb07fa1ebe06b37');
    expect(hash(first.tide.safeCorridorMask)).toBe(hash(second.tide.safeCorridorMask));
    expect(hash(first.tide.safeCorridorMask)).toBe(first.tide.safeCorridorHash);
    expect(hash(first.tide.tidalRank)).toBe(hash(second.tide.tidalRank));
    expect(hash(first.tide.tidalRank)).toBe(first.tide.tidalRankHash);
    expect(encodeTerrainRle(first.terrain)).toHaveLength(14_365);
    expect(encodeTerrainRle(first.railways.mask)).toHaveLength(1);
    expect(first.pois).toEqual(MONT_SAINT_MICHEL_GEO.pois);
  }, 15_000);
});
