/** 서버가 검증한 사용자·시각·저장 상태만 새 FSRS 전이에 사용할 수 있다. */
import { createClient } from '@supabase/supabase-js';
import { FSRS_POLICY, introduceFsrsCard, learningDay, previewFsrsRatings, schedulerTime, validateFsrsCard } from '../fsrsScheduler.js';
import { beginFsrsAttempt, revealFsrsAttempt, finishFsrsAttempt, planFsrsUndo } from '../fsrsReviewSession.js';
import { UUID } from '../learningSources.js';
import { DEFAULT_NEW_PER_DAY, NEW_PER_DAY_OPTIONS } from '../vocabStudy.js';
import { readLearningAdmissionStatus } from './learningAdmission.js';

const identity = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const same = (left, right) => canonical(left) === canonical(right);
const reject = (code, status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const copy = value => JSON.parse(JSON.stringify(value));
const fields = {
  enroll: [], question: ['attemptId', 'answerVisible', 'dailyNewLimit', 'expectedPolicyRevision'], reveal: ['attemptId', 'hint'],
  grade: ['attemptId', 'rating'], undo: ['targetOperationId'], abandon: ['attemptId'],
};

export function fsrsServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) reject('fsrs_storage_unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function fsrsError(error) {
  const known = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    && /^fsrs_[a-z_]+$/.test(error.code || '');
  return { status: known ? error.status : 503, body: { ok: false,
    code: known ? error.code : 'fsrs_storage_unavailable' } };
}

function databaseError(error) {
  if (!error) return;
  const message = String(error.message || '');
  const cases = [
    [/policy_revision|policy_conflict/, 'fsrs_admission_policy_conflict', 409],
    [/admission_pending|admission_not_started|admission_stopped|admission_inactive/, 'fsrs_admission_pending', 409],
    [/operation_replay_mismatch|operation_conflict|idempotency/, 'fsrs_operation_conflict', 409],
    [/revision/, 'fsrs_revision_conflict', 409],
    [/attempt_conflict|invalid_attempt_phase|invalid_fsrs_attempt/, 'fsrs_attempt_conflict', 409],
    [/not_due/, 'fsrs_card_not_due', 409],
    [/not_found|not_available|owner|forbidden/, 'fsrs_card_not_found', 404],
    [/excluded|known_word/, 'fsrs_card_excluded', 409],
    [/budget|daily_new_limit/, 'fsrs_new_budget_exhausted', 409],
    [/recall_not_eligible/, 'fsrs_recall_not_eligible', 422],
    [/disabled|unavailable|not_ready/, 'fsrs_storage_unavailable', 503],
  ];
  for (const [pattern, code, status] of cases) if (pattern.test(message)) reject(code, status);
  reject('fsrs_storage_unavailable');
}

async function rpc(client, name, args) {
  let result;
  try { result = await client.rpc(name, args); } catch { reject('fsrs_storage_unavailable'); }
  databaseError(result?.error);
  return result?.data;
}

export function parseFsrsRequest(body, userId) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.hasOwn(fields, body.action)) reject('fsrs_invalid_request', 400);
  const allowed = new Set(['action', 'accountId', 'cardId', 'operationId', 'expectedRevision', ...fields[body.action]]);
  if (Object.keys(body).some(key => !allowed.has(key))) reject('fsrs_invalid_request', 400);
  if (body.accountId !== userId) reject('fsrs_account_changed', 409);
  if (!UUID.test(body.cardId || '') || !identity(body.operationId) || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 0 || body.expectedRevision >= Number.MAX_SAFE_INTEGER) reject('fsrs_invalid_request', 400);
  if (body.action === 'enroll' && body.expectedRevision !== 0) reject('fsrs_invalid_request', 400);
  if (['reveal', 'grade', 'abandon'].includes(body.action) && !identity(body.attemptId)) reject('fsrs_invalid_request', 400);
  if (body.action === 'question' && body.attemptId !== undefined && !identity(body.attemptId)) reject('fsrs_invalid_request', 400);
  if (body.action === 'grade' && ![1, 2, 3, 4].includes(body.rating)) reject('fsrs_invalid_request', 400);
  if (body.action === 'undo' && (!identity(body.targetOperationId) || body.targetOperationId === body.operationId)) reject('fsrs_invalid_request', 400);
  if (body.dailyNewLimit !== undefined && !NEW_PER_DAY_OPTIONS.includes(body.dailyNewLimit)) reject('fsrs_invalid_request', 400);
  if (body.expectedPolicyRevision !== undefined && (!Number.isSafeInteger(body.expectedPolicyRevision)
      || body.expectedPolicyRevision < 0 || body.expectedPolicyRevision >= Number.MAX_SAFE_INTEGER)) reject('fsrs_invalid_request', 400);
  for (const flag of ['answerVisible', 'hint']) if (body[flag] !== undefined && typeof body[flag] !== 'boolean') reject('fsrs_invalid_request', 400);
  const request = copy(body);
  if (body.action === 'question') {
    request.attemptId ??= body.operationId; request.answerVisible ??= false;
    request.dailyNewLimit ??= DEFAULT_NEW_PER_DAY;
  }
  if (body.action === 'reveal') request.hint ??= false;
  return request;
}

