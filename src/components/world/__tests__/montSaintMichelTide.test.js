import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';
import { CITY_NODES, buildMontSaintMichelGrid } from '../cities/mont-saint-michel.js';
import { MONT_SAINT_MICHEL_GEO } from '../cities/mont-saint-michel.geo.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';
import {
  MONT_SAINT_MICHEL_TIDE_CONTRACT,
  isMontSaintMichelTidalVisualWater,
  montSaintMichelTideAt,
  tideCopyKeyForNode,
} from '../montSaintMichelTide.js';

vi.mock('../QuestReview', () => ({ GBC: { cream: '#fff' } }));

function reachableFrom(grid, startTile, width, height) {
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  const start = startTile[1] * width + startTile[0];
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (seen[next] || isCityBlocked(grid[next])) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return seen;
}

describe('Mont-Saint-Michel deterministic tide contract', () => {
  it('pins the 745-minute clock, epoch, phases, and eight visual bands', () => {
    expect(MONT_SAINT_MICHEL_TIDE_CONTRACT).toEqual({
      periodGameMinutes: 745,
      epochLowMinute: 420,
      bands: 8,
      phaseOrder: ['low', 'rising', 'high', 'falling'],
      visualOnly: true,
      collisionEnabled: false,
    });
    expect(montSaintMichelTideAt(420)).toMatchObject({ phase: 'low', band: 0, elapsed: 0 });
    expect(montSaintMichelTideAt(420 + 745 / 4)).toMatchObject({ phase: 'rising', band: 4 });
    expect(montSaintMichelTideAt(420 + 745 / 2)).toMatchObject({ phase: 'high', band: 7 });
    expect(montSaintMichelTideAt(420 + (745 * 3) / 4)).toMatchObject({ phase: 'falling', band: 4 });
    expect(montSaintMichelTideAt(420 - 745)).toMatchObject({ phase: 'low', band: 0, elapsed: 0 });
    expect(montSaintMichelTideAt(420 + 745 * 1_000_000)).toMatchObject({ phase: 'low', band: 0 });
    expect(() => montSaintMichelTideAt(Number.NaN)).toThrow('totalGameMinutes must be finite');
  });

  it('pins all source-informed ranks and the 301-tile minimum BEACH spine', () => {
    const tide = MONT_SAINT_MICHEL_GEO.tide;
    expect(tide).toMatchObject({
      method: 'source-informed-minimum-beach-corridor-v1',
      safeAnchorId: 'abbey',
      periodGameMinutes: 745,
      epochLowMinute: 420,
      bands: 8,
      visualOnly: true,
      collisionEnabled: false,
      safeCorridorTileCount: 301,
      safeCorridorBounds: { minX: 286, maxX: 286, minY: 231, maxY: 531 },
      safeCorridorHash: 'e1b6a457b6b8336c698143caa5df49004eee94d815cb5c3b80922f041acc07dc',
      tidalTileCount: 116_518,
      tidalRankMaxDistance: 149,
      tidalRankHash: '60c80e9895d04d5b12276963ac591748abda4ada1b1ddf10db92acfe5f2a80ce',
      staticTerrainHash: '31191d0a7e34e175b1a40ab071d81886137affe2cb5dceeb53393ec5e295a75d',
    });
    expect(tide.safeCorridorMask).toHaveLength(MONT_SAINT_MICHEL_GEO.terrain.length);
    expect(tide.tidalRank).toHaveLength(MONT_SAINT_MICHEL_GEO.terrain.length);
    let invalidSafeTiles = 0;
    let invalidTidalTiles = 0;
    for (let index = 0; index < MONT_SAINT_MICHEL_GEO.terrain.length; index += 1) {
      if (tide.safeCorridorMask[index] && MONT_SAINT_MICHEL_GEO.terrain[index] !== CITY_TILE.BEACH) {
        invalidSafeTiles += 1;
      }
      if (tide.tidalRank[index] !== 255 && (
        MONT_SAINT_MICHEL_GEO.terrain[index] !== CITY_TILE.BEACH || tide.tidalRank[index] >= 8
      )) invalidTidalTiles += 1;
    }
    expect(invalidSafeTiles).toBe(0);
    expect(invalidTidalTiles).toBe(0);
  });

  it('keeps every POI, door, and EXIT reachable behind the high-tide safety spine', () => {
    const { w, h } = MONT_SAINT_MICHEL_GEO.meta.grid;
    const highTideCollisionProbe = buildMontSaintMichelGrid();
    for (let index = 0; index < highTideCollisionProbe.length; index += 1) {
      if (MONT_SAINT_MICHEL_GEO.tide.safeCorridorMask[index]) continue;
      if (MONT_SAINT_MICHEL_GEO.tide.tidalRank[index] !== 255) {
        highTideCollisionProbe[index] = CITY_TILE.WATER;
      }
    }
    const seen = reachableFrom(
      highTideCollisionProbe,
      [MONT_SAINT_MICHEL_GEO.entrance.x, MONT_SAINT_MICHEL_GEO.entrance.y],
      w,
      h,
    );
    for (const node of CITY_NODES) {
      expect(seen[node.tile[1] * w + node.tile[0]], node.id).toBe(1);
    }
    for (const [x, y] of MONT_SAINT_MICHEL_GEO.exitTiles) {
      expect(seen[y * w + x], `EXIT ${x},${y}`).toBe(1);
    }
  });

  it('refreshes copy only for the ramparts POI and msm-04 door on phase changes', () => {
    const hooked = CITY_NODES.filter((node) => node.tideCopyHook);
    expect(hooked.map((node) => node.id)).toEqual(['ramparts', 'msm-04']);
    for (const node of hooked) {
      expect(tideCopyKeyForNode(node, { phase: 'rising' })).toBe('rising');
      expect(tideCopyKeyForNode(node, { phase: 'high' })).toBe('high');
    }
    expect(tideCopyKeyForNode(CITY_NODES.find((node) => node.id === 'abbey'), { phase: 'high' }))
      .toBeNull();
    expect(tideCopyKeyForNode(hooked[0], { phase: 'unknown' })).toBeNull();
  });

  it('renders a viewport-bounded tide overlay while collision stays static', () => {
    const tide = {
      safeCorridorMask: Uint8Array.from([0, 1, 0, 0]),
      tidalRank: Uint8Array.from([0, 0, 255, 255]),
      epochLowMinute: 420,
    };
    class FakeScene {}
    const Scene = buildCityScene(
      { Scene: FakeScene },
      {
        id: 'mont-saint-michel',
        cols: 2,
        rows: 2,
        CITY_TILE,
        tide,
        buildGrid: () => Uint8Array.from([
          CITY_TILE.BEACH, CITY_TILE.BEACH,
          CITY_TILE.WATER, CITY_TILE.SIDEWALK,
        ]),
      },
      { avatarRef: { current: null } },
    );
    const scene = new Scene();
    scene.grid = Uint8Array.from([
      CITY_TILE.BEACH, CITY_TILE.BEACH,
      CITY_TILE.WATER, CITY_TILE.SIDEWALK,
    ]);
    scene.tideState = montSaintMichelTideAt(420 + 745 / 2);
    scene.waterFrame = 1;
    scene.waterPool = [];
    scene.cameras = {
      main: { worldView: { x: 0, y: 0, right: 64, bottom: 64 } },
    };
    scene.add = {
      image: () => ({
        position: null,
        texture: null,
        setOrigin() { return this; },
        setScale() { return this; },
        setDepth() { return this; },
        setVisible() { return this; },
        setPosition(x, y) { this.position = [x, y]; return this; },
        setTexture(texture) { this.texture = texture; return this; },
      }),
    };

    expect(scene.blocked(0, 0)).toBe(false);
    expect(scene.tideVisualWaterAt(0, 0)).toBe(true);
    expect(scene.tideVisualWaterAt(1, 0)).toBe(false);
    scene.refreshWaterOverlay();
    expect(scene.waterPool).toHaveLength(2);
    expect(scene.waterPool.map((image) => image.position)).toEqual([[0, 0], [0, 32]]);
    expect(scene.waterPool.map((image) => image.texture)).toEqual(['ct_water1', 'ct_water1']);
  });

  it('excludes the pinned spine from visual water at every band', () => {
    const tide = MONT_SAINT_MICHEL_GEO.tide;
    const safeIndex = tide.safeCorridorMask.findIndex((value) => value === 1);
    const rankZeroIndex = tide.tidalRank.findIndex(
      (rank, index) => rank === 0 && !tide.safeCorridorMask[index],
    );
    expect(isMontSaintMichelTidalVisualWater(tide, safeIndex, 7)).toBe(false);
    expect(isMontSaintMichelTidalVisualWater(tide, rankZeroIndex, 0)).toBe(true);
    expect(isMontSaintMichelTidalVisualWater(tide, rankZeroIndex, -1)).toBe(false);
  });
});
