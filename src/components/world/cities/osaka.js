import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { OSAKA_GEO } from './osaka.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = OSAKA_GEO.meta.grid.w;
export const ROWS = OSAKA_GEO.meta.grid.h;
const EXIT_TILES = [[414, 177], [414, 178]];
export const ENTRANCE = { x: 414, y: 187, facing: 'down' };

export const ZONES = [
  { id: 'umeda', label: '梅田', bounds: [350, 130, 480, 225], labelTile: [407, 155] },
  { id: 'osaka-castle', label: '大阪城', bounds: [500, 225, 620, 330], labelTile: [550, 245] },
  { id: 'namba', label: '難波／道頓堀', bounds: [390, 330, 510, 420], labelTile: [425, 345] },
  { id: 'tennoji', label: '天王寺', bounds: [420, 420, 560, 530], labelTile: [470, 505] },
  { id: 'bay', label: '大阪港', bounds: [60, 380, 210, 520], labelTile: [120, 410] },
];

export const CITY_NODES = OSAKA_GEO.pois.map((poi) => ({
  id: poi.id,
  kind: 'spot',
  name: poi.nameJa,
  facade: 'sign',
  tile: [poi.tile[0], poi.tile[1]],
  facing: 'down',
  noStamp: true,
  desc: `오사카의 대표 장소 「${poi.nameJa}」(${poi.yomi}). 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
}));

export const STATIONS = OSAKA_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT = [
  {
    id: 'osaka-loop', nameJa: '大阪環状線', mode: 'train', color: 0xd96b36,
    stopIds: ['osaka', 'fukushima', 'nishikujo', 'bentencho', 'taisho', 'shin-imamiya', 'tennoji', 'tsuruhashi', 'morinomiya', 'kyobashi', 'sakuranomiya', 'temma'],
    segmentMinutes: [3, 5, 4, 4, 5, 3, 6, 5, 4, 4, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 24 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 7 },
    ],
  },
  {
    id: 'osaka-shin-osaka-link', nameJa: '新大阪連絡線', mode: 'train', color: 0x4f96c8,
    stopIds: ['shin-osaka', 'osaka'], segmentMinutes: [5],
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

export const PROPS = [];

export function buildOsakaGrid() {
  const grid = Uint8Array.from(OSAKA_GEO.terrain);
  for (const [x, y] of EXIT_TILES) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const OSAKA = {
  id: 'osaka', name: '오사카', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'osaka',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: OSAKA_GEO.railways,
  CITY_TILE, buildGrid: buildOsakaGrid,
};

export default OSAKA;
