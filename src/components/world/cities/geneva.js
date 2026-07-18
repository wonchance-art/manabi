// 🏙️ 제네바 도시 정밀맵 — 실 OSM geo(#289, 309×362)를 CityScene 계약에 연결한다.
// 유럽 2차 3호. 프랑스어권 문법(name=nameFr canonical, contentLocale 'fr') — 마르세유 패턴.
// desc 사실 검증 2026-07-18(제토 140m·수력 기원 전승, 칼뱅 설교지 전승, 팔레 데 나시옹은
// 외관·지리만 — 국제기구 활동 서술 0건, 엠블럼·기 무재현. 브로큰 체어 조형물 무마커 — 재고 검증 노트).
// 🛶 도선 9번째 — 무에트 수상 셔틀(파키↔오빠브, 선사명 일반화). fr 도어 3호 세트(fr-13~)는
// 별도 저작 라운드(시계 공방·퐁뒤·초콜릿 후보). 수면 'glacial' 스킨은 R4 애드온 후보로 보류(기본 유지).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { GENEVA_GEO } from './geneva.geo.js';
import { GENEVA_DOORS } from '../genevaDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = GENEVA_GEO.meta.grid.w;
export const ROWS = GENEVA_GEO.meta.grid.h;
export const ENTRANCE = { ...GENEVA_GEO.entrance };

