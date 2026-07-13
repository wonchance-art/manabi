// 🏙️ 학습 월드 — 후쿠오카 도시 정밀맵 데이터 (1호 도시 · **실지형 geo 격상판**).
//
// 설계 문서: docs/world-city-maps.md · 리서치: docs/research-fukuoka-map.md.
// CityScene(파라미터화된 도시 씬)이 이 데이터를 읽어 렌더한다. **도시 추가 = 데이터 파일 1개** 원칙.
//
// ── 실지형 전환(손그림 128×96 → Codex geo 388×254) ──
//   지형·좌표계는 이제 cities/fukuoka.geo.js(§6.4 계약, Codex 소유·수정 금지)가 단일 진실원.
//   FUKUOKA_GEO = { meta:{grid:{w,h},metersPerTile:20,bbox,...}, terrain:<디코드된 Uint8Array 388×254>,
//                   pois:[13], stations:[11] }. terrain 은 이미 RLE 디코드된 표준 지형 코드 배열이라
//   buildGrid 는 이를 복사해 EXIT(게임 기믹) 타일만 얹어 반환한다(지형 재생성 없음).
//   · COLS/ROWS = geo grid.w/h(388×254). metersPerTile=20 실축척.
//   · STATIONS = geo.stations(11) 매핑(전철 fast-travel — 실좌표·BFS 검증본).
//   · CITY_NODES = geo.pois(13) + 라멘 NPC + 一風堂 — geo 좌표에 한국어 desc/facade/kind 를 얹는다.
//     geo POI 가 물/건물 위(도달 불가)면 메인 보행 성분의 최근접 보행칸으로 스냅한 좌표를 쓴다
//     (오프라인 결정적 계산 — scripts/scratch 로 산출, geo 결정성이라 하드코딩 안전).
//   · ENTRANCE/EXIT = 博多港 부두(하카타항) — geo DOCK 클러스터 인근 보행칸/선착장.
//
// 인코딩(문서 §4-3 정신 유지): 순수 함수(buildFukuokaGrid)라 Phaser 의존 0 — vitest(node)에서
//   그리드 무결성(크기·출입구 보행·NPC 인접·연결성·BFS 도달성)을 그대로 검증한다.

// ── 표준 지형 코드 — 공용 단일 진실원(cities/terrain.js, docs §6.4) ──
import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
// ── 실지형 데이터(Codex 소유·읽기 전용) — 지형·POI·역의 단일 진실원 ──
import { FUKUOKA_GEO } from './fukuoka.geo.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = FUKUOKA_GEO.meta.grid.w; // 388
export const ROWS = FUKUOKA_GEO.meta.grid.h; // 254

// 전국맵 복귀 출구(EXIT) — geo terrain 엔 EXIT 코드가 없어(게임 기믹) 여기서 배치한다.
//   博多港 베이사이드 부두(geo DOCK 클러스터)의 선착장 데크 2칸을 EXIT 로 승격 — 밟으면 전국맵 복귀.
//   (부두 인근이라 페리 하선/복귀 동선 정합. 진입 스폰과는 떨어져 있어 즉시 이탈 없음.)
const EXIT_TILES = [[237, 62], [237, 63]];

// 도시 진입 스폰(하카타항 부두 광장 남쪽 보행칸 — 페리에서 내려 도심을 향해 down). 직행 재접속 폴백 좌표.
//   geo DOCK 클러스터(x235..237,y62..69) 남단에 붙은 보도칸 — 메인 보행 성분에 속해 전역 도달 가능.
export const ENTRANCE = { x: 237, y: 70, facing: 'down' };

// ── 구역(동네) — 미니맵 라벨(일본어 간판) + 지역 식별. geo 실좌표 기준 7구역 재배치 ──
//   bounds 는 미니맵 색조 힌트(그리드 범위 안), label/labelTile 은 미니맵 텍스트 배치.
export const ZONES = [
  { id: 'hakata-port', label: '博多港', bounds: [205, 55, 265, 92], labelTile: [228, 66] },
  { id: 'tenjin', label: '天神', bounds: [212, 120, 252, 162], labelTile: [220, 128] },
  { id: 'nakasu', label: '中洲', bounds: [256, 108, 284, 146], labelTile: [262, 116] },
  { id: 'canalcity', label: 'キャナルシティ博多', bounds: [283, 136, 318, 166], labelTile: [290, 141] },
  { id: 'hakata-sta', label: '博多駅', bounds: [312, 122, 362, 166], labelTile: [322, 130] },
  { id: 'daimyo-ramen', label: '大名／ラーメン', bounds: [178, 144, 222, 176], labelTile: [188, 151] },
  { id: 'ohori', label: '大濠公園／福岡城跡', bounds: [98, 158, 178, 202], labelTile: [116, 166] },
];

