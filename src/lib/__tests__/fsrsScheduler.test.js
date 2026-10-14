import { describe, expect, it } from 'vitest';
import { fsrs, State } from 'ts-fsrs';
import { FSRS_POLICY, introduceFsrsCard, learningDay, previewFsrsRatings, scheduleFsrsReview, validateFsrsCard } from '../fsrsScheduler.js';

const at = '2026-10-03T09:00:00.000Z';
const plus = (time, seconds) => new Date(Date.parse(time) + seconds * 1000).toISOString();
const delay = (result, time) => (Date.parse(result.card.due) - Date.parse(time)) / 1000;
const introduced = () => introduceFsrsCard(at);
const grade = (card, rating) => scheduleFsrsReview(card, rating, card.due).card;

describe('full-state FSRS with explicit Anki seconds policy', () => {
  it('introduces without inventing a recall, then waits 30 seconds for the first question', () => {
    const card = introduced();
    expect(card).toMatchObject({ stability: 0, difficulty: 0, reps: 0, lapses: 0, revision: 0,
      state: 'New', due: plus(at, 30), lastReview: null });
    expect(() => scheduleFsrsReview(card, 3, plus(at, 29))).toThrow('not_due');
  });

  it('calculates 30 / 315 / 600 seconds and adaptive Easy, without mutating the input', () => {
    const card = Object.freeze(introduced()), result = previewFsrsRatings(card, card.due);
    expect([1, 2, 3].map(r => delay(result[r], card.due))).toEqual([30, 315, 600]);
    expect(result[4].card.state).toBe('Review');
    expect(delay(result[4], card.due)).toBeGreaterThanOrEqual(86400);
    expect(result[3].card.stability).toBe(2.3065);
    expect(result[3].card.difficulty).toBe(2.11810397);
    for (const r of [1, 2, 3, 4]) {
      expect(result[r].card).toMatchObject({ revision: 1, reps: 1, lapses: 0 });
      expect(result[r].log.applied).toMatchObject({ due: result[r].card.due, state: result[r].card.state, step: result[r].card.step });
    }
    expect(card.reps).toBe(0);
    expect(card.due).toBe(plus(at, 30));
  });

  it('keeps later Hard at ten minutes; Again restarts learning; Good graduates', () => {
    const card = grade(introduced(), 3), next = previewFsrsRatings(card, card.due);
    expect(card).toMatchObject({ state: 'Learning', step: 1 });
    expect(delay(next[2], card.due)).toBe(600);
    expect(next[2].card.step).toBe(1);
    expect(delay(next[1], card.due)).toBe(30);
    expect(next[1].card.step).toBe(0);
    expect(next[3].card).toMatchObject({ state: 'Review', step: 0, stability: 2.3065, reps: 2, lapses: 0 });
  });

  it('lapses into Relearning, counts the lapse only once, and uses 600 / 900 seconds', () => {
    const review = grade(grade(introduced(), 3), 3);
    const lapse = grade(review, 1), retry = previewFsrsRatings(lapse, lapse.due);
    expect(lapse).toMatchObject({ state: 'Relearning', step: 0, lapses: 1 });
    expect(Date.parse(lapse.due) - Date.parse(review.due)).toBe(600000);
    expect(delay(retry[1], lapse.due)).toBe(600);
    expect(delay(retry[2], lapse.due)).toBe(900);
    expect(retry[1].card.lapses).toBe(1);
    expect(retry[3].card.state).toBe('Review');
    expect(retry[4].card.state).toBe('Review');
  });

  it('uses stored 04:00 learning days, rather than UTC midnight or locale selection', () => {
    const before = '2026-10-03T18:59:00.000Z'; // KST 03:59
    expect(learningDay(plus(before, 120)) - learningDay(before)).toBe(1);
    const utc = '2026-10-03T23:59:00.000Z';
    expect(learningDay(plus(utc, 120)) - learningDay(utc)).toBe(0);
    const card = grade(introduceFsrsCard(plus(before, -30)), 3);
    expect(card.state).toBe('Learning'); // short step crossing rollover stays Learning
    const next = scheduleFsrsReview(card, 3, card.due);
    expect(next.log.elapsedDays).toBe(1);
    expect(next.card.stability).toBe(7.31530068);
    const translated = { ...card, explanationLocale: 'zh-TW' };
    expect(scheduleFsrsReview(translated, 3, card.due).card.due).toBe(next.card.due);
  });

  it.each([
    ['2026-03-08T07:59:00Z', '2026-03-08T08:00:00Z'], // US DST spring, 03:59 -> 04:00
    ['2026-11-01T08:59:00Z', '2026-11-01T09:00:00Z'], // US DST fall, 03:59 -> 04:00
  ])('uses calendar rollover correctly through DST: %s', (before, after) => {
    expect(learningDay(after, 'America/New_York') - learningDay(before, 'America/New_York')).toBe(1);
    expect(learningDay(plus(before, -7200), 'America/New_York')).toBe(learningDay(before, 'America/New_York'));
  });

  it('has full memory and long-due parity with pinned native engine on matching calendar days', () => {
    const card = grade(grade(introduced(), 3), 3);
    const native = fsrs({ enable_fuzz: false, request_retention: 0.9 }).repeat({
      due: new Date(card.due), stability: card.stability, difficulty: card.difficulty,
      elapsed_days: card.elapsedDays, scheduled_days: card.scheduledDays,
      reps: card.reps, lapses: card.lapses, state: State.Review, learning_steps: card.step,
      last_review: new Date(card.lastReview),
    }, new Date(card.due));
    const next = previewFsrsRatings(card, card.due);
    for (const rating of [1, 2, 3, 4]) {
      expect(next[rating].card.stability).toBe(native[rating].card.stability);
      expect(next[rating].card.difficulty).toBe(native[rating].card.difficulty);
      expect(next[rating].card.due).toBe(native[rating].card.due.toISOString());
      expect(next[rating].card.reps).toBe(native[rating].card.reps);
      expect(next[rating].card.lapses).toBe(native[rating].card.lapses);
    }
  });

  it('rejects incomplete legacy cards and unverified versions instead of guessing history', () => {
    expect(() => validateFsrsCard({ interval: 3, ease_factor: 2, repetitions: 0, next_review_at: at })).toThrow();
    expect(() => validateFsrsCard({ ...introduced(), policyVersion: 'future-policy' })).toThrow();
    expect(() => validateFsrsCard({ ...introduced(), engine: 'future-engine' })).toThrow();
    expect(() => introduceFsrsCard('2026-10-03T09:00:00')).toThrow();
    expect(() => introduceFsrsCard(at, { timeZone: 'invalid-zone' })).toThrow();
    expect(() => scheduleFsrsReview(introduced(), 0, plus(at, 30))).toThrow('rating');
  });

  it('keeps the pinned policy and precise timestamp through serialization and a long synthetic history', () => {
    let card = introduced();
    for (let i = 0; i < 120; i++) {
      const rating = [3, 2, 3, 4, 1, 2, 3][i % 7];
      const result = scheduleFsrsReview(JSON.parse(JSON.stringify(card)), rating, card.due);
      expect(result.card.revision).toBe(card.revision + 1);
      expect(result.card.reps).toBe(card.reps + 1);
      expect(Date.parse(result.card.due)).toBeGreaterThan(Date.parse(card.due));
      expect(result.card.policyVersion).toBe(FSRS_POLICY.version);
      expect(result.card.scheduledDays).toBeLessThanOrEqual(FSRS_POLICY.maximumInterval);
      card = result.card;
    }
  });
});

