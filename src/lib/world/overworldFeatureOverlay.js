import { OVERWORLD_STORAGE_CHUNK_TILES } from './overworldChunk.js';
import { OVERWORLD_ROUTE_QUANTIZATION } from './overworldOverlay.js';

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const OVERLAY_DOCUMENT_KEYS = new Set([
  'formatVersion', 'kind', 'quantization', 'haloTiles', 'cx', 'cy', 'segments',
]);
const OVERLAY_SEGMENT_KEYS = Object.freeze({
  'river-segments': new Set([
    'id', 'routeId', 'sourceFeatureIndex', 'partIndex', 'segmentIndex',
    'scaleRank', 'start', 'end',
  ]),
  'rail-segments': new Set([
    'id', 'routeId', 'sourceFeatureIndex', 'segmentIndex', 'scaleRank',
    'category', 'electric', 'multiTrack', 'start', 'end',
  ]),
  'boundary-segments': new Set([
    'id', 'routeId', 'sourceKind', 'sourceFeatureIndex', 'partIndex',
    'segmentIndex', 'scaleRank', 'boundaryClass', 'start', 'end',
  ]),
});

function assertKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported field: ${key}`);
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer`);
}

function assertSource(source) {
  for (const key of ['regionId', 'regionHash', 'projectionManifestHash', 'kind', 'pathPrefix']) {
    if (typeof source?.[key] !== 'string' || source[key].length === 0) {
      throw new TypeError(`overlay source ${key} must be a non-empty string`);
    }
  }
  assertPositiveInteger(source.width, 'overlay source width');
  assertPositiveInteger(source.height, 'overlay source height');
}

function normalizeView(worldView) {
  const x = worldView?.x;
  const y = worldView?.y;
  const width = worldView?.width ?? (worldView?.right - x);
  const height = worldView?.height ?? (worldView?.bottom - y);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new RangeError('worldView must provide finite positive bounds');
  }
  return { x, y, width, height };
}

function assertPoint(point, label) {
  if (!Array.isArray(point) || point.length !== 2
    || !point.every((coordinate) => Number.isSafeInteger(coordinate))) {
    throw new TypeError(`${label} must be a safe-integer [x, y] pair`);
  }
}

export function normalizeOverworldOverlayDocument(input, expected = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('overworld overlay document must be an object');
  }
  assertKnownKeys(input, OVERLAY_DOCUMENT_KEYS, 'overworld overlay document');
  if (input.formatVersion !== 1) throw new Error(`unsupported overworld overlay format: ${input.formatVersion}`);
  if (!['river-segments', 'rail-segments', 'boundary-segments'].includes(input.kind)) {
    throw new Error(`unsupported overworld overlay kind: ${input.kind}`);
  }
  if (!Number.isInteger(input.cx) || !Number.isInteger(input.cy) || input.cx < 0 || input.cy < 0) {
    throw new RangeError('overworld overlay chunk coordinates must be non-negative integers');
  }
  if (input.quantization !== OVERWORLD_ROUTE_QUANTIZATION || input.haloTiles !== 1) {
    throw new Error('overworld overlay quantization/halo contract drifted');
  }
  for (const key of ['kind', 'cx', 'cy']) {
    if (expected[key] !== undefined && input[key] !== expected[key]) {
      throw new Error(`overworld overlay ${key} mismatch: ${input[key]} !== ${expected[key]}`);
    }
  }
  if (!Array.isArray(input.segments)) throw new TypeError('overworld overlay segments must be an array');
  const seen = new Set();
  for (let index = 0; index < input.segments.length; index += 1) {
    const segment = input.segments[index];
    if (!segment || typeof segment !== 'object') throw new TypeError(`segments[${index}] must be an object`);
    assertKnownKeys(segment, OVERLAY_SEGMENT_KEYS[input.kind], `segments[${index}]`);
    if (typeof segment.id !== 'string' || segment.id.length === 0 || seen.has(segment.id)) {
      throw new Error(`segments[${index}].id must be unique and non-empty`);
    }
    seen.add(segment.id);
    assertPoint(segment.start, `segments[${index}].start`);
    assertPoint(segment.end, `segments[${index}].end`);
    if (segment.start[0] === segment.end[0] && segment.start[1] === segment.end[1]) {
      throw new Error(`segments[${index}] has zero length`);
    }
    if (!Number.isInteger(segment.scaleRank) || segment.scaleRank < 0) {
      throw new RangeError(`segments[${index}].scaleRank must be non-negative`);
    }
    if (input.kind === 'boundary-segments') {
      if (!['land', 'disputed'].includes(segment.sourceKind)) {
        throw new Error(`segments[${index}].sourceKind is unsupported`);
      }
      if (!['de-facto', 'neutral-disputed'].includes(segment.boundaryClass)) {
        throw new Error(`segments[${index}].boundaryClass is unsupported`);
      }
    }
  }
  return Object.freeze({ ...input, segments: Object.freeze([...input.segments]) });
}

