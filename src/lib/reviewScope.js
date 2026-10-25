// 복습 범위(REV-SCOPE-R1A · R1B-1 — 오너 승인 REV-SCOPE 3판 D1–D15, 2026-10-10 KST).
// 범위 하나(언어 → 급수 → 출처 → 상태 → 종류)가 개수 · 시작 · 줄을 함께 정한다(설계 §3 · §6-1 ①②③).
// - 주소 문법: parseReviewScope ↔ serializeReviewScope. 진입점은 모두 serializeReviewScope로 주소를 만든다
//   (교재 도구막대 · 교재 과 끝 · 자료 뷰어 · 배움 칸(AK) · 현황(AK)) — 왕복이 같은 문자열이어야 한다.
// - 명시 범위가 무효거나 id 조회가 실패하면 닫힌다: 「전체」로 새지 않고 저장된 설정도 덮지 않는다(원칙 5).
// - 개수는 countReviewScope 하나가 낸다(배움 칸 · 언어 칩 · 복습방 공용, 원칙 3). 같은 결과의 queue가
//   복습 시작에 그대로 쓰이므로 「보이는 개수 = 시작하는 줄 길이」가 구조로 성립한다.
//
// R1-B-1 줄 규칙(§6-1 ③): 두 엔진(FSRS · 예전 일정)을 한 줄로 합친다 — R1-A의 「FSRS 카드가 하나라도 있으면
// 세션 전체가 FSRS」를 없앴다. 순서 · 끼우기 · 띄우기는 reviewQueue.orderReviewQueue, 밀린 복습 규칙(그 언어의
// 기한 지난 복습 > 하루 평균 × 2면 새 표현 0)과 뜻 없는 표현 제외도 줄과 개수에 함께 건다.
import { REVIEW_SCOPE_LANGS, STUDY_SOURCE_REF, FRAGILE_RETRIEVABILITY, SCOPE_LANG_LABELS, scopeSourceLabel, scopeStateLabel, scopeTypeLabel } from './reviewScopeUrl.js';
import { detectLangConfident } from './constants.js';
import { zhHskLevelLabel, zhHskLevelOf } from './zhHskLevel.js';
import { isVocabularyReviewAvailable, isVocabularyReviewDue, isVocabularyUnreviewed, vocabularyRetrievability } from './vocabularyLearningRead.js';
import { expressionKind, hasMeaning } from './reviewCard.js';
import { backlogBaseline, isBacklogged, orderReviewQueue } from './reviewQueue.js';

export * from './reviewScopeUrl.js';

export function scopeLevelLabel(level) {
  if (level === 'NONE') return '미분류';
  return zhHskLevelLabel(Number(String(level || '').slice(1)));
}

/** 저장된 언어가 없으면 null 언어 그대로. 언어 판정은 저장값 우선, 비었으면 확신할 때만(kana · 프랑스어 부호). */
/** 끝 화면 머리 — 「중국어 · HSK 2 · 내 서재 자료 · 2개」(§5-5). */
export function scopeSummaryLabel(scope, { materialTitles } = {}) {
  if (!scope?.lang) return null;
  return [SCOPE_LANG_LABELS[scope.lang], scope.level && scopeLevelLabel(scope.level),
    scope.source && scopeSourceLabel(scope.source, { materialTitles }), scope.state && scope.state !== 'due' && scopeStateLabel(scope.state),
    scope.type && scopeTypeLabel(scope.type)].filter(Boolean).join(' · ');
}

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
 * 범위 거르기 — 언어 · 급수 · 종류 · 출처(상태는 개수 계산에서). 조회가 필요한 출처는 sourceIds(서버가 준 본인 단어 id),
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
    if (scope.type && expressionKind(word) !== scope.type) return false;
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
  stored: 0, noMeaning: 0, backlog: null, queue: { items: [], ids: [], legacyIds: [], fsrsIds: [] }, scopedIds: [] });

