import { describe, expect, it } from 'vitest';
import {
  applyTileFixes,
  TILE_FIX_MANIFEST_VERSION,
} from './applyTileFixes.mjs';

function manifest(fixes = []) {
  return {
    version: TILE_FIX_MANIFEST_VERSION,
    city: 'lyon',
    grid: { w: 3, h: 2 },
    scannerVersion: 'tile-integrity-v1',
    fixes,
  };
}

function fix(overrides = {}) {
  return {
    findingId: 'tile-integrity-v1:lyon:isolated-building:0:0',
    city: 'lyon',
    x: 0,
    y: 0,
    before: 1,
    after: 7,
    ruleId: 'isolated-building',
    scannerVersion: 'tile-integrity-v1',
    ...overrides,
  };
}

describe('applyTileFixes', () => {
  it('returns the exact input grid for an empty manifest', () => {
    const grid = new Uint8Array([1, 2, 3, 4, 5, 6]);
    expect(applyTileFixes(grid, manifest())).toBe(grid);
  });

  it('applies fixes in canonical order without mutating the input', () => {
    const grid = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const result = applyTileFixes(grid, manifest([
      fix({
        findingId: 'tile-integrity-v1:lyon:disconnected-road:2:1',
        x: 2,
        y: 1,
        before: 6,
        after: 9,
        ruleId: 'disconnected-road',
      }),
      fix(),
    ]));

    expect(result).toEqual(new Uint8Array([7, 2, 3, 4, 5, 9]));
    expect(result).not.toBe(grid);
    expect(grid).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('validates every before value before applying any fix', () => {
    const grid = new Uint8Array([1, 2, 3, 4, 5, 6]);
    expect(() => applyTileFixes(grid, manifest([
      fix(),
      fix({
        findingId: 'tile-integrity-v1:lyon:disconnected-road:2:1',
        x: 2,
        y: 1,
        before: 8,
        after: 9,
        ruleId: 'disconnected-road',
      }),
    ]))).toThrow(/expected 8 at 2,1, received 6/);
    expect(grid).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('rejects duplicate coordinates', () => {
    const grid = new Uint8Array([1, 2, 3, 4, 5, 6]);
    expect(() => applyTileFixes(grid, manifest([
      fix(),
      fix({ findingId: 'tile-integrity-v1:lyon:other-rule:0:0', ruleId: 'other-rule' }),
    ]))).toThrow(/Duplicate tile fix coordinate: 0,0/);
  });

  it.each([
    ['city', fix({ city: 'bordeaux' }), /city must match manifest.city/],
    ['scanner version', fix({ scannerVersion: 'tile-integrity-v2' }), /scannerVersion must match/],
    ['coordinate', fix({ x: 3 }), /x must be an integer from 0 to 2/],
    ['no-op rewrite', fix({ after: 1 }), /must change the tile code/],
  ])('rejects an invalid %s contract', (_label, invalidFix, error) => {
    const grid = new Uint8Array([1, 2, 3, 4, 5, 6]);
    expect(() => applyTileFixes(grid, manifest([invalidFix]))).toThrow(error);
  });
});
