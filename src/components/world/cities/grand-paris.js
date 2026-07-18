// 🏙️ 그랑파리 도시 정밀맵 — 실 OSM geo(#154·#157, 1355×891)를 CityScene 계약에 연결한다.
// 지형·POI·역 좌표는 grand-paris.geo.js가 단일 진실원, 여기서는 게임용 콘텐츠만 덧씌운다.
// 2축 [설정 언어 <현지 언어>]: name = nameFr(현지어), desc = ko 해설에 「nameFr(한글명)」 병기.
// desc 사실 검증 2026-07-17(전승·통칭 헤지, 미술관은 외관·명칭 참조 — 소장품 재현 금지).
// ⚠️ CityScene 호환: 역 표기 필드명이 nameJa(레거시)라 nameFr를 그대로 매핑한다 — 개명 후속 P3.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { GRAND_PARIS_GEO } from './grand-paris.geo.js';
import { PARIS_DOORS } from '../parisDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = GRAND_PARIS_GEO.meta.grid.w;
export const ROWS = GRAND_PARIS_GEO.meta.grid.h;
export const ENTRANCE = { ...GRAND_PARIS_GEO.entrance };

// 검증 desc — 그랑파리 22종
const GRAND_PARIS_DESC_KO = Object.freeze({
  'eiffel-tower': '1889년 만국박람회를 위해 세워진 「Tour Eiffel(에펠탑)」. 높이 약 330m — 완공 당시 세계에서 가장 높은 구조물이었어요.',
  louvre: '세계 최대급 미술관 「Musée du Louvre(루브르)」. 왕궁을 미술관으로 바꾼 곳으로, 유리 피라미드는 1989년에 더해졌어요.',
  'notre-dame': '시테섬의 대성당 「Cathédrale Notre-Dame(노트르담)」. 1163년 착공된 고딕 대성당으로, 2019년 화재 후 2024년 12월 재개관했어요.',
  'arc-de-triomphe': '샹젤리제 서쪽 끝의 「Arc de Triomphe(개선문)」. 나폴레옹이 명했고 1836년 완공, 높이 약 50m예요.',
  'champs-elysees': '콩코르드 광장에서 개선문까지 약 1.9km 뻗은 「Champs-Élysées(샹젤리제 거리)」. \'세상에서 가장 아름다운 거리\'로 불리기도 해요.',
  'sacre-coeur': '몽마르트르 언덕 위 흰 대성당 「Sacré-Cœur(사크레쾨르)」. 1914년 완공됐고, 계단 아래로 파리 시내가 펼쳐져요.',
  'musee-orsay': '센 강변의 「Musée d\'Orsay(오르세 미술관)」. 1900년 기차역 건물을 고쳐 1986년 미술관으로 열었어요 — 인상파 소장으로 알려져 있어요.',
  pompidou: '배관을 겉으로 드러낸 파격 건축 「Centre Pompidou(퐁피두 센터)」. 1977년 개관한 복합 문화 공간이에요.',
  luxembourg: '라탱 지구 곁의 정원 「Jardin du Luxembourg(뤽상부르 정원)」. 1612년 마리 드 메디시스가 조성을 시작했다고 전해져요.',
  pantheon: '라탱 지구 언덕의 「Panthéon(팡테옹)」. 볼테르·루소·위고 등 프랑스 위인들이 안장된 국립묘당이에요.',
  invalides: '금빛 돔의 「Les Invalides(앵발리드)」. 루이 14세가 세운 상이군인 요양소로, 나폴레옹의 묘가 있어요.',
  concorde: '파리 최대 광장 「Place de la Concorde(콩코르드 광장)」. 중앙의 오벨리스크는 이집트 룩소르에서 온 것이에요.',
  'opera-garnier': '1875년 개관한 오페라 극장 「Opéra Garnier(오페라 가르니에)」. 화려한 대계단으로 알려져 있어요.',
  'pont-neuf': '이름은 \'새 다리\'지만 파리에서 가장 오래된 다리 「Pont Neuf(퐁뇌프)」. 1607년 완공됐어요.',
  marais: '귀족 저택가에서 출발한 역사 지구 「Le Marais(마레)」. 보주 광장과 골목 상점가가 이어져요.',
  'quartier-latin': '소르본(1257년 기원)을 품은 「Quartier Latin(라탱 지구)」. 중세부터 학생들이 라틴어를 쓰던 데서 이름이 왔다고 전해져요.',
  'montparnasse-tower': '몽파르나스의 「Tour Montparnasse(몽파르나스 타워)」. 1973년 완공된 약 210m 오피스 타워 — 전망대에서 에펠탑이 보여요.',
  versailles: '루이 14세가 궁정을 옮긴(1682년) 「Château de Versailles(베르사유궁)」. 거울의 방과 정원으로 1979년 세계유산에 등재됐어요.',
  'grande-arche': '라데팡스의 「Grande Arche(그랑드아르슈)」. 1989년 완공 — 루브르에서 개선문으로 이어지는 역사축의 서쪽 끝이에요.',
  'saint-denis-basilica': '파리 북쪽의 「Basilique Saint-Denis(생드니 대성당)」. 고딕 양식의 발상지로 꼽히고, 프랑스 왕들의 묘소예요.',
  'bois-de-boulogne': '파리 서쪽의 큰 숲 「Bois de Boulogne(불로뉴숲)」. 호수와 산책로가 있는 시민의 휴식처예요.',
  vincennes: '파리 동쪽의 중세 성채 「Château de Vincennes(뱅센성)」. 높은 중세 성탑이 남아 있는 왕실 거성이었어요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, fr 원문 학습축은 도어·씬에서 소비.
export const GRAND_PARIS_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(GRAND_PARIS_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: GRAND_PARIS_DESC_KO[poi.id] ?? `파리의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return GRAND_PARIS_COPY[locale]?.[id] || GRAND_PARIS_COPY.ko[id];
}

// 구역 라벨 — 타일 경계는 webmercator 재투영 계산치.
export const ZONES = [
  { id: 'cite-louvre', label: '시테·루브르', bounds: [824, 401, 970, 529], labelTile: [897, 465] },
  { id: 'marais', label: '마레', bounds: [923, 412, 996, 490], labelTile: [960, 451] },
  { id: 'latin', label: '라탱·생제르맹', bounds: [806, 473, 934, 568], labelTile: [870, 521] },
  { id: 'eiffel', label: '에펠·앵발리드', bounds: [659, 418, 806, 529], labelTile: [733, 474] },
  { id: 'champs', label: '샹젤리제·오페라', bounds: [696, 345, 897, 418], labelTile: [797, 382] },
  { id: 'montmartre', label: '몽마르트르', bounds: [824, 251, 934, 345], labelTile: [879, 298] },
  { id: 'montparnasse', label: '몽파르나스', bounds: [751, 529, 861, 624], labelTile: [806, 577] },
  { id: 'bercy', label: '베르시·리옹역', bounds: [952, 501, 1080, 624], labelTile: [1016, 563] },
  { id: 'defense', label: '라데팡스', bounds: [439, 223, 568, 318], labelTile: [504, 271] },
  { id: 'boulogne', label: '불로뉴숲', bounds: [494, 345, 641, 490], labelTile: [568, 418] },
  { id: 'vincennes', label: '뱅센숲', bounds: [1099, 501, 1318, 668], labelTile: [1209, 585] },
  { id: 'versailles', label: '베르사유', bounds: [0, 668, 220, 807], labelTile: [110, 738] },
  { id: 'saint-denis', label: '생드니', bounds: [879, 0, 1025, 111], labelTile: [952, 56] },
];

// 프랑스어 도어 배치 타일 — geo 보행 타일 나선 탐색 계산치(앵커: 라탱·몽마르트르·샤틀레·마레·루브르·북역).
const PARIS_DOOR_TILES = Object.freeze({
  'fr-01': [887, 499], // 카페(라탱 지구)
  'fr-02': [887, 293], // 불랑제리(몽마르트르)
  'fr-03': [901, 451], // 메트로 승강장(샤틀레)
  'fr-04': [953, 457], // 마르셰(마레)
  'fr-05': [862, 439], // 미술관 매표소(루브르 곁)
  'fr-06': [931, 326], // 호텔 체크인(북역 곁 — entrance 인근)
});

export const CITY_NODES = [
  ...GRAND_PARIS_GEO.pois.map((poi) => {
    const copy = poiCopy(poi.id);
    return {
      id: poi.id,
      kind: 'spot',
      name: copy.name,
      nameFr: poi.nameFr,
      contentLocale: poi.contentLocale,
      facade: 'sign',
      tile: [poi.tile[0], poi.tile[1]],
      facing: 'down',
      noStamp: true,
      desc: copy.desc,
    };
  }),
  // 프랑스어 문화 도어 6종 — track 명시 라우팅(trackChapterHref), 문화 사실은 desc 미리보기로.
  ...PARIS_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...PARIS_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: 'french',
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
  })),
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = GRAND_PARIS_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님 — 도쿄·부산 관행).
export const TRANSIT = [
  {
    // 메트로 1호선 실정차 축(라데팡스~샤틀레~리옹역) — 전노선 재현은 과함(스펙 합의).
    id: 'paris-metro-1', nameJa: 'Métro 1', mode: 'subway', color: 0xf2c500,
    stopIds: ['la-defense', 'chatelet', 'gare-de-lyon'],
    segmentMinutes: [14, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    // RER B·D 공유 구간(북역~샤틀레) — 실정차 순서.
    id: 'paris-rer-bd', nameJa: 'RER B·D', mode: 'train', color: 0x4a90d9,
    stopIds: ['gare-du-nord', 'chatelet'],
    segmentMinutes: [4], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 8 },
    ],
  },
  {
    // 몽파르나스발 베르사유행 트랑질리앵의 게임 추상화(실착역 샹티에를 리브고슈로 접음 — 주석 고정).
    id: 'paris-transilien-versailles', nameJa: 'Transilien (Versailles)', mode: 'train', color: 0x7bb36e,
    stopIds: ['montparnasse', 'versailles-rive-gauche'],
    segmentMinutes: [22], dwellMinutes: 2,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 40 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 15 },
    ],
  },
];

// ⛲ 렌더크래프트 R1.5 — 기존 kind 재사용 배치. 에펠 실루엣 등 신규 kind는 베이킹 스펙 후속.
export const PROPS = [
  { kind: 'eiffel', tile: [714, 452] },     // 🗼 에펠탑 실루엣(POI 곁 — R3)
  { kind: 'pyramide', tile: [867, 444] },   // 루브르 유리 피라미드(R3)
  { kind: 'fountain', tile: [812, 416] }, // 콩코르드 분수
  { kind: 'stall', tile: [957, 461] },    // 마레 마르셰 노점
];

export function buildGrandParisGrid() {
  const grid = Uint8Array.from(GRAND_PARIS_GEO.terrain);
  for (const [x, y] of GRAND_PARIS_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const GRAND_PARIS = {
  id: 'grand-paris', name: '파리', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'paris',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: GRAND_PARIS_GEO.railways,
  tileSkins: Object.freeze({ building: 'zinc' }), // R4 — 오스만 아연 지붕
  CITY_TILE, buildGrid: buildGrandParisGrid,
};

export default GRAND_PARIS;
