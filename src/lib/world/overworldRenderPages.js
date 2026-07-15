import { OVERWORLD_STORAGE_CHUNK_TILES } from './overworldChunk.js';
import { globalTileToStorageChunk } from './overworldCollisionWindow.js';
import { overworldChunkKey } from './overworldChunkLoader.js';

export const OVERWORLD_RENDER_PAGE_TILES = 32;
export const OVERWORLD_RENDER_PAGES_PER_STORAGE_CHUNK = OVERWORLD_STORAGE_CHUNK_TILES
  / OVERWORLD_RENDER_PAGE_TILES;
export const OVERWORLD_RENDER_PAGE_BYTES = (OVERWORLD_RENDER_PAGE_TILES * 16) ** 2 * 4;

const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_BYTES = DEFAULT_MAX_PAGES * OVERWORLD_RENDER_PAGE_BYTES;

function assertSafeInteger(value, label) {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer`);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer`);
}

function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function normalizeView(view) {
  const x = view?.x;
  const y = view?.y;
  const width = view?.width ?? (view?.right - x);
  const height = view?.height ?? (view?.bottom - y);
  for (const [value, label] of [[x, 'view.x'], [y, 'view.y'], [width, 'view.width'], [height, 'view.height']]) {
    assertFinite(value, label);
  }
  if (width <= 0 || height <= 0) throw new RangeError('view width and height must be positive');
  return Object.freeze({ x, y, width, height, right: x + width, bottom: y + height });
}

function normalizeDirection(direction) {
  const x = direction?.x ?? 0;
  const y = direction?.y ?? 0;
  assertFinite(x, 'direction.x');
  assertFinite(y, 'direction.y');
  return Object.freeze({ x: Math.sign(x), y: Math.sign(y) });
}

function pageRange(view, pagePixels) {
  return Object.freeze({
    x0: Math.floor(view.x / pagePixels),
    y0: Math.floor(view.y / pagePixels),
    x1: Math.ceil(view.right / pagePixels) - 1,
    y1: Math.ceil(view.bottom / pagePixels) - 1,
  });
}

function pageDistance(pageX, pageY, centerX, centerY) {
  return Math.abs(pageX - centerX) + Math.abs(pageY - centerY);
}

function freezePage(page) {
  return Object.freeze(page);
}

function comparePages(left, right) {
  return left.tier - right.tier
    || left.distance - right.distance
    || left.directionRank - right.directionRank
    || left.pageY - right.pageY
    || left.pageX - right.pageX;
}

function compareStorageRequests(left, right) {
  return left.tier - right.tier
    || left.distance - right.distance
    || left.directionRank - right.directionRank
    || left.cy - right.cy
    || left.cx - right.cx;
}

function assertLoader(loader) {
  if (!loader || typeof loader.load !== 'function' || !Number.isSafeInteger(loader.generation)) {
    throw new TypeError('loader must provide load(cx, cy) and an integer generation');
  }
}

export function overworldRenderPageKey(pageX, pageY) {
  assertSafeInteger(pageX, 'pageX');
  assertSafeInteger(pageY, 'pageY');
  return `${pageX},${pageY}`;
}

export function renderPageToStorageChunk(pageX, pageY) {
  const key = overworldRenderPageKey(pageX, pageY);
  const { cx, cy, localX, localY } = globalTileToStorageChunk(
    pageX * OVERWORLD_RENDER_PAGE_TILES,
    pageY * OVERWORLD_RENDER_PAGE_TILES,
  );
  return Object.freeze({
    key,
    pageX,
    pageY,
    cx,
    cy,
    chunkKey: overworldChunkKey(cx, cy),
    localPageX: localX / OVERWORLD_RENDER_PAGE_TILES,
    localPageY: localY / OVERWORLD_RENDER_PAGE_TILES,
    localTileX: localX,
    localTileY: localY,
  });
}

export function renderPageTileBounds(pageX, pageY) {
  overworldRenderPageKey(pageX, pageY);
  const x0 = pageX * OVERWORLD_RENDER_PAGE_TILES;
  const y0 = pageY * OVERWORLD_RENDER_PAGE_TILES;
  return Object.freeze({
    x0,
    y0,
    x1: x0 + OVERWORLD_RENDER_PAGE_TILES,
    y1: y0 + OVERWORLD_RENDER_PAGE_TILES,
  });
}

