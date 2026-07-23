import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LYON_GEO } from '../src/components/world/cities/lyon.geo.js';
import { CITY_TILE } from '../src/components/world/cities/terrain.js';
import { scanTileIntegrity } from './scan-tile-integrity.mjs';
import {
  A_PRIME_CARRIAGEWAY_MODE_RULE_ID,
  B_PRIME_MAJORITY_RULE_ID,
  C_PRIME_PERPENDICULAR_RULE_ID,
  collectProtectedTiles,
  D_PRIME_NONROAD_MODE_RULE_ID,
  F_FULL_WIDTH_CROSSWALK_RULE_ID,
  generateAllTileFixManifest,
  generateTileFixManifest,
  H_PRIME_ROAD_ABSORB_RULE_ID,
  scanCrosswalkLengthFindings,
  scanRoadSurroundedPlazaGreenFindings,
  TILE_FIX_ALL_SCANNER_VERSION,
  TILE_INTEGRITY_R2_SCANNER_VERSION,
} from './gen-tile-fix-manifest.mjs';
import { applyTileFixes } from './lib/applyTileFixes.mjs';

const CARDINAL = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function withDataSha256(canonical) {
  return {
    ...canonical,
    dataSha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  };
}

function scanEnvelope(grid, {
  cols = 3,
  rows = 3,
  findings = {},
} = {}) {
  const normalizedFindings = Object.fromEntries(
    ['A', 'B', 'C', 'D'].map((type) => [type, findings[type] ?? []]),
  );
  const city = {
    id: 'fixture',
    cols,
    rows,
    cells: grid.length,
    counts: Object.fromEntries(
      Object.entries(normalizedFindings).map(([type, entries]) => [type, entries.length]),
    ),
    findings: normalizedFindings,
  };
  return withDataSha256({
    schemaVersion: 2,
    source: 'fixture terrain',
    cities: [city],
  });
}

function scanFixture(grid, finding) {
  return scanEnvelope(grid, { findings: { B: [finding] } });
}

function bFinding(x = 1, y = 1) {
  return {
    cityId: 'fixture',
    type: 'B',
    anchor: [x, y],
    tiles: [[x, y]],
    componentSize: 1,
    roadContactCount: 0,
  };
}

