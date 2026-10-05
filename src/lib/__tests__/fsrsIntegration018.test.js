import { describe, expect, it, vi } from 'vitest';
import { S_MAX } from 'ts-fsrs';
import { schedulerTime, learningDay, introduceFsrsCard, validateFsrsCard, scheduleFsrsReview, FSRS_POLICY } from '../fsrsScheduler.js';
import { beginFsrsAttempt, revealFsrsAttempt, finishFsrsAttempt, planFsrsUndo, fsrsQueueState, watchFsrsQueue } from '../fsrsReviewSession.js';

const start = '2026-10-03T00:00:00.000Z';
const introduced = () => introduceFsrsCard(start);
const begin = () => beginFsrsAttempt(introduced(), { id: 'attempt', userId: 'learner', cardId: 'word', at: introduced().due });
const revealed = () => revealFsrsAttempt(begin(), introduced().due);
const grade = () => finishFsrsAttempt(revealed(), 3, { operationId: 'grade', at: introduced().due });
const review = () => scheduleFsrsReview(introduced(), 4, introduced().due).card;
const undo = operation => planFsrsUndo(operation, operation.nextCard, { operationId: 'undo', userId: 'learner', cardId: 'word', at: introduced().due });
const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).reverse().map(([key, val]) => [key, reverseKeys(val)])) : value;

describe('persisted scheduler times and complete card bounds', () => {
  it.each([
    '2026-02-30T12:00:00Z', '2025-02-29T12:00:00Z', '2026-04-31T00:00:00Z',
    '2026-10-03T24:00:00Z', '2026-10-03T00:00:00.0009Z', '2026-10-03T00:00:00+24:00',
    '2026-10-03T00:00:00+09:60', 0.9, Number.MAX_SAFE_INTEGER, new Date(NaN),
  ])('rejects invalid or silently normalized time %s', time => {
    expect(() => schedulerTime(time)).toThrow('invalid_scheduler_time');
  });

  it('accepts explicit offsets and millisecond precision without changing the instant', () => {
    const at = schedulerTime('2024-02-29T00:00:00.120Z');
    expect(schedulerTime('2024-02-29T09:00:00.12+09:00')).toBe(at);
    expect(schedulerTime(new Date(at))).toBe(at);
    expect(schedulerTime(at)).toBe(at);
    expect(schedulerTime('2024-02-28T19:00:00.120-05:00')).toBe(at);
  });

  it('does not map calendar years below 100 to the twentieth century', () => {
    expect(learningDay('0100-01-01T12:00:00Z', 'UTC', 0) - learningDay('0099-12-31T12:00:00Z', 'UTC', 0)).toBe(1);
    expect(learningDay('0001-01-01T12:00:00Z', 'UTC', 0) - learningDay('0000-12-31T12:00:00Z', 'UTC', 0)).toBe(1);
  });

  it('rejects a local calendar outside the supported Date range instead of returning NaN', () => {
    expect(() => learningDay(-8640000000000000, 'America/New_York', 0)).toThrow('invalid_scheduler_time');
  });

  it.each([
    ['New elapsed history', () => ({ ...introduced(), elapsedDays: 1 })],
    ['Review zero days', () => ({ ...review(), scheduledDays: 0 })],
    ['Review excessive days', () => ({ ...review(), scheduledDays: FSRS_POLICY.maximumInterval + 1 })],
    ['stability beyond engine bounds', () => ({ ...review(), stability: S_MAX + 1 })],
    ['very large finite stability', () => ({ ...review(), stability: 1e308 })],
    ['unsafe revision', () => ({ ...review(), revision: Number.MAX_SAFE_INTEGER + 1 })],
    ['unsafe reps', () => ({ ...review(), reps: Number.MAX_SAFE_INTEGER + 1 })],
  ])('rejects unreachable persisted state: %s', (_name, makeCard) => expect(() => validateFsrsCard(makeCard())).toThrow());

  it('accepts verified engine memory bounds without rounding or replacing them', () => {
    const card = { ...review(), stability: S_MAX };
    expect(validateFsrsCard(card)).toBe(card);
    const next = scheduleFsrsReview(card, 3, card.due).card;
    expect(next.stability).toBeLessThanOrEqual(S_MAX);
    expect(card.stability).toBe(S_MAX);
  });
});

describe('attempt snapshots retain the actual question and reveal boundary', () => {
  it.each([
    ['missing question', { questionAt: undefined }],
    ['future question', { questionAt: '2099-01-01T00:00:00Z' }],
    ['early question', { questionAt: start }],
    ['truthy eligibility string', { eligible: 'false' }],
    ['missing actor', { userId: null }],
    ['missing attempt', { id: undefined }],
    ['empty card identity', { cardId: '' }],
    ['false hint timestamp', { hintedAt: false }],
  ])('rejects a malformed revealed snapshot: %s', (_name, patch) => {
    expect(() => finishFsrsAttempt({ ...revealed(), ...patch }, 3, { operationId: 'grade', at: introduced().due })).toThrow();
  });

  it('validates restored question snapshots before revealing, including hints and exposure', () => {
    expect(() => revealFsrsAttempt({ ...begin(), eligible: 1 }, introduced().due)).toThrow('invalid_attempt_state');
    expect(() => revealFsrsAttempt({ ...begin(), revealedAt: start }, introduced().due)).toThrow('invalid_attempt_state');
    expect(() => revealFsrsAttempt(begin(), introduced().due, { hint: 'false' })).toThrow('invalid_attempt_state');
    expect(() => beginFsrsAttempt(introduced(), { id: 'attempt', userId: 'learner', cardId: 'word', at: introduced().due, answerVisible: 0 })).toThrow('invalid_attempt_state');
    const hint = revealFsrsAttempt(begin(), introduced().due, { hint: true });
    expect(() => finishFsrsAttempt(hint, 4, { operationId: 'grade', at: introduced().due })).toThrow('recall_not_eligible');
  });
});

