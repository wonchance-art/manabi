import { CITY_TILE } from './terrain.js';

function invariant(condition, message) {
  if (!condition) throw new Error(`French city runtime adapter: ${message}`);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function localeNames(entry) {
  return Object.fromEntries(Object.entries(entry).filter(([key, value]) => (
    /^name[A-Z]/.test(key) && isNonEmptyString(value)
  )));
}

function validateTile(tile, grid, label) {
  invariant(Array.isArray(tile) && tile.length === 2, `${label} tile must be [x,y]`);
  const [x, y] = tile;
  invariant(Number.isInteger(x) && Number.isInteger(y), `${label} tile must use integers`);
  invariant(x >= 0 && y >= 0 && x < grid.w && y < grid.h, `${label} tile is outside the grid`);
}

function validateUniqueIds(entries, label) {
  const ids = new Set();
  for (const entry of entries) {
    invariant(isNonEmptyString(entry.id), `${label} id is required`);
    invariant(!ids.has(entry.id), `duplicate ${label} id ${entry.id}`);
    ids.add(entry.id);
  }
  return ids;
}

function findCopyValue(copyByLocale, localeOrder, id, field) {
  for (const locale of localeOrder) {
    const value = copyByLocale?.[locale]?.[id]?.[field];
    if (isNonEmptyString(value)) return value;
  }
  return null;
}

function validateGeo(id, geo, runtimeNameField) {
  invariant(geo && typeof geo === 'object', 'geo is required');
  invariant(geo.meta?.city === id, `geo city ${geo.meta?.city} does not match ${id}`);
  const grid = geo.meta?.grid;
  invariant(Number.isInteger(grid?.w) && grid.w > 0, 'grid width must be a positive integer');
  invariant(Number.isInteger(grid?.h) && grid.h > 0, 'grid height must be a positive integer');
  invariant(geo.terrain instanceof Uint8Array, 'terrain must be Uint8Array');
  invariant(geo.terrain.length === grid.w * grid.h, 'terrain length does not match the grid');
  invariant(isNonEmptyString(geo.meta?.contentLocale), 'meta.contentLocale is required');
  invariant(isNonEmptyString(geo.meta?.schema?.nameField), 'meta.schema.nameField is required');
  invariant(isNonEmptyString(runtimeNameField), 'runtimeNameField is required');
  invariant(/^name[A-Z]/.test(runtimeNameField), 'runtimeNameField must be a localized name field');
  invariant(Array.isArray(geo.pois), 'pois must be an array');
  invariant(Array.isArray(geo.stations), 'stations must be an array');
  invariant(Array.isArray(geo.exitTiles), 'exitTiles must be an array');
  validateUniqueIds(geo.pois, 'POI');
  validateUniqueIds(geo.stations, 'station');
  for (const entry of [...geo.pois, ...geo.stations]) {
    validateTile(entry.tile, grid, entry.id);
    invariant(isNonEmptyString(entry[runtimeNameField]), `${entry.id} is missing ${runtimeNameField}`);
  }
  for (const [index, tile] of geo.exitTiles.entries()) validateTile(tile, grid, `exit ${index}`);
  validateTile([geo.entrance?.x, geo.entrance?.y], grid, 'entrance');
  if (geo.railways?.mask) {
    invariant(geo.railways.mask instanceof Uint8Array, 'railway mask must be Uint8Array');
    invariant(geo.railways.mask.length === geo.terrain.length, 'railway mask length mismatch');
  }
}

export function createFrenchCityRuntimeAdapter({
  id,
  displayName,
  geo,
  returnNode,
  runtimeNameField = geo?.meta?.schema?.nameField,
  displayLocale = geo?.meta?.contentLocale,
  fallbackLocales = [],
  copyByLocale = {},
  zones = [],
  props = [],
  transit = [],
  transitPoints = [],
  defaultFacade = 'sign',
}) {
  invariant(isNonEmptyString(id), 'id is required');
  invariant(isNonEmptyString(displayName), 'displayName is required');
  invariant(isNonEmptyString(returnNode), 'returnNode is required');
  invariant(isNonEmptyString(displayLocale), 'displayLocale is required');
  invariant(Array.isArray(fallbackLocales), 'fallbackLocales must be an array');
  invariant(fallbackLocales.every(isNonEmptyString), 'fallbackLocales must contain locale strings');
  validateGeo(id, geo, runtimeNameField);

  const localeOrder = [...new Set([displayLocale, ...fallbackLocales])];
  const nodes = geo.pois.map((poi) => {
    const copyName = findCopyValue(copyByLocale, localeOrder, poi.id, 'name');
    const copyDesc = findCopyValue(copyByLocale, localeOrder, poi.id, 'desc');
    const primaryName = poi[runtimeNameField];
    return Object.freeze({
      id: poi.id,
      kind: 'spot',
      poiKind: poi.kind,
      name: copyName ?? primaryName,
      ...localeNames(poi),
      contentLocale: poi.contentLocale ?? geo.meta.contentLocale,
      facade: poi.facade ?? defaultFacade,
      tile: Object.freeze([poi.tile[0], poi.tile[1]]),
      facing: poi.facing ?? 'down',
      noStamp: poi.noStamp ?? true,
      ...(copyDesc ? { desc: copyDesc } : {}),
    });
  });

  const stations = geo.stations.map((station) => Object.freeze({
    id: station.id,
    ...localeNames(station),
    nameJa: station[runtimeNameField],
    yomi: station.yomi ?? '',
    contentLocale: station.contentLocale ?? geo.meta.contentLocale,
    tile: Object.freeze([station.tile[0], station.tile[1]]),
    line: station.line,
    ...(station.routeId ? { routeId: station.routeId } : {}),
  }));

  const stationIds = new Set(stations.map(({ id: stationId }) => stationId));
  for (const line of transit) {
    invariant(isNonEmptyString(line?.id), 'transit id is required');
    invariant(Array.isArray(line.stopIds), `transit ${line.id} stopIds must be an array`);
    for (const stopId of line.stopIds) {
      invariant(stationIds.has(stopId), `transit ${line.id} references unknown station ${stopId}`);
    }
  }

  const buildGrid = () => {
    const grid = Uint8Array.from(geo.terrain);
    for (const [x, y] of geo.exitTiles) grid[y * geo.meta.grid.w + x] = CITY_TILE.EXIT;
    return grid;
  };

  return Object.freeze({
    id,
    name: displayName,
    cols: geo.meta.grid.w,
    rows: geo.meta.grid.h,
    entrance: Object.freeze({ ...geo.entrance }),
    returnNode,
    zones: Object.freeze([...zones]),
    nodes: Object.freeze(nodes),
    stations: Object.freeze(stations),
    props: Object.freeze([...props]),
    transit: Object.freeze([...transit]),
    transitPoints: Object.freeze([...transitPoints]),
    railways: geo.railways,
    CITY_TILE,
    buildGrid,
  });
}
