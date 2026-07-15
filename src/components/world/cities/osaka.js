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
  'osaka-castle': 'castle', ebisubashi: 'bigscreen', tsutenkaku: 'tokyotower',
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
};

export const CITY_NODES = OSAKA_GEO.pois.map((poi) => ({
  id: poi.id,
  kind: 'spot',
  name: poi.nameJa,
  facade: POI_FACADE[poi.id] || 'sign',
  tile: [poi.tile[0], poi.tile[1]],
  facing: 'down',
  noStamp: true,
  desc: POI_DESC[poi.id] || `오사카의 대표 장소 「${poi.nameJa}」(${poi.yomi}). 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
}));

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

export const PROPS = [];

export function buildOsakaGrid() {
  const grid = Uint8Array.from(OSAKA_GEO.terrain);
  for (const [x, y] of EXIT_TILES) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const OSAKA = {
  id: 'osaka', name: '오사카', cols: COLS, rows: ROWS, entrance: ENTRANCE, returnNode: 'osaka',
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: OSAKA_GEO.railways,
  CITY_TILE, buildGrid: buildOsakaGrid,
};

export default OSAKA;
