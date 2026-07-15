import { describe, expect, it, vi } from 'vitest';
import {
  PhaserOverworldOverlayLayer,
  PhaserOverworldPageRenderer,
  cameraWorldViewToRenderView,
  createLegacyOverworldChunkLoader,
} from '../overworldPageRenderer.js';
import { createOverworldRoute } from '../../../lib/world/overworldOverlay.js';

function fakeScene() {
  const renderTextures = [];
  const images = [];
  const graphics = [];
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
      image: vi.fn((x, y, key) => {
        const image = {
          x,
          y,
          key,
          visible: true,
          destroyed: false,
          setScale: vi.fn(function setScale(scale) { this.scale = scale; return this; }),
          setDepth: vi.fn(function setDepth(depth) { this.depth = depth; return this; }),
          setPosition: vi.fn(function setPosition(px, py) { this.x = px; this.y = py; return this; }),
          setVisible: vi.fn(function setVisible(visible) { this.visible = visible; return this; }),
          destroy: vi.fn(function destroy() { this.destroyed = true; }),
        };
        images.push(image);
        return image;
      }),
      graphics: vi.fn(() => {
        const graphic = {
          commands: [],
          visible: true,
          destroyed: false,
          setDepth: vi.fn(function setDepth(depth) { this.depth = depth; return this; }),
          setVisible: vi.fn(function setVisible(visible) { this.visible = visible; return this; }),
          clear: vi.fn(function clear() { this.commands.length = 0; return this; }),
          lineStyle: vi.fn(function lineStyle(width, color, alpha) { this.commands.push(['style', width, color, alpha]); return this; }),
          beginPath: vi.fn(function beginPath() { return this; }),
          moveTo: vi.fn(function moveTo(x, y) { this.commands.push(['move', x, y]); return this; }),
          lineTo: vi.fn(function lineTo(x, y) { this.commands.push(['line', x, y]); return this; }),
          strokePath: vi.fn(function strokePath() { return this; }),
          destroy: vi.fn(function destroy() { this.destroyed = true; }),
        };
        graphics.push(graphic);
        return graphic;
      }),
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
  return { scene, stamp, renderTextures, images, graphics };
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

describe('Phaser 오버월드 오버레이·차량 adapter', () => {
  it('노선을 전역 좌표로 그리고 같은 차량 객체가 페이지·저장 청크 경계를 통과한다', () => {
    const { scene, images, graphics } = fakeScene();
    const route = createOverworldRoute({
      id: 'fixture-ferry',
      mode: 'ferry',
      points: [[255, 4], [257, 4]],
      color: 0xf4f0d0,
    });
    const layer = new PhaserOverworldOverlayLayer(scene, {
      routes: [route],
      vehicleTextureKeyAt: () => 'boat',
      tilePixels: 16,
      worldScale: 2,
      haloTiles: 0,
    });
    const view = { x: 250 * 32, y: 0, width: 20 * 32, height: 10 * 32 };
    layer.updateCamera(view);
    expect(graphics[0].commands.filter(([command]) => command === 'move' || command === 'line'))
      .toEqual([['move', 255.5 * 32, 4.5 * 32], ['line', 257.5 * 32, 4.5 * 32]]);

    layer.updateVehicles([{ id: 'run-1', routeId: route.id, progress: 0.49 }], view);
    const sprite = images[0];
    expect(layer.vehicleViews.get('run-1').position).toMatchObject({ pageX: 7, chunkX: 0 });
    layer.updateVehicles([{ id: 'run-1', routeId: route.id, progress: 0.51 }], view);
    expect(images).toHaveLength(1);
    expect(layer.vehicleViews.get('run-1').sprite).toBe(sprite);
    expect(layer.vehicleViews.get('run-1').position).toMatchObject({ pageX: 8, chunkX: 1 });

    layer.updateVehicles([{ id: 'run-1', routeId: route.id, progress: 1 }], {
      x: 0, y: 0, width: 320, height: 288,
    });
    expect(sprite.visible).toBe(false);
    expect(sprite.destroyed).toBe(false);
    layer.destroy();
    expect(sprite.destroyed).toBe(true);
    expect(graphics[0].destroyed).toBe(true);
  });
});
