/** 읽기 전용 학습 projection. 원본 단어/출처와 일정의 코호트를 합쳐 쓰지 않는다. */
import { forgetting_curve, generatorParameters } from 'ts-fsrs';
import { FSRS_POLICY, learningDay, schedulerTime, validateFsrsCard } from './fsrsScheduler.js';

const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const legacyWeights = generatorParameters().w;
const pinnedWeights = generatorParameters({ request_retention: FSRS_POLICY.retention,
  maximum_interval: FSRS_POLICY.maximumInterval, enable_fuzz: false, enable_short_term: true }).w;

export const VOCABULARY_LEARNING_SUMMARY_FIELDS = Object.freeze(['id', 'user_id', 'word_text', 'base_form',
  'meaning', 'language', 'created_at', 'interval', 'ease_factor', 'repetitions', 'last_reviewed_at', 'next_review_at', 'source_material_id']);

// PostgreSQL의 기존 timestamp는 마이크로초를 가질 수 있다. 원문 값은 그대로 두고,
// 읽기 eligibility만 다음 밀리초로 올림하여 실제 만기보다 먼저 활성화하지 않는다.
function legacyTime(value, { ceil = false } = {}) {
  if (typeof value !== 'string') return schedulerTime(value);
  const fraction = /\.(\d{4,6})(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!fraction) return schedulerTime(value);
  const replacement = `.${fraction[1].slice(0, 3)}${fraction[2]}`;
  const whole = schedulerTime(value.slice(0, fraction.index) + replacement);
  return whole + (ceil && /[1-9]/.test(fraction[1].slice(3)) ? 1 : 0);
}

function legacyMemory(vocabulary) {
  const { interval, repetitions, last_reviewed_at: lastReview = null, next_review_at: due = null } = vocabulary;
  if (interval != null && !finite(interval)) fail('vocabulary_learning_invalid_legacy_memory');
  if (repetitions != null && (!Number.isSafeInteger(repetitions) || repetitions < 0)) fail('vocabulary_learning_invalid_legacy_memory');
  if (lastReview !== null) legacyTime(lastReview);
  if (due !== null) legacyTime(due);
  // 현재 legacy adapter도 ease_factor에 D를 직접 기록한다. 유효한 저장값만 읽고
  // 초기 0/누락값에 adapter의 기본 난이도나 과거 SM-2 상태를 추측해 채우지 않는다.
  const difficulty = finite(vocabulary.ease_factor) && vocabulary.ease_factor >= 1 && vocabulary.ease_factor <= 10
    ? vocabulary.ease_factor : null;
  return { state: null, stability: interval ?? null, difficulty, lapses: repetitions ?? null,
    reps: null, lastReview, due, revision: null, policyVersion: null, engine: null,
    timeZone: null, rolloverHour: null };
}

export const isVocabularyLearningProjection = value => value?.kind === 'vocabulary-learning' && value?.version === 1;

