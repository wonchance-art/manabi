// 🏙️ 학습 월드 — 후쿠오카 도시 정밀맵 데이터 (1호 도시 · 실지리 격상판).
//
// 설계 문서: docs/world-city-maps.md · 리서치: docs/research-fukuoka-map.md(§조사3 7구역 추천안).
// CityScene(파라미터화된 도시 씬)이 이 데이터를 읽어 렌더한다. **도시 추가 = 데이터 파일 1개** 원칙.
//
// 규모: 128×96 타일(전국맵과 동일 1타일=32 월드 px). 동네 7구역(리서치 §조사3-1):
//   ① 博多港/베이사이드(북·만 접점) — 페리 부두=전국맵 복귀 출구(EXIT).
//   ② 天神(서핵) — 백화점·지하상가·면세.
//   ③ 中洲(중앙·두 물줄기 사이) — 야타이·ドン・キホーテ中洲店·一蘭·櫛田神社.
//   ④ キャナルシティ(나카스–하카타역 사이) — 운하 분수.
//   ⑤ 博多駅(동남·미카사강 옆) — JR博多シティ.
//   ⑥ ラーメン/大名 골목(서·다이묘) — 一風堂 大名本店·라멘집 NPC(nodeId 'fukuoka-ramen' 유지).
//   ⑦ 大濠公園/福岡城跡(서편 내륙) — 연못(중앙 섬·다리)·성터 석벽.
// 지형: 북쪽 하카타만 바다띠 + 노코노시마/시카노시마 실루엣 섬(배경·도달 불가), 나카강·하카타강·
//   미카사강 3선(다리로 연결), 오호리공원 연못, 캐널시티 운하. 다자이후 신사는 전국맵 유지.
//
// 인코딩(문서 §4-3): 선언적 구획 그리드 + 프리팹 배치. 순수 함수(buildFukuokaGrid)라 Phaser 의존 0 —
//   vitest(node)에서 그리드 무결성(크기·출입구 보행·NPC 인접·연결성)을 그대로 검증한다.

export const COLS = 128;
export const ROWS = 96;

// ── 도시 전용 타일 코드 (전국맵 mapData TERRAIN 와 별개 — 도시 규모에 맞춘 단순 인코딩) ──
export const CITY_TILE = {
  ROAD: 0,       // 아스팔트 차도(보행 가능)
  SIDEWALK: 1,   // 보도(기본 지면)
  CROSSWALK: 2,  // 횡단보도
  PLAZA: 3,      // 광장/부두 지면
  PARK: 4,       // 공원 잔디(가로수 스폰)
  BRIDGE: 5,     // 강 다리(보행 가능)
  DOCK: 6,       // 부두 데크
  EXIT: 7,       // 전국맵 복귀 출구(밟으면 이탈)
  WATER: 8,      // 강·연못·항만 수면(차단)
  BUILDING: 9,   // 건물 블록(차단 · 파사드 렌더)
  ISLAND: 10,    // 바다/연못 위 섬 실루엣(차단 · 배경 · 도달 불가)
};

// 차단 타일 — 물·건물·섬만 막는다(도로·보도·횡단보도·다리·부두·공원·광장·출구는 통행 가능).
const CITY_BLOCKED = new Set([CITY_TILE.WATER, CITY_TILE.BUILDING, CITY_TILE.ISLAND]);
export function isCityBlocked(code) { return CITY_BLOCKED.has(code); }
export function isCityWalkable(code) { return !CITY_BLOCKED.has(code); }

// 도시 진입 스폰(하카타항 부두 광장 — 페리에서 내려 도심을 향해 down). 직행 재접속 폴백 좌표.
export const ENTRANCE = { x: 62, y: 14, facing: 'down' };

// ── 구역(동네) — 미니맵 라벨(일본어 간판) + 지역 식별 ──
// bounds 는 미니맵 색조 힌트, label/labelTile 은 미니맵 텍스트 배치.
export const ZONES = [
  { id: 'hakata-port', label: '博多港', bounds: [2, 8, 125, 17], labelTile: [40, 11] },
  { id: 'tenjin', label: '天神', bounds: [4, 20, 42, 38], labelTile: [20, 22] },
  { id: 'nakasu', label: '中洲', bounds: [46, 26, 61, 76], labelTile: [53, 30] },
  { id: 'canalcity', label: 'キャナルシティ博多', bounds: [66, 42, 86, 64], labelTile: [76, 43] },
  { id: 'hakata-sta', label: '博多駅', bounds: [88, 58, 102, 90], labelTile: [95, 60] },
  { id: 'daimyo-ramen', label: '大名／ラーメン', bounds: [4, 42, 40, 56], labelTile: [20, 43] },
  { id: 'ohori', label: '大濠公園／福岡城跡', bounds: [4, 60, 40, 92], labelTile: [26, 61] },
];

