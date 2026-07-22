import { CITY_TILE, isCityBlocked } from './cities/terrain.js';

const ROUTE_DIRECTIONS = Object.freeze([
  Object.freeze({ direction: 'U', dx: 0, dy: -1 }),
  Object.freeze({ direction: 'R', dx: 1, dy: 0 }),
  Object.freeze({ direction: 'D', dx: 0, dy: 1 }),
  Object.freeze({ direction: 'L', dx: -1, dy: 0 }),
]);
const DIRECTION_BY_ID = new Map(ROUTE_DIRECTIONS.map((entry) => [entry.direction, entry]));
const WAYPOINT_KINDS = Object.freeze({ node: 'nodes', station: 'stations' });
const SHA256_HEX = /^[0-9a-f]{64}$/;

function invariant(condition, message) {
  if (!condition) throw new Error(`mainRoute: ${message}`);
}

function frozenRef(ref) {
  return Object.freeze({ kind: ref.kind, id: ref.id });
}

export function mainRouteRefKey(ref) {
  invariant(ref && Object.hasOwn(WAYPOINT_KINDS, ref.kind), 'waypoint kind must be node or station');
  invariant(typeof ref.id === 'string' && ref.id.length > 0, 'waypoint id must be a non-empty string');
  return `${ref.kind}:${ref.id}`;
}

function routeGrid(city, suppliedGrid) {
  const grid = suppliedGrid ?? city?.buildGrid?.();
  invariant(Number.isInteger(city?.cols) && city.cols > 0, 'city cols must be a positive integer');
  invariant(Number.isInteger(city?.rows) && city.rows > 0, 'city rows must be a positive integer');
  invariant(grid && grid.length === city.cols * city.rows, 'grid size must match city dimensions');
  return grid;
}

function validTile(tile) {
  return Array.isArray(tile) && tile.length === 2
    && Number.isInteger(tile[0]) && Number.isInteger(tile[1]);
}

function routeTileAllowed(grid, cols, rows, tile) {
  if (!validTile(tile)) return false;
  const [x, y] = tile;
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  const code = grid[y * cols + x];
  return code !== CITY_TILE.EXIT && !isCityBlocked(code);
}

function resolveWaypoint(city, ref, grid) {
  const key = mainRouteRefKey(ref);
  const collection = Array.isArray(city[WAYPOINT_KINDS[ref.kind]])
    ? city[WAYPOINT_KINDS[ref.kind]]
    : [];
  const matches = collection.filter((entry) => entry?.id === ref.id);
  invariant(matches.length === 1, `${key} must resolve exact-1`);
  invariant(routeTileAllowed(grid, city.cols, city.rows, matches[0].tile), `${key} must be walkable and non-EXIT`);
  return Object.freeze({ key, ref: frozenRef(ref), tile: Object.freeze([...matches[0].tile]) });
}

function validateRouteHeader(city, grid) {
  const route = city?.mainRoute;
  if (route == null) return null;
  invariant(typeof route.id === 'string' && route.id.length > 0, 'id must be a non-empty string');
  invariant(route.version === 1, 'version must be 1');
  invariant(route.routing?.algorithm === 'cardinal-bfs-v1', 'algorithm must be cardinal-bfs-v1');
  invariant(route.routing?.neighborOrder === 'URDL', 'neighborOrder must be URDL');
  invariant(route.routing?.excludeExit === true, 'excludeExit must be true');
  invariant(Array.isArray(route.waypoints) && route.waypoints.length >= 2, 'at least two waypoints are required');
  const waypoints = route.waypoints.map((ref) => resolveWaypoint(city, ref, grid));
  invariant(new Set(waypoints.map(({ key }) => key)).size === waypoints.length, 'waypoints must be unique');
  return { route, waypoints };
}

function hintKey(from, to) {
  return `${mainRouteRefKey(from)}--${mainRouteRefKey(to)}`;
}

function routeHints(route, waypoints, grid, city) {
  const hints = Array.isArray(route.segmentHints) ? route.segmentHints : [];
  const adjacent = new Set(waypoints.slice(1).map((to, index) => `${waypoints[index].key}--${to.key}`));
  const byPair = new Map();
  for (const hint of hints) {
    const key = hintKey(hint?.from, hint?.to);
    invariant(adjacent.has(key), `${key} hint must target adjacent waypoints`);
    invariant(!byPair.has(key), `${key} hint must be unique`);
    const viaTiles = Array.isArray(hint.viaTiles) ? hint.viaTiles : [];
    for (const tile of viaTiles) {
      invariant(routeTileAllowed(grid, city.cols, city.rows, tile), `${key} hint tile must be walkable and non-EXIT`);
    }
    byPair.set(key, viaTiles.map((tile) => Object.freeze([...tile])));
  }
  return byPair;
}

