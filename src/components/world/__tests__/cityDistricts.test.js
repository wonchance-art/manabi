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
import { CITY_TILE, isCityBlocked, resolveArrivalTile } from '../cities/terrain.js';

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
const COTE_DAZUR_GUIDEBOOK_LAND_KEY = 'ct_guidebook_land_cote_dazur';
const DISTRICT_CITY_IDS = Object.freeze([
  'lyon', 'bordeaux', 'strasbourg', 'seoul', 'busan', 'cote-dazur', 'leman-riviera',
  'tokyo', 'osaka', 'fukuoka', 'kyoto',
  'grand-paris', 'brussels', 'london', 'mont-saint-michel', 'geneva',
  'taipei', 'hong-kong', 'shanghai', 'beijing',
  'brisbane', 'sydney', 'canberra', 'melbourne',
]);
const EXPANSION_DISTRICT_LABELS = Object.freeze({
  'grand-paris': ['파리 북중부', '센강 중심부', '서부 위성권', '외곽 위성권'],
  brussels: ['미디·남역', '구시가·왕궁', '북역·보타니크', 'EU 지구·라켄'],
  london: ['킹스크로스·캠든', '중심·서부', '시티·동부', '외곽 위성권'],
  'mont-saint-michel': ['수도원 섬', '상부 제방길', '본토·제방길'],
  geneva: ['국제지구·우안', '구시가·호반', '플랭팔레', '카루주'],
  taipei: ['스린·고궁', '서부 도심', '동부 도심', '신이·라오허'],
  'hong-kong': ['구룡 북부', '침사추이', '센트럴·애드미럴티', '빅토리아픽·코즈웨이베이'],
  shanghai: ['인민광장·난징루·와이탄', '루자쭈이', '위위안·신톈디', '톈쯔팡'],
  beijing: ['북부 호수권', '자금성·중심부', '왕푸징', '전문·천단'],
  brisbane: ['CBD·북부', '사우스뱅크', '캥거루포인트·식물원', '뉴팜'],
  sydney: ['시티·하버', '도심 남동부', '본다이·왓슨스베이', '하버 북안'],
  canberra: ['시빅·북부', '기념관·에인슬리', '호수·국회지구', '킹스턴·캔버라역'],
  melbourne: ['시티(CBD)', '도심 북부', '사우스뱅크·동부', '세인트킬다'],
});

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

function rasterizeTexture({ width, height, commands }) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (const { shape, args: [left, top, rectWidth, rectHeight], color, alpha } of commands) {
    if (shape !== 'rect') throw new Error(`unsupported texture command: ${shape}`);
    const source = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
    for (let y = top; y < top + rectHeight; y += 1) {
      for (let x = left; x < left + rectWidth; x += 1) {
        const offset = (y * width + x) * 4;
        const destinationAlpha = rgba[offset + 3] / 255;
        const outputAlpha = alpha + destinationAlpha * (1 - alpha);
        for (let channel = 0; channel < 3; channel += 1) {
          rgba[offset + channel] = Math.round((
            source[channel] * alpha
            + rgba[offset + channel] * destinationAlpha * (1 - alpha)
          ) / outputAlpha);
        }
        rgba[offset + 3] = Math.round(outputAlpha * 255);
      }
    }
  }
  return rgba;
}

