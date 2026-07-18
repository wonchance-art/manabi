// 🏙️ 캔버라 도시 정밀맵 — 실 OSM geo(#219, 546×501)를 CityScene 계약에 연결한다.
// 호주 3호(영어권 4호): name = nameEn canonical, ko desc에 「nameEn(한글명)」 병기(런던 패턴).
// desc 사실 검증 2026-07-18(연도 전승 헤지·국회의사당/전쟁기념관은 건축 외관·지리 참조만 —
// 정치·군사 서술 완전 배제(자금성·천안문 선례 준용)·브랜드 일반화·인물 재현 금지).
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameEn 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { CANBERRA_GEO } from './canberra.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = CANBERRA_GEO.meta.grid.w;
export const ROWS = CANBERRA_GEO.meta.grid.h;
export const ENTRANCE = { ...CANBERRA_GEO.entrance };

// 검증 desc — 캔버라 10종
const CANBERRA_DESC_KO = Object.freeze({
  'parliament-house': '캐피털 힐의 「Parliament House(국회의사당)」. 1988년 무렵 완공된 것으로 전해지는 잔디 지붕 건축 — 언덕 자체가 지붕이 되는 설계예요. 이 게임에선 건축 외관만 담아요.',
  'old-parliament-house': '흰 신고전주의 건물 「Old Parliament House(구 국회의사당)」. 1927년 무렵 지어진 것으로 전해지며, 지금은 잔디밭 너머로 신청사와 마주 보고 서 있어요.',
  'australian-war-memorial': '안작 퍼레이드 축선 끝의 「Australian War Memorial(전쟁기념관)」. 돔 지붕의 사암 건축이 마운트 에인슬리 기슭에 자리해요 — 이 게임에선 건물 외관과 위치만 담아요.',
  'lake-burley-griffin': '도시 한가운데의 인공 호수 「Lake Burley Griffin(벌리그리핀호)」. 1960년대 조성으로 전해지며, 계획도시 캔버라의 남북을 가르는 중심축이에요.',
  'captain-cook-jet': '호수 위로 솟는 물기둥 「Captain Cook Memorial Jet(캡틴쿡 분수)」. 맑은 날이면 100m가 넘는 물줄기가 멀리서도 보여요.',
  'national-library': '호숫가의 흰 열주 건물 「National Library of Australia(국립도서관)」. 그리스 신전풍 외관이 수면에 비쳐요 — 외관만 담아요.',
  questacon: '흰 원통형의 「Questacon(퀘스타콘)」. 과학관 건물로, 호숫가 산책로 곁에 서 있어요 — 외관만 담아요.',
  'commonwealth-park': '호수 북안의 「Commonwealth Park(커먼웰스 파크)」. 봄이면 큰 꽃 축제가 열리는 것으로 알려진 잔디 공원이에요.',
  'mount-ainslie': '도시 동북쪽의 「Mount Ainslie(마운트 에인슬리)」. 전망대에 오르면 안작 퍼레이드에서 국회의사당까지 계획도시의 축선이 일직선으로 내려다보여요.',
  braddon: '시빅 북쪽의 「Braddon(브래던)」. 옛 차고 거리가 카페·브런치 골목으로 바뀐 동네예요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, en 원문 학습축은 도어·씬에서 소비.
export const CANBERRA_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(CANBERRA_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameEn,
      desc: CANBERRA_DESC_KO[poi.id] ?? `캔버라의 대표 장소 「${poi.nameEn}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return CANBERRA_COPY[locale]?.[id] || CANBERRA_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'civic', label: '시빅·브래던', bounds: [282, 156, 386, 267], labelTile: [334, 212] },
  { id: 'parliament', label: '국회 삼각지대', bounds: [218, 306, 341, 417], labelTile: [280, 362] },
  { id: 'lake', label: '벌리그리핀호', bounds: [114, 234, 432, 345], labelTile: [273, 290] },
  { id: 'campbell', label: '캠벨·전쟁기념관', bounds: [363, 167, 477, 278], labelTile: [420, 223] },
  { id: 'kingston', label: '킹스턴·캔버라역', bounds: [341, 378, 454, 473], labelTile: [398, 426] },
  { id: 'ainslie', label: '에인슬리 산자락', bounds: [386, 100, 500, 211], labelTile: [443, 156] },
];

export const CITY_NODES = CANBERRA_GEO.pois.map((poi) => {
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
});

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 영어 도시는 nameEn을 그대로 싣는다(yomi 공란).
export const STATIONS = CANBERRA_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameEn,
  nameEn: station.nameEn,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
// 캔버라역(NSW TrainLink)은 유효 구간 내 단독역 — 표시 전용(루트 최소 2역 계약). 페리 없음.
export const TRANSIT = [
  {
    // 라이트레일 유효 구간 실정차 축(앨링가 스트리트→딕슨 — 중간역 생략).
    id: 'canberra-light-rail', nameJa: 'Canberra Light Rail', mode: 'train', color: 0xc73e3e,
    stopIds: ['alinga-street', 'dickson'],
    segmentMinutes: [8], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

// ⛲ 렌더크래프트 R1.5 — 캡틴쿡 분수는 호수 수면 배치(POI desc와 시각 일치).
export const PROPS = [
  { kind: 'fountain', tile: [321, 286] }, // 캡틴쿡 분수(벌리그리핀호 수면)
];

export function buildCanberraGrid() {
  const grid = Uint8Array.from(CANBERRA_GEO.terrain);
  for (const [x, y] of CANBERRA_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const CANBERRA = {
  id: 'canberra', name: '캔버라', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'canberra', // 오버월드 APAC 캔버라 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: CANBERRA_GEO.railways,
  CITY_TILE, buildGrid: buildCanberraGrid,
};

export default CANBERRA;
