'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { canUseLegacyAdmissionCompatibility, normalizeAdmissionRequest, normalizeAdmissionStatus,
  validateAdmissionReceipt, nextAdmissionDayAt, LEARNING_ADMISSION_OFFLINE, isAdmissionOfflineError } from './learningAdmission';

const clone = value => JSON.parse(JSON.stringify(value));
const problem = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const requestScope = request => request.action === 'admit' ? `card:${request.cardId}`
  : request.action === 'question' ? `question:${request.cardId}:${request.expectedRevision}` : 'configure';
const equalRequest = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 첫 출제 의도는 네트워크 전에 COMMIT한다. 여러 탭도 같은 미확인 연산을 재사용한다. */
export function createAdmissionIntentStore({ indexedDB = globalThis.indexedDB, databaseName = 'manabi-learning-admission-v1' } = {}) {
  let opening;
  const open = () => {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(problem('learning_admission_storage_unavailable')); return; }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('intentions', { keyPath: 'operationId' });
        store.createIndex('actor', 'accountId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(problem('learning_admission_storage_blocked'));
    }).catch(error => { opening = null; throw error; });
    return opening;
  };
  const transact = async (mode, work) => {
    const database = await open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('intentions', mode), store = transaction.objectStore('intentions');
      let result, failure;
      transaction.oncomplete = () => resolve(clone(result));
      transaction.onabort = transaction.onerror = () => reject(failure || transaction.error || problem('learning_admission_storage_failed'));
      const fail = error => { failure = error; transaction.abort(); };
      try { work(store, value => { result = value; }, fail); } catch (error) { fail(error); }
    });
  };
  return {
    prepare(request) {
      return transact('readwrite', (store, done, fail) => {
        const read = store.index('actor').getAll(request.accountId);
        read.onsuccess = () => {
          const existing = read.result.find(row => row.scope === requestScope(request) && row.status === 'pending');
          if (existing) {
            if (request.action === 'configure' && existing.request.dailyNewLimit !== request.dailyNewLimit) {
              fail(problem('learning_admission_pending_configuration')); return;
            }
            done(existing.request); return;
          }
          store.add({ operationId: request.operationId, accountId: request.accountId, scope: requestScope(request), request, status: 'pending' });
          done(request);
        };
      });
    },
    settle(request, response) {
      return transact('readwrite', (store, done, fail) => {
        const read = store.get(request.operationId);
        read.onsuccess = () => {
          if (!read.result || !equalRequest(read.result.request, request)) { fail(problem('learning_admission_request_conflict')); return; }
          store.put({ ...read.result, status: 'settled', response }); done(response);
        };
      });
    },
    reject(request, error) {
      return transact('readwrite', (store, done, fail) => {
        const read = store.get(request.operationId);
        read.onsuccess = () => {
          if (!read.result || !equalRequest(read.result.request, request)) { fail(problem('learning_admission_request_conflict')); return; }
          store.put({ ...read.result, status: 'blocked', code: error.code }); done(true);
        };
      });
    },
    pending(accountId) {
      return transact('readonly', (store, done) => {
        const read = store.index('actor').getAll(accountId);
        read.onsuccess = () => done(read.result.filter(row => row.status === 'pending'));
      });
    },
  };
}

/** 오프라인·과거 성공 캐시는 입장권이 아니다. 응답과 로컬 영수증이 모두 정착해야 반환한다. */
export function createLearningAdmissionClient({ accountId, getAccountId = () => accountId,
  fetchImpl = (...args) => globalThis.fetch(...args), store = createAdmissionIntentStore(),
  makeId = () => globalThis.crypto.randomUUID(), requestTimeout = 15000 } = {}) {
  const requests = new Set();
  const owner = () => {
    if (!accountId || getAccountId() !== accountId) throw problem('learning_admission_account_changed');
  };
  const send = async request => {
    owner();
    const abort = new AbortController();
    requests.add(abort);
    const timer = setTimeout(() => abort.abort(), requestTimeout);
    try {
    const response = await fetchImpl('/api/learning/admission', { method: request ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: abort.signal,
      ...(request ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) } : {}) });
    owner();
    let body;
    try { body = await response.json(); } catch { throw problem('learning_admission_invalid_response', { status: response.status }); }
    owner();
    if (!response.ok || body?.ok === false) throw problem(body?.code || 'learning_admission_unavailable', { status: response.status });
    return body;
    } finally { clearTimeout(timer); requests.delete(abort); }
  };
  const perform = async body => {
    owner();
    const desired = normalizeAdmissionRequest({ ...body, accountId, operationId: makeId() }, accountId);
    const request = normalizeAdmissionRequest(await store.prepare(desired), accountId);
    if (request.action !== desired.action || (request.action === 'admit' && request.cardId !== desired.cardId)) throw problem('learning_admission_request_conflict');
    owner();
    // 409 등 확정 거절만 종결한다. 연결/5xx/로컬 정착 실패는 같은 요청을 남긴다.
    let response;
    try { response = validateAdmissionReceipt(await send(request), { request }); }
    catch (error) {
      owner();
      if ([400, 403, 404, 409, 422].includes(error.status)) await store.reject(request, error);
      throw error;
    }
    owner();
    const settled = await store.settle(request, response);
    owner();
    return settled;
  };
  return {
    load: async () => normalizeAdmissionStatus(await send(), { actorId: accountId }),
    admit: ({ cardId, expectedPolicyRevision }) => perform({ action: 'admit', cardId, expectedPolicyRevision }),
    configure: ({ dailyNewLimit, expectedPolicyRevision }) => perform({ action: 'configure', dailyNewLimit, expectedPolicyRevision }),
    pending: () => { owner(); return store.pending(accountId); },
    cancel() { requests.forEach(request => request.abort()); requests.clear(); },
  };
}

