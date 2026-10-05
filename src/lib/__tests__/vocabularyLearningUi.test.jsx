import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import VocabList from '../../views/VocabList';
import VocabDetailCard from '../../views/VocabDetailCard';
import VocabReview from '../../views/VocabReview';
import VocabStats from '../../views/VocabStats';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { vocabularyRetrievability } from '../vocabularyLearningRead';
import { sliceBetween } from './helpers/sliceBetween';
import { fetchVocabLearningData, invalidateVocabularyLearning } from '../useVocabData';

const cache = vi.hoisted(() => new Map());
vi.mock('../offlineCache', () => ({
  cacheVocabSnapshot: vi.fn(async (actor, rows) => { cache.set(actor, rows); }),
  getCachedVocabSnapshot: vi.fn(async actor => cache.get(actor) ?? null),
}));

vi.mock('../../components/learning/VocabularyContexts', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
const START = Date.parse('2026-10-03T00:00:00.000Z');
const at = START + 30_000;
const iso = value => new Date(value).toISOString();
const base = { user_id: 'actor', language: 'Chinese', word_text: '你好', base_form: '你好', source_material_id: null, meaning: '안녕하세요', furigana: 'nǐ hǎo', pos: '인사',
  created_at: iso(START), interval: 999, repetitions: 99, ease_factor: 99,
  last_reviewed_at: iso(START), next_review_at: iso(START - 86_400_000) };
function fixture({ enabled = true, excluded = false } = {}) {
  const initial = introduceFsrsCard(START);
  const card = scheduleFsrsReview(initial, 1, at).card;
  const fsrs = Object.freeze({ ...base, id: 'fresh' });
  const legacy = Object.freeze({ ...base, id: 'legacy', word_text: '谢谢', interval: 40, repetitions: 3, next_review_at: iso(START + 86_400_000) });
  const newWord = Object.freeze({ ...base, id: 'new', word_text: '早上好', interval: 0, repetitions: 0, last_reviewed_at: null, next_review_at: iso(START + 30_000) });
  const snapshot = { version: 1, actorId: 'actor', now: iso(at), enabled, complete: true, registryAvailable: true,
    rows: [fsrs, legacy, newWord], registry: [
      { cardId: fsrs.id, userId: 'actor', enrolled: true, eligible: !excluded, known: false, excluded, card, nextQuestionAt: card.due, firstQuestionAt: iso(at) },
      ...[legacy, newWord].map(row => ({ cardId: row.id, userId: 'actor', enrolled: false, eligible: true, known: false, excluded: false, card: null, nextQuestionAt: null, firstQuestionAt: null })),
    ] };
  return projectVocabularyLearningRows(snapshot, { actorId: 'actor' });
}
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
const byId = snapshot => new Map(snapshot.projections.map(row => [row.vocabulary.id, row]));
const listProps = snapshot => ({ vocab: snapshot.rows, filteredVocab: snapshot.rows, visibleCount: 30,
  search: '', sortBy: 'due', langFilter: 'all', learningById: byId(snapshot), now: at });

describe('authoritative vocabulary learning UI', () => {
  it('List uses full memory stage/due despite contradictory legacy fields, keeping source text', () => {
    const snapshot = fixture();
    const html = render(VocabList, listProps(snapshot));
    expect(html).toContain('nǐ hǎo');
    expect(html).toContain('안녕하세요');
    expect((html.match(/title="숙련"/g) || []).length).toBe(1);
    expect((html.match(/title="초기"/g) || []).length).toBe(1);
    expect((html.match(/class="vocab-row__due"/g) || []).length).toBe(1);
    expect(snapshot.rows[0].interval).toBe(999);
    expect(snapshot.rows[0].repetitions).toBe(99);
    expect(snapshot.projections[0].vocabulary).toBe(snapshot.rows[0]);
  });
  it('Detail shows actual 30-second interval, full difficulty/lapses and pinned retrievability', () => {
    const snapshot = fixture();
    const p = snapshot.projections[0];
    const html = render(VocabDetailCard, { word: snapshot.rows[0], projection: p, now: at, onClose() {} });
    expect(html).toContain('>30s<');
    expect(html).toContain(`>${p.memory.difficulty.toFixed(1)}<`);
    expect(html).toContain(`>${p.memory.lapses}회<`);
    expect(html).toContain(`${Math.round(vocabularyRetrievability(p, at) * 100)}%`);
    expect(html).not.toContain('99회');
    expect(html).not.toContain('99.0');
    expect(html).not.toContain('999일');
  });
  it('legacy difficulty/unknown retention remain unknown; new enrollment interval starts at 30s', () => {
    const snapshot = fixture();
    const legacy = render(VocabDetailCard, { word: snapshot.rows[1], projection: snapshot.projections[1], now: at, onClose() {} });
    expect(legacy).toContain('>—</span><span class="vocab-detail-stat__label">난이도');
    expect(legacy).toContain('>3회<');
    const newHtml = render(VocabDetailCard, { word: snapshot.rows[2], projection: snapshot.projections[2], now: at, onClose() {} });
    expect(newHtml).toContain('>—</span><span class="vocab-detail-stat__label">기억 강도');
    expect(newHtml).not.toContain('aria-valuenow="0"');
    const unreviewed = projectVocabularyLearningRows({ ...snapshot, registry: snapshot.registry.map(entry => entry.enrolled
      ? { ...entry, card: introduceFsrsCard(START), firstQuestionAt: null } : entry) }, { actorId: 'actor' });
    const introduced = render(VocabDetailCard, { word: unreviewed.rows[0], projection: unreviewed.projections[0], now: at, onClose() {} });
    expect(introduced).toContain('>30s<');
    expect(introduced).toContain('>아직<');
  });
  it('Stats uses actual lapses, known measured denominator and shared available calendar', () => {
    const snapshot = fixture();
    const html = render(VocabStats, { vocab: snapshot.rows, projections: snapshot.projections, learningAvailable: true, now: at });
    const measured = snapshot.projections.map(p => vocabularyRetrievability(p, at)).filter(value => value !== null);
    expect(html).toContain(`유지율 ${Math.round(measured.reduce((sum, n) => sum + n, 0) / measured.length * 100)}%`);
    expect(html).toContain('Again 3');
    expect(html).not.toContain('Again 99');
    expect(html).toContain('숙련 1');
    expect((html.match(/class="forecast-count">2</g) || []).length).toBe(1);
  });
  it('disabled enrollment preserves memory but does not enter calendar or due state', () => {
    const snapshot = fixture({ enabled: false });
    const html = render(VocabStats, { vocab: snapshot.rows, projections: snapshot.projections, learningAvailable: true, now: at });
    expect(html).toContain('숙련 1');
    expect(html).not.toContain('class="forecast-count">2<');
    const detail = render(VocabDetailCard, { word: snapshot.rows[0], projection: snapshot.projections[0], now: at + 60_000, onClose() {} });
    expect(detail).toContain('>30s<');
    expect(detail).not.toContain('복습 필요!');
  });
  it('Review completion counts the same memory and forecast without changing grade controls', () => {
    const snapshot = fixture();
    const done = render(VocabReview, { vocab: snapshot.rows, projections: snapshot.projections, learningAvailable: true, now: at,
      reviewWords: [], reviewIdx: 0, reviewFinished: true });
    expect(done).toContain('>1</span><span class="review-done__stat-label">숙련 표현');
    expect(done).toContain('총 1개 예정');
    const grading = render(VocabReview, { vocab: snapshot.rows, reviewWords: [snapshot.rows[1]], reviewIdx: 0,
      currentWord: snapshot.rows[1], reviewMode: 'flash', showAnswer: true });
    expect(grading.match(/review-score-btn review-score-btn--[a-z]+/g)).toEqual([
      'review-score-btn review-score-btn--again', 'review-score-btn review-score-btn--hard',
      'review-score-btn review-score-btn--good', 'review-score-btn review-score-btn--easy',
    ]);
  });
  it('unavailable projection never invents zero retention/mastery and supports a lagging browser clock', () => {
    const snapshot = fixture();
    const unknown = render(VocabStats, { vocab: snapshot.rows, learningAvailable: false, now: at });
    expect(unknown).toContain('유지율 —');
    expect(unknown).toContain('숙련 —');
    expect(unknown).not.toContain('유지율 0%');
    expect(() => render(VocabDetailCard, { word: snapshot.rows[0], projection: snapshot.projections[0], now: START, onClose() {} })).not.toThrow();
    expect(() => render(VocabList, { ...listProps(snapshot), now: START })).not.toThrow();
  });
  it('manual active path returns atomic save before legacy SQL and never closes on a queued result', () => {
    const source = readFileSync(new URL('../../views/VocabPage.jsx', import.meta.url), 'utf8');
    const manual = sliceBetween(source, 'const manualAddMutation', 'manualAddPendingRef.current =');
    const active = sliceBetween(manual, 'if (fsrsReview.controller.getSnapshot().enabled)', 'const row =');
    expect(active).toContain('return fsrsReview.controller.saveVocabulary(vocabulary)');
    expect(active).not.toContain('supabase');
    expect(manual).not.toContain('enrollInserted');
    expect(sliceBetween(manual, 'if (result?.ok !== true)', "invalidateVocabularyLearning")).toContain('return;');
    expect(source).toContain('fsrsReview.controller.retrySave(row.operationId)');
    const data = readFileSync(new URL('../useVocabData.js', import.meta.url), 'utf8');
    expect(data).toContain("queryKey: ['vocab', user?.id, 'learning']");
    expect(data).toContain('learning.rows : EMPTY_ROWS');
    expect(data).not.toContain('fetchVocab(');
  });
});


describe('complete vocabulary reads and read-only offline fallback', () => {
  it('retains source rows after an outage while withholding every learning projection', async () => {
    cache.clear();
    const snapshot = fixture();
    const online = await fetchVocabLearningData('actor', { fetchImpl: async () => ({ ok: true, json: async () => snapshot }) });
    await Promise.resolve();
    expect(online.complete).toBe(true);
    const offline = await fetchVocabLearningData('actor', { fetchImpl: async () => { throw new Error('offline'); } });
    expect(offline.rows).toEqual(snapshot.rows);
    expect(offline.projections).toEqual([]);
    expect(offline.complete).toBe(false);
    expect(offline.registryAvailable).toBe(false);
    expect(offline.offline).toBe(true);
    const html = render(VocabList, { ...listProps(offline), readOnly: true });
    expect(html).toContain('안녕하세요');
    expect(html).not.toContain('class="vocab-row__due"');
    expect((html.match(/disabled=""/g) || []).length).toBe(3);
  });
  it('never returns another actor cache or treats an unknown registry as a new empty cohort', async () => {
    cache.clear();
    const options = { fetchImpl: async () => { throw new Error('unavailable'); } };
    await expect(fetchVocabLearningData('actor', options)).rejects.toThrow('unavailable');
    cache.set('learning:actor', [{ ...base, id: 'wrong', user_id: 'other' }]);
    await expect(fetchVocabLearningData('actor', options)).rejects.toThrow('unavailable');
    cache.set('learning:actor', fixture().rows);
    await expect(fetchVocabLearningData('actor', { ...options, getActorId: () => 'other' })).rejects.toThrow();
    const abort = new AbortController(); abort.abort();
    await expect(fetchVocabLearningData('actor', { ...options, signal: abort.signal })).rejects.toThrow();
  });
  it('invalidates all shared consumers only for the explicitly settled actor', async () => {
    const queryClient = { invalidateQueries: vi.fn() };
    await invalidateVocabularyLearning(queryClient, 'actor');
    const keys = queryClient.invalidateQueries.mock.calls.map(([arg]) => arg.queryKey);
    for (const prefix of ['vocab', 'vocab-words', 'home-v2', 'profile-stats', 'output-words', 'book-review', 'due-vocab-index', 'weekly-report', 'goal-known']) {
      expect(keys).toContainEqual([prefix, 'actor']);
    }
    const count = keys.length;
    await invalidateVocabularyLearning(queryClient, null);
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(count);
  });
});
