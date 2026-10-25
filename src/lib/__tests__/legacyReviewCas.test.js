// 독립 리뷰 2026-10-25 KST — 예전 일정 쓰기의 비교 후 쓰기(prev last_reviewed_at) · 쓰기 직전 계정 대조 · 닫힘 전송 토큰 만료.
// 시나리오: 노트북 세션 줄에 X → 폰에서 X 채점(+3일) → 노트북이 옛 값으로 계산한 일정이 폰의 최신 일정을 덮었다(무조건 UPDATE).
// 계약: 바탕이 같을 때만 바꾸고(.eq/.is — 마이그레이션 없음), 0행이면 legacy_review_superseded — 기록(이벤트)은 남고 일정은 그대로, 큐에 안 담는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const remote = vi.hoisted(() => ({ rpc: vi.fn(), rows: [], inserts: [], updates: [], session: { user: { id: 'alice' } }, enqueue: vi.fn() }));
function table(name) {
  const filters = []; let patch = null;
  const query = {
    insert: async rows => { remote.inserts.push({ name, rows }); return { error: null }; },
    update(value) { patch = value; return query; },
    eq(key, value) { filters.push(row => (key === 'last_reviewed_at' ? Date.parse(row[key]) === Date.parse(value) : row[key] === value)); return query; },
    is(key, value) { filters.push(row => (value === null ? row[key] == null : row[key] === value)); return query; },
    select: async () => run(true),
    then: (resolve, reject) => run(false).then(resolve, reject),
  };
  const run = async selected => {
    const hit = remote.rows.filter(row => filters.every(fn => fn(row)));
    hit.forEach(row => Object.assign(row, patch));
    remote.updates.push({ name, patch, matched: hit.length, selected });
    return { data: selected ? hit.map(row => ({ id: row.id })) : null, error: null };
  };
  return query;
}
vi.mock('../supabase', () => ({ supabase: {
  rpc: (...args) => remote.rpc(...args), from: name => table(name),
  auth: { getSession: async () => ({ data: { session: remote.session } }) },
} }));
vi.mock('../streak', () => ({ recordActivity: vi.fn(async () => true) }));
vi.mock('../reviewOutbox', () => ({ enqueueReview: (...args) => remote.enqueue(...args) }));
import { supabase } from '../supabase';
import { persistVocabGrade } from '../fsrs';
import { recordReviewCompleted } from '../learn/progressStore';
import { assertLegacyFsrsAllowed, assertLegacyFsrsAllowedOnce } from '../fsrsLegacyBoundary';
import { isLegacyReviewSuperseded } from '../legacyReviewSupersede';
import { keepaliveTokenUsable } from '../keepalive';

const LAPTOP_BASE = '2026-10-20T01:00:00.000Z', PHONE = '2026-10-25T09:00:00.000Z';
const stats = { interval: 3, ease_factor: 5, repetitions: 1, next_review_at: '2026-10-28T00:00:00.000Z' };
const grade = (expected, nextStats = stats) => recordReviewCompleted('alice', {
  type: 'vocab', itemKey: '猫', lang: 'Japanese', correct: true, detail: { word_id: 'word-1', rating: 3, qtype: 'flash' },
}, nextStats, expected === undefined ? undefined : { expectedLastReviewedAt: expected });

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  remote.rpc.mockReset().mockImplementation(async () => ({ data: { version: 1, enrolled: false, actorId: 'alice' }, error: null }));
  remote.rows = [{ id: 'word-1', user_id: 'alice', interval: 1, last_reviewed_at: LAPTOP_BASE }];
  remote.inserts.length = 0; remote.updates.length = 0; remote.session = { user: { id: 'alice' } };
  remote.enqueue.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.unstubAllGlobals());

describe('persistVocabGrade 비교 후 쓰기', () => {
  it('바탕이 같으면 바꾼다(.eq) · 없던 카드는 .is(null) · 주지 않으면 지금처럼 무조건', async () => {
    await persistVocabGrade(supabase, 'word-1', stats, '2026-10-25T10:00:00.000Z', { expectedLastReviewedAt: LAPTOP_BASE });
    expect(remote.updates.at(-1)).toMatchObject({ matched: 1, selected: true });
    remote.rows = [{ id: 'word-2', last_reviewed_at: null }];
    await persistVocabGrade(supabase, 'word-2', stats, '2026-10-25T10:00:00.000Z', { expectedLastReviewedAt: null });
    expect(remote.updates.at(-1)).toMatchObject({ matched: 1 });
    remote.rows = [{ id: 'word-3', last_reviewed_at: PHONE }];
    await persistVocabGrade(supabase, 'word-3', stats, '2026-10-25T10:00:00.000Z');
    expect(remote.updates.at(-1)).toMatchObject({ matched: 1, selected: false });
  });

  it('그 사이 다른 기기가 먼저 복습했으면 0행 → legacy_review_superseded, 일정은 그대로', async () => {
    remote.rows[0].last_reviewed_at = PHONE; remote.rows[0].interval = 30;
    const error = await persistVocabGrade(supabase, 'word-1', stats, '2026-10-25T10:00:00.000Z', { expectedLastReviewedAt: LAPTOP_BASE }).catch(e => e);
    expect(isLegacyReviewSuperseded(error)).toBe(true);
    expect(remote.rows[0]).toMatchObject({ interval: 30, last_reviewed_at: PHONE });
  });
});

