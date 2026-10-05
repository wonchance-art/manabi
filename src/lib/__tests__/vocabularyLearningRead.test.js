import { describe, expect, it } from 'vitest';
import { FSRSAlgorithm } from 'ts-fsrs';
import { introduceFsrsCard, scheduleFsrsReview, FSRS_POLICY } from '../fsrsScheduler.js';
import { isVocabularyReviewAvailable, isVocabularyReviewDue, isVocabularyUnreviewed,
  projectVocabularyLearning, vocabularyRetrievability } from '../vocabularyLearningRead.js';
import { isKnownWord, wordStage } from '../growthStats.js';
import { buildForecast } from '../forecast.js';

const actorId = 'learner', at = '2026-10-03T19:01:00.000Z';
const vocabulary = () => ({ id: 'word', user_id: actorId, word_text: '단어', meaning: 'kept meaning', language: 'Korean',
  interval: 0, repetitions: 0, last_reviewed_at: null, next_review_at: '2026-10-01T00:00:00.000Z',
  source_sentence: 'Original source.', source_ref: 'Preserved edition' });
const newCard = () => introduceFsrsCard('2026-10-01T00:00:00.000Z');
const reviewCard = () => scheduleFsrsReview(newCard(), 4, newCard().due).card;
const legacy = () => ({ cardId: 'word', userId: actorId, enrolled: false, card: null, eligible: true,
  known: false, excluded: false, nextQuestionAt: null, firstQuestionAt: null });
const enrolled = (card = reviewCard()) => ({ ...legacy(), enrolled: true, card, nextQuestionAt: card.due });
const project = (registry = legacy(), raw = vocabulary(), extra = {}) => projectVocabularyLearning({ actorId,
  vocabulary: raw, registry, enabled: true, registryAvailable: true, complete: true, at, ...extra });

describe('complete vocabulary read projection preserves its separate cohorts', () => {
  it('keeps original meaning/source and legacy fields byte-identical while full memory drives displays', () => {
    const raw = vocabulary(), before = JSON.stringify(raw), card = reviewCard();
    const projection = project(enrolled(card), raw);
    expect(projection.vocabulary).toBe(raw);
    expect(JSON.stringify(raw)).toBe(before);
    expect(projection.source).toBe('fsrs-v1');
    expect(projection.memory).toMatchObject({ stability: card.stability, reps: 1, state: 'Review', due: card.due, lastReview: card.lastReview });
    expect(projection).not.toHaveProperty('interval');
    expect(projection).not.toHaveProperty('next_review_at');
    expect(isKnownWord(projection)).toBe(true);
    expect(isKnownWord(raw)).toBe(false);
    expect(wordStage(projection).key).toBe('learning');
    expect(wordStage(raw).key).toBe('new');
  });

  it('does not turn legacy lapses, save grade or lack of receipt into invented FSRS repetitions/state', () => {
    const raw = { ...vocabulary(), interval: 12, repetitions: 6 };
    const projection = project(legacy(), raw);
    expect(projection.memory).toMatchObject({ stability: 12, lapses: 6, reps: null, state: null, difficulty: null, revision: null });
    expect(projection.review.firstQuestionAt).toBeNull();
    expect(isVocabularyUnreviewed(projection)).toBe(true);
    expect(wordStage(projection)).toEqual(wordStage(raw));
    expect(isKnownWord(projection)).toBe(isKnownWord(raw));
  });

  it('reads a stored legacy difficulty exactly without clamping or filling an unknown value', () => {
    for (const value of [1, 2.573829, 10]) expect(project(legacy(), { ...vocabulary(), ease_factor: value }).memory.difficulty).toBe(value);
    for (const value of [null, undefined, 0, -1, 11, '2.5', Infinity]) expect(project(legacy(), { ...vocabulary(), ease_factor: value }).memory.difficulty).toBeNull();
  });

  it.each([
    ['unavailable registry', { registryAvailable: false }], ['incomplete snapshot', { complete: false }],
    ['missing membership', { registry: undefined }], ['wrong actor', { actorId: 'other' }],
    ['wrong card registry', { registry: { ...legacy(), cardId: 'other' } }],
    ['string eligibility', { registry: { ...legacy(), eligible: 'false' } }],
    ['missing new memory', { registry: { ...enrolled(), card: null } }],
    ['legacy carrying full memory', { registry: { ...legacy(), card: reviewCard() } }],
    ['legacy invented receipt', { registry: { ...legacy(), firstQuestionAt: newCard().due } }],
    ['missing enrolled cooldown', { registry: { ...enrolled(), nextQuestionAt: null } }],
    ['earlier than due gate', { registry: { ...enrolled(), nextQuestionAt: newCard().introducedAt } }],
    ['inconsistent eligible known', { registry: { ...legacy(), eligible: true, known: true } }],
  ])('refuses an ambiguous cohort instead of downgrading it: %s', (_name, extra) => {
    expect(() => project(legacy(), vocabulary(), extra)).toThrow();
  });

  it('rejects unsupported engine/policy and future last-review clocks', () => {
    expect(() => project(enrolled({ ...reviewCard(), policyVersion: 'future' }))).toThrow();
    expect(() => project(enrolled(), vocabulary(), { at: '2026-09-01T00:00:00.000Z' })).toThrow('clock_reversed');
    expect(() => project(legacy(), { ...vocabulary(), last_reviewed_at: '2099-01-01T00:00:00Z' })).toThrow('clock_reversed');
  });

  it('preserves memory on disabled rollback and blocks only the enrolled review path', () => {
    const full = project(enrolled(), vocabulary(), { enabled: false });
    expect(full.source).toBe('fsrs-v1');
    expect(full.memory).toEqual(project(enrolled()).memory);
    expect(full.review).toMatchObject({ available: false, blockedReason: 'disabled' });
    expect(isKnownWord(full)).toBe(true);
    expect(isVocabularyReviewAvailable(project(legacy(), vocabulary(), { enabled: false }))).toBe(true);
  });

  it.each(['known', 'excluded'])('removes %s from actionable review without changing memory', flag => {
    const active = project(enrolled(newCard()));
    const blocked = project({ ...enrolled(newCard()), [flag]: true, eligible: false });
    expect(blocked.memory).toEqual(active.memory);
    expect(isVocabularyReviewDue(blocked, at)).toBe(false);
    expect(blocked.review.blockedReason).toBe(flag);
  });

  it('separates exact memory due from exposure cooldown and does not allow learning ahead', () => {
    const card = newCard(), cooldown = '2026-10-04T00:00:00.000Z';
    const projection = project({ ...enrolled(card), nextQuestionAt: cooldown });
    expect(projection.memory.due).toBe(card.due);
    expect(projection.review.nextQuestionAt).toBe(cooldown);
    expect(isVocabularyReviewAvailable(projection)).toBe(true);
    expect(isVocabularyReviewDue(projection, at)).toBe(false);
    expect(isVocabularyReviewDue(projection, cooldown)).toBe(true);
    expect(() => isVocabularyReviewDue(projection, '2026-10-03T19:00:59.999Z')).toThrow('clock_reversed');
    expect(isVocabularyUnreviewed(projection)).toBe(true);
  });

  it('preserves valid legacy microsecond timestamps and rounds only eligibility upward', () => {
    const due = '2026-10-03T19:01:00.000123+00:00';
    const raw = { ...vocabulary(), next_review_at: due };
    const projection = project(legacy(), raw);
    expect(projection.memory.due).toBe(due);
    expect(projection.review.nextQuestionAt).toBe('2026-10-03T19:01:00.001Z');
    expect(isVocabularyReviewDue(projection, at)).toBe(false);
    expect(isVocabularyReviewDue(projection, '2026-10-03T19:01:00.001Z')).toBe(true);
    expect(raw.next_review_at).toBe(due);
    expect(() => project(legacy(), { ...raw, next_review_at: '2026-02-30T00:00:00.123456Z' })).toThrow();
  });

  it('keeps an unscheduled legacy row unscheduled', () => {
    const projection = project(legacy(), { ...vocabulary(), next_review_at: null });
    expect(projection.review.nextQuestionAt).toBeNull();
    expect(isVocabularyReviewDue(projection, at)).toBe(false);
  });
});

