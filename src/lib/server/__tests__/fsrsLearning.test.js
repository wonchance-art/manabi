import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFsrsRequest, readFsrsStatus, parseFsrsRequest, fsrsError } from '../fsrsLearning.js';
import { introduceFsrsCard, learningDay } from '../../fsrsScheduler.js';

const owner = '10000000-0000-0000-0000-000000000001';
const stranger = '10000000-0000-0000-0000-000000000002';
const id = '20000000-0000-0000-0000-000000000001';
const introducedAt = '2026-10-02T18:59:00.000Z'; // KST 학습일 경계(04시) 직전
const instant = seconds => new Date(Date.parse(introducedAt) + seconds * 1000).toISOString();
const clone = value => JSON.parse(JSON.stringify(value));
let authClient, serviceClient, stored, operations, enabled, applyError, databaseAt, policyLimit;

function request(action, extra = {}, now = instant(30)) {
  databaseAt = now;
  return applyFsrsRequest({ authClient, serviceClient, userId: owner, now,
    body: { action, accountId: owner, cardId: id, operationId: action, expectedRevision: stored?.card.revision || 0, ...(action === 'question' ? { expectedPolicyRevision: 0 } : {}), ...extra } });
}

beforeEach(() => {
  enabled = true; applyError = null; operations = new Map(); databaseAt = instant(30); policyLimit = 15;
  stored = { cardId: id, userId: owner, card: introduceFsrsCard(introducedAt), attempt: null,
    enrolled: true, excluded: false, eligible: true, firstQuestionAt: null };
  authClient = { rpc: vi.fn(async () => ({ data: { version: 1, enabled, policyVersion: 'anki-seconds-v1' } })) };
  // 서버 RPC 경계의 메모리 대역. 권한/원자성 자체는 별도 SQL 계약에서 검증한다.
  serviceClient = { rpc: vi.fn(async (name, args) => {
    if (args.p_actor !== owner) return { error: { message: 'fsrs_forbidden' } };
    if (name === 'learning_admission_status') {
      const used = stored?.firstQuestionAt && learningDay(stored.firstQuestionAt) === learningDay(databaseAt) ? 1 : 0;
      return { data: { version: 1, actorId: owner, installed: true, enabled: true, active: true, fsrsEnabled: enabled,
        startsAt: '2026-10-01T19:00:00.000Z', now: databaseAt, learningDay: new Date(learningDay(databaseAt) * 86400000).toISOString().slice(0, 10),
        timeZone: 'Asia/Seoul', rolloverHour: 4, limit: policyLimit, policyRevision: 0, used, remaining: Math.max(0, policyLimit - used),
        fsrsUsed: used, legacyUsed: 0, admittedLegacyCardIds: [] } };
    }
    if (name === 'fsrs_list_states') return { data: stored ? [clone(stored)] : [] };
    if (name === 'fsrs_read_state') return { data: stored ? { ...clone(stored), operations: [] } : null };
    if (name === 'fsrs_read_operation') return { data: clone(operations.get(args.p_operation_id) || null) };
    if (name !== 'fsrs_apply_learning_operation') throw new Error('unexpected_rpc');
    if (applyError) return { error: applyError };
    const operation = clone(args.p_operation);
    operations.set(operation.id, operation);
    if (operation.kind === 'enroll') stored = { userId: owner, cardId: id, card: operation.nextCard, attempt: null, enrolled: true };
    else if (operation.nextAttempt) {
      stored.attempt = operation.nextAttempt;
      if (operation.kind === 'question' && !stored.firstQuestionAt) stored.firstQuestionAt = operation.nextAttempt.questionAt;
    } else {
      stored.card = operation.nextCard; stored.attempt = null;
      stored.nextQuestionAt = operation.kind === 'undo'
        ? new Date(Math.max(Date.parse(stored.card.due), Date.parse(operation.log.reviewedAt) + 30000)).toISOString() : stored.card.due;
    }
    return { data: { ...clone(stored), operationId: operation.id, duplicate: false } };
  }) };
});

