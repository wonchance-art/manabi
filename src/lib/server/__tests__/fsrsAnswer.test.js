// GRADE-ONE-REQUEST-001 — 단어 페이지의 한 번 채점(action 'answer'). 서버가 묻기 → 보이기 → 채점을 차례로, 단계마다 자기 시계로 ·
// 단건 연산과 같은 검증 · 전이 · 반영 RPC로 한다. DB에는 연산 셋이 각자의 ID로 남고, 같은 탭의 재전송은 멱등이다.
// 운영 실측(2026-10-30 KST, 35장 8분): 한 장에 요청 6 · DB 약 18(목록 읽기 셋 · 입장 넷 · (인증 + 연산 읽기 + 상태 읽기 + 반영) 셋).
import { beforeEach, describe, expect, it } from 'vitest';
import { applyFsrsAnswer, applyFsrsRequest, fsrsError, parseFsrsAnswerRequest, resetFsrsCapabilityCache } from '../fsrsLearning.js';
import { fsrsAnswerStepIds } from '../../fsrsReviewSession.js';
import { cardIds, fsrsMemoryDb, owner } from '../../__tests__/helpers/fsrsMemoryDb.js';

const [A, B] = cardIds;
let db;
const answer = (extra = {}, cardId = A) => applyFsrsAnswer({ authClient: db.authClient, serviceClient: db.serviceClient, userId: owner, now: db.tick,
  body: { action: 'answer', accountId: owner, cardId, operationId: 'tap-1', rating: 3, ...extra } });
const applies = () => db.calls().fsrs_apply_learning_operation || 0;

beforeEach(() => { resetFsrsCapabilityCache(); db = fsrsMemoryDb(); });

