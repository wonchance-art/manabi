import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildCityScene,
  cityUsesRoadAutotile,
  ROAD_AUTOTILE_STYLE,
  ROAD_AUTOTILE_VARIANTS,
} from '../CityScene.js';
import { resolveCityDistricts } from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { loadAllCities } from '../cities/index.js';
import { CITY_TILE } from '../cities/terrain.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

const AUTOTILE_PREFIXES = [
  'ct_road_autotile',
  'ct_crosswalk_autotile',
  'ct_bridge_autotile',
  'ct_guidebook_road_autotile',
  'ct_main_route_paving_autotile',
];

let CITY_MAPS;

function fixtureCity(roadStyle = ROAD_AUTOTILE_STYLE) {
  const city = {
    id: 'road-autotile-fixture',
    cols: 3,
    rows: 3,
    entrance: { x: 0, y: 0 },
    nodes: [],
    stations: [],
    props: [],
    transit: [],
    districts: {
      version: 'district-v1',
      open: [{ id: 'open', label: 'Open', tiles: { rects: [[0, 0, 2, 2]] } }],
      locked: { style: 'guidebook', line: '준비 중이에요.' },
    },
    mainRoute: {},
    CITY_TILE,
    buildGrid: () => new Uint8Array(9).fill(CITY_TILE.SIDEWALK),
  };
  if (roadStyle != null) city.roadStyle = roadStyle;
  return city;
}

function textureHarness(city = fixtureCity()) {
  const textures = new Map();
  class FakeGraphics {
    constructor() { this.color = 0; this.alpha = 1; this.commands = []; }
    fillStyle(color, alpha = 1) { this.color = color; this.alpha = alpha; return this; }
    fillRect(...args) {
      this.commands.push({ shape: 'rect', args, color: this.color, alpha: this.alpha });
      return this;
    }
    fillCircle(...args) {
      this.commands.push({ shape: 'circle', args, color: this.color, alpha: this.alpha });
      return this;
    }
    generateTexture(key, width, height) {
      textures.set(key, { width, height, commands: structuredClone(this.commands) });
    }
    destroy() {}
  }
  class FakeScene {
    constructor() {
      this.textures = { exists: (key) => textures.has(key) };
      this.make = { graphics: () => new FakeGraphics() };
    }
  }
  const Scene = buildCityScene({ Scene: FakeScene }, city, { avatarRef: { current: null } });
  const scene = new Scene();
  scene.preload();
  scene.grid = city.buildGrid();
  scene.districts = null;
  return { scene, textures };
}

function setRoadMask(scene, mask, centerCode = CITY_TILE.ROAD, diagonals = false) {
  scene.grid.fill(CITY_TILE.SIDEWALK);
  scene.grid[4] = centerCode;
  const neighbors = [
    [1, CITY_TILE.ROAD],
    [5, CITY_TILE.CROSSWALK],
    [7, CITY_TILE.BRIDGE],
    [3, CITY_TILE.ROAD],
  ];
  for (let bit = 0; bit < neighbors.length; bit += 1) {
    if (mask & (1 << bit)) scene.grid[neighbors[bit][0]] = neighbors[bit][1];
  }
  if (diagonals) {
    for (const index of [0, 2, 6, 8]) scene.grid[index] = CITY_TILE.ROAD;
  }
}

function lockCenter(scene) {
  scene.districts = {
    cols: 3,
    rows: 3,
    open: [{ rects: [[0, 0, 0, 0]] }],
  };
}

function rectArgs(texture, color) {
  return texture.commands
    .filter((command) => command.shape === 'rect' && command.color === color)
    .map(({ args }) => args);
}

function cityRenderKeyManifest(city) {
  class FakeScene { constructor() {} }
  const Scene = buildCityScene({ Scene: FakeScene }, city, {});
  const scene = new Scene();
  scene.grid = city.buildGrid();
  scene.mainRoute = resolveCityMainRoute(city, scene.grid);
  scene.districts = resolveCityDistricts(city, scene.grid, scene.mainRoute);
  const routeTiles = new Set(
    (scene.mainRoute?.path ?? []).map(([x, y]) => y * city.cols + x),
  );
  const hash = createHash('sha256');

  for (let index = 0; index < scene.grid.length; index += 1) {
    const x = index % city.cols;
    const y = Math.floor(index / city.cols);
    const terrainKey = scene.terrainTexKey(x, y);
    const pavingKey = routeTiles.has(index) && scene.districtOpenAt(x, y)
      ? scene.mainRoutePavingTexKey(x, y)
      : '-';
    hash.update(`${terrainKey}:${pavingKey};`);
  }

  return {
    id: city.id,
    roadStyle: city.roadStyle ?? null,
    sha256: hash.digest('hex'),
  };
}