/** registry는 완전 snapshot에서 얻은 이 단어의 명시적 metadata 한 행이다. */
export function projectVocabularyLearning({ actorId, vocabulary, registry, enabled,
  registryAvailable, complete, at }) {
  if (!identity(actorId) || !vocabulary || !identity(vocabulary.id) || vocabulary.user_id !== actorId) fail('vocabulary_learning_owner_mismatch');
  if (registryAvailable !== true || complete !== true || typeof enabled !== 'boolean') fail('vocabulary_learning_unavailable');
  if (!registry || registry.cardId !== vocabulary.id || registry.userId !== actorId) fail('vocabulary_learning_registry_mismatch');
  for (const key of ['enrolled', 'eligible', 'known', 'excluded']) {
    if (typeof registry[key] !== 'boolean') fail('vocabulary_learning_invalid_registry');
  }
  if (registry.eligible && (registry.known || registry.excluded)) fail('vocabulary_learning_invalid_registry');
  if (!Object.hasOwn(registry, 'nextQuestionAt') || !Object.hasOwn(registry, 'firstQuestionAt')) fail('vocabulary_learning_invalid_registry');
  const now = schedulerTime(at);
  let source, memory, due, firstQuestionAt;
  if (registry.enrolled) {
    const card = validateFsrsCard(registry.card);
    if (schedulerTime(card.introducedAt) > now || (card.lastReview !== null && schedulerTime(card.lastReview) > now)) fail('vocabulary_learning_clock_reversed');
    source = 'fsrs-v1';
    memory = { version: card.version, state: card.state, stability: card.stability, difficulty: card.difficulty,
      lapses: card.lapses, reps: card.reps, lastReview: card.lastReview, due: card.due,
      revision: card.revision, policyVersion: card.policyVersion, engine: card.engine,
      timeZone: card.timeZone, rolloverHour: card.rolloverHour, introducedAt: card.introducedAt,
      step: card.step, scheduledDays: card.scheduledDays, elapsedDays: card.elapsedDays };
    due = schedulerTime(registry.nextQuestionAt);
    if (due < schedulerTime(card.due)) fail('vocabulary_learning_invalid_registry');
    if (registry.attempt && (registry.attempt.userId !== actorId || registry.attempt.cardId !== vocabulary.id)) fail('vocabulary_learning_owner_mismatch');
    firstQuestionAt = registry.firstQuestionAt;
    if (firstQuestionAt !== null && (schedulerTime(firstQuestionAt) < schedulerTime(card.introducedAt) + FSRS_POLICY.learning[0] * 1000 || schedulerTime(firstQuestionAt) > now)) fail('vocabulary_learning_invalid_receipt');
  } else {
    if (registry.card !== null || registry.nextQuestionAt !== null || registry.firstQuestionAt !== null || registry.attempt != null) fail('vocabulary_learning_cohort_mismatch');
    source = 'legacy'; memory = legacyMemory(vocabulary); firstQuestionAt = null;
    if (memory.lastReview !== null && legacyTime(memory.lastReview) > now) fail('vocabulary_learning_clock_reversed');
    due = memory.due === null ? null : legacyTime(memory.due, { ceil: true });
  }
  const available = registry.eligible && !registry.known && !registry.excluded && (source === 'legacy' || enabled);
  return Object.freeze({ kind: 'vocabulary-learning', version: 1, vocabulary, source,
    memory: Object.freeze(memory), review: Object.freeze({ known: registry.known, excluded: registry.excluded,
      eligible: registry.eligible, available, firstQuestionAt, registryVerified: true,
      nextQuestionAt: due === null ? null : new Date(due).toISOString(), evaluatedAt: new Date(now).toISOString(),
      blockedReason: registry.known ? 'known' : registry.excluded ? 'excluded' : !registry.eligible ? 'ineligible'
        : source === 'fsrs-v1' && !enabled ? 'disabled' : null }) });
}

export const isVocabularyReviewAvailable = projection => isVocabularyLearningProjection(projection) && projection.review.available === true;

export function isVocabularyReviewDue(projection, at = projection?.review?.evaluatedAt) {
  if (!isVocabularyLearningProjection(projection)) fail('vocabulary_learning_projection_required');
  const now = schedulerTime(at);
  if (now < schedulerTime(projection.review.evaluatedAt)) fail('vocabulary_learning_clock_reversed');
  return isVocabularyReviewAvailable(projection) && projection.review.nextQuestionAt !== null && schedulerTime(projection.review.nextQuestionAt) <= now;
}

/** 미평가와 일일 신규 질문 영수증은 별개다. legacy 반복 수로 회상 횟수를 추측하지 않는다. */
export function isVocabularyUnreviewed(projection) {
  if (!isVocabularyLearningProjection(projection)) fail('vocabulary_learning_projection_required');
  return projection.source === 'fsrs-v1' ? projection.memory.state === 'New' : projection.memory.lastReview === null;
}

/** 예측은 읽기 전용이다. FSRS는 카드에 고정된 학습일, legacy는 기존 경과일 공식을 유지한다. */
export function vocabularyRetrievability(projection, at = projection?.review?.evaluatedAt) {
  if (!isVocabularyLearningProjection(projection)) fail('vocabulary_learning_projection_required');
  const now = schedulerTime(at), memory = projection.memory;
  if (now < schedulerTime(projection.review.evaluatedAt)) fail('vocabulary_learning_clock_reversed');
  if (memory.lastReview === null || !finite(memory.stability) || memory.stability === 0) return null;
  const elapsed = projection.source === 'fsrs-v1'
    ? learningDay(now, memory.timeZone, memory.rolloverHour) - learningDay(memory.lastReview, memory.timeZone, memory.rolloverHour)
    : (now - legacyTime(memory.lastReview)) / 86400000;
  if (elapsed < 0) fail('vocabulary_learning_clock_reversed');
  return forgetting_curve(projection.source === 'fsrs-v1' ? pinnedWeights : legacyWeights,
    elapsed, projection.source === 'fsrs-v1' ? memory.stability : Math.max(0.01, memory.stability));
}
