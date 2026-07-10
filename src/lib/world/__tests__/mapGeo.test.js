import { describe, it, expect } from 'vitest';
import { project, POI, decodeMap } from '../../../components/world/mapData';
import { unproject, isCoastTile } from '../mapGeo';

// 🗺️ 관리자 전체 맵 뷰어(WorldMapPage)가 쓰는 순수 지리 헬퍼 검증.
// project()/unproject()가 서로 역함수인지, 해안 판정이 sea 인접 land만 골라내는지 확인.

describe('unproject (project의 역함수)', () => {
  it('POI 좌표를 역산하면 원래 위경도에 근접한다 (반올림 오차 이내)', () => {
    const seoulLonLat = unproject(POI.SEOUL.x, POI.SEOUL.y);
    expect(seoulLonLat.lon).toBeCloseTo(126.98, 1);
    expect(seoulLonLat.lat).toBeCloseTo(37.57, 1);

    const tokyoLonLat = unproject(POI.TOKYO.x, POI.TOKYO.y);
    expect(tokyoLonLat.lon).toBeCloseTo(139.69, 1);
    expect(tokyoLonLat.lat).toBeCloseTo(35.68, 1);
  });

  it('project → unproject 왕복이 타일 좌표를 (반올림 오차 이내로) 보존한다', () => {
    const samples = [{ x: 68, y: 208 }, { x: 316, y: 255 }, { x: 0, y: 0 }, { x: 447, y: 383 }];
    for (const { x, y } of samples) {
      const { lon, lat } = unproject(x, y);
      const back = project(lon, lat);
      expect(back.x).toBeCloseTo(x, 0);
      expect(back.y).toBeCloseTo(y, 0);
    }
  });
});

describe('isCoastTile', () => {
  const grid = decodeMap();

  it('sea 타일은 해안이 아니다(land 아님)', () => {
    expect(isCoastTile(grid, 117, 260)).toBe(false); // 대한해협 중간 — sea
  });

  it('서울(내륙 land)은 인접 4방향이 모두 land라 해안이 아니다', () => {
    expect(isCoastTile(grid, POI.SEOUL.x, POI.SEOUL.y)).toBe(false);
  });

  it('land이면서 sea와 인접한 타일은 해안이다', () => {
    // 대한해협 인접 육상 타일을 grid에서 직접 탐색 — sea(117,260) 주변에서 land 이웃을 찾는다.
    let found = false;
    for (let dx = -6; dx <= 6 && !found; dx++) {
      for (let dy = -6; dy <= 6 && !found; dy++) {
        const tx = 117 + dx, ty = 260 + dy;
        if (isCoastTile(grid, tx, ty)) found = true;
      }
    }
    expect(found).toBe(true);
  });
});
