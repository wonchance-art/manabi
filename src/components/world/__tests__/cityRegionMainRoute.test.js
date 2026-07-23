import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildCityScene,
  CITY_LIGHTING_TINT,
  cityLightingAlpha,
} from '../CityScene.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { loadAllCities } from '../cities/index.js';
import { CITY_TILE } from '../cities/terrain.js';

vi.mock('../QuestReview', () => ({ GBC: { cream: '#fff', ink: '#000', font: 'monospace' } }));

const ROUTE_TEXTURES = [
  'ct_main_route_paving',
  'ct_prop_route_signpost',
  'ct_prop_route_streetlight',
];
const DISCOVERY_TEXTURES = [
  'ct_prop_route_discovery_0',
  'ct_prop_route_discovery_1',
];
let CITY_MAPS;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function rgb(color) {
  if (typeof color === 'string') {
    const hex = color.startsWith('#') ? color.slice(1) : color;
    const normalized = hex.length === 3 ? [...hex].map((digit) => digit.repeat(2)).join('') : hex;
    color = Number.parseInt(normalized, 16);
  }
  return [(color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff];
}

function blendPixel(pixels, width, height, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  const source = rgb(color);
  const sourceAlpha = Math.max(0, Math.min(1, alpha));
  const destinationAlpha = pixels[offset + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    const premultiplied = source[channel] * sourceAlpha
      + pixels[offset + channel] * destinationAlpha * (1 - sourceAlpha);
    pixels[offset + channel] = outputAlpha === 0 ? 0 : Math.round(premultiplied / outputAlpha);
  }
  pixels[offset + 3] = Math.round(outputAlpha * 255);
}

function rasterize(width, height, commands) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (const command of commands) {
    if (command.shape === 'rect') {
      const [, x, y, rectWidth, rectHeight] = command.args;
      for (let py = y; py < y + rectHeight; py += 1) {
        for (let px = x; px < x + rectWidth; px += 1) {
          blendPixel(pixels, width, height, px, py, command.color, command.alpha);
        }
      }
      continue;
    }
    const [, cx, cy, radius] = command.args;
    for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py += 1) {
      for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px += 1) {
        const dx = px + 0.5 - cx;
        const dy = py + 0.5 - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          blendPixel(pixels, width, height, px, py, command.color, command.alpha);
        }
      }
    }
  }
  return pixels;
}

function tintRgb(rgbValue, tint, alpha) {
  const tintChannels = rgb(tint);
  return rgbValue.map((channel, index) => Math.round(
    tintChannels[index] * alpha + channel * (1 - alpha),
  ));
}

function perceivedLightness(rgbValue) {
  return rgbValue[0] * 0.2126 + rgbValue[1] * 0.7152 + rgbValue[2] * 0.0722;
}

function fixtureCity(withRoute, withDiscoveries = false) {
  const city = {
    id: 'main-route-render-fixture',
    cols: 4,
    rows: 1,
    CITY_TILE,
    nodes: [
      { id: 'a', tile: [0, 0] },
      { id: 'b', tile: [3, 0] },
    ],
    stations: [],
    props: [],
    buildGrid: () => new Uint8Array(4).fill(CITY_TILE.ROAD),
  };
  if (withRoute) {
    city.mainRoute = {
      id: 'render-fixture-route',
      version: 1,
      waypoints: [
        { kind: 'node', id: 'a' },
        { kind: 'node', id: 'b' },
      ],
      routing: {
        algorithm: 'cardinal-bfs-v1',
        neighborOrder: 'URDL',
        excludeExit: true,
      },
      segmentHints: [],
      branches: [],
      ...(withDiscoveries ? {
        discoveries: [{
          id: 'main-route-render-fixture-d1',
          leg: ['a', 'b'],
          at: 0.5,
          line: '길 위에서 작은 반짝임을 발견해요.',
        }],
      } : {}),
      segments: [{
        id: 'node:a--node:b',
        from: { kind: 'node', id: 'a' },
        to: { kind: 'node', id: 'b' },
        stepsRle: [{ direction: 'R', count: 3 }],
        stepCount: 3,
        tileCount: 4,
        pathSha256: '0'.repeat(64),
      }],
    };
  }
  return city;
}