const GENEVA_DESC_KO = Object.freeze({
  'jet-deau': '레만호 위로 솟는 물기둥 「Jet d\'Eau(제토 분수)」. 140m 높이로 알려진 도시의 상징 — 본래 수력 설비의 압력 배출에서 시작됐다고 전해져요.',
  'cathedrale-saint-pierre': '구시가 언덕의 「Cathédrale Saint-Pierre(생피에르 대성당)」. 종교개혁기 칼뱅이 설교한 곳으로 전해지며, 탑에 오르면 호수와 도시가 한눈에 보여요.',
  'jardin-anglais': '호숫가 공원 「Jardin Anglais(영국 정원)」. 시계 산업 도시답게 생화로 만든 대형 꽃시계가 상징이에요.',
  'bains-des-paquis': '호수로 뻗은 방파제 목욕장 「Bains des Pâquis(파키 목욕장)」. 여름엔 수영, 겨울엔 사우나 — 시민들의 아침 문화로 알려진 곳이에요.',
  'palais-des-nations': '국제기구 지구의 「Palais des Nations(팔레 데 나시옹)」. 국제연맹 본부로 지어진 것으로 전해지는 건물 — 이 게임에선 외관과 위치만 담아요.',
  plainpalais: '마름모꼴 광장 「Plaine de Plainpalais(플랭팔레)」. 주중엔 벼룩시장과 청과 시장이 서는 시민의 마당이에요.',
  carouge: '사르데냐 왕국 시절 계획된 것으로 전해지는 저층 동네 「Carouge(카루주)」. 지중해풍 골목과 공방·카페가 이어져 \'제네바 속 작은 이탈리아\'로 불려요.',
  'parc-des-bastions': '성벽 아래 공원 「Parc des Bastions(바스티옹 공원)」. 사람 키만 한 야외 체스판과 종교개혁 기념비(19세기 말~20세기 초 조성으로 전해짐)가 있어요.',
  'gare-cornavin': '제네바의 중앙역 「Gare Cornavin(코르나뱅역)」. 파리·취리히 방면 열차가 드나드는 관문이에요.',
  'vieille-ville': '스위스에서 손꼽히게 큰 구시가로 알려진 「Vieille Ville(구시가)」. 돌계단 골목과 광장, 오래된 서점이 이어져요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameFr canonical.
export const GENEVA_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(GENEVA_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: GENEVA_DESC_KO[poi.id] ?? `제네바의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return GENEVA_COPY[locale]?.[id] || GENEVA_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'nations', label: 'UN 지구·파키', bounds: [77, 11, 212, 178], labelTile: [145, 95] },
  { id: 'rive-droite', label: '코르나뱅·역전', bounds: [97, 139, 193, 234], labelTile: [145, 187] },
  { id: 'rive-gauche', label: '구시가·바스티옹', bounds: [135, 178, 232, 262], labelTile: [184, 220] },
  { id: 'plainpalais', label: '플랭팔레', bounds: [97, 223, 166, 290], labelTile: [132, 257] },
  { id: 'carouge', label: '카루주', bounds: [89, 278, 174, 356], labelTile: [132, 317] },
  { id: 'lake', label: '레만호·제토', bounds: [166, 100, 290, 223], labelTile: [228, 162] },
];

// fr 도어 3종(fr-13~15) tile — 앵커 POI 곁 보행+이격 ≥2 스크립트 검증 배치.
const GENEVA_DOOR_TILES = Object.freeze({
  'fr-13': [179, 199], // 시계 공방 — 꽃시계(영국 정원) 곁
  'fr-14': [170, 217], // 퐁뒤 식당 — 구시가
  'fr-15': [128, 326], // 초콜릿 가게 — 카루주 공방 골목
});

export const CITY_NODES = [
  ...GENEVA_GEO.pois.map((poi) => {
    const copy = poiCopy(poi.id);
    return {
      id: poi.id,
      kind: 'spot',
      name: copy.name,
      nameFr: poi.nameFr,
      contentLocale: poi.contentLocale,
      facade: poi.id === 'gare-cornavin' ? 'station' : 'sign',
      tile: [poi.tile[0], poi.tile[1]],
      facing: 'down',
      noStamp: true,
      desc: copy.desc,
    };
  }),
  // 프랑스어 문화 도어 3종(fr-13~15 — 파리·마르세유와 별개 신규 세트) — track 명시 라우팅.
  ...GENEVA_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...GENEVA_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = GENEVA_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 무에트 수상 셔틀 선착장 2종(geo transitPoints — 도선 문법 9번째).
export const TRANSIT_POINTS = GENEVA_GEO.transitPoints.map((point) => ({
  id: point.id,
  nameJa: point.nameFr,
  nameFr: point.nameFr,
  yomi: '',
  contentLocale: point.contentLocale,
  tile: [point.tile[0], point.tile[1]],
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
// 코르나뱅은 단독역 — 표시 전용(루트 최소 2역 계약, 베이징 선례). 트램 확장은 후속 판단.
export const TRANSIT = [
  {
    // 🛶 무에트 수상 셔틀 — 호수 양안 횡단(~500m, 선사명 일반화 표기).
    id: 'geneva-mouettes', nameJa: 'Mouettes du lac', mode: 'ferry', color: 0xd9b23c,
    stopIds: ['paquis-jetee', 'eaux-vives-landing'],
    segmentMinutes: [5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 420, endMinute: 1260, headwayMinutes: 12 },
    ],
  },
];

// ⛲ 렌더크래프트 — 기존 kind 재사용 배치(보행/수면 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'fountain', tile: [152, 223] },  // 바스티옹 공원 분수
  { kind: 'stall', tile: [140, 237] },     // 플랭팔레 벼룩시장 좌판
  { kind: 'ferry_dom', tile: [194, 179] }, // 레만호 수면 — 무에트 소형선
  { kind: 'parasol', tile: [191, 155] },   // 파키 목욕장 파라솔
];

export function buildGenevaGrid() {
  const grid = Uint8Array.from(GENEVA_GEO.terrain);
  for (const [x, y] of GENEVA_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const GENEVA = {
  id: 'geneva', name: '제네바', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'geneva', // 오버월드 EMEA 게이트는 Codex-1 후속(코르나뱅 기준)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: GENEVA_GEO.railways,
  CITY_TILE, buildGrid: buildGenevaGrid,
};

export default GENEVA;
