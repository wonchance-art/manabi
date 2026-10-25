// 복습 줄 만들기 · 세션 진행(REV-SCOPE-R1B-1 — 오너 승인 3판 D10 · D11, 설계 §6-1 ③).
//
// 순수 모듈. countReviewScope(개수)와 복습방(시작 · 진행)이 같은 함수를 쓴다 — 보이는 개수 = 시작하는 줄 길이.
// - 두 엔진(FSRS · 예전 일정)을 한 줄로 만든다. 채점은 카드마다 원래 엔진으로 저장한다(화면의 몫).
// - 순서: 기한 지난 복습은 지금 기억 확률이 낮은 순(두 엔진 모두 snapshot 기억 모델 — forecast.js와 같은 방식).
//   새 일정의 학습 · 재학습 단계 카드(분 단위 단계가 끝난 것)는 맨 앞 — 짧은 단계가 밀리지 않게.
// - 새 표현은 복습 사이에 고르게 편다(Anki 「복습과 섞기」 — intersperseNew, 오너 「Anki와 동일하게」 2026-10-25 KST.
//   그 전은 복습 3장마다 1장). 학습 단계 카드는 섞지 않고 맨 앞. 같은 출처 단위(교재 과 · 자료 · 덱)의 새 표현끼리는 4장 이상 띄운다.
// - 새 표현의 첫 등장은 채점 없는 「처음 보는 표현」 카드 → 3장 뒤 채점 카드(FSRS = 첫 질문 · 학습 단계,
//   예전 일정 = 세션 내 재질문 — 줄 메타데이터만, 일정 저장 없음). 세션 길이 · 진행 표시는 서로 다른 카드 수다.

export const SOURCE_SPACING = 4;
export const REASK_AFTER = 3;
export const SESSION_LENGTHS = Object.freeze([20, 50]);
export const DEFAULT_SESSION_LENGTH = 20;
export const BACKLOG_WINDOW_DAYS = 14;
export const BACKLOG_DEFAULT_BASELINE = 20;
export const BACKLOG_FACTOR = 2;
// 기준 하한(오너 승인 2026-10-14) — 오래 쓴 가벼운 사용자(14일에 3장 → 평균 0.2)가 밀린 복습 1장에 새 표현이
// 멈추지 않게, 판정에 쓰는 기준은 하루 10장 아래로 내려가지 않는다. 화면의 「하루 평균」은 실제 평균 그대로.
export const BACKLOG_MIN_BASELINE = 10;
export const RESUME_MAX_AGE_MS = 24 * 3600 * 1000;

const byNumber = (a, b) => (a === b ? 0 : a < b ? -1 : 1);

/**
 * 새 항목을 복습 사이에 고르게 편다 — Anki 「복습과 섞기」(rslib scheduler/queue/builder/intersperser.rs)와 같은 비율
 * (복습 수 + 1) / (새 수 + 1). 복습 10 · 새 5 → R N R R N R R N R R N R R N R. Anki는 소수(f32)로 비교하지만
 * 여기는 같은 식을 정수로 곱해 비교한다(경계에서 반올림 차이가 없다).
 * pick(pending, out) = 이번 새 자리에 낼 항목의 pending 안 위치. -1이면 복습을 한 장 더 내고(남은 복습이 없으면 맨 앞), 다음 자리에서 다시 묻는다.
 */
export function intersperseNew(reviews = [], fresh = [], pick = () => 0) {
  const R = reviews.length, N = fresh.length, pending = [...fresh], out = [];
  let r = 0, n = 0;
  while (r < R || pending.length) {
    const reviewsLeft = r < R;
    if (pending.length && (!reviewsLeft || (n + 1) * (R + 1) < (r + 1) * (N + 1))) {
      const at = pick(pending, out);
      if (at >= 0 || !reviewsLeft) { out.push(pending.splice(Math.max(0, at), 1)[0]); n++; continue; }
    }
    out.push(reviews[r++]);
  }
  return out;
}

/**
 * 한 줄로 합치기. reviews · fresh 항목 = { id, engine:'fsrs'|'legacy', retrievability?, dueAt?, learning?,
 * sourceKey?, createdAt?, introduced? }. 반환 = [{ id, engine, isNew, introduced }] — 줄 순서 그대로.
 */
