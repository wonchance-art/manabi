import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTodayReviewRows } from '../useOutputWords';
import { pickOutputWords } from '../outputWords';

const NOW = Date.parse('2026-10-03T15:30:00.000Z');
const ACTOR = '11111111-1111-4111-8111-111111111111';
const word = (id, extra = {}) => ({ id, word_text: `词${id}`, base_form: `词${id}`, source_material_id: null, ease_factor: 2.5, meaning: `뜻${id}`, language: 'Chinese', last_reviewed_at: null, ...extra });
const event = (id, extra = {}) => ({ id: `event-${id}`, source: 'vocab', item_key: `词${id}`, correct: true,
  created_at: '2026-10-03T15:20:00.000Z', detail: { word_id: id }, ...extra });

// 실제 PostgREST max_rows가 요청 범위보다 작아도 전체 count까지 읽는지 검사한다.
function database({ events = [], words = [], maxRows = 500, failure, mutateCount = false }) {
  const calls = [];
  return { calls, from(table) {
    let ids = null, since = null, until = null, call = { table, owner: null };
    calls.push(call);
    const query = {
      select(fields, options) { call.fields = fields; call.count = options?.count; return query; },
      eq(key, value) { if (key === 'user_id') call.owner = value; return query; },
      gte(key, value) { since = [key, value]; return query; },
      lte(key, value) { until = [key, value]; return query; },
      order() { return query; },
      in(key, value) { ids = value; call.ids = value; return query; },
      async range(from, to) {
        call.range = [from, to];
        if (failure === table) return { error: new Error('denied') };
        const rows = (table === 'review_events' ? events : words).filter(row =>
          (!ids || ids.includes(row.id)) && (!since || Date.parse(row[since[0]]) >= Date.parse(since[1]))
          && (!until || Date.parse(row[until[0]]) <= Date.parse(until[1])));
        return { data: rows.slice(from, Math.min(to + 1, from + maxRows)), count: rows.length + (mutateCount && from > 0 ? 1 : 0) };
      },
    };
    return query;
  } };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('effective output vocabulary reads', () => {
  it('finds new FSRS words through grade IDs even when legacy last_reviewed_at remains null', async () => {
    const source = word('a');
    const client = database({ events: [event('a')], words: [source] });
    const before = JSON.stringify(source);
    const loaded = await fetchTodayReviewRows(ACTOR, { client, now: NOW });
    expect(pickOutputWords({ ...loaded, language: 'Chinese' })).toEqual([{ id: 'a', word_text: '词a', meaning: '뜻a' }]);
    expect(JSON.stringify(source)).toBe(before);
    expect(client.calls[0].table).toBe('review_events');
    expect(client.calls.every(call => call.owner === ACTOR && call.count === 'exact')).toBe(true);
    expect(client.calls.find(call => call.table === 'active_vocabulary').ids).toEqual(['a']);
  });

  it('does not revive an undone grade through the legacy timestamp fallback', async () => {
    const grade = event('a');
    const undo = { id: 'undo-a', source: 'ui', item_key: grade.item_key, correct: true, created_at: '2026-10-03T15:21:00.000Z',
      detail: { qtype: 'undo', undo_of: { item_key: grade.item_key, reviewed_at: grade.created_at } } };
    const client = database({ events: [grade, undo], words: [word('a', { last_reviewed_at: grade.created_at })] });
    const loaded = await fetchTodayReviewRows(ACTOR, { client, now: NOW });
    expect(loaded.allowFallback).toBe(false);
    expect(pickOutputWords(loaded)).toEqual([]);
    expect(client.calls.every(call => call.table === 'review_events')).toBe(true);
  });

  it('keeps legacy history without word IDs usable', async () => {
    const client = database({ events: [event('missing', { detail: {} })], words: [word('legacy', { last_reviewed_at: '2026-10-03T15:20:00.000Z' })] });
    const loaded = await fetchTodayReviewRows(ACTOR, { client, now: NOW });
    expect(loaded.allowFallback).toBe(true);
    expect(pickOutputWords(loaded).map(row => row.id)).toEqual(['legacy']);
  });

  it('reads all capped pages and preserves KST midnight rather than scheduler 04:00', async () => {
    const events = Array.from({ length: 503 }, (_, i) => event(`w${i}`));
    events.push(event('yesterday', { created_at: '2026-10-03T14:59:59.999Z' }));
    const client = database({ events, words: events.map(e => word(e.detail.word_id)), maxRows: 47 });
    const loaded = await fetchTodayReviewRows(ACTOR, { client, now: NOW });
    expect(loaded.events).toHaveLength(503);
    expect(loaded.vocabRows).toHaveLength(503);
    expect(loaded.vocabRows.some(row => row.id === 'yesterday')).toBe(false);
    expect(client.calls.filter(call => call.table === 'review_events').length).toBeGreaterThan(10);
  });

  it('does not count inactive or other-owner rows absent from the active owner query', async () => {
    const client = database({ events: [event('a'), event('excluded')], words: [word('a')] });
    const loaded = await fetchTodayReviewRows(ACTOR, { client, now: NOW });
    expect(pickOutputWords(loaded).map(row => row.id)).toEqual(['a']);
  });

  it.each(['review_events', 'active_vocabulary'])('propagates %s read failures', async failure => {
    const client = database({ events: [event('a')], words: [word('a')], failure });
    await expect(fetchTodayReviewRows(ACTOR, { client, now: NOW })).rejects.toThrow('denied');
  });

  it('rejects incomplete changing pagination instead of returning a partial zero/count', async () => {
    const client = database({ events: [event('a'), event('b')], maxRows: 1, mutateCount: true });
    await expect(fetchTodayReviewRows(ACTOR, { client, now: NOW })).rejects.toThrow('output_words_incomplete');
  });
});

// 기존 snapshot API와 실제 소비 함수를 함께 검증해 옛 SQL due/날짜 필터 재등장을 막는다.
const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: db }));
import { fetchHomeData } from '../../views/HomePage';
import { fetchProfileStats } from '../../views/ProfileStats';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';

