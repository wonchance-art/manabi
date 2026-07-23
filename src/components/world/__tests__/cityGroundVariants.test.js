import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AMBIENT_PROP_KINDS,
  buildCityScene,
  cityGroundVariantAt,
  cityGroundVariantForDistrict,
  cityPropTextureKey,
  cityUsesGroundVariants,
  GROUND_VARIANTS,
  GROUND_VARIANT_STYLE,
} from '../CityScene.js';
import { resolveCityDistricts } from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { loadAllCities } from '../cities/index.js';
import LYON, { CITY_TILE, PROPS as LYON_PROPS } from '../cities/lyon.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

function fixtureCity(groundStyle = GROUND_VARIANT_STYLE) {
  const city = {
    id: 'ground-variant-fixture',
    cols: 3,
    rows: 3,
    entrance: { x: 0, y: 0 },
    nodes: [],
    stations: [],
    props: [],
    transit: [],
    districts: {
      version: 'district-v1',
      open: [
        { id: 'old-quarter', label: 'Old quarter', tiles: { rects: [[0, 0, 2, 2]] } },
      ],
      locked: { style: 'guidebook', line: '준비 중이에요.' },
    },
    CITY_TILE,
    buildGrid: () => new Uint8Array(9).fill(CITY_TILE.PLAZA),
  };
  if (groundStyle != null) city.groundStyle = groundStyle;
  return city;
}