export function orderReviewQueue({ reviews = [], fresh = [] } = {}) {
  const r = value => (typeof value === 'number' && Number.isFinite(value) ? value : -1);
  const sortedReviews = [...reviews].sort((a, b) => (b.learning ? 1 : 0) - (a.learning ? 1 : 0)
    || byNumber(r(a.retrievability), r(b.retrievability)) || byNumber(a.dueAt ?? 0, b.dueAt ?? 0) || String(a.id).localeCompare(String(b.id)));
  // 새 표현: 이미 시작한 것(오늘 입장권 · 첫 질문을 받은 것)이 먼저, 그다음 담은 순서.
  const pending = [...fresh].sort((a, b) => (b.introduced ? 1 : 0) - (a.introduced ? 1 : 0)
    || byNumber(a.createdAt ?? 0, b.createdAt ?? 0) || String(a.id).localeCompare(String(b.id)));
  // 학습 단계 카드는 맨 앞(Anki도 지금 차례인 학습 단계 카드를 먼저 낸다), 나머지 복습 사이에 새 표현을 편다.
  const learning = sortedReviews.filter(item => item.learning), rest = sortedReviews.filter(item => !item.learning);
  const isFresh = new Set(pending);
  // 띄우기를 지킬 새 표현이 없으면 복습을 한 장 더 낸다. 복습도 없으면 순서대로 낸다(남은 것이 같은 출처뿐일 때).
  const spaced = out => item => !item.sourceKey ||
    !out.slice(-(SOURCE_SPACING - 1)).some(prev => isFresh.has(prev) && prev.sourceKey === item.sourceKey);
  const mixed = intersperseNew(rest, pending, (left, out) => left.findIndex(spaced(out)));
  return [...learning, ...mixed].map(item => isFresh.has(item)
    ? { id: item.id, engine: item.engine, isNew: true, introduced: !!item.introduced }
    : { id: item.id, engine: item.engine, isNew: false, introduced: true });
}

/** 세션 길이 칩 = 서로 다른 카드 수(새 표현 포함, 학습 단계 · 재질문 제외). limit이 null이면 전부. 줄 앞에서 자른다. */
export function sliceSession(items, limit) {
  return Number.isInteger(limit) && limit > 0 ? (items || []).slice(0, limit) : [...(items || [])];
}

/** 이 개수에서 보여 줄 길이 칩 — 20 · 50 중 개수보다 작은 것 + 전부. 20 이하면 칩 없음. */
export function sessionLengthOptions(total) {
  if (!(total > DEFAULT_SESSION_LENGTH)) return [];
  return [...SESSION_LENGTHS.filter(n => n < total), null];
}

// ── 세션 진행(줄 메타데이터) ──
// 단계 = { id, engine, phase }: phase 'intro'(처음 보는 표현 · 채점 없음) · 'question'(채점) · 'reask'(예전 일정
// 새 표현의 세션 내 재질문 — 첫 채점) · 'again'(예전 일정 「다시」 재노출) · 'learn'(FSRS 학습 단계 재확인).

/** 시작 줄 → 첫 단계 목록. 아직 시작하지 않은 새 표현은 처음 보는 표현 카드로 연다. */
export function initialSteps(items) {
  return (items || []).map(item => ({ id: item.id, engine: item.engine,
    phase: item.isNew && !item.introduced ? 'intro' : 'question' }));
}

/** 처음 보는 표현을 넘기면 3장 뒤에 채점 단계를 넣는다(남은 줄이 짧으면 끝에). */
export function insertAfterIntro(steps, index) {
  const step = steps[index];
  if (!step || step.phase !== 'intro') return steps;
  const next = { id: step.id, engine: step.engine, phase: step.engine === 'legacy' ? 'reask' : 'question' };
  const at = Math.min(steps.length, index + 1 + REASK_AFTER);
  return [...steps.slice(0, at), next, ...steps.slice(at)];
}

/** FSRS 학습 단계 카드가 다시 나올 때가 되면 지금 카드 바로 뒤에 끼운다(지금 카드이거나 이미 남은 단계에 있으면 그대로). */
export function insertLearningStep(steps, index, id) {
  if (steps[index]?.id === id || steps.slice(index + 1).some(step => step.id === id && step.phase !== 'skipped')) return steps;
  return [...steps.slice(0, index + 1), { id, engine: 'fsrs', phase: 'learn' }, ...steps.slice(index + 1)];
}

// 채점(또는 미루기)이 끝난 단계 — 처음 보는 표현 · 건너뛴 단계 · 되돌린 단계는 세지 않는다.
const GRADED_PHASES = new Set(['question', 'reask', 'again', 'learn']);

/**
 * 진행 표시 = 끝낸 서로 다른 카드 수 / 이 세션의 서로 다른 카드 수(학습 단계 · 재질문은 세지 않는다).
 * 끝냈는지는 줄의 위치로 판정한다: index 앞의 채점 단계 — 되돌리면(index를 되감거나 단계를 'undone'으로) 자연히 빠진다.
 * 건너뛰기만 하고 남은 단계도 없는 카드(아는 단어로 옮김 · 다른 곳에서 채점)는 N에서 뺀다. priorDone = 이어 하기 전에 끝낸 카드.
 */
