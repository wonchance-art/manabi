// 🗺️ 도시 정밀맵 — **표준 지형 코드**(docs/world-city-maps.md §6.4) 단일 진실원.
//
// 렌더러(CityScene 청크 베이킹)·충돌·미니맵·도시 데이터(cities/<id>.js)·향후 geo 엔진
// (cities/<id>.geo.js)이 **모두 이 상수를 참조**한다. 도시가 늘어도 지형 코드는 하나.
//
// §6.4 표준 지형 코드:
//   ROAD · SIDEWALK · CROSSWALK · PLAZA · PARK · BEACH · WATER(차단) · RIVER(차단) ·
//   BUILDING(차단) · ISLAND(차단·배경) · BRIDGE · DOCK
// + EXIT: 게임 기믹(전국맵 복귀). geo terrain 배열엔 없고 도시 로직이 배치하는 보행 타일.
//
// 숫자값은 기존 후쿠오카 인코딩(0..10)을 보존하고 RIVER·BEACH만 뒤에 덧붙인다
//   → 미니맵 색표·저장 그리드·회귀 테스트가 그대로 유효(무회귀).

export const CITY_TILE = {
  ROAD: 0,       // 아스팔트 차도(보행 가능)
  SIDEWALK: 1,   // 보도(기본 지면)
  CROSSWALK: 2,  // 횡단보도
  PLAZA: 3,      // 광장/부두 지면
  PARK: 4,       // 공원 잔디(가로수 스폰)
  BRIDGE: 5,     // 강 다리(보행 가능)
  DOCK: 6,       // 부두 데크
  EXIT: 7,       // 전국맵 복귀 출구(밟으면 이탈) — 게임 기믹(지형 코드 아님)
  WATER: 8,      // 바다·항만 수면(차단)
  BUILDING: 9,   // 건물 블록(차단 · 파사드 렌더)
  ISLAND: 10,    // 바다/연못 위 섬 실루엣(차단 · 배경 · 도달 불가)
  RIVER: 11,     // 강·운하 수면(차단 · WATER 와 구분해 강 톤)
  BEACH: 12,     // 모래 해변(보행 가능 · 해안선)
};

// 차단 타일 — 물·강·건물·섬만 막는다.
//   (도로·보도·횡단보도·다리·부두·공원·광장·해변·출구는 통행 가능.)
const CITY_BLOCKED = new Set([
  CITY_TILE.WATER, CITY_TILE.RIVER, CITY_TILE.BUILDING, CITY_TILE.ISLAND,
]);

export function isCityBlocked(code) { return CITY_BLOCKED.has(code); }
export function isCityWalkable(code) { return !CITY_BLOCKED.has(code); }

// 수면(물결 애니 대상) — WATER/RIVER 둘 다 흐르는 물. RIVER 는 강 톤으로 렌더.
export function isCityWater(code) { return code === CITY_TILE.WATER || code === CITY_TILE.RIVER; }

// 🚃 전철 fast-travel — 행선지 목록(현재 역 제외)을 만드는 공용 순수 로직.
//   도시 데이터의 stations 배열(현 fukuoka.js STATIONS · 향후 geo.js stations[])을 그대로 소비한다.
//   인터페이스가 stations 배열로 통일돼 있어 geo 통합 시 목록만 갈아끼우면 자동 동작(docs §6.2·§6.4).
export function fastTravelDestinations(stations, fromId) {
  return (Array.isArray(stations) ? stations : []).filter((s) => s && s.id !== fromId);
}

// 🚃 fast-travel 도착 tile 해석(순수·결정적) — 소프트락 방지 게이트.
//   유효 도착점 = 자기 셀이 보행 가능 **AND** cardinal 4방 중 최소 1칸이 보행 가능(걸어서 벗어날 수
//   있음). 자기만 보행이면 5×5 건물 한가운데 고립된 1칸 같은 곳에 스냅돼 못 나오는 소프트락이 남는다.
//   정확 tile 이 이 조건 실패면 반경 확장 링(Chebyshev)으로 **같은 조건**을 만족하는 최근접 칸을
//   결정적으로 탐색해 재배치. 그래도 없으면 null(이동 취소 → travelBlocked).
//   반환: [x,y] (보행 가능 + 보행 인접) | null. travelToStation 이 페이드 시작 전에 호출.
//   geo stations[] 상속·이후 도시 데이터의 잘못된/고립된 tile 도 런타임에서 안전하게 걸러낸다.
export function resolveArrivalTile(grid, cols, rows, tile) {
  if (!Array.isArray(tile) || tile.length !== 2) return null;
  const [tx, ty] = tile;
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return null;
  const inB = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const cell = (x, y) => inB(x, y) && isCityWalkable(grid[y * cols + x]);
  // 유효 도착점 — 보행 가능 + cardinal 보행 인접(걸어서 벗어날 수 있어야 함).
  const usable = (x, y) => cell(x, y) && (cell(x + 1, y) || cell(x - 1, y) || cell(x, y + 1) || cell(x, y - 1));
  if (usable(tx, ty)) return [tx, ty];
  const R = Math.max(cols, rows);
  for (let r = 1; r <= R; r++) {
    let best = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // 이번 링 테두리만
        const x = tx + dx, y = ty + dy;
        if (!usable(x, y)) continue;
        const d = dx * dx + dy * dy;                              // 유클리드² 최근접(동률 → 결정적 순서)
        if (d < bestD) { bestD = d; best = [x, y]; }
      }
    }
    if (best) return best;
  }
  return null;
}
