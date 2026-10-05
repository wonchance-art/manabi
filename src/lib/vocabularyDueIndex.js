/** 완전 snapshot의 읽기 인덱스. 원본 뜻·출처·legacy 일정에는 projection을 덮지 않는다. */
import { projectVocabularyLearningRows } from './vocabularyLearningRows.js';
import { isVocabularyReviewAvailable, isVocabularyReviewDue, projectVocabularyLearning } from './vocabularyLearningRead.js';
import { schedulerTime } from './fsrsScheduler.js';

const reviewFields = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];

function completeAt(snapshot, at = Date.now()) {
  return projectVocabularyLearningRows(snapshot, { actorId: snapshot?.actorId,
    at: Math.max(schedulerTime(at), schedulerTime(snapshot?.now)) });
}

export function buildVocabularyWordIndex(snapshot, at) {
  const checked = completeAt(snapshot, at);
  const byKey = new Map(), surfaces = new Set(), bases = new Set();
  for (const row of checked.rows) {
    if (row.word_text) {
      surfaces.add(row.word_text);
      byKey.set(`surface:${row.word_text}`, row);
      byKey.set(`${row.language}:surface:${row.word_text}`, row);
    }
    if (row.base_form) {
      bases.add(row.base_form);
      if (!byKey.has(`base:${row.base_form}`)) byKey.set(`base:${row.base_form}`, row);
      if (!byKey.has(`${row.language}:base:${row.base_form}`)) byKey.set(`${row.language}:base:${row.base_form}`, row);
    }
  }
  return { byKey, surfaces, bases, actorId: checked.actorId, now: checked.now, enabled: checked.enabled,
    complete: true, registryAvailable: true,
    projectionsById: new Map(checked.projections.map(projection => [projection.vocabulary.id, projection])),
    registryById: new Map(checked.registry.map(entry => [entry.cardId, entry])) };
}

export function findIndexedVocabulary(index, token, language) {
  if (!token) return null;
  const base = token.sep_link || token.base_form;
  const scoped = index?.byKey?.get(`${language}:surface:${token.text}`)
    || (base && index?.byKey?.get(`${language}:base:${base}`));
  const fallback = index?.byKey?.get(`surface:${token.text}`)
    || (base && index?.byKey?.get(`base:${base}`));
  return scoped || (fallback?.language === language ? fallback : null);
}

export function isIndexedVocabularyDue(index, row, { at = Date.now(), legacyOnly = false } = {}) {
  if (!row || index?.complete !== true || index.registryAvailable !== true) return false;
  let projection = index.projectionsById?.get(row.id);
  if (!projection || row.user_id !== index.actorId || row.__pendingReview) return false;
  const now = Math.max(schedulerTime(at), schedulerTime(index.now));
  if (projection.source === 'legacy' && reviewFields.some(field => row[field] !== projection.vocabulary[field])) {
    // 기존 legacy의 성공/undo/오프라인 캐시 패치만 반영한다. FSRS cohort와 registry는 고정한다.
    const vocabulary = { ...projection.vocabulary };
    for (const field of reviewFields) vocabulary[field] = row[field];
    try {
      projection = projectVocabularyLearning({ actorId: index.actorId, vocabulary,
        registry: index.registryById.get(row.id), enabled: index.enabled, registryAvailable: true, complete: true, at: now });
    } catch { return false; }
  }
  if (legacyOnly && (projection.source !== 'legacy' || projection.memory.lastReview === null)) return false;
  return isVocabularyReviewDue(projection, now);
}

export function countVocabularyDueInMaterial(index, material, at) {
  if (index?.complete !== true || index.registryAvailable !== true) return null;
  const dictionary = material?.processed_json?.dictionary;
  if (!dictionary) return 0;
  const language = material.processed_json.metadata?.language || material.language;
  const seen = new Set();
  for (const tokenId of material.processed_json.sequence || []) {
    const token = dictionary[tokenId];
    if (!token || token.pos === '개행') continue;
    const row = findIndexedVocabulary(index, token, language);
    if (isIndexedVocabularyDue(index, row, { at })) seen.add(row.id);
  }
  return seen.size;
}

/** 입장/새 FSRS를 지원하지 않는 학습 화면에는 기존 평가 이력이 있는 legacy만 보낸다. */
export function selectLegacyReviewRows(snapshot, { language, at = Date.now(), dueOnly = true,
  limit = Infinity, requireMeaning = false } = {}) {
  if (limit !== Infinity && (!Number.isSafeInteger(limit) || limit < 0)) throw new Error('vocabulary_learning_invalid_limit');
  const checked = completeAt(snapshot, at);
  return checked.projections
    .filter(projection => projection.source === 'legacy' && projection.memory.lastReview !== null
      && (!language || projection.vocabulary.language === language) && isVocabularyReviewAvailable(projection)
      && (!dueOnly || isVocabularyReviewDue(projection, checked.now))
      && (!requireMeaning || (typeof projection.vocabulary.meaning === 'string' && projection.vocabulary.meaning.trim())))
    .sort((left, right) => (left.review.nextQuestionAt === null ? Infinity : schedulerTime(left.review.nextQuestionAt))
      - (right.review.nextQuestionAt === null ? Infinity : schedulerTime(right.review.nextQuestionAt)))
    .slice(0, limit).map(projection => projection.vocabulary);
}
