// 🏙️ 브뤼셀 도시 정밀맵 — 실 OSM geo(#169, 352×613)를 CityScene 계약에 연결한다.
// 다언어 복수 앵커 1호(§3-8): name = nameFr(canonical), nameNl 병기 노출은 후속 UI 안건.
// desc 사실 검증 2026-07-17(전승·통칭 헤지). 아토미움 = marker-only(오너 게이트 — 명칭·마커만).
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameFr 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BRUSSELS_GEO } from './brussels.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = BRUSSELS_GEO.meta.grid.w;
export const ROWS = BRUSSELS_GEO.meta.grid.h;
export const ENTRANCE = { ...BRUSSELS_GEO.entrance };

const BRUSSELS_DESC_KO = Object.freeze({
  'grand-place': '길드 하우스가 사방을 두른 「Grand-Place(그랑플라스)」. 1998년 세계유산 — 시청 첨탑이 약 96m로 광장을 내려다봐요.',
  'manneken-pis': '브뤼셀의 마스코트 「Manneken-Pis(마네켄피스)」. 60cm 남짓한 오줌싸개 동상으로, 행사 때마다 옷을 갈아입는 전통으로 알려져 있어요.',
  'galeries-royales': '유리 지붕의 아케이드 「Galeries Royales Saint-Hubert(갤러리 생튀베르)」. 1847년 개장한 유럽 초기의 쇼핑 아케이드로 전해져요.',
  cathedral: '두 탑의 고딕 성당 「Cathédrale Sts-Michel-et-Gudule(생미셸 대성당)」. 벨기에 왕실의 결혼식·대관 행사가 열려온 곳이에요.',
  'mont-des-arts': '정원 계단 위로 시내가 내려다보이는 「Mont des Arts(몽데자르)」. \'예술의 언덕\'이라는 이름처럼 도서관·미술관이 모여 있어요.',
  'magritte-museum': '초현실주의 화가 르네 마그리트를 다루는 「Musée Magritte(마그리트 미술관)」. 이 게임에선 외관만 담아요.',
  sablon: '골동품·초콜릿 상점가로 알려진 「Sablon(사블롱)」. 주말 골동품 시장이 열리는 광장 동네예요.',
  'royal-palace': '벨기에 국왕의 집무 궁전 「Palais Royal(브뤼셀 왕궁)」. 여름 한정 일반 공개로 알려져 있어요.',
  'parc-cinquantenaire': '독립 50주년을 기념해 조성된 「Parc du Cinquantenaire(생캉트네르 공원)」. 개선문과 박물관 단지가 있어요.',
  'eu-quarter': '유럽연합 기관들이 모인 「Quartier Européen(EU 지구)」. 베를레몽 건물 외관이 상징 — 이 게임에선 거리 풍경만 담아요.',
  'comics-museum': '아르누보 건물의 「Centre Belge de la BD(벨기에 만화센터)」. 빅토르 오르타 설계 건물로 전해져요 — 외관만 담아요.',
  atomium: '1958년 브뤼셀 만국박람회의 상징 「Atomium(아토미움)」. 철 결정 구조를 확대한 높이 약 102m의 구조물이에요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, fr/nl 병기는 geo 필드 유지.
export const BRUSSELS_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(BRUSSELS_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: BRUSSELS_DESC_KO[poi.id] ?? `브뤼셀의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return BRUSSELS_COPY[locale]?.[id] || BRUSSELS_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'old-town', label: '그랑플라스·구시가', bounds: [88, 251, 158, 334], labelTile: [123, 293] },
  { id: 'royal', label: '왕궁·사블롱', bounds: [105, 306, 176, 362], labelTile: [141, 334] },
  { id: 'eu', label: 'EU 지구·생캉트네르', bounds: [176, 290, 281, 362], labelTile: [229, 326] },
  { id: 'midi', label: '미디·남역', bounds: [18, 334, 88, 401], labelTile: [53, 368] },
  { id: 'north', label: '북역·보타니크', bounds: [112, 195, 183, 267], labelTile: [148, 231] },
  { id: 'laeken', label: '라켄·아토미움', bounds: [35, 0, 123, 84], labelTile: [79, 42] },
];

export const CITY_NODES = BRUSSELS_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameFr: poi.nameFr,
    nameNl: poi.nameNl,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
  };
});

// ⚠️ nameJa = 레거시 표기 필드. fr canonical, nl 병기 필드 보존.
export const STATIONS = BRUSSELS_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  nameNl: station.nameNl,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 남북 관통선 실정차 순서(미디→중앙→북역). 슈만은 EU 지구 도보 권역이라 후속.
    id: 'brussels-north-south', nameJa: 'Jonction Nord-Midi', mode: 'train', color: 0x2e5fa3,
    stopIds: ['bruxelles-midi', 'bruxelles-central', 'bruxelles-nord'],
    segmentMinutes: [3, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
];

// 🧇 렌더크래프트 R1.5 — 기존 kind 재사용 배치(브랜드 무언급 — 일반 노점).
export const PROPS = [
  { kind: 'gable', tile: [114, 298] },      // 그랑플라스 박공 지붕(R3)
  { kind: 'stall', tile: [116, 298] }, // 그랑플라스 곁 와플 노점
  { kind: 'stall', tile: [128, 332] }, // 사블롱 노점
];

export function buildBrusselsGrid() {
  const grid = Uint8Array.from(BRUSSELS_GEO.terrain);
  for (const [x, y] of BRUSSELS_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const BRUSSELS = {
  id: 'brussels', name: '브뤼셀', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  roadStyle: 'autotile-v1',
  returnNode: 'brussels', // 오버월드 노드는 Codex-1 게이트 라운드(미디 [242,375] 후보 검증 완료)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: BRUSSELS_GEO.railways,
  // 📖 여행책 지구제 v1 — T10 r3 실측 rect.
  districts: {
    version: 'district-v1',
    open: [
      { id: 'midi', label: '미디·남역', tiles: { rects: [[35, 335, 75, 375]] } },
      { id: 'historic-royal', label: '구시가·왕궁', tiles: { rects: [[90, 270, 175, 350]] } },
      { id: 'north', label: '북역·보타니크', tiles: { rects: [[125, 205, 155, 269]] } },
      {
        id: 'eu-laeken',
        label: 'EU 지구·라켄',
        tiles: { rects: [[205, 295, 270, 350], [55, 10, 95, 45]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  tileSkins: Object.freeze({ building: 'brick' }), // R4 — 벽돌 타운하우스 톤
  CITY_TILE, buildGrid: buildBrusselsGrid,
};

export default BRUSSELS;