function bakeHarness(city) {
  const textures = new Map();

  class FakeGraphics {
    constructor() {
      this.color = 0;
      this.alpha = 1;
      this.commands = [];
    }

    fillStyle(color, alpha = 1) {
      this.color = color;
      this.alpha = alpha;
      return this;
    }

    fillRect(...args) {
      this.commands.push({ shape: 'rect', args: ['fillRect', ...args], color: this.color, alpha: this.alpha });
      return this;
    }

    fillCircle(...args) {
      this.commands.push({ shape: 'circle', args: ['fillCircle', ...args], color: this.color, alpha: this.alpha });
      return this;
    }

    generateTexture(key, width, height) {
      const pixels = rasterize(width, height, this.commands);
      textures.set(key, {
        width,
        height,
        commands: structuredClone(this.commands),
        pixels,
        rgbaSha256: sha256(pixels),
      });
    }

    destroy() {}
  }

  class FakeScene {
    constructor() {
      this.textures = { exists: (key) => textures.has(key) };
      this.make = { graphics: () => new FakeGraphics() };
    }
  }

  const Scene = buildCityScene(
    { Scene: FakeScene },
    city,
    { avatarRef: { current: null } },
  );
  const scene = new Scene();
  scene.preload();
  return { scene, textures };
}

function bakeChunkRgba(city) {
  const { scene, textures } = bakeHarness(city);
  const width = 512;
  const height = 512;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const draws = [];
  const renderTexture = {
    setOrigin() { return this; },
    setDepth() { return this; },
    setRoundPixels() { return this; },
    beginDraw() {},
    batchDraw(stamp, x, y) {
      const texture = textures.get(stamp.texture);
      draws.push({ key: stamp.texture, x, y });
      for (let ty = 0; ty < texture.height; ty += 1) {
        for (let tx = 0; tx < texture.width; tx += 1) {
          const sourceOffset = (ty * texture.width + tx) * 4;
          const alpha = texture.pixels[sourceOffset + 3] / 255;
          const color = (texture.pixels[sourceOffset] << 16)
            | (texture.pixels[sourceOffset + 1] << 8)
            | texture.pixels[sourceOffset + 2];
          blendPixel(pixels, width, height, x + tx, y + ty, color, alpha);
        }
      }
    },
    endDraw() {},
  };
  scene.grid = city.buildGrid();
  scene.mainRoute = resolveCityMainRoute(city, scene.grid);
  scene.chunkStamp = {
    texture: null,
    setTexture(texture) { this.texture = texture; return this; },
  };
  scene.add = { renderTexture: () => renderTexture };
  scene.bakeChunk(0, 0);
  const sampleOffset = (3 * width + 8) * 4;
  return {
    draws,
    rgbaSha256: sha256(pixels),
    sampleRgb: Array.from(pixels.slice(sampleOffset, sampleOffset + 3)),
  };
}

