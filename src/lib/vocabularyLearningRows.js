/** 완전한 actor-bound snapshot만 projection으로 만든다. 오류를 빈 단어장으로 바꾸지 않는다. */
import { schedulerTime } from './fsrsScheduler.js';
import { isVocabularyReviewAvailable, projectVocabularyLearning, VOCABULARY_LEARNING_REQUIRED_FIELDS } from './vocabularyLearningRead.js';
import { kstDateString, kstDayStartMs } from './growthStats.js';
import { takeEarlyVocabulary } from './vocabularyEarly.js';

const failure = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

function checkedSnapshot(snapshot, actorId, at) {
  if (!identity(actorId) || snapshot?.actorId !== actorId) throw failure('vocabulary_learning_owner_mismatch');
  if (snapshot?.version !== 1 || snapshot.registryAvailable !== true || snapshot.complete !== true ||
      typeof snapshot.enabled !== 'boolean' || !Array.isArray(snapshot.rows) || !Array.isArray(snapshot.registry)) throw failure('vocabulary_learning_unavailable');
  const capturedAt = schedulerTime(snapshot.now), now = schedulerTime(at);
  if (now < capturedAt) throw failure('vocabulary_learning_clock_reversed');
  if (snapshot.rows.length !== snapshot.registry.length) throw failure('vocabulary_learning_incomplete_registry');
  return now;
}

const validRow = (vocabulary, actorId) => !!vocabulary && identity(vocabulary.id) && vocabulary.user_id === actorId &&
  typeof vocabulary.word_text === 'string' && VOCABULARY_LEARNING_REQUIRED_FIELDS.every(key => Object.hasOwn(vocabulary, key)) &&
  (vocabulary.language === null || (typeof vocabulary.language === 'string' && !!vocabulary.language));

/**
 * 이 함수가 검사 · 투영해 내보낸 snapshot(VIEWER-INDEX-001, 2026-11-02 KST). 뷰어 색인(buildVocabularyWordIndex)은 받은 snapshot을
 * 그 자리에서 한 번 더 투영했다 — 3,000단어 CPU×4 약 45 ms(같은 긴 작업 약 160 ms의 3할), 검사 · 투영 결과는 시각 하나(evaluatedAt) 말고 같다.
 * 같은 객체를 같은 계정 · 같거나 늦은 시각으로 다시 받으면 검사를 되풀이하지 않고 시각만 옮겨 적는다(재투영과 깊은 비교로 같다 — 계약
 * vocabularyProjectReuse.test.js). 늦은 시각에서 결과가 같은 까닭: 투영의 시각 검사(소개 · 마지막 복습 · 첫 질문 > 지금이면 거부)는 시각이
 * 늘면 통과를 유지하고, 시각을 담는 칸은 review.evaluatedAt뿐이다(reprojectVocabularyLearningRow와 같은 전제 — 계약 vocabLearningPatch).
 * 행 · 등록 · 투영 배열이나 머리 칸이 바뀌었거나, 투영과 행이 줄마다 같은 객체가 아니면 처음처럼 다 검사한다. 행 객체는 제자리에서 고치지 않는다
 * (앱의 모든 패치는 새 객체를 만든다 — beginVocabularyReview · mergeVocabularyWordIndexCards 선례). 시각이 줄마다 다른 결과
 * (reprojectVocabularyLearningRow)는 적어 두지 않는다 — 전체 재투영은 모든 줄을 같은 시각으로 맞추기 때문이다.
 */
const PROJECTED = new WeakMap();
const HEAD_FIELDS = ['version', 'actorId', 'registryAvailable', 'complete', 'enabled', 'now', 'rows', 'registry', 'projections'];

function reusableProjection(snapshot, actorId, at) {
  const held = snapshot && typeof snapshot === 'object' ? PROJECTED.get(snapshot) : undefined;
  if (!held || held.actorId !== actorId || !HEAD_FIELDS.every(key => snapshot[key] === held[key])) return null;
  const { rows, projections } = held;
  if (projections.length !== rows.length) return null;
  for (let index = 0; index < rows.length; index++) if (projections[index]?.vocabulary !== rows[index]) return null;
  let now;
  try { now = schedulerTime(at); } catch { return null; }
  return now >= held.at ? { held, now } : null; // 이른 시각은 처음 경로(clock_reversed)로
}

function rememberProjection(result, actorId, at) {
  PROJECTED.set(result, { ...Object.fromEntries(HEAD_FIELDS.map(key => [key, result[key]])), actorId, at });
  return result;
}

