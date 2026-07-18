// 🏙️ 홍콩 도시 정밀맵 — 실 OSM geo(#183, 618×390)를 CityScene 계약에 연결한다.
// 중국어권 2호: name = nameZhHant(현지 정체 canonical), nameZhHans 병기(학습 트랙 정합).
// desc 사실 검증 2026-07-17(연도 전승 헤지·정치 서술 배제·인물 초상/핸드프린트 재현 금지 — 헌장 민감지역 규율).
// 스타페리 = 부산↔하카타 페리 문법 재사용: 양안 부두를 transitPoints로 올려 ferry 루트 정차지를 해석한다.
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameZhHant 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { HONG_KONG_GEO } from './hong-kong.geo.js';
import { HONG_KONG_DOORS } from '../hongKongDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = HONG_KONG_GEO.meta.grid.w;
export const ROWS = HONG_KONG_GEO.meta.grid.h;
export const ENTRANCE = { ...HONG_KONG_GEO.entrance };

const HONG_KONG_DESC_KO = Object.freeze({
  'victoria-peak': '홍콩섬의 지붕 「太平山頂(빅토리아픽)」. 전망대에서 빅토리아항과 주룽 반도의 마천루 숲이 한눈에 내려다보여요.',
  'star-ferry-tst': '주룽 쪽 도선장 「天星碼頭(스타페리 침사추이 부두)」. 19세기 말부터 이어져 온 항구 도선으로, 지금도 바다 건너 센트럴을 오가요.',
  'star-ferry-central': '홍콩섬 쪽 도선장 「天星碼頭(스타페리 센트럴 부두)」. 짧은 뱃길이지만 빅토리아항의 스카이라인을 가장 가까이서 볼 수 있어요.',
  'clock-tower': '침사추이 바닷가의 「前九廣鐵路鐘樓(구 구광철도 시계탑)」. 1915년 무렵 세워진 것으로 전해지는 옛 기차역의 흔적이에요.',
  'tst-promenade': '바다를 따라 걷는 「尖沙咀海濱花園(침사추이 해변 산책로)」. 해 질 녘이면 맞은편 홍콩섬의 불빛이 물 위에 번져요.',
  'temple-street': '밤이 되면 살아나는 「廟街夜市(템플스트리트 야시장)」. 노점 사이로 뚝배기 요리 냄새와 광둥어 흥정 소리가 오가는 거리예요.',
  'mongkok-ladies': '몽콕의 노천 시장 「女人街(레이디스 마켓)」. 퉁초이가를 따라 잡화·의류 노점이 빽빽하게 늘어서요.',
  'man-mo-temple': '문(文)과 무(武)의 신을 모시는 「文武廟(만모사원)」. 1847년경 지어진 것으로 전해지며, 천장에 매달린 나선형 향이 인상적이에요.',
  'mid-levels-escalator': '언덕 도시의 발이 되어 주는 「半山自動扶梯(미드레벨 에스컬레이터)」. 세계에서 가장 긴 옥외 에스컬레이터 축으로 알려져 있어요.',
  'central-statue-square': '센트럴 한복판의 「皇后像廣場(황후상광장)」. 오래된 석조 건축과 고층 빌딩이 마주 보는 광장이에요.',
  'victoria-park': '코즈웨이베이 곁의 큰 공원 「維多利亞公園(빅토리아공원)」. 이른 아침이면 잔디밭에서 태극권을 하는 사람들을 볼 수 있어요.',
  'kowloon-park': '침사추이 뒤편의 녹지 「九龍公園(주룽공원)」. 번화가 바로 옆이라고 믿기 어려울 만큼 조용한 쉼터예요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, 정체/간체 병기는 geo 필드 유지.
export const HONG_KONG_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(HONG_KONG_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameZhHant,
      desc: HONG_KONG_DESC_KO[poi.id] ?? `홍콩의 대표 장소 「${poi.nameZhHant}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return HONG_KONG_COPY[locale]?.[id] || HONG_KONG_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'tsim-sha-tsui', label: '침사추이', bounds: [335, 139, 412, 223], labelTile: [374, 181] },
  { id: 'jordan-mongkok', label: '조던·몽콕', bounds: [324, 28, 402, 156], labelTile: [363, 92] },
  { id: 'central', label: '센트럴', bounds: [247, 234, 350, 306], labelTile: [299, 270] },
  { id: 'admiralty-wanchai', label: '애드미럴티·완차이', bounds: [324, 262, 438, 323], labelTile: [381, 293] },
  { id: 'causeway-bay', label: '코즈웨이베이', bounds: [412, 245, 489, 301], labelTile: [451, 273] },
  { id: 'the-peak', label: '빅토리아픽', bounds: [196, 306, 299, 378], labelTile: [248, 342] },
];

// 중국어 도어 배치 타일 — geo 보행 타일 나선 탐색 계산치(기존 노드·프롭과 체비쇼프 ≥2 이격).
const HONG_KONG_DOOR_TILES = Object.freeze({
  'zh-07': [357, 199], // 페리 매표소(스타페리)
  'zh-08': [310, 274], // 차찬텡(센트럴)
  'zh-09': [451, 269], // 트램 정류장(코즈웨이베이)
});

export const CITY_NODES = [
  ...HONG_KONG_GEO.pois.map((poi) => {
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
  }),
  // 중국어 문화 도어 3종(zh-07~09 — 타이베이와 별개 신규 세트, 광둥어는 문화 각주로만).
  ...HONG_KONG_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.name,
    nameZh: door.nameZh,
    contentLocale: 'zh',
    facade: 'sign',
    tile: [...HONG_KONG_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].zh} ${door.lines[0].pinyin} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa = 레거시 표기 필드. 정체 canonical, 간체 병기 보존.
export const STATIONS = HONG_KONG_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameZhHant,
  nameZhHant: station.nameZhHant,
  nameZhHans: station.nameZhHans,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 스타페리 양안 부두 — ferry 루트 stopId 해석용(역이 아닌 도선장이라 transitPoints로 올린다).
export const TRANSIT_POINTS = HONG_KONG_GEO.pois
  .filter((poi) => poi.kind === 'ferry-terminal')
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
    // 취안완선 유효 구간 실정차 순서(센트럴→진스청→침사추이→몽콕 방면).
    id: 'hong-kong-tsuen-wan', nameJa: '荃灣線', mode: 'subway', color: 0xe2231a,
    stopIds: ['central', 'admiralty', 'tsim-sha-tsui', 'mong-kok'],
    segmentMinutes: [2, 5, 6], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // 빅토리아항 도선 — 침사추이↔센트럴 양안 왕복(부산↔하카타 페리 문법).
    id: 'star-ferry-victoria-harbour', nameJa: '天星小輪', mode: 'ferry', color: 0x2e7d5b,
    stopIds: ['star-ferry-tst', 'star-ferry-central'],
    segmentMinutes: [9],
    serviceWindows: [{ startMinute: 390, endMinute: 1410, headwayMinutes: 12 }],
  },
];

// 🛳️ 렌더크래프트 R1 — 기존 kind 재사용 배치(수면=선체·보행=노점/네온, 노드 이격 ≥2 계산치).
// 시계탑·정크선 등 신규 실루엣 kind는 CityScene 베이킹 스펙(#150) 후속.
export const PROPS = [
  { kind: 'ferry_dom', tile: [335, 220] }, // 빅토리아항 스타페리 선체(양안 부두 중간)
  { kind: 'stall', tile: [362, 125] },     // 템플스트리트 야시장 노점
  { kind: 'stall', tile: [367, 58] },      // 레이디스 마켓 노점
  { kind: 'neon', tile: [358, 70] },       // 몽콕 네온 간판
];

export function buildHongKongGrid() {
  const grid = Uint8Array.from(HONG_KONG_GEO.terrain);
  for (const [x, y] of HONG_KONG_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const HONG_KONG = {
  id: 'hong-kong', name: '홍콩', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'hong-kong', // 오버월드 APAC 홍콩 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: HONG_KONG_GEO.railways,
  CITY_TILE, buildGrid: buildHongKongGrid,
};

export default HONG_KONG;