export function planOverworldRenderPages(viewInput, {
  tilePixels = 16,
  padding = 1,
  prefetch = 1,
  direction = { x: 0, y: 0 },
} = {}) {
  assertPositiveInteger(tilePixels, 'tilePixels');
  assertNonNegativeInteger(padding, 'padding');
  assertNonNegativeInteger(prefetch, 'prefetch');
  const view = normalizeView(viewInput);
  const movement = normalizeDirection(direction);
  const pagePixels = tilePixels * OVERWORLD_RENDER_PAGE_TILES;
  const core = pageRange(view, pagePixels);
  const padded = Object.freeze({
    x0: core.x0 - padding,
    y0: core.y0 - padding,
    x1: core.x1 + padding,
    y1: core.y1 + padding,
  });
  const centerX = (core.x0 + core.x1) / 2;
  const centerY = (core.y0 + core.y1) / 2;
  const pages = new Map();
  const add = (pageX, pageY, tier) => {
    const key = overworldRenderPageKey(pageX, pageY);
    const previous = pages.get(key);
    if (previous && previous.tier <= tier) return;
    pages.set(key, freezePage({
      key,
      pageX,
      pageY,
      tier,
      visible: tier === 0,
      distance: pageDistance(pageX, pageY, centerX, centerY),
      directionRank: -((pageX - centerX) * movement.x + (pageY - centerY) * movement.y),
    }));
  };

  for (let pageY = core.y0; pageY <= core.y1; pageY += 1) {
    for (let pageX = core.x0; pageX <= core.x1; pageX += 1) add(pageX, pageY, 0);
  }
  for (let pageY = padded.y0; pageY <= padded.y1; pageY += 1) {
    for (let pageX = padded.x0; pageX <= padded.x1; pageX += 1) add(pageX, pageY, 1);
  }

  if (prefetch > 0 && movement.x !== 0) {
    const edge = movement.x > 0 ? padded.x1 : padded.x0;
    for (let step = 1; step <= prefetch; step += 1) {
      const pageX = edge + movement.x * step;
      for (let pageY = padded.y0; pageY <= padded.y1; pageY += 1) add(pageX, pageY, 2);
    }
  }
  if (prefetch > 0 && movement.y !== 0) {
    const edge = movement.y > 0 ? padded.y1 : padded.y0;
    for (let step = 1; step <= prefetch; step += 1) {
      const pageY = edge + movement.y * step;
      for (let pageX = padded.x0; pageX <= padded.x1; pageX += 1) add(pageX, pageY, 2);
    }
  }

  return Object.freeze([...pages.values()].sort(comparePages));
}

export function collectRenderPageStorageChunks(pages) {
  const requests = new Map();
  for (const page of pages) {
    const location = renderPageToStorageChunk(page.pageX, page.pageY);
    const previous = requests.get(location.chunkKey);
    const request = Object.freeze({
      key: location.chunkKey,
      cx: location.cx,
      cy: location.cy,
      tier: page.tier ?? 0,
      distance: page.distance ?? 0,
      directionRank: page.directionRank ?? 0,
    });
    if (!previous || compareStorageRequests(request, previous) < 0) {
      requests.set(location.chunkKey, request);
    }
  }
  return Object.freeze([...requests.values()].sort(compareStorageRequests));
}

export function createOverworldRenderPageSource(chunk, pageX, pageY) {
  if (!chunk?.header || typeof chunk.surfaceAt !== 'function') {
    throw new TypeError('chunk must be a decoded overworld chunk');
  }
  const location = renderPageToStorageChunk(pageX, pageY);
  if (chunk.header.cx !== location.cx || chunk.header.cy !== location.cy) {
    throw new Error(`render page chunk mismatch: ${chunk.header.cx},${chunk.header.cy} !== ${location.cx},${location.cy}`);
  }
  const localCoordinate = (x, y) => {
    if (!Number.isInteger(x) || x < 0 || x >= OVERWORLD_RENDER_PAGE_TILES) {
      throw new RangeError(`x must be between 0 and ${OVERWORLD_RENDER_PAGE_TILES - 1}`);
    }
    if (!Number.isInteger(y) || y < 0 || y >= OVERWORLD_RENDER_PAGE_TILES) {
      throw new RangeError(`y must be between 0 and ${OVERWORLD_RENDER_PAGE_TILES - 1}`);
    }
    return Object.freeze({ x: location.localTileX + x, y: location.localTileY + y });
  };
  const call = (method, x, y) => {
    const local = localCoordinate(x, y);
    return chunk[method](local.x, local.y);
  };
  return Object.freeze({
    ...location,
    width: OVERWORLD_RENDER_PAGE_TILES,
    height: OVERWORLD_RENDER_PAGE_TILES,
    bounds: renderPageTileBounds(pageX, pageY),
    surfaceAt: (x, y) => call('surfaceAt', x, y),
    collisionAt: (x, y) => call('collisionAt', x, y),
    viewOnlyAt: (x, y) => call('viewOnlyAt', x, y),
    isValidAt: (x, y) => call('isValidAt', x, y),
  });
}

