/**
 * 도쿄 현지어 파일럿 회색 박스의 공간 계약.
 *
 * 실제 도쿄 geo는 도시 간 관계의 정본으로 남기고, 이 모듈은 짧게 걸으며 언어 행동을
 * 수행하는 두 플레이 장면만 선언한다. 렌더러·Phaser에 의존하지 않는다.
 */

export const TOKYO_PILOT_SCENE = Object.freeze({
  HANEDA: 'tokyo-pilot:haneda',
  TRAIN: 'tokyo-pilot:train',
  SHIBUYA: 'tokyo-pilot:shibuya',
});

export const TOKYO_PILOT_TILE = Object.freeze({
  WALL: 0,
  FLOOR: 1,
  CROSSING: 2,
  PLATFORM: 3,
  EXIT: 4,
});

const R = (x, y, w, h, tile = TOKYO_PILOT_TILE.FLOOR) => Object.freeze({ x, y, w, h, tile });
const A = (id, kind, x, y) => Object.freeze({ id, kind, tile: Object.freeze([x, y]) });

export const TOKYO_PILOT_MAPS = Object.freeze({
  [TOKYO_PILOT_SCENE.HANEDA]: Object.freeze({
    id: TOKYO_PILOT_SCENE.HANEDA,
    cols: 32,
    rows: 24,
    spawn: Object.freeze([4, 4]),
    // 도착 게이트 → 안내 홀 → 철도 복도 → 개찰 → 플랫폼. 버스 쪽은 짧은 회복 가지다.
    walkableRects: Object.freeze([
      R(2, 2, 10, 6), R(7, 6, 17, 8), R(20, 8, 8, 5),
      R(24, 11, 5, 7), R(4, 11, 8, 5),
      R(10, 17, 19, 4, TOKYO_PILOT_TILE.PLATFORM),
    ]),
    anchors: Object.freeze([
      A('haneda-arrivals-exit', 'checkpoint', 9, 6),
      A('haneda-rail-sign', 'language', 17, 9),
      A('haneda-bus-recovery', 'recovery', 6, 14),
      A('haneda-station-agent', 'language', 25, 13),
      A('haneda-ticket-gate', 'gate', 26, 16),
      A('haneda-train-door', 'scene-exit', 25, 19),
    ]),
  }),
  [TOKYO_PILOT_SCENE.TRAIN]: Object.freeze({
    id: TOKYO_PILOT_SCENE.TRAIN,
    cols: 24,
    rows: 12,
    spawn: Object.freeze([3, 6]),
    // 차내 이동 → 방송 확인 → 시부야 문. 장거리 지형 보행을 짧은 승차 장면으로 치환한다.
    walkableRects: Object.freeze([
      R(2, 3, 20, 7, TOKYO_PILOT_TILE.PLATFORM),
      R(20, 4, 2, 5, TOKYO_PILOT_TILE.EXIT),
    ]),
    anchors: Object.freeze([
      A('train-haneda-door', 'checkpoint', 3, 6),
      A('train-arrival-announcement', 'language', 12, 4),
      A('train-shibuya-door', 'scene-exit', 20, 6),
    ]),
  }),
  [TOKYO_PILOT_SCENE.SHIBUYA]: Object.freeze({
    id: TOKYO_PILOT_SCENE.SHIBUYA,
    cols: 40,
    rows: 30,
    spawn: Object.freeze([5, 4]),
    // 플랫폼 → 개찰/출구 → 교차로 → 큰길/골목 → 카페. 잘못된 출구도 본동선으로 돌아온다.
    walkableRects: Object.freeze([
      R(2, 2, 17, 6, TOKYO_PILOT_TILE.PLATFORM), R(14, 6, 8, 8),
      R(5, 10, 11, 6), R(20, 10, 8, 7),
      R(12, 14, 19, 10, TOKYO_PILOT_TILE.CROSSING),
      R(28, 17, 9, 5), R(32, 20, 5, 8),
      R(20, 22, 15, 6), R(8, 21, 13, 5),
    ]),
    anchors: Object.freeze([
      A('shibuya-platform-arrival', 'checkpoint', 5, 4),
      A('shibuya-wrong-exit', 'recovery', 8, 13),
      A('shibuya-crossing-exit', 'gate', 23, 13),
      A('shibuya-crossing', 'checkpoint', 24, 19),
      A('shibuya-direction-npc', 'language', 33, 20),
      A('shibuya-cafe-door', 'gate', 33, 25),
      A('shibuya-cafe-order', 'language', 27, 25),
      A('shibuya-meeting', 'journey-end', 23, 25),
    ]),
  }),
});

function assert(condition, message) {
  if (!condition) throw new Error(`tokyoPilotMap: ${message}`);
}

export function tokyoPilotMap(sceneId) {
  const map = TOKYO_PILOT_MAPS[sceneId];
  assert(map, `unknown scene: ${String(sceneId)}`);
  return map;
}

export function buildTokyoPilotGrid(sceneId) {
  const map = tokyoPilotMap(sceneId);
  const grid = new Uint8Array(map.cols * map.rows);
  for (const rect of map.walkableRects) {
    assert(rect.w > 0 && rect.h > 0, 'rectangle dimensions must be positive');
    assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= map.cols && rect.y + rect.h <= map.rows, 'rectangle is out of bounds');
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      grid.fill(rect.tile, y * map.cols + rect.x, y * map.cols + rect.x + rect.w);
    }
  }
  return grid;
}

export function tokyoPilotAnchor(sceneId, anchorId) {
  const anchor = tokyoPilotMap(sceneId).anchors.find(({ id }) => id === anchorId);
  assert(anchor, `unknown anchor: ${String(anchorId)}`);
  return anchor;
}

export function isTokyoPilotWalkable(tile) {
  return tile !== TOKYO_PILOT_TILE.WALL;
}

export function validateTokyoPilotMap(sceneId) {
  const map = tokyoPilotMap(sceneId);
  const grid = buildTokyoPilotGrid(sceneId);
  const ids = new Set();
  const index = (x, y) => y * map.cols + x;

  for (const anchor of map.anchors) {
    assert(!ids.has(anchor.id), `duplicate anchor: ${anchor.id}`);
    ids.add(anchor.id);
    const [x, y] = anchor.tile;
    assert(Number.isInteger(x) && Number.isInteger(y), `anchor must use integer tiles: ${anchor.id}`);
    assert(x >= 0 && y >= 0 && x < map.cols && y < map.rows, `anchor is out of bounds: ${anchor.id}`);
    assert(isTokyoPilotWalkable(grid[index(x, y)]), `anchor is blocked: ${anchor.id}`);
  }

  const [sx, sy] = map.spawn;
  assert(isTokyoPilotWalkable(grid[index(sx, sy)]), 'spawn is blocked');
  const seen = new Uint8Array(grid.length);
  const queue = [index(sx, sy)];
  seen[queue[0]] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const x = current % map.cols;
    const y = Math.floor(current / map.cols);
    for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]) {
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      const next = index(nx, ny);
      if (seen[next] || !isTokyoPilotWalkable(grid[next])) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  for (const anchor of map.anchors) {
    assert(seen[index(anchor.tile[0], anchor.tile[1])] === 1, `anchor is unreachable: ${anchor.id}`);
  }

  return Object.freeze({
    sceneId,
    walkableTiles: queue.length,
    anchorCount: map.anchors.length,
  });
}
