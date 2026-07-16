import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BUSAN_GEO } from './busan.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = BUSAN_GEO.meta.grid.w;
export const ROWS = BUSAN_GEO.meta.grid.h;
export const ENTRANCE = { ...BUSAN_GEO.entrance };

// 설정 언어 < 현지 언어 확장 예약. 지금은 ko 슬롯만 저작하며 컴포넌트는 이 중앙 lookup 결과만 소비한다.
export const BUSAN_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(BUSAN_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameKo,
      desc: `부산의 대표 장소 「${poi.nameKo}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return BUSAN_COPY[locale]?.[id] || BUSAN_COPY.ko[id];
}

export const ZONES = [];

export const CITY_NODES = BUSAN_GEO.pois.map((poi) => {
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

export const STATIONS = BUSAN_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameKo,
  nameKo: station.nameKo,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간과 운행 창은 게임 월드의 결정적 시뮬레이션 값이며 실제 시간표가 아니다.
export const TRANSIT = [
  {
    id: 'busan-line-1', nameJa: '부산도시철도 1호선', mode: 'subway', color: 0xe38b2c,
    stopIds: ['nampo', 'busan', 'seomyeon', 'dongnae-station', 'pnu-station'],
    segmentMinutes: [5, 10, 18, 7], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
  {
    id: 'busan-line-2', nameJa: '부산도시철도 2호선', mode: 'subway', color: 0x59a44b,
    stopIds: ['seomyeon', 'centum-city-station', 'haeundae-station'],
    segmentMinutes: [25, 10], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

// 파사드·랜드마크 프롭은 Claude 소유 후속 배선에서 추가한다.
export const PROPS = [];

export function buildBusanGrid() {
  const grid = Uint8Array.from(BUSAN_GEO.terrain);
  for (const [x, y] of BUSAN_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const BUSAN = {
  id: 'busan', name: '부산', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'busan',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: BUSAN_GEO.railways,
  CITY_TILE, buildGrid: buildBusanGrid,
};

export default BUSAN;
