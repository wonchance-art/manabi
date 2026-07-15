import { avatarPalette } from '../../lib/world/avatar';
import { OverworldChunkLoader, overworldChunkKey } from '../../lib/world/overworldChunkLoader';
import { OVERWORLD_STORAGE_CHUNK_TILES } from '../../lib/world/overworldChunk';
import { corridorStopSpawn } from '../../lib/world/transsibCorridor';
import { overworldRegionSpawn } from '../../lib/world/overworldRegions';
import { PhaserOverworldPageRenderer } from './overworldPageRenderer';
import {
  CHAR_ORIGIN_Y,
  CHAR_WALK_CYCLE,
  ensureAvatarCharSet,
  toneColor,
  tonePalette,
} from './sprites';
import bus from './bus';

const TILE = 32;
const TEXTURE_TILE = 16;
const WORLD_SCALE = 2;
const STEP_MS = 180;
const CHAR_ANIM_MS = 100;
const EMIT_MS = 100;
const PAGE_WORLD_PIXELS = 32 * TILE;
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const VALID_DIR = new Set(Object.keys(DIRV));

const keyToDir = (key) => {
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    default: return null;
  }
};

const tileHash = (x, y) => {
  let value = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  value ^= value >>> 13;
  return value >>> 0;
};

const terrainTextureKey = ({ surface, globalX, globalY, valid }) => {
  if (!valid || surface === 0) return 't_water0';
  if (surface === 1) return 't_plain';
  if (surface === 2) return 't_grass';
  if (surface === 3) return ['t_mountain', 't_mountain_b', 't_mountain_c'][tileHash(globalX, globalY) % 3];
  if (surface === 4) return 't_peak';
  return 't_water0';
};

