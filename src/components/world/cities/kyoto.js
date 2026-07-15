import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { KYOTO_GEO } from './kyoto.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = KYOTO_GEO.meta.grid.w;
export const ROWS = KYOTO_GEO.meta.grid.h;
const EXIT_TILES = [[404, 412], [404, 413]];
export const ENTRANCE = { x: 404, y: 422, facing: 'down' };

export const ZONES = [
  { id: 'imperial', label: '京都御所', bounds: [350, 130, 470, 240], labelTile: [415, 160] },
  { id: 'nijo', label: '二条', bounds: [280, 220, 390, 320], labelTile: [325, 235] },
  { id: 'gion', label: '祇園／東山', bounds: [450, 250, 610, 390], labelTile: [540, 285] },
  { id: 'kyoto-station', label: '京都駅', bounds: [350, 380, 480, 455], labelTile: [405, 395] },
  { id: 'fushimi', label: '伏見稲荷', bounds: [420, 455, 540, 560], labelTile: [500, 490] },
  { id: 'arashiyama', label: '嵐山', bounds: [0, 180, 150, 320], labelTile: [55, 205] },
];

export const CITY_NODES = KYOTO_GEO.pois.map((poi) => ({
  id: poi.id,
  kind: 'spot',
  name: poi.nameJa,
  facade: poi.kind === 'shrine' ? 'torii' : 'sign',
  tile: [poi.tile[0], poi.tile[1]],
  facing: 'down',
  noStamp: true,
  desc: `교토의 대표 장소 「${poi.nameJa}」(${poi.yomi}). 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
}));

export const STATIONS = KYOTO_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT = [
  {
    id: 'kyoto-sanin', nameJa: 'JR山陰線', mode: 'train', color: 0x8f6ab5,
    stopIds: ['kyoto', 'umekoji-kyotonishi', 'tambaguchi', 'nijo', 'emmachi', 'hanazono', 'uzumasa', 'saga-arashiyama'],
    segmentMinutes: [3, 3, 4, 3, 3, 3, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 12 },
    ],
  },
  {
    id: 'kyoto-nara', nameJa: 'JR奈良線', mode: 'train', color: 0xb45c4d,
    stopIds: ['kyoto', 'tofukuji', 'inari'], segmentMinutes: [3, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 12 },
    ],
  },
  {
    id: 'kyoto-city-bus', nameJa: '京都市バス', mode: 'bus', color: 0x4f8f62,
    stopIds: ['kyoto', 'nijo'], segmentMinutes: [24],
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 45 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 15 },
    ],
  },
];

export const PROPS = [];

export function buildKyotoGrid() {
  const grid = Uint8Array.from(KYOTO_GEO.terrain);
  for (const [x, y] of EXIT_TILES) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const KYOTO = {
  id: 'kyoto', name: '교토', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'kyoto',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: KYOTO_GEO.railways,
  CITY_TILE, buildGrid: buildKyotoGrid,
};

export default KYOTO;