// 범위 안 학습 행(아는 단어 · 제외 · 지원 안 하는 언어 제외)과 상태 판정 — 개수와 FSRS 범위 id가 같은 판정을 쓴다.
// 뜻이 없는 표현은 복습 줄에서 빼고(noMeaning으로 따로 센다) 목록에 「뜻 채우기」를 낸다(§5-6).
// fragileIds = 지난 14일 집중 연습에서 「몰랐어요」 · 오답을 받은 표현(practiceEvents.practiceFragileIds) — 흐릿 범위에 더한다.
function scopedProjections({ snapshot, scope, now, levels, sourceIds, reviewSupported = () => true, fragileIds = null }) {
  const matcher = createScopeMatcher(scope, { levels, sourceIds });
  if (!matcher.ready) return { ready: false, reason: matcher.reason };
  const at = time(now);
  const clock = p => Math.max(at, Date.parse(p.review.evaluatedAt) || at);
  const practiced = new Set([...(fragileIds || [])].map(String));
  const fragile = p => practiced.has(String(p.vocabulary.id)) || (vocabularyRetrievability(p, clock(p)) ?? 1) < FRAGILE_RETRIEVABILITY;
  const stateOk = (p, isNew) => scope.state === 'new' ? isNew : scope.state === 'fragile' ? !isNew && fragile(p) : true;
  const stored = (snapshot?.projections || []).filter(p => p?.vocabulary && matcher.matches(p.vocabulary) && !p.review.known
    && !p.review.excluded && !p.vocabulary.is_excluded && !p.vocabulary.is_known && reviewSupported(p.vocabulary));
  const inScope = stored.filter(p => hasMeaning(p.vocabulary));
  const fsrsIds = inScope.filter(p => p.source === 'fsrs-v1' && isVocabularyReviewAvailable(p) && stateOk(p, isVocabularyUnreviewed(p)))
    .map(p => p.vocabulary.id);
  return { ready: true, at, clock, stateOk, stored, inScope, fsrsIds };
}

/** FSRS controller에 넘길 범위 id(useFsrsReview scopeIds). 범위를 아직 판정할 수 없으면 null — 빈 범위로 출제한다. */
export function scopedFsrsCardIds(args) {
  const scoped = scopedProjections(args);
  return scoped.ready ? scoped.fsrsIds : null;
}

// 띄우기 단위(§6-1 ③) — 교재 과(chapter_slug, 교재 범위 조회가 준다) · 자료 · 덱(source_ref). 모르면 띄우지 않는다.
function sourceKeyOf(word, chapters) {
  const chapter = chapters?.[word.id];
  if (chapter) return `chapter:${chapter}`;
  if (word.source_material_id != null) return `material:${word.source_material_id}`;
  return word.source_ref ? `ref:${word.source_ref}` : null;
}