// ── 가게/NPC·스팟 노드 (도시 로컬 좌표) ──
//   · npc(fukuoka-ramen): 기존 라멘집 NPC 이전(nodeId 유지 — 스탬프 연속성). NpcDialog(npcScripts 무수정).
//   · shop/spot(noStamp): 파사드+간판. A 로 짧은 desc(한국어 설명 + 일본어 명칭/요미). 스탬프 없음.
//   · desc 는 리서치 검증 표기만 — 단정 금지(우동 발상·노포 우열·야타이 상호 등) 회피.
export const CITY_NODES = [
  // ⑥ ラーメン/大名 골목 — 라멘집 NPC(이전 유지) + 一風堂 大名本店.
  {
    id: 'fukuoka-ramen', kind: 'npc', npc: 'ramen', name: '博多ラーメン',
    tile: [26, 47], facing: 'down',
    desc: '뽀얀 김이 오르는 돈코츠 라멘집(博多ラーメン·はかたラーメン). 입구 券売機(켄바이키)에서 식권부터 — 「替え玉お願いします」를 써 볼 곳.',
  },
  {
    id: 'fukuoka-ippudo', kind: 'shop', name: '一風堂 大名本店', facade: 'noren',
    tile: [12, 49], facing: 'down', noStamp: true,
    desc: '다이묘에서 시작한 돈코츠 라멘집 「一風堂 大名本店」(いっぷうどう だいみょうほんてん). 붉은 노렌 아래 白丸·赤丸.',
  },
  // ③ 中洲 — 야타이 거리 + 돈키호테(텐진→나카스 이전) + 一蘭 + 櫛田神社.
  {
    id: 'fukuoka-donki', kind: 'shop', name: 'ドン・キホーテ中洲店', facade: 'donki',
    tile: [54, 44], facing: 'down', noStamp: true,
    desc: '노란 간판이 번쩍이는 24시간 대형 할인점 「ドン・キホーテ中洲店」(どんきほーて なかすてん). 免税(めんぜい·면세) 카운터에서 여권을 보이면 세금을 돌려받아요. (ot-12 면세 도어의 무대 — 아직 점원은 없어요.)',
  },
  {
    id: 'fukuoka-ichiran', kind: 'shop', name: '一蘭 本社総本店', facade: 'noren',
    tile: [51, 62], facing: 'down', noStamp: true,
    desc: '칸막이 1인 부스에서 먹는 돈코츠 라멘 「一蘭 本社総本店」(いちらん ほんしゃそうほんてん). 주문표에 味の濃さ·こってり度를 골라 적어요.',
  },
  {
    id: 'fukuoka-kushida', kind: 'spot', name: '櫛田神社', facade: 'torii',
    tile: [57, 68], facing: 'down', noStamp: true,
    desc: '하카타의 총사(総鎮守) 「櫛田神社」(くしだじんじゃ). 여름 祇園山笠(ぎおんやまかさ)의 신사 — 붉은 토리이를 지나 참배해요.',
  },
  // ② 天神 — 백화점군·지하상가.
  {
    id: 'fukuoka-tenjin', kind: 'spot', name: '天神地下街', facade: 'depart',
    tile: [20, 26], facing: 'down', noStamp: true,
    desc: '남북으로 길게 이어진 지하상가 「天神地下街」(てんじんちかがい)와 岩田屋·福岡PARCO 백화점군. 텐진은 후쿠오카 도심의 서핵.',
  },
  // ④ キャナルシティ — 운하 분수.
  {
    id: 'fukuoka-canalcity', kind: 'spot', name: 'キャナルシティ博多', facade: 'fountain',
    tile: [74, 50], facing: 'down', noStamp: true,
    desc: '운하(캐널)를 낀 복합몰 「キャナルシティ博多」(きゃなるしてぃはかた). 분수쇼가 시간마다 물을 뿜어 올려요.',
  },
  // ⑤ 博多駅 — JR博多シティ.
  {
    id: 'fukuoka-hakata-sta', kind: 'spot', name: 'JR博多シティ', facade: 'station',
    tile: [94, 58], facing: 'down', noStamp: true,
    desc: '하카타역 직결 상업동 「JR博多シティ」(はかたシティ)·博多阪急. 신칸센·지하철이 모이는 도시의 관문.',
  },
  // ⑦ 大濠公園/福岡城跡.
  {
    id: 'fukuoka-ohori', kind: 'spot', name: '大濠公園', facade: 'sign',
    tile: [31, 64], facing: 'down', noStamp: true,
    desc: '후쿠오카성 외호(外堀)를 정비한 큰 연못 공원 「大濠公園」(おおほりこうえん). 연못을 두른 산책로와 스타벅스 뷰.',
  },
  {
    id: 'fukuoka-castle', kind: 'spot', name: '福岡城跡', facade: 'castle',
    tile: [26, 87], facing: 'down', noStamp: true,
    desc: '오호리공원과 잇닿은 성터 「福岡城跡／舞鶴公園」(ふくおかじょうあと／まいづるこうえん). 봄이면 벚꽃이 석벽을 덮어요.',
  },
  // ① 博多港/베이사이드.
  {
    id: 'fukuoka-bayside', kind: 'spot', name: 'ベイサイドプレイス博多', facade: 'sign',
    tile: [40, 12], facing: 'down', noStamp: true,
    desc: '페리 부두에 면한 베이사이드 「ベイサイドプレイス博多」(べいさいどぷれいす はかた). 배로 노코노시마(能古島)·시카노시마(志賀島) 같은 하카타만 섬으로 이어져요.',
  },
];

