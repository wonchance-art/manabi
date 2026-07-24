import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEARNING_ACTIVITY_EVENT,
  getLearningMotivation,
  recordLessonActivity,
} from '../learningActivity.js';
import { learningActivityStorageKey } from '../../world/storageSchema.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    values,
  };
}

describe('learningActivity', () => {
  let storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('게스트 레슨 완료를 날짜별로 멱등 기록하고 연속일만 스트릭을 올린다', () => {
    const day1 = new Date('2026-07-24T12:00:00');
    const day2 = new Date('2026-07-25T12:00:00');
    const day4 = new Date('2026-07-27T12:00:00');

    expect(recordLessonActivity(undefined, { storage, now: day1 })).toEqual({
      lastLessonDate: '2026-07-24',
      lessonStreak: 1,
    });
    expect(recordLessonActivity(undefined, { storage, now: day1 }).lessonStreak).toBe(1);
    expect(recordLessonActivity(undefined, { storage, now: day2 }).lessonStreak).toBe(2);
    expect(recordLessonActivity(undefined, { storage, now: day4 }).lessonStreak).toBe(1);

    expect(getLearningMotivation(undefined, { storage, now: day4 })).toEqual({
      streakCount: 1,
      dailyGoalComplete: true,
      source: 'guest',
    });
  });

  it('게스트와 로그인 사용자의 일일 활동을 서로 다른 키에 격리한다', () => {
    const now = new Date('2026-07-24T12:00:00');
    recordLessonActivity(undefined, { storage, now });
    recordLessonActivity('user-1', { storage, now });

    expect(storage.values.has(learningActivityStorageKey())).toBe(true);
    expect(storage.values.has(learningActivityStorageKey('user-1'))).toBe(true);
    expect(storage.values.size).toBe(2);
  });

  it('레슨 완료 후 코스 지도가 즉시 다시 읽을 수 있는 갱신 이벤트를 보낸다', () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal('CustomEvent', class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    });

    recordLessonActivity('user-1', {
      storage,
      now: new Date('2026-07-24T12:00:00'),
    });

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: LEARNING_ACTIVITY_EVENT,
      detail: expect.objectContaining({
        userId: 'user-1',
        lastLessonDate: '2026-07-24',
        lessonStreak: 1,
      }),
    }));
  });

  it('로그인은 profile 스트릭을 정본으로 쓰고 RPC 재조회 전 오늘 증가분만 낙관 반영한다', () => {
    const now = new Date('2026-07-24T12:00:00');
    recordLessonActivity('user-1', { storage, now });

    expect(getLearningMotivation('user-1', {
      storage,
      now,
      remoteStreak: 6,
      remoteLastStreakDate: '2026-07-23',
    })).toEqual({
      streakCount: 7,
      dailyGoalComplete: true,
      source: 'remote',
    });

    expect(getLearningMotivation('user-1', {
      storage,
      now,
      remoteStreak: 7,
      remoteLastStreakDate: '2026-07-24',
    }).streakCount).toBe(7);
  });

  it('깨진 payload나 차단 저장소는 0일·미완료로 안전하게 닫힌다', () => {
    storage.values.set(learningActivityStorageKey(), '{broken');
    expect(getLearningMotivation(undefined, { storage })).toEqual({
      streakCount: 0,
      dailyGoalComplete: false,
      source: 'guest',
    });

    const blocked = {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(() => { throw new Error('blocked'); }),
    };
    expect(() => recordLessonActivity(undefined, { storage: blocked })).not.toThrow();
  });
});
