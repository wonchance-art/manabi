import {
  TOKYO_PILOT_TILE,
  buildTokyoPilotGrid,
  isTokyoPilotWalkable,
  tokyoPilotMap,
} from '../../lib/tokyoPilotMap.js';

export const TOKYO_PILOT_TILE_PX = 16;
export const TOKYO_PILOT_STEP_MS = 105;

const TILE_COLOR = Object.freeze({
  [TOKYO_PILOT_TILE.FLOOR]: 0xb7b3a4,
  [TOKYO_PILOT_TILE.CROSSING]: 0xd8d4c3,
  [TOKYO_PILOT_TILE.PLATFORM]: 0x777b80,
  [TOKYO_PILOT_TILE.EXIT]: 0x9db77b,
});

export function tokyoPilotStepTarget(map, grid, tile, direction) {
  const delta = {
    up: [0, -1],
    right: [1, 0],
    down: [0, 1],
    left: [-1, 0],
  }[direction];
  if (!delta) return null;
  const x = tile[0] + delta[0];
  const y = tile[1] + delta[1];
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return null;
  return isTokyoPilotWalkable(grid[y * map.cols + x]) ? [x, y] : null;
}

export function nearestTokyoPilotAnchor(map, tile, maxDistance = 1) {
  let nearest = null;
  for (const anchor of map.anchors) {
    const distance = Math.abs(anchor.tile[0] - tile[0]) + Math.abs(anchor.tile[1] - tile[1]);
    if (distance > maxDistance) continue;
    if (!nearest || distance < nearest.distance) nearest = { anchor, distance };
  }
  return nearest?.anchor ?? null;
}

export function resolveTokyoPilotSpawn(map, grid, requestedSpawn) {
  const spawn = requestedSpawn ?? map.spawn;
  if (!Array.isArray(spawn) || spawn.length !== 2 || !spawn.every(Number.isInteger)) return [...map.spawn];
  const [x, y] = spawn;
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return [...map.spawn];
  return isTokyoPilotWalkable(grid[y * map.cols + x]) ? [x, y] : [...map.spawn];
}

/**
 * 회색 박스 전용 Phaser scene. 텍스트·콘텐츠·저장 상태는 소유하지 않으며, anchor 접근과
 * scene 준비만 ctx callback으로 전달한다. 실제 제품 배선 전 독립 하니스에서도 쓸 수 있다.
 */
export function buildTokyoPilotScene(Phaser, sceneId, ctx = {}) {
  const map = tokyoPilotMap(sceneId);

  return class TokyoPilotScene extends Phaser.Scene {
    constructor() { super(sceneId); }

    create(data = {}) {
      this.mapContract = map;
      this.grid = buildTokyoPilotGrid(sceneId);
      this.playerTile = resolveTokyoPilotSpawn(map, this.grid, data.spawn);
      this.lastStepAt = -Infinity;
      this.lastAnchorId = null;
      this.heldDirs = [];

      const backdrop = this.add.graphics();
      backdrop.fillStyle(0x20231f, 1);
      backdrop.fillRect(0, 0, map.cols * TOKYO_PILOT_TILE_PX, map.rows * TOKYO_PILOT_TILE_PX);
      for (let y = 0; y < map.rows; y += 1) {
        for (let x = 0; x < map.cols; x += 1) {
          const tile = this.grid[y * map.cols + x];
          if (!isTokyoPilotWalkable(tile)) continue;
          backdrop.fillStyle(TILE_COLOR[tile] ?? TILE_COLOR[TOKYO_PILOT_TILE.FLOOR], 1);
          backdrop.fillRect(
            x * TOKYO_PILOT_TILE_PX + 1,
            y * TOKYO_PILOT_TILE_PX + 1,
            TOKYO_PILOT_TILE_PX - 2,
            TOKYO_PILOT_TILE_PX - 2,
          );
        }
      }

      for (const anchor of map.anchors) {
        const marker = this.add.rectangle(
          anchor.tile[0] * TOKYO_PILOT_TILE_PX + TOKYO_PILOT_TILE_PX / 2,
          anchor.tile[1] * TOKYO_PILOT_TILE_PX + TOKYO_PILOT_TILE_PX / 2,
          6,
          6,
          anchor.kind === 'language' ? 0xf0c65a : 0x86b6d8,
        );
        marker.setDepth(2);
      }

      this.player = this.add.rectangle(0, 0, 10, 12, 0xf4efe0).setDepth(4);
      this.placePlayer();
      this.cursors = this.input.keyboard?.createCursorKeys?.() ?? null;
      this.cameras.main.setBounds(0, 0, map.cols * TOKYO_PILOT_TILE_PX, map.rows * TOKYO_PILOT_TILE_PX);
      this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
      this.cameras.main.setRoundPixels(true);
      ctx.onReady?.({ sceneId, spawn: [...this.playerTile] });
      this.emitNearbyAnchor();
    }

    extInputDown(direction) {
      if (!['up', 'right', 'down', 'left'].includes(direction)) return;
      this.heldDirs = this.heldDirs.filter((value) => value !== direction);
      this.heldDirs.push(direction);
    }

    extInputUp(direction) {
      this.heldDirs = this.heldDirs.filter((value) => value !== direction);
    }

    placePlayer() {
      this.player.setPosition(
        this.playerTile[0] * TOKYO_PILOT_TILE_PX + TOKYO_PILOT_TILE_PX / 2,
        this.playerTile[1] * TOKYO_PILOT_TILE_PX + TOKYO_PILOT_TILE_PX / 2,
      );
    }

    heldDirection() {
      if (this.heldDirs.length > 0) return this.heldDirs[this.heldDirs.length - 1];
      if (this.cursors?.up?.isDown) return 'up';
      if (this.cursors?.right?.isDown) return 'right';
      if (this.cursors?.down?.isDown) return 'down';
      if (this.cursors?.left?.isDown) return 'left';
      return null;
    }

    debugTeleportTo(x, y) {
      const spawn = resolveTokyoPilotSpawn(map, this.grid, [x, y]);
      if (spawn[0] !== x || spawn[1] !== y) return Promise.reject(new Error('invalid pilot tile'));
      this.playerTile = spawn;
      this.placePlayer();
      this.emitNearbyAnchor();
      return Promise.resolve(this.pilotRuntimeSnapshot());
    }

    pilotRuntimeSnapshot() {
      return Object.freeze({
        sceneId,
        tile: Object.freeze([...this.playerTile]),
        nearbyAnchorId: this.lastAnchorId,
      });
    }

    emitNearbyAnchor() {
      const anchor = nearestTokyoPilotAnchor(map, this.playerTile);
      const id = anchor?.id ?? null;
      if (id === this.lastAnchorId) return;
      this.lastAnchorId = id;
      ctx.onAnchorChange?.(anchor);
    }

    update(time) {
      const direction = this.heldDirection();
      if (!direction || time - this.lastStepAt < TOKYO_PILOT_STEP_MS) return;
      const target = tokyoPilotStepTarget(map, this.grid, this.playerTile, direction);
      if (!target) return;
      this.playerTile = target;
      this.lastStepAt = time;
      this.placePlayer();
      this.emitNearbyAnchor();
      ctx.onMove?.({ sceneId, tile: [...this.playerTile] });
    }
  };
}
