import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';

vi.mock('../QuestReview', () => ({ GBC: { cream: '#fff' } }));

const LANDMARK_TEXTURES = {
  eiffel: [24, 32],
  pyramide: [24, 16],
  abbey_spire: [24, 32],
  parasol: [24, 20],
  gable: [24, 24],
  bigben: [24, 32],
  towerbridge: [32, 24],
  tower101: [24, 32],
  pailou: [24, 24],
  hk_clocktower: [24, 32],
  pearl_tower: [24, 32],
  gugong_roof: [32, 20],
  white_dagoba: [24, 24],
  storybridge: [32, 20],
  operahouse: [32, 20],
};

function bakeCityTextures() {
  const textures = new Map();

  class FakeGraphics {
    constructor() {
      this.colors = new Set();
      this.drawCount = 0;
    }

    fillStyle(color) {
      this.colors.add(color);
      return this;
    }

    fillRect() {
      this.drawCount += 1;
      return this;
    }

    fillCircle() {
      this.drawCount += 1;
      return this;
    }

    generateTexture(key, width, height) {
      textures.set(key, {
        width,
        height,
        colors: [...this.colors],
        drawCount: this.drawCount,
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
    { id: 'landmark-contract', cols: 1, rows: 1, CITY_TILE: {} },
    { avatarRef: { current: null } },
  );

  new Scene().preload();
  return textures;
}

describe('CityScene 렌더크래프트 R2 랜드마크 베이킹', () => {
  const textures = bakeCityTextures();

  it.each(Object.entries(LANDMARK_TEXTURES))(
    '%s kind를 ct_prop_<kind> 규격과 2~3색 도트 팔레트로 굽는다',
    (kind, [width, height]) => {
      const texture = textures.get(`ct_prop_${kind}`);
      expect(texture).toMatchObject({ width, height });
      expect(texture.drawCount).toBeGreaterThan(0);
      expect(texture.colors.length).toBeGreaterThanOrEqual(2);
      expect(texture.colors.length).toBeLessThanOrEqual(3);
    },
  );
});
