// 학습 월드 localStorage 정본.
//
// v1은 S19 도입 전부터 제품이 쓰던 키와 payload 형식을 그대로 선언한다. 버전 키가 없는
// 기존 브라우저도 v1로 간주하며, ensureStorageSchema()는 payload를 건드리지 않고 버전 표식만
// 기록한다. 다음 버전이 필요해질 때 STORAGE_SCHEMA_MIGRATIONS에 target version 함수를 등록한다.

export const STORAGE_SCHEMA_VERSION = 1;
export const STORAGE_SCHEMA_VERSION_KEY = 'storage-schema-version';
export const GUEST_STAMPS_STORAGE_KEY = 'guest-stamps';
export const WORLD_TITLES_STORAGE_KEY = 'worldTitles';
export const INVENTORY_FAVORITES_KEY = 'manabi-world-inventory-favorites-v1';
export const INVENTORY_ITEM_COUNTS_KEY = 'manabi-world-inventory-items-v1';
export const AVATAR_STORAGE_KEY = 'manabi-world-avatar-v1';
export const PET_STORAGE_KEY = 'world_pet';
export const MUTED_USER_IDS_STORAGE_KEY = 'world_muted';
export const NPC_MEETING_STORAGE_PREFIX = 'npc-met:';
export const ROUTE_DISCOVERY_STORAGE_PREFIX = 'route-discoveries:';
export const BRIEFING_SEEN_PREFIX = 'briefing-seen:';
export const LEARNING_ACTIVITY_STORAGE_PREFIX = 'manabi-learning-activity-v1:';

export const WORLD_STORAGE_KEYS = Object.freeze({
  schemaVersion: STORAGE_SCHEMA_VERSION_KEY,
  guestStamps: GUEST_STAMPS_STORAGE_KEY,
  worldTitles: WORLD_TITLES_STORAGE_KEY,
  inventoryFavorites: INVENTORY_FAVORITES_KEY,
  inventoryItemCounts: INVENTORY_ITEM_COUNTS_KEY,
  avatar: AVATAR_STORAGE_KEY,
  petChoice: PET_STORAGE_KEY,
  mutedUserIds: MUTED_USER_IDS_STORAGE_KEY,
});

export const WORLD_STORAGE_KEY_PREFIXES = Object.freeze({
  npcMeetings: NPC_MEETING_STORAGE_PREFIX,
  routeDiscoveries: ROUTE_DISCOVERY_STORAGE_PREFIX,
  briefingSeen: BRIEFING_SEEN_PREFIX,
});

// 학습 진도 원본 키(studied_lesson 등)는 각 기존 저장소가 계속 소유한다.
// 이 정본에는 사용자 스코프의 일일 활동 메타데이터 prefix만 선언한다.
export const LEARNING_STORAGE_KEY_PREFIXES = Object.freeze({
  activity: LEARNING_ACTIVITY_STORAGE_PREFIX,
});

export function npcMeetingStorageKey(cityId) {
  return `${WORLD_STORAGE_KEY_PREFIXES.npcMeetings}${cityId}`;
}

export function routeDiscoveryStorageKey(cityId) {
  return `${WORLD_STORAGE_KEY_PREFIXES.routeDiscoveries}${cityId}`;
}

export function briefingSeenKey(countryId) {
  return `${WORLD_STORAGE_KEY_PREFIXES.briefingSeen}${countryId}`;
}

export function learningActivityStorageKey(userId) {
  const scope = typeof userId === 'string' && userId.trim() ? userId : 'guest';
  return `${LEARNING_STORAGE_KEY_PREFIXES.activity}${scope}`;
}

// target version -> (storage) => void. v1은 기존 형식의 선언이므로 실행할 마이그레이션이 없다.
export const STORAGE_SCHEMA_MIGRATIONS = Object.freeze({});

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readStorageSchemaVersion(storage = defaultStorage()) {
  if (!storage) return STORAGE_SCHEMA_VERSION;
  try {
    const raw = storage.getItem(STORAGE_SCHEMA_VERSION_KEY);
    if (raw === null) return STORAGE_SCHEMA_VERSION;
    if (!/^[1-9]\d*$/.test(raw)) return STORAGE_SCHEMA_VERSION;
    const version = Number(raw);
    return Number.isSafeInteger(version) ? version : STORAGE_SCHEMA_VERSION;
  } catch {
    return STORAGE_SCHEMA_VERSION;
  }
}

export function ensureStorageSchema(storage = defaultStorage()) {
  if (!storage) return STORAGE_SCHEMA_VERSION;
  let version = readStorageSchemaVersion(storage);
  if (version > STORAGE_SCHEMA_VERSION) return version;

  try {
    while (version < STORAGE_SCHEMA_VERSION) {
      const nextVersion = version + 1;
      const migrate = STORAGE_SCHEMA_MIGRATIONS[nextVersion];
      if (typeof migrate !== 'function') return version;
      migrate(storage);
      version = nextVersion;
    }
    storage.setItem(STORAGE_SCHEMA_VERSION_KEY, String(version));
  } catch {
    // 저장소 차단·향후 migration 실패 시 기존 payload와 버전 표식을 그대로 둔다.
  }
  return version;
}
