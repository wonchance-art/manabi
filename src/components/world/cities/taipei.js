// 🏙️ 타이베이 도시 정밀맵 — 실 OSM geo(#179, 454×501)를 CityScene 계약에 연결한다.
// 중국어권 1호: name = nameZhHant(현지 정체 canonical), nameZhHans 병기(학습 트랙 정합).
// desc 사실 검증 2026-07-17(전승 헤지·정치 서술 배제 고정·고궁 외관만 — 헌장 민감지역 규율).
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameZhHant 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { TAIPEI_GEO } from './taipei.geo.js';
import { ZH_DOORS } from '../zhDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = TAIPEI_GEO.meta.grid.w;
export const ROWS = TAIPEI_GEO.meta.grid.h;
export const ENTRANCE = { ...TAIPEI_GEO.entrance };

const TAIPEI_DESC_KO = Object.freeze({
  'taipei-101': '신이 지구의 마천루 「臺北101(타이베이 101)」. 2004년 완공된 약 508m 타워로, 한때 세계에서 가장 높은 건물이었어요.',
  'longshan-temple': '완화의 오래된 사원 「龍山寺(용산사)」. 1738년 창건으로 전해지며, 향 연기 속에 참배가 이어지는 타이베이 신앙의 중심이에요.',
  ximending: '보행자 거리의 원조 격인 「西門町(시먼딩)」. 영화관·거리 공연·간식 노점이 모인 젊음의 거리예요.',
  'cks-memorial': '흰 벽과 파란 팔각지붕의 「中正紀念堂(중정기념당)」. 광장 양옆의 국가희극원·음악청과 함께 큰 광장을 이뤄요.',
  'national-palace-museum': '와이솽시 계곡의 「國立故宮博物院(고궁박물원)」. 이 게임에선 건물 외관과 위치만 담아요.',
  'shilin-market': '타이베이 최대 야시장 「士林夜市(스린야시장)」. 지하 미식구역과 골목 노점으로 알려져 있어요.',
  'raohe-market': '쑹산 자락의 직선형 야시장 「饒河街夜市(라오허제야시장)」. 입구 패루(牌樓)가 상징이에요.',
  'dihua-street': '차·건어물·한약재 상가가 이어지는 「迪化街(디화제)」. 19세기 다다오청 항구 상업가에서 출발한 옛 거리예요.',
  bopiliao: '청대 거리 풍경이 보존된 「剝皮寮(보피랴오)」. 붉은 벽돌 골목이 영화 촬영지로도 쓰여요.',
  'daan-park': '도심의 큰 숲 공원 「大安森林公園(다안삼림공원)」. \'타이베이의 폐\'로 불리기도 해요.',
  'huashan-1914': '옛 양조장을 고친 문화지구 「華山1914(화산1914)」. 이름의 1914는 양조장이 들어선 해에서 왔어요.',
  'elephant-mountain': '101 전망 명소로 유명한 「象山(샹산)」. 짧지만 가파른 등산로 끝 바위 전망대에서 도심이 한눈에 보여요.',
  'presidential-office': '붉은 벽돌의 「總統府(총통부)」 청사. 1919년 완공된 건축물로, 이 게임에선 외관만 담아요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, 정체/간체 병기는 geo 필드 유지.
export const TAIPEI_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(TAIPEI_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameZhHant,
      desc: TAIPEI_DESC_KO[poi.id] ?? `타이베이의 대표 장소 「${poi.nameZhHant}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return TAIPEI_COPY[locale]?.[id] || TAIPEI_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'wanhua', label: '완화·시먼딩', bounds: [25, 345, 126, 445], labelTile: [76, 395] },
  { id: 'zhongzheng', label: '중정·타이베이역', bounds: [91, 334, 176, 445], labelTile: [134, 390] },
  { id: 'datong', label: '다퉁·디화제', bounds: [76, 251, 151, 334], labelTile: [114, 293] },
  { id: 'east', label: '동구·충샤오', bounds: [227, 345, 353, 445], labelTile: [290, 395] },
  { id: 'xinyi', label: '신이·101', bounds: [328, 390, 444, 490], labelTile: [386, 440] },
  { id: 'shilin', label: '스린', bounds: [126, 56, 227, 178], labelTile: [177, 117] },
  { id: 'shilin-palace', label: '고궁·와이솽시', bounds: [252, 0, 353, 84], labelTile: [303, 42] },
  { id: 'daan', label: '다안', bounds: [192, 401, 277, 490], labelTile: [235, 446] },
];

// 중국어 도어 배치 타일 — geo 보행 타일 나선 탐색 계산치(기존 노드와 체비쇼프 ≥2 이격).
// 중국어권 1호 도시가 공용 도어 6종을 싣는다(파리 fr·런던 en 선례).
const TAIPEI_DOOR_TILES = Object.freeze({
  'zh-01': [100, 293], // 찻집(디화제 — 차 상가)
  'zh-02': [171, 121], // 야시장 노점(스린야시장)
  'zh-03': [90, 376],  // 지하철 매표기(시먼역)
  'zh-04': [47, 403],  // 사원 향로(용산사)
  'zh-05': [83, 375],  // 식당(시먼딩)
  'zh-06': [439, 326], // 시장 골목(라오허제야시장)
});

export const CITY_NODES = [
  ...TAIPEI_GEO.pois.map((poi) => {
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
  }),
  // 중국어 문화 도어 6종 — track 명시 라우팅(trackChapterHref), 문화 사실은 desc 미리보기로.
  ...ZH_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.name,
    nameZh: door.nameZh,
    contentLocale: 'zh',
    facade: 'sign',
    tile: [...TAIPEI_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].zh} ${door.lines[0].pinyin} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa = 레거시 표기 필드. 정체 canonical, 간체 병기 보존.
export const STATIONS = TAIPEI_GEO.stations.map((station) => ({
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
export const TRANSIT = [
  {
    // 단수이신이선 유효 구간 실정차 순서(스린→타이베이역→101 방면).
    id: 'taipei-tamsui-xinyi', nameJa: '淡水信義線', mode: 'subway', color: 0xd9333f,
    stopIds: ['shilin', 'taipei-main', 'taipei-101-station'],
    segmentMinutes: [12, 14], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 7 },
    ],
  },
  {
    // 반난선 유효 구간(시먼→타이베이역→충샤오푸싱).
    id: 'taipei-bannan', nameJa: '板南線', mode: 'subway', color: 0x2c6bb3,
    stopIds: ['ximen', 'taipei-main', 'zhongxiao-fuxing'],
    segmentMinutes: [2, 6], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 7 },
    ],
  },
];

// 🏮 렌더크래프트 R1 — 기존 kind 재사용 배치. 101 실루엣·패루 등 신규 kind는 베이킹 스펙 후속.
export const PROPS = [
  { kind: 'stall', tile: [175, 118] }, // 스린야시장 노점
  { kind: 'stall', tile: [443, 330] }, // 라오허제 노점
  { kind: 'neon', tile: [86, 372] },   // 시먼딩 네온
];

export function buildTaipeiGrid() {
  const grid = Uint8Array.from(TAIPEI_GEO.terrain);
  for (const [x, y] of TAIPEI_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const TAIPEI = {
  id: 'taipei', name: '타이베이', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'taipei', // 오버월드 APAC 타이베이 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: TAIPEI_GEO.railways,
  CITY_TILE, buildGrid: buildTaipeiGrid,
};

export default TAIPEI;