describe('새 FSRS 서버 경계', () => {
  it('준비 상태는 별도 버전·정책·enabled 모두 일치해야 열리며 비활성에서도 등록 목록을 보존한다', async () => {
    enabled = false; stored.excluded = true; stored.eligible = false;
    const status = await readFsrsStatus({ authClient, serviceClient, userId: owner, now: instant(30) });
    expect(status).toMatchObject({ enabled: false, registryAvailable: true, cards: [{ cardId: id, enrolled: true, excluded: true, eligible: false }] });
    await expect(request('question')).rejects.toMatchObject({ status: 503 });
    expect(serviceClient.rpc.mock.calls.filter(([name]) => name === 'fsrs_apply_learning_operation')).toHaveLength(0);
    authClient.rpc.mockResolvedValue({ data: { version: 2, enabled: true, policyVersion: 'anki-seconds-v1' } });
    await expect(request('question')).rejects.toMatchObject({ status: 503 });
  });

  it('등록 목록/능력 읽기 실패를 빈 목록·기존 저장 허용으로 바꾸지 않는다', async () => {
    serviceClient.rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'private SQL detail' } });
    await expect(readFsrsStatus({ authClient, serviceClient, userId: owner })).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
    authClient.rpc.mockRejectedValue(new Error('private auth token'));
    await expect(request('question')).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
  });

  it('오래된 계정·사용자 제공 메모리/시각/소유자·부정한 간격/평점을 DB 호출 전에 거절한다', async () => {
    await expect(request('question', { accountId: stranger })).rejects.toMatchObject({ code: 'fsrs_account_changed', status: 409 });
    for (const forged of [{ nextCard: {} }, { due: instant(0) }, { at: instant(0) }, { userId: owner }, { expectedRevision: -1 }, { dailyNewLimit: 999 }]) {
      await expect(request('question', forged)).rejects.toMatchObject({ status: 400 });
    }
    await expect(request('grade', { attemptId: 'q', rating: '3' })).rejects.toMatchObject({ status: 400 });
    expect(serviceClient.rpc).not.toHaveBeenCalled(); expect(authClient.rpc).not.toHaveBeenCalled();
  });

  it('타인 RPC 응답은 service role 사용 여부와 무관하게 내 카드로 계산하거나 노출하지 않는다', async () => {
    stored.userId = stranger;
    await expect(request('question')).rejects.toMatchObject({ status: 404 });
    await expect(readFsrsStatus({ authClient, serviceClient, userId: owner })).rejects.toMatchObject({ status: 404 });
    expect(serviceClient.rpc.mock.calls.some(([name]) => name === 'fsrs_apply_learning_operation')).toBe(false);
  });

  it('새 등록은 추정한 과거 기억 없이 서버 시각+30초이며 원자 RPC가 신선한 소유 단어 조건을 검사한다', async () => {
    stored = null;
    const response = await request('enroll', {}, instant(100));
    expect(response.card).toMatchObject({ state: 'New', due: instant(130), introducedAt: instant(100), revision: 0, reps: 0 });
    expect(operations.get('enroll')).toMatchObject({ userId: owner, nextCard: response.card });
    await expect(request('enroll', { operationId: 'another' })).rejects.toMatchObject({ status: 409 });
  });

  it('첫 질문은 정확한 due부터 가능하고 저장/문제 노출은 기억 갱신이나 평가가 아니다', async () => {
    await expect(request('question', {}, instant(29.999))).rejects.toMatchObject({ code: 'fsrs_card_not_due', status: 409 });
    const before = clone(stored.card);
    const response = await request('question');
    expect(response.attempt).toMatchObject({ id: 'question', userId: owner, cardId: id, phase: 'question', questionAt: instant(30), eligible: true });
    expect(response.previews[1].due).toBe(instant(60));
    expect(stored.card).toEqual(before);
    expect(operations.get('question').request.dailyNewLimit).toBe(15);
    await expect(request('question', { operationId: 'competing' })).rejects.toMatchObject({ code: 'fsrs_attempt_conflict' });
  });

  it('동일 질문 재전송은 원래 문제 시각을 보존하고 같은 ID의 다른 요청은 충돌한다', async () => {
    await request('question');
    const replay = await request('question', {}, instant(90));
    expect(replay).toMatchObject({ duplicate: true, attempt: { questionAt: instant(30) } });
    await expect(request('question', { answerVisible: true })).rejects.toMatchObject({ code: 'fsrs_operation_conflict', status: 409 });
    expect(serviceClient.rpc.mock.calls.filter(([name]) => name === 'fsrs_apply_learning_operation')).toHaveLength(1);
  });

  it('정책 revision 도입 전에 이미 반영된 질문의 exact replay는 원 요청을 바꾸지 않는다', async () => {
    await request('question');
    delete operations.get('question').request.expectedPolicyRevision;
    const original = clone(operations.get('question'));
    const replay = await request('question', { expectedPolicyRevision: undefined }, instant(90));
    expect(replay).toMatchObject({ duplicate: true, attempt: { questionAt: instant(30) } });
    expect(operations.get('question')).toEqual(original);
    expect(serviceClient.rpc.mock.calls.filter(([name]) => name === 'fsrs_apply_learning_operation')).toHaveLength(1);
  });

  it('동시에 도착한 같은 명령은 SQL 원문 시각이 달라도 커밋한 원본 요청을 확인하여 재전송으로 처리한다', async () => {
    const implementation = serviceClient.rpc.getMockImplementation();
    serviceClient.rpc.mockImplementation(async (name, args) => {
      if (name !== 'fsrs_apply_learning_operation') return implementation(name, args);
      // 다른 요청이 read-operation과 apply 사이에 먼저 성공한 경합을 재현한다.
      const prior = clone(args.p_operation);
      prior.nextAttempt.questionAt = instant(30);
      operations.set(prior.id, prior); stored.attempt = prior.nextAttempt; stored.firstQuestionAt = instant(30);
      return { error: { message: 'fsrs_operation_replay_mismatch', details: 'never expose' } };
    });
    const response = await request('question', {}, instant(31));
    expect(response).toMatchObject({ duplicate: true, attempt: { questionAt: instant(30) } });
    expect(operations.size).toBe(1);
  });

  it('동시 ID 충돌의 요청 내용이 다르면 커밋된 카드가 있어도 성공으로 바꾸지 않는다', async () => {
    const implementation = serviceClient.rpc.getMockImplementation();
    serviceClient.rpc.mockImplementation(async (name, args) => {
      if (name !== 'fsrs_apply_learning_operation') return implementation(name, args);
      const prior = clone(args.p_operation); prior.request.answerVisible = true;
      operations.set(prior.id, prior);
      return { error: { message: 'fsrs_operation_replay_mismatch' } };
    });
    await expect(request('question')).rejects.toMatchObject({ code: 'fsrs_operation_conflict', status: 409 });
  });

  it('질문 전 공개·다른 질문·공개 전 평가는 거부하며 노출과 힌트는 회상으로 채점할 수 없다', async () => {
    await expect(request('reveal', { attemptId: 'missing' })).rejects.toMatchObject({ status: 409 });
    await request('question', { answerVisible: true });
    await expect(request('grade', { attemptId: 'question', rating: 3 })).rejects.toMatchObject({ code: 'fsrs_answer_not_revealed' });
    await request('reveal', { attemptId: 'question', hint: true }, instant(35));
    await expect(request('grade', { attemptId: 'question', rating: 3 }, instant(40))).rejects.toMatchObject({ code: 'fsrs_recall_not_eligible', status: 422 });
    expect(stored.card.reps).toBe(0);
  });

  it('첫 문제의 보존 receipt는 04시 학습 경계로 집계하며 UTC 날짜나 언어 설정에 의존하지 않는다', async () => {
    await request('question');
    databaseAt = instant(59);
    const before = await readFsrsStatus({ authClient, serviceClient, userId: owner, now: instant(59) });
    databaseAt = instant(60);
    const after = await readFsrsStatus({ authClient, serviceClient, userId: owner, now: instant(60) });
    expect(before.firstQuestionsToday).toBe(1); expect(after.firstQuestionsToday).toBe(0);
  });

  it('늦게 전달한 평가는 서버에 저장된 정답 공개 시각으로 계산한다', async () => {
    await request('question');
    const revealed = await request('reveal', { attemptId: 'question' }, instant(35));
    const graded = await request('grade', { attemptId: 'question', rating: 2 }, instant(86400));
    expect(graded.card).toMatchObject({ revision: 1, state: 'Learning', due: instant(350), lastReview: instant(35) });
    expect(revealed.previews[2].due).toBe(graded.card.due);
    expect(operations.get('grade').log).toMatchObject({ reviewedAt: instant(35), questionAt: instant(30), revealedAt: instant(35), optimizerEligible: true, rewardEligible: true });
  });

  it('현재 카드/질문 revision 불일치, 서버보다 미래의 공개 시각, 제외 카드는 평가하지 않는다', async () => {
    await request('question'); await request('reveal', { attemptId: 'question' }, instant(35));
    await expect(request('grade', { attemptId: 'question', rating: 3 }, instant(34))).rejects.toMatchObject({ code: 'fsrs_attempt_conflict' });
    await expect(request('grade', { attemptId: 'question', rating: 3, expectedRevision: 1 }, instant(40))).rejects.toMatchObject({ code: 'fsrs_revision_conflict' });
    stored.excluded = true;
    await expect(request('grade', { attemptId: 'question', rating: 3 }, instant(40))).rejects.toMatchObject({ code: 'fsrs_card_excluded' });
  });

  it('노출된 질문을 폐기해도 receipt·기억은 유지하며 새로운 회상까지 30초를 둔다', async () => {
    await request('question'); await request('reveal', { attemptId: 'question', hint: true }, instant(35));
    const before = clone(stored.card), receipt = stored.firstQuestionAt;
    await request('abandon', { attemptId: 'question' }, instant(40));
    expect(stored.card).toEqual(before); expect(stored.firstQuestionAt).toBe(receipt);
    expect(stored.attempt.phase).toBe('abandoned');
    await expect(request('question', { operationId: 'second', attemptId: 'second' }, instant(64.999))).rejects.toMatchObject({ code: 'fsrs_card_not_due' });
    await request('question', { operationId: 'second', attemptId: 'second' }, instant(65));
    expect(stored.attempt).toMatchObject({ id: 'second', eligible: true, phase: 'question' });
    expect(stored.firstQuestionAt).toBe(receipt);
  });

  it('취소는 저장된 평가를 보상 연산으로 되돌리며 revision·receipt는 되돌리지 않는다', async () => {
    const original = clone(stored.card);
    await request('question'); await request('reveal', { attemptId: 'question' }, instant(35));
    await request('grade', { attemptId: 'question', rating: 3 }, instant(40));
    const response = await request('undo', { targetOperationId: 'grade' }, instant(45));
    expect(response.card).toEqual({ ...original, revision: 2 });
    expect(stored.firstQuestionAt).toBe(instant(30));
    expect(operations.get('undo').log).toMatchObject({ rewardEligible: false, optimizerEligible: false });
    expect(response.nextQuestionAt).toBe(instant(75));
    await expect(request('question', { operationId: 'too-early' }, instant(74.999))).rejects.toMatchObject({ code: 'fsrs_card_not_due' });
    // 이때 과거 grade의 응답만 유실됐어도 과거 revision 1을 반환하지 않는다.
    const replay = await request('grade', { expectedRevision: 0, attemptId: 'question', rating: 3 }, instant(50));
    expect(replay).toMatchObject({ duplicate: true, operationId: 'grade', card: { revision: 2 } });
    await request('question', { operationId: 'after-undo' }, instant(75));
  });

  it('취소 대상도 서버 이력만 읽고 다른 사용자의 조작/더 오래된 평가를 거절한다', async () => {
    await request('question'); await request('reveal', { attemptId: 'question' }, instant(35));
    await request('grade', { attemptId: 'question', rating: 3 }, instant(40));
    operations.get('grade').userId = stranger;
    await expect(request('undo', { targetOperationId: 'grade' }, instant(45))).rejects.toMatchObject({ status: 503 });
    await expect(request('undo', { targetOperationId: 'unknown' }, instant(45))).rejects.toMatchObject({ code: 'fsrs_undo_target_unavailable' });
  });

  it('같은 카드의 새 문제를 덮어쓰는 취소를 거절하고 명시적으로 폐기한 후에만 보상한다', async () => {
    await request('question'); await request('reveal', { attemptId: 'question' }, instant(35));
    await request('grade', { attemptId: 'question', rating: 1 }, instant(40));
    await request('question', { operationId: 'second', attemptId: 'second' }, instant(65));
    await expect(request('undo', { targetOperationId: 'grade' }, instant(66))).rejects.toMatchObject({ code: 'fsrs_attempt_conflict' });
    await request('abandon', { attemptId: 'second' }, instant(67));
    expect((await request('undo', { targetOperationId: 'grade' }, instant(68))).card.revision).toBe(2);
  });

  it('다른 카드/사용자의 질문 snapshot이 섞인 저장 응답은 노출하거나 계산하지 않는다', async () => {
    await request('question'); stored.attempt.userId = stranger;
    await expect(readFsrsStatus({ authClient, serviceClient, userId: owner })).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
    await expect(request('reveal', { attemptId: 'question' }, instant(35))).rejects.toMatchObject({ code: 'fsrs_storage_unavailable' });
  });

  it('읽기 뒤 원자 쓰기에서 발생한 revision/budget 충돌을 성공으로 보고하지 않는다', async () => {
    applyError = { message: 'fsrs_revision_conflict' };
    await expect(request('question')).rejects.toMatchObject({ status: 409, code: 'fsrs_revision_conflict' });
    applyError = { message: 'fsrs_new_budget_exhausted' }; policyLimit = 0;
    await expect(request('question', { dailyNewLimit: 0 })).rejects.toMatchObject({ status: 409, code: 'fsrs_new_budget_exhausted' });
    expect(stored.attempt).toBeNull();
  });

  it('SQL·토큰·학습 내용이 오류 응답에 노출되지 않는다', () => {
    expect(fsrsError({ message: 'secret and private meaning', details: 'owner-email', status: 400 })).toEqual({ status: 503, body: { ok: false, code: 'fsrs_storage_unavailable' } });
    expect(() => parseFsrsRequest({ action: 'unknown' }, owner)).toThrow('fsrs_invalid_request');
  });
});
