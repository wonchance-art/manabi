import { normalizeLongitude, roundHalfAwayFromZero } from './overworldGeo.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;
const TERRAIN_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'generatorGitSha',
  'regionId',
  'baseSurface',
  'elevationSource',
  'riverSource',
  'terrainClasses',
  'terrainThresholdsMeters',
  'elevationSampling',
  'riverRules',
  'previewMasks',
]);

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} keys must be exactly: ${wanted.join(', ')}`);
  }
}

function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer between ${min} and ${max}`);
  }
}

function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertRelativePath(value, label) {
  assertString(value, label);
  if (value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) {
    throw new Error(`${label} must be a repository-relative POSIX path`);
  }
}

function assertHash(value, label) {
  if (!SHA256_HEX.test(value)) throw new TypeError(`${label} must be lowercase SHA-256 hex`);
}

function normalizeBaseSurface(baseSurface) {
  assertExactKeys(baseSurface, [
    'manifestPath', 'directory', 'contentManifest', 'contentManifestSha256', 'contentManifestBytes',
  ], 'baseSurface');
  for (const key of ['manifestPath', 'directory', 'contentManifest']) {
    assertRelativePath(baseSurface[key], `baseSurface.${key}`);
  }
  assertHash(baseSurface.contentManifestSha256, 'baseSurface.contentManifestSha256');
  assertInteger(baseSurface.contentManifestBytes, 'baseSurface.contentManifestBytes', { min: 1 });
  return Object.freeze({ ...baseSurface });
}

function normalizeElevationSource(source) {
  assertExactKeys(source, [
    'id', 'cacheFile', 'url', 'version', 'sha256', 'bytes', 'license', 'role', 'required',
    'width', 'height', 'pixelSizeDegrees', 'originCenterLon', 'originCenterLat', 'dataType', 'crop',
  ], 'elevationSource');
  for (const key of ['id', 'cacheFile', 'url', 'version', 'license', 'role', 'dataType']) {
    assertString(source[key], `elevationSource.${key}`);
  }
  if (source.cacheFile.includes('/') || source.cacheFile.includes('\\')) {
    throw new Error('elevationSource.cacheFile must be one file name');
  }
  assertHash(source.sha256, 'elevationSource.sha256');
  assertInteger(source.bytes, 'elevationSource.bytes', { min: 1 });
  assertInteger(source.width, 'elevationSource.width', { min: 1 });
  assertInteger(source.height, 'elevationSource.height', { min: 1 });
  for (const key of ['pixelSizeDegrees', 'originCenterLon', 'originCenterLat']) {
    assertFinite(source[key], `elevationSource.${key}`);
  }
  if (source.pixelSizeDegrees <= 0) throw new RangeError('elevationSource.pixelSizeDegrees must be positive');
  if (source.role !== 'elevation' || source.required !== true || source.dataType !== 'float32') {
    throw new Error('elevationSource must be required float32 elevation data');
  }
  assertExactKeys(source.crop, ['left', 'top', 'width', 'height'], 'elevationSource.crop');
  for (const key of ['left', 'top', 'width', 'height']) {
    assertInteger(source.crop[key], `elevationSource.crop.${key}`, { min: key === 'width' || key === 'height' ? 1 : 0 });
  }
  if (source.crop.left + source.crop.width > source.width
    || source.crop.top + source.crop.height > source.height) {
    throw new RangeError('elevationSource.crop must stay inside the source raster');
  }
  return Object.freeze({ ...source, crop: Object.freeze({ ...source.crop }) });
}

function normalizeRiverSource(source) {
  assertExactKeys(source, [
    'id', 'cacheFile', 'url', 'version', 'sha256', 'bytes', 'license', 'role', 'required',
  ], 'riverSource');
  for (const key of ['id', 'cacheFile', 'url', 'version', 'license', 'role']) {
    assertString(source[key], `riverSource.${key}`);
  }
  if (source.cacheFile.includes('/') || source.cacheFile.includes('\\')) {
    throw new Error('riverSource.cacheFile must be one file name');
  }
  assertHash(source.sha256, 'riverSource.sha256');
  assertInteger(source.bytes, 'riverSource.bytes', { min: 1 });
  if (source.role !== 'river-centerlines' || source.required !== true) {
    throw new Error('riverSource must be required river-centerlines data');
  }
  return Object.freeze({ ...source });
}

