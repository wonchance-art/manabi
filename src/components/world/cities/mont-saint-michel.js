import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { MONT_SAINT_MICHEL_GEO } from './mont-saint-michel.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = MONT_SAINT_MICHEL_GEO.meta.grid.w;
export const ROWS = MONT_SAINT_MICHEL_GEO.meta.grid.h;
export const ENTRANCE = { ...MONT_SAINT_MICHEL_GEO.entrance };

export const CITY_NODES = MONT_SAINT_MICHEL_GEO.pois.map((poi) => ({
  id: poi.id,
  kind: 'spot',
  name: poi.nameFr,
  nameFr: poi.nameFr,
  contentLocale: poi.contentLocale,
  facade: 'sign',
  tile: [poi.tile[0], poi.tile[1]],
  facing: 'down',
  noStamp: true,
  ...(poi.id === 'abbey' ? {
    gate: Object.freeze({ type: 'story-scene', scene: 'msm-abbey-scene' }),
  } : {}),
}));

export function buildMontSaintMichelGrid() {
  const grid = Uint8Array.from(MONT_SAINT_MICHEL_GEO.terrain);
  for (const [x, y] of MONT_SAINT_MICHEL_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const MONT_SAINT_MICHEL = {
  id: 'mont-saint-michel',
  name: 'Mont-Saint-Michel',
  cols: COLS,
  rows: ROWS,
  metersPerTile: MONT_SAINT_MICHEL_GEO.meta.metersPerTile,
  tileSkins: MONT_SAINT_MICHEL_GEO.tileSkins,
  entrance: ENTRANCE,
  returnNode: 'mont-saint-michel',
  zones: [],
  nodes: CITY_NODES,
  stations: [],
  props: [],
  transit: [],
  transitPoints: [],
  railways: MONT_SAINT_MICHEL_GEO.railways,
  CITY_TILE,
  buildGrid: buildMontSaintMichelGrid,
};

export default MONT_SAINT_MICHEL;
