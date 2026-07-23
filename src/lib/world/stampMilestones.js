import {
  PET_FOOD_ITEM_ID,
  grantInventoryItem,
  loadInventoryItemCounts,
} from './inventory.js';
import { WORLD_TITLES_STORAGE_KEY } from './storageSchema.js';
import { STAMP_ALBUM_NODES } from './stampUniverse.js';

export { WORLD_TITLES_STORAGE_KEY };

export const STAMP_MILESTONE_REWARDS = Object.freeze([
  Object.freeze({ count: 10, titleKey: 'stamp-10', petFood: 1 }),
  Object.freeze({ count: 30, titleKey: 'stamp-30', petFood: 1 }),
  Object.freeze({ count: 60, titleKey: 'stamp-60', petFood: 1 }),
  Object.freeze({ count: 85, titleKey: 'stamp-85', petFood: 1 }),
]);

export function loadWorldTitles(storage = globalThis?.localStorage) {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(WORLD_TITLES_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((key) => typeof key === 'string' && key.length > 0))];
  } catch {
    return [];
  }
}

export function saveWorldTitles(titleKeys, storage = globalThis?.localStorage) {
  const next = [...new Set((titleKeys || []).filter((key) => typeof key === 'string' && key.length > 0))];
  try { storage?.setItem(WORLD_TITLES_STORAGE_KEY, JSON.stringify(next)); } catch { /* 저장소 차단 시 현재 세션만 유지 */ }
  return next;
}

export function canonicalStampCount(stamps) {
  const owned = stamps instanceof Set ? stamps : new Set();
  return STAMP_ALBUM_NODES.reduce(
    (count, node) => count + (owned.has(node.id) ? 1 : 0),
    0,
  );
}

export function claimStampMilestoneRewards(stamps, storage = globalThis?.localStorage) {
  const stampCount = canonicalStampCount(stamps);
  const titles = loadWorldTitles(storage);
  const titleSet = new Set(titles);
  const unlocked = STAMP_MILESTONE_REWARDS.filter(
    (reward) => stampCount >= reward.count && !titleSet.has(reward.titleKey),
  );

  if (unlocked.length === 0) {
    return Object.freeze({
      stampCount,
      unlocked: Object.freeze([]),
      titles: Object.freeze(titles),
      inventory: Object.freeze(loadInventoryItemCounts(storage)),
    });
  }

  const petFood = unlocked.reduce((total, reward) => total + reward.petFood, 0);
  const inventory = grantInventoryItem(PET_FOOD_ITEM_ID, petFood, storage);
  const nextTitles = saveWorldTitles([
    ...titles,
    ...unlocked.map((reward) => reward.titleKey),
  ], storage);

  return Object.freeze({
    stampCount,
    unlocked: Object.freeze(unlocked.map((reward) => reward.titleKey)),
    titles: Object.freeze(nextTitles),
    inventory: Object.freeze(inventory),
  });
}