describe('한 번 채점 — 묻기 · 보이기 · 채점을 서버가 차례로', () => {
  it('세 연산이 각자의 ID로 차례대로 반영되고, 시각은 단계마다 서버 시계(묻기 < 보이기 = 채점 시각)', async () => {
    const body = await answer();
    const ids = fsrsAnswerStepIds('tap-1');
    expect(db.kinds()).toEqual([`question:${ids.question}`, `reveal:${ids.reveal}`, `grade:${ids.grade}`]);
    const [question, reveal, grade] = db.operations.map((o) => o.operation);
    expect(question.request).toMatchObject({ action: 'question', attemptId: ids.question, answerVisible: false, dailyNewLimit: 15, expectedPolicyRevision: 0, expectedRevision: 0 });
    expect(reveal.request).toMatchObject({ action: 'reveal', attemptId: ids.question, hint: false });
    expect(grade.request).toMatchObject({ action: 'grade', attemptId: ids.question, rating: 3, expectedRevision: 0 });
    expect(Date.parse(reveal.nextAttempt.revealedAt)).toBeGreaterThan(Date.parse(question.nextAttempt.questionAt));
    expect(grade.log).toMatchObject({ questionAt: question.nextAttempt.questionAt, revealedAt: reveal.nextAttempt.revealedAt,
      reviewedAt: reveal.nextAttempt.revealedAt, rating: 3, optimizerEligible: true, rewardEligible: true });
    expect(body).toMatchObject({ ok: true, version: 1, actorId: owner, cardId: A, operationId: 'tap-1', duplicate: false, attempt: null,
      card: { revision: 1, reps: 1 }, grade: { operationId: ids.grade, revision: 1 }, admission: { used: 1, remaining: 14 } });
  });

  it('반영 전 읽기는 한 번씩 — 능력 1(15초 공유) · 입장 1 · 상태 1, 반영 3. 목록 · 연산 읽기 0', async () => {
    await answer();
    expect(db.calls()).toEqual({ fsrs_capabilities: 1, learning_admission_status: 1, fsrs_read_state: 1, fsrs_apply_learning_operation: 3 });
    db.resetCalls();
    await answer({ operationId: 'tap-2' }, B); // 다음 장 — 능력은 나눠 쓴다
    expect(db.calls()).toEqual({ learning_admission_status: 1, fsrs_read_state: 1, fsrs_apply_learning_operation: 3 });
  });

  it('같은 탭의 재전송은 멱등 — 반영 없이 같은 채점 영수증(duplicate) · 다른 평점은 충돌', async () => {
    const first = await answer();
    const again = await answer();
    expect(applies()).toBe(3);
    expect(again).toMatchObject({ ok: true, duplicate: true, grade: first.grade, card: { revision: 1 } });
    await expect(answer({ rating: 1 })).rejects.toMatchObject({ code: 'fsrs_operation_conflict', status: 409 });
    expect(db.operations).toHaveLength(3);
  });

  it('중간에 끊긴 탭의 재전송은 반영된 단계를 건너뛰고 잇는다(묻기 · 보이기 다시 보내지 않음)', async () => {
    db.fail = (op) => (op.kind === 'grade' ? { code: '57014', message: 'canceling statement due to statement timeout' } : null);
    await expect(answer()).rejects.toMatchObject({ code: 'fsrs_storage_unavailable', status: 503 });
    expect(db.kinds()).toHaveLength(2);
    db.fail = null; db.resetCalls();
    const body = await answer();
    expect(body).toMatchObject({ ok: true, duplicate: false, card: { revision: 1 } });
    expect(db.kinds().map((k) => k.split(':')[0])).toEqual(['question', 'reveal', 'grade']);
    expect(db.calls().fsrs_apply_learning_operation).toBe(1);
  });

  it('동시에 도착한 같은 탭(시각만 다른 같은 명령)은 커밋된 원본을 확인해 잇는다', async () => {
    db.fail = (op) => {
      if (op.kind !== 'question') return null;
      db.fail = null; // 다른 요청이 같은 묻기를 먼저 반영했다(시각이 다르다)
      const earlier = JSON.parse(JSON.stringify(op)); earlier.nextAttempt.questionAt = new Date(Date.parse(op.nextAttempt.questionAt) - 10).toISOString();
      db.cards.get(A).attempt = earlier.nextAttempt; db.receipts.set(A, earlier.nextAttempt.questionAt);
      db.operations.push({ id: op.id, cardId: A, operation: earlier, result: {} });
      return { message: 'fsrs_operation_replay_mismatch' };
    };
    expect(await answer()).toMatchObject({ ok: true, card: { revision: 1 } });
    expect(db.kinds().map((k) => k.split(':')[0])).toEqual(['question', 'reveal', 'grade']);
  });

  it('열린 시도(다른 화면 · 끊긴 앞 탭)가 있으면 그 시도를 잇는다 — 새 질문 없이 보이기 · 채점', async () => {
    await applyFsrsRequest({ authClient: db.authClient, serviceClient: db.serviceClient, userId: owner, now: db.tick,
      body: { action: 'question', accountId: owner, cardId: A, operationId: 'room-q', expectedRevision: 0, expectedPolicyRevision: 0 } });
    db.resetCalls();
    const body = await answer();
    expect(db.kinds()).toEqual(['question:room-q', 'reveal:tap-1:reveal', 'grade:tap-1:grade']);
    expect(db.operations[2].operation.attemptId).toBe('room-q');
    expect(body.grade).toEqual({ operationId: 'tap-1:grade', revision: 1 });
    expect(db.calls().fsrs_apply_learning_operation).toBe(2);
  });

  it('차례가 아닌 카드는 반영 없이 거절 — 다음 질문 시각을 함께(단어 페이지가 곧 차례면 그만큼 기다린다)', async () => {
    await answer();
    db.resetCalls();
    const error = await answer({ operationId: 'tap-2' }).catch((e) => e);
    expect(error).toMatchObject({ code: 'fsrs_card_not_due', status: 409 });
    expect(fsrsError(error).body).toEqual({ ok: false, code: 'fsrs_card_not_due', nextQuestionAt: db.cards.get(A).card.due });
    expect(db.calls().fsrs_apply_learning_operation).toBeUndefined();
  });
});

