// 🏙️ 학습 월드 — 후쿠오카 도시 정밀맵 데이터 (1호 도시 · **실지형 geo 격상판**).
//
// 설계 문서: docs/world-city-maps.md · 리서치: docs/research-fukuoka-map.md.
// CityScene(파라미터화된 도시 씬)이 이 데이터를 읽어 렌더한다. **도시 추가 = 데이터 파일 1개** 원칙.
//
// ── 실지형 전환(손그림 128×96 → Codex geo 388×254) ──
//   지형·좌표계는 이제 cities/fukuoka.geo.js(§6.4 계약, Codex 소유·수정 금지)가 단일 진실원.
//   FUKUOKA_GEO(v2.1 실 OSM 재생성) = { meta:{grid:{w,h},metersPerTile:20,bbox,...},
//                   terrain:<디코드된 Uint8Array 388×254·건물/도로 실 래스터>, pois:[14], stations:[11] }.
//   terrain 은 이미 RLE 디코드된 표준 지형 코드 배열이라 buildGrid 는 복사해 EXIT 타일만 얹어 반환.
//   · COLS/ROWS = geo grid.w/h(388×254). metersPerTile=20 실축척.
//   · STATIONS = geo.stations(11) 매핑(전철 fast-travel — 실좌표·BFS 검증본).
//   · CITY_NODES = geo.pois(14·국제선 터미널 포함, tile=poiTile 로 자동 정합) + 라멘/一風堂/편의점/
//     이자카야 NPC·상점 4. geo POI 는 전부 보행·카디널 인접·단일 성분으로 스냅됨(Codex 계약).
//   · ENTRANCE/EXIT = 博多港 부두 인근 보행칸(v2.1 건물 실 래스터 반영해 재배치).
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

// geo POI(§6.4)의 보행 스냅 tile 을 단일 진실원으로 — 노드 좌표를 하드코딩하지 않고 여기서 끌어온다.
//   geo v2.1 재생성(건물·도로 실 래스터화)으로 POI tile 이 갱신돼도 노드가 자동 정합(무회귀).
//   Codex geo 는 전 POI 를 보행 가능·카디널 인접·메인 성분으로 스냅해 준다(계약).
const POI_BY_ID = Object.fromEntries(FUKUOKA_GEO.pois.map((p) => [p.id, p]));
const poiTile = (id) => POI_BY_ID[id].tile;

// 전국맵 복귀 출구(EXIT) — geo terrain 엔 EXIT 코드가 없어(게임 기믹) 여기서 배치한다.
//   博多港 베이사이드 부두(geo DOCK 클러스터)의 선착장 데크 2칸을 EXIT 로 승격 — 밟으면 전국맵 복귀.
//   (부두 인근이라 페리 하선/복귀 동선 정합. 진입 스폰과는 떨어져 있어 즉시 이탈 없음.)
//   geo v2.1(건물 실 래스터)에서 부두 인근 보행칸으로 재배치 — 국제선 터미널(博多港国際ターミナル)
//   앞 보도 2칸을 EXIT 로 승격(밟으면 전국맵 복귀). 페리 재승선 동선 정합·진입 스폰과 떨어져 즉시 이탈 없음.
const EXIT_TILES = [[240, 46], [241, 46]];

