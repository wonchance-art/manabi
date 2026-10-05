'use client';

import { createFsrsOperationOutbox, normalizeFsrsRequest } from './fsrsOperationOutbox';
import { rememberFsrsEnrollments } from './fsrsLegacyBoundary';
import { createAdmissionIntentStore } from './useLearningAdmission';
import { normalizeAdmissionStatus } from './learningAdmission';

const problem = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const receiptKey = (cardId, attemptId, revision) => JSON.stringify([cardId, attemptId, revision]);
const pendingResult = entry => ({ queued: true, operationId: entry.operationId,
  accountId: entry.accountId, action: entry.payload?.action,
  status: entry.status === 'queued' ? 'pending' : entry.status === 'settled'
    ? (entry.response?.duplicate ? 'replayed' : 'applied') : entry.status,
  ...(entry.response ? { response: entry.response } : {}), blockReason: entry.blockReason });

/** 서버 오류는 원본을 버리는 사유가 아니다. 충돌은 자동 재계산/덮어쓰기를 멈춘다. */
export function fsrsFailureStatus(error) {
  if (/stale/.test(error?.code || '')) return 'stale';
  if (/conflict|revision/.test(error?.code || '')) return 'conflict';
  if (['fsrs_invalid_request', 'fsrs_invalid_queue_entry'].includes(error?.code)) return 'blocked';
  if ([400, 404, 409, 422].includes(error?.status)) return 'blocked';
  return 'queued';
}

