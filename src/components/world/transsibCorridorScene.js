import {
  CHAR_ORIGIN_Y, CHAR_WALK_CYCLE,
  ensureAvatarCharSet, toneColor, tonePalette,
} from './sprites';
import { avatarPalette } from '../../lib/world/avatar';
import {
  TRANS_SIBERIAN_CORRIDOR,
  corridorStopSpawn,
  corridorTripStateAt,
  disembarkCorridorTrip,
  isCorridorPlatformTile,
  persistCorridorTerminalBeforeBoard,
  prepareCorridorTrip,
} from '../../lib/world/transsibCorridor';
import {
  overworldRegionForCorridorStop,
  overworldRegionSpawnForCorridorStop,
} from '../../lib/world/overworldRegions';
import bus from './bus';

const TILE = 32;
const ROWS = 13;
const WORLD_COLS = 209;
const WORLD_W = WORLD_COLS * TILE;
const WORLD_H = ROWS * TILE;
const PLATFORM_MIN_Y = 7;
const PLATFORM_MAX_Y = 10;
const PLATFORM_RADIUS = 4;
const STEP_MS = 180;
const CHAR_ANIM_MS = 100;
const EMIT_MS = 100;
const STATUS_MS = 250;
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const VALID_DIR = new Set(Object.keys(DIRV));

function keyToDir(key) {
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    default: return null;
  }
}

const stopById = (id) => TRANS_SIBERIAN_CORRIDOR.stops.find((stop) => stop.id === id) || null;
const terminalStops = () => [TRANS_SIBERIAN_CORRIDOR.stops[0], TRANS_SIBERIAN_CORRIDOR.stops.at(-1)];
const statusKey = (state) => [state?.phase, state?.stopId, state?.fromId, state?.toId, state?.message].join(':');

