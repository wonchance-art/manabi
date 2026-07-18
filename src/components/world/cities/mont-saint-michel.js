import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { MONT_SAINT_MICHEL_GEO } from './mont-saint-michel.geo.js';
import { MSM_DOORS } from '../msmDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = MONT_SAINT_MICHEL_GEO.meta.grid.w;
export const ROWS = MONT_SAINT_MICHEL_GEO.meta.grid.h;
export const ENTRANCE = { ...MONT_SAINT_MICHEL_GEO.entrance };

// 검증 desc (2026-07-17 — 708 오베르 전승 헤지·966 베네딕토회·2014 교량 확인)
const MSM_DESC_KO = Object.freeze({
  abbey: '708년 오베르 주교의 예배당 전승에서 시작해 966년 베네딕토회 수도원이 들어선 「Abbaye du Mont-Saint-Michel(몽생미셸 수도원)」. 13세기 고딕 별관 \'라 메르베유\'가 백미로, 1979년 세계유산에 등재됐어요.',
  'grande-rue': '성문에서 수도원까지 오르는 단 하나의 골목 「Grande Rue(그랑드뤼)」. 폭 3~4m 돌길에 기념품점과 식당이 빼곡해요.',
  ramparts: '만(灣)을 내려다보는 성벽길 「Les Remparts(성벽 순회로)」. 백년전쟁 때 요새화된 구간으로, 갯벌과 조수를 한눈에 봐요.',
  'causeway-shuttle': '본토와 섬을 잇는 교량형 제방의 셔틀 「Navette(나베트)」. 2014년 개통한 다리로 바닷물이 다시 섬을 감싸게 됐어요.',
});

// 프랑스어 도어 배치 타일 — geo 보행 타일 나선 탐색 계산치(4m/타일, 앵커: 수도원·그랑드뤼·성벽·제방).
const MSM_DOOR_TILES = Object.freeze({
  'msm-01': [286, 161], // 수도원 매표소(수도원 곁)
  'msm-02': [301, 170], // 그랑드뤼 기념품점
  'msm-03': [307, 177], // 오믈렛 레스토랑(그랑드뤼 남측)
  'msm-04': [315, 161], // 성벽 전망 포인트
  'msm-05': [378, 838], // 셔틀 정류장(라 카제른)
  'msm-06': [298, 181], // 순례자 쉼터(성문측)
});

export const CITY_NODES = [
  ...MONT_SAINT_MICHEL_GEO.pois.map((poi) => ({
    id: poi.id,
    kind: 'spot',
    name: poi.nameFr,
    nameFr: poi.nameFr,
    contentLocale: poi.contentLocale,
    facade: 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: MSM_DESC_KO[poi.id],
    ...(poi.id === 'abbey' ? {
      gate: Object.freeze({ type: 'story-scene', scene: 'msm-abbey-scene' }),
    } : {}),
    ...(poi.id === 'ramparts' ? { tideCopyHook: true } : {}),
  })),
  // 프랑스어 문화 도어 6종 — chapter가 프랑스어 트랙으로 라우팅(frenchChapterHref).
  ...MSM_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameFr,
    nameFr: door.nameFr,
    contentLocale: 'fr',
    facade: 'sign',
    tile: [...MSM_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: 'french',
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].fr} (${door.lines[0].gloss})`,
    ...(door.id === 'msm-04' ? { tideCopyHook: true } : {}),
  })),
];

export function buildMontSaintMichelGrid() {
  const grid = Uint8Array.from(MONT_SAINT_MICHEL_GEO.terrain);
  for (const [x, y] of MONT_SAINT_MICHEL_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const MONT_SAINT_MICHEL = {
  id: 'mont-saint-michel',
  name: 'Mont-Saint-Michel',
  cols: COLS,
  rows: ROWS,
  metersPerTile: MONT_SAINT_MICHEL_GEO.meta.metersPerTile,
  tileSkins: MONT_SAINT_MICHEL_GEO.tileSkins,
  entrance: ENTRANCE,
  returnNode: 'mont-saint-michel',
  zones: [],
  nodes: CITY_NODES,
  stations: [],
  props: [],
  transit: [],
  transitPoints: [],
  railways: MONT_SAINT_MICHEL_GEO.railways,
  tide: MONT_SAINT_MICHEL_GEO.tide,
  CITY_TILE,
  buildGrid: buildMontSaintMichelGrid,
};

export default MONT_SAINT_MICHEL;