export class OverworldRenderPagerStaleError extends Error {
  constructor() {
    super('overworld render page request belongs to a stale update');
    this.name = 'OverworldRenderPagerStaleError';
    this.code = 'OVERWORLD_RENDER_PAGE_STALE';
  }
}

export class OverworldRenderPager {
  constructor({
    loader,
    bakePage,
    setPageVisible = () => {},
    destroyPage = (resource) => resource?.destroy?.(),
    tilePixels = 16,
    maxPages = DEFAULT_MAX_PAGES,
    maxBytes = DEFAULT_MAX_BYTES,
  } = {}) {
    assertLoader(loader);
    if (typeof bakePage !== 'function') throw new TypeError('bakePage must be a function');
    if (typeof setPageVisible !== 'function') throw new TypeError('setPageVisible must be a function');
    if (typeof destroyPage !== 'function') throw new TypeError('destroyPage must be a function');
    assertPositiveInteger(tilePixels, 'tilePixels');
    assertPositiveInteger(maxPages, 'maxPages');
    assertPositiveInteger(maxBytes, 'maxBytes');
    this.loader = loader;
    this.bakePage = bakePage;
    this.setPageVisible = setPageVisible;
    this.destroyPage = destroyPage;
    this.tilePixels = tilePixels;
    this.defaultPageBytes = (OVERWORLD_RENDER_PAGE_TILES * tilePixels) ** 2 * 4;
    this.maxPages = maxPages;
    this.maxBytes = maxBytes;
    this.entries = new Map();
    this.inflight = new Map();
    this.visibleKeys = new Set();
    this.desiredKeys = new Set();
    this.pendingCoreKeys = new Set();
    this.totalBytes = 0;
    this.tick = 0;
    this.updateGeneration = 0;
    this.lifecycleGeneration = 1;
    this.loaderGeneration = loader.generation;
    this.destroyed = false;
    this.background = Promise.resolve(Object.freeze({ loaded: 0, failed: 0 }));
  }

  get size() { return this.entries.size; }

  get byteLength() { return this.totalBytes; }

  get visible() { return [...this.visibleKeys]; }

  get pendingCount() { return this.inflight.size; }

  has(key) { return this.entries.has(key); }

  page(key) { return this.entries.get(key)?.resource; }

  async update(view, { direction, padding = 1, prefetch = 1 } = {}) {
    if (this.destroyed) throw new Error('overworld render pager is destroyed');
    if (this.loaderGeneration !== this.loader.generation) {
      this.clear();
      this.loaderGeneration = this.loader.generation;
    }
    const pages = planOverworldRenderPages(view, {
      tilePixels: this.tilePixels,
      direction,
      padding,
      prefetch,
    });
    const core = pages.filter((page) => page.visible);
    const warm = pages.filter((page) => !page.visible);
    const generation = this.updateGeneration + 1;
    const loaderGeneration = this.loader.generation;
    this.updateGeneration = generation;
    this.desiredKeys = new Set(pages.map((page) => page.key));
    this.pendingCoreKeys = new Set(core.map((page) => page.key));

    try {
      await Promise.all(core.map((page) => this.ensurePage(page)));
      this.assertCurrent(generation, loaderGeneration);
      this.commitVisible(core.map((page) => page.key));
      this.pendingCoreKeys.clear();
      this.trim();
      this.background = this.warmPages(warm, generation);
      return Object.freeze({
        generation,
        pages,
        visibleKeys: Object.freeze(core.map((page) => page.key)),
        background: this.background,
      });
    } catch (error) {
      if (generation === this.updateGeneration) this.pendingCoreKeys.clear();
      if (this.destroyed
        || generation !== this.updateGeneration
        || loaderGeneration !== this.loader.generation) {
        throw new OverworldRenderPagerStaleError();
      }
      throw error;
    }
  }

  async warmPages(pages, generation) {
    let loaded = 0;
    let failed = 0;
    for (const page of pages) {
      if (this.destroyed || generation !== this.updateGeneration || !this.desiredKeys.has(page.key)) break;
      try {
        await this.ensurePage(page);
        if (this.destroyed || generation !== this.updateGeneration) break;
        loaded += 1;
        this.trim();
      } catch (error) {
        if (error instanceof OverworldRenderPagerStaleError) break;
        failed += 1;
      }
    }
    return Object.freeze({ loaded, failed });
  }