function bfsLeg(grid, cols, rows, from, to) {
  const start = from[1] * cols + from[0];
  const target = to[1] * cols + to[0];
  if (start === target) return [start];
  const previous = new Int32Array(grid.length);
  previous.fill(-2);
  previous[start] = -1;
  const queue = new Int32Array(grid.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;

  while (head < tail && previous[target] === -2) {
    const index = queue[head++];
    const x = index % cols;
    const y = Math.floor(index / cols);
    for (const { dx, dy } of ROUTE_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = ny * cols + nx;
      if (previous[next] !== -2 || !routeTileAllowed(grid, cols, rows, [nx, ny])) continue;
      previous[next] = index;
      queue[tail++] = next;
    }
  }
  invariant(previous[target] !== -2, `no route from ${from.join(',')} to ${to.join(',')}`);
  const reversed = [];
  for (let index = target; index !== -1; index = previous[index]) reversed.push(index);
  reversed.reverse();
  return reversed;
}

function pathStepsRle(pathIndices, cols) {
  const runs = [];
  for (let index = 1; index < pathIndices.length; index += 1) {
    const delta = pathIndices[index] - pathIndices[index - 1];
    const direction = delta === -cols ? 'U'
      : delta === 1 ? 'R'
        : delta === cols ? 'D'
          : delta === -1 ? 'L'
            : null;
    invariant(direction, 'planned path must be cardinal');
    const last = runs.at(-1);
    if (last?.direction === direction) last.count += 1;
    else runs.push({ direction, count: 1 });
  }
  return Object.freeze(runs.map((run) => Object.freeze(run)));
}

function joinLegs(legs) {
  const path = [];
  for (const leg of legs) path.push(...(path.length ? leg.slice(1) : leg));
  return path;
}

export function encodeMainRoutePathIndices(pathIndices) {
  const bytes = new Uint8Array(pathIndices.length * 4);
  const view = new DataView(bytes.buffer);
  pathIndices.forEach((index, offset) => view.setUint32(offset * 4, index, true));
  return bytes;
}

export function planCityMainRoute(city, suppliedGrid) {
  const grid = routeGrid(city, suppliedGrid);
  const header = validateRouteHeader(city, grid);
  if (!header) return null;
  const { route, waypoints } = header;
  const hints = routeHints(route, waypoints, grid, city);
  const segments = [];

  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1];
    const to = waypoints[index];
    const key = `${from.key}--${to.key}`;
    const viaTiles = hints.get(key) ?? [];
    const stops = [from.tile, ...viaTiles, to.tile];
    const pathIndices = joinLegs(stops.slice(1).map((stop, stopIndex) => (
      bfsLeg(grid, city.cols, city.rows, stops[stopIndex], stop)
    )));
    segments.push(Object.freeze({
      id: key,
      from: from.ref,
      to: to.ref,
      stepsRle: pathStepsRle(pathIndices, city.cols),
      stepCount: pathIndices.length - 1,
      tileCount: pathIndices.length,
      pathIndices: Object.freeze(pathIndices),
      pathBytes: encodeMainRoutePathIndices(pathIndices),
    }));
  }
  return Object.freeze({
    id: route.id,
    version: route.version,
    waypoints: Object.freeze(waypoints),
    segments: Object.freeze(segments),
  });
}

function decodeStoredSegment(city, grid, stored, from, to) {
  const expectedId = `${from.key}--${to.key}`;
  invariant(stored?.id === expectedId, `${expectedId} segment id mismatch`);
  invariant(mainRouteRefKey(stored.from) === from.key, `${expectedId} from mismatch`);
  invariant(mainRouteRefKey(stored.to) === to.key, `${expectedId} to mismatch`);
  invariant(Array.isArray(stored.stepsRle), `${expectedId} stepsRle must be an array`);
  invariant(SHA256_HEX.test(stored.pathSha256), `${expectedId} pathSha256 must be lowercase SHA-256`);

  const pathIndices = [from.tile[1] * city.cols + from.tile[0]];
  let x = from.tile[0];
  let y = from.tile[1];
  let stepCount = 0;
  for (const run of stored.stepsRle) {
    const direction = DIRECTION_BY_ID.get(run?.direction);
    invariant(direction && Number.isInteger(run.count) && run.count > 0, `${expectedId} has invalid RLE run`);
    for (let count = 0; count < run.count; count += 1) {
      x += direction.dx;
      y += direction.dy;
      invariant(routeTileAllowed(grid, city.cols, city.rows, [x, y]), `${expectedId} enters blocked, EXIT, or out-of-range tile`);
      pathIndices.push(y * city.cols + x);
      stepCount += 1;
    }
  }
  invariant(x === to.tile[0] && y === to.tile[1], `${expectedId} must end at its waypoint`);
  invariant(stored.stepCount === stepCount, `${expectedId} stepCount mismatch`);
  invariant(stored.tileCount === pathIndices.length, `${expectedId} tileCount mismatch`);
  return Object.freeze({
    id: expectedId,
    from: from.ref,
    to: to.ref,
    stepsRle: stored.stepsRle,
    stepCount,
    tileCount: pathIndices.length,
    pathSha256: stored.pathSha256,
    pathIndices: Object.freeze(pathIndices),
  });
}

