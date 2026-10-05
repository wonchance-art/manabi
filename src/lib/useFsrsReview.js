'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createFsrsLearningClient } from './fsrsLearningClient';
import { previewFsrsRatings, validateFsrsCard } from './fsrsScheduler';
import { fsrsQueueState } from './fsrsReviewSession';
import { normalizeFsrsSaveRequest } from './fsrsOperationOutbox';
import { normalizeAdmissionStatus } from './learningAdmission';

const clone = value => JSON.parse(JSON.stringify(value));
const uuid = () => globalThis.crypto.randomUUID();
const settled = status => status === 'applied' || status === 'replayed';

export function canAutoStartFsrsReview(state) {
  return !state.current && !state.busy && state.ready.length > 0 &&
    (!state.error || state.error.message === 'fsrs_sync_blocked');
}

export function isNewFsrsManualInsert(row, accountId) {
  return !!row && row.user_id === accountId && typeof row.id === 'string' && !!row.id &&
    row.interval === 0 && row.repetitions === 0 && row.last_reviewed_at === null &&
    !row.is_excluded && !row.is_known;
}

export function fsrsIntervalLabel(due, at) {
  const seconds = Math.max(0, Math.round((Date.parse(due) - Date.parse(at)) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m${seconds % 60 ? `${seconds % 60}s` : ''}`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/** DB 상태만 문제의 기준으로 삼는다. 대기 중인 연산은 재출제나 옛 채점 경로로 보내지 않는다. */
export function createFsrsReviewController({ accountId, client, now = Date.now, makeId = uuid,
  setTimer = setTimeout, clearTimer = clearTimeout, eventTarget = globalThis.window,
  visibilityTarget = globalThis.document, onApplied = () => {}, onAdmission = () => {} }) {
  let disposed = false, started = false, timer = null, offset = 0, words = [], allowedIds = null;
  let generation = 0, readGeneration = 0, locked = false, refreshPromise = null;
  const listeners = new Set(), enrollments = new Map(), saves = new Map(), appliedOperations = new Set();
  let state = { status: accountId ? 'loading' : 'ready', registryAvailable: !accountId,
    enabled: false, cards: [], enrolledIds: [], pending: [], ready: [], nextWakeAt: null,
    current: null, busy: false, error: null, lastGrade: null, completed: 0, firstQuestionsToday: 0, enrollmentFailures: [],
    pendingSaves: [], saveFailures: [], admission: null };
  const publish = patch => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const visibleWord = cardId => words.find(word => word.id === cardId && !word.is_excluded && !word.is_known
    && (!allowedIds || allowedIds.has(cardId)));
  const pendingPatch = entries => {
    const pending = entries || [], pendingSaves = pending.filter(entry => entry.payload?.action === 'save');
    return { pending, pendingSaves,
      saveFailures: pendingSaves.filter(entry => ['blocked', 'conflict', 'stale'].includes(entry.status)) };
  };
  const pendingEnrolledIds = entries => (entries || []).filter(entry => entry.payload?.action !== 'save').map(entry => entry.cardId);
  const notifyApplied = event => {
    if (disposed || (event?.accountId && event.accountId !== accountId) ||
        (event?.response?.actorId && event.response.actorId !== accountId)) return;
    if (event?.operationId && appliedOperations.has(event.operationId)) return;
    if (event?.operationId) appliedOperations.add(event.operationId);
    onApplied(accountId, event);
  };
  const queue = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    const pendingIds = new Set(state.pending.map(row => row.cardId));
    const entries = state.enabled && state.registryAvailable ? state.cards.filter(entry =>
      visibleWord(entry.cardId) && entry.eligible !== false && !entry.known && !entry.excluded && !pendingIds.has(entry.cardId)
      && (entry.card.state !== 'New' || entry.firstQuestionAt || (state.admission?.active && state.admission.remaining > 0))
    ).map(entry => ({ ...entry, id: entry.cardId, userId: accountId })) : [];
    const time = now() + offset;
    const cooldowns = entries.map(entry => Date.parse(entry.nextQuestionAt)).filter(value => value > time);
    const next = fsrsQueueState(entries.filter(entry => !entry.nextQuestionAt || Date.parse(entry.nextQuestionAt) <= time), accountId, time);
    if (cooldowns.length) {
      const wake = Math.min(...cooldowns, next.nextWakeAt ? Date.parse(next.nextWakeAt) : Infinity);
      next.nextWakeAt = new Date(wake).toISOString();
    }
    // 로딩 중 query의 기본 []와 scope 배열은 매 렌더 새 객체일 수 있다.
    // 같은 큐를 다시 알리면 effect→외부 store→렌더가 반복되므로 실제 출제 상태만 발행한다.
    const unchanged = state.nextWakeAt === next.nextWakeAt && state.ready.length === next.ready.length &&
      state.ready.every((entry, index) => entry.cardId === next.ready[index].cardId &&
        entry.card === next.ready[index].card && entry.attempt === next.ready[index].attempt &&
        entry.nextQuestionAt === next.ready[index].nextQuestionAt);
    if (!unchanged) publish({ ready: next.ready, nextWakeAt: next.nextWakeAt });
    if (next.nextWakeAt) timer = setTimer(() => {
      // 브라우저 시계만 믿고 출제하지 않는다. 만기 때 서버의 소유권·제외 상태를 다시 읽는다.
      refresh().catch(() => {});
    }, Math.min(2147483647, Math.max(1, Date.parse(next.nextWakeAt) - now() - offset)));
  };
  const adopt = response => {
    if (!response?.cardId || !response.card) return;
    validateFsrsCard(response.card);
    const old = state.cards.find(row => row.cardId === response.cardId);
    if (old && old.card.revision > response.card.revision) return;
    readGeneration++; refreshPromise = null;
    const entry = { ...old, cardId: response.cardId, card: clone(response.card), attempt: response.attempt || null,
      ...(response.nextQuestionAt !== undefined ? { nextQuestionAt: response.nextQuestionAt } : {}) };
    publish({ cards: [...state.cards.filter(row => row.cardId !== response.cardId), entry],
      enrolledIds: [...new Set([...state.enrolledIds, response.cardId])] });
  };
  async function refresh() {
    if (disposed || !accountId) return false;
    if (refreshPromise) return refreshPromise;
    const token = generation, readToken = ++readGeneration;
    refreshPromise = (async () => {
      let pending;
      try {
        const snapshot = await client.load();
        pending = await client.pending();
        if (disposed || token !== generation || readToken !== readGeneration) return false;
        if (snapshot?.version !== 1 || snapshot.registryAvailable !== true || !Array.isArray(snapshot.cards)) {
          throw new Error('fsrs_registry_unavailable');
        }
        if (Number.isFinite(Date.parse(snapshot.now))) offset = Date.parse(snapshot.now) - now();
        const admission = snapshot.admission || snapshot.enabled
          ? normalizeAdmissionStatus(snapshot.admission, { actorId: accountId }) : null;
        const cards = snapshot.cards.map(entry => {
          validateFsrsCard(entry.card);
          const newer = state.cards.find(row => row.cardId === entry.cardId && row.card.revision > entry.card.revision);
          return clone(newer || entry);
        });
        // 성공한 목록에서 빠져도 한 번 등록된 ID는 이 계정 세션 동안 legacy로 되돌리지 않는다.
        publish({ cards, ...pendingPatch(pending), enrolledIds: [...new Set([...state.enrolledIds, ...cards.map(row => row.cardId), ...pendingEnrolledIds(pending)])],
          admission, firstQuestionsToday: admission?.active ? admission.used : snapshot.firstQuestionsToday ?? 0,
          enabled: snapshot.enabled === true, registryAvailable: true, status: 'ready',
          error: pending?.some(row => ['blocked', 'conflict', 'stale'].includes(row.status)) ? new Error('fsrs_sync_blocked') : null });
        const current = state.current;
        if (current && (!visibleWord(current.cardId) || !snapshot.enabled ||
          !cards.some(row => row.cardId === current.cardId && row.card.revision === current.card.revision &&
            (!current.attempt || row.attempt?.id === current.attempt.id) && row.eligible !== false && !row.known && !row.excluded))) {
          publish({ current: null });
        }
        queue();
        return true;
      } catch (error) {
        if (!pending && !disposed && token === generation && readToken === readGeneration) {
          try { pending = await client.pending(); } catch { /* 기존 의도/오류 상태를 빈 큐로 덮지 않는다. */ }
        }
        if (!disposed && token === generation && readToken === readGeneration) {
          publish({ registryAvailable: false, status: 'error', error,
            ...(pending ? { ...pendingPatch(pending), enrolledIds: [...new Set([...state.enrolledIds, ...pendingEnrolledIds(pending)])] } : {}) });
          queue();
        }
        return false;
      } finally { if (token === generation && readToken === readGeneration) refreshPromise = null; }
    })();
    return refreshPromise;
  }
  const run = async work => {
    if (disposed || locked) return false;
    locked = true;
    const token = generation;
    publish({ busy: true, error: null });
    try { return await work(token); }
    catch (error) { if (token === generation) publish({ error }); return false; }
    finally { if (token === generation) { locked = false; publish({ busy: false }); } }
  };
  const basePayload = (action, card, extra = {}) => ({ action, accountId, cardId: card.cardId,
    expectedRevision: card.card.revision, operationId: makeId(), ...extra });
  const refreshAfterSettlement = async () => {
    // 저장 전에 시작한 GET을 저장 후의 완전한 목록으로 간주하지 않는다.
    if (refreshPromise) await refreshPromise;
    return refresh();
  };
  const completeSave = async (response, token) => {
    if (disposed || token !== generation) throw new Error('fsrs_account_changed');
    if (response?.ok === true) {
      if (response.actorId !== accountId) throw new Error('fsrs_account_changed');
      if (response.enrolled) adopt(response.state);
      notifyApplied({ action: 'save', accountId, operationId: response.operationId, response });
      await refreshAfterSettlement();
      if (disposed || token !== generation) throw new Error('fsrs_account_changed');
      return response;
    }
    if (response?.queued !== true) throw new Error('fsrs_not_durably_accepted');
    const pending = await client.pending();
    if (disposed || token !== generation) throw new Error('fsrs_account_changed');
    publish({ ...pendingPatch(pending), enrolledIds: [...new Set([...state.enrolledIds, ...pendingEnrolledIds(pending)])] });
    queue();
    return response;
  };
  async function saveVocabulary(vocabulary) {
    if (disposed || !accountId || !state.registryAvailable || !state.enabled) throw new Error('fsrs_storage_unavailable');
    const token = generation;
    const proposed = normalizeFsrsSaveRequest({ action: 'save', accountId, operationId: makeId(), cardId: makeId(), vocabulary }, accountId);
    const key = JSON.stringify(proposed.vocabulary);
    const pending = await client.pending();
    if (disposed || token !== generation) throw new Error('fsrs_account_changed');
    const existing = pending.find(entry => entry.payload?.action === 'save' && JSON.stringify(entry.payload.vocabulary) === key);
    if (existing) saves.set(key, existing.payload);
    if (!saves.has(key)) saves.set(key, proposed);
    const response = await client.save(saves.get(key));
    const result = await completeSave(response, token);
    if (result?.ok) saves.delete(key);
    return result;
  }
  async function retrySave(operationId) {
    if (disposed || !accountId) throw new Error('fsrs_account_changed');
    const token = generation;
    return completeSave(await client.retrySave(operationId), token);
  }
  async function enrollInserted(row) {
    if (disposed || !isNewFsrsManualInsert(row, accountId)) return { enrolled: false, skipped: true };
    const token = generation;
    // INSERT의 반환 행만 이 함수에 들어온다. 중복 upsert/목록 조회로 등록 후보를 만들지 않는다.
    if (!enrollments.has(row.id)) {
      if (!state.registryAvailable || !state.enabled) return { enrolled: false, skipped: true };
      enrollments.set(row.id, { action: 'enroll', accountId, cardId: row.id, expectedRevision: 0,
        operationId: `fsrs-enroll:${accountId}:${row.id}` });
    }
    publish({ enrolledIds: [...new Set([...state.enrolledIds, row.id])] });
    try {
      if (!(await refresh()) || disposed || token !== generation || !state.enabled) throw new Error('fsrs_storage_unavailable');
      const existing = state.cards.find(entry => entry.cardId === row.id);
      if (!existing) {
        const response = await client.enroll(enrollments.get(row.id));
        if (disposed || token !== generation) return { enrolled: false, stale: true };
        if (response?.ok !== true) throw new Error('fsrs_enrollment_pending');
        adopt(response);
      }
      if (!(await refresh()) || disposed || token !== generation) throw new Error('fsrs_registry_unavailable');
      if (!state.cards.some(entry => entry.cardId === row.id)) throw new Error('fsrs_enrollment_pending');
      enrollments.delete(row.id);
      publish({ enrollmentFailures: state.enrollmentFailures.filter(entry => entry.id !== row.id) });
      return { enrolled: true };
    } catch (error) {
      if (!disposed && token === generation) publish({ enrollmentFailures: [...state.enrollmentFailures.filter(entry => entry.id !== row.id), clone(row)] });
      return { enrolled: false, error };
    }
  }
  async function question() {
    return run(async token => {
      if (!(await refresh()) || disposed || token !== generation || !state.enabled) return false;
      const entry = state.ready[0];
      if (!entry) return false;
      const current = { cardId: entry.cardId, card: clone(entry.card), word: visibleWord(entry.cardId),
        attempt: null, phase: 'question', previews: null, previewAt: null };
      if (state.lastGrade?.payload.cardId === entry.cardId) publish({ lastGrade: null });
      if (entry.attempt && ['question', 'revealed'].includes(entry.attempt.phase)) {
        if (entry.attempt.card?.revision !== entry.card.revision || entry.attempt.userId !== accountId ||
          entry.attempt.cardId !== entry.cardId || entry.attempt.eligible !== true) throw new Error('invalid_attempt_receipt');
        await client.confirmQuestion?.(entry);
        if (disposed || token !== generation || !visibleWord(entry.cardId)) return false;
        const at = entry.attempt.revealedAt;
        publish({ current: { ...current, attempt: clone(entry.attempt), phase: entry.attempt.phase,
          previews: at ? Object.fromEntries(Object.entries(previewFsrsRatings(entry.card, at))
            .map(([rating, result]) => [rating, { due: result.card.due }])) : null, previewAt: at } });
        return true;
      }
      // 문제를 실제로 열 때만 question을 보낸다. 목록·읽기·저장에서는 호출하지 않는다.
      if (!state.admission?.installed) throw new Error('fsrs_admission_unavailable');
      const response = await client.question(basePayload('question', current, { attemptId: makeId(), answerVisible: false,
        dailyNewLimit: state.admission.limit, expectedPolicyRevision: state.admission.policyRevision }));
      if (disposed || token !== generation || !visibleWord(entry.cardId)) return false;
      if (!response?.attempt || response.attempt.phase !== 'question') throw new Error('invalid_question_receipt');
      const admission = normalizeAdmissionStatus(response.admission, { actorId: accountId });
      adopt(response);
      publish({ admission, firstQuestionsToday: admission.used });
      onAdmission(admission);
      if (entry.card.state === 'New' && !entry.firstQuestionAt) {
        publish({ cards: state.cards.map(row => row.cardId === entry.cardId
            ? { ...row, firstQuestionAt: response.attempt.questionAt } : row) });
      }
      publish({ current: { ...current, card: clone(response.card), attempt: clone(response.attempt) } });
      return true;
    });
  }
  async function reveal() {
    return run(async token => {
      const current = state.current;
      if (!state.enabled || !state.registryAvailable || !current?.attempt || current.phase !== 'question' || !visibleWord(current.cardId)) return false;
      if (!(await refresh()) || disposed || token !== generation || !state.enabled) return false;
      const persisted = state.cards.find(entry => entry.cardId === current.cardId);
      if (persisted?.attempt?.id !== current.attempt.id) throw new Error('review_revision_conflict');
      const response = persisted.attempt.phase === 'revealed'
        ? { ...persisted, now: persisted.attempt.revealedAt }
        : await client.reveal(basePayload('reveal', current, { attemptId: current.attempt.id, hint: false }));
      if (disposed || token !== generation || !visibleWord(current.cardId)) return false;
      if (response?.attempt?.phase !== 'revealed' || response.attempt.eligible !== true) throw new Error('invalid_reveal_receipt');
      validateFsrsCard(response.card);
      const at = response.now || response.attempt.revealedAt;
      const previews = response.previews || Object.fromEntries(Object.entries(previewFsrsRatings(response.card, at))
        .map(([rating, result]) => [rating, { due: result.card.due }]));
      adopt(response);
      publish({ current: { ...current, card: clone(response.card), attempt: clone(response.attempt),
        phase: 'revealed', previews, previewAt: at } });
      return true;
    });
  }
  async function grade(rating) {
    return run(async token => {
      const current = state.current;
      if (![1, 2, 3, 4].includes(rating) || !state.enabled || !state.registryAvailable ||
        current?.phase !== 'revealed' || !visibleWord(current.cardId)) return false;
      if (current.pendingPayload && current.pendingPayload.rating !== rating) return false;
      const payload = current.pendingPayload || basePayload('grade', current, { attemptId: current.attempt.id, rating });
      publish({ current: { ...current, pendingPayload: payload } });
      const result = await client.submit(payload);
      if (disposed || token !== generation) return false;
      if (result?.queued !== true) throw new Error('fsrs_not_durably_accepted');
      if (!['pending', 'applied', 'replayed'].includes(result.status)) {
        publish({ pending: await client.pending() });
        queue();
        throw new Error('fsrs_sync_blocked');
      }
      // 영속 저장된 평가만 전진한다. 응답 대기 카드는 같은 판본으로 다시 출제하지 않는다.
      if (result.response && settled(result.status)) adopt(result.response);
      const pending = await client.pending();
      if (disposed || token !== generation) return false;
      publish({ current: null, completed: state.completed + 1,
        lastGrade: { payload, response: result.response || null },
        pending: settled(result.status) || state.cards.some(entry => entry.cardId === payload.cardId && entry.card.revision > payload.expectedRevision) ? pending : [...pending.filter(row => row.operationId !== payload.operationId),
          { operationId: payload.operationId, cardId: current.cardId, payload, status: result.status }] });
      queue();
      if (settled(result.status)) notifyApplied({ ...result, action: 'grade', accountId });
      return true;
    });
  }
  async function undo() {
    return run(async token => {
      const last = state.lastGrade;
      if (!last || !state.registryAvailable || !state.enabled || !visibleWord(last.payload.cardId)) return false;
      const payload = last.undoPayload || { action: 'undo', accountId, operationId: makeId(),
        cardId: last.payload.cardId, expectedRevision: last.payload.expectedRevision + 1,
        targetOperationId: last.payload.operationId };
      publish({ lastGrade: { ...last, undoPayload: payload } });
      const result = await client.submit(payload);
      if (disposed || token !== generation) return false;
      if (result?.queued !== true) throw new Error('fsrs_undo_not_durably_accepted');
      if (!['pending', 'applied', 'replayed'].includes(result.status)) {
        publish({ pending: await client.pending() });
        queue();
        throw new Error('fsrs_sync_blocked');
      }
      if (result.response && settled(result.status)) adopt(result.response);
      const pending = await client.pending();
      if (disposed || token !== generation) return false;
      publish({ current: null, pending, lastGrade: null, completed: Math.max(0, state.completed - 1) });
      queue();
      if (settled(result.status)) notifyApplied({ ...result, action: 'undo', accountId });
      return true;
    });
  }
  const onFocus = () => { if (!disposed) refresh().catch(() => {}); };
  const onVisible = () => { if (visibilityTarget?.visibilityState !== 'hidden') onFocus(); };
  let unsubscribe;
  const onClientChange = event => {
    if (disposed || event.type !== 'change' || (event.accountId && event.accountId !== accountId) ||
        (event.response?.actorId && event.response.actorId !== accountId)) return;
    if (settled(event.status)) {
      if (event.action === 'save') { if (event.response?.enrolled) adopt(event.response.state); }
      else adopt(event.response);
      notifyApplied(event);
    }
    if (!locked) (settled(event.status) ? refreshAfterSettlement() : refresh()).catch(() => {});
  };
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    start() {
      if (started) return;
      disposed = false; started = true;
      client.start?.();
      unsubscribe = client.subscribe?.(onClientChange);
      eventTarget?.addEventListener('focus', onFocus);
      visibilityTarget?.addEventListener('visibilitychange', onVisible);
    },
    setWords(nextWords, scopeIds = null) {
      words = nextWords || []; allowedIds = scopeIds ? new Set(scopeIds) : null;
      if (state.current && !visibleWord(state.current.cardId)) publish({ current: null });
      queue();
    },
    // 활성 한도는 서버 admission 정책만 따른다. 로컬 설정 변경으로 슬롯을 늘리지 않는다.
    setDailyNewLimit() { queue(); },
    canLegacy(cardId) { return state.registryAvailable && !state.enrolledIds.includes(cardId) && !state.pending.some(entry => entry.cardId === cardId); },
    refresh, question, reveal, grade, undo, enrollInserted, saveVocabulary, retrySave,
    async retrySync() { try { await client.flush(); } catch (error) { publish({ error }); } return refresh(); },
    leave() { if (!locked) publish({ current: null }); },
    dispose() {
      disposed = true; started = false; generation++; locked = false; refreshPromise = null;
      if (timer !== null) clearTimer(timer);
      unsubscribe?.(); client.dispose?.(); listeners.clear();
      eventTarget?.removeEventListener('focus', onFocus);
      visibilityTarget?.removeEventListener('visibilitychange', onVisible);
    },
  };
}

export function useFsrsReview({ accountId, words, scopeIds, dailyNewLimit, onApplied, onAdmission }) {
  const accountRef = useRef(accountId), appliedRef = useRef(onApplied), admissionRef = useRef(onAdmission);
  accountRef.current = accountId; appliedRef.current = onApplied; admissionRef.current = onAdmission;
  const controller = useMemo(() => createFsrsReviewController({ accountId,
    client: createFsrsLearningClient({ accountId, getAccountId: () => accountRef.current }),
    onAdmission: quota => { if (accountId === accountRef.current) admissionRef.current?.(quota); },
    onApplied: (actorId, event) => { if (actorId === accountRef.current) appliedRef.current?.(actorId, event); },
  }), [accountId]);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.setWords(words, scopeIds); }, [controller, words, scopeIds]);
  useEffect(() => { controller.setDailyNewLimit(dailyNewLimit); }, [controller, dailyNewLimit]);
  useEffect(() => {
    controller.start();
    controller.refresh();
    return () => controller.dispose();
  }, [controller]);
  return { ...state, controller };
}
