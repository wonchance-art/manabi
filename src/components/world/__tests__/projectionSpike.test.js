import { describe, expect, it } from 'vitest';
import {
  PROJECTION_IDS,
  buildProjection,
  chunkContinuityStats,
  pointMetrics,
  roundHalfAwayFromZero,
  sampleGrid,
  tileFrame,
} from '../../../../scripts/world/projection-spike-lib.mjs';

const EARTH_RADIUS = 6371008.8;
const APAC_ANCHOR = { lon0: 125, lat0: 27.5, standardLat: 27.5 };
const APAC_BBOX = [60, -47, 180, 61];

describe('글로벌 월드 투영 스파이크', () => {
  it.each(PROJECTION_IDS)('%s 정·역변환이 대표 지점에서 왕복한다', (id) => {
    const projection = buildProjection(id, APAC_ANCHOR, EARTH_RADIUS);
    for (const point of [
      { lon: 139.7, lat: 35.7 },
      { lon: 126.98, lat: 37.57 },
      { lon: 174.78, lat: -41.29 },
      { lon: 106.85, lat: -6.21 },
    ]) {
      const projected = projection.forward(point.lon, point.lat);
      const restored = projection.inverse(projected.x, projected.y);
      expect(restored.lon).toBeCloseTo(point.lon, 8);
      expect(restored.lat).toBeCloseTo(point.lat, 8);
    }
  });

  it('등장방형은 화면 위와 진북이 일치한다', () => {
    const projection = buildProjection('equirectangular', APAC_ANCHOR, EARTH_RADIUS);
    for (const point of sampleGrid(APAC_BBOX, 7, 7)) {
      const metrics = pointMetrics(projection, point.lon, point.lat, EARTH_RADIUS);
      expect(metrics.northDeviationDeg).toBeLessThan(1e-7);
      expect(metrics.screenNorthErrorDeg).toBeLessThan(1e-7);
    }
  });

  it('Sinusoidal은 뉴질랜드 코너에서 진북 전단 비용이 드러난다', () => {
    const projection = buildProjection('sinusoidal', APAC_ANCHOR, EARTH_RADIUS);
    const metrics = pointMetrics(projection, 174.78, -41.29, EARTH_RADIUS);
    expect(metrics.screenNorthErrorDeg).toBeGreaterThan(20);
    expect(metrics.geoAxisHorizontalShare).toBeGreaterThan(0.25);
  });

  it('256타일 청크 경계 좌표를 양쪽 청크에서 동일하게 재구성한다', () => {
    const projection = buildProjection('laea', APAC_ANCHOR, EARTH_RADIUS);
    const frame = tileFrame(projection, APAC_BBOX, 4500);
    const stats = chunkContinuityStats(frame, [[
      { lon: 60, lat: -20 },
      { lon: 125, lat: 27.5 },
      { lon: 179, lat: 58 },
    ]], 256);
    expect(stats.crossings).toBeGreaterThan(0);
    expect(stats.cracks).toBe(0);
    expect(stats.maxErrorTile).toBeLessThanOrEqual(1e-9);
  });

  it('음수와 양수 반 타일을 0에서 먼 쪽으로 반올림한다', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });
});
