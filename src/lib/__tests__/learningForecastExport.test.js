import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { fetchForecastRows } from '../server/pushSend.js';
import { buildVocabularyCSV, csvToVocabRows } from '../vocabIO.js';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler.js';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows.js';
import { buildForecast } from '../forecast.js';
import { canUseStudyPrefetch } from '../studyPrefetchEligibility.js';

const actorId = '00000000-0000-4000-8000-000000000001';
const cardId = '00000000-0000-4000-8000-000000000002';
const at = '2026-10-03T12:00:00.000Z';
function fixture({ count = 1, full = true } = {}) {
  const initial = introduceFsrsCard('2026-10-01T12:00:00.000Z');
  const card = scheduleFsrsReview(initial, 3, initial.due).card;
  const rows = Array.from({ length: count }, (_, i) => ({ id: i === 0 ? cardId : `00000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}`,
    user_id: actorId, word_text: `原文${i}`, meaning: '보존, "뜻"', language: 'Chinese', base_form: null, created_at: '2026-10-01T00:00:00.000Z',
    interval: 0, ease_factor: 0, repetitions: 0, last_reviewed_at: null, next_review_at: '2026-10-01T00:00:00.000123Z',
    source_material_id: 12, source_sentence: '原文句子。', source_ref: '원래 판본' }));
  const registry = rows.map(row => ({ cardId: row.id, userId: actorId, enrolled: full, card: full ? card : null,
    eligible: true, known: false, excluded: false, firstQuestionAt: null, nextQuestionAt: full ? card.due : null }));
  return { version: 1, actorId, enabled: true, complete: true, registryAvailable: true, now: at, rows, registry };
}
function csvCells(text) {
  // 행의 인용부호·쉼표를 실제 CSV 규칙으로 분해한다(현재 fixture에는 줄바꿈 없음).
  return text.split('\n').map(line => {
    const cells = []; let value = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
      else if (line[i] === ',' && !quoted) { cells.push(value); value = ''; }
      else value += line[i];
    }
    cells.push(value); return cells;
  });
}

describe('forecast complete state reads', () => {
  it('passes full memory even when all raw legacy review columns still indicate a new word', async () => {
    const snapshot = fixture(); const before = structuredClone(snapshot);
    const rpc = vi.fn(async () => ({ data: snapshot }));
    const projections = await fetchForecastRows({ rpc }, actorId, 'Chinese');
    expect(rpc).toHaveBeenCalledWith('fsrs_vocabulary_snapshot', { p_actor: actorId });
    expect(projections[0].memory.reps).toBe(1);
    expect(projections[0].vocabulary.last_reviewed_at).toBeNull();
    expect(buildForecast(projections, new Date(at))).toEqual(buildForecast(projectVocabularyLearningRows(snapshot, { actorId }).projections, new Date(at)));
    expect(snapshot).toEqual(before);
  });
  it('checks the entire owner snapshot before language filtering, without a 1000 row truncation', async () => {
    const snapshot = fixture({ count: 1007 });
    const client = { rpc: async () => ({ data: snapshot }) };
    expect(await fetchForecastRows(client, actorId, 'Chinese')).toHaveLength(1007);
    expect(await fetchForecastRows(client, actorId, 'Japanese')).toEqual([]);
    snapshot.rows.at(-1).user_id = '00000000-0000-4000-8000-000000000999';
    await expect(fetchForecastRows(client, actorId, 'Japanese')).rejects.toThrow();
  });
  it('propagates missing and incomplete registries instead of claiming no forecast words', async () => {
    await expect(fetchForecastRows({ rpc: async () => ({ error: { message: 'missing RPC' } }) }, actorId, 'Chinese')).rejects.toThrow();
    const snapshot = fixture(); snapshot.registry = [];
    await expect(fetchForecastRows({ rpc: async () => ({ data: snapshot }) }, actorId, 'Chinese')).rejects.toThrow();
  });
});

