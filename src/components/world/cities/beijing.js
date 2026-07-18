// 🏙️ 베이징 도시 정밀맵 — 실 OSM geo(#199, 342×390)를 CityScene 계약에 연결한다.
// 중국어권 4호(최종): name = nameZhHant(스키마 canonical), nameZhHans 병기(학습 트랙 정합).
// desc 사실 검증 2026-07-17(연도 전승 헤지·정치 서술 완전 배제 — 광장·기념물은 건축·지리만,
// 자금성 소장품 재현 금지, 중난하이 POI/라벨 부존재 확인 — 헌장 민감지역 규율).
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameZhHant 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BEIJING_GEO } from './beijing.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = BEIJING_GEO.meta.grid.w;
export const ROWS = BEIJING_GEO.meta.grid.h;
export const ENTRANCE = { ...BEIJING_GEO.entrance };

const BEIJING_DESC_KO = Object.freeze({
  'forbidden-city': '명·청 두 왕조의 황궁 「紫禁城(자금성)」. 1420년 무렵 완공된 것으로 전해지는 세계 최대급 목조 궁궐군이에요 — 이 게임에선 외관과 위치만 담아요.',
  'tiananmen-gate': '황성의 정문 성루 「天安門(천안문)」. 명대에 처음 세워져 청대에 다시 지어진 것으로 전해지는 붉은 성루 건축이에요.',
  'jingshan-park': '자금성 북쪽의 인공 언덕 「景山公園(경산공원)」. 만춘정에 오르면 자금성의 금빛 지붕 바다가 한눈에 내려다보여요.',
  'beihai-park': '요·금대 기원으로 전해지는 황실 원림 「北海公園(북해공원)」. 호수 가운데 섬 위 흰 백탑이 상징이에요.',
  qianmen: '내성의 정문 「前門(전문·정양문)」. 명대 건립으로 전해지며, 문루와 전루가 마주 보고 서 있어요.',
  'qianmen-street': '전문 남쪽으로 곧게 뻗은 옛 상가 「前門大街(전문대가)」. 오래된 상호의 점포들이 이어지는 거리예요.',
  wangfujing: '베이징의 보행 쇼핑가 「王府井大街(왕푸징대가)」. 백화점과 간식 골목이 함께 있는 번화가예요.',
  nanluoguxiang: '원대의 골목 구조가 남은 것으로 전해지는 후퉁 「南鑼鼓巷(난뤄구샹)」. 사합원 골목 사이로 작은 가게가 이어져요.',
  shichahai: '도심의 세 호수 「什剎海(스차하이)」. 여름엔 뱃놀이, 겨울엔 얼음 위 스케이트 — 호숫가로 후퉁이 이어져요.',
  'drum-tower': '시각을 알리던 북이 걸린 「鼓樓(고루)」. 원대 기원으로 전해지며, 지금 건물은 후대에 다시 지어진 것이에요.',
  'bell-tower': '고루 북쪽에 마주 선 「鐘樓(종루)」. 큰 종으로 아침을 알리던 회색 벽돌 누각이에요.',
  tiantan: '황제가 하늘에 제를 올리던 「天壇(천단)」의 기년전. 세 겹 처마의 원형 목조 전각으로, 지금 건물은 19세기 말 재건으로 전해져요. 세계유산.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, 정체/간체 병기는 geo 필드 유지.
export const BEIJING_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(BEIJING_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameZhHant,
      desc: BEIJING_DESC_KO[poi.id] ?? `베이징의 대표 장소 「${poi.nameZhHant}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return BEIJING_COPY[locale]?.[id] || BEIJING_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'gugong', label: '자금성·천안문', bounds: [141, 134, 231, 251], labelTile: [186, 193] },
  { id: 'qianmen', label: '전문·전문대가', bounds: [141, 251, 222, 345], labelTile: [182, 298] },
  { id: 'wangfujing', label: '왕푸징', bounds: [231, 178, 307, 278], labelTile: [269, 228] },
  { id: 'beihai', label: '북해·경산', bounds: [107, 95, 222, 178], labelTile: [165, 137] },
  { id: 'shichahai', label: '스차하이·후퉁', bounds: [51, 6, 192, 95], labelTile: [122, 51] },
  { id: 'gulou', label: '고루·난뤄구샹', bounds: [192, 6, 265, 111], labelTile: [229, 59] },
  { id: 'tiantan', label: '천단', bounds: [205, 301, 303, 389], labelTile: [254, 345] },
];

export const CITY_NODES = BEIJING_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameZhHant: poi.nameZhHant,
    nameZhHans: poi.nameZhHans,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
  };
});

// ⚠️ nameJa = 레거시 표기 필드. 정체 canonical, 간체 병기 보존.
export const STATIONS = BEIJING_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameZhHant,
  nameZhHant: station.nameZhHant,
  nameZhHans: station.nameZhHans,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
// 전문역(2호선)·스차하이역(8호선)은 유효 구간 내 단독역 — 표시 전용(루트 최소 2역 계약).
export const TRANSIT = [
  {
    // 1호선 유효 구간 실인접 정차(천안문동→왕푸징).
    id: 'beijing-metro-1', nameJa: '1號線', mode: 'subway', color: 0xc23a30,
    stopIds: ['tiananmen-east', 'wangfujing-station'],
    segmentMinutes: [2], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 5 },
    ],
  },
];

// 🏮 렌더크래프트 R1 — 기존 kind 재사용 배치. 자금성 지붕·백탑 등 신규 kind는 베이킹 스펙 후속.
export const PROPS = [
  { kind: 'stall', tile: [184, 300] }, // 전문대가 노점
  { kind: 'stall', tile: [265, 229] }, // 왕푸징 간식 골목 노점
];

export function buildBeijingGrid() {
  const grid = Uint8Array.from(BEIJING_GEO.terrain);
  for (const [x, y] of BEIJING_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const BEIJING = {
  id: 'beijing', name: '베이징', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'beijing', // 오버월드 APAC 베이징 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: BEIJING_GEO.railways,
  CITY_TILE, buildGrid: buildBeijingGrid,
};

export default BEIJING;