// 도시 진입 스폰(하카타항 베이사이드 부두 인근 보행칸 — 페리에서 내려 도심을 향해 down). 직행 재접속 폴백.
//   geo v2.1 에서 ベイサイドプレイス博多(국내선 부두) 남측 보도칸 — 메인 보행 성분·전역 도달.
export const ENTRANCE = { x: 236, y: 67, facing: 'down' };

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
  // ① 博多港/베이사이드 — 국내선 부두(ベイサイド)·국제선 터미널(博多港国際ターミナル)·포트타워.
  {
    id: 'bayside-place', kind: 'spot', name: 'ベイサイドプレイス博多', facade: 'sign',
    tile: poiTile('bayside-place'), facing: 'down', noStamp: true,
    desc: '국내선 부두 「ベイサイドプレイス博多」(べいさいどぷれいす はかた). 하카타 부두에서 배로 시카노시마(志賀島) 쪽으로 나가요. (노코노시마 能古島는 메이노하마 姪浜 나루에서 따로 가요.)',
  },
  {
    id: 'hakata-port-international-terminal', kind: 'spot', name: '博多港国際ターミナル', facade: 'sign',
    tile: poiTile('hakata-port-international-terminal'), facing: 'down', noStamp: true,
    desc: '부산행 국제 여객선이 드나드는 「博多港国際ターミナル」(はかたこう こくさいターミナル). 앞바다에 큰 카페리가 떠 있어요 — 여기서 배를 타면 부산으로.',
  },
  {
    id: 'hakata-port-tower', kind: 'spot', name: '博多ポートタワー', facade: 'sign',
    tile: poiTile('hakata-port-tower'), facing: 'down', noStamp: true,
    desc: '하카타항의 붉은 전망탑 「博多ポートタワー」(はかたぽーとたわー). 항만 베이 지구를 내려다보는 오래된 랜드마크예요.',
  },
  // ② 天神(서핵·백화점군) 인접 — アクロス福岡 + 편의점 NPC(ot-07 편의점 도어 무대).
  {
    id: 'acros-fukuoka', kind: 'spot', name: 'アクロス福岡', facade: 'depart',
    tile: poiTile('acros-fukuoka'), facing: 'down', noStamp: true,
    desc: '계단식 옥상 정원으로 유명한 복합 문화시설 「アクロス福岡」(あくろすふくおか). 텐진 도심에서 산처럼 초록으로 덮인 건물이에요.',
  },
  // ローソン(편의점 NPC) — 텐진 도심. ot-07 편의점 도어의 무대: 만능 대답 お願いします/大丈夫です.
  //   nodeId 는 WORLD_NODES 에 없어 스탬프 미대상(noStamp) — 대화 학습 경험만(스탬프 우주는 25 국내 노드 유지).
  {
    id: 'fukuoka-konbini', kind: 'npc', npc: 'konbini', name: 'ローソン',
    tile: [248, 140], facing: 'down', noStamp: true,
    desc: '24시간 불이 켜진 편의점(コンビニ) 「ローソン」(로손). 계산대에서 뭘 묻든 대답은 딱 두 개 — お願いします(네)·大丈夫です(됐어요). 명물 からあげクン도 있어요.',
  },
  // ③ 中洲 — 야타이 거리 + 돈키호테 中洲店(免税 도어 무대) + 一蘭 본사.
  {
    id: 'nakasu', kind: 'shop', name: 'ドン・キホーテ中洲店', facade: 'donki',
    tile: poiTile('nakasu'), facing: 'down', noStamp: true,
    desc: '두 강 사이 세로 섬 中洲(なかす)의 밤거리 — 야타이(屋台) 노점과 24시간 대형 할인점 「ドン・キホーテ中洲店」(どんきほーて なかすてん). 免税(めんぜい·면세) 카운터에서 여권을 보이면 세금을 돌려받아요. 근처엔 一蘭 본사도. (ot-12 면세 도어의 무대 — 아직 점원은 없어요.)',
  },
  // 居酒屋(이자카야 NPC) — 나카스 밤거리. ot-08 이자카야 도어의 무대: お通し의 정체 + 첫 주문 とりあえず生で.
  //   nodeId 는 WORLD_NODES 에 없어 스탬프 미대상(noStamp) — 대화 학습 경험만.
  {
    id: 'fukuoka-izakaya', kind: 'npc', npc: 'izakaya', name: '居酒屋',
    tile: [272, 132], facing: 'down', noStamp: true,
    desc: '나카스 밤거리의 이자카야(居酒屋). 안 시켜도 나오는 유료 기본 안주 お通し(오토시)와, 앉자마자 외치는 첫 주문 「とりあえず生で」를 써 볼 곳이에요.',
  },
  {
    id: 'kushida-jinja', kind: 'spot', name: '櫛田神社', facade: 'torii',
    tile: poiTile('kushida-jinja'), facing: 'down', noStamp: true,
    desc: '하카타의 총사(総鎮守) 「櫛田神社」(くしだじんじゃ). 여름 祇園山笠(ぎおんやまかさ)의 신사 — 붉은 토리이를 지나 참배해요.',
  },
  // ④ キャナルシティ — 운하 분수.
  {
    id: 'canal-city', kind: 'spot', name: 'キャナルシティ博多', facade: 'fountain',
    tile: poiTile('canal-city'), facing: 'down', noStamp: true,
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
    tile: poiTile('ohori-park'), facing: 'down', noStamp: true,
    desc: '후쿠오카성 외호(外堀)를 정비한 큰 연못 공원 「大濠公園」(おおほりこうえん). 연못을 두른 산책로와 스타벅스 뷰.',
  },
  {
    id: 'fukuoka-castle', kind: 'spot', name: '福岡城跡', facade: 'castle',
    tile: poiTile('fukuoka-castle'), facing: 'down', noStamp: true,
    desc: '오호리공원과 잇닿은 성터 「福岡城跡／舞鶴公園」(ふくおかじょうあと／まいづるこうえん). 봄이면 벚꽃이 석벽을 덮어요.',
  },
  {
    id: 'fukuoka-museum', kind: 'spot', name: '福岡市博物館', facade: 'depart',
    tile: poiTile('fukuoka-museum'), facing: 'down', noStamp: true,
    desc: '금인(金印·한위노국왕 金印)으로 알려진 「福岡市博物館」(ふくおかしはくぶつかん). 시사이드 모모치의 넓은 뮤지엄이에요.',
  },
  // ⑧ シーサイドももち/福岡タワー — 서쪽 해안 워터프런트.
  {
    id: 'momochi-seaside', kind: 'spot', name: 'シーサイドももち海浜公園', facade: 'sign',
    tile: poiTile('momochi-seaside'), facing: 'down', noStamp: true,
    desc: '인공 백사장이 펼쳐진 「シーサイドももち海浜公園」(しーさいどももち かいひんこうえん). 하카타만을 바라보는 산책 해변이에요.',
  },
  {
    id: 'fukuoka-tower', kind: 'spot', name: '福岡タワー', facade: 'sign',
    tile: poiTile('fukuoka-tower'), facing: 'down', noStamp: true,
    desc: '해안에 우뚝 선 전망탑 「福岡タワー」(ふくおかたわー). 삼각 거울 외벽이 바다를 비추는 모모치의 상징이에요.',
  },
  {
    id: 'marizon', kind: 'spot', name: 'マリゾン', facade: 'sign',
    tile: poiTile('marizon'), facing: 'down', noStamp: true,
    desc: '모모치 해변의 워터프런트 「マリゾン」(まりぞん). 예배당·상점이 모인 바닷가 소구역이에요.',
  },
  {
    id: 'paypay-dome', kind: 'spot', name: 'PayPayドーム', facade: 'sign',
    tile: poiTile('paypay-dome'), facing: 'down', noStamp: true,
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
  { kind: 'noren', tile: [203, 159] },      // 大名/ラーメン
  { kind: 'sign', tile: [124, 178] },       // 大濠公園
  { kind: 'sign', tile: [17, 123] },        // 福岡タワー/모모치
  // ── 🛳️ 렌더크래프트(오너 지시) — 페리선·캐널 내부 컷어웨이·하카타역 디테일(geo v2.1 좌표) ──
  { kind: 'ferry_intl', tile: [236, 47] },  // 博多港国際ターミナル 앞바다 — 부산행 대형 카페리
  { kind: 'ferry_dom', tile: [240, 67] },   // ベイサイド 국내선 부두 앞바다 — 시가시마行 소형선
  { kind: 'fountain', tile: [293, 148] },   // キャナルシティ 운하 분수(외곽 ring 내부)
  { kind: 'bus', tile: [293, 145] },        // キャナルシティ 버스터미널(내부 컷어웨이)
  { kind: 'stall', tile: [291, 147] },      // キャナルシティ 내부 몰 가게
  { kind: 'stall', tile: [295, 146] },      // キャナルシティ 내부 몰 가게
  { kind: 'hakata_sta', tile: [335, 141] }, // 博多駅 대형 역사(JR博多シティ) — 허브
  { kind: 'platform', tile: [331, 146] },   // 博多駅 승강장
  { kind: 'platform', tile: [339, 146] },   // 博多駅 승강장
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
