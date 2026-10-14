// 복습 범위(REV-SCOPE-R1A — 오너 승인 REV-SCOPE 3판 D1–D15, 2026-10-10 KST).
// 범위 하나(언어 → 급수 → 출처 → 상태)가 개수 · 시작 · 줄을 함께 정한다(설계 §3 · §6-1 ①②).
// - 주소 문법: parseReviewScope ↔ serializeReviewScope. 진입점은 모두 serializeReviewScope로 주소를 만든다
//   (교재 도구막대 · 교재 과 끝 · 자료 뷰어 · 배움 칸(AK) · 현황(AK)) — 왕복이 같은 문자열이어야 한다.
// - 명시 범위가 무효거나 id 조회가 실패하면 닫힌다: 「전체」로 새지 않고 저장된 설정도 덮지 않는다(원칙 5).
// - 개수는 countReviewScope 하나가 낸다(배움 칸 · 언어 칩 · 복습방 공용, 원칙 3). 같은 결과의 queue가
//   복습 시작에 그대로 쓰이므로 「보이는 개수 = 시작하는 줄 길이」가 구조로 성립한다.
//
// ⚠ R1-A의 엔진 규칙: 「범위 안 FSRS 카드가 하나라도 출제 가능하면 세션 전체가 FSRS」(VocabPage startSession)를
// 그대로 둔다. 그래서 개수도 그 규칙대로 센다 — FSRS가 잡으면 FSRS 줄만 total이고, 그 뒤로 밀린 예전 일정 카드는
// deferred로 따로 낸다. 두 엔진을 한 줄로 합치는 일(FSRS 독점 해제)은 R1-B다(설계 §6-1 ③). 밀린 복습 규칙 ·
// 뜻 없는 표현 제외도 줄 동작을 바꾸므로 R1-B에서 줄과 개수를 함께 바꾼다.
import { REVIEW_SCOPE_LANGS, STUDY_SOURCE_REF, FRAGILE_RETRIEVABILITY } from './reviewScopeUrl.js';
import { detectLangConfident } from './constants.js';
import { zhHskLevelLabel, zhHskLevelOf } from './zhHskLevel.js';
import { isVocabularyReviewAvailable, isVocabularyReviewDue, isVocabularyUnreviewed, vocabularyRetrievability } from './vocabularyLearningRead.js';

export * from './reviewScopeUrl.js';

export function scopeLevelLabel(level) {
  if (level === 'NONE') return '미분류';
  return zhHskLevelLabel(Number(String(level || '').slice(1)));
}

/** 저장된 언어가 없으면 null 언어 그대로. 언어 판정은 저장값 우선, 비었으면 확신할 때만(kana · 프랑스어 부호). */
export function wordScopeLanguage(word) {
  return word?.language || detectLangConfident(word?.word_text) || null;
}

export function wordZhLevel(word, levels) {
  const level = zhHskLevelOf(word?.word_text, levels);
  return level ? `H${level}` : 'NONE';
}

export const scopeNeedsLookup = source => source?.kind === 'book' || source?.kind === 'material' || source?.kind === 'note';
export const scopeNeedsLevels = scope => !!scope?.level;

/**
 * 범위 거르기 — 언어 · 급수 · 출처(상태는 개수 계산에서). 조회가 필요한 출처는 sourceIds(서버가 준 본인 단어 id),
 * 급수는 levels(HSK 2026 표)가 있어야 판정한다. 아직 없으면 ready:false — 「전체」로 대신 세지 않는다.
 */
export function createScopeMatcher(scope, { levels = null, sourceIds = null } = {}) {
  if (!scope?.lang || !REVIEW_SCOPE_LANGS.includes(scope.lang)) return { ready: false, reason: 'lang' };
  if (scope.level && !levels) return { ready: false, reason: 'levels' };
  const source = scope.source || null;
  if (scopeNeedsLookup(source) && !Array.isArray(sourceIds)) return { ready: false, reason: 'source' };
  const ids = scopeNeedsLookup(source) ? new Set(sourceIds) : null;
  const materialIds = source?.kind === 'material' || source?.kind === 'note' ? new Set(source.ids) : null;
  const matches = word => {
    if (!word || wordScopeLanguage(word) !== scope.lang) return false;
    if (scope.level && wordZhLevel(word, levels) !== scope.level) return false;
    if (!source) return true;
    if (source.kind === 'book') return ids.has(word.id);
    if (materialIds) return ids.has(word.id) || (word.source_material_id != null && materialIds.has(String(word.source_material_id)));
    if (source.kind === 'deck') return word.source_ref === source.ref;
    return word.source_ref === STUDY_SOURCE_REF;
  };
  return { ready: true, matches };
}

