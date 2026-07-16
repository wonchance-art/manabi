import { OVERWORLD_ROUTE_QUANTIZATION } from '../../lib/world/overworldOverlay.js';
import {
  OverworldFeatureOverlayLoader,
  overlayChunkCoordinatesForWorldView,
  visibleOverworldOverlaySegments,
} from '../../lib/world/overworldFeatureOverlay.js';

export function overworldDashedLineSegments(start, end, dashPixels, gapPixels) {
  if (![...start, ...end, dashPixels, gapPixels].every(Number.isFinite)
    || dashPixels <= 0 || gapPixels < 0) {
    throw new RangeError('dashed line inputs must be finite with a positive dash');
  }
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Object.freeze([]);
  const pieces = [];
  for (let offset = 0; offset < length; offset += dashPixels + gapPixels) {
    const dashEnd = Math.min(length, offset + dashPixels);
    pieces.push(Object.freeze([
      Object.freeze([start[0] + (dx * offset) / length, start[1] + (dy * offset) / length]),
      Object.freeze([start[0] + (dx * dashEnd) / length, start[1] + (dy * dashEnd) / length]),
    ]));
  }
  return Object.freeze(pieces);
}

export class PhaserOverworldChunkOverlayRenderer {
  constructor(scene, {
    sources = [],
    baseUrl = '/assets/overworld',
    tilePixels = 16,
    worldScale = 2,
    maxDocuments = 12,
  } = {}) {
    if (!scene?.add?.graphics) throw new TypeError('scene must provide Phaser graphics');
    this.scene = scene;
    this.tilePixels = tilePixels;
    this.worldScale = worldScale;
    this.destroyed = false;
    this.generation = 0;
    this.lastSignature = null;
    this.layers = sources.map((source, index) => ({
      source,
      loader: new OverworldFeatureOverlayLoader({ baseUrl, source, maxDocuments }),
      graphics: scene.add.graphics().setDepth(source.style?.depth ?? index + 1),
    }));
  }

  worldCoordinate(valueQ) {
    return (valueQ / OVERWORLD_ROUTE_QUANTIZATION + 0.5) * this.tilePixels * this.worldScale;
  }

  drawLayer(layer, documents, worldView) {
    const graphics = layer.graphics;
    const style = layer.source.style || {};
    const maxScaleRank = style.maxScaleRank ?? 5;
    const groups = new Map();
    for (const segment of visibleOverworldOverlaySegments(documents, worldView, {
      tilePixels: this.tilePixels,
      worldScale: this.worldScale,
    })) {
      const rank = Math.min(maxScaleRank, segment.scaleRank);
      const boundaryClass = segment.boundaryClass ?? 'solid';
      const key = `${String(rank).padStart(3, '0')}:${boundaryClass}`;
      if (!groups.has(key)) groups.set(key, { rank, boundaryClass, segments: [] });
      groups.get(key).segments.push(segment);
    }
    graphics.clear();
    for (const { rank, boundaryClass, segments } of [...groups.values()]
      .sort((left, right) => right.rank - left.rank
        || (left.boundaryClass < right.boundaryClass ? -1 : left.boundaryClass > right.boundaryClass ? 1 : 0))) {
      const widthTiles = (style.widthTiles ?? 0.06)
        + (maxScaleRank - rank) * (style.rankStepTiles ?? 0.01);
      graphics.lineStyle(
        Math.max(1, widthTiles * this.tilePixels * this.worldScale),
        boundaryClass === 'neutral-disputed'
          ? (style.neutralDisputedColor ?? style.color ?? 0xffffff)
          : (style.color ?? 0xffffff),
        boundaryClass === 'neutral-disputed'
          ? (style.neutralDisputedAlpha ?? style.alpha ?? 0.8)
          : (style.alpha ?? 0.8),
      );
      graphics.beginPath();
      for (const segment of segments) {
        const start = [this.worldCoordinate(segment.start[0]), this.worldCoordinate(segment.start[1])];
        const end = [this.worldCoordinate(segment.end[0]), this.worldCoordinate(segment.end[1])];
        if (boundaryClass === 'neutral-disputed') {
          const dashPixels = (style.dashTiles ?? 0.18) * this.tilePixels * this.worldScale;
          const gapPixels = (style.gapTiles ?? 0.14) * this.tilePixels * this.worldScale;
          for (const [dashStart, dashEnd] of overworldDashedLineSegments(
            start,
            end,
            dashPixels,
            gapPixels,
          )) {
            graphics.moveTo(...dashStart);
            graphics.lineTo(...dashEnd);
          }
        } else {
          graphics.moveTo(...start);
          graphics.lineTo(...end);
        }
      }
      graphics.strokePath();
    }
    graphics.setVisible(groups.size > 0);
  }

  updateCamera(cameraOrView, { force = false } = {}) {
    if (this.destroyed || this.layers.length === 0) return Promise.resolve(null);
    const worldView = cameraOrView?.worldView ?? cameraOrView;
    const chunks = overlayChunkCoordinatesForWorldView(worldView, {
      tilePixels: this.tilePixels,
      worldScale: this.worldScale,
      width: this.layers[0].source.width,
      height: this.layers[0].source.height,
      paddingChunks: 0,
    });
    const tileWorldPixels = this.tilePixels * this.worldScale;
    const signature = `${chunks.map(({ cx, cy }) => `${cx},${cy}`).join('|')};${Math.floor(worldView.x / tileWorldPixels)},${Math.floor(worldView.y / tileWorldPixels)}`;
    if (!force && signature === this.lastSignature) return Promise.resolve(null);
    this.lastSignature = signature;
    const generation = ++this.generation;
    return Promise.all(this.layers.map(async (layer) => {
      const results = await Promise.allSettled(
        chunks.map(({ cx, cy }) => layer.loader.load(cx, cy)),
      );
      const documents = results
        .filter((result) => result.status === 'fulfilled' && result.value)
        .map((result) => result.value);
      if (this.destroyed || generation !== this.generation) return;
      this.drawLayer(layer, documents, worldView);
    }));
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generation += 1;
    for (const layer of this.layers) {
      layer.loader.destroy();
      layer.graphics.destroy();
    }
    this.layers.length = 0;
    this.lastSignature = null;
  }
}
