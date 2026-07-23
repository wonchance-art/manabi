// 🏙️ 마르세유 도시 정밀맵 — 실 OSM geo(#260, 406×446)를 CityScene 계약에 연결한다.
// 유럽 2차 1호. 프랑스어권 문법(name=nameFr canonical, contentLocale 'fr') — 그랑파리 패턴.
// desc 사실 검증 2026-07-18(연도 전승 헤지 — 이프성 16세기·몬테크리스토 통설, 벨로드롬
// "6만 명 규모급" 헤지, 부야베스는 도어 문화 각주로 이관). IP: 뮤셈·벨로드롬 외관만.
// 🛶 도선 문법 7번째 — 첫 외해 섬 항로: 구항↔이프성(geo 2성분 BFS 계약, ferry-only 도달)
//    + 구항 횡단 페리보트 283m. 🎨 R4 지역 색감 첫 소비: terracotta 지붕 + emerald 수면.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { MARSEILLE_GEO } from './marseille.geo.js';
import { MARSEILLE_DOORS } from '../marseilleDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = MARSEILLE_GEO.meta.grid.w;
export const ROWS = MARSEILLE_GEO.meta.grid.h;
export const ENTRANCE = { ...MARSEILLE_GEO.entrance };

const MARSEILLE_DESC_KO = Object.freeze({
  'vieux-port': '2,600년 항구 도시의 심장 「Vieux-Port(구항)」. 그리스인들이 항구를 연 것으로 전해지는 자리 — 아침이면 부두에서 생선 직판이 서요.',
  'notre-dame-de-la-garde': '도시 최고 언덕의 「Notre-Dame de la Garde(노트르담 드 라 가르드)」. 19세기에 세워진 것으로 전해지는 성당으로, 금빛 성모상 때문에 \'본 메르(좋은 어머니)\'라 불려요.',
  'le-panier': '마르세유에서 가장 오래된 언덕 동네 「Le Panier(파니에)」. 빨래가 걸린 좁은 골목과 파스텔 벽, 작은 공방이 이어져요.',
  mucem: '바다 위에 떠 있는 듯한 검은 격자 건축 「MuCEM(뮤셈)」. 2013년 개관으로 전해지는 지중해 문명 박물관 — 이 게임에선 외관만 담아요.',
  'fort-saint-jean': '항구 입구를 지키던 「Fort Saint-Jean(생장 요새)」. 17세기 축조로 전해지며, 지금은 뮤셈과 다리로 이어진 산책로예요.',
  'cathedrale-la-major': '줄무늬 석재의 「Cathédrale de la Major(라 마조르 대성당)」. 19세기에 지어진 것으로 전해지는 비잔틴풍 대성당이 부두를 내려다봐요.',
  'chateau-dif': '앞바다 바위섬의 요새 감옥 「Château d\'If(이프성)」. 16세기 축조로 전해지며, 소설 몬테크리스토 백작의 무대로 알려져 있어요 — 구항에서 배로 가요.',
  'vallon-des-auffes': '절벽 사이 작은 어촌 포구 「Vallon des Auffes(발롱 데 조프)」. 다리 아래 색색의 고깃배가 정박한 그림 같은 포구예요.',
  'plage-des-catalans': '도심에서 가장 가까운 백사장 「Plage des Catalans(카탈랑 해변)」. 구항에서 걸어 닿는 시민 해변이에요.',
  'palais-longchamp': '물의 궁전 「Palais Longchamp(롱샹 궁전)」. 19세기 운하 완공을 기념해 세워진 것으로 전해지는 분수 궁전이에요.',
  'cours-julien': '거리 미술과 노천 카페의 언덕 「Cours Julien(쿠르 쥘리앵)」. 벽화가 수시로 바뀌는 예술 동네예요.',
  'stade-velodrome': '흰 곡면 지붕의 「Stade Vélodrome(벨로드롬)」. 6만 명 규모급으로 알려진 대형 경기장 — 이 게임에선 외관만 담아요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameFr canonical.
export const MARSEILLE_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(MARSEILLE_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: MARSEILLE_DESC_KO[poi.id] ?? `마르세유의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return MARSEILLE_COPY[locale]?.[id] || MARSEILLE_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'vieux-port-panier', label: '구항·파니에', bounds: [142, 123, 252, 195], labelTile: [197, 159] },
  { id: 'joliette', label: '라 마조르·졸리에트', bounds: [142, 73, 211, 139], labelTile: [177, 106] },
  { id: 'corniche', label: '코르니슈', bounds: [101, 184, 171, 279], labelTile: [136, 232] },
  { id: 'saint-charles', label: '생샤를·쿠르쥘리앵', bounds: [223, 106, 304, 195], labelTile: [264, 151] },
  { id: 'prado', label: '프라도·벨로드롬', bounds: [215, 251, 333, 351], labelTile: [274, 301] },
  { id: 'frioul-if', label: '이프성 앞바다', bounds: [0, 206, 81, 296], labelTile: [41, 251] },
];

// fr 도어 6종(fr-07~12) tile — 앵커 POI 곁 보행+이격 ≥2 스크립트 검증 배치.
const MARSEILLE_DOOR_TILES = Object.freeze({
  'fr-07': [218, 167], // 부야베스 식당 — 구항 북안
  'fr-08': [196, 139], // 파니에 비누 공방
  'fr-09': [221, 166], // 이프성 페리 매표 — 벨주 부두 곁
  'fr-10': [222, 170], // 구항 아침 생선 좌판
  'fr-11': [206, 226], // 본 메르 전망 테라스
  'fr-12': [253, 172], // 쿠르 쥘리앵 거리 미술 아틀리에
});

export const CITY_NODES = [
  ...MARSEILLE_GEO.pois.map((poi) => {
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
  // 프랑스어 문화 도어 6종(fr-07~12 — 파리와 별개 신규 세트) — track 명시 라우팅.
  ...MARSEILLE_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...MARSEILLE_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = MARSEILLE_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 페리 부두 4종 — 구항↔이프성(첫 외해 섬 항로)·구항 횡단 페리보트(geo transitPoints 계약 소비).
export const TRANSIT_POINTS = (MARSEILLE_GEO.transitPoints || []).map((point) => ({
  id: point.id,
  nameJa: point.nameFr,
  nameFr: point.nameFr,
  yomi: '',
  contentLocale: point.contentLocale,
  tile: [point.tile[0], point.tile[1]],
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // M1 유효 구간 실정차 노선 순(생샤를→구항→카스텔란).
    id: 'marseille-m1', nameJa: 'Métro M1', mode: 'subway', color: 0x2f6fb2,
    stopIds: ['saint-charles', 'vieux-port-metro', 'castellane'],
    segmentMinutes: [2, 2], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // M2 유효 구간(졸리에트→생샤를).
    id: 'marseille-m2', nameJa: 'Métro M2', mode: 'subway', color: 0xc2503a,
    stopIds: ['joliette', 'saint-charles'],
    segmentMinutes: [3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // 🛶 구항 → 이프성 도선 — 첫 외해 섬 항로(2성분 BFS의 유일한 다리).
    id: 'marseille-ferry-if', nameJa: 'Navette du château d\'If', mode: 'ferry', color: 0x2e7d5b,
    stopIds: ['vieux-port-quay', 'chateau-dif-landing'],
    segmentMinutes: [20], dwellMinutes: 2,
    serviceWindows: [
      { startMinute: 480, endMinute: 1080, headwayMinutes: 60 },
    ],
  },
  {
    // 구항 횡단 페리보트(~283m) — 세계에서 가장 짧은 축에 드는 항로로 알려진 명물.
    id: 'marseille-ferry-boat', nameJa: 'Ferry-boat du Vieux-Port', mode: 'ferry', color: 0xe8a13a,
    stopIds: ['ferry-boat-south', 'ferry-boat-north'],
    segmentMinutes: [3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 420, endMinute: 1200, headwayMinutes: 15 },
    ],
  },
];

// ⛲ 렌더크래프트 — 기존 kind 재사용 배치(보행/수면 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'ferry_dom', tile: [218, 169] }, // 구항 수면 — 이프성 도선 소형선
  { kind: 'parasol', tile: [134, 199] },   // 카탈랑 해변 파라솔
  { kind: 'fountain', tile: [300, 112] },  // 롱샹 궁전 분수
  { kind: 'stall', tile: [198, 139] },     // 파니에 골목 공방 좌판
];

export function buildMarseilleGrid() {
  const grid = Uint8Array.from(MARSEILLE_GEO.terrain);
  for (const [x, y] of MARSEILLE_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const MARSEILLE = {
  id: 'marseille', name: '마르세유', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  roadStyle: 'autotile-v1',
  returnNode: 'marseille', // 오버월드 EMEA 마르세유 노드는 Codex-1 게이트 라운드 후속(생샤를 기준)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: MARSEILLE_GEO.railways,
  // 🎨 R4 지역 색감 — 테라코타 지붕 + 에메랄드 수면(첫 소비 도시).
  tileSkins: Object.freeze({ building: 'terracotta', water: 'emerald' }),
  districts: Object.freeze({
    version: 'district-v1',
    open: [
      {
        id: 'vieux-port-panier',
        label: '구항·파니에',
        tiles: { rects: [[140, 100, 223, 190]] },
      },
      {
        id: 'saint-charles-longchamp',
        label: '생샤를·롱샹',
        tiles: { rects: [[224, 90, 320, 225]] },
      },
      {
        id: 'garde-corniche',
        label: '노트르담·코르니슈',
        tiles: { rects: [[95, 191, 222, 260]] },
      },
      {
        id: 'if-prado',
        label: '이프 방면·프라도',
        tiles: { rects: [[10, 240, 35, 265], [285, 285, 325, 325]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  }),
  CITY_TILE, buildGrid: buildMarseilleGrid,
};

export default MARSEILLE;
