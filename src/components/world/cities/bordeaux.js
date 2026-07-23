// 🏙️ 보르도 도시 정밀맵 — 실 OSM geo(#358, 474×501)를 CityScene 계약에 연결한다.
// 불어권 확장 2호. 프랑스어권 문법(name=nameFr canonical, contentLocale 'fr') — 리옹 패턴.
// desc 사실 검증 2026-07-22(달의 항구 세계유산 2007·물의 거울 전승 헤지, 와인 샤토·상호 무표기).
// 🎨 R4 terracotta(석회암 도심이지만 지붕 톤은 남서부 오렌지 — 리옹과 동일 배정).
// fr 도어 7호 세트·트램 상세는 별도 라운드. 게이트는 Codex-1 후속(생장역 기준, 발주 5043686863).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BORDEAUX_GEO } from './bordeaux.geo.js';
import { BORDEAUX_DOORS } from '../bordeauxDoors.js';

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

// fr 도어 2종(fr-15~16 — 제안 스팟 좌표) tile — 앵커 근처 보행+이격 ≥3 스크립트 검증 배치.
const BORDEAUX_DOOR_TILES = Object.freeze({
  'fr-15': [268, 226], // 제과점 — 역사지구 1안
  'fr-16': [269, 148], // 골동품점 — 북강변 1안
});

export const CITY_NODES = [
  // 🧑‍💼 채움 라운드 1 — 빈 역 지구 NPC(스팟 실측: 보행·이격≥3·개방 rect 내).
  {
    id: 'bordeaux-gare-accueil', kind: 'npc', npc: 'gare-accueil', name: '안내 부스',
    tile: [328, 302], facing: 'down', noStamp: true,
    desc: '생장역의 안내 부스. 프랑스 여행의 첫 마디 — Bonjour로 시작해 보세요.',
  },
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
  // 프랑스어 문화 도어 2종(fr-15~16 — 채움 라운드 2) — track 명시 라우팅.
  ...BORDEAUX_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...BORDEAUX_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
  })),
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


