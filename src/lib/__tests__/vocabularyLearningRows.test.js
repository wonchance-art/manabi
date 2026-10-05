import { describe, expect, it, vi } from 'vitest';
import { introduceFsrsCard } from '../fsrsScheduler.js';
import { fetchVocabularyLearningRows, projectVocabularyLearningRows, vocabularyReviewCalendar } from '../vocabularyLearningRows.js';
import { VOCABULARY_LEARNING_SUMMARY_FIELDS } from '../vocabularyLearningRead.js';

const actorId = 'learner', now = '2026-10-03T12:00:00.000Z';
const snapshot = () => ({ version: 1, actorId, enabled: true, registryAvailable: true, complete: true, now,
  rows: [{ id: 'word', user_id: actorId, language: 'Korean', word_text: '단어', interval: 0, ease_factor: null, repetitions: 0,
    base_form: null, created_at: null, source_material_id: null,
    next_review_at: '2026-10-03T15:00:00.000Z', last_reviewed_at: null, meaning: 'unchanged', source_sentence: 'original' }],
  registry: [{ cardId: 'word', userId: actorId, enrolled: false, card: null, known: false, excluded: false,
    eligible: true, nextQuestionAt: null, firstQuestionAt: null }] });
const response = body => ({ ok: true, status: 200, json: async () => body });

