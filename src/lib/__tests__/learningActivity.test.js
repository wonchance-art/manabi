import { describe, expect, it, vi } from 'vitest';
import { activityDay, createProfileReadOnlyRefresh, isSettledFsrsActivity, replayActivityDays } from '../learningActivity';

const baseline = { streak_count: 5, streak_freeze_count: 1, last_streak_date: '2026-10-01' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

describe('eligible activity day and existing freeze-earn policy', () => {
  it('uses verified UTC midnight, separately from the KST 04:00 new-card boundary', () => {
    expect(activityDay('2026-10-03T23:59:59.999Z')).toBe('2026-10-03');
    expect(activityDay('2026-10-04T00:00:00.000Z')).toBe('2026-10-04');
    expect(activityDay('2026-10-04T04:00:00+09:00')).toBe('2026-10-03');
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