// ── 가게/NPC·스팟 노드 (도시 로컬 좌표 = geo POI 스냅 좌표) ──
//   · npc(fukuoka-ramen): 라멘집 NPC(nodeId 유지 — 스탬프 연속성). NpcDialog(npcScripts 무수정).
//   · shop/spot(noStamp): 파사드+간판. A 로 짧은 desc(한국어 설명 + 일본어 명칭/요미). 스탬프 없음.
//   · tile 은 geo POI 좌표를 메인 보행 성분 최근접 보행칸으로 스냅한 값(물/건물 위 POI 대응).
//   · desc 는 리서치 검증 표기만 — 단정 금지(우동 발상·노포 우열·야타이 상호 등) 회피.
export const CITY_NODES = [
  // ① 博多港/베이사이드 — 페리 부두·포트타워.
  {
    id: 'bayside-place', kind: 'spot', name: 'ベイサイドプレイス博多', facade: 'sign',
    tile: [235, 65], facing: 'down', noStamp: true,
    desc: '페리 부두에 면한 베이사이드 「ベイサイドプレイス博多」(べいさいどぷれいす はかた). 하카타 부두에서 배로 시카노시마(志賀島) 쪽으로 나가요. (노코노시마 能古島는 메이노하마 姪浜 나루에서 따로 가요.)',
  },
  {
    id: 'hakata-port-tower', kind: 'spot', name: '博多ポートタワー', facade: 'sign',
    tile: [213, 71], facing: 'down', noStamp: true,
    desc: '하카타항의 붉은 전망탑 「博多ポートタワー」(はかたぽーとたわー). 항만 베이 지구를 내려다보는 오래된 랜드마크예요.',
  },
  // ② 天神(서핵·백화점군) 인접 — アクロス福岡.
  {
    id: 'acros-fukuoka', kind: 'spot', name: 'アクロス福岡', facade: 'depart',
    tile: [250, 134], facing: 'down', noStamp: true,
    desc: '계단식 옥상 정원으로 유명한 복합 문화시설 「アクロス福岡」(あくろすふくおか). 텐진 도심에서 산처럼 초록으로 덮인 건물이에요.',
  },
  // ③ 中洲 — 야타이 거리 + 돈키호테 中洲店(免税 도어 무대) + 一蘭 본사.
  {
    id: 'nakasu', kind: 'shop', name: 'ドン・キホーテ中洲店', facade: 'donki',
    tile: [268, 128], facing: 'down', noStamp: true,
    desc: '두 강 사이 세로 섬 中洲(なかす)의 밤거리 — 야타이(屋台) 노점과 24시간 대형 할인점 「ドン・キホーテ中洲店」(どんきほーて なかすてん). 免税(めんぜい·면세) 카운터에서 여권을 보이면 세금을 돌려받아요. 근처엔 一蘭 본사도. (ot-12 면세 도어의 무대 — 아직 점원은 없어요.)',
  },
  {
    id: 'kushida-jinja', kind: 'spot', name: '櫛田神社', facade: 'torii',
    tile: [289, 125], facing: 'down', noStamp: true,
    desc: '하카타의 총사(総鎮守) 「櫛田神社」(くしだじんじゃ). 여름 祇園山笠(ぎおんやまかさ)의 신사 — 붉은 토리이를 지나 참배해요.',
  },
  // ④ キャナルシティ — 운하 분수.
  {
    id: 'canal-city', kind: 'spot', name: 'キャナルシティ博多', facade: 'fountain',
    tile: [296, 149], facing: 'down', noStamp: true,
    desc: '운하(캐널)를 낀 복합몰 「キャナルシティ博多」(きゃなるしてぃはかた). 분수쇼가 시간마다 물을 뿜어 올려요.',
  },
  // ⑥ 大名/ラーメン 골목 — 라멘집 NPC(이전 유지) + 一風堂 大名本店.
  {
    id: 'fukuoka-ramen', kind: 'npc', npc: 'ramen', name: '博多ラーメン',
    tile: [205, 158], facing: 'down',
    desc: '뽀얀 김이 오르는 돈코츠 라멘집(博多ラーメン·はかたラーメン). 입구 券売機(켄바이키)에서 식권부터 — 「替え玉お願いします」를 써 볼 곳.',
  },
  {
    id: 'fukuoka-ippudo', kind: 'shop', name: '一風堂 大名本店', facade: 'noren',
    tile: [200, 160], facing: 'down', noStamp: true,
    desc: '다이묘에서 시작한 돈코츠 라멘집 「一風堂 大名本店」(いっぷうどう だいみょうほんてん). 붉은 노렌 아래 白丸·赤丸.',
  },
  // ⑦ 大濠公園/福岡城跡 — 연못 공원·성터.
  {
    id: 'ohori-park', kind: 'spot', name: '大濠公園', facade: 'sign',
    tile: [122, 177], facing: 'down', noStamp: true,
    desc: '후쿠오카성 외호(外堀)를 정비한 큰 연못 공원 「大濠公園」(おおほりこうえん). 연못을 두른 산책로와 스타벅스 뷰.',
  },
  {
    id: 'fukuoka-castle', kind: 'spot', name: '福岡城跡', facade: 'castle',
    tile: [160, 175], facing: 'down', noStamp: true,
    desc: '오호리공원과 잇닿은 성터 「福岡城跡／舞鶴公園」(ふくおかじょうあと／まいづるこうえん). 봄이면 벚꽃이 석벽을 덮어요.',
  },
  {
    id: 'fukuoka-museum', kind: 'spot', name: '福岡市博物館', facade: 'depart',
    tile: [21, 146], facing: 'down', noStamp: true,
    desc: '금인(金印·한위노국왕 金印)으로 알려진 「福岡市博物館」(ふくおかしはくぶつかん). 시사이드 모모치의 넓은 뮤지엄이에요.',
  },
  // ⑧ シーサイドももち/福岡タワー — 서쪽 해안 워터프런트.
  {
    id: 'momochi-seaside', kind: 'spot', name: 'シーサイドももち海浜公園', facade: 'sign',
    tile: [13, 115], facing: 'down', noStamp: true,
    desc: '인공 백사장이 펼쳐진 「シーサイドももち海浜公園」(しーさいどももち かいひんこうえん). 하카타만을 바라보는 산책 해변이에요.',
  },
  {
    id: 'fukuoka-tower', kind: 'spot', name: '福岡タワー', facade: 'sign',
    tile: [17, 125], facing: 'down', noStamp: true,
    desc: '해안에 우뚝 선 전망탑 「福岡タワー」(ふくおかたわー). 삼각 거울 외벽이 바다를 비추는 모모치의 상징이에요.',
  },
  {
    id: 'marizon', kind: 'spot', name: 'マリゾン', facade: 'sign',
    tile: [14, 115], facing: 'down', noStamp: true,
    desc: '모모치 해변의 워터프런트 「マリゾン」(まりぞん). 예배당·상점이 모인 바닷가 소구역이에요.',
  },
  {
    id: 'paypay-dome', kind: 'spot', name: 'PayPayドーム', facade: 'sign',
    tile: [61, 118], facing: 'down', noStamp: true,
    desc: '개폐식 지붕의 대형 구장 「PayPayドーム」(ぺいぺいどーむ). 후쿠오카 소프트뱅크 호크스의 홈구장이에요.',
  },
];

