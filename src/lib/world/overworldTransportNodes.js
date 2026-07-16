import { OVERWORLD_STORAGE_CHUNK_TILES } from './overworldChunk.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[a-z0-9-]+$/;
const MANIFEST_KEYS = Object.freeze([
  'schemaVersion',
  'releaseEligible',
  'generatorGitSha',
  'regionId',
  'baseRegion',
  'nodeRules',
  'nodes',
]);
const BASE_REGION_KEYS = Object.freeze([
  'manifestPath',
  'directory',
  'contentManifest',
  'contentManifestSha256',
  'contentManifestBytes',
]);
const SOURCE_NODE_KEYS = Object.freeze([
  'id', 'type', 'label', 'corridorStopId', 'lon', 'lat',
]);
const DOCUMENT_KEYS = Object.freeze(['formatVersion', 'kind', 'cx', 'cy', 'nodes']);
const DOCUMENT_NODE_KEYS = Object.freeze([
  'id', 'type', 'label', 'corridorStopId', 'tile',
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
    throw new Error(`${label} keys must be exactly: ${wanted.join(', ')}`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function assertSafeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new TypeError(`${label} must use lowercase ASCII letters, digits, and hyphens`);
  }
}

function normalizeBaseRegion(value) {
  assertExactKeys(value, BASE_REGION_KEYS, 'baseRegion');
  for (const key of ['manifestPath', 'directory', 'contentManifest']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new TypeError(`baseRegion.${key} must be a non-empty string`);
    }
  }
  if (!SHA256_HEX.test(value.contentManifestSha256)) {
    throw new TypeError('baseRegion.contentManifestSha256 must be lowercase SHA-256 hex');
  }
  assertPositiveInteger(value.contentManifestBytes, 'baseRegion.contentManifestBytes');
  return Object.freeze({ ...value });
}

function normalizeSourceNode(value, index) {
  const label = `nodes[${index}]`;
  assertExactKeys(value, SOURCE_NODE_KEYS, label);
  assertSafeId(value.id, `${label}.id`);
  if (value.type !== 'transsib-gate') throw new Error(`${label}.type must be transsib-gate`);
  if (typeof value.label !== 'string' || value.label.length === 0) {
    throw new TypeError(`${label}.label must be a non-empty string`);
  }
  assertSafeId(value.corridorStopId, `${label}.corridorStopId`);
  if (!Number.isFinite(value.lon) || value.lon < -180 || value.lon > 180) {
    throw new RangeError(`${label}.lon must be between -180 and 180`);
  }
  if (!Number.isFinite(value.lat) || value.lat < -90 || value.lat > 90) {
    throw new RangeError(`${label}.lat must be between -90 and 90`);
  }
  return Object.freeze({ ...value });
}

export function normalizeOverworldTransportNodeManifest(input) {
  assertExactKeys(input, MANIFEST_KEYS, 'transport node manifest');
  if (input.schemaVersion !== 1) throw new Error('transport node schemaVersion must be 1');
  if (input.releaseEligible !== false) throw new Error('transport node preview must remain releaseEligible=false');
  if (input.generatorGitSha !== null
    && (typeof input.generatorGitSha !== 'string' || !/^[0-9a-f]{40}$/.test(input.generatorGitSha))) {
    throw new Error('generatorGitSha must be null or a full lowercase git SHA');
  }
  assertSafeId(input.regionId, 'regionId');
  assertExactKeys(input.nodeRules, ['chunkTiles'], 'nodeRules');
  if (input.nodeRules.chunkTiles !== OVERWORLD_STORAGE_CHUNK_TILES) {
    throw new Error(`nodeRules.chunkTiles must remain ${OVERWORLD_STORAGE_CHUNK_TILES}`);
  }
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    throw new Error('transport node manifest requires at least one node');
  }
  const nodes = input.nodes.map(normalizeSourceNode);
  const ids = new Set();
  const stops = new Set();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`duplicate transport node id: ${node.id}`);
    if (stops.has(node.corridorStopId)) {
      throw new Error(`duplicate transport corridor stop: ${node.corridorStopId}`);
    }
    ids.add(node.id);
    stops.add(node.corridorStopId);
  }
  return Object.freeze({
    ...input,
    baseRegion: normalizeBaseRegion(input.baseRegion),
    nodeRules: Object.freeze({ ...input.nodeRules }),
    nodes: Object.freeze(nodes),
  });
}

