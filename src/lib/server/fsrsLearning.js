/** 서버가 검증한 사용자·시각·저장 상태만 새 FSRS 전이에 사용할 수 있다. */
import { createClient } from '@supabase/supabase-js';
import { FSRS_POLICIES, FSRS_RETRY_SECONDS, introduceFsrsCard, learningDay, previewFsrsRatings, schedulerTime, validateFsrsCard } from '../fsrsScheduler.js';
import { beginFsrsAttempt, revealFsrsAttempt, finishFsrsAttempt, planFsrsUndo } from '../fsrsReviewSession.js';
import { UUID } from '../learningSources.js';
import { DEFAULT_NEW_PER_DAY, NEW_PER_DAY_OPTIONS } from '../vocabStudy.js';
import { readLearningAdmissionStatus } from './learningAdmission.js';
import { normalizeAdmissionStatus } from '../learningAdmission.js';

const identity = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const same = (left, right) => canonical(left) === canonical(right);
// detail은 서버 로그 전용(응답 본문에 싣지 않는다) — 503이 어느 단계에서 났는지 남긴다(REVIEW-LOAD-TRANSIENT-001).
const reject = (code, status = 503, detail) => { throw Object.assign(new Error(code), { code, status, ...(detail ? { detail } : {}) }); };
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

/** 5xx만 원인 단계를 남긴다. 사용자 ID · 요청 본문 · 키는 싣지 않는다. */
export function logFsrsUnavailable(route, error) {
  const { status } = fsrsError(error);
  if (status < 500) return;
  console.warn(`[fsrs] ${route} ${status}`, error?.code || error?.name || 'error', error?.detail || error?.message || '');
}

export function fsrsError(error) {
  const known = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    && /^fsrs_[a-z_]+$/.test(error.code || '');
  return { status: known ? error.status : 503, body: { ok: false,
    code: known ? error.code : 'fsrs_storage_unavailable' } };
}

function databaseError(error, name = 'rpc') {
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
  const detail = `${name}: ${error.code || ''} ${message}`.slice(0, 300);
  for (const [pattern, code, status] of cases) if (pattern.test(message)) reject(code, status, status >= 500 ? detail : undefined);
  reject('fsrs_storage_unavailable', 503, detail);
}

async function rpc(client, name, args) {
  let result;
  try { result = await client.rpc(name, args); }
  catch (error) { reject('fsrs_storage_unavailable', 503, `${name} threw: ${error?.name || ''} ${error?.message || ''}`.slice(0, 300)); }
  databaseError(result?.error, name);
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

// 능력(fsrs_capabilities)은 계정과 무관한 전역 설정이다. 연산마다 읽던 것을(운영 평균 0.54 s · 단어 한 장당 세 번) 같은 서버
// 인스턴스에서 15초 나눠 쓴다 — 진행 중인 읽기도 같이 쓴다(FSRS-CAPABILITY-CACHE-001). 실패는 담지 않는다. 최종 권한은 DB다:
// 반영 함수(fsrs_apply_operation)가 settings.enabled · 계약 해시를 FOR SHARE로 다시 보고 꺼졌으면 거절한다(fsrs_storage_disabled → 503).
export const FSRS_CAPABILITY_TTL_MS = 15000;
let capabilityCache = null;
export function resetFsrsCapabilityCache() { capabilityCache = null; }

function capabilities(client, now = Date.now()) {
  if (capabilityCache && now - capabilityCache.at >= 0 && now - capabilityCache.at < FSRS_CAPABILITY_TTL_MS) return capabilityCache.promise;
  const promise = readCapabilities(client);
  const entry = { at: now, promise };
  capabilityCache = entry;
  promise.catch(() => { if (capabilityCache === entry) capabilityCache = null; });
  return promise;
}

async function readCapabilities(client) {
  // 설치 부재와 읽기 장애를 '등록 카드 없음'으로 변환하지 않는다.
  const raw = await rpc(client, 'fsrs_capabilities');
  // 학습 단계 정책은 서버가 정한다(REV-SCOPE R1-B-2 anki-v2). 모르는 정책값이면 추측하지 않고 멈춘다.
  if (raw?.version !== 1 || !Object.hasOwn(FSRS_POLICIES, raw?.policyVersion) || typeof raw.enabled !== 'boolean') reject('fsrs_storage_unavailable', 503, 'fsrs_capabilities: contract mismatch');
  return { version: 1, enabled: raw.enabled,
    policyVersion: raw.policyVersion };
}

function checkedState(raw, userId, cardId = null) {
  if (!raw) return null;
  if (raw.userId !== userId || !UUID.test(raw.cardId || '') || (cardId && raw.cardId !== cardId)) reject('fsrs_card_not_found', 404);
  if (raw.card === null && raw.enrolled === false) return null;
  try { validateFsrsCard(raw.card); } catch { reject('fsrs_storage_unavailable', 503, 'state: invalid card'); }
  if (raw.attempt && (raw.attempt.userId !== userId || raw.attempt.cardId !== raw.cardId
    || !identity(raw.attempt.id) || !['question', 'revealed', 'abandoned'].includes(raw.attempt.phase)
    || typeof raw.attempt.eligible !== 'boolean' || !same(raw.attempt.card, raw.card))) reject('fsrs_storage_unavailable', 503, 'state: attempt mismatch');
  return raw;
}

function publicState(raw) {
  return { cardId: raw.cardId, card: copy(raw.card), attempt: raw.attempt ? copy(raw.attempt) : null,
    enrolled: true, eligible: raw.eligible !== false && !raw.known && !raw.excluded,
    known: raw.known === true, excluded: raw.excluded === true, firstQuestionAt: raw.firstQuestionAt ?? null,
    nextQuestionAt: raw.nextQuestionAt ?? raw.card.due };
}

function result(raw, userId, now, operationId, duplicate = false, policyVersion = raw?.card?.policyVersion) {
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
      response.previews = Object.fromEntries(Object.entries(previewFsrsRatings(state.card, previewAt, { policyVersion }))
        .map(([rating, preview]) => [rating, { due: preview.card.due }]));
    } catch { /* 평가 결과가 이미 반영된 재전송에는 이전 미리보기를 붙이지 않는다. */ }
  }
  return response;
}