// REV-SCOPE R1-B-2: 학습 단계 Anki 기본값(1분 · 10분, 재학습 10분). 정책은 서버가 알린 값을 따르고,
// 기존 anki-seconds-v1 카드는 계속 읽히고 채점되며, 학습 중 카드는 다음 채점 때 같은 단계 순번으로 넘어간다.
describe('learning-step policy anki-v2 alongside anki-seconds-v1', () => {
  const v2 = { policyVersion: 'anki-v2' };
  it('introduces anki-v2 cards one minute before the first question', () => {
    const card = introduceFsrsCard(at, v2);
    expect(card).toMatchObject({ policyVersion: 'anki-v2', state: 'New', due: plus(at, 60) });
    expect(() => validateFsrsCard({ ...card, due: plus(at, 30) })).toThrow('invalid_new_card');
    // 예전 정책 New 카드는 30초 그대로 유효하다 — 정책을 바꿔도 무효 카드가 늘지 않는다.
    expect(validateFsrsCard(introduced()).due).toBe(plus(at, 30));
  });

  it('schedules 1 / 5.5 / 10 minutes on anki-v2 and keeps Relearning at 10 minutes', () => {
    const card = introduceFsrsCard(at, v2), result = previewFsrsRatings(card, card.due);
    expect([1, 2, 3].map(r => delay(result[r], card.due))).toEqual([60, 330, 600]);
    const learning = grade(card, 3), next = previewFsrsRatings(learning, learning.due);
    expect(delay(next[1], learning.due)).toBe(60);
    expect(delay(next[2], learning.due)).toBe(600);
    let review = grade(learning, 3);
    expect(review.state).toBe('Review');
    review = scheduleFsrsReview(review, 1, review.due).card;
    expect(review).toMatchObject({ state: 'Relearning', step: 0, policyVersion: 'anki-v2' });
    expect((Date.parse(review.due) - Date.parse(review.lastReview)) / 1000).toBe(600);
  });

  it('moves an anki-seconds-v1 card to the announced policy at its next grade, keeping the step index', () => {
    const old = grade(introduced(), 3);
    expect(old).toMatchObject({ policyVersion: 'anki-seconds-v1', state: 'Learning', step: 1 });
    const moved = previewFsrsRatings(old, old.due, v2);
    expect(moved[1].card).toMatchObject({ policyVersion: 'anki-v2', state: 'Learning', step: 0 });
    expect(delay(moved[1], old.due)).toBe(60);
    expect(moved[2].card).toMatchObject({ policyVersion: 'anki-v2', step: 1 });
    expect(delay(moved[2], old.due)).toBe(600);
    // 정책을 알리지 않으면 카드 정책 그대로(이전 동작).
    expect(previewFsrsRatings(old, old.due)[1].card.policyVersion).toBe('anki-seconds-v1');
    expect(() => previewFsrsRatings(old, old.due, { policyVersion: 'future-policy' })).toThrow('unsupported_fsrs_card');
  });
});