function normalizeDocumentNode(value, index, expected) {
  const label = `nodes[${index}]`;
  assertExactKeys(value, DOCUMENT_NODE_KEYS, label);
  assertSafeId(value.id, `${label}.id`);
  if (value.type !== 'transsib-gate') throw new Error(`${label}.type must be transsib-gate`);
  if (typeof value.label !== 'string' || value.label.length === 0) {
    throw new TypeError(`${label}.label must be a non-empty string`);
  }
  assertSafeId(value.corridorStopId, `${label}.corridorStopId`);
  if (!Array.isArray(value.tile) || value.tile.length !== 2
    || !value.tile.every(Number.isSafeInteger)) {
    throw new TypeError(`${label}.tile must be a safe-integer [x, y] pair`);
  }
  const [x, y] = value.tile;
  if (x < 0 || y < 0 || x >= expected.width || y >= expected.height) {
    throw new RangeError(`${label}.tile is outside the region bounds`);
  }
  if (Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES) !== expected.cx
    || Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES) !== expected.cy) {
    throw new Error(`${label}.tile does not belong to document chunk`);
  }
  return Object.freeze({ ...value, tile: Object.freeze([...value.tile]) });
}

export function normalizeOverworldTransportNodeDocument(input, expected = {}) {
  assertExactKeys(input, DOCUMENT_KEYS, 'transport node document');
  if (input.formatVersion !== 1 || input.kind !== 'transport-nodes') {
    throw new Error('unsupported transport node document format');
  }
  for (const key of ['cx', 'cy']) {
    if (!Number.isSafeInteger(input[key]) || input[key] < 0) {
      throw new RangeError(`transport node document ${key} must be a non-negative integer`);
    }
    if (expected[key] !== undefined && input[key] !== expected[key]) {
      throw new Error(`transport node document ${key} mismatch`);
    }
  }
  assertPositiveInteger(expected.width, 'expected.width');
  assertPositiveInteger(expected.height, 'expected.height');
  if (!Array.isArray(input.nodes)) throw new TypeError('transport node document nodes must be an array');
  const ids = new Set();
  const nodes = input.nodes.map((node, index) => {
    const normalized = normalizeDocumentNode(node, index, {
      ...expected,
      cx: input.cx,
      cy: input.cy,
    });
    if (ids.has(normalized.id)) throw new Error(`duplicate transport node id: ${normalized.id}`);
    ids.add(normalized.id);
    return normalized;
  });
  return Object.freeze({ ...input, nodes: Object.freeze(nodes) });
}

function assertNodeSource(source) {
  for (const key of ['regionId', 'regionHash', 'projectionManifestHash', 'pathPrefix']) {
    if (typeof source?.[key] !== 'string' || source[key].length === 0) {
      throw new TypeError(`transport node source ${key} must be a non-empty string`);
    }
  }
  if (!SHA256_HEX.test(source.regionHash) || !SHA256_HEX.test(source.projectionManifestHash)) {
    throw new TypeError('transport node source hashes must be lowercase SHA-256 hex');
  }
  assertPositiveInteger(source.width, 'transport node source width');
  assertPositiveInteger(source.height, 'transport node source height');
}

