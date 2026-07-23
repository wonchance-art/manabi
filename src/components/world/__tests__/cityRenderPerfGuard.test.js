import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';
import {
  chunkDims,
  chunkTileBounds,
} from '../cityChunks.js';
import {
  cityDistrictOpenAt,
  resolveCityDistricts,
} from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import {
  CITY_MINI_SCALE,
  cityMinimapLayout,
  downsampleCityGrid,
} from '../cityMinimap.js';
import { loadCity } from '../cities/index.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

const SAMPLE_CHUNKS = 128;
const TILE = 32;
const BASELINE_HEAD = '9d19d75fce0d476f350bf092d8410541bc499495';

// origin/main 실측 × 1.5를 올림한 결정적 호출/할당 상한이다.
// P9는 normal/locked tileCode probe를 124,145/112,349로 낮추므로 병합 뒤 여유가 커진다.
const LIMITS = Object.freeze({
  normal: Object.freeze({
    bakeChunkCalls: 192,
    tileCodeProbes: 260_708,
    batchDrawCalls: 49_896,
  }),
  locked: Object.freeze({
    bakeChunkCalls: 192,
    tileCodeProbes: 241_652,
    batchDrawCalls: 48_072,
  }),
  minimap: Object.freeze({
    gridBuildCalls: 2,
    layoutCalls: 2,
    downsampleCalls: 2,
    downsampleGridReads: 1_342_296,
    offscreenCanvasAllocations: 3,
    imageDataAllocations: 2,
    putImageDataCalls: 2,
    lockResolveCalls: 2,
    lockOpenProbes: 335_574,
    lockFillRectCalls: 240_660,
    initialDrawImageCalls: 3,
    intervalAllocations: 2,
  }),
});

let tokyo;

function uniformSample(items, count) {
  if (items.length <= count) return [...items];
  return Array.from(
    { length: count },
    (_unused, index) => items[Math.floor(index * (items.length - 1) / (count - 1))],
  );
}

function makeScene(city) {
  class FakeScene { constructor() {} }
  const Scene = buildCityScene({ Scene: FakeScene }, city, {});
  const scene = new Scene();
  scene.grid = city.buildGrid();
  scene.mainRoute = resolveCityMainRoute(city, scene.grid);
  scene.districts = resolveCityDistricts(city, scene.grid, scene.mainRoute);
  return scene;
}

function allChunks(city) {
  const { chunkCols, chunkRows } = chunkDims(city.cols, city.rows);
  return Array.from({ length: chunkCols * chunkRows }, (_unused, index) => ({
    cx: index % chunkCols,
    cy: Math.floor(index / chunkCols),
  }));
}

function chunkIsFullyLocked(scene, city, { cx, cy }) {
  const bounds = chunkTileBounds(cx, cy, city.cols, city.rows);
  for (let ty = bounds.y0; ty < bounds.y1; ty += 1) {
    for (let tx = bounds.x0; tx < bounds.x1; tx += 1) {
      if (scene.districtOpenAt(tx, ty)) return false;
    }
  }
  return true;
}

function measureSceneBake(city, lockedOnly) {
  const scene = makeScene(city);
  const metrics = {
    bakeChunkCalls: 0,
    tileCodeProbes: 0,
    batchDrawCalls: 0,
  };
  const originalTileCode = scene.tileCode.bind(scene);
  scene.tileCode = (...args) => {
    metrics.tileCodeProbes += 1;
    return originalTileCode(...args);
  };
  scene.chunkStamp = {
    setTexture() { return this; },
  };
  scene.add = {
    renderTexture() {
      return {
        setOrigin() { return this; },
        setDepth() { return this; },
        setRoundPixels() { return this; },
        beginDraw() {},
        batchDraw() { metrics.batchDrawCalls += 1; },
        endDraw() {},
      };
    },
  };

  const candidates = allChunks(city);
  const chunks = uniformSample(
    lockedOnly
      ? candidates.filter((chunk) => chunkIsFullyLocked(scene, city, chunk))
      : candidates,
    SAMPLE_CHUNKS,
  );
  for (const { cx, cy } of chunks) {
    metrics.bakeChunkCalls += 1;
    scene.bakeChunk(cx, cy);
  }
  return metrics;
}

function cityMinimapBranchRunner() {
  const source = readFileSync(new URL('../GameCanvas.jsx', import.meta.url), 'utf8');
  const startMarker = '    if (city) {\n';
  const endMarker = '\n    // ── 전국 미니맵';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('GameCanvas city minimap branch not found');
  const body = source.slice(start + startMarker.length, end).replace(/\n    }\s*$/, '');
  return vm.runInNewContext(`(function (
    city,
    sceneRef,
    canvasRef,
    showDistricts,
    cityMinimapLayoutForCity,
    downsampleCityGrid,
    resolveCityDistricts,
    cityDistrictOpenAt,
    CITY_MINI_COLORS,
    CITY_MINI_SCALE,
    TILE,
    document,
    setInterval,
    clearInterval
  ) {${body}
  })`);
}

