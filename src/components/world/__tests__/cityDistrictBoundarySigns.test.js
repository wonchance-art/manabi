import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';
import {
  CITY_DISTRICT_BOUNDARY_SIGN_KIND,
  CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING,
  planCityDistrictBoundarySigns,
} from '../cityDistrictBoundarySigns.js';
import { cityDistrictOpenAt, resolveCityDistricts } from '../cityDistricts.js';
import { resolveCityMainRoute } from '../cityMainRoute.js';
import { CITY_MAPS } from '../cities/index.js';
import { CITY_TILE, isCityWalkable } from '../cities/terrain.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

function resolvedFixture(cols, rows, rects) {
  return Object.freeze({
    version: 'district-v1',
    cols,
    rows,
    open: Object.freeze([Object.freeze({
      id: 'open',
      label: 'Open',
      rects: Object.freeze(rects.map((rect) => Object.freeze(rect))),
    })]),
    locked: Object.freeze({ style: 'guidebook', line: '준비 중' }),
  });
}

function chebyshev(a, b) {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

function boundaryTextureHarness(withDistricts) {
  const textures = new Map();
  class FakeGraphics {
    constructor() { this.color = 0; this.commands = []; }
    fillStyle(color) { this.color = color; return this; }
    fillRect(...args) { this.commands.push({ color: this.color, args }); return this; }
    fillCircle(...args) { this.commands.push({ color: this.color, args }); return this; }
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
  const city = {
    id: 'district-boundary-texture-fixture',
    cols: 2,
    rows: 1,
    CITY_TILE,
    ...(withDistricts ? {
      districts: {
        version: 'district-v1',
        open: [{ id: 'open', label: 'Open', tiles: { rects: [[0, 0, 0, 0]] } }],
        locked: { style: 'guidebook', line: '준비 중' },
      },
    } : {}),
  };
  const Scene = buildCityScene({ Scene: FakeScene }, city, { avatarRef: { current: null } });
  new Scene().preload();
  return textures;
}

describe('잠금 지구 경계 표지판 순수 배치', () => {
  it('district 미정의는 빈 결과이고 손상된 입력은 fail-closed로 throw한다', () => {
    const empty = planCityDistrictBoundarySigns(null, new Uint8Array());
    expect(empty).toEqual([]);
    expect(Object.isFrozen(empty)).toBe(true);

    const resolved = resolvedFixture(12, 17, [[0, 0, 5, 16]]);
    expect(() => planCityDistrictBoundarySigns(
      { ...resolved, version: 'district-v2' },
      new Uint8Array(12 * 17),
    )).toThrow(/version must be district-v1/);
    expect(() => planCityDistrictBoundarySigns(resolved, new Uint8Array(1)))
      .toThrow(/grid size must match/);
  });

  it('개방 쪽 cardinal 경계에서 도로를 먼저 고르고 모든 팻말을 Chebyshev 8타일 이격한다', () => {
    const resolved = resolvedFixture(12, 17, [[0, 0, 5, 16]]);
    const grid = new Uint8Array(12 * 17).fill(CITY_TILE.SIDEWALK);
    grid[8 * 12 + 5] = CITY_TILE.ROAD;

    const first = planCityDistrictBoundarySigns(resolved, grid);
    const second = planCityDistrictBoundarySigns(resolved, grid);
    expect(first).toEqual(second);
    expect(first.map(({ tile }) => tile)).toEqual([[5, 8], [5, 0], [5, 16]]);
    expect(first.every(({ kind }) => kind === CITY_DISTRICT_BOUNDARY_SIGN_KIND)).toBe(true);
    expect(first.every(({ tile: [x, y] }) => (
      cityDistrictOpenAt(resolved, x, y)
      && !cityDistrictOpenAt(resolved, x + 1, y)
      && isCityWalkable(grid[y * resolved.cols + x])
    ))).toBe(true);
    for (let i = 0; i < first.length; i += 1) {
      for (let j = i + 1; j < first.length; j += 1) {
        expect(chebyshev(first[i].tile, first[j].tile))
          .toBeGreaterThanOrEqual(CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING);
      }
    }
    expect(CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING).toBe(8);
  });

  it('겹친 rect의 내부 이음새는 경계로 오인하지 않고 차단·EXIT 타일에는 놓지 않는다', () => {
    const resolved = resolvedFixture(12, 17, [[0, 0, 5, 16], [6, 0, 8, 16]]);
    const grid = new Uint8Array(12 * 17).fill(CITY_TILE.SIDEWALK);
    grid[8 * 12 + 8] = CITY_TILE.BUILDING;
    grid[16 * 12 + 8] = CITY_TILE.EXIT;

    const signs = planCityDistrictBoundarySigns(resolved, grid);
    expect(signs.length).toBeGreaterThan(0);
    expect(signs.every(({ tile: [x, y] }) => x === 8 && x !== 5 && y !== 8 && y !== 16))
      .toBe(true);
  });

  it('정본 district 24도시의 경계·보행·간격과 2회 byte-identical manifest를 고정한다', () => {
    const districtCities = CITY_MAPS.filter((city) => city.districts != null);
    const manifest = districtCities.map((city) => {
      const grid = city.buildGrid();
      const districts = resolveCityDistricts(city, grid, resolveCityMainRoute(city, grid));
      const first = planCityDistrictBoundarySigns(districts, grid);
      const second = planCityDistrictBoundarySigns(districts, grid);
      expect(first).toEqual(second);
      expect(Object.isFrozen(first)).toBe(true);
      for (const sign of first) {
        expect(Object.isFrozen(sign)).toBe(true);
        expect(Object.isFrozen(sign.tile)).toBe(true);
        const [x, y] = sign.tile;
        expect(cityDistrictOpenAt(districts, x, y)).toBe(true);
        expect(isCityWalkable(grid[y * city.cols + x])).toBe(true);
        expect(grid[y * city.cols + x]).not.toBe(CITY_TILE.EXIT);
        expect([
          [x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y],
        ].some(([nx, ny]) => (
          nx >= 0 && ny >= 0 && nx < city.cols && ny < city.rows
          && !cityDistrictOpenAt(districts, nx, ny)
        ))).toBe(true);
      }
      for (let i = 0; i < first.length; i += 1) {
        for (let j = i + 1; j < first.length; j += 1) {
          expect(chebyshev(first[i].tile, first[j].tile))
            .toBeGreaterThanOrEqual(CITY_DISTRICT_BOUNDARY_SIGN_MIN_SPACING);
        }
      }
      return { id: city.id, tiles: first.map(({ tile }) => tile) };
    });
    const bytes = JSON.stringify(manifest);
    const secondBytes = JSON.stringify(structuredClone(manifest));

    expect(districtCities.map(({ id }) => id))
      .toEqual([
        'fukuoka', 'tokyo', 'osaka', 'kyoto', 'busan', 'seoul',
        'grand-paris', 'mont-saint-michel', 'cote-dazur', 'brussels',
        'taipei', 'hong-kong', 'london', 'shanghai', 'beijing',
        'brisbane', 'sydney', 'canberra', 'melbourne',
        'marseille', 'kawaguchiko', 'geneva',
        'leman-riviera', 'lyon', 'bordeaux', 'strasbourg',
      ]);
    expect(manifest.map(({ id, tiles }) => [id, tiles.length])).toMatchInlineSnapshot(`
      [
        [
          "fukuoka",
          113,
        ],
        [
          "tokyo",
          519,
        ],
        [
          "osaka",
          293,
        ],
        [
          "kyoto",
          356,
        ],
        [
          "busan",
          233,
        ],
        [
          "seoul",
          429,
        ],
        [
          "grand-paris",
          316,
        ],
        [
          "mont-saint-michel",
          161,
        ],
        [
          "cote-dazur",
          232,
        ],
        [
          "brussels",
          96,
        ],
        [
          "taipei",
          184,
        ],
        [
          "hong-kong",
          85,
        ],
        [
          "london",
          343,
        ],
        [
          "shanghai",
          93,
        ],
        [
          "beijing",
          102,
        ],
        [
          "brisbane",
          65,
        ],
        [
          "sydney",
          161,
        ],
        [
          "canberra",
          157,
        ],
        [
          "melbourne",
          119,
        ],
        [
          "marseille",
          78,
        ],
        [
          "kawaguchiko",
          108,
        ],
        [
          "geneva",
          66,
        ],
        [
          "leman-riviera",
          146,
        ],
        [
          "lyon",
          62,
        ],
        [
          "bordeaux",
          75,
        ],
        [
          "strasbourg",
          63,
        ],
      ]
    `);
    expect(bytes).toBe(secondBytes);
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('ea969b6eadb7f7b3dd850e8cfd82774d458340a284aa3909f1700b044e1333b4');
  });
});

describe('CityScene 잠금 경계 팻말 베이크', () => {
  it('district 도시에만 GBC 3색·무문자 빗장 팻말 texture 1종을 굽는다', () => {
    const undefinedTextures = boundaryTextureHarness(false);
    const districtTextures = boundaryTextureHarness(true);
    const key = 'ct_prop_district_boundary_signpost';
    const texture = districtTextures.get(key);

    expect(undefinedTextures.has(key)).toBe(false);
    expect(texture).toMatchObject({ width: 16, height: 32 });
    expect([...new Set(texture.commands.map(({ color }) => color))])
      .toEqual([0x2a2118, 0xf6edcf, 0x8a5a2b]);
    expect([...districtTextures.keys()].filter((textureKey) => (
      textureKey.startsWith('ct_prop_district_boundary_')
    ))).toEqual([key]);
  });
});
