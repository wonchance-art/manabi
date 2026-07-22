import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  encodeMainRoutePathIndices,
  planCityMainRoute,
  resolveCityMainRoute,
} from '../cityMainRoute.js';
import { LYON, MAIN_ROUTE } from '../cities/lyon.js';
import { CITY_TILE, isCityBlocked } from '../cities/terrain.js';

const WAYPOINTS = [
  'station:perrache',
  'node:bellecour',
  'node:vieux-lyon',
  'node:fourviere',
  'node:terreaux',
  'node:opera',
  'node:croix-rousse',
  'node:halles',
  'station:part-dieu',
];

const SEGMENT_PINS = [
  ['station:perrache--node:bellecour', 88, 89, '781ae7cb3d7fe322b8f37b450359fc182042eeb1b4ffc44b4dc131a794bf5392'],
  ['node:bellecour--node:vieux-lyon', 37, 38, '0cb15b9e2b234357109e66485b9894504dc22de636edbc962142a53662a0e8b4'],
  ['node:vieux-lyon--node:fourviere', 31, 32, '1c72c078a5097d20ed0873df071615b97e0d683b1f61e2a1223996dde5237d67'],
  ['node:fourviere--node:terreaux', 77, 78, 'e149ceb0cc0f74e2254a99a90643fc7cd2d3554833930877b60b1870e311e7da'],
  ['node:terreaux--node:opera', 26, 27, '075090c44b399a578127829cc5468f5f353817eccbe77403fac55cb6a31380e4'],
  ['node:opera--node:croix-rousse', 65, 66, '7e26891c1d43fc8c9551b4436ff3968d45ab1a9c794857215808cd3b6094621e'],
  ['node:croix-rousse--node:halles', 134, 135, '739014d9831e9190517f81ae1d79c157cac7bf6d5f277e9aefaac4fff47825f0'],
  ['node:halles--station:part-dieu', 50, 51, '94d03b490e14a1daf94fc288072e944ae70b048a3647e3857a8f1b597d006f48'],
];

