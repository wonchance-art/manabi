import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { KYOTO_GEO } from './kyoto.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = KYOTO_GEO.meta.grid.w;
export const ROWS = KYOTO_GEO.meta.grid.h;
const EXIT_TILES = [[404, 412], [404, 413]];
export const ENTRANCE = { x: 404, y: 422, facing: 'down' };

export const ZONES = [
  { id: 'imperial', label: '京都御所', bounds: [350, 130, 470, 240], labelTile: [415, 160] },
  { id: 'nijo', label: '二条', bounds: [280, 220, 390, 320], labelTile: [325, 235] },
  { id: 'gion', label: '祇園／東山', bounds: [450, 250, 610, 390], labelTile: [540, 285] },
  { id: 'kyoto-station', label: '京都駅', bounds: [350, 380, 480, 455], labelTile: [405, 395] },
  { id: 'fushimi', label: '伏見稲荷', bounds: [420, 455, 540, 560], labelTile: [500, 490] },
  { id: 'arashiyama', label: '嵐山', bounds: [0, 180, 150, 320], labelTile: [55, 205] },
];

// POI 별 검증 desc(공식 소스 리서치 2026-07-15). 세계유산('고도 교토의 문화재' 1994) 표기는
//   구성 자산 4곳(二条城·清水寺·金閣 鹿苑寺·銀閣 慈照寺)에만 — 御所·伏見稲荷·八坂·平安神宮·渡月橋 금지.
//   전승 연도는 "전해짐" 헤지. geo pois 와 자동 동기, 미등재 id 는 안전 폴백.
const POI_FACADE = {
  'nijo-castle': 'castle', 'fushimi-inari-taisha': 'torii', 'yasaka-shrine': 'torii', 'heian-shrine': 'torii',
  kinkakuji: 'kinkaku',
};
const POI_DESC = {
  'nijo-castle': '1603년 도쿠가와 이에야스가 세운 성 「二条城」(にじょうじょう). 1867년 니노마루 고텐에서 대정봉환이 표명됐고, 세계유산 \'고도 교토의 문화재\'의 구성 자산이에요.',
  'kyoto-imperial-palace': '메이지 초까지 약 500년간 역대 천황이 거처한 궁 「京都御所」(きょうとごしょ). 현재 건물은 대체로 1855년에 지어졌어요.',
  'fushimi-inari-taisha': '붉은 도리이가 늘어선 센본토리이로 알려진 신사 「伏見稲荷大社」(ふしみいなりたいしゃ). 711년 이나리산 진좌가 기원이고, 약 3만으로 일컬어지는 전국 이나리 신사의 총본궁이에요.',
  'yasaka-shrine': '기온마쓰리의 무대가 되는 신사 「八坂神社」(やさかじんじゃ). 창건은 656년으로 전해지고, 본전은 2020년 국보로 지정됐어요.',
  'heian-shrine': '헤이안 천도 1100년을 기념해 1895년 창건된 신사 「平安神宮」(へいあんじんぐう). 헤이안쿄 조당원을 8분의 5 규모로 재현했어요.',
  kiyomizudera: '벼랑 위 목조 무대로 알려진 사찰 「清水寺」(きよみずでら). 778년 개창으로 전해지고 현재 본당은 1633년 재건 — 세계유산 \'고도 교토의 문화재\'의 구성 자산이에요.',
  togetsukyo: '아라시야마의 풍경을 대표하는 길이 155m의 다리 「渡月橋」(とげつきょう). 현재 다리는 1934년에 놓였고, 이름은 달이 건너는 듯하다는 옛 노래에서 유래한 것으로 전해져요.',
  kinkakuji: '금박 사리전으로 알려진 선종 사찰 「金閣寺」(きんかくじ) — 정식 명칭은 로쿠온지(鹿苑寺). 1397년 아시카가 요시미쓰가 조영했고, 사리전은 1950년 소실 후 1955년 재건 — 세계유산 구성 자산이에요.',
  ginkakuji: '검박한 정취의 관음전으로 알려진 선종 사찰 「銀閣寺」(ぎんかくじ) — 정식 명칭은 지쇼지(慈照寺). 1482년 아시카가 요시마사가 산장으로 짓기 시작했고, 관음전과 동구당은 국보 — 세계유산 구성 자산이에요.',
  'nishiki-market': '\'교토의 부엌\'으로 불리는 아케이드 시장 「錦市場」(にしきいちば). 400년 넘는 역사로 전해지고, 약 390m 골목에 식재료 상점 120여 곳이 늘어서 있어요.',
};