function planReviewScope({ snapshot, fsrsEntries, quota, scope, now, levels, sourceIds, chapters = null,
  canLegacy = () => true, reviewSupported, fsrsEnabled, pendingIds = [], fragileIds = null, backlog = null }) {
  const scoped = scopedProjections({ snapshot, scope, now, levels, sourceIds, reviewSupported, fragileIds });
  if (!scoped.ready) return empty('pending', scoped.reason);
  const { at, clock, stateOk, inScope, stored } = scoped;
  const byId = new Map(inScope.map(p => [p.vocabulary.id, p]));
  const retrievability = p => (p ? vocabularyRetrievability(p, clock(p)) : null);

  // 예전 일정 — 기존 오늘 세션 계산(reviewsDue · newAvailable · newToday) 그대로.
  const legacy = inScope.filter(p => p.source === 'legacy' && isVocabularyReviewAvailable(p) && canLegacy(p.vocabulary.id));
  const legacyReviews = legacy.filter(p => !isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, clock(p)) && stateOk(p, false));
  const legacyNew = legacy.filter(p => isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, clock(p)) && stateOk(p, true));
  const admitted = new Set(quota?.admittedLegacyCardIds || []);
  const remaining = Math.max(0, Number(quota?.remaining) || 0);

  // FSRS — useFsrsReview controller.queue()의 출제 조건 그대로(범위 id는 이 계획이 controller에 넘긴다).
  const enabled = fsrsEnabled ?? snapshot?.enabled === true;
  const pending = new Set(pendingIds), fsrsIds = new Set(scoped.fsrsIds);
  const entries = enabled ? (fsrsEntries ?? fsrsEntriesFromSnapshot(snapshot)) : [];
  const fsrsScoped = entries.filter(e => fsrsIds.has(e.cardId) && e.eligible !== false && !e.known && !e.excluded && !pending.has(e.cardId));
  const dueAt = e => Math.max(time(e.card?.due), e.nextQuestionAt ? time(e.nextQuestionAt) : -Infinity);
  const fsrsDue = fsrsScoped.filter(e => dueAt(e) <= at);
  const fsrsOpen = quota?.active === true && remaining > 0;
  const fsrsReviews = fsrsDue.filter(e => e.card?.state !== 'New');
  const fsrsNew = fsrsDue.filter(e => e.card?.state === 'New');

  // 밀린 복습 규칙 — 그 언어 전체의 기한 지난 복습이 기준의 2배를 넘으면 새 표현 0(계정 한도는 차감하지 않는다).
  const paused = !!backlog?.active;
  const reviews = [
    ...legacyReviews.map(p => ({ id: p.vocabulary.id, engine: 'legacy', retrievability: retrievability(p),
      dueAt: time(p.review.nextQuestionAt) })),
    ...fsrsReviews.map(e => ({ id: e.cardId, engine: 'fsrs', retrievability: retrievability(byId.get(e.cardId)),
      dueAt: dueAt(e), learning: e.card.state === 'Learning' || e.card.state === 'Relearning' })),
  ];
  const freshOf = (id, engine, introduced) => {
    const word = byId.get(id)?.vocabulary || { id };
    return { id, engine, introduced, sourceKey: sourceKeyOf(word, chapters), createdAt: time(word.created_at) || 0 };
  };
  const resumed = paused ? [] : [
    ...legacyNew.filter(p => admitted.has(p.vocabulary.id)).map(p => freshOf(p.vocabulary.id, 'legacy', true)),
    ...fsrsNew.filter(e => e.firstQuestionAt).map(e => freshOf(e.cardId, 'fsrs', true)),
  ];
  // 아직 시작하지 않은 새 표현은 계정 한도 남은 수 안에서, 담은 순서대로. FSRS는 서버 한도가 열려 있을 때만.
  const unseenAll = [
    ...legacyNew.filter(p => !admitted.has(p.vocabulary.id)).map(p => freshOf(p.vocabulary.id, 'legacy', false)),
    ...fsrsNew.filter(e => !e.firstQuestionAt).map(e => freshOf(e.cardId, 'fsrs', false)),
  ];
  const unseenEligible = unseenAll.filter(item => item.engine === 'legacy' || fsrsOpen)
    .sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
  const unseen = paused ? [] : unseenEligible.slice(0, remaining);
  const resumedTotal = legacyNew.filter(p => admitted.has(p.vocabulary.id)).length + fsrsNew.filter(e => e.firstQuestionAt).length;

  const items = orderReviewQueue({ reviews, fresh: [...resumed, ...unseen] });
  const newAllowed = resumed.length + unseen.length;
  const engines = new Set(items.map(item => item.engine));
  return { status: 'ready', reason: null, stored: stored.length, noMeaning: stored.length - inScope.length,
    scopedIds: stored.map(p => p.vocabulary.id),
    engine: engines.size > 1 ? 'mixed' : [...engines][0] || null,
    due: reviews.length, newAllowed,
    newLocked: unseenAll.length - unseen.length + (paused ? resumedTotal : 0),
    total: items.length, deferred: 0, backlog,
    queue: { items, ids: items.map(item => item.id), legacyIds: items.filter(item => item.engine === 'legacy').map(item => item.id),
      fsrsIds: scoped.fsrsIds } };
}

