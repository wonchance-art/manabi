// 🏙️ 코트다쥐르 확장 묶음 — 실 OSM geo(#158, 1571×1169)를 CityScene 계약에 연결한다.
// 니스+앙티브+생폴드방스+에즈+모나코 한 맵(오너 확정). geo가 단일 진실원, 여기는 콘텐츠만.
// 2축: name=nameFr, desc=ko 「nameFr(한글명)」 병기. desc 사실 검증 2026-07-17(웹 확정 5건 포함).
// IP 하드리밋: 몬테카를로 카지노 외관·명칭만(내부·도박 재현 금지), F1 코스·이벤트 재현 금지.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { COTE_DAZUR_GEO } from './cote-dazur.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = COTE_DAZUR_GEO.meta.grid.w;
export const ROWS = COTE_DAZUR_GEO.meta.grid.h;
export const ENTRANCE = { ...COTE_DAZUR_GEO.entrance };

const COTE_DAZUR_DESC_KO = Object.freeze({
  'promenade-des-anglais': '니스 해변을 따라 뻗은 산책로 「Promenade des Anglais(프롬나드 데 장글레)」. 19세기 겨울을 나러 온 영국 체류객들이 만든 데서 이름이 왔다고 전해져요.',
  'place-massena': '니스의 중심 광장 「Place Masséna(마세나 광장)」. 붉은 건물과 체스판 무늬 바닥이 상징이에요.',
  'vieux-nice': '좁은 골목이 얽힌 「Vieux Nice(니스 구시가)」. 살레야 광장의 꽃·청과 시장으로 알려져 있어요.',
  'castle-hill': '니스 항과 해안을 한눈에 내려다보는 언덕 「Colline du Château(캐슬힐)」. 성은 18세기 초에 헐렸고 지금은 전망 공원이에요.',
  'musee-chagall': '시미에 지구의 「Musée Marc Chagall(샤갈 미술관)」. 1973년 개관 — 샤갈 생전에 세워진 국립 미술관이에요.',
  'musee-matisse': '시미에 언덕의 「Musée Matisse(마티스 미술관)」. 붉은 제노바풍 저택이 상징 — 마티스는 만년을 니스에서 보냈어요.',
  'nice-airport': '「Aéroport Nice Côte d\'Azur(니스 코트다쥐르 공항)」. 바다에 면한 활주로로 착륙 풍경이 유명한 남프랑스 관문이에요.',
  'antibes-picasso': '앙티브 바닷가 성채의 「Musée Picasso(피카소 미술관)」. 피카소가 1946년 그리말디성에서 작업한 인연으로 1966년 피카소 미술관이 됐어요.',
  'fort-carre': '앙티브 항을 지키던 별 모양 성채 「Fort Carré(포르 카레)」. 16세기 축성으로 전해져요.',
  'saint-paul-de-vence': '성벽으로 둘러싸인 언덕 마을 「Saint-Paul-de-Vence(생폴드방스)」. 20세기 화가들이 사랑한 예술 마을로, 샤갈이 이곳에 잠들어 있어요.',
  'fondation-maeght': '생폴드방스 곁의 현대미술관 「Fondation Maeght(마그 재단)」. 1964년 개관 — 정원과 건축이 작품과 어우러진 곳으로 알려져 있어요.',
  'cagnes-renoir': '카뉴쉬르메르의 「Musée Renoir(르누아르 미술관)」. 르누아르가 만년을 보낸 올리브 정원의 저택 \'레 콜레트\'예요.',
  'villefranche-sur-mer': '깊은 만에 안긴 항구 마을 「Villefranche-sur-Mer(빌프랑슈쉬르메르)」. 파스텔색 집들과 옛 골목길로 알려져 있어요.',
  'eze-village': '해안 절벽 위 돌마을 「Èze(에즈)」. 좁은 골목 꼭대기의 이국정원에서 지중해가 내려다보여요.',
  'monaco-palace': '모나코 언덕 위 「Palais Princier(대공궁)」. 그리말디 가문이 다스려온 공국의 궁전으로, 위병 교대식이 열려요.',
  'oceanographic-museum': '절벽에 세워진 「Musée Océanographique(해양박물관)」. 1910년 개관 — 해양 탐험가였던 알베르 1세 대공이 세웠어요.',
  'port-hercule': '모나코의 항구 「Port Hercule(포르 에르퀼)」. 요트가 늘어선 공국의 앞바다 — 이 게임에선 항구 풍경만 담아요.',
  'monte-carlo-casino': '몬테카를로의 「Casino de Monte-Carlo(카지노)」 외관. 1863년 문을 연 벨에포크 건축물로, 이 게임에선 건물 외관과 광장만 참조해요.',
});

