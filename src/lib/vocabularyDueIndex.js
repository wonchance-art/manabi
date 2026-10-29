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

/**
 * 카드 몇 장의 snapshot(SNAPSHOT-CARDS-001 — fsrs_vocabulary_snapshot_cards, 같은 판정 · 같은 모양)을 이미 만든 색인에 붙인다.
 * 결과 = 전체 snapshot(그 카드만 새 값)으로 buildVocabularyWordIndex를 다시 부른 것과 같다(계약 vocabWordsCardsPatch.test.js):
 * 행 · 투영 · 등록 정보는 그 카드만 바꾸고, 열쇠는 build의 순서 규칙을 id로 되짚는다 — 행은 id 오름차순(SQL ORDER BY id; 소문자 UUID 문자열 순서 =
 * uuid 순서)이라 표면 열쇠(surface: · 언어:surface:)는 가장 큰 id, 기본형 열쇠(base: · 언어:base:)는 가장 작은 id가 갖는다.
 * 되짚을 수 없으면 null(호출부가 전체를 다시 받는다): 색인이 불완전 · 다른 계정 · FSRS 켜짐이 다름 · 요청한 카드가 응답에 없는데 색인에 있음(지워짐) ·
 * 이미 있던 카드의 표기 · 기본형 · 언어가 바뀜(옛 열쇠를 누가 이어받을지 색인만으로는 모른다).
 * 평가 전송 중 행(__pendingReview)은 여기서 다루지 않는다 — 호출부가 preservePendingVocabularyReviews로 지킨다(전체 받기와 같은 길).
 */
export function mergeVocabularyWordIndexCards(index, cards, { ids = [], at } = {}) {
  if (!index?.byKey || index.complete !== true || index.registryAvailable !== true || cards?.actorId !== index.actorId) return null;
  let checked;
  try { checked = completeAt(cards, at ?? index.now); } catch { return null; }
  if (checked.enabled !== index.enabled) return null;
  const fresh = new Map(checked.rows.map(row => [row.id, row]));
  const held = new Map();
  for (const row of index.byKey.values()) if (row?.id && !held.has(row.id)) held.set(row.id, row);
  for (const wanted of ids) if (!fresh.has(wanted) && (held.has(wanted) || index.projectionsById?.has(wanted))) return null;
  for (const row of checked.rows) {
    const old = held.get(row.id) || index.projectionsById?.get(row.id)?.vocabulary;
    if (old && (old.word_text !== row.word_text || old.base_form !== row.base_form || old.language !== row.language)) return null;
  }
  const byKey = new Map([...index.byKey].map(([key, row]) => [key, fresh.get(row?.id) || row]));
  const surfaces = new Set(index.surfaces), bases = new Set(index.bases);
  const claim = (key, row, wins) => { const current = byKey.get(key); if (!current || current.id === row.id || wins(current.id)) byKey.set(key, row); };
  for (const row of checked.rows) {
    if (row.word_text) {
      surfaces.add(row.word_text);
      for (const key of [`surface:${row.word_text}`, `${row.language}:surface:${row.word_text}`]) claim(key, row, other => other < row.id);
    }
    if (row.base_form) {
      bases.add(row.base_form);
      for (const key of [`base:${row.base_form}`, `${row.language}:base:${row.base_form}`]) claim(key, row, other => row.id < other);
    }
  }
  const projectionsById = new Map(index.projectionsById), registryById = new Map(index.registryById);
  for (const projection of checked.projections) projectionsById.set(projection.vocabulary.id, projection);
  for (const entry of checked.registry) registryById.set(entry.cardId, entry);
  return { ...index, byKey, surfaces, bases, projectionsById, registryById,
    now: new Date(Math.max(schedulerTime(index.now), schedulerTime(checked.now))).toISOString() };
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

// 카드 한 장의 현재 projection — legacy의 성공/undo/오프라인 캐시 패치만 반영한다. FSRS cohort와 registry는 고정한다.
export function currentIndexedProjection(index, row, now = Date.now()) {
  if (!row || index?.complete !== true || index.registryAvailable !== true) return null;
  let projection = index.projectionsById?.get(row.id);
  if (!projection || row.user_id !== index.actorId || row.__pendingReview) return null;
  if (projection.source === 'legacy' && reviewFields.some(field => row[field] !== projection.vocabulary[field])) {
    const vocabulary = { ...projection.vocabulary };
    for (const field of reviewFields) vocabulary[field] = row[field];
    try {
      projection = projectVocabularyLearning({ actorId: index.actorId, vocabulary,
        registry: index.registryById.get(row.id), enabled: index.enabled, registryAvailable: true, complete: true, at: now });
    } catch { return null; }
  }
  return projection;
}

export function isIndexedVocabularyDue(index, row, { at = Date.now(), legacyOnly = false } = {}) {
  if (!row || index?.complete !== true || index.registryAvailable !== true) return false;
  const now = Math.max(schedulerTime(at), schedulerTime(index.now));
  const projection = currentIndexedProjection(index, row, now);
  if (!projection) return false;
  if (legacyOnly && (projection.source !== 'legacy' || projection.memory.lastReview === null)) return false;
  return isVocabularyReviewDue(projection, now);
}

/**
 * 저장 카드의 다음 복습(AE-R1 하단 저장 줄 「다음 복습 10월 12일」) — 읽기 전용, 추가 조회 없음.
 * projectionsById의 review.nextQuestionAt을 그대로 쓴다(isIndexedVocabularyDue와 같은 projection).
 * 복습 대상이 아니면(아는 단어·제외·부적격·FSRS 비활성·일정 없음·평가 전송 중) null.
 * @returns {{at:string, due:boolean, source:string}|null}
 */
export function indexedVocabularyNextReview(index, row, { at = Date.now() } = {}) {
  if (!row || index?.complete !== true || index.registryAvailable !== true) return null;
  const now = Math.max(schedulerTime(at), schedulerTime(index.now));
  const projection = currentIndexedProjection(index, row, now);
  if (!projection || !isVocabularyReviewAvailable(projection) || projection.review.nextQuestionAt === null) return null;
  return { at: projection.review.nextQuestionAt, due: isVocabularyReviewDue(projection, now), source: projection.source };
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
