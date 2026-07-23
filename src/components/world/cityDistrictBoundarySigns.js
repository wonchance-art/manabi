import {
  CITY_DISTRICT_VERSION,
  cityDistrictOpenAt,
} from './cityDistricts.js';
import { CITY_TILE, isCityWalkable } from './cities/terrain.js';

export const CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING = 8;
export const CITY_DISTRICT_BOUNDARY_SIGN_KIND = 'district_boundary_signpost';

const CARDINAL_NEIGHBORS = Object.freeze([
  Object.freeze([0, -1]),
  Object.freeze([1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([-1, 0]),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`district boundary signs: ${message}`);
}

function boundaryTerrainPriority(code) {
  if (code === CITY_TILE.ROAD || code === CITY_TILE.CROSSWALK || code === CITY_TILE.BRIDGE) {
    return 0;
  }
  if (code === CITY_TILE.EXIT || !isCityWalkable(code)) return null;
  return 1;
}

function touchesLockedDistrict(resolved, x, y) {
  return CARDINAL_NEIGHBORS.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < resolved.cols && ny < resolved.rows
      && !cityDistrictOpenAt(resolved, nx, ny);
  });
}

function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * 개방 rect union의 외곽을 훑어 잠금 지구와 맞닿은 개방 쪽 보행 타일에 팻말을 배치한다.
 * 도로 계열을 다른 보행면보다 먼저 고르고, 동률은 y→x 순서로 고정한다.
 */
export function planCityDistrictBoundarySigns(resolved, grid) {
  if (resolved == null) return Object.freeze([]);
  invariant(resolved.version === CITY_DISTRICT_VERSION,
    `version must be ${CITY_DISTRICT_VERSION}`);
  invariant(Number.isInteger(resolved.cols) && resolved.cols > 0
    && Number.isInteger(resolved.rows) && resolved.rows > 0,
  'resolved dimensions must be positive integers');
  invariant(grid && grid.length === resolved.cols * resolved.rows,
    'grid size must match resolved dimensions');
  invariant(Array.isArray(resolved.open) && resolved.open.length > 0,
    'resolved open districts must be a non-empty array');

  const candidates = new Map();
  const consider = (x, y) => {
    if (!cityDistrictOpenAt(resolved, x, y) || !touchesLockedDistrict(resolved, x, y)) return;
    const priority = boundaryTerrainPriority(grid[y * resolved.cols + x]);
    if (priority == null) return;
    candidates.set(`${x},${y}`, { x, y, priority });
  };

  for (const district of resolved.open) {
    invariant(Array.isArray(district?.rects) && district.rects.length > 0,
      'each resolved open district must contain rects');
    for (const rect of district.rects) {
      invariant(Array.isArray(rect) && rect.length === 4 && rect.every(Number.isInteger),
        'each resolved rect must contain four integers');
      const [x0, y0, x1, y1] = rect;
      invariant(x0 >= 0 && y0 >= 0 && x0 <= x1 && y0 <= y1
        && x1 < resolved.cols && y1 < resolved.rows,
      'resolved rect bounds must be ordered inside the city grid');
      for (let x = x0; x <= x1; x += 1) {
        consider(x, y0);
        if (y1 !== y0) consider(x, y1);
      }
      for (let y = y0 + 1; y < y1; y += 1) {
        consider(x0, y);
        if (x1 !== x0) consider(x1, y);
      }
    }
  }

  const ordered = [...candidates.values()].sort(
    (a, b) => a.priority - b.priority || a.y - b.y || a.x - b.x,
  );
  const selected = [];
  for (const candidate of ordered) {
    if (selected.some((other) => (
      chebyshevDistance(candidate, other) < CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING
    ))) continue;
    selected.push(candidate);
  }

  return Object.freeze(selected.map(({ x, y }) => Object.freeze({
    kind: CITY_DISTRICT_BOUNDARY_SIGN_KIND,
    tile: Object.freeze([x, y]),
  })));
}
