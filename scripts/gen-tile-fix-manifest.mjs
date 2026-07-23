#!/usr/bin/env node
/**
 * Generate a tile-fix manifest from scan-tile-integrity.mjs r2 JSON.
 *
 * Supported deterministic corrections:
 *   A′ isolated BUILDING components → surrounding carriageway mode.
 *   B′ zero-road-contact CROSSWALK components → surrounding walkable mode.
 *   C′ parallel CROSSWALK components → perpendicular full-road-width component.
 *   D′ one-tile road-like components → surrounding non-road mode.
 *   F  short CROSSWALK runs → full road width (ROAD tiles only).
 *   H′ one-tile PLAZA/PARK fragments surrounded by carriageway → ROAD.
 *
 * All-rule manifests share one fail-closed safety guard. If any touched coordinate
 * is a spawn, learning door, NPC, station, or mainRoute path tile, the whole finding
 * is left unchanged and recorded in manifest.skipped.
 *
 * Usage:
 *   node scripts/scan-tile-integrity.mjs --city lyon --format json \
 *     --output /tmp/lyon-r2.json
 *   node scripts/gen-tile-fix-manifest.mjs \
 *     --input /tmp/lyon-r2.json \
 *     --city lyon \
 *     --types A,B,C,D,F,H \
 *     --base-manifest data/fix-manifests/lyon-b1.json \
 *     --output data/fix-manifests/lyon-all-draft.json
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CITY_MANIFEST,
  loadCity,
} from '../src/components/world/cities/manifest.js';
import {
  CITY_TILE,
  isCityWalkable,
} from '../src/components/world/cities/terrain.js';
import { resolveCityMainRoute } from '../src/components/world/cityMainRoute.js';
import {
  applyTileFixes,
  TILE_FIX_MANIFEST_VERSION,
} from './lib/applyTileFixes.mjs';

export const TILE_INTEGRITY_R2_SCANNER_VERSION = 'tile-integrity-r2';
export const TILE_INTEGRITY_V2R2_SCANNER_VERSION = 'tile-integrity-v2r2';
export const TILE_FIX_ALL_SCANNER_VERSION = 'tile-integrity-r2+v2r2';
export const A_PRIME_CARRIAGEWAY_MODE_RULE_ID = 'a-prime-majority-carriageway-v1';
export const B_PRIME_MAJORITY_RULE_ID = 'b-prime-majority-noncrosswalk-walkable-v1';
export const C_PRIME_PERPENDICULAR_RULE_ID = 'c-prime-perpendicular-full-road-width-v1';
export const D_PRIME_NONROAD_MODE_RULE_ID = 'd-prime-majority-nonroad-v1';
export const F_FULL_WIDTH_CROSSWALK_RULE_ID = 'f-full-road-width-crosswalk-v1';
export const H_PRIME_ROAD_ABSORB_RULE_ID = 'h-prime-road-absorb-v1';

const SUPPORTED_SCAN_SCHEMA_VERSION = 2;
const SUPPORTED_FINDING_TYPE = 'B';
const ALL_FINDING_TYPES = Object.freeze(['A', 'B', 'C', 'D', 'F', 'H']);
const RULE_IDS = Object.freeze({
  A: A_PRIME_CARRIAGEWAY_MODE_RULE_ID,
  B: B_PRIME_MAJORITY_RULE_ID,
  C: C_PRIME_PERPENDICULAR_RULE_ID,
  D: D_PRIME_NONROAD_MODE_RULE_ID,
  F: F_FULL_WIDTH_CROSSWALK_RULE_ID,
  H: H_PRIME_ROAD_ABSORB_RULE_ID,
});
const RULE_ORDER = Object.freeze(['B', 'H', 'A', 'C', 'F', 'D']);
const PROTECTED_KINDS = Object.freeze(['spawn', 'door', 'npc', 'station', 'mainRoute']);
const CARDINAL = Object.freeze([
  Object.freeze([0, -1]),
  Object.freeze([1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([-1, 0]),
]);
const MOORE_RING = Object.freeze([
  Object.freeze([-1, -1]),
  Object.freeze([0, -1]),
  Object.freeze([1, -1]),
  Object.freeze([-1, 0]),
  Object.freeze([1, 0]),
  Object.freeze([-1, 1]),
  Object.freeze([0, 1]),
  Object.freeze([1, 1]),
]);
const KNOWN_TILE_CODES = new Set(Object.values(CITY_TILE));
const ROAD_CONTEXT = new Set([CITY_TILE.ROAD, CITY_TILE.BRIDGE]);
const ROAD_LIKE = new Set([
  CITY_TILE.ROAD,
  CITY_TILE.CROSSWALK,
  CITY_TILE.BRIDGE,
]);
const EXTRA_ROAD_LIKE = new Set([...ROAD_LIKE, CITY_TILE.EXIT]);
const PLAZA_GREEN = new Set([CITY_TILE.PLAZA, CITY_TILE.PARK]);
const CARRIAGEWAY = new Set([CITY_TILE.ROAD, CITY_TILE.CROSSWALK]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCoordinates(left, right) {
  return left[1] - right[1] || left[0] - right[0];
}

function inBounds(x, y, cols, rows) {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
}

function assertSafeInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new TypeError(`${field} must be an integer from ${min} to ${max}`);
  }
}

function scannerPayloadSha256(scanResult) {
  const { dataSha256: _dataSha256, ...canonical } = scanResult;
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function normalizeFindingType(value) {
  const normalized = String(value).trim().replace(/['′]$/u, '').toUpperCase();
  if (ALL_FINDING_TYPES.includes(normalized)) return normalized;
  throw new Error(`Unsupported tile-integrity finding type: ${String(value)}`);
}

function normalizeRuleId(value) {
  if (value === B_PRIME_MAJORITY_RULE_ID) return value;
  throw new Error(`Unsupported tile-fix rule: ${String(value)}`);
}

function normalizeFindingTypes(values) {
  const normalized = [...new Set(values.map(normalizeFindingType))];
  if (normalized.length === 0) {
    throw new Error('At least one tile-integrity finding type is required');
  }
  return RULE_ORDER.filter((type) => normalized.includes(type));
}

function validateScanEnvelope(scanResult) {
  assertObject(scanResult, 'scan result');
  if (scanResult.schemaVersion !== SUPPORTED_SCAN_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported tile-integrity scan schema: ${String(scanResult.schemaVersion)}`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(scanResult.dataSha256 ?? '')) {
    throw new Error('scan result dataSha256 must be a lowercase SHA-256 hex digest');
  }
  const actualSha256 = scannerPayloadSha256(scanResult);
  if (actualSha256 !== scanResult.dataSha256) {
    throw new Error(
      `tile-integrity scan data SHA mismatch: ${actualSha256} !== ${scanResult.dataSha256}`,
    );
  }
  if (!Array.isArray(scanResult.cities)) {
    throw new TypeError('scan result cities must be an array');
  }
}

function validateCardinalComponent(tiles, tileKeys, field) {
  const seen = new Set();
  const queue = [tiles[0]];
  seen.add(`${tiles[0][0]},${tiles[0][1]}`);
  for (let read = 0; read < queue.length; read += 1) {
    const [x, y] = queue[read];
    for (const [dx, dy] of CARDINAL) {
      const key = `${x + dx},${y + dy}`;
      if (!tileKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push([x + dx, y + dy]);
    }
  }
  if (seen.size !== tiles.length) {
    throw new Error(`${field}.tiles must be one cardinal CROSSWALK component`);
  }
}

function validateFinding(finding, {
  cityId,
  cols,
  rows,
  grid,
  findingIndex,
  occupied,
}) {
  const field = `city.findings.B[${findingIndex}]`;
  assertObject(finding, field);
  if (finding.cityId !== cityId || finding.type !== SUPPORTED_FINDING_TYPE) {
    throw new Error(`${field} must be a B finding for ${cityId}`);
  }
  if (finding.roadContactCount !== 0) {
    throw new Error(`${field}.roadContactCount must be zero`);
  }
  if (!Array.isArray(finding.tiles) || finding.tiles.length === 0) {
    throw new TypeError(`${field}.tiles must be a non-empty array`);
  }
  if (finding.componentSize !== finding.tiles.length) {
    throw new Error(`${field}.componentSize must equal tiles.length`);
  }
  const tiles = finding.tiles.map((coordinate, tileIndex) => {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new TypeError(`${field}.tiles[${tileIndex}] must be [x,y]`);
    }
    const [x, y] = coordinate;
    assertSafeInteger(x, `${field}.tiles[${tileIndex}][0]`, { max: cols - 1 });
    assertSafeInteger(y, `${field}.tiles[${tileIndex}][1]`, { max: rows - 1 });
    return [x, y];
  }).sort(compareCoordinates);
  if (
    !Array.isArray(finding.anchor)
    || finding.anchor.length !== 2
    || finding.anchor[0] !== tiles[0][0]
    || finding.anchor[1] !== tiles[0][1]
  ) {
    throw new Error(`${field}.anchor must be the row-major minimum tile`);
  }

  const tileKeys = new Set();
  for (const [x, y] of tiles) {
    const key = `${x},${y}`;
    if (tileKeys.has(key) || occupied.has(key)) {
      throw new Error(`Duplicate B′ tile coordinate: ${key}`);
    }
    tileKeys.add(key);
    occupied.add(key);
    if (grid[y * cols + x] !== CITY_TILE.CROSSWALK) {
      throw new Error(`${field} expected CROSSWALK at ${x},${y}`);
    }
  }
  validateCardinalComponent(tiles, tileKeys, field);

  for (const [x, y] of tiles) {
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const code = grid[ny * cols + nx];
      if (ROAD_CONTEXT.has(code)) {
        throw new Error(`${field} has stale cardinal road contact at ${nx},${ny}`);
      }
      if (code === CITY_TILE.CROSSWALK && !tileKeys.has(`${nx},${ny}`)) {
        throw new Error(`${field} is not a maximal CROSSWALK component`);
      }
    }
  }
  return tiles;
}

function isReplacementCandidate(code) {
  return KNOWN_TILE_CODES.has(code)
    && code !== CITY_TILE.CROSSWALK
    && code !== CITY_TILE.EXIT
    && isCityWalkable(code);
}

function replacementForTile(grid, cols, rows, x, y) {
  const counts = new Map();
  for (const [dx, dy] of MOORE_RING) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(nx, ny, cols, rows)) continue;
    const code = grid[ny * cols + nx];
    if (!isReplacementCandidate(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) {
    throw new Error(`No non-CROSSWALK walkable neighbor at ${x},${y}`);
  }
  const maxCount = Math.max(...counts.values());
  const modes = [...counts]
    .filter(([, count]) => count === maxCount)
    .map(([code]) => code)
    .sort((left, right) => left - right);
  return modes.length === 1 ? modes[0] : CITY_TILE.SIDEWALK;
}

function validateGrid(grid, cols, rows) {
  if ((!Array.isArray(grid) && !ArrayBuffer.isView(grid))
    || typeof grid.length !== 'number') {
    throw new TypeError('grid must be an array or typed array');
  }
  if (grid.length !== cols * rows) {
    throw new Error(`grid length mismatch: ${grid.length} !== ${cols}x${rows}`);
  }
}

function coordinateKey(x, y) {
  return `${x},${y}`;
}

function tileAt(grid, cols, rows, x, y) {
  return inBounds(x, y, cols, rows) ? grid[y * cols + x] : null;
}

function componentAxis(tiles) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of tiles) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  return {
    axis: width > height ? 'horizontal' : height > width ? 'vertical' : 'unknown',
    bounds: [minX, minY, maxX, maxY],
  };
}

function roadAxisForCrosswalk(grid, cols, rows, tiles) {
  const contacts = { north: 0, east: 0, south: 0, west: 0 };
  for (const [x, y] of tiles) {
    if (ROAD_CONTEXT.has(tileAt(grid, cols, rows, x, y - 1))) contacts.north += 1;
    if (ROAD_CONTEXT.has(tileAt(grid, cols, rows, x + 1, y))) contacts.east += 1;
    if (ROAD_CONTEXT.has(tileAt(grid, cols, rows, x, y + 1))) contacts.south += 1;
    if (ROAD_CONTEXT.has(tileAt(grid, cols, rows, x - 1, y))) contacts.west += 1;
  }
  const vertical = contacts.north + contacts.south;
  const horizontal = contacts.east + contacts.west;
  return {
    axis: vertical > horizontal ? 'vertical' : horizontal > vertical ? 'horizontal' : 'unknown',
    contacts,
    roadContactCount: vertical + horizontal,
  };
}

function validateR2ComponentFinding(finding, {
  type,
  cityId,
  cols,
  rows,
  grid,
  findingIndex,
  expectedCodes,
}) {
  const field = `city.findings.${type}[${findingIndex}]`;
  assertObject(finding, field);
  if (finding.cityId !== cityId || finding.type !== type) {
    throw new Error(`${field} must be an ${type} finding for ${cityId}`);
  }
  if (!Array.isArray(finding.tiles) || finding.tiles.length === 0) {
    throw new TypeError(`${field}.tiles must be a non-empty array`);
  }
  if (finding.componentSize !== finding.tiles.length) {
    throw new Error(`${field}.componentSize must equal tiles.length`);
  }
  const tiles = finding.tiles.map((coordinate, tileIndex) => {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      throw new TypeError(`${field}.tiles[${tileIndex}] must be [x,y]`);
    }
    const [x, y] = coordinate;
    assertSafeInteger(x, `${field}.tiles[${tileIndex}][0]`, { max: cols - 1 });
    assertSafeInteger(y, `${field}.tiles[${tileIndex}][1]`, { max: rows - 1 });
    return [x, y];
  }).sort(compareCoordinates);
  if (
    !Array.isArray(finding.anchor)
    || finding.anchor.length !== 2
    || finding.anchor[0] !== tiles[0][0]
    || finding.anchor[1] !== tiles[0][1]
  ) {
    throw new Error(`${field}.anchor must be the row-major minimum tile`);
  }
  const keys = new Set();
  for (const [x, y] of tiles) {
    const key = coordinateKey(x, y);
    if (keys.has(key)) throw new Error(`${field}.tiles contains duplicate ${key}`);
    keys.add(key);
    if (!expectedCodes.has(grid[y * cols + x])) {
      throw new Error(`${field} has an unexpected tile code at ${key}`);
    }
  }
  validateCardinalComponent(tiles, keys, field);
  return { tiles, keys, field };
}

function validateAFinding(finding, context) {
  const validated = validateR2ComponentFinding(finding, {
    ...context,
    type: 'A',
    expectedCodes: new Set([CITY_TILE.BUILDING]),
  });
  if (validated.tiles.length > 2) {
    throw new Error(`${validated.field} must contain one or two BUILDING tiles`);
  }
  const ring = new Set();
  for (const [x, y] of validated.tiles) {
    if (x === 0 || y === 0 || x === context.cols - 1 || y === context.rows - 1) {
      throw new Error(`${validated.field} must not touch the grid edge`);
    }
    for (const [dx, dy] of MOORE_RING) {
      const nx = x + dx;
      const ny = y + dy;
      const key = coordinateKey(nx, ny);
      if (validated.keys.has(key)) continue;
      ring.add(key);
      if (!ROAD_LIKE.has(context.grid[ny * context.cols + nx])) {
        throw new Error(`${validated.field} has non-carriageway ring tile at ${key}`);
      }
    }
  }
  if (finding.ringSize !== ring.size) {
    throw new Error(`${validated.field}.ringSize drift: ${finding.ringSize} !== ${ring.size}`);
  }
  return { ...validated, ring: [...ring].map((key) => key.split(',').map(Number)) };
}

function validateCFinding(finding, context) {
  const validated = validateR2ComponentFinding(finding, {
    ...context,
    type: 'C',
    expectedCodes: new Set([CITY_TILE.CROSSWALK]),
  });
  const crosswalk = componentAxis(validated.tiles);
  const road = roadAxisForCrosswalk(
    context.grid,
    context.cols,
    context.rows,
    validated.tiles,
  );
  if (
    crosswalk.axis === 'unknown'
    || road.axis === 'unknown'
    || crosswalk.axis !== road.axis
    || finding.crosswalkAxis !== crosswalk.axis
    || finding.roadAxis !== road.axis
    || finding.roadContactCount !== road.roadContactCount
    || JSON.stringify(finding.roadContacts) !== JSON.stringify(road.contacts)
  ) {
    throw new Error(`${validated.field} crosswalk/road axis contract drift`);
  }
  return {
    ...validated,
    crosswalkAxis: crosswalk.axis,
    roadAxis: road.axis,
    bounds: crosswalk.bounds,
  };
}

function validateDFinding(finding, context) {
  const validated = validateR2ComponentFinding(finding, {
    ...context,
    type: 'D',
    expectedCodes: ROAD_LIKE,
  });
  if (validated.tiles.length !== 1) {
    throw new Error(`${validated.field} must be a one-tile road-like component`);
  }
  const [[x, y]] = validated.tiles;
  for (const [dx, dy] of CARDINAL) {
    if (ROAD_LIKE.has(tileAt(context.grid, context.cols, context.rows, x + dx, y + dy))) {
      throw new Error(`${validated.field} is not a maximal one-tile road-like component`);
    }
  }
  const sidewalkNeighborCount = MOORE_RING.reduce((count, [dx, dy]) => (
    count + Number(
      tileAt(context.grid, context.cols, context.rows, x + dx, y + dy)
        === CITY_TILE.SIDEWALK,
    )
  ), 0);
  if (
    sidewalkNeighborCount >= 4
    || finding.sidewalkNeighborCount !== sidewalkNeighborCount
    || !Array.isArray(finding.tileCodes)
    || finding.tileCodes.length !== 1
    || finding.tileCodes[0] !== context.grid[y * context.cols + x]
  ) {
    throw new Error(`${validated.field} singleton road contract drift`);
  }
  return validated;
}

function validateAllR2Findings(city, scanResult, grid) {
  const validators = {
    A: validateAFinding,
    B: (finding, context) => ({
      tiles: validateFinding(finding, {
        ...context,
        occupied: context.occupied,
      }),
    }),
    C: validateCFinding,
    D: validateDFinding,
  };
  const validated = {};
  for (const type of ['A', 'B', 'C', 'D']) {
    if (!Array.isArray(city.findings[type])) {
      throw new TypeError(`city.findings.${type} must be an array`);
    }
    if (city.counts?.[type] !== city.findings[type].length) {
      throw new Error(`city.counts.${type} must equal findings length`);
    }
    const occupied = new Set();
    validated[type] = [...city.findings[type]]
      .sort((left, right) => compareCoordinates(left.anchor, right.anchor))
      .map((finding, findingIndex) => ({
        finding,
        ...validators[type](finding, {
          cityId: city.id,
          cols: city.cols,
          rows: city.rows,
          grid,
          findingIndex,
          occupied,
        }),
      }));
  }
  return validated;
}

function modeAtCoordinates(grid, cols, coordinates, predicate, field) {
  const counts = new Map();
  for (const [x, y] of coordinates) {
    const code = grid[y * cols + x];
    if (!predicate(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size === 0) throw new Error(`${field} has no eligible surrounding tile`);
  const maxCount = Math.max(...counts.values());
  return [...counts]
    .filter(([, count]) => count === maxCount)
    .map(([code]) => code)
    .sort((left, right) => left - right)[0];
}

function buildRoadSpans(grid, cols, rows) {
  const horizontalStart = new Int32Array(grid.length).fill(-1);
  const horizontalEnd = new Int32Array(grid.length).fill(-1);
  const verticalStart = new Int32Array(grid.length).fill(-1);
  const verticalEnd = new Int32Array(grid.length).fill(-1);
  for (let y = 0; y < rows; y += 1) {
    let x = 0;
    while (x < cols) {
      if (!EXTRA_ROAD_LIKE.has(grid[y * cols + x])) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < cols && EXTRA_ROAD_LIKE.has(grid[y * cols + x])) x += 1;
      const end = x - 1;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const index = y * cols + cursor;
        horizontalStart[index] = start;
        horizontalEnd[index] = end;
      }
    }
  }
  for (let x = 0; x < cols; x += 1) {
    let y = 0;
    while (y < rows) {
      if (!EXTRA_ROAD_LIKE.has(grid[y * cols + x])) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < rows && EXTRA_ROAD_LIKE.has(grid[y * cols + x])) y += 1;
      const end = y - 1;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const index = cursor * cols + x;
        verticalStart[index] = start;
        verticalEnd[index] = end;
      }
    }
  }
  return {
    horizontalStart,
    horizontalEnd,
    verticalStart,
    verticalEnd,
  };
}

function sameSpan(starts, ends, first, second) {
  return starts[first] >= 0
    && starts[first] === starts[second]
    && ends[first] === ends[second];
}

function spanWidth(starts, ends, index) {
  return starts[index] < 0 ? 0 : ends[index] - starts[index] + 1;
}

function collectCrosswalkComponents(grid, cols, rows) {
  const seen = new Uint8Array(grid.length);
  const components = [];
  for (let start = 0; start < grid.length; start += 1) {
    if (seen[start] || grid[start] !== CITY_TILE.CROSSWALK) continue;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % cols;
      const y = (index - x) / cols;
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, cols, rows)) continue;
        const next = ny * cols + nx;
        if (seen[next] || grid[next] !== CITY_TILE.CROSSWALK) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    components.push(queue);
  }
  return components;
}

function outsideContinuation(grid, cols, rows, x, y, dx, dy) {
  let count = 0;
  for (
    let cursorX = x + dx, cursorY = y + dy;
    inBounds(cursorX, cursorY, cols, rows);
    cursorX += dx, cursorY += dy
  ) {
    if (!EXTRA_ROAD_LIKE.has(grid[cursorY * cols + cursorX])) break;
    count += 1;
  }
  return count;
}

function componentTravelScores(component, grid, cols, rows) {
  const rowsToXs = new Map();
  const colsToYs = new Map();
  for (const index of component) {
    const x = index % cols;
    const y = (index - x) / cols;
    if (!rowsToXs.has(y)) rowsToXs.set(y, []);
    if (!colsToYs.has(x)) colsToYs.set(x, []);
    rowsToXs.get(y).push(x);
    colsToYs.get(x).push(y);
  }
  let horizontal = 0;
  for (const [y, xs] of rowsToXs) {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    horizontal = Math.max(
      horizontal,
      Math.min(
        outsideContinuation(grid, cols, rows, minX, y, -1, 0),
        outsideContinuation(grid, cols, rows, maxX, y, 1, 0),
      ),
    );
  }
  let vertical = 0;
  for (const [x, ys] of colsToYs) {
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    vertical = Math.max(
      vertical,
      Math.min(
        outsideContinuation(grid, cols, rows, x, minY, 0, -1),
        outsideContinuation(grid, cols, rows, x, maxY, 0, 1),
      ),
    );
  }
  return { horizontal, vertical, rowsToXs, colsToYs };
}

function longestRun(values) {
  const sorted = [...values].sort((left, right) => left - right);
  let best = null;
  for (let start = 0; start < sorted.length;) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    const candidate = {
      start: sorted[start],
      end: sorted[end],
      length: end - start + 1,
      midpoint: sorted[Math.floor((start + end) / 2)],
    };
    if (!best || candidate.length > best.length) best = candidate;
    start = end + 1;
  }
  return best;
}

export function scanCrosswalkLengthFindings(grid, cols, rows) {
  validateGrid(grid, cols, rows);
  const spans = buildRoadSpans(grid, cols, rows);
  const findings = [];
  for (const component of collectCrosswalkComponents(grid, cols, rows)) {
    const scores = componentTravelScores(component, grid, cols, rows);
    const strongest = Math.max(scores.horizontal, scores.vertical);
    if (strongest < 2 || scores.horizontal === scores.vertical) continue;
    const axis = scores.vertical > scores.horizontal ? 'H' : 'V';
    let best = null;
    if (axis === 'H') {
      for (const [y, xs] of [...scores.rowsToXs].sort((left, right) => left[0] - right[0])) {
        const run = longestRun(xs);
        const candidate = { x: run.midpoint, y, ...run };
        if (
          !best
          || candidate.length > best.length
          || (
            candidate.length === best.length
            && (candidate.y < best.y || (candidate.y === best.y && candidate.x < best.x))
          )
        ) best = candidate;
      }
      if (best.y < 1 || best.y + 1 >= rows) continue;
      const center = best.y * cols + best.x;
      if (
        !sameSpan(spans.horizontalStart, spans.horizontalEnd, center, center - cols)
        || !sameSpan(spans.horizontalStart, spans.horizontalEnd, center, center + cols)
      ) continue;
      best.roadStart = spans.horizontalStart[center];
      best.roadEnd = spans.horizontalEnd[center];
      best.roadWidth = spanWidth(spans.horizontalStart, spans.horizontalEnd, center);
    } else {
      for (const [x, ys] of [...scores.colsToYs].sort((left, right) => left[0] - right[0])) {
        const run = longestRun(ys);
        const candidate = { x, y: run.midpoint, ...run };
        if (
          !best
          || candidate.length > best.length
          || (
            candidate.length === best.length
            && (candidate.y < best.y || (candidate.y === best.y && candidate.x < best.x))
          )
        ) best = candidate;
      }
      if (best.x < 1 || best.x + 1 >= cols) continue;
      const center = best.y * cols + best.x;
      if (
        !sameSpan(spans.verticalStart, spans.verticalEnd, center, center - 1)
        || !sameSpan(spans.verticalStart, spans.verticalEnd, center, center + 1)
      ) continue;
      best.roadStart = spans.verticalStart[center];
      best.roadEnd = spans.verticalEnd[center];
      best.roadWidth = spanWidth(spans.verticalStart, spans.verticalEnd, center);
    }
    if (best.length === best.roadWidth) continue;
    findings.push({
      type: 'F',
      x: best.x,
      y: best.y,
      axis,
      runLength: best.length,
      roadWidth: best.roadWidth,
      roadStart: best.roadStart,
      roadEnd: best.roadEnd,
      component: component
        .map((index) => [index % cols, Math.floor(index / cols)])
        .sort(compareCoordinates),
    });
  }
  return findings.sort((left, right) => left.y - right.y || left.x - right.x);
}

export function scanRoadSurroundedPlazaGreenFindings(grid, cols, rows) {
  validateGrid(grid, cols, rows);
  const seen = new Uint8Array(grid.length);
  const findings = [];
  for (let start = 0; start < grid.length; start += 1) {
    if (seen[start] || !PLAZA_GREEN.has(grid[start])) continue;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % cols;
      const y = Math.floor(index / cols);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, cols, rows)) continue;
        const next = ny * cols + nx;
        if (seen[next] || !PLAZA_GREEN.has(grid[next])) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (queue.length !== 1) continue;
    const x = start % cols;
    const y = Math.floor(start / cols);
    if (x === 0 || y === 0 || x + 1 === cols || y + 1 === rows) continue;
    if (![start - cols, start + 1, start + cols, start - 1]
      .every((index) => CARRIAGEWAY.has(grid[index]))) continue;
    findings.push({
      type: 'H',
      x,
      y,
      subtype: grid[start] === CITY_TILE.PLAZA ? 'PLAZA' : 'GREEN',
    });
  }
  return findings.sort((left, right) => left.y - right.y || left.x - right.x);
}

export function scanIsolatedBuildingFindings(grid, cols, rows) {
  validateGrid(grid, cols, rows);
  const seen = new Uint8Array(grid.length);
  const findings = [];
  for (let start = 0; start < grid.length; start += 1) {
    if (seen[start] || grid[start] !== CITY_TILE.BUILDING) continue;
    const queue = [start];
    seen[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % cols;
      const y = Math.floor(index / cols);
      for (const [dx, dy] of CARDINAL) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, cols, rows)) continue;
        const next = ny * cols + nx;
        if (seen[next] || grid[next] !== CITY_TILE.BUILDING) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    if (queue.length < 1 || queue.length > 2) continue;
    const component = new Set(queue);
    const ring = new Set();
    let eligible = true;
    for (const index of queue) {
      const x = index % cols;
      const y = Math.floor(index / cols);
      if (x === 0 || y === 0 || x + 1 === cols || y + 1 === rows) {
        eligible = false;
        break;
      }
      for (const [dx, dy] of MOORE_RING) {
        const neighbor = (y + dy) * cols + x + dx;
        if (component.has(neighbor)) continue;
        ring.add(neighbor);
        if (!ROAD_LIKE.has(grid[neighbor])) eligible = false;
      }
    }
    if (!eligible || ring.size === 0) continue;
    const tiles = queue
      .map((index) => [index % cols, Math.floor(index / cols)])
      .sort(compareCoordinates);
    findings.push({
      finding: {
        cityId: null,
        type: 'A',
        anchor: tiles[0],
        tiles,
        componentSize: tiles.length,
        ringSize: ring.size,
      },
      tiles,
      ring: [...ring]
        .map((index) => [index % cols, Math.floor(index / cols)])
        .sort(compareCoordinates),
      field: `derived A′ ${tiles[0][0]},${tiles[0][1]}`,
    });
  }
  return findings.sort((left, right) => (
    compareCoordinates(left.finding.anchor, right.finding.anchor)
  ));
}

function findingId(cityId, type, x, y) {
  const scannerVersion = type === 'F' || type === 'H'
    ? TILE_INTEGRITY_V2R2_SCANNER_VERSION
    : TILE_INTEGRITY_R2_SCANNER_VERSION;
  return `${scannerVersion}:${cityId}:${type}:${y}:${x}`;
}

function lineCoordinates(axis, fixed, start, end) {
  const coordinates = [];
  for (let cursor = start; cursor <= end; cursor += 1) {
    coordinates.push(axis === 'H' ? [cursor, fixed] : [fixed, cursor]);
  }
  return coordinates;
}

function contiguousRoadLikeSpan(grid, cols, rows, x, y, axis) {
  const [dx, dy] = axis === 'H' ? [1, 0] : [0, 1];
  if (!ROAD_LIKE.has(tileAt(grid, cols, rows, x, y))) {
    throw new Error(`C′ center ${x},${y} is not road-like after restoration`);
  }
  let startX = x;
  let startY = y;
  let endX = x;
  let endY = y;
  while (ROAD_LIKE.has(tileAt(grid, cols, rows, startX - dx, startY - dy))) {
    startX -= dx;
    startY -= dy;
  }
  while (ROAD_LIKE.has(tileAt(grid, cols, rows, endX + dx, endY + dy))) {
    endX += dx;
    endY += dy;
  }
  return axis === 'H'
    ? lineCoordinates('H', y, startX, endX)
    : lineCoordinates('V', x, startY, endY);
}

function dedupeCoordinates(coordinates) {
  const unique = new Map();
  for (const coordinate of coordinates) {
    unique.set(coordinateKey(coordinate[0], coordinate[1]), coordinate);
  }
  return [...unique.values()].sort(compareCoordinates);
}

function protectedMatches(protectedTiles, cols, coordinates) {
  const matches = [];
  for (const [x, y] of dedupeCoordinates(coordinates)) {
    const kinds = protectedTiles.get(y * cols + x);
    if (!kinds) continue;
    matches.push({ x, y, kinds: PROTECTED_KINDS.filter((kind) => kinds.has(kind)) });
  }
  return matches;
}

function applyPlan({
  plan,
  grid,
  cols,
  protectedTiles,
  owners,
  skipped,
  summary,
}) {
  if (plan.skipReason) {
    if (skipped.some((entry) => entry.findingId === plan.findingId)) return false;
    skipped.push({
      findingId: plan.findingId,
      city: plan.city,
      findingType: plan.type,
      ruleId: plan.ruleId,
      reason: plan.skipReason,
      protected: [],
    });
    summary[plan.type].skipped += 1;
    return false;
  }
  const matches = protectedMatches(protectedTiles, cols, plan.touched);
  if (matches.length > 0) {
    if (skipped.some((entry) => entry.findingId === plan.findingId)) return false;
    skipped.push({
      findingId: plan.findingId,
      city: plan.city,
      findingType: plan.type,
      ruleId: plan.ruleId,
      reason: 'protected-tile',
      protected: matches,
    });
    summary[plan.type].skipped += 1;
    return false;
  }
  let changed = false;
  for (const { x, y, after } of plan.changes) {
    const index = y * cols + x;
    if (grid[index] === after) continue;
    grid[index] = after;
    owners.set(index, {
      findingId: plan.findingId,
      ruleId: plan.ruleId,
    });
    changed = true;
  }
  if (changed) summary[plan.type].applied += 1;
  else summary[plan.type].resolvedByEarlierRules += 1;
  return changed;
}

function planB(cityId, grid, cols, rows, validated) {
  const [anchorX, anchorY] = validated.finding.anchor;
  return {
    findingId: findingId(cityId, 'B', anchorX, anchorY),
    city: cityId,
    type: 'B',
    ruleId: RULE_IDS.B,
    touched: validated.tiles,
    changes: validated.tiles.map(([x, y]) => ({
      x,
      y,
      after: replacementForTile(grid, cols, rows, x, y),
    })),
  };
}

function planC(cityId, grid, cols, rows, validated) {
  const restored = grid.slice();
  for (const [x, y] of validated.tiles) restored[y * cols + x] = CITY_TILE.ROAD;
  const [minX, minY, maxX, maxY] = validated.bounds;
  const geometricCenterX = (minX + maxX) / 2;
  const geometricCenterY = (minY + maxY) / 2;
  const [centerX, centerY] = [...validated.tiles].sort((left, right) => {
    const leftDistance = (left[0] - geometricCenterX) ** 2
      + (left[1] - geometricCenterY) ** 2;
    const rightDistance = (right[0] - geometricCenterX) ** 2
      + (right[1] - geometricCenterY) ** 2;
    return leftDistance - rightDistance || compareCoordinates(left, right);
  })[0];
  const crossingAxis = validated.roadAxis === 'vertical' ? 'H' : 'V';
  const target = contiguousRoadLikeSpan(
    restored,
    cols,
    rows,
    centerX,
    centerY,
    crossingAxis,
  );
  const changes = new Map();
  for (const [x, y] of validated.tiles) {
    changes.set(coordinateKey(x, y), { x, y, after: CITY_TILE.ROAD });
  }
  for (const [x, y] of target) {
    const index = y * cols + x;
    if (restored[index] === CITY_TILE.ROAD) {
      changes.set(coordinateKey(x, y), { x, y, after: CITY_TILE.CROSSWALK });
    }
  }
  const [anchorX, anchorY] = validated.finding.anchor;
  return {
    findingId: findingId(cityId, 'C', anchorX, anchorY),
    city: cityId,
    type: 'C',
    ruleId: RULE_IDS.C,
    touched: dedupeCoordinates([...validated.tiles, ...target]),
    changes: [...changes.values()].sort((left, right) => left.y - right.y || left.x - right.x),
  };
}

function planF(cityId, grid, cols, finding) {
  const target = lineCoordinates(
    finding.axis,
    finding.axis === 'H' ? finding.y : finding.x,
    finding.roadStart,
    finding.roadEnd,
  );
  const changes = [];
  for (const [x, y] of target) {
    const code = grid[y * cols + x];
    if (code === CITY_TILE.ROAD) {
      changes.push({ x, y, after: CITY_TILE.CROSSWALK });
    } else if (code !== CITY_TILE.CROSSWALK) {
      throw new Error(`F road span contains non-ROAD/CROSSWALK tile ${code} at ${x},${y}`);
    }
  }
  return {
    findingId: findingId(cityId, 'F', finding.x, finding.y),
    city: cityId,
    type: 'F',
    ruleId: RULE_IDS.F,
    touched: dedupeCoordinates([...finding.component, ...target]),
    changes,
  };
}

function planH(cityId, finding) {
  return {
    findingId: findingId(cityId, 'H', finding.x, finding.y),
    city: cityId,
    type: 'H',
    ruleId: RULE_IDS.H,
    touched: [[finding.x, finding.y]],
    changes: [{ x: finding.x, y: finding.y, after: CITY_TILE.ROAD }],
  };
}

function planA(cityId, grid, cols, validated) {
  const after = modeAtCoordinates(
    grid,
    cols,
    validated.ring,
    (code) => ROAD_LIKE.has(code),
    validated.field,
  );
  const [anchorX, anchorY] = validated.finding.anchor;
  return {
    findingId: findingId(cityId, 'A', anchorX, anchorY),
    city: cityId,
    type: 'A',
    ruleId: RULE_IDS.A,
    touched: validated.tiles,
    changes: validated.tiles.map(([x, y]) => ({ x, y, after })),
  };
}

function wouldDisconnectWalkable(grid, cols, rows, x, y, after) {
  if (isCityWalkable(after) || !isCityWalkable(grid[y * cols + x])) return false;
  const removedIndex = y * cols + x;
  const neighbors = CARDINAL
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([nx, ny]) => (
      inBounds(nx, ny, cols, rows)
      && isCityWalkable(grid[ny * cols + nx])
    ))
    .map(([nx, ny]) => ny * cols + nx);
  if (neighbors.length <= 1) return false;

  const targets = new Set(neighbors.slice(1));
  const seen = new Uint8Array(grid.length);
  const queue = new Int32Array(grid.length);
  let read = 0;
  let write = 0;
  queue[write] = neighbors[0];
  write += 1;
  seen[neighbors[0]] = 1;
  while (read < write && targets.size > 0) {
    const index = queue[read];
    read += 1;
    const currentX = index % cols;
    const currentY = Math.floor(index / cols);
    for (const [dx, dy] of CARDINAL) {
      const nx = currentX + dx;
      const ny = currentY + dy;
      if (!inBounds(nx, ny, cols, rows)) continue;
      const next = ny * cols + nx;
      if (
        next === removedIndex
        || seen[next]
        || !isCityWalkable(grid[next])
      ) continue;
      seen[next] = 1;
      targets.delete(next);
      queue[write] = next;
      write += 1;
    }
  }
  return targets.size > 0;
}

function planD(cityId, grid, cols, rows, validated) {
  const [[x, y]] = validated.tiles;
  if (!ROAD_LIKE.has(grid[y * cols + x])) return null;
  if (CARDINAL.some(([dx, dy]) => (
    ROAD_LIKE.has(tileAt(grid, cols, rows, x + dx, y + dy))
  ))) return null;
  const neighbors = MOORE_RING
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([nx, ny]) => inBounds(nx, ny, cols, rows));
  const after = modeAtCoordinates(
    grid,
    cols,
    neighbors,
    (code) => KNOWN_TILE_CODES.has(code)
      && !ROAD_LIKE.has(code)
      && code !== CITY_TILE.EXIT,
    validated.field,
  );
  const plan = {
    findingId: findingId(cityId, 'D', x, y),
    city: cityId,
    type: 'D',
    ruleId: RULE_IDS.D,
    touched: [[x, y]],
    changes: [{ x, y, after }],
  };
  if (wouldDisconnectWalkable(grid, cols, rows, x, y, after)) {
    plan.skipReason = 'walkability-articulation';
  }
  return plan;
}

function findCityScanRecord(scanResult, cityId, grid) {
  validateScanEnvelope(scanResult);
  if (typeof cityId !== 'string' || cityId.length === 0) {
    throw new TypeError('cityId must be a non-empty string');
  }
  const matchingCities = scanResult.cities.filter((city) => city?.id === cityId);
  if (matchingCities.length !== 1) {
    throw new Error(`scan result must contain exactly one ${cityId} city record`);
  }
  const city = matchingCities[0];
  assertSafeInteger(city.cols, 'city.cols', { min: 1 });
  assertSafeInteger(city.rows, 'city.rows', { min: 1 });
  validateGrid(grid, city.cols, city.rows);
  if (city.cells !== grid.length) {
    throw new Error(`city.cells mismatch: ${String(city.cells)} !== ${grid.length}`);
  }
  assertObject(city.findings, 'city.findings');
  return city;
}

export function generateAllTileFixManifest(scanResult, {
  cityId,
  grid,
  protectedTiles = new Map(),
  findingTypes = ALL_FINDING_TYPES,
} = {}) {
  const city = findCityScanRecord(scanResult, cityId, grid);
  if (!(protectedTiles instanceof Map)) {
    throw new TypeError('protectedTiles must be a Map keyed by row-major tile index');
  }
  const selectedTypes = normalizeFindingTypes(findingTypes);
  const validated = validateAllR2Findings(city, scanResult, grid);
  const sourceGrid = grid.slice();
  const working = grid.slice();
  const owners = new Map();
  const skipped = [];
  const baselineF = scanCrosswalkLengthFindings(sourceGrid, city.cols, city.rows);
  const baselineH = scanRoadSurroundedPlazaGreenFindings(sourceGrid, city.cols, city.rows);
  const summary = Object.fromEntries(ALL_FINDING_TYPES.map((type) => [
    type,
    {
      baseline: type === 'F'
        ? baselineF.length
        : type === 'H' ? baselineH.length : city.counts[type],
      candidates: 0,
      applied: 0,
      resolvedByEarlierRules: 0,
      skipped: 0,
    },
  ]));

  const runPlans = (type, plans) => {
    if (!selectedTypes.includes(type)) return 0;
    if (summary[type].candidates === 0) summary[type].candidates = plans.length;
    let changed = 0;
    for (const plan of plans) {
      if (plan === null) {
        summary[type].resolvedByEarlierRules += 1;
        continue;
      }
      changed += Number(applyPlan({
        plan,
        grid: working,
        cols: city.cols,
        protectedTiles,
        owners,
        skipped,
        summary,
      }));
    }
    return changed;
  };

  runPlans('B', validated.B.map((entry) => planB(
    cityId,
    working,
    city.cols,
    city.rows,
    entry,
  )));
  runPlans('H', scanRoadSurroundedPlazaGreenFindings(working, city.cols, city.rows).map((finding) => (
    planH(cityId, finding)
  )));
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const changed = runPlans(
      'A',
      scanIsolatedBuildingFindings(working, city.cols, city.rows).map((entry) => (
        planA(cityId, working, city.cols, entry)
      )),
    );
    if (changed === 0) break;
    if (iteration === 7) throw new Error('A′ correction did not converge within 8 iterations');
  }
  runPlans('C', validated.C.map((entry) => planC(
    cityId,
    working,
    city.cols,
    city.rows,
    entry,
  )));
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const changed = runPlans(
      'F',
      scanCrosswalkLengthFindings(working, city.cols, city.rows).map((finding) => (
        planF(cityId, working, city.cols, finding)
      )),
    );
    if (changed === 0) break;
    if (iteration === 7) throw new Error('F correction did not converge within 8 iterations');
  }
  if (selectedTypes.includes('D')) summary.D.candidates = validated.D.length;
  for (const entry of validated.D) {
    runPlans('D', [planD(
      cityId,
      working,
      city.cols,
      city.rows,
      entry,
    )]);
  }

  const fixes = [];
  for (let index = 0; index < sourceGrid.length; index += 1) {
    if (sourceGrid[index] === working[index]) continue;
    const owner = owners.get(index);
    if (!owner) throw new Error(`Missing rule owner for changed tile index ${index}`);
    fixes.push({
      findingId: owner.findingId,
      city: cityId,
      x: index % city.cols,
      y: Math.floor(index / city.cols),
      before: sourceGrid[index],
      after: working[index],
      ruleId: owner.ruleId,
      scannerVersion: TILE_FIX_ALL_SCANNER_VERSION,
    });
  }
  fixes.sort((left, right) => (
    left.y - right.y
    || left.x - right.x
    || compareStrings(left.findingId, right.findingId)
  ));
  skipped.sort((left, right) => (
    compareStrings(left.findingId, right.findingId)
  ));
  const manifest = {
    version: TILE_FIX_MANIFEST_VERSION,
    city: cityId,
    grid: { w: city.cols, h: city.rows },
    scannerVersion: TILE_FIX_ALL_SCANNER_VERSION,
    sourceScans: {
      r2DataSha256: scanResult.dataSha256,
      v2r2Contract: TILE_INTEGRITY_V2R2_SCANNER_VERSION,
    },
    ruleOrder: RULE_ORDER.filter((type) => selectedTypes.includes(type)),
    safetyGuard: {
      policy: 'skip-whole-finding-if-any-touched-tile-is-protected',
      protectedKinds: [...PROTECTED_KINDS],
      invariantGuards: ['preserve-single-cardinal-walkable-component'],
    },
    summary: Object.fromEntries(
      ALL_FINDING_TYPES
        .filter((type) => selectedTypes.includes(type))
        .map((type) => [type, summary[type]]),
    ),
    skipped,
    fixes,
  };
  applyTileFixes(sourceGrid, manifest);
  return manifest;
}

export function generateTileFixManifest(scanResult, {
  cityId,
  grid,
  findingType = SUPPORTED_FINDING_TYPE,
  ruleId = B_PRIME_MAJORITY_RULE_ID,
} = {}) {
  if (normalizeFindingType(findingType) !== SUPPORTED_FINDING_TYPE) {
    throw new Error('generateTileFixManifest supports B′ only; use generateAllTileFixManifest');
  }
  validateScanEnvelope(scanResult);
  const normalizedType = normalizeFindingType(findingType);
  const normalizedRuleId = normalizeRuleId(ruleId);
  if (typeof cityId !== 'string' || cityId.length === 0) {
    throw new TypeError('cityId must be a non-empty string');
  }
  const matchingCities = scanResult.cities.filter((city) => city?.id === cityId);
  if (matchingCities.length !== 1) {
    throw new Error(`scan result must contain exactly one ${cityId} city record`);
  }
  const city = matchingCities[0];
  assertSafeInteger(city.cols, 'city.cols', { min: 1 });
  assertSafeInteger(city.rows, 'city.rows', { min: 1 });
  validateGrid(grid, city.cols, city.rows);
  if (city.cells !== grid.length) {
    throw new Error(`city.cells mismatch: ${String(city.cells)} !== ${grid.length}`);
  }
  assertObject(city.findings, 'city.findings');
  if (!Array.isArray(city.findings[normalizedType])) {
    throw new TypeError(`city.findings.${normalizedType} must be an array`);
  }
  if (city.counts?.[normalizedType] !== city.findings[normalizedType].length) {
    throw new Error(`city.counts.${normalizedType} must equal findings length`);
  }

  const occupied = new Set();
  const fixes = [];
  const findings = [...city.findings[normalizedType]].sort((left, right) => (
    compareCoordinates(left.anchor, right.anchor)
  ));
  for (let findingIndex = 0; findingIndex < findings.length; findingIndex += 1) {
    const finding = findings[findingIndex];
    const tiles = validateFinding(finding, {
      cityId,
      cols: city.cols,
      rows: city.rows,
      grid,
      findingIndex,
      occupied,
    });
    const findingId = [
      TILE_INTEGRITY_R2_SCANNER_VERSION,
      cityId,
      normalizedType,
      finding.anchor[1],
      finding.anchor[0],
    ].join(':');
    for (const [x, y] of tiles) {
      fixes.push({
        findingId,
        city: cityId,
        x,
        y,
        before: CITY_TILE.CROSSWALK,
        after: replacementForTile(grid, city.cols, city.rows, x, y),
        ruleId: normalizedRuleId,
        scannerVersion: TILE_INTEGRITY_R2_SCANNER_VERSION,
      });
    }
  }
  fixes.sort((left, right) => (
    left.y - right.y
    || left.x - right.x
    || compareStrings(left.findingId, right.findingId)
  ));

  const manifest = {
    version: TILE_FIX_MANIFEST_VERSION,
    city: cityId,
    grid: { w: city.cols, h: city.rows },
    scannerVersion: TILE_INTEGRITY_R2_SCANNER_VERSION,
    fixes,
  };
  applyTileFixes(grid, manifest);
  return manifest;
}

async function loadCityGrid(cityId) {
  const city = CITY_MANIFEST.find((entry) => entry.id === cityId);
  if (!city) throw new Error(`Unknown city id: ${cityId}`);
  const moduleUrl = new URL(
    `../src/components/world/cities/${cityId}.geo.js`,
    import.meta.url,
  );
  const geoModule = await import(moduleUrl.href);
  const geo = Object.values(geoModule).find((value) => (
    value
    && typeof value === 'object'
    && value.meta?.grid?.w === city.cols
    && value.meta?.grid?.h === city.rows
    && value.terrain instanceof Uint8Array
  ));
  if (!geo) throw new Error(`Unable to resolve geo export for city: ${cityId}`);
  return geo.terrain;
}

function reverseAppliedManifest(grid, manifest) {
  assertObject(manifest, 'base manifest');
  if (!Array.isArray(manifest.fixes)) {
    throw new TypeError('base manifest.fixes must be an array');
  }
  return applyTileFixes(grid, {
    ...manifest,
    fixes: manifest.fixes.map((fix) => ({
      ...fix,
      before: fix.after,
      after: fix.before,
    })),
  });
}

function addProtectedTile(protectedTiles, city, tile, kind, id) {
  if (
    !Array.isArray(tile)
    || tile.length !== 2
    || !tile.every(Number.isSafeInteger)
  ) {
    throw new TypeError(`${city.id}:${id} protected tile must be [x,y]`);
  }
  const [x, y] = tile;
  if (!inBounds(x, y, city.cols, city.rows)) {
    throw new Error(`${city.id}:${id} protected tile is out of bounds: ${x},${y}`);
  }
  const index = y * city.cols + x;
  if (!protectedTiles.has(index)) protectedTiles.set(index, new Set());
  protectedTiles.get(index).add(kind);
}

export async function collectProtectedTiles(cityId, grid) {
  const city = await loadCity(cityId);
  validateGrid(grid, city.cols, city.rows);
  const protectedTiles = new Map();
  addProtectedTile(
    protectedTiles,
    city,
    [city.entrance.x, city.entrance.y],
    'spawn',
    'entrance',
  );
  for (const node of city.nodes) {
    if (
      node?.kind === 'spot'
      && typeof node.track === 'string'
      && node.track.length > 0
      && typeof node.chapter === 'string'
      && node.chapter.length > 0
    ) {
      addProtectedTile(protectedTiles, city, node.tile, 'door', node.id);
    }
    if (node?.kind === 'npc') {
      addProtectedTile(protectedTiles, city, node.tile, 'npc', node.id);
    }
  }
  for (const station of city.stations) {
    addProtectedTile(protectedTiles, city, station.tile, 'station', station.id);
  }
  const mainRoute = resolveCityMainRoute(city, grid);
  for (let index = 0; index < (mainRoute?.path.length ?? 0); index += 1) {
    addProtectedTile(protectedTiles, city, mainRoute.path[index], 'mainRoute', `path-${index}`);
  }
  return protectedTiles;
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    cityId: null,
    findingTypes: [SUPPORTED_FINDING_TYPE],
    ruleId: B_PRIME_MAJORITY_RULE_ID,
    baseManifest: null,
    allRules: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = () => {
      index += 1;
      if (index >= argv.length || argv[index].startsWith('-')) {
        throw new Error(`Missing value for ${argument}`);
      }
      return argv[index];
    };
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--input') {
      options.input = nextValue();
    } else if (argument.startsWith('--input=')) {
      options.input = argument.slice('--input='.length);
    } else if (argument === '--output') {
      options.output = nextValue();
    } else if (argument.startsWith('--output=')) {
      options.output = argument.slice('--output='.length);
    } else if (argument === '--city') {
      options.cityId = nextValue();
    } else if (argument.startsWith('--city=')) {
      options.cityId = argument.slice('--city='.length);
    } else if (argument === '--type') {
      options.findingTypes = [nextValue()];
    } else if (argument.startsWith('--type=')) {
      options.findingTypes = [argument.slice('--type='.length)];
    } else if (argument === '--types') {
      options.findingTypes = nextValue().split(',');
    } else if (argument.startsWith('--types=')) {
      options.findingTypes = argument.slice('--types='.length).split(',');
    } else if (argument === '--all') {
      options.findingTypes = [...ALL_FINDING_TYPES];
      options.allRules = true;
    } else if (argument === '--base-manifest') {
      options.baseManifest = nextValue();
    } else if (argument.startsWith('--base-manifest=')) {
      options.baseManifest = argument.slice('--base-manifest='.length);
    } else if (argument === '--rule') {
      options.ruleId = nextValue();
    } else if (argument.startsWith('--rule=')) {
      options.ruleId = argument.slice('--rule='.length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.help) {
    for (const field of ['input', 'output', 'cityId']) {
      if (!options[field]) throw new Error(`Missing required --${field === 'cityId' ? 'city' : field}`);
    }
  }
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write([
      'Usage: node scripts/gen-tile-fix-manifest.mjs [options]',
      '',
      'Required:',
      '  --input PATH    scan-tile-integrity.mjs r2 JSON',
      '  --city ID       canonical city id present in the scan',
      '  --output PATH   manifest v1 JSON output',
      '',
      'Rule selection:',
      '  --type B        one finding type (legacy B′ output remains supported)',
      '  --types LIST    comma-separated A,B,C,D,F,H selection',
      '  --all           shorthand for --types A,B,C,D,F,H',
      '  --base-manifest PATH',
      '                  reverse an already-applied manifest before generation',
      `  --rule ${B_PRIME_MAJORITY_RULE_ID}`,
      '                  legacy B′ rule override (single --type B only)',
      '',
      'All-rule safety guard:',
      '  skip an entire finding if any touched tile is spawn/door/NPC/station/mainRoute;',
      '  record the protected coordinates and kinds in manifest.skipped.',
      '',
    ].join('\n'));
    return;
  }
  const scanResult = JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8'));
  const committedGrid = await loadCityGrid(options.cityId);
  const grid = options.baseManifest
    ? reverseAppliedManifest(
      committedGrid,
      JSON.parse(fs.readFileSync(path.resolve(options.baseManifest), 'utf8')),
    )
    : committedGrid;
  const normalizedTypes = normalizeFindingTypes(options.findingTypes);
  const legacyBOnly = normalizedTypes.length === 1
    && normalizedTypes[0] === 'B'
    && options.baseManifest === null
    && !options.allRules;
  const manifest = legacyBOnly
    ? generateTileFixManifest(scanResult, {
      cityId: options.cityId,
      grid,
      findingType: normalizedTypes[0],
      ruleId: options.ruleId,
    })
    : generateAllTileFixManifest(scanResult, {
      cityId: options.cityId,
      grid,
      protectedTiles: await collectProtectedTiles(options.cityId, grid),
      findingTypes: normalizedTypes,
    });
  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    outputPath,
    city: manifest.city,
    findingTypes: normalizedTypes,
    findings: new Set(manifest.fixes.map(({ findingId }) => findingId)).size,
    fixes: manifest.fixes.length,
    skipped: manifest.skipped?.length ?? 0,
  })}\n`);
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main(process.argv.slice(2));
}
