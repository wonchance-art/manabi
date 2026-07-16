import { describe, expect, it } from 'vitest';
import { projectionMetrics, project } from '../../../../scripts/build-korean-city-osm-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { CITY_SCALE_TIERS, cityMetersPerTile, cityScaleTier } from '../cities/scale.js';

describe('도시 geo 축척 티어 계약', () => {
  it('표준 20m와 정밀 4m만 허용한다', () => {
    expect(CITY_SCALE_TIERS).toEqual({
      standard: { id: 'city-standard-20m-v1', metersPerTile: 20 },
      precision: { id: 'city-precision-4m-v1', metersPerTile: 4 },
    });
    expect(cityScaleTier()).toBe(CITY_SCALE_TIERS.standard);
    expect(cityScaleTier(4)).toBe(CITY_SCALE_TIERS.precision);
    expect(cityMetersPerTile({ metersPerTile: 4 })).toBe(4);
    expect(cityMetersPerTile({ meta: { metersPerTile: 4 } })).toBe(4);
    expect(cityMetersPerTile({ id: 'legacy-city' })).toBe(20);
    expect(() => cityScaleTier(10)).toThrow(/unsupported city metersPerTile/);
    expect(() => cityScaleTier('4')).toThrow(/finite number/);
  });

  it('같은 bbox를 4m에서 축별 5배 해상도로 결정적으로 투영한다', () => {
    const bbox = [0, 0, 0.01, 0.01];
    const standard = projectionMetrics(bbox, 20);
    const precision = projectionMetrics(bbox, 4);
    const precisionAgain = projectionMetrics(bbox, 4);
    expect(precisionAgain).toEqual(precision);
    expect(Math.abs(precision.grid.w - standard.grid.w * 5)).toBeLessThanOrEqual(4);
    expect(Math.abs(precision.grid.h - standard.grid.h * 5)).toBeLessThanOrEqual(4);

    const standardPoint = project(0.005, 0.005, standard);
    const precisionPoint = project(0.005, 0.005, precision);
    expect(precisionPoint.x).toBeCloseTo(standardPoint.x * 5, 10);
    expect(precisionPoint.y).toBeCloseTo(standardPoint.y * 5, 10);
  });

  it('몽생미셸 목표급 0.08M 격자의 미니맵 추정 피크가 24 MiB 아래다', () => {
    const cols = 400;
    const rows = 200;
    const cells = cols * rows;
    const layout = cityMinimapLayout(cols, rows);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes + sourceCanvasBytes * 2;
    expect(cells).toBe(80_000);
    expect(layout).toMatchObject({ factor: 1, sourceWidth: 400, sourceHeight: 200 });
    expect(estimatedPeakBytes).toBe(3_760_000);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
