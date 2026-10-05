import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readLearningAdmissionStatus, applyLearningAdmissionRequest } from '../server/learningAdmission.js';
import { applyFsrsRequest, readFsrsStatus } from '../server/fsrsLearning.js';
import { introduceFsrsCard } from '../fsrsScheduler.js';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), client: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/server/fsrsLearning', async original => ({ ...(await original()), fsrsServiceClient: mocks.client }));
import { GET, POST } from '../../app/api/learning/admission/route.js';

const owner = '10000000-0000-0000-0000-000000000001', foreign = '10000000-0000-0000-0000-000000000002';
const cardId = '20000000-0000-0000-0000-000000000001', at = '2026-10-04T00:00:00.000Z';
const request = extra => ({ action: 'admit', accountId: owner, operationId: 'first-question', cardId, expectedPolicyRevision: 1, ...extra });
const status = extra => ({ version: 1, actorId: owner, installed: true, enabled: true, active: true, fsrsEnabled: true,
  startsAt: '2026-10-03T19:00:00.000Z', now: at, learningDay: '2026-10-04', timeZone: 'Asia/Seoul', rolloverHour: 4,
  limit: 15, policyRevision: 1, used: 1, remaining: 14, fsrsUsed: 0, legacyUsed: 1, admittedLegacyCardIds: [cardId], ...extra });
const receipt = extra => ({ version: 1, actorId: owner, operationId: 'first-question', cardId, admitted: true,
  consumed: true, duplicate: false, firstQuestionAt: at, admittedAt: at, startsAt: '2026-10-03T19:00:00.000Z',
  learningDay: '2026-10-04', quota: status(), ...extra });
