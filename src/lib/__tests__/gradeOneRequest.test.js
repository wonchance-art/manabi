// GRADE-ONE-REQUEST-001 — 단어 페이지의 FSRS 채점은 「한 장 = 요청 한 번」(오너 승인). 실제 전송자(createFsrsLearningClient) →
// 실제 경로(POST /api/learning/fsrs) → 실제 서버(applyFsrsRequest → applyFsrsAnswer)를 잇고, DB 경계만 메모리 대역(fsrsMemoryDb)이다.
// 전에는 한 장에 요청 6(GET 목록 셋 · POST 셋) · DB 약 18(운영 edge 로그 2026-10-30 KST, 35장 8분).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardIds, fsrsMemoryDb, owner } from './helpers/fsrsMemoryDb.js';
import { FSRS_OPERATION_KIND } from '../fsrsOperationOutbox';

const h = vi.hoisted(() => ({ db: null, fetch: null, outbox: null, requireUser: null }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: (...a) => h.requireUser(...a), requireUserForRead: (...a) => h.requireUser(...a) }));
vi.mock('@/lib/server/fsrsLearning', async (importOriginal) => ({ ...(await importOriginal()), fsrsServiceClient: () => h.db.serviceClient }));
vi.mock('../fsrsLearningClient', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, createFsrsLearningClient: (options) => real.createFsrsLearningClient({ ...options, eventTarget: null,
    fetchImpl: (...args) => h.fetch(...args), outbox: h.outbox }) };
});
const { POST } = await import('../../app/api/learning/fsrs/route.js');
const { resetFsrsCapabilityCache } = await import('../server/fsrsLearning.js');
const { gradeLevelFsrs, undoLevelFsrs, disposeLevelFsrs } = await import('../levelFsrsGrade');
const [A, B] = cardIds;

// 보낼함 메모리 대역(fsrsLearningClient.test.js와 같은 모양).
function memoryOutbox() {
  const rows = [];
  return { rows,
    list: vi.fn(async (accountId, { includeSettled = false } = {}) => structuredClone(rows.filter((r) => r.accountId === accountId && (includeSettled || r.status !== 'settled')))),
    append: vi.fn(async (input) => {
      const previous = rows.find((r) => r.accountId === input.accountId && r.operationId === input.payload.operationId);
      if (previous) return structuredClone(previous);
      const entry = { ...input, seq: rows.length + 1, kind: FSRS_OPERATION_KIND, cardId: input.payload.cardId, operationId: input.payload.operationId,
        status: input.blockReason ? 'blocked' : 'queued' };
      rows.push(structuredClone(entry)); return structuredClone(entry);
    }),
    mark: vi.fn(async (entry, patch) => {
      const i = rows.findIndex((r) => r.seq === entry.seq);
      if (rows[i].status !== 'settled') rows[i] = { ...rows[i], ...structuredClone(patch) };
      return structuredClone(rows[i]);
    }),
  };
}
// 브라우저 fetch → 실제 경로 처리기. 인증(getUser)은 요청마다 한 번.
const route = (url, options) => POST(new Request(new URL(url, 'https://manabi.test'), { method: options.method,
  headers: { ...(options.headers || {}), Origin: 'https://manabi.test' }, body: options.body }));
const posts = () => h.fetch.mock.calls.filter(([, o]) => o.method === 'POST');
const sent = () => posts().map(([, o]) => JSON.parse(o.body));

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-10-30T03:00:00.000Z') });
  resetFsrsCapabilityCache();
  h.db = fsrsMemoryDb({ start: Date.now(), stepMs: 0 });
  h.outbox = memoryOutbox();
  h.requireUser = vi.fn(async () => ({ user: { id: owner }, supabase: h.db.authClient }));
  h.fetch = vi.fn(route);
});
afterEach(() => { disposeLevelFsrs(); vi.useRealTimers(); });
const settle = async (promise) => { const out = promise.then((v) => ({ v }), (e) => ({ e })); await vi.advanceTimersByTimeAsync(10000); const r = await out; if (r.e) throw r.e; return r.v; };

