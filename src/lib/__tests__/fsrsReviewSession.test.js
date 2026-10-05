import { describe, expect, it, vi } from 'vitest';
import { introduceFsrsCard } from '../fsrsScheduler.js';
import { beginFsrsAttempt, revealFsrsAttempt, finishFsrsAttempt, planFsrsUndo, fsrsQueueState, watchFsrsQueue } from '../fsrsReviewSession.js';

const start = '2026-10-03T09:00:00Z', question = '2026-10-03T09:00:30Z', reveal = '2026-10-03T09:00:33Z', rated = '2026-10-03T09:00:34Z';
const card = () => introduceFsrsCard(start);
const begin = (over = {}) => beginFsrsAttempt(card(), { id: 'attempt', userId: 'alice', cardId: 'word', at: question, ...over });
const finish = () => finishFsrsAttempt(revealFsrsAttempt(begin(), reveal), 3, { operationId: 'grade', at: rated });

describe('FSRS attempt, compensation and due queue contracts', () => {
  it('requires a question before reveal and one captured assessment time in card/log', () => {
    expect(() => finishFsrsAttempt(begin(), 3, { operationId: 'grade', at: rated })).toThrow('not_revealed');
    const op = finish();
    expect(op).toMatchObject({ kind: 'grade', expectedRevision: 0, userId: 'alice', cardId: 'word' });
    expect(op.nextCard.lastReview).toBe(op.log.reviewedAt);
    expect(op.log).toMatchObject({ optimizerEligible: true, rewardEligible: true });
    expect(op.previousCard).toEqual(card());
  });
  it('current-answer exposure or hints are not rewarded or used as recall', () => {
    for (const exposed of [revealFsrsAttempt(begin({ answerVisible: true }), reveal), revealFsrsAttempt(begin(), reveal, { hint: true })]) {
      expect(() => finishFsrsAttempt(exposed, 4, { operationId: 'grade', at: rated })).toThrow('not_eligible');
    }
    expect(() => begin({ at: start })).toThrow('not_due');
    expect(() => revealFsrsAttempt(begin(), start)).toThrow('clock_reversed');
  });
  it('undo is a compensating operation with increasing revision and the exact former memory/due', () => {
    const op = finish();
    const undo = planFsrsUndo(op, op.nextCard, { operationId: 'undo', userId: 'alice', cardId: 'word', at: rated });
    expect(undo.expectedRevision).toBe(1);
    expect(undo.nextCard).toEqual({ ...op.previousCard, revision: 2 });
    expect(undo.log).toMatchObject({ optimizerEligible: false, rewardEligible: false });
    expect(undo.undoneOperationId).toBe(op.id);
    expect(() => planFsrsUndo(op, { ...op.nextCard, revision: 2 }, { operationId: 'undo', userId: 'alice', cardId: 'word', at: rated })).toThrow('conflict');
    expect(() => planFsrsUndo(op, op.nextCard, { operationId: 'undo', userId: 'bob', cardId: 'word', at: rated })).toThrow('identity');
  });
  it('uses a timed due queue with owner/exclusion recheck and no learning ahead', () => {
    const entries = [{ id: 'first', userId: 'alice', card: card() },
      { id: 'later', userId: 'alice', card: introduceFsrsCard(question) },
      { id: 'private', userId: 'bob', card: card() },
      { id: 'known', userId: 'alice', card: card(), known: true },
      { id: 'excluded', userId: 'alice', card: card(), excluded: true }];
    expect(fsrsQueueState(entries, 'alice', start)).toMatchObject({ ready: [], nextWakeAt: new Date(question).toISOString() });
    const due = fsrsQueueState(entries, 'alice', question);
    expect(due.ready.map(e => e.id)).toEqual(['first']);
    expect(due.nextWakeAt).toBe('2026-10-03T09:01:00.000Z');
    entries[0].excluded = true;
    expect(fsrsQueueState(entries, 'alice', question).ready).toEqual([]);
    expect(fsrsQueueState(entries, null, question).ready).toEqual([]);
  });
  it('wakes at the exact due time, checks focus changes and cancels all listeners on stop', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(start));
      const target = new EventTarget(), onChange = vi.fn();
      const entries = [{ id: 'word', userId: 'alice', card: card() }];
      const watcher = watchFsrsQueue({ readEntries: () => entries, readUserId: () => 'alice', onChange,
        eventTarget: target, visibilityTarget: target });
      vi.advanceTimersByTime(29999);
      expect(onChange).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(onChange.mock.lastCall[0].ready).toHaveLength(1);
      entries[0].excluded = true;
      target.dispatchEvent(new Event('focus'));
      expect(onChange.mock.lastCall[0].ready).toEqual([]);
      watcher.stop();
      target.dispatchEvent(new Event('focus'));
      expect(onChange).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
