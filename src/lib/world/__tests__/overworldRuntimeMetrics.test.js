import { describe, expect, it } from 'vitest';
import {
  OVERWORLD_RUNTIME_TARGET_BYTES,
  collectOverworldRuntimeMetrics,
} from '../overworldRuntimeMetrics.js';

describe('오버월드 런타임 계측', () => {
  it('렌더 페이지·packed 청크만 32 MiB 예산에 합산하고 heap은 별도 기록한다', () => {
    const metrics = collectOverworldRuntimeMetrics({
      loader: {
        generation: 3,
        cacheSize: 2,
        cacheBytes: 4200,
        pendingCount: 1,
      },
      pager: {
        size: 7,
        byteLength: 7 * 1024 * 1024,
        visible: ['1,2', '2,2'],
        pendingCount: 2,
        maxPages: 20,
        maxBytes: 20 * 1024 * 1024,
      },
      heapUsedBytes: 91_234_567.9,
      committedUpdates: 5,
      blankFrameCount: 0,
    });

    expect(metrics).toMatchObject({
      generation: 3,
      renderPages: 7,
      visiblePages: 2,
      packedChunks: 2,
      packedChunkBytes: 4200,
      pendingPages: 2,
      pendingChunks: 1,
      runtimeBytes: 7 * 1024 * 1024 + 4200,
      estimatedGpuTextureBytes: 7 * 1024 * 1024,
      heapUsedBytes: 91_234_567,
      committedUpdates: 5,
      blankFrameCount: 0,
    });
    expect(metrics.limits.runtimeBytes).toBe(OVERWORLD_RUNTIME_TARGET_BYTES);
    expect(metrics.visiblePageKeys).toEqual(['1,2', '2,2']);
  });
});
