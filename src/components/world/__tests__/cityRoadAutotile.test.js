import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildCityScene, ROAD_AUTOTILE_VARIANTS } from '../CityScene.js';
import { resolveCityDistricts } from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { loadAllCities } from '../cities/index.js';
import { CITY_TILE } from '../cities/terrain.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

let CITY_MAPS;

function fixtureCity() {
  return {
    id: 'road-autotile-fixture',
    cols: 3,
    rows: 3,
    entrance: { x: 0, y: 0 },
    nodes: [],
    stations: [],
    transit: [],
    districts: {
      version: 'district-v1',
      open: [{ id: 'all', label: 'All', tiles: { rects: [[0, 0, 2, 2]] } }],
      locked: { style: 'guidebook', line: '준비 중' },
    },
    CITY_TILE,
    buildGrid: () => new Uint8Array(9).fill(CITY_TILE.SIDEWALK),
  };
}

function textureHarness() {
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

  const city = fixtureCity();
  const Scene = buildCityScene(
    { Scene: FakeScene },
    city,
    { avatarRef: { current: null } },
  );
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

function rectArgs(texture, color) {
  return texture.commands
    .filter((command) => command.shape === 'rect' && command.color === color)
    .map(({ args }) => args);
}

function roadTextureKeys() {
  return ['ct_road', 'ct_crosswalk', 'ct_bridge', 'ct_guidebook_road']
    .flatMap((prefix) => [
      ...Array.from({ length: 16 }, (_unused, mask) => `${prefix}_${mask}`),
      `${prefix}_inner`,
    ]);
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
  const variants = new Set();
  let roadLikeTiles = 0;
  let innerTiles = 0;
  let guidebookRoadTiles = 0;

  for (let index = 0; index < scene.grid.length; index += 1) {
    const x = index % city.cols;
    const y = Math.floor(index / city.cols);
    const terrainKey = scene.terrainTexKey(x, y);
    const pavingKey = routeTiles.has(index) && scene.districtOpenAt(x, y)
      ? 'ct_main_route_paving'
      : '-';
    const match = terrainKey.match(/^ct_(?:road|crosswalk|bridge|guidebook_road)_(\d+|inner)$/);
    if (match) {
      roadLikeTiles += 1;
      if (match[1] === 'inner') innerTiles += 1;
      else variants.add(Number(match[1]));
      if (terrainKey.startsWith('ct_guidebook_road_')) guidebookRoadTiles += 1;
    }
    hash.update(`${terrainKey}:${pavingKey};`);
  }

  return {
    id: city.id,
    roadLikeTiles,
    variants: [...variants].sort((left, right) => left - right),
    innerTiles,
    guidebookRoadTiles,
    sha256: hash.digest('hex'),
  };
}

describe('CityScene roadLike 4방 오토타일', () => {
  beforeAll(async () => {
    CITY_MAPS = await loadAllCities();
  }, 60000);

  it('고립1·끝단4·직선2·코너4·T4·십자1의 16개 마스크를 4계열이 공유한다', () => {
    const { scene, textures } = textureHarness();
    const unlockedCases = [
      [CITY_TILE.ROAD, 'ct_road'],
      [CITY_TILE.CROSSWALK, 'ct_crosswalk'],
      [CITY_TILE.BRIDGE, 'ct_bridge'],
    ];

    expect(ROAD_AUTOTILE_VARIANTS).toEqual([
      'isolated',
      'end-n', 'end-e', 'corner-ne', 'end-s', 'straight-ns', 'corner-es', 't-nes',
      'end-w', 'corner-nw', 'straight-ew', 't-new', 'corner-sw', 't-nsw', 't-esw',
      'cross',
    ]);

    for (let mask = 0; mask < ROAD_AUTOTILE_VARIANTS.length; mask += 1) {
      for (const [centerCode, prefix] of unlockedCases) {
        setRoadMask(scene, mask, centerCode);
        scene.districts = null;
        expect(scene.roadMask(1, 1)).toBe(mask);
        expect(scene.terrainTexKey(1, 1)).toBe(`${prefix}_${mask}`);
      }
      setRoadMask(scene, mask, CITY_TILE.ROAD);
      scene.districts = { cols: 3, rows: 3, open: [{ rects: [[0, 0, 0, 0]] }] };
      expect(scene.terrainTexKey(1, 1)).toBe(`ct_guidebook_road_${mask}`);
    }

    for (const key of roadTextureKeys()) expect(textures.has(key)).toBe(true);
  });

  it('모든 계열은 비도로 변만 에지로 남기고 직선에만 월드 8px 위상 파선을 둔다', () => {
    const { textures } = textureHarness();
    const disconnectedEdges = [
      [0, 15, 16, 1],
      [0, 0, 1, 16],
    ];
    const edgeCases = [
      ['ct_road', 0x777a82],
      ['ct_crosswalk', 0x777a82],
      ['ct_bridge', 0x6f4a28],
      ['ct_guidebook_road', 0x6f6b65],
    ];

    expect(rectArgs(textures.get('ct_road_0'), 0x777a82)).toEqual([
      [0, 0, 16, 1],
      [15, 0, 1, 16],
      [0, 15, 16, 1],
      [0, 0, 1, 16],
    ]);
    for (const [prefix, edgeColor] of edgeCases) {
      expect(rectArgs(textures.get(`${prefix}_3`), edgeColor)).toEqual(disconnectedEdges);
      expect(rectArgs(textures.get(`${prefix}_15`), edgeColor)).toEqual([]);
    }

    const straightDashes = [
      ['ct_road', 0xd9d2b0],
      ['ct_bridge', 0xe0c394],
      ['ct_guidebook_road', 0xc2baa9],
    ];
    for (const [prefix, dashColor] of straightDashes) {
      expect(rectArgs(textures.get(`${prefix}_5`), dashColor)).toEqual([
        [7, 0, 2, 2], [7, 4, 2, 2], [7, 8, 2, 2], [7, 12, 2, 2],
      ]);
      expect(rectArgs(textures.get(`${prefix}_10`), dashColor)).toEqual([
        [0, 7, 2, 2], [4, 7, 2, 2], [8, 7, 2, 2], [12, 7, 2, 2],
      ]);
      for (const mask of [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15]) {
        expect(rectArgs(textures.get(`${prefix}_${mask}`), dashColor)).toEqual([]);
      }
    }
  });

  it('4방+4대각 roadLike 중심은 십자와 다른 무에지·무파선 inner 노면을 쓴다', () => {
    const { scene, textures } = textureHarness();
    const cases = [
      [CITY_TILE.ROAD, 'ct_road'],
      [CITY_TILE.CROSSWALK, 'ct_crosswalk'],
      [CITY_TILE.BRIDGE, 'ct_bridge'],
    ];

    for (const [centerCode, prefix] of cases) {
      scene.districts = null;
      setRoadMask(scene, 15, centerCode, false);
      expect(scene.roadInteriorAt(1, 1)).toBe(false);
      expect(scene.terrainTexKey(1, 1)).toBe(`${prefix}_15`);
      setRoadMask(scene, 15, centerCode, true);
      expect(scene.roadInteriorAt(1, 1)).toBe(true);
      expect(scene.terrainTexKey(1, 1)).toBe(`${prefix}_inner`);
    }

    setRoadMask(scene, 15, CITY_TILE.ROAD, true);
    scene.districts = { cols: 3, rows: 3, open: [{ rects: [[0, 0, 0, 0]] }] };
    expect(scene.terrainTexKey(1, 1)).toBe('ct_guidebook_road_inner');
    expect(textures.get('ct_road_inner').commands)
      .not.toEqual(textures.get('ct_road_15').commands);
    expect(rectArgs(textures.get('ct_road_inner'), 0x777a82)).toEqual([]);
    expect(rectArgs(textures.get('ct_road_inner'), 0xd9d2b0)).toEqual([]);
  });

  it('4계열 16종+inner 렌더 명령이 독립 2회 byte-identical이다', () => {
    const keys = roadTextureKeys();
    const first = textureHarness().textures;
    const second = textureHarness().textures;
    const digest = (textures) => createHash('sha256').update(JSON.stringify(
      keys.map((key) => [key, textures.get(key)]),
    )).digest('hex');

    expect(digest(first)).toBe(digest(second));
    expect({ textureCount: keys.length, sha256: digest(first) }).toMatchInlineSnapshot(`
      {
        "sha256": "5025c3cb2a97534b5c65d527c3e2fc161d2b864669e845b1c4ad38446f3a2ebe",
        "textureCount": 68,
      }
    `);
  });

  it('26도시 전 지형·mainRoute 렌더 키 manifest를 고정한다', () => {
    expect(CITY_MAPS.map(cityRenderKeyManifest)).toMatchSnapshot();
  }, 60000);
});