// 검사 · 투영 한 벌. 동기 · 나눠 돌기(projectVocabularyLearningRowsSliced)가 같은 본문을 쓴다 — 줄 STEP_ROWS개마다 한 번 멈출 자리(yield)를 낸다.
const STEP_ROWS = 64;
function* projectionSteps(snapshot, actorId, at) {
  const reuse = reusableProjection(snapshot, actorId, at);
  if (reuse) {
    const evaluatedAt = new Date(reuse.now).toISOString();
    const projections = reuse.held.projections.map(projection => projection.review.evaluatedAt === evaluatedAt ? projection
      : Object.freeze({ ...projection, review: Object.freeze({ ...projection.review, evaluatedAt }) }));
    return rememberProjection({ ...snapshot, rows: snapshot.rows, registry: snapshot.registry, projections, now: evaluatedAt }, actorId, reuse.now);
  }
  const now = checkedSnapshot(snapshot, actorId, at);
  const entries = new Map();
  for (const entry of snapshot.registry) {
    if (!entry || !identity(entry.cardId) || entry.userId !== actorId || entries.has(entry.cardId)) throw failure('vocabulary_learning_invalid_registry');
    entries.set(entry.cardId, entry);
  }
  yield;
  const seen = new Set();
  const rows = snapshot.rows, projections = [];
  for (let index = 0; index < rows.length; index++) {
    const vocabulary = rows[index];
    if (!validRow(vocabulary, actorId) || seen.has(vocabulary.id)) throw failure('vocabulary_learning_invalid_rows');
    seen.add(vocabulary.id);
    projections.push(projectVocabularyLearning({ actorId, vocabulary, registry: entries.get(vocabulary.id),
      enabled: snapshot.enabled, registryAvailable: true, complete: true, at: now }));
    if (index % STEP_ROWS === STEP_ROWS - 1) yield;
  }
  return rememberProjection({ ...snapshot, rows: snapshot.rows, registry: snapshot.registry, projections,
    now: new Date(now).toISOString() }, actorId, now);
}

export function projectVocabularyLearningRows(snapshot, { actorId, at = snapshot?.now } = {}) {
  const steps = projectionSteps(snapshot, actorId, at);
  for (;;) { const step = steps.next(); if (step.done) return step.value; }
}

/** 다음 작업으로 넘긴다 — scheduler.yield(앞자리 유지)가 있으면 그것, 없으면 setTimeout 0. */
export const yieldToMain = () => (typeof globalThis.scheduler?.yield === 'function'
  ? globalThis.scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0)));

/**
 * projectVocabularyLearningRows와 같은 검사 · 같은 결과(계약 vocabularyProjectReuse.test.js)를 sliceMs씩 나눠 돈다(VIEWER-INDEX-001).
 * 뷰어 첫 화면 — 3,000단어 계정은 받은 snapshot의 투영이 CPU×4 약 0.1초 한 덩어리라, 그 사이 탭 · 스크롤이 기다렸다.
 * 시각(at)은 시작할 때 한 번 정한다(동기 판과 같다). 나눠 도는 사이 계정이 바뀌면 호출부(fetchVocabularyLearningRows의 check)가 결과를 버린다.
 */
export async function projectVocabularyLearningRowsSliced(snapshot, { actorId, at = snapshot?.now } = {},
  { sliceMs = 30, yieldTo = yieldToMain, clock = () => performance.now() } = {}) {
  const steps = projectionSteps(snapshot, actorId, at);
  let start = clock();
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
    if (clock() - start >= sliceMs) { await yieldTo(); start = clock(); }
  }
}

/**
 * 이미 투영한 snapshot에서 한 행만 바꿔 다시 투영한다(채점 저장 직후 — LOGGED-IN-PERF F7). 다른 행의 투영 객체는 그대로 둔다:
 * 투영에서 시각(at)에 기대는 칸은 review.evaluatedAt뿐이라(nextQuestionAt · available · 막힌 까닭은 행과 등록 정보만 본다),
 * 화면은 모두 「max(지금, evaluatedAt)」 시계로 판정하므로 전체 재투영과 같은 값을 그린다(계약 vocabLearningPatch).
 * 투영이 행과 줄이 어긋나 있으면(직접 만든 snapshot 등) 전체 재투영으로 돌아간다.
 */
export function reprojectVocabularyLearningRow(projected, wordId, row, { actorId, at = projected?.now } = {}) {
  const now = checkedSnapshot(projected, actorId, at);
  const index = projected.rows.findIndex(current => current?.id === wordId);
  if (index < 0 || row?.id !== wordId) throw failure('vocabulary_learning_invalid_rows');
  const rows = projected.rows.slice();
  rows[index] = row;
  const previous = projected.projections;
  if (!Array.isArray(previous) || previous.length !== rows.length || previous[index]?.vocabulary?.id !== wordId) {
    return projectVocabularyLearningRows({ ...projected, rows }, { actorId, at: now });
  }
  if (!validRow(row, actorId)) throw failure('vocabulary_learning_invalid_rows');
  const registry = projected.registry.find(entry => entry?.cardId === wordId);
  if (!registry || registry.userId !== actorId) throw failure('vocabulary_learning_invalid_registry');
  const projections = previous.slice();
  projections[index] = projectVocabularyLearning({ actorId, vocabulary: row, registry,
    enabled: projected.enabled, registryAvailable: true, complete: true, at: now });
  return { ...projected, rows, registry: projected.registry, projections, now: new Date(now).toISOString() };
}

/**
 * GET의 contexts/id 경로와 구분한다. 계정 전환·취소 뒤 도착한 옛 응답은 반환하지 않는다.
 * sliced: true면 투영을 나눠 돈다(projectVocabularyLearningRowsSliced — 결과 같음). 나눠 도는 사이의 계정 전환 · 취소도 위와 같이 버린다.
 */
