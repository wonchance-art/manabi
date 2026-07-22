// 🏙️ 레만호 연안 도시 정밀맵 — 실 OSM geo(#304, 1342×780)를 CityScene 계약에 연결한다.
// 유럽 2차 4호(로잔~라보~브베~몽트뢰~시옹). 프랑스어권 문법(name=nameFr canonical,
// contentLocale 'fr') — 마르세유·제네바 패턴. desc 사실 검증 2026-07-22(대성당 야경꾼 전승,
// 라보 2007 세계유산, 시옹성은 representationPolicy대로 건축·지리만, 몽트뢰는 행사 무언급,
// 브베 시장은 상호·기업 무언급 — geo의 representationPolicy 필드 준수).
// 🛶 도선 10호 — 벨에포크 유람선(선사명 일반화, 무에트·구항 문법). 🎨 R4B glacial 수면 첫 소비.
// 🚪 fr 도어 5호 세트(fr-16~18 — 와인 카브·거리 음악가·약국, a2 잔여 챕터 02·03·07).
// 오버월드 EMEA 게이트는 Codex-1 후속(로잔역 기준).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { LEMAN_RIVIERA_GEO } from './leman-riviera.geo.js';
import { LEMAN_DOORS } from '../lemanDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = LEMAN_RIVIERA_GEO.meta.grid.w;
export const ROWS = LEMAN_RIVIERA_GEO.meta.grid.h;
export const ENTRANCE = { ...LEMAN_RIVIERA_GEO.entrance };

