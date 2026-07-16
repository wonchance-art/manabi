const compareCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function assertIntegerPair(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isSafeInteger)) {
    throw new TypeError(`${label} must be an integer pair`);
  }
}

const pointKey = ([x, y]) => `${x},${y}`;

export function normalizeOverworldRailDocuments(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new TypeError('rail documents must be a non-empty array');
  }
  let quantization = null;
  const segments = new Map();
  for (const [documentIndex, document] of documents.entries()) {
    if (document?.formatVersion !== 1 || document?.kind !== 'rail-segments'
      || !Number.isSafeInteger(document.quantization) || document.quantization <= 0
      || !Array.isArray(document.segments)) {
      throw new Error(`invalid rail document at index ${documentIndex}`);
    }
    if (quantization === null) quantization = document.quantization;
    else if (document.quantization !== quantization) throw new Error('rail document quantization mismatch');
    for (const [segmentIndex, segment] of document.segments.entries()) {
      if (typeof segment?.id !== 'string' || segment.id.length === 0) {
        throw new TypeError(`rail segment id is invalid at ${documentIndex}:${segmentIndex}`);
      }
      assertIntegerPair(segment.start, `${segment.id}.start`);
      assertIntegerPair(segment.end, `${segment.id}.end`);
      if (segment.start[0] === segment.end[0] && segment.start[1] === segment.end[1]) {
        throw new Error(`rail segment ${segment.id} has zero length`);
      }
      const canonical = JSON.stringify(segment);
      const existing = segments.get(segment.id);
      if (existing && existing.canonical !== canonical) {
        throw new Error(`rail segment halo copy drifted: ${segment.id}`);
      }
      if (!existing) segments.set(segment.id, { canonical, segment });
    }
  }
  if (segments.size === 0) throw new Error('rail documents contain no segments');
  return Object.freeze({
    quantization,
    segments: Object.freeze([...segments.values()]
      .map(({ segment }) => segment)
      .sort((left, right) => compareCodePoint(left.id, right.id))),
  });
}

function componentIndex(segments) {
  const parent = new Map();
  const ensure = (value) => {
    if (!parent.has(value)) parent.set(value, value);
  };
  const find = (value) => {
    let root = value;
    while (parent.get(root) !== root) root = parent.get(root);
    let current = value;
    while (parent.get(current) !== current) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  const union = (first, second) => {
    ensure(first);
    ensure(second);
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot === secondRoot) return;
    const [keep, replace] = [firstRoot, secondRoot].sort(compareCodePoint);
    parent.set(replace, keep);
  };
  for (const segment of segments) union(pointKey(segment.start), pointKey(segment.end));

  const membersByRoot = new Map();
  for (const node of [...parent.keys()].sort(compareCodePoint)) {
    const root = find(node);
    const members = membersByRoot.get(root);
    if (members) members.push(node);
    else membersByRoot.set(root, [node]);
  }
  const componentByNode = new Map();
  for (const members of membersByRoot.values()) {
    const componentId = members.sort(compareCodePoint)[0];
    for (const node of members) componentByNode.set(node, componentId);
  }
  return Object.freeze({ componentByNode, componentCount: membersByRoot.size, nodeCount: parent.size });
}

export function findNearestOverworldRailSegment(tile, segments, quantization) {
  const point = [tile[0] * quantization, tile[1] * quantization];
  let best = null;
  for (const segment of segments) {
    const [ax, ay] = segment.start;
    const [bx, by] = segment.end;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = Math.max(0, Math.min(1,
      ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared));
    const projection = [ax + ratio * dx, ay + ratio * dy];
    const distance = Math.hypot(point[0] - projection[0], point[1] - projection[1]);
    if (!best || distance < best.distance
      || (distance === best.distance && compareCodePoint(segment.id, best.segment.id) < 0)) {
      best = { distance, projection, ratio, segment };
    }
  }
  return Object.freeze({
    ...best,
    projection: Object.freeze(best.projection),
  });
}

export function auditOverworldRailGraph({ documents, hubs, maxSnapTiles = 2 } = {}) {
  if (!Array.isArray(hubs) || hubs.length === 0) throw new TypeError('rail hubs must be a non-empty array');
  if (!Number.isFinite(maxSnapTiles) || maxSnapTiles <= 0) {
    throw new RangeError('maxSnapTiles must be a positive finite number');
  }
  const normalized = normalizeOverworldRailDocuments(documents);
  const components = componentIndex(normalized.segments);
  const ids = new Set();
  const hubReports = hubs.map((hub, index) => {
    if (typeof hub?.id !== 'string' || hub.id.length === 0) throw new TypeError(`rail hub id is invalid at ${index}`);
    if (ids.has(hub.id)) throw new Error(`duplicate rail hub id: ${hub.id}`);
    ids.add(hub.id);
    assertIntegerPair(hub.tile, `${hub.id}.tile`);
    const nearest = findNearestOverworldRailSegment(hub.tile, normalized.segments, normalized.quantization);
    const snapDistanceTiles = nearest.distance / normalized.quantization;
    if (snapDistanceTiles >= maxSnapTiles) {
      throw new Error(`rail hub ${hub.id} is ${snapDistanceTiles.toFixed(6)} tiles from the network`);
    }
    return Object.freeze({
      id: hub.id,
      tile: Object.freeze([...hub.tile]),
      nearestSegmentId: nearest.segment.id,
      snapDistanceTiles,
      componentId: components.componentByNode.get(pointKey(nearest.segment.start)),
    });
  }).sort((left, right) => compareCodePoint(left.id, right.id));
  return Object.freeze({
    formatVersion: 1,
    quantization: normalized.quantization,
    segmentCount: normalized.segments.length,
    nodeCount: components.nodeCount,
    componentCount: components.componentCount,
    hubs: Object.freeze(hubReports),
  });
}
