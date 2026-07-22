import { CITY_TILE, resolveArrivalTile } from './cities/terrain.js';

export const CITY_DISTRICT_VERSION = 'district-v1';
export const CITY_DISTRICT_LOCK_STYLE = 'guidebook';
export const CITY_DISTRICT_LOCK_DURATION_MS = 4200;

function invariant(condition, message) {
  if (!condition) throw new Error(`districts: ${message}`);
}

function validTile(tile) {
  return Array.isArray(tile) && tile.length === 2
    && Number.isInteger(tile[0]) && Number.isInteger(tile[1]);
}

function tileLabel(tile) {
  return validTile(tile) ? `${tile[0]},${tile[1]}` : String(tile);
}

export function cityDistrictOpenAt(resolved, tx, ty) {
  if (resolved == null) return true;
  if (!Number.isInteger(tx) || !Number.isInteger(ty)
      || tx < 0 || ty < 0 || tx >= resolved.cols || ty >= resolved.rows) return false;
  return resolved.open.some((district) => district.rects.some(
    ([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1,
  ));
}

function assertOpen(resolved, tile, label) {
  invariant(validTile(tile), `${label} tile must contain two integers`);
  invariant(cityDistrictOpenAt(resolved, tile[0], tile[1]), `${label} tile ${tileLabel(tile)} must be open`);
}

function freezeOpenDistrict(raw, index, cols, rows, usedIds) {
  invariant(raw && typeof raw === 'object', `open[${index}] must be an object`);
  invariant(typeof raw.id === 'string' && raw.id === raw.id.trim() && raw.id.length > 0,
    `open[${index}].id must be a non-empty trimmed string`);
  invariant(!usedIds.has(raw.id), `${raw.id} open id must be unique`);
  usedIds.add(raw.id);
  invariant(typeof raw.label === 'string' && raw.label === raw.label.trim() && raw.label.length > 0,
    `${raw.id}.label must be a non-empty trimmed string`);
  invariant(raw.tiles && typeof raw.tiles === 'object', `${raw.id}.tiles must be an object`);
  invariant(Array.isArray(raw.tiles.rects) && raw.tiles.rects.length > 0,
    `${raw.id}.tiles.rects must be a non-empty array`);

  const rects = raw.tiles.rects.map((rect, rectIndex) => {
    invariant(Array.isArray(rect) && rect.length === 4 && rect.every(Number.isInteger),
      `${raw.id}.tiles.rects[${rectIndex}] must contain four integers`);
    const [x0, y0, x1, y1] = rect;
    invariant(x0 <= x1 && y0 <= y1, `${raw.id}.tiles.rects[${rectIndex}] bounds must be ordered`);
    invariant(x0 >= 0 && y0 >= 0 && x1 < cols && y1 < rows,
      `${raw.id}.tiles.rects[${rectIndex}] must stay inside the city grid`);
    return Object.freeze([x0, y0, x1, y1]);
  });
  return Object.freeze({
    id: raw.id,
    label: raw.label,
    rects: Object.freeze(rects),
  });
}

function resolveTransitStops(city, grid, resolved) {
  const stops = [...(Array.isArray(city.stations) ? city.stations : []),
    ...(Array.isArray(city.transitPoints) ? city.transitPoints : [])];
  const stopIds = new Set();
  for (const line of Array.isArray(city.transit) ? city.transit : []) {
    for (const id of Array.isArray(line?.stopIds) ? line.stopIds : []) stopIds.add(id);
  }
  for (const id of stopIds) {
    const matches = stops.filter((stop) => stop?.id === id);
    invariant(matches.length === 1, `transit arrival ${id} must resolve exact-1`);
    assertOpen(resolved, matches[0].tile, `transit arrival ${id}`);
    const arrival = resolveArrivalTile(grid, resolved.cols, resolved.rows, matches[0].tile);
    invariant(arrival != null, `transit arrival ${id} must resolve to a walkable tile`);
    assertOpen(resolved, arrival, `resolved transit arrival ${id}`);
  }
}

function validateRuntimeAnchors(city, grid, resolved, mainRoute) {
  assertOpen(resolved, [city?.entrance?.x, city?.entrance?.y], 'spawn entrance');

  let exitCount = 0;
  for (let index = 0; index < grid.length; index += 1) {
    if (grid[index] !== CITY_TILE.EXIT) continue;
    exitCount += 1;
    assertOpen(resolved, [index % resolved.cols, Math.floor(index / resolved.cols)], 'return EXIT');
  }
  if (city.returnNode != null) invariant(exitCount > 0, 'returnNode requires at least one open EXIT tile');

  resolveTransitStops(city, grid, resolved);

  for (const node of Array.isArray(city.nodes) ? city.nodes : []) {
    if (node?.npc || node?.gate || node?.chapter || node?.reading) {
      assertOpen(resolved, node.tile, `node ${node.id ?? '<unknown>'}`);
    }
  }

  for (const tile of mainRoute?.path ?? []) assertOpen(resolved, tile, 'main route');
  for (const discovery of mainRoute?.discoveries ?? []) {
    assertOpen(resolved, discovery.tile, `discovery ${discovery.id}`);
  }
}

export function resolveCityDistricts(city, suppliedGrid, mainRoute = null) {
  if (city?.districts == null) return null;
  invariant(Number.isInteger(city?.cols) && city.cols > 0, 'city cols must be a positive integer');
  invariant(Number.isInteger(city?.rows) && city.rows > 0, 'city rows must be a positive integer');
  invariant(suppliedGrid && suppliedGrid.length === city.cols * city.rows,
    'grid size must match city dimensions');

  const raw = city.districts;
  invariant(raw && typeof raw === 'object', 'config must be an object');
  invariant(raw.version === CITY_DISTRICT_VERSION, `version must be ${CITY_DISTRICT_VERSION}`);
  invariant(Array.isArray(raw.open) && raw.open.length > 0, 'open must be a non-empty array');
  invariant(raw.locked && typeof raw.locked === 'object', 'locked must be an object');
  invariant(raw.locked.style === CITY_DISTRICT_LOCK_STYLE,
    `locked.style must be ${CITY_DISTRICT_LOCK_STYLE}`);
  invariant(typeof raw.locked.line === 'string' && raw.locked.line === raw.locked.line.trim()
    && raw.locked.line.length > 0, 'locked.line must be a non-empty trimmed string');

  const usedIds = new Set();
  const open = raw.open.map((district, index) => (
    freezeOpenDistrict(district, index, city.cols, city.rows, usedIds)
  ));
  const resolved = Object.freeze({
    version: CITY_DISTRICT_VERSION,
    cols: city.cols,
    rows: city.rows,
    open: Object.freeze(open),
    locked: Object.freeze({
      style: CITY_DISTRICT_LOCK_STYLE,
      line: raw.locked.line,
    }),
  });
  validateRuntimeAnchors(city, suppliedGrid, resolved, mainRoute);
  return resolved;
}
