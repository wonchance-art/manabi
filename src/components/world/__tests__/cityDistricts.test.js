import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';
import {
  CITY_DISTRICT_LOCK_DURATION_MS,
  cityDistrictOpenAt,
  resolveCityDistricts,
} from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { CITY_MAPS } from '../cities/index.js';
import { LYON } from '../cities/lyon.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

const LOCK_LINE = '이 동네는 아직 준비 중이에요 — 다음 여행에서 만나요';
const GUIDEBOOK_KEYS = [
  'ct_guidebook_land',
  'ct_guidebook_water',
  'ct_guidebook_road_h',
  'ct_guidebook_road_v',
  'ct_guidebook_road_x',
  'ct_guidebook_landmark',
  'ct_guidebook_landmark_marker',
];

function districtConfig(rect = [0, 0, 3, 2]) {
  return {
    version: 'district-v1',
    open: [{ id: 'open-core', label: 'Open Core', tiles: { rects: [rect] } }],
    locked: { style: 'guidebook', line: LOCK_LINE },
  };
}

function contractFixture() {
  const grid = new Uint8Array(15).fill(CITY_TILE.ROAD);
  grid[0] = CITY_TILE.EXIT;
  const city = {
    id: 'district-contract-fixture',
    cols: 5,
    rows: 3,
    entrance: { x: 1, y: 1, facing: 'down' },
    returnNode: 'fixture-node',
    stations: [
      { id: 's1', tile: [1, 1] },
      { id: 's2', tile: [3, 1] },
    ],
    transitPoints: [],
    transit: [{ id: 'line', stopIds: ['s1', 's2'] }],
    nodes: [
      { id: 'door', tile: [2, 1], gate: { type: 'story-scene', scene: 'fixture-scene' } },
      { id: 'npc', tile: [3, 1], npc: 'guide' },
      { id: 'landmark-silhouette', tile: [4, 2] },
    ],
    districts: districtConfig(),
    CITY_TILE,
    buildGrid: () => Uint8Array.from(grid),
  };
  const mainRoute = {
    path: [[1, 1], [2, 1], [3, 1]],
    discoveries: [{ id: 'fixture-d1', tile: [2, 1] }],
  };
  return { city, grid, mainRoute };
}

function resolveFixture(mutate = () => {}) {
  const fixture = contractFixture();
  mutate(fixture);
  return resolveCityDistricts(fixture.city, fixture.grid, fixture.mainRoute);
}

function textureHarness(city) {
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
  return { scene, textures };
}

const LYON_OPEN_RECTS = Object.freeze([
  Object.freeze(['perrache-bellecour', [127, 228, 169, 292]]),
  Object.freeze(['bellecour-vieux-lyon', [136, 213, 169, 240]]),
  Object.freeze(['vieux-lyon-fourviere', [118, 202, 149, 225]]),
  Object.freeze(['fourviere-terreaux', [118, 174, 178, 215]]),
  Object.freeze(['terreaux-opera', [166, 173, 187, 194]]),
  Object.freeze(['opera-croix-rousse', [157, 136, 191, 186]]),
  Object.freeze(['croix-rousse-halles', [157, 136, 239, 212]]),
  Object.freeze(['halles-part-dieu', [227, 200, 276, 225]]),
]);

function lyonPilot() {
  return {
    ...LYON,
    districts: {
      version: 'district-v1',
      open: LYON_OPEN_RECTS.map(([id, rect]) => ({ id, label: id, tiles: { rects: [rect] } })),
      locked: { style: 'guidebook', line: LOCK_LINE },
    },
  };
}

