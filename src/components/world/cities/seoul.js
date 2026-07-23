import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { SEOUL_GEO } from './seoul.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = SEOUL_GEO.meta.grid.w;
export const ROWS = SEOUL_GEO.meta.grid.h;
export const ENTRANCE = { ...SEOUL_GEO.entrance };

// 검증 desc (2026-07-16 사실 검증 — 전승·통설 헤지, 상표는 지리 참조만. 오사카·교토 규율 준용)
const SEOUL_DESC_KO = Object.freeze({
  gyeongbokgung: '1395년(태조 4년) 창건된 조선왕조의 법궁 「경복궁」. 임진왜란 때 소실 후 고종 대(1865~1868년)에 중건됐어요. 근정전·경회루가 국보.',
  gwanghwamun: '경복궁의 정문 「광화문」. 현재 문루는 2010년 복원본이에요. 앞으로 광화문광장이 펼쳐져요.',
  'n-seoul-tower': '남산 정상의 전망탑 「N서울타워」. 1975년 완공, 탑 높이 236.7m — 서울 전경 조망 명소로 알려져 있어요.',
  myeongdong: '서울 대표 쇼핑 거리 「명동」. 화장품·패션 상점과 노점 먹거리로 관광객이 많이 찾는 곳이에요.',
  sungnyemun: '한양도성의 남대문 「숭례문」(국보). 1398년 완공, 2008년 화재 후 2013년 복구됐어요. 곁의 남대문시장은 조선 후기부터 이어진 시장으로 알려져 있어요.',
  bukchon: '경복궁과 창덕궁 사이 언덕의 한옥 밀집 지역 「북촌한옥마을」. 지금도 주민이 거주하는 동네라 조용히 걸어요.',
  insadong: '전통 공예품·화랑·찻집이 모인 거리 「인사동」. 붓·한지·도자 같은 전통 문화 상점가로 알려져 있어요.',
  cheonggyecheon: '도심을 가로지르는 하천 「청계천」. 복개 도로를 걷어내고 2005년 복원해 산책로가 됐어요.',
  ddp: '동대문의 곡면 디자인 건축 「동대문의 곡면 디자인 건축」. 현대식 설계로 알려진 2014년 개관 복합문화공간이에요.',
  heunginjimun: '한양도성의 동대문 「흥인지문」(보물). 한양도성 성문 가운데 유일하게 옹성(반달 모양 성곽)을 갖춘 문이에요.',
  hongdae: '홍익대학교 앞 「홍대거리」. 버스킹·클럽·소품숍이 모인 젊음의 거리예요.',
  'yeouido-63': '여의도의 금빛 초고층 빌딩 「63스퀘어」. 1985년 준공, 높이 249.6m — 준공 당시 아시아 최고층으로 알려졌어요.',
  coex: '삼성동의 대형 복합몰 「코엑스」. 별마당도서관(2017년 개장)의 대형 서가가 상징이 됐어요.',
  'lotte-world-tower': '잠실의 「롯데월드타워」. 2017년 개장, 555m·123층으로 국내 최고층 건물이에요.',
  changdeokgung: '1405년 창건된 조선의 이궁 「창덕궁」. 자연 지형을 살린 배치와 후원(비원)으로 1997년 유네스코 세계유산에 등재됐어요.',
  jongmyo: '조선 역대 왕과 왕비의 신주를 모신 사당 「종묘」. 1995년 세계유산 등재 — 정전의 긴 맞배지붕이 상징이에요.',
  seonjeongneung: '강남 도심 속 조선왕릉 「선릉·정릉」. 성종·중종 등의 능으로, 조선왕릉 전체가 2009년 세계유산에 등재됐어요.',
  'gimpo-airport': '서울 서쪽 관문 「김포공항」. 현재는 국내선과 단거리 국제선 중심 — 공항철도로 홍대입구·서울역과 이어져요.',
  'seoul-nat-univ': '관악산 자락의 「서울대학교」 관악캠퍼스. 1946년 개교한 국립대학이에요.',
  'amsa-dong': '한강변의 신석기시대 마을 유적 「암사동 선사유적」. 빗살무늬토기가 다수 출토된 집터 유적으로 알려져 있어요.',
  'seoul-forest': '2005년 개장한 한강·중랑천 합류부의 도시공원 「서울숲」. 사슴 방사장이 있는 생태숲이에요.',
  itaewon: '다국적 음식점과 상점이 모인 거리 「이태원」. 서울에서 가장 국제색 짙은 동네로 알려져 있어요.',
  'gwangjang-market': '1905년 문을 연 것으로 전해지는 서울에서 가장 오래된 상설시장 「광장시장」. 빈대떡·육회 같은 먹거리 골목과 한복·구제 상가로 붐벼요.',
});

