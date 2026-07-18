const SHA256_HEX = /^[0-9a-f]{64}$/;
const TOP_LEVEL_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'generatorGitSha',
  'regionId',
  'baseTerrain',
  'boundarySources',
  'boundaryRules',
  'policy',
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

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function assertSha256(value, label) {
  if (!SHA256_HEX.test(value)) throw new TypeError(`${label} must be a lowercase SHA-256`);
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
    assertString(value[key], `baseTerrain.${key}`);
  }
  assertSha256(value.contentManifestSha256, 'baseTerrain.contentManifestSha256');
  assertPositiveInteger(value.contentManifestBytes, 'baseTerrain.contentManifestBytes');
  return Object.freeze({ ...value });
}

function normalizeBoundarySource(value, index) {
  assertExactKeys(value, [
    'id', 'cacheFile', 'url', 'version', 'sha256', 'bytes', 'license',
    'role', 'required', 'sourceKind',
  ], `boundarySources[${index}]`);
  for (const key of ['id', 'cacheFile', 'url', 'version', 'license']) {
    assertString(value[key], `boundarySources[${index}].${key}`);
  }
  if (value.cacheFile.includes('/') || value.cacheFile.includes('\\')) {
    throw new Error(`boundarySources[${index}].cacheFile must be one file name`);
  }
  assertSha256(value.sha256, `boundarySources[${index}].sha256`);
  assertPositiveInteger(value.bytes, `boundarySources[${index}].bytes`);
  if (!['land', 'disputed'].includes(value.sourceKind)) {
    throw new Error(`boundarySources[${index}].sourceKind is unsupported`);
  }
  const expectedRole = value.sourceKind === 'land'
    ? 'admin0-boundary-lines'
    : 'admin0-disputed-boundary-lines';
  if (value.role !== expectedRole || value.required !== true) {
    throw new Error(`boundarySources[${index}] must be the required ${expectedRole} source`);
  }
  return Object.freeze({ ...value });
}

function normalizeClassList(value, label) {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => (
    typeof item === 'string' && item.length > 0
  ))) {
    throw new TypeError(`${label} must be a non-empty string array`);
  }
  const sorted = [...value].sort();
  if (new Set(value).size !== value.length || JSON.stringify(value) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be unique and code-point sorted`);
  }
  return Object.freeze([...value]);
}

function normalizePolicy(value) {
  assertExactKeys(value, [
    'id', 'solidFeatureClasses', 'neutralFeatureClasses', 'countryFill',
    'ownershipLabels', 'sourceProperties', 'disclaimer',
  ], 'policy');
  if (value.id !== 'neutral-boundary-policy-v1') throw new Error('unsupported boundary policy');
  const solidFeatureClasses = normalizeClassList(value.solidFeatureClasses, 'policy.solidFeatureClasses');
  const neutralFeatureClasses = normalizeClassList(value.neutralFeatureClasses, 'policy.neutralFeatureClasses');
  if (solidFeatureClasses.some((item) => neutralFeatureClasses.includes(item))) {
    throw new Error('boundary policy classes must not overlap');
  }
  if (value.countryFill !== 'none' || value.ownershipLabels !== 'forbidden'
    || value.sourceProperties !== 'discard-all') {
    throw new Error('boundary policy must forbid ownership styling and source properties');
  }
  assertString(value.disclaimer, 'policy.disclaimer');
  return Object.freeze({
    ...value,
    solidFeatureClasses,
    neutralFeatureClasses,
  });
}

function normalizeBoundaryRules(value) {
  assertExactKeys(value, [
    'quantization', 'haloTiles', 'simplification', 'defaultScaleRank',
  ], 'boundaryRules');
  if (value.quantization !== 1024 || value.haloTiles !== 1 || value.simplification !== 'none') {
    throw new Error('boundaryRules must keep 1/1024 quantization, one-tile halo, and no simplification');
  }
  assertPositiveInteger(value.defaultScaleRank, 'boundaryRules.defaultScaleRank');
  return Object.freeze({ ...value });
}

export function normalizeOverworldBoundaryManifest(input) {
  assertExactKeys(input, TOP_LEVEL_KEYS, 'boundary manifest');
  if (input.schemaVersion !== 1) throw new Error('boundary schemaVersion must be 1');
  if (typeof input.releaseEligible !== 'boolean') {
    throw new TypeError('releaseEligible must be boolean');
  }
  if (input.generatorGitSha !== null
    && (typeof input.generatorGitSha !== 'string' || !/^[0-9a-f]{40}$/.test(input.generatorGitSha))) {
    throw new TypeError('generatorGitSha must be null or a full lowercase git SHA');
  }
  assertString(input.regionId, 'regionId');
  if (!Array.isArray(input.boundarySources) || input.boundarySources.length !== 2) {
    throw new Error('boundarySources must contain exactly land and disputed sources');
  }
  const boundarySources = input.boundarySources.map(normalizeBoundarySource);
  if (JSON.stringify(boundarySources.map(({ sourceKind }) => sourceKind)) !== JSON.stringify(['land', 'disputed'])) {
    throw new Error('boundarySources must be ordered land, disputed');
  }
  return Object.freeze({
    ...input,
    baseTerrain: normalizeBaseTerrain(input.baseTerrain),
    boundarySources: Object.freeze(boundarySources),
    boundaryRules: normalizeBoundaryRules(input.boundaryRules),
    policy: normalizePolicy(input.policy),
  });
}

export function classifyBoundaryFeature(sourceKind, featureClass, policy) {
  if (typeof featureClass !== 'string' || featureClass.length === 0) {
    throw new Error('boundary feature class must be present');
  }
  if (sourceKind === 'land' && policy.solidFeatureClasses.includes(featureClass)) return 'de-facto';
  if (policy.neutralFeatureClasses.includes(featureClass)) return 'neutral-disputed';
  throw new Error(`unclassified boundary feature class: ${featureClass}`);
}
