import { describe, it, expect } from 'vitest';
import {
  MAP_W, MAP_H, GEO, project, POI, MAP_RLE, decodeMap, isLandAt,
} from '../mapData.js';

// 🗺️ 광장 맵(한반도+일본 실비율 도트 맵) 무결성.
// build-map.mjs 가 구운 mapData.js 를 검증한다: 투영 검산·RLE 왕복·주요 지점 land/sea.

describe('등장방형 투영 (위도 고정 cos38°)', () => {
  it('상수: LON0=123.5, LAT0=46.0, KX=19.5, KY=24.7', () => {
    expect(GEO).toEqual({ LON0: 123.5, LAT0: 46.0, KX: 19.5, KY: 24.7 });
  });
  it('서울(126.98E, 37.57N) → (68, 208)', () => {
    expect(project(126.98, 37.57)).toEqual({ x: 68, y: 208 });
  });
  it('도쿄(139.69E, 35.68N) → (316, 255)', () => {
    expect(project(139.69, 35.68)).toEqual({ x: 316, y: 255 });
  });
  it('부산(129.07E, 35.18N) → (109, 267)', () => {
    expect(project(129.07, 35.18)).toEqual({ x: 109, y: 267 });
  });
  it('POI 주요 지점이 투영값과 일치', () => {
    expect(POI.SEOUL).toEqual({ x: 68, y: 208 });
    expect(POI.TOKYO).toEqual({ x: 316, y: 255 });
    expect(POI.BUSAN).toEqual({ x: 109, y: 267 });
    // 인천공항은 서울 서쪽, 하네다는 도쿄 곁.
    expect(POI.INCHEON.x).toBeLessThan(POI.SEOUL.x);
  });
});

describe('RLE 디코더 왕복', () => {
  const grid = decodeMap();

  it('디코드 격자는 MAP_W×MAP_H 길이의 0/1 배열', () => {
    expect(grid.length).toBe(MAP_W * MAP_H);
    for (let i = 0; i < grid.length; i++) expect(grid[i] === 0 || grid[i] === 1).toBe(true);
  });

  it('디코드는 결정적(두 번 호출 결과 동일)', () => {
    const g2 = decodeMap();
    expect(Array.from(g2)).toEqual(Array.from(grid));
  });

  it('격자 → RLE 재인코딩이 MAP_RLE 와 완전 일치(왕복 무손실)', () => {
    // 디코더와 대칭인 인코더로 되감아 원본 문자열과 비교한다.
    const rows = [];
    for (let y = 0; y < MAP_H; y++) {
      const runs = [];
      let val = 0, count = 0;
      for (let x = 0; x < MAP_W; x++) {
        const v = grid[y * MAP_W + x];
        if (v === val) count++;
        else { runs.push(count.toString(36)); val = v; count = 1; }
      }
      runs.push(count.toString(36));
      rows.push(runs.join(','));
    }
    expect(rows.join(';')).toBe(MAP_RLE);
  });
});

describe('데이터 무결성 (주요 지점 land / 해협 sea / 제주 존재)', () => {
  const grid = decodeMap();
  const land = (p) => isLandAt(grid, p.x, p.y);

  it('서울·도쿄·부산·후쿠오카는 land', () => {
    expect(land(POI.SEOUL)).toBe(true);
    expect(land(POI.TOKYO)).toBe(true);
    expect(land(POI.BUSAN)).toBe(true);
    expect(land(POI.FUKUOKA)).toBe(true);
  });

  it('대한해협 중간(117, 260)은 sea', () => {
    expect(isLandAt(grid, 117, 260)).toBe(false);
  });

  it('제주 존재 — 중심부(59, 312) land + 주변 덩어리 확인', () => {
    expect(isLandAt(grid, 59, 312)).toBe(true);
    let n = 0;
    for (let y = 308; y <= 318; y++) for (let x = 54; x <= 66; x++) if (isLandAt(grid, x, y)) n++;
    expect(n).toBeGreaterThan(30); // 제주는 큰 섬 — 소도서 정리에도 유지
  });

  it('범위 밖은 sea 취급', () => {
    expect(isLandAt(grid, -1, 0)).toBe(false);
    expect(isLandAt(grid, MAP_W, 0)).toBe(false);
    expect(isLandAt(grid, 0, MAP_H)).toBe(false);
  });

  it('바다가 대부분(실비율 맵 — land 비율 30% 미만)', () => {
    let land = 0; for (let i = 0; i < grid.length; i++) land += grid[i];
    expect(land).toBeGreaterThan(1000);
    expect(land / grid.length).toBeLessThan(0.3);
  });
});
