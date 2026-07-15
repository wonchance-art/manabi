import { OVERWORLD_STORAGE_CHUNK_TILES } from './overworldChunk.js';
import { OVERWORLD_RENDER_PAGE_TILES } from './overworldRenderPages.js';

export const OVERWORLD_ROUTE_QUANTIZATION = 1024;

function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
}

function assertPositive(value, label) {
  assertFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive`);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function quantizeCoordinate(value, label) {
  assertFinite(value, label);
  const quantized = Math.round(value * OVERWORLD_ROUTE_QUANTIZATION);
  if (!Number.isSafeInteger(quantized)) throw new RangeError(`${label} is outside the safe quantized range`);
  return quantized;
}

function normalizePoint(point, index) {
  if (!Array.isArray(point) || point.length !== 2) {
    throw new TypeError(`points[${index}] must be a [x, y] pair`);
  }
  return Object.freeze([
    quantizeCoordinate(point[0], `points[${index}][0]`),
    quantizeCoordinate(point[1], `points[${index}][1]`),
  ]);
}

function segmentBounds(start, end) {
  return Object.freeze({
    x0: Math.min(start[0], end[0]),
    y0: Math.min(start[1], end[1]),
    x1: Math.max(start[0], end[0]),
    y1: Math.max(start[1], end[1]),
  });
}

export function createOverworldRoute({
  id,
  mode = 'train',
  points,
  color = 0xffffff,
  alpha = 0.8,
  widthTiles = 0.16,
} = {}) {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('route id must be a non-empty string');
  if (typeof mode !== 'string' || mode.length === 0) throw new TypeError('route mode must be a non-empty string');
  if (!Array.isArray(points) || points.length < 2) throw new RangeError('route requires at least two points');
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
    throw new RangeError('route color must be a 24-bit integer');
  }
  assertFinite(alpha, 'route alpha');
  if (alpha < 0 || alpha > 1) throw new RangeError('route alpha must be between 0 and 1');
  assertPositive(widthTiles, 'route widthTiles');

  const pointsQ = Object.freeze(points.map(normalizePoint));
  const segments = [];
  let totalLengthQ = 0;
  for (let index = 0; index < pointsQ.length - 1; index += 1) {
    const start = pointsQ[index];
    const end = pointsQ[index + 1];
    const lengthQ = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (lengthQ === 0) throw new RangeError(`route segment ${index} has zero length`);
    totalLengthQ += lengthQ;
    segments.push(Object.freeze({
      key: `${id}:${index}`,
      routeId: id,
      index,
      start,
      end,
      lengthQ,
      boundsQ: segmentBounds(start, end),
    }));
  }

  return Object.freeze({
    id,
    mode,
    color,
    alpha,
    widthTiles,
    pointsQ,
    segments: Object.freeze(segments),
    totalLengthQ,
  });
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
  return { x, y, width, height };
}

function intersects(left, right) {
  return left.x1 >= right.x0 && left.x0 <= right.x1
    && left.y1 >= right.y0 && left.y0 <= right.y1;
}

export function planOverworldOverlaySegments(view, routes, {
  tilePixels = 16,
  haloTiles = 1,
} = {}) {
  assertPositive(tilePixels, 'tilePixels');
  assertFinite(haloTiles, 'haloTiles');
  if (haloTiles < 0) throw new RangeError('haloTiles must be non-negative');
  const normalized = normalizeView(view);
  const scale = OVERWORLD_ROUTE_QUANTIZATION / tilePixels;
  const haloQ = Math.ceil(haloTiles * OVERWORLD_ROUTE_QUANTIZATION);
  const boundsQ = {
    x0: Math.floor(normalized.x * scale) - haloQ,
    y0: Math.floor(normalized.y * scale) - haloQ,
    x1: Math.ceil((normalized.x + normalized.width) * scale) + haloQ,
    y1: Math.ceil((normalized.y + normalized.height) * scale) + haloQ,
  };
  const planned = [];
  for (const route of routes || []) {
    for (const segment of route.segments || []) {
      if (!intersects(segment.boundsQ, boundsQ)) continue;
      planned.push(Object.freeze({ ...segment, route }));
    }
  }
  planned.sort((left, right) => compareText(left.routeId, right.routeId) || left.index - right.index);
  return Object.freeze(planned);
}

export function overworldRoutePosition(route, progress) {
  if (!route?.segments?.length || !Number.isFinite(route.totalLengthQ) || route.totalLengthQ <= 0) {
    throw new TypeError('route must be created by createOverworldRoute');
  }
  assertFinite(progress, 'progress');
  const clamped = Math.max(0, Math.min(1, progress));
  let remaining = route.totalLengthQ * clamped;
  let segment = route.segments[route.segments.length - 1];
  for (const candidate of route.segments) {
    segment = candidate;
    if (remaining <= candidate.lengthQ) break;
    remaining -= candidate.lengthQ;
  }
  const local = clamped === 1 ? 1 : Math.max(0, Math.min(1, remaining / segment.lengthQ));
  const xQ = segment.start[0] + (segment.end[0] - segment.start[0]) * local;
  const yQ = segment.start[1] + (segment.end[1] - segment.start[1]) * local;
  const tileX = xQ / OVERWORLD_ROUTE_QUANTIZATION;
  const tileY = yQ / OVERWORLD_ROUTE_QUANTIZATION;
  return Object.freeze({
    routeId: route.id,
    segmentIndex: segment.index,
    progress: clamped,
    xQ,
    yQ,
    tileX,
    tileY,
    pageX: Math.floor(tileX / OVERWORLD_RENDER_PAGE_TILES),
    pageY: Math.floor(tileY / OVERWORLD_RENDER_PAGE_TILES),
    chunkX: Math.floor(tileX / OVERWORLD_STORAGE_CHUNK_TILES),
    chunkY: Math.floor(tileY / OVERWORLD_STORAGE_CHUNK_TILES),
  });
}
