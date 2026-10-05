/** 완전한 actor-bound snapshot만 projection으로 만든다. 오류를 빈 단어장으로 바꾸지 않는다. */
import { schedulerTime } from './fsrsScheduler.js';
import { isVocabularyReviewAvailable, projectVocabularyLearning, VOCABULARY_LEARNING_SUMMARY_FIELDS } from './vocabularyLearningRead.js';
import { kstDateString, kstDayStartMs } from './growthStats.js';

const failure = (code, extra = {}) => Object.assign(new Error(code), { code, ...extra });
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function projectVocabularyLearningRows(snapshot, { actorId, at = snapshot?.now } = {}) {
  if (!identity(actorId) || snapshot?.actorId !== actorId) throw failure('vocabulary_learning_owner_mismatch');
  if (snapshot?.version !== 1 || snapshot.registryAvailable !== true || snapshot.complete !== true ||
      typeof snapshot.enabled !== 'boolean' || !Array.isArray(snapshot.rows) || !Array.isArray(snapshot.registry)) throw failure('vocabulary_learning_unavailable');
  const capturedAt = schedulerTime(snapshot.now), now = schedulerTime(at);
  if (now < capturedAt) throw failure('vocabulary_learning_clock_reversed');
  if (snapshot.rows.length !== snapshot.registry.length) throw failure('vocabulary_learning_incomplete_registry');
  const entries = new Map();
  for (const entry of snapshot.registry) {
    if (!entry || !identity(entry.cardId) || entry.userId !== actorId || entries.has(entry.cardId)) throw failure('vocabulary_learning_invalid_registry');
    entries.set(entry.cardId, entry);
  }
  const seen = new Set();
  const projections = snapshot.rows.map(vocabulary => {
    if (!vocabulary || !identity(vocabulary.id) || seen.has(vocabulary.id) || vocabulary.user_id !== actorId ||
        typeof vocabulary.word_text !== 'string' || !VOCABULARY_LEARNING_SUMMARY_FIELDS.every(key => Object.hasOwn(vocabulary, key)) ||
        (vocabulary.language !== null && (typeof vocabulary.language !== 'string' || !vocabulary.language))) throw failure('vocabulary_learning_invalid_rows');
    seen.add(vocabulary.id);
    return projectVocabularyLearning({ actorId, vocabulary, registry: entries.get(vocabulary.id),
      enabled: snapshot.enabled, registryAvailable: true, complete: true, at: now });
  });
  return { ...snapshot, rows: snapshot.rows, registry: snapshot.registry, projections,
    now: new Date(now).toISOString() };
}

/** GET의 contexts/id 경로와 구분한다. 계정 전환·취소 뒤 도착한 옛 응답은 반환하지 않는다. */
export async function fetchVocabularyLearningRows(actorId, { fetchImpl = (...args) => globalThis.fetch(...args),
  signal, getActorId = () => actorId, at, fields } = {}) {
  const check = () => {
    if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
    if (!identity(actorId) || getActorId() !== actorId) throw failure('vocabulary_learning_owner_mismatch');
  };
  check();
  if (fields !== undefined && fields !== 'summary') throw failure('vocabulary_learning_invalid_fields');
  const response = await fetchImpl(`/api/learning/vocabulary?view=learning${fields === 'summary' ? '&fields=summary' : ''}`, {
    method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
  });
  check();
  let body;
  try { body = await response.json(); } catch { throw failure('vocabulary_learning_invalid_response', { status: response.status }); }
  check();
  if (!response.ok || body?.ok === false) throw failure(body?.code || 'vocabulary_learning_unavailable', { status: response.status });
  // 요청 시작 시각은 응답의 DB 시각보다 이를 수 있다. at는 역사 조회가 아닌
  // 로컬 시계 하한이며, 전송 완료 후 더 최신인 snapshot 시각을 함께 사용한다.
  return projectVocabularyLearningRows(body, { actorId,
    ...(at === undefined ? {} : { at: Math.max(schedulerTime(at), schedulerTime(body?.now)) }) });
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
