import { describe, expect, it } from 'vitest';
import {
  OVERWORLD_ROUTE_QUANTIZATION,
  createOverworldRoute,
  overworldRoutePosition,
  planOverworldOverlaySegments,
} from '../overworldOverlay.js';

describe('오버월드 희소 노선 계약', () => {
  it('좌표를 타일 1/1024 정수로 양자화하고 입력 순서와 무관하게 구간을 정렬한다', () => {
    const beta = createOverworldRoute({ id: 'beta', points: [[31.25, 4], [33.75, 4]] });
    const alpha = createOverworldRoute({ id: 'alpha', points: [[31, 3], [33, 3]] });
    expect(beta.pointsQ[0]).toEqual([31.25 * OVERWORLD_ROUTE_QUANTIZATION, 4 * OVERWORLD_ROUTE_QUANTIZATION]);
    const planned = planOverworldOverlaySegments({ x: 31 * 16, y: 0, width: 32, height: 128 }, [beta, alpha], {
      tilePixels: 16,
      haloTiles: 0,
    });
    expect(planned.map((segment) => segment.key)).toEqual(['alpha:0', 'beta:0']);
  });

  it('페이지 경계 양쪽이 같은 전역 양자화 endpoint를 소비한다', () => {
    const route = createOverworldRoute({ id: 'seam', points: [[31, 8], [33, 8]] });
    const left = planOverworldOverlaySegments({ x: 0, y: 0, width: 32 * 16, height: 16 * 16 }, [route], {
      tilePixels: 16,
      haloTiles: 0,
    });
    const right = planOverworldOverlaySegments({ x: 32 * 16, y: 0, width: 32 * 16, height: 16 * 16 }, [route], {
      tilePixels: 16,
      haloTiles: 0,
    });
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
    expect(left[0].start).toBe(right[0].start);
    expect(left[0].end).toBe(right[0].end);
  });

  it('차량 위치가 32 페이지와 256 저장 청크 경계를 점프 없이 지난다', () => {
    const route = createOverworldRoute({ id: 'boundary', points: [[255, 12], [257, 12]] });
    const before = overworldRoutePosition(route, 0.49);
    const after = overworldRoutePosition(route, 0.51);
    expect(before).toMatchObject({ pageX: 7, chunkX: 0 });
    expect(after).toMatchObject({ pageX: 8, chunkX: 1 });
    expect(after.tileX - before.tileX).toBeCloseTo(0.04, 10);
    expect(before.tileY).toBe(after.tileY);
  });

  it('다중 구간을 거리 비율로 보간하고 양 끝을 정확히 고정한다', () => {
    const route = createOverworldRoute({ id: 'bent', points: [[0, 0], [3, 0], [3, 4]] });
    expect(overworldRoutePosition(route, 0)).toMatchObject({ tileX: 0, tileY: 0, segmentIndex: 0 });
    expect(overworldRoutePosition(route, 3 / 7)).toMatchObject({ tileX: 3, tileY: 0, segmentIndex: 0 });
    expect(overworldRoutePosition(route, 5 / 7)).toMatchObject({ tileX: 3, tileY: 2, segmentIndex: 1 });
    expect(overworldRoutePosition(route, 1)).toMatchObject({ tileX: 3, tileY: 4, segmentIndex: 1 });
  });
});