const LEMAN_DESC_KO = Object.freeze({
  'lausanne-cathedral': '언덕 위 고딕 대성당 「Cathédrale de Lausanne」. 1275년 봉헌으로 전해지며, 밤마다 탑에서 시각을 외치는 야경꾼 전통이 이어지는 것으로 알려져 있어요.',
  'lausanne-gare': '심플론선의 관문 「Gare de Lausanne」. 파리·밀라노 방면 열차가 지나는 레만호 북안의 중앙역이에요.',
  flon: '옛 창고 계곡을 재생한 지구 「Le Flon」. 하천을 복개한 저지대 창고촌이 상점과 광장의 거리로 바뀐 것으로 전해져요.',
  ouchy: '로잔의 호반 항구 「Ouchy」. 옛 어촌이 산책로와 선착장의 호숫가로 바뀌었고, 벨에포크 기선이 드나드는 곳이에요.',
  'lutry-vieux-bourg': '중세 성벽 골목이 남은 구시가 「Lutry」. 라보 포도밭 벨트가 시작되는 호안 마을이에요.',
  cully: '라보 한가운데의 선착장 마을 「Cully」. 포도밭 사이 골목과 호반 광장이 잇닿아 있어요.',
  'epesses-lavaux': '레만호 비탈의 계단식 포도밭 「Epesses (Lavaux)」. 11세기 수도원 개간에서 비롯됐다고 전해지는 라보 테라스의 한가운데 — 2007년 세계유산으로 등재됐어요.',
  'st-saphorin': '코르니슈 길의 전망 명소 「Saint-Saphorin」. 경사면 아래 돌집 마을과 포도밭, 호수가 한 프레임에 담겨요.',
  'vevey-grande-place': '호반의 대광장 「Grande Place, Vevey」. 너른 광장 너머로 호수와 알프스 능선이 열려요.',
  'vevey-marche': '브베의 장터 「Place du Marché, Vevey」. 주 두 차례 장이 서는 전통이 이어지는 것으로 전해져요.',
  'montreux-quai': '꽃길 호반 산책로 「Quais de Montreux」. 온화한 기후로 야자수가 자라는 벨에포크 휴양지 풍경이에요.',
  chillon: '호수 바위섬 위의 성 「Château de Chillon」. 사보이아 가문 시절 확장된 것으로 전해지는 수상 성채 — 이 게임에선 건축과 지리만 담아요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameFr canonical.
export const LEMAN_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(LEMAN_RIVIERA_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: LEMAN_DESC_KO[poi.id] ?? `레만호 연안의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return LEMAN_COPY[locale]?.[id] || LEMAN_COPY.ko[id];
}

// 구역 라벨 — POI·역 tile 포함 관계 검증 계산치 (webmercator 재투영 좌표계).
export const ZONES = [
  { id: 'lausanne', label: '로잔·플롱', bounds: [60, 50, 220, 155], labelTile: [150, 80] },
  { id: 'ouchy', label: '우시 호반', bounds: [60, 155, 230, 250], labelTile: [140, 205] },
  { id: 'lavaux', label: '라보 포도밭', bounds: [280, 140, 820, 430], labelTile: [540, 270] },
  { id: 'vevey', label: '브베', bounds: [860, 380, 1010, 500], labelTile: [935, 455] },
  { id: 'montreux', label: '몽트뢰·시옹', bounds: [1120, 530, 1310, 740], labelTile: [1210, 630] },
  { id: 'lake', label: '레만호', bounds: [300, 460, 1100, 760], labelTile: [650, 600] },
];

// fr 도어 3종(fr-16~18) tile — 앵커 POI 곁 보행+이격 ≥3 스크립트 검증 배치.
const LEMAN_DOOR_TILES = Object.freeze({
  'fr-16': [524, 259],  // 와인 카브 — 에페스(라보) 포도밭 곁
  'fr-17': [1187, 587], // 거리 음악가 — 몽트뢰 호반 산책로
  'fr-18': [109, 97],   // 약국 — 로잔 플롱
});

export const CITY_NODES = [
  ...LEMAN_RIVIERA_GEO.pois.map((poi) => {
    const copy = poiCopy(poi.id);
    return {
      id: poi.id,
      kind: 'spot',
      name: copy.name,
      nameFr: poi.nameFr,
      contentLocale: poi.contentLocale,
      facade: poi.id === 'lausanne-gare' ? 'station' : 'sign',
      tile: [poi.tile[0], poi.tile[1]],
      facing: 'down',
      noStamp: true,
      desc: copy.desc,
    };
  }),
  // 프랑스어 문화 도어 3종(fr-16~18 — 프랑스어권 5번째 신규 세트) — track 명시 라우팅.
  ...LEMAN_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...LEMAN_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = LEMAN_RIVIERA_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 벨에포크 유람선 선착장 5종(geo transitPoints — 도선 문법 10번째, 선사명 일반화).
export const TRANSIT_POINTS = LEMAN_RIVIERA_GEO.transitPoints.map((point) => ({
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
    // 🚆 심플론 연안선 — 로잔~시옹 7역 종관(geo railways RLE 정합).
    id: 'leman-simplon', nameJa: 'Ligne du Simplon', mode: 'train', color: 0xa63d40,
    stopIds: ['lausanne', 'lutry', 'cully', 'rivaz', 'vevey', 'montreux', 'veytaux-chillon'],
    segmentMinutes: [5, 4, 3, 5, 4, 2], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 330, endMinute: 1410, headwayMinutes: 20 },
    ],
  },
  {
    // 🛶 벨에포크 유람선 — 우시~시옹 호반 5선착장(도선 10호, 선사명 일반화 표기).
    id: 'leman-belle-epoque', nameJa: 'Bateau Belle Époque', mode: 'ferry', color: 0xd9b23c,
    stopIds: ['ouchy-landing', 'cully-landing', 'vevey-landing', 'montreux-landing', 'chillon-landing'],
    segmentMinutes: [25, 18, 10, 5], dwellMinutes: 2,
    serviceWindows: [
      { startMinute: 540, endMinute: 1140, headwayMinutes: 90 },
    ],
  },
];

// ⛲ 렌더크래프트 — 기존 kind 재사용 배치(보행/수면 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'fountain', tile: [133, 92] },     // 로잔 대성당 곁 광장 분수
  { kind: 'stall', tile: [929, 437] },       // 브베 시장 광장 좌판
  { kind: 'ferry_dom', tile: [110, 200] },   // 우시 앞 수면 — 벨에포크 소형선
  { kind: 'parasol', tile: [1192, 588] },    // 몽트뢰 호반 산책로 파라솔
];

export function buildLemanRivieraGrid() {
  const grid = Uint8Array.from(LEMAN_RIVIERA_GEO.terrain);
  for (const [x, y] of LEMAN_RIVIERA_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const LEMAN_RIVIERA = {
  id: 'leman-riviera', name: '레만호 연안', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'leman-riviera', // 오버월드 EMEA 게이트는 Codex-1 후속(로잔역 기준)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: LEMAN_RIVIERA_GEO.railways,
  // 🎨 R4B — 빙하수 청록 수면(제네바와 공유하는 레만호 표현).
  tileSkins: Object.freeze({ water: 'glacial' }),
  CITY_TILE, buildGrid: buildLemanRivieraGrid,
};

export default LEMAN_RIVIERA;
