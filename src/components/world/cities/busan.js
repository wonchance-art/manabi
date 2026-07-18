import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { BUSAN_GEO } from './busan.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = BUSAN_GEO.meta.grid.w;
export const ROWS = BUSAN_GEO.meta.grid.h;
export const ENTRANCE = { ...BUSAN_GEO.entrance };

// 검증 desc (2026-07-16 사실 검증 — 전승·통설은 헤지, 상표는 지리 참조만. 오사카·교토 규율 준용)
const BUSAN_DESC_KO = Object.freeze({
  haeundae: '부산 대표 해수욕장 「해운대해수욕장」. 여름 피서지의 대명사로 알려져 있어요.',
  gwangalli: '광안대교 야경을 정면으로 보는 「광안리해수욕장」. 해변 카페 거리가 이어져요.',
  'gwangan-bridge': '수영만을 가로지르는 「광안대교」. 2002년 완공된 총길이 약 7,420m의 2층 해상 교량이에요.',
  jagalchi: '남포동 바닷가의 수산시장 「자갈치시장」. 국내 대표 수산시장으로 알려져 있고, "오이소, 보이소, 사이소"가 상징 문구예요.',
  'gukje-market': '한국전쟁 후 형성된 원도심 재래시장 「국제시장」. 먹자골목으로도 유명해요.',
  gamcheon: '산비탈 계단식 마을 「감천문화마을」. 파스텔색 집과 골목 벽화로 \'한국의 마추픽추\'라는 별칭으로 불리기도 해요.',
  'busan-tower': '용두산공원의 전망탑 「부산타워(용두산공원)」. 1973년 개관한 높이 120m 탑으로 원도심과 부산항을 내려다봐요.',
  taejongdae: '영도 남단의 해안 절벽 명승 「태종대」. 신라 태종 무열왕이 들렀다는 전승에서 이름이 왔다고 전해져요.',
  'busan-port-intl': '「부산항국제여객터미널」. 후쿠오카 등 일본 노선 여객선이 오가는 관문 — 부산↔하카타 페리가 닿는 곳이에요.',
  dadaepo: '낙동강 하구 서편의 「다대포해수욕장」. 완만한 백사장과 몰운대 낙조 명소로 알려져 있어요.',
  eulsukdo: '낙동강 하구의 철새 도래지 「을숙도」. 겨울 철새가 찾는 습지로, 생태공원이 조성돼 있어요.',
  'dongnae-eupseong': '임진왜란 동래성 전투의 현장 「동래읍성」. 복원된 북문과 성곽 산책로가 남아 있고, 곁의 동래온천은 부산의 오랜 온천지예요.',
  'pnu-street': '「부산대앞 젊음의 거리」. 부산대학교 정문 앞으로 카페·소극장·헌책방 골목이 이어지는 대학가예요.',
});

// 설정 언어 < 현지 언어 확장 예약. 지금은 ko 슬롯만 저작하며 컴포넌트는 이 중앙 lookup 결과만 소비한다.
export const BUSAN_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(BUSAN_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameKo,
      desc: BUSAN_DESC_KO[poi.id] ?? `부산의 대표 장소 「${poi.nameKo}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return BUSAN_COPY[locale]?.[id] || BUSAN_COPY.ko[id];
}

// 구역 라벨(선거구 겸용 — 헌장 자치 기둥③) — 타일 경계는 webmercator 재투영 계산치.
export const ZONES = [
  { id: 'myeongji', label: '명지·다대포', bounds: [0, 668, 410, 1113], labelTile: [205, 891] },
  { id: 'sasang', label: '사상·낙동강', bounds: [319, 111, 592, 557], labelTile: [456, 334] },
  { id: 'wondosim', label: '원도심·남포', bounds: [546, 696, 728, 835], labelTile: [637, 766] },
  { id: 'busan-station', label: '부산역·초량', bounds: [637, 557, 774, 696], labelTile: [706, 627] },
  { id: 'yeongdo', label: '영도', bounds: [637, 807, 956, 1058], labelTile: [797, 933] },
  { id: 'seomyeon', label: '서면', bounds: [683, 362, 865, 529], labelTile: [774, 446] },
  { id: 'gwangalli', label: '광안리·수영', bounds: [956, 390, 1092, 585], labelTile: [1024, 488] },
  { id: 'haeundae', label: '해운대·센텀', bounds: [1001, 279, 1320, 501], labelTile: [1161, 390] },
  { id: 'dongnae', label: '동래·온천장', bounds: [774, 111, 956, 279], labelTile: [865, 195] },
  { id: 'pnu', label: '부산대', bounds: [819, 0, 956, 111], labelTile: [888, 56] },
];

export const CITY_NODES = BUSAN_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameKo: poi.nameKo,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
    // 🐟 자갈치 = 경매 아침 액트 씬 진입 게이트(액트 씬 2호 — MSM 수도원 문법).
    ...(poi.id === 'jagalchi' ? {
      gate: Object.freeze({ type: 'story-scene', scene: 'jagalchi-market-scene' }),
    } : {}),
  };
});

export const STATIONS = BUSAN_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameKo,
  nameKo: station.nameKo,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간과 운행 창은 게임 월드의 결정적 시뮬레이션 값이며 실제 시간표가 아니다.
export const TRANSIT = [
  {
    id: 'busan-line-1', nameJa: '부산도시철도 1호선', mode: 'subway', color: 0xe38b2c,
    stopIds: ['nampo', 'busan', 'seomyeon', 'dongnae-station', 'pnu-station'],
    segmentMinutes: [5, 10, 18, 7], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
  {
    id: 'busan-line-2', nameJa: '부산도시철도 2호선', mode: 'subway', color: 0x59a44b,
    stopIds: ['seomyeon', 'centum-city-station', 'haeundae-station'],
    segmentMinutes: [25, 10], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

// 🛳️ 렌더크래프트 R1.5 — 기존 kind 재사용 배치(수면/보행 판정+노드 이격 ≥2 계산치).
export const PROPS = [
  { kind: 'ferry_intl', tile: [710, 704] }, // 부산항 앞바다 — 하카타행 카페리(후쿠오카 국제항로 대칭)
  { kind: 'stall', tile: [642, 800] },      // 자갈치시장 노점
  { kind: 'stall', tile: [631, 771] },      // 국제시장 노점
  { kind: 'neon', tile: [1042, 481] },      // 광안리 네온
];

export function buildBusanGrid() {
  const grid = Uint8Array.from(BUSAN_GEO.terrain);
  for (const [x, y] of BUSAN_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const BUSAN = {
  id: 'busan', name: '부산', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'busan',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: BUSAN_GEO.railways,
  CITY_TILE, buildGrid: buildBusanGrid,
};

export default BUSAN;
