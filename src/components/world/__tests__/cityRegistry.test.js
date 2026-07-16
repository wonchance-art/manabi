import { describe, expect, it } from 'vitest';
import { CITY_DATA, CITY_MAPS } from '../cities/index.js';

describe('도시 정밀맵 레지스트리', () => {
  it('현재 플레이 가능한 도시를 전체 맵 뷰어와 같은 순서로 노출한다', () => {
    expect(CITY_MAPS.map((city) => city.id)).toEqual([
      'fukuoka', 'tokyo', 'osaka', 'kyoto', 'busan', 'seoul', 'mont-saint-michel',
    ]);
    expect(Object.keys(CITY_DATA)).toEqual(CITY_MAPS.map((city) => city.id));
  });

  it('모든 도시가 뷰어에서 그릴 수 있는 격자 계약을 지킨다', () => {
    for (const city of CITY_MAPS) {
      const grid = city.buildGrid();
      expect(city.name).toBeTruthy();
      expect(city.cols).toBeGreaterThan(0);
      expect(city.rows).toBeGreaterThan(0);
      expect(grid).toBeInstanceOf(Uint8Array);
      expect(grid).toHaveLength(city.cols * city.rows);
      expect(CITY_DATA[city.id]).toBe(city);
    }
  });
});
