import {
  STAMP_MILESTONE_REWARDS,
  canonicalStampCount,
  loadWorldTitles,
} from '../../lib/world/stampMilestones.js';
import { worldTitleCopyForKey } from '../../lib/world/worldTitleCopy.js';

export const STAMP_TITLE_TOAST_DURATION_MS = 4200;

function titlePresentationForKey(titleKey) {
  const copy = worldTitleCopyForKey(titleKey);
  if (!copy) return null;
  return Object.freeze({ key: titleKey, name: copy.name, line: copy.line });
}

export function stampTitlePresentation(stamps, storage = globalThis?.localStorage) {
  const stampCount = canonicalStampCount(stamps);
  const titles = loadWorldTitles(storage)
    .map(titlePresentationForKey)
    .filter(Boolean);
  const nextReward = STAMP_MILESTONE_REWARDS.find(({ count }) => count > stampCount) ?? null;
  const nextMilestone = nextReward
    ? Object.freeze({
      count: nextReward.count,
      remaining: nextReward.count - stampCount,
      titleKey: nextReward.titleKey,
    })
    : null;

  return Object.freeze({
    stampCount,
    titles: Object.freeze(titles),
    nextMilestone,
    progressLine: nextMilestone
      ? `다음 칭호까지 도장 ${nextMilestone.remaining}개`
      : '모든 여행 칭호를 모았어요.',
  });
}

export function stampTitleToastForUnlocked(unlockedTitleKeys) {
  if (!Array.isArray(unlockedTitleKeys)) return null;
  const titles = unlockedTitleKeys
    .map(titlePresentationForKey)
    .filter(Boolean);
  return titles.at(-1) ?? null;
}
