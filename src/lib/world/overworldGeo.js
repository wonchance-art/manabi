const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const SHA256_HEX = /^[0-9a-f]{64}$/;

const MANIFEST_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'generatorGitSha',
  'regionId',
  'bbox',
  'earthRadiusMeters',
  'metersPerTile',
  'chunkTiles',
  'projection',
  'tileFrame',
  'supersampling',
  'surfaceClasses',
  'surfacePriority',
  'previewMasks',
  'sources',
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

function assertFinite(value, label, { positive = false } = {}) {
  if (!Number.isFinite(value) || (positive && value <= 0)) {
    throw new RangeError(`${label} must be ${positive ? 'a positive' : 'a finite'} number`);
  }
}

function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer between ${min} and ${max}`);
  }
}

function normalizeSource(source, index) {
  const label = `sources[${index}]`;
  assertExactKeys(source, [
    'id', 'cacheFile', 'url', 'version', 'sha256', 'bytes', 'license', 'role', 'required',
  ], label);
  for (const key of ['id', 'cacheFile', 'url', 'version', 'license', 'role']) {
    if (typeof source[key] !== 'string' || source[key].length === 0) {
      throw new TypeError(`${label}.${key} must be a non-empty string`);
    }
  }
  if (source.cacheFile.includes('/') || source.cacheFile.includes('\\') || source.cacheFile === '..') {
    throw new Error(`${label}.cacheFile must be one file name`);
  }
  if (!SHA256_HEX.test(source.sha256)) throw new TypeError(`${label}.sha256 must be lowercase SHA-256 hex`);
  assertInteger(source.bytes, `${label}.bytes`, { min: 1 });
  if (source.required !== true) throw new Error(`${label}.required must be true for this release stage`);
  return Object.freeze({ ...source });
}

export function normalizeLongitude(lon, center = 0) {
  let normalized = lon;
  while (normalized - center > 180) normalized -= 360;
  while (normalized - center < -180) normalized += 360;
  return normalized;
}

export function roundHalfAwayFromZero(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function normalizeOverworldRegionManifest(manifest) {
  assertExactKeys(manifest, MANIFEST_KEYS, 'manifest');
  assertInteger(manifest.schemaVersion, 'schemaVersion', { min: 1, max: 0xffff });
  if (manifest.releaseEligible !== false) {
    throw new Error('the surface-only region stage must remain releaseEligible=false');
  }
  if (manifest.generatorGitSha !== null) {
    if (typeof manifest.generatorGitSha !== 'string' || !/^[0-9a-f]{40}$/.test(manifest.generatorGitSha)) {
      throw new TypeError('generatorGitSha must be null or a full lowercase 40-character git SHA');
    }
  }
  if (typeof manifest.regionId !== 'string' || !/^[a-z0-9-]+$/.test(manifest.regionId)) {
    throw new TypeError('regionId must use lowercase ASCII letters, digits, and hyphens');
  }

  if (!Array.isArray(manifest.bbox) || manifest.bbox.length !== 4) {
    throw new TypeError('bbox must be [minLon,minLat,maxLon,maxLat]');
  }
  manifest.bbox.forEach((value, index) => assertFinite(value, `bbox[${index}]`));
  const [minLon, minLat, maxLon, maxLat] = manifest.bbox;
  if (minLon >= maxLon || minLat >= maxLat || minLat < -90 || maxLat > 90 || maxLon - minLon > 180) {
    throw new RangeError('bbox must be ordered, stay within latitude limits, and span at most 180 longitude degrees');
  }
  assertFinite(manifest.earthRadiusMeters, 'earthRadiusMeters', { positive: true });
  assertFinite(manifest.metersPerTile, 'metersPerTile', { positive: true });
  assertInteger(manifest.chunkTiles, 'chunkTiles', { min: 1, max: 0xffff });
  if (manifest.chunkTiles !== 256) {
    throw new Error('chunkTiles must remain locked to 256');
  }

  assertExactKeys(manifest.projection, ['id', 'method', 'axisMode', 'lon0', 'lat0', 'standardLat'], 'projection');
  if (manifest.projection.method !== 'equirectangular' || manifest.projection.axisMode !== 'screen-axis') {
    throw new Error('overworld region projection must be equirectangular + screen-axis');
  }
  if (typeof manifest.projection.id !== 'string' || manifest.projection.id.length === 0) {
    throw new TypeError('projection.id must be a non-empty string');
  }
  for (const key of ['lon0', 'lat0', 'standardLat']) {
    assertFinite(manifest.projection[key], `projection.${key}`);
  }

  assertExactKeys(manifest.tileFrame, ['origin', 'yAxis', 'boundary', 'rounding'], 'tileFrame');
  if (manifest.tileFrame.origin !== 'projected-bbox-north-west'
    || manifest.tileFrame.yAxis !== 'south'
    || manifest.tileFrame.boundary !== 'half-open'
    || manifest.tileFrame.rounding !== 'nearest-half-away-from-zero') {
    throw new Error('tileFrame contract drifted');
  }

  assertExactKeys(manifest.supersampling, ['width', 'height', 'offsets'], 'supersampling');
  if (manifest.supersampling.width !== 4 || manifest.supersampling.height !== 4
    || JSON.stringify(manifest.supersampling.offsets) !== JSON.stringify([0.125, 0.375, 0.625, 0.875])) {
    throw new Error('supersampling must use the locked 4x4 center offsets');
  }

  assertExactKeys(manifest.surfaceClasses, ['sea', 'land'], 'surfaceClasses');
  for (const key of ['sea', 'land']) {
    assertInteger(manifest.surfaceClasses[key], `surfaceClasses.${key}`, { min: 0, max: 15 });
  }
  if (manifest.surfaceClasses.sea === manifest.surfaceClasses.land) {
    throw new Error('sea and land surface class IDs must differ');
  }
  if (JSON.stringify(manifest.surfacePriority) !== JSON.stringify(['land', 'sea'])) {
    throw new Error('surfacePriority must be ["land","sea"]');
  }

  assertExactKeys(manifest.previewMasks, ['collision', 'viewOnly'], 'previewMasks');
  if (manifest.previewMasks.collision !== 'all-blocked'
    || manifest.previewMasks.viewOnly !== 'all-view-only') {
    throw new Error('surface-only preview masks must fail closed');
  }
  if (!Array.isArray(manifest.sources) || manifest.sources.length !== 1) {
    throw new Error('surface-only stage requires exactly one Natural Earth land source');
  }
  const sources = manifest.sources.map(normalizeSource);
  if (sources[0].role !== 'land' || !sources[0].id.startsWith('natural-earth-land-')) {
    throw new Error('surface-only source must be Natural Earth land geometry');
  }

  return Object.freeze({
    ...manifest,
    bbox: Object.freeze([...manifest.bbox]),
    projection: Object.freeze({ ...manifest.projection }),
    tileFrame: Object.freeze({ ...manifest.tileFrame }),
    supersampling: Object.freeze({
      ...manifest.supersampling,
      offsets: Object.freeze([...manifest.supersampling.offsets]),
    }),
    surfaceClasses: Object.freeze({ ...manifest.surfaceClasses }),
    surfacePriority: Object.freeze([...manifest.surfacePriority]),
    previewMasks: Object.freeze({ ...manifest.previewMasks }),
    sources: Object.freeze(sources),
  });
}

export function createEquirectangularTileFrame(manifestInput) {
  const manifest = normalizeOverworldRegionManifest(manifestInput);
  const { earthRadiusMeters: radius, metersPerTile, bbox, projection } = manifest;
  const standardCos = Math.cos(projection.standardLat * DEG);
  if (Math.abs(standardCos) < 1e-12) throw new RangeError('projection.standardLat is too close to a pole');
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const forwardUnwrapped = (lon, lat) => ({
    x: radius * (lon - projection.lon0) * DEG * standardCos,
    y: radius * lat * DEG,
  });
  const forward = (lon, lat) => forwardUnwrapped(normalizeLongitude(lon, projection.lon0), lat);
  const min = forward(minLon, minLat);
  const max = forward(maxLon, maxLat);
  const minX = Math.min(min.x, max.x);
  const maxX = Math.max(min.x, max.x);
  const minY = Math.min(min.y, max.y);
  const maxY = Math.max(min.y, max.y);
  const width = Math.ceil((maxX - minX) / metersPerTile);
  const height = Math.ceil((maxY - minY) / metersPerTile);

  const project = (lon, lat) => {
    const point = forward(lon, lat);
    return Object.freeze({
      x: (point.x - minX) / metersPerTile,
      y: (maxY - point.y) / metersPerTile,
    });
  };
  const projectUnwrapped = (lon, lat) => {
    const point = forwardUnwrapped(lon, lat);
    return Object.freeze({
      x: (point.x - minX) / metersPerTile,
      y: (maxY - point.y) / metersPerTile,
    });
  };
  const unproject = (x, y) => Object.freeze({
    lon: normalizeLongitude(((minX + x * metersPerTile) / (radius * standardCos)) * RAD + projection.lon0,
      projection.lon0),
    lat: ((maxY - y * metersPerTile) / radius) * RAD,
  });
  const tileToChunk = (x, y) => Object.freeze({
    cx: Math.floor(x / manifest.chunkTiles),
    cy: Math.floor(y / manifest.chunkTiles),
  });

  return Object.freeze({
    manifest,
    width,
    height,
    chunkColumns: Math.ceil(width / manifest.chunkTiles),
    chunkRows: Math.ceil(height / manifest.chunkTiles),
    bounds: Object.freeze({ minX, minY, maxX, maxY }),
    project,
    projectUnwrapped,
    unproject,
    tileToChunk,
  });
}
