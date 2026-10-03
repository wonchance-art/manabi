import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
const mocks = vi.hoisted(() => ({from: vi.fn(), enqueue: vi.fn(), grade: vi.fn(), activity: vi.fn()}));
vi.mock('../supabase', () => ({supabase: {from: mocks.from}}));
vi.mock('../reviewOutbox', async importOriginal => ({...await importOriginal(), enqueueReview: mocks.enqueue}));
vi.mock('../fsrs', () => ({persistVocabGrade: mocks.grade}));
vi.mock('../streak', () => ({recordActivity: mocks.activity}));
import {recordReviewCompleted} from '../learn/progressStore';
import {flushReviews} from '../reviewOutbox';

const guard = {code: '55000', message: 'korean_learning_not_ready'};
const ready = {version: 1, languages: {Korean: {save: true, review: true, known: true, exclude: true}}};
const reviewedAt = '2026-10-02T01:00:00.000Z';
const stats = {next_review_at: '2026-10-03T01:00:00.000Z', interval: 1, repetitions: 2};
const ref = {type: 'vocab', itemKey: '가다', lang: 'Korean', correct: true, detail: {word_id: 'ko-card', rating: 3}};
const entry = (seq, lang) => ({seq, userId: 'alice', lang, source: 'vocab', itemKey: `${lang}-word`,
  correct: true, detail: {word_id: `${lang}-card`, rating: 3}, nextStats: stats, reviewedAt});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enqueue.mockResolvedValue(true); mocks.grade.mockResolvedValue(); mocks.activity.mockResolvedValue();
  vi.stubGlobal('navigator', {onLine: true});
});
afterEach(() => vi.unstubAllGlobals());

describe('Korean review completion storage guard', () => {
  it.each([guard, {code: 'learning_storage_unavailable', message: 'blocked'}])('returns terminal failure on rejected event insert without enqueue or grade', async error => {
    const insert = vi.fn(async () => ({error})); mocks.from.mockReturnValue({insert});
    expect(await recordReviewCompleted('alice', ref, stats)).toEqual({ok: false, error});
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({user_id: 'alice', lang: 'Korean', item_key: '가다', created_at: expect.any(String)})]);
    expect(mocks.enqueue).not.toHaveBeenCalled(); expect(mocks.grade).not.toHaveBeenCalled();
    expect(mocks.activity).not.toHaveBeenCalled();
  });
  it('returns terminal failure on the SRS guard after event insertion', async () => {
    mocks.from.mockReturnValue({insert: vi.fn(async () => ({error: null}))});
    mocks.grade.mockRejectedValueOnce(guard);
    expect(await recordReviewCompleted('alice', ref, stats)).toEqual({ok: false, error: guard});
    expect(mocks.enqueue).not.toHaveBeenCalled(); expect(mocks.activity).not.toHaveBeenCalled();
  });
  it('keeps ordinary online network failure in the existing offline queue', async () => {
    mocks.from.mockReturnValue({insert: vi.fn(async () => ({error: new Error('network')}))});
    const result = await recordReviewCompleted('alice', ref, stats);
    expect(result).toEqual({ok: true, queued: true, reviewedAt: expect.any(String)});
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({userId: 'alice', lang: 'Korean', nextStats: stats, reviewedAt: result.reviewedAt}));
    expect(mocks.grade).not.toHaveBeenCalled();
  });
  it('preserves explicit offline review intent without attempting a DB call', async () => {
    vi.stubGlobal('navigator', {onLine: false});
    expect(await recordReviewCompleted('alice', ref, stats)).toMatchObject({ok: true, queued: true});
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.enqueue).toHaveBeenCalledOnce();
  });
});

// Stateful mock: rejected INSERT is atomic, successful events survive later flushes.
function fixture({contract = ready, capabilityError = null, rejectMixed = false, networkError = null} = {}) {
  const state = {contract, capabilityError, pending: [entry(1, 'Japanese'), entry(2, 'Korean')], events: [], failedMixed: false};
  const scopes = [];
  const insert = vi.fn(async rows => {
    if (rejectMixed && !state.failedMixed && rows.some(row => row.lang === 'Korean')) {
      state.failedMixed = true; return {error: guard};
    }
    if (networkError) return {error: networkError};
    state.events.push(...rows); return {error: null};
  });
  const rpc = vi.fn(async () => ({data: state.contract, error: state.capabilityError}));
  const client = {rpc, from(table) {
    const query = {select: () => query, eq: (field, value) => {scopes.push([table, field, value]); return query;},
      order: () => query, range: async () => ({data: [], error: null}), gte: () => query,
      lte: async () => ({data: state.events, error: null}),
      in: async (_, ids) => ({data: ids.map(id => ({id, last_reviewed_at: null})), error: null}), insert};
    return query;
  }};
  const persist = vi.fn(async () => {}), remove = vi.fn(async seqs => {
    state.pending = state.pending.filter(row => !seqs.includes(row.seq));
  });
  const deps = {persist, remove, load: vi.fn(async () => state.pending)};
  return {state, client, deps, scopes, insert, rpc, persist, remove};
}

