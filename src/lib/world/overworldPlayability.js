const SHA256_HEX = /^[0-9a-f]{64}$/;

const MANIFEST_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'generatorGitSha',
  'regionId',
  'baseTerrain',
  'terrainClasses',
  'componentRules',
  'policyAnchors',
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

function assertRelativePath(value, label) {
  if (typeof value !== 'string' || value.length === 0
    || value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) {
    throw new Error(`${label} must be a repository-relative POSIX path`);
  }
}

function normalizeBaseTerrain(baseTerrain) {
  assertExactKeys(baseTerrain, [
    'manifestPath', 'directory', 'contentManifest', 'contentManifestSha256', 'contentManifestBytes',
  ], 'baseTerrain');
  for (const key of ['manifestPath', 'directory', 'contentManifest']) {
    assertRelativePath(baseTerrain[key], `baseTerrain.${key}`);
  }
  if (!SHA256_HEX.test(baseTerrain.contentManifestSha256)) {
    throw new TypeError('baseTerrain.contentManifestSha256 must be lowercase SHA-256 hex');
  }
  assertInteger(baseTerrain.contentManifestBytes, 'baseTerrain.contentManifestBytes', { min: 1 });
  return Object.freeze({ ...baseTerrain });
}

function normalizeTerrainClasses(classes) {
  assertExactKeys(classes, ['sea', 'lowland', 'highland', 'mountain', 'alpine'], 'terrainClasses');
  const values = Object.values(classes);
  values.forEach((value, index) => assertInteger(value, `terrainClasses[${index}]`, { min: 0, max: 15 }));
  if (classes.sea !== 0 || new Set(values).size !== values.length) {
    throw new Error('terrainClasses must be unique and keep sea=0');
  }
  return Object.freeze({ ...classes });
}

function normalizeRules(rules) {
  assertExactKeys(rules, [
    'connectivity', 'minimumWalkableTiles', 'seaCollision', 'seaViewOnly', 'smallIsland',
    'remoteOverride', 'anchorSnapMaxTiles',
  ], 'componentRules');
  if (rules.connectivity !== 4) throw new Error('componentRules.connectivity must remain 4');
  assertInteger(rules.minimumWalkableTiles, 'componentRules.minimumWalkableTiles', { min: 1 });
  assertInteger(rules.anchorSnapMaxTiles, 'componentRules.anchorSnapMaxTiles', { min: 0, max: 32 });
  if (rules.seaCollision !== 'blocked' || rules.seaViewOnly !== false
    || rules.smallIsland !== 'view-only' || rules.remoteOverride !== 'view-only') {
    throw new Error('componentRules policy contract drifted');
  }
  return Object.freeze({ ...rules });
}

function normalizeAnchor(anchor, index, defaultSnap) {
  const label = `policyAnchors[${index}]`;
  assertExactKeys(anchor, ['id', 'lon', 'lat', 'policy', 'maxSnapTiles'], label);
  if (typeof anchor.id !== 'string' || !/^[a-z0-9-]+$/.test(anchor.id)) {
    throw new TypeError(`${label}.id must use lowercase ASCII letters, digits, and hyphens`);
  }
  assertFinite(anchor.lon, `${label}.lon`);
  assertFinite(anchor.lat, `${label}.lat`);
  if (anchor.lat < -90 || anchor.lat > 90) throw new RangeError(`${label}.lat is outside WGS84 latitude`);
  if (anchor.policy !== 'walkable' && anchor.policy !== 'view-only') {
    throw new Error(`${label}.policy must be walkable or view-only`);
  }
  assertInteger(anchor.maxSnapTiles, `${label}.maxSnapTiles`, { min: 0, max: defaultSnap });
  return Object.freeze({ ...anchor });
}

export function normalizeOverworldPlayabilityManifest(manifest) {
  assertExactKeys(manifest, MANIFEST_KEYS, 'playability manifest');
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
  const baseTerrain = normalizeBaseTerrain(manifest.baseTerrain);
  const terrainClasses = normalizeTerrainClasses(manifest.terrainClasses);
  const componentRules = normalizeRules(manifest.componentRules);
  if (!Array.isArray(manifest.policyAnchors)) throw new TypeError('policyAnchors must be an array');
  const policyAnchors = manifest.policyAnchors.map((anchor, index) => (
    normalizeAnchor(anchor, index, componentRules.anchorSnapMaxTiles)
  ));
  const ids = policyAnchors.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error('policyAnchors IDs must be unique');
  return Object.freeze({
    ...manifest,
    baseTerrain,
    terrainClasses,
    componentRules,
    policyAnchors: Object.freeze(policyAnchors),
  });
}

export function labelLandComponents({ width, height, surfaces, seaSurface = 0 }) {
  assertInteger(width, 'width', { min: 1 });
  assertInteger(height, 'height', { min: 1 });
  if (!(surfaces instanceof Uint8Array) || surfaces.length !== width * height) {
    throw new TypeError('surfaces must be a width*height Uint8Array');
  }
  const labels = new Int32Array(surfaces.length);
  const queue = new Int32Array(surfaces.length);
  const components = [];
  let nextId = 0;

  for (let start = 0; start < surfaces.length; start += 1) {
    if (surfaces[start] === seaSurface || labels[start] !== 0) continue;
    const id = ++nextId;
    let read = 0;
    let write = 1;
    let tileCount = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    queue[0] = start;
    labels[start] = id;
    while (read < write) {
      const index = queue[read++];
      const x = index % width;
      const y = (index - x) / width;
      tileCount += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const left = index - 1;
      if (x > 0 && surfaces[left] !== seaSurface && labels[left] === 0) {
        labels[left] = id;
        queue[write++] = left;
      }
      const right = index + 1;
      if (x + 1 < width && surfaces[right] !== seaSurface && labels[right] === 0) {
        labels[right] = id;
        queue[write++] = right;
      }
      const top = index - width;
      if (y > 0 && surfaces[top] !== seaSurface && labels[top] === 0) {
        labels[top] = id;
        queue[write++] = top;
      }
      const bottom = index + width;
      if (y + 1 < height && surfaces[bottom] !== seaSurface && labels[bottom] === 0) {
        labels[bottom] = id;
        queue[write++] = bottom;
      }
    }
    components.push(Object.freeze({
      id,
      tileCount,
      bounds: Object.freeze({ x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1 }),
    }));
  }
  return Object.freeze({ labels, components: Object.freeze(components) });
}