function textureHarness(city = fixtureCity()) {
  const textures = new Map();

  class FakeGraphics {
    constructor() {
      this.color = 0;
      this.alpha = 1;
      this.commands = [];
      this.colors = new Set();
    }

    fillStyle(color, alpha = 1) {
      this.color = color;
      this.alpha = alpha;
      this.colors.add(color);
      return this;
    }

    fillRect(...args) {
      this.commands.push({ shape: 'rect', args, color: this.color, alpha: this.alpha });
      return this;
    }

    fillCircle(...args) {
      this.commands.push({ shape: 'circle', args, color: this.color, alpha: this.alpha });
      return this;
    }

    generateTexture(key, width, height) {
      textures.set(key, {
        width,
        height,
        colors: [...this.colors],
        commands: structuredClone(this.commands),
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
  scene.grid = city.buildGrid();
  scene.mainRoute = resolveCityMainRoute(city, scene.grid);
  scene.districts = resolveCityDistricts(city, scene.grid, scene.mainRoute);
  return { scene, textures };
}

function cityRenderKey(city) {
  class FakeScene { constructor() {} }
  const Scene = buildCityScene({ Scene: FakeScene }, city, {});
  const scene = new Scene();
  scene.grid = city.buildGrid();
  scene.mainRoute = resolveCityMainRoute(city, scene.grid);
  scene.districts = resolveCityDistricts(city, scene.grid, scene.mainRoute);
  const hash = createHash('sha256');
  for (let index = 0; index < scene.grid.length; index += 1) {
    const x = index % city.cols;
    const y = Math.floor(index / city.cols);
    hash.update(`${scene.terrainTexKey(x, y)};`);
  }
  return hash.digest('hex');
}

describe('CityScene P2 지구별 보행 지면 variant-v1', () => {
  let cities;

  beforeAll(async () => {
    cities = await loadAllCities();
  }, 60_000);

  it('리옹만 opt-in하고 기존 props 배치 3개를 그대로 유지한다', () => {
    expect(cities).toHaveLength(26);
    expect(cities.filter(cityUsesGroundVariants).map(({ id, groundStyle }) => (
      [id, groundStyle]
    ))).toEqual([['lyon', GROUND_VARIANT_STYLE]]);
    expect(LYON_PROPS).toEqual([
      { kind: 'fountain', tile: [169, 179] },
      { kind: 'stall', tile: [230, 202] },
      { kind: 'parasol', tile: [242, 121] },
    ]);
  });

  it('city.id seed와 district.id로 3종을 결정하고 리옹 PLAZA 4곳에 모두 노출한다', () => {
    const { scene } = textureHarness(LYON);
    expect(GROUND_VARIANTS).toEqual(['pave', 'gravel', 'flagstone']);
    expect(LYON.districts.open.map(({ id }) => [
      id,
      cityGroundVariantForDistrict(LYON, id),
    ])).toEqual([
      ['presquile-confluence', 'pave'],
      ['vieux-lyon-fourviere', 'gravel'],
      ['terreaux-croix-rousse', 'flagstone'],
      ['rhone-part-dieu', 'gravel'],
    ]);
    expect([
      [143, 219, scene.terrainTexKey(143, 219)],
      [181, 179, scene.terrainTexKey(181, 179)],
      [233, 206, scene.terrainTexKey(233, 206)],
      [269, 219, scene.terrainTexKey(269, 219)],
    ]).toEqual([
      [143, 219, 'ct_ground_pave'],
      [181, 179, 'ct_ground_flagstone'],
      [233, 206, 'ct_ground_gravel'],
      [269, 219, 'ct_ground_gravel'],
    ]);
    expect([
      scene.mainRoutePavingTexKey(143, 219),
      scene.mainRoutePavingTexKey(181, 179),
      scene.mainRoutePavingTexKey(233, 206),
      scene.mainRoutePavingTexKey(269, 219),
    ]).toEqual([null, null, null, null]);
    expect(cityGroundVariantAt(LYON, scene.districts, 0, 0)).toBeNull();
  });

  it('ROAD·SIDEWALK·CROSSWALK·BRIDGE와 잠금 지면 키는 opt-in 전후 동일하다', () => {
    const withVariants = textureHarness(LYON).scene;
    const withoutVariants = textureHarness({ ...LYON, groundStyle: undefined }).scene;
    for (let index = 0; index < withVariants.grid.length; index += 1) {
      if (withVariants.grid[index] === CITY_TILE.PLAZA) continue;
      const x = index % LYON.cols;
      const y = Math.floor(index / LYON.cols);
      expect(withVariants.terrainTexKey(x, y)).toBe(withoutVariants.terrainTexKey(x, y));
      expect(withVariants.mainRoutePavingTexKey(x, y))
        .toBe(withoutVariants.mainRoutePavingTexKey(x, y));
    }
  }, 60_000);

  it('지면 3종을 기존 웜 팔레트의 16px 정적 텍스처로 opt-in 베이크한다', () => {
    const first = textureHarness();
    const second = textureHarness();
    const keys = GROUND_VARIANTS.map((variant) => `ct_ground_${variant}`);
    for (const key of keys) {
      expect(first.textures.get(key)).toMatchObject({ width: 16, height: 16 });
      expect(first.textures.get(key).colors).toHaveLength(3);
    }
    const digest = (textures) => createHash('sha256').update(JSON.stringify(
      keys.map((key) => [key, textures.get(key)]),
    )).digest('hex');
    expect(digest(first.textures)).toBe(digest(second.textures));

    const legacy = textureHarness(fixtureCity(null));
    expect([...legacy.textures.keys()].filter((key) => key.startsWith('ct_ground_')))
      .toEqual([]);
  });

  it('미설정 25도시 render key SHA는 불변이고 리옹만 의도적으로 바뀐다', () => {
    const manifest = cities.map((city) => ({
      id: city.id,
      before: cityRenderKey({ ...city, groundStyle: undefined }),
      after: cityRenderKey(city),
    }));

    expect(manifest.filter(({ before, after }) => before !== after).map(({ id }) => id))
      .toEqual(['lyon']);
    expect(manifest.filter(({ before, after }) => before === after)).toHaveLength(25);
    expect(manifest).toMatchSnapshot();
  }, 120_000);
});

describe('CityScene P2 범용 props 4종', () => {
  const { scene, textures } = textureHarness();

  it('kind·tile 파이프라인용 4종과 가로등 점등 프레임을 확정 크기로 굽는다', () => {
    expect(AMBIENT_PROP_KINDS).toEqual(['streetlight', 'awning', 'fountain', 'bench']);
    expect(textures.get('ct_prop_streetlight')).toMatchObject({ width: 16, height: 32 });
    expect(textures.get('ct_prop_streetlight_lit')).toMatchObject({ width: 16, height: 32 });
    expect(textures.get('ct_prop_awning')).toMatchObject({ width: 24, height: 16 });
    expect(textures.get('ct_prop_fountain')).toMatchObject({ width: 16, height: 16 });
    expect(textures.get('ct_prop_bench')).toMatchObject({ width: 16, height: 16 });
    expect(textures.get('ct_prop_awning').colors).toEqual([0xb85d4b, 0xe6d5b4]);
    expect([...textures.keys()].filter((key) => /^ct_prop_fountain_/.test(key))).toEqual([]);
  });

  it('밤·심야에만 범용 가로등을 점등하고 다른 kind는 정적 키를 유지한다', () => {
    expect(cityPropTextureKey('streetlight', 'day')).toBe('ct_prop_streetlight');
    expect(cityPropTextureKey('streetlight', 'evening')).toBe('ct_prop_streetlight');
    expect(cityPropTextureKey('streetlight', 'night')).toBe('ct_prop_streetlight_lit');
    expect(cityPropTextureKey('streetlight', 'late-night')).toBe('ct_prop_streetlight_lit');
    for (const kind of ['awning', 'fountain', 'bench']) {
      expect(cityPropTextureKey(kind, 'night')).toBe(`ct_prop_${kind}`);
    }

    const view = { texture: null, setTexture(texture) { this.texture = texture; } };
    scene.ambientStreetlightViews = [view];
    scene.ambientStreetlightTexture = null;
    scene.refreshAmbientPropLighting('day');
    expect(view.texture).toBe('ct_prop_streetlight');
    scene.refreshAmbientPropLighting('night');
    expect(view.texture).toBe('ct_prop_streetlight_lit');
  });
});