// ── 🚃 전철 fast-travel 역(駅) — 무분할 대형 도시맵의 이동 수단(docs §6.2) ──
//   역 근접 → A → 행선지 선택 오버레이 → 페이드 후 도착역 인접 보행칸으로 순간이동(씬 유지).
//   인터페이스는 stations 배열({ id, nameJa, yomi, tile:[x,y], line? }) — geo.stations(11·§6.4 계약)를
//   그대로 매핑. tile 은 geo BFS 로 검증된 실좌표(전부 보행 가능·보행 인접)라 그대로 쓴다.
//   · yomi 는 학습 소재(역명 일본어 읽기) — 오버레이에 「博多駅 はかたえき」 형태로 병기.
export const STATIONS = FUKUOKA_GEO.stations.map((s) => ({
  id: s.id,
  nameJa: `${s.nameJa}駅`,
  yomi: `${s.yomi}えき`,
  tile: [s.tile[0], s.tile[1]],
  line: s.line,
}));

// 프리팹 파사드(노렌·간판·토리이·분수 등) 배치 — 건물 프론티지에 얹는 도트 소품(순수 시각·비상호작용).
// kind → CityScene 이 ct_prop_<kind> 텍스처로 굽는다. geo POI 좌표 인근에 배치.
export const PROPS = [
  { kind: 'sign', tile: [230, 68] },        // 博多港
  { kind: 'depart', tile: [248, 132] },     // 天神/アクロス
  { kind: 'torii', tile: [287, 124] },      // 櫛田神社
  { kind: 'fountain', tile: [298, 150] },   // キャナルシティ 운하
  { kind: 'noren', tile: [203, 159] },      // 大名/ラーメン
  { kind: 'station', tile: [333, 146] },    // 博多駅
  { kind: 'sign', tile: [124, 178] },       // 大濠公園
  { kind: 'sign', tile: [17, 123] },        // 福岡タワー/모모치
];

// 선언적 그리드 빌더 — 결정적·순수. 반환: Uint8Array(COLS*ROWS), 값 ∈ CITY_TILE.
//   geo terrain(이미 디코드된 표준 지형 코드 Uint8Array)을 복사해 EXIT 게임 기믹 타일만 얹는다.
//   (공유 geo.terrain 을 변경하지 않도록 반드시 복사한다.)
export function buildFukuokaGrid() {
  const g = Uint8Array.from(FUKUOKA_GEO.terrain);
  for (const [x, y] of EXIT_TILES) {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) g[y * COLS + x] = CITY_TILE.EXIT;
  }
  return g;
}

export const FUKUOKA = {
  id: 'fukuoka',
  name: '후쿠오카',
  cols: COLS,
  rows: ROWS,
  entrance: ENTRANCE,
  returnNode: 'fukuoka',   // 전국맵 복귀 시 이 노드 앞에서 스폰(worldNodes 의 fukuoka 도시 노드)
  zones: ZONES,
  nodes: CITY_NODES,
  stations: STATIONS,   // 🚃 전철 fast-travel 노드(geo.stations 매핑)
  props: PROPS,
  CITY_TILE,
  buildGrid: buildFukuokaGrid,
};

export default FUKUOKA;
