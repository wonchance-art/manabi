// 🏙️ 도쿄 도시 정밀맵 — 실 OSM geo v2.1을 CityScene 데이터 계약에 연결한다.
// 지형·POI·山手線 역 좌표는 tokyo.geo.js가 단일 진실원이며, 여기서는 게임용 EXIT만 덧씌운다.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { TOKYO_GEO } from './tokyo.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = TOKYO_GEO.meta.grid.w;
export const ROWS = TOKYO_GEO.meta.grid.h;

const POI_BY_ID = Object.fromEntries(TOKYO_GEO.pois.map((poi) => [poi.id, poi]));
const poiTile = (id) => POI_BY_ID[id].tile;

// 하네다 남부의 기존 ROAD 세로축. ENTRANCE에서 위로만 걸으면 EXIT에 닿는 e2e 회랑이다.
// 공항 POI와는 15타일 이상 떨어져 출입·상호작용 프롬프트가 겹치지 않는다.
const EXIT_TILES = [[402, 619], [402, 620]];

export const ENTRANCE = { x: 402, y: 629, facing: 'down' };

export const ZONES = [
  { id: 'shibuya', label: '渋谷', bounds: [0, 0, 60, 80], labelTile: [18, 15] },
  { id: 'ebisu-meguro', label: '恵比寿／目黒', bounds: [45, 80, 115, 190], labelTile: [78, 112] },
  { id: 'shinagawa', label: '品川／高輪', bounds: [120, 150, 230, 270], labelTile: [170, 178] },
  { id: 'shiba', label: '芝／浜松町', bounds: [205, 0, 300, 130], labelTile: [245, 22] },
  { id: 'tokyo-bay', label: '東京湾／お台場', bounds: [290, 100, 420, 240], labelTile: [347, 140] },
  { id: 'haneda', label: '羽田空港', bounds: [350, 560, 470, 667], labelTile: [390, 600] },
];

// 品川駅 POI는 같은 geo 좌표의 山手線 정기 교통 역으로 한 번만 렌더한다.
// 나머지 POI는 실좌표에서 스냅된 geo tile을 그대로 쓰는 설명 마커다.
export const CITY_NODES = [
  {
    id: 'haneda-airport', kind: 'spot', name: '羽田空港', facade: 'depart',
    tile: poiTile('haneda-airport'), facing: 'down', noStamp: true,
    desc: '도쿄 남쪽 바닷가의 공항 「羽田空港」(はねだくうこう). 시내와 철도·모노레일로 이어져요.',
  },
  {
    id: 'shibuya-scramble', kind: 'spot', name: '渋谷スクランブル交差点', facade: 'sign',
    tile: poiTile('shibuya-scramble'), facing: 'down', noStamp: true,
    desc: '여러 방향의 보행 신호가 함께 열리는 「渋谷スクランブル交差点」(しぶや すくらんぶる こうさてん).',
  },
  {
    id: 'tokyo-tower', kind: 'spot', name: '東京タワー', facade: 'sign',
    tile: poiTile('tokyo-tower'), facing: 'down', noStamp: true,
    desc: '시바공원 곁에 선 전파탑 「東京タワー」(とうきょうたわー). 도쿄만 쪽 도심을 내려다봐요.',
  },
  {
    id: 'rainbow-bridge', kind: 'spot', name: 'レインボーブリッジ', facade: 'sign',
    tile: poiTile('rainbow-bridge'), facing: 'down', noStamp: true,
    desc: '시바우라와 오다이바를 잇는 현수교 「レインボーブリッジ」(れいんぼーぶりっじ).',
  },
  {
    id: 'odaiba-seaside-park', kind: 'spot', name: 'お台場海浜公園', facade: 'sign',
    tile: poiTile('odaiba-seaside-park'), facing: 'down', noStamp: true,
    desc: '도쿄만 인공섬의 해변 공원 「お台場海浜公園」(おだいば かいひんこうえん).',
  },
  {
    id: 'hamarikyu-gardens', kind: 'spot', name: '浜離宮恩賜庭園', facade: 'sign',
    tile: poiTile('hamarikyu-gardens'), facing: 'down', noStamp: true,
    desc: '바닷물을 끌어들인 연못이 있는 정원 「浜離宮恩賜庭園」(はまりきゅう おんしていえん).',
  },
  {
    id: 'zojoji', kind: 'spot', name: '増上寺', facade: 'sign',
    tile: poiTile('zojoji'), facing: 'down', noStamp: true,
    desc: '도쿄타워 가까이에 있는 불교 사찰 「増上寺」(ぞうじょうじ).',
  },
  {
    id: 'ebisu-garden-place', kind: 'spot', name: '恵比寿ガーデンプレイス', facade: 'sign',
    tile: poiTile('ebisu-garden-place'), facing: 'down', noStamp: true,
    desc: '에비스역 남쪽의 복합 공간 「恵比寿ガーデンプレイス」(えびす がーでんぷれいす).',
  },
];

export const STATIONS = TOKYO_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
  ...(station.id === 'shinagawa' ? { poiId: 'shinagawa-station' } : {}),
}));

export const TRANSIT_POINTS = [
  { id: 'haneda-airport', tile: poiTile('haneda-airport'), nameJa: '羽田空港' },
];

export const TRANSIT = [
  {
    id: 'tokyo-yamanote', nameJa: '山手線', mode: 'train', color: 0x8dbb45,
    stopIds: ['shibuya', 'ebisu', 'meguro', 'gotanda', 'osaki', 'shinagawa', 'takanawa-gateway', 'tamachi', 'hamamatsucho'],
    segmentMinutes: [3, 3, 3, 3, 4, 3, 3, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 24 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 6 },
    ],
  },
  {
    id: 'tokyo-haneda-access', nameJa: '羽田アクセス線', mode: 'train', color: 0x4ba4d8,
    stopIds: ['haneda-airport', 'shinagawa', 'shibuya'], segmentMinutes: [14, 12], dwellMinutes: 2,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 30 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 10 },
    ],
  },
];

// 하네다·시부야·시나가와의 전용 렌더크래프트는 후속 작업으로 남긴다.
// 현재는 CITY_NODES와 STATIONS의 공용 마커만 사용해 실제 장소를 중복 렌더하지 않는다.
export const PROPS = [];

export function buildTokyoGrid() {
  const grid = Uint8Array.from(TOKYO_GEO.terrain);
  for (const [x, y] of EXIT_TILES) {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[y * COLS + x] = CITY_TILE.EXIT;
  }
  return grid;
}

export const TOKYO = {
  id: 'tokyo',
  name: '도쿄',
  cols: COLS,
  rows: ROWS,
  entrance: ENTRANCE,
  returnNode: 'tokyo',
  zones: ZONES,
  nodes: CITY_NODES,
  stations: STATIONS,
  transit: TRANSIT,
  transitPoints: TRANSIT_POINTS,
  railways: TOKYO_GEO.railways,
  props: PROPS,
  CITY_TILE,
  buildGrid: buildTokyoGrid,
};

export default TOKYO;