async function capabilities(client) {
  // 설치 부재와 읽기 장애를 '등록 카드 없음'으로 변환하지 않는다.
  const raw = await rpc(client, 'fsrs_capabilities');
  if (raw?.version !== 1 || raw?.policyVersion !== FSRS_POLICY.version || typeof raw.enabled !== 'boolean') reject('fsrs_storage_unavailable');
  return { version: 1, enabled: raw.enabled,
    policyVersion: FSRS_POLICY.version };
}

function checkedState(raw, userId, cardId = null) {
  if (!raw) return null;
  if (raw.userId !== userId || !UUID.test(raw.cardId || '') || (cardId && raw.cardId !== cardId)) reject('fsrs_card_not_found', 404);
  if (raw.card === null && raw.enrolled === false) return null;
  try { validateFsrsCard(raw.card); } catch { reject('fsrs_storage_unavailable'); }
  if (raw.attempt && (raw.attempt.userId !== userId || raw.attempt.cardId !== raw.cardId
    || !identity(raw.attempt.id) || !['question', 'revealed', 'abandoned'].includes(raw.attempt.phase)
    || typeof raw.attempt.eligible !== 'boolean' || !same(raw.attempt.card, raw.card))) reject('fsrs_storage_unavailable');
  return raw;
}

function publicState(raw) {
  return { cardId: raw.cardId, card: copy(raw.card), attempt: raw.attempt ? copy(raw.attempt) : null,
    enrolled: true, eligible: raw.eligible !== false && !raw.known && !raw.excluded,
    known: raw.known === true, excluded: raw.excluded === true, firstQuestionAt: raw.firstQuestionAt ?? null,
    nextQuestionAt: raw.nextQuestionAt ?? raw.card.due };
}

function result(raw, userId, now, operationId, duplicate = false) {
  const state = checkedState(raw, userId), at = new Date(schedulerTime(now)).toISOString();
  if (!state) reject('fsrs_storage_unavailable');
  const response = { ok: true, version: 1, actorId: userId, now: at, ...publicState(state), operationId, duplicate };
  if (state.attempt) {
    response.attemptId = state.attempt.id;
    response.startedAt = state.attempt.questionAt;
  }
  if (response.eligible && schedulerTime(response.nextQuestionAt) <= schedulerTime(at) && schedulerTime(state.card.due) <= schedulerTime(at)) {
    const previewAt = state.attempt?.phase === 'revealed' ? state.attempt.revealedAt : at;
    try {
      response.previews = Object.fromEntries(Object.entries(previewFsrsRatings(state.card, previewAt))
        .map(([rating, preview]) => [rating, { due: preview.card.due }]));
    } catch { /* 평가 결과가 이미 반영된 재전송에는 이전 미리보기를 붙이지 않는다. */ }
  }
  return response;
}