/** 화면에 오류를 띄운 실패만 콘솔에 코드 · 상태로 남긴다(원문 메시지 · 응답 본문은 싣지 않는다).
 *  서버가 200인데 「복습을 준비하지 못했어요」가 뜬 관찰(M09 #1337 6166527435)의 클라이언트 단계를 가르기 위함. */
export function logLearningFailure(where, error) {
  console.warn(`[learning] ${where} 실패`, error?.code || error?.name || 'error', error?.status ?? '');
}

/**
 * 질문(question) 직전 한도 다시 읽기를 건너뛰는 창(VOCAB-START-3, 2026-10-17 KST). 복습 시작(startSession)이 입장 한도를 막 읽고
 * 줄을 짠 뒤 첫 카드를 묻는데, question이 다시 GET부터 해 시작 뒤 첫 카드까지 왕복이 하나 더 들었다(입장 → FSRS → 입장 다시).
 * question이 한도에서 쓰는 것은 정책 판(expectedPolicyRevision)과 호환 여부뿐이다 — 판이 그 사이 바뀌면 서버가 409로 거절하고
 * 아래 다시 읽기가 그대로 돈다. 사용량 · 새 표현 한도는 서버 입장 RPC가 정본이다. 짧게 둔다(사람이 카드를 읽는 동안이면 다시 읽는다).
 */
export const QUESTION_QUOTA_FRESH_MS = 2000;

export { LEARNING_ADMISSION_OFFLINE, isAdmissionOfflineError };
const browserOffline = () => globalThis.navigator?.onLine === false;