describe('city.districts fail-closed resolve', () => {
  it('미정의는 완전 개방이고 유효 rect union은 inclusive·deep-frozen이다', () => {
    const { city, grid } = contractFixture();
    expect(resolveCityDistricts({ ...city, districts: undefined }, grid)).toBeNull();
    expect(cityDistrictOpenAt(null, -999, 999)).toBe(true);

    const first = resolveFixture();
    const second = resolveFixture();
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.open)).toBe(true);
    expect(Object.isFrozen(first.open[0].rects[0])).toBe(true);
    expect(cityDistrictOpenAt(first, 0, 0)).toBe(true);
    expect(cityDistrictOpenAt(first, 3, 2)).toBe(true);
    expect(cityDistrictOpenAt(first, 4, 2)).toBe(false);
    expect(cityDistrictOpenAt(first, 5, 2)).toBe(false);
  });

  it.each([
    ['version', (f) => { f.city.districts.version = 'district-v2'; }, /version must be district-v1/],
    ['open', (f) => { f.city.districts.open = []; }, /open must be a non-empty array/],
    ['duplicate id', (f) => { f.city.districts.open.push(structuredClone(f.city.districts.open[0])); }, /open id must be unique/],
    ['rect arity', (f) => { f.city.districts.open[0].tiles.rects[0] = [0, 0, 3]; }, /four integers/],
    ['rect order', (f) => { f.city.districts.open[0].tiles.rects[0] = [3, 0, 2, 2]; }, /bounds must be ordered/],
    ['rect bounds', (f) => { f.city.districts.open[0].tiles.rects[0] = [0, 0, 5, 2]; }, /inside the city grid/],
    ['style', (f) => { f.city.districts.locked.style = 'fog'; }, /locked.style must be guidebook/],
    ['line', (f) => { f.city.districts.locked.line = ' '; }, /locked.line must be a non-empty trimmed string/],
  ])('%s 손상은 묵인하지 않고 throw한다', (_label, mutate, error) => {
    const fixture = contractFixture();
    mutate(fixture);
    expect(() => resolveCityDistricts(fixture.city, fixture.grid, fixture.mainRoute)).toThrow(error);
  });

  it.each([
    ['spawn', (f) => { f.city.entrance = { x: 4, y: 2 }; }, /spawn entrance tile 4,2 must be open/],
    ['TRANSIT arrival', (f) => { f.city.stations[1].tile = [4, 2]; }, /transit arrival s2 tile 4,2 must be open/],
    ['returnNode EXIT', (f) => { f.grid[0] = CITY_TILE.ROAD; f.grid[14] = CITY_TILE.EXIT; }, /return EXIT tile 4,2 must be open/],
    ['door', (f) => { f.city.nodes[0].tile = [4, 2]; }, /node door tile 4,2 must be open/],
    ['NPC', (f) => { f.city.nodes[1].tile = [4, 2]; }, /node npc tile 4,2 must be open/],
    ['main route', (f) => { f.mainRoute.path.push([4, 2]); }, /main route tile 4,2 must be open/],
    ['discovery', (f) => { f.mainRoute.discoveries[0].tile = [4, 2]; }, /discovery fixture-d1 tile 4,2 must be open/],
  ])('%s가 잠금 영역이면 resolve 단계에서 throw한다', (_label, mutate, error) => {
    const fixture = contractFixture();
    mutate(fixture);
    expect(() => resolveCityDistricts(fixture.city, fixture.grid, fixture.mainRoute)).toThrow(error);
  });

  it('일반 landmark는 잠금 영역의 저채도 silhouette로 남길 수 있다', () => {
    expect(() => resolveFixture()).not.toThrow();
  });
});

