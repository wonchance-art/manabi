// 🏙️ 멜버른 도시 정밀맵 — 실 OSM geo(#227, 484×557)를 CityScene 계약에 연결한다.
// 호주 4호(영어권 5호) — 오너 확정 큐 최종 도시. name = nameEn canonical, ko desc에
// 「nameEn(한글명)」 병기(런던 패턴). desc 사실 검증 2026-07-18(연도 전승 헤지·MCG 경기·구단
// 재현 금지(웸블리 선례)·전쟁기념관 외관·지리만(캔버라 선례)·호이지어 레인 특정 작품 재현 금지).
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameEn 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { MELBOURNE_GEO } from './melbourne.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = MELBOURNE_GEO.meta.grid.w;
export const ROWS = MELBOURNE_GEO.meta.grid.h;
export const ENTRANCE = { ...MELBOURNE_GEO.entrance };

// 검증 desc — 멜버른 12종
const MELBOURNE_DESC_KO = Object.freeze({
  'flinders-street-station': '노란 돔의 「Flinders Street station(플린더스 스트리트역)」. 1910년 무렵 완공된 것으로 전해지는 역사(驛舍)로, \'시계 아래에서 만나\'는 멜버른의 약속 장소예요.',
  'federation-square': '기하학 파사드의 광장 「Federation Square(페더레이션 스퀘어)」. 강변과 역 사이 — 멜버른의 행사와 만남이 모이는 앞마당이에요.',
  'hosier-lane': '골목 전체가 그림으로 덮인 「Hosier Lane(호이지어 레인)」. 거리 미술이 수시로 바뀌는 골목이라 갈 때마다 풍경이 달라요.',
  'queen-victoria-market': '19세기부터 이어진 것으로 전해지는 「Queen Victoria Market(퀸빅토리아마켓)」. 청과·델리·잡화 천막이 블록을 가득 채워요.',
  'state-library': '돔 열람실로 알려진 「State Library Victoria(주립도서관)」. 1850년대 개관 기원으로 전해지는 오래된 도서관 — 잔디밭 앞 계단이 만남의 장소예요.',
  'carlton-gardens': '왕립전시관을 품은 「Carlton Gardens(칼튼 가든)」. 1880년 무렵 세워진 것으로 전해지는 전시관 건물과 함께 세계유산으로 등재돼 있어요 — 외관만 담아요.',
  'lygon-street': '이탈리안 지구의 중심 「Lygon Street(라이곤 스트리트)」. 노천 테이블과 젤라토 가게가 이어지는 거리 — 멜버른 커피 문화의 뿌리로 알려져 있어요.',
  'fitzroy-brunswick-st': '빈티지와 라이브 바의 거리 「Brunswick Street, Fitzroy(피츠로이 브런즈윅 스트리트)」. 개성 있는 상점이 이어지는 동네예요.',
  'royal-botanic-gardens': '야라강 남안의 「Royal Botanic Gardens(왕립식물원)」. 1846년 기원으로 전해지는 큰 정원 — 호수 둘레 산책로가 유명해요.',
  'shrine-of-remembrance': '왕립식물원 곁 언덕의 「Shrine of Remembrance(전쟁기념관)」. 그리스 신전풍 석조 건축이 도심 축선과 마주 보고 서 있어요 — 이 게임에선 건물 외관과 위치만 담아요.',
  mcg: '\'The G\'라는 애칭의 「Melbourne Cricket Ground(MCG)」. 10만 명 규모급으로 알려진 대형 경기장 — 이 게임에선 외관만 담아요.',
  'st-kilda': '트램으로 닿는 바닷가 동네 「St Kilda Beach(세인트킬다)」. 긴 부두와 해변 산책로, 케이크 가게 골목으로 알려져 있어요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, en 원문 학습축은 도어·씬에서 소비.
export const MELBOURNE_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(MELBOURNE_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameEn,
      desc: MELBOURNE_DESC_KO[poi.id] ?? `멜버른의 대표 장소 「${poi.nameEn}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return MELBOURNE_COPY[locale]?.[id] || MELBOURNE_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'cbd', label: '시티(CBD)·호이지어', bounds: [229, 150, 330, 234], labelTile: [280, 192] },
  { id: 'carlton', label: '칼튼·라이곤', bounds: [264, 56, 330, 150], labelTile: [297, 103] },
  { id: 'fitzroy', label: '피츠로이', bounds: [330, 56, 396, 150], labelTile: [363, 103] },
  { id: 'southbank', label: '사우스뱅크·식물원', bounds: [242, 211, 374, 323], labelTile: [308, 267] },
  { id: 'east', label: '이스트멜버른·MCG', bounds: [330, 167, 440, 267], labelTile: [385, 217] },
  { id: 'st-kilda', label: '세인트킬다', bounds: [286, 423, 396, 534], labelTile: [341, 479] },
  { id: 'docklands', label: '도클랜즈·서던크로스', bounds: [154, 167, 242, 250], labelTile: [198, 209] },
];

export const CITY_NODES = MELBOURNE_GEO.pois.map((poi) => {
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
export const STATIONS = MELBOURNE_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameEn,
  nameEn: station.nameEn,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 시티루프 유효 구간 실순환 순서(플린더스→서던크로스→멜버른센트럴→팔러먼트 — 단방향 축으로 접음).
    id: 'melbourne-city-loop', nameJa: 'City Loop', mode: 'subway', color: 0x2b6fb3,
    stopIds: ['flinders-street', 'southern-cross', 'melbourne-central', 'parliament'],
    segmentMinutes: [3, 3, 2], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // 시티서클 트램의 게임 추상화(무료 순환 트램 — 플린더스↔팔러먼트 구간, 기존 train 모드 재사용).
    id: 'melbourne-city-circle-tram', nameJa: 'City Circle Tram', mode: 'train', color: 0x8c5a3c,
    stopIds: ['flinders-street', 'parliament'],
    segmentMinutes: [6], dwellMinutes: 1,
    serviceWindows: [{ startMinute: 600, endMinute: 1080, headwayMinutes: 12 }],
  },
];

// 프롭(플린더스 돔·트램 차체·호이지어 벽 등)은 렌더크래프트 후속.
export const PROPS = [];

export function buildMelbourneGrid() {
  const grid = Uint8Array.from(MELBOURNE_GEO.terrain);
  for (const [x, y] of MELBOURNE_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const MELBOURNE = {
  id: 'melbourne', name: '멜버른', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'melbourne', // 오버월드 APAC 멜버른 노드는 Codex-1 게이트 라운드 후속
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: MELBOURNE_GEO.railways,
  CITY_TILE, buildGrid: buildMelbourneGrid,
};

export default MELBOURNE;
