// 🏙️ 스트라스부르 도시 정밀맵 — 실 OSM geo(#363, 405×446)를 CityScene 계약에 연결한다.
// 불어권 확장 3호. 프랑스어권 문법(name=nameFr canonical, contentLocale 'fr') — 리옹·보르도 패턴.
// desc 사실 검증 2026-07-22(그랑딜 세계유산 1988·대성당 첨탑 전승 헤지). 유럽의회는
// representationPolicy 준수 — 외관·지리만, 기관 활동 서술 0(팔레 데 나시옹 선례).
// 🎨 R4 brick(알자스 목조·붉은 사암 톤 — 런던/브뤼셀 brick 재사용). fr 도어·트램은 후속.
// 게이트는 Codex-1 후속(스트라스부르역 기준, 발주 5043954582).

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { STRASBOURG_GEO } from './strasbourg.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = STRASBOURG_GEO.meta.grid.w;
export const ROWS = STRASBOURG_GEO.meta.grid.h;
export const ENTRANCE = { ...STRASBOURG_GEO.entrance };

const STRASBOURG_DESC_KO = Object.freeze({
  cathedrale: '붉은 사암의 대성당 「Cathédrale de Strasbourg」. 한때 세계에서 가장 높은 건물이었다고 전해지는 142m 첨탑이 하나만 서 있는 비대칭 정면이 상징이에요.',
  'petite-france': '수로 사이 목조 가옥 지구 「La Petite France」. 옛 무두장이·방앗간 동네로, 그랑딜 세계유산(1988년 등재)의 얼굴이 된 물의 골목이에요.',
  'place-kleber': '그랑딜 한가운데의 중심 광장 「Place Kléber」. 겨울이면 대형 트리가 서는, 도시 리듬의 축이 되는 광장이에요.',
  'barrage-vauban': '17세기 방어 댐 「Barrage Vauban」. 수위를 조절해 도시를 지키던 구조물로, 옥상 테라스에서 퐁쿠베르와 수로가 한눈에 보여요.',
  'ponts-couverts': '세 개의 탑이 지키는 다리 「Ponts Couverts」. 중세엔 지붕 덮인 목조 다리였다고 전해지며, 이름에 그 기억이 남아 있어요.',
  'parlement-europeen': '수변의 유리 원형 건물 「Parlement européen」. 이 게임에선 외관과 위치만 담아요 — 일 강과 운하가 만나는 유럽 지구의 랜드마크예요.',
  orangerie: '도심의 오래된 공원 「Parc de l\'Orangerie」. 황새 둥지로 알려진 산책 정원으로, 호수와 보트 선착장이 있어요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameFr canonical.
export const STRASBOURG_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(STRASBOURG_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: STRASBOURG_DESC_KO[poi.id] ?? `스트라스부르의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return STRASBOURG_COPY[locale]?.[id] || STRASBOURG_COPY.ko[id];
}

// 구역 라벨 — POI·역 tile 포함 관계 검증 계산치.
export const ZONES = [
  { id: 'grande-ile', label: '그랑딜·대성당', bounds: [150, 240, 220, 300], labelTile: [185, 262] },
  { id: 'petite-france', label: '프티트 프랑스', bounds: [130, 265, 160, 300], labelTile: [145, 285] },
  { id: 'gare', label: '역전', bounds: [105, 225, 150, 265], labelTile: [125, 243] },
  { id: 'neustadt', label: '노이슈타트', bounds: [190, 200, 250, 245], labelTile: [220, 222] },
  { id: 'europe', label: '유럽 지구·오랑주리', bounds: [240, 160, 300, 220], labelTile: [268, 192] },
  { id: 'ill', label: '일 강', bounds: [150, 300, 260, 340], labelTile: [200, 318] },
];

export const CITY_NODES = [
  ...STRASBOURG_GEO.pois.map((poi) => {
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
];

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = STRASBOURG_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

export const TRANSIT_POINTS = [];

// 단독역 표시 전용(베이징 선례). 트램 축은 후속 라운드.
export const TRANSIT = [];

// ⛲ 렌더크래프트 — 기존 kind 재사용 배치(보행 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'fountain', tile: [165, 256] },  // 클레베르 광장 분수
  { kind: 'stall', tile: [187, 264] },     // 대성당 앞 크리스마스 좌판 자리
  { kind: 'parasol', tile: [252, 202] },   // 오랑주리 호숫가 파라솔
];

export function buildStrasbourgGrid() {
  const grid = Uint8Array.from(STRASBOURG_GEO.terrain);
  for (const [x, y] of STRASBOURG_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const STRASBOURG = {
  id: 'strasbourg', name: '스트라스부르', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'strasbourg', // 오버월드 EMEA 게이트는 Codex-1 후속(스트라스부르역 기준)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: STRASBOURG_GEO.railways,
  // 🎨 R4 — 알자스 목조·사암 톤(brick 재사용).
  tileSkins: Object.freeze({ building: 'brick' }),
  CITY_TILE, buildGrid: buildStrasbourgGrid,
};

export default STRASBOURG;
