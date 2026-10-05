import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { withLegacyReviewLock } from '../../lib/legacyReviewSync';

// 실제 VocabPage 핸들러를 실행한다. React/네트워크 경계만 주입해 ref와 수명주기를 관측한다.
const source = readFileSync(new URL('../VocabPage.jsx', import.meta.url), 'utf8');
const handler = (start, end) => sliceBetween(source, start, end)
  .replaceAll('import(', 'loadModule(');
const scoreSource = handler('  const handleScore = async', '  const handleSkip =');
const undoSource = handler('  const undoLastGrade = async', '  // 객관식·듣기');
const lifecycleSource = sliceBetween(source, '  useEffect(() => {\n    workspaceAlive.current = true;', '  }, []);') + '  }, []);';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const snapshot = () => ({ wordId: 'card-a', itemKey: '猫', word: '猫', lang: 'Japanese', rating: 3,
  reviewedAt: '2026-10-04T14:59:00.000Z', queued: true, reviewIdx: 2, requeued: false,
  wasNew: false, prev: { interval: 5, ease_factor: 3, repetitions: 1, next_review_at: '2026-10-03T00:00:00Z', last_reviewed_at: null } });

function fixture() {
  let mountEffect, cleanup;
  const undoQueuedReview = vi.fn(async () => ({ ok: true, queued: false, status: 'settled', compensated: true }));
  const persistVocabGrade = vi.fn(async () => {});
  const recordReviewCompleted = vi.fn(async () => ({ ok: true, queued: true, reviewedAt: '2026-10-04T15:00:00.000Z' }));
  const c = {
    user: { id: 'actor-a' }, workspaceAlive: { current: true }, mutationGuard: { current: { accountId: 'actor-a' } },
    lastGradeRef: { current: snapshot() }, scoringRef: { current: false }, pendingGradeRef: { current: 0 },
    gradeSequenceRef: { current: 0 }, gradeSessionRef: { current: 0 }, gradeLifetimeRef: { current: 0 },
    supabase: {}, queryClient: {}, toast: vi.fn(), invalidateVocabularyLearning: vi.fn(),
    fsrsReview: { controller: { canLegacy: () => true } },
    admission: { current: { compatibility: false }, controller: { leave: vi.fn(), getSnapshot: () => ({ current: { questionKey: 'session:0', cardId: 'card-a' } }) } },
    loadModule: vi.fn(async path => path.endsWith('reviewOutbox') ? { undoQueuedReview }
      : { persistVocabGrade, calculateFSRS: () => ({ interval: 10, ease_factor: 4, repetitions: 1, next_review_at: '2026-10-06T00:00:00Z' }) }),
    logReviewEvents: vi.fn(async () => {}), withLegacyReviewLock,
    setReviewQueue: vi.fn(), setIntroIds: vi.fn(), saveIntroIds: vi.fn(),
    setReviewSessionId: vi.fn(), setReviewIdx: vi.fn(), setShowAnswer: vi.fn(), setContextSelected: vi.fn(),
    setTypingAnswer: vi.fn(), setReviewFinished: vi.fn(), friendlyToastMessage: error => error.message,
    questionKey: 'session:0', currentWord: { id: 'card-a', word_text: '猫', language: 'Japanese', meaning: '고양이' },
    reviewSupported: () => true, isNewWord: () => false, detectLang: () => 'Japanese',
    SRS_FIELDS: ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'],
    reviewIdx: 0, effectiveMode: 'flash', reviewMode: 'flash', recordReviewCompleted,
    refreshProfileReadOnly: vi.fn(async () => {}), registerNewIntro: vi.fn(), goNextReview: vi.fn(),
    useEffect: fn => { mountEffect = fn; cleanup = fn(); },
  };
  const actions = new Function(...Object.keys(c), `${lifecycleSource}\n${scoreSource}\n${undoSource}\nreturn { handleScore, undoLastGrade };`)(...Object.values(c));
  return { ...actions, c, undoQueuedReview, persistVocabGrade, recordReviewCompleted,
    unmount: () => cleanup(), remount: () => { cleanup = mountEffect(); } };
}

