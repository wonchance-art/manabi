import { describe, expect, it, vi } from 'vitest';
import { ACTIVITY_DAY_SWITCH_AT, activityDay, createProfileReadOnlyRefresh, isSettledFsrsActivity, nearActivityRollover, replayActivityDays } from '../learningActivity';
import { learningDateString } from '../growthStats';
import fs from 'node:fs';

const baseline = { streak_count: 5, streak_freeze_count: 1, last_streak_date: '2026-10-01' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

describe('eligible activity day and existing freeze-earn policy', () => {
  it('uses verified UTC midnight, separately from the KST 04:00 new-card boundary', () => {
    expect(activityDay('2026-10-03T23:59:59.999Z')).toBe('2026-10-03');
    expect(activityDay('2026-10-04T00:00:00.000Z')).toBe('2026-10-04');
    expect(activityDay('2026-10-04T04:00:00+09:00')).toBe('2026-10-03');
  });
  // STREAK-LEARNING-DAY-001(오너 결정 2026-11-01 KST): 전환 뒤 연속의 하루 = 04시 학습일 — 표시 통계(growthStats)와 같은 날.
  it('after the switch the activity day is the KST 04:00 learning day, same as the display statistics', () => {
    expect(ACTIVITY_DAY_SWITCH_AT).toBe(Date.parse('2026-11-03T04:00:00+09:00'));
    expect(activityDay('2026-11-03T03:59:59.999+09:00')).toBe('2026-11-02'); // 전환 직전: UTC 날짜(11/2 18:59Z)
    expect(activityDay('2026-11-04T08:00:00+09:00')).toBe('2026-11-04'); // 04–09시: UTC로는 전날, 학습일로는 그날
    expect(activityDay('2026-11-04T02:00:00+09:00')).toBe('2026-11-03'); // 04시 전 = 전날 학습일
    for (const t of ['2026-11-05T03:00:00+09:00', '2026-11-05T05:00:00+09:00', '2026-11-05T23:30:00+09:00']) {
      expect(activityDay(t)).toBe(learningDateString(Date.parse(t)));
    }
    // 같은 전환 시각 · 같은 식이 마이그레이션에 있다(DB 정본 fsrs_private.activity_day).
    const sql = fs.readFileSync('supabase/migrations/20261101130000_streak_learning_day.sql', 'utf8');
    expect(sql).toContain("SELECT '2026-11-03 04:00:00+09'::timestamptz");
    expect(sql).toContain("((p_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date");
  });
  it('the device-clock guard follows the rollover — UTC midnight before the switch, KST 04:00 (19:00Z) after', () => {
    expect(nearActivityRollover(new Date('2026-11-01T00:05:00Z'))).toBe(true);
    expect(nearActivityRollover(new Date('2026-11-01T19:05:00Z'))).toBe(false);
    expect(nearActivityRollover(new Date('2026-11-05T19:05:00Z'))).toBe(true);
    expect(nearActivityRollover(new Date('2026-11-05T18:50:00Z'))).toBe(true);
    expect(nearActivityRollover(new Date('2026-11-05T00:05:00Z'))).toBe(false);
  });
  it('day D arriving after D+1 converges with chronological receipts, restoring an unnecessarily spent freeze', () => {
    const gap = replayActivityDays(baseline, ['2026-10-03']);
    expect(gap).toEqual({ streak_count: 6, streak_freeze_count: 0, last_streak_date: '2026-10-03' });
    const late = replayActivityDays(baseline, ['2026-10-03', '2026-10-02']);
    expect(late).toEqual(replayActivityDays(baseline, ['2026-10-02', '2026-10-03']));
    expect(late).toEqual({ streak_count: 7, streak_freeze_count: 2, last_streak_date: '2026-10-03' });
    expect(baseline.streak_count).toBe(5);
    expect(replayActivityDays({ ...baseline, streak_count: null }, ['2026-10-01'])).toEqual({ ...baseline, streak_count: null });
  });
  it('deduplicates same-day activity and does not fabricate pre-baseline history', () => {
    expect(replayActivityDays(baseline, ['2026-10-01', '2026-09-30'])).toEqual(baseline);
    expect(replayActivityDays(baseline, ['2026-10-02', '2026-10-02'])).toEqual({ ...baseline, streak_count: 6, last_streak_date: '2026-10-02' });
  });
  it('preserves existing gap/reset, freeze consumption and seven-day earning cap', () => {
    expect(replayActivityDays({ ...baseline, streak_count: 6 }, ['2026-10-03'])).toEqual({ streak_count: 7, streak_freeze_count: 1, last_streak_date: '2026-10-03' });
    expect(replayActivityDays({ ...baseline, streak_count: 6, streak_freeze_count: 2 }, ['2026-10-02']).streak_freeze_count).toBe(2);
    expect(replayActivityDays(baseline, ['2026-10-04'])).toEqual({ streak_count: 1, streak_freeze_count: 1, last_streak_date: '2026-10-04' });
  });
  it('rejects malformed dates and integer overflow instead of inventing state', () => {
    expect(() => replayActivityDays(baseline, ['2026-02-30'])).toThrow('invalid_activity_day');
    expect(() => replayActivityDays({ ...baseline, streak_count: 2147483647 }, ['2026-10-02'])).toThrow('activity_streak_overflow');
    expect(() => replayActivityDays({ ...baseline, streak_freeze_count: -1 }, [])).toThrow('invalid_activity_profile');
  });
});

describe('readonly profile refresh after committed activity', () => {
  it('reads only the current actor and treats missing profile as missing, without creating one', async () => {
    const read = vi.fn(async () => ({ data: null, error: { code: 'PGRST116' } })), apply = vi.fn();
    const refresh = createProfileReadOnlyRefresh({ getActor: () => 'A', read, onProfile: apply });
    await refresh.refresh(null); await refresh.refresh('B');
    expect(read).not.toHaveBeenCalled();
    expect(await refresh.refresh('A')).toBeNull();
    expect(read).toHaveBeenCalledExactlyOnceWith('A');
    expect(apply).toHaveBeenCalledExactlyOnceWith(null, 'A');
  });
  it('discards late old-account success and error without applying another account profile', async () => {
    let actor = 'A'; const pending = deferred(), apply = vi.fn();
    const refresh = createProfileReadOnlyRefresh({ getActor: () => actor, read: () => pending.promise, onProfile: apply });
    const request = refresh.refresh('A'); actor = 'B'; refresh.invalidate();
    pending.resolve({ data: { id: 'A', ...baseline }, error: null });
    expect(await request).toBeNull(); expect(apply).not.toHaveBeenCalled();
  });
  it('suppresses a rejected old-account network read after invalidation', async () => {
    let actor = 'A', reject; const pending = new Promise((resolve, failure) => { reject = failure; });
    const apply = vi.fn(), refresh = createProfileReadOnlyRefresh({ getActor: () => actor, read: () => pending, onProfile: apply });
    const request = refresh.refresh('A'); actor = 'B'; refresh.invalidate(); reject(new Error('old request aborted'));
    expect(await request).toBeNull(); expect(apply).not.toHaveBeenCalled();
  });
  it('only applies the latest same-account read and keeps real errors visible', async () => {
    const old = deferred(), fresh = deferred(), apply = vi.fn(); let i = 0;
    const refresh = createProfileReadOnlyRefresh({ getActor: () => 'A', read: () => (++i === 1 ? old : fresh).promise, onProfile: apply });
    const first = refresh.refresh('A'), second = refresh.refresh('A');
    fresh.resolve({ data: { id: 'A', streak_count: 7 } }); await second;
    old.resolve({ data: { id: 'A', streak_count: 1 } }); await first;
    expect(apply).toHaveBeenCalledExactlyOnceWith({ id: 'A', streak_count: 7 }, 'A');
    const failed = createProfileReadOnlyRefresh({ getActor: () => 'A', read: async () => ({ error: new Error('offline') }), onProfile: apply });
    await expect(failed.refresh('A')).rejects.toThrow('offline');
  });
  it('refuses a foreign profile response even when the request used the right owner', async () => {
    const apply = vi.fn();
    const refresh = createProfileReadOnlyRefresh({ getActor: () => 'A', read: async () => ({ data: { id: 'B' } }), onProfile: apply });
    await expect(refresh.refresh('A')).rejects.toThrow('profile_actor_mismatch'); expect(apply).not.toHaveBeenCalled();
  });
  it('only settled actor-bound grade receipts authorize a display refresh, including replay', () => {
    const event = { accountId: 'A', action: 'grade', status: 'applied', operationId: 'op', response: { ok: true, actorId: 'A', operationId: 'op' } };
    expect(isSettledFsrsActivity(event, 'A')).toBe(true);
    expect(isSettledFsrsActivity({ ...event, status: 'replayed' }, 'A')).toBe(true);
    for (const patch of [{ status: 'pending' }, { action: 'undo' }, { action: 'save' }, { accountId: 'B' }, { response: { ...event.response, operationId: 'wrong' } }]) {
      expect(isSettledFsrsActivity({ ...event, ...patch }, 'A')).toBe(false);
    }
    expect(isSettledFsrsActivity(event, 'B')).toBe(false);
  });
});
