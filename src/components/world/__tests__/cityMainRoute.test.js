import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  cityMainRouteTileAt,
  encodeMainRoutePathIndices,
  mainRouteRefKey,
  planCityMainRoute,
  resolveCityMainRoute,
} from '../cityMainRoute.js';
import { CITY_TILE } from '../cities/terrain.js';

const EMPTY_SHA256 = '0'.repeat(64);

function storedRoute(overrides = {}) {
  return {
    id: 'fixture-route',
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
    segments: [{
      id: 'node:a--node:b',
      from: { kind: 'node', id: 'a' },
      to: { kind: 'node', id: 'b' },
      stepsRle: [{ direction: 'R', count: 3 }],
      stepCount: 3,
      tileCount: 4,
      pathSha256: EMPTY_SHA256,
    }],
    ...overrides,
  };
}

function fixtureCity(overrides = {}) {
  const grid = overrides.grid ?? new Uint8Array(4).fill(CITY_TILE.ROAD);
  return {
    id: 'main-route-fixture',
    cols: 4,
    rows: 1,
    CITY_TILE,
    nodes: [
      { id: 'a', tile: [0, 0] },
      { id: 'b', tile: [3, 0] },
    ],
    stations: [],
    props: [],
    buildGrid: () => grid,
    mainRoute: storedRoute(),
    ...overrides,
  };
}

describe('cityMainRoute 순수 계약', () => {
  it('typed ref를 kind:id로 분리하고 undefined 도시는 완전히 비활성화한다', () => {
    expect(mainRouteRefKey({ kind: 'node', id: 'same' })).toBe('node:same');
    expect(mainRouteRefKey({ kind: 'station', id: 'same' })).toBe('station:same');
    expect(planCityMainRoute(fixtureCity({ mainRoute: undefined }))).toBeNull();
    expect(resolveCityMainRoute({ mainRoute: undefined })).toBeNull();
    expect(cityMainRouteTileAt(null, 4, 0, 0)).toBe(false);
  });

  it('저장 RLE를 4방 경로로 디코드하고 route mask만 만든다', () => {
    const city = fixtureCity();
    const route = resolveCityMainRoute(city);

    expect(route.path).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(route.waypointOffsets).toEqual([0, 3]);
    expect([...encodeMainRoutePathIndices(route.pathIndices)]).toEqual([
      0, 0, 0, 0,
      1, 0, 0, 0,
      2, 0, 0, 0,
      3, 0, 0, 0,
    ]);
    expect(cityMainRouteTileAt(route, city.cols, 2, 0)).toBe(true);
    expect(cityMainRouteTileAt(route, city.cols, 2, 1)).toBe(false);
  });

  it('URDL FIFO BFS의 동률 경로를 위쪽 우선으로 고정한다', () => {
    const grid = new Uint8Array(3 * 3).fill(CITY_TILE.ROAD);
    grid[1 * 3 + 1] = CITY_TILE.BUILDING;
    const city = {
      id: 'urdl-fixture',
      cols: 3,
      rows: 3,
      CITY_TILE,
      nodes: [
        { id: 'a', tile: [0, 1] },
        { id: 'b', tile: [2, 1] },
      ],
      stations: [],
      props: [],
      buildGrid: () => grid,
      mainRoute: {
        ...storedRoute(),
        segments: [],
      },
    };

    const first = planCityMainRoute(city);
    const second = planCityMainRoute(city);
    expect(first.segments[0].stepsRle).toEqual([
      { direction: 'U', count: 1 },
      { direction: 'R', count: 2 },
      { direction: 'D', count: 1 },
    ]);
    expect(first.segments[0].pathIndices).toEqual(second.segments[0].pathIndices);
    expect(createHash('sha256').update(first.segments[0].pathBytes).digest('hex'))
      .toBe(createHash('sha256').update(second.segments[0].pathBytes).digest('hex'));
  });

  it('typed waypoint exact-1·비EXIT·RLE endpoint/count를 fail closed한다', () => {
    const duplicate = fixtureCity({
      nodes: [
        { id: 'a', tile: [0, 0] },
        { id: 'a', tile: [1, 0] },
        { id: 'b', tile: [3, 0] },
      ],
    });
    expect(() => planCityMainRoute(duplicate)).toThrow(/node:a must resolve exact-1/);

    const exitGrid = new Uint8Array([
      CITY_TILE.ROAD,
      CITY_TILE.EXIT,
      CITY_TILE.ROAD,
      CITY_TILE.ROAD,
    ]);
    expect(() => resolveCityMainRoute(fixtureCity({ grid: exitGrid })))
      .toThrow(/blocked, EXIT, or out-of-range/);

    const invalidRoute = storedRoute({
      segments: [{
        ...storedRoute().segments[0],
        stepCount: 2,
      }],
    });
    expect(() => resolveCityMainRoute(fixtureCity({ mainRoute: invalidRoute })))
      .toThrow(/stepCount mismatch/);
  });
});