describe('growth and forecast use the exact read memory without changing report boundaries', () => {
  it('uses the pinned scheduler learning day in full-state recall probability', () => {
    const first = introduceFsrsCard('2026-10-03T18:59:00.000Z');
    const card = scheduleFsrsReview(first, 3, first.due).card;
    const now = '2026-10-03T19:00:00.000Z'; // KST04, only30 seconds since prior grade
    const projection = project(enrolled(card), vocabulary(), { at: now });
    const engine = new FSRSAlgorithm({ request_retention: FSRS_POLICY.retention,
      maximum_interval: FSRS_POLICY.maximumInterval, enable_fuzz: false, enable_short_term: true });
    expect(vocabularyRetrievability(projection, now)).toBeCloseTo(engine.forgetting_curve(1, card.stability), 12);
    expect(vocabularyRetrievability(projection, now)).toBeLessThan(engine.forgetting_curve(30 / 86400, card.stability));
  });

  it('keeps legacy forecast results identical after wrapping its unchanged raw memory', () => {
    const rows = [1, 2, 3].map((n, index) => ({ ...vocabulary(), id: `legacy-${index}`, word_text: `legacy-${index}`,
      interval: n, last_reviewed_at: '2026-10-01T19:01:00.000Z' }));
    const projections = rows.map(raw => project({ ...legacy(), cardId: raw.id }, raw));
    expect(buildForecast(projections, new Date(at))).toEqual(buildForecast(rows, new Date(at)));
  });

  it('calculates full-state forecast from verified memory while raw legacy storage stays frozen', () => {
    const initial = introduceFsrsCard('2026-10-01T00:00:00.000Z');
    const card = scheduleFsrsReview(initial, 1, initial.due).card;
    const engine = new FSRSAlgorithm();
    let elapsed = 0;
    while (!(engine.forgetting_curve(elapsed, card.stability) >= 0.7 && engine.forgetting_curve(elapsed + 1, card.stability) < 0.7)) elapsed++;
    const now = new Date(Date.parse(card.lastReview) + elapsed * 86400000);
    const raw = vocabulary(), before = JSON.stringify(raw), projection = project(enrolled(card), raw, { at: now });
    expect(buildForecast([projection], now).count).toBe(1);
    expect(buildForecast([raw], now).count).toBe(0);
    expect(buildForecast([project({ ...enrolled(card), known: true, eligible: false }, raw, { at: now })], now).count).toBe(0);
    expect(JSON.stringify(raw)).toBe(before);
  });
});
