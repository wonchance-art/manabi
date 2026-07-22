import { avatarPalette } from '../../lib/world/avatar';
import {
  EMEA_RAIL_NETWORK,
  arriveEmeaRailTrip,
  boardEmeaRailTrip,
  continueEmeaRailTrip,
  disembarkEmeaRailTrip,
  emeaRailDestinations,
  emeaRailSegmentPresentation,
  persistEmeaRailTerminalBeforeBoard,
  planEmeaRailRoute,
  prepareEmeaRailTrip,
} from '../../lib/world/emeaRail';
import { OverworldChunkLoader, overworldChunkKey } from '../../lib/world/overworldChunkLoader';
import { OVERWORLD_STORAGE_CHUNK_TILES } from '../../lib/world/overworldChunk';
import { overworldRenderPageKeyAtWorldPixel } from '../../lib/world/overworldRenderPages';
import { canAccessCorridor, corridorStopSpawn } from '../../lib/world/transsibCorridor';
import { overworldRegionSpawn } from '../../lib/world/overworldRegions';
import { OverworldTransportNodeLoader } from '../../lib/world/overworldTransportNodes';
import {
  nearestOverworldRegionWorldNode,
  overworldRegionWorldNodes,
  resolveOverworldRegionFerry,
} from '../../lib/world/overworldRegionWorldNodes';
import { PhaserOverworldPageRenderer } from './overworldPageRenderer';
import { PhaserOverworldChunkOverlayRenderer } from './overworldChunkOverlayRenderer';
import {
  CHAR_ORIGIN_Y,
  CHAR_WALK_CYCLE,
  ensureAvatarCharSet,
  toneColor,
  tonePalette,
} from './sprites';
import bus from './bus';
import { overworldRegionAvatarPrefix } from './avatarRebake';
import { presentQuestDone, presentQuestScored } from './stampCollectionPresentation';

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
  const avatarPrefix = overworldRegionAvatarPrefix(region.id); // avatarRebake.js 공유 계약과 단일 소스
  const railGateTexture = `region_rail_gate_${region.id}`;
  const airGateTexture = `region_air_gate_${region.id}`;
  const worldNodeTexture = `region_world_node_${region.id}`;
  const ferryTexture = `region_ferry_${region.id}`;
  const questHeartTexture = `region_quest_heart_${region.id}`;
  const railHubs = region.sceneId === EMEA_RAIL_NETWORK.sceneId
    ? EMEA_RAIL_NETWORK.hubs.map((hub) => Object.freeze({
      ...hub,
      type: 'rail-hub',
      tile: Object.freeze({ x: hub.tile[0], y: hub.tile[1] }),
    }))
    : [];
  const railHubById = (hubId) => railHubs.find((hub) => hub.id === hubId) || null;

  return class OverworldRegionScene extends Phaser.Scene {
    constructor() { super(region.sceneId); }

    preload() {
      this.mode = 'day';
      ensureAvatarCharSet(this, avatarPrefix, tonePalette(avatarPalette(ctx.avatarRef?.current), this.mode), { shape: ctx.avatarRef?.current });
      if (!this.textures.exists(railGateTexture)) {
        const gate = this.make.graphics({ add: false });
        gate.fillStyle(toneColor(0x3b2e2a, this.mode), 1).fillRect(2, 4, 12, 12);
        gate.fillStyle(toneColor(0xd7c59b, this.mode), 1).fillRect(3, 5, 10, 5);
        gate.fillStyle(toneColor(0x9f315d, this.mode), 1).fillRect(1, 2, 14, 4);
        gate.fillStyle(toneColor(0xf5ecd3, this.mode), 1).fillRect(5, 11, 6, 5);
        gate.generateTexture(railGateTexture, 16, 20);
        gate.destroy();
      }
      if (!this.textures.exists(airGateTexture)) {
        const gate = this.make.graphics({ add: false });
        gate.fillStyle(toneColor(0xf5ecd3, this.mode), 1).fillRect(1, 7, 14, 3);
        gate.fillStyle(toneColor(0x285a77, this.mode), 1).fillRect(6, 1, 4, 15);
        gate.fillStyle(toneColor(0x285a77, this.mode), 1).fillRect(2, 5, 12, 4);
        gate.fillStyle(toneColor(0x9f315d, this.mode), 1).fillRect(7, 14, 2, 4);
        gate.generateTexture(airGateTexture, 16, 20);
        gate.destroy();
      }
      if (!this.textures.exists(worldNodeTexture)) {
        const marker = this.make.graphics({ add: false });
        marker.fillStyle(toneColor(0xf5ecd3, this.mode), 1).fillCircle(8, 7, 6);
        marker.fillStyle(toneColor(0x9f315d, this.mode), 1).fillCircle(8, 7, 3);
        marker.fillStyle(toneColor(0x3b2e2a, this.mode), 1).fillTriangle(5, 10, 11, 10, 8, 17);
        marker.generateTexture(worldNodeTexture, 16, 18);
        marker.destroy();
      }
      if (!this.textures.exists(ferryTexture)) {
        const ferry = this.make.graphics({ add: false });
        ferry.fillStyle(toneColor(0x285a77, this.mode), 1).fillRect(1, 10, 14, 5);
        ferry.fillStyle(toneColor(0xf5ecd3, this.mode), 1).fillRect(3, 5, 10, 6);
        ferry.fillStyle(toneColor(0x9f315d, this.mode), 1).fillRect(9, 2, 3, 4);
        ferry.fillStyle(toneColor(0x8fc7dd, this.mode), 1).fillRect(4, 7, 2, 2).fillRect(7, 7, 2, 2);
        ferry.generateTexture(ferryTexture, 16, 16);
        ferry.destroy();
      }
      if (!this.textures.exists(questHeartTexture)) {
        const heart = this.make.graphics({ add: false });
        heart.fillStyle(toneColor(0xe0556a, this.mode), 1);
        heart.fillRect(1, 1, 2, 2); heart.fillRect(5, 1, 2, 2);
        heart.fillRect(0, 2, 8, 2); heart.fillRect(1, 4, 6, 1);
        heart.fillRect(2, 5, 4, 1); heart.fillRect(3, 6, 2, 1);
        heart.fillStyle(toneColor(0xf59caa, this.mode), 1).fillRect(1, 2, 1, 1);
        heart.generateTexture(questHeartTexture, 8, 7);
        heart.destroy();
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
      this.ferrying = false;
      this.railTrip = null;
      this.railDisembarking = false;
      this.ferryBoat = null;
      this.facing = 'down';
      this.heldDirs = [];
      this.lastEmit = -Infinity;
      this.lastDistanceEmit = -Infinity;
      this.nearGate = null;
      this.nearWorldNode = null;
      this.activeGate = null;
      this.transportGates = [];
      this.worldNodeEntries = overworldRegionWorldNodes(region, ctx.worldNodes);
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
      this.featureOverlays = new PhaserOverworldChunkOverlayRenderer(this, {
        sources: region.overlaySources,
        baseUrl: region.assetBaseUrl,
        tilePixels: TEXTURE_TILE,
        worldScale: WORLD_SCALE,
      });
      this.transportNodes = new OverworldTransportNodeLoader({
        baseUrl: region.assetBaseUrl,
        source: region.nodeSource,
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
      this.gateMarkers = new Map();

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
        ctx.setNearNode?.(null);
        ctx.setStatus?.(null);
        this.terrainPages?.destroy();
        this.terrainPages = null;
        this.featureOverlays?.destroy();
        this.featureOverlays = null;
        this.transportNodes?.destroy();
        this.transportNodes = null;
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
      const configuredGates = [region.gate, region.airGate, ...railHubs].filter(Boolean);
      const resolvedGates = await Promise.all(configuredGates.map(async (configured) => {
        const matchingNodes = await this.transportNodes.loadAtTile(configured.tile.x, configured.tile.y);
        const node = matchingNodes.find(({ id }) => id === configured.id);
        const variantMatches = configured.type === 'transsib-gate'
          ? node?.corridorStopId === configured.corridorStopId
          : configured.type === 'air-gate'
            ? node?.airportCode === configured.airportCode
            : configured.type === 'rail-hub' && Array.isArray(node?.arrivalOffset);
        if (!node || node.type !== configured.type || node.label !== configured.label
          || node.contentLocale !== configured.contentLocale || !variantMatches) {
          throw new Error('region gate transport node contract drifted');
        }
        return Object.freeze({
          ...configured,
          tile: Object.freeze({ x: node.tile[0], y: node.tile[1] }),
        });
      }));
      this.transportGates = resolvedGates;
      this.activeGate = resolvedGates.find(({ type }) => type === 'transsib-gate') || null;
      for (const gate of resolvedGates) {
        const texture = gate.type === 'air-gate' ? airGateTexture : railGateTexture;
        const marker = this.add.image(
          gate.tile.x * TILE + TILE / 2,
          (gate.tile.y + 1) * TILE,
          texture,
        ).setOrigin(0.5, 1).setScale(2).setDepth(900).setVisible(true);
        this.gateMarkers.set(gate.id, marker);
      }
      this.worldNodeMarkers = this.worldNodeEntries
        .filter(({ interactive }) => interactive)
        .map(({ node, tile }) => this.add.image(
          tile[0] * TILE + TILE / 2,
          (tile[1] + 1) * TILE,
          worldNodeTexture,
        ).setOrigin(0.5, 1).setScale(2).setDepth(850).setVisible(true).setData('nodeId', node.id));
      let spawnX = this.pTileX;
      let spawnY = this.pTileY;
      if (!await this.isWalkable(spawnX, spawnY)) {
        const fallbackGate = this.activeGate || this.transportGates[0];
        spawnX = fallbackGate.tile.x;
        spawnY = fallbackGate.tile.y;
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
      await this.refreshFeatureOverlays(true, {
        x: Math.max(0, this.player.x - 160),
        y: Math.max(0, this.player.y - 144),
        width: 320,
        height: 288,
      }).catch(() => null);
      if (this.destroyed) return;
      this.ready = true;
      this.inputLocked = false;
      ctx.setStatus?.(null);
      this.refreshNearInteraction(true);
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
            this.refreshNearInteraction();
            this.refreshTerrainPages();
            this.refreshFeatureOverlays();
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

    refreshNearInteraction(force = false) {
      const near = this.ready
        ? this.transportGates
          .filter((gate) => Math.abs(this.pTileX - gate.tile.x) <= 1
            && Math.abs(this.pTileY - gate.tile.y) <= 1)
          .sort((left, right) => (
            Math.abs(this.pTileX - left.tile.x) + Math.abs(this.pTileY - left.tile.y)
          ) - (
            Math.abs(this.pTileX - right.tile.x) + Math.abs(this.pTileY - right.tile.y)
          ))[0] || null
        : null;
      const nearWorldNode = this.ready && !near
        ? nearestOverworldRegionWorldNode(this.worldNodeEntries, this.pTileX, this.pTileY)
        : null;
      const gateChanged = near?.id !== this.nearGate?.id;
      const nodeChanged = nearWorldNode?.id !== this.nearWorldNode?.id;
      if (!force && !gateChanged && !nodeChanged) return;
      this.nearGate = near;
      this.nearWorldNode = nearWorldNode;
      if (force || gateChanged) ctx.setNearGate?.(near ? { region, gate: near } : null);
      if (force || nodeChanged) ctx.setNearNode?.(nearWorldNode);
    }

    regionInteract() {
      if (this.inputLocked) return;
      if (this.nearGate?.type === 'rail-hub') {
        const destinationIds = new Set(emeaRailDestinations(this.nearGate.id).map(({ id }) => id));
        const options = railHubs
          .filter((hub) => destinationIds.has(hub.id))
          .map((hub) => Object.freeze({
            ...hub,
            stopIds: planEmeaRailRoute(this.nearGate.id, hub.id),
          }))
          .map((option) => Object.freeze({
            ...option,
            stopLabels: Object.freeze(option.stopIds.map((hubId) => railHubById(hubId)?.label || hubId)),
          }));
        ctx.requestGate?.({ region, gate: this.nearGate, options });
      } else if (this.nearGate) ctx.requestGate?.({ region, gate: this.nearGate });
      else if (this.nearWorldNode) ctx.requestNode?.(this.nearWorldNode);
    }

    // 지역 오버월드도 도시 씬과 같은 quest:scored/done 하트 타이밍을 사용한다.
    // 지역 씬에는 펫이 없으므로 피드백 기준점은 플레이어다.
    questScoredFx(result = {}) { presentQuestScored(this, result); }
    questDoneFx() { presentQuestDone(this); }
    spawnHeart() {
      if (!this.player) return;
      const heart = this.add.image(
        this.player.x,
        this.player.y - 12,
        questHeartTexture,
      ).setScale(WORLD_SCALE).setDepth(10001);
      this.tweens.add({
        targets: heart,
        y: heart.y - 26,
        alpha: 0,
        duration: 1100,
        ease: 'Sine.easeOut',
        onComplete: () => heart.destroy(),
      });
    }

    enterCity(cityId) {
      if (this.inputLocked || !ctx.hasCity?.(cityId)) return;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      const worldReturn = Object.freeze({
        scene: region.sceneId,
        x: this.pTileX,
        y: this.pTileY,
      });
      this.cameras.main.fadeOut(260, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(`city:${cityId}`, { worldReturn });
      });
    }

    enterAirport() {
      if (this.inputLocked || this.nearWorldNode?.gate?.type !== 'story-scene'
        || this.nearWorldNode.gate.scene !== 'airport') return;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      const returnSpawn = Object.freeze({
        scene: region.sceneId,
        x: this.pTileX,
        y: this.pTileY,
      });
      ctx.onAirportEnter?.();
      this.scene.start('airport', { returnSpawn });
    }

    async ferryTo(destinationId) {
      if (this.inputLocked || this.ferrying) return false;
      const route = resolveOverworldRegionFerry(
        this.worldNodeEntries,
        this.nearWorldNode,
        destinationId,
        region.sceneId,
      );
      if (!route) return false;

      const { x: destinationX, y: destinationY } = route.spawn;
      const spawn = route.spawn;
      this.inputLocked = true;
      this.ferrying = true;
      this.heldDirs.length = 0;
      ctx.setNearNode?.(null);
      ctx.setStatus?.({ phase: 'saving-ferry', message: '도착 항구를 저장하고 있어요.' });
      const persisted = await ctx.persistPosition?.(spawn);
      if (!persisted || this.destroyed) {
        this.inputLocked = false;
        this.ferrying = false;
        this.refreshNearInteraction(true);
        ctx.setStatus?.({ phase: 'error', message: '도착 항구를 저장하지 못했어요. 다시 시도해 주세요.' });
        return false;
      }

      ctx.setStatus?.(null);
      const targetX = destinationX * TILE + TILE / 2;
      const targetY = destinationY * TILE + TILE / 2;
      const distance = Math.hypot(targetX - this.player.x, targetY - this.player.y);
      const duration = Math.min(5000, Math.max(3000, distance * 0.15));
      this.ferryBoat = this.add.image(this.player.x, this.player.y + 8, ferryTexture)
        .setOrigin(0.5, 0.5).setScale(2).setDepth(999);
      this.moving = true;
      let streamedPageKey = overworldRenderPageKeyAtWorldPixel(this.player.x, this.player.y, {
        tilePixels: TILE,
      });
      this.tweens.add({
        targets: this.player,
        x: targetX,
        y: targetY,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.ferryBoat?.setPosition(this.player.x, this.player.y + 8);
          const nextPageKey = overworldRenderPageKeyAtWorldPixel(this.player.x, this.player.y, {
            tilePixels: TILE,
          });
          if (nextPageKey === streamedPageKey) return;
          streamedPageKey = nextPageKey;
          this.refreshTerrainPages();
          this.refreshFeatureOverlays();
        },
        onComplete: () => {
          this.pTileX = destinationX;
          this.pTileY = destinationY;
          this.moving = false;
          this.ferrying = false;
          this.inputLocked = false;
          this.ferryBoat?.destroy();
          this.ferryBoat = null;
          this.refreshNearInteraction(true);
          this.refreshTerrainPages(true);
          this.refreshFeatureOverlays(true);
        },
      });
      return true;
    }

    async enterCorridor() {
      if (this.nearGate?.type !== 'transsib-gate' || this.inputLocked) return;
      if (!canAccessCorridor({ allowPreview: ctx.canAccessPreviewRegionsRef?.current })) {
        ctx.setStatus?.({
          phase: 'error',
          message: '횡단열차 회랑은 아직 열리지 않았어요.',
        });
        return false;
      }
      const spawn = corridorStopSpawn(this.nearGate.corridorStopId);
      if (!spawn) return false;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      ctx.setNearGate?.(null);
      ctx.setStatus?.({ phase: 'saving-gate', message: '횡단열차 플랫폼을 저장하고 있어요.' });
      const persisted = await ctx.persistPosition?.(spawn);
      if (!persisted || this.destroyed) {
        this.inputLocked = false;
        this.refreshNearInteraction(true);
        ctx.setStatus?.({ phase: 'error', message: '플랫폼 저장에 실패했어요. 연결을 확인해 주세요.' });
        return false;
      }
      ctx.setStatus?.(null);
      this.scene.start('transsib-corridor', { spawn });
      return true;
    }

    railStatus(trip) {
      const segmentPresentation = trip.phase === 'riding'
        ? emeaRailSegmentPresentation(trip.fromId, trip.toId)
        : null;
      return Object.freeze({
        ...trip,
        preview: true,
        terminalHub: railHubById(trip.terminalId),
        stopHub: railHubById(trip.stopId),
        fromHub: railHubById(trip.fromId),
        toHub: railHubById(trip.toId),
        segmentPresentation,
      });
    }

    beginRailSegmentPresentation(trip) {
      const presentation = emeaRailSegmentPresentation(trip.fromId, trip.toId);
      if (presentation.kind === 'channel-tunnel') {
        this.cameras.main.fadeOut(presentation.fadeMs, 0, 0, 0);
      }
      return presentation;
    }

    finishRailSegmentPresentation(trip) {
      const presentation = emeaRailSegmentPresentation(trip.fromId, trip.toId);
      if (presentation.kind === 'channel-tunnel') {
        this.cameras.main.fadeIn(presentation.fadeMs, 0, 0, 0);
      }
      return presentation;
    }

    async boardRailTo(terminalId) {
      if (this.inputLocked || this.nearGate?.type !== 'rail-hub' || this.railTrip) return false;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      ctx.setNearGate?.(null);
      ctx.setStatus?.({ phase: 'saving-rail', message: '종착 철도 허브를 저장하고 있어요.' });
      try {
        const prepared = prepareEmeaRailTrip({ originId: this.nearGate.id, terminalId });
        const ready = await persistEmeaRailTerminalBeforeBoard(prepared, ctx.persistPosition);
        this.railTrip = boardEmeaRailTrip(ready);
        this.beginRailSegmentPresentation(this.railTrip);
        this.player.setVisible(false);
        ctx.setStatus?.(this.railStatus(this.railTrip));
        return true;
      } catch (error) {
        this.railTrip = null;
        this.inputLocked = false;
        this.player.setVisible(true);
        this.refreshNearInteraction(true);
        ctx.setStatus?.({
          phase: 'error',
          message: error?.message || '종착 철도 허브를 저장하지 못했어요.',
        });
        return false;
      }
    }

    advanceRailPreview() {
      if (this.railTrip?.phase !== 'riding') return false;
      this.finishRailSegmentPresentation(this.railTrip);
      this.railTrip = arriveEmeaRailTrip(this.railTrip);
      ctx.setStatus?.(this.railStatus(this.railTrip));
      return true;
    }

    continueRailPreview() {
      if (this.railTrip?.phase !== 'stopped') return false;
      this.railTrip = continueEmeaRailTrip(this.railTrip);
      this.beginRailSegmentPresentation(this.railTrip);
      ctx.setStatus?.(this.railStatus(this.railTrip));
      return true;
    }

    async disembarkRailPreview() {
      if (this.railDisembarking || !this.railTrip?.canDisembark) return false;
      this.railDisembarking = true;
      const trip = this.railTrip;
      const result = disembarkEmeaRailTrip(trip);
      ctx.setStatus?.({ phase: 'saving-rail-stop', stopHub: railHubById(trip.stopId) });
      try {
        const alreadyPersisted = trip.stopId === trip.terminalId;
        const saved = alreadyPersisted || await ctx.persistPosition?.(result.spawn);
        if (!saved) throw new Error('하차 위치를 저장하지 못했어요. 열차에서 다시 시도해 주세요.');
        this.railTrip = null;
        this.pTileX = result.spawn.x;
        this.pTileY = result.spawn.y;
        this.player.setPosition(
          this.pTileX * TILE + TILE / 2,
          this.pTileY * TILE + TILE / 2,
        ).setVisible(true);
        this.cameras.main.centerOn(this.player.x, this.player.y);
        await this.refreshTerrainPages(true);
        await this.refreshFeatureOverlays(true).catch(() => null);
        this.inputLocked = false;
        ctx.setStatus?.(null);
        this.refreshNearInteraction(true);
        return true;
      } catch (error) {
        ctx.setStatus?.({ ...this.railStatus(trip), phase: 'error', message: error?.message });
        return false;
      } finally {
        this.railDisembarking = false;
      }
    }

    async leaveByAir() {
      if (this.nearGate?.type !== 'air-gate' || this.inputLocked) return;
      const spawn = ctx.airReturnSpawn?.();
      if (!spawn) return;
      this.inputLocked = true;
      this.heldDirs.length = 0;
      ctx.setNearGate?.(null);
      ctx.setStatus?.({ phase: 'saving-air', message: '귀환 공항을 저장하고 있어요.' });
      const persisted = await ctx.persistPosition?.(spawn);
      if (!persisted || this.destroyed) {
        this.inputLocked = false;
        this.refreshNearInteraction(true);
        ctx.setStatus?.({ phase: 'error', message: '귀환 위치 저장에 실패했어요. 연결을 확인해 주세요.' });
        return;
      }
      ctx.setStatus?.(null);
      this.scene.start('world', { spawn });
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

    refreshFeatureOverlays(force = false, cameraOrView = this.cameras.main) {
      if (!this.featureOverlays) return Promise.resolve(null);
      const update = this.featureOverlays.updateCamera(cameraOrView, { force });
      update.catch(() => {});
      return update;
    }

    applyPeers(incoming) {
      this.otherScenePeerIds = new Set(Object.keys(incoming || {}));
    }

    overworldRuntimeSnapshot() {
      return Object.freeze({
        scene: region.sceneId,
        ready: this.ready,
        playerTile: Object.freeze([this.pTileX, this.pTileY]),
        nearGateId: this.nearGate?.id || null,
        nearWorldNodeId: this.nearWorldNode?.id || null,
        worldNodeCount: this.worldNodeEntries.length,
        interactiveWorldNodeCount: this.worldNodeMarkers?.length || 0,
      });
    }

    async debugTeleportTo(tx, ty) {
      if (!this.ready || this.inputLocked || !Number.isInteger(tx) || !Number.isInteger(ty)
        || !await this.isWalkable(tx, ty)) throw new Error('debug destination is not walkable');
      this.heldDirs.length = 0;
      this.moving = false;
      this.stepPending = false;
      this.pTileX = tx;
      this.pTileY = ty;
      this.player.setPosition(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
      this.cameras.main.centerOn(this.player.x, this.player.y);
      await this.refreshTerrainPages(true);
      await this.refreshFeatureOverlays(true).catch(() => null);
      this.refreshNearInteraction(true);
      return this.overworldRuntimeSnapshot();
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
          persistable: !this.ferrying && !this.railTrip,
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
