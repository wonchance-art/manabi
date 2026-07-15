import { OVERWORLD_STORAGE_CHUNK_TILES } from '../../lib/world/overworldChunk.js';
import {
  OVERWORLD_RENDER_PAGE_TILES,
  OverworldRenderPager,
  OverworldRenderPagerStaleError,
  planOverworldRenderPages,
} from '../../lib/world/overworldRenderPages.js';
import {
  OVERWORLD_ROUTE_QUANTIZATION,
  overworldRoutePosition,
  planOverworldOverlaySegments,
} from '../../lib/world/overworldOverlay.js';

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer`);
}

function assertLocalCoordinate(value, label) {
  if (!Number.isInteger(value) || value < 0 || value >= OVERWORLD_STORAGE_CHUNK_TILES) {
    throw new RangeError(`${label} must be between 0 and ${OVERWORLD_STORAGE_CHUNK_TILES - 1}`);
  }
}

function normalizeDirection(direction) {
  return {
    x: Math.sign(direction?.x ?? 0),
    y: Math.sign(direction?.y ?? 0),
  };
}

export function cameraWorldViewToRenderView(worldView, worldScale = 2) {
  if (!Number.isFinite(worldScale) || worldScale <= 0) {
    throw new RangeError('worldScale must be positive');
  }
  const x = worldView?.x;
  const y = worldView?.y;
  const width = worldView?.width ?? (worldView?.right - x);
  const height = worldView?.height ?? (worldView?.bottom - y);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new RangeError('worldView must provide finite positive bounds');
  }
  return Object.freeze({
    x: x / worldScale,
    y: y / worldScale,
    width: width / worldScale,
    height: height / worldScale,
  });
}

export function createLegacyOverworldChunkLoader({
  width,
  height,
  surfaceAt,
  collisionAt = () => false,
  viewOnlyAt = () => false,
  fallbackSurface = 0,
  generation = 1,
} = {}) {
  assertPositiveInteger(width, 'width');
  assertPositiveInteger(height, 'height');
  if (typeof surfaceAt !== 'function') throw new TypeError('surfaceAt must be a function');
  if (typeof collisionAt !== 'function') throw new TypeError('collisionAt must be a function');
  if (typeof viewOnlyAt !== 'function') throw new TypeError('viewOnlyAt must be a function');
  if (!Number.isSafeInteger(generation)) throw new RangeError('generation must be a safe integer');
  const chunks = new Map();
  const chunkSize = OVERWORLD_STORAGE_CHUNK_TILES;

  const createChunk = (cx, cy) => {
    const originX = cx * chunkSize;
    const originY = cy * chunkSize;
    const globalAt = (x, y) => {
      assertLocalCoordinate(x, 'x');
      assertLocalCoordinate(y, 'y');
      return { x: originX + x, y: originY + y };
    };
    const isGlobalValid = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const isValidAt = (x, y) => {
      const global = globalAt(x, y);
      return isGlobalValid(global.x, global.y);
    };
    const read = (reader, x, y, fallback) => {
      const global = globalAt(x, y);
      return isGlobalValid(global.x, global.y) ? reader(global.x, global.y) : fallback;
    };
    const validBounds = Object.freeze({
      x0: Math.min(chunkSize, Math.max(0, -originX)),
      y0: Math.min(chunkSize, Math.max(0, -originY)),
      x1: Math.max(0, Math.min(chunkSize, width - originX)),
      y1: Math.max(0, Math.min(chunkSize, height - originY)),
    });
    const chunk = {
      header: Object.freeze({ cx, cy, validBounds, legacy: true }),
      isValidAt,
      surfaceAt: (x, y) => read(surfaceAt, x, y, fallbackSurface),
      collisionAt: (x, y) => Number(Boolean(read(collisionAt, x, y, true))),
      viewOnlyAt: (x, y) => Number(Boolean(read(viewOnlyAt, x, y, true))),
    };
    chunk.isWalkableAt = (x, y) => chunk.isValidAt(x, y)
      && chunk.collisionAt(x, y) === 0
      && chunk.viewOnlyAt(x, y) === 0;
    return Object.freeze(chunk);
  };

  return {
    generation,
    async load(cx, cy) {
      if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) {
        throw new RangeError('chunk coordinates must be safe integers');
      }
      const key = `${cx},${cy}`;
      if (!chunks.has(key)) chunks.set(key, createChunk(cx, cy));
      return chunks.get(key);
    },
    clear() { chunks.clear(); },
  };
}

export class PhaserOverworldPageRenderer {
  constructor(scene, {
    loader,
    textureKeyAt,
    fallbackTextureKey,
    tilePixels = 16,
    worldScale = 2,
    depth = 0,
    maxPages = 20,
    maxBytes,
  } = {}) {
    if (!scene?.add?.renderTexture || !scene?.make?.image) {
      throw new TypeError('scene must provide Phaser renderTexture and image factories');
    }
    if (typeof textureKeyAt !== 'function') throw new TypeError('textureKeyAt must be a function');
    if (typeof fallbackTextureKey !== 'string' || fallbackTextureKey.length === 0) {
      throw new TypeError('fallbackTextureKey must be a non-empty string');
    }
    assertPositiveInteger(tilePixels, 'tilePixels');
    if (!Number.isFinite(worldScale) || worldScale <= 0) throw new RangeError('worldScale must be positive');
    this.scene = scene;
    this.textureKeyAt = textureKeyAt;
    this.fallbackTextureKey = fallbackTextureKey;
    this.tilePixels = tilePixels;
    this.worldScale = worldScale;
    this.depth = depth;
    this.destroyed = false;
    this.lastSignature = null;
    this.stamp = scene.make.image({ add: false, key: fallbackTextureKey }).setOrigin(0, 0);
    this.pager = new OverworldRenderPager({
      loader,
      bakePage: (source) => this.bakePage(source),
      setPageVisible: (resource, visible) => resource.setVisible(visible),
      destroyPage: (resource) => resource.destroy(),
      tilePixels,
      maxPages,
      ...(maxBytes === undefined ? {} : { maxBytes }),
    });
  }

  bakePage(source) {
    if (this.destroyed) throw new Error('Phaser overworld page renderer is destroyed');
    const width = source.width * this.tilePixels;
    const height = source.height * this.tilePixels;
    const worldX = source.bounds.x0 * this.tilePixels * this.worldScale;
    const worldY = source.bounds.y0 * this.tilePixels * this.worldScale;
    const renderTexture = this.scene.add.renderTexture(worldX, worldY, width, height)
      .setOrigin(0, 0)
      .setScale(this.worldScale)
      .setDepth(this.depth)
      .setVisible(false);
    try {
      renderTexture.beginDraw();
      for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
          const globalX = source.bounds.x0 + x;
          const globalY = source.bounds.y0 + y;
          const key = this.textureKeyAt({
            source,
            x,
            y,
            globalX,
            globalY,
            surface: source.surfaceAt(x, y),
            valid: source.isValidAt(x, y),
          }) || this.fallbackTextureKey;
          this.stamp.setTexture(key);
          renderTexture.batchDraw(this.stamp, x * this.tilePixels, y * this.tilePixels);
        }
      }
      renderTexture.endDraw();
      return {
        resource: renderTexture,
        byteLength: width * height * 4,
      };
    } catch (error) {
      renderTexture.destroy();
      throw error;
    }
  }

  updateCamera(cameraOrView, {
    direction = { x: 0, y: 0 },
    padding = 1,
    prefetch = 1,
    force = false,
  } = {}) {
    if (this.destroyed) return Promise.resolve(null);
    const worldView = cameraOrView?.worldView ?? cameraOrView;
    const view = cameraWorldViewToRenderView(worldView, this.worldScale);
    const movement = normalizeDirection(direction);
    const pages = planOverworldRenderPages(view, {
      tilePixels: this.tilePixels,
      direction: movement,
      padding,
      prefetch,
    });
    const core = pages.filter((page) => page.visible).map((page) => page.key).join('|');
    const signature = `${core};${movement.x},${movement.y};${padding};${prefetch}`;
    if (!force && signature === this.lastSignature) return Promise.resolve(null);
    this.lastSignature = signature;
    const update = this.pager.update(view, { direction: movement, padding, prefetch })
      .catch((error) => {
        if (error instanceof OverworldRenderPagerStaleError) return null;
        if (this.lastSignature === signature) this.lastSignature = null;
        throw error;
      });
    return update;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pager.destroy();
    this.stamp.destroy();
    this.lastSignature = null;
  }
}

export class PhaserOverworldOverlayLayer {
  constructor(scene, {
    routes = [],
    vehicleTextureKeyAt,
    tilePixels = 16,
    worldScale = 2,
    routeDepth = 0.75,
    vehicleDepth = 8500,
    haloTiles = 1,
  } = {}) {
    if (!scene?.add?.graphics || !scene?.add?.image) {
      throw new TypeError('scene must provide Phaser graphics and image factories');
    }
    if (typeof vehicleTextureKeyAt !== 'function') {
      throw new TypeError('vehicleTextureKeyAt must be a function');
    }
    assertPositiveInteger(tilePixels, 'tilePixels');
    if (!Number.isFinite(worldScale) || worldScale <= 0) throw new RangeError('worldScale must be positive');
    if (!Number.isFinite(haloTiles) || haloTiles < 0) throw new RangeError('haloTiles must be non-negative');
    this.scene = scene;
    this.routes = Object.freeze([...routes]);
    this.routeById = new Map(this.routes.map((route) => [route.id, route]));
    this.vehicleTextureKeyAt = vehicleTextureKeyAt;
    this.tilePixels = tilePixels;
    this.worldScale = worldScale;
    this.vehicleDepth = vehicleDepth;
    this.haloTiles = haloTiles;
    this.destroyed = false;
    this.routeSignature = null;
    this.routeGraphics = scene.add.graphics().setDepth(routeDepth);
    this.vehicleViews = new Map();
  }

  routeWorldCoordinate(valueQ) {
    return (valueQ / OVERWORLD_ROUTE_QUANTIZATION + 0.5) * this.tilePixels * this.worldScale;
  }

  updateCamera(cameraOrView, { force = false } = {}) {
    if (this.destroyed) return;
    const worldView = cameraOrView?.worldView ?? cameraOrView;
    const view = cameraWorldViewToRenderView(worldView, this.worldScale);
    const segments = planOverworldOverlaySegments(view, this.routes, {
      tilePixels: this.tilePixels,
      haloTiles: this.haloTiles,
    });
    const signature = segments.map((segment) => segment.key).join('|');
    if (!force && signature === this.routeSignature) return;
    this.routeSignature = signature;
    this.routeGraphics.clear();
    for (const segment of segments) {
      const route = segment.route;
      this.routeGraphics.lineStyle(
        Math.max(1, route.widthTiles * this.tilePixels * this.worldScale),
        route.color,
        route.alpha,
      );
      this.routeGraphics.beginPath();
      this.routeGraphics.moveTo(
        this.routeWorldCoordinate(segment.start[0]),
        this.routeWorldCoordinate(segment.start[1]),
      );
      this.routeGraphics.lineTo(
        this.routeWorldCoordinate(segment.end[0]),
        this.routeWorldCoordinate(segment.end[1]),
      );
      this.routeGraphics.strokePath();
    }
    this.routeGraphics.setVisible(segments.length > 0);
  }

  updateVehicles(vehicles, cameraOrView) {
    if (this.destroyed) return;
    const view = cameraOrView?.worldView ?? cameraOrView;
    const halo = this.haloTiles * this.tilePixels * this.worldScale;
    const alive = new Set();
    for (const vehicle of vehicles || []) {
      const id = vehicle?.id ?? vehicle?.runId;
      const route = this.routeById.get(vehicle?.routeId);
      if (typeof id !== 'string' || !route) continue;
      const position = overworldRoutePosition(route, vehicle.progress);
      let entry = this.vehicleViews.get(id);
      if (!entry) {
        const textureKey = this.vehicleTextureKeyAt(vehicle, route);
        if (typeof textureKey !== 'string' || textureKey.length === 0) continue;
        const sprite = this.scene.add.image(0, 0, textureKey).setScale(this.worldScale).setDepth(this.vehicleDepth);
        entry = { sprite, routeId: route.id, position };
        this.vehicleViews.set(id, entry);
      }
      alive.add(id);
      const worldX = this.routeWorldCoordinate(position.xQ);
      const worldY = this.routeWorldCoordinate(position.yQ);
      const visible = worldX >= view.x - halo && worldX <= view.x + view.width + halo
        && worldY >= view.y - halo && worldY <= view.y + view.height + halo;
      entry.position = position;
      entry.sprite.setPosition(worldX, worldY)
        .setDepth(Math.max(this.vehicleDepth, worldY + 2))
        .setVisible(visible);
    }
    for (const [id, entry] of this.vehicleViews) {
      if (alive.has(id)) continue;
      entry.sprite.destroy();
      this.vehicleViews.delete(id);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.routeGraphics.destroy();
    for (const [, entry] of this.vehicleViews) entry.sprite.destroy();
    this.vehicleViews.clear();
    this.routeSignature = null;
  }
}

export { OVERWORLD_RENDER_PAGE_TILES };
