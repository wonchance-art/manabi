// 순수 지리 헬퍼 — WorldMapPage(관리자 전체 맵 뷰어) 전용 보조 모듈.
// mapData.js(자동 생성 파일, 직접 수정 금지)는 읽기 전용으로만 참조한다.
// React/Next/Supabase 등 브라우저 의존 없음 — vitest(node 환경)에서 그대로 임포트 가능.

import { GEO, isLandAt } from '../../components/world/mapData';

// 타일 좌표 → [lon, lat] — mapData.project()의 역함수.
// project: x = (lon - LON0) * KX, y = (LAT0 - lat) * KY
export function unproject(tx, ty) {
  return {
    lon: tx / GEO.KX + GEO.LON0,
    lat: GEO.LAT0 - ty / GEO.KY,
  };
}

// land 타일이 4방향 중 하나라도 sea와 맞닿으면 해안(모래) 타일로 분류.
export function isCoastTile(grid, tx, ty) {
  if (!isLandAt(grid, tx, ty)) return false;
  return (
    !isLandAt(grid, tx - 1, ty) ||
    !isLandAt(grid, tx + 1, ty) ||
    !isLandAt(grid, tx, ty - 1) ||
    !isLandAt(grid, tx, ty + 1)
  );
}