const DISCOVERY_PINS = [
  ['lyon-d1', ['perrache', 'bellecour'], 0.55, 48, [139, 250], '보행자 거리의 차양 아래로 아침 냄새가 흘러요 — 리옹의 하루는 빵집 앞에서 시작돼요.'],
  ['lyon-d2', ['bellecour', 'vieux-lyon'], 0.50, 107, [152, 226], '손강 다리 위에서 물빛이 바뀌어요 — 잔잔한 손강과 힘찬 론강, 두 강의 성격이 달라요.'],
  ['lyon-d3', ['vieux-lyon', 'fourviere'], 0.40, 137, [140, 210], '구시가 골목엔 「트라불」이라 불리는 지붕 덮인 지름길이 숨어 있어요 — 비 오는 날의 통로였대요.'],
  ['lyon-d4', ['fourviere', 'terreaux'], 0.45, 191, [137, 187], '언덕에서 내려다보면 붉은 지붕의 바다 너머로 두 강이 만나는 자리가 보여요.'],
  ['lyon-d5', ['terreaux', 'opera'], 0.50, 246, [177, 188], '시청 뒤편을 돌면 오페라의 유리 반원 지붕이 나타나요 — 옛 벽 위에 얹은 현대의 곡선이에요.'],
  ['lyon-d6', ['opera', 'croix-rousse'], 0.60, 298, [182, 149], '크루아루스 오르막은 옛 견직 공방의 동네예요 — 천장 높은 집들이 그 시절의 흔적이에요.'],
  ['lyon-d7', ['croix-rousse', 'halles'], 0.50, 391, [219, 153], '론강변 산책로엔 플라타너스가 줄지어요 — 강을 따라 달리는 사람들의 코스예요.'],
  ['lyon-d8', ['halles', 'part-dieu'], 0.45, 481, [247, 215], '실내 시장의 치즈 좌판을 지나면 곧 파르디외의 유리탑이 눈에 들어와요.'],
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedPlan(plan) {
  return plan.segments.map((segment) => ({
    id: segment.id,
    from: segment.from,
    to: segment.to,
    stepsRle: segment.stepsRle,
    stepCount: segment.stepCount,
    tileCount: segment.tileCount,
    pathSha256: sha256(segment.pathBytes),
  }));
}

function markerTiles() {
  return [...LYON.nodes, ...LYON.stations, ...LYON.props].map(({ tile }) => tile);
}

function chebyshev(left, right) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

describe('리옹 mainRoute 정석 한 바퀴', () => {
  it('승인된 typed waypoint 9열과 URDL·비EXIT 계약을 exact 고정한다', () => {
    expect(MAIN_ROUTE.waypoints.map(({ kind, id }) => `${kind}:${id}`)).toEqual(WAYPOINTS);
    expect(MAIN_ROUTE.routing).toEqual({
      algorithm: 'cardinal-bfs-v1',
      neighborOrder: 'URDL',
      excludeExit: true,
    });
    expect(MAIN_ROUTE.segmentHints).toEqual([]);
    expect(MAIN_ROUTE.branches).toEqual([]);
  });

  it('planner 2회 산출과 저장 RLE·8개 pathSha256 pin이 byte-identical이다', () => {
    const grid = LYON.buildGrid();
    const first = planCityMainRoute(LYON, grid);
    const second = planCityMainRoute(LYON, grid);
    const firstJson = JSON.stringify(normalizedPlan(first));
    const secondJson = JSON.stringify(normalizedPlan(second));

    expect(firstJson).toBe(secondJson);
    expect(sha256(firstJson)).toBe('fbb1d8410062e67f56330a17cb0468f45cdabee8d7427389c26be7f3bf1381ae');
    expect(normalizedPlan(first).map(({ id, stepCount, tileCount, pathSha256 }) => (
      [id, stepCount, tileCount, pathSha256]
    ))).toEqual(SEGMENT_PINS);

    first.segments.forEach((planned, index) => {
      const stored = MAIN_ROUTE.segments[index];
      expect(stored.stepsRle).toEqual(planned.stepsRle);
      expect(stored.stepCount).toBe(planned.stepCount);
      expect(stored.tileCount).toBe(planned.tileCount);
      expect(stored.pathSha256).toBe(sha256(planned.pathBytes));
    });
  });

  it('508-step 경로가 waypoint를 순서대로 지나며 차단·EXIT·비4방 칸이 없다', () => {
    const grid = LYON.buildGrid();
    const route = resolveCityMainRoute(LYON, grid);

    expect(route.path).toHaveLength(509);
    expect(route.waypointOffsets).toEqual([0, 88, 125, 156, 233, 259, 324, 458, 508]);
    expect(sha256(encodeMainRoutePathIndices(route.pathIndices)))
      .toBe('782589e1aefed848f114874d22087a47ca3bbbcf0056a53064fd6d9ccd432c7c');

    route.path.forEach(([x, y], index) => {
      const code = grid[y * LYON.cols + x];
      expect(code).not.toBe(CITY_TILE.EXIT);
      expect(isCityBlocked(code)).toBe(false);
      if (index === 0) return;
      const [px, py] = route.path[index - 1];
      expect(Math.abs(x - px) + Math.abs(y - py)).toBe(1);
    });

    const waypointTiles = MAIN_ROUTE.waypoints.map(({ kind, id }) => {
      const collection = kind === 'node' ? LYON.nodes : LYON.stations;
      return collection.find((entry) => entry.id === id).tile;
    });
    expect(route.waypointOffsets.map((offset) => route.path[offset])).toEqual(waypointTiles);
  });

  it('정본 발견 8건의 카피와 waypointOffsets 기반 tileIndex를 exact 고정한다', () => {
    const route = resolveCityMainRoute(LYON);
    expect(route.discoveries.map(({ id, leg, at, routeIndex, tile, line }) => (
      [id, leg, at, routeIndex, tile, line]
    ))).toEqual(DISCOVERY_PINS);
    expect(route.discoveries.every(({ routeIndex, tile }) => route.path[routeIndex] === tile)).toBe(true);
  });

  it('프롭 2종을 곁 1타일·상호 12타일·기존 marker 3타일 이격으로 결정 배치한다', () => {
    const grid = LYON.buildGrid();
    const first = resolveCityMainRoute(LYON, grid);
    const second = resolveCityMainRoute(LYON, grid);
    const firstJson = JSON.stringify(first.props);

    expect(firstJson).toBe(JSON.stringify(second.props));
    expect(sha256(firstJson)).toBe('a5bf0c59854edac2c5909e26cf4900cdf9511d5b735305b129cdc60fc1e350c7');
    expect(first.props).toHaveLength(20);
    expect(new Set(first.props.map(({ kind }) => kind))).toEqual(new Set([
      'route_signpost',
      'route_streetlight',
    ]));

    const markers = markerTiles();
    first.props.forEach((prop, index) => {
      const [x, y] = prop.tile;
      expect(isCityBlocked(grid[y * LYON.cols + x])).toBe(false);
      expect(grid[y * LYON.cols + x]).not.toBe(CITY_TILE.EXIT);
      expect(first.tileSet.has(y * LYON.cols + x)).toBe(false);
      expect(Math.min(...first.path.map((tile) => (
        Math.abs(tile[0] - x) + Math.abs(tile[1] - y)
      )))).toBe(1);
      expect(Math.min(...markers.map((tile) => chebyshev(tile, prop.tile))))
        .toBeGreaterThanOrEqual(3);
      for (let other = 0; other < index; other += 1) {
        expect(chebyshev(first.props[other].tile, prop.tile)).toBeGreaterThanOrEqual(12);
      }
      if (prop.kind === 'route_streetlight') expect(prop.routeIndex % 12).toBe(0);
    });
  });
});
