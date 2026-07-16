import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { SEOUL_GEO } from './seoul.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = SEOUL_GEO.meta.grid.w;
export const ROWS = SEOUL_GEO.meta.grid.h;
export const ENTRANCE = { ...SEOUL_GEO.entrance };

export const SEOUL_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(SEOUL_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameKo,
      desc: `서울의 대표 장소 「${poi.nameKo}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return SEOUL_COPY[locale]?.[id] || SEOUL_COPY.ko[id];
}

export const ZONES = [];

export const CITY_NODES = SEOUL_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameKo: poi.nameKo,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
  };
});

export const STATIONS = SEOUL_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameKo,
  nameKo: station.nameKo,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT = [
  {
    id: 'seoul-line-1', nameJa: '수도권 전철 1호선', mode: 'subway', color: 0x2f5ca8,
    stopIds: ['seoul', 'city-hall', 'jonggak', 'dongdaemun'],
    segmentMinutes: [3, 2, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    id: 'seoul-line-2', nameJa: '수도권 전철 2호선', mode: 'subway', color: 0x3b9b50,
    stopIds: ['hongik-university', 'city-hall', 'gangnam', 'samseong', 'jamsil'],
    segmentMinutes: [12, 25, 6, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
];

export const PROPS = [];

export function buildSeoulGrid() {
  const grid = Uint8Array.from(SEOUL_GEO.terrain);
  for (const [x, y] of SEOUL_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const SEOUL = {
  id: 'seoul', name: '서울', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'seoul',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: SEOUL_GEO.railways,
  CITY_TILE, buildGrid: buildSeoulGrid,
};

export default SEOUL;
