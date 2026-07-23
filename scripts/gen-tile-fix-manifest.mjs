#!/usr/bin/env node
/**
 * Generate a tile-fix manifest from scan-tile-integrity.mjs r2 JSON.
 *
 * The first supported rule is B′ only:
 *   Replace every tile in a zero-cardinal-road-contact CROSSWALK component with
 *   the most frequent non-CROSSWALK walkable tile code in that tile's Moore/8-neighbor
 *   ring. Resolve every top-frequency tie as SIDEWALK.
 *
 * Usage:
 *   node scripts/scan-tile-integrity.mjs --city lyon --format json \
 *     --output /tmp/lyon-r2.json
 *   node scripts/gen-tile-fix-manifest.mjs \
 *     --input /tmp/lyon-r2.json \
 *     --city lyon \
 *     --type B \
 *     --rule b-prime-majority-noncrosswalk-walkable-v1 \
 *     --output data/fix-manifests/lyon-b1-draft.json
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CITY_MANIFEST } from '../src/components/world/cities/manifest.js';
import {
  CITY_TILE,
  isCityWalkable,
} from '../src/components/world/cities/terrain.js';
import {
  applyTileFixes,
  TILE_FIX_MANIFEST_VERSION,
} from './lib/applyTileFixes.mjs';

export const TILE_INTEGRITY_R2_SCANNER_VERSION = 'tile-integrity-r2';
export const B_PRIME_MAJORITY_RULE_ID = 'b-prime-majority-noncrosswalk-walkable-v1';

const SUPPORTED_SCAN_SCHEMA_VERSION = 2;
const SUPPORTED_FINDING_TYPE = 'B';
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
  if (value === 'B' || value === "B'" || value === 'B′') return SUPPORTED_FINDING_TYPE;
  throw new Error(`Unsupported tile-integrity finding type: ${String(value)}`);
}

function normalizeRuleId(value) {
  if (value === B_PRIME_MAJORITY_RULE_ID) return value;
  throw new Error(`Unsupported tile-fix rule: ${String(value)}`);
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

export function generateTileFixManifest(scanResult, {
  cityId,
  grid,
  findingType = SUPPORTED_FINDING_TYPE,
  ruleId = B_PRIME_MAJORITY_RULE_ID,
} = {}) {
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

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    cityId: null,
    findingType: SUPPORTED_FINDING_TYPE,
    ruleId: B_PRIME_MAJORITY_RULE_ID,
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
      options.findingType = nextValue();
    } else if (argument.startsWith('--type=')) {
      options.findingType = argument.slice('--type='.length);
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
      '  --type B        B′ STRAY_CROSSWALK (the only supported type)',
      `  --rule ${B_PRIME_MAJORITY_RULE_ID}`,
      '                  8-neighbor non-CROSSWALK walkable mode; ties → SIDEWALK',
      '',
    ].join('\n'));
    return;
  }
  const scanResult = JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8'));
  const grid = await loadCityGrid(options.cityId);
  const manifest = generateTileFixManifest(scanResult, {
    cityId: options.cityId,
    grid,
    findingType: options.findingType,
    ruleId: options.ruleId,
  });
  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    outputPath,
    city: manifest.city,
    findingType: normalizeFindingType(options.findingType),
    ruleId: manifest.fixes[0]?.ruleId ?? options.ruleId,
    findings: new Set(manifest.fixes.map(({ findingId }) => findingId)).size,
    fixes: manifest.fixes.length,
  })}\n`);
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main(process.argv.slice(2));
}
