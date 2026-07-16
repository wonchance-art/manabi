import {
  findNearestOverworldRailSegment,
  normalizeOverworldRailDocuments,
} from './overworldRailGraphAudit.js';

const compareCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const pointKey = ([x, y]) => `${x},${y}`;
const keyPoint = (key) => Object.freeze(key.split(',').map(Number));

function assertHub(hub, label) {
  if (typeof hub?.id !== 'string' || hub.id.length === 0) {
    throw new TypeError(`${label}.id must be a non-empty string`);
  }
  if (!Array.isArray(hub.tile) || hub.tile.length !== 2 || !hub.tile.every(Number.isSafeInteger)) {
    throw new TypeError(`${label}.tile must be an integer pair`);
  }
}

function roundHalfAwayFromZero(value) {
  const rounded = value < 0 ? Math.ceil(value - 0.5) : Math.floor(value + 0.5);
  if (!Number.isSafeInteger(rounded)) throw new RangeError('rail projection exceeds the safe integer range');
  return rounded;
}

function snapHub(hub, normalized, maxSnapTiles) {
  const nearest = findNearestOverworldRailSegment(
    hub.tile,
    normalized.segments,
    normalized.quantization,
  );
  const snapDistanceTiles = nearest.distance / normalized.quantization;
  if (snapDistanceTiles >= maxSnapTiles) {
    throw new Error(`rail hub ${hub.id} is ${snapDistanceTiles.toFixed(6)} tiles from the network`);
  }
  return Object.freeze({
    hub,
    segment: nearest.segment,
    point: Object.freeze(nearest.projection.map(roundHalfAwayFromZero)),
    snapDistanceTiles,
  });
}

function graphIndex(segments) {
  const adjacency = new Map();
  const append = (from, to, segmentId, distance) => {
    const edges = adjacency.get(from);
    const edge = Object.freeze({ to, segmentId, distance });
    if (edges) edges.push(edge);
    else adjacency.set(from, [edge]);
  };
  for (const segment of segments) {
    const start = pointKey(segment.start);
    const end = pointKey(segment.end);
    const distance = Math.hypot(
      segment.end[0] - segment.start[0],
      segment.end[1] - segment.start[1],
    );
    append(start, end, segment.id, distance);
    append(end, start, segment.id, distance);
  }
  for (const edges of adjacency.values()) {
    edges.sort((left, right) => (
      compareCodePoint(left.to, right.to) || compareCodePoint(left.segmentId, right.segmentId)
    ));
  }
  return adjacency;
}

class MinHeap {
  constructor() {
    this.values = [];
  }

  static compare(left, right) {
    return left.distance - right.distance
      || compareCodePoint(left.node, right.node);
  }

