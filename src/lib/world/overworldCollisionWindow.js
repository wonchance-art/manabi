import { OVERWORLD_STORAGE_CHUNK_TILES } from './overworldChunk.js';
import { overworldChunkKey } from './overworldChunkLoader.js';

const WINDOW_RADIUS = 1;
const WINDOW_SIDE = WINDOW_RADIUS * 2 + 1;

const UNLOADED_CELL = Object.freeze({
  loaded: false,
  valid: false,
  surface: null,
  collision: 1,
  viewOnly: 1,
  walkable: false,
});

const INVALID_CELL = Object.freeze({
  loaded: true,
  valid: false,
  surface: null,
  collision: 1,
  viewOnly: 1,
  walkable: false,
});

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function assertLoader(loader) {
  if (!loader || typeof loader.load !== 'function' || !Number.isSafeInteger(loader.generation)) {
    throw new TypeError('loader must provide load(cx, cy) and an integer generation');
  }
}

export function globalTileToStorageChunk(globalX, globalY) {
  assertSafeInteger(globalX, 'globalX');
  assertSafeInteger(globalY, 'globalY');
  const cx = Math.floor(globalX / OVERWORLD_STORAGE_CHUNK_TILES);
  const cy = Math.floor(globalY / OVERWORLD_STORAGE_CHUNK_TILES);
  overworldChunkKey(cx, cy);
  return Object.freeze({
    cx,
    cy,
    localX: globalX - cx * OVERWORLD_STORAGE_CHUNK_TILES,
    localY: globalY - cy * OVERWORLD_STORAGE_CHUNK_TILES,
  });
}

export function overworldCollisionWindowCoordinates(centerCx, centerCy) {
  assertSafeInteger(centerCx, 'centerCx');
  assertSafeInteger(centerCy, 'centerCy');
  const coordinates = [];
  for (let dy = -WINDOW_RADIUS; dy <= WINDOW_RADIUS; dy += 1) {
    for (let dx = -WINDOW_RADIUS; dx <= WINDOW_RADIUS; dx += 1) {
      const cx = centerCx + dx;
      const cy = centerCy + dy;
      assertSafeInteger(cx, 'cx');
      assertSafeInteger(cy, 'cy');
      overworldChunkKey(cx, cy);
      coordinates.push(Object.freeze({ cx, cy, distance: Math.abs(dx) + Math.abs(dy) }));
    }
  }
  coordinates.sort((left, right) => left.distance - right.distance
    || left.cy - right.cy
    || left.cx - right.cx);
  return Object.freeze(coordinates);
}

export class OverworldCollisionWindowStaleError extends Error {
  constructor() {
    super('overworld collision window request belongs to a stale generation');
    this.name = 'OverworldCollisionWindowStaleError';
    this.code = 'OVERWORLD_COLLISION_WINDOW_STALE';
  }
}

export class OverworldCollisionWindow {
  constructor({ loader } = {}) {
    assertLoader(loader);
    this.loader = loader;
    this.chunks = new Map();
    this.centerChunk = null;
    this.loaderGeneration = 0;
    this.requestGeneration = 0;
    this.pending = null;
    this.destroyed = false;
  }

  get ready() {
    return !this.destroyed
      && this.loaderGeneration === this.loader.generation
      && this.chunks.size === WINDOW_SIDE ** 2;
  }

  get size() { return this.ready ? this.chunks.size : 0; }

  get center() { return this.ready ? this.centerChunk : null; }

  loadAround(globalX, globalY) {
    const { cx, cy } = globalTileToStorageChunk(globalX, globalY);
    return this.loadCenterChunk(cx, cy);
  }

  loadCenterChunk(centerCx, centerCy) {
    if (this.destroyed) return Promise.reject(new Error('overworld collision window is destroyed'));
    const coordinates = overworldCollisionWindowCoordinates(centerCx, centerCy);
    const loaderGeneration = this.loader.generation;
    if (this.pending
      && this.pending.loaderGeneration === loaderGeneration
      && this.pending.centerCx === centerCx
      && this.pending.centerCy === centerCy) {
      return this.pending.promise;
    }

    const requestGeneration = this.requestGeneration + 1;
    this.requestGeneration = requestGeneration;
    const execute = async () => {
      const decoded = await Promise.all(coordinates.map(({ cx, cy }) => this.loader.load(cx, cy)));
      this.assertCurrent(requestGeneration, loaderGeneration);
      const nextChunks = new Map();
      coordinates.forEach(({ cx, cy }, index) => {
        nextChunks.set(overworldChunkKey(cx, cy), decoded[index]);
      });
      this.chunks = nextChunks;
      this.centerChunk = Object.freeze({ cx: centerCx, cy: centerCy });
      this.loaderGeneration = loaderGeneration;
      return this;
    };
    const promise = execute().catch((error) => {
      if (this.destroyed
        || requestGeneration !== this.requestGeneration
        || loaderGeneration !== this.loader.generation) {
        throw new OverworldCollisionWindowStaleError();
      }
      throw error;
    });
    const entry = {
      promise, requestGeneration, loaderGeneration, centerCx, centerCy,
    };
    this.pending = entry;
    const cleanup = () => {
      if (this.pending === entry) this.pending = null;
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  chunkAt(cx, cy) {
    assertSafeInteger(cx, 'cx');
    assertSafeInteger(cy, 'cy');
    if (!this.ready) return undefined;
    return this.chunks.get(overworldChunkKey(cx, cy));
  }

  cellAt(globalX, globalY) {
    const { cx, cy, localX, localY } = globalTileToStorageChunk(globalX, globalY);
    const chunk = this.chunkAt(cx, cy);
    if (!chunk) return UNLOADED_CELL;
    if (!chunk.isValidAt(localX, localY)) return INVALID_CELL;
    const collision = chunk.collisionAt(localX, localY);
    const viewOnly = chunk.viewOnlyAt(localX, localY);
    return Object.freeze({
      loaded: true,
      valid: true,
      surface: chunk.surfaceAt(localX, localY),
      collision,
      viewOnly,
      walkable: collision === 0 && viewOnly === 0,
    });
  }

  isWalkable(globalX, globalY) {
    const { cx, cy, localX, localY } = globalTileToStorageChunk(globalX, globalY);
    const chunk = this.chunkAt(cx, cy);
    return chunk?.isWalkableAt(localX, localY) === true;
  }

  clear() {
    if (this.destroyed) return;
    this.requestGeneration += 1;
    this.pending = null;
    this.chunks.clear();
    this.centerChunk = null;
    this.loaderGeneration = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
  }

  assertCurrent(requestGeneration, loaderGeneration) {
    if (this.destroyed
      || requestGeneration !== this.requestGeneration
      || loaderGeneration !== this.loader.generation) {
      throw new OverworldCollisionWindowStaleError();
    }
  }
}

export const OVERWORLD_COLLISION_WINDOW_CHUNKS = WINDOW_SIDE ** 2;
