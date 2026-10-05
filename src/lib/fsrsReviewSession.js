/** 새 FSRS의 문제 노출·회상·보상 경계를 검증하는 순수 상태 전이. DB 권한 검증을 대체하지 않는다. */
import { scheduleFsrsReview, schedulerTime, validateFsrsCard } from './fsrsScheduler.js';

const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const copy = value => JSON.parse(JSON.stringify(value));
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const stateKey = value => JSON.stringify(ordered(value));

// 저장·전송된 snapshot은 begin을 통과했다는 전제만으로 신뢰하지 않는다.
function validateAttempt(attempt) {
  if (!attempt || ![attempt.id, attempt.userId, attempt.cardId].every(identity)) throw new Error('invalid_attempt_identity');
  validateFsrsCard(attempt.card);
  if (typeof attempt.eligible !== 'boolean' || !['question', 'revealed'].includes(attempt.phase)) throw new Error('invalid_attempt_state');
  const question = schedulerTime(attempt.questionAt);
  if (question < schedulerTime(attempt.card.due)) throw new Error('fsrs_card_not_due');
  if (attempt.phase === 'question') {
    if (attempt.revealedAt !== null || attempt.hintedAt !== null) throw new Error('invalid_attempt_state');
  } else {
    const revealed = schedulerTime(attempt.revealedAt);
    if (revealed < question) throw new Error('attempt_clock_reversed');
    if (attempt.hintedAt !== null) {
      const hinted = schedulerTime(attempt.hintedAt);
      if (attempt.eligible || hinted < question || hinted > revealed) throw new Error('invalid_attempt_state');
    }
  }
  return attempt;
}

export function beginFsrsAttempt(card, { id, userId, cardId, at, answerVisible = false }) {
  validateFsrsCard(card);
  if (![id, userId, cardId].every(identity)) throw new Error('invalid_attempt_identity');
  if (typeof answerVisible !== 'boolean') throw new Error('invalid_attempt_state');
  return validateAttempt({ id, userId, cardId, card: copy(card), phase: 'question', eligible: !answerVisible,
    questionAt: new Date(schedulerTime(at)).toISOString(), revealedAt: null, hintedAt: null });
}

export function revealFsrsAttempt(attempt, at, { hint = false } = {}) {
  if (attempt?.phase !== 'question') throw new Error('invalid_attempt_phase');
  validateAttempt(attempt);
  if (typeof hint !== 'boolean') throw new Error('invalid_attempt_state');
  if (schedulerTime(at) < schedulerTime(attempt.questionAt)) throw new Error('attempt_clock_reversed');
  return validateAttempt({ ...copy(attempt), phase: 'revealed', revealedAt: new Date(schedulerTime(at)).toISOString(),
    eligible: attempt.eligible && !hint, hintedAt: hint ? new Date(schedulerTime(at)).toISOString() : null });
}

export function finishFsrsAttempt(attempt, rating, { operationId, at }) {
  if (attempt?.phase !== 'revealed') throw new Error('answer_not_revealed');
  validateAttempt(attempt);
  if (attempt.eligible !== true || attempt.hintedAt !== null) throw new Error('recall_not_eligible');
  if (!identity(operationId)) throw new Error('invalid_operation_id');
  if (schedulerTime(at) < schedulerTime(attempt.revealedAt)) throw new Error('attempt_clock_reversed');
  const result = scheduleFsrsReview(attempt.card, rating, at);
  return { version: 1, id: operationId, kind: 'grade', userId: attempt.userId, cardId: attempt.cardId,
    attemptId: attempt.id, expectedRevision: attempt.card.revision,
    previousCard: copy(attempt.card), nextCard: result.card,
    log: { ...result.log, questionAt: attempt.questionAt, revealedAt: attempt.revealedAt,
      optimizerEligible: true, rewardEligible: true } };
}