function countingGrid(grid, metrics) {
  return new Proxy(grid, {
    get(target, property) {
      if (typeof property === 'string' && /^\d+$/.test(property)) metrics.gridReads += 1;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function canvasContext(metrics, kind) {
  return {
    createImageData(width, height) {
      metrics.imageDataAllocations += 1;
      return { data: new Uint8ClampedArray(width * height * 4) };
    },
    putImageData() { metrics.putImageDataCalls += 1; },
    fillRect() {
      if (kind === 'lock') metrics.lockFillRectCalls += 1;
    },
    drawImage() {
      if (kind === 'visible') metrics.initialDrawImageCalls += 1;
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    measureText() { return { width: 0 }; },
    fillText() {},
  };
}

function measureMinimapBake(city) {
  const metrics = {
    gridReads: 0,
    downsampleGridReads: 0,
    offscreenCanvasAllocations: 0,
    imageDataAllocations: 0,
    putImageDataCalls: 0,
    lockFillRectCalls: 0,
    initialDrawImageCalls: 0,
  };
  const gridBuild = vi.fn(() => countingGrid(city.buildGrid(), metrics));
  const measuredCity = { ...city, buildGrid: gridBuild };
  const layout = vi.fn((cityId, cols, rows) => {
    const defaultLayout = cityMinimapLayout(cols, rows);
    const factorFloor = cityId === 'tokyo' ? 2 : cityId === 'cote-dazur' ? 3 : 1;
    const factor = Math.max(defaultLayout.factor, factorFloor);
    if (factor === defaultLayout.factor) return defaultLayout;
    const sourceWidth = Math.ceil(cols / factor);
    const sourceHeight = Math.ceil(rows / factor);
    const width = sourceWidth * CITY_MINI_SCALE;
    const height = sourceHeight * CITY_MINI_SCALE;
    return {
      factor,
      sourceWidth,
      sourceHeight,
      width,
      height,
      backingBytes: width * height * 4,
    };
  });
  const downsample = vi.fn((...args) => {
    const before = metrics.gridReads;
    const result = downsampleCityGrid(...args);
    metrics.downsampleGridReads += metrics.gridReads - before;
    return result;
  });
  const resolveLocks = vi.fn((...args) => resolveCityDistricts(...args));
  const lockOpen = vi.fn((...args) => cityDistrictOpenAt(...args));
  const offscreen = [];
  const document = {
    createElement: vi.fn(() => {
      const kind = offscreen.length === 0 ? 'terrain' : 'lock';
      const canvas = { getContext: () => canvasContext(metrics, kind) };
      offscreen.push(canvas);
      metrics.offscreenCanvasAllocations += 1;
      return canvas;
    }),
  };
  const visibleCanvas = { getContext: () => canvasContext(metrics, 'visible') };
  const schedule = vi.fn(() => 1);
  const cancel = vi.fn();
  const colors = new Proxy({}, { get: () => [0, 0, 0] });

  const cleanup = cityMinimapBranchRunner()(
    measuredCity,
    { current: { districts: null } },
    { current: visibleCanvas },
    true,
    layout,
    downsample,
    resolveLocks,
    lockOpen,
    colors,
    CITY_MINI_SCALE,
    TILE,
    document,
    schedule,
    cancel,
  );

  return {
    gridBuildCalls: gridBuild.mock.calls.length,
    layoutCalls: layout.mock.calls.length,
    downsampleCalls: downsample.mock.calls.length,
    downsampleGridReads: metrics.downsampleGridReads,
    offscreenCanvasAllocations: metrics.offscreenCanvasAllocations,
    imageDataAllocations: metrics.imageDataAllocations,
    putImageDataCalls: metrics.putImageDataCalls,
    lockResolveCalls: resolveLocks.mock.calls.length,
    lockOpenProbes: lockOpen.mock.calls.length,
    lockFillRectCalls: metrics.lockFillRectCalls,
    initialDrawImageCalls: metrics.initialDrawImageCalls,
    intervalAllocations: schedule.mock.calls.length,
    cleanup: typeof cleanup,
  };
}

function expectWithinLimits(metrics, limits) {
  for (const [name, limit] of Object.entries(limits)) {
    expect(
      metrics[name],
      `${name} must stay <= ${limit} (baseline ${BASELINE_HEAD})`,
    ).toBeLessThanOrEqual(limit);
  }
}

describe('P10 렌더 성능 결정 지표 가드', () => {
  beforeAll(async () => {
    tokyo = await loadCity('tokyo');
  }, 60_000);

  it('도쿄 128청크 scene·완전 잠금 bake의 probe/draw 수가 main 실측 1.5배 안이다', () => {
    const normal = measureSceneBake(tokyo, false);
    const locked = measureSceneBake(tokyo, true);

    expectWithinLimits(normal, LIMITS.normal);
    expectWithinLimits(locked, LIMITS.locked);
  }, 60_000);

  it('도쿄 미니맵·잠금 오버레이가 단일 bake 호출/할당 상한을 지킨다', () => {
    const metrics = measureMinimapBake(tokyo);

    expectWithinLimits(metrics, LIMITS.minimap);
    expect(metrics.cleanup).toBe('function');
  }, 60_000);
});