// 설정 언어 < 현지 언어 중앙 lookup.
export const COTE_DAZUR_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(COTE_DAZUR_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameFr,
      desc: COTE_DAZUR_DESC_KO[poi.id] ?? `코트다쥐르의 대표 장소 「${poi.nameFr}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return COTE_DAZUR_COPY[locale]?.[id] || COTE_DAZUR_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'antibes', label: '앙티브', bounds: [121, 835, 362, 1058], labelTile: [242, 947] },
  { id: 'cagnes', label: '카뉴쉬르메르', bounds: [282, 390, 524, 613], labelTile: [403, 502] },
  { id: 'saint-paul', label: '생폴드방스', bounds: [161, 223, 322, 390], labelTile: [242, 307] },
  { id: 'nice-airport', label: '니스 공항·바르강', bounds: [524, 390, 685, 613], labelTile: [605, 502] },
  { id: 'nice-west', label: '니스 신시가', bounds: [685, 223, 846, 390], labelTile: [766, 307] },
  { id: 'vieux-nice', label: '니스 구시가·항', bounds: [846, 223, 967, 362], labelTile: [907, 293] },
  { id: 'cimiez', label: '시미에', bounds: [806, 111, 926, 223], labelTile: [866, 167] },
  { id: 'corniche', label: '빌프랑슈~에즈 해안', bounds: [967, 111, 1289, 334], labelTile: [1128, 223] },
  { id: 'monaco', label: '모나코', bounds: [1369, 0, 1531, 167], labelTile: [1450, 84] },
];

export const CITY_NODES = COTE_DAZUR_GEO.pois.map((poi) => {
  const copy = poiCopy(poi.id);
  return {
    id: poi.id,
    kind: 'spot',
    name: copy.name,
    nameFr: poi.nameFr,
    contentLocale: poi.contentLocale,
    facade: poi.id === 'nice-airport' ? 'depart' : 'sign',
    tile: [poi.tile[0], poi.tile[1]],
    facing: 'down',
    noStamp: true,
    desc: copy.desc,
  };
});

// ⚠️ nameJa 필드는 CityScene 레거시 계약 — 프랑스 도시는 nameFr를 그대로 싣는다(yomi 공란).
export const STATIONS = COTE_DAZUR_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: station.nameFr,
  nameFr: station.nameFr,
  yomi: '',
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // TER 해안선 실정차 순서(마르세유~벤티미글리아선의 우리 구간).
    id: 'ter-cote-dazur', nameJa: 'TER Côte d\'Azur', mode: 'train', color: 0x2f6fb2,
    stopIds: ['antibes', 'cagnes-sur-mer', 'nice-ville', 'villefranche-sur-mer', 'eze-sur-mer', 'monaco-monte-carlo'],
    segmentMinutes: [8, 9, 7, 5, 8], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 300, headwayMinutes: 40 },
      { startMinute: 300, endMinute: 1440, headwayMinutes: 12 },
    ],
  },
];

// ⛲ 렌더크래프트 R1.5 — 기존 kind 재사용 배치(보행 판정+노드 이격 ≥2 계산치).
export const PROPS = [
  { kind: 'parasol', tile: [815, 308] },    // 프롬나드 파라솔(R3)
  { kind: 'fountain', tile: [847, 294] }, // 마세나 광장 분수
  { kind: 'stall', tile: [868, 300] },    // 니스 구시가 마르셰 노점
];

export function buildCoteDAzurGrid() {
  const grid = Uint8Array.from(COTE_DAZUR_GEO.terrain);
  for (const [x, y] of COTE_DAZUR_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const COTE_DAZUR = {
  id: 'cote-dazur', name: '코트다쥐르', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  returnNode: 'nice', // 오버월드 니스 노드(EMEA [289,551] 도착 [289,550]) — Codex-1 게이트 라운드와 정합
  // 📖 여행책 지구제 v1 (D2 6호 — T5 실측 그대로, 개방 9.88%).
  districts: {
    version: 'district-v1',
    open: [
      { id: 'ouest', label: '서부 리비에라', tiles: { rects: [[225, 870, 300, 970], [330, 460, 410, 530], [220, 245, 275, 320]] } },
      { id: 'nice', label: '니스', tiles: { rects: [[600, 150, 910, 500]] } },
      { id: 'est', label: '동부 연안', tiles: { rects: [[970, 105, 1235, 280]] } },
      { id: 'monaco', label: '모나코 일대', tiles: { rects: [[1420, 40, 1510, 125]] } },
    ],
    locked: {
      style: 'guidebook',
      line: '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요.',
    },
  },
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: [], railways: COTE_DAZUR_GEO.railways,
  tileSkins: Object.freeze({ building: 'terracotta', water: 'emerald' }), // R4 — 지중해 기와 + 휴양지 에메랄드
  CITY_TILE, buildGrid: buildCoteDAzurGrid,
};

export default COTE_DAZUR;