// 프리팹 파사드(노렌·간판·토리이·분수 등) 배치 — 건물 프론티지에 얹는 도트 소품(순수 시각·비상호작용).
// kind → CityScene 이 ct_prop_<kind> 텍스처로 굽는다.
export const PROPS = [
  { kind: 'sign', tile: [30, 22] }, { kind: 'depart', tile: [10, 22] },
  { kind: 'noren', tile: [48, 40] }, { kind: 'noren', tile: [58, 58] },
  { kind: 'noren', tile: [20, 45] }, { kind: 'torii', tile: [55, 65] },
  { kind: 'fountain', tile: [78, 52] }, { kind: 'sign', tile: [24, 62] },
  { kind: 'castle', tile: [10, 74] }, { kind: 'station', tile: [98, 64] },
  { kind: 'sign', tile: [90, 12] }, { kind: 'sign', tile: [70, 12] },
];

const idx = (x, y) => y * COLS + x;

function paint(g, x0, y0, x1, y1, code) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      g[idx(x, y)] = code;
    }
  }
}

// 둥근 섬/연못 실루엣 — 중심(cx,cy)·반경 r 의 마름모+사각 근사(도트 블롭).
function blob(g, cx, cy, rx, ry, code) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const nx = (x - cx) / (rx + 0.0001), ny = (y - cy) / (ry + 0.0001);
      if (nx * nx + ny * ny <= 1.05) g[idx(x, y)] = code;
    }
  }
}