describe('한 장 = 요청 한 번', () => {
  it('단어 페이지의 채점 한 번은 POST 하나(GET 0) — 서버가 묻기 · 보이기 · 채점을 차례로 반영한다', async () => {
    expect(await settle(gradeLevelFsrs({ accountId: owner, row: { id: A }, rating: 3 }))).toEqual({ ok: true });
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual([{ action: 'answer', accountId: owner, cardId: A, operationId: expect.any(String), rating: 3 }]);
    const tap = sent()[0].operationId;
    expect(h.db.kinds()).toEqual([`question:${tap}:question`, `reveal:${tap}:reveal`, `grade:${tap}:grade`]);
    // 한 장의 DB 왕복: 인증 1 + 능력 1(15초 공유) + 입장 1 + 상태 1 + 반영 3. 카드 목록 전체 읽기(fsrs_list_states)는 없다.
    expect(h.requireUser).toHaveBeenCalledTimes(1);
    expect(h.db.calls()).toEqual({ fsrs_capabilities: 1, learning_admission_status: 1, fsrs_read_state: 1, fsrs_apply_learning_operation: 3 });
    h.db.resetCalls();
    expect(await settle(gradeLevelFsrs({ accountId: owner, row: { id: B }, rating: 4 }))).toEqual({ ok: true });
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.db.calls()).toEqual({ learning_admission_status: 1, fsrs_read_state: 1, fsrs_apply_learning_operation: 3 });
    expect(h.outbox.append).not.toHaveBeenCalled();
  });

  it('응답을 잃으면(서버는 반영) 같은 탭 ID로 한 번 더 보내고, 서버는 재전송 영수증 — 두 번 채점되지 않는다', async () => {
    h.fetch = vi.fn(async (url, options) => {
      const response = await route(url, options);
      if (h.fetch.mock.calls.length === 1) throw new TypeError('fetch failed'); // 반영 뒤 연결이 끊겼다
      return response;
    });
    expect(await settle(gradeLevelFsrs({ accountId: owner, row: { id: A }, rating: 2 }))).toEqual({ ok: true });
    expect(posts()).toHaveLength(2);
    expect(sent()[1]).toEqual(sent()[0]);
    expect(h.db.operations.map((o) => o.operation.kind)).toEqual(['question', 'reveal', 'grade']);
  });

  it('끊긴 채로는 보낼함에 넣지 않고 실패를 돌려준다(조용히 버리지 않는다) — 다시 보내기는 한 번', async () => {
    h.fetch = vi.fn(async () => { throw new TypeError('fetch failed'); });
    const result = await settle(gradeLevelFsrs({ accountId: owner, row: { id: A }, rating: 3 }));
    expect(result).toMatchObject({ ok: false, error: expect.any(TypeError) });
    expect(posts()).toHaveLength(2);
    expect(h.outbox.append).not.toHaveBeenCalled();
    expect(h.db.operations).toHaveLength(0);
  });

  it('오늘 새 단어 몫을 다 쓰면 new-limit(한도 함께) — 반영 0', async () => {
    h.db.extraUsed = 15;
    expect(await settle(gradeLevelFsrs({ accountId: owner, row: { id: A }, rating: 3 }))).toEqual({ ok: false, reason: 'new-limit', limit: 15 });
    expect(posts()).toHaveLength(1);
    expect(h.db.operations).toHaveLength(0);
  });

  it('곧 차례인 카드는 서버가 알려 준 시각까지 한 번 더 기다렸다 같은 탭 ID로 보낸다', async () => {
    h.db.cards.get(A).nextQuestionAt = new Date(Date.now() + 2000).toISOString();
    expect(await settle(gradeLevelFsrs({ accountId: owner, row: { id: A }, rating: 3 }))).toEqual({ ok: true });
    expect(posts()).toHaveLength(2);
    expect(sent()[1]).toEqual(sent()[0]);
    expect(h.db.operations).toHaveLength(3);
  });
});

describe('되돌리기 — 한 번 채점 뒤에도 보낼함의 undo 하나', () => {
  it('마지막 채점 연산을 채점 뒤 판본으로 겨누고, 서버가 되돌린다', async () => {
    const original = structuredClone(h.db.cards.get(A).card);
    await settle(gradeLevelFsrs({ accountId: owner, row: { id: A }, rating: 4 }));
    const tap = sent()[0].operationId;
    await settle(undoLevelFsrs({ accountId: owner }));
    expect(h.outbox.rows).toHaveLength(1);
    expect(h.outbox.rows[0]).toMatchObject({ status: 'settled', payload: { action: 'undo', cardId: A, expectedRevision: 1, targetOperationId: `${tap}:grade` } });
    expect(h.db.cards.get(A).card).toEqual({ ...original, revision: 2 });
    expect(posts()).toHaveLength(2);
    // 되돌릴 것이 더 없다
    await expect(settle(undoLevelFsrs({ accountId: owner }))).rejects.toThrow('되돌릴 수 있는 채점이 없어요.');
  });
});