export async function readFsrsStatus({ authClient, serviceClient, userId, now = new Date() }) {
  if (!UUID.test(userId || '')) reject('fsrs_auth_required', 401);
  const contract = await capabilities(authClient);
  const rows = await rpc(serviceClient, 'fsrs_list_states', { p_actor: userId });
  if (!Array.isArray(rows)) reject('fsrs_storage_unavailable');
  const cards = rows.map(row => publicState(checkedState(row, userId)));
  if (new Set(cards.map(card => card.cardId)).size !== cards.length) reject('fsrs_storage_unavailable');
  const firstQuestionsToday = cards.filter(entry => entry.firstQuestionAt
    && learningDay(entry.firstQuestionAt, entry.card.timeZone, entry.card.rolloverHour)
      === learningDay(now, entry.card.timeZone, entry.card.rolloverHour)).length;
  const admission = await readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled: contract.enabled, now });
  return { ...contract, actorId: userId, now: admission.now, registryAvailable: true,
    firstQuestionsToday: admission.installed ? admission.used : firstQuestionsToday, admission, cards };
}

function checkAttempt(state, request, userId) {
  const attempt = state.attempt;
  if (!attempt || attempt.userId !== userId || attempt.cardId !== state.cardId || attempt.id !== request.attemptId
      || !same(attempt.card, state.card)) reject('fsrs_attempt_conflict', 409);
  return attempt;
}

function transition(state, request, userId, at) {
  const base = { version: 1, id: request.operationId, kind: request.action, userId,
    cardId: request.cardId, expectedRevision: request.expectedRevision, request };
  if (request.action === 'enroll') {
    if (state) reject('fsrs_already_enrolled', 409);
    return { ...base, nextCard: introduceFsrsCard(at) };
  }
  if (!state) reject('fsrs_card_not_found', 404);
  if (state.card.revision !== request.expectedRevision) reject('fsrs_revision_conflict', 409);
  if (state.eligible === false || state.known || state.excluded) reject('fsrs_card_excluded', 409);
  if (request.action === 'question') {
    if (state.nextQuestionAt && schedulerTime(at) < schedulerTime(state.nextQuestionAt)) reject('fsrs_card_not_due', 409);
    // 같은 질문은 재전송으로 재개한다. 아직 평가할 수 있는 질문을 덮어쓰지 않는다.
    if (state.attempt && ['question', 'revealed'].includes(state.attempt.phase)) {
      reject('fsrs_attempt_conflict', 409);
    }
    if (state.attempt?.phase === 'abandoned') {
      const exposed = state.attempt.revealedAt || state.attempt.questionAt;
      if (schedulerTime(at) < schedulerTime(exposed) + FSRS_POLICY.learning[0] * 1000) reject('fsrs_card_not_due', 409);
    }
    return { ...base, dailyNewLimit: request.dailyNewLimit, nextAttempt: beginFsrsAttempt(state.card, { id: request.attemptId, userId,
      cardId: request.cardId, at, answerVisible: request.answerVisible }) };
  }
  if (request.action === 'abandon') {
    const attempt = checkAttempt(state, request, userId);
    if (!['question', 'revealed'].includes(attempt.phase)) reject('fsrs_attempt_conflict', 409);
    if (schedulerTime(at) < schedulerTime(attempt.revealedAt || attempt.questionAt)) reject('fsrs_attempt_conflict', 409);
    return { ...base, nextAttempt: { ...copy(attempt), phase: 'abandoned', abandonedAt: at } };
  }
  if (request.action === 'reveal') return { ...base, nextAttempt: revealFsrsAttempt(checkAttempt(state, request, userId), at, { hint: request.hint }) };
  if (request.action === 'grade') {
    const attempt = checkAttempt(state, request, userId);
    // 응답을 본 시각은 서버에 이미 기록되어 있다. 오프라인 전송 지연은 회상 간격이 아니다.
    if (attempt.phase !== 'revealed' || !attempt.revealedAt) reject('fsrs_answer_not_revealed', 409);
    if (schedulerTime(attempt.revealedAt) > schedulerTime(at)) reject('fsrs_attempt_conflict', 409);
    return { ...finishFsrsAttempt(attempt, request.rating, { operationId: request.operationId, at: attempt.revealedAt }), request };
  }
  if (state.attempt && ['question', 'revealed'].includes(state.attempt.phase)) reject('fsrs_attempt_conflict', 409);
  const target = state.operations?.find(operation => operation.id === request.targetOperationId);
  if (!target) reject('fsrs_undo_target_unavailable', 409);
  return { ...planFsrsUndo(target, state.card, { operationId: request.operationId, userId, cardId: request.cardId, at }), request };
}

