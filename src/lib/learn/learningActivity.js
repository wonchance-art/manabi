import { learningActivityStorageKey } from '../world/storageSchema.js';

export const LEARNING_ACTIVITY_EVENT = 'manabi:learning-activity';

const EMPTY_ACTIVITY = Object.freeze({
  lastLessonDate: '',
  lessonStreak: 0,
});

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

function localDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOrdinal(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function readStoredActivity(userId, storage) {
  if (!storage) return { ...EMPTY_ACTIVITY };

  try {
    const value = JSON.parse(storage.getItem(learningActivityStorageKey(userId)) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...EMPTY_ACTIVITY };
    }

    return {
      lastLessonDate: /^\d{4}-\d{2}-\d{2}$/.test(value.lastLessonDate)
        ? value.lastLessonDate
        : '',
      lessonStreak: normalizeCount(value.lessonStreak),
    };
  } catch {
    return { ...EMPTY_ACTIVITY };
  }
}

function emitActivity(detail) {
  try {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    const event = typeof CustomEvent === 'function'
      ? new CustomEvent(LEARNING_ACTIVITY_EVENT, { detail })
      : new Event(LEARNING_ACTIVITY_EVENT);
    window.dispatchEvent(event);
  } catch {}
}

/**
 * 완료 레슨의 날짜 메타데이터만 기록한다.
 * 기존 studied_lesson 진도 payload는 수정하지 않으며 사용자/게스트 스코프를 분리한다.
 */
export function recordLessonActivity(userId, {
  now = new Date(),
  storage = defaultStorage(),
} = {}) {
  const today = localDateKey(now);
  if (!today) return { ...EMPTY_ACTIVITY };

  const previous = readStoredActivity(userId, storage);
  const previousOrdinal = dateOrdinal(previous.lastLessonDate);
  const todayOrdinal = dateOrdinal(today);
  let lessonStreak = previous.lessonStreak;

  if (previous.lastLessonDate !== today) {
    lessonStreak = previousOrdinal != null && todayOrdinal - previousOrdinal === 1
      ? Math.max(1, previous.lessonStreak + 1)
      : 1;
  }

  const next = { lastLessonDate: today, lessonStreak };
  try {
    storage?.setItem(learningActivityStorageKey(userId), JSON.stringify(next));
  } catch {}
  emitActivity({ userId: userId || null, ...next });
  return next;
}

/**
 * 코스 지도에 필요한 스트릭/오늘 목표 표시 상태.
 * 로그인 스트릭은 profiles 정본을 우선하고, 아직 profile 재조회 전이면 오늘 로컬
 * 레슨 이벤트와 last_streak_date를 이용해 한 번만 낙관 반영한다.
 */
export function getLearningMotivation(userId, {
  now = new Date(),
  storage = defaultStorage(),
  remoteStreak = 0,
  remoteLastStreakDate = '',
} = {}) {
  const today = localDateKey(now);
  const activity = readStoredActivity(userId, storage);
  const dailyGoalComplete = Boolean(today && activity.lastLessonDate === today);

  if (!userId) {
    return {
      streakCount: activity.lessonStreak,
      dailyGoalComplete,
      source: 'guest',
    };
  }

  let streakCount = normalizeCount(remoteStreak);
  if (dailyGoalComplete && remoteLastStreakDate !== today) {
    const remoteOrdinal = dateOrdinal(remoteLastStreakDate);
    const todayOrdinal = dateOrdinal(today);
    if (remoteOrdinal == null) {
      streakCount = Math.max(1, streakCount);
    } else {
      streakCount = todayOrdinal - remoteOrdinal === 1
        ? Math.max(1, streakCount + 1)
        : 1;
    }
  }

  return {
    streakCount,
    dailyGoalComplete,
    source: 'remote',
  };
}
