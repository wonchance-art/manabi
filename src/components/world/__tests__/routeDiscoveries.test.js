import { describe, expect, it, vi } from 'vitest';
import { buildCityScene } from '../CityScene.js';
import bus from '../bus.js';
import {
  claimRouteDiscoveryAt,
  loadRouteDiscoveryIds,
  routeDiscoveryStorageKey,
  ROUTE_DISCOVERY_DURATION_MS,
  saveRouteDiscoveryIds,
} from '../routeDiscoveries.js';
import { CITY_TILE } from '../cities/terrain.js';
import { INVENTORY_ITEM_COUNTS_KEY } from '../../../lib/world/inventory.js';
import { WORLD_TITLES_STORAGE_KEY } from '../../../lib/world/stampMilestones.js';
import {
  DISCOVERY_MILESTONE_EVENT,
  DISCOVERY_MILESTONE_REWARDS,
} from '../../../lib/world/discoveryMilestones.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

function memoryStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

const DISCOVERY = Object.freeze({
  id: 'walk-fixture-d1',
  tile: Object.freeze([1, 0]),
  line: '길 위에서 작은 반짝임을 발견해요.',
});

function sceneFixture(storage) {
  class FakeScene {
    constructor() {}
  }
  const city = {
    id: 'walk-fixture',
    cols: 2,
    rows: 1,
    CITY_TILE,
  };
  const Scene = buildCityScene({ Scene: FakeScene }, city, {});
  const scene = new Scene();
  scene.mainRoute = { discoveries: [DISCOVERY] };
  scene.routeDiscoveryIds = new Set();
  scene.routeDiscoveryStorage = storage;
  scene.pTileX = 0;
  scene.pTileY = 0;
  scene.heldDirs = [];
  scene.tileCode = () => CITY_TILE.ROAD;
  scene.refreshRouteDiscoveryViews = vi.fn();
  scene.showRouteDiscovery = vi.fn();
  scene.player = { setPosition: vi.fn(), setDepth: vi.fn() };
  scene.playerHalo = {
    setPosition: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
  };
  scene.pet = { setPosition: vi.fn() };
  scene.cameras = { main: { centerOn: vi.fn() } };
  scene.refreshChunks = vi.fn();
  scene.refreshWaterOverlay = vi.fn();
  return scene;
}

describe('route discovery 1회 저장·도보 트리거', () => {
  it('localStorage 배열을 결정 순서로 왕복하고 손상 값은 fail closed한다', () => {
    const storage = memoryStorage();
    expect(saveRouteDiscoveryIds('lyon', new Set(['lyon-d2', 'lyon-d1']), storage)).toBe(true);
    expect(storage.values.get(routeDiscoveryStorageKey('lyon'))).toBe('["lyon-d1","lyon-d2"]');
    expect(loadRouteDiscoveryIds('lyon', storage)).toEqual(new Set(['lyon-d1', 'lyon-d2']));

    storage.values.set(routeDiscoveryStorageKey('lyon'), '{broken');
    expect(loadRouteDiscoveryIds('lyon', storage)).toEqual(new Set());
  });

  it('같은 타일은 최초 1회만 claim하고 저장을 다시 읽어도 재발동하지 않는다', () => {
    const storage = memoryStorage();
    const discoveredIds = new Set();
    const args = {
      cityId: 'walk-fixture',
      discoveries: [DISCOVERY],
      discoveredIds,
      tx: 1,
      ty: 0,
      storage,
    };
    expect(claimRouteDiscoveryAt(args)).toBe(DISCOVERY);
    expect(claimRouteDiscoveryAt(args)).toBeNull();
    expect(loadRouteDiscoveryIds('walk-fixture', storage)).toEqual(new Set(['walk-fixture-d1']));
    expect(claimRouteDiscoveryAt({
      ...args,
      discoveredIds: loadRouteDiscoveryIds('walk-fixture', storage),
    })).toBeNull();
  });

  it('정본 마지막 발견 저장 직후 도시 완집 보상과 칭호 이벤트를 각각 1회만 연다', () => {
    const storage = memoryStorage();
    const reward = DISCOVERY_MILESTONE_REWARDS[0];
    const discoveries = reward.discoveryIds.map((id, index) => ({
      id,
      tile: [index + 1, 0],
      line: `${id} 발견`,
    }));
    const discoveredIds = new Set(reward.discoveryIds.slice(0, -1));
    const onMilestone = vi.fn();
    bus.on(DISCOVERY_MILESTONE_EVENT, onMilestone);

    try {
      const args = {
        cityId: reward.cityId,
        discoveries,
        discoveredIds,
        tx: discoveries.length,
        ty: 0,
        storage,
      };
      expect(claimRouteDiscoveryAt(args)).toBe(discoveries.at(-1));
      expect(claimRouteDiscoveryAt(args)).toBeNull();
    } finally {
      bus.off(DISCOVERY_MILESTONE_EVENT, onMilestone);
    }

    expect(onMilestone).toHaveBeenCalledTimes(1);
    expect(onMilestone).toHaveBeenCalledWith(['discovery-lyon']);
    expect(storage.values.get(WORLD_TITLES_STORAGE_KEY)).toBe('["discovery-lyon"]');
    expect(storage.values.get(INVENTORY_ITEM_COUNTS_KEY)).toBe('{"pet-food":1}');
  });

  it('전철 배치(placeAt)는 제외하고 도보 완료(onStepDone)만 1회 발동한다', () => {
    const storage = memoryStorage();
    const scene = sceneFixture(storage);

    scene.placeAt(1, 0);
    expect(scene.showRouteDiscovery).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();

    scene.onStepDone();
    expect(scene.showRouteDiscovery).toHaveBeenCalledWith(DISCOVERY);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    scene.onStepDone();
    expect(scene.showRouteDiscovery).toHaveBeenCalledTimes(1);
  });

  it('GBC 말풍선은 스탬프 없이 정확히 4.2초 뒤 소등한다', () => {
    const scene = sceneFixture(memoryStorage());
    const toast = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    scene.add = { text: vi.fn(() => toast) };
    scene.scale = { width: 480 };
    scene.time = { delayedCall: vi.fn(() => ({ remove: vi.fn() })) };

    scene.showRouteDiscovery = Object.getPrototypeOf(scene).showRouteDiscovery;
    scene.showRouteDiscovery(DISCOVERY);
    expect(scene.time.delayedCall).toHaveBeenCalledWith(
      ROUTE_DISCOVERY_DURATION_MS,
      expect.any(Function),
    );
    expect(ROUTE_DISCOVERY_DURATION_MS).toBe(4200);
  });
});