export async function fetchVocabularyLearningRows(actorId, { fetchImpl = (...args) => globalThis.fetch(...args),
  signal, getActorId = () => actorId, at, fields, sliced = false } = {}) {
  const check = () => {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    if (!identity(actorId) || getActorId() !== actorId) throw failure('vocabulary_learning_owner_mismatch');
  };
  check();
  if (fields !== undefined && fields !== 'summary') throw failure('vocabulary_learning_invalid_fields');
  const url = `/api/learning/vocabulary?view=learning${fields === 'summary' ? '&fields=summary' : ''}`;
  // 문서 머리가 일찍 보낸 같은 읽기(VOCAB-EARLY-001)가 있으면 그 성공 응답을 한 번 넘겨받는다 — 없거나 실패면 지금처럼 보낸다.
  const early = await takeEarlyVocabulary(url);
  const response = early || await fetchImpl(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal });
  check();
  let body;
  try { body = await response.json(); } catch { throw failure('vocabulary_learning_invalid_response', { status: response.status }); }
  check();
  if (!response.ok || body?.ok === false) throw failure(body?.code || 'vocabulary_learning_unavailable', { status: response.status });
  // 요청 시작 시각은 응답의 DB 시각보다 이를 수 있다. at는 역사 조회가 아닌
  // 로컬 시계 하한이며, 전송 완료 후 더 최신인 snapshot 시각을 함께 사용한다.
  const options = { actorId, ...(at === undefined ? {} : { at: Math.max(schedulerTime(at), schedulerTime(body?.now)) }) };
  if (!sliced) return projectVocabularyLearningRows(body, options);
  const projected = await projectVocabularyLearningRowsSliced(body, options);
  check();
  return projected;
}

/** 카드 몇 장 읽기의 상한 — 서버(VOCABULARY_CARDS_MAX) · SQL(fsrs_vocabulary_snapshot_cards)과 같다. */
export const VOCABULARY_LEARNING_CARDS_MAX = 50;
const lowerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * 카드 몇 장의 학습 snapshot(SNAPSHOT-CARDS-001) — 같은 경로의 view=learning&ids=…, 응답 모양 · 투영은 위 전체 읽기와 같다.
 * 저장 · 채점 뒤 색인 패치(viewerVocabularyCache.refreshVocabWordsCards)만 쓴다. ids는 소문자 UUID 1~50개 · 중복 없음.
 * 요청하지 않은 행이 오면 실패(전체 snapshot을 잘못 받은 것과 섞이지 않게). 계정 전환 · 취소 뒤 도착한 응답은 반환하지 않는다.
 */
export async function fetchVocabularyLearningCards(actorId, ids, { fetchImpl = (...args) => globalThis.fetch(...args),
  signal, getActorId = () => actorId } = {}) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > VOCABULARY_LEARNING_CARDS_MAX || !ids.every(id => lowerUuid.test(id))
      || new Set(ids).size !== ids.length) throw failure('vocabulary_learning_invalid_ids');
  const check = () => {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    if (!identity(actorId) || getActorId() !== actorId) throw failure('vocabulary_learning_owner_mismatch');
  };
  check();
  const response = await fetchImpl(`/api/learning/vocabulary?view=learning&ids=${ids.join(',')}`, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
  });
  check();
  let body;
  try { body = await response.json(); } catch { throw failure('vocabulary_learning_invalid_response', { status: response.status }); }
  check();
  if (!response.ok || body?.ok === false) throw failure(body?.code || 'vocabulary_learning_unavailable', { status: response.status });
  const wanted = new Set(ids);
  if (!Array.isArray(body?.rows) || !body.rows.every(row => wanted.has(row?.id))) throw failure('vocabulary_learning_invalid_rows');
  return projectVocabularyLearningRows(body, { actorId });
}

/** KST 자정 표시 달력이다. 카드의 학습일/시간대/일일 신규 예산을 변경하지 않는다. */
export function vocabularyReviewCalendar(projections, at, { days = 7, startOffset = 0 } = {}) {
  const now = schedulerTime(at);
  if (!Array.isArray(projections) || !Number.isInteger(days) || days < 1 || days > 366 ||
      !Number.isInteger(startOffset) || Math.abs(startOffset) > 366) throw failure('vocabulary_learning_invalid_calendar');
  const start = kstDayStartMs(now) + startOffset * 86400000;
  const buckets = Array.from({ length: days }, (_, index) => {
    const key = kstDateString(start + index * 86400000);
    return { key, date: key, count: 0 };
  });
  const indices = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  for (const projection of projections) {
    if (now < schedulerTime(projection.review?.evaluatedAt)) throw failure('vocabulary_learning_clock_reversed');
    if (!isVocabularyReviewAvailable(projection) || projection.review.nextQuestionAt === null) continue;
    const index = indices.get(kstDateString(schedulerTime(projection.review.nextQuestionAt)));
    if (index !== undefined) buckets[index].count++;
  }
  return buckets;
}
