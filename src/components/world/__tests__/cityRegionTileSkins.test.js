import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';
import { CITY_TILE } from '../cities/terrain.js';

vi.mock('../QuestReview', () => ({ GBC: { cream: '#fff' } }));

const BUILDING_PALETTES = {
  zinc: [0x66727e, 0x7a8794, 0x525c66],
  terracotta: [0xa2573a, 0xb96a48, 0x7c422c],
  kawara: [0x4e4c50, 0x5c5a60, 0x3a383c],
  hutong: [0x625e58, 0x726d64, 0x484440],
  brick: [0x7e5648, 0x8f6352, 0x54382e],
};

function bakeCityTextures() {
  const textures = new Map();

  class FakeGraphics {
    constructor() {
      this.colors = new Set();
    }

    fillStyle(color) {
      this.colors.add(color);
      return this;
    }

    fillRect() {
      return this;
    }

    fillCircle() {
      return this;
    }

    generateTexture(key, width, height) {
      textures.set(key, { width, height, colors: [...this.colors] });
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
    { id: 'region-skin-contract', cols: 1, rows: 1, CITY_TILE: {} },
    { avatarRef: { current: null } },
  );

  new Scene().preload();
  return textures;
}

function makeTextureConsumerScene(tileCode, tileSkins = {}) {
  class FakeScene {}
  const Scene = buildCityScene(
    { Scene: FakeScene },
    {
      id: 'region-skin-consumer',
      cols: 1,
      rows: 1,
      CITY_TILE,
      tileSkins,
      buildGrid: () => [tileCode],
    },
    { avatarRef: { current: null } },
  );
  const scene = new Scene();
  scene.grid = [tileCode];
  return scene;
}

describe('CityScene 렌더크래프트 R4 지역 색감 베이킹', () => {
  const textures = bakeCityTextures();

  it('기존 건물 16마스크와 수면 3프레임을 같은 키·팔레트로 유지한다', () => {
    for (let mask = 0; mask < 16; mask += 1) {
      expect(textures.get(`ct_bldg_${mask}`)).toMatchObject({ width: 16, height: 16 });
    }
    expect(textures.get('ct_bldg_15').colors).toEqual([
      0x716d68,
      0x827d76,
      0x5a5652,
    ]);
    expect([
      textures.get('ct_water0').colors,
      textures.get('ct_water1').colors,
      textures.get('ct_water2').colors,
    ]).toEqual([
      [0x3a86b0, 0xd6f0fb],
      [0x3e93c4, 0xd6f0fb],
      [0x347ba0, 0xd6f0fb],
    ]);
  });

  it.each(Object.entries(BUILDING_PALETTES))(
    '%s 건물 스킨을 16마스크와 확정 3색 팔레트로 굽는다',
    (skin, palette) => {
      for (let mask = 0; mask < 16; mask += 1) {
        expect(textures.get(`ct_bldg_${skin}_${mask}`))
          .toMatchObject({ width: 16, height: 16 });
      }
      expect(textures.get(`ct_bldg_${skin}_15`).colors).toEqual(palette);
    },
  );

  it('emerald 수면을 확정 3프레임과 밝은 하이라이트로 굽는다', () => {
    expect([
      textures.get('ct_water_emerald0').colors,
      textures.get('ct_water_emerald1').colors,
      textures.get('ct_water_emerald2').colors,
    ]).toEqual([
      [0x2fae9e, 0xe6faf4],
      [0x35c0ae, 0xe6faf4],
      [0x2a9a8c, 0xe6faf4],
    ]);
  });

  it('청크 건물·정적 수면과 애니 수면 소비처가 도시 스킨 키를 함께 사용한다', () => {
    const buildingScene = makeTextureConsumerScene(
      CITY_TILE.BUILDING,
      { building: 'brick' },
    );
    expect(buildingScene.terrainTexKey(0, 0)).toBe('ct_bldg_brick_15');

    const waterScene = makeTextureConsumerScene(
      CITY_TILE.WATER,
      { water: 'emerald' },
    );
    expect(waterScene.terrainTexKey(0, 0)).toBe('ct_water_emerald0');

    const image = {
      texture: null,
      setOrigin() { return this; },
      setScale() { return this; },
      setDepth() { return this; },
      setVisible() { return this; },
      setPosition() { return this; },
      setTexture(texture) { this.texture = texture; return this; },
    };
    waterScene.cameras = {
      main: { worldView: { x: 0, y: 0, right: 32, bottom: 32 } },
    };
    waterScene.waterPool = [];
    waterScene.waterFrame = 2;
    waterScene.add = { image: () => image };
    waterScene.refreshWaterOverlay();

    expect(image.texture).toBe('ct_water_emerald2');
  });
});
