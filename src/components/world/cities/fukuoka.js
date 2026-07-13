// 🏙️ 학습 월드 — 후쿠오카 도시 정밀맵 데이터 (1호 도시 · 파일럿).
//
// 설계 문서: docs/world-city-maps.md. CityScene(파라미터화된 도시 씬)이 이 데이터를 읽어 렌더한다.
// **도시 추가 = 데이터 파일 1개** 원칙 — 그리드(도시 전용 인코딩)·구역 라벨·가게/NPC·출입구·미니맵.
//
// 규모: 96×72 타일(전국맵과 동일 1타일=32 월드 px). 동네 3구역:
//   ① 하카타항(남쪽) — 페리 부두·전국맵 복귀 출구.
//   ② 하카타 라멘 골목(동쪽) — 기존 라멘집 NPC 이전 배치(nodeId 'fukuoka-ramen' 유지 — 스탬프 연속성).
//   ③ 텐진 상점가(서쪽) — 돈키호테 파사드(ot-12 면세 도어의 무대. NPC 없음 — 파사드+간판, A로 짧은 desc).
// 나카강(canal)이 텐진과 도심을 가르고, 다리로 잇는다. 다자이후 신사는 전국맵에 유지(도시맵 밖).
//
// 인코딩(문서 §4-3): 선언적 구획 그리드 + 프리팹 배치. 순수 함수(buildFukuokaGrid)라 Phaser 의존 0 —
//   vitest(node)에서 그리드 무결성(크기·출입구 보행·NPC 인접·연결성)을 그대로 검증한다.

export const COLS = 96;
export const ROWS = 72;

// ── 도시 전용 타일 코드 (전국맵 mapData TERRAIN 와 별개 — 도시 규모에 맞춘 단순 인코딩) ──
export const CITY_TILE = {
  ROAD: 0,       // 아스팔트 차도(보행 가능)
  SIDEWALK: 1,   // 보도(기본 지면)
  CROSSWALK: 2,  // 횡단보도
  PLAZA: 3,      // 광장/부두 지면
  PARK: 4,       // 공원 잔디(가로수 스폰)
  BRIDGE: 5,     // 나카강 다리(보행 가능)
  DOCK: 6,       // 부두 데크
  EXIT: 7,       // 전국맵 복귀 출구(밟으면 이탈)
  WATER: 8,      // 나카강·항만 수면(차단)
  BUILDING: 9,   // 건물 블록(차단 · 파사드 렌더)
};

// 차단 타일 — 물·건물만 막는다(도로·보도·횡단보도·다리·부두·공원·광장·출구는 통행 가능).
const CITY_BLOCKED = new Set([CITY_TILE.WATER, CITY_TILE.BUILDING]);
export function isCityBlocked(code) { return CITY_BLOCKED.has(code); }
export function isCityWalkable(code) { return !CITY_BLOCKED.has(code); }

// 도시 진입 스폰(부두 광장 북쪽 — 도심을 향해 up). 전국맵→도시 진입·직행 재접속 폴백 좌표.
export const ENTRANCE = { x: 47, y: 60, facing: 'up' };

// ── 구역(동네) — 미니맵 라벨 + 지역 식별 ──
// bounds 는 미니맵 색조 힌트, label/labelTile 은 미니맵 텍스트 배치.
export const ZONES = [
  { id: 'hakata-port', label: '하카타항', bounds: [4, 55, 91, 71], labelTile: [47, 62] },
  { id: 'ramen-alley', label: '라멘 골목', bounds: [64, 6, 94, 54], labelTile: [79, 21] },
  { id: 'tenjin', label: '텐진 상점가', bounds: [2, 6, 29, 54], labelTile: [15, 21] },
];

// ── 가게/NPC 노드 (도시 로컬 좌표) ──
//   · ramen  : 기존 라멘집 NPC 이전(nodeId 유지). npc 필드로 NpcDialog(npcScripts 무수정). 마커 t_npc_ramen.
//   · donki  : 텐진 돈키호테 파사드. NPC 없음 — A 로 짧은 desc(면세 도어 무대 소개). 스탬프 없음(noStamp).
export const CITY_NODES = [
  {
    id: 'fukuoka-ramen', kind: 'npc', npc: 'ramen', name: '하카타 라멘 전문점',
    tile: [78, 30], facing: 'down',
    desc: '뽀얀 김이 오르는 돈코츠 라멘 전문점. 입구 券売機(켄바이키)에서 식권부터 — 「替え玉お願いします」를 써 볼 곳.',
  },
  {
    id: 'fukuoka-donki', kind: 'shop', name: '돈키호테 텐진점', facade: 'donki',
    tile: [14, 28], facing: 'down', noStamp: true,
    desc: '노란 간판이 번쩍이는 대형 할인점. 2층 免税(めんぜい·면세) 카운터에서 여권을 보이면 세금을 돌려받아요. (ot-12 면세 도어의 무대 — 아직 점원은 없어요.)',
  },
];