export function stepProgress(steps, index, cardIds, priorDone = []) {
  const done = new Set(priorDone), pending = new Set(), skipped = new Set();
  (steps || []).forEach((step, at) => {
    if (at >= index) pending.add(step.id);
    else if (GRADED_PHASES.has(step.phase)) done.add(step.id);
    else if (step.phase === 'skipped') skipped.add(step.id);
  });
  const dropped = id => skipped.has(id) && !done.has(id) && !pending.has(id);
  const doneIds = (cardIds || []).filter(id => done.has(id));
  const remainingIds = (cardIds || []).filter(id => !done.has(id) && !dropped(id));
  return { done: doneIds.length, total: doneIds.length + remainingIds.length, doneIds, remainingIds };
}

// ── 이어 하기(세션 저장소) — { scopeKey, cardIds, index, startedAt } ──
// cardIds는 [끝낸 카드 …, 남은 카드 …] 순서로 쓰고 index = 끝낸 카드 수다(stepProgress로 만든다). 다시 열 때 다른 곳에서
// 이미 채점된 카드(마지막 채점 > startedAt)는 건너뛰고, 24시간이 지나면 버린다. 메모리 안 이어 하기를 대체한다.
export const RESUME_KEY_PREFIX = 'vocab_review_resume:';
export const resumeKey = accountId => `${RESUME_KEY_PREFIX}${accountId || 'guest'}`;

export function readResume(storage, accountId) {
  try {
    const raw = storage?.getItem(resumeKey(accountId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.scopeKey !== 'string' || !Array.isArray(value.cardIds) || !Number.isInteger(value.index)
      || value.index < 0 || value.index > value.cardIds.length || !Number.isFinite(Date.parse(value.startedAt))) return null;
    return value;
  } catch { return null; }
}
export function writeResume(storage, accountId, resume) {
  try {
    if (resume) storage?.setItem(resumeKey(accountId), JSON.stringify(resume));
    else storage?.removeItem(resumeKey(accountId));
  } catch { /* 저장소가 막히면 이 화면에서만 이어 간다 */ }
}

/**
 * 저장된 진행 → 다시 열 줄. 범위가 다르거나 24시간이 지났으면 null(버린다).
 * reviewedAt(id) = 그 카드의 마지막 채점 시각(ms, 없으면 null), available(id) = 지금도 복습할 수 있는 카드인가.
 * 반환 = { remaining: [id…], done, total } — done/total이 「멈춘 복습 이어 하기 (n / N)」.
 */
export function restoreResume(resume, { scopeKey, now = Date.now(), reviewedAt = () => null, available = () => true } = {}) {
  if (!resume || resume.scopeKey !== scopeKey) return null;
  const started = Date.parse(resume.startedAt);
  if (!(now - started < RESUME_MAX_AGE_MS) || now < started) return null;
  const remaining = resume.cardIds.slice(resume.index).filter(id => {
    const at = reviewedAt(id);
    return available(id) && !(Number.isFinite(at) && at > started);
  });
  if (!remaining.length) return null;
  return { remaining, done: resume.cardIds.length - remaining.length, total: resume.cardIds.length };
}

// ── 밀린 복습 규칙(R1-A §2 · 설계 §6-1 ③) ──
/**
 * 기준 = 그 언어의 지난 14일 하루 평균 완료 복습 수(14일 기록이 없으면 20). 오늘 기한 지난 복습이 기준의 2배를
 * 넘으면 그 언어의 새 표현을 0으로(계정 한도는 차감하지 않는다).
 * 「완료 복습 수」는 snapshot에서 잰다 — 지난 14일 안에 마지막 채점이 있는 카드 수(두 엔진 공통, 카드당 1).
 * FSRS 채점은 review_events에 남지 않아 기록 표본으로는 두 엔진을 같은 기준으로 셀 수 없다. 언어의 가장 오래된
 * 표현이 14일이 안 됐으면(기록이 14일에 못 미침) 기본값 20을 쓴다.
 */
export function backlogBaseline(projections, { now = Date.now() } = {}) {
  const since = now - BACKLOG_WINDOW_DAYS * 86400000;
  let reviewed = 0, oldest = Infinity;
  for (const p of projections || []) {
    const created = Date.parse(p?.vocabulary?.created_at);
    if (Number.isFinite(created)) oldest = Math.min(oldest, created);
    const last = Date.parse(p?.memory?.lastReview);
    if (Number.isFinite(last) && last >= since && last <= now) reviewed++;
  }
  if (!(oldest <= since) || reviewed === 0) return BACKLOG_DEFAULT_BASELINE;
  return reviewed / BACKLOG_WINDOW_DAYS;
}

export function isBacklogged(overdue, baseline) {
  return overdue > BACKLOG_FACTOR * Math.max(baseline, BACKLOG_MIN_BASELINE);
}