export async function applyFsrsRequest({ authClient, serviceClient, userId, body, now = new Date() }) {
  if (!UUID.test(userId || '')) reject('fsrs_auth_required', 401);
  const request = parseFsrsRequest(body, userId), at = new Date(schedulerTime(now)).toISOString();
  const contract = await capabilities(authClient);
  if (!contract.enabled) reject('fsrs_storage_unavailable');
  const admission = await readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled: contract.enabled, now });
  if (!admission.installed) reject('fsrs_admission_unavailable');
  const currentResult = async (current, duplicate) => ({ ...result(current, userId, at, request.operationId, duplicate),
    admission: await readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled: contract.enabled, now }) });
  const previous = await rpc(serviceClient, 'fsrs_read_operation', { p_actor: userId, p_card_id: request.cardId, p_operation_id: request.operationId });
  const raw = await rpc(serviceClient, 'fsrs_read_state', { p_actor: userId, p_card_id: request.cardId });
  const state = checkedState(raw, userId, request.cardId);
  if (previous) {
    if (previous.userId !== userId || previous.cardId !== request.cardId || previous.id !== request.operationId
        || !previous.request || !same(previous.request, request)) reject('fsrs_operation_conflict', 409);
    // 오래된 연산의 결과로 클라이언트의 최신 revision을 되돌리지 않는다.
    return currentResult(state, true);
  }
  // 이전에 반영된 구 요청의 재전송에는 revision을 주입하지 않는다. 새 입장에만 현재 정책을 요구한다.
  if (request.action === 'question' && (request.expectedPolicyRevision !== admission.policyRevision
      || request.dailyNewLimit !== admission.limit)) reject('fsrs_admission_policy_conflict', 409);
  if (request.action === 'undo' && state && !state.operations?.some(operation => operation.id === request.targetOperationId)) {
    const target = await rpc(serviceClient, 'fsrs_read_operation', { p_actor: userId, p_card_id: request.cardId, p_operation_id: request.targetOperationId });
    if (target) state.operations = [...(state.operations || []), target];
  }
  let operation;
  try { operation = transition(state, request, userId, at); } catch (error) {
    if (error?.code) throw error;
    const messages = { fsrs_card_not_due: ['fsrs_card_not_due', 409], recall_not_eligible: ['fsrs_recall_not_eligible', 422],
      answer_not_revealed: ['fsrs_answer_not_revealed', 409], invalid_attempt_phase: ['fsrs_attempt_conflict', 409],
      review_revision_conflict: ['fsrs_revision_conflict', 409], attempt_clock_reversed: ['fsrs_attempt_conflict', 409] };
    const mapped = messages[error?.message];
    if (mapped) reject(...mapped);
    reject('fsrs_storage_unavailable');
  }
  let applied;
  try { applied = await rpc(serviceClient, 'fsrs_apply_learning_operation', { p_actor: userId, p_operation: operation }); } catch (error) {
    if (error?.code !== 'fsrs_operation_conflict') throw error;
    // 동시 재전송 둘이 서로 다른 서버 시각으로 계산했더라도, 실제 반영된 같은 명령을 확인한다.
    const committed = await rpc(serviceClient, 'fsrs_read_operation', { p_actor: userId, p_card_id: request.cardId, p_operation_id: request.operationId });
    if (!committed || committed.userId !== userId || committed.cardId !== request.cardId || committed.id !== request.operationId
        || !committed.request || !same(committed.request, request)) throw error;
    const current = await rpc(serviceClient, 'fsrs_read_state', { p_actor: userId, p_card_id: request.cardId });
    return currentResult(checkedState(current, userId, request.cardId), true);
  }
  if (!applied || applied.operationId !== request.operationId || applied.cardId !== request.cardId) reject('fsrs_storage_unavailable');
  if (applied.duplicate === true) {
    const current = await rpc(serviceClient, 'fsrs_read_state', { p_actor: userId, p_card_id: request.cardId });
    return currentResult(checkedState(current, userId, request.cardId), true);
  }
  return currentResult(applied, applied.duplicate === true);
}