export async function readFsrsStatus({ authClient, serviceClient, userId, now = new Date() }) {
  if (!UUID.test(userId || '')) reject('fsrs_auth_required', 401);
  // 능력 · 등록 목록 · 입장 상태는 서로 기다리지 않는다(모두 읽기). 입장 상태의 능력 대조는 같은 능력 읽기의 약속을 나눠 받는다
  // (fsrs_capabilities는 한 번). 모두 받은 뒤 능력 → 목록 → 입장 순으로 오류를 판정한다 — 순차일 때와 같은 우선순위.
  const contractPromise = capabilities(authClient);
  const [contractRead, rowsRead, admissionRead] = await Promise.allSettled([contractPromise,
    rpc(serviceClient, 'fsrs_list_states', { p_actor: userId }),
    readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled: contractPromise.then(c => c.enabled), now })]);
  if (contractRead.status === 'rejected') throw contractRead.reason;
  if (rowsRead.status === 'rejected') throw rowsRead.reason;
  const contract = contractRead.value, rows = rowsRead.value;
  if (!Array.isArray(rows)) reject('fsrs_storage_unavailable', 503, 'fsrs_list_states: not an array');
  const cards = rows.map(row => publicState(checkedState(row, userId)));
  if (new Set(cards.map(card => card.cardId)).size !== cards.length) reject('fsrs_storage_unavailable', 503, 'fsrs_list_states: duplicate card');
  const firstQuestionsToday = cards.filter(entry => entry.firstQuestionAt
    && learningDay(entry.firstQuestionAt, entry.card.timeZone, entry.card.rolloverHour)
      === learningDay(now, entry.card.timeZone, entry.card.rolloverHour)).length;
  if (admissionRead.status === 'rejected') throw admissionRead.reason;
  const admission = admissionRead.value;
  return { ...contract, actorId: userId, now: admission.now, registryAvailable: true,
    firstQuestionsToday: admission.installed ? admission.used : firstQuestionsToday, admission, cards };
}

function checkAttempt(state, request, userId) {
  const attempt = state.attempt;
  if (!attempt || attempt.userId !== userId || attempt.cardId !== state.cardId || attempt.id !== request.attemptId
      || !same(attempt.card, state.card)) reject('fsrs_attempt_conflict', 409);
  return attempt;
}

function transition(state, request, userId, at, policyVersion) {
  const base = { version: 1, id: request.operationId, kind: request.action, userId,
    cardId: request.cardId, expectedRevision: request.expectedRevision, request };
  if (request.action === 'enroll') {
    if (state) reject('fsrs_already_enrolled', 409);
    return { ...base, nextCard: introduceFsrsCard(at, { policyVersion }) };
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
      if (schedulerTime(at) < schedulerTime(exposed) + FSRS_RETRY_SECONDS * 1000) reject('fsrs_card_not_due', 409);
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
    return { ...finishFsrsAttempt(attempt, request.rating, { operationId: request.operationId, at: attempt.revealedAt, policyVersion }), request };
  }
  if (state.attempt && ['question', 'revealed'].includes(state.attempt.phase)) reject('fsrs_attempt_conflict', 409);
  const target = state.operations?.find(operation => operation.id === request.targetOperationId);
  if (!target) reject('fsrs_undo_target_unavailable', 409);
  return { ...planFsrsUndo(target, state.card, { operationId: request.operationId, userId, cardId: request.cardId, at }), request };
}

