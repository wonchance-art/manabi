import { describe, expect, it } from 'vitest';
import { projectionMetrics, project } from '../../../../scripts/build-korean-city-osm-snapshot.mjs';
import { cityMinimapLayout } from '../cityMinimap.js';
import { CITY_SCALE_TIERS, cityMetersPerTile, cityScaleTier } from '../cities/scale.js';

describe('city geo scale tier contract', () => {
  it('allows only standard 20m and precision 4m tiers', () => {
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

  it('projects the same bbox at five times each axis resolution for 4m', () => {
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

  it('keeps the approved Mont-Saint-Michel 4m grid under the 24 MiB minimap peak gate', () => {
    const cols = 442;
    const rows = 1030;
    const cells = cols * rows;
    const layout = cityMinimapLayout(cols, rows);
    const sourceCanvasBytes = layout.sourceWidth * layout.sourceHeight * 4;
    const estimatedCoreArrayBytes = cells * 3;
    const estimatedPeakBytes = estimatedCoreArrayBytes + layout.backingBytes + sourceCanvasBytes * 2;
    expect(cells).toBe(455_260);
    expect(layout).toMatchObject({
      factor: 1, sourceWidth: 442, sourceHeight: 1030, width: 1326, height: 3090,
    });
    expect(estimatedPeakBytes).toBe(21_397_220);
    expect(estimatedPeakBytes).toBeLessThan(24 * 1024 * 1024);
  });
});