describe('CityScene mainRoute 소비 경계', () => {
  beforeAll(async () => {
    CITY_MAPS = await loadAllCities();
  }, 60000);

  it('레지스트리 26도시 중 리옹·보르도·스트라스부르·도쿄 4도시가 mainRoute를 정의하고 나머지 22도시를 비활성 유지한다', () => {
    expect(CITY_MAPS).toHaveLength(26);
    expect(CITY_MAPS.filter((city) => city.mainRoute).map(({ id }) => id)).toEqual(['tokyo', 'lyon', 'bordeaux', 'strasbourg']);
    expect(CITY_MAPS.filter((city) => city.mainRoute == null)).toHaveLength(22);
  });

  it('미정의 도시에는 route texture를 0개 굽고 기존 texture RGBA를 그대로 둔다', () => {
    const base = bakeHarness(fixtureCity(false)).textures;
    const routed = bakeHarness(fixtureCity(true)).textures;

    for (const key of ROUTE_TEXTURES) expect(base.has(key)).toBe(false);
    expect(ROUTE_TEXTURES.every((key) => routed.has(key))).toBe(true);
    for (const [key, texture] of base) {
      expect(routed.get(key)).toEqual(texture);
    }
  });

  it('웜 그레이 포장과 무문자 이정표·가로등을 확정 키·도트 규격으로 굽는다', () => {
    const textures = bakeHarness(fixtureCity(true)).textures;
    const paving = textures.get('ct_main_route_paving');
    const signpost = textures.get('ct_prop_route_signpost');
    const streetlight = textures.get('ct_prop_route_streetlight');

    expect(paving).toMatchObject({ width: 16, height: 16 });
    expect([...new Set(paving.commands.map(({ color }) => color))]).toEqual([
      0x817766,
      0x5f594f,
      0xa09682,
    ]);
    expect([...new Set(paving.commands.map(({ alpha }) => alpha))]).toEqual([
      0.76,
      0.42,
    ]);
    expect(signpost).toMatchObject({ width: 16, height: 32 });
    expect(streetlight).toMatchObject({ width: 16, height: 32 });
    expect(new Set(signpost.commands.map(({ color }) => color)).size).toBe(3);
    expect(new Set(streetlight.commands.map(({ color }) => color)).size).toBe(3);
  });

  it('도시 시간대 조명 틴트 아래에서도 포장이 ROAD보다 밝게 남는다', () => {
    const base = bakeChunkRgba(fixtureCity(false)).sampleRgb;
    const paving = bakeChunkRgba(fixtureCity(true)).sampleRgb;

    expect(CITY_LIGHTING_TINT).toBe(0x18254a);
    expect([
      cityLightingAlpha('morning'),
      cityLightingAlpha('dawn'),
      cityLightingAlpha('evening'),
      cityLightingAlpha('night'),
      cityLightingAlpha('late-night'),
    ]).toEqual([0, 0.1, 0.1, 0.24, 0.24]);

    for (const phase of ['evening', 'night', 'late-night']) {
      const alpha = cityLightingAlpha(phase);
      const baseLit = tintRgb(base, CITY_LIGHTING_TINT, alpha);
      const pavingLit = tintRgb(paving, CITY_LIGHTING_TINT, alpha);
      expect(perceivedLightness(pavingLit) - perceivedLightness(baseLit)).toBeGreaterThanOrEqual(20);
    }
  });

  it('discovery가 있을 때만 무문자 2프레임 스파클을 굽는다', () => {
    const undefinedCity = bakeHarness(fixtureCity(false)).textures;
    const routeOnly = bakeHarness(fixtureCity(true)).textures;
    const discoveredRoute = bakeHarness(fixtureCity(true, true)).textures;

    for (const key of DISCOVERY_TEXTURES) {
      expect(undefinedCity.has(key)).toBe(false);
      expect(routeOnly.has(key)).toBe(false);
      expect(discoveredRoute.get(key)).toMatchObject({ width: 16, height: 16 });
    }
    expect(discoveredRoute.get('ct_prop_route_discovery_0').commands)
      .not.toEqual(discoveredRoute.get('ct_prop_route_discovery_1').commands);
  });

  it('원본 terrain→route overlay 순서와 2회 청크 RGBA SHA를 고정한다', () => {
    const baseFirst = bakeChunkRgba(fixtureCity(false));
    const baseSecond = bakeChunkRgba(fixtureCity(false));
    const routeFirst = bakeChunkRgba(fixtureCity(true));
    const routeSecond = bakeChunkRgba(fixtureCity(true));

    expect(baseFirst).toEqual(baseSecond);
    expect(routeFirst).toEqual(routeSecond);
    expect(baseFirst.draws).toHaveLength(4);
    expect(routeFirst.draws).toHaveLength(8);
    expect(routeFirst.draws.map(({ key }) => key)).toEqual([
      'ct_road_h', 'ct_main_route_paving',
      'ct_road_h', 'ct_main_route_paving',
      'ct_road_h', 'ct_main_route_paving',
      'ct_road_h', 'ct_main_route_paving',
    ]);
    expect([baseFirst.rgbaSha256, routeFirst.rgbaSha256]).toEqual([
      'c5e96ff8e4cc44639058cec120a0d1e1cba936f66e42186363f708e3381681a3',
      'c0e62a01c69ccd17992c09ec72efa4e4b2b2ff6060fe0b166d32c6f7d48366d7',
    ]);
    expect(baseFirst.rgbaSha256).not.toBe(routeFirst.rgbaSha256);
  });
});