function mixedSnapshot() {
  const now = '2026-10-03T15:30:00.000Z';
  const legacyId = '22222222-2222-4222-8222-222222222222';
  const newId = '33333333-3333-4333-8333-333333333333';
  const rows = [
    { ...word(legacyId), user_id: ACTOR, interval: 10, repetitions: 2, created_at: now,
      last_reviewed_at: '2026-10-01T00:00:00.000Z', next_review_at: '2026-10-03T15:00:00.000Z' },
    { ...word(newId), user_id: ACTOR, interval: 0, repetitions: 0, created_at: now,
      last_reviewed_at: null, next_review_at: '2026-10-01T00:00:00.000Z' },
  ];
  const card = scheduleFsrsReview(introduceFsrsCard('2026-10-02T00:00:00.000Z'), 4, '2026-10-02T00:01:00.000Z').card;
  return { version: 1, actorId: ACTOR, enabled: true, complete: true, registryAvailable: true, now, rows,
    registry: [
      { userId: ACTOR, cardId: legacyId, enrolled: false, card: null, eligible: true, known: false, excluded: false, nextQuestionAt: null, firstQuestionAt: null },
      { userId: ACTOR, cardId: newId, enrolled: true, card, eligible: true, known: false, excluded: false,
        nextQuestionAt: card.due, firstQuestionAt: '2026-10-02T00:00:30.000Z' },
    ] };
}

function recentProgress(result = { data: [] }) {
  const chain = {};
  for (const method of ['select', 'eq', 'order']) chain[method] = vi.fn(() => chain);
  chain.limit = vi.fn(async () => result);
  db.from.mockImplementation(table => {
    if (table !== 'reading_progress') throw new Error(`unexpected legacy table read: ${table}`);
    return chain;
  });
  return chain;
}

describe('home and profile mixed memory integration', () => {
  it('uses exact full-state due after the server clock advances during a request', async () => {
    const snapshot = mixedSnapshot();
    const before = JSON.stringify(snapshot.rows);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => snapshot })));
    recentProgress();
    const home = await fetchHomeData(ACTOR, 'Chinese', NOW - 1000);
    expect(home.dueCount).toBe(1); // 새 FSRS의 보존된 legacy 만기면 2가 되는 회귀
    expect(home.vocabByLang.Chinese).toBe(2);
    expect(JSON.stringify(snapshot.rows)).toBe(before);
    expect(fetch.mock.calls[0][0]).toContain('fields=summary');
    vi.unstubAllGlobals();
  });

  it('passes full-state memory separately from raw profile rows', async () => {
    const snapshot = mixedSnapshot();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => snapshot })));
    const profile = await fetchProfileStats(ACTOR, NOW);
    expect(profile.vocab[1].last_reviewed_at).toBeNull();
    expect(profile.projections[1].memory.lastReview).toBe('2026-10-02T00:01:00.000Z');
    expect(profile.heatmapDayCounts['2026-10-04']).toBe(2);
    vi.unstubAllGlobals();
  });

  it('propagates unavailable/incomplete registry and never presents it as zero or legacy', async () => {
    recentProgress();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...mixedSnapshot(), complete: false }) })));
    await expect(fetchHomeData(ACTOR, 'Chinese', NOW)).rejects.toThrow();
    await expect(fetchProfileStats(ACTOR, NOW)).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it('propagates the other home query failure too', async () => {
    recentProgress({ error: new Error('recent_denied') });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => mixedSnapshot() })));
    await expect(fetchHomeData(ACTOR, 'Chinese', NOW)).rejects.toThrow('recent_denied');
    vi.unstubAllGlobals();
  });
});