describe('undo verifies the original grade transition', () => {
  it.each([
    ['future operation version', operation => { operation.version = 999; }],
    ['empty original identity', operation => { operation.id = ''; }],
    ['changed rating', operation => { operation.log.rating = 4; }],
    ['changed review time', operation => { operation.log.reviewedAt = '2000-01-01T00:00:00Z'; }],
    ['changed previous due', operation => { operation.previousCard.due = '2099-01-01T00:00:00Z'; }],
    ['changed previous timezone', operation => { operation.previousCard.timeZone = 'UTC'; }],
    ['changed previous rollover', operation => { operation.previousCard.rolloverHour = 0; }],
    ['changed applied due', operation => { operation.log.applied.due = introduced().due; }],
    ['changed engine memory', operation => { operation.log.engine.memory.stability = 999; }],
    ['missing question receipt', operation => { delete operation.log.questionAt; }],
  ])('rejects a corrupt original operation: %s', (_name, corrupt) => {
    const operation = grade(); corrupt(operation);
    expect(() => undo(operation)).toThrow();
  });

  it('accepts a database JSON key reorder and preserves pinned state exactly on compensation', () => {
    const original = grade();
    const snapshot = structuredClone(original);
    const reordered = reverseKeys(original);
    const result = planFsrsUndo(reordered, original.nextCard, { operationId: 'undo', userId: 'learner', cardId: 'word', at: introduced().due });
    expect(result.nextCard).toEqual({ ...original.previousCard, revision: 2 });
    expect(result.nextCard.elapsedDays).toBe(0);
    expect(original).toEqual(snapshot);
  });
});

describe('queue row isolation and exposure cooldown metadata', () => {
  it('isolates null and malformed rows without exposing another learner or hiding a valid card', () => {
    const valid = { id: 'valid', userId: 'learner', card: introduced() };
    const state = fsrsQueueState([null, { ...valid, id: 'bad', nextQuestionAt: '2026-02-30T00:00:00Z' },
      { id: 'private', userId: 'other', card: null }, valid], 'learner', introduced().due);
    expect(state.ready).toEqual([valid]);
    expect(state.invalid).toEqual([null, 'bad']);
    expect(() => fsrsQueueState({}, 'learner', start)).toThrow('invalid_fsrs_queue');
  });

  it('waits for nextQuestionAt without changing card memory or accepting an earlier gate', () => {
    const card = introduced(), snapshot = structuredClone(card);
    const entry = { id: 'word', userId: 'learner', card, nextQuestionAt: '2026-10-03T00:01:00.000Z' };
    expect(fsrsQueueState([entry], 'learner', card.due)).toMatchObject({ ready: [], nextWakeAt: entry.nextQuestionAt });
    expect(fsrsQueueState([entry], 'learner', entry.nextQuestionAt).ready).toEqual([entry]);
    expect(fsrsQueueState([{ ...entry, nextQuestionAt: start }], 'learner', start).nextWakeAt).toBe(card.due);
    expect(card).toEqual(snapshot);
  });

  it('wakes at the metadata gate and removes everything on stop', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(introduced().due));
      const target = new EventTarget(), onChange = vi.fn();
      const entry = { id: 'word', userId: 'learner', card: introduced(), nextQuestionAt: '2026-10-03T00:01:00.000Z' };
      const watcher = watchFsrsQueue({ readEntries: () => [entry], readUserId: () => 'learner', onChange,
        eventTarget: target, visibilityTarget: target });
      expect(onChange.mock.lastCall[0].ready).toEqual([]);
      vi.advanceTimersByTime(30000);
      expect(onChange.mock.lastCall[0].ready).toEqual([entry]);
      watcher.stop(); watcher.stop();
      target.dispatchEvent(new Event('focus'));
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it.each(['readEntries', 'onChange'])('cleans up even when initialization fails in %s', failure => {
    const listeners = new Map(), timers = new Map(); let sequence = 0;
    const target = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
    expect(() => watchFsrsQueue({
      readEntries: () => { if (failure === 'readEntries') throw Error('failed reader'); return [{ id: 'word', userId: 'learner', card: introduced() }]; },
      readUserId: () => 'learner', now: () => schedulerTime(start),
      onChange: () => { if (failure === 'onChange') throw Error('failed consumer'); },
      setTimer: (fn, delay) => { timers.set(++sequence, { fn, delay }); return sequence; }, clearTimer: id => timers.delete(id),
      eventTarget: target, visibilityTarget: target,
    })).toThrow();
    expect(listeners.size).toBe(0);
    expect(timers.size).toBe(0);
  });
});