export function overlayChunkCoordinatesForWorldView(worldView, {
  worldScale = 2,
  tilePixels = 16,
  width,
  height,
  paddingChunks = 0,
} = {}) {
  if (!Number.isFinite(worldScale) || worldScale <= 0) throw new RangeError('worldScale must be positive');
  assertPositiveInteger(tilePixels, 'tilePixels');
  assertPositiveInteger(width, 'width');
  assertPositiveInteger(height, 'height');
  if (!Number.isInteger(paddingChunks) || paddingChunks < 0) {
    throw new RangeError('paddingChunks must be a non-negative integer');
  }
  const view = normalizeView(worldView);
  const tileWorldPixels = tilePixels * worldScale;
  const maxCx = Math.ceil(width / OVERWORLD_STORAGE_CHUNK_TILES) - 1;
  const maxCy = Math.ceil(height / OVERWORLD_STORAGE_CHUNK_TILES) - 1;
  const x0 = Math.max(0, Math.floor(view.x / tileWorldPixels / OVERWORLD_STORAGE_CHUNK_TILES) - paddingChunks);
  const y0 = Math.max(0, Math.floor(view.y / tileWorldPixels / OVERWORLD_STORAGE_CHUNK_TILES) - paddingChunks);
  const x1 = Math.min(maxCx, Math.floor((view.x + view.width - 1) / tileWorldPixels / OVERWORLD_STORAGE_CHUNK_TILES) + paddingChunks);
  const y1 = Math.min(maxCy, Math.floor((view.y + view.height - 1) / tileWorldPixels / OVERWORLD_STORAGE_CHUNK_TILES) + paddingChunks);
  const coordinates = [];
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) coordinates.push(Object.freeze({ cx, cy }));
  }
  return Object.freeze(coordinates);
}

export function visibleOverworldOverlaySegments(documents, worldView, {
  worldScale = 2,
  tilePixels = 16,
  haloTiles = 1,
} = {}) {
  const view = normalizeView(worldView);
  const tileWorldPixels = tilePixels * worldScale;
  const x0 = Math.floor((view.x / tileWorldPixels - haloTiles) * OVERWORLD_ROUTE_QUANTIZATION);
  const y0 = Math.floor((view.y / tileWorldPixels - haloTiles) * OVERWORLD_ROUTE_QUANTIZATION);
  const x1 = Math.ceil(((view.x + view.width) / tileWorldPixels + haloTiles) * OVERWORLD_ROUTE_QUANTIZATION);
  const y1 = Math.ceil(((view.y + view.height) / tileWorldPixels + haloTiles) * OVERWORLD_ROUTE_QUANTIZATION);
  const unique = new Map();
  for (const document of documents || []) {
    for (const segment of document?.segments || []) {
      const sx0 = Math.min(segment.start[0], segment.end[0]);
      const sy0 = Math.min(segment.start[1], segment.end[1]);
      const sx1 = Math.max(segment.start[0], segment.end[0]);
      const sy1 = Math.max(segment.start[1], segment.end[1]);
      if (sx1 < x0 || sx0 > x1 || sy1 < y0 || sy0 > y1) continue;
      if (!unique.has(segment.id)) unique.set(segment.id, segment);
    }
  }
  return Object.freeze([...unique.values()].sort((left, right) => compareText(left.id, right.id)));
}