// 프리팹 파사드(노렌·간판) 배치 — 건물 프론티지에 얹는 도트 소품(순수 시각).
// kind: 'noren'(붉은 노렌+초롱) | 'sign'(간판 보드) | 'donki'(돈키 간판). CityScene 이 도트로 굽는다.
export const PROPS = [
  { kind: 'sign', tile: [10, 16] }, { kind: 'noren', tile: [24, 16] },
  { kind: 'sign', tile: [36, 16] }, { kind: 'noren', tile: [72, 16] },
  { kind: 'sign', tile: [88, 16] }, { kind: 'noren', tile: [72, 34] },
  { kind: 'sign', tile: [24, 40] }, { kind: 'noren', tile: [88, 40] },
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

// 선언적 구획 그리드 빌더 — 결정적·순수. 반환: Uint8Array(COLS*ROWS), 값 ∈ CITY_TILE.
export function buildFukuokaGrid() {
  const T = CITY_TILE;
  const g = new Uint8Array(COLS * ROWS).fill(T.SIDEWALK);

  // ── 건물 블록(구역별) — 프론티지 보도 1타일 남기고 카빙 ──
  const BLOCKS = [
    // 텐진(서) — x2..29, 세로 보도 회랑 x14 를 사이에 둔 두 건물 열.
    [4, 10, 12, 16], [18, 10, 27, 16], [4, 22, 12, 30], [18, 22, 27, 30], [4, 38, 12, 48], [18, 38, 27, 48],
    // 도심(중앙) — x34..56, 중앙 공원은 아래에서 별도.
    [34, 10, 38, 16], [54, 10, 56, 16], [34, 38, 38, 48], [52, 38, 56, 48],
    // 라멘 골목(동) — x66..93, 세로 회랑 x78 을 사이에 둔 두 건물 열.
    [68, 10, 77, 18], [83, 10, 92, 18], [68, 24, 77, 32], [83, 24, 92, 32], [68, 38, 77, 48], [83, 38, 92, 48],
  ];
  for (const [x0, y0, x1, y1] of BLOCKS) paint(g, x0, y0, x1, y1, T.BUILDING);

  // 중앙 공원(가로수) — 도심 코어.
  paint(g, 40, 22, 52, 32, T.PARK);

  // ── 차도(2타일 폭) — 동서 대로 3 + 남북 거리 몇 + 부두 연결로 ──
  const HROADS = [18, 34, 50];       // 동서 대로 시작 y(각 y, y+1)
  const VROADS = [14, 40, 58, 80];   // 남북 거리 시작 x(각 x, x+1)
  for (const y of HROADS) paint(g, 2, y, 93, y + 1, T.ROAD);
  for (const x of VROADS) paint(g, x, 6, x + 1, 54, T.ROAD);
  paint(g, 46, 50, 47, 60, T.ROAD);  // 부두 연결로(도심→항)

  // 횡단보도 — 교차로마다 대로 위 지브라(간단히 교차점 셀에).
  for (const y of HROADS) for (const x of VROADS) paint(g, x, y, x + 1, y + 1, T.CROSSWALK);

  // ── 나카강(canal) — 텐진과 도심을 가르는 세로 수로 + 대로 교차점 다리 ──
  paint(g, 30, 8, 31, 54, T.WATER);
  for (const y of HROADS) paint(g, 30, y, 31, y + 1, T.BRIDGE);

  // ── 하카타항(남쪽) — 부두 광장 + 페리 부두(pier) + 항만 수면 + 복귀 출구 ──
  paint(g, 4, 55, 91, 67, T.PLAZA);         // 부두 광장
  paint(g, 0, 68, 95, 71, T.WATER);         // 항만 수면(바깥 프레임)
  paint(g, 45, 66, 50, 70, T.DOCK);         // 부두 데크(남으로 돌출)
  paint(g, 46, 70, 49, 70, T.EXIT);         // 페리 선착장 — 밟으면 전국맵 복귀

  // ── 노드 프론티지 확보 — 마커 타일과 남쪽 이웃을 보도로(보행 인접 보장) ──
  for (const n of CITY_NODES) {
    const [nx, ny] = n.tile;
    g[idx(nx, ny)] = T.SIDEWALK;
    if (ny + 1 < ROWS) g[idx(nx, ny + 1)] = T.SIDEWALK;
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