function nearestLandTile({ x, y, width, height, labels, maxSnapTiles }) {
  const centerX = Math.floor(x);
  const centerY = Math.floor(y);
  const candidates = [];
  for (let dy = -maxSnapTiles; dy <= maxSnapTiles; dy += 1) {
    for (let dx = -maxSnapTiles; dx <= maxSnapTiles; dx += 1) {
      const tileX = centerX + dx;
      const tileY = centerY + dy;
      if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) continue;
      const componentId = labels[tileY * width + tileX];
      if (componentId === 0) continue;
      candidates.push({ tileX, tileY, componentId, distanceSquared: dx * dx + dy * dy });
    }
  }
  candidates.sort((left, right) => left.distanceSquared - right.distanceSquared
    || left.tileY - right.tileY || left.tileX - right.tileX);
  return candidates[0] ?? null;
}

export function resolvePolicyAnchors({ frame, labels, anchors }) {
  const resolved = anchors.map((anchor) => {
    const projected = frame.project(anchor.lon, anchor.lat);
    const result = nearestLandTile({
      x: projected.x,
      y: projected.y,
      width: frame.width,
      height: frame.height,
      labels,
      maxSnapTiles: anchor.maxSnapTiles,
    });
    if (!result) throw new Error(`policy anchor ${anchor.id} could not resolve to land`);
    return Object.freeze({
      id: anchor.id,
      lon: anchor.lon,
      lat: anchor.lat,
      policy: anchor.policy,
      tileX: result.tileX,
      tileY: result.tileY,
      componentId: result.componentId,
      snapDistanceSquared: result.distanceSquared,
    });
  });
  return Object.freeze(resolved);
}

export function classifyPlayabilityComponents({ components, resolvedAnchors, minimumWalkableTiles }) {
  const anchorPolicies = new Map();
  for (const anchor of resolvedAnchors) {
    const policies = anchorPolicies.get(anchor.componentId) ?? new Set();
    policies.add(anchor.policy);
    anchorPolicies.set(anchor.componentId, policies);
  }
  const policies = new Uint8Array(components.length + 1);
  const classified = components.map((component) => {
    const overrides = anchorPolicies.get(component.id) ?? new Set();
    if (overrides.size > 1) {
      const anchors = resolvedAnchors.filter(({ componentId }) => componentId === component.id)
        .map(({ id, policy }) => `${id}:${policy}`).join(', ');
      throw new Error(`component ${component.id} has conflicting policy anchors: ${anchors}`);
    }
    const policy = overrides.has('view-only')
      ? 'view-only'
      : overrides.has('walkable') || component.tileCount >= minimumWalkableTiles
        ? 'walkable'
        : 'view-only';
    policies[component.id] = policy === 'walkable' ? 1 : 2;
    return Object.freeze({ ...component, policy });
  });
  return Object.freeze({ policies, components: Object.freeze(classified) });
}

export function derivePlayability({ frame, surfaces, manifest: manifestInput }) {
  const manifest = normalizeOverworldPlayabilityManifest(manifestInput);
  const labeled = labelLandComponents({
    width: frame.width,
    height: frame.height,
    surfaces,
    seaSurface: manifest.terrainClasses.sea,
  });
  const resolvedAnchors = resolvePolicyAnchors({
    frame,
    labels: labeled.labels,
    anchors: manifest.policyAnchors,
  });
  const classified = classifyPlayabilityComponents({
    components: labeled.components,
    resolvedAnchors,
    minimumWalkableTiles: manifest.componentRules.minimumWalkableTiles,
  });
  let seaTileCount = 0;
  let walkableLandTileCount = 0;
  let viewOnlyLandTileCount = 0;
  for (let index = 0; index < surfaces.length; index += 1) {
    const componentId = labeled.labels[index];
    if (componentId === 0) seaTileCount += 1;
    else if (classified.policies[componentId] === 1) walkableLandTileCount += 1;
    else viewOnlyLandTileCount += 1;
  }
  const collisionAtIndex = (index) => {
    const componentId = labeled.labels[index];
    return componentId === 0 || classified.policies[componentId] === 2 ? 1 : 0;
  };
  const viewOnlyAtIndex = (index) => {
    const componentId = labeled.labels[index];
    return componentId !== 0 && classified.policies[componentId] === 2 ? 1 : 0;
  };
  return Object.freeze({
    labels: labeled.labels,
    componentPolicies: classified.policies,
    components: classified.components,
    resolvedAnchors,
    collisionAtIndex,
    viewOnlyAtIndex,
    counts: Object.freeze({
      totalTileCount: surfaces.length,
      seaTileCount,
      landTileCount: surfaces.length - seaTileCount,
      walkableLandTileCount,
      viewOnlyLandTileCount,
      componentCount: classified.components.length,
      walkableComponentCount: classified.components.filter(({ policy }) => policy === 'walkable').length,
      viewOnlyComponentCount: classified.components.filter(({ policy }) => policy === 'view-only').length,
    }),
  });
}