// 🧭 주동선 v3 — 보르도 클래식 워크(T3 실측 docs/proposal-mainroute-bdx-sxb.md 좌표·경로 그대로).
// 생장역→역사지구→강변→북부(시테 뒤 뱅) 9 waypoint·490 steps. cardinal-bfs-v1 재현 핀.
// discoveries는 후속 카피 라운드에서 저작(빈 배열 = 발견 렌더 없음, fail-closed).
export const MAIN_ROUTE = Object.freeze({
  id: 'bordeaux-classic-walk',
  version: 1,
  waypoints: Object.freeze([
    Object.freeze({ kind: 'station', id: 'bordeaux-saint-jean' }),
    Object.freeze({ kind: 'node', id: 'grosse-cloche' }),
    Object.freeze({ kind: 'node', id: 'cathedrale-saint-andre' }),
    Object.freeze({ kind: 'node', id: 'rue-sainte-catherine' }),
    Object.freeze({ kind: 'node', id: 'place-de-la-bourse' }),
    Object.freeze({ kind: 'node', id: 'place-des-quinconces' }),
    Object.freeze({ kind: 'node', id: 'jardin-public' }),
    Object.freeze({ kind: 'node', id: 'chartrons' }),
    Object.freeze({ kind: 'node', id: 'cite-du-vin' }),
  ]),
  routing: Object.freeze({
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  }),
  segmentHints: Object.freeze([]),
  branches: Object.freeze([]),
  discoveries: Object.freeze([
    Object.freeze({
      id: 'bordeaux-d1', leg: Object.freeze(['bordeaux-saint-jean', 'grosse-cloche']), at: 0.55,
      line: '역을 나서면 옛 성문 쪽으로 완만한 내리막이에요 — 큰 종이 울리면 포도 수확이 시작됐대요.',
    }),
    Object.freeze({
      id: 'bordeaux-d2', leg: Object.freeze(['grosse-cloche', 'cathedrale-saint-andre']), at: 0.5,
      line: '좁은 골목이 광장으로 열리면 첨탑 두 개가 먼저 보여요 — 대성당 앞은 도시의 오랜 중심이에요.',
    }),
    Object.freeze({
      id: 'bordeaux-d3', leg: Object.freeze(['cathedrale-saint-andre', 'rue-sainte-catherine']), at: 0.45,
      line: '유럽에서 손꼽히게 긴 보행자 거리예요 — 1km 넘는 길이 전부 걷는 사람의 것이에요.',
    }),
    Object.freeze({
      id: 'bordeaux-d4', leg: Object.freeze(['rue-sainte-catherine', 'place-de-la-bourse']), at: 0.5,
      line: '강 쪽으로 내려가면 물거울 광장이에요 — 얕은 물 위에 18세기 건물이 그대로 비쳐요.',
    }),
    Object.freeze({
      id: 'bordeaux-d5', leg: Object.freeze(['place-de-la-bourse', 'place-des-quinconces']), at: 0.5,
      line: '가론 강변 산책로가 큰 광장으로 이어져요 — 유럽에서 가장 넓은 광장 중 하나예요.',
    }),
    Object.freeze({
      id: 'bordeaux-d6', leg: Object.freeze(['place-des-quinconces', 'jardin-public']), at: 0.5,
      line: '도심의 소음이 잦아들고 나무 그늘이 시작돼요 — 18세기부터 시민의 정원이었어요.',
    }),
    Object.freeze({
      id: 'bordeaux-d7', leg: Object.freeze(['jardin-public', 'chartrons']), at: 0.55,
      line: '와인 창고가 늘어섰던 동네예요 — 지붕 낮은 집들이 그 시절 상인들의 흔적이에요.',
    }),
    Object.freeze({
      id: 'bordeaux-d8', leg: Object.freeze(['chartrons', 'cite-du-vin']), at: 0.5,
      line: '강변 끝에 반짝이는 곡선 건물이 나타나요 — 와인 디캔터를 닮았다고들 해요.',
    }),
  ]),
  segments: Object.freeze([
    Object.freeze({
      id: 'station:bordeaux-saint-jean--node:grosse-cloche',
      stepCount: 122,
      tileCount: 123,
      pathSha256: '289e37deac942d0b5f0beb46c3308a0d1b8ee41e5046b69b64cafe143e335ddd',
      from: Object.freeze({ kind: 'station', id: 'bordeaux-saint-jean' }),
      to: Object.freeze({ kind: 'node', id: 'grosse-cloche' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 8 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 6 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 8 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 10 }),
        Object.freeze({ direction: 'L', count: 5 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 12 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'L', count: 9 }),
        Object.freeze({ direction: 'U', count: 15 }),
        Object.freeze({ direction: 'L', count: 9 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 4 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 2 }),
      ]),
    }),
    Object.freeze({
      id: 'node:grosse-cloche--node:cathedrale-saint-andre',
      stepCount: 37,
      tileCount: 38,
      pathSha256: '76e37fa6fc2c6987a1a79a9e68c6348d01e34c92c77666518844c3fc625bf686',
      from: Object.freeze({ kind: 'node', id: 'grosse-cloche' }),
      to: Object.freeze({ kind: 'node', id: 'cathedrale-saint-andre' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'L', count: 9 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 4 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 5 }),
        Object.freeze({ direction: 'D', count: 1 }),
      ]),
    }),
    Object.freeze({
      id: 'node:cathedrale-saint-andre--node:rue-sainte-catherine',
      stepCount: 38,
      tileCount: 39,
      pathSha256: 'fa450fea26fa31a1f792a0c3792f0dfd1ae14a29817f1b6d41aeb9e4aa550941',
      from: Object.freeze({ kind: 'node', id: 'cathedrale-saint-andre' }),
      to: Object.freeze({ kind: 'node', id: 'rue-sainte-catherine' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 5 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 13 }),
        Object.freeze({ direction: 'U', count: 6 }),
        Object.freeze({ direction: 'L', count: 5 }),
      ]),
    }),
    Object.freeze({
      id: 'node:rue-sainte-catherine--node:place-de-la-bourse',
      stepCount: 29,
      tileCount: 30,
      pathSha256: '943bf4151c69e99b29d67531ddb71ae7f8231921750fa2adc25c40ea371bb50e',
      from: Object.freeze({ kind: 'node', id: 'rue-sainte-catherine' }),
      to: Object.freeze({ kind: 'node', id: 'place-de-la-bourse' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 6 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 6 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
      ]),
    }),
    Object.freeze({
      id: 'node:place-de-la-bourse--node:place-des-quinconces',
      stepCount: 39,
      tileCount: 40,
      pathSha256: '811fe1c60cfe5041ade548913928ea99bf20e7a753f93dc60d8da237c5f58a43',
      from: Object.freeze({ kind: 'node', id: 'place-de-la-bourse' }),
      to: Object.freeze({ kind: 'node', id: 'place-des-quinconces' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 10 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 5 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 5 }),
        Object.freeze({ direction: 'L', count: 17 }),
      ]),
    }),
    Object.freeze({
      id: 'node:place-des-quinconces--node:jardin-public',
      stepCount: 28,
      tileCount: 29,
      pathSha256: '88cc7de3172949894a3de2d11cae2960947b26710d290fe3ef81b9b75b5bbe25',
      from: Object.freeze({ kind: 'node', id: 'place-des-quinconces' }),
      to: Object.freeze({ kind: 'node', id: 'jardin-public' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 11 }),
        Object.freeze({ direction: 'L', count: 4 }),
        Object.freeze({ direction: 'U', count: 5 }),
        Object.freeze({ direction: 'L', count: 8 }),
      ]),
    }),
    Object.freeze({
      id: 'node:jardin-public--node:chartrons',
      stepCount: 58,
      tileCount: 59,
      pathSha256: 'aceee67d962e5695c54e28982a1b41e46552c192d3e11627e8b34073b35c77ba',
      from: Object.freeze({ kind: 'node', id: 'jardin-public' }),
      to: Object.freeze({ kind: 'node', id: 'chartrons' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 3 }),
        Object.freeze({ direction: 'U', count: 7 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 9 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 3 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
      ]),
    }),
    Object.freeze({
      id: 'node:chartrons--node:cite-du-vin',
      stepCount: 139,
      tileCount: 140,
      pathSha256: '8dc19efe558d496cb6e4f5fc671c45bea8fc26692e90ba5a4cfd5a257bf5705f',
      from: Object.freeze({ kind: 'node', id: 'chartrons' }),
      to: Object.freeze({ kind: 'node', id: 'cite-du-vin' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 9 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 3 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 3 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
      ]),
    }),
  ]),
});