export class OverworldTransportNodeLoader {
  constructor({ baseUrl = '/assets/overworld', source, fetchImpl = globalThis.fetch, maxDocuments = 8 } = {}) {
    if (typeof baseUrl !== 'string' || baseUrl.length === 0) throw new TypeError('baseUrl must be non-empty');
    assertNodeSource(source);
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    assertPositiveInteger(maxDocuments, 'maxDocuments');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.source = Object.freeze({ ...source });
    this.fetchImpl = fetchImpl === globalThis.fetch ? fetchImpl.bind(globalThis) : fetchImpl;
    this.maxDocuments = maxDocuments;
    this.documents = new Map();
    this.inflight = new Map();
    this.availablePaths = null;
    this.manifestPromise = null;
    this.controllers = new Set();
    this.destroyed = false;
  }

  url(path) { return `${this.baseUrl}/${this.source.regionId}/${path}`; }

  async loadManifest() {
    if (this.destroyed) throw new Error('transport node loader is destroyed');
    if (this.availablePaths) return this.availablePaths;
    if (this.manifestPromise) return this.manifestPromise;
    const controller = new AbortController();
    this.controllers.add(controller);
    this.manifestPromise = this.fetchImpl(this.url('content-manifest.json'), {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'same-origin',
    }).then(async (response) => {
      if (!response?.ok) throw new Error(`transport node manifest fetch failed: ${response?.status ?? 'unknown'}`);
      const manifest = await response.json();
      for (const key of ['regionId', 'regionHash', 'projectionManifestHash', 'width', 'height']) {
        if (manifest?.[key] !== this.source[key]) throw new Error(`transport node manifest ${key} mismatch`);
      }
      if (!Array.isArray(manifest.nodes)) throw new TypeError('transport node manifest nodes must be an array');
      const paths = new Set();
      for (const entry of manifest.nodes) {
        if (typeof entry?.path !== 'string' || !entry.path.startsWith(`${this.source.pathPrefix}/`)) {
          throw new Error('transport node manifest contains an invalid path');
        }
        paths.add(entry.path);
      }
      if (this.destroyed) throw new Error('transport node loader is destroyed');
      this.availablePaths = paths;
      return paths;
    }).finally(() => {
      this.controllers.delete(controller);
      this.manifestPromise = null;
    });
    return this.manifestPromise;
  }

  touch(path, document) {
    this.documents.delete(path);
    this.documents.set(path, document);
    while (this.documents.size > this.maxDocuments) this.documents.delete(this.documents.keys().next().value);
  }

  async load(cx, cy) {
    if (this.destroyed) throw new Error('transport node loader is destroyed');
    if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy) || cx < 0 || cy < 0) {
      throw new RangeError('transport node chunk coordinates must be non-negative integers');
    }
    const path = `${this.source.pathPrefix}/${cx}/${cy}.json`;
    const available = await this.loadManifest();
    if (!available.has(path)) return null;
    const cached = this.documents.get(path);
    if (cached) {
      this.touch(path, cached);
      return cached;
    }
    if (this.inflight.has(path)) return this.inflight.get(path);
    const controller = new AbortController();
    this.controllers.add(controller);
    const pending = this.fetchImpl(this.url(path), {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'same-origin',
    }).then(async (response) => {
      if (!response?.ok) throw new Error(`transport node fetch failed: ${response?.status ?? 'unknown'}`);
      const document = normalizeOverworldTransportNodeDocument(await response.json(), {
        cx,
        cy,
        width: this.source.width,
        height: this.source.height,
      });
      if (this.destroyed) throw new Error('transport node loader is destroyed');
      this.touch(path, document);
      return document;
    }).finally(() => {
      this.controllers.delete(controller);
      this.inflight.delete(path);
    });
    this.inflight.set(path, pending);
    return pending;
  }

  async loadAtTile(x, y) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0
      || x >= this.source.width || y >= this.source.height) return Object.freeze([]);
    const document = await this.load(
      Math.floor(x / OVERWORLD_STORAGE_CHUNK_TILES),
      Math.floor(y / OVERWORLD_STORAGE_CHUNK_TILES),
    );
    return Object.freeze((document?.nodes || []).filter((node) => node.tile[0] === x && node.tile[1] === y));
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.documents.clear();
    this.inflight.clear();
    this.availablePaths = null;
  }
}
