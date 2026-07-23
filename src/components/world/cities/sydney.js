// 🏙️ 시드니 도시 정밀맵 — 실 OSM geo(#216, 648×780)를 CityScene 계약에 연결한다.
// 호주 2호(영어권 3호): name = nameEn canonical, ko desc에 「nameEn(한글명)」 병기(런던 패턴).
// desc 사실 검증 2026-07-18(연도 전승 헤지·오페라하우스 외관 실루엣만 — IP 유의·타롱가 위치만·브랜드 일반화).
// 하버 페리 3노선 = 첫 다분기 도선(스타페리 문법 5번째): geo ferryLinks 계약을 TRANSIT 3루트로 소비.
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameEn 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { SYDNEY_GEO } from './sydney.geo.js';
import { SYDNEY_DOORS } from '../sydneyDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = SYDNEY_GEO.meta.grid.w;
export const ROWS = SYDNEY_GEO.meta.grid.h;
export const ENTRANCE = { ...SYDNEY_GEO.entrance };

// 검증 desc — 시드니 14종
const SYDNEY_DESC_KO = Object.freeze({
  'opera-house': '베넬롱 포인트의 「Sydney Opera House(시드니 오페라하우스)」. 1973년 무렵 완공된 것으로 전해지는 조개껍질 지붕의 건축 — 이 게임에선 외관 실루엣만 담아요. 세계유산.',
  'harbour-bridge': '항구를 가로지르는 강철 아치 「Sydney Harbour Bridge(하버브리지)」. 1932년 개통으로 전해지며, \'옷걸이\'라는 애칭으로 불리기도 해요.',
  'the-rocks': '식민지 시대 골목이 남은 「The Rocks(록스)」. 사암 창고 건물과 주말 마켓이 이어지는 시드니에서 가장 오래된 동네로 알려져 있어요.',
  'circular-quay': '페리가 드나드는 항구 광장 「Circular Quay(서큘러키)」. 오페라하우스와 하버브리지 사이 — 시드니 뱃길의 출발점이에요.',
  'royal-botanic-garden': '하버를 감싸는 「Royal Botanic Garden(왕립식물원)」. 1816년 기원으로 전해지는 오래된 식물원 — 미세스 매쿼리 포인트에서 오페라하우스와 다리가 한 프레임에 들어와요.',
  'darling-harbour': '수족관·박물관이 모인 수변 「Darling Harbour(달링하버)」. 저녁이면 항구 불빛이 수면에 번지는 산책로예요.',
  barangaroo: '옛 부두를 고친 수변 지구 「Barangaroo(바랑가루)」. 사암 곶 공원과 강변 산책로가 이어져요.',
  qvb: '로마네스크풍 돔의 「Queen Victoria Building(퀸빅토리아빌딩)」. 1898년 무렵 지어진 것으로 전해지는 아케이드 백화점 건물이에요.',
  chinatown: '헤이마켓의 「Chinatown(차이나타운)」. 패디스 마켓과 딤섬 집이 이어지는 골목 — 밤이면 야시장이 서기도 해요.',
  'newtown-king-st': '빈티지 숍과 서점, 세계 각국 식당이 이어지는 「King Street, Newtown(뉴타운 킹스트리트)」. 대학가 특유의 자유로운 공기가 흘러요.',
  paddington: '테라스 하우스의 동네 「Paddington(패딩턴)」. 철제 레이스 발코니가 이어지는 옥스퍼드 스트리트의 부티크 거리예요.',
  'bondi-beach': '초승달 모양 백사장 「Bondi Beach(본다이비치)」. 서퍼들의 성지로 알려져 있고, 해안 절벽을 따라 쿠지까지 산책로가 이어져요.',
  manly: '페리로 닿는 해변 마을 「Manly(맨리)」. 서큘러키에서 배로 건너와 코르소를 걸으면 바로 바다가 나와요.',
  'watsons-bay': '하버 초입의 어촌 마을 「Watsons Bay(왓슨스베이)」. 절벽 전망대 \'갭\'에서 태평양이 한눈에 펼쳐져요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, en 원문 학습축은 도어·씬에서 소비.
export const SYDNEY_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(SYDNEY_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameEn,
      desc: SYDNEY_DESC_KO[poi.id] ?? `시드니의 대표 장소 「${poi.nameEn}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return SYDNEY_COPY[locale]?.[id] || SYDNEY_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'quay-rocks', label: '서큘러키·록스', bounds: [148, 334, 222, 417], labelTile: [185, 376] },
  { id: 'cbd', label: '시티(CBD)', bounds: [129, 417, 222, 529], labelTile: [176, 473] },
  { id: 'darling', label: '달링하버·바랑가루', bounds: [92, 362, 153, 501], labelTile: [123, 432] },
  { id: 'paddington', label: '패딩턴·서리힐스', bounds: [194, 490, 300, 584], labelTile: [247, 537] },
  { id: 'newtown', label: '뉴타운·시드니대', bounds: [23, 512, 116, 640], labelTile: [70, 576] },
  { id: 'bondi', label: '본다이', bounds: [393, 512, 532, 601], labelTile: [463, 557] },
  { id: 'manly', label: '맨리', bounds: [499, 0, 578, 83], labelTile: [539, 42] },
  { id: 'harbour-north', label: '하버 북안', bounds: [300, 195, 555, 362], labelTile: [428, 279] },
];

// 영어 도어 배치 타일 — geo 보행 타일 나선 탐색 계산치(기존 노드·프롭과 체비쇼프 ≥2 이격).
const SYDNEY_DOOR_TILES = Object.freeze({
  'en-07': [187, 397], // 페리 매표소(서큘러키)
  'en-08': [482, 562], // 서프 렌탈(본다이)
  'en-09': [61, 598],  // 브런치 카페(뉴타운)
  'en-10': [260, 527], // 주말 마켓(패딩턴)
  'en-11': [179, 385], // 호스텔 라운지(록스)
  'en-12': [516, 295], // 전망대(왓슨스베이 갭)
});

export const CITY_NODES = [
  ...SYDNEY_GEO.pois.map((poi) => {
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
  }),
  // 영어 문화 도어 6종(en-07~12 — 런던과 별개 신규 세트) — track 명시 라우팅.
  ...SYDNEY_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameEn,
    nameEn: door.nameEn,
    contentLocale: 'en',
    facade: 'sign',
    tile: [...SYDNEY_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].en} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 영어 도시는 nameEn을 그대로 싣는다(yomi 공란).
export const STATIONS = SYDNEY_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameEn,
  nameEn: station.nameEn,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 하버 페리 부두 4종 — 다분기 ferry 루트 stopId 해석용(geo ferryLinks 계약 소비).
export const TRANSIT_POINTS = (SYDNEY_GEO.transitPoints || []).map((point) => ({
  id: point.id,
  nameJa: point.nameEn,
  nameEn: point.nameEn,
  contentLocale: point.contentLocale,
  tile: [point.tile[0], point.tile[1]],
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 시티서클 유효 구간 실인접 정차(센트럴→타운홀→서큘러키).
    id: 'sydney-city-circle', nameJa: 'City Circle', mode: 'subway', color: 0xf6bd27,
    stopIds: ['central', 'town-hall', 'circular-quay-station'],
    segmentMinutes: [2, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // 이스턴서버브스선 유효 구간(타운홀→마틴플레이스→본다이정션 방면).
    id: 'sydney-eastern-suburbs', nameJa: 'Eastern Suburbs line', mode: 'subway', color: 0x1e9d8b,
    stopIds: ['town-hall', 'martin-place', 'bondi-junction'],
    segmentMinutes: [2, 6], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    // 하버 페리 F1 — 서큘러키↔맨리(다분기 도선 1).
    id: 'sydney-ferry-manly', nameJa: 'Manly Ferry', mode: 'ferry', color: 0x2e7d5b,
    stopIds: ['circular-quay-ferry', 'manly-ferry'],
    segmentMinutes: [18],
    serviceWindows: [{ startMinute: 360, endMinute: 1380, headwayMinutes: 20 }],
  },
  {
    // 하버 페리 F2 — 서큘러키↔타롱가(다분기 도선 2).
    id: 'sydney-ferry-taronga', nameJa: 'Taronga Ferry', mode: 'ferry', color: 0x3a8fb5,
    stopIds: ['circular-quay-ferry', 'taronga-ferry'],
    segmentMinutes: [12],
    serviceWindows: [{ startMinute: 420, endMinute: 1320, headwayMinutes: 30 }],
  },
  {
    // 하버 페리 F9 — 서큘러키↔왓슨스베이(다분기 도선 3).
    id: 'sydney-ferry-watsons-bay', nameJa: 'Watsons Bay Ferry', mode: 'ferry', color: 0xe8a13a,
    stopIds: ['circular-quay-ferry', 'watsons-bay-ferry'],
    segmentMinutes: [16],
    serviceWindows: [{ startMinute: 420, endMinute: 1320, headwayMinutes: 40 }],
  },
];

// 🛳️ 렌더크래프트 R1 — 기존 kind 재사용 배치. 오페라하우스·하버브리지 실루엣은 베이킹 스펙 후속.
export const PROPS = [
  { kind: 'operahouse', tile: [211, 370] },    // 오페라하우스 조개 지붕 실루엣(R3)
  { kind: 'ferry_intl', tile: [260, 300] }, // 맨리 페리 대형 선체(하버 항로)
  { kind: 'ferry_dom', tile: [211, 379] },  // 서큘러키 앞 페리
  { kind: 'stall', tile: [161, 503] },      // 차이나타운 패디스 노점
];

export function buildSydneyGrid() {
  const grid = Uint8Array.from(SYDNEY_GEO.terrain);
  for (const [x, y] of SYDNEY_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const SYDNEY = {
  id: 'sydney', name: '시드니', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'sydney', // 오버월드 APAC 시드니 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: SYDNEY_GEO.railways,
  // 📖 여행책 지구제 v1 — T10 r3 실측 rect.
  districts: {
    version: 'district-v1',
    open: [
      { id: 'cbd-harbour', label: '시티·하버', tiles: { rects: [[120, 330, 225, 530]] } },
      {
        id: 'inner-south-east',
        label: '도심 남동부',
        tiles: { rects: [[40, 560, 90, 620], [240, 500, 280, 550], [330, 540, 380, 580]] },
      },
      {
        id: 'bondi-watsons',
        label: '본다이·왓슨스베이',
        tiles: { rects: [[450, 270, 540, 330], [450, 540, 510, 590]] },
      },
      {
        id: 'harbour-north',
        label: '하버 북안',
        tiles: { rects: [[310, 285, 350, 330], [515, 25, 565, 75], [240, 285, 280, 315]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  tileSkins: Object.freeze({ building: 'terracotta' }), // R4 — 시드니 교외 테라코타 지붕 톤
  CITY_TILE, buildGrid: buildSydneyGrid,
};

export default SYDNEY;
