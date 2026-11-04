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
 * 하루 열쇠 — 정본 활동일(learningActivity.activityDay: 04시 학습일, 연속 · 표시 통계와 같은 날)을 받으면 그것을, 못 받았으면 기기 날짜.
 * 정본 모듈은 ts-fsrs를 끌고 와 첫 JS 밖(authFirstLoad 계약)이라 부르는 쪽이 import()로 받아 넘긴다(STREAK-COURSEMAP-001).
 */
function dayKeyOf(activity) {
  if (typeof activity?.activityDay !== 'function') return localDateKey;
  return (date = new Date()) => {
    const value = date instanceof Date ? date : new Date(date);
    return Number.isNaN(value.getTime()) ? '' : activity.activityDay(value.toISOString());
  };
}

/**
 * 완료 레슨의 날짜 메타데이터만 기록한다.
 * 기존 studied_lesson 진도 payload는 수정하지 않으며 사용자/게스트 스코프를 분리한다.
 */
export function recordLessonActivity(userId, {
  now = new Date(),
  storage = defaultStorage(),
  activity = null,
} = {}) {
  const today = dayKeyOf(activity)(now);
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
 * activity(정본 모듈)와 profile을 받으면 셈도 정본으로(STREAK-COURSEMAP-001, 2026-11-04 KST): 끊긴 연속은 0(liveStreakCount —
 * 대시보드 「연속」과 같은 수), 오늘 레슨이 아직 안 셌으면 streakAfterActivity(쉼 규칙 포함). 예전엔 저장된 streak_count를 그대로 보여
 * 끊긴 연속이 코스 지도에만 살아 있었고, 기기 자정 기준이라 00 ~ 04시 레슨은 하루를 더 붙였다.
 */
export function getLearningMotivation(userId, {
  now = new Date(),
  storage = defaultStorage(),
  remoteStreak = 0,
  remoteLastStreakDate = '',
  profile = null,
  activity = null,
} = {}) {
  const today = dayKeyOf(activity)(now);
  const stored = readStoredActivity(userId, storage);
  const dailyGoalComplete = Boolean(today && stored.lastLessonDate === today);

  if (!userId) {
    return {
      streakCount: stored.lessonStreak,
      dailyGoalComplete,
      source: 'guest',
    };
  }

  if (profile && typeof activity?.liveStreakCount === 'function' && typeof activity?.streakAfterActivity === 'function') {
    return {
      streakCount: normalizeCount(dailyGoalComplete ? activity.streakAfterActivity(profile, now.getTime()) : activity.liveStreakCount(profile, now.getTime())),
      dailyGoalComplete,
      source: 'remote',
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