beforeEach(() => vi.restoreAllMocks());

describe('queued review undo recovery in the actual VocabPage handlers', () => {
  it('waits for the coordinated undo, passes the original identity/previous schedule, and rejects a concurrent click', async () => {
    const f = fixture(), reply = deferred(), last = f.c.lastGradeRef.current;
    f.undoQueuedReview.mockReturnValue(reply.promise);
    const pending = f.undoLastGrade(); await tick();
    expect(f.undoQueuedReview).toHaveBeenCalledWith(f.c.supabase, { ...last, userId: 'actor-a', itemKey: last.itemKey, reviewedAt: last.reviewedAt },
      { getAccountId: expect.any(Function) });
    expect(f.undoQueuedReview.mock.calls[0][2].getAccountId()).toBe('actor-a');
    expect(f.c.lastGradeRef.current).toBe(last);
    expect(f.c.setReviewIdx).not.toHaveBeenCalled(); expect(f.c.toast).not.toHaveBeenCalled();
    await f.undoLastGrade(); expect(f.undoQueuedReview).toHaveBeenCalledTimes(1);
    reply.resolve({ ok: true, queued: false, status: 'settled' }); await pending;
    expect(f.c.lastGradeRef.current).toBeNull(); expect(f.c.setReviewIdx).toHaveBeenCalledWith(2);
    expect(f.c.invalidateVocabularyLearning).toHaveBeenCalledWith(f.c.queryClient, 'actor-a');
    expect(f.c.toast).toHaveBeenCalledWith('되돌렸어요 — 「猫」 다시 채점', 'info');
  });

  it.each(['throw', 'negative receipt', 'missing receipt', 'pending receipt'])('keeps the same undo snapshot after %s and allows exact retry', async failure => {
    const f = fixture(), last = f.c.lastGradeRef.current;
    if (failure === 'throw') f.undoQueuedReview.mockRejectedValueOnce(new Error('lost reply'));
    else f.undoQueuedReview.mockResolvedValueOnce(failure === 'missing receipt' ? undefined
      : failure === 'pending receipt' ? { ok: true, queued: true, status: 'pending' } : { ok: false, error: new Error('not settled') });
    await f.undoLastGrade();
    expect(f.c.lastGradeRef.current).toBe(last); expect(f.c.scoringRef.current).toBe(false);
    expect(f.c.setReviewIdx).not.toHaveBeenCalled(); expect(f.c.invalidateVocabularyLearning).not.toHaveBeenCalled();
    expect(f.c.toast.mock.calls.every(([, kind]) => kind === 'error')).toBe(true);
    await f.undoLastGrade();
    expect(f.undoQueuedReview.mock.calls[1].slice(0, 2)).toEqual(f.undoQueuedReview.mock.calls[0].slice(0, 2));
    expect(f.c.lastGradeRef.current).toBeNull();
  });

  it('preserves online undo on schedule or compensation failure and awaits the strict compensation', async () => {
    const f = fixture(); f.c.lastGradeRef.current.queued = false;
    const last = f.c.lastGradeRef.current;
    f.persistVocabGrade.mockRejectedValueOnce(new Error('schedule refused'));
    await f.undoLastGrade(); expect(f.c.lastGradeRef.current).toBe(last);
    f.c.logReviewEvents.mockRejectedValueOnce(new Error('event refused'));
    await f.undoLastGrade(); expect(f.c.lastGradeRef.current).toBe(last);
    expect(f.c.logReviewEvents.mock.calls[0][2]).toEqual({ strict: true });
    expect(f.c.setReviewIdx).not.toHaveBeenCalled();
    const receipt = deferred(); f.c.logReviewEvents.mockReturnValueOnce(receipt.promise);
    const pending = f.undoLastGrade(); await tick(); expect(f.c.lastGradeRef.current).toBe(last);
    receipt.resolve(); await pending; expect(f.c.lastGradeRef.current).toBeNull();
    expect(f.persistVocabGrade.mock.calls[2]).toEqual([f.c.supabase, last.wordId,
      { interval: 5, ease_factor: 3, repetitions: 1, next_review_at: '2026-10-03T00:00:00Z' }, null]);
  });

  it.each(['actor switch', 'unmount'])('does not announce or rewind a late undo after %s', async change => {
    const f = fixture(), receipt = deferred(), last = f.c.lastGradeRef.current;
    f.undoQueuedReview.mockReturnValue(receipt.promise);
    const pending = f.undoLastGrade(); await tick();
    if (change === 'actor switch') f.c.mutationGuard.current.accountId = 'actor-b';
    else f.c.workspaceAlive.current = false;
    expect(f.undoQueuedReview.mock.calls[0][2].getAccountId()).toBe(change === 'actor switch' ? 'actor-b' : null);
    receipt.resolve({ ok: true, queued: false, status: 'settled' }); await pending;
    expect(f.c.lastGradeRef.current).toBe(last);
    expect(f.c.toast).not.toHaveBeenCalled(); expect(f.c.setReviewIdx).not.toHaveBeenCalled();
    expect(f.c.invalidateVocabularyLearning).not.toHaveBeenCalled();
  });

  it.each(['reported', 'rejected'])('preserves previous undo when optimistic grade save fails (%s)', async failure => {
    const f = fixture(), reply = deferred(), last = f.c.lastGradeRef.current;
    f.recordReviewCompleted.mockReturnValue(reply.promise);
    await f.handleScore(3); expect(f.c.goNextReview).toHaveBeenCalled();
    expect(f.c.lastGradeRef.current).toBe(last);
    await f.undoLastGrade(); expect(f.undoQueuedReview).not.toHaveBeenCalled();
    if (failure === 'reported') reply.resolve({ ok: false }); else reply.reject(new Error('save failed'));
    await tick(); expect(f.c.pendingGradeRef.current).toBe(0); expect(f.c.lastGradeRef.current).toBe(last);
    await f.undoLastGrade(); expect(f.undoQueuedReview).toHaveBeenCalledTimes(1);
  });

  it('does not replace a newer accepted grade with an older out-of-order response', async () => {
    const f = fixture(), first = deferred(), second = deferred();
    f.recordReviewCompleted.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await f.handleScore(2); await f.handleScore(4);
    second.resolve({ ok: true, queued: true, reviewedAt: '2026-10-04T15:02:00Z' }); await tick();
    const last = f.c.lastGradeRef.current;
    first.resolve({ ok: true, queued: true, reviewedAt: '2026-10-04T15:01:00Z' }); await tick();
    expect(f.c.lastGradeRef.current).toBe(last); expect(last.rating).toBe(4); expect(f.c.pendingGradeRef.current).toBe(0);
  });

  it('discards a late grade ref after a new session or unmount without blocking optimistic advance', async () => {
    const f = fixture(), reply = deferred(); f.recordReviewCompleted.mockReturnValue(reply.promise);
    await f.handleScore(3); expect(f.c.goNextReview).toHaveBeenCalled();
    f.c.gradeSessionRef.current++; f.c.lastGradeRef.current = null;
    reply.resolve({ ok: true, queued: true, reviewedAt: '2026-10-04T15:00:00Z' }); await tick();
    expect(f.c.lastGradeRef.current).toBeNull(); expect(f.c.pendingGradeRef.current).toBe(0);
    const late = deferred(); f.recordReviewCompleted.mockReturnValue(late.promise);
    await f.handleScore(3); f.c.workspaceAlive.current = false;
    const count = f.c.invalidateVocabularyLearning.mock.calls.length;
    late.resolve({ ok: true }); await tick(); expect(f.c.invalidateVocabularyLearning).toHaveBeenCalledTimes(count);
    expect(f.c.lastGradeRef.current).toBeNull();
  });

  it('actual effect cleanup resets pending refs and an old lifetime cannot decrement a remounted save', async () => {
    const f = fixture(), old = deferred(), current = deferred();
    f.recordReviewCompleted.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await f.handleScore(3); expect(f.c.pendingGradeRef.current).toBe(1);
    f.unmount();
    expect(f.c.pendingGradeRef.current).toBe(0); expect(f.c.lastGradeRef.current).toBeNull();
    expect(f.c.scoringRef.current).toBe(false); expect(f.c.workspaceAlive.current).toBe(false);
    f.remount(); await f.handleScore(4); expect(f.c.pendingGradeRef.current).toBe(1);
    old.resolve({ ok: true, queued: true, reviewedAt: '2026-10-04T15:01:00Z' }); await tick();
    expect(f.c.pendingGradeRef.current).toBe(1); expect(f.c.lastGradeRef.current).toBeNull();
    current.resolve({ ok: true, queued: true, reviewedAt: '2026-10-04T15:02:00Z' }); await tick();
    expect(f.c.pendingGradeRef.current).toBe(0); expect(f.c.lastGradeRef.current.rating).toBe(4);
  });

  it('a stale module-load failure cannot unlock a remounted grade that is still loading', async () => {
    const f = fixture(), old = deferred(), current = deferred();
    f.c.loadModule.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const previous = f.handleScore(3); f.unmount(); f.remount();
    const next = f.handleScore(4); expect(f.c.scoringRef.current).toBe(true);
    old.reject(new Error('old module failed')); await previous;
    expect(f.c.scoringRef.current).toBe(true); expect(f.c.toast).not.toHaveBeenCalled();
    current.resolve({ calculateFSRS: () => ({ interval: 10, ease_factor: 4, repetitions: 1, next_review_at: '2026-10-06T00:00:00Z' }) });
    await next; await tick(); expect(f.c.scoringRef.current).toBe(false); expect(f.c.lastGradeRef.current.rating).toBe(4);
  });

  it('online restore waits behind the actual same-actor lock and holds it through strict compensation', async () => {
    const f = fixture(), hold = deferred(), entered = deferred(), marker = deferred();
    f.c.lastGradeRef.current.queued = false;
    const prior = withLegacyReviewLock('actor-a', async () => { entered.resolve(); await hold.promise; });
    await entered.promise;
    f.c.logReviewEvents.mockReturnValueOnce(marker.promise);
    const pending = f.undoLastGrade(); await tick();
    expect(f.persistVocabGrade).not.toHaveBeenCalled();
    hold.resolve(); await prior; await tick(); expect(f.persistVocabGrade).toHaveBeenCalledOnce();
    expect(f.c.logReviewEvents).toHaveBeenCalledOnce();
    const nextWriter = vi.fn(); const next = withLegacyReviewLock('actor-a', nextWriter);
    await tick(); expect(nextWriter).not.toHaveBeenCalled(); expect(f.c.lastGradeRef.current).not.toBeNull();
    marker.resolve(); await pending; await next;
    expect(nextWriter).toHaveBeenCalledOnce(); expect(f.c.lastGradeRef.current).toBeNull();
  });

  it('an actor change while online undo waits for the lock prevents restore and marker writes', async () => {
    const f = fixture(), hold = deferred(), entered = deferred(); f.c.lastGradeRef.current.queued = false;
    const last = f.c.lastGradeRef.current;
    const prior = withLegacyReviewLock('actor-a', async () => { entered.resolve(); await hold.promise; });
    await entered.promise;
    const pending = f.undoLastGrade(); await tick(); f.c.mutationGuard.current.accountId = 'actor-b';
    hold.resolve(); await prior; await pending;
    expect(f.persistVocabGrade).not.toHaveBeenCalled(); expect(f.c.logReviewEvents).not.toHaveBeenCalled();
    expect(f.c.lastGradeRef.current).toBe(last); expect(f.c.toast).not.toHaveBeenCalled();
  });
});
