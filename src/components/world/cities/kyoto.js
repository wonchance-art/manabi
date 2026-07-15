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
};

export const CITY_NODES = KYOTO_GEO.pois.map((poi) => ({
  id: poi.id,
  kind: 'spot',
  name: poi.nameJa,
  facade: POI_FACADE[poi.id] || (poi.kind === 'shrine' ? 'torii' : 'sign'),
  tile: [poi.tile[0], poi.tile[1]],
  facing: 'down',
  noStamp: true,
  desc: POI_DESC[poi.id] || `교토의 대표 장소 「${poi.nameJa}」(${poi.yomi}). 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
}));

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

export function buildKyotoGrid() {
  const grid = Uint8Array.from(KYOTO_GEO.terrain);
  for (const [x, y] of EXIT_TILES) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const KYOTO = {
  id: 'kyoto', name: '교토', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'kyoto',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: KYOTO_GEO.railways,
  CITY_TILE, buildGrid: buildKyotoGrid,
};

export default KYOTO;