describe('하루 새 단어 몫(LEVEL-NEW-LIMIT-001) — 서버가 판정해 fsrs_new_budget_exhausted(한도 함께)', () => {
  it('처음 묻는 새 카드 · 몫 0이면 묻지 않는다(반영 0) — 오류 본문에 한도', async () => {
    db.extraUsed = 15;
    const error = await answer().catch((e) => e);
    expect(error).toMatchObject({ code: 'fsrs_new_budget_exhausted', status: 409 });
    expect(fsrsError(error)).toEqual({ status: 409, body: { ok: false, code: 'fsrs_new_budget_exhausted', limit: 15 } });
    expect(applies()).toBe(0);
  });
  it('읽은 뒤 반영 사이에 몫이 찬 경합(반영 함수의 learning_daily_new_limit)도 같은 이름', async () => {
    db.fail = (op) => { if (op.kind === 'question') { db.fail = null; db.extraUsed = 15; } return null; };
    await expect(answer()).rejects.toMatchObject({ code: 'fsrs_new_budget_exhausted', reply: { limit: 15 } });
    expect(db.operations).toHaveLength(0);
  });
  it('이미 시작한 새 카드 · 복습 카드는 몫 0이어도 채점한다(몫을 쓰지 않는다)', async () => {
    db.extraUsed = 15; db.receipts.set(A, new Date(db.now - 5000).toISOString());
    expect(await answer()).toMatchObject({ ok: true, card: { revision: 1 } });
  });
  it('몫이 남았으면 채점하고 하나를 쓴다', async () => {
    db.extraUsed = 14;
    expect(await answer()).toMatchObject({ ok: true, admission: { used: 15, remaining: 0 } });
  });
});

describe('되돌리기 · 다시 채점 — 단건 undo가 한 번 채점의 채점 연산을 겨눈다', () => {
  it('undo(targetOperationId = 채점 연산 · expectedRevision = 채점 뒤 판본)로 되돌리고 30초 뒤 다시 채점', async () => {
    const original = JSON.parse(JSON.stringify(db.cards.get(A).card));
    const graded = await answer({ rating: 4 });
    const undone = await applyFsrsRequest({ authClient: db.authClient, serviceClient: db.serviceClient, userId: owner, now: db.tick,
      body: { action: 'undo', accountId: owner, cardId: A, operationId: 'undo-1', expectedRevision: graded.grade.revision, targetOperationId: graded.grade.operationId } });
    expect(undone.card).toEqual({ ...original, revision: 2 });
    await expect(answer({ operationId: 'tap-2' })).rejects.toMatchObject({ code: 'fsrs_card_not_due' });
    db.now += 30000;
    expect(await answer({ operationId: 'tap-3', rating: 2 })).toMatchObject({ ok: true, card: { revision: 3 }, grade: { operationId: 'tap-3:grade', revision: 3 } });
  });
});

describe('입력 계약 — 시각 · 판본 · 시도 · 정책은 받지 않는다', () => {
  it('브라우저가 정한 값 · 모르는 필드 · 다른 계정은 DB 호출 전에 거절', async () => {
    for (const forged of [{ expectedRevision: 0 }, { at: '2026-10-30T00:00:00Z' }, { attemptId: 'x' }, { dailyNewLimit: 40 }, { rating: 5 },
      { cardId: 'not-a-uuid' }, { operationId: 'x'.repeat(191) }]) {
      await expect(answer(forged)).rejects.toMatchObject({ code: 'fsrs_invalid_request', status: 400 });
    }
    await expect(answer({ accountId: '10000000-0000-4000-8000-000000000002' })).rejects.toMatchObject({ code: 'fsrs_account_changed' });
    expect(db.calls()).toEqual({});
    expect(parseFsrsAnswerRequest({ action: 'answer', accountId: owner, cardId: A, operationId: 'x'.repeat(190), rating: 1 }, owner).operationId).toHaveLength(190);
  });
  it('단건 연산의 오류 본문은 그대로(안내 필드 없음)', () => {
    expect(fsrsError(Object.assign(new Error('x'), { code: 'fsrs_card_not_due', status: 409 })).body).toEqual({ ok: false, code: 'fsrs_card_not_due' });
    expect(fsrsError({ code: 'secret', status: 409, reply: { limit: 15 } }).body).toEqual({ ok: false, code: 'fsrs_storage_unavailable' });
  });
  it('applyFsrsRequest가 answer를 같은 길로 보낸다(경로 · 응답 모양은 단건 연산과 별개)', async () => {
    const body = await applyFsrsRequest({ authClient: db.authClient, serviceClient: db.serviceClient, userId: owner, now: db.tick,
      body: { action: 'answer', accountId: owner, cardId: A, operationId: 'tap-1', rating: 3 } });
    expect(body).toMatchObject({ ok: true, grade: { operationId: 'tap-1:grade' } });
  });
});