export const BORDEAUX = {
  id: 'bordeaux', name: '보르도', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'bordeaux', // 오버월드 EMEA 게이트는 Codex-1 후속(생장역 기준)
  mainRoute: MAIN_ROUTE,
  // 📖 여행책 지구제 v1 (D2 — T5 실측 docs/proposal-district-rects.md 후보 그대로, 오너 승인 순서 2호).
  // 빈 벌판(도어·NPC 0)을 잠그고 완성 코스만 개방 — 개방 4.97%, 필수 gate 3/3 포함 사전검증 PASS.
  districts: {
    version: 'district-v1',
    open: [
      { id: 'gare-saint-jean', label: '생장역 일대', tiles: { rects: [[305, 285, 365, 325]] } },
      { id: 'centre-historique', label: '역사 지구', tiles: { rects: [[235, 188, 315, 255]] } },
      { id: 'nord-rive', label: '샤르트롱·북강변', tiles: { rects: [[235, 140, 290, 187], [335, 85, 370, 115]] } },
      // 주동선 회랑 — 클래식 워크(MAIN_ROUTE) 경로 커버(생장역 접근로·샤르트롱→시테 뒤 뱅 강변).
      { id: 'route-corridor', label: '클래식 워크 회랑', tiles: { rects: [[263, 240, 336, 307], [267, 94, 360, 157]] } },
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
