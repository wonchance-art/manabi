// 한 번 채점(GRADE-ONE-REQUEST-001) 계약 테스트의 DB 대역 — 서버 RPC 경계(fsrs_* · learning_admission_status)만 메모리로 흉내 낸다.
// 반영 함수(fsrs_apply_learning_operation)의 판정 중 이 계약이 기대는 것만 옮겼다: 같은 ID 재전송(같으면 이전 결과 · 다르면 충돌) ·
// 첫 문제의 정책 대조와 하루 새 단어 몫 · 질문 시각 ≥ 차례 · 열린 시도 위 새 질문 거절 · 채점은 보인 시도만 · 반영 뒤 입장 상태(quota).
// 권한 · 원자성 자체는 SQL 계약 테스트의 몫이다.
import { vi } from 'vitest';
import { introduceFsrsCard, learningDay } from '../../fsrsScheduler.js';

export const owner = '10000000-0000-4000-8000-000000000001';
export const cardIds = ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003'];
const clone = (value) => JSON.parse(JSON.stringify(value));

export function fsrsMemoryDb({ start = Date.parse('2026-10-30T03:00:00.000Z'), limit = 15, cards = cardIds, stepMs = 50 } = {}) {
  const db = {
    now: start, limit, extraUsed: 0, fail: null,
    cards: new Map(cards.map((id) => [id, { card: introduceFsrsCard(new Date(start - 60000).toISOString()), attempt: null, nextQuestionAt: null }])),
    receipts: new Map(), operations: [],
  };
  /** 서버 시계 — 부를 때마다 stepMs씩 간다(단계마다 다른 시각인지 볼 수 있게). */
  db.tick = () => { db.now += stepMs; return new Date(db.now).toISOString(); };
  db.status = () => {
    const at = new Date(db.now).toISOString(), day = learningDay(at);
    const used = db.extraUsed + [...db.receipts.values()].filter((q) => learningDay(q) === day).length;
    return { version: 1, actorId: owner, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-01T19:00:00.000Z',
      now: at, learningDay: new Date(day * 86400000).toISOString().slice(0, 10), timeZone: 'Asia/Seoul', rolloverHour: 4, limit: db.limit,
      policyRevision: 0, used, remaining: Math.max(0, db.limit - used), fsrsUsed: used, legacyUsed: 0, admittedLegacyCardIds: [] };
  };
  const row = (id) => {
    const entry = db.cards.get(id);
    return { cardId: id, userId: owner, card: clone(entry.card), attempt: entry.attempt ? clone(entry.attempt) : null, enrolled: true, excluded: false,
      nextQuestionAt: entry.nextQuestionAt || entry.card.due, firstQuestionAt: db.receipts.get(id) ?? null };
  };
  const fail = (message) => ({ error: { code: 'P0001', message } });
  const apply = (op) => {
    const injected = db.fail?.(op);
    if (injected) return { error: injected };
    const prior = db.operations.find((o) => o.id === op.id);
    if (prior) return JSON.stringify(prior.operation) === JSON.stringify(op)
      ? { data: { ...clone(prior.result), duplicate: true, quota: db.status() } } : fail('fsrs_operation_replay_mismatch');
    const entry = db.cards.get(op.cardId);
    if (!entry) return fail('word_not_available');
    if (entry.card.revision !== op.expectedRevision) return fail('review_revision_conflict');
    if (op.kind === 'question') {
      const quota = db.status();
      if (op.request.expectedPolicyRevision !== quota.policyRevision || op.dailyNewLimit !== quota.limit) return fail('learning_policy_conflict');
      const at = Date.parse(op.nextAttempt.questionAt);
      if (at < Date.parse(entry.card.due) || at < Date.parse(entry.nextQuestionAt || entry.card.due)) return fail('fsrs_card_not_due');
      if (entry.attempt && ['question', 'revealed'].includes(entry.attempt.phase)) return fail('invalid_attempt_phase');
      if (entry.card.state === 'New' && !db.receipts.has(op.cardId)) {
        if (quota.remaining <= 0) return fail('learning_daily_new_limit');
        db.receipts.set(op.cardId, op.nextAttempt.questionAt);
      }
      entry.attempt = clone(op.nextAttempt);
    } else if (op.kind === 'reveal') {
      if (entry.attempt?.phase !== 'question' || entry.attempt.id !== op.nextAttempt.id) return fail('invalid_attempt_phase');
      entry.attempt = clone(op.nextAttempt);
    } else if (op.kind === 'grade') {
      if (entry.attempt?.phase !== 'revealed' || entry.attempt.id !== op.attemptId || op.log.revealedAt !== entry.attempt.revealedAt) return fail('invalid_fsrs_grade');
      entry.card = clone(op.nextCard); entry.attempt = null; entry.nextQuestionAt = null;
    } else if (op.kind === 'undo') {
      const target = db.operations.find((o) => o.id === op.undoneOperationId && o.operation.kind === 'grade');
      if (!target || entry.attempt || JSON.stringify(target.operation.nextCard) !== JSON.stringify(entry.card)) return fail('invalid_fsrs_undo');
      entry.card = clone(op.nextCard); entry.attempt = null;
      entry.nextQuestionAt = new Date(Math.max(Date.parse(entry.card.due), Date.parse(op.log.reviewedAt) + 30000)).toISOString();
    } else return fail('invalid_fsrs_operation');
    const result = { ...row(op.cardId), operationId: op.id, duplicate: false };
    db.operations.push({ id: op.id, cardId: op.cardId, operation: clone(op), result: clone(result) });
    return { data: { ...result, quota: db.status() } };
  };
  db.authClient = { rpc: vi.fn(async (name) => (name === 'fsrs_capabilities'
    ? { data: { version: 1, enabled: true, policyVersion: 'anki-seconds-v1' } } : fail('unexpected_auth_rpc'))) };
  db.serviceClient = { rpc: vi.fn(async (name, args) => {
    if (args?.p_actor !== owner) return fail('fsrs_forbidden');
    if (name === 'learning_admission_status') return { data: db.status() };
    if (name === 'fsrs_list_states') return { data: [...db.cards.keys()].map(row) };
    if (name === 'fsrs_read_state') {
      if (!db.cards.has(args.p_card_id)) return fail('word_not_available');
      return { data: { ...row(args.p_card_id), operations: db.operations.filter((o) => o.cardId === args.p_card_id).slice(-100).map((o) => clone(o.operation)) } };
    }
    if (name === 'fsrs_read_operation') return { data: clone(db.operations.find((o) => o.id === args.p_operation_id && o.cardId === args.p_card_id)?.operation ?? null) };
    if (name === 'fsrs_apply_learning_operation') return apply(clone(args.p_operation));
    return fail('unexpected_rpc');
  }) };
  /** 이름별 RPC 횟수(auth + service). */
  db.calls = () => [...db.authClient.rpc.mock.calls, ...db.serviceClient.rpc.mock.calls].reduce((acc, [name]) => ({ ...acc, [name]: (acc[name] || 0) + 1 }), {});
  db.resetCalls = () => { db.authClient.rpc.mockClear(); db.serviceClient.rpc.mockClear(); };
  db.kinds = (cardId) => db.operations.filter((o) => !cardId || o.cardId === cardId).map((o) => `${o.operation.kind}:${o.id}`);
  return db;
}