export class OverworldFeatureOverlayLoader {
  constructor({ baseUrl = '/assets/overworld', source, fetchImpl = globalThis.fetch, maxDocuments = 12 } = {}) {
    if (typeof baseUrl !== 'string' || baseUrl.length === 0) throw new TypeError('baseUrl must be non-empty');
    assertSource(source);
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
    this.allDocuments = null;
    this.allPromise = null;
    this.controllers = new Set();
    this.destroyed = false;
  }

  url(path) { return `${this.baseUrl}/${this.source.regionId}/${path}`; }

  async loadManifest() {
    if (this.destroyed) throw new Error('overworld overlay loader is destroyed');
    if (this.availablePaths) return this.availablePaths;
    if (this.manifestPromise) return this.manifestPromise;
    const controller = new AbortController();
    this.controllers.add(controller);
    this.manifestPromise = this.fetchImpl(this.url('content-manifest.json'), {
      signal: controller.signal,
      cache: 'force-cache',
      credentials: 'same-origin',
    }).then(async (response) => {
      if (!response?.ok) throw new Error(`overworld overlay manifest fetch failed: ${response?.status ?? 'unknown'}`);
      const manifest = await response.json();
      for (const key of ['regionId', 'regionHash', 'projectionManifestHash', 'width', 'height']) {
        if (manifest?.[key] !== this.source[key]) {
          throw new Error(`overworld overlay manifest ${key} mismatch`);
        }
      }
      if (!Array.isArray(manifest.overlays)) throw new TypeError('overworld overlay manifest overlays must be an array');
      const paths = new Set();
      for (const overlay of manifest.overlays) {
        if (typeof overlay?.path !== 'string' || !overlay.path.startsWith(`${this.source.pathPrefix}/`)) {
          throw new Error('overworld overlay manifest contains an invalid path');
        }
        paths.add(overlay.path);
      }
      if (this.destroyed) throw new Error('overworld overlay loader is destroyed');
      this.availablePaths = paths;
      return paths;
    }).finally(() => {
      this.controllers.delete(controller);
      this.manifestPromise = null;
    });
    return this.manifestPromise;
  }

  touch(key, document) {
    this.documents.delete(key);
    this.documents.set(key, document);
    while (this.documents.size > this.maxDocuments) this.documents.delete(this.documents.keys().next().value);
  }

  async load(cx, cy) {
    if (this.destroyed) throw new Error('overworld overlay loader is destroyed');
    if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cy < 0) {
      throw new RangeError('overlay chunk coordinates must be non-negative integers');
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
      if (!response?.ok) throw new Error(`overworld overlay fetch failed: ${response?.status ?? 'unknown'}`);
      const document = normalizeOverworldOverlayDocument(await response.json(), {
        kind: this.source.kind,
        cx,
        cy,
      });
      if (this.destroyed) throw new Error('overworld overlay loader is destroyed');
      this.touch(path, document);
      return document;
    }).finally(() => {
      this.controllers.delete(controller);
      this.inflight.delete(path);
    });
    this.inflight.set(path, pending);
    return pending;
  }

  async loadAll() {
    if (this.destroyed) throw new Error('overworld overlay loader is destroyed');
    if (this.allDocuments) return this.allDocuments;
    if (this.allPromise) return this.allPromise;
    this.allPromise = (async () => {
      const prefix = `${this.source.pathPrefix}/`;
      const paths = [...await this.loadManifest()].sort(compareText);
      const coordinates = paths.map((path) => {
        const parts = path.slice(prefix.length).split('/');
        const file = parts[1];
        if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+\.json$/.test(file || '')) {
          throw new Error(`overworld overlay manifest path is not a chunk: ${path}`);
        }
        return Object.freeze({
          cx: Number(parts[0]),
          cy: Number(file.slice(0, -5)),
        });
      });
      const documents = await Promise.all(coordinates.map(({ cx, cy }) => this.load(cx, cy)));
      if (this.destroyed) throw new Error('overworld overlay loader is destroyed');
      if (documents.some((document) => !document)) {
        throw new Error('overworld overlay manifest path disappeared while loading all chunks');
      }
      this.allDocuments = Object.freeze(documents);
      return this.allDocuments;
    })().finally(() => {
      this.allPromise = null;
    });
    return this.allPromise;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.documents.clear();
    this.inflight.clear();
    this.availablePaths = null;
    this.allDocuments = null;
    this.allPromise = null;
  }
}
