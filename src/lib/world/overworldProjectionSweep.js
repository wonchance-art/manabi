const DEG = Math.PI / 180;

const MANIFEST_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'regionId',
  'bbox',
  'anchor',
  'earthRadiusMeters',
  'metersPerTile',
  'chunkTiles',
  'axisModes',
  'sampleGrid',
  'scoreWeights',
  'standardLatitudeSweep',
  'fixtures',
  'priorBaseline',
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
    throw new RangeError(`${label} must be ${positive ? 'positive' : 'finite'}`);
  }
}

function assertInteger(value, label, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer between ${min} and ${max}`);
  }
}

function normalizeBbox(bbox, label) {
  if (!Array.isArray(bbox) || bbox.length !== 4) throw new TypeError(`${label} must have four values`);
  bbox.forEach((value, index) => assertFinite(value, `${label}[${index}]`));
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || bbox[1] < -90 || bbox[3] > 90) {
    throw new RangeError(`${label} must be an ordered WGS84 bbox`);
  }
  return Object.freeze([...bbox]);
}

export function normalizeProjectionSweepManifest(manifest) {
  assertExactKeys(manifest, MANIFEST_KEYS, 'projection sweep manifest');
  assertInteger(manifest.schemaVersion, 'schemaVersion', { min: 1, max: 0xffff });
  if (manifest.releaseEligible !== false) throw new Error('projection sweep must remain releaseEligible=false');
  if (typeof manifest.regionId !== 'string' || !/^[a-z0-9-]+$/.test(manifest.regionId)) {
    throw new TypeError('regionId must use lowercase ASCII letters, digits, and hyphens');
  }
  const bbox = normalizeBbox(manifest.bbox, 'bbox');
  assertExactKeys(manifest.anchor, ['lon0', 'lat0'], 'anchor');
  assertFinite(manifest.anchor.lon0, 'anchor.lon0');
  assertFinite(manifest.anchor.lat0, 'anchor.lat0');
  assertFinite(manifest.earthRadiusMeters, 'earthRadiusMeters', { positive: true });
  assertFinite(manifest.metersPerTile, 'metersPerTile', { positive: true });
  if (manifest.chunkTiles !== 256) throw new Error('chunkTiles must remain 256');
  if (JSON.stringify(manifest.axisModes) !== JSON.stringify(['screen-axis', 'geo-axis'])) {
    throw new Error('axisModes must keep screen-axis and geo-axis in order');
  }

  assertExactKeys(manifest.sampleGrid, ['columns', 'rows', 'offset'], 'sampleGrid');
  assertInteger(manifest.sampleGrid.columns, 'sampleGrid.columns', { min: 2, max: 1001 });
  assertInteger(manifest.sampleGrid.rows, 'sampleGrid.rows', { min: 2, max: 1001 });
  assertFinite(manifest.sampleGrid.offset, 'sampleGrid.offset');
  if (manifest.sampleGrid.offset <= 0 || manifest.sampleGrid.offset >= 1) {
    throw new RangeError('sampleGrid.offset must be between zero and one');
  }

  assertExactKeys(manifest.scoreWeights, [
    'scaleP95', 'northDeviationP95', 'shearP95', 'shapeDistortionP95', 'screenNorthErrorP95',
  ], 'scoreWeights');
  for (const [key, value] of Object.entries(manifest.scoreWeights)) {
    assertFinite(value, `scoreWeights.${key}`);
    if (value < 0) throw new RangeError(`scoreWeights.${key} must be non-negative`);
  }

  assertExactKeys(manifest.standardLatitudeSweep, [
    'min', 'max', 'step', 'reportCandidates', 'recommendationPolicy',
  ], 'standardLatitudeSweep');
  for (const key of ['min', 'max', 'step']) {
    assertFinite(manifest.standardLatitudeSweep[key], `standardLatitudeSweep.${key}`);
  }
  const sweep = manifest.standardLatitudeSweep;
  const sweepStepCount = (sweep.max - sweep.min) / sweep.step;
  if (sweep.min < -89 || sweep.max > 89 || sweep.min >= sweep.max || sweep.step <= 0
    || Math.abs(sweepStepCount - Math.round(sweepStepCount)) > 1e-9) {
    throw new RangeError('standardLatitudeSweep range must be finite, ordered, and evenly divisible');
  }
  if (!Array.isArray(sweep.reportCandidates) || sweep.reportCandidates.length === 0) {
    throw new TypeError('standardLatitudeSweep.reportCandidates must be non-empty');
  }
  sweep.reportCandidates.forEach((value, index) => {
    assertFinite(value, `standardLatitudeSweep.reportCandidates[${index}]`);
    if (value < sweep.min || value > sweep.max) throw new RangeError('report candidate is outside sweep range');
  });
  if (sweep.recommendationPolicy !== 'minimum-uniform-fixture-score-then-minimax') {
    throw new Error('standard latitude recommendation policy drifted');
  }

  if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length !== 7) {
    throw new Error('the EMEA sweep requires exactly seven validation fixtures');
  }
  const fixtures = manifest.fixtures.map((fixture, index) => {
    const label = `fixtures[${index}]`;
    assertExactKeys(fixture, ['id', 'label', 'bbox', 'weight'], label);
    if (typeof fixture.id !== 'string' || !/^[a-z0-9-]+$/.test(fixture.id)) {
      throw new TypeError(`${label}.id must use lowercase ASCII letters, digits, and hyphens`);
    }
    if (typeof fixture.label !== 'string' || fixture.label.length === 0) {
      throw new TypeError(`${label}.label must be non-empty`);
    }
    const fixtureBbox = normalizeBbox(fixture.bbox, `${label}.bbox`);
    if (fixtureBbox[0] < bbox[0] || fixtureBbox[1] < bbox[1]
      || fixtureBbox[2] > bbox[2] || fixtureBbox[3] > bbox[3]) {
      throw new RangeError(`${label}.bbox must stay inside the region bbox`);
    }
    assertFinite(fixture.weight, `${label}.weight`, { positive: true });
    if (fixture.weight !== 1) {
      throw new Error(`${label}.weight must remain 1 for the uniform seven-fixture score`);
    }
    return Object.freeze({ ...fixture, bbox: fixtureBbox });
  });
  if (new Set(fixtures.map(({ id }) => id)).size !== fixtures.length) {
    throw new Error('fixture IDs must be unique');
  }

  assertExactKeys(manifest.priorBaseline, [
    'sourceCommit', 'reportPath', 'equirectangularStandardLat',
    'sinusoidalScreenAxisPass', 'laeaScreenAxisPass',
  ], 'priorBaseline');
  if (!/^[0-9a-f]{40}$/.test(manifest.priorBaseline.sourceCommit)) {
    throw new TypeError('priorBaseline.sourceCommit must be a full git SHA');
  }
  if (typeof manifest.priorBaseline.reportPath !== 'string'
    || manifest.priorBaseline.reportPath.startsWith('/')
    || manifest.priorBaseline.reportPath.split('/').includes('..')) {
    throw new Error('priorBaseline.reportPath must be repository-relative');
  }
  assertFinite(manifest.priorBaseline.equirectangularStandardLat,
    'priorBaseline.equirectangularStandardLat');
  if (manifest.priorBaseline.sinusoidalScreenAxisPass !== false
    || manifest.priorBaseline.laeaScreenAxisPass !== false) {
    throw new Error('prior non-equirectangular screen-axis failures must remain explicit');
  }

  return Object.freeze({
    ...manifest,
    bbox,
    anchor: Object.freeze({ ...manifest.anchor }),
    axisModes: Object.freeze([...manifest.axisModes]),
    sampleGrid: Object.freeze({ ...manifest.sampleGrid }),
    scoreWeights: Object.freeze({ ...manifest.scoreWeights }),
    standardLatitudeSweep: Object.freeze({
      ...sweep,
      reportCandidates: Object.freeze([...sweep.reportCandidates]),
    }),
    fixtures: Object.freeze(fixtures),
    priorBaseline: Object.freeze({ ...manifest.priorBaseline }),
  });
}

export function linearPercentile(values, probability) {
  if (!Array.isArray(values) || values.length === 0) throw new RangeError('percentile values must be non-empty');
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function summarize(values) {
  return Object.freeze({
    p50: linearPercentile(values, 0.5),
    p95: linearPercentile(values, 0.95),
    max: Math.max(...values),
  });
}

function sampleLatitudes(bbox, rows, offset) {
  const [, minLat, , maxLat] = bbox;
  return Array.from({ length: rows }, (_, row) => (
    minLat + (maxLat - minLat) * ((row + offset) / rows)
  ));
}

export function evaluateEquirectangularStandardLatitude({
  standardLat,
  bbox,
  sampleGrid,
  scoreWeights,
  earthRadiusMeters,
  metersPerTile,
}) {
  const standardCos = Math.cos(standardLat * DEG);
  const latitudes = sampleLatitudes(bbox, sampleGrid.rows, sampleGrid.offset);
  const eastScaleErrorPct = [];
  const shapeDistortionPct = [];
  const areaErrorPct = [];
  for (const latitude of latitudes) {
    const eastScale = standardCos / Math.cos(latitude * DEG);
    for (let column = 0; column < sampleGrid.columns; column += 1) {
      eastScaleErrorPct.push(Math.abs(eastScale - 1) * 100);
      shapeDistortionPct.push((Math.max(eastScale, 1) / Math.min(eastScale, 1) - 1) * 100);
      areaErrorPct.push(Math.abs(eastScale - 1) * 100);
    }
  }
  const metrics = Object.freeze({
    eastScaleErrorPct: summarize(eastScaleErrorPct),
    northScaleErrorPct: summarize(eastScaleErrorPct.map(() => 0)),
    northDeviationDeg: summarize(eastScaleErrorPct.map(() => 0)),
    shearDeg: summarize(eastScaleErrorPct.map(() => 0)),
    shapeDistortionPct: summarize(shapeDistortionPct),
    areaErrorPct: summarize(areaErrorPct),
    screenNorthErrorDeg: summarize(eastScaleErrorPct.map(() => 0)),
    geoAxisHorizontalShare: summarize(eastScaleErrorPct.map(() => 0)),
  });
  const scaleP95 = (metrics.eastScaleErrorPct.p95 + metrics.northScaleErrorPct.p95) / 2;
  const score = scaleP95 * scoreWeights.scaleP95
    + metrics.northDeviationDeg.p95 * scoreWeights.northDeviationP95
    + metrics.shearDeg.p95 * scoreWeights.shearP95
    + metrics.shapeDistortionPct.p95 * scoreWeights.shapeDistortionP95
    + metrics.screenNorthErrorDeg.p95 * scoreWeights.screenNorthErrorP95;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const widthMeters = earthRadiusMeters * (maxLon - minLon) * DEG * standardCos;
  const heightMeters = earthRadiusMeters * (maxLat - minLat) * DEG;
  return Object.freeze({
    standardLat,
    score,
    metrics,
    widthTiles: Math.ceil(widthMeters / metersPerTile),
    heightTiles: Math.ceil(heightMeters / metersPerTile),
  });
}

export function buildEmeaProjectionSweep(manifestInput) {
  const manifest = normalizeProjectionSweepManifest(manifestInput);
  const candidates = [];
  const stepCount = Math.round(
    (manifest.standardLatitudeSweep.max - manifest.standardLatitudeSweep.min)
      / manifest.standardLatitudeSweep.step,
  );
  for (let index = 0; index <= stepCount; index += 1) {
    const standardLat = Number((
      manifest.standardLatitudeSweep.min + index * manifest.standardLatitudeSweep.step
    ).toFixed(9));
    const region = evaluateEquirectangularStandardLatitude({
      standardLat,
      bbox: manifest.bbox,
      sampleGrid: manifest.sampleGrid,
      scoreWeights: manifest.scoreWeights,
      earthRadiusMeters: manifest.earthRadiusMeters,
      metersPerTile: manifest.metersPerTile,
    });
    const fixtures = manifest.fixtures.map((fixture) => Object.freeze({
      id: fixture.id,
      label: fixture.label,
      weight: fixture.weight,
      ...evaluateEquirectangularStandardLatitude({
        standardLat,
        bbox: fixture.bbox,
        sampleGrid: manifest.sampleGrid,
        scoreWeights: manifest.scoreWeights,
        earthRadiusMeters: manifest.earthRadiusMeters,
        metersPerTile: manifest.metersPerTile,
      }),
    }));
    const totalWeight = fixtures.reduce((sum, fixture) => sum + fixture.weight, 0);
    const uniformFixtureScore = fixtures.reduce(
      (sum, fixture) => sum + fixture.score * fixture.weight,
      0,
    ) / totalWeight;
    const maxFixtureScore = Math.max(...fixtures.map(({ score }) => score));
    candidates.push(Object.freeze({
      standardLat,
      region,
      fixtures: Object.freeze(fixtures),
      uniformFixtureScore,
      maxFixtureScore,
      axisModes: Object.freeze({
        screenAxis: Object.freeze({ northErrorDeg: 0, pass: true }),
        geoAxis: Object.freeze({ horizontalShare: 0, pass: true }),
      }),
    }));
  }
  const ranking = [...candidates].sort((left, right) => (
    left.uniformFixtureScore - right.uniformFixtureScore
      || left.maxFixtureScore - right.maxFixtureScore
      || left.standardLat - right.standardLat
  ));
  return Object.freeze({
    manifest,
    candidates: Object.freeze(candidates),
    ranking: Object.freeze(ranking),
    recommendation: ranking[0],
  });
}