// 선언적 구획 그리드 빌더 — 결정적·순수. 반환: Uint8Array(COLS*ROWS), 값 ∈ CITY_TILE.
export function buildFukuokaGrid() {
  const T = CITY_TILE;
  const g = new Uint8Array(COLS * ROWS).fill(T.SIDEWALK);

  // ── ① 하카타만(북쪽 바다띠) + 섬 실루엣 + 항 광장 + 페리 부두 ──
  paint(g, 0, 0, COLS - 1, 7, T.WATER);            // 만 수면
  blob(g, 22, 3, 8, 3, T.ISLAND);                  // 노코노시마(🌸 꽃섬 — 만 안쪽 서)
  blob(g, 98, 3, 9, 3, T.ISLAND);                  // 시카노시마(만 입구 동)
  paint(g, 106, 3, 118, 4, T.ISLAND);              // 우미노나카미치(가는 사주 실루엣)
  paint(g, 2, 8, 125, 17, T.PLAZA);                // 博多港 부두 광장(베이사이드)
  paint(g, 60, 4, 65, 9, T.DOCK);                  // 페리 부두 데크(북으로 돌출)
  paint(g, 61, 3, 64, 3, T.EXIT);                  // 페리 선착장 — 밟으면 전국맵 복귀

  // ── 구역별 지면(공원·광장) ──
  paint(g, 30, 26, 38, 34, T.PARK);                // 天神 중앙 소공원(가로수)
  paint(g, 66, 44, 86, 64, T.PLAZA);               // キャナルシティ 광장(운하 낀 몰 앞마당)
  paint(g, 4, 60, 40, 92, T.PARK);                 // 大濠公園/福岡城跡 녹지

  // ── 건물 블록(구역별) — 프론티지 보도 1타일 남기고 카빙(도로는 뒤에서 위에 카빙) ──
  const BLOCKS = [
    // ② 天神(x4..42) — 백화점·지하상가 상부. 중앙 소공원 좌우로 건물열.
    [6, 20, 14, 24], [22, 20, 28, 24], [4, 28, 14, 36], [18, 30, 28, 36], [34, 20, 40, 30],
    // ⑥ 大名/ラーメン(x4..40, y42..56) — 라멘·카페 골목.
    [6, 44, 14, 50], [18, 44, 24, 50], [30, 44, 38, 52], [6, 52, 22, 55],
    // ③ 中洲(x46..61, y26..76) — 야타이·환락가 블록(두 강 사이 세로 섬).
    [46, 28, 52, 36], [56, 28, 61, 36], [46, 46, 52, 54], [56, 46, 61, 56], [46, 64, 52, 74], [56, 70, 61, 74],
    // ④ キャナルシティ 주변 상업동(광장 밖 테두리).
    [66, 40, 74, 42], [80, 40, 86, 42], [66, 66, 78, 72],
    // ⑤ 博多駅(x88..102, y58..90) — 역사·아뮤플라자.
    [88, 60, 96, 68], [98, 60, 102, 70], [88, 74, 96, 84], [98, 76, 102, 88],
    // 동쪽 미카사강 건너(x108..125) — 주택/상업 소블록.
    [110, 30, 118, 40], [110, 60, 120, 72],
  ];
  for (const [x0, y0, x1, y1] of BLOCKS) paint(g, x0, y0, x1, y1, T.BUILDING);

  // 성터 석벽(福岡城跡) — 오호리 녹지 남서에 ㄷ자 석벽(건물 코드로 렌더).
  paint(g, 10, 76, 22, 78, T.BUILDING);
  paint(g, 10, 78, 12, 88, T.BUILDING);

  // ── 차도(2타일 폭) — 동서 대로 5 + 남북 거리 8 ──
  const HROADS = [24, 40, 56, 72, 88];             // 동서 대로 시작 y(각 y, y+1)
  const VROADS = [10, 24, 38, 52, 68, 82, 100, 114]; // 남북 거리 시작 x(각 x, x+1)
  for (const y of HROADS) paint(g, 2, y, COLS - 3, y + 1, T.ROAD);
  for (const x of VROADS) paint(g, x, 18, x + 1, 92, T.ROAD);

  // 횡단보도 — 교차로마다 대로 위 지브라(교차점 셀).
  for (const y of HROADS) for (const x of VROADS) paint(g, x, y, x + 1, y + 1, T.CROSSWALK);

  // ── 하천 3선(세로 수면) + 대로 교차점 다리 ──
  // 那珂川(나카강) — 텐진(서)과 나카스(중앙) 사이.
  paint(g, 44, 20, 45, 80, T.WATER);
  // 博多川(하카타강) — 나카스를 동에서 감싸는 두 번째 물줄기(나카스=두 강 사이 섬).
  paint(g, 62, 28, 63, 78, T.WATER);
  // 御笠川(미카사강) — 동쪽 테두리, 하카타역 곁을 지나 만으로.
  paint(g, 104, 22, 105, 92, T.WATER);
  for (const y of HROADS) {
    for (const [rx0, rx1] of [[44, 45], [62, 63], [104, 105]]) {
      // 강 범위 안의 대로 교차 지점에만 다리.
      paint(g, rx0, y, rx1, y + 1, T.BRIDGE);
    }
  }

  // ── 大濠公園 연못(중앙 섬 + 가로지르는 다리) ──
  blob(g, 20, 76, 13, 9, T.WATER);                 // 원형 연못
  paint(g, 6, 82, 30, 83, T.BRIDGE);               // 연못을 동서로 가로지르는 다리(양안 연결)
  blob(g, 13, 79, 2, 1, T.ISLAND);                 // 연못 섬 실루엣(다리 곁)
  blob(g, 27, 73, 2, 1, T.ISLAND);

  // ── キャナルシティ 운하(분수) — 광장 안 작은 물길 + 다리 ──
  paint(g, 70, 50, 78, 53, T.WATER);
  paint(g, 73, 50, 74, 53, T.BRIDGE);

  // ── 노드 프론티지 확보 — 마커 타일·주변을 보도로(보행 인접·접근 보장) ──
  for (const n of CITY_NODES) {
    const [nx, ny] = n.tile;
    for (const [dx, dy] of [[0, 0], [0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const x = nx + dx, y = ny + dy;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      if (isCityBlocked(g[idx(x, y)])) g[idx(x, y)] = T.SIDEWALK;
    }
  }
  // 진입 스폰 타일도 보도/광장 보장.
  if (isCityBlocked(g[idx(ENTRANCE.x, ENTRANCE.y)])) g[idx(ENTRANCE.x, ENTRANCE.y)] = T.PLAZA;

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
  props: PROPS,
  CITY_TILE,
  buildGrid: buildFukuokaGrid,
};

export default FUKUOKA;
