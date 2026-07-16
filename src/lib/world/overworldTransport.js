import { quantizeTerrainOverlay, unwrapLineLongitudes } from './overworldTerrain.js';

const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'generatorGitSha',
  'regionId',
  'baseTerrain',
  'railSource',
  'railRules',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertExactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} keys mismatch: ${actual.join(',')}`);
  }
}

function assertSha256(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} must be a lowercase SHA-256`);
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive integer`);
}

function normalizeBaseTerrain(value) {
  assertExactKeys(value, [
    'manifestPath',
    'directory',
    'contentManifest',
    'contentManifestSha256',
    'contentManifestBytes',
  ], 'baseTerrain');
  for (const key of ['manifestPath', 'directory', 'contentManifest']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new Error(`baseTerrain.${key} must be a non-empty string`);
    }
  }
  assertSha256(value.contentManifestSha256, 'baseTerrain.contentManifestSha256');
  assertPositiveInteger(value.contentManifestBytes, 'baseTerrain.contentManifestBytes');
  return Object.freeze({ ...value });
}

function normalizeRailSource(value) {
  assertExactKeys(value, [
    'id', 'cacheFile', 'url', 'version', 'sha256', 'bytes', 'license', 'role', 'required',
  ], 'railSource');
  for (const key of ['id', 'cacheFile', 'url', 'version', 'license']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new Error(`railSource.${key} must be a non-empty string`);
    }
  }
  assertSha256(value.sha256, 'railSource.sha256');
  assertPositiveInteger(value.bytes, 'railSource.bytes');
  if (value.role !== 'rail-centerlines' || value.required !== true) {
    throw new Error('railSource must be a required rail-centerlines source');
  }
  return Object.freeze({ ...value });
}

function normalizeRailRules(value) {
  assertExactKeys(value, [
    'maxScaleRank', 'quantization', 'haloTiles', 'simplification',
  ], 'railRules');
  if (!Number.isSafeInteger(value.maxScaleRank) || value.maxScaleRank < 0) {
    throw new RangeError('railRules.maxScaleRank must be a non-negative integer');
  }
  if (value.quantization !== 1024 || value.haloTiles !== 1) {
    throw new Error('railRules quantization/halo contract drifted');
  }
  assertExactKeys(value.simplification, ['method', 'toleranceQuantized'], 'railRules.simplification');
  if (value.simplification.method !== 'rdp-global-quantized') {
    throw new Error('railRules.simplification.method must be rdp-global-quantized');
  }
  assertPositiveInteger(value.simplification.toleranceQuantized, 'railRules.simplification.toleranceQuantized');
  if (value.simplification.toleranceQuantized >= value.quantization) {
    throw new RangeError('rail simplification tolerance must remain below one tile');
  }
  return Object.freeze({
    ...value,
    simplification: Object.freeze({ ...value.simplification }),
  });
}

export function normalizeOverworldTransportManifest(input) {
  assertExactKeys(input, TOP_LEVEL_KEYS, 'transport manifest');
  if (input.schemaVersion !== 1) throw new Error('transport schemaVersion must be 1');
  if (input.releaseEligible !== false) throw new Error('transport preview must remain releaseEligible=false');
  if (input.generatorGitSha !== null
    && (typeof input.generatorGitSha !== 'string' || !/^[0-9a-f]{40}$/.test(input.generatorGitSha))) {
    throw new Error('generatorGitSha must be null or a full lowercase git SHA');
  }
  if (typeof input.regionId !== 'string' || input.regionId.length === 0) {
    throw new Error('regionId must be a non-empty string');
  }
  return Object.freeze({
    schemaVersion: input.schemaVersion,
    releaseEligible: input.releaseEligible,
    generatorGitSha: input.generatorGitSha,
    regionId: input.regionId,
    baseTerrain: normalizeBaseTerrain(input.baseTerrain),
    railSource: normalizeRailSource(input.railSource),
    railRules: normalizeRailRules(input.railRules),
  });
}

function perpendicularExceedsTolerance(point, start, end, toleranceSquared) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    const px = point[0] - start[0];
    const py = point[1] - start[1];
    return px * px + py * py > toleranceSquared;
  }
  const cross = dy * (point[0] - start[0]) - dx * (point[1] - start[1]);
  return cross * cross > toleranceSquared * (dx * dx + dy * dy);
}

export function simplifyQuantizedLine(points, tolerance) {
  if (!Array.isArray(points)) throw new TypeError('points must be an array');
  if (!Number.isSafeInteger(tolerance) || tolerance <= 0) {
    throw new RangeError('tolerance must be a positive integer');
  }
  const deduplicated = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2
      || !Number.isSafeInteger(point[0]) || !Number.isSafeInteger(point[1])) {
      throw new TypeError('quantized points must be integer pairs');
    }
    const previous = deduplicated.at(-1);
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) deduplicated.push(point);
  }
  if (deduplicated.length <= 2) return Object.freeze(deduplicated.map((point) => Object.freeze([...point])));

  const keep = new Uint8Array(deduplicated.length);
  keep[0] = 1;
  keep[keep.length - 1] = 1;
  const stack = [[0, deduplicated.length - 1]];
  const toleranceSquared = tolerance * tolerance;
  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop();
    let farthestIndex = -1;
    let farthestRatio = -1;
    const start = deduplicated[startIndex];
    const end = deduplicated[endIndex];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lengthSquared = dx * dx + dy * dy;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const point = deduplicated[index];
      const px = point[0] - start[0];
      const py = point[1] - start[1];
      const distanceNumerator = lengthSquared === 0
        ? px * px + py * py
        : (dy * px - dx * py) ** 2 / lengthSquared;
      if (distanceNumerator > farthestRatio) {
        farthestRatio = distanceNumerator;
        farthestIndex = index;
      }
    }
    if (farthestIndex >= 0
      && perpendicularExceedsTolerance(deduplicated[farthestIndex], start, end, toleranceSquared)) {
      keep[farthestIndex] = 1;
      stack.push([startIndex, farthestIndex], [farthestIndex, endIndex]);
    }
  }
  return Object.freeze(deduplicated.filter((_, index) => keep[index] === 1)
    .map((point) => Object.freeze([...point])));
}

export function projectAndSimplifyRailLine({ coordinates, frame, rules }) {
  const projected = unwrapLineLongitudes(coordinates, frame.manifest.projection.lon0).map(([lon, lat]) => {
    const point = frame.projectUnwrapped(lon, lat);
    return [
      quantizeTerrainOverlay(point.x, rules.quantization),
      quantizeTerrainOverlay(point.y, rules.quantization),
    ];
  });
  return simplifyQuantizedLine(projected, rules.simplification.toleranceQuantized);
}
