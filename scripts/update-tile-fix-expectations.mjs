#!/usr/bin/env node
/**
 * Re-measure and update deterministic expectations affected by city tile fixes.
 *
 * This script intentionally owns only measured literals/snapshots:
 * - Lyon terrain counts/hash/RLE length/PNG hash;
 * - district boundary-sign counts and manifest hash;
 * - S18 district-sign audit counts and audit hash;
 * - the city road-autotile snapshot (via targeted Vitest --update).
 *
 * Usage:
 *   node scripts/update-tile-fix-expectations.mjs
 *   node scripts/update-tile-fix-expectations.mjs --check
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { buildLyonCityGeo } from './build-lyon-city-geo.mjs';
import { encodeTerrainRle } from './build-french-city-geo-core.mjs';
import { renderCityPng } from './world/render-city-map.mjs';
import { STAMP_ALBUM_NODES } from '../src/lib/world/stampUniverse.js';
import {
  CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING,
  planCityDistrictBoundarySigns,
} from '../src/components/world/cityDistrictBoundarySigns.js';
import {
  cityDistrictOpenAt,
  resolveCityDistricts,
} from '../src/components/world/cityDistricts.js';
import { resolveCityMainRoute } from '../src/components/world/cityMainRoute.js';
import {
  CITY_MINI_SCALE,
  cityMinimapLayout,
} from '../src/components/world/cityMinimap.js';
import {
  loadAllCities,
} from '../src/components/world/cities/index.js';
import {
  CITY_TILE,
  isCityWalkable,
} from '../src/components/world/cities/terrain.js';
import {
  stampAlbumDistrictPresentation,
} from '../src/components/world/stampAlbumDistrictPresentation.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const TARGETS = Object.freeze({
  lyonGeo: path.join(REPO_ROOT, 'src/components/world/__tests__/lyonGeo.test.js'),
  boundary: path.join(
    REPO_ROOT,
    'src/components/world/__tests__/cityDistrictBoundarySigns.test.js',
  ),
  audit: path.join(
    REPO_ROOT,
    'src/components/world/__tests__/districtSignsAudit24.test.js',
  ),
  autotileSnapshot: path.join(
    REPO_ROOT,
    'src/components/world/__tests__/__snapshots__/cityRoadAutotile.test.js.snap',
  ),
});
const LOCK_LINE = '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.';
const T19_CITY_IDS = new Set([
  'grand-paris', 'brussels', 'london', 'mont-saint-michel', 'geneva',
  'taipei', 'hong-kong', 'shanghai', 'beijing',
  'brisbane', 'sydney', 'canberra', 'melbourne',
]);
const HASH = (value) => createHash('sha256').update(value).digest('hex');

function parseArgs(argv) {
  let check = false;
  for (const argument of argv) {
    if (argument === '--check') check = true;
    else if (argument === '--help' || argument === '-h') {
      process.stdout.write([
        'Usage: node scripts/update-tile-fix-expectations.mjs [--check]',
        '',
        '  default   rewrite measured literals and targeted Vitest snapshots',
        '  --check   fail if any measured literal or snapshot is stale',
        '',
      ].join('\n'));
      return { help: true, check };
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { help: false, check };
}

function replaceOne(source, pattern, replacement, label) {
  let matches = 0;
  const output = source.replace(pattern, (...args) => {
    matches += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (matches !== 1) throw new Error(`${label} expected exactly one source match; received ${matches}`);
  return output;
}

function formatIntegerLiteral(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

function renderLyonPng(geo) {
  return renderCityPng({
    cols: geo.meta.grid.w,
    rows: geo.meta.grid.h,
    buildGrid: () => geo.terrain,
    railways: geo.railways,
    stations: geo.stations,
    nodes: geo.pois,
    entrance: geo.entrance,
  });
}

function measureLyonGeo() {
  const first = buildLyonCityGeo();
  const second = buildLyonCityGeo();
  const firstPng = renderLyonPng(first);
  const secondPng = renderLyonPng(second);
  const terrainSha256 = HASH(first.terrain);
  const pngSha256 = HASH(firstPng);
  if (terrainSha256 !== HASH(second.terrain)) {
    throw new Error('Lyon terrain is not byte-identical across two builds');
  }
  if (pngSha256 !== HASH(secondPng)) {
    throw new Error('Lyon PNG is not byte-identical across two renders');
  }
  const counts = Object.fromEntries(Object.values(CITY_TILE).map((code) => [code, 0]));
  for (const code of first.terrain) counts[code] += 1;
  for (const code of Object.keys(counts)) {
    if (counts[code] === 0) delete counts[code];
  }
  const { w, h } = first.meta.grid;
  const seen = new Uint8Array(first.terrain.length);
  const queue = new Int32Array(first.terrain.length);
  let read = 0;
  let write = 0;
  const [startX, startY] = first.stations[0].tile;
  const start = startY * w + startX;
  queue[write] = start;
  write += 1;
  seen[start] = 1;
  while (read < write) {
    const index = queue[read];
    read += 1;
    const x = index % w;
    const y = Math.floor(index / w);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const next = ny * w + nx;
      if (seen[next] || !isCityWalkable(first.terrain[next])) continue;
      seen[next] = 1;
      queue[write] = next;
      write += 1;
    }
  }
  let walkableTileCount = 0;
  let reachedTileCount = 0;
  for (let index = 0; index < first.terrain.length; index += 1) {
    if (!isCityWalkable(first.terrain[index])) continue;
    walkableTileCount += 1;
    reachedTileCount += seen[index];
  }
  if (walkableTileCount !== reachedTileCount) {
    throw new Error(
      `Lyon cardinal walkability disconnected: ${reachedTileCount}/${walkableTileCount}`,
    );
  }
  return {
    counts,
    finalLandBuildingRatio: first.meta.buildingTexture.finalLandBuildingRatio,
    finalWaterTileCount: first.meta.hydrology.finalWaterTileCount,
    finalRiverTileCount: first.meta.hydrology.finalRiverTileCount,
    walkableTileCount,
    reachedTileCount,
    terrainSha256,
    terrainRleLength: encodeTerrainRle(first.terrain).length,
    pngSha256,
  };
}

function chebyshev(first, second) {
  return Math.max(Math.abs(first[0] - second[0]), Math.abs(first[1] - second[1]));
}

function boundaryAdjacent(resolved, grid, signs) {
  return signs.length > 0 && signs.every(({ tile: [x, y] }) => (
    cityDistrictOpenAt(resolved, x, y)
    && isCityWalkable(grid[y * resolved.cols + x])
    && grid[y * resolved.cols + x] !== CITY_TILE.EXIT
    && [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].some(([nx, ny]) => (
      nx >= 0 && ny >= 0 && nx < resolved.cols && ny < resolved.rows
      && !cityDistrictOpenAt(resolved, nx, ny)
    ))
  ));
}

function spacingValid(signs) {
  for (let first = 0; first < signs.length; first += 1) {
    for (let second = first + 1; second < signs.length; second += 1) {
      if (
        chebyshev(signs[first].tile, signs[second].tile)
        < CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING
      ) return false;
    }
  }
  return true;
}

function minimapPolicy() {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, 'src/components/world/GameCanvas.jsx'),
    'utf8',
  );
  const policySource = source.match(
    /export const cityMinimapLayoutForCity = ([\s\S]*?\n};)/,
  )?.[1];
  if (!policySource) throw new Error('GameCanvas cityMinimapLayoutForCity policy not found');
  return vm.runInNewContext(`(${policySource.replace(/;$/, '')})`, {
    CITY_MINI_SCALE,
    cityMinimapLayout,
  });
}

function minimapLockSamples(city, resolved, cityMinimapLayoutForCity) {
  const layout = cityMinimapLayoutForCity(city.id, city.cols, city.rows);
  let open = 0;
  let locked = 0;
  for (let sy = 0; sy < layout.sourceHeight; sy += 1) {
    for (let sx = 0; sx < layout.sourceWidth; sx += 1) {
      const tx = Math.min(city.cols - 1, sx * layout.factor);
      const ty = Math.min(city.rows - 1, sy * layout.factor);
      if (cityDistrictOpenAt(resolved, tx, ty)) open += 1;
      else locked += 1;
    }
  }
  return { factor: layout.factor, open, locked };
}

async function measureDistrictExpectations() {
  const allCities = await loadAllCities();
  const districtCities = allCities.filter((city) => city.districts != null);
  const cityData = Object.freeze(
    Object.fromEntries(allCities.map((city) => [city.id, city])),
  );
  const cityMinimapLayoutForCity = minimapPolicy();
  const cityNodeById = new Map(STAMP_ALBUM_NODES
    .filter((node) => node.gate?.type === 'city')
    .map((node) => [node.gate.to, node]));
  const boundaryManifest = [];
  const auditManifest = [];

  for (const city of districtCities) {
    const grid = city.buildGrid();
    const resolved = resolveCityDistricts(
      city,
      grid,
      resolveCityMainRoute(city, grid),
    );
    const signs = planCityDistrictBoundarySigns(resolved, grid);
    const tiles = signs.map(({ tile }) => tile);
    boundaryManifest.push({ id: city.id, tiles });

    const minimap = minimapLockSamples(city, resolved, cityMinimapLayoutForCity);
    const album = stampAlbumDistrictPresentation(cityNodeById.get(city.id), cityData);
    const labels = resolved.open.map((district) => district.label);
    auditManifest.push({
      id: city.id,
      t19: T19_CITY_IDS.has(city.id),
      signCount: signs.length,
      boundaryAdjacent: boundaryAdjacent(resolved, grid, signs),
      spacingValid: spacingValid(signs),
      lockLine: resolved.locked.line === LOCK_LINE,
      minimap: minimap.open > 0 && minimap.locked > 0,
      minimapFactor: minimap.factor,
      minimapOpenSamples: minimap.open,
      minimapLockedSamples: minimap.locked,
      album: album?.countLabel === `개방 ${labels.length} 동네`
        && JSON.stringify(album.labels) === JSON.stringify(labels),
      albumLabelCount: album?.labels.length ?? 0,
    });
  }

  const invalidAuditRows = auditManifest.filter((row) => !(
    row.boundaryAdjacent
    && row.spacingValid
    && row.lockLine
    && row.minimap
    && row.album
  ));
  if (invalidAuditRows.length > 0) {
    throw new Error(`District audit invariants failed: ${invalidAuditRows.map(({ id }) => id)}`);
  }
  return {
    signCounts: boundaryManifest.map(({ id, tiles }) => [id, tiles.length]),
    boundaryManifestSha256: HASH(JSON.stringify(boundaryManifest)),
    auditSha256: HASH(JSON.stringify(auditManifest)),
  };
}

function updateLyonGeoSource(source, measurement) {
  let output = source;
  const tileNames = [
    'ROAD', 'SIDEWALK', 'CROSSWALK', 'PLAZA', 'PARK', 'WATER',
    'BUILDING', 'RIVER', 'MOUNTAIN',
  ];
  for (const name of tileNames) {
    const code = CITY_TILE[name];
    if (!Number.isSafeInteger(measurement.counts[code])) {
      throw new Error(`Lyon measured terrain has no ${name} count`);
    }
    output = replaceOne(
      output,
      new RegExp(`(\\[CITY_TILE\\.${name}\\]: )[\\d_]+(,)`),
      (_match, prefix, suffix) => (
        `${prefix}${formatIntegerLiteral(measurement.counts[code])}${suffix}`
      ),
      `lyonGeo ${name} count`,
    );
  }
  output = replaceOne(
    output,
    /(finalLandBuildingRatio: )[\d.]+(,)/,
    (_match, prefix, suffix) => (
      `${prefix}${measurement.finalLandBuildingRatio}${suffix}`
    ),
    'lyonGeo final land/building ratio',
  );
  output = replaceOne(
    output,
    /(finalWaterTileCount: )[\d_]+(,)/,
    (_match, prefix, suffix) => (
      `${prefix}${formatIntegerLiteral(measurement.finalWaterTileCount)}${suffix}`
    ),
    'lyonGeo final water tile count',
  );
  output = replaceOne(
    output,
    /(finalRiverTileCount: )[\d_]+(,)/,
    (_match, prefix, suffix) => (
      `${prefix}${formatIntegerLiteral(measurement.finalRiverTileCount)}${suffix}`
    ),
    'lyonGeo final river tile count',
  );
  output = replaceOne(
    output,
    /(expect\(\{ walkable, reached \}\)\.toEqual\(\{ walkable: )[\d_]+(, reached: )[\d_]+( \}\);)/,
    (_match, prefix, middle, suffix) => (
      `${prefix}${formatIntegerLiteral(measurement.walkableTileCount)}`
      + `${middle}${formatIntegerLiteral(measurement.reachedTileCount)}${suffix}`
    ),
    'lyonGeo cardinal walkability counts',
  );
  output = replaceOne(
    output,
    /(expect\(hash\(first\.terrain\)\)\s*\n\s*\.toBe\(')[0-9a-f]{64}('\);)/,
    (_match, prefix, suffix) => `${prefix}${measurement.terrainSha256}${suffix}`,
    'lyonGeo terrain SHA',
  );
  output = replaceOne(
    output,
    /(expect\(encodeTerrainRle\(first\.terrain\)\)\.toHaveLength\()[\d_]+(\);)/,
    (_match, prefix, suffix) => (
      `${prefix}${formatIntegerLiteral(measurement.terrainRleLength)}${suffix}`
    ),
    'lyonGeo terrain RLE length',
  );
  output = replaceOne(
    output,
    /(expect\(hash\(firstPng\)\)\s*\n\s*\.toBe\(')[0-9a-f]{64}('\);)/,
    (_match, prefix, suffix) => `${prefix}${measurement.pngSha256}${suffix}`,
    'lyonGeo PNG SHA',
  );
  return output;
}

function updateBoundarySource(source, measurement) {
  return replaceOne(
    source,
    /(expect\(createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)\)\s*\n\s*\.toBe\(')[0-9a-f]{64}('\);)/,
    (_match, prefix, suffix) => (
      `${prefix}${measurement.boundaryManifestSha256}${suffix}`
    ),
    'district boundary manifest SHA',
  );
}

function updateAuditSource(source, measurement) {
  let output = source;
  for (const [cityId, signCount] of measurement.signCounts) {
    const escapedId = cityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = replaceOne(
      output,
      new RegExp(`(\\['${escapedId}', )[\\d_]+(\\])`),
      (_match, prefix, suffix) => `${prefix}${formatIntegerLiteral(signCount)}${suffix}`,
      `district audit sign count ${cityId}`,
    );
  }
  output = replaceOne(
    output,
    /(expect\(createHash\('sha256'\)\.update\(firstBytes\)\.digest\('hex'\)\)\s*\n\s*\.toBe\(')[0-9a-f]{64}('\);)/,
    (_match, prefix, suffix) => `${prefix}${measurement.auditSha256}${suffix}`,
    'district audit SHA',
  );
  return output;
}

function runSnapshotTests(check) {
  const args = [
    path.join(REPO_ROOT, 'node_modules/vitest/vitest.mjs'),
    'run',
    'src/components/world/__tests__/cityDistrictBoundarySigns.test.js',
    'src/components/world/__tests__/cityRoadAutotile.test.js',
    '--no-file-parallelism',
  ];
  if (!check) args.push('--update');
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`targeted snapshot Vitest failed with exit ${result.status}`);
  }
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) return;
  const before = new Map(
    Object.values(TARGETS).map((target) => [target, fs.readFileSync(target, 'utf8')]),
  );
  const lyon = measureLyonGeo();
  const district = await measureDistrictExpectations();
  const rewritten = new Map([
    [TARGETS.lyonGeo, updateLyonGeoSource(before.get(TARGETS.lyonGeo), lyon)],
    [TARGETS.boundary, updateBoundarySource(before.get(TARGETS.boundary), district)],
    [TARGETS.audit, updateAuditSource(before.get(TARGETS.audit), district)],
  ]);
  const staleLiterals = [...rewritten]
    .filter(([target, source]) => source !== before.get(target))
    .map(([target]) => path.relative(REPO_ROOT, target));
  if (options.check && staleLiterals.length > 0) {
    throw new Error(`stale measured tile-fix expectations: ${staleLiterals.join(', ')}`);
  }
  if (!options.check) {
    for (const [target, source] of rewritten) fs.writeFileSync(target, source, 'utf8');
  }
  runSnapshotTests(options.check);

  const updatedFiles = Object.values(TARGETS)
    .filter((target) => fs.readFileSync(target, 'utf8') !== before.get(target))
    .map((target) => path.relative(REPO_ROOT, target));
  process.stdout.write(`${JSON.stringify({
    mode: options.check ? 'check' : 'update',
    lyon,
    district: {
      signCounts: Object.fromEntries(district.signCounts),
      boundaryManifestSha256: district.boundaryManifestSha256,
      auditSha256: district.auditSha256,
    },
    updatedFiles,
  })}\n`);
}

await main(process.argv.slice(2));
