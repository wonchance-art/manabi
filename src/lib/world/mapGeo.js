// 순수 지리 헬퍼 — WorldMapPage(관리자 전체 맵 뷰어) 전용 보조 모듈.
// mapData.js(자동 생성 파일, 직접 수정 금지)는 읽기 전용으로만 참조한다.
// React/Next/Supabase 등 브라우저 의존 없음 — vitest(node 환경)에서 그대로 임포트 가능.

import { GEO, MAP_W, MAP_H, TERRAIN, isLandAt, POI } from '../../components/world/mapData';

// ── 스폰 광장 → 플레이 가능 격자 변환 (순수 함수 · 결정적 · 단일 진실원) ──
// GameCanvas 런타임·관리자 뷰(WorldMapPage)·미니맵(buildMinimap)이 모두 이 함수를 거쳐
// "플레이 가능 격자"를 얻는다. 예전엔 GameCanvas 안에서만 광장을 메꿔(43타일) 관리자 뷰·
// 미니맵이 raw 격자를 그려 런타임과 어긋났다(P2-6). 이제 산출을 한 곳에 고정한다.
//
// 스폰 반경(타일). GameCanvas 장식 비움 반경과 동일값 — 여기서 단일 정의해 배포한다.
export const PLAZA_R = 5;

// 광장 SEA→LAND 메꿈 반경(타일). 서울 스폰 바로 주변만 walkable 로 보장하는 소패치.
// 예전엔 서울~인천공항을 통째로 덮는 사각형(x≈56–74)이라 buildPlayableGrid 가 경기만(인천 앞바다)
// SEA 를 전부 LAND 로 메꿔, 데이터에서 강화도·영종도·염하수로를 아무리 다듬어도 런타임·미니맵·관리자
// playable 뷰에서는 통짜 땅으로 보였다(오너 "안 바뀐다"의 근본 원인). 이제 인천 방향을 포함하지 않는
// 서울 ±PLAZA_FILL_R 소패치로 축소한다 — 서울은 원래 land 라 사실상 무연산이고, 인천공항 접근은
// 실지형(영종대교)으로 도달한다. 경기만 SEA 는 playable 격자에서도 보존된다(회귀의 핵심 게이트).
export const PLAZA_FILL_R = 3;

// 광장 SEA→LAND 메꿈 사각형 경계(서울 스폰 소패치). POI 에서 결정적으로 산출 — 인천 방향 미포함.
export function plazaBounds() {
  return {
    x0: POI.SEOUL.x - PLAZA_FILL_R,
    x1: POI.SEOUL.x + PLAZA_FILL_R,
    y0: POI.SEOUL.y - PLAZA_FILL_R,
    y1: POI.SEOUL.y + PLAZA_FILL_R,
  };
}

// rawGrid(mapData.decodeMap() 산출) → 플레이 가능 격자.
// 스폰 광장 사각형 안의 SEA 타일만 LAND 로 메꾼다(광장이 바다에 잘리지 않게). 목적이 그뿐이므로
// SEA 한정 — RIVER·LAKE·FENCE·BRIDGE 는 절대 건드리지 않는다(무차별 LAND 강제는 한강을 지우고
// 영종대교를 없애며 서측 철조망에 구멍을 뚫어 국경을 여는 회귀를 냈다). 입력 불변(복사본 반환).
export function buildPlayableGrid(rawGrid) {
  const grid = Uint8Array.from(rawGrid);
  const { x0, x1, y0, y1 } = plazaBounds();
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
      const i = ty * MAP_W + tx;
      if (grid[i] === TERRAIN.SEA) grid[i] = TERRAIN.LAND;
    }
  }
  return grid;
}

// 타일 좌표 → [lon, lat] — mapData.project()의 역함수.
// project: x = (lon - LON0) * KX, y = (LAT0 - lat) * KY
export function unproject(tx, ty) {
  return {
    lon: tx / GEO.KX + GEO.LON0,
    lat: GEO.LAT0 - ty / GEO.KY,
  };
}

// 타일이 바다(sea)인지 — 범위 밖도 바다로 취급.
// 주의: 해안 판정은 '바다'와의 인접만 본다. 강(river)·호수(lake)는 내륙 수계라
// 그 옆의 육지를 해안(모래)으로 만들지 않는다(한강변 서울이 해안이 되지 않도록).
export function isSeaAt(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return grid[ty * MAP_W + tx] === TERRAIN.SEA;
}

// land 타일이 4방향 중 하나라도 sea와 맞닿으면 해안(모래) 타일로 분류.
export function isCoastTile(grid, tx, ty) {
  if (!isLandAt(grid, tx, ty)) return false;
  return (
    isSeaAt(grid, tx - 1, ty) ||
    isSeaAt(grid, tx + 1, ty) ||
    isSeaAt(grid, tx, ty - 1) ||
    isSeaAt(grid, tx, ty + 1)
  );
}
