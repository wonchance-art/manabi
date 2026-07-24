import { describe, expect, it, vi } from 'vitest';
import {
  STORAGE_SCHEMA_MIGRATIONS,
  STORAGE_SCHEMA_VERSION,
  STORAGE_SCHEMA_VERSION_KEY,
  LEARNING_STORAGE_KEY_PREFIXES,
  WORLD_STORAGE_KEYS,
  WORLD_STORAGE_KEY_PREFIXES,
  briefingSeenKey,
  ensureStorageSchema,
  learningActivityStorageKey,
  normalizeSlug,
  npcMeetingStorageKey,
  readStorageSchemaVersion,
  routeDiscoveryStorageKey,
  slugAliases,
} from '../storageSchema.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    values,
  };
}

describe('월드 localStorage 스키마 v1', () => {
  it('실사용 고정 키와 동적 prefix를 한 정본에 고정한다', () => {
    expect(STORAGE_SCHEMA_VERSION).toBe(1);
    expect(STORAGE_SCHEMA_VERSION_KEY).toBe('storage-schema-version');
    expect(WORLD_STORAGE_KEYS).toEqual({
      schemaVersion: 'storage-schema-version',
      guestStamps: 'guest-stamps',
      worldTitles: 'worldTitles',
      inventoryFavorites: 'manabi-world-inventory-favorites-v1',
      inventoryItemCounts: 'manabi-world-inventory-items-v1',
      avatar: 'manabi-world-avatar-v1',
      petChoice: 'world_pet',
      mutedUserIds: 'world_muted',
    });
    expect(WORLD_STORAGE_KEY_PREFIXES).toEqual({
      npcMeetings: 'npc-met:',
      routeDiscoveries: 'route-discoveries:',
      briefingSeen: 'briefing-seen:',
    });
    expect(LEARNING_STORAGE_KEY_PREFIXES).toEqual({
      activity: 'manabi-learning-activity-v1:',
    });
    expect(npcMeetingStorageKey('lyon')).toBe('npc-met:lyon');
    expect(routeDiscoveryStorageKey('lyon')).toBe('route-discoveries:lyon');
    expect(briefingSeenKey('france')).toBe('briefing-seen:france');
    expect(learningActivityStorageKey()).toBe('manabi-learning-activity-v1:guest');
    expect(learningActivityStorageKey('user-1')).toBe('manabi-learning-activity-v1:user-1');
    expect(Object.isFrozen(WORLD_STORAGE_KEYS)).toBe(true);
    expect(Object.isFrozen(WORLD_STORAGE_KEY_PREFIXES)).toBe(true);
    expect(Object.isFrozen(LEARNING_STORAGE_KEY_PREFIXES)).toBe(true);
  });

  it('slug 별칭은 구→신 정본을 연쇄 정규화하고 미등록 slug는 통과시킨다', () => {
    const aliases = Object.freeze({
      'a0-06': 'a1-06',
      'legacy-a0-06': 'a0-06',
    });

    expect(slugAliases).toEqual({});
    expect(Object.isFrozen(slugAliases)).toBe(true);
    expect(normalizeSlug('a0-06', aliases)).toBe('a1-06');
    expect(normalizeSlug('legacy-a0-06', aliases)).toBe('a1-06');
    expect(normalizeSlug('unregistered', aliases)).toBe('unregistered');
    expect(normalizeSlug('cycle-a', { 'cycle-a': 'cycle-b', 'cycle-b': 'cycle-a' })).toBe('cycle-a');
  });

  it('버전 키가 없는 기존 payload를 v1로 간주하고 무손실로 표식만 추가한다', () => {
    const storage = memoryStorage({
      [WORLD_STORAGE_KEYS.guestStamps]: '["seoul","ghost-node"]',
      [routeDiscoveryStorageKey('lyon')]: '["lyon-d1"]',
    });
    const before = new Map(storage.values);

    expect(readStorageSchemaVersion(storage)).toBe(1);
    expect(ensureStorageSchema(storage)).toBe(1);
    expect(storage.values.get(STORAGE_SCHEMA_VERSION_KEY)).toBe('1');
    for (const [key, value] of before) {
      expect(storage.values.get(key)).toBe(value);
    }
  });

  it('깨진 버전은 v1로 닫고 미래 버전은 내리지 않으며 v1 migration은 no-op이다', () => {
    const broken = memoryStorage({ [STORAGE_SCHEMA_VERSION_KEY]: '{broken' });
    expect(readStorageSchemaVersion(broken)).toBe(1);
    expect(ensureStorageSchema(broken)).toBe(1);
    expect(broken.values.get(STORAGE_SCHEMA_VERSION_KEY)).toBe('1');

    const future = memoryStorage({ [STORAGE_SCHEMA_VERSION_KEY]: '2' });
    expect(ensureStorageSchema(future)).toBe(2);
    expect(future.values.get(STORAGE_SCHEMA_VERSION_KEY)).toBe('2');
    expect(future.setItem).not.toHaveBeenCalled();

    expect(STORAGE_SCHEMA_MIGRATIONS).toEqual({});
    expect(Object.isFrozen(STORAGE_SCHEMA_MIGRATIONS)).toBe(true);
  });

  it('SSR·차단 저장소에서도 v1로 안전하게 닫힌다', () => {
    const blocked = {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(() => { throw new Error('blocked'); }),
    };
    expect(readStorageSchemaVersion(null)).toBe(1);
    expect(ensureStorageSchema(null)).toBe(1);
    expect(readStorageSchemaVersion(blocked)).toBe(1);
    expect(ensureStorageSchema(blocked)).toBe(1);
  });
});