  push(value) {
    const values = this.values;
    values.push(value);
    let index = values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (MinHeap.compare(values[parent], value) <= 0) break;
      values[index] = values[parent];
      index = parent;
    }
    values[index] = value;
  }

  pop() {
    if (this.values.length === 0) return null;
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      let child = left;
      if (right < this.values.length
        && MinHeap.compare(this.values[right], this.values[left]) < 0) child = right;
      if (MinHeap.compare(last, this.values[child]) <= 0) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

function shortestGraphPath(adjacency, start, terminal) {
  if (start === terminal) {
    return Object.freeze({ distance: 0, pointKeys: Object.freeze([start]), segmentIds: Object.freeze([]) });
  }
  const distanceByNode = new Map([[start, 0]]);
  const previous = new Map();
  const queue = new MinHeap();
  queue.push({ node: start, distance: 0 });

  while (queue.values.length > 0) {
    const current = queue.pop();
    if (current.distance !== distanceByNode.get(current.node)) continue;
    if (current.node === terminal) break;
    for (const edge of adjacency.get(current.node) || []) {
      const nextDistance = current.distance + edge.distance;
      const knownDistance = distanceByNode.get(edge.to);
      if (knownDistance !== undefined && knownDistance <= nextDistance) continue;
      distanceByNode.set(edge.to, nextDistance);
      previous.set(edge.to, Object.freeze({ node: current.node, segmentId: edge.segmentId }));
      queue.push({ node: edge.to, distance: nextDistance });
    }
  }
  if (!distanceByNode.has(terminal)) return null;

  const pointKeys = [terminal];
  const segmentIds = [];
  for (let current = terminal; current !== start;) {
    const step = previous.get(current);
    segmentIds.push(step.segmentId);
    current = step.node;
    pointKeys.push(current);
  }
  pointKeys.reverse();
  segmentIds.reverse();
  return Object.freeze({
    distance: distanceByNode.get(terminal),
    pointKeys: Object.freeze(pointKeys),
    segmentIds: Object.freeze(segmentIds),
  });
}

function appendUnique(values, value, key = (entry) => entry) {
  if (values.length === 0 || key(values[values.length - 1]) !== key(value)) values.push(value);
}

function candidateFromEndpoints(origin, terminal, graphPath) {
  const originEndpoint = keyPoint(graphPath.pointKeys[0]);
  const terminalEndpoint = keyPoint(graphPath.pointKeys[graphPath.pointKeys.length - 1]);
  const points = [];
  appendUnique(points, origin.point, pointKey);
  appendUnique(points, originEndpoint, pointKey);
  for (const key of graphPath.pointKeys) appendUnique(points, keyPoint(key), pointKey);
  appendUnique(points, terminalEndpoint, pointKey);
  appendUnique(points, terminal.point, pointKey);

  const segmentIds = [];
  if (pointKey(origin.point) !== pointKey(originEndpoint)) {
    appendUnique(segmentIds, origin.segment.id);
  }
  for (const id of graphPath.segmentIds) appendUnique(segmentIds, id);
  if (pointKey(terminal.point) !== pointKey(terminalEndpoint)) {
    appendUnique(segmentIds, terminal.segment.id);
  }
  const distance = Math.hypot(
    origin.point[0] - originEndpoint[0],
    origin.point[1] - originEndpoint[1],
  ) + graphPath.distance + Math.hypot(
    terminal.point[0] - terminalEndpoint[0],
    terminal.point[1] - terminalEndpoint[1],
  );
  return Object.freeze({
    distance,
    points: Object.freeze(points),
    segmentIds: Object.freeze(segmentIds),
    signature: JSON.stringify([points, segmentIds]),
  });
}

function directSegmentCandidate(origin, terminal) {
  if (origin.segment.id !== terminal.segment.id) return null;
  const points = origin.point[0] === terminal.point[0] && origin.point[1] === terminal.point[1]
    ? [origin.point]
    : [origin.point, terminal.point];
  return Object.freeze({
    distance: Math.hypot(
      origin.point[0] - terminal.point[0],
      origin.point[1] - terminal.point[1],
    ),
    points: Object.freeze(points),
    segmentIds: Object.freeze([origin.segment.id]),
    signature: JSON.stringify([points, [origin.segment.id]]),
  });
}

export function planOverworldRailPath({
  documents,
  origin,
  terminal,
  maxSnapTiles = 2,
} = {}) {
  assertHub(origin, 'origin');
  assertHub(terminal, 'terminal');
  if (origin.id === terminal.id) throw new Error('origin and terminal must differ');
  if (!Number.isFinite(maxSnapTiles) || maxSnapTiles <= 0) {
    throw new RangeError('maxSnapTiles must be a positive finite number');
  }

  const normalized = normalizeOverworldRailDocuments(documents);
  const originSnap = snapHub(origin, normalized, maxSnapTiles);
  const terminalSnap = snapHub(terminal, normalized, maxSnapTiles);
  const adjacency = graphIndex(normalized.segments);
  const candidates = [];
  const direct = directSegmentCandidate(originSnap, terminalSnap);
  if (direct) candidates.push(direct);
  for (const originEndpoint of [originSnap.segment.start, originSnap.segment.end]) {
    for (const terminalEndpoint of [terminalSnap.segment.start, terminalSnap.segment.end]) {
      const graphPath = shortestGraphPath(
        adjacency,
        pointKey(originEndpoint),
        pointKey(terminalEndpoint),
      );
      if (graphPath) candidates.push(candidateFromEndpoints(originSnap, terminalSnap, graphPath));
    }
  }
  if (candidates.length === 0) {
    throw new Error(`overworld rail path is disconnected: ${origin.id}:${terminal.id}`);
  }
  candidates.sort((left, right) => left.distance - right.distance
    || compareCodePoint(left.signature, right.signature));
  const best = candidates[0];
  return Object.freeze({
    formatVersion: 1,
    quantization: normalized.quantization,
    originId: origin.id,
    terminalId: terminal.id,
    originSnap: Object.freeze({
      pointQuantized: originSnap.point,
      segmentId: originSnap.segment.id,
      distanceTiles: originSnap.snapDistanceTiles,
    }),
    terminalSnap: Object.freeze({
      pointQuantized: terminalSnap.point,
      segmentId: terminalSnap.segment.id,
      distanceTiles: terminalSnap.snapDistanceTiles,
    }),
    distanceTiles: best.distance / normalized.quantization,
    pointsQuantized: best.points,
    segmentIds: best.segmentIds,
  });
}
