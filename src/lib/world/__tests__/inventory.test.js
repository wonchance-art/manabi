import { describe, expect, it } from 'vitest';
import {
  INVENTORY_FAVORITES_KEY,
  STARTER_ITEMS,
  filterInventoryItems,
  loadInventoryFavorites,
  saveInventoryFavorites,
} from '../inventory';

function memoryStorage(initial) {
  const data = new Map(initial ? [[INVENTORY_FAVORITES_KEY, initial]] : []);
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
});