export function buildOverworldRegionScene(Phaser, region, ctx) {
  const worldWidth = region.width * TILE;
  const worldHeight = region.height * TILE;
  const avatarPrefix = `region_pc_${region.id.replace(/[^a-z0-9]/g, '_')}`;
  const gateTexture = `region_gate_${region.id}`;

  return class OverworldRegionScene extends Phaser.Scene {
    constructor() { super(region.sceneId); }

    preload() {
      this.mode = 'day';
      ensureAvatarCharSet(this, avatarPrefix, tonePalette(avatarPalette(ctx.avatarRef?.current), this.mode));
      if (!this.textures.exists(gateTexture)) {
        const gate = this.make.graphics({ add: false });
        gate.fillStyle(toneColor(0x3b2e2a, this.mode), 1).fillRect(2, 4, 12, 12);
        gate.fillStyle(toneColor(0xd7c59b, this.mode), 1).fillRect(3, 5, 10, 5);
        gate.fillStyle(toneColor(0x9f315d, this.mode), 1).fillRect(1, 2, 14, 4);
        gate.fillStyle(toneColor(0xf5ecd3, this.mode), 1).fillRect(5, 11, 6, 5);
        gate.generateTexture(gateTexture, 16, 20);
        gate.destroy();
      }
    }

    create(bootData) {
      ctx.bindScene?.(this);
      ctx.onEnter?.(region);
      this.destroyed = false;
      this.ready = false;
      this.inputLocked = true;
      this.runHeld = false;
      this.moving = false;
      this.stepPending = false;
      this.facing = 'down';
      this.heldDirs = [];
      this.lastEmit = -Infinity;
      this.lastDistanceEmit = -Infinity;
      this.nearGate = false;
      this.loadedChunks = new Map();
      this.otherScenePeerIds = new Set();

      this.chunkLoader = new OverworldChunkLoader({
        baseUrl: region.assetBaseUrl,
        manifest: region.manifest,
      });
      this.terrainPages = new PhaserOverworldPageRenderer(this, {
        loader: this.chunkLoader,
        textureKeyAt: terrainTextureKey,
        fallbackTextureKey: 't_water0',
        tilePixels: TEXTURE_TILE,
        worldScale: WORLD_SCALE,
        depth: 0,
      });

      const requested = bootData?.spawn?.scene === region.sceneId
        ? bootData.spawn
        : overworldRegionSpawn(region);
      this.pTileX = Number.isInteger(requested?.x) ? requested.x : region.gate.tile.x;
      this.pTileY = Number.isInteger(requested?.y) ? requested.y : region.gate.tile.y;
      this.player = this.add.image(
        this.pTileX * TILE + TILE / 2,
        this.pTileY * TILE + TILE / 2,
        `${avatarPrefix}_down_n`,
      ).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(2).setDepth(1000).setVisible(false);
      this.gateMarker = this.add.image(
        region.gate.tile.x * TILE + TILE / 2,
        (region.gate.tile.y + 1) * TILE,
        gateTexture,
      ).setOrigin(0.5, 1).setScale(2).setDepth(900);

      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setBackgroundColor('#6ba9cc');
      this.cameras.main.setRoundPixels(true);
      this.cameras.main.centerOn(this.player.x, this.player.y);
      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

      this.input.keyboard.on('keydown', (event) => this.extInputDown(keyToDir(event.key)));
      this.input.keyboard.on('keyup', (event) => this.extInputUp(keyToDir(event.key)));
      this.events.once('shutdown', () => {
        this.destroyed = true;
        this.heldDirs.length = 0;
        ctx.setNearGate?.(null);
        ctx.setStatus?.(null);
        this.terrainPages?.destroy();
        this.terrainPages = null;
        this.chunkLoader?.destroy();
        this.chunkLoader = null;
        this.loadedChunks.clear();
      });

      ctx.setStatus?.({ phase: 'loading', message: `${region.label} 지형을 불러오고 있어요.` });
      this.initializeSpawn().catch(() => {
        if (this.destroyed) return;
        ctx.setStatus?.({ phase: 'error', message: '지역 지형을 불러오지 못했어요. 다시 시도해 주세요.' });
      });
    }

    async initializeSpawn() {
      let spawnX = this.pTileX;
      let spawnY = this.pTileY;
      if (!await this.isWalkable(spawnX, spawnY)) {
        spawnX = region.gate.tile.x;
        spawnY = region.gate.tile.y;
      }
      if (!await this.isWalkable(spawnX, spawnY)) throw new Error('region gate spawn is not walkable');
      this.pTileX = spawnX;
      this.pTileY = spawnY;
      this.player.setPosition(spawnX * TILE + TILE / 2, spawnY * TILE + TILE / 2).setVisible(true);
      this.cameras.main.centerOn(this.player.x, this.player.y);
      await this.refreshTerrainPages(true, {
        x: Math.max(0, this.player.x - 160),
        y: Math.max(0, this.player.y - 144),
        width: 320,
        height: 288,
      });
      if (this.destroyed) return;
      this.ready = true;
      this.inputLocked = false;
      ctx.setStatus?.(null);
      this.refreshNearGate(true);
      ctx.onReady?.();
    }

    async ensureChunk(tx, ty) {
      if (!Number.isInteger(tx) || !Number.isInteger(ty)
        || tx < 0 || ty < 0 || tx >= region.width || ty >= region.height) return null;
      const cx = Math.floor(tx / OVERWORLD_STORAGE_CHUNK_TILES);
      const cy = Math.floor(ty / OVERWORLD_STORAGE_CHUNK_TILES);
      const key = overworldChunkKey(cx, cy);
      const cached = this.loadedChunks.get(key);
      if (cached) return cached;
      const chunk = await this.chunkLoader.load(cx, cy);
      if (!this.destroyed) this.loadedChunks.set(key, chunk);
      return chunk;
    }

    async isWalkable(tx, ty) {
      const chunk = await this.ensureChunk(tx, ty);
      if (!chunk) return false;
      const localX = tx % OVERWORLD_STORAGE_CHUNK_TILES;
      const localY = ty % OVERWORLD_STORAGE_CHUNK_TILES;
      return chunk.isWalkableAt(localX, localY);
    }

    extInputDown(direction) {
      if (!this.ready || this.inputLocked || !VALID_DIR.has(direction)) return;
      if (!this.heldDirs.includes(direction)) this.heldDirs.push(direction);
    }

    extInputUp(direction) {
      if (!direction) return;
      this.heldDirs = this.heldDirs.filter((value) => value !== direction);
    }

    async startStep(direction) {
      if (this.stepPending || this.moving || !this.ready) return;
      this.stepPending = true;
      const [dx, dy] = DIRV[direction];
      const tx = this.pTileX + dx;
      const ty = this.pTileY + dy;
      try {
        if (!await this.isWalkable(tx, ty) || this.destroyed) return;
        this.pTileX = tx;
        this.pTileY = ty;
        this.facing = direction;
        this.moving = true;
        this.tweens.add({
          targets: this.player,
          x: tx * TILE + TILE / 2,
          y: ty * TILE + TILE / 2,
          duration: this.runHeld ? STEP_MS / 2 : STEP_MS,
          ease: 'Linear',
          onComplete: () => {
            this.moving = false;
            this.refreshNearGate();
            this.refreshTerrainPages();
          },
        });
      } finally {
        this.stepPending = false;
      }
    }

    charTexture(time) {
      const base = ['left', 'right'].includes(this.facing) ? 'side' : this.facing;
      const pose = this.moving
        ? CHAR_WALK_CYCLE[Math.floor(time / CHAR_ANIM_MS) % CHAR_WALK_CYCLE.length]
        : 'n';
      return `${avatarPrefix}_${base}_${pose}`;
    }

    refreshNearGate(force = false) {
      const near = this.ready
        && Math.abs(this.pTileX - region.gate.tile.x) <= 1
        && Math.abs(this.pTileY - region.gate.tile.y) <= 1;
      if (!force && near === this.nearGate) return;
      this.nearGate = near;
      ctx.setNearGate?.(near ? { region, gate: region.gate } : null);
    }

    regionInteract() {
      if (this.nearGate && !this.inputLocked) ctx.requestGate?.({ region, gate: region.gate });
    }

    async enterCorridor() {
      if (!this.nearGate || this.inputLocked) return;
      const spawn = corridorStopSpawn(region.gate.corridorStopId);
      if (!spawn) return;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      ctx.setNearGate?.(null);
      ctx.setStatus?.({ phase: 'saving-gate', message: '횡단열차 플랫폼을 저장하고 있어요.' });
      const persisted = await ctx.persistPosition?.(spawn);
      if (!persisted || this.destroyed) {
        this.inputLocked = false;
        this.refreshNearGate(true);
        ctx.setStatus?.({ phase: 'error', message: '플랫폼 저장에 실패했어요. 연결을 확인해 주세요.' });
        return;
      }
      ctx.setStatus?.(null);
      this.scene.start('transsib-corridor', { spawn });
    }

    refreshTerrainPages(force = false, cameraOrView = this.cameras.main) {
      if (!this.terrainPages) return Promise.resolve(null);
      const view = cameraOrView?.worldView ?? cameraOrView;
      const width = view?.width ?? (view?.right - view?.x);
      const height = view?.height ?? (view?.bottom - view?.y);
      if (![view?.x, view?.y, width, height].every(Number.isFinite)) return Promise.resolve(null);
      const atEdge = view.x < PAGE_WORLD_PIXELS || view.y < PAGE_WORLD_PIXELS
        || view.x + width > worldWidth - PAGE_WORLD_PIXELS
        || view.y + height > worldHeight - PAGE_WORLD_PIXELS;
      const vector = this.moving ? DIRV[this.facing] : [0, 0];
      const update = this.terrainPages.updateCamera(cameraOrView, {
        direction: { x: vector[0], y: vector[1] },
        padding: atEdge ? 0 : 1,
        prefetch: atEdge ? 0 : 1,
        force,
      });
      update.catch(() => {});
      return update;
    }

    applyPeers(incoming) {
      this.otherScenePeerIds = new Set(Object.keys(incoming || {}));
    }

    update(time) {
      if (this.ready && !this.inputLocked && !this.moving && !this.stepPending && this.heldDirs.length) {
        this.startStep(this.heldDirs.at(-1));
      }
      if (this.player.visible) {
        this.player.setTexture(this.charTexture(time)).setFlipX(this.facing === 'right');
      }
      if (this.ready && time - this.lastEmit >= EMIT_MS) {
        this.lastEmit = time;
        bus.emit('local:state', {
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          dir: this.facing,
          scene: region.sceneId,
          persistable: true,
        });
      }
      if (time - this.lastDistanceEmit >= 500) {
        this.lastDistanceEmit = time;
        const distances = {};
        for (const id of this.otherScenePeerIds) distances[id] = Infinity;
        bus.emit('peers:dist', distances);
      }
    }
  };
}