describe('complete actor-scoped vocabulary loader', () => {
  it('shares the same pure projection for HTTP and SSR without a legacy prefilter', async () => {
    const body = snapshot(), fetchImpl = vi.fn().mockResolvedValue(response(body));
    const loaded = await fetchVocabularyLearningRows(actorId, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/api/learning/vocabulary?view=learning', expect.objectContaining({
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
    }));
    expect(loaded).toEqual(projectVocabularyLearningRows(body, { actorId }));
    expect(loaded.rows).toBe(body.rows);
    expect(loaded.registry).toBe(body.registry);
    expect(loaded.projections[0].vocabulary).toBe(body.rows[0]);
  });

  it('allows a deliberately narrow response only after the server validates the complete cohort', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(snapshot()));
    await fetchVocabularyLearningRows(actorId, { fetchImpl, fields: 'summary' });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/learning/vocabulary?view=learning&fields=summary');
    expect(VOCABULARY_LEARNING_SUMMARY_FIELDS).toEqual(['id', 'user_id', 'word_text', 'base_form', 'meaning', 'language',
      'created_at', 'interval', 'ease_factor', 'repetitions', 'last_reviewed_at', 'next_review_at', 'source_material_id']);
    expect(Object.isFrozen(VOCABULARY_LEARNING_SUMMARY_FIELDS)).toBe(true);
    await expect(fetchVocabularyLearningRows(actorId, { fetchImpl, fields: 'unsafe' })).rejects.toThrow('invalid_fields');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing schema', body => { delete body.version; }], ['unavailable registry', body => { body.registryAvailable = false; }],
    ['truncation', body => { body.complete = false; }], ['missing registry row', body => { body.registry = []; }],
    ['extra registry row', body => { body.registry.push({ ...body.registry[0], cardId: 'extra' }); }],
    ['duplicate raw row', body => { body.rows.push(body.rows[0]); body.registry.push({ ...body.registry[0], cardId: 'extra' }); }],
    ['duplicate registry row', body => { body.rows.push({ ...body.rows[0], id: 'extra' }); body.registry.push(body.registry[0]); }],
    ['foreign snapshot', body => { body.actorId = 'other'; }], ['foreign raw row', body => { body.rows[0].user_id = 'other'; }],
    ['foreign metadata', body => { body.registry[0].userId = 'other'; }], ['unmatched membership', body => { body.registry[0].cardId = 'other'; }],
    ['invalid clock', body => { body.now = '2026-02-30T00:00:00Z'; }],
  ])('rejects %s instead of returning a fabricated empty/legacy result', async (_name, alter) => {
    const body = snapshot(); alter(body);
    await expect(fetchVocabularyLearningRows(actorId, { fetchImpl: async () => response(body) })).rejects.toThrow();
  });

  it('keeps null legacy language unknown without guessing another language', () => {
    const body = snapshot(); body.rows[0].language = null;
    expect(projectVocabularyLearningRows(body, { actorId }).projections[0].vocabulary.language).toBeNull();
  });

  it('rejects unavailable HTTP and malformed JSON while preserving caller error state', async () => {
    await expect(fetchVocabularyLearningRows(actorId, { fetchImpl: async () => ({ ok: false, status: 503,
      json: async () => ({ code: 'fsrs_storage_unavailable' }) }) })).rejects.toMatchObject({ code: 'fsrs_storage_unavailable', status: 503 });
    await expect(fetchVocabularyLearningRows(actorId, { fetchImpl: async () => ({ ok: true, status: 200,
      json: async () => { throw Error('truncated body'); } }) })).rejects.toMatchObject({ code: 'vocabulary_learning_invalid_response' });
  });

  it('rejects an old actor response and aborts before and after a network response', async () => {
    let current = actorId;
    await expect(fetchVocabularyLearningRows(actorId, { getActorId: () => current, fetchImpl: async () => {
      current = 'other'; return response(snapshot());
    } })).rejects.toThrow('owner_mismatch');
    const before = new AbortController(); before.abort(); const fetchImpl = vi.fn();
    await expect(fetchVocabularyLearningRows(actorId, { signal: before.signal, fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
    const during = new AbortController();
    await expect(fetchVocabularyLearningRows(actorId, { signal: during.signal, fetchImpl: async () => {
      during.abort(); return response(snapshot());
    } })).rejects.toThrow();
  });

  it('uses response capture time after a delayed request while pure historical rollback remains invalid', async () => {
    const earlier = Date.parse(now) - 5000;
    const loaded = await fetchVocabularyLearningRows(actorId, { at: earlier, fetchImpl: async () => response(snapshot()) });
    expect(loaded.now).toBe(now);
    expect(loaded.projections[0].review.evaluatedAt).toBe(now);
    expect(() => projectVocabularyLearningRows(snapshot(), { actorId, at: earlier })).toThrow('clock_reversed');
  });

  it('handles a real complete empty snapshot distinctly from an absent installation', () => {
    const body = { ...snapshot(), enabled: false, rows: [], registry: [] };
    expect(projectVocabularyLearningRows(body, { actorId }).projections).toEqual([]);
    expect(() => projectVocabularyLearningRows({ ...body, registryAvailable: false }, { actorId })).toThrow();
  });
});

describe('display calendar uses KST midnight and exact eligibility, separate from scheduler days', () => {
  it('places the KST midnight due in tomorrow and uses cooldown without rewriting memory', () => {
    const body = snapshot(), card = introduceFsrsCard('2026-10-03T10:00:00Z');
    body.rows.push({ ...body.rows[0], id: 'fsrs' });
    body.registry.push({ ...body.registry[0], cardId: 'fsrs', enrolled: true, card,
      nextQuestionAt: '2026-10-03T14:59:59.999Z' });
    const loaded = projectVocabularyLearningRows(body, { actorId });
    expect(vocabularyReviewCalendar(loaded.projections, now, { days: 2 })).toEqual([
      { key: '2026-10-03', date: '2026-10-03', count: 1 },
      { key: '2026-10-04', date: '2026-10-04', count: 1 },
    ]);
    expect(loaded.projections[1].memory.due).toBe(card.due);
    body.enabled = false;
    expect(vocabularyReviewCalendar(projectVocabularyLearningRows(body, { actorId }).projections, now, { days: 1 })[0].count).toBe(0);
  });

  it('omits known/excluded calendar entries and validates the display window', () => {
    const body = snapshot(); body.registry[0].known = true; body.registry[0].eligible = false;
    const projected = projectVocabularyLearningRows(body, { actorId }).projections;
    expect(vocabularyReviewCalendar(projected, now, { days: 2 }).map(b => b.count)).toEqual([0, 0]);
    expect(() => vocabularyReviewCalendar(projected, now, { days: 0 })).toThrow();
    expect(() => vocabularyReviewCalendar(projected, Date.parse(now) - 1)).toThrow('clock_reversed');
  });
});
