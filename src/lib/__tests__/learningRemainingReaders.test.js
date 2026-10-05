import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { introduceFsrsCard } from '../fsrsScheduler';
const env = vi.hoisted(() => ({ snapshot: null, client: { rpc: vi.fn() }, ref: null, captured: {} }));
vi.mock('../server/fsrsLearning', () => ({ fsrsServiceClient: () => env.client }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('@/content/refLangs', () => ({ getRefLang: () => env.ref }));
vi.mock('../publishedChapter', () => ({ loadPublishedRegistry: async (_language, ref) => ref }));
vi.mock('@/views/refShared', () => ({ refMain: value => value?.ja || '', refPron: () => '' }));
vi.mock('@/lib/refQuiz', () => ({ buildChapterQuiz: () => ({ meaning: [], apply: [] }) }));
vi.mock('@/lib/studySession', () => ({
  composeSession: value => { env.captured.session = value; return []; },
  buildWarmupItems: (_events, rows, _meanings, _due, fallback) => { env.captured.warmupRows = rows; env.captured.warmupFallback = fallback; return []; },
  buildEncounterItems: () => [],
}));
vi.mock('@/lib/writingPrompts', () => ({ levelBand: () => 'N5' }));
vi.mock('@/lib/studyParagraph', () => ({ THEMES: ['일상'] }));
import { assembleStudyMaterials } from '../studyMaterials';
import { fetchQuestReviewRows } from '../../components/world/QuestReview';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const NOW = Date.parse('2026-10-04T03:00:00.000Z'); // KST Sunday: weakness branch is exercised too.
const iso = value => new Date(value).toISOString();
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
function fixture() {
  const makeRow = (number, extra = {}) => ({ id: id(number), user_id: ACTOR, word_text: `語${number}`, base_form: `語${number}`,
    language: 'Japanese', meaning: `개인 뜻 ${number}`, furigana: `よみ${number}`, source_sentence: `원본 語${number} 문장`,
    source_material_id: 123, created_at: iso(NOW - 5 * 86400000), interval: 2, ease_factor: 4, repetitions: 0,
    last_reviewed_at: iso(NOW - 2 * 86400000), next_review_at: iso(NOW - 86400000), ...extra });
  const rows = Array.from({ length: 24 }, (_, i) => makeRow(i + 1));
  rows.push(makeRow(25, { last_reviewed_at: null }), makeRow(26), makeRow(27));
  const card = introduceFsrsCard(NOW - 100000);
  const registry = rows.map((row, i) => ({ userId: ACTOR, cardId: row.id, enrolled: i < 24, eligible: true,
    known: false, excluded: false, card: i < 24 ? card : null, nextQuestionAt: i < 24 ? card.due : null, firstQuestionAt: null }));
  return { version: 1, actorId: ACTOR, enabled: true, registryAvailable: true, complete: true, now: iso(NOW), rows, registry };
}
function database(events = []) {
  const tables = [];
  return { tables, from(table) {
    tables.push(table);
    if (['active_vocabulary', 'user_vocabulary', 'vocabulary_with_exclusions'].includes(table)) throw new Error('legacy candidate query bypass');
    const chain = {};
    for (const method of ['select', 'eq', 'not', 'lte', 'gte', 'order', 'limit', 'in', 'range']) chain[method] = () => chain;
    chain.then = (resolve, reject) => Promise.resolve({ data: table === 'review_events' ? events : [] }).then(resolve, reject);
    return chain;
  } };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  env.snapshot = fixture(); env.captured = {};
  env.client.rpc.mockReset().mockImplementation(async name => {
    expect(name).toBe('fsrs_vocabulary_snapshot'); return { data: env.snapshot };
  });
  env.ref = { ALL_CHAPTERS: [], LEVEL_META: [{ key: 'N5' }], langCode: 'ja', base: '/japanese',
    getChapter: () => null, isIntroLevel: () => false,
    getVocab: () => ({ themes: [{ words: env.snapshot.rows.map(row => ({ ja: row.word_text, ko: row.meaning })) }] }) };
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('study assembly authoritative candidate boundary', () => {
  it('excludes enrolled/new before due and weakness caps and never refetches skinny legacy candidates', async () => {
    const events = env.snapshot.rows.flatMap(row => Array.from({ length: 3 }, () => ({ source: 'vocab', item_key: row.word_text,
      correct: false, created_at: iso(NOW - 2 * 86400000), detail: {} })));
    const db = database(events), before = JSON.stringify(env.snapshot.rows);
    const result = await assembleStudyMaterials(db, ACTOR, 'Japanese');
    expect(env.captured.session.vocab.map(row => row.id)).toEqual([id(26), id(27)]);
    expect(result.paragraphMaterials.weekly).toBe(true);
    expect(result.paragraphMaterials.dueWords.map(value => value.row.id)).toEqual([id(26), id(27)]);
    expect(result.legacyReviewRows[0]).toBe(env.snapshot.rows[25]);
    expect(env.captured.warmupFallback).toEqual([]); // Saved enrolled/new terms cannot re-enter as content fallback.
    expect(JSON.stringify(env.snapshot.rows)).toBe(before);
    expect(env.client.rpc).toHaveBeenCalledOnce();
    expect(env.client.rpc).toHaveBeenCalledWith('fsrs_vocabulary_snapshot', { p_actor: ACTOR });
  });
  it('preserves future legacy for weakness without scheduling it as currently due', async () => {
    env.snapshot.rows[25].next_review_at = iso(NOW + 2 * 86400000);
    const result = await assembleStudyMaterials(database(), ACTOR, 'Japanese');
    expect(env.captured.session.vocab.map(row => row.id)).toEqual([id(27)]);
    expect(result.legacyReviewRows.map(row => row.id)).toEqual([id(27), id(26)]);
    expect(result.paragraphMaterials.dueWords[0].row).toBe(env.snapshot.rows[26]);
  });
  it.each(['missing', 'error', 'foreign'])('rejects %s snapshot rather than making empty materials', async mode => {
    if (mode === 'missing') env.snapshot.registry.pop();
    if (mode === 'error') env.client.rpc.mockResolvedValue({ error: { message: 'offline' } });
    if (mode === 'foreign') env.snapshot.rows[0].user_id = id(999);
    await expect(assembleStudyMaterials(database(), ACTOR, 'Japanese')).rejects.toThrow();
    expect(env.captured.session).toBeUndefined();
  });
});

describe('quest actual reader protocol', () => {
  it('loads complete state and selects only supported reviewed legacy after enrolled prefixes', async () => {
    const before = JSON.stringify(env.snapshot.rows);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => env.snapshot })));
    const result = await fetchQuestReviewRows(ACTOR);
    expect(result).toEqual(env.snapshot.rows.slice(25));
    expect(result[0]).toBe(env.snapshot.rows[25]);
    expect(fetch.mock.calls[0][0]).toBe('/api/learning/vocabulary?view=learning');
    expect(JSON.stringify(env.snapshot.rows)).toBe(before);
  });
  it('propagates unavailable and aborted reads so UI cannot claim no due cards', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ code: 'fsrs_storage_unavailable' }) })));
    await expect(fetchQuestReviewRows(ACTOR)).rejects.toThrow('fsrs_storage_unavailable');
    const controller = new AbortController(); controller.abort();
    await expect(fetchQuestReviewRows(ACTOR, { signal: controller.signal })).rejects.toThrow();
  });
});