function textureLightnessDifference(first, second) {
  const firstRgba = rasterizeTexture(first);
  const secondRgba = rasterizeTexture(second);
  const differences = [];
  for (let offset = 0; offset < firstRgba.length; offset += 4) {
    const firstLightness = firstRgba[offset] * 0.2126
      + firstRgba[offset + 1] * 0.7152
      + firstRgba[offset + 2] * 0.0722;
    const secondLightness = secondRgba[offset] * 0.2126
      + secondRgba[offset + 1] * 0.7152
      + secondRgba[offset + 2] * 0.0722;
    differences.push(Math.abs(firstLightness - secondLightness));
  }
  return {
    meanAbs: Number((differences.reduce((sum, value) => sum + value, 0) / differences.length).toFixed(2)),
    minAbs: Number(Math.min(...differences).toFixed(2)),
    maxAbs: Number(Math.max(...differences).toFixed(2)),
    atLeast20: differences.filter((value) => value >= 20).length,
    pixels: differences.length,
  };
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

    const visualContract = Object.fromEntries(GUIDEBOOK_KEYS.map((key) => {
      const uniqueStyles = new Map(guidebookHarness.textures.get(key).commands.map(({ color, alpha }) => [
        `${color.toString(16)}@${alpha}`,
        { color: `#${color.toString(16).padStart(6, '0')}`, alpha },
      ]));
      return [key, [...uniqueStyles.values()]];
    }));
    expect(visualContract).toMatchInlineSnapshot(`
      {
        "ct_guidebook_land": [
          {
            "alpha": 1,
            "color": "#d4c7ae",
          },
          {
            "alpha": 0.5,
            "color": "#b1a48a",
          },
          {
            "alpha": 0.42,
            "color": "#8f826c",
          },
        ],
        "ct_guidebook_landmark": [
          {
            "alpha": 1,
            "color": "#d4c7ae",
          },
          {
            "alpha": 0.5,
            "color": "#b1a48a",
          },
          {
            "alpha": 0.42,
            "color": "#8f826c",
          },
          {
            "alpha": 0.76,
            "color": "#958d7e",
          },
          {
            "alpha": 0.58,
            "color": "#70695f",
          },
        ],
        "ct_guidebook_landmark_marker": [
          {
            "alpha": 0.82,
            "color": "#78736b",
          },
          {
            "alpha": 0.82,
            "color": "#918a7e",
          },
          {
            "alpha": 0.7,
            "color": "#5f5b55",
          },
        ],
        "ct_guidebook_road_h": [
          {
            "alpha": 1,
            "color": "#d4c7ae",
          },
          {
            "alpha": 0.5,
            "color": "#b1a48a",
          },
          {
            "alpha": 0.42,
            "color": "#8f826c",
          },
          {
            "alpha": 0.74,
            "color": "#89847c",
          },
          {
            "alpha": 0.34,
            "color": "#6f6b65",
          },
        ],
        "ct_guidebook_road_v": [
          {
            "alpha": 1,
            "color": "#d4c7ae",
          },
          {
            "alpha": 0.5,
            "color": "#b1a48a",
          },
          {
            "alpha": 0.42,
            "color": "#8f826c",
          },
          {
            "alpha": 0.74,
            "color": "#89847c",
          },
          {
            "alpha": 0.34,
            "color": "#6f6b65",
          },
        ],
        "ct_guidebook_road_x": [
          {
            "alpha": 1,
            "color": "#d4c7ae",
          },
          {
            "alpha": 0.5,
            "color": "#b1a48a",
          },
          {
            "alpha": 0.42,
            "color": "#8f826c",
          },
          {
            "alpha": 0.74,
            "color": "#89847c",
          },
          {
            "alpha": 0.34,
            "color": "#6f6b65",
          },
        ],
        "ct_guidebook_water": [
          {
            "alpha": 1,
            "color": "#98a6ab",
          },
          {
            "alpha": 0.66,
            "color": "#cad3d0",
          },
          {
            "alpha": 0.4,
            "color": "#74848a",
          },
        ],
      }
    `);
    expect(guidebookHarness.textures.get('ct_guidebook_land').commands
      .filter(({ color }) => color === 0x8f826c)).toHaveLength(8);
    expect(guidebookHarness.textures.get('ct_guidebook_water').commands
      .filter(({ color }) => color === 0x74848a)).toHaveLength(8);
  });

  it('코트다쥐르 밝은 보도↔잠금 평지는 W2 지각 명도차 하한 20을 전 픽셀에서 넘는다', () => {
    const city = CITY_MAPS.find(({ id }) => id === 'cote-dazur');
    const harness = textureHarness(city);
    harness.scene.grid = city.buildGrid();
    harness.scene.districts = resolveCityDistricts(
      city,
      harness.scene.grid,
      resolveCityMainRoute(city, harness.scene.grid),
    );

    expect(harness.scene.terrainTexKey(600, 191)).toBe('ct_sidewalk');
    expect(harness.scene.terrainTexKey(599, 191)).toBe(COTE_DAZUR_GUIDEBOOK_LAND_KEY);
    expect(textureLightnessDifference(
      harness.textures.get('ct_sidewalk'),
      harness.textures.get(COTE_DAZUR_GUIDEBOOK_LAND_KEY),
    )).toEqual({
      meanAbs: 24.43,
      minAbs: 20.95,
      maxAbs: 59.09,
      atLeast20: 256,
      pixels: 256,
    });
  });

  it('코트다쥐르 외 지구제 6도시는 guidebook 명령을 유지하고 서울만 autotile 경계 키를 쓴다', () => {
    const boundarySamples = [
      ['lyon', [239, 139], [240, 139]],
      ['bordeaux', [315, 191], [316, 191]],
      ['strasbourg', [110, 257], [109, 257]],
      ['seoul', [995, 573], [996, 573]],
      ['busan', [810, 423], [811, 423]],
      ['leman-riviera', [80, 140], [79, 140]],
    ];
    const manifest = boundarySamples.map(([id, openTile, lockedTile]) => {
      const city = CITY_MAPS.find((candidate) => candidate.id === id);
      const harness = textureHarness(city);
      harness.scene.grid = city.buildGrid();
      harness.scene.districts = resolveCityDistricts(
        city,
        harness.scene.grid,
        resolveCityMainRoute(city, harness.scene.grid),
      );
      expect(harness.textures.has(COTE_DAZUR_GUIDEBOOK_LAND_KEY)).toBe(false);
      const guidebookSha = createHash('sha256').update(JSON.stringify(
        GUIDEBOOK_KEYS.map((key) => [key, harness.textures.get(key)]),
      )).digest('hex');
      return {
        id,
        boundaryKeys: [
          harness.scene.terrainTexKey(...openTile),
          harness.scene.terrainTexKey(...lockedTile),
        ],
        guidebookSha,
      };
    });

    expect(manifest).toMatchInlineSnapshot(`
      [
        {
          "boundaryKeys": [
            "ct_sidewalk",
            "ct_guidebook_land",
          ],
          "guidebookSha": "6ef0480b36888577fc698f13f5f605c9420ba3a2d4cac490d919f60ca56f0e5e",
          "id": "lyon",
        },
        {
          "boundaryKeys": [
            "ct_sidewalk",
            "ct_guidebook_land",
          ],
          "guidebookSha": "6ef0480b36888577fc698f13f5f605c9420ba3a2d4cac490d919f60ca56f0e5e",
          "id": "bordeaux",
        },
        {
          "boundaryKeys": [
            "ct_sidewalk",
            "ct_guidebook_road_v",
          ],
          "guidebookSha": "6ef0480b36888577fc698f13f5f605c9420ba3a2d4cac490d919f60ca56f0e5e",
          "id": "strasbourg",
        },
        {
          "boundaryKeys": [
            "ct_road_autotile_13",
            "ct_guidebook_land",
          ],
          "guidebookSha": "6ef0480b36888577fc698f13f5f605c9420ba3a2d4cac490d919f60ca56f0e5e",
          "id": "seoul",
        },
        {
          "boundaryKeys": [
            "ct_road_h",
            "ct_guidebook_road_h",
          ],
          "guidebookSha": "6ef0480b36888577fc698f13f5f605c9420ba3a2d4cac490d919f60ca56f0e5e",
          "id": "busan",
        },
        {
          "boundaryKeys": [
            "ct_sidewalk",
            "ct_guidebook_land",
          ],
          "guidebookSha": "6ef0480b36888577fc698f13f5f605c9420ba3a2d4cac490d919f60ca56f0e5e",
          "id": "leman-riviera",
        },
      ]
    `);
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

  it.each(Object.entries(EXPANSION_DISTRICT_LABELS))(
    '%s T19 rect는 TRANSIT·스폰·EXIT·도어·NPC·발견·mainRoute 전부 열린다',
    (id, labels) => {
      const city = CITY_MAPS.find((candidate) => candidate.id === id);
      const grid = city.buildGrid();
      const route = resolveCityMainRoute(city, grid);
      const first = resolveCityDistricts(city, grid, route);
      const second = resolveCityDistricts(city, grid, route);

      expect(first.open.map((district) => district.label)).toEqual(labels);
      expect(first).toEqual(second);
      expect(cityDistrictOpenAt(first, city.entrance.x, city.entrance.y)).toBe(true);

      const exits = [];
      for (let index = 0; index < grid.length; index += 1) {
        if (grid[index] !== CITY_TILE.EXIT) continue;
        const tile = [index % city.cols, Math.floor(index / city.cols)];
        exits.push(tile);
        expect(cityDistrictOpenAt(first, ...tile)).toBe(true);
      }
      expect(exits.length).toBeGreaterThan(0);

      const stops = [...(city.stations ?? []), ...(city.transitPoints ?? [])];
      const transitIds = new Set((city.transit ?? []).flatMap((line) => line.stopIds ?? []));
      for (const stopId of transitIds) {
        const matches = stops.filter((stop) => stop.id === stopId);
        expect(matches).toHaveLength(1);
        expect(cityDistrictOpenAt(first, ...matches[0].tile)).toBe(true);
        const arrival = resolveArrivalTile(grid, city.cols, city.rows, matches[0].tile);
        expect(arrival).not.toBeNull();
        expect(cityDistrictOpenAt(first, ...arrival)).toBe(true);
      }

      const requiredNodes = (city.nodes ?? []).filter(
        (node) => node.npc || node.gate || node.chapter || node.reading,
      );
      expect(requiredNodes.every(({ tile }) => cityDistrictOpenAt(first, ...tile))).toBe(true);
      expect((route?.path ?? []).every((tile) => cityDistrictOpenAt(first, ...tile))).toBe(true);
      expect((route?.discoveries ?? []).every(
        ({ tile }) => cityDistrictOpenAt(first, ...tile),
      )).toBe(true);
    },
  );

  it('districts 미정의 2도시는 render key·movement collision을 그대로 유지한다', () => {
    // 지구 정의 도시 목록 — 새 도시를 지구화하면 여기와 길이 스냅샷을 함께 갱신한다(무단 지구화 가드).
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

    expect(manifest).toHaveLength(2);
    expect(manifest).toMatchInlineSnapshot(`
      [
        "marseille:a8acf4d94ef8a037450a7dae67d3d0f00d6841a53eaf13158f38eee2d0defa01",
        "kawaguchiko:add90460ba2f032d15dbaaddd7ae0b4eb72937aaf011f4e965bed03b92b5e1c3",
      ]
    `);
  });
});
