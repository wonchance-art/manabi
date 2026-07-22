import { describe, expect, it } from 'vitest';
import { INVENTORY_ITEM_COUNTS_KEY } from '../inventory.js';
import { STAMP_ALBUM_NODES } from '../stampUniverse.js';
import {
  STAMP_MILESTONE_REWARDS,
  WORLD_TITLES_STORAGE_KEY,
  canonicalStampCount,
  claimStampMilestoneRewards,
  loadWorldTitles,
  saveWorldTitles,
} from '../stampMilestones.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

const firstStampIds = (count) => new Set(STAMP_ALBUM_NODES.slice(0, count).map((node) => node.id));

describe('스탬프 마일스톤 보상 v1', () => {
  it('10/30/60/85에 카피 없는 칭호 키 4개와 사료 1개씩을 고정한다', () => {
    expect(STAMP_MILESTONE_REWARDS).toEqual([
      { count: 10, titleKey: 'stamp-10', petFood: 1 },
      { count: 30, titleKey: 'stamp-30', petFood: 1 },
      { count: 60, titleKey: 'stamp-60', petFood: 1 },
      { count: 85, titleKey: 'stamp-85', petFood: 1 },
    ]);
    expect(Object.isFrozen(STAMP_MILESTONE_REWARDS)).toBe(true);
    expect(STAMP_MILESTONE_REWARDS.every(Object.isFrozen)).toBe(true);
  });

  it('정본 교집합만 세어 알 수 없는 저장 ID로 마일스톤을 열지 않는다', () => {
    const stamps = firstStampIds(9);
    stamps.add('unknown-row');
    stamps.add('another-unknown-row');
    expect(canonicalStampCount(stamps)).toBe(9);
    expect(claimStampMilestoneRewards(stamps, memoryStorage()).unlocked).toEqual([]);
  });

  it('한 번에 여러 문턱을 넘고 재평가해도 사료와 칭호를 중복 지급하지 않는다', () => {
    const storage = memoryStorage();
    expect(claimStampMilestoneRewards(firstStampIds(60), storage)).toMatchObject({
      stampCount: 60,
      unlocked: ['stamp-10', 'stamp-30', 'stamp-60'],
      titles: ['stamp-10', 'stamp-30', 'stamp-60'],
      inventory: { 'pet-food': 3 },
    });
    expect(claimStampMilestoneRewards(firstStampIds(60), storage)).toMatchObject({
      unlocked: [],
      inventory: { 'pet-food': 3 },
    });
    expect(claimStampMilestoneRewards(firstStampIds(85), storage)).toMatchObject({
      unlocked: ['stamp-85'],
      titles: ['stamp-10', 'stamp-30', 'stamp-60', 'stamp-85'],
      inventory: { 'pet-food': 4 },
    });
    expect(storage.getItem(WORLD_TITLES_STORAGE_KEY))
      .toBe('["stamp-10","stamp-30","stamp-60","stamp-85"]');
    expect(storage.getItem(INVENTORY_ITEM_COUNTS_KEY)).toBe('{"pet-food":4}');
  });

  it('다른 시스템의 칭호 키는 보존하고 깨진 worldTitles는 빈 배열로 복구한다', () => {
    const storage = memoryStorage({
      [WORLD_TITLES_STORAGE_KEY]: '["other-title","other-title",3]'
    });
    expect(loadWorldTitles(storage)).toEqual(['other-title']);
    expect(saveWorldTitles(['other-title', 'stamp-10', 'stamp-10'], storage))
      .toEqual(['other-title', 'stamp-10']);
    expect(loadWorldTitles(memoryStorage({ [WORLD_TITLES_STORAGE_KEY]: '{broken' }))).toEqual([]);
  });
});