export function normalizeOverworldTerrainManifest(manifest) {
  assertExactKeys(manifest, TERRAIN_KEYS, 'terrain manifest');
  assertInteger(manifest.schemaVersion, 'schemaVersion', { min: 1, max: 0xffff });
  if (typeof manifest.releaseEligible !== 'boolean') {
    throw new TypeError('releaseEligible must be boolean');
  }
  if (manifest.generatorGitSha !== null
    && (typeof manifest.generatorGitSha !== 'string' || !/^[0-9a-f]{40}$/.test(manifest.generatorGitSha))) {
    throw new TypeError('generatorGitSha must be null or a full lowercase 40-character git SHA');
  }
  if (typeof manifest.regionId !== 'string' || !/^[a-z0-9-]+$/.test(manifest.regionId)) {
    throw new TypeError('regionId must use lowercase ASCII letters, digits, and hyphens');
  }
  const baseSurface = normalizeBaseSurface(manifest.baseSurface);
  const elevationSource = normalizeElevationSource(manifest.elevationSource);
  const riverSource = normalizeRiverSource(manifest.riverSource);

  assertExactKeys(manifest.terrainClasses, ['sea', 'lowland', 'highland', 'mountain', 'alpine'], 'terrainClasses');
  const classValues = Object.values(manifest.terrainClasses);
  classValues.forEach((value, index) => assertInteger(value, `terrainClasses[${index}]`, { min: 0, max: 15 }));
  if (new Set(classValues).size !== classValues.length || manifest.terrainClasses.sea !== 0) {
    throw new Error('terrainClasses must be unique and keep sea=0');
  }

  assertExactKeys(manifest.terrainThresholdsMeters, ['highland', 'mountain', 'alpine'], 'terrainThresholdsMeters');
  const { highland, mountain, alpine } = manifest.terrainThresholdsMeters;
  for (const [value, label] of [[highland, 'highland'], [mountain, 'mountain'], [alpine, 'alpine']]) {
    assertFinite(value, `terrainThresholdsMeters.${label}`);
  }
  if (!(0 < highland && highland < mountain && mountain < alpine)) {
    throw new Error('terrain thresholds must be strictly increasing positive meters');
  }

  assertExactKeys(manifest.elevationSampling, ['method', 'offsets', 'rounding', 'edgeHandling'], 'elevationSampling');
  if (manifest.elevationSampling.method !== 'nearest-native-mean-4x4'
    || manifest.elevationSampling.rounding !== 'nearest-half-away-from-zero'
    || manifest.elevationSampling.edgeHandling !== 'clamp-to-source-edge'
    || JSON.stringify(manifest.elevationSampling.offsets) !== JSON.stringify([0.125, 0.375, 0.625, 0.875])) {
    throw new Error('elevationSampling contract drifted');
  }

  assertExactKeys(manifest.riverRules, ['maxScaleRank', 'quantization', 'haloTiles', 'simplification'], 'riverRules');
  assertInteger(manifest.riverRules.maxScaleRank, 'riverRules.maxScaleRank', { min: 0, max: 10 });
  if (manifest.riverRules.quantization !== 1024
    || manifest.riverRules.haloTiles !== 1
    || manifest.riverRules.simplification !== 'none') {
    throw new Error('riverRules must keep 1/1024 quantization, one-tile halo, and no simplification');
  }

  assertExactKeys(manifest.previewMasks, ['collision', 'viewOnly'], 'previewMasks');
  if (manifest.previewMasks.collision !== 'all-blocked'
    || manifest.previewMasks.viewOnly !== 'all-view-only') {
    throw new Error('terrain preview masks must fail closed');
  }

  return Object.freeze({
    ...manifest,
    baseSurface,
    elevationSource,
    riverSource,
    terrainClasses: Object.freeze({ ...manifest.terrainClasses }),
    terrainThresholdsMeters: Object.freeze({ ...manifest.terrainThresholdsMeters }),
    elevationSampling: Object.freeze({
      ...manifest.elevationSampling,
      offsets: Object.freeze([...manifest.elevationSampling.offsets]),
    }),
    riverRules: Object.freeze({ ...manifest.riverRules }),
    previewMasks: Object.freeze({ ...manifest.previewMasks }),
  });
}

export function classifyTerrainElevation(elevationMeters, classes, thresholds) {
  assertFinite(elevationMeters, 'elevationMeters');
  if (elevationMeters >= thresholds.alpine) return classes.alpine;
  if (elevationMeters >= thresholds.mountain) return classes.mountain;
  if (elevationMeters >= thresholds.highland) return classes.highland;
  return classes.lowland;
}

export function meanElevationMeters(samples) {
  if (!Array.isArray(samples) && !ArrayBuffer.isView(samples)) {
    throw new TypeError('elevation samples must be an array');
  }
  if (samples.length !== 16) throw new RangeError('elevation sampling requires exactly 16 values');
  let total = 0;
  for (const sample of samples) {
    assertFinite(sample, 'elevation sample');
    total += sample;
  }
  return roundHalfAwayFromZero(total / samples.length);
}

export function unwrapLineLongitudes(points, center) {
  if (!Array.isArray(points) || points.length < 2) throw new RangeError('river line needs at least two points');
  let previous;
  return points.map((point, index) => {
    if (!Array.isArray(point) || point.length < 2) throw new TypeError(`river point ${index} must be [lon,lat]`);
    const [lon, lat] = point;
    assertFinite(lon, `river point ${index} longitude`);
    assertFinite(lat, `river point ${index} latitude`);
    let unwrapped = index === 0 ? normalizeLongitude(lon, center) : lon;
    if (index > 0) {
      while (unwrapped - previous > 180) unwrapped -= 360;
      while (unwrapped - previous < -180) unwrapped += 360;
    }
    previous = unwrapped;
    return Object.freeze([unwrapped, lat]);
  });
}

export function quantizeTerrainOverlay(value, quantization = 1024) {
  assertFinite(value, 'overlay coordinate');
  const quantized = roundHalfAwayFromZero(value * quantization);
  if (!Number.isSafeInteger(quantized)) throw new RangeError('overlay coordinate is outside the safe integer range');
  return quantized;
}
