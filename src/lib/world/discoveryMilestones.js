import {
  PET_FOOD_ITEM_ID,
  grantInventoryItem,
  loadInventoryItemCounts,
} from './inventory.js';
import {
  loadWorldTitles,
  saveWorldTitles,
} from './stampMilestones.js';

export const DISCOVERY_MILESTONE_EVENT = 'discovery:milestone';

export const DISCOVERY_MILESTONE_REWARDS = Object.freeze([
  Object.freeze({
    cityId: 'lyon',
    discoveryIds: Object.freeze([
      'lyon-d1',
      'lyon-d2',
      'lyon-d3',
      'lyon-d4',
      'lyon-d5',
      'lyon-d6',
      'lyon-d7',
      'lyon-d8',
    ]),
    titleKey: 'discovery-lyon',
    petFood: 1,
  }),
  Object.freeze({
    cityId: 'bordeaux',
    discoveryIds: Object.freeze([
      'bordeaux-d1',
      'bordeaux-d2',
      'bordeaux-d3',
      'bordeaux-d4',
      'bordeaux-d5',
      'bordeaux-d6',
      'bordeaux-d7',
      'bordeaux-d8',
    ]),
    titleKey: 'discovery-bordeaux',
    petFood: 1,
  }),
  Object.freeze({
    cityId: 'strasbourg',
    discoveryIds: Object.freeze([
      'strasbourg-d1',
      'strasbourg-d2',
      'strasbourg-d3',
      'strasbourg-d4',
      'strasbourg-d5',
      'strasbourg-d6',
      'strasbourg-d7',
    ]),
    titleKey: 'discovery-strasbourg',
    petFood: 1,
  }),
]);

const REWARD_BY_CITY = new Map(
  DISCOVERY_MILESTONE_REWARDS.map((reward) => [reward.cityId, reward]),
);
const DISCOVERY_TITLE_KEYS = new Set(
  DISCOVERY_MILESTONE_REWARDS.map((reward) => reward.titleKey),
);

function discoveryIdsFromDefinitions(discoveries) {
  if (!Array.isArray(discoveries)) return new Set();
  return new Set(discoveries
    .map((discovery) => discovery?.id)
    .filter((id) => typeof id === 'string' && id.length > 0));
}

function rewardResult({
  reward,
  discoveredCount,
  complete,
  unlocked,
  titles,
  inventory,
}) {
  return Object.freeze({
    cityId: reward.cityId,
    discoveredCount,
    totalCount: reward.discoveryIds.length,
    complete,
    unlocked: Object.freeze(unlocked),
    titles: Object.freeze(titles),
    inventory: Object.freeze(inventory),
  });
}

// S3와 같은 worldTitles 키를 지급 영수증으로 쓴다. 저장된 발견 ID는 현재 도시
// mainRoute 정본과 S9 allowlist 양쪽에 모두 있는 것만 세어 유령 ID를 fail-closed 처리한다.
export function claimDiscoveryMilestoneReward({
  cityId,
  discoveries,
  discoveredIds,
  storage = globalThis?.localStorage,
}) {
  const reward = REWARD_BY_CITY.get(cityId);
  if (!reward || !Array.isArray(discoveries) || !(discoveredIds instanceof Set)) return null;

  const expectedIds = new Set(reward.discoveryIds);
  const definitionIds = discoveryIdsFromDefinitions(discoveries);
  const definitionsMatch = definitionIds.size === expectedIds.size
    && reward.discoveryIds.every((id) => definitionIds.has(id));
  const discoveredCount = reward.discoveryIds.reduce(
    (count, id) => count + (discoveredIds.has(id) ? 1 : 0),
    0,
  );
  const complete = definitionsMatch && discoveredCount === reward.discoveryIds.length;
  const titles = loadWorldTitles(storage);

  if (!complete || titles.includes(reward.titleKey)) {
    return rewardResult({
      reward,
      discoveredCount,
      complete,
      unlocked: [],
      titles,
      inventory: loadInventoryItemCounts(storage),
    });
  }

  const inventory = grantInventoryItem(PET_FOOD_ITEM_ID, reward.petFood, storage);
  const nextTitles = saveWorldTitles([...titles, reward.titleKey], storage);
  return rewardResult({
    reward,
    discoveredCount,
    complete,
    unlocked: [reward.titleKey],
    titles: nextTitles,
    inventory,
  });
}

// Claude가 도시별 카피를 붙이기 전에는 기술 키를 노출하지 않고 key-only 토스트를 만든다.
export function discoveryTitleToastForUnlocked(unlockedTitleKeys) {
  if (!Array.isArray(unlockedTitleKeys)) return null;
  const titleKey = unlockedTitleKeys
    .filter((key) => DISCOVERY_TITLE_KEYS.has(key))
    .at(-1);
  return titleKey ? Object.freeze({ key: titleKey }) : null;
}
