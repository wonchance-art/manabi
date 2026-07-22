import { describe, expect, it } from 'vitest';
import {
  INVENTORY_FAVORITES_KEY,
  INVENTORY_ITEM_COUNTS_KEY,
  PET_FOOD_ITEM_ID,
  STARTER_ITEMS,
  filterInventoryItems,
  grantInventoryItem,
  inventoryItemsWithRewards,
  loadInventoryFavorites,
  loadInventoryItemCounts,
  saveInventoryItemCounts,
  saveInventoryFavorites,
} from '../inventory';

function memoryStorage(initial, key = INVENTORY_FAVORITES_KEY) {
  const data = new Map(initial ? [[key, initial]] : []);
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

describe('월드 가방', () => {
  it('분류와 검색어를 함께 적용한다', () => {
    expect(filterInventoryItems(STARTER_ITEMS, { category: 'phrase', query: 'すみません' }).map((item) => item.id))
      .toEqual(['phrase-sumimasen']);
    expect(filterInventoryItems(STARTER_ITEMS, { category: 'key' }).map((item) => item.id))
      .toEqual(['transit-card']);
  });

  it('즐겨찾기는 실제 아이템 id만 중복 없이 저장한다', () => {
    const storage = memoryStorage();
    expect(saveInventoryFavorites(['travel-notebook', 'bad', 'travel-notebook'], storage)).toEqual(['travel-notebook']);
    expect(loadInventoryFavorites(storage)).toEqual(['travel-notebook']);
  });

  it('깨진 저장값은 빈 목록으로 복구한다', () => {
    expect(loadInventoryFavorites(memoryStorage('{broken'))).toEqual([]);
  });

  it('마일스톤 펫 사료 수량을 기존 가방 아이템으로 중복 없이 정규화한다', () => {
    const storage = memoryStorage(null);
    expect(grantInventoryItem(PET_FOOD_ITEM_ID, 1, storage)).toEqual({ 'pet-food': 1 });
    expect(grantInventoryItem(PET_FOOD_ITEM_ID, 3, storage)).toEqual({ 'pet-food': 4 });
    expect(loadInventoryItemCounts(storage)).toEqual({ 'pet-food': 4 });
    expect(inventoryItemsWithRewards(loadInventoryItemCounts(storage)).at(-1)).toMatchObject({
      id: 'pet-food', category: 'care', quantity: 4,
    });
  });

  it('알 수 없는 아이템·0 이하·깨진 수량은 저장하지 않는다', () => {
    const storage = memoryStorage('{broken', INVENTORY_ITEM_COUNTS_KEY);
    expect(loadInventoryItemCounts(storage)).toEqual({});
    expect(grantInventoryItem('unknown', 1, storage)).toEqual({});
    expect(grantInventoryItem(PET_FOOD_ITEM_ID, 0, storage)).toEqual({});
    expect(saveInventoryItemCounts({ 'pet-food': -1, unknown: 5 }, storage)).toEqual({});
    expect(inventoryItemsWithRewards({})).toEqual(STARTER_ITEMS);
  });
});