/** 학습 snapshot projection → FSRS 등록 정보(controller가 없는 화면 — 배움 칸 — 용). */
export function fsrsEntriesFromSnapshot(snapshot) {
  return (snapshot?.projections || []).filter(p => p?.source === 'fsrs-v1').map(p => ({
    cardId: p.vocabulary.id, card: { state: p.memory.state, due: p.memory.due },
    nextQuestionAt: p.review.nextQuestionAt, firstQuestionAt: p.review.firstQuestionAt,
    eligible: p.review.eligible, known: p.review.known, excluded: p.review.excluded,
  }));
}

const time = value => (typeof value === 'number' ? value : Date.parse(value));
const empty = (status, reason) => ({ status, reason, engine: null, due: 0, newAllowed: 0, newLocked: 0, total: 0, deferred: 0,
  stored: 0, queue: { legacyIds: [], fsrsIds: [] }, scopedIds: [] });

// 범위 안 학습 행(아는 단어 · 제외 · 지원 안 하는 언어 제외)과 상태 판정 — 개수와 FSRS 범위 id가 같은 판정을 쓴다.
function scopedProjections({ snapshot, scope, now, levels, sourceIds, reviewSupported = () => true }) {
  const matcher = createScopeMatcher(scope, { levels, sourceIds });
  if (!matcher.ready) return { ready: false, reason: matcher.reason };
  const at = time(now);
  const clock = p => Math.max(at, Date.parse(p.review.evaluatedAt) || at);
  const fragile = p => (vocabularyRetrievability(p, clock(p)) ?? 1) < FRAGILE_RETRIEVABILITY;
  const stateOk = (p, isNew) => scope.state === 'new' ? isNew : scope.state === 'fragile' ? !isNew && fragile(p) : true;
  const inScope = (snapshot?.projections || []).filter(p => p?.vocabulary && matcher.matches(p.vocabulary) && !p.review.known
    && !p.review.excluded && !p.vocabulary.is_excluded && !p.vocabulary.is_known && reviewSupported(p.vocabulary));
  const fsrsIds = inScope.filter(p => p.source === 'fsrs-v1' && isVocabularyReviewAvailable(p) && stateOk(p, isVocabularyUnreviewed(p)))
    .map(p => p.vocabulary.id);
  return { ready: true, at, clock, stateOk, inScope, fsrsIds };
}

/** FSRS controller에 넘길 범위 id(useFsrsReview scopeIds). 범위를 아직 판정할 수 없으면 null — 빈 범위로 출제한다. */
export function scopedFsrsCardIds(args) {
  const scoped = scopedProjections(args);
  return scoped.ready ? scoped.fsrsIds : null;
}

function planReviewScope({ snapshot, fsrsEntries, quota, scope, now, levels, sourceIds,
  canLegacy = () => true, reviewSupported, fsrsEnabled, pendingIds = [] }) {
  const scoped = scopedProjections({ snapshot, scope, now, levels, sourceIds, reviewSupported });
  if (!scoped.ready) return empty('pending', scoped.reason);
  const { at, clock, stateOk, inScope } = scoped;

  // 예전 일정 — VocabPage의 기존 오늘 세션 계산(reviewsDue · newAvailable · newToday) 그대로.
  const legacy = inScope.filter(p => p.source === 'legacy' && isVocabularyReviewAvailable(p) && canLegacy(p.vocabulary.id));
  const legacyReviews = legacy.filter(p => !isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, clock(p)) && stateOk(p, false));
  const legacyNew = legacy.filter(p => isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, clock(p)) && stateOk(p, true));
  const admitted = new Set(quota?.admittedLegacyCardIds || []);
  const resumed = legacyNew.filter(p => admitted.has(p.vocabulary.id));
  const unseen = legacyNew.filter(p => !admitted.has(p.vocabulary.id));
  const remaining = Math.max(0, Number(quota?.remaining) || 0);

  // FSRS — useFsrsReview controller.queue()의 출제 조건 그대로(범위 id는 이 계획이 controller에 넘긴다).
  const enabled = fsrsEnabled ?? snapshot?.enabled === true;
  const pending = new Set(pendingIds), fsrsIds = new Set(scoped.fsrsIds);
  const entries = enabled ? (fsrsEntries ?? fsrsEntriesFromSnapshot(snapshot)) : [];
  const fsrsScoped = entries.filter(e => fsrsIds.has(e.cardId) && e.eligible !== false && !e.known && !e.excluded && !pending.has(e.cardId));
  const dueAt = e => Math.max(time(e.card?.due), e.nextQuestionAt ? time(e.nextQuestionAt) : -Infinity);
  const fsrsDue = fsrsScoped.filter(e => dueAt(e) <= at);
  const fsrsOpen = quota?.active === true && remaining > 0;
  const isUnseen = e => e.card?.state === 'New' && !e.firstQuestionAt;
  const fsrsReady = fsrsDue.filter(e => !isUnseen(e) || fsrsOpen);
  const fsrsUnseen = fsrsDue.filter(isUnseen);
  const base = { status: 'ready', reason: null, stored: inScope.length, scopedIds: inScope.map(p => p.vocabulary.id) };

  if (fsrsReady.length > 0) {
    const allowedUnseen = fsrsOpen ? Math.min(fsrsUnseen.length, remaining) : 0;
    const reviews = fsrsReady.filter(e => e.card.state !== 'New').length;
    const newAllowed = fsrsReady.filter(e => e.card.state === 'New' && e.firstQuestionAt).length + allowedUnseen;
    return { ...base, engine: 'fsrs', due: reviews, newAllowed, newLocked: fsrsUnseen.length - allowedUnseen,
      total: reviews + newAllowed, deferred: legacyReviews.length + legacyNew.length,
      queue: { legacyIds: [], fsrsIds: scoped.fsrsIds } };
  }
  const allowedUnseen = Math.min(unseen.length, remaining);
  const legacyIds = [...legacyReviews, ...resumed, ...unseen.slice(0, allowedUnseen)].map(p => p.vocabulary.id);
  return { ...base, engine: 'legacy', due: legacyReviews.length, newAllowed: resumed.length + allowedUnseen,
    newLocked: unseen.length - allowedUnseen + fsrsUnseen.length, total: legacyIds.length, deferred: 0,
    queue: { legacyIds, fsrsIds: scoped.fsrsIds } };
}