/** 전송 중에도 취소는 새 연산이다. 성공했던 과거 상태로 돌려도 revision은 계속 증가한다. */
export function planFsrsUndo(operation, currentCard, { operationId, userId, cardId, at }) {
  validateFsrsCard(currentCard);
  if (![operationId, userId, cardId, operation?.id, operation?.attemptId].every(identity) ||
      operationId === operation?.id || operation?.version !== 1 || operation?.kind !== 'grade' ||
      userId !== operation.userId || cardId !== operation.cardId) throw new Error('invalid_undo_identity');
  validateFsrsCard(operation.previousCard);
  validateFsrsCard(operation.nextCard);
  if (currentCard.revision !== operation.nextCard.revision ||
      currentCard.revision !== operation.expectedRevision + 1 ||
      operation.previousCard.revision !== operation.expectedRevision ||
      stateKey(currentCard) !== stateKey(operation.nextCard)) throw new Error('review_revision_conflict');
  // 원연산은 서버에 보관된 것을 전달한다. 그 안에서도 질문·평가·결과의 일관성을
  // 다시 계산해 확인하고, 손상된 previousCard를 임의의 복원 대상으로 삼지 않는다.
  const log = operation.log;
  if (!log || log.reviewedAt !== operation.nextCard.lastReview) throw new Error('invalid_grade_snapshot');
  const replay = finishFsrsAttempt({ id: operation.attemptId, userId, cardId,
    card: operation.previousCard, phase: 'revealed', eligible: true, hintedAt: null,
    questionAt: log.questionAt, revealedAt: log.revealedAt,
  }, log.rating, { operationId: operation.id, at: log.reviewedAt });
  if (stateKey(replay.nextCard) !== stateKey(operation.nextCard) ||
      Object.keys(replay.log).some(key => stateKey(replay.log[key]) !== stateKey(log[key]))) throw new Error('invalid_grade_snapshot');
  if (schedulerTime(at) < schedulerTime(operation.log.reviewedAt)) throw new Error('attempt_clock_reversed');
  const nextCard = validateFsrsCard({ ...copy(operation.previousCard), revision: currentCard.revision + 1 });
  return { version: 1, id: operationId, kind: 'undo', userId, cardId, undoneOperationId: operation.id,
    expectedRevision: currentCard.revision, previousCard: copy(currentCard), nextCard,
    log: { reviewedAt: new Date(schedulerTime(at)).toISOString(), optimizerEligible: false, rewardEligible: false,
      applied: { due: nextCard.due, state: nextCard.state, step: nextCard.step, revision: nextCard.revision } } };
}

/** 개인 복습 전용. 호출 시마다 소유자·known/제외·실제 due를 다시 확인한다. */
export function fsrsQueueState(entries, userId, at) {
  const now = schedulerTime(at), ready = [], waiting = [], invalid = [];
  if (!identity(userId)) return { ready, nextWakeAt: null, invalid };
  if (entries != null && !Array.isArray(entries)) throw new Error('invalid_fsrs_queue');
  for (const entry of entries || []) {
    try {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('invalid_fsrs_entry');
      if (entry.userId !== userId || entry.known || entry.excluded) continue;
      if (!identity(entry.id)) throw new Error('invalid_fsrs_entry');
      validateFsrsCard(entry.card);
      // 힌트/노출 후 재질문 대기는 큐 metadata다. 카드 기억·일정은 바꾸지 않는다.
      const due = Math.max(schedulerTime(entry.card.due), entry.nextQuestionAt == null ? -Infinity : schedulerTime(entry.nextQuestionAt));
      if (due <= now) ready.push({ entry, due });
      else waiting.push(due);
    } catch { invalid.push(identity(entry?.id) ? entry.id : null); }
  }
  ready.sort((a, b) => a.due - b.due || a.entry.id.localeCompare(b.entry.id));
  return { ready: ready.map(item => item.entry), nextWakeAt: waiting.length ? new Date(waiting.reduce((a, b) => Math.min(a, b))).toISOString() : null, invalid };
}

/** 화면이 닫혀 있던 동안의 만기와 계정/제외 변경도 복귀 시 새 입력으로 다시 계산한다. */
export function watchFsrsQueue({ readEntries, readUserId, onChange, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout, eventTarget = globalThis.window,
  visibilityTarget = globalThis.document }) {
  let timer = null, stopped = false;
  const refresh = () => {
    if (stopped) return;
    if (timer !== null) clearTimer(timer);
    timer = null;
    const time = schedulerTime(now()), state = fsrsQueueState(readEntries(), readUserId(), time);
    if (state.nextWakeAt) timer = setTimer(refresh, Math.min(2147483647, Math.max(1, schedulerTime(state.nextWakeAt) - time)));
    onChange(state);
  };
  const visible = () => { if (visibilityTarget?.visibilityState !== 'hidden') refresh(); };
  const stop = () => {
    stopped = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
    eventTarget?.removeEventListener('focus', refresh);
    visibilityTarget?.removeEventListener('visibilitychange', visible);
  };
  try {
    eventTarget?.addEventListener('focus', refresh);
    visibilityTarget?.addEventListener('visibilitychange', visible);
    refresh();
  } catch (error) {
    stop();
    throw error;
  }
  return { refresh, stop };
}