function countStrayCrosswalkComponents(grid, cols, rows) {
  const seen = new Uint8Array(grid.length);
  let count = 0;
  for (let start = 0; start < grid.length; start += 1) {
    if (seen[start] || grid[start] !== CITY_TILE.CROSSWALK) continue;
    const queue = [start];
    seen[start] = 1;
    let roadContacts = 0;
    for (let read = 0; read < queue.length; read += 1) {
      const index = queue[read];
      const x = index % cols;
      const y = (index - x) / cols;
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const next = ny * cols + nx;
        if (grid[next] === CITY_TILE.ROAD || grid[next] === CITY_TILE.BRIDGE) {
          roadContacts += 1;
        }
        if (!seen[next] && grid[next] === CITY_TILE.CROSSWALK) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (roadContacts === 0) count += 1;
  }
  return count;
}

describe('generateTileFixManifest', () => {
  it('uses the most frequent non-CROSSWALK walkable 8-neighbor code', () => {
    const grid = new Uint8Array([
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.ROAD,
      CITY_TILE.PARK, CITY_TILE.CROSSWALK, CITY_TILE.PLAZA,
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.ROAD,
    ]);
    const manifest = generateTileFixManifest(scanFixture(grid, bFinding()), {
      cityId: 'fixture',
      grid,
    });

    expect(manifest).toEqual({
      version: 1,
      city: 'fixture',
      grid: { w: 3, h: 3 },
      scannerVersion: TILE_INTEGRITY_R2_SCANNER_VERSION,
      fixes: [{
        findingId: 'tile-integrity-r2:fixture:B:1:1',
        city: 'fixture',
        x: 1,
        y: 1,
        before: CITY_TILE.CROSSWALK,
        after: CITY_TILE.ROAD,
        ruleId: B_PRIME_MAJORITY_RULE_ID,
        scannerVersion: TILE_INTEGRITY_R2_SCANNER_VERSION,
      }],
    });
  });

  it('resolves a top-frequency tie as SIDEWALK', () => {
    const grid = new Uint8Array([
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.ROAD,
      CITY_TILE.SIDEWALK, CITY_TILE.CROSSWALK, CITY_TILE.SIDEWALK,
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.ROAD,
    ]);
    const manifest = generateTileFixManifest(scanFixture(grid, bFinding()), {
      cityId: 'fixture',
      grid,
      findingType: 'B′',
    });

    expect(manifest.fixes[0].after).toBe(CITY_TILE.SIDEWALK);
  });

  it('rejects a stale scan digest before creating fixes', () => {
    const grid = new Uint8Array(9).fill(CITY_TILE.SIDEWALK);
    grid[4] = CITY_TILE.CROSSWALK;
    const scan = scanFixture(grid, bFinding());
    scan.cities[0].counts.B = 2;

    expect(() => generateTileFixManifest(scan, {
      cityId: 'fixture',
      grid,
    })).toThrow(/scan data SHA mismatch/);
  });

  it('applies the common protected-tile guard atomically and records the skip', () => {
    const grid = new Uint8Array(9).fill(CITY_TILE.SIDEWALK);
    grid[4] = CITY_TILE.CROSSWALK;
    const manifest = generateAllTileFixManifest(scanFixture(grid, bFinding()), {
      cityId: 'fixture',
      grid,
      protectedTiles: new Map([[4, new Set(['mainRoute'])]]),
      findingTypes: ['B'],
    });

    expect(manifest.fixes).toEqual([]);
    expect(manifest.skipped).toEqual([{
      findingId: 'tile-integrity-r2:fixture:B:1:1',
      city: 'fixture',
      findingType: 'B',
      ruleId: B_PRIME_MAJORITY_RULE_ID,
      reason: 'protected-tile',
      protected: [{ x: 1, y: 1, kinds: ['mainRoute'] }],
    }]);
    expect(manifest.summary.B).toMatchObject({ baseline: 1, applied: 0, skipped: 1 });
  });

  it('corrects A′, C′, and D′ with deterministic local modes and center preservation', () => {
    const aGrid = new Uint8Array(9).fill(CITY_TILE.ROAD);
    aGrid[4] = CITY_TILE.BUILDING;
    const aManifest = generateAllTileFixManifest(scanEnvelope(aGrid, {
      findings: {
        A: [{
          cityId: 'fixture',
          type: 'A',
          anchor: [1, 1],
          tiles: [[1, 1]],
          componentSize: 1,
          ringSize: 8,
        }],
      },
    }), {
      cityId: 'fixture',
      grid: aGrid,
      findingTypes: ['A'],
    });
    expect(aManifest.fixes).toMatchObject([{
      x: 1,
      y: 1,
      before: CITY_TILE.BUILDING,
      after: CITY_TILE.ROAD,
      ruleId: A_PRIME_CARRIAGEWAY_MODE_RULE_ID,
    }]);

    const cGrid = new Uint8Array(25).fill(CITY_TILE.SIDEWALK);
    for (let y = 0; y < 5; y += 1) cGrid[y * 5 + 2] = CITY_TILE.ROAD;
    for (let y = 1; y <= 3; y += 1) cGrid[y * 5 + 2] = CITY_TILE.CROSSWALK;
    const cFinding = {
      cityId: 'fixture',
      type: 'C',
      anchor: [2, 1],
      tiles: [[2, 1], [2, 2], [2, 3]],
      componentSize: 3,
      crosswalkAxis: 'vertical',
      roadAxis: 'vertical',
      roadContacts: { north: 1, east: 0, south: 1, west: 0 },
      roadContactCount: 2,
    };
    const cManifest = generateAllTileFixManifest(scanEnvelope(cGrid, {
      cols: 5,
      rows: 5,
      findings: { C: [cFinding] },
    }), {
      cityId: 'fixture',
      grid: cGrid,
      findingTypes: ['C'],
    });
    expect(cManifest.fixes.map(({ x, y, after, ruleId }) => [x, y, after, ruleId]))
      .toEqual([
        [2, 1, CITY_TILE.ROAD, C_PRIME_PERPENDICULAR_RULE_ID],
        [2, 3, CITY_TILE.ROAD, C_PRIME_PERPENDICULAR_RULE_ID],
      ]);

    const dGrid = new Uint8Array([
      CITY_TILE.PARK, CITY_TILE.PARK, CITY_TILE.SIDEWALK,
      CITY_TILE.PARK, CITY_TILE.ROAD, CITY_TILE.SIDEWALK,
      CITY_TILE.PARK, CITY_TILE.PARK, CITY_TILE.SIDEWALK,
    ]);
    const dManifest = generateAllTileFixManifest(scanEnvelope(dGrid, {
      findings: {
        D: [{
          cityId: 'fixture',
          type: 'D',
          anchor: [1, 1],
          tiles: [[1, 1]],
          componentSize: 1,
          tileCodes: [CITY_TILE.ROAD],
          sidewalkNeighborCount: 3,
        }],
      },
    }), {
      cityId: 'fixture',
      grid: dGrid,
      findingTypes: ['D'],
    });
    expect(dManifest.fixes).toMatchObject([{
      x: 1,
      y: 1,
      after: CITY_TILE.PARK,
      ruleId: D_PRIME_NONROAD_MODE_RULE_ID,
    }]);
  });

  it('extends F across ROAD only and absorbs H′ into ROAD', () => {
    const fGrid = new Uint8Array(15).fill(CITY_TILE.ROAD);
    fGrid[2 * 3 + 1] = CITY_TILE.CROSSWALK;
    expect(scanCrosswalkLengthFindings(fGrid, 3, 5)).toMatchObject([{
      x: 1,
      y: 2,
      axis: 'H',
      runLength: 1,
      roadWidth: 3,
    }]);
    const fManifest = generateAllTileFixManifest(scanEnvelope(fGrid, {
      cols: 3,
      rows: 5,
    }), {
      cityId: 'fixture',
      grid: fGrid,
      findingTypes: ['F'],
    });
    expect(fManifest.fixes.map(({ x, y, after, ruleId }) => [x, y, after, ruleId]))
      .toEqual([
        [0, 2, CITY_TILE.CROSSWALK, F_FULL_WIDTH_CROSSWALK_RULE_ID],
        [2, 2, CITY_TILE.CROSSWALK, F_FULL_WIDTH_CROSSWALK_RULE_ID],
      ]);

    const hGrid = new Uint8Array(9).fill(CITY_TILE.ROAD);
    hGrid[4] = CITY_TILE.PARK;
    expect(scanRoadSurroundedPlazaGreenFindings(hGrid, 3, 3)).toMatchObject([{
      x: 1,
      y: 1,
      subtype: 'GREEN',
    }]);
    const hManifest = generateAllTileFixManifest(scanEnvelope(hGrid), {
      cityId: 'fixture',
      grid: hGrid,
      findingTypes: ['H'],
    });
    expect(hManifest.fixes).toMatchObject([{
      x: 1,
      y: 1,
      after: CITY_TILE.ROAD,
      ruleId: H_PRIME_ROAD_ABSORB_RULE_ID,
    }]);
  });

  it('turns the committed Lyon B′ 28 components into zero', async () => {
    const scan = await scanTileIntegrity({ onlyCity: 'lyon' });
    // Load the committed manifest to verify it matches expected structure
    const manifestPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../data/fix-manifests/lyon-b1.json',
    );
    const committed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(scan.cities[0].counts.B).toBe(0); // Already fixed in LYON_GEO
    expect(new Set(committed.fixes.map(({ findingId }) => findingId)).size).toBe(28);
    expect(committed.fixes).toHaveLength(30);
    expect(committed.fixes.filter(({ after }) => after === CITY_TILE.ROAD)).toHaveLength(6);
    expect(committed.fixes.filter(({ after }) => after === CITY_TILE.SIDEWALK)).toHaveLength(24);
    // Verify that LYON_GEO is now free of stray crosswalks after fixes
    expect(countStrayCrosswalkComponents(
      LYON_GEO.terrain,
      LYON_GEO.meta.grid.w,
      LYON_GEO.meta.grid.h,
    )).toBe(0);
  });

  it('pins the integrated Lyon draft and keeps every protected tile out of fixes', async () => {
    const manifestPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../data/fix-manifests/lyon-all-draft.json',
    );
    const bytes = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(bytes);
    const protectedTiles = await collectProtectedTiles('lyon', LYON_GEO.terrain);

    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('8f1273da5530c742e40f62b3a62f6201f6707474309cb24c3d4e79cbab699d5d');
    expect(manifest).toMatchObject({
      version: 1,
      city: 'lyon',
      grid: { w: 428, h: 501 },
      scannerVersion: TILE_FIX_ALL_SCANNER_VERSION,
      ruleOrder: ['B', 'H', 'A', 'C', 'F', 'D'],
      summary: {
        A: { baseline: 134, candidates: 135, applied: 135, skipped: 0 },
        B: { baseline: 28, candidates: 28, applied: 28, skipped: 0 },
        C: { baseline: 68, candidates: 68, applied: 67, skipped: 1 },
        D: { baseline: 388, candidates: 388, applied: 354, skipped: 18 },
        F: { baseline: 71, candidates: 72, applied: 69, skipped: 2 },
        H: { baseline: 60, candidates: 60, applied: 60, skipped: 0 },
      },
    });
    expect(manifest.fixes).toHaveLength(1_001);
    expect(manifest.skipped).toHaveLength(21);
    expect(manifest.skipped.reduce((counts, { reason }) => ({
      ...counts,
      [reason]: (counts[reason] ?? 0) + 1,
    }), {})).toEqual({
      'protected-tile': 4,
      'walkability-articulation': 17,
    });
    expect(manifest.skipped
      .filter(({ reason }) => reason === 'protected-tile')
      .map(({ findingType, protected: protectedEntries }) => [
      findingType,
      protectedEntries.map(({ x, y, kinds }) => [x, y, kinds]),
    ])).toEqual([
      ['C', [[158, 180, ['mainRoute']]]],
      ['D', [[177, 145, ['mainRoute']]]],
      ['F', [[125, 204, ['mainRoute']], [126, 204, ['mainRoute']]]],
      ['F', [[249, 217, ['mainRoute']]]],
    ]);
    expect(manifest.fixes.filter(({ x, y }) => protectedTiles.has(y * 428 + x)))
      .toEqual([]);
  });
});
