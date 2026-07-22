// 🏙️ 보르도 도시 정밀맵 — 실 OSM geo(#358, 474×501)를 CityScene 계약에 연결한다.
// 불어권 확장 2호. 프랑스어권 문법(name=nameFr canonical, contentLocale 'fr') — 리옹 패턴.
// desc 사실 검증 2026-07-22(달의 항구 세계유산 2007·물의 거울 전승 헤지, 와인 샤토·상호 무표기).
// 🎨 R4 terracotta(석회암 도심이지만 지붕 톤은 남서부 오렌지 — 리옹과 동일 배정).
// fr 도어 7호 세트·트램 상세는 별도 라운드. 게이트는 Codex-1 후속(생장역 기준, 발주 5043686863).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BORDEAUX_GEO } from './bordeaux.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = BORDEAUX_GEO.meta.grid.w;
export const ROWS = BORDEAUX_GEO.meta.grid.h;
export const ENTRANCE = { ...BORDEAUX_GEO.entrance };

const BORDEAUX_DESC_KO = Object.freeze({
  'place-de-la-bourse': '강변의 반달형 광장 「Place de la Bourse」. 18세기 왕립 광장으로 지어졌고, 앞마당의 얕은 수반 「물의 거울」에 건물이 비치는 풍경으로 알려져요.',
  'grosse-cloche': '중세 성문 위의 큰 종 「Grosse Cloche」. 옛 시청 종루로, 종이 도시 자치의 상징이었다고 전해져요.',
  'cathedrale-saint-andre': '고딕 대성당 「Cathédrale Saint-André」. 곁에 홀로 선 페베를랑 종탑에 오르면 도심 지붕이 한눈에 들어와요.',
  'place-des-quinconces': '유럽에서 손꼽히게 너른 광장 「Place des Quinconces」. 지롱드 기념비의 분수 조각이 광장 북쪽 끝을 장식해요.',
  'cite-du-vin': '와인 문화관 「La Cité du Vin」. 디캔터를 닮은 곡면 건물로, 세계 와인 문화를 다루는 전시관이에요 — 전망층에서 가론강이 굽어보여요.',
  'rue-sainte-catherine': '보행자 거리 「Rue Sainte-Catherine」. 1km를 넘는 길이로 유럽에서 가장 긴 보행 상점가의 하나로 꼽혀요.',
  'pont-de-pierre': '가론강의 첫 다리 「Pont de Pierre」. 19세기 초 건설로 전해지며, 아치가 강 곡류를 따라 길게 이어져요.',
  'jardin-public': '도심의 영국식 정원 「Jardin Public」. 18세기 조성으로 전해지는 산책 정원으로, 연못과 회전목마가 있어요.',
  chartrons: '와인 상인들의 옛 지구 「Les Chartrons」. 강변 창고 거리가 골동품 상점과 카페 골목으로 바뀐 동네예요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameFr canonical.
export const BORDEAUX_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(BORDEAUX_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: BORDEAUX_DESC_KO[poi.id] ?? `보르도의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return BORDEAUX_COPY[locale]?.[id] || BORDEAUX_COPY.ko[id];
}

// 구역 라벨 — POI·역 tile 포함 관계 검증 계산치.
export const ZONES = [
  { id: 'vieux-bordeaux', label: '구시가·부르스', bounds: [235, 195, 315, 260], labelTile: [270, 228] },
  { id: 'quinconces', label: '캥콩스·샤르트롱', bounds: [235, 140, 300, 195], labelTile: [263, 168] },
  { id: 'jardin', label: '퍼블릭 정원', bounds: [230, 160, 258, 195], labelTile: [244, 176] },
  { id: 'bassins', label: '시테뒤뱅·수변', bounds: [320, 80, 400, 140], labelTile: [358, 108] },
  { id: 'saint-jean', label: '생장역', bounds: [300, 270, 370, 330], labelTile: [335, 295] },
  { id: 'garonne', label: '가론강', bounds: [280, 100, 360, 260], labelTile: [325, 180] },
];

export const CITY_NODES = [
  ...BORDEAUX_GEO.pois.map((poi) => {
    const copy = poiCopy(poi.id);
    return {
      id: poi.id,
      kind: 'spot',
      name: copy.name,
      nameFr: poi.nameFr,
      contentLocale: poi.contentLocale,
      facade: 'sign',
      tile: [poi.tile[0], poi.tile[1]],
      facing: 'down',
      noStamp: true,
      desc: copy.desc,
    };
  }),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = BORDEAUX_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT_POINTS = [];

// 생장 단독역 — 표시 전용(루트 최소 2역 계약, 베이징 선례). 트램 축은 후속 라운드.
export const TRANSIT = [];

// ⛲ 렌더크래프트 — 기존 kind 재사용 배치(보행 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'fountain', tile: [257, 190] },  // 캥콩스 지롱드 기념비 분수
  { kind: 'stall', tile: [277, 210] },     // 부르스 곁 강변 좌판
  { kind: 'parasol', tile: [352, 96] },    // 시테뒤뱅 수변 파라솔
];

export function buildBordeauxGrid() {
  const grid = Uint8Array.from(BORDEAUX_GEO.terrain);
  for (const [x, y] of BORDEAUX_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const BORDEAUX = {
  id: 'bordeaux', name: '보르도', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'bordeaux', // 오버월드 EMEA 게이트는 Codex-1 후속(생장역 기준)
  // 📖 여행책 지구제 v1 (D2 — T5 실측 docs/proposal-district-rects.md 후보 그대로, 오너 승인 순서 2호).
  // 빈 벌판(도어·NPC 0)을 잠그고 완성 코스만 개방 — 개방 4.97%, 필수 gate 3/3 포함 사전검증 PASS.
  districts: {
    version: 'district-v1',
    open: [
      { id: 'gare-saint-jean', label: '생장역 일대', tiles: { rects: [[305, 285, 365, 325]] } },
      { id: 'centre-historique', label: '역사 지구', tiles: { rects: [[235, 188, 315, 255]] } },
      { id: 'nord-rive', label: '샤르트롱·북강변', tiles: { rects: [[235, 140, 290, 187], [335, 85, 370, 115]] } },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: BORDEAUX_GEO.railways,
  // 🎨 R4 — 남서부 오렌지 지붕 톤.
  tileSkins: Object.freeze({ building: 'terracotta' }),
  CITY_TILE, buildGrid: buildBordeauxGrid,
};

export default BORDEAUX;
