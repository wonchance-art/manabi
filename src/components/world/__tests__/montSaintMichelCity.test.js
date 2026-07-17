import { describe, expect, it } from 'vitest';
import MONT_SAINT_MICHEL, {
  buildMontSaintMichelGrid,
  CITY_NODES,
} from '../cities/mont-saint-michel.js';
import { CITY_TILE } from '../cities/terrain.js';

describe('Mont-Saint-Michel runtime city wiring', () => {
  it('keeps the 4m mudflat city contract with Claude descriptions and doors wired', () => {
    expect(MONT_SAINT_MICHEL).toMatchObject({
      id: 'mont-saint-michel',
      metersPerTile: 4,
      tileSkins: { beach: 'mudflat' },
      cols: 442,
      rows: 1030,
    });
    // POI 4 + 프랑스어 도어 6 (Claude desc 배선 완료 — 구 플레이스홀더 계약 대체)
    expect(CITY_NODES).toHaveLength(10);
    const pois = CITY_NODES.filter((node) => !node.id.startsWith('msm-0'));
    expect(pois).toHaveLength(4);
    expect(pois.every((node) => typeof node.desc === 'string' && node.desc.length > 0)).toBe(true);
    const doors = CITY_NODES.filter((node) => node.id.startsWith('msm-0'));
    expect(doors.every((node) => typeof node.chapter === 'string')).toBe(true);
  });

  it('wires only the abbey POI to the four-act scene skeleton', () => {
    const abbey = CITY_NODES.find((node) => node.id === 'abbey');
    expect(abbey?.gate).toEqual({ type: 'story-scene', scene: 'msm-abbey-scene' });
    expect(CITY_NODES.filter((node) => node.gate)).toEqual([abbey]);
  });

  it('preserves the generated terrain and overlays only the city exit tiles', () => {
    const grid = buildMontSaintMichelGrid();
    expect(grid).toBeInstanceOf(Uint8Array);
    expect(grid).toHaveLength(442 * 1030);
    expect(Array.from(grid).filter((code) => code === CITY_TILE.EXIT)).toHaveLength(2);
  });
});
