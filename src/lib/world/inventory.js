export const INVENTORY_FAVORITES_KEY = 'manabi-world-inventory-favorites-v1';

export const INVENTORY_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'key', label: '중요' },
  { id: 'phrase', label: '회화' },
  { id: 'record', label: '기록' },
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
    const valid = new Set(STARTER_ITEMS.map((item) => item.id));
    return [...new Set(value.filter((id) => valid.has(id)))];
  } catch {
    return [];
  }
}

export function saveInventoryFavorites(ids, storage = globalThis?.localStorage) {
  const valid = new Set(STARTER_ITEMS.map((item) => item.id));
  const next = [...new Set((ids || []).filter((id) => valid.has(id)))];
  try { storage?.setItem(INVENTORY_FAVORITES_KEY, JSON.stringify(next)); } catch { /* 저장소 차단 시 현재 세션만 유지 */ }
  return next;
}
