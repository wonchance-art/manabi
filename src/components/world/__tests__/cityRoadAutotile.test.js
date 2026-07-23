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

const LEGACY_RENDER_KEY_SHA = Object.freeze({
  fukuoka: 'dc6dd00f9a14ea06517d1e6543039c7e63e2f9b0471f2f5bb3b086b744318a9a',
  tokyo: '219f96f37ca1d6ddf27ef9e3a10e5bc48152dd68ceff801bcb8b8672ba434665',
  osaka: 'dc648e5e34bdd10f2bdce1c0a2c585a725d76533c52173e51d1552eb6ca6fe24',
  kyoto: 'b54e257ffb8fbda0e0d2ebd11ab9d02ca5118fb41a7d91766aba9fb27dc947b9',
  busan: '08abc45d06d624f7a4f65afbb2ed7458b8f13bf9d22c81eba7fb676cb193dead',
  seoul: 'ac7e9aecc6141b3ebf0e8d9f5aa466709b700952a1eb692e42ef689b1d337ea0',
  'grand-paris': '67bad1273ac21b0337458b1e76ab73bdfa103a83e8ab1da820ef05e77deb5557',
  'mont-saint-michel': '8f01e2ecb7ad5d7386f38440d4f36e61f82f3c6508253832c4a93bcd098aa4a7',
  'cote-dazur': 'dfb1e1c1390e7a806be8bc2c334d0251121bb39da52a7e69ff4d150dcbccdce7',
  brussels: '49b77760838417134ea865b3b1498b8d7e77187aa47b3ec255c25e0fa8dcf500',
  taipei: '7bee3b6c2c37a36ed0725eb9881bc2c9917c4c9b698d7d104ac813a1e9c32941',
  'hong-kong': '39323421eaa95a37ff51c249d97909c8fdc8a5aff7e5b1674db33761dd793832',
  london: '77a0e7f2fd8b40ce4e00fd1af4ad069640ec179fb28e1c16d14357fc07ca3385',
  shanghai: 'd3dd56fc1bc79c3f5bdde95400916795460d2be716dd19e5da1574ba8d0ef086',
  beijing: '82eced22ded9b36e74c8a22ff302b658b2a91b72cdd3bdbcdbc4ea5d4ce35e73',
  brisbane: 'c85f32e4a2c3a7def043f366f9547b5721b6b99776f493e3ebce6adc78d3f9cc',
  sydney: '3e9cf36b071ec600eb66f5b0c3c0bdf27aa053793b4770ef17b48f69ba9d78e7',
  canberra: '2d1443256f666df7695d3fd0d8edff0295f609f5112edde1b7d3498793293aa0',
  melbourne: 'd7f0daa7b7f7129065fb07d09faf44f9942ba9eeb240e047ab8dcaf187ea555d',
  marseille: '82a44066c3d9a85bca08bba111e1910fac3d860578fe17183ea3b8c8b402f8e4',
  kawaguchiko: '32d22ac780014abfb91a4e9f1059c97bfef300fbdd9ed7941155324013c40bb4',
  geneva: '4ab951e8352360e0e72b3dfbdc1e4426eeb6b701b077498f865d06b631a35545',
  'leman-riviera': '704f630b695cf08583ee2e4d5f130878fd24c6b61653ba921265ea4088e05d58',
  bordeaux: '9bbd35e8f138c0621472044dfc10db3e9ed0b1ac619befafe92cccbdb403807e',
  strasbourg: 'eaeefb5c2d4a52ea273473c437bfc2a9982427996ef87043fa98369be55daebc',
});

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

  it('roadStyle 계약은 lyon 단일 opt-in이고 미설정 25도시는 legacy 키를 유지한다', () => {
    expect(CITY_MAPS).toHaveLength(26);
    expect(CITY_MAPS.filter(cityUsesRoadAutotile).map(({ id, roadStyle }) => [id, roadStyle]))
      .toEqual([['lyon', ROAD_AUTOTILE_STYLE]]);
    expect(CITY_MAPS.filter((city) => city.roadStyle == null)).toHaveLength(25);

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

  it('26도시 전 지형·mainRoute 키 스냅샷에서 리옹만 갱신되고 25도시는 exact 불변이다', () => {
    const manifest = CITY_MAPS.map(cityRenderKeyManifest);
    const legacyManifest = Object.fromEntries(
      manifest.filter(({ id }) => id !== 'lyon').map(({ id, sha256 }) => [id, sha256]),
    );

    expect(legacyManifest).toEqual(LEGACY_RENDER_KEY_SHA);
    expect(manifest).toMatchSnapshot();
  }, 60000);
});
