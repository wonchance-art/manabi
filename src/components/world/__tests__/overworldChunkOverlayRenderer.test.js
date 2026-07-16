import { describe, expect, it, vi } from 'vitest';
import {
  PhaserOverworldChunkOverlayRenderer,
  overworldDashedLineSegments,
} from '../overworldChunkOverlayRenderer.js';

const SOURCE = Object.freeze({
  regionId: 'test-terrain-v1',
  regionHash: 'aa'.repeat(32),
  projectionManifestHash: 'bb'.repeat(32),
  width: 512,
  height: 256,
  kind: 'river-segments',
  pathPrefix: 'rivers',
});

function graphics() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

describe('PhaserOverworldChunkOverlayRenderer', () => {
  it('중립 분쟁선을 고정 길이 점선 조각으로 나눈다', () => {
    expect(overworldDashedLineSegments([0, 0], [10, 0], 3, 2)).toEqual([
      [[0, 0], [3, 0]],
      [[5, 0], [8, 0]],
    ]);
  });

  it('한 청크가 실패해도 성공한 청크로 레이어를 갱신한다', async () => {
    const layerGraphics = graphics();
    const renderer = new PhaserOverworldChunkOverlayRenderer({
      add: { graphics: () => layerGraphics },
    }, { sources: [SOURCE] });
    const loaded = { segments: [] };
    renderer.layers[0].loader.load = vi.fn(async (cx) => {
      if (cx === 0) throw new Error('temporary chunk failure');
      return loaded;
    });
    renderer.drawLayer = vi.fn();

    await expect(renderer.updateCamera({
      x: 255 * 32,
      y: 0,
      width: 64,
      height: 288,
    })).resolves.toBeDefined();

    expect(renderer.layers[0].loader.load).toHaveBeenCalledTimes(2);
    expect(renderer.drawLayer).toHaveBeenCalledWith(
      renderer.layers[0],
      [loaded],
      expect.any(Object),
    );
    renderer.destroy();
  });
});