describe('recordReviewCompleted — 물러난 채점', () => {
  it('폰이 먼저 채점한 카드: 이벤트는 남기고 일정은 덮지 않으며 큐에 담지 않는다(superseded)', async () => {
    remote.rows[0].last_reviewed_at = PHONE; remote.rows[0].interval = 30;
    const r = await grade(LAPTOP_BASE);
    expect(r).toMatchObject({ ok: true, superseded: true });
    expect(remote.inserts.filter(w => w.name === 'review_events')).toHaveLength(1);
    expect(remote.rows[0]).toMatchObject({ interval: 30, last_reviewed_at: PHONE });
    expect(remote.enqueue).not.toHaveBeenCalled();
  });
  it('바탕이 같으면 지금처럼 저장한다(superseded 없음)', async () => {
    const r = await grade(LAPTOP_BASE);
    expect(r.ok).toBe(true); expect(r.superseded).toBeUndefined();
    expect(remote.rows[0]).toMatchObject({ interval: 3, last_reviewed_at: r.reviewedAt });
  });
  it('끊긴 채점은 바탕을 보낼함 항목에 싣는다 — 재생이 같은 규칙을 쓴다', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(await grade(LAPTOP_BASE)).toMatchObject({ ok: true, queued: true });
    expect(remote.enqueue.mock.calls[0][0]).toMatchObject({ expectedLastReviewedAt: LAPTOP_BASE, remoteAttempted: false });
    await grade(undefined);
    expect(remote.enqueue.mock.calls[1][0]).not.toHaveProperty('expectedLastReviewedAt');
  });
});

describe('증거를 나눠 쓸 때도 쓰기 직전 계정을 대조한다', () => {
  it('채점 도중 세션 계정이 바뀌면 fsrs_account_changed(차단 · 큐에 안 담음) — RPC 대조와 같은 분류', async () => {
    const proof = await assertLegacyFsrsAllowed(supabase, { userId: 'alice', cardId: 'word-1', itemKey: '猫', language: 'Japanese' });
    remote.session = { user: { id: 'bob' } };
    await expect(assertLegacyFsrsAllowedOnce(supabase, { cardId: 'word-1' }, proof)).rejects.toMatchObject({ code: 'fsrs_account_changed' });
    remote.session = null;
    await expect(assertLegacyFsrsAllowedOnce(supabase, { cardId: 'word-1' }, proof)).rejects.toMatchObject({ code: 'fsrs_boundary_unavailable' });
    remote.session = { user: { id: 'alice' } };
    await expect(assertLegacyFsrsAllowedOnce(supabase, { cardId: 'word-1' }, proof)).resolves.toBe(proof);
    expect(remote.rpc).toHaveBeenCalledTimes(1);
  });
  it('실제 채점 경로: 이벤트 INSERT 직전에 계정이 바뀌면 아무것도 쓰지 않고 fsrs_account_changed로 끝난다', async () => {
    remote.rpc.mockImplementation(async () => { remote.session = { user: { id: 'bob' } }; return { data: { version: 1, enrolled: false, actorId: 'alice' }, error: null }; });
    const r = await grade(LAPTOP_BASE);
    expect(r).toMatchObject({ ok: false }); expect(r.error?.code).toBe('fsrs_account_changed');
    expect(remote.inserts).toHaveLength(0); expect(remote.enqueue).not.toHaveBeenCalled();
  });
});

describe('keepaliveTokenUsable — 닫힘 전송 토큰 만료', () => {
  const jwt = exp => `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;
  it('만료 · 1분 안 만료 · 읽을 수 없는 토큰은 쓰지 않는다(보통 전송으로)', () => {
    const now = Date.parse('2026-10-25T10:00:00.000Z');
    expect(keepaliveTokenUsable(jwt(now / 1000 + 3600), { now })).toBe(true);
    expect(keepaliveTokenUsable(jwt(now / 1000 + 30), { now })).toBe(false);
    expect(keepaliveTokenUsable(jwt(now / 1000 - 1), { now })).toBe(false);
    expect(keepaliveTokenUsable('not-a-jwt', { now })).toBe(false);
    expect(keepaliveTokenUsable(null, { now })).toBe(false);
  });
});