export function createLearningAdmissionController({ accountId, client, onQuota = () => {},
  eventTarget = globalThis.window, visibilityTarget = globalThis.document,
  setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now(), isOffline = browserOffline } = {}) {
  let disposed = false, started = false, generation = 0, requestGeneration = 0, readGeneration = 0, loading = null, working = null;
  let timer = null, quotaAt = null; // quotaAt = 이 기기 시계로 한도를 받은 때(읽기 · 입장 · 설정 응답 모두)
  let offlineQuestion = null; // 끊겨서 못 연 카드 — 연결되면 같은 카드 · 같은 문항 열쇠로 다시 묻는다
  // 서버가 이미 입장시킨 카드(F9). learning_admit_legacy가 fsrs_private.legacy_admissions에 카드마다 한 번 남기고 지우지 않는 사실이라
  // (계정 삭제 cascade 외 DELETE · UPDATE 없음) 한 번 본 id는 이 계정 controller가 사는 동안 거짓이 되지 않는다 — 단조 합집합으로 모은다.
  // 기기가 만든 영수증이 아니다: 서버 응답(한도 읽기 · 입장 응답)의 admittedLegacyCardIds만 넣는다.
  // 끊겼을 때만 쓴다(독립 리뷰 2026-10-25 KST). 연결돼 있으면 입장 POST가 매번 새 operationId로 다시 검사한다 — 제외(vocabulary_excluded) ·
  // 다른 기기가 먼저 복습해 아직 때가 아님(learning_card_not_due) · 정책 판. 이 검사를 건너뛰면 노트북 줄에 남은 카드가 폰에서 채점된 뒤에도
  // 왕복 없이 열려 다시 채점된다. 끊긴 동안의 그런 겹침은 보낼함 재생의 비교 후 쓰기(prev last_reviewed_at)가 막는다.
  const admitted = new Set();
  let admittedMode = null; // 마지막으로 검증한 한도가 호환(사전 활성) 모드인가 — 호환이면 입장권이 없어 이 지름길을 쓰지 않는다
  const listeners = new Set();
  let state = { status: 'loading', quota: null, current: null, busy: false, error: null };
  const publish = patch => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); } };
  // 막 받은 한도 — 오류 · 한도 없음 · 진행 중 읽기(포커스 · 날 바뀜)가 있으면 아니다(그 읽기를 기다린다).
  const quotaFresh = () => state.status === 'ready' && !!state.quota && !loading && quotaAt !== null && now() - quotaAt >= 0 && now() - quotaAt <= QUESTION_QUOTA_FRESH_MS;
  const applyQuota = (quota, source = 'load') => {
    const validated = normalizeAdmissionStatus(quota, { actorId: accountId });
    quotaAt = now();
    (validated.admittedLegacyCardIds || []).forEach(id => admitted.add(id));
    admittedMode = canUseLegacyAdmissionCompatibility(validated) ? 'compatibility' : 'admission';
    publish({ quota: validated, status: 'ready' });
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => { timer = null; refresh(); }, Math.min(2147483647, Math.max(1, Date.parse(nextAdmissionDayAt(validated)) - Date.parse(validated.now))));
    onQuota(validated, { source }); return validated;
  };
  /** 서버가 이미 입장시킨 카드인가(입장 모드에서만). 네트워크 없이 답한다. */
  const alreadyAdmitted = cardId => admittedMode === 'admission' && admitted.has(cardId);
  async function refresh() {
    if (disposed || !accountId) return false;
    if (loading) return loading;
    const token = generation, readToken = ++readGeneration;
    loading = (async () => {
      try {
        const quota = await client.load();
        if (disposed || token !== generation || readToken !== readGeneration) return false;
        applyQuota(quota); return true;
      } catch (error) {
        if (!disposed && token === generation && readToken === readGeneration) {
          logLearningFailure('admission load', error);
          // 끊긴 동안의 배경 읽기(포커스 · 날 바뀜 · 다시 묻기) 실패는 서버가 이미 준 한도 · 열린 카드를 거두지 않는다(F9) —
          // 거두면 이미 받은 카드도 다음 장에서 멈춘다. 연결되면(online) 다시 읽는다. 받은 한도가 없거나 연결된 채 실패하면 지금처럼 닫는다.
          if (!(isOffline() && state.status === 'ready' && state.quota)) publish({ status: 'error', quota: null, current: null, error });
        }
        return false;
      } finally { if (token === generation && readToken === readGeneration) loading = null; }
    })();
    return loading;
  }
  async function question(cardId, questionKey) {
    if (disposed || !accountId || !cardId || !questionKey) return false;
    if (state.current?.cardId === cardId && state.current.questionKey === questionKey) return true;
    if (working?.key === questionKey) return working.promise;
    const token = generation, questionToken = ++requestGeneration;
    if (isOffline()) {
      // 끊긴 동안(F9) — 이미 입장한 카드는 서버 왕복 없이 연다(새 표현 한도를 쓰지 않는 카드다). 채점은 보낼함에 쌓이고, 보낼 때
      // 경계 확인 · 비교 후 쓰기(그 사이 다른 기기가 먼저 복습했으면 일정은 건드리지 않는다)를 거친다.
      if (alreadyAdmitted(cardId)) {
        working = null; offlineQuestion = null;
        publish({ current: { accountId, cardId, questionKey, compatibility: false, admitted: true }, busy: false, error: null });
        return true;
      }
      // 아직 입장하지 않은 카드는 서버만 열 수 있다(새 표현 한도 · 첫 노출 영수증) — 묻지 않고 끊김을 알린다.
      working = null; offlineQuestion = { cardId, questionKey };
      publish({ current: null, busy: false, error: problem(LEARNING_ADMISSION_OFFLINE) });
      return false;
    }
    offlineQuestion = null;
    publish({ current: null, busy: true, error: null });
    const promise = (async () => {
      try {
        // 막 받은 한도면 다시 읽지 않는다(VOCAB-START-3 — 복습 시작 직후 첫 카드의 중복 GET). 아니면 지금처럼 먼저 읽는다.
        const quotaReady = quotaFresh() || await refresh();
        if (disposed || token !== generation || questionToken !== requestGeneration) return false;
        if (!quotaReady) {
          // 읽는 사이 끊겼다 — 받은 한도는 남겨 두었으니(위 refresh) 「준비 중」에 멈추지 않게 끊김을 알린다.
          if (isOffline()) { offlineQuestion = { cardId, questionKey }; publish({ error: problem(LEARNING_ADMISSION_OFFLINE) }); }
          return false;
        }
        if (canUseLegacyAdmissionCompatibility(state.quota)) {
          publish({ current: { accountId, cardId, questionKey, compatibility: true } }); return true;
        }
        const response = await client.admit({ cardId, expectedPolicyRevision: state.quota.policyRevision });
        if (disposed || token !== generation || questionToken !== requestGeneration) return false;
        readGeneration++; loading = null;
        admitted.add(response.cardId);
        applyQuota(response.quota, 'admit');
        publish({ current: { accountId, cardId, questionKey, receipt: response, compatibility: false } });
        return true;
      } catch (error) {
        if (!disposed && token === generation && questionToken === requestGeneration) {
          logLearningFailure('admission question', error);
          if (error.status === 409) { readGeneration++; loading = null; await refresh(); }
          // 묻는 사이 끊겼으면(요청 실패 + 끊김) 끊김 안내로 — 연결되면 다시 묻는다.
          if (isOffline() && !error.status) { offlineQuestion = { cardId, questionKey }; publish({ current: null, error: problem(LEARNING_ADMISSION_OFFLINE) }); }
          else publish({ current: null, error });
        }
        return false;
      } finally {
        if (!disposed && token === generation && questionToken === requestGeneration) { working = null; publish({ busy: false }); }
      }
    })();
    working = { key: questionKey, promise }; return promise;
  }
  async function configure(dailyNewLimit) {
    if (disposed || state.busy || !state.quota || canUseLegacyAdmissionCompatibility(state.quota)) return false;
    const token = generation; publish({ busy: true, error: null });
    try {
      const response = await client.configure({ dailyNewLimit, expectedPolicyRevision: state.quota.policyRevision });
      if (disposed || token !== generation) return false;
      readGeneration++; loading = null;
      applyQuota(response.quota, 'configure'); return true;
    } catch (error) {
      if (!disposed && token === generation) { logLearningFailure('admission configure', error); if (error.status === 409) { readGeneration++; loading = null; await refresh(); } publish({ error }); }
      return false;
    } finally { if (!disposed && token === generation) publish({ busy: false }); }
  }
  const onFocus = () => { if (!disposed) refresh(); };
  const onVisible = () => { if (visibilityTarget?.visibilityState !== 'hidden') onFocus(); };
  // 연결이 돌아오면 끊겨서 못 연 카드를 같은 열쇠로 다시 묻는다(그 안에서 한도도 읽는다). 없으면 한도만 다시 읽는다.
  const onOnline = () => {
    if (disposed) return;
    const pending = offlineQuestion;
    if (pending && isAdmissionOfflineError(state.error)) { publish({ error: null }); question(pending.cardId, pending.questionKey); }
    else refresh();
  };
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh, question, configure,
    async retryConfiguration() {
      const entries = await client.pending();
      const pending = entries.find(entry => entry.request.action === 'configure');
      if (pending) return configure(pending.request.dailyNewLimit);
      const result = await refresh();
      if (result) publish({ error: null });
      return result;
    },
    leave() { requestGeneration++; working = null; offlineQuestion = null;
      publish({ current: null, busy: false, ...(isAdmissionOfflineError(state.error) ? { error: null } : {}) }); },
    /** 서버가 질문을 거절한 카드를 화면이 건너뛴 뒤 그 오류를 지운다(목록으로 돌아가도 「준비하지 못했어요」가 남지 않게). */
    dismissError() { publish({ error: null }); },
    /** 서버가 이미 입장시킨 카드인가 — 화면 · 계약 확인용(네트워크 없음). */
    isAdmitted: cardId => alreadyAdmitted(cardId),
    start() { if (started) return; disposed = false; started = true;
      eventTarget?.addEventListener('focus', onFocus); eventTarget?.addEventListener('online', onOnline);
      visibilityTarget?.addEventListener('visibilitychange', onVisible); },
    dispose() { client.cancel?.(); if (timer !== null) clearTimer(timer); timer = null; disposed = true; started = false; generation++; requestGeneration++; working = null; loading = null; listeners.clear();
      admitted.clear(); offlineQuestion = null; // admittedMode는 다음 applyQuota가 늘 다시 정한다(입장 id가 들어오는 유일한 길)
      eventTarget?.removeEventListener('focus', onFocus); eventTarget?.removeEventListener('online', onOnline); visibilityTarget?.removeEventListener('visibilitychange', onVisible); },
  };
}

export function useLearningAdmission({ accountId, onQuota } = {}) {
  const actor = useRef(accountId), notify = useRef(onQuota);
  actor.current = accountId; notify.current = onQuota;
  const controller = useMemo(() => createLearningAdmissionController({ accountId,
    client: createLearningAdmissionClient({ accountId, getAccountId: () => actor.current }),
    onQuota: (quota, meta) => { if (actor.current === accountId) notify.current?.(quota, meta); },
  }), [accountId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(); controller.refresh(); return () => controller.dispose(); }, [controller]);
  return { ...state, compatibility: !!state.quota && canUseLegacyAdmissionCompatibility(state.quota), controller };
}