function routeTiles(pathIndices, cols) {
  return Object.freeze(pathIndices.map((index) => Object.freeze([index % cols, Math.floor(index / cols)])));
}

function chebyshev(left, right) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

function adjacentOffsets(path, routeIndex) {
  const current = path[routeIndex];
  const next = path[Math.min(path.length - 1, routeIndex + 1)];
  const previous = path[Math.max(0, routeIndex - 1)];
  let dx = next[0] - current[0];
  let dy = next[1] - current[1];
  if (dx === 0 && dy === 0) {
    dx = current[0] - previous[0];
    dy = current[1] - previous[1];
  }
  const candidates = [[dy, -dx], [-dy, dx], [0, -1], [1, 0], [0, 1], [-1, 0]];
  const seen = new Set();
  return candidates.filter(([ox, oy]) => {
    const key = `${ox},${oy}`;
    if ((ox === 0 && oy === 0) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function planRouteProps(city, grid, path, waypointOffsets, routeSet) {
  const occupiedMarkers = [
    ...(city.nodes ?? []),
    ...(city.stations ?? []),
    ...(city.props ?? []),
  ].map((entry) => entry?.tile).filter(validTile);
  const candidates = [];
  for (let index = 1; index < waypointOffsets.length - 1; index += 1) {
    // RFC의 +2 후보는 waypoint 이격 ≥3 추가 승인과 양립하지 않아, 첫 허용 거리인 +3을 쓴다.
    candidates.push({ kind: 'route_signpost', routeIndex: Math.min(path.length - 1, waypointOffsets[index] + 3) });
  }
  for (let routeIndex = 12; routeIndex < path.length; routeIndex += 12) {
    candidates.push({ kind: 'route_streetlight', routeIndex });
  }

  const props = [];
  const kindCounts = new Map();
  for (const candidate of candidates) {
    const [x, y] = path[candidate.routeIndex];
    let tile = null;
    for (const [ox, oy] of adjacentOffsets(path, candidate.routeIndex)) {
      const next = [x + ox, y + oy];
      if (!routeTileAllowed(grid, city.cols, city.rows, next)) continue;
      if (routeSet.has(next[1] * city.cols + next[0])) continue;
      if (occupiedMarkers.some((marker) => chebyshev(marker, next) < 3)) continue;
      if (props.some((prop) => chebyshev(prop.tile, next) < 12)) continue;
      tile = next;
      break;
    }
    if (!tile) continue;
    const kindCount = (kindCounts.get(candidate.kind) ?? 0) + 1;
    kindCounts.set(candidate.kind, kindCount);
    props.push(Object.freeze({
      id: `${candidate.kind}-${String(kindCount).padStart(2, '0')}`,
      kind: candidate.kind,
      tile: Object.freeze(tile),
      routeIndex: candidate.routeIndex,
    }));
  }
  return Object.freeze(props);
}

export function resolveCityMainRoute(city, suppliedGrid) {
  if (city?.mainRoute == null) return null;
  const grid = routeGrid(city, suppliedGrid);
  const header = validateRouteHeader(city, grid);
  const { route, waypoints } = header;
  invariant(Array.isArray(route.segments), 'segments must be an array');
  invariant(route.segments.length === waypoints.length - 1, 'segment count must equal waypoint count minus one');

  const segments = route.segments.map((stored, index) => (
    decodeStoredSegment(city, grid, stored, waypoints[index], waypoints[index + 1])
  ));
  const pathIndices = joinLegs(segments.map((segment) => segment.pathIndices));
  const waypointOffsets = [0];
  for (const segment of segments) waypointOffsets.push(waypointOffsets.at(-1) + segment.stepCount);
  const path = routeTiles(pathIndices, city.cols);
  const tileSet = new Set(pathIndices);
  const props = planRouteProps(city, grid, path, waypointOffsets, tileSet);
  return Object.freeze({
    id: route.id,
    version: route.version,
    segments: Object.freeze(segments),
    pathIndices: Object.freeze(pathIndices),
    path,
    waypointOffsets: Object.freeze(waypointOffsets),
    tileSet,
    props,
  });
}

export function cityMainRouteTileAt(resolvedRoute, cols, tx, ty) {
  return resolvedRoute?.tileSet?.has(ty * cols + tx) ?? false;
}
