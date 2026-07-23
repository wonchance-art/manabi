// 🏙️ 리옹 도시 정밀맵 — 실 OSM geo(#352, 428×501)를 CityScene 계약에 연결한다.
// 불어권 확장 1호(오너 큐 2026-07-22: 리옹→보르도→스트라스부르). 프랑스어권 문법
// (name=nameFr canonical, contentLocale 'fr') — 마르세유·레만 패턴. desc 사실 검증
// 2026-07-22(카뉘·트라불·합류점 전승 헤지, 레알 시장은 인명·상호 무표기 일반 시설명).
// 🎨 R4 terracotta 지붕(구시가 오렌지 톤). fr 도어 6호 세트·메트로 상세는 별도 라운드.
// 오버월드 EMEA 게이트는 Codex-1 후속(파르디외 기준, 발주 5043280384).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { LYON_GEO } from './lyon.geo.js';
import { LYON_DOORS } from '../lyonDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = LYON_GEO.meta.grid.w;
export const ROWS = LYON_GEO.meta.grid.h;
export const ENTRANCE = { ...LYON_GEO.entrance };

const LYON_DESC_KO = Object.freeze({
  fourviere: '언덕 위의 흰 대성당 「Basilique de Fourvière」. 19세기 말 봉헌으로 전해지며, 푸니쿨라를 타고 오르면 두 강과 반도가 한눈에 내려다보여요.',
  'vieux-lyon': '르네상스 거리가 통째로 남은 구시가 「Vieux Lyon」. 건물 사이를 잇는 비밀 통로 트라불(traboule)은 견직물 상인들이 비를 피해 천을 나르던 길로 전해져요.',
  bellecour: '유럽에서 손꼽히게 너른 광장 「Place Bellecour」. 반도(프레스킬) 한가운데의 붉은 흙 광장으로, 도시의 거리 기준점이 되는 곳이에요.',
  terreaux: '시청과 미술관이 마주 보는 광장 「Place des Terreaux」. 19세기 조각가가 만든 사두마차 분수가 광장의 상징으로 통해요.',
  'croix-rousse': '견직공들의 언덕 「La Croix-Rousse」. 카뉘(canut)라 불린 19세기 직공들이 높은 천장 작업장에서 비단을 짰던 동네로, 완만한 골목 시장이 이어져요.',
  confluence: '론강과 손강이 만나는 곶 「La Confluence」. 옛 항만·공업지가 현대 건축 지구로 바뀐 곳으로, 두 강의 물빛이 갈라지는 합류점을 볼 수 있어요.',
  'tete-dor': '도심 속 대공원 「Parc de la Tête d\'Or」. 이름은 공원 땅에 묻혔다는 황금 두상 전설에서 왔다고 전해지고, 호수와 장미원이 넓게 펼쳐져요.',
  halles: '실내 미식 시장 「Halles de Lyon」. 미식 도시 리옹의 부엌으로 통하는 곳 — 치즈·소시송·크넬 같은 리옹 명물 좌판이 늘어서 있어요.',
  opera: '검은 유리 돔을 얹은 오페라 극장 「Opéra de Lyon」. 19세기 건물에 현대 돔을 증축한 개보수(1993년 재개관)로 알려져 있어요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameFr canonical.
export const LYON_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(LYON_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: LYON_DESC_KO[poi.id] ?? `리옹의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return LYON_COPY[locale]?.[id] || LYON_COPY.ko[id];
}

// 구역 라벨 — POI·역 tile 포함 관계 검증 계산치.
export const ZONES = [
  { id: 'fourviere', label: '푸르비에르·구시가', bounds: [90, 170, 158, 260], labelTile: [125, 215] },
  { id: 'presquile', label: '프레스킬(반도)', bounds: [158, 150, 205, 300], labelTile: [178, 225] },
  { id: 'croix-rousse', label: '크루아루스', bounds: [130, 110, 205, 150], labelTile: [165, 130] },
  { id: 'part-dieu', label: '파르디외·레알', bounds: [205, 170, 300, 250], labelTile: [252, 210] },
  { id: 'confluence', label: '콘플루앙스', bounds: [80, 300, 175, 420], labelTile: [125, 360] },
  { id: 'tete-dor', label: '테트도르', bounds: [205, 90, 290, 150], labelTile: [248, 118] },
];

// fr 도어 8종(fr-19~20, fr-31~36) tile — 앵커 POI 곁 보행+이격 ≥3 스크립트 검증 배치.
// open districts rects 범위:
// - presquile-confluence: [[127, 228, 169, 292], [136, 213, 169, 240]]
// - vieux-lyon-fourviere: [[118, 202, 149, 225], [118, 174, 178, 215]]
// - terreaux-croix-rousse: [[166, 173, 187, 194], [157, 136, 191, 186]]
// - rhone-part-dieu: [[157, 136, 239, 212], [227, 200, 276, 225]]
const LYON_DOOR_TILES = Object.freeze({
  'fr-19': [262, 217], // 식료품 시장 — rhone-part-dieu [227, 200, 276, 225]
  'fr-20': [227, 202], // 노천 카페 — rhone-part-dieu [227, 200, 276, 225]
  'fr-31': [170, 155], // 실크 아틀리에 — terreaux-croix-rousse [157, 136, 191, 186]
  'fr-32': [145, 200], // 부숑 식당 — vieux-lyon-fourviere [118, 202, 149, 225]
  'fr-33': [130, 210], // 트라불 안뜰 서점 — vieux-lyon-fourviere [118, 202, 149, 225]
  'fr-34': [175, 170], // 인형극 공방 — terreaux-croix-rousse [157, 136, 191, 186]
  'fr-35': [155, 260], // 강변 과자점 — rhone-part-dieu [157, 136, 239, 212] + presquile-confluence [136, 213, 169, 240]
  'fr-36': [125, 220], // 언덕 전망 카페 — vieux-lyon-fourviere [118, 202, 149, 225]
});

export const CITY_NODES = [
  // 🧑‍💼 채움 라운드 1 — 경로변 NPC(스팟 실측: T8 proposal-npc-door-spots.md).
  {
    id: 'lyon-presquile-confluence-cafe', kind: 'npc', npc: 'lyon-presquile-cafe', name: '카페 종업원',
    tile: [143, 222], facing: 'down', noStamp: true,
    desc: '프레스킬 카페 테라스 종업원. 유럽식 카페에서 커피를 주문하며 불어 첫 대화를 배워요.',
  },
  {
    id: 'lyon-vieux-lyon-fourviere-traboule', kind: 'npc', npc: 'lyon-vieux-traboule', name: '구시가 주민',
    tile: [172, 183], facing: 'down', noStamp: true,
    desc: '구시가 안내인. 트라불의 미스터리를 풀며 리옹의 역사 속으로 들어가요.',
  },
  {
    id: 'lyon-terreaux-croix-rousse-marche', kind: 'npc', npc: 'lyon-croix-rousse-marche', name: '시장 상인',
    tile: [179, 182], facing: 'down', noStamp: true,
    desc: '크루아루스 골목 시장의 과일 상인. 숫자와 가격 묻기를 배우며 리옹의 장시장 활기를 느껴요.',
  },
  // 🧑‍💼 채움 라운드 2 — 파르디외·레알 실내 시장 NPC(스팟 실측: proposal-npc-spots-r2.md).
  {
    id: 'lyon-rhone-part-dieu-marche-1', kind: 'npc', npc: 'lyon-part-dieu-marche-1', name: '시장 상인',
    tile: [234, 209], facing: 'down', noStamp: true,
    desc: '리옹 실내 시장 상인. 신선한 채소와 과일을 사며 품목·수량을 배워요.',
  },
  {
    id: 'lyon-rhone-part-dieu-marche-2', kind: 'npc', npc: 'lyon-part-dieu-marche-2', name: '시장 상인',
    tile: [265, 217], facing: 'down', noStamp: true,
    desc: '리옹 시장 내 도로변 노점. 가격을 묻고 현금 계산하는 여행 표현을 배워요.',
  },
  ...LYON_GEO.pois.map((poi) => {
    const copy = poiCopy(poi.id);
    // 리옹 주요 명소 스탬프 활성화: fourviere, vieux-lyon, bellecour, terreaux, croix-rousse, halles, tete-dor
    const stampActiveIds = new Set(['fourviere', 'vieux-lyon', 'bellecour', 'terreaux', 'croix-rousse', 'halles', 'tete-dor']);
    return {
      id: poi.id,
      kind: 'spot',
      name: copy.name,
      nameFr: poi.nameFr,
      contentLocale: poi.contentLocale,
      facade: 'sign',
      tile: [poi.tile[0], poi.tile[1]],
      facing: 'down',
      ...(stampActiveIds.has(poi.id) ? {} : { noStamp: true }),
      desc: copy.desc,
    };
  }),
  // 프랑스어 문화 도어 2종(fr-19~20 — 채움 라운드 2) — track 명시 라우팅.
  ...LYON_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...LYON_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = LYON_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT_POINTS = [];

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 🚆 파르디외~페라슈 연결선 — 반도 동안을 잇는 시내 철도축(메트로 상세는 후속 라운드).
    id: 'lyon-rail-link', nameJa: 'Liaison Part-Dieu–Perrache', mode: 'train', color: 0xa63d40,
    stopIds: ['part-dieu', 'perrache'],
    segmentMinutes: [6], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 330, endMinute: 1410, headwayMinutes: 12 },
    ],
  },
];

// ⛲ 렌더크래프트 — 기존 kind 재사용 배치(보행 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'fountain', tile: [169, 179] },  // 테로 광장 분수
  { kind: 'stall', tile: [230, 202] },     // 레알 미식 시장 좌판
  { kind: 'parasol', tile: [242, 121] },   // 테트도르 호숫가 파라솔
];

// 🧭 레벨 디자인 v3 — 페라슈에서 파르디외까지 「정석 한 바퀴」 주동선.
// geo·충돌은 건드리지 않고 승인된 typed waypoint와 결정 경로 산출물만 싣는다(#383).
export const MAIN_ROUTE = Object.freeze({
  id: 'lyon-classic-loop',
  version: 1,
  waypoints: Object.freeze([
    Object.freeze({ kind: 'station', id: 'perrache' }),
    Object.freeze({ kind: 'node', id: 'bellecour' }),
    Object.freeze({ kind: 'node', id: 'vieux-lyon' }),
    Object.freeze({ kind: 'node', id: 'fourviere' }),
    Object.freeze({ kind: 'node', id: 'terreaux' }),
    Object.freeze({ kind: 'node', id: 'opera' }),
    Object.freeze({ kind: 'node', id: 'croix-rousse' }),
    Object.freeze({ kind: 'node', id: 'halles' }),
    Object.freeze({ kind: 'station', id: 'part-dieu' }),
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
      id: 'lyon-d1', leg: Object.freeze(['perrache', 'bellecour']), at: 0.55,
      line: '보행자 거리의 차양 아래로 아침 냄새가 흘러요 — 리옹의 하루는 빵집 앞에서 시작돼요.',
    }),
    Object.freeze({
      id: 'lyon-d2', leg: Object.freeze(['bellecour', 'vieux-lyon']), at: 0.50,
      line: '손강 다리 위에서 물빛이 바뀌어요 — 잔잔한 손강과 힘찬 론강, 두 강의 성격이 달라요.',
    }),
    Object.freeze({
      id: 'lyon-d3', leg: Object.freeze(['vieux-lyon', 'fourviere']), at: 0.40,
      line: '구시가 골목엔 「트라불」이라 불리는 지붕 덮인 지름길이 숨어 있어요 — 비 오는 날의 통로였대요.',
    }),
    Object.freeze({
      id: 'lyon-d4', leg: Object.freeze(['fourviere', 'terreaux']), at: 0.45,
      line: '언덕에서 내려다보면 붉은 지붕의 바다 너머로 두 강이 만나는 자리가 보여요.',
    }),
    Object.freeze({
      id: 'lyon-d5', leg: Object.freeze(['terreaux', 'opera']), at: 0.50,
      line: '시청 뒤편을 돌면 오페라의 유리 반원 지붕이 나타나요 — 옛 벽 위에 얹은 현대의 곡선이에요.',
    }),
    Object.freeze({
      id: 'lyon-d6', leg: Object.freeze(['opera', 'croix-rousse']), at: 0.60,
      line: '크루아루스 오르막은 옛 견직 공방의 동네예요 — 천장 높은 집들이 그 시절의 흔적이에요.',
    }),
    Object.freeze({
      id: 'lyon-d7', leg: Object.freeze(['croix-rousse', 'halles']), at: 0.50,
      line: '론강변 산책로엔 플라타너스가 줄지어요 — 강을 따라 달리는 사람들의 코스예요.',
    }),
    Object.freeze({
      id: 'lyon-d8', leg: Object.freeze(['halles', 'part-dieu']), at: 0.45,
      line: '실내 시장의 치즈 좌판을 지나면 곧 파르디외의 유리탑이 눈에 들어와요.',
    }),
  ]),
  segments: Object.freeze([
    Object.freeze({
      id: 'station:perrache--node:bellecour',
      from: Object.freeze({ kind: 'station', id: 'perrache' }),
      to: Object.freeze({ kind: 'node', id: 'bellecour' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 10 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 8 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 6 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 11 }),
      ]),
      stepCount: 88,
      tileCount: 89,
      pathSha256: '781ae7cb3d7fe322b8f37b450359fc182042eeb1b4ffc44b4dc131a794bf5392',
    }),
    Object.freeze({
      id: 'node:bellecour--node:vieux-lyon',
      from: Object.freeze({ kind: 'node', id: 'bellecour' }),
      to: Object.freeze({ kind: 'node', id: 'vieux-lyon' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 3 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'L', count: 5 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 3 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 3 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 3 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'R', count: 1 }),
      ]),
      stepCount: 37,
      tileCount: 38,
      pathSha256: '0cb15b9e2b234357109e66485b9894504dc22de636edbc962142a53662a0e8b4',
    }),
    Object.freeze({
      id: 'node:vieux-lyon--node:fourviere',
      from: Object.freeze({ kind: 'node', id: 'vieux-lyon' }),
      to: Object.freeze({ kind: 'node', id: 'fourviere' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 3 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 15 }),
        Object.freeze({ direction: 'D', count: 1 }),
      ]),
      stepCount: 31,
      tileCount: 32,
      pathSha256: '1c72c078a5097d20ed0873df071615b97e0d683b1f61e2a1223996dde5237d67',
    }),
    Object.freeze({
      id: 'node:fourviere--node:terreaux',
      from: Object.freeze({ kind: 'node', id: 'fourviere' }),
      to: Object.freeze({ kind: 'node', id: 'terreaux' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'R', count: 7 }),
        Object.freeze({ direction: 'U', count: 10 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 5 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 8 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 8 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 3 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'R', count: 14 }),
      ]),
      stepCount: 77,
      tileCount: 78,
      pathSha256: 'e149ceb0cc0f74e2254a99a90643fc7cd2d3554833930877b60b1870e311e7da',
    }),
    Object.freeze({
      id: 'node:terreaux--node:opera',
      from: Object.freeze({ kind: 'node', id: 'terreaux' }),
      to: Object.freeze({ kind: 'node', id: 'opera' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'D', count: 8 }),
        Object.freeze({ direction: 'R', count: 7 }),
        Object.freeze({ direction: 'U', count: 8 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
      ]),
      stepCount: 26,
      tileCount: 27,
      pathSha256: '075090c44b399a578127829cc5468f5f353817eccbe77403fac55cb6a31380e4',
    }),
    Object.freeze({
      id: 'node:opera--node:croix-rousse',
      from: Object.freeze({ kind: 'node', id: 'opera' }),
      to: Object.freeze({ kind: 'node', id: 'croix-rousse' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'U', count: 29 }),
        Object.freeze({ direction: 'L', count: 2 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 2 }),
        Object.freeze({ direction: 'L', count: 3 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 1 }),
        Object.freeze({ direction: 'L', count: 1 }),
        Object.freeze({ direction: 'U', count: 4 }),
        Object.freeze({ direction: 'L', count: 14 }),
      ]),
      stepCount: 65,
      tileCount: 66,
      pathSha256: '7e26891c1d43fc8c9551b4436ff3968d45ab1a9c794857215808cd3b6094621e',
    }),
    Object.freeze({
      id: 'node:croix-rousse--node:halles',
      from: Object.freeze({ kind: 'node', id: 'croix-rousse' }),
      to: Object.freeze({ kind: 'node', id: 'halles' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'R', count: 21 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'D', count: 6 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 2 }),
        Object.freeze({ direction: 'R', count: 4 }),
        Object.freeze({ direction: 'D', count: 1 }),
        Object.freeze({ direction: 'R', count: 27 }),
        Object.freeze({ direction: 'D', count: 4 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 7 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 6 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 10 }),
        Object.freeze({ direction: 'R', count: 2 }),
        Object.freeze({ direction: 'D', count: 9 }),
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 13 }),
        Object.freeze({ direction: 'R', count: 6 }),
        Object.freeze({ direction: 'D', count: 4 }),
        Object.freeze({ direction: 'R', count: 1 }),
      ]),
      stepCount: 134,
      tileCount: 135,
      pathSha256: '739014d9831e9190517f81ae1d79c157cac7bf6d5f277e9aefaac4fff47825f0',
    }),
    Object.freeze({
      id: 'node:halles--station:part-dieu',
      from: Object.freeze({ kind: 'node', id: 'halles' }),
      to: Object.freeze({ kind: 'station', id: 'part-dieu' }),
      stepsRle: Object.freeze([
        Object.freeze({ direction: 'R', count: 1 }),
        Object.freeze({ direction: 'D', count: 4 }),
        Object.freeze({ direction: 'R', count: 13 }),
        Object.freeze({ direction: 'D', count: 7 }),
        Object.freeze({ direction: 'R', count: 21 }),
        Object.freeze({ direction: 'D', count: 2 }),
        Object.freeze({ direction: 'R', count: 2 }),
      ]),
      stepCount: 50,
      tileCount: 51,
      pathSha256: '94d03b490e14a1daf94fc288072e944ae70b048a3647e3857a8f1b597d006f48',
    }),
  ]),
});

export function buildLyonGrid() {
  const grid = Uint8Array.from(LYON_GEO.terrain);
  for (const [x, y] of LYON_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const LYON = {
  id: 'lyon', name: '리옹', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  roadStyle: 'autotile-v1',
  returnNode: 'lyon', // 오버월드 EMEA 게이트는 Codex-1 후속(파르디외 기준)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: LYON_GEO.railways,
  mainRoute: MAIN_ROUTE,
  // 📖 여행책 지구제 v1 (D2 정본 — RFC docs/rfc-guidebook-districts.md·오너 승인 2026-07-23).
  // 개방 = 주동선 회랑(leg별 bbox+6타일 마진, #150 예비 산출 5049709411 검산). 나머지는
  // guidebook 잠금 렌더 + soft wall. 지구 확장 시 rect 추가만(기존 rect 축소 금지 관례).
  districts: {
    version: 'district-v1',
    open: [
      {
        id: 'presquile-confluence',
        label: '프레스킬 남부',
        tiles: { rects: [[127, 228, 169, 292], [136, 213, 169, 240]] },
      },
      {
        id: 'vieux-lyon-fourviere',
        label: '구시가·푸르비에르',
        tiles: { rects: [[118, 202, 149, 225], [118, 174, 178, 215]] },
      },
      {
        id: 'terreaux-croix-rousse',
        label: '테로·크루아루스',
        tiles: { rects: [[166, 173, 187, 194], [157, 136, 191, 186]] },
      },
      {
        id: 'rhone-part-dieu',
        label: '론 강변·파르디외',
        tiles: { rects: [[157, 136, 239, 212], [227, 200, 276, 225]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  // 🎨 R4 — 구시가 오렌지 지붕 톤.
  tileSkins: Object.freeze({ building: 'terracotta' }),
  CITY_TILE, buildGrid: buildLyonGrid,
};

export default LYON;
