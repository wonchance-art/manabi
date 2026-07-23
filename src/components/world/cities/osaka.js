import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { OSAKA_GEO } from './osaka.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = OSAKA_GEO.meta.grid.w;
export const ROWS = OSAKA_GEO.meta.grid.h;
const EXIT_TILES = [[414, 177], [414, 178]];
export const ENTRANCE = { x: 414, y: 187, facing: 'down' };

export const ZONES = [
  { id: 'umeda', label: '梅田', bounds: [350, 130, 480, 225], labelTile: [407, 155] },
  { id: 'osaka-castle', label: '大阪城', bounds: [500, 225, 620, 330], labelTile: [550, 245] },
  { id: 'namba', label: '難波／道頓堀', bounds: [390, 330, 510, 420], labelTile: [425, 345] },
  { id: 'tennoji', label: '天王寺', bounds: [420, 420, 560, 530], labelTile: [470, 505] },
  { id: 'bay', label: '大阪港', bounds: [60, 380, 210, 520], labelTile: [120, 410] },
];

// POI 별 검증 desc(공식 소스 리서치 2026-07-15 — 단정 회피·전승 헤지·상표 지리참조만)와 전용 파사드.
//   geo pois 와 자동 동기(목록은 geo 가 진실원, 여기선 표현만 얹음). 미등재 id 는 안전 폴백.
const POI_FACADE = {
  'osaka-castle': 'castle', ebisubashi: 'bigscreen', tsutenkaku: 'tsutenkaku',
  'kuromon-market': 'stall', shitennoji: 'sign', 'osaka-aquarium': 'sign', 'nakanoshima-park': 'sign',
};
const POI_DESC = {
  'osaka-castle': '도요토미 히데요시가 1583년 축성을 시작한 오사카의 상징적인 성 「大阪城」(おおさかじょう). 현재 천수각은 1931년 시민 기부로 재건된 3대째예요.',
  ebisubashi: '도톤보리강에 걸린 다리 「戎橋」(えびすばし). 1615년 도톤보리 개착과 함께 놓였다고 전해지고, 대형 전광판과 네온사인이 밀집한 번화가 풍경으로 알려져 있어요.',
  tsutenkaku: '신세카이(新世界)의 전망탑 「通天閣」(つうてんかく). 초대 탑은 1912년, 현재의 2대째 탑은 1956년에 세워졌고 높이는 108m예요.',
  'kuromon-market': "'오사카의 부엌'으로 불리는 시장 「黒門市場」(くろもんいちば). 약 580m 아케이드에 신선식품 상점 150곳 정도가 늘어서 있어요.",
  'osaka-aquarium': '환태평양 화산대를 테마로 한 대형 수족관 「海遊館」(かいゆうかん). 1990년 개관했고, 깊이 9m의 중앙 수조에서 고래상어가 헤엄쳐요.',
  'nakanoshima-park': '도지마강과 도사보리강 사이의 수변 공원 「中之島公園」(なかのしまこうえん). 1891년 개설된 오사카시 최초의 공원으로, 장미원이 알려져 있어요.',
  shitennoji: '쇼토쿠 태자가 593년에 세운 것으로 전해지는 사찰 「四天王寺」(してんのうじ). 중문·오중탑·금당·강당이 일직선으로 늘어서는 가람배치로 유명해요.',
  'kuchu-teien': '초고층 쌍둥이 빌딩 꼭대기를 잇는 옥상 전망대 「空中庭園展望台」(くうちゅうていえんてんぼうだい). 1993년 완공됐고, 지상 173m 원형 데크에서 우메다 일대와 요도가와가 한눈에 내려다보여요.',
};