describe('Korean outbox capability and rollback isolation', () => {
  it.each([null, {version: 1, languages: {}}, {version: 1, languages: {Korean: {review: true}}}])('holds unsupported Korean entries while flushing legacy reviews', async contract => {
    const f = fixture({contract});
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 1, applied: 1});
    expect(f.rpc).toHaveBeenCalledWith('learning_language_capabilities');
    expect(f.insert.mock.calls[0][0].map(row => row.lang)).toEqual(['Japanese']);
    expect(f.remove).toHaveBeenCalledWith([1]); expect(f.state.pending).toEqual([entry(2, 'Korean')]);
    expect(f.persist).toHaveBeenCalledWith(f.client, 'Japanese-card', stats, reviewedAt);
    expect(f.scopes.filter(([, field]) => field === 'user_id').every(([, , user]) => user === 'alice')).toBe(true);
  });
  it('treats unavailable capability RPC as blocked Korean without interrupting legacy sync', async () => {
    for (const mode of ['error', 'missing', 'throw']) {
      const f = fixture({capabilityError: new Error('missing RPC')});
      if (mode === 'missing') delete f.client.rpc;
      if (mode === 'throw') f.rpc.mockRejectedValueOnce(new Error('offline'));
      expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 1, applied: 1});
      expect(f.state.pending.map(row => row.lang)).toEqual(['Korean']);
    }
  });
  it('flushes both languages when the complete deployed capability is active', async () => {
    const f = fixture();
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 2, kept: 0, applied: 2});
    expect(f.insert).toHaveBeenCalledOnce(); expect(f.insert.mock.calls[0][0].map(row => row.lang)).toEqual(['Japanese', 'Korean']);
    expect(f.remove).toHaveBeenCalledWith([1, 2]); expect(f.state.pending).toEqual([]);
  });
  it('after capability drift rejects mixed insert, safely retries only legacy and retains Korean history for recovery', async () => {
    const f = fixture({rejectMixed: true});
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 1, applied: 1});
    expect(f.insert.mock.calls.map(([rows]) => rows.map(row => row.lang))).toEqual([['Japanese', 'Korean'], ['Japanese']]);
    expect(f.state.events.map(row => row.lang)).toEqual(['Japanese']);
    expect(f.state.pending).toEqual([entry(2, 'Korean')]);
    f.state.contract = null;
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 0, kept: 1, applied: 0});
    expect(f.state.pending).toEqual([entry(2, 'Korean')]);
    f.state.contract = ready;
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 0, applied: 1});
    expect(f.state.events.map(row => row.lang)).toEqual(['Japanese', 'Korean']);
    expect(f.state.events.every(row => row.user_id === 'alice' && row.created_at === reviewedAt)).toBe(true);
    expect(f.state.pending).toEqual([]);
  });
  it('keeps already-landed Korean events if its SRS guard becomes blocked, then recovers without duplicate history', async () => {
    const f = fixture();
    f.persist.mockImplementation(async (_, id) => {if (id === 'Korean-card') throw guard;});
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 1, applied: 1});
    expect(f.state.events).toHaveLength(2); expect(f.state.pending).toEqual([entry(2, 'Korean')]);
    f.persist.mockResolvedValue();
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 0, applied: 1});
    expect(f.insert).toHaveBeenCalledOnce(); expect(f.state.events).toHaveLength(2);
    expect(f.state.pending).toEqual([]);
  });
  it('does not query capabilities for legacy-only queues', async () => {
    const f = fixture(); f.state.pending = [entry(1, 'French')];
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 1, kept: 0, applied: 1});
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('preserves all events on ordinary mixed-batch network failure', async () => {
    const f = fixture({networkError: new Error('offline')});
    expect(await flushReviews(f.client, 'alice', f.deps)).toEqual({sent: 0, kept: 2, applied: 0});
    expect(f.insert).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
    expect(f.persist).not.toHaveBeenCalled(); expect(f.state.events).toEqual([]);
    expect(f.state.pending).toHaveLength(2);
  });
});
