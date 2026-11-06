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

// STREAK-COURSEMAP-001(2026-11-04 KST) — 코스 지도 연속 = 정본(learningActivity) 셈 · 04시 학습일. 예전엔 저장된 streak_count를
// 그대로 보여 끊긴 연속이 코스 지도에만 살아 있었고(대시보드는 「–」), 기기 자정 기준이라 00 ~ 04시 레슨이 하루를 더 붙였다.
describe('코스 지도 연속 — 정본 셈(대시보드 「연속」과 같은 수)', async () => {
  const activity = await import('../../learningActivity.js');
  const { streakView } = await import('../../learnDashboard.js');
  const profileOf = (streak, last, rest = 0) => ({ id: 'user-1', streak_count: streak, last_streak_date: last, streak_freeze_count: rest });
  const at = iso => new Date(iso);

  it('끊긴 연속은 0 — 대시보드 streakView와 같은 수', () => {
    const storage = memoryStorage();
    const now = at('2026-11-08T12:00:00+09:00');
    const profile = profileOf(6, '2026-11-04');
    const m = getLearningMotivation('user-1', { storage, now, profile, activity });
    expect(m.streakCount).toBe(0);
    expect(streakView(profile, now.getTime()).value).toBe('0일'); // 발매 점검 #10 — 0은 「0일」(예전 「–」)
    // 정본 없이는(예전 셈) 6이 그대로 보였다
    expect(getLearningMotivation('user-1', { storage, now, remoteStreak: 6, remoteLastStreakDate: '2026-11-04' }).streakCount).toBe(6);
  });

  it('00 ~ 04시 레슨은 어제 학습일 — 이미 센 날이라 하루를 더 붙이지 않는다', () => {
    const storage = memoryStorage();
    const now = at('2026-11-05T01:30:00+09:00'); // 학습일 11/4
    recordLessonActivity('user-1', { storage, now, activity });
    const m = getLearningMotivation('user-1', { storage, now, profile: profileOf(6, '2026-11-04'), activity });
    expect(m).toEqual({ streakCount: 6, dailyGoalComplete: true, source: 'remote' });
    expect(JSON.parse(storage.values.get(learningActivityStorageKey('user-1'))).lastLessonDate).toBe('2026-11-04');
  });

  it('「오늘 레슨 했음」도 학습일로 — 03시 레슨(학습일 11/4)을 05시(학습일 11/5)에 「오늘 했음」으로 보지 않는다', () => {
    const storage = memoryStorage();
    recordLessonActivity('user-1', { storage, now: at('2026-11-05T03:00:00+09:00'), activity });
    const now = at('2026-11-05T05:00:00+09:00'); // 두 시각 모두 UTC 날짜는 11/4 — 기기 날짜(UTC 러너)로는 같은 날로 보였다
    expect(getLearningMotivation('user-1', { storage, now, profile: profileOf(6, '2026-11-04'), activity }))
      .toEqual({ streakCount: 6, dailyGoalComplete: false, source: 'remote' });
  });

  it('오늘 레슨을 서버가 아직 안 셌으면 하루 더(쉼 규칙 포함 — streakAfterActivity)', () => {
    const storage = memoryStorage();
    const now = at('2026-11-05T12:00:00+09:00');
    recordLessonActivity('user-1', { storage, now, activity });
    expect(getLearningMotivation('user-1', { storage, now, profile: profileOf(6, '2026-11-04'), activity }).streakCount).toBe(7);
    expect(getLearningMotivation('user-1', { storage, now, profile: profileOf(6, '2026-11-03', 1), activity }).streakCount).toBe(7); // 하루 빈 날을 쉼이 메움
    expect(getLearningMotivation('user-1', { storage, now, profile: profileOf(6, '2026-11-02'), activity }).streakCount).toBe(1);
  });

  it('배선 — 코스 지도 · 레슨 기록이 정본을 넘기고, 지표 사전의 연속 하루는 학습일', async () => {
    const fs = await import('node:fs');
    const page = fs.readFileSync('src/views/CourseMapPage.jsx', 'utf8');
    expect(page).toContain("import('../lib/learningActivity').then((mod) => { activity = mod; }).catch(() => {}).finally(syncMotivation);");
    expect(page).toContain('profile: user?.id && profile?.id === user.id ? profile : null,');
    expect(fs.readFileSync('src/lib/learn/progressStore.js', 'utf8')).toContain("const activity = await import('../learningActivity').catch(() => null);\n    recordLessonActivity(userId, { activity });");
    const { METRICS } = await import('../../metrics/registry.js');
    expect(METRICS.streak.day).toBe('learning');
  });
});
