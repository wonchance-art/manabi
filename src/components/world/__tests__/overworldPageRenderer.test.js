import { describe, expect, it, vi } from 'vitest';
import {
  PhaserOverworldPageRenderer,
  cameraWorldViewToRenderView,
  createLegacyOverworldChunkLoader,
} from '../overworldPageRenderer.js';

function fakeScene() {
  const renderTextures = [];
  const stamp = {
    key: null,
    destroyed: false,
    setOrigin: vi.fn(function setOrigin() { return this; }),
    setTexture: vi.fn(function setTexture(key) { this.key = key; return this; }),
    destroy: vi.fn(function destroy() { this.destroyed = true; }),
  };
  const scene = {
    make: {
      image: vi.fn(({ key }) => {
        stamp.key = key;
        return stamp;
      }),
    },
    add: {
      renderTexture: vi.fn((x, y, width, height) => {
        const texture = {
          x,
          y,
          width,
          height,
          visible: true,
          destroyed: false,
          draws: [],
          setOrigin: vi.fn(function setOrigin() { return this; }),
          setScale: vi.fn(function setScale(scale) { this.scale = scale; return this; }),
          setDepth: vi.fn(function setDepth(depth) { this.depth = depth; return this; }),
          setVisible: vi.fn(function setVisible(visible) { this.visible = visible; return this; }),
          beginDraw: vi.fn(),
          batchDraw: vi.fn(function batchDraw(image, drawX, drawY) {
            this.draws.push({ key: image.key, x: drawX, y: drawY });
          }),
          endDraw: vi.fn(),
          destroy: vi.fn(function destroy() { this.destroyed = true; }),
        };
        renderTextures.push(texture);
        return texture;
      }),
    },
  };
  return { scene, stamp, renderTextures };
}

describe('legacy 오버월드 저장 청크 adapter', () => {
  it('전역 격자를 256 청크 로컬 좌표로 노출하고 범위 밖은 fail-closed 처리한다', async () => {
    const loader = createLegacyOverworldChunkLoader({
      width: 300,
      height: 270,
      surfaceAt: (x, y) => (x + y) % 9,
      collisionAt: (x, y) => x === y,
      viewOnlyAt: (x, y) => x === 299 && y === 269,
    });
    const chunk = await loader.load(1, 1);
    expect(chunk.header).toMatchObject({
      cx: 1,
      cy: 1,
      validBounds: { x0: 0, y0: 0, x1: 44, y1: 14 },
      legacy: true,
    });
    expect(chunk.isValidAt(43, 13)).toBe(true);
    expect(chunk.surfaceAt(43, 13)).toBe((299 + 269) % 9);
    expect(chunk.viewOnlyAt(43, 13)).toBe(1);
    expect(chunk.isWalkableAt(43, 13)).toBe(false);
    expect(chunk.isValidAt(44, 13)).toBe(false);
    expect(chunk.collisionAt(44, 13)).toBe(1);
    expect(chunk.viewOnlyAt(44, 13)).toBe(1);
    expect(await loader.load(1, 1)).toBe(chunk);
  });
});

describe('Phaser 오버월드 렌더 페이지 adapter', () => {
  it('월드 카메라를 16px 원본 좌표로 환산한다', () => {
    expect(cameraWorldViewToRenderView({ x: 1024, y: 512, width: 320, height: 288 }, 2))
      .toEqual({ x: 512, y: 256, width: 160, height: 144 });
  });

  it('32×32 타일을 512×512 RenderTexture에 굽고 페이지 경계에서 원자 교체한다', async () => {
    const { scene, stamp, renderTextures } = fakeScene();
    const loader = createLegacyOverworldChunkLoader({
      width: 96,
      height: 64,
      surfaceAt: (x, y) => (x + y) % 4,
    });
    const renderer = new PhaserOverworldPageRenderer(scene, {
      loader,
      textureKeyAt: ({ globalX, globalY, valid }) => (valid ? `tile-${globalX}-${globalY}` : 'sea'),
      fallbackTextureKey: 'sea',
      tilePixels: 16,
      worldScale: 2,
      depth: 0,
      maxPages: 4,
      maxBytes: 4 * 1024 * 1024,
    });

    await renderer.updateCamera({ worldView: { x: 0, y: 0, width: 320, height: 288 } }, {
      padding: 0,
      prefetch: 0,
    });
    expect(renderTextures).toHaveLength(1);
    expect(renderTextures[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 512,
      height: 512,
      scale: 2,
      depth: 0,
      visible: true,
    });
    expect(renderTextures[0].draws).toHaveLength(32 * 32);
    expect(renderTextures[0].draws[0]).toEqual({ key: 'tile-0-0', x: 0, y: 0 });
    expect(renderTextures[0].draws.at(-1)).toEqual({ key: 'tile-31-31', x: 496, y: 496 });

    await renderer.updateCamera({ worldView: { x: 0, y: 0, width: 320, height: 288 } }, {
      padding: 0,
      prefetch: 0,
    });
    expect(renderTextures).toHaveLength(1);

    await renderer.updateCamera({ worldView: { x: 1024, y: 0, width: 320, height: 288 } }, {
      direction: { x: 1, y: 0 },
      padding: 0,
      prefetch: 0,
    });
    expect(renderTextures).toHaveLength(2);
    expect(renderTextures[1]).toMatchObject({ x: 1024, y: 0, visible: true });
    expect(renderTextures[0].visible).toBe(false);

    renderer.destroy();
    expect(renderTextures.every((texture) => texture.destroyed)).toBe(true);
    expect(stamp.destroyed).toBe(true);
  });
});