// 그 언어의 밀린 복습 상태 — 언어 전체(좁힌 범위와 무관)의 기한 지난 복습 수와 지난 14일 기준.
function languageBacklog(shared, lang) {
  const plan = planReviewScope({ ...shared, quota: { active: false, remaining: 0, admittedLegacyCardIds: [] },
    scope: { lang, level: null, source: null, state: 'due' }, sourceIds: null });
  if (plan.status !== 'ready') return null;
  const projections = (shared.snapshot?.projections || []).filter(p => wordScopeLanguage(p?.vocabulary) === lang);
  const baseline = backlogBaseline(projections, { now: time(shared.now) });
  return { overdue: plan.due, baseline, active: isBacklogged(plan.due, baseline) };
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
 *   due        = 범위 안 기한 된 복습(두 엔진 합)
 *   newAllowed = 범위 안 새 표현 중 오늘 시작 가능한 수(계정 한도 남은 수 이내, 밀린 복습이면 0)
 *   newLocked  = 한도 · 밀린 복습에 막혀 오늘 시작하지 못하는 새 표현
 *   total      = due + newAllowed = 시작하는 줄 길이(queue.items — 두 엔진이 섞인 한 줄)
 *   grammarDue = 그 언어 문법 복습(별줄, total에 넣지 않는다)
 *   byLang     = 언어 칩 숫자(그 언어만 고른 범위의 total)
 *   backlog    = { overdue, baseline, active } — 그 언어의 밀린 복습 상태(문구 「밀린 복습부터」)
 *   noMeaning  = 범위 안 뜻 없는 표현(줄에서 뺀 수)
 * 입력: snapshot = fetchVocabularyLearningRows 결과(projections), fsrsEntries = FSRS controller의 cards(없으면
 * snapshot에서), quota = { remaining, active, admittedLegacyCardIds }. 급수 · 출처 범위는 levels · sourceIds가 있어야 센다.
 * chapters = 교재 범위 조회의 단어별 과(띄우기 단위), fragileIds = 집중 연습 「몰랐어요」 표현(흐릿 범위).
 */
export function countReviewScope({ snapshot, fsrsEntries, quota, scope, now = Date.now(), grammar = null,
  levels = null, sourceIds = null, chapters = null, canLegacy, reviewSupported, fsrsEnabled, pendingIds, fragileIds = null } = {}) {
  const shared = { snapshot, fsrsEntries, quota, now, levels, canLegacy, reviewSupported, fsrsEnabled, pendingIds, fragileIds };
  const backlogs = new Map();
  const backlogOf = lang => {
    if (!backlogs.has(lang)) backlogs.set(lang, languageBacklog(shared, lang));
    return backlogs.get(lang);
  };
  const plan = planReviewScope({ ...shared, scope, sourceIds, chapters, backlog: scope?.lang ? backlogOf(scope.lang) : null });
  const byLang = {};
  for (const lang of REVIEW_SCOPE_LANGS) {
    if (!(snapshot?.projections || []).some(p => wordScopeLanguage(p?.vocabulary) === lang)) continue;
    byLang[lang] = planReviewScope({ ...shared, scope: { lang, level: null, source: null, state: 'due' }, backlog: backlogOf(lang) }).total;
  }
  return { ...plan, grammarDue: scope?.lang ? grammarDueCount(grammar, scope.lang, time(now)) : 0, byLang };
}

/**
 * 담은 표현의 언어별 수(언어 칩 · 범위 언어 기본값) — 순서는 표현이 처음 나온 순서. 복습방과 서버 첫 화면 숫자(reviewRoomFirstScreen)가
 * 같은 함수를 쓴다(VOCAB-FIRST-NUMBERS-001 — 언어 칩 순서 · 기본 언어가 목록이 온 뒤에도 그대로여야 숫자가 튀지 않는다).
 */
export function reviewLanguageCounts(words) {
  const counts = new Map();
  for (const word of words || []) {
    const lang = wordScopeLanguage(word);
    if (REVIEW_SCOPE_LANGS.includes(lang)) counts.set(lang, (counts.get(lang) || 0) + 1);
  }
  return counts;
}

/** 프로필의 학습 언어(배움 언어 칩이 고른 첫 언어). */
export function profileReviewLang(profile) {
  return Array.isArray(profile?.learning_language) ? profile.learning_language[0] : profile?.learning_language;
}

/** 범위 언어 기본값 — 주소 · 저장값이 없으면 학습 언어, 그 언어에 담은 표현이 없으면 가장 많은 언어. */
export function defaultReviewLang(profileLang, languageCounts) {
  return languageCounts.has(profileLang) ? profileLang
    : [...languageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || (REVIEW_SCOPE_LANGS.includes(profileLang) ? profileLang : 'Japanese');
}

/**
 * 집중 연습 대상(§6-1 ④) — 범위 안 표현 전체(기한과 무관). 새 표현만 · 흐릿 · 위험 범위는 그 상태만. 잊기 쉬운 순서.
 * vocab = 범위 안 표현, learningById = 투영(id → projection), fragileIds = 지난 14일 집중 연습 「몰랐어요」 · 오답 표현.
 */
export function scopePracticeWords(vocab, learningById, { reviewSupported = () => true, state = 'due', fragileIds = [], now = Date.now() } = {}) {
  const fragile = new Set(fragileIds);
  const rows = [];
  for (const word of vocab || []) {
    const p = learningById.get(word.id);
    if (!p || p.review.known || p.review.excluded || !reviewSupported(word) || !hasMeaning(word)) continue;
    const r = vocabularyRetrievability(p, Math.max(now, Date.parse(p.review.evaluatedAt) || 0));
    const isNew = isVocabularyUnreviewed(p);
    if (state === 'new' && !isNew) continue;
    if (state === 'fragile' && (isNew || !(fragile.has(String(word.id)) || (r ?? 1) < FRAGILE_RETRIEVABILITY))) continue;
    rows.push({ word, r: r ?? 2 });
  }
  return rows.sort((a, b) => a.r - b.r).map(row => row.word);
}
