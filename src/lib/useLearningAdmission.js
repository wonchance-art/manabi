'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { canUseLegacyAdmissionCompatibility, normalizeAdmissionRequest, normalizeAdmissionStatus,
  validateAdmissionReceipt, nextAdmissionDayAt } from './learningAdmission';

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

export function createLearningAdmissionController({ accountId, client, onQuota = () => {},
  eventTarget = globalThis.window, visibilityTarget = globalThis.document,
  setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let disposed = false, started = false, generation = 0, requestGeneration = 0, readGeneration = 0, loading = null, working = null;
  let timer = null;
  const listeners = new Set();
  let state = { status: 'loading', quota: null, current: null, busy: false, error: null };
  const publish = patch => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); } };
  const applyQuota = quota => {
    const validated = normalizeAdmissionStatus(quota, { actorId: accountId });
    publish({ quota: validated, status: 'ready' });
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => { timer = null; refresh(); }, Math.min(2147483647, Math.max(1, Date.parse(nextAdmissionDayAt(validated)) - Date.parse(validated.now))));
    onQuota(validated); return validated;
  };
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
        if (!disposed && token === generation && readToken === readGeneration) publish({ status: 'error', quota: null, current: null, error });
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
    publish({ current: null, busy: true, error: null });
    const promise = (async () => {
      try {
        if (!(await refresh()) || disposed || token !== generation || questionToken !== requestGeneration) return false;
        if (canUseLegacyAdmissionCompatibility(state.quota)) {
          publish({ current: { accountId, cardId, questionKey, compatibility: true } }); return true;
        }
        const response = await client.admit({ cardId, expectedPolicyRevision: state.quota.policyRevision });
        if (disposed || token !== generation || questionToken !== requestGeneration) return false;
        readGeneration++; loading = null;
        applyQuota(response.quota);
        publish({ current: { accountId, cardId, questionKey, receipt: response, compatibility: false } });
        return true;
      } catch (error) {
        if (!disposed && token === generation && questionToken === requestGeneration) {
          if (error.status === 409) { readGeneration++; loading = null; await refresh(); }
          publish({ current: null, error });
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
      applyQuota(response.quota); return true;
    } catch (error) {
      if (!disposed && token === generation) { if (error.status === 409) { readGeneration++; loading = null; await refresh(); } publish({ error }); }
      return false;
    } finally { if (!disposed && token === generation) publish({ busy: false }); }
  }
  const onFocus = () => { if (!disposed) refresh(); };
  const onVisible = () => { if (visibilityTarget?.visibilityState !== 'hidden') onFocus(); };
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
    leave() { requestGeneration++; working = null; publish({ current: null, busy: false }); },
    start() { if (started) return; disposed = false; started = true;
      eventTarget?.addEventListener('focus', onFocus); visibilityTarget?.addEventListener('visibilitychange', onVisible); },
    dispose() { client.cancel?.(); if (timer !== null) clearTimer(timer); timer = null; disposed = true; started = false; generation++; requestGeneration++; working = null; loading = null; listeners.clear();
      eventTarget?.removeEventListener('focus', onFocus); visibilityTarget?.removeEventListener('visibilitychange', onVisible); },
  };
}

export function useLearningAdmission({ accountId, onQuota } = {}) {
  const actor = useRef(accountId), notify = useRef(onQuota);
  actor.current = accountId; notify.current = onQuota;
  const controller = useMemo(() => createLearningAdmissionController({ accountId,
    client: createLearningAdmissionClient({ accountId, getAccountId: () => actor.current }),
    onQuota: quota => { if (actor.current === accountId) notify.current?.(quota); },
  }), [accountId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.start(); controller.refresh(); return () => controller.dispose(); }, [controller]);
  return { ...state, compatibility: !!state.quota && canUseLegacyAdmissionCompatibility(state.quota), controller };
}
