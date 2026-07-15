import {
  OVERWORLD_CHUNK_FILE_BYTES,
  OVERWORLD_CHUNK_FORMAT_VERSION,
  decodeOverworldChunkV1,
} from './overworldChunk.js';

const SAFE_REGION_ID = /^[a-z0-9][a-z0-9-]*$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer`);
}

function assertCoordinate(value, label) {
  if (!Number.isSafeInteger(value) || value < -0x80000000 || value > 0x7fffffff) {
    throw new RangeError(`${label} must be a safe integer in the signed 32-bit range`);
  }
}

function normalizeRoot(baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) throw new TypeError('baseUrl must be a non-empty string');
  return baseUrl.replace(/\/+$/, '');
}

function normalizeManifest(config) {
  const regionId = config?.regionId;
  const schemaVersion = config?.schemaVersion;
  const regionHash = config?.regionHash;
  const projectionManifestHash = config?.projectionManifestHash;
  if (typeof regionId !== 'string' || !SAFE_REGION_ID.test(regionId)) {
    throw new Error(`invalid overworld region id: ${regionId}`);
  }
  assertPositiveInteger(schemaVersion, 'schemaVersion');
  if (typeof regionHash !== 'string' || !SHA256_HEX.test(regionHash)) {
    throw new Error('regionHash must be a lowercase SHA-256 hex string');
  }
  if (typeof projectionManifestHash !== 'string' || !SHA256_HEX.test(projectionManifestHash)) {
    throw new Error('projectionManifestHash must be a lowercase SHA-256 hex string');
  }
  return Object.freeze({ regionId, schemaVersion, regionHash, projectionManifestHash });
}

export function overworldChunkKey(cx, cy) {
  assertCoordinate(cx, 'cx');
  assertCoordinate(cy, 'cy');
  return `${cx},${cy}`;
}

export function overworldChunkUrl(baseUrl, regionId, cx, cy) {
  const root = normalizeRoot(baseUrl);
  if (typeof regionId !== 'string' || !SAFE_REGION_ID.test(regionId)) {
    throw new Error(`invalid overworld region id: ${regionId}`);
  }
  return `${root}/${regionId}/${overworldChunkKey(cx, cy).replace(',', '/')}.owc`;
}

export class PackedChunkCache {
  constructor({ maxEntries = 32, maxBytes = 32 * OVERWORLD_CHUNK_FILE_BYTES } = {}) {
    assertPositiveInteger(maxEntries, 'maxEntries');
    assertPositiveInteger(maxBytes, 'maxBytes');
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.entries = new Map();
    this.totalBytes = 0;
  }

  get size() { return this.entries.size; }

  get byteLength() { return this.totalBytes; }

  has(key) { return this.entries.has(key); }

  keys() { return [...this.entries.keys()]; }

  peek(key) { return this.entries.get(key)?.value; }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, byteLength = OVERWORLD_CHUNK_FILE_BYTES) {
    assertPositiveInteger(byteLength, 'byteLength');
    const previous = this.entries.get(key);
    if (previous) {
      this.totalBytes -= previous.byteLength;
      this.entries.delete(key);
    }
    this.entries.set(key, { value, byteLength });
    this.totalBytes += byteLength;
    this.evictToLimits();
    return value;
  }

  delete(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.totalBytes -= entry.byteLength;
    return true;
  }

  clear() {
    this.entries.clear();
    this.totalBytes = 0;
  }

  evictToLimits() {
    while (this.entries.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }
}

export class OverworldChunkStaleError extends Error {
  constructor() {
    super('overworld chunk request belongs to a stale generation');
    this.name = 'OverworldChunkStaleError';
    this.code = 'OVERWORLD_CHUNK_STALE';
  }
}

export class OverworldChunkLoader {
  constructor({
    baseUrl,
    manifest,
    fetchImpl = globalThis.fetch,
    cache = new PackedChunkCache(),
  }) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
    if (!(cache instanceof PackedChunkCache)) throw new TypeError('cache must be a PackedChunkCache');
    this.baseUrl = normalizeRoot(baseUrl);
    this.manifest = normalizeManifest(manifest);
    this.fetchImpl = fetchImpl === globalThis.fetch ? fetchImpl.bind(globalThis) : fetchImpl;
    this.cache = cache;
    this.inflight = new Map();
    this.generation = 1;
    this.destroyed = false;
  }

  get pendingCount() { return this.inflight.size; }

  get cacheSize() { return this.cache.size; }

  get cacheBytes() { return this.cache.byteLength; }

  load(cx, cy) {
    if (this.destroyed) return Promise.reject(new Error('overworld chunk loader is destroyed'));
    const coordinateKey = overworldChunkKey(cx, cy);
    const requestKey = `${this.generation}:${coordinateKey}`;
    const cached = this.cache.get(requestKey);
    if (cached) return Promise.resolve(cached);
    const pending = this.inflight.get(requestKey);
    if (pending) return pending.promise;

    const generation = this.generation;
    const manifest = this.manifest;
    const controller = new AbortController();
    const execute = async () => {
      try {
        const response = await this.fetchImpl(
          overworldChunkUrl(this.baseUrl, manifest.regionId, cx, cy),
          { signal: controller.signal, cache: 'force-cache', credentials: 'same-origin' },
        );
        if (!response?.ok) {
          throw new Error(`overworld chunk fetch failed: ${response?.status ?? 'unknown'}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        this.assertCurrent(generation);
        const decoded = decodeOverworldChunkV1(bytes, {
          expected: {
            schemaVersion: manifest.schemaVersion,
            cx,
            cy,
            regionHash: manifest.regionHash,
            projectionManifestHash: manifest.projectionManifestHash,
          },
        });
        this.assertCurrent(generation);
        this.cache.set(requestKey, decoded, bytes.byteLength);
        return decoded;
      } catch (error) {
        if (generation !== this.generation || this.destroyed) throw new OverworldChunkStaleError();
        throw error;
      }
    };
    const promise = execute();
    const entry = { promise, controller, generation };
    this.inflight.set(requestKey, entry);
    const cleanup = () => {
      if (this.inflight.get(requestKey) === entry) this.inflight.delete(requestKey);
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  reset(manifest = this.manifest) {
    if (this.destroyed) throw new Error('overworld chunk loader is destroyed');
    const nextManifest = normalizeManifest(manifest);
    this.generation += 1;
    this.abortInflight();
    this.cache.clear();
    this.manifest = nextManifest;
    return this.generation;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generation += 1;
    this.abortInflight();
    this.cache.clear();
  }

  abortInflight() {
    for (const entry of this.inflight.values()) entry.controller.abort();
    this.inflight.clear();
  }

  assertCurrent(generation) {
    if (this.destroyed || generation !== this.generation) throw new OverworldChunkStaleError();
  }
}

export const OVERWORLD_CHUNK_REQUEST_FORMAT_VERSION = OVERWORLD_CHUNK_FORMAT_VERSION;
