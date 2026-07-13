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
