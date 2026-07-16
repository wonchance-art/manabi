import { describe, expect, it } from 'vitest';
import { cityMinimapLayout, downsampleCityGrid } from '../cityMinimap.js';
import { CITY_TILE } from '../cities/terrain.js';

describe('대형 도시 미니맵 메모리 게이트', () => {
  it('기존 도시는 원본 해상도를 유지하고 부산·서울만 제한한다', () => {
    expect(cityMinimapLayout(824, 1086)).toMatchObject({ factor: 1, width: 2472, height: 3258 });
    expect(cityMinimapLayout(1320, 1114)).toMatchObject({ factor: 2, width: 1980, height: 1671 });
    expect(cityMinimapLayout(1721, 1448)).toMatchObject({ factor: 3, width: 1722, height: 1449 });
    expect(cityMinimapLayout(1320, 1114).backingBytes).toBeLessThan(16 * 1024 * 1024);
    expect(cityMinimapLayout(1721, 1448).backingBytes).toBeLessThan(12 * 1024 * 1024);
  });

  it('다운샘플 시 도로·출구처럼 중요한 가는 지형을 보존한다', () => {
    const grid = Uint8Array.from([
      CITY_TILE.SIDEWALK, CITY_TILE.BUILDING, CITY_TILE.PARK,
      CITY_TILE.ROAD, CITY_TILE.SIDEWALK, CITY_TILE.WATER,
      CITY_TILE.SIDEWALK, CITY_TILE.EXIT, CITY_TILE.MOUNTAIN,
    ]);
    expect(downsampleCityGrid(grid, 3, 3, 3)).toEqual({
      codes: Uint8Array.from([CITY_TILE.EXIT]),
      width: 1,
      height: 1,
    });
  });
});
