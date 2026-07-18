// 🏙️ 런던 도시 정밀맵 — 실 OSM geo(#160, 1213×1002)를 CityScene 계약에 연결한다.
// 영어권 1호: 2축 [설정 언어 <현지 언어>] — name = nameEn, desc = ko 해설에 「nameEn(한글명)」 병기(파리 패턴).
// desc 사실 검증 2026-07-17(전승·통칭 헤지, 박물관 소장품·경기 재현 금지 — 외관·명칭만).
// 영어 도어 en-01~06: 슬러그가 프랑스어와 동형이라 track 필드 필수(trackChapterHref 라우팅).
// ⚠️ CityScene 호환: 역 표기 필드명 nameJa(레거시)에 nameEn 매핑 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { LONDON_GEO } from './london.geo.js';
import { LONDON_DOORS } from '../londonDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = LONDON_GEO.meta.grid.w;
export const ROWS = LONDON_GEO.meta.grid.h;
export const ENTRANCE = { ...LONDON_GEO.entrance };

// 검증 desc — 런던 24종
const LONDON_DESC_KO = Object.freeze({
  'westminster-abbey': '템스 곁의 「Westminster Abbey(웨스트민스터 사원)」. 1066년 이후 영국 군주의 대관식이 이곳에서 열려왔고, 뉴턴·다윈 등이 잠들어 있어요. 세계유산.',
  'houses-of-parliament': '영국 의회가 자리한 「Houses of Parliament(웨스트민스터궁)」. 시계탑 \'빅벤\'이라는 애칭은 원래 큰 종의 이름에서 왔다고 알려져 있어요. 세계유산.',
  'buckingham-palace': '영국 군주의 런던 거처 「Buckingham Palace(버킹엄궁)」. 궁 앞 근위병 교대식이 대표 볼거리예요.',
  'tower-of-london': '정복왕 윌리엄이 쌓기 시작한 성채 「Tower of London(런던탑)」. 왕궁·감옥·조폐소를 거쳐 지금은 왕관 보석의 보관처로 알려져 있어요. 세계유산.',
  'tower-bridge': '템스강의 도개교 「Tower Bridge(타워브리지)」. 1894년 개통 — 배가 지나면 다리가 들려요.',
  'st-pauls': '「St Paul\'s Cathedral(세인트폴 대성당)」. 런던 대화재 뒤 크리스토퍼 렌의 설계로 1710년경 완공된 돔 성당이에요.',
  'british-museum': '1753년 설립된 「British Museum(대영박물관)」. 세계 각지의 유물을 소장한 무료 입장 박물관 — 이 게임에선 외관만 담아요.',
  'trafalgar-square': '넬슨 제독 기념비가 선 「Trafalgar Square(트래펄가 광장)」. 내셔널갤러리가 광장 북쪽에 면해 있어요.',
  'covent-garden': '청과 시장에서 출발한 「Covent Garden(코번트가든)」. 지금은 아케이드 상점과 거리 공연으로 알려져 있어요.',
  'piccadilly-circus': '전광판과 에로스 동상(통칭)으로 알려진 교차로 「Piccadilly Circus(피커딜리 서커스)」.',
  'london-eye': '템스 남안의 대관람차 「London Eye(런던아이)」. 2000년 개장, 높이 135m예요.',
  'tate-modern': '화력발전소를 고친 현대미술관 「Tate Modern(테이트모던)」. 2000년 개관 — 터빈 홀의 거대한 공간이 상징이에요. 곁에 셰익스피어 글로브 극장(재건)이 있어요.',
  'borough-market': '런던브리지 곁의 식료품 시장 「Borough Market(버러마켓)」. 중세부터 이어진 시장으로 전해져요.',
  'the-shard': '2012년 완공된 「The Shard(더 샤드)」. 약 310m — 서유럽에서 손꼽히게 높은 마천루예요.',
  'camden-town': '운하 곁 마켓 거리 「Camden Town(캠든타운)」. 펑크·얼터너티브 문화의 본거지로 알려져 있어요.',
  'notting-hill': '파스텔색 집들의 동네 「Notting Hill(노팅힐)」. 포토벨로 로드 골동품 시장이 유명해요.',
  'hyde-park': '런던 서쪽의 큰 공원 「Hyde Park(하이드파크)」. 누구나 연단에 설 수 있는 \'스피커스 코너\' 전통으로 알려져 있어요.',
  'natural-history-museum': '1881년 개관한 「Natural History Museum(자연사박물관)」. 공룡 골격과 로마네스크풍 건물로 유명 — 외관만 담아요.',
  greenwich: '본초자오선이 지나는 「Maritime Greenwich(그리니치)」. 왕립천문대(1675년 설립)와 범선 커티삭이 있는 세계유산이에요.',
  'kew-gardens': '왕립식물원 「Kew Gardens(큐 가든)」. 1759년 기원으로 전해지며 — 빅토리아 시대 유리온실 팜하우스로 알려진 세계유산이에요.',
  wimbledon: '테니스의 성지로 알려진 「Wimbledon(윔블던)」 일대. 이 게임에선 동네와 외관만 담아요.',
  'hampstead-heath': '북런던의 언덕 초원 「Hampstead Heath(햄스테드 히스)」. 팔러먼트 힐에서 런던 스카이라인이 한눈에 보여요.',
  wembley: '아치가 상징인 「Wembley Stadium(웸블리)」 일대. 외관만 담아요.',
  'olympic-park': '2012년 런던 올림픽의 유산 「Queen Elizabeth Olympic Park(올림픽공원)」. 스트랫퍼드의 수변 공원이에요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, en 원문 학습축은 도어·씬에서 소비.
export const LONDON_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(LONDON_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameEn,
      desc: LONDON_DESC_KO[poi.id] ?? `런던의 대표 장소 「${poi.nameEn}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return LONDON_COPY[locale]?.[id] || LONDON_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'westminster', label: '웨스트민스터', bounds: [537, 490, 658, 590], labelTile: [598, 540] },
  { id: 'west-end', label: '웨스트엔드·소호', bounds: [527, 435, 651, 513], labelTile: [589, 474] },
  { id: 'city', label: '시티·세인트폴', bounds: [651, 435, 797, 529], labelTile: [724, 482] },
  { id: 'southbank', label: '사우스뱅크·버러', bounds: [624, 513, 790, 579], labelTile: [707, 546] },
  { id: 'kensington', label: '켄싱턴·하이드파크', bounds: [312, 468, 520, 613], labelTile: [416, 541] },
  { id: 'camden', label: '캠든·킹스크로스', bounds: [520, 307, 624, 418], labelTile: [572, 363] },
  { id: 'greenwich', label: '그리니치', bounds: [970, 602, 1109, 724], labelTile: [1040, 663] },
  { id: 'stratford', label: '스트랫퍼드·올림픽공원', bounds: [953, 268, 1091, 390], labelTile: [1022, 329] },
];

// 영어 도어 배치 타일 — geo 보행 타일 나선 탐색 계산치(기존 노드와 체비쇼프 ≥2 이격).
const LONDON_DOOR_TILES = Object.freeze({
  'en-01': [608, 383], // 튜브(킹스크로스)
  'en-02': [616, 488], // 펍(코번트가든)
  'en-03': [574, 498], // 카페(소호·피커딜리)
  'en-04': [722, 524], // 버러마켓
  'en-05': [598, 447], // 뮤지엄 매표소(대영박물관 곁)
  'en-06': [601, 386], // B&B 체크인(세인트판크라스 곁 — entrance 인근)
});

export const CITY_NODES = [
  ...LONDON_GEO.pois.map((poi) => {
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
  }),
  // 영어 문화 도어 6종 — track 명시 라우팅(trackChapterHref), 문화 사실은 desc 미리보기로.
  ...LONDON_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameEn,
    nameEn: door.nameEn,
    contentLocale: 'en',
    facade: 'sign',
    tile: [...LONDON_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].en} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 영어 도시는 nameEn을 그대로 싣는다(yomi 공란).
export const STATIONS = LONDON_GEO.stations.map((station) => ({
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
    // 서클선 실정차 순서(패딩턴→빅토리아→웨스트민스터→리버풀스트리트→킹스크로스) — 중간역 생략 축.
    id: 'london-circle', nameJa: 'Circle Line', mode: 'subway', color: 0xffd300,
    stopIds: ['paddington', 'victoria', 'westminster', 'liverpool-street', 'kings-cross'],
    segmentMinutes: [12, 4, 10, 8], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    // 주빌리선 유효 구간(웨스트민스터→워털루→런던브리지) — 실정차 순서.
    id: 'london-jubilee', nameJa: 'Jubilee Line', mode: 'subway', color: 0x868f98,
    stopIds: ['westminster', 'waterloo', 'london-bridge'],
    segmentMinutes: [2, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // 런던브리지발 그리니치행 국철의 게임 추상화 — 그리니치 세계유산 축.
    id: 'london-rail-greenwich', nameJa: 'National Rail (Greenwich)', mode: 'train', color: 0x00afad,
    stopIds: ['london-bridge', 'greenwich-station'],
    segmentMinutes: [10], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 40 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 12 },
    ],
  },
];

// ⛲ 렌더크래프트 R1.5 — 기존 kind 재사용 배치. 빅벤·타워브리지 실루엣은 베이킹 스펙 후속.
export const PROPS = [
  { kind: 'bigben', tile: [610, 560] },     // 빅벤 시계탑 실루엣(R3)
  { kind: 'towerbridge', tile: [780, 524] },// 타워브리지 2탑(R3)
  { kind: 'stall', tile: [726, 524] },    // 버러마켓 노점(en-04 도어 곁)
  { kind: 'fountain', tile: [597, 514] }, // 트래펄가 분수
];

export function buildLondonGrid() {
  const grid = Uint8Array.from(LONDON_GEO.terrain);
  for (const [x, y] of LONDON_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const LONDON = {
  id: 'london', name: '런던', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'london', // 오버월드 EMEA 세인트판크라스 노드는 Codex-1 게이트 라운드 후속(#175 후보 [172,356])
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: LONDON_GEO.railways,
  tileSkins: Object.freeze({ building: 'brick' }), // R4 — 적벽돌·슬레이트
  CITY_TILE, buildGrid: buildLondonGrid,
};

export default LONDON;
