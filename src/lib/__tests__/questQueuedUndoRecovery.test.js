import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { withLegacyReviewLock } from '../legacyReviewSync';
import { sliceBetween } from './helpers/sliceBetween.js';

// 실제 handler를 실행하며 네트워크·React 경계만 대체한다.
const source = readFileSync(new URL('../../components/world/QuestReview.jsx', import.meta.url), 'utf8');
const handler = sliceBetween(source, '  const undoLast = async () => {', '\n  // ── 키').replaceAll('import(', 'loadModule(');
const receipt = { ok: true, status: 'settled', queued: false };
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function fixture() {
  let current = true;
  const last = { userId: 'actor-a', wordId: 'word-a', lang: 'Japanese', itemKey: '猫',
    rating: 3, queued: true, reviewedAt: '2026-10-05T00:00:00.000Z',
    prev: { interval: 1, ease_factor: 2.5, repetitions: 1, next_review_at: null, last_reviewed_at: null },
    idx: 2, right: 1 };
  const undoQueuedReview = vi.fn(async () => receipt);
  const c = { userId: 'actor-a', lastGradeRef: { current: last }, gradingRef: { current: false },
    actorScopeRef: { current: {} }, isCurrentScope: () => current, supabase: {},
    loadModule: vi.fn(async () => ({ undoQueuedReview, withLegacyReviewLock })),
    setGradeError: vi.fn(), persistQuestReviewGrade: vi.fn(async () => {}), writeReviewEvents: vi.fn(async () => {}),
    rightRef: { current: 2 }, setRight: vi.fn(), setIdx: vi.fn(), setFlipped: vi.fn(), setPhase: vi.fn() };
  const undoLast = new Function(...Object.keys(c), `${handler}\nreturn undoLast;`)(...Object.values(c));
  return { c, last, undoLast, undoQueuedReview, leave: () => { current = false; } };
}

describe('queued quest undo uses confirmed durable recovery', () => {
  it('waits for compensation, passes the snapshot and blocks duplicate clicks', async () => {
    const f = fixture(), reply = deferred(); f.undoQueuedReview.mockReturnValue(reply.promise);
    const pending = f.undoLast(); await tick();
    expect(f.c.lastGradeRef.current).toBe(f.last);
    expect(f.c.setIdx).not.toHaveBeenCalled();
    await f.undoLast(); expect(f.undoQueuedReview).toHaveBeenCalledTimes(1);
    expect(f.undoQueuedReview).toHaveBeenCalledWith(f.c.supabase, f.last, { getAccountId: expect.any(Function) });
    reply.resolve(receipt); await pending;
    expect(f.c.lastGradeRef.current).toBeNull(); expect(f.c.setIdx).toHaveBeenCalledWith(2);
    expect(f.c.setRight).toHaveBeenCalledWith(1); expect(f.c.gradingRef.current).toBe(false);
    expect(f.c.writeReviewEvents).not.toHaveBeenCalled();
  });
  it.each([undefined, { ok: true }, { ok: false }, { ...receipt, status: 'pending' }, { ...receipt, queued: true }])(
    'retains the exact retry snapshot for an unconfirmed receipt %j', async reply => {
      const f = fixture(); f.undoQueuedReview.mockResolvedValueOnce(reply);
      await f.undoLast();
      expect(f.c.lastGradeRef.current).toBe(f.last); expect(f.c.setIdx).not.toHaveBeenCalled();
      expect(f.c.gradingRef.current).toBe(false); expect(f.c.setGradeError).toHaveBeenLastCalledWith('되돌리지 못했어요. 연결을 확인해 주세요.');
      await f.undoLast(); expect(f.c.lastGradeRef.current).toBeNull();
      expect(f.undoQueuedReview.mock.calls[1][1]).toEqual(f.undoQueuedReview.mock.calls[0][1]);
    },
  );
  it('retains retry after rejection and does not mutate another actor on a late receipt', async () => {
    const f = fixture(); f.undoQueuedReview.mockRejectedValueOnce(new Error('lost reply'));
    await f.undoLast(); expect(f.c.lastGradeRef.current).toBe(f.last);
    const reply = deferred(); f.undoQueuedReview.mockReturnValue(reply.promise);
    const pending = f.undoLast(); await tick(); f.leave();
    expect(f.undoQueuedReview.mock.calls[1][2].getAccountId()).toBeNull();
    reply.resolve(receipt); await pending;
    expect(f.c.lastGradeRef.current).toBe(f.last); expect(f.c.setIdx).not.toHaveBeenCalled();
  });
  it('serializes online restore and waits for strict compensation before rewinding', async () => {
    const f = fixture(), held = deferred(), entered = deferred(), marker = deferred(); f.last.queued = false;
    const busy = withLegacyReviewLock('actor-a', async () => { entered.resolve(); await held.promise; });
    await entered.promise;
    f.c.writeReviewEvents.mockReturnValue(marker.promise);
    const undo = f.undoLast(); await tick();
    expect(f.c.persistQuestReviewGrade).not.toHaveBeenCalled();
    held.resolve(); await busy; await tick();
    expect(f.c.persistQuestReviewGrade).toHaveBeenCalledTimes(1);
    expect(f.c.writeReviewEvents).toHaveBeenCalledWith('actor-a', expect.any(Array), { strict: true });
    expect(f.c.lastGradeRef.current).toBe(f.last); expect(f.c.setIdx).not.toHaveBeenCalled();
    marker.resolve(); await undo; expect(f.c.lastGradeRef.current).toBeNull();
  });
  it('retains online snapshot after the strict compensation fails', async () => {
    const f = fixture(); f.last.queued = false;
    f.c.writeReviewEvents.mockRejectedValueOnce(new Error('marker failed'));
    await f.undoLast(); expect(f.c.lastGradeRef.current).toBe(f.last);
    expect(f.c.setIdx).not.toHaveBeenCalled(); expect(f.c.gradingRef.current).toBe(false);
  });
});