describe('CityScene guidebook 소비 경계', () => {
  it('잠금 경계 이동을 막고 고정 카피를 세션당 한 번·정확히 4.2초만 보인다', () => {
    class FakeScene { constructor() {} }
    const fixture = contractFixture();
    const Scene = buildCityScene({ Scene: FakeScene }, fixture.city, {});
    const scene = new Scene();
    scene.grid = fixture.grid;
    scene.districts = resolveCityDistricts(fixture.city, fixture.grid, fixture.mainRoute);
    scene.districtLockNoticeShown = false;
    scene.pTileX = 3;
    scene.pTileY = 2;
    scene.tapTile = { x: 4, y: 2 };
    scene.startStep = vi.fn();
    const toast = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    scene.add = { text: vi.fn(() => toast) };
    scene.scale = { width: 480 };
    scene.time = { delayedCall: vi.fn(() => ({ remove: vi.fn() })) };

    expect(scene.tryStartStep('right')).toBe(false);
    expect(scene.tryStartStep('right')).toBe(false);
    expect(scene.startStep).not.toHaveBeenCalled();
    expect(scene.add.text).toHaveBeenCalledTimes(1);
    expect(scene.add.text.mock.calls[0][2]).toBe(LOCK_LINE);
    expect(scene.time.delayedCall).toHaveBeenCalledWith(
      CITY_DISTRICT_LOCK_DURATION_MS,
      expect.any(Function),
    );
    expect(CITY_DISTRICT_LOCK_DURATION_MS).toBe(4200);
  });

  it('미정의는 guidebook texture를 0개 굽고 정의 시에만 종이 지도 키를 소비한다', () => {
    const baseCity = {
      id: 'district-render-fixture', cols: 2, rows: 1,
      entrance: { x: 0, y: 0 }, nodes: [], stations: [], transit: [],
      CITY_TILE,
      buildGrid: () => Uint8Array.from([CITY_TILE.ROAD, CITY_TILE.WATER]),
    };
    const undefinedHarness = textureHarness(baseCity);
    const districtCity = { ...baseCity, districts: districtConfig([0, 0, 0, 0]) };
    const guidebookHarness = textureHarness(districtCity);
    const grid = districtCity.buildGrid();
    guidebookHarness.scene.grid = grid;
    guidebookHarness.scene.districts = resolveCityDistricts(districtCity, grid);

    for (const key of GUIDEBOOK_KEYS) {
      expect(undefinedHarness.textures.has(key)).toBe(false);
      expect(guidebookHarness.textures.has(key)).toBe(true);
    }
    expect(guidebookHarness.scene.terrainTexKey(0, 0)).toBe('ct_road_x');
    expect(guidebookHarness.scene.terrainTexKey(1, 0)).toBe('ct_guidebook_water');
    expect(guidebookHarness.textures.get('ct_guidebook_land')).toMatchObject({ width: 16, height: 16 });
    expect(guidebookHarness.textures.get('ct_guidebook_landmark_marker')).toMatchObject({ width: 16, height: 32 });
  });

  it('리옹 예비 rect 8개가 전체 주동선·발견·출입·TRANSIT 정합 게이트를 통과한다', () => {
    const city = lyonPilot();
    const grid = city.buildGrid();
    const route = resolveCityMainRoute(city, grid);
    const first = resolveCityDistricts(city, grid, route);
    const second = resolveCityDistricts(city, grid, route);
    const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

    expect(first.open).toHaveLength(8);
    expect(route.path).toHaveLength(509);
    expect(sha(first)).toBe(sha(second));
    expect(route.path.every(([x, y]) => cityDistrictOpenAt(first, x, y))).toBe(true);
  });

  it('districts 미정의 19도시는 render key·movement collision을 그대로 유지한다', () => {
    // 지구 정의 도시 목록 — 새 도시를 지구화하면 여기와 길이 스냅샷을 함께 갱신한다(무단 지구화 가드).
    const DISTRICT_CITY_IDS = ['lyon', 'bordeaux', 'strasbourg', 'seoul', 'busan', 'cote-dazur', 'leman-riviera'];
    class FakeScene { constructor() {} }
    const manifest = CITY_MAPS.filter(({ id }) => !DISTRICT_CITY_IDS.includes(id)).map((city) => {
      const Scene = buildCityScene({ Scene: FakeScene }, city, {});
      const scene = new Scene();
      scene.grid = city.buildGrid();
      scene.districts = resolveCityDistricts(city, scene.grid);
      const hash = createHash('sha256');
      const failures = [];
      const stride = Math.max(1, Math.floor(scene.grid.length / 2048));
      for (let index = 0; index < scene.grid.length; index += stride) {
        const x = index % city.cols;
        const y = Math.floor(index / city.cols);
        const texture = scene.terrainTexKey(x, y);
        const blocked = scene.blocked(x, y);
        if (blocked !== isCityBlocked(scene.grid[index]) || texture.startsWith('ct_guidebook_')) {
          failures.push(index);
        }
        hash.update(`${scene.grid[index]}:${Number(blocked)}:${texture};`);
      }
      expect(failures).toEqual([]);
      return `${city.id}:${hash.digest('hex')}`;
    });

    expect(manifest).toHaveLength(19);
    expect(manifest).toMatchInlineSnapshot(`
      [
        "fukuoka:cd94cd15350dbaa66284da236cd24a1d851dcecc1171b56611a09ec8cc99d03f",
        "tokyo:005351d1f6395c51c4f447e7e5ac91dc37eb7b922ab31b4985f8430218367d74",
        "osaka:1e157faba21b00707aa7fc3bf169b388fd5fbb972145ddf3c0abc1922fb663f1",
        "kyoto:d3120dc9193275a1a4ec204eccab3cfa0dbf9ab781e1d3bbe068a6bd806daa65",
        "grand-paris:38aa447e903cd2b4325e1f9d1eb8aef62404a6ccbbdb6f9cb25bbcdde1b2918a",
        "mont-saint-michel:bc2b359851b61d8c453183419d0404bf5ed3e55ab914f0c8b0d85b3e35437633",
        "brussels:5390f6d7ca2f6d8a77624050468b24351130a16ecf267a3d18bb74e5bcd533a0",
        "taipei:5ef6a95c3fcb0715a00effa97f22dca6ac3bc6120dc45fac435b28f664a0a01e",
        "hong-kong:ed9f37d618bdb24f6e993ad91aad92b8d941727f39577f6d6f5724e3aadc01a9",
        "london:3f8ee7d1a1285c7fe7b6696898a6827d9e84c0ab7d2073bd4c5d55b36cf4e22e",
        "shanghai:ecd2cac281742914f5716775e9c1fae5e676eb18da594c440ed0ecb823c78522",
        "beijing:164b01ed8a0191dd93631504236f3f3467cba05209cd762dbc6f66ad9431af46",
        "brisbane:1fd6e0f3ff0c312b4275db04b37df72f97eaf4624385228a39ab631a65076d5e",
        "sydney:4ead615cf673e11735f58a8e47e0499bc1ff231eaeb99b4cbdaa996cc1316b8f",
        "canberra:8efe84492bbcfb3e0e3459761e08a29d26bd57e96eabfc54b0afe181afa3c7e9",
        "melbourne:5764ba162c50e2edb9d439173c1a7033e6b2ab921cf185c9af5ed2affa2414d6",
        "marseille:a8acf4d94ef8a037450a7dae67d3d0f00d6841a53eaf13158f38eee2d0defa01",
        "kawaguchiko:add90460ba2f032d15dbaaddd7ae0b4eb72937aaf011f4e965bed03b92b5e1c3",
        "geneva:a879108da2c62b0831891fd2b1b4833f3da9360ee85a8a704dd4cd777e6d8093",
      ]
    `);
  });
});