/**
 * 새 표현 한도 → countReviewScope의 quota 입력(복습방 · 배움 칸 공용 — 두 화면 숫자가 같은 한도를 쓴다).
 * 호환 모드(서버 한도 없음)는 이 기기의 하루 한도에서 오늘 시작한 수를 빼고, 아니면 서버의 남은 수.
 * admission = useLearningAdmission 결과, newPerDay · introIds = 기기 설정(vocab_new_per_day · loadIntroIds),
 * vocabIds = 지금 계정에 있는 단어 id(지운 단어의 시작 기록은 빼고 센다). 한도를 아직 모르면 null.
 */
export function reviewScopeQuota(admission, { newPerDay = 0, introIds = [], vocabIds = null } = {}) {
  const quota = admission?.quota;
  if (!quota) return null;
  const known = vocabIds ? new Set(vocabIds) : null;
  const started = introIds.filter(id => !known || known.has(id)).length;
  const remaining = admission.compatibility ? Math.max(0, newPerDay - started) : quota.active ? quota.remaining : 0;
  return { active: quota.active === true, remaining, admittedLegacyCardIds: quota.admittedLegacyCardIds || [] };
}

const GRAMMAR_LANG = { Japanese: ['japanese', 'ja'], Chinese: ['chinese', 'zh'], English: ['english', 'en'], French: ['french', 'fr'], Korean: ['korean', 'ko'] };
function grammarDueCount(grammar, lang, at) {
  if (!Array.isArray(grammar)) return 0;
  const names = GRAMMAR_LANG[lang] || [];
  return grammar.filter(row => names.includes(String(row?.lang || '').toLowerCase()) && time(row.next_review_at) <= at).length;
}

/**
 * 복습 개수 — 배움 칸(AK) · 언어 칩 · 복습방이 모두 이 함수 하나를 쓴다(설계 §6-1 ②, 계약 reviewScopeCount).
 *   due        = 범위 안 기한 된 복습(R1-A: 이번 세션을 잡는 엔진 하나 — 위 머리 주석)
 *   newAllowed = 범위 안 새 표현 중 오늘 시작 가능한 수(계정 한도 남은 수 이내)
 *   newLocked  = 한도에 막혀 오늘 시작하지 못하는 새 표현
 *   total      = due + newAllowed = 시작하는 줄 길이(queue)
 *   grammarDue = 그 언어 문법 복습(별줄, total에 넣지 않는다)
 *   byLang     = 언어 칩 숫자(그 언어만 고른 범위의 total)
 * 입력: snapshot = fetchVocabularyLearningRows 결과(projections), fsrsEntries = FSRS controller의 cards(없으면
 * snapshot에서), quota = { remaining, active, admittedLegacyCardIds }. 급수 · 출처 범위는 levels · sourceIds가 있어야 센다.
 */
export function countReviewScope({ snapshot, fsrsEntries, quota, scope, now = Date.now(), grammar = null,
  levels = null, sourceIds = null, canLegacy, reviewSupported, fsrsEnabled, pendingIds } = {}) {
  const shared = { snapshot, fsrsEntries, quota, now, levels, canLegacy, reviewSupported, fsrsEnabled, pendingIds };
  const plan = planReviewScope({ ...shared, scope, sourceIds });
  const byLang = {};
  for (const lang of REVIEW_SCOPE_LANGS) {
    if (!(snapshot?.projections || []).some(p => wordScopeLanguage(p?.vocabulary) === lang)) continue;
    byLang[lang] = planReviewScope({ ...shared, scope: { lang, level: null, source: null, state: 'due' } }).total;
  }
  return { ...plan, grammarDue: scope?.lang ? grammarDueCount(grammar, scope.lang, time(now)) : 0, byLang };
}
