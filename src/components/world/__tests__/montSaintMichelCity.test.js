import { describe, expect, it } from 'vitest';
import MONT_SAINT_MICHEL, {
  buildMontSaintMichelGrid,
  CITY_NODES,
} from '../cities/mont-saint-michel.js';
import { CITY_TILE } from '../cities/terrain.js';

describe('Mont-Saint-Michel runtime city wiring', () => {
  it('keeps the 4m mudflat city contract without Claude-owned descriptions', () => {
    expect(MONT_SAINT_MICHEL).toMatchObject({
      id: 'mont-saint-michel',
      metersPerTile: 4,
      tileSkins: { beach: 'mudflat' },
      cols: 442,
      rows: 863,
    });
    expect(CITY_NODES).toHaveLength(4);
    expect(CITY_NODES.every((node) => !Object.hasOwn(node, 'desc'))).toBe(true);
  });

  it('wires only the abbey POI to the four-act scene skeleton', () => {
    const abbey = CITY_NODES.find((node) => node.id === 'abbey');
    expect(abbey?.gate).toEqual({ type: 'story-scene', scene: 'msm-abbey-scene' });
    expect(CITY_NODES.filter((node) => node.gate)).toEqual([abbey]);
  });

  it('preserves the generated terrain and overlays only the city exit tiles', () => {
    const grid = buildMontSaintMichelGrid();
    expect(grid).toBeInstanceOf(Uint8Array);
    expect(grid).toHaveLength(442 * 863);
    expect(Array.from(grid).filter((code) => code === CITY_TILE.EXIT)).toHaveLength(2);
  });
});