export const CITY_NODES = [
  ...OSAKA_GEO.pois.map((poi) => ({
    id: poi.id,
    kind: 'spot',
    name: poi.nameJa,
    facade: POI_FACADE[poi.id] || 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: POI_DESC[poi.id] || `오사카의 대표 장소 「${poi.nameJa}」(${poi.yomi}). 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
  })),
  // ── NPC 대화 노드(가공 무대 — geo POI 아님) — 후쿠오카 패턴 재사용(스크립트는 도시 불문 제네릭).
  //   타일은 보행+보행인접+기존 마커 Chebyshev ≥3 이격을 스크립트로 검증해 고정.
  {
    id: 'osaka-izakaya', kind: 'npc', npc: 'izakaya', chapter: 'ot-08-izakaya', name: '居酒屋',
    tile: [437, 366], facing: 'down', noStamp: true,
    desc: '도톤보리 골목의 이자카야(居酒屋). 안 시켜도 나오는 유료 기본 안주 お通し(오토시)와 첫 주문 「とりあえず生で」를 써 볼 곳이에요.',
  },
  {
    id: 'osaka-konbini', kind: 'npc', npc: 'konbini', chapter: 'ot-07-konbini', name: 'コンビニ',
    tile: [469, 385], facing: 'down', noStamp: true,
    desc: '黒門市場 곁 24시간 편의점(コンビニ). 계산대 대답은 딱 두 개 — お願いします(네)·大丈夫です(됐어요)라고 하면 돼요.',
  },
  // ── 채움 라운드 3-1: 도쿄·오사카 8지구 NPC 4종 (owner 2026-07-23) ──
  {
    id: 'osaka-north-hubs-transfer', kind: 'npc', npc: 'osaka-north-hubs-transfer', chapter: 'ot-11-densha', name: '乗り換え案内員',
    tile: [435, 5], facing: 'down', noStamp: true,
    desc: '오사카 북부 교통 허브의 환승 안내원 「乗り換え案内員」(のりかえあんないいん). 환승 노선, 출구 방향, 빠른 식사를 안내받아요.',
  },
  {
    id: 'osaka-castle-east-guide', kind: 'npc', npc: 'osaka-castle-east-guide', chapter: 'ot-09-jinja', name: '公園案内員',
    tile: [553, 262], facing: 'down', noStamp: true,
    desc: '오사카성 동쪽 공원 안내원 「公園案内員」(こうえんあんないいん). 관광 동선과 전통 공방 체험 순서를 배워요.',
  },
];

export const STATIONS = OSAKA_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT = [
  {
    id: 'osaka-loop', nameJa: '大阪環状線', mode: 'train', color: 0xd96b36,
    stopIds: ['osaka', 'fukushima', 'nishikujo', 'bentencho', 'taisho', 'shin-imamiya', 'tennoji', 'tsuruhashi', 'morinomiya', 'kyobashi', 'sakuranomiya', 'temma'],
    segmentMinutes: [3, 5, 4, 4, 5, 3, 6, 5, 4, 4, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 24 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 7 },
    ],
  },
  {
    id: 'osaka-shin-osaka-link', nameJa: '新大阪連絡線', mode: 'train', color: 0x4f96c8,
    stopIds: ['shin-osaka', 'osaka'], segmentMinutes: [5],
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

export const PROPS = [
  // 도톤보리 — 무브랜드 네온 거리(戎橋 노드 곁, ≥3 이격·상호 비겹침 간격 계산).
  { kind: 'neon', tile: [439, 364] },
  { kind: 'bigscreen', tile: [441, 364] },
  { kind: 'neon', tile: [443, 364] },
  // 신세카이 — 通天閣 아래 상점가 네온.
  { kind: 'neon', tile: [460, 455] },
  { kind: 'neon', tile: [462, 455] },
  // 黒門市場 — 아케이드 매대 열.
  { kind: 'stall', tile: [463, 384] },
  { kind: 'stall', tile: [465, 384] },
];

// 오사카 mainRoute v3 정본 — 도시 루프 9waypoint, 1,220타일, 관광 일본 2호.
// 세그먼트·sha는 docs/proposal-osaka-mainroute.md(T26 재검증) 정식본을 핀함.
// 발견점(d1~d8)은 각 leg 구간 콘텍스트를 오사카 여행자 관점으로 직저작.
export const MAIN_ROUTE = Object.freeze({
  id: 'osaka-classic-loop-candidate-a',
  version: 1,
  waypoints: Object.freeze([
    Object.freeze({ kind: 'station', id: 'osaka' }),
    Object.freeze({ kind: 'node', id: 'kuchu-teien' }),
    Object.freeze({ kind: 'node', id: 'nakanoshima-park' }),
    Object.freeze({ kind: 'node', id: 'osaka-castle' }),
    Object.freeze({ kind: 'node', id: 'shitennoji' }),
    Object.freeze({ kind: 'station', id: 'tennoji' }),
    Object.freeze({ kind: 'node', id: 'tsutenkaku' }),
    Object.freeze({ kind: 'node', id: 'kuromon-market' }),
    Object.freeze({ kind: 'node', id: 'ebisubashi' }),
    Object.freeze({ kind: 'node', id: 'osaka-aquarium' }),
  ]),
  routing: Object.freeze({
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  }),
  segmentHints: Object.freeze([
    Object.freeze({
      from: Object.freeze({ kind: 'node', id: 'nakanoshima-park' }),
      to: Object.freeze({ kind: 'node', id: 'osaka-castle' }),
      viaTiles: [[538, 245]],
    }),
  ]),
  branches: Object.freeze([]),
  discoveries: Object.freeze([
    Object.freeze({
      id: 'osaka-d1', leg: Object.freeze(['osaka', 'kuchu-teien']), at: 0.50,
      line: '우메다 역세권을 빠져나가며 만나는 고가 선로와 대형 보행축의 교차 — 미들타운의 거리에서 공중정원으로 올라가는 길이에요.',
    }),
    Object.freeze({
      id: 'osaka-d2', leg: Object.freeze(['kuchu-teien', 'nakanoshima-park']), at: 0.55,
      line: '초고층 빌딩 숲에서 도지마강 수변의 도심으로 내려가는 구간 — 업무 센터에서 공원 섬으로 건너가는 전환점이에요.',
    }),
    Object.freeze({
      id: 'osaka-d3', leg: Object.freeze(['nakanoshima-park', 'osaka-castle']), at: 0.68,
      line: '수변 도시 공간에서 성곽 공원권으로 건너가는 open 교량 — 두 지구가 맞닿는 전환점을 지나 녹지로 들어가요.',
    }),
    Object.freeze({
      id: 'osaka-d4', leg: Object.freeze(['osaka-castle', 'shitennoji']), at: 0.12,
      line: '오사카성 남쪽 공원 보행축 — 해자 주변 녹지에서 나가며 남부 생활권 장거리 이동을 앞둔 구간이에요.',
    }),
    Object.freeze({
      id: 'osaka-d5', leg: Object.freeze(['shitennoji', 'tennoji']), at: 0.50,
      line: '사찰권에서 텐노지역 광장으로 내려가는 길 — 고찰의 침묵에서 역세권의 활기로 전환돼요.',
    }),
    Object.freeze({
      id: 'osaka-d6', leg: Object.freeze(['tennoji', 'tsutenkaku']), at: 0.55,
      line: '텐노지역 교통 중심에서 신세카이 전망탑으로 서진하는 보행축 — 역세권에서 상점가 거리로 바뀌어요.',
    }),
    Object.freeze({
      id: 'osaka-d7', leg: Object.freeze(['tsutenkaku', 'kuromon-market']), at: 0.50,
      line: '신세카이 관광 중심가에서 북쪽 시장권으로 이어지는 생활 골목 — 기념품과 신선 식재료가 뒤섞인 길목이에요.',
    }),
    Object.freeze({
      id: 'osaka-d8', leg: Object.freeze(['ebisubashi', 'osaka-aquarium']), at: 0.95,
      line: '난바 번화가를 빠져나가 항만 open 구간을 지나 수족관 앞에 다다르는 구간 — 도시 가로에서 부두·수변 경관으로 바뀌어요.',
    }),
  ]),
  segments: Object.freeze([
    Object.freeze({
      id: 'station:osaka--node:kuchu-teien',
      from: Object.freeze({ kind: 'station', id: 'osaka' }),
      to: Object.freeze({ kind: 'node', id: 'kuchu-teien' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 3 }, { direction: 'L', count: 1 }, { direction: 'U', count: 4 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 2 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 1 }, { direction: 'L', count: 22 }, { direction: 'U', count: 1 }, { direction: 'L', count: 1 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 4 }, { direction: 'R', count: 2 },
      ]),
      stepCount: 48,
      tileCount: 49,
      pathSha256: 'a54413ff0119c96e045119eaf8b63beb06acdaa4dbc7ed4c7457e191b3688adf',
    }),
    Object.freeze({
      id: 'node:kuchu-teien--node:nakanoshima-park',
      from: Object.freeze({ kind: 'node', id: 'kuchu-teien' }),
      to: Object.freeze({ kind: 'node', id: 'nakanoshima-park' }),
      stepsRle: Object.freeze([
        { direction: 'L', count: 2 }, { direction: 'D', count: 4 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 22 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 4 }, { direction: 'R', count: 4 }, { direction: 'D', count: 1 }, { direction: 'R', count: 2 }, { direction: 'D', count: 2 }, { direction: 'R', count: 8 }, { direction: 'D', count: 1 }, { direction: 'R', count: 25 }, { direction: 'D', count: 4 }, { direction: 'R', count: 10 }, { direction: 'D', count: 4 }, { direction: 'R', count: 1 }, { direction: 'D', count: 12 }, { direction: 'R', count: 2 }, { direction: 'D', count: 1 }, { direction: 'R', count: 1 }, { direction: 'D', count: 14 }, { direction: 'R', count: 2 }, { direction: 'D', count: 5 }, { direction: 'R', count: 1 }, { direction: 'D', count: 14 },
      ]),
      stepCount: 158,
      tileCount: 159,
      pathSha256: '92bed1523e43f9fe5088c1c61880bc87a87d881c4ce7466a72139a31379f262c',
    }),
    Object.freeze({
      id: 'node:nakanoshima-park--node:osaka-castle',
      from: Object.freeze({ kind: 'node', id: 'nakanoshima-park' }),
      to: Object.freeze({ kind: 'node', id: 'osaka-castle' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 2 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 27 }, { direction: 'D', count: 1 }, { direction: 'R', count: 9 }, { direction: 'U', count: 1 }, { direction: 'R', count: 4 }, { direction: 'U', count: 1 }, { direction: 'R', count: 19 }, { direction: 'D', count: 4 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 7 }, { direction: 'D', count: 10 }, { direction: 'R', count: 2 }, { direction: 'D', count: 6 }, { direction: 'R', count: 1 }, { direction: 'D', count: 1 }, { direction: 'R', count: 5 }, { direction: 'D', count: 12 }, { direction: 'R', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 2 }, { direction: 'U', count: 1 }, { direction: 'R', count: 1 }, { direction: 'U', count: 3 }, { direction: 'R', count: 3 },
      ]),
      stepCount: 130,
      tileCount: 131,
      pathSha256: 'b9541de191124b440edb0c26575a45850eb3afb75da8933830cdc50771d96ecc',
    }),
    Object.freeze({
      id: 'node:osaka-castle--node:shitennoji',
      from: Object.freeze({ kind: 'node', id: 'osaka-castle' }),
      to: Object.freeze({ kind: 'node', id: 'shitennoji' }),
      stepsRle: Object.freeze([
        { direction: 'L', count: 2 }, { direction: 'D', count: 10 }, { direction: 'L', count: 11 }, { direction: 'D', count: 3 }, { direction: 'L', count: 4 }, { direction: 'D', count: 7 }, { direction: 'L', count: 1 }, { direction: 'D', count: 5 }, { direction: 'L', count: 1 }, { direction: 'D', count: 24 }, { direction: 'L', count: 2 }, { direction: 'D', count: 3 }, { direction: 'L', count: 1 }, { direction: 'D', count: 13 }, { direction: 'L', count: 1 }, { direction: 'D', count: 9 }, { direction: 'L', count: 1 }, { direction: 'D', count: 11 }, { direction: 'L', count: 1 }, { direction: 'D', count: 8 }, { direction: 'L', count: 1 }, { direction: 'D', count: 9 }, { direction: 'L', count: 1 }, { direction: 'D', count: 4 }, { direction: 'L', count: 1 }, { direction: 'D', count: 6 }, { direction: 'L', count: 1 }, { direction: 'D', count: 7 }, { direction: 'L', count: 1 }, { direction: 'D', count: 5 }, { direction: 'L', count: 1 }, { direction: 'D', count: 15 }, { direction: 'L', count: 1 }, { direction: 'D', count: 5 }, { direction: 'L', count: 1 }, { direction: 'D', count: 5 }, { direction: 'L', count: 1 }, { direction: 'D', count: 7 }, { direction: 'L', count: 1 }, { direction: 'D', count: 8 }, { direction: 'L', count: 1 }, { direction: 'D', count: 13 }, { direction: 'L', count: 2 }, { direction: 'D', count: 5 }, { direction: 'L', count: 4 }, { direction: 'D', count: 1 }, { direction: 'L', count: 6 },
      ]),
      stepCount: 231,
      tileCount: 232,
      pathSha256: '365692435280e19b8d9e343d3524466aeb598518e57fb7766ca83d5c5890dcc7',
    }),
    Object.freeze({
      id: 'node:shitennoji--station:tennoji',
      from: Object.freeze({ kind: 'node', id: 'shitennoji' }),
      to: Object.freeze({ kind: 'station', id: 'tennoji' }),
      stepsRle: Object.freeze([
        { direction: 'R', count: 1 }, { direction: 'D', count: 3 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'R', count: 1 }, { direction: 'D', count: 7 }, { direction: 'L', count: 1 }, { direction: 'D', count: 15 }, { direction: 'R', count: 2 }, { direction: 'D', count: 10 }, { direction: 'L', count: 2 },
      ]),
      stepCount: 48,
      tileCount: 49,
      pathSha256: 'fd3b13ce4585e08481fb2329255e9a793cdcf57c6155842f36b6481a1263b516',
    }),
    Object.freeze({
      id: 'station:tennoji--node:tsutenkaku',
      from: Object.freeze({ kind: 'station', id: 'tennoji' }),
      to: Object.freeze({ kind: 'node', id: 'tsutenkaku' }),
      stepsRle: Object.freeze([
        { direction: 'U', count: 3 }, { direction: 'L', count: 6 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 }, { direction: 'U', count: 19 }, { direction: 'L', count: 20 }, { direction: 'U', count: 1 }, { direction: 'L', count: 3 }, { direction: 'U', count: 4 }, { direction: 'L', count: 11 },
      ]),
      stepCount: 70,
      tileCount: 71,
      pathSha256: '2d5113ec82be427d27ba9ed321da429fd8612c513763524ae3da5f3ba8e3c09f',
    }),
    Object.freeze({
      id: 'node:tsutenkaku--node:kuromon-market',
      from: Object.freeze({ kind: 'node', id: 'tsutenkaku' }),
      to: Object.freeze({ kind: 'node', id: 'kuromon-market' }),
      stepsRle: Object.freeze([
        { direction: 'R', count: 1 }, { direction: 'U', count: 15 }, { direction: 'R', count: 1 }, { direction: 'U', count: 40 }, { direction: 'R', count: 1 }, { direction: 'U', count: 7 }, { direction: 'L', count: 1 }, { direction: 'U', count: 7 }, { direction: 'R', count: 2 }, { direction: 'U', count: 2 }, { direction: 'L', count: 1 },
      ]),
      stepCount: 78,
      tileCount: 79,
      pathSha256: '6f736007e4763147321e126a0450e25e0b91ca0339ae11b9febcb712f4c8a454',
    }),
    Object.freeze({
      id: 'node:kuromon-market--node:ebisubashi',
      from: Object.freeze({ kind: 'node', id: 'kuromon-market' }),
      to: Object.freeze({ kind: 'node', id: 'ebisubashi' }),
      stepsRle: Object.freeze([
        { direction: 'R', count: 1 }, { direction: 'U', count: 18 }, { direction: 'L', count: 3 }, { direction: 'U', count: 2 }, { direction: 'L', count: 24 },
      ]),
      stepCount: 48,
      tileCount: 49,
      pathSha256: '1da5a8df516578c447d6b4ae1b9fc7238e9e7ed4cb9da0e5d41307a2e6837b7c',
    }),
    Object.freeze({
      id: 'node:ebisubashi--node:osaka-aquarium',
      from: Object.freeze({ kind: 'node', id: 'ebisubashi' }),
      to: Object.freeze({ kind: 'node', id: 'osaka-aquarium' }),
      stepsRle: Object.freeze([
        { direction: 'D', count: 1 }, { direction: 'L', count: 3 }, { direction: 'D', count: 22 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 6 }, { direction: 'D', count: 1 }, { direction: 'L', count: 14 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 4 }, { direction: 'D', count: 3 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 70 }, { direction: 'D', count: 1 }, { direction: 'L', count: 28 }, { direction: 'D', count: 1 }, { direction: 'L', count: 12 }, { direction: 'D', count: 2 }, { direction: 'L', count: 7 }, { direction: 'D', count: 3 }, { direction: 'L', count: 5 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 8 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 19 }, { direction: 'U', count: 1 }, { direction: 'L', count: 12 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 4 }, { direction: 'L', count: 2 }, { direction: 'D', count: 2 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 4 }, { direction: 'L', count: 1 }, { direction: 'D', count: 3 }, { direction: 'L', count: 10 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 1 }, { direction: 'L', count: 1 }, { direction: 'D', count: 2 }, { direction: 'L', count: 20 }, { direction: 'D', count: 1 }, { direction: 'L', count: 8 }, { direction: 'D', count: 1 }, { direction: 'L', count: 19 }, { direction: 'D', count: 1 }, { direction: 'L', count: 2 }, { direction: 'D', count: 1 }, { direction: 'L', count: 3 }, { direction: 'D', count: 1 }, { direction: 'L', count: 9 }, { direction: 'D', count: 2 }, { direction: 'L', count: 19 }, { direction: 'D', count: 1 }, { direction: 'L', count: 6 }, { direction: 'D', count: 1 }, { direction: 'L', count: 12 }, { direction: 'D', count: 1 }, { direction: 'L', count: 15 },
      ]),
      stepCount: 408,
      tileCount: 409,
      pathSha256: '849684235e84181203f2900d5f2af6dcc9deb638520f2bdb192a12d3b083d68d',
    }),
  ]),
});

export function buildOsakaGrid() {
  const grid = Uint8Array.from(OSAKA_GEO.terrain);
  for (const [x, y] of EXIT_TILES) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const OSAKA = {
  id: 'osaka', name: '오사카', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'osaka',
  roadStyle: 'autotile-v1',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: OSAKA_GEO.railways,
  // 📖 여행책 지구제 v1 (D2 정본 — RFC docs/rfc-guidebook-districts.md·오너 승인 2026-07-23).
  // 개방 = 주동선 회랑 rect. 나머지는 guidebook 잠금 렌더 + soft wall.
  districts: {
    version: 'district-v1',
    open: [
      {
        id: 'north-hubs',
        label: '북부·허브',
        tiles: { rects: [[415, 0, 455, 25], [350, 140, 610, 245]] },
      },
      {
        id: 'castle-east',
        label: '성곽·동부',
        tiles: { rects: [[535, 246, 615, 330]] },
      },
      {
        id: 'namba-tennoji',
        label: '난바·텐노지',
        tiles: { rects: [[250, 280, 360, 410], [420, 331, 520, 505], [550, 350, 600, 410]] },
      },
      {
        id: 'bay',
        label: '항만',
        tiles: { rects: [[85, 420, 135, 470]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  CITY_TILE, buildGrid: buildOsakaGrid,
};

export default OSAKA;