const missing = { code: 'PGRST202', message: 'Could not find the function public.learning_admission_status(p_actor) in the schema cache' };
const missingMarker = { code: 'PGRST202', message: 'Could not find the function public.fsrs_learning_admission_marker(p_actor) in the schema cache' };
const clone = value => JSON.parse(JSON.stringify(value));
let authClient, serviceClient, quota;
const read = () => readLearningAdmissionStatus({ authClient, serviceClient, userId: owner, now: at });
const apply = body => applyLearningAdmissionRequest({ authClient, serviceClient, userId: owner, body });
const post = (body, headers = {}) => POST(new Request('https://manabi.test/api/learning/admission', { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks(); quota = status();
  authClient = { rpc: vi.fn(async () => ({ data: { version: 1, policyVersion: 'anki-seconds-v1', enabled: true } })) };
  serviceClient = { rpc: vi.fn(async name => ({ data: name === 'learning_admission_status' ? clone(quota) : receipt() })) };
  mocks.requireUser.mockResolvedValue({ user: { id: owner }, supabase: authClient });
  mocks.client.mockReturnValue(serviceClient);
});

describe('인증된 공통 입장 경계', () => {
  it('GET는 DB의 현재 한도를 읽으며 정책 쓰기나 요청 limit 변경을 하지 않는다', async () => {
    expect(await read()).toEqual(status());
    expect(serviceClient.rpc).toHaveBeenCalledExactlyOnceWith('learning_admission_status', { p_actor: owner });
    expect((await GET(new Request('https://manabi.test/api/learning/admission?dailyNewLimit=40'))).status).toBe(400);
  });
  it('정확한 미설치 + 실제 FSRS disabled 둘 다 있어야 nullcount 구 호환이 된다', async () => {
    serviceClient.rpc.mockResolvedValue({ error: missing });
    await expect(read()).rejects.toMatchObject({ status: 503 });
    authClient.rpc.mockResolvedValue({ data: { version: 1, policyVersion: 'anki-seconds-v1', enabled: false } });
    serviceClient.rpc.mockImplementation(async name => name === 'learning_admission_status' ? { error: missing }
      : name === 'fsrs_learning_admission_marker' ? { error: missingMarker }
      : { data: { version: 1, actorId: owner, enabled: false, registryAvailable: true, complete: true, now: at, rows: [], registry: [] } });
    expect(await read()).toMatchObject({ installed: false, fsrsEnabled: false, used: null, admittedLegacyCardIds: null });
    expect(serviceClient.rpc).toHaveBeenLastCalledWith('fsrs_vocabulary_snapshot', { p_actor: owner });
    serviceClient.rpc.mockResolvedValue({ error: missing });
    await expect(read()).rejects.toMatchObject({ status: 503 });
    for (const error of [{ code: 'PGRST202', message: 'private SQL detail' }, { code: '42501', message: missing.message },
      { code: '42501', message: 'owner forbidden private policy' },
      { code: 'PGRST202', message: 'Could not find the function public.another(p_actor) in the schema cache' }]) {
      serviceClient.rpc.mockResolvedValue({ error }); await expect(read()).rejects.toMatchObject({ status: 503 });
    }
    serviceClient.rpc.mockRejectedValue(new Error('private network')); await expect(read()).rejects.toMatchObject({ status: 503 });
  });
  it('새 설치에서 status 함수만 사라지거나 marker까지 손상되면 old-disabled fallback하지 않는다', async () => {
    authClient.rpc.mockResolvedValue({ data: { version: 1, policyVersion: 'anki-seconds-v1', enabled: false } });
    for (const marker of [{ data: { version: 1, actorId: owner, installed: true } }, { error: { code: '55000', message: 'learning_admission_unavailable' } }]) {
      serviceClient.rpc.mockImplementation(async name => name === 'learning_admission_status' ? { error: missing } : marker);
      await expect(read()).rejects.toMatchObject({ code: 'fsrs_admission_unavailable' });
    }
    serviceClient.rpc.mockImplementation(async name => name === 'learning_admission_status' ? { error: missing }
      : name === 'fsrs_learning_admission_marker' ? { error: missingMarker }
        : { error: { code: '55000', message: 'fsrs_contract_drift' } });
    await expect(read()).rejects.toMatchObject({ code: 'fsrs_admission_unavailable' });
    serviceClient.rpc.mockImplementation(async name => name === 'learning_admission_status' ? { error: missing }
      : name === 'fsrs_learning_admission_marker' ? { error: missingMarker }
        : { data: { version: 1, actorId: owner, enabled: false, registryAvailable: true, complete: true, now: at,
          rows: [], registry: [], learningAdmissionVersion: 1 } });
    await expect(read()).rejects.toMatchObject({ code: 'fsrs_admission_unavailable' });
  });
  it('잘못된 owner/clock/count/gate 응답을 empty나 disabled로 바꾸지 않는다', async () => {
    for (const extra of [{ actorId: foreign }, { fsrsEnabled: false }, { remaining: 15 }, { now: 'bad' }, { installed: false }]) {
      quota = status(extra); await expect(read()).rejects.toMatchObject({ status: 503 });
    }
    authClient.rpc.mockResolvedValue({ data: { enabled: false } }); await expect(read()).rejects.toMatchObject({ status: 503 });
  });
  it('브라우저 state/시각/한도변조와 오래된 계정은 SQL 이전에 거절한다', async () => {
    for (const extra of [{ now: at }, { dailyNewLimit: 40 }, { nextCard: {} }, { accountId: foreign }]) await expect(apply(request(extra))).rejects.toBeDefined();
    expect(serviceClient.rpc).not.toHaveBeenCalled(); expect(authClient.rpc).not.toHaveBeenCalled();
  });
  it('legacy admission은 verified actor와 exact CAS payload를 단일 쓰기 RPC로 보낸다', async () => {
    expect(await apply(request())).toEqual(receipt());
    expect(serviceClient.rpc).toHaveBeenLastCalledWith('learning_admit_legacy', { p_actor: owner, p_request: request() });
    expect(serviceClient.rpc.mock.calls.filter(([name]) => name !== 'learning_admission_status')).toHaveLength(1);
  });
  it('configure는 별도 CAS RPC이며 같은 actor/operation 응답만 받는다', async () => {
    const body = { action: 'configure', accountId: owner, operationId: 'policy', expectedPolicyRevision: 1, dailyNewLimit: 0 };
    serviceClient.rpc.mockImplementation(async name => ({ data: name === 'learning_admission_status' ? quota
      : { version: 1, actorId: owner, operationId: 'policy', duplicate: false, quota: status({ policyRevision: 2, limit: 0, remaining: 0 }) } }));
    expect((await apply(body)).quota.limit).toBe(0);
    expect(serviceClient.rpc).toHaveBeenLastCalledWith('learning_configure_admission', { p_actor: owner, p_request: body });
  });
  it('DB 거절은 한도·정책·소유권별 코드만 노출하고 원문은 숨긴다', async () => {
    for (const [message, code] of [['learning_policy_revision_conflict private', 'fsrs_admission_policy_conflict'],
      ['learning_budget_exhausted private', 'fsrs_new_budget_exhausted'], ['learning_owner_forbidden private', 'fsrs_card_not_found'],
      ['learning_admission_pending private', 'fsrs_admission_pending'], ['SQL secret password', 'fsrs_admission_unavailable']]) {
      serviceClient.rpc.mockImplementation(async name => name === 'learning_admission_status' ? { data: quota } : { error: { message } });
      const response = await post(request()); expect(await response.json()).toEqual({ ok: false, code });
    }
  });
  it('익명·다른 origin·손상된 JSON·큰 스트림은 실제 쓰기 전 거절하고 캐시하지 않는다', async () => {
    mocks.requireUser.mockResolvedValue({ error: 'private', status: 401 });
    expect((await post(request())).status).toBe(401); expect(mocks.client).not.toHaveBeenCalled();
    mocks.requireUser.mockResolvedValue({ user: { id: owner }, supabase: authClient });
    for (const response of [await post(request(), { Origin: 'https://foreign.test' }), await post('{'), await post(null), await post(' '.repeat(4097))]) {
      expect([400, 403]).toContain(response.status); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
    expect(serviceClient.rpc).not.toHaveBeenCalled();
    const response = await GET(); expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});

describe('FSRS가 같은 admission 정책을 사용하는 경계', () => {
  const card = introduceFsrsCard('2026-10-03T23:59:00.000Z');
  const state = () => ({ cardId, userId: owner, card, enrolled: true, eligible: true, known: false, excluded: false,
    attempt: null, firstQuestionAt: null, nextQuestionAt: card.due, operations: [] });
  const question = extra => ({ action: 'question', accountId: owner, operationId: 'q', cardId, expectedRevision: 0,
    expectedPolicyRevision: 1, dailyNewLimit: 15, ...extra });
  const run = body => applyFsrsRequest({ authClient, serviceClient, userId: owner, body, now: at });

  it('status firstQuestionsToday는 FSRS 카드만 센 숫자가 아니라 공통 정본이다', async () => {
    quota = status({ fsrsUsed: 2, legacyUsed: 3, used: 5, remaining: 10 });
    serviceClient.rpc.mockImplementation(async name => ({ data: name === 'learning_admission_status' ? quota : [state()] }));
    expect(await readFsrsStatus({ authClient, serviceClient, userId: owner, now: at })).toMatchObject({ firstQuestionsToday: 5, admission: { used: 5 } });
  });
  it('새 question은 policy CAS 검사 후 새 원자 wrapper만 호출한다', async () => {
    serviceClient.rpc.mockImplementation(async (name, args) => {
      if (name === 'learning_admission_status') return { data: quota };
      if (name === 'fsrs_read_operation') return { data: null };
      if (name === 'fsrs_read_state') return { data: state() };
      if (name === 'fsrs_apply_learning_operation') return { data: { ...state(), attempt: args.p_operation.nextAttempt, operationId: 'q' } };
      throw new Error('legacy mutation must not run');
    });
    expect((await run(question())).admission.used).toBe(1);
    const op = serviceClient.rpc.mock.calls.find(([name]) => name === 'fsrs_apply_learning_operation')[1].p_operation;
    expect(op.request.expectedPolicyRevision).toBe(1); expect(op.dailyNewLimit).toBe(15);
    serviceClient.rpc.mockClear();
    for (const body of [question({ expectedPolicyRevision: 0 }), question({ dailyNewLimit: 40 }), question({ expectedPolicyRevision: undefined })]) {
      await expect(run(body)).rejects.toMatchObject({ code: 'fsrs_admission_policy_conflict' });
    }
    expect(serviceClient.rpc.mock.calls.some(([name]) => name === 'fsrs_apply_learning_operation')).toBe(false);
  });
  it('이미 반영된 구 question에는 revision을 주입하지 않고 원 요청 그대로 재개한다', async () => {
    const body = question(); delete body.expectedPolicyRevision;
    const storedRequest = { ...body, attemptId: 'q', answerVisible: false };
    serviceClient.rpc.mockImplementation(async name => ({ data: name === 'learning_admission_status' ? quota : name === 'fsrs_read_operation'
      ? { id: 'q', cardId, userId: owner, request: storedRequest } : state() }));
    expect(await run(body)).toMatchObject({ duplicate: true, operationId: 'q' });
    expect(serviceClient.rpc.mock.calls.some(([name]) => name === 'fsrs_apply_learning_operation')).toBe(false);
    expect(Object.hasOwn(body, 'expectedPolicyRevision')).toBe(false);
  });
});