describe('CityScene road autotile opt-in', () => {
  beforeAll(async () => {
    CITY_MAPS = await loadAllCities();
  }, 60000);

  it('roadStyle 계약은 26도시 전부 autotile-v1을 사용한다', () => {
    expect(CITY_MAPS).toHaveLength(26);
    expect(CITY_MAPS.filter(cityUsesRoadAutotile).map(({ id, roadStyle }) => [id, roadStyle]))
      .toEqual(CITY_MAPS.map(({ id }) => [id, ROAD_AUTOTILE_STYLE]));
    expect(CITY_MAPS.filter((city) => city.roadStyle == null)).toHaveLength(0);

    const flagged = textureHarness();
    const legacy = textureHarness(fixtureCity(null));
    expect([...legacy.textures.keys()].filter((key) => key.includes('_autotile_'))).toEqual([]);
    for (const key of [
      'ct_road_v', 'ct_road_h', 'ct_road_x',
      'ct_crosswalk_v', 'ct_crosswalk_h', 'ct_bridge',
      'ct_guidebook_road_v', 'ct_guidebook_road_h', 'ct_guidebook_road_x',
      'ct_main_route_paving',
    ]) {
      expect(flagged.textures.get(key)).toEqual(legacy.textures.get(key));
    }
  });

  it('ROAD·CROSSWALK·BRIDGE·guidebook·mainRoute가 같은 16개 N/E/S/W 마스크를 소비한다', () => {
    const { scene, textures } = textureHarness();
    const unlockedCases = [
      [CITY_TILE.ROAD, 'ct_road_autotile'],
      [CITY_TILE.CROSSWALK, 'ct_crosswalk_autotile'],
      [CITY_TILE.BRIDGE, 'ct_bridge_autotile'],
    ];

    expect(ROAD_AUTOTILE_VARIANTS).toHaveLength(16);
    expect(ROAD_AUTOTILE_VARIANTS.reduce((counts, kind) => {
      const category = kind.split('-')[0];
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {})).toEqual({ isolated: 1, end: 4, corner: 4, straight: 2, t: 4, cross: 1 });

    for (let mask = 0; mask < 16; mask += 1) {
      for (const [centerCode, prefix] of unlockedCases) {
        setRoadMask(scene, mask, centerCode);
        scene.districts = null;
        expect(scene.roadMask(1, 1)).toBe(mask);
        expect(scene.terrainTexKey(1, 1)).toBe(`${prefix}_${mask}`);
        expect(scene.mainRoutePavingTexKey(1, 1))
          .toBe(`ct_main_route_paving_autotile_${mask}`);
      }
      setRoadMask(scene, mask);
      lockCenter(scene);
      expect(scene.terrainTexKey(1, 1)).toBe(`ct_guidebook_road_autotile_${mask}`);
    }

    for (const prefix of AUTOTILE_PREFIXES) {
      expect(Array.from({ length: 16 }, (_unused, mask) => textures.has(`${prefix}_${mask}`)))
        .toEqual(new Array(16).fill(true));
    }
  });

  it('비도로 변에만 에지를 두고 직선 5·10에만 월드 8px 위상 파선을 둔다', () => {
    const { textures } = textureHarness();
    const edgeColor = 0x777a82;
    const dashColor = 0xd9d2b0;

    expect(rectArgs(textures.get('ct_road_autotile_0'), edgeColor)).toEqual([
      [0, 0, 16, 1],
      [15, 0, 1, 16],
      [0, 15, 16, 1],
      [0, 0, 1, 16],
    ]);
    expect(rectArgs(textures.get('ct_road_autotile_3'), edgeColor)).toEqual([
      [0, 15, 16, 1],
      [0, 0, 1, 16],
    ]);
    expect(rectArgs(textures.get('ct_road_autotile_15'), edgeColor)).toEqual([]);

    const verticalDashes = rectArgs(textures.get('ct_road_autotile_5'), dashColor);
    const horizontalDashes = rectArgs(textures.get('ct_road_autotile_10'), dashColor);
    expect(verticalDashes).toEqual([
      [7, 0, 2, 2],
      [7, 4, 2, 2],
      [7, 8, 2, 2],
      [7, 12, 2, 2],
    ]);
    expect(horizontalDashes).toEqual([
      [0, 7, 2, 2],
      [4, 7, 2, 2],
      [8, 7, 2, 2],
      [12, 7, 2, 2],
    ]);
    expect(verticalDashes.map(([, y]) => y * 2)).toEqual([0, 8, 16, 24]);
    expect(horizontalDashes.map(([x]) => x * 2)).toEqual([0, 8, 16, 24]);
    for (const mask of [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15]) {
      expect(rectArgs(textures.get(`ct_road_autotile_${mask}`), dashColor)).toEqual([]);
    }
  });

  it('4방+4대각 roadLike 중심은 5계열 모두 무에지·무파선 inner 노면을 쓴다', () => {
    const { scene, textures } = textureHarness();
    const cases = [
      [CITY_TILE.ROAD, 'ct_road_autotile'],
      [CITY_TILE.CROSSWALK, 'ct_crosswalk_autotile'],
      [CITY_TILE.BRIDGE, 'ct_bridge_autotile'],
    ];

    for (const [centerCode, prefix] of cases) {
      scene.districts = null;
      setRoadMask(scene, 15, centerCode, false);
      expect(scene.roadInteriorAt(1, 1)).toBe(false);
      expect(scene.terrainTexKey(1, 1)).toBe(`${prefix}_15`);
      setRoadMask(scene, 15, centerCode, true);
      expect(scene.roadInteriorAt(1, 1)).toBe(true);
      expect(scene.terrainTexKey(1, 1)).toBe(`${prefix}_inner`);
      expect(scene.mainRoutePavingTexKey(1, 1))
        .toBe('ct_main_route_paving_autotile_inner');
    }

    setRoadMask(scene, 15, CITY_TILE.ROAD, true);
    lockCenter(scene);
    expect(scene.terrainTexKey(1, 1)).toBe('ct_guidebook_road_autotile_inner');
    for (const [prefix, edgeColor, dashColor] of [
      ['ct_road_autotile', 0x777a82, 0xd9d2b0],
      ['ct_bridge_autotile', 0x6f4a28, 0xe0c394],
      ['ct_guidebook_road_autotile', 0x6f6b65, 0xc2baa9],
      ['ct_main_route_paving_autotile', 0x4d4942, 0xd9d2b0],
    ]) {
      expect(rectArgs(textures.get(`${prefix}_inner`), edgeColor)).toEqual([]);
      expect(rectArgs(textures.get(`${prefix}_inner`), dashColor)).toEqual([]);
    }
    expect(rectArgs(textures.get('ct_crosswalk_autotile_inner'), 0xeae4d2))
      .toEqual(rectArgs(textures.get('ct_crosswalk_autotile_15'), 0xeae4d2));
  });

  it('5계열 16종+inner 렌더 명령이 2회 byte-identical이다', () => {
    const keys = AUTOTILE_PREFIXES.flatMap((prefix) => [
      ...Array.from({ length: 16 }, (_unused, mask) => `${prefix}_${mask}`),
      `${prefix}_inner`,
    ]);
    const first = textureHarness().textures;
    const second = textureHarness().textures;
    const digest = (textures) => createHash('sha256').update(JSON.stringify(
      keys.map((key) => [key, textures.get(key)]),
    )).digest('hex');

    expect(digest(first)).toBe(digest(second));
    expect({ textureCount: keys.length, sha256: digest(first) }).toMatchSnapshot();
  });

  it('26도시 전 지형·mainRoute 키 스냅샷이 autotile-v1 전면 확산을 고정한다', () => {
    const manifest = CITY_MAPS.map(cityRenderKeyManifest);

    expect(manifest.every(({ roadStyle }) => roadStyle === ROAD_AUTOTILE_STYLE)).toBe(true);
    expect(manifest).toMatchSnapshot();
  }, 60000);
});
