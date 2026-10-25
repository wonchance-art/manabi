// F5② — 경계 확인(fsrs_legacy_boundary)을 「같은 카드 · 같은 채점」 단위로 1번(로그인 감사 2026-10-25 KST: 채점 1번에 3번 —
// progressStore · logReviewEvents · persistVocabGrade가 같은 카드로 각자). 실제 progressStore · reviewEvents · fsrs를 돌리고 Supabase만 바꾼다.
// 계약: 채점 하나 = 경계 RPC 1 · 이벤트 INSERT 1 · 일정 UPDATE 1. 증거는 같은 카드 · 계정 · 표기 · 언어 · 짧은 수명만 덮고 위조할 수 없다.
// 덮지 못하는 쓰기는 지금처럼 다시 묻는다(쓰기를 지키는 확인을 건너뛰지 않는다). 차단(enrolled)은 그대로 막는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const remote = vi.hoisted(() => ({ rpc: vi.fn(), inserts: [], updates: [] }));
vi.mock('../supabase', () => ({ supabase: {
  rpc: (...args) => remote.rpc(...args),
  from: table => ({
    insert: async rows => { remote.inserts.push({ table, rows }); return { error: null }; },
    update: patch => ({ eq: async (key, value) => { remote.updates.push({ table, patch, key, value }); return { error: null }; } }),
  }),
} }));
vi.mock('../streak', () => ({ recordActivity: vi.fn(async () => true) }));
vi.mock('../reviewOutbox', () => ({ enqueueReview: vi.fn(async () => true) }));
import { recordReviewCompleted } from '../learn/progressStore';
import { logReviewEvents } from '../reviewEvents';
import { persistVocabGrade } from '../fsrs';
import { assertLegacyFsrsAllowed, legacyBoundaryCovers, LEGACY_BOUNDARY_PROOF_MS } from '../fsrsLegacyBoundary';
import { supabase } from '../supabase';

const boundaryCalls = () => remote.rpc.mock.calls.filter(([name]) => name === 'fsrs_legacy_boundary');
const allowed = actorId => ({ data: { version: 1, enrolled: false, actorId }, error: null });
const grade = (userId, wordId = 'word-1') => recordReviewCompleted(userId, {
  type: 'vocab', itemKey: '猫', lang: 'Japanese', correct: true, detail: { word_id: wordId, rating: 3, qtype: 'flash' },
}, { interval: 3, ease_factor: 5, repetitions: 1, next_review_at: '2026-10-28T00:00:00.000Z' });

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  remote.rpc.mockReset(); remote.inserts.length = 0; remote.updates.length = 0;
  remote.rpc.mockImplementation(async () => allowed('alice'));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('채점 하나 = 경계 확인 1번', () => {
  it('이벤트 · 일정 두 쓰기가 첫 확인을 나눠 쓴다(전 3번 → 1번) — 쓰기는 그대로 하나씩', async () => {
    const r = await grade('alice');
    expect(r).toMatchObject({ ok: true });
    expect(boundaryCalls()).toHaveLength(1);
    expect(boundaryCalls()[0][1]).toEqual({ p_card_id: 'word-1', p_item_key: '猫', p_language: 'Japanese' });
    expect(remote.inserts.filter(w => w.table === 'review_events')).toHaveLength(1);
    expect(remote.updates.filter(w => w.table === 'user_vocabulary')).toHaveLength(1);
    expect(remote.updates[0].patch.last_reviewed_at).toBe(r.reviewedAt);
  });

  it('채점마다 새로 묻는다 — 증거는 다음 채점으로 넘어가지 않는다', async () => {
    await grade('alice'); await grade('alice'); await grade('alice', 'word-2');
    expect(boundaryCalls()).toHaveLength(3);
  });

  it('등록(enrolled)된 카드는 지금처럼 막고 어떤 쓰기도 나가지 않는다', async () => {
    remote.rpc.mockResolvedValue({ data: { version: 1, enrolled: true, actorId: 'carol' }, error: null });
    const r = await grade('carol');
    expect(r.ok).toBe(false); expect(r.error?.code).toBe('fsrs_legacy_write_blocked');
    expect(remote.inserts).toHaveLength(0); expect(remote.updates).toHaveLength(0);
  });
});

describe('증거가 덮는 범위', () => {
  it('같은 카드 · 계정 · 표기 · 언어만 덮는다 — 다른 카드 · 다른 표기 · 다른 계정은 다시 묻는다', async () => {
    const proof = await assertLegacyFsrsAllowed(supabase, { userId: 'alice', cardId: 'word-1', itemKey: '猫', language: 'Japanese' });
    expect(legacyBoundaryCovers(proof, { cardId: 'word-1' })).toBe(true);
    expect(legacyBoundaryCovers(proof, { userId: 'alice', cardId: 'word-1', itemKey: '猫', language: 'Japanese' })).toBe(true);
    expect(legacyBoundaryCovers(proof, { cardId: 'word-2' })).toBe(false);
    expect(legacyBoundaryCovers(proof, { cardId: 'word-1', itemKey: '犬' })).toBe(false);
    expect(legacyBoundaryCovers(proof, { cardId: 'word-1', language: 'Chinese' })).toBe(false);
    expect(legacyBoundaryCovers(proof, { userId: 'bob', cardId: 'word-1' })).toBe(false);
    remote.rpc.mockClear();
    await logReviewEvents('alice', [{ lang: 'Japanese', source: 'vocab', item_key: '犬', correct: true, detail: { word_id: 'word-1' } }], { strict: true, boundary: proof });
    await persistVocabGrade(supabase, 'word-2', { interval: 1 }, '2026-10-25T00:00:00.000Z', { boundary: proof });
    expect(boundaryCalls()).toHaveLength(2);
  });

  it('위조한 증거(같은 모양의 보통 객체)는 덮지 못한다', async () => {
    const forged = Object.freeze({ userId: 'alice', cardId: 'word-1', itemKey: '猫', language: 'Japanese', at: Date.now() });
    expect(legacyBoundaryCovers(forged, { cardId: 'word-1' })).toBe(false);
    await persistVocabGrade(supabase, 'word-1', { interval: 1 }, '2026-10-25T00:00:00.000Z', { boundary: forged });
    expect(boundaryCalls()).toHaveLength(1);
  });

  it('수명이 지난 증거는 덮지 못한다', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-25T00:00:00.000Z') });
    const proof = await assertLegacyFsrsAllowed(supabase, { userId: 'alice', cardId: 'word-1', itemKey: '猫', language: 'Japanese' });
    vi.advanceTimersByTime(LEGACY_BOUNDARY_PROOF_MS + 1);
    expect(legacyBoundaryCovers(proof, { cardId: 'word-1' })).toBe(false);
  });

  it('덮어도 기기 차단 캐시(같은 계정이 등록을 본 카드)는 늘 다시 본다', async () => {
    remote.rpc.mockImplementation(async () => allowed('dave'));
    const proof = await assertLegacyFsrsAllowed(supabase, { userId: 'dave', cardId: 'word-9', itemKey: '鳥', language: 'Japanese' });
    remote.rpc.mockResolvedValueOnce({ data: { version: 1, enrolled: true, actorId: 'dave' }, error: null });
    await expect(assertLegacyFsrsAllowed(supabase, { userId: 'dave', cardId: 'word-9' })).rejects.toMatchObject({ code: 'fsrs_legacy_write_blocked' });
    await expect(persistVocabGrade(supabase, 'word-9', { interval: 1 }, '2026-10-25T00:00:00.000Z', { boundary: proof }))
      .rejects.toMatchObject({ code: 'fsrs_legacy_write_blocked' });
  });
});