export const SEOUL_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(SEOUL_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameKo,
      desc: SEOUL_DESC_KO[poi.id] ?? `서울의 대표 장소 「${poi.nameKo}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return SEOUL_COPY[locale]?.[id] || SEOUL_COPY.ko[id];
}

// 구역 라벨(선거구 겸용 — 헌장 자치 기둥③) — 타일 경계는 webmercator 재투영 계산치.
export const ZONES = [
  { id: 'gunggwol', label: '궁궐·종로', bounds: [706, 502, 949, 696], labelTile: [828, 599] },
  { id: 'myeongdong', label: '명동·남산', bounds: [794, 696, 949, 836], labelTile: [872, 766] },
  { id: 'dongdaemun', label: '동대문', bounds: [949, 613, 1059, 752], labelTile: [1004, 683] },
  { id: 'hongdae', label: '홍대·마포', bounds: [441, 669, 706, 836], labelTile: [574, 753] },
  { id: 'yeouido', label: '여의도', bounds: [529, 863, 706, 1002], labelTile: [618, 933] },
  { id: 'yongsan', label: '용산·이태원', bounds: [750, 808, 971, 947], labelTile: [861, 878] },
  { id: 'gangnam', label: '강남', bounds: [971, 947, 1235, 1114], labelTile: [1103, 1031] },
  { id: 'jamsil', label: '잠실', bounds: [1235, 891, 1500, 1058], labelTile: [1368, 975] },
  { id: 'gwanak', label: '관악·서울대', bounds: [618, 1141, 838, 1392], labelTile: [728, 1267] },
  { id: 'gimpo', label: '김포공항', bounds: [0, 585, 265, 780], labelTile: [133, 683] },
  { id: 'seongsu', label: '성수·서울숲', bounds: [1015, 724, 1235, 891], labelTile: [1125, 808] },
  { id: 'gangdong', label: '강동·암사', bounds: [1412, 613, 1677, 836], labelTile: [1545, 725] },
];

export const CITY_NODES = SEOUL_GEO.pois.map((poi) => {
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
  };
});

export const STATIONS = SEOUL_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameKo,
  nameKo: station.nameKo,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT = [
  {
    id: 'seoul-line-1', nameJa: '수도권 전철 1호선', mode: 'subway', color: 0x2f5ca8,
    stopIds: ['seoul', 'city-hall', 'jonggak', 'dongdaemun'],
    segmentMinutes: [3, 2, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    id: 'seoul-line-2', nameJa: '수도권 전철 2호선', mode: 'subway', color: 0x3b9b50,
    stopIds: ['hongik-university', 'city-hall', 'gangnam', 'samseong', 'jamsil'],
    segmentMinutes: [12, 25, 6, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
];

// 🏮 렌더크래프트 R1.5 — 기존 kind 재사용 배치(보행 판정+노드 이격 ≥2 계산치).
export const PROPS = [
  { kind: 'stall', tile: [862, 705] }, // 명동 노점
  { kind: 'neon', tile: [591, 737] },  // 홍대 네온
  { kind: 'stall', tile: [861, 646] }, // 인사동 노점
];

export function buildSeoulGrid() {
  const grid = Uint8Array.from(SEOUL_GEO.terrain);
  for (const [x, y] of SEOUL_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

// 🗺️ 서울 주동선 경로 — 서울역→홍대→여의도→강남역→코엑스→롯데월드타워→서울숲→동대문→경복궁→숭례문
// v3 정본(T26 proposal 실측 2026-07-23) — 10 waypoint / 9 leg / 2,609 steps / 2,610 tiles.
// 상태: 5/9 leg open-only PASS, 4 leg 연결부 locked 회랑 1,000타일. 회랑 rect 23개 추가로 open 전수.
const MAIN_ROUTE = Object.freeze({
  id: 'seoul-classic-loop-candidate-a',
  version: 1,
  waypoints: Object.freeze([
    Object.freeze({ kind: 'station', id: 'seoul' }),
    Object.freeze({ kind: 'node', id: 'hongdae' }),
    Object.freeze({ kind: 'node', id: 'yeouido-63' }),
    Object.freeze({ kind: 'station', id: 'gangnam' }),
    Object.freeze({ kind: 'node', id: 'coex' }),
    Object.freeze({ kind: 'node', id: 'lotte-world-tower' }),
    Object.freeze({ kind: 'node', id: 'seoul-forest' }),
    Object.freeze({ kind: 'node', id: 'ddp' }),
    Object.freeze({ kind: 'node', id: 'gyeongbokgung' }),
    Object.freeze({ kind: 'node', id: 'sungnyemun' }),
  ]),
  routing: Object.freeze({
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  }),
  segmentHints: Object.freeze([
    Object.freeze({
      from: Object.freeze({ kind: 'node', id: 'seoul-forest' }),
      to: Object.freeze({ kind: 'node', id: 'ddp' }),
      viaTiles: [[995, 791]],
    }),
  ]),
  branches: Object.freeze([]),
  discoveries: Object.freeze([
    Object.freeze({
      id: 'seoul-d1', leg: Object.freeze(['seoul', 'hongdae']), at: 0.50,
      line: '서울역 서쪽에서 마포·홍대 생활권으로 접어든 직후 — 도심 관문에서 서부 청년 문화권으로 바뀌는 구간이에요.',
    }),
    Object.freeze({
      id: 'seoul-d2', leg: Object.freeze(['hongdae', 'yeouido-63']), at: 0.55,
      line: '홍대 남쪽에서 한강·여의도권으로 내려가는 생활축 — 대학가와 업무·수변 지구의 전환이에요.',
    }),
    Object.freeze({
      id: 'seoul-d3', leg: Object.freeze(['yeouido-63', 'gangnam']), at: 0.08,
      line: '여의도 남동 끝자락 — 서남권 open 회랑을 벗어나 강남 방향 장거리 이동을 앞둔 구간이에요.',
    }),
    Object.freeze({
      id: 'seoul-d4', leg: Object.freeze(['gangnam', 'coex']), at: 0.55,
      line: '강남역에서 삼성동으로 이어지는 동서 업무축 — 대로와 지하철 환승권이 겹치는 구간이에요.',
    }),
    Object.freeze({
      id: 'seoul-d5', leg: Object.freeze(['coex', 'lotte-world-tower']), at: 0.88,
      line: '잠실권 open rect 진입 뒤 — 동부 대로에서 석촌호수 주변 고층 경관으로 바뀌는 구간이에요.',
    }),
    Object.freeze({
      id: 'seoul-d6', leg: Object.freeze(['lotte-world-tower', 'seoul-forest']), at: 0.95,
      line: '잠실에서 북서로 돌아 서울숲에 닿기 직전 — 강남권에서 성수·한강 북안으로 전환돼요.',
    }),
    Object.freeze({
      id: 'seoul-d7', leg: Object.freeze(['seoul-forest', 'ddp']), at: 0.55,
      line: '서울숲에서 사대문 안으로 복귀하는 경계 — 성수 생활권에서 동대문 도심축으로 접어드는 구간이에요.',
    }),
    Object.freeze({
      id: 'seoul-d8', leg: Object.freeze(['ddp', 'gyeongbokgung']), at: 0.55,
      line: '동대문에서 경복궁으로 잇는 종로·청계천권 — 상업 도심과 궁궐축이 만나는 구간이에요.',
    }),
  ]),
  segments: Object.freeze([
    Object.freeze({
      id: 'station:seoul--node:hongdae',
      from: Object.freeze({ kind: 'station', id: 'seoul' }),
      to: Object.freeze({ kind: 'node', id: 'hongdae' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 8 }, { direction: 'L', count: 34 }, { direction: 'U', count: 2 }, { direction: 'L', count: 9 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 3 }, { direction: 'U', count: 1 }, { direction: 'L', count: 16 }, { direction: 'D', count: 1 }, { direction: 'L', count: 52 }, { direction: 'U', count: 1 }, { direction: 'L', count: 20 }, { direction: 'D', count: 1 }, { direction: 'L', count: 4 }, { direction: 'D', count: 1 }, { direction: 'L', count: 25 }, { direction: 'D', count: 1 }, { direction: 'L', count: 36 }, { direction: 'U', count: 1 }, { direction: 'L', count: 3 }, { direction: 'U', count: 3 }, { direction: 'L', count: 5 },
      ]),
      stepCount: 230,
      tileCount: 231,
      pathSha256: 'bff35912705a2b58e513807c1d47c17639a0c2b795b68f65978ca4ca11cd3aaa',
    }),
    Object.freeze({
      id: 'node:hongdae--node:yeouido-63',
      from: Object.freeze({ kind: 'node', id: 'hongdae' }),
      to: Object.freeze({ kind: 'node', id: 'yeouido-63' }),
      stepsRle: Object.freeze([
        { direction: 'R', count: 5 }, { direction: 'D', count: 3 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 24 }, { direction: 'R', count: 1 }, { direction: 'D', count: 19 }, { direction: 'R', count: 3 }, { direction: 'D', count: 5 }, { direction: 'R', count: 4 }, { direction: 'D', count: 5 }, { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 1 }, { direction: 'D', count: 9 }, { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 2 }, { direction: 'D', count: 15 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 6 }, { direction: 'L', count: 2 }, { direction: 'D', count: 1 }, { direction: 'L', count: 2 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 3 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 5 }, { direction: 'D', count: 3 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 24 }, { direction: 'R', count: 1 },
      ]),
      stepCount: 328,
      tileCount: 329,
      pathSha256: '7ff38237d097f2823248a834d30aef104e4e4a7f1d1dec03c9e4d6ebde54db25',
    }),
    Object.freeze({
      id: 'node:yeouido-63--station:gangnam',
      from: Object.freeze({ kind: 'node', id: 'yeouido-63' }),
      to: Object.freeze({ kind: 'station', id: 'gangnam' }),
      stepsRle: Object.freeze([
        { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'R', count: 8 }, { direction: 'D', count: 15 }, { direction: 'R', count: 27 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 4 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 4 }, { direction: 'D', count: 2 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 3 }, { direction: 'D', count: 1 }, { direction: 'R', count: 12 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 63 }, { direction: 'D', count: 2 }, { direction: 'R', count: 2 }, { direction: 'D', count: 2 }, { direction: 'R', count: 7 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 2 }, { direction: 'R', count: 3 }, { direction: 'D', count: 2 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 14 }, { direction: 'D', count: 1 }, { direction: 'R', count: 24 }, { direction: 'D', count: 1 }, { direction: 'R', count: 4 }, { direction: 'U', count: 3 }, { direction: 'R', count: 4 }, { direction: 'U', count: 2 }, { direction: 'R', count: 8 }, { direction: 'U', count: 1 }, { direction: 'R', count: 49 }, { direction: 'D', count: 2 }, { direction: 'R', count: 7 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 2 }, { direction: 'R', count: 12 }, { direction: 'D', count: 2 }, { direction: 'R', count: 7 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 7 }, { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'R', count: 1 }, { direction: 'D', count: 6 },
      ]),
      stepCount: 527,
      tileCount: 528,
      pathSha256: 'd6d6dc93ed2e8fd69badaa41af5cbb0ffcac9783687feca4dde70a4b2dcc9694',
    }),
    Object.freeze({
      id: 'station:gangnam--node:coex',
      from: Object.freeze({ kind: 'station', id: 'gangnam' }),
      to: Object.freeze({ kind: 'node', id: 'coex' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 5 }, { direction: 'R', count: 2 }, { direction: 'U', count: 2 }, { direction: 'R', count: 1 }, { direction: 'U', count: 2 }, { direction: 'R', count: 1 }, { direction: 'U', count: 2 }, { direction: 'R', count: 2 }, { direction: 'U', count: 5 }, { direction: 'R', count: 1 }, { direction: 'U', count: 5 }, { direction: 'R', count: 1 }, { direction: 'U', count: 13 }, { direction: 'R', count: 1 }, { direction: 'U', count: 23 }, { direction: 'R', count: 24 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 8 }, { direction: 'U', count: 2 }, { direction: 'R', count: 5 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 1 }, { direction: 'R', count: 5 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 1 }, { direction: 'R', count: 1 }, { direction: 'U', count: 1 }, { direction: 'R', count: 14 }, { direction: 'U', count: 1 }, { direction: 'R', count: 34 }, { direction: 'U', count: 1 }, { direction: 'R', count: 7 }, { direction: 'U', count: 2 }, { direction: 'R', count: 5 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 2 }, { direction: 'R', count: 6 },
      ]),
      stepCount: 213,
      tileCount: 214,
      pathSha256: '0e214c6fe9bb94cc47fd2c065a29a6ce7df3efd6b658e429dc58cb61704bacc3',
    }),
    Object.freeze({
      id: 'node:coex--node:lotte-world-tower',
      from: Object.freeze({ kind: 'node', id: 'coex' }),
      to: Object.freeze({ kind: 'node', id: 'lotte-world-tower' }),
      stepsRle: Object.freeze([
        { direction: 'L', count: 3 }, { direction: 'D', count: 5 }, { direction: 'R', count: 2 }, { direction: 'D', count: 4 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 4 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 10 }, { direction: 'U', count: 1 }, { direction: 'R', count: 5 }, { direction: 'D', count: 2 }, { direction: 'R', count: 16 }, { direction: 'D', count: 2 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 2 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 11 }, { direction: 'U', count: 1 }, { direction: 'R', count: 1 }, { direction: 'U', count: 1 }, { direction: 'R', count: 1 }, { direction: 'U', count: 1 }, { direction: 'R', count: 19 }, { direction: 'U', count: 1 }, { direction: 'R', count: 1 }, { direction: 'U', count: 1 }, { direction: 'R', count: 19 }, { direction: 'U', count: 1 }, { direction: 'R', count: 11 }, { direction: 'U', count: 1 }, { direction: 'R', count: 3 }, { direction: 'U', count: 1 }, { direction: 'R', count: 25 }, { direction: 'U', count: 1 }, { direction: 'R', count: 10 }, { direction: 'U', count: 1 }, { direction: 'R', count: 9 }, { direction: 'U', count: 1 }, { direction: 'R', count: 16 }, { direction: 'U', count: 1 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 16 }, { direction: 'D', count: 3 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 },
      ]),
      stepCount: 245,
      tileCount: 246,
      pathSha256: 'b0d2d8102fb7c945cdca22e391fc640a6b9601c43097a78494c6c0b93310e0af',
    }),
    Object.freeze({
      id: 'node:lotte-world-tower--node:seoul-forest',
      from: Object.freeze({ kind: 'node', id: 'lotte-world-tower' }),
      to: Object.freeze({ kind: 'node', id: 'seoul-forest' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 2 }, { direction: 'R', count: 1 }, { direction: 'U', count: 1 }, { direction: 'R', count: 1 }, { direction: 'U', count: 6 }, { direction: 'L', count: 2 }, { direction: 'U', count: 3 }, { direction: 'L', count: 3 }, { direction: 'U', count: 14 }, { direction: 'L', count: 2 }, { direction: 'U', count: 12 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 6 }, { direction: 'L', count: 28 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 27 }, { direction: 'L', count: 1 }, { direction: 'U', count: 17 }, { direction: 'L', count: 1 }, { direction: 'U', count: 6 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 26 }, { direction: 'U', count: 1 }, { direction: 'L', count: 3 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 3 }, { direction: 'L', count: 9 }, { direction: 'U', count: 5 }, { direction: 'L', count: 3 }, { direction: 'U', count: 1 }, { direction: 'L', count: 6 }, { direction: 'U', count: 1 }, { direction: 'L', count: 19 }, { direction: 'U', count: 2 }, { direction: 'L', count: 16 }, { direction: 'U', count: 1 }, { direction: 'L', count: 3 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 22 }, { direction: 'U', count: 1 }, { direction: 'L', count: 6 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 4 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 5 }, { direction: 'U', count: 2 }, { direction: 'L', count: 3 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 34 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 4 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 3 }, { direction: 'U', count: 1 }, { direction: 'L', count: 11 }, { direction: 'U', count: 2 }, { direction: 'L', count: 5 }, { direction: 'U', count: 1 }, { direction: 'L', count: 21 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 4 },
      ]),
      stepCount: 467,
      tileCount: 468,
      pathSha256: '7d412f9d3d44ff94a831c5a75f4f1d0ed99ae2f723ec2258283ec5a0a5ecae60',
    }),
    Object.freeze({
      id: 'node:seoul-forest--node:ddp',
      from: Object.freeze({ kind: 'node', id: 'seoul-forest' }),
      to: Object.freeze({ kind: 'node', id: 'ddp' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 6 }, { direction: 'L', count: 23 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 6 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 5 }, { direction: 'U', count: 1 }, { direction: 'L', count: 10 }, { direction: 'U', count: 4 }, { direction: 'L', count: 52 }, { direction: 'U', count: 15 }, { direction: 'L', count: 1 }, { direction: 'U', count: 13 }, { direction: 'L', count: 21 }, { direction: 'U', count: 1 }, { direction: 'L', count: 9 }, { direction: 'U', count: 34 }, { direction: 'R', count: 1 }, { direction: 'U', count: 2 }, { direction: 'R', count: 1 }, { direction: 'U', count: 35 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 4 }, { direction: 'R', count: 4 },
      ]),
      stepCount: 261,
      tileCount: 262,
      pathSha256: 'bf773fc37ff4819bac7e509677227b2f4ea40ca628fab62a90e066f1b55655e3',
    }),
    Object.freeze({
      id: 'node:ddp--node:gyeongbokgung',
      from: Object.freeze({ kind: 'node', id: 'ddp' }),
      to: Object.freeze({ kind: 'node', id: 'gyeongbokgung' }),
      stepsRle: Object.freeze([
        { direction: 'L', count: 7 }, { direction: 'U', count: 1 }, { direction: 'L', count: 7 }, { direction: 'D', count: 1 }, { direction: 'L', count: 4 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 9 }, { direction: 'U', count: 3 }, { direction: 'L', count: 8 }, { direction: 'U', count: 1 }, { direction: 'L', count: 13 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 9 }, { direction: 'L', count: 87 }, { direction: 'U', count: 48 }, { direction: 'L', count: 3 }, { direction: 'U', count: 3 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 },
      ]),
      stepCount: 215,
      tileCount: 216,
      pathSha256: 'fd505512164b54c5425a3fced71b561755b0f43ad06538712a2f62cbbef61086',
    }),
    Object.freeze({
      id: 'node:gyeongbokgung--node:sungnyemun',
      from: Object.freeze({ kind: 'node', id: 'gyeongbokgung' }),
      to: Object.freeze({ kind: 'node', id: 'sungnyemun' }),
      stepsRle: Object.freeze([
        { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 8 }, { direction: 'R', count: 1 }, { direction: 'D', count: 20 }, { direction: 'L', count: 1 }, { direction: 'D', count: 8 }, { direction: 'L', count: 1 }, { direction: 'D', count: 46 }, { direction: 'L', count: 1 }, { direction: 'D', count: 4 }, { direction: 'L', count: 1 }, { direction: 'D', count: 11 }, { direction: 'L', count: 1 }, { direction: 'D', count: 8 }, { direction: 'L', count: 3 }, { direction: 'D', count: 1 }, { direction: 'L', count: 3 },
      ]),
      stepCount: 123,
      tileCount: 124,
      pathSha256: '6d379b9d2f4e0babe47ab3f29eae9979ae0a29eb7ee85daa005b8e0047c866a2',
    }),
  ]),
});

export const SEOUL = {
  id: 'seoul', name: '서울', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'seoul',
  roadStyle: 'autotile-v1',
  // 📖 여행책 지구제 v1 (D2 4호 — T5 실측 docs/proposal-district-rects.md 그대로, 개방 5.91%).
  // T26 mainRoute 회랑 23개 rect 추가 반영 — 경로 전수 open 보행.
  districts: {
    version: 'district-v1',
    open: [
      { id: 'historic-core', label: '사대문 안', tiles: { rects: [[780, 570, 995, 790], [735, 738, 781, 747]] } },
      { id: 'west', label: '서남권', tiles: { rects: [[550, 700, 700, 970], [699, 738, 738, 743], [699, 961, 736, 979], [733, 975, 766, 996], [762, 993, 796, 1013], [792, 1010, 830, 1027]] } },
      { id: 'southeast', label: '강남·잠실', tiles: { rects: [[1020, 970, 1230, 1095], [1340, 950, 1410, 1010], [826, 1024, 875, 1030], [872, 1026, 913, 1039], [910, 1033, 956, 1040], [952, 1030, 1001, 1036], [998, 1030, 1021, 1037], [1229, 988, 1271, 1001], [1268, 985, 1316, 992], [1313, 983, 1341, 989], [1338, 933, 1375, 951], [1320, 904, 1341, 937], [1317, 859, 1323, 908], [1282, 846, 1321, 862]] } },
      { id: 'river-north', label: '한강 북안', tiles: { rects: [[870, 791, 1120, 900], [1245, 835, 1286, 849], [1201, 831, 1248, 839], [1163, 821, 1204, 835], [1123, 813, 1166, 825], [1119, 813, 1126, 817]] } },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: SEOUL_GEO.railways,
  mainRoute: MAIN_ROUTE,
  CITY_TILE, buildGrid: buildSeoulGrid,
};

export default SEOUL;