describe('current schedule CSV with preserved original metadata', () => {
  it('exports exact full memory and cooldown independently of untouched legacy columns', () => {
    const snapshot = fixture();
    snapshot.registry[0].nextQuestionAt = '2026-10-04T12:00:45.123Z';
    const { projections } = projectVocabularyLearningRows(snapshot, { actorId });
    const before = JSON.stringify(snapshot.rows);
    const cells = csvCells(buildVocabularyCSV(snapshot.rows, projections));
    expect(cells[0]).toHaveLength(8);
    expect(cells[1][2]).toBe(snapshot.rows[0].meaning);
    expect(cells[1][4]).toBe(snapshot.registry[0].nextQuestionAt);
    expect(cells[1][5]).toBe(String(snapshot.registry[0].card.stability));
    const metadata = JSON.parse(cells[1][7]);
    expect(metadata.scheduler).toBe('fsrs-v1');
    expect(metadata.memory).toEqual(snapshot.registry[0].card);
    expect(metadata.originalSchedule.next_review_at).toBe(snapshot.rows[0].next_review_at);
    expect(metadata.originalSchedule.last_reviewed_at).toBeNull();
    expect(metadata.review.nextQuestionAt).not.toBe(metadata.memory.due);
    expect(JSON.stringify(snapshot.rows)).toBe(before);
  });
  it('exports unknown legacy difficulty/state as unknown, without inventing zero or repetitions', () => {
    const snapshot = fixture({ full: false });
    const { projections } = projectVocabularyLearningRows(snapshot, { actorId });
    const cells = csvCells(buildVocabularyCSV(snapshot.rows, projections));
    expect(cells[1][6]).toBe('');
    expect(JSON.parse(cells[1][7]).memory.reps).toBeNull();
    expect(JSON.parse(cells[1][7]).originalSchedule.ease_factor).toBe(0);
  });
  it('does not export a missing, duplicate or other-owner projection', () => {
    const snapshot = fixture(), { projections } = projectVocabularyLearningRows(snapshot, { actorId });
    expect(() => buildVocabularyCSV(snapshot.rows)).toThrow();
    expect(() => buildVocabularyCSV(snapshot.rows, [])).toThrow();
    expect(() => buildVocabularyCSV(snapshot.rows, [...projections, ...projections])).toThrow();
    expect(() => buildVocabularyCSV([{ ...snapshot.rows[0], user_id: 'someone-else' }], projections)).toThrow();
  });
  it('keeps imported CSV scheduling server-owned and ignores exported state metadata', () => {
    const snapshot = fixture(), { projections } = projectVocabularyLearningRows(snapshot, { actorId });
    const csv = buildVocabularyCSV(snapshot.rows, projections);
    const imported = csvToVocabRows(csv, actorId);
    expect(imported).toHaveLength(1);
    expect(imported[0].word_text).toBe(snapshot.rows[0].word_text);
    expect(imported[0].meaning).toBe(snapshot.rows[0].meaning);
    expect(imported[0]).not.toHaveProperty('memory');
    expect(imported[0]).not.toHaveProperty('interval');
  });
});

describe('prefetched study material cannot bypass current cohort validation', () => {
  const current = () => ({ ...fixture({ full: false }).rows[0], last_reviewed_at: '2026-10-02T00:00:00.000Z' });
  const materials = row => ({ language: 'Chinese', dueWords: [{ word: row.word_text, meaning: row.meaning, row }] });
  it('keeps matching owned previously reviewed vocabulary reusable without mutating saved material', () => {
    const row = current(), saved = materials(structuredClone(row)), before = structuredClone(saved);
    expect(canUseStudyPrefetch(saved, [row], actorId, 'Chinese')).toBe(true);
    expect(saved).toEqual(before);
  });
  it.each(['meaning', 'source_sentence', 'next_review_at'])('rejects a cached %s that is no longer current', field => {
    const row = current(), saved = materials({ ...row, [field]: 'stale' });
    expect(canUseStudyPrefetch(saved, [row], actorId, 'Chinese')).toBe(false);
  });
  it('rejects removed/enrolled/foreign/unreviewed targets and malformed identity lists', () => {
    const row = current();
    expect(canUseStudyPrefetch(materials(row), [], actorId, 'Chinese')).toBe(false);
    const future = { ...row, next_review_at: '2099-01-01T00:00:00.000Z' };
    expect(canUseStudyPrefetch(materials(future), [future], actorId, 'Chinese', Date.parse(at))).toBe(false);
    const precise = { ...row, next_review_at: at.replace('.000Z', '.000123Z') };
    expect(canUseStudyPrefetch(materials(precise), [precise], actorId, 'Chinese', Date.parse(at))).toBe(false);
    expect(canUseStudyPrefetch(materials(row), [{ ...row, user_id: 'other' }], actorId, 'Chinese')).toBe(false);
    expect(canUseStudyPrefetch(materials(row), [{ ...row, last_reviewed_at: null }], actorId, 'Chinese')).toBe(false);
    expect(canUseStudyPrefetch({ language: 'Chinese' }, [row], actorId, 'Chinese')).toBe(false);
    expect(canUseStudyPrefetch({ ...materials(row), dueWords: [...materials(row).dueWords, ...materials(row).dueWords] }, [row], actorId, 'Chinese')).toBe(false);
  });
});

describe('push routes do not turn unavailable learning state into a delivery', () => {
  it('manual test returns 503 without sending fallback copy on a failed snapshot', async () => {
    const send = vi.fn(), userId = actorId;
    vi.resetModules();
    vi.doMock('@/lib/server/auth', () => ({ requireUser: async () => ({ user: { id: userId } }) }));
    vi.doMock('@/lib/server/pushSend', () => ({
      hasVapidConfig: () => true,
      serverSupabase: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [{ lang: 'Chinese' }] }) }) }) }),
      fetchForecastRows: async () => { throw new Error('fsrs_snapshot_unavailable'); },
      detectNewEpisode: async () => false, buildPushCopy: vi.fn(), sendToSubscription: send,
    }));
    try {
      const { POST } = await import('../../app/api/push/test/route.js');
      const response = await POST(new Request('https://example.test/api/push/test', { method: 'POST' }));
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'fsrs_snapshot_unavailable' });
      expect(send).not.toHaveBeenCalled();
    } finally { vi.doUnmock('@/lib/server/auth'); vi.doUnmock('@/lib/server/pushSend'); vi.resetModules(); }
  });
});
