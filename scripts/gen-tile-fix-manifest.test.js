import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LYON_GEO } from '../src/components/world/cities/lyon.geo.js';
import { CITY_TILE } from '../src/components/world/cities/terrain.js';
import { scanTileIntegrity } from './scan-tile-integrity.mjs';
import {
  B_PRIME_MAJORITY_RULE_ID,
  generateTileFixManifest,
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

function scanFixture(grid, finding) {
  const city = {
    id: 'fixture',
    cols: 3,
    rows: 3,
    cells: grid.length,
    counts: { B: 1 },
    findings: { B: [finding] },
  };
  return withDataSha256({
    schemaVersion: 2,
    source: 'fixture terrain',
    cities: [city],
  });
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
});
