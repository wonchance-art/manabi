import { describe, expect, it, vi } from 'vitest';
import { INVENTORY_ITEM_COUNTS_KEY } from '../inventory.js';
import { WORLD_TITLES_STORAGE_KEY } from '../stampMilestones.js';
import {
  DISCOVERY_MILESTONE_REWARDS,
  claimDiscoveryMilestoneReward,
  discoveryTitleToastForUnlocked,
} from '../discoveryMilestones.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

function definitionsFor(reward, ids = reward.discoveryIds) {
  return ids.map((id) => ({ id }));
}

function claim(reward, discoveredIds, storage, discoveries = definitionsFor(reward)) {
  return claimDiscoveryMilestoneReward({
    cityId: reward.cityId,
    discoveries,
    discoveredIds: new Set(discoveredIds),
    storage,
  });
}

describe('S9 도시별 발견 완집 보상', () => {
  it('리옹 8·보르도 8·스트라스부르 7 정본과 key-only 칭호·사료 1개를 고정한다', () => {
    expect(DISCOVERY_MILESTONE_REWARDS.map((reward) => ({
      cityId: reward.cityId,
      count: reward.discoveryIds.length,
      titleKey: reward.titleKey,
      petFood: reward.petFood,
    }))).toEqual([
      { cityId: 'lyon', count: 8, titleKey: 'discovery-lyon', petFood: 1 },
      { cityId: 'bordeaux', count: 8, titleKey: 'discovery-bordeaux', petFood: 1 },
      { cityId: 'strasbourg', count: 7, titleKey: 'discovery-strasbourg', petFood: 1 },
    ]);
    expect(Object.isFrozen(DISCOVERY_MILESTONE_REWARDS)).toBe(true);
    expect(DISCOVERY_MILESTONE_REWARDS.every((reward) => (
      Object.isFrozen(reward) && Object.isFrozen(reward.discoveryIds)
    ))).toBe(true);
  });

  it('정본 마지막 발견 순간에만 칭호 키와 펫 사료를 1회 지급한다', () => {
    const reward = DISCOVERY_MILESTONE_REWARDS[0];
    const storage = memoryStorage();

    expect(claim(reward, reward.discoveryIds.slice(0, -1), storage)).toMatchObject({
      cityId: 'lyon',
      discoveredCount: 7,
      totalCount: 8,
      complete: false,
      unlocked: [],
      inventory: {},
    });
    expect(claim(reward, reward.discoveryIds, storage)).toMatchObject({
      complete: true,
      unlocked: ['discovery-lyon'],
      titles: ['discovery-lyon'],
      inventory: { 'pet-food': 1 },
    });
    expect(claim(reward, reward.discoveryIds, storage)).toMatchObject({
      complete: true,
      unlocked: [],
      inventory: { 'pet-food': 1 },
    });
    expect(storage.values.get(WORLD_TITLES_STORAGE_KEY)).toBe('["discovery-lyon"]');
    expect(storage.values.get(INVENTORY_ITEM_COUNTS_KEY)).toBe('{"pet-food":1}');
  });

  it('세 도시를 각각 완집해도 도시별 1회만 지급하고 기존 칭호를 보존한다', () => {
    const storage = memoryStorage({
      [WORLD_TITLES_STORAGE_KEY]: '["stamp-10","other-title"]',
    });

    for (const reward of DISCOVERY_MILESTONE_REWARDS) {
      expect(claim(reward, reward.discoveryIds, storage).unlocked).toEqual([reward.titleKey]);
      expect(claim(reward, reward.discoveryIds, storage).unlocked).toEqual([]);
    }

    expect(JSON.parse(storage.values.get(WORLD_TITLES_STORAGE_KEY))).toEqual([
      'stamp-10',
      'other-title',
      'discovery-lyon',
      'discovery-bordeaux',
      'discovery-strasbourg',
    ]);
    expect(storage.values.get(INVENTORY_ITEM_COUNTS_KEY)).toBe('{"pet-food":3}');
  });

  it('유령 저장 ID와 정본을 가장한 동일 개수의 교체 ID로는 완집을 열지 않는다', () => {
    const reward = DISCOVERY_MILESTONE_REWARDS[1];
    const storage = memoryStorage();
    const storedWithGhosts = new Set([
      ...reward.discoveryIds.slice(0, -1),
      'bordeaux-d999',
      'lyon-d8',
    ]);

    expect(claim(reward, storedWithGhosts, storage)).toMatchObject({
      discoveredCount: 7,
      totalCount: 8,
      complete: false,
      unlocked: [],
      inventory: {},
    });
    expect(claim(
      reward,
      reward.discoveryIds,
      storage,
      definitionsFor(reward, [...reward.discoveryIds.slice(0, -1), 'bordeaux-d999']),
    )).toMatchObject({
      discoveredCount: 8,
      complete: false,
      unlocked: [],
    });
    expect(storage.values.has(WORLD_TITLES_STORAGE_KEY)).toBe(false);
    expect(storage.values.has(INVENTORY_ITEM_COUNTS_KEY)).toBe(false);
  });

  it('미지원 도시·손상 입력은 저장소를 읽지 않고 fail-closed한다', () => {
    const storage = memoryStorage();
    expect(claimDiscoveryMilestoneReward({
      cityId: 'ghost-city',
      discoveries: [{ id: 'ghost-d1' }],
      discoveredIds: new Set(['ghost-d1']),
      storage,
    })).toBeNull();
    expect(claimDiscoveryMilestoneReward({
      cityId: 'lyon',
      discoveries: null,
      discoveredIds: new Set(),
      storage,
    })).toBeNull();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('토스트는 정본 칭호 중 마지막 하나를 key-only로 골라 카피를 만들지 않는다', () => {
    expect(discoveryTitleToastForUnlocked([
      'discovery-lyon',
      'ghost-title',
      'discovery-strasbourg',
    ])).toEqual({ key: 'discovery-strasbourg' });
    expect(discoveryTitleToastForUnlocked(['ghost-title'])).toBeNull();
    expect(discoveryTitleToastForUnlocked(null)).toBeNull();
  });
});
