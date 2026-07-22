// 🏙️ 리옹 도시 정밀맵 — 실 OSM geo(#352, 428×501)를 CityScene 계약에 연결한다.
// 불어권 확장 1호(오너 큐 2026-07-22: 리옹→보르도→스트라스부르). 프랑스어권 문법
// (name=nameFr canonical, contentLocale 'fr') — 마르세유·레만 패턴. desc 사실 검증
// 2026-07-22(카뉘·트라불·합류점 전승 헤지, 레알 시장은 인명·상호 무표기 일반 시설명).
// 🎨 R4 terracotta 지붕(구시가 오렌지 톤). fr 도어 6호 세트·메트로 상세는 별도 라운드.
// 오버월드 EMEA 게이트는 Codex-1 후속(파르디외 기준, 발주 5043280384).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { LYON_GEO } from './lyon.geo.js';

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

export const CITY_NODES = [
  ...LYON_GEO.pois.map((poi) => {
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

export function buildLyonGrid() {
  const grid = Uint8Array.from(LYON_GEO.terrain);
  for (const [x, y] of LYON_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const LYON = {
  id: 'lyon', name: '리옹', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'lyon', // 오버월드 EMEA 게이트는 Codex-1 후속(파르디외 기준)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: LYON_GEO.railways,
  // 🎨 R4 — 구시가 오렌지 지붕 톤.
  tileSkins: Object.freeze({ building: 'terracotta' }),
  CITY_TILE, buildGrid: buildLyonGrid,
};

export default LYON;