export function buildTranssibCorridorScene(Phaser, ctx) {
  return class TranssibCorridorScene extends Phaser.Scene {
    constructor() { super(TRANS_SIBERIAN_CORRIDOR.sceneId); }

    preload() {
      this.mode = 'day';
      ensureAvatarCharSet(this, 'ts_pc', tonePalette(avatarPalette(ctx.avatarRef?.current), this.mode));
      const train = this.make.graphics({ add: false });
      train.fillStyle(toneColor(0x263a5f, this.mode), 1).fillRect(0, 2, 48, 18);
      train.fillStyle(toneColor(0xe8dec2, this.mode), 1).fillRect(5, 5, 10, 6);
      train.fillRect(19, 5, 10, 6); train.fillRect(33, 5, 10, 6);
      train.fillStyle(toneColor(0xb33b36, this.mode), 1).fillRect(0, 14, 48, 4);
      train.fillStyle(toneColor(0x1b1d24, this.mode), 1).fillCircle(10, 20, 3).fillCircle(38, 20, 3);
      train.generateTexture('ts_train', 48, 24); train.destroy();
    }

    create(bootData) {
      ctx.bindScene?.(this);
      ctx.onEnter?.();
      this.inputLocked = false;
      this.runHeld = false;
      this.moving = false;
      this.facing = 'down';
      this.heldDirs = [];
      this.trip = null;
      this.currentTripState = null;
      this.disembarking = false;
      this.lastEmit = -Infinity;
      this.lastStatusUpdate = -Infinity;
      this.lastStatusKey = '';
      this.nearStopId = null;
      this.peers = new Map();
      this.otherScenePeerIds = new Set();

      this.drawCorridor();
      const requested = bootData?.spawn?.scene === TRANS_SIBERIAN_CORRIDOR.sceneId
        ? bootData.spawn : corridorStopSpawn(TRANS_SIBERIAN_CORRIDOR.stops[0].id);
      const startStop = TRANS_SIBERIAN_CORRIDOR.stops.find(
        (stop) => stop.tile[0] === requested?.x && stop.tile[1] === requested?.y,
      ) || TRANS_SIBERIAN_CORRIDOR.stops[0];
      this.currentStopId = startStop.id;
      this.pTileX = startStop.tile[0];
      this.pTileY = startStop.tile[1];
      this.player = this.add.image(
        this.pTileX * TILE + TILE / 2,
        this.pTileY * TILE + TILE / 2,
        'ts_pc_down_n',
      ).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(2).setDepth(1000);
      this.train = this.add.image(startStop.tile[0] * TILE + TILE / 2, 5.8 * TILE, 'ts_train')
        .setScale(2).setDepth(900);

      this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
      this.cameras.main.setBackgroundColor('#b9d3df');
      this.cameras.main.setRoundPixels(true);
      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

      this.input.keyboard.on('keydown', (event) => this.extInputDown(keyToDir(event.key)));
      this.input.keyboard.on('keyup', (event) => this.extInputUp(keyToDir(event.key)));
      this.events.once('shutdown', () => {
        this.heldDirs.length = 0;
        ctx.setNearStop?.(null);
        ctx.setStatus?.(null);
      });
      this.refreshNearStop(true);
      ctx.onReady?.();
    }

    drawCorridor() {
      const graphics = this.add.graphics().setDepth(-10);
      graphics.fillStyle(0xb9d3df, 1).fillRect(0, 0, WORLD_W, WORLD_H);
      graphics.fillStyle(0x718694, 1).fillRect(0, 0, WORLD_W, TILE * 4);
      graphics.fillStyle(0x5b4636, 1).fillRect(0, TILE * 5, WORLD_W, 5);
      graphics.fillRect(0, TILE * 6 - 6, WORLD_W, 5);
      for (let x = 0; x < WORLD_W; x += 20) graphics.fillRect(x, TILE * 5 - 4, 5, TILE + 8);
      for (const stop of TRANS_SIBERIAN_CORRIDOR.stops) {
        const left = (stop.tile[0] - PLATFORM_RADIUS) * TILE;
        graphics.fillStyle(0xd6c8aa, 1).fillRect(left, PLATFORM_MIN_Y * TILE, (PLATFORM_RADIUS * 2 + 1) * TILE, 4 * TILE);
        graphics.fillStyle(0xeee2c4, 1).fillRect(left, PLATFORM_MIN_Y * TILE, (PLATFORM_RADIUS * 2 + 1) * TILE, 8);
        graphics.fillStyle(0x8e6e49, 1).fillRect(left, PLATFORM_MAX_Y * TILE + 24, (PLATFORM_RADIUS * 2 + 1) * TILE, 8);
        this.add.text(stop.tile[0] * TILE + TILE / 2, 7.5 * TILE, stop.name, {
          fontFamily: "'Galmuri9', monospace", fontSize: '10px', color: '#2a2118',
          backgroundColor: '#f6edcf', padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 1).setDepth(10);
      }
    }

    charTexture(time) {
      const base = ['left', 'right'].includes(this.facing) ? 'side' : this.facing;
      const pose = this.moving
        ? CHAR_WALK_CYCLE[Math.floor(time / CHAR_ANIM_MS) % CHAR_WALK_CYCLE.length] : 'n';
      return `ts_pc_${base}_${pose}`;
    }

    extInputDown(direction) {
      if (this.trip || this.inputLocked || !VALID_DIR.has(direction)) return;
      if (!this.heldDirs.includes(direction)) this.heldDirs.push(direction);
    }

    extInputUp(direction) {
      if (!direction) return;
      this.heldDirs = this.heldDirs.filter((value) => value !== direction);
    }

    blocked(tx, ty) {
      const stop = stopById(this.currentStopId);
      if (!stop) return true;
      return ty < PLATFORM_MIN_Y || ty > PLATFORM_MAX_Y
        || tx < stop.tile[0] - PLATFORM_RADIUS || tx > stop.tile[0] + PLATFORM_RADIUS;
    }

    startStep(direction) {
      const [dx, dy] = DIRV[direction];
      const tx = this.pTileX + dx, ty = this.pTileY + dy;
      if (this.blocked(tx, ty)) return;
      this.pTileX = tx; this.pTileY = ty; this.facing = direction; this.moving = true;
      this.tweens.add({
        targets: this.player,
        x: tx * TILE + TILE / 2,
        y: ty * TILE + TILE / 2,
        duration: this.runHeld ? STEP_MS / 2 : STEP_MS,
        ease: 'Linear',
        onComplete: () => { this.moving = false; this.refreshNearStop(); },
      });
    }

    refreshNearStop(force = false) {
      if (this.trip) return;
      const stop = stopById(this.currentStopId);
      const near = stop && Math.abs(this.pTileX - stop.tile[0]) <= 1 && Math.abs(this.pTileY - stop.tile[1]) <= 1
        ? stop : null;
      if (!force && near?.id === this.nearStopId) return;
      this.nearStopId = near?.id || null;
      ctx.setNearStop?.(near);
    }

    corridorInteract() {
      if (this.trip && this.currentTripState?.canDisembark) {
        this.disembarkCurrent();
        return;
      }
      if (this.trip || !this.nearStopId) return;
      const currentIndex = TRANS_SIBERIAN_CORRIDOR.stops.findIndex((stop) => stop.id === this.nearStopId);
      const options = terminalStops().filter((stop, index) => (index === 0 ? currentIndex > 0 : currentIndex < TRANS_SIBERIAN_CORRIDOR.stops.length - 1));
      ctx.requestBoarding?.({
        stop: stopById(this.nearStopId),
        options,
        regionGate: overworldRegionForCorridorStop(this.nearStopId),
      });
    }

    async leaveToRegion() {
      if (this.trip || !this.nearStopId || this.inputLocked) return;
      const region = overworldRegionForCorridorStop(this.nearStopId);
      const spawn = overworldRegionSpawnForCorridorStop(this.nearStopId);
      if (!region || !spawn) return;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      ctx.setNearStop?.(null);
      ctx.setStatus?.({ phase: 'saving-region', message: `${region.label} 진입 위치를 저장하고 있어요.` });
      const persisted = await ctx.persistPosition(spawn);
      if (!persisted) {
        this.inputLocked = false;
        this.refreshNearStop(true);
        ctx.setStatus?.({ phase: 'error', message: '지역 진입 위치를 저장하지 못했어요. 연결을 확인해 주세요.' });
        return;
      }
      ctx.setStatus?.(null);
      this.scene.start(region.sceneId, { spawn });
    }

    async boardTo(terminalId) {
      if (this.trip || !this.nearStopId) return;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      ctx.setNearStop?.(null);
      ctx.setStatus?.({ phase: 'saving', message: '종착역을 먼저 저장하고 있어요.' });
      try {
        const prepared = prepareCorridorTrip({
          originId: this.nearStopId,
          terminalId,
          nowMinute: ctx.worldClockRef.current.totalGameMinutes,
        });
        this.trip = await persistCorridorTerminalBeforeBoard(prepared, ctx.persistPosition);
        this.player.setVisible(false);
        this.cameras.main.stopFollow();
        this.cameras.main.startFollow(this.train, true, 0.18, 0.18);
        this.syncTrip(true);
      } catch (error) {
        this.trip = null;
        this.inputLocked = false;
        this.refreshNearStop(true);
        ctx.setStatus?.({
          phase: 'error',
          message: '종착역 저장에 실패했어요. 연결을 확인하고 다시 시도해 주세요.',
        });
      }
    }

    syncTrip(force = false) {
      if (!this.trip) return;
      const state = corridorTripStateAt(this.trip, ctx.worldClockRef.current.totalGameMinutes);
      this.currentTripState = state;
      let x = this.train.x;
      if (state.phase === 'riding') {
        const from = stopById(state.fromId), to = stopById(state.toId);
        x = (from.tile[0] + (to.tile[0] - from.tile[0]) * state.progress) * TILE + TILE / 2;
      } else if (state.stopId) {
        x = stopById(state.stopId).tile[0] * TILE + TILE / 2;
      } else if (state.phase === 'waiting') {
        x = stopById(this.trip.originId).tile[0] * TILE + TILE / 2;
      }
      this.train.setPosition(Math.round(x), 5.8 * TILE);
      const key = statusKey(state);
      if (force || key !== this.lastStatusKey) {
        this.lastStatusKey = key;
        ctx.setStatus?.({
          ...state,
          stop: stopById(state.stopId),
          terminal: stopById(this.trip.terminalId),
          routeId: this.trip.routeId,
        });
      }
    }

    async disembarkCurrent() {
      if (this.disembarking || !this.trip || !this.currentTripState?.canDisembark) return;
      this.disembarking = true;
      const trip = this.trip;
      const state = this.currentTripState;
      const result = disembarkCorridorTrip(trip, state);
      ctx.setStatus?.({ phase: 'saving-stop', stopId: state.stopId, message: '하차 위치를 저장하고 있어요.' });
      try {
        const alreadyPersisted = state.stopId === trip.terminalId;
        const saved = alreadyPersisted || await ctx.persistPosition(result.spawn);
        if (!saved) throw new Error('하차 위치를 저장하지 못했어요. 열차 안에서 다시 시도해 주세요.');
        this.trip = null;
        this.currentTripState = null;
        this.currentStopId = state.stopId;
        this.placeAtStop(state.stopId);
        this.inputLocked = false;
        this.player.setVisible(true);
        this.cameras.main.stopFollow();
        this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
        ctx.setStatus?.(null);
        this.refreshNearStop(true);
      } catch (error) {
        ctx.setStatus?.({ ...state, phase: 'error', message: error?.message || '하차할 수 없어요.' });
      } finally {
        this.disembarking = false;
      }
    }

    placeAtStop(stopId) {
      const stop = stopById(stopId);
      this.pTileX = stop.tile[0]; this.pTileY = stop.tile[1]; this.facing = 'down'; this.moving = false;
      this.player.setPosition(this.pTileX * TILE + TILE / 2, this.pTileY * TILE + TILE / 2).setDepth(1000);
      this.train.setPosition(this.pTileX * TILE + TILE / 2, 5.8 * TILE);
    }

    applyPeers(incoming) {
      this.otherScenePeerIds = new Set(Object.keys(incoming || {}));
    }

    update(time) {
      if (this.trip && time - this.lastStatusUpdate >= STATUS_MS) {
        this.lastStatusUpdate = time;
        this.syncTrip();
      }
      if (!this.trip && !this.inputLocked && !this.moving && this.heldDirs.length) {
        this.startStep(this.heldDirs.at(-1));
      }
      if (this.player.visible) {
        this.player.setTexture(this.charTexture(time)).setFlipX(this.facing === 'right');
      }
      if (time - this.lastEmit >= EMIT_MS) {
        this.lastEmit = time;
        const source = this.trip ? this.train : this.player;
        bus.emit('local:state', {
          x: Math.round(source.x), y: Math.round(source.y), dir: this.facing,
          scene: TRANS_SIBERIAN_CORRIDOR.sceneId,
          persistable: !this.trip && isCorridorPlatformTile(this.pTileX, this.pTileY),
        });
      }
      if (time - (this.lastDistanceEmit || 0) >= 500) {
        this.lastDistanceEmit = time;
        const distances = {};
        for (const id of this.otherScenePeerIds) distances[id] = Infinity;
        bus.emit('peers:dist', distances);
      }
    }
  };
}