  ensurePage(page) {
    const resident = this.entries.get(page.key);
    if (resident) {
      this.touch(resident);
      return Promise.resolve(resident);
    }
    const pending = this.inflight.get(page.key);
    if (pending) return pending;

    const lifecycleGeneration = this.lifecycleGeneration;
    const loaderGeneration = this.loaderGeneration;
    const execute = async () => {
      const location = renderPageToStorageChunk(page.pageX, page.pageY);
      const chunk = await this.loader.load(location.cx, location.cy);
      if (!this.isPageCurrent(page.key, lifecycleGeneration, loaderGeneration)) {
        throw new OverworldRenderPagerStaleError();
      }
      this.trim(this.defaultPageBytes, 1);
      const source = createOverworldRenderPageSource(chunk, page.pageX, page.pageY);
      const baked = await this.bakePage(source);
      const normalized = baked && typeof baked === 'object' && 'resource' in baked
        ? baked
        : { resource: baked, byteLength: this.defaultPageBytes };
      if (normalized.resource === undefined || normalized.resource === null) {
        throw new Error(`bakePage returned no resource for ${page.key}`);
      }
      const byteLength = normalized.byteLength ?? this.defaultPageBytes;
      assertPositiveInteger(byteLength, 'render page byteLength');
      if (!this.isPageCurrent(page.key, lifecycleGeneration, loaderGeneration)) {
        this.destroyPage(normalized.resource);
        throw new OverworldRenderPagerStaleError();
      }
      const entry = {
        key: page.key,
        pageX: page.pageX,
        pageY: page.pageY,
        resource: normalized.resource,
        byteLength,
        tick: 0,
      };
      this.setPageVisible(entry.resource, false);
      this.entries.set(entry.key, entry);
      this.totalBytes += byteLength;
      this.touch(entry);
      return entry;
    };
    const promise = execute();
    this.inflight.set(page.key, promise);
    const cleanup = () => {
      if (this.inflight.get(page.key) === promise) this.inflight.delete(page.key);
    };
    promise.then(cleanup, cleanup);
    return promise;
  }

  commitVisible(nextKeys) {
    for (const key of nextKeys) {
      if (!this.entries.has(key)) throw new Error(`render page is not ready: ${key}`);
    }
    const next = new Set(nextKeys);
    for (const key of next) {
      const entry = this.entries.get(key);
      this.touch(entry);
      if (!this.visibleKeys.has(key)) this.setPageVisible(entry.resource, true);
    }
    for (const key of this.visibleKeys) {
      if (!next.has(key)) this.setPageVisible(this.entries.get(key)?.resource, false);
    }
    this.visibleKeys = next;
  }

  touch(entry) {
    entry.tick = ++this.tick;
  }

  protectedKeys() {
    return new Set([...this.visibleKeys, ...this.pendingCoreKeys]);
  }

  trim(reserveBytes = 0, reservePages = 0) {
    const protect = this.protectedKeys();
    const order = [...this.entries.values()].sort((left, right) => left.tick - right.tick);
    for (const entry of order) {
      if (this.entries.size + reservePages <= this.maxPages
        && this.totalBytes + reserveBytes <= this.maxBytes) break;
      if (protect.has(entry.key)) continue;
      this.remove(entry.key);
    }
  }

  remove(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (this.visibleKeys.has(key)) return false;
    this.entries.delete(key);
    this.totalBytes -= entry.byteLength;
    this.destroyPage(entry.resource);
    return true;
  }

  clear() {
    if (this.destroyed) return;
    this.updateGeneration += 1;
    this.lifecycleGeneration += 1;
    this.desiredKeys.clear();
    this.pendingCoreKeys.clear();
    this.inflight.clear();
    for (const key of this.visibleKeys) this.setPageVisible(this.entries.get(key)?.resource, false);
    this.visibleKeys.clear();
    for (const entry of this.entries.values()) this.destroyPage(entry.resource);
    this.entries.clear();
    this.totalBytes = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
  }

  assertCurrent(generation, loaderGeneration) {
    if (this.destroyed
      || generation !== this.updateGeneration
      || loaderGeneration !== this.loader.generation) {
      throw new OverworldRenderPagerStaleError();
    }
  }

  isPageCurrent(key, lifecycleGeneration, loaderGeneration) {
    return !this.destroyed
      && lifecycleGeneration === this.lifecycleGeneration
      && loaderGeneration === this.loaderGeneration
      && loaderGeneration === this.loader.generation
      && this.desiredKeys.has(key);
  }
}
