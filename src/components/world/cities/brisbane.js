// 🏙️ 브리즈번 도시 정밀맵 — 실 OSM geo(#211, 544×557)를 CityScene 계약에 연결한다.
// 호주 1호·남반구 첫 도시(영어권 2호): name = nameEn canonical, ko desc에 「nameEn(한글명)」 병기(런던 패턴).
// desc 사실 검증 2026-07-17(연도 전승 헤지·QAGOMA 소장품 재현 금지·브랜드 일반화·인물 재현 금지).
// 시티캣 = 도선 문법 4번째: 양안 부두(리버사이드·사우스뱅크)는 geo transitPoints 계약 그대로 소비.
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameEn 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BRISBANE_GEO } from './brisbane.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = BRISBANE_GEO.meta.grid.w;
export const ROWS = BRISBANE_GEO.meta.grid.h;
export const ENTRANCE = { ...BRISBANE_GEO.entrance };

// 검증 desc — 브리즈번 11종
const BRISBANE_DESC_KO = Object.freeze({
  'story-bridge': '브리즈번강을 가로지르는 강철 캔틸레버교 「Story Bridge(스토리브리지)」. 1940년 무렵 개통된 것으로 전해지며, 도시 스카이라인의 상징이에요.',
  'kangaroo-point-cliffs': '강가의 현무암 절벽 「Kangaroo Point Cliffs(캥거루포인트 절벽)」. 절벽 위 산책로에서 도심 스카이라인이 강 건너로 펼쳐져요.',
  'south-bank-parklands': '도심 맞은편 강변 공원 「South Bank Parklands(사우스뱅크 파크랜드)」. 도시 한가운데 인공 해변 스트리츠비치가 있는 곳으로 알려져 있어요.',
  'wheel-of-brisbane': '사우스뱅크 초입의 대관람차 「Wheel of Brisbane(휠오브브리즈번)」. 한 바퀴 돌면 강과 도심이 한눈에 들어와요.',
  'queen-street-mall': '보행자 쇼핑 거리 「Queen Street Mall(퀸스트리트몰)」. 아케이드와 노천 카페가 이어지는 도심의 중심축이에요.',
  'brisbane-city-hall': '킹조지 광장의 「Brisbane City Hall(브리즈번 시청)」. 1930년 무렵 완공된 것으로 전해지는 시계탑 건물 — 종소리가 광장에 울려요.',
  'city-botanic-gardens': '도심 강굽이 안쪽의 「City Botanic Gardens(시티 보태닉 가든)」. 19세기 식민지 시대 정원에서 출발한 것으로 전해지는 오래된 식물원이에요.',
  'roma-street-parkland': '역 곁의 큰 정원 「Roma Street Parkland(로마스트리트 파크랜드)」. 도심 속 아열대 정원으로 알려져 있어요.',
  qagoma: '강변의 미술관 단지 「QAGOMA(퀸즐랜드 미술관·GOMA)」. 이 게임에선 건물 외관과 위치만 담아요.',
  'howard-smith-wharves': '스토리브리지 아래 강변 부두를 고친 「Howard Smith Wharves(하워드스미스 워브스)」. 옛 부두 창고가 강변 라운지로 바뀐 곳이에요.',
  'new-farm-park': '강굽이의 「New Farm Park(뉴팜 파크)」. 장미 정원과 큰 무화과 나무 그늘로 알려진 시민 공원이에요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, en 원문 학습축은 도어·씬에서 소비.
export const BRISBANE_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(BRISBANE_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameEn,
      desc: BRISBANE_DESC_KO[poi.id] ?? `브리즈번의 대표 장소 「${poi.nameEn}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return BRISBANE_COPY[locale]?.[id] || BRISBANE_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'cbd', label: '시티(CBD)', bounds: [173, 211, 272, 306], labelTile: [223, 259] },
  { id: 'south-bank', label: '사우스뱅크', bounds: [148, 278, 227, 356], labelTile: [188, 317] },
  { id: 'kangaroo-point', label: '캥거루포인트', bounds: [237, 278, 306, 373], labelTile: [272, 326] },
  { id: 'fortitude-valley', label: '포티튜드밸리', bounds: [237, 156, 321, 234], labelTile: [279, 195] },
  { id: 'new-farm', label: '뉴팜', bounds: [296, 223, 385, 306], labelTile: [341, 265] },
  { id: 'roma-street', label: '로마스트리트', bounds: [109, 211, 188, 278], labelTile: [149, 245] },
];

export const CITY_NODES = BRISBANE_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameEn: poi.nameEn,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
  };
});

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 영어 도시는 nameEn을 그대로 싣는다(yomi 공란).
export const STATIONS = BRISBANE_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameEn,
  nameEn: station.nameEn,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 시티캣 양안 부두 — ferry 루트 stopId 해석용(geo connectivity.ferryLink 계약 소비).
export const TRANSIT_POINTS = (BRISBANE_GEO.transitPoints || []).map((point) => ({
  id: point.id,
  nameJa: point.nameEn,
  nameEn: point.nameEn,
  contentLocale: point.contentLocale,
  tile: [point.tile[0], point.tile[1]],
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 노스코스트선 유효 구간 실인접 정차(로마스트리트→센트럴→포티튜드밸리).
    id: 'brisbane-north-coast', nameJa: 'North Coast line', mode: 'train', color: 0x2b7de0,
    stopIds: ['roma-street', 'central', 'fortitude-valley'],
    segmentMinutes: [2, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    // 메리베일선 강 건너 구간(로마스트리트→사우스브리즈번).
    id: 'brisbane-merivale', nameJa: 'Merivale line', mode: 'train', color: 0x7bb36e,
    stopIds: ['roma-street', 'south-brisbane'],
    segmentMinutes: [3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
  {
    // 시티캣 도선 — 리버사이드↔사우스뱅크(스타페리 문법 4번째).
    id: 'citycat-riverside-south-bank', nameJa: 'CityCat', mode: 'ferry', color: 0x2e7d9e,
    stopIds: ['riverside-ferry', 'south-bank-ferry'],
    segmentMinutes: [7],
    serviceWindows: [{ startMinute: 360, endMinute: 1380, headwayMinutes: 15 }],
  },
];

// 🛳️ 렌더크래프트 R1 — 기존 kind 재사용 배치. 스토리브리지 실루엣 등 신규 kind는 베이킹 스펙 후속.
export const PROPS = [
  { kind: 'storybridge', tile: [277, 244] },   // 스토리브리지 아치(R3)
  { kind: 'ferry_dom', tile: [221, 310] }, // 시티캣 선체(리버사이드~사우스뱅크 중간)
  { kind: 'stall', tile: [219, 273] },     // 퀸스트리트몰 노점
];

export function buildBrisbaneGrid() {
  const grid = Uint8Array.from(BRISBANE_GEO.terrain);
  for (const [x, y] of BRISBANE_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const BRISBANE = {
  id: 'brisbane', name: '브리즈번', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'brisbane', // 오버월드 APAC 브리즈번 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: BRISBANE_GEO.railways,
  CITY_TILE, buildGrid: buildBrisbaneGrid,
};

export default BRISBANE;
