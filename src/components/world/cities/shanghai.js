// 🏙️ 상하이 도시 정밀맵 — 실 OSM geo(#191, 429×390)를 CityScene 계약에 연결한다.
// 중국어권 3호: name = nameZhHant(스키마 canonical), nameZhHans 병기(학습 트랙 정합).
// desc 사실 검증 2026-07-17(연도 전승 헤지·정치 서술 배제 — 신톈디는 스쿠먼 건축·상업 재생만,
// 인민광장은 박물관·녹지만 서술. 브랜드 간판 일반화·인물 재현 금지 — 헌장 민감지역 규율).
// 황푸강 도선 = 홍콩 스타페리 문법 재사용: 양안 부두(와이탄·루자쭈이)를 transitPoints로 올린다.
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameZhHant 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { SHANGHAI_GEO } from './shanghai.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = SHANGHAI_GEO.meta.grid.w;
export const ROWS = SHANGHAI_GEO.meta.grid.h;
export const ENTRANCE = { ...SHANGHAI_GEO.entrance };

const SHANGHAI_DESC_KO = Object.freeze({
  'the-bund': '황푸강 서안을 따라 걷는 「外灘(와이탄)」. 20세기 초 은행·상관 건물들이 강변에 늘어서 있고, 맞은편엔 루자쭈이의 마천루가 마주 서요.',
  'oriental-pearl': '푸둥의 상징 「東方明珠(동방명주)」. 1990년대 중반 세워진 약 468m의 방송탑으로, 구슬을 꿴 듯한 실루엣이 멀리서도 눈에 띄어요.',
  'shanghai-tower': '나선형으로 비틀려 올라가는 「上海中心大廈(상하이타워)」. 2015년 무렵 완공된 약 632m 타워로, 중국에서 가장 높은 건물로 알려져 있어요.',
  lujiazui: '고층 빌딩이 숲을 이루는 「陸家嘴(루자쭈이)」. 황푸강이 크게 굽이치는 안쪽에 들어선 금융지구예요.',
  'yu-garden': '명대에 조성된 것으로 전해지는 강남 정원 「豫園(위위안)」. 연못 위 구곡교와 기암, 회랑이 이어지고 문 앞 거리에선 샤오룽바오 김이 올라와요.',
  'nanjing-road': '보행자 쇼핑 거리 「南京東路(난징둥루)」. 와이탄에서 인민광장까지, 네온 간판 아래로 사람의 물결이 이어져요.',
  'peoples-square': '도심 한가운데의 「人民廣場(인민광장)」. 잔디와 분수 곁에 박물관·미술관이 모여 있는 상하이의 중심점이에요.',
  xintiandi: '스쿠먼(石庫門) 벽돌 골목을 고쳐 만든 「新天地(신톈디)」. 옛 주택가의 돌문 안에 카페와 상점이 들어서 있어요.',
  tianzifang: '좁은 골목이 미로처럼 얽힌 「田子坊(톈쯔팡)」. 공방·화랑·찻집이 스쿠먼 골목 구석구석에 숨어 있어요.',
  'waibaidu-bridge': '쑤저우허가 황푸강과 만나는 어귀의 「外白渡橋(와이바이두교)」. 1900년대 초 놓인 것으로 전해지는 강철 트러스 다리예요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, 정체/간체 병기는 geo 필드 유지.
export const SHANGHAI_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(SHANGHAI_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameZhHant,
      desc: SHANGHAI_DESC_KO[poi.id] ?? `상하이의 대표 장소 「${poi.nameZhHant}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return SHANGHAI_COPY[locale]?.[id] || SHANGHAI_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'bund-nanjing', label: '와이탄·난징둥루', bounds: [86, 95, 209, 173], labelTile: [148, 134] },
  { id: 'peoples-square', label: '인민광장', bounds: [38, 128, 133, 212], labelTile: [86, 170] },
  { id: 'yuyuan', label: '위위안·라오청샹', bounds: [152, 173, 238, 251], labelTile: [195, 212] },
  { id: 'xintiandi', label: '신톈디', bounds: [71, 212, 152, 289], labelTile: [112, 251] },
  { id: 'tianzifang', label: '톈쯔팡', bounds: [24, 273, 105, 345], labelTile: [65, 309] },
  { id: 'lujiazui', label: '루자쭈이·푸둥', bounds: [209, 67, 343, 189], labelTile: [276, 128] },
];

export const CITY_NODES = SHANGHAI_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameZhHant: poi.nameZhHant,
    nameZhHans: poi.nameZhHans,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
  };
});

// ⚠️ nameJa = 레거시 표기 필드. 정체 canonical, 간체 병기 보존.
export const STATIONS = SHANGHAI_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameZhHant,
  nameZhHant: station.nameZhHant,
  nameZhHans: station.nameZhHans,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 황푸강 도선 양안 — ferry 루트 stopId 해석용(geo connectivity.ferryLink 계약 소비).
export const TRANSIT_POINTS = SHANGHAI_GEO.pois
  .filter((poi) => poi.routeId === 'huangpu-river-ferry')
  .map((poi) => ({
    id: poi.id,
    nameJa: poi.nameZhHant,
    nameZhHant: poi.nameZhHant,
    nameZhHans: poi.nameZhHans,
    contentLocale: poi.contentLocale,
    tile: [poi.tile[0], poi.tile[1]],
  }));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 2호선 유효 구간 실정차 순서(인민광장→난징둥루→루자쭈이 — 황푸강 하저 횡단).
    id: 'shanghai-metro-2', nameJa: '2號線', mode: 'subway', color: 0x97c024,
    stopIds: ['peoples-square-station', 'nanjing-east-station', 'lujiazui-station'],
    segmentMinutes: [2, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // 10호선 유효 구간(위위안→난징둥루 — 실인접 정차).
    id: 'shanghai-metro-10', nameJa: '10號線', mode: 'subway', color: 0xc6a1cf,
    stopIds: ['yuyuan-station', 'nanjing-east-station'],
    segmentMinutes: [3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    // 황푸강 도선 — 와이탄↔루자쭈이 양안 왕복(홍콩 스타페리 문법).
    id: 'huangpu-river-ferry', nameJa: '黃浦江輪渡', mode: 'ferry', color: 0xe8b23a,
    stopIds: ['the-bund', 'lujiazui'],
    segmentMinutes: [6],
    serviceWindows: [{ startMinute: 390, endMinute: 1380, headwayMinutes: 15 }],
  },
];

// 프롭(동방명주 실루엣·와이탄 파사드·도선 선체 등)은 렌더크래프트 후속.
export const PROPS = [];

export function buildShanghaiGrid() {
  const grid = Uint8Array.from(SHANGHAI_GEO.terrain);
  for (const [x, y] of SHANGHAI_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const SHANGHAI = {
  id: 'shanghai', name: '상하이', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'shanghai', // 오버월드 APAC 상하이 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: SHANGHAI_GEO.railways,
  CITY_TILE, buildGrid: buildShanghaiGrid,
};

export default SHANGHAI;
