export const INVENTORY_FAVORITES_KEY = 'manabi-world-inventory-favorites-v1';
export const INVENTORY_ITEM_COUNTS_KEY = 'manabi-world-inventory-items-v1';
export const PET_FOOD_ITEM_ID = 'pet-food';

export const INVENTORY_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'key', label: '중요' },
  { id: 'phrase', label: '회화' },
  { id: 'record', label: '기록' },
  { id: 'care', label: '돌봄' },
];

export const STARTER_ITEMS = Object.freeze([
  {
    id: 'travel-notebook',
    icon: '📒',
    name: '여행 수첩',
    category: 'record',
    description: '방문한 장소와 모은 기념 스탬프를 확인해요.',
    action: 'codex',
    actionLabel: '도감 보기',
  },
  {
    id: 'transit-card',
    icon: '🎫',
    name: '교통 카드',
    category: 'key',
    description: '도시의 역과 정기 교통을 이용할 때 쓰는 여행 필수품이에요.',
    action: 'quests',
    actionLabel: '이동 임무',
  },
  {
    id: 'phrase-sumimasen',
    icon: '💬',
    name: '회화 카드「すみません」',
    category: 'phrase',
    description: '실례합니다 · 말을 걸거나 도움을 청할 때 먼저 꺼내는 표현이에요.',
    action: 'dictionary',
    actionLabel: '사전 열기',
  },
]);

export const REWARD_ITEMS = Object.freeze([
  Object.freeze({
    id: PET_FOOD_ITEM_ID,
    icon: '🥫',
    name: '펫 사료',
    category: 'care',
    description: '여행 스탬프 마일스톤에서 받은 펫 돌봄 물품이에요.',
  }),
]);

const INVENTORY_ITEMS = Object.freeze([...STARTER_ITEMS, ...REWARD_ITEMS]);
const INVENTORY_ITEM_IDS = new Set(INVENTORY_ITEMS.map((item) => item.id));
const COUNTABLE_ITEM_IDS = new Set(REWARD_ITEMS.map((item) => item.id));

export function filterInventoryItems(items, { query = '', category = 'all' } = {}) {
  const keyword = query.trim().toLocaleLowerCase('ko');
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!keyword) return true;
    return `${item.name} ${item.description}`.toLocaleLowerCase('ko').includes(keyword);
  });
}

export function loadInventoryFavorites(storage = globalThis?.localStorage) {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(INVENTORY_FAVORITES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id) => INVENTORY_ITEM_IDS.has(id)))];
  } catch {
    return [];
  }
}

export function saveInventoryFavorites(ids, storage = globalThis?.localStorage) {
  const next = [...new Set((ids || []).filter((id) => INVENTORY_ITEM_IDS.has(id)))];
  try { storage?.setItem(INVENTORY_FAVORITES_KEY, JSON.stringify(next)); } catch { /* 저장소 차단 시 현재 세션만 유지 */ }
  return next;
}

function normalizeInventoryItemCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next = {};
  for (const itemId of COUNTABLE_ITEM_IDS) {
    const count = Number(value[itemId]);
    if (Number.isInteger(count) && count > 0) next[itemId] = count;
  }
  return next;
}

export function loadInventoryItemCounts(storage = globalThis?.localStorage) {
  if (!storage) return {};
  try {
    return normalizeInventoryItemCounts(JSON.parse(storage.getItem(INVENTORY_ITEM_COUNTS_KEY) || '{}'));
  } catch {
    return {};
  }
}

export function saveInventoryItemCounts(counts, storage = globalThis?.localStorage) {
  const next = normalizeInventoryItemCounts(counts);
  try { storage?.setItem(INVENTORY_ITEM_COUNTS_KEY, JSON.stringify(next)); } catch { /* 저장소 차단 시 현재 세션만 유지 */ }
  return next;
}

export function grantInventoryItem(itemId, quantity = 1, storage = globalThis?.localStorage) {
  const current = loadInventoryItemCounts(storage);
  const amount = Number(quantity);
  if (!COUNTABLE_ITEM_IDS.has(itemId) || !Number.isInteger(amount) || amount <= 0) return current;
  return saveInventoryItemCounts({
    ...current,
    [itemId]: (current[itemId] || 0) + amount,
  }, storage);
}

export function inventoryItemsWithRewards(counts = {}) {
  const normalized = normalizeInventoryItemCounts(counts);
  return [
    ...STARTER_ITEMS,
    ...REWARD_ITEMS
      .filter((item) => (normalized[item.id] || 0) > 0)
      .map((item) => ({ ...item, quantity: normalized[item.id] })),
  ];
}