export async function applyFsrsRequest({ authClient, serviceClient, userId, body, now = new Date() }) {
  if (!UUID.test(userId || '')) reject('fsrs_auth_required', 401);
  const request = parseFsrsRequest(body, userId), at = new Date(schedulerTime(now)).toISOString();
  // 능력 · 입장 상태 · 이 연산 · 카드 상태는 모두 읽기라 서로 기다리지 않는다(readFsrsStatus PERF-FSRS-001과 같은 결 — FSRS-APPLY-PARALLEL-001).
  // 순차일 때 연산 하나 = 왕복 넷 + 반영 + 입장 재조회(운영 평균 합 약 1.3 s, 2026-10-26 KST edge 로그). 오류 판정은 순차일 때의 순서
  // (능력 → 켜짐 → 입장 → 설치 → 연산 → 상태) 그대로 — 모두 받은 뒤 그 순서로 던진다. 반영(쓰기)은 그 판정을 다 통과한 뒤에만.
  // 반영 전 입장 상태는 첫 문제(question) 정책 대조와 등록 · 폐기 같은 그 밖의 연산에만 읽는다. 보이기 · 채점 · 되돌리기 · 폐기는
  // 입장 상태를 쓰지 않고, 무결성(require_admission_integrity)은 반영 함수가 DB 안에서 다시 본다 — 그 읽기(무결성 해시 넷)를 덜어 낸다
  // (FSRS-ADMISSION-QUOTA-001 — 운영 평균 약 0.5 s로 가장 무거운 읽기, 단어 한 장당 세 번 → 한 번).
  const preAdmission = !['reveal', 'grade', 'undo', 'abandon'].includes(request.action);
  const contractPromise = capabilities(authClient);
  const [contractRead, admissionRead, previousRead, rawRead] = await Promise.allSettled([contractPromise,
    preAdmission ? readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled: contractPromise.then(c => c.enabled), now }) : null,
    rpc(serviceClient, 'fsrs_read_operation', { p_actor: userId, p_card_id: request.cardId, p_operation_id: request.operationId }),
    rpc(serviceClient, 'fsrs_read_state', { p_actor: userId, p_card_id: request.cardId })]);
  if (contractRead.status === 'rejected') throw contractRead.reason;
  const contract = contractRead.value;
  if (!contract.enabled) reject('fsrs_storage_unavailable');
  if (admissionRead.status === 'rejected') throw admissionRead.reason;
  const admission = admissionRead.value;
  if (preAdmission && !admission.installed) reject('fsrs_admission_unavailable');
  // 응답의 입장 상태 — 반영 함수가 같은 트랜잭션에서 붙여 주는 반영 뒤 상태(quota = admission_status)를 그대로 쓴다. 모양이 맞지 않거나
  // 반영을 거치지 않은 재전송이면, 첫 문제가 아닌 연산은 반영 전에 읽은 것을(입장 상태는 첫 문제만 바꾼다 — FSRS-ADMISSION-REREAD-001),
  // 그 밖에는 지금처럼 다시 읽는다.
  const admissionAfter = async (raw) => {
    if (raw?.quota) {
      try {
        const status = normalizeAdmissionStatus(raw.quota, { actorId: userId });
        if (status.installed && status.fsrsEnabled === contract.enabled) return status;
      } catch { /* 아래에서 읽는다 */ }
    }
    if (admission && request.action !== 'question') return admission;
    return readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled: contract.enabled, now });
  };
  const currentResult = async (current, duplicate, raw = null) => ({ ...result(current, userId, at, request.operationId, duplicate, contract.policyVersion),
    admission: await admissionAfter(raw) });
  if (previousRead.status === 'rejected') throw previousRead.reason;
  const previous = previousRead.value;
  if (rawRead.status === 'rejected') throw rawRead.reason;
  const state = checkedState(rawRead.value, userId, request.cardId);
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
  try { operation = transition(state, request, userId, at, contract.policyVersion); } catch (error) {
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
    return currentResult(checkedState(current, userId, request.cardId), true, applied);
  }
  return currentResult(applied, applied.duplicate === true, applied);
}