/** 계정별 단일 전송자. question/reveal은 온라인 영수증이 있어야 회상으로 진행한다. */
export function createFsrsLearningClient({ accountId, getAccountId = () => accountId,
  fetchImpl = (...args) => globalThis.fetch(...args), outbox = createFsrsOperationOutbox(),
  questionStore = createAdmissionIntentStore({ databaseName: 'manabi-fsrs-questions-v1' }),
  eventTarget = globalThis.window, requestTimeout = 15000 } = {}) {
  const listeners = new Set(), receipts = new Map(), controllers = new Set();
  let disposed = false, started = false, flushing = null, rerun = false, generation = 0;
  const assertOwner = () => {
    if (disposed) throw problem('fsrs_client_disposed');
    if (typeof accountId !== 'string' || !accountId) throw problem('fsrs_invalid_account');
    if (getAccountId() !== accountId) throw problem('fsrs_account_changed');
  };
  const emit = event => {
    if (disposed || getAccountId() !== accountId) return;
    listeners.forEach(listener => { try { listener(event); } catch { /* 구독 실패는 원본 저장과 별개다. */ } });
  };
  const remember = body => {
    const attempt = body?.attempt;
    if (attempt?.phase === 'revealed' && attempt.eligible === true && !attempt.hintedAt &&
        attempt.userId === accountId && attempt.cardId === body.cardId &&
        attempt.card?.revision === body.card?.revision &&
        Number.isFinite(Date.parse(attempt.questionAt)) && Number.isFinite(Date.parse(attempt.revealedAt)) &&
        Date.parse(attempt.revealedAt) >= Date.parse(attempt.questionAt)) {
      receipts.set(receiptKey(body.cardId, attempt.id, body.card.revision), {
        attemptId: attempt.id, revision: body.card.revision,
        questionAt: attempt.questionAt, revealedAt: attempt.revealedAt,
      });
    }
  };
  const request = async payload => {
    assertOwner();
    const requestGeneration = generation;
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), requestTimeout);
    try {
      const response = await fetchImpl(payload?.action === 'save' ? '/api/learning/vocabulary' : '/api/learning/fsrs', { method: payload ? 'POST' : 'GET',
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}) });
      assertOwner();
      if (requestGeneration !== generation) throw problem('fsrs_client_disposed');
      let body;
      try { body = await response.json(); }
      catch { throw problem('fsrs_invalid_response', { status: response.status }); }
      assertOwner();
      if (requestGeneration !== generation) throw problem('fsrs_client_disposed');
      if (!response.ok || body?.ok === false) throw problem(body?.code || 'fsrs_request_failed', { status: response.status });
      if (body?.version !== 1) throw problem('fsrs_invalid_response');
      if (payload?.action === 'save') {
        if (body.ok !== true || body.actorId !== accountId || body.operationId !== payload.operationId ||
            body.requestedCardId !== payload.cardId || typeof body.created !== 'boolean' ||
            typeof body.enrolled !== 'boolean' || typeof body.duplicate !== 'boolean' ||
            !body.vocabularyId || body.row?.id !== body.vocabularyId || body.row.user_id !== accountId ||
            body.state?.cardId !== body.vocabularyId || body.state.userId !== accountId ||
            body.state.enrolled !== body.enrolled ||
            (body.created && (!body.enrolled || body.vocabularyId !== payload.cardId)) ||
            (body.enrolled ? !Number.isSafeInteger(body.state.card?.revision) || body.state.card.revision < 0 : body.state.card !== null)) {
          throw problem('fsrs_invalid_response');
        }
      } else if (payload) {
        const minimumRevision = payload.expectedRevision + (['grade', 'undo'].includes(payload.action) ? 1 : 0);
        if (body.ok !== true || body.operationId !== payload.operationId || body.cardId !== payload.cardId ||
            !Number.isSafeInteger(body.card?.revision) || body.card.revision < minimumRevision ||
            (body.duplicate !== true && body.card.revision !== minimumRevision)) throw problem('fsrs_invalid_response');
      }
      return body;
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  };
  const online = async (action, payload) => {
    const normalized = normalizeFsrsRequest({ ...payload, action }, accountId);
    const response = await request(normalized);
    remember(response);
    return response;
  };
  // 신규 출제는 자동 flush 대상이 아니다. 명시적으로 연 문제의 원본만 재전송한다.
  const question = async payload => {
    assertOwner();
    const desired = normalizeFsrsRequest({ ...payload, action: 'question' }, accountId);
    if (!Number.isSafeInteger(desired.expectedPolicyRevision)) throw problem('fsrs_admission_unavailable');
    const original = normalizeFsrsRequest(await questionStore.prepare(desired), accountId);
    if (original.action !== 'question' || original.cardId !== desired.cardId || original.expectedRevision !== desired.expectedRevision) throw problem('fsrs_operation_id_conflict');
    assertOwner();
    let response;
    try {
      response = await request(original);
      normalizeAdmissionStatus(response.admission, { actorId: accountId });
      if (response.actorId !== accountId || !['question', 'revealed'].includes(response.attempt?.phase) ||
          response.attempt.eligible !== true || response.attempt.hintedAt !== null || !Number.isFinite(Date.parse(response.attempt.questionAt)) ||
          response.attempt.userId !== accountId || response.attempt.cardId !== original.cardId ||
          response.attempt.card?.revision !== response.card?.revision ||
          (original.attemptId !== undefined && response.attempt.id !== original.attemptId)) throw problem('fsrs_invalid_question_receipt');
    }
    catch (error) {
      assertOwner();
      if ([400, 403, 404, 409, 422].includes(error.status)) await questionStore.reject(original, error);
      throw error;
    }
    assertOwner();
    await questionStore.settle(original, response);
    assertOwner();
    remember(response);
    return response;
  };
  const confirmQuestion = async entry => {
    assertOwner();
    // 응답 유실 뒤 GET이 반환한 동일 시도는 노출 상태를 보존한 채 재개한다.
    const pending = await questionStore.pending(accountId);
    assertOwner();
    for (const row of pending) {
      if (row.request.cardId === entry.cardId && row.request.attemptId === entry.attempt?.id &&
          row.request.expectedRevision === entry.card?.revision && entry.attempt.userId === accountId) {
        await questionStore.settle(row.request, { source: 'authoritative-snapshot', entry });
        assertOwner();
      }
    }
  };
  const readPending = async options => {
    assertOwner();
    const entries = await outbox.list(accountId, options);
    assertOwner();
    // 기존 INSERT 후 enroll 의도는 보호한다. 원자적 save의 제안 ID는 등록 증거가 아니다.
    rememberFsrsEnrollments(accountId, entries.flatMap(entry => entry.payload?.action !== 'save' ? [entry]
      : entry.status === 'settled' && entry.response?.enrolled === true ? [entry.response.vocabularyId] : []));
    return entries;
  };

  const runFlush = async () => {
    const outcomes = [];
    do {
      rerun = false;
      assertOwner();
      const entries = await readPending();
      assertOwner();
      const held = new Set();
      for (const entry of entries) {
        assertOwner();
        if (held.has(entry.cardId)) continue;
        if (entry.status !== 'queued') {
          held.add(entry.cardId);
          outcomes.push(pendingResult(entry));
          continue;
        }
        let response;
        try {
          const payload = normalizeFsrsRequest(entry.payload, accountId);
          if (!['save', 'enroll', 'grade', 'undo'].includes(payload.action) || payload.cardId !== entry.cardId ||
              payload.operationId !== entry.operationId) throw problem('fsrs_invalid_queue_entry', { status: 400 });
          if (payload.action === 'grade' && (!entry.receipt || entry.receipt.attemptId !== payload.attemptId ||
              entry.receipt.revision !== payload.expectedRevision)) {
            throw problem('fsrs_online_attempt_required', { status: 409 });
          }
          response = await request(payload);
        } catch (error) {
          assertOwner();
          held.add(entry.cardId);
          const status = fsrsFailureStatus(error);
          // 상태 저장이 실패해도 이전 원본은 그대로다. 다음 전송은 동일한 ID로만 재시도한다.
          try {
            const saved = await outbox.mark(entry, { status, blockReason: error.code || 'fsrs_network_error' });
            const result = pendingResult(saved);
            outcomes.push(result);
            emit({ type: 'change', ...result });
          } catch (storageError) {
            outcomes.push({ queued: true, operationId: entry.operationId, status: 'pending', blockReason: 'fsrs_receipt_write_failed' });
            emit({ type: 'error', operationId: entry.operationId, error: storageError });
          }
          continue;
        }
        assertOwner();
        let saved;
        try { saved = await outbox.mark(entry, { status: 'settled', response }); }
        catch (error) {
          held.add(entry.cardId);
          outcomes.push({ queued: true, operationId: entry.operationId, status: 'pending', blockReason: 'fsrs_receipt_write_failed' });
          emit({ type: 'error', operationId: entry.operationId, error });
          continue;
        }
        if (saved.response?.enrolled === true) rememberFsrsEnrollments(accountId, [saved.response.vocabularyId]);
        const result = pendingResult(saved);
        outcomes.push(result);
        emit({ type: 'change', ...result });
      }
    } while (rerun);
    return outcomes;
  };
  const flush = () => {
    if (flushing) return flushing;
    flushing = runFlush().finally(() => {
      flushing = null;
      if (rerun && !disposed && getAccountId() === accountId) queueMicrotask(startFlush);
    });
    return flushing;
  };
  const startFlush = () => { flush().catch(error => emit({ type: 'error', error })); };
  /** 단어 INSERT를 따로 실행하지 않는다. 저장과 등록을 묶은 서버 명령 하나만 보낸다. */
  const save = async payload => {
    assertOwner();
    const normalized = normalizeFsrsRequest({ ...payload, action: 'save' }, accountId);
    const entry = await outbox.append({ accountId, payload: normalized });
    assertOwner();
    emit({ type: 'change', ...pendingResult(entry) });
    rerun = true;
    await flush();
    const persisted = (await readPending({ includeSettled: true })).find(row => row.operationId === normalized.operationId);
    if (!persisted) throw problem('fsrs_outbox_identity_conflict');
    return persisted.status === 'settled' ? persisted.response : { ...pendingResult(persisted),
      cardId: normalized.cardId, vocabulary: normalized.vocabulary };
  };

  return {
    start() {
      if (started) return;
      disposed = false;
      started = true;
      eventTarget?.addEventListener('online', startFlush);
      eventTarget?.addEventListener('focus', startFlush);
      // 이미 온라인인 페이지 재진입에는 online/focus 이벤트가 오지 않을 수 있다.
      const startupGeneration = generation;
      queueMicrotask(() => {
        if (started && !disposed && startupGeneration === generation &&
            typeof accountId === 'string' && accountId && getAccountId() === accountId) startFlush();
      });
    },
    async load() {
      await readPending();
      const body = await request();
      if (typeof body.enabled !== 'boolean' || !Array.isArray(body.cards) || body.registryAvailable !== true) {
        throw problem('fsrs_invalid_response');
      }
      if (body.actorId !== accountId) throw problem('fsrs_account_changed');
      rememberFsrsEnrollments(accountId, body.cards);
      body.cards.forEach(remember);
      return body;
    },
    /** 확인된 신규 단어 INSERT 전용. 등록 의도를 먼저 보존하고 실패 시 구형 채점으로 돌아가지 않는다. */
    async enroll(payload) {
      assertOwner();
      const normalized = normalizeFsrsRequest({ ...payload, action: 'enroll' }, accountId);
      rememberFsrsEnrollments(accountId, [normalized.cardId]);
      const entry = await outbox.append({ accountId, payload: normalized });
      assertOwner();
      emit({ type: 'change', ...pendingResult(entry) });
      rerun = true;
      await flush();
      const settled = (await readPending({ includeSettled: true })).find(row => row.operationId === normalized.operationId);
      if (!settled) throw problem('fsrs_outbox_identity_conflict');
      return settled.status === 'settled' ? settled.response : { ...pendingResult(settled), cardId: normalized.cardId };
    },
    save,
    async retrySave(operationId) {
      const entry = (await readPending({ includeSettled: true })).find(row => row.operationId === operationId && row.payload.action === 'save');
      if (!entry) throw problem('fsrs_save_not_found');
      if (entry.status === 'blocked' && /(?:excluded|known)/.test(entry.blockReason || '')) {
        await outbox.mark(entry, { status: 'queued' });
        assertOwner();
      }
      return save(entry.payload);
    },
    question, confirmQuestion,
    reveal: payload => online('reveal', payload),
    abandon: payload => online('abandon', payload),
    async submit(payload) {
      assertOwner();
      const normalized = normalizeFsrsRequest(payload, accountId);
      if (!['grade', 'undo'].includes(normalized.action)) throw problem('fsrs_not_queueable');
      const receipt = normalized.action === 'grade'
        ? receipts.get(receiptKey(normalized.cardId, normalized.attemptId, normalized.expectedRevision)) : null;
      const entry = await outbox.append({ accountId, payload: normalized, receipt,
        blockReason: normalized.action === 'grade' && !receipt ? 'fsrs_online_attempt_required' : null });
      assertOwner();
      const result = pendingResult(entry);
      emit({ type: 'change', ...result });
      rerun = true;
      startFlush();
      return result;
    },
    async pending() {
      return readPending();
    },
    flush,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() {
      disposed = true;
      started = false;
      generation++;
      controllers.forEach(controller => controller.abort());
      listeners.clear();
      receipts.clear();
      eventTarget?.removeEventListener('online', startFlush);
      eventTarget?.removeEventListener('focus', startFlush);
    },
  };
}