export const CITY_NODES = [
  ...KYOTO_GEO.pois.map((poi) => ({
    id: poi.id,
    kind: 'spot',
    name: poi.nameJa,
    facade: POI_FACADE[poi.id] || (poi.kind === 'shrine' ? 'torii' : 'sign'),
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: POI_DESC[poi.id] || `교토의 대표 장소 「${poi.nameJa}」(${poi.yomi}). 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
  })),
  // ── NPC 대화 노드(가공 무대 — geo POI 아님) — 미코상 스크립트는 도시 불문 제네릭(참배 예절·오미쿠지).
  //   타일은 보행+보행인접+기존 마커 Chebyshev ≥3 이격을 스크립트로 검증해 고정.
  {
    id: 'kyoto-shrine', kind: 'npc', npc: 'shrine', chapter: 'ot-09-jinja', name: '巫女',
    tile: [485, 514], facing: 'down', noStamp: true,
    desc: '「伏見稲荷大社」(ふしみいなりたいしゃ) 참배로 곁의 미코(巫女)상. 참배 예절 二礼二拍手一礼(통설)과 오미쿠지를 배워요.',
  },
];

export const STATIONS = KYOTO_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT = [
  {
    id: 'kyoto-sanin', nameJa: 'JR山陰線', mode: 'train', color: 0x8f6ab5,
    stopIds: ['kyoto', 'umekoji-kyotonishi', 'tambaguchi', 'nijo', 'emmachi', 'hanazono', 'uzumasa', 'saga-arashiyama'],
    segmentMinutes: [3, 3, 4, 3, 3, 3, 5], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 12 },
    ],
  },
  {
    id: 'kyoto-nara', nameJa: 'JR奈良線', mode: 'train', color: 0xb45c4d,
    stopIds: ['kyoto', 'tofukuji', 'inari'], segmentMinutes: [3, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 12 },
    ],
  },
  {
    id: 'kyoto-city-bus', nameJa: '京都市バス', mode: 'bus', color: 0x4f8f62,
    stopIds: ['kyoto', 'nijo'], segmentMinutes: [24],
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 45 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 15 },
    ],
  },
];

export const PROPS = [
  // 伏見稲荷 센본토리이 — 참배로를 따라 토리이 열(노드 남측, ≥3 이격).
  { kind: 'torii', tile: [486, 520] },
  { kind: 'torii', tile: [488, 520] },
  { kind: 'torii', tile: [486, 522] },
  { kind: 'torii', tile: [488, 522] },
  // 祇園 — 노렌 거리(八坂 서측).
  { kind: 'noren', tile: [491, 311] },
  { kind: 'noren', tile: [493, 311] },
  // 嵐山 — 대나무 숲(渡月橋 인근).
  { kind: 'bamboo', tile: [31, 258] },
  { kind: 'bamboo', tile: [33, 258] },
  { kind: 'bamboo', tile: [38, 265] },
];

// 교토 mainRoute v3 정본 — 코스 루프 10waypoint, 1,611타일, 일본 3호.
// 세그먼트·sha는 docs/proposal-kyoto-mainroute.md(T26 재검증) 정식본을 핀함.
// 발견점(d1~d8)은 각 leg 구간 콘텍스트를 교토 여행자 관점으로 직저작.
export const MAIN_ROUTE = Object.freeze({
  id: 'kyoto-classic-loop-candidate-a',
  version: 1,
  waypoints: Object.freeze([
    Object.freeze({ kind: 'station', id: 'kyoto' }),
    Object.freeze({ kind: 'node', id: 'fushimi-inari-taisha' }),
    Object.freeze({ kind: 'node', id: 'kiyomizudera' }),
    Object.freeze({ kind: 'node', id: 'yasaka-shrine' }),
    Object.freeze({ kind: 'node', id: 'heian-shrine' }),
    Object.freeze({ kind: 'node', id: 'ginkakuji' }),
    Object.freeze({ kind: 'node', id: 'kyoto-imperial-palace' }),
    Object.freeze({ kind: 'node', id: 'nijo-castle' }),
    Object.freeze({ kind: 'node', id: 'kinkakuji' }),
    Object.freeze({ kind: 'node', id: 'togetsukyo' }),
  ]),
  routing: Object.freeze({
    algorithm: 'cardinal-bfs-v1',
    neighborOrder: 'URDL',
    excludeExit: true,
  }),
  segmentHints: Object.freeze([]),
  branches: Object.freeze([]),
  segments: Object.freeze([
    Object.freeze({id: 'station:kyoto--node:fushimi-inari-taisha', from: Object.freeze({ kind: 'station', id: 'kyoto' }), to: Object.freeze({ kind: 'node', id: 'fushimi-inari-taisha' }), stepsRle: Object.freeze([{direction:'R',count:34},{direction:'D',count:1},{direction:'R',count:1},{direction:'D',count:6},{direction:'R',count:1},{direction:'D',count:2},{direction:'R',count:1},{direction:'D',count:4},{direction:'R',count:1},{direction:'D',count:8},{direction:'R',count:1},{direction:'D',count:7},{direction:'R',count:18},{direction:'D',count:1},{direction:'R',count:10},{direction:'D',count:1},{direction:'R',count:1},{direction:'D',count:12},{direction:'R',count:1},{direction:'D',count:4},{direction:'R',count:1},{direction:'D',count:1},{direction:'R',count:1},{direction:'D',count:2},{direction:'R',count:1},{direction:'D',count:2},{direction:'R',count:2},{direction:'D',count:1},{direction:'R',count:4},{direction:'D',count:28},{direction:'R',count:1},{direction:'D',count:9},{direction:'R',count:1},{direction:'D',count:8},{direction:'R',count:3},{direction:'D',count:5}]), stepCount: 185, tileCount: 186, pathSha256: '87221ddbd22351731950ee146c9154fbaa311a44eab9bec7c46f4370e5df5646'}),
    Object.freeze({id: 'node:fushimi-inari-taisha--node:kiyomizudera', from: Object.freeze({ kind: 'node', id: 'fushimi-inari-taisha' }), to: Object.freeze({ kind: 'node', id: 'kiyomizudera' }), stepsRle: Object.freeze([{direction:'U',count:5},{direction:'R',count:2},{direction:'U',count:24},{direction:'R',count:1},{direction:'U',count:2},{direction:'R',count:1},{direction:'U',count:3},{direction:'R',count:1},{direction:'U',count:11},{direction:'R',count:3},{direction:'U',count:23},{direction:'R',count:7},{direction:'U',count:33},{direction:'R',count:2},{direction:'U',count:6},{direction:'R',count:1},{direction:'U',count:5},{direction:'R',count:2},{direction:'U',count:9},{direction:'R',count:3},{direction:'U',count:9},{direction:'R',count:1},{direction:'U',count:1},{direction:'R',count:1},{direction:'U',count:1},{direction:'R',count:6},{direction:'U',count:23},{direction:'R',count:1}]), stepCount: 187, tileCount: 188, pathSha256: '113d0626445336c2bb0a6cba8a326270049eea48620c9fba1aeadb766a954fce'}),
    Object.freeze({id: 'node:kiyomizudera--node:yasaka-shrine', from: Object.freeze({ kind: 'node', id: 'kiyomizudera' }), to: Object.freeze({ kind: 'node', id: 'yasaka-shrine' }), stepsRle: Object.freeze([{direction:'L',count:1},{direction:'U',count:5},{direction:'L',count:1},{direction:'U',count:12},{direction:'L',count:1},{direction:'U',count:25},{direction:'L',count:1},{direction:'U',count:1},{direction:'L',count:1},{direction:'U',count:5},{direction:'L',count:21}]), stepCount: 74, tileCount: 75, pathSha256: '82411ce87491e4bc42506c52ed3eb1c8fd636bd7188f17393cf1181e55c88c76'}),
    Object.freeze({id: 'node:yasaka-shrine--node:heian-shrine', from: Object.freeze({ kind: 'node', id: 'yasaka-shrine' }), to: Object.freeze({ kind: 'node', id: 'heian-shrine' }), stepsRle: Object.freeze([{direction:'R',count:1},{direction:'U',count:2},{direction:'R',count:9},{direction:'U',count:2},{direction:'R',count:2},{direction:'U',count:8},{direction:'R',count:1},{direction:'U',count:4},{direction:'R',count:5},{direction:'U',count:1},{direction:'R',count:2},{direction:'U',count:9},{direction:'R',count:1},{direction:'U',count:44},{direction:'R',count:1}]), stepCount: 92, tileCount: 93, pathSha256: 'cfd0b76bc993344a0b5c7de8276a0810e53e1c8a409542b461841ed78d9535b2'}),
    Object.freeze({id: 'node:heian-shrine--node:ginkakuji', from: Object.freeze({ kind: 'node', id: 'heian-shrine' }), to: Object.freeze({ kind: 'node', id: 'ginkakuji' }), stepsRle: Object.freeze([{direction:'L',count:1},{direction:'U',count:2},{direction:'R',count:1},{direction:'U',count:11},{direction:'R',count:1},{direction:'U',count:14},{direction:'R',count:2},{direction:'U',count:5},{direction:'R',count:2},{direction:'U',count:11},{direction:'R',count:1},{direction:'U',count:6},{direction:'R',count:3},{direction:'U',count:7},{direction:'R',count:15},{direction:'U',count:1},{direction:'R',count:4},{direction:'U',count:1},{direction:'R',count:6},{direction:'U',count:2},{direction:'R',count:16},{direction:'U',count:1},{direction:'R',count:19}]), stepCount: 132, tileCount: 133, pathSha256: '7a50705ca9313c09eb878045a8ca50a2e524be363992b0da20d25d05f7f7c269'}),
    Object.freeze({id: 'node:ginkakuji--node:kyoto-imperial-palace', from: Object.freeze({ kind: 'node', id: 'ginkakuji' }), to: Object.freeze({ kind: 'node', id: 'kyoto-imperial-palace' }), stepsRle: Object.freeze([{direction:'U',count:2},{direction:'L',count:1},{direction:'U',count:1},{direction:'L',count:18},{direction:'U',count:1},{direction:'L',count:5},{direction:'U',count:1},{direction:'L',count:3},{direction:'U',count:1},{direction:'L',count:6},{direction:'U',count:1},{direction:'L',count:2},{direction:'U',count:1},{direction:'L',count:6},{direction:'U',count:1},{direction:'L',count:39},{direction:'U',count:1},{direction:'L',count:43},{direction:'D',count:3},{direction:'L',count:10},{direction:'D',count:1},{direction:'L',count:1},{direction:'D',count:3},{direction:'L',count:6},{direction:'D',count:2},{direction:'L',count:2},{direction:'D',count:6},{direction:'L',count:20},{direction:'D',count:1},{direction:'L',count:2},{direction:'D',count:3},{direction:'L',count:1}]), stepCount: 194, tileCount: 195, pathSha256: '947dea934eda712b724a7b47286361d271c4099705f008cc69fe0babc73e2b01'}),
    Object.freeze({id: 'node:kyoto-imperial-palace--node:nijo-castle', from: Object.freeze({ kind: 'node', id: 'kyoto-imperial-palace' }), to: Object.freeze({ kind: 'node', id: 'nijo-castle' }), stepsRle: Object.freeze([{direction:'D',count:41},{direction:'L',count:1},{direction:'D',count:18},{direction:'L',count:44},{direction:'D',count:1},{direction:'L',count:6},{direction:'D',count:1},{direction:'L',count:1},{direction:'D',count:1},{direction:'L',count:6},{direction:'D',count:7},{direction:'L',count:5}]), stepCount: 132, tileCount: 133, pathSha256: '271c90147f91974605d20c1e811ed720866e4ccdb306566f044f413e986879c9'}),
    Object.freeze({id: 'node:nijo-castle--node:kinkakuji', from: Object.freeze({ kind: 'node', id: 'nijo-castle' }), to: Object.freeze({ kind: 'node', id: 'kinkakuji' }), stepsRle: Object.freeze([{direction:'U',count:11},{direction:'L',count:1},{direction:'U',count:35},{direction:'L',count:1},{direction:'U',count:21},{direction:'L',count:1},{direction:'U',count:2},{direction:'L',count:1},{direction:'U',count:3},{direction:'L',count:2},{direction:'U',count:9},{direction:'L',count:1},{direction:'U',count:2},{direction:'L',count:4},{direction:'U',count:1},{direction:'L',count:1},{direction:'U',count:26},{direction:'L',count:1},{direction:'U',count:3},{direction:'L',count:1},{direction:'U',count:1},{direction:'L',count:1},{direction:'U',count:27},{direction:'L',count:8},{direction:'U',count:1},{direction:'L',count:11},{direction:'U',count:1},{direction:'L',count:2},{direction:'U',count:1},{direction:'L',count:9},{direction:'U',count:1},{direction:'L',count:10},{direction:'U',count:1},{direction:'L',count:27}]), stepCount: 228, tileCount: 229, pathSha256: '9197e9cce7fd9cd8d67c865a50ece49a939a21bc34639175afb47b4f503756b1'}),
    Object.freeze({id: 'node:kinkakuji--node:togetsukyo', from: Object.freeze({ kind: 'node', id: 'kinkakuji' }), to: Object.freeze({ kind: 'node', id: 'togetsukyo' }), stepsRle: Object.freeze([{direction:'D',count:8},{direction:'L',count:3},{direction:'D',count:28},{direction:'L',count:3},{direction:'D',count:20},{direction:'L',count:4},{direction:'D',count:3},{direction:'L',count:1},{direction:'D',count:9},{direction:'L',count:1},{direction:'D',count:15},{direction:'L',count:1},{direction:'D',count:2},{direction:'L',count:1},{direction:'D',count:33},{direction:'L',count:7},{direction:'D',count:1},{direction:'L',count:13},{direction:'D',count:1},{direction:'L',count:20},{direction:'D',count:1},{direction:'L',count:40},{direction:'D',count:1},{direction:'L',count:4},{direction:'D',count:1},{direction:'L',count:6},{direction:'D',count:7},{direction:'L',count:3},{direction:'D',count:1},{direction:'L',count:4},{direction:'D',count:3},{direction:'L',count:4},{direction:'D',count:2},{direction:'L',count:17},{direction:'D',count:1},{direction:'L',count:1},{direction:'D',count:1},{direction:'L',count:7},{direction:'D',count:1},{direction:'L',count:46},{direction:'D',count:1},{direction:'L',count:21},{direction:'D',count:1},{direction:'L',count:4},{direction:'D',count:2},{direction:'L',count:26},{direction:'D',count:1},{direction:'L',count:1},{direction:'D',count:3},{direction:'L',count:1}]), stepCount: 386, tileCount: 387, pathSha256: '2f9aae336caad11defc3ab637263fac565f8b11a943280752c9f0d4c287e7d56'}),
  ]),
  discoveries: Object.freeze([
    Object.freeze({id: 'kyoto-d1', leg: Object.freeze(['kyoto', 'fushimi-inari-taisha']), at: 0.35, line: '교토역 남동쪽 가로망에서 후시미 방향으로 접어드는 구간 — 역의 동편에서 남부 생활권으로 향하는 전환점이에요.'}),
    Object.freeze({id: 'kyoto-d2', leg: Object.freeze(['fushimi-inari-taisha', 'kiyomizudera']), at: 0.90, line: '남쪽에서 히가시야마 경계에 다시 들어와 기요미즈데라 권역으로 올라가는 길목 — 산 언덕을 따라 올라가는 참배로예요.'}),
    Object.freeze({id: 'kyoto-d3', leg: Object.freeze(['kiyomizudera', 'yasaka-shrine']), at: 0.25, line: '히가시야마 산 위에서 기온 거리 중심으로 내려오며 기요미즈데라에서 야사카 방향으로 향하는 구간 — 절 참배에서 신사 참배로 가는 길이에요.'}),
    Object.freeze({id: 'kyoto-d4', leg: Object.freeze(['yasaka-shrine', 'heian-shrine']), at: 0.55, line: '야사카 신사 주변의 기온 거리에서 헤이안신궁 방면으로 펼쳐지는 넓은 북행축 — 전통 상점가에서 황궁 영역의 조용한 산책로로 변하는 구간이에요.'}),
    Object.freeze({id: 'kyoto-d5', leg: Object.freeze(['heian-shrine', 'ginkakuji']), at: 0.55, line: '헤이안신궁 북쪽에서 동산 기슭을 따라 긴카쿠지 권역으로 이어지는 보행축 — 신궁 뒤 숲의 정적에서 사찰로 향하는 마음의 길이에요.'}),
    Object.freeze({id: 'kyoto-d6', leg: Object.freeze(['ginkakuji', 'kyoto-imperial-palace']), at: 0.80, line: '북동부 산 기슭의 사찰권을 벗어나 황궁의 격자형 중심가로 내려오는 구간 — 산 속 침묵에서 도시 광장의 활기로 변하는 지점이에요.'}),
    Object.freeze({id: 'kyoto-d7', leg: Object.freeze(['kyoto-imperial-palace', 'nijo-castle']), at: 0.55, line: '황궁 남서쪽에서 니조성으로 내려가는 중심 격자 — 황실 영역에서 무사 영역으로 전환되는 북부 녹지대를 지나요.'}),
    Object.freeze({id: 'kyoto-d8', leg: Object.freeze(['nijo-castle', 'kinkakuji']), at: 0.95, line: '니조성에서 북서부로 올라가 킨카쿠지 접근 가로에 닿는 구간 — 도시에서 산 마을로 올라가는 입구, 금각사 앞 숲이 가까워지는 지점이에요.'}),
  ]),
});

export function buildKyotoGrid() {
  const grid = Uint8Array.from(KYOTO_GEO.terrain);
  for (const [x, y] of EXIT_TILES) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const KYOTO = {
  id: 'kyoto', name: '교토', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'kyoto',
  roadStyle: 'autotile-v1',
  mainRoute: MAIN_ROUTE,
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: KYOTO_GEO.railways,
  // 📖 여행책 지구제 v1 (D2 정본 — RFC docs/rfc-guidebook-districts.md·오너 승인 2026-07-23).
  // 개방 = 주동선 회랑 rect. 나머지는 guidebook 잠금 렌더 + soft wall.
  districts: {
    version: 'district-v1',
    open: [
      {
        id: 'arashiyama-sanin',
        label: '아라시야마·산인',
        tiles: { rects: [[20, 210, 160, 285], [200, 205, 285, 250]] },
      },
      {
        id: 'imperial-nijo',
        label: '황궁·니조',
        tiles: { rects: [[250, 90, 300, 135], [315, 170, 450, 285]] },
      },
      {
        id: 'higashiyama-core',
        label: '히가시야마·중심',
        tiles: { rects: [[500, 160, 610, 270], [410, 286, 540, 339], [480, 340, 540, 380]] },
      },
      {
        id: 'station-fushimi',
        label: '역·후시미',
        tiles: { rects: [[315, 340, 470, 450], [440, 490, 510, 535]] },
      },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  tileSkins: Object.freeze({ building: 'kawara' }), // R4 — 먹색 기와(이부시가와라 톤)
  CITY_TILE, buildGrid: buildKyotoGrid,
};

export default KYOTO;
