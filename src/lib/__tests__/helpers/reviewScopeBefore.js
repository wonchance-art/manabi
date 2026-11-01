// 바꾸기 전 구현(origin/main 24aea2b67의 src/lib/reviewScope.js 72–288행 · reviewQueue.js backlogBaseline) — 같음 증명의 기준(VOCAB-SCOPE-PERF-001).
// 제품 코드가 아니다: reviewScopeEquivalence.test.js만 읽는다. 공유 판정(범위 거르기 · 학습 상태 · 형제 규칙 · 줄 순서)은 정본 모듈을 그대로 부르고,
// 이번에 바꾼 부분(언어별 개수 셈 · 밀린 복습 기준 · 묻는 시각 풀이)이 든 계획 함수들은 예전 글자 그대로 둔다. 정본 규칙을 고쳐 숫자가 바뀌어야 하는
// 변경이면 이 파일도 함께 고친다(같음 계약은 「최적화가 결과를 바꾸지 않았다」만 증명한다).
import { REVIEW_SCOPE_LANGS, FRAGILE_RETRIEVABILITY } from '../../reviewScopeUrl.js';
import { createScopeMatcher, wordScopeLanguage } from '../../reviewScope.js';
import { isVocabularyReviewAvailable, isVocabularyReviewDue, isVocabularyUnreviewed, vocabularyRetrievability } from '../../vocabularyLearningRead.js';
import { hasMeaning } from '../../reviewCard.js';
import { BACKLOG_DEFAULT_BASELINE, BACKLOG_WINDOW_DAYS, isBacklogged, orderReviewQueue } from '../../reviewQueue.js';
import { cardKindOf, cardVocabularyId, pickSiblings } from '../../fsrsCardKinds.js';

export function backlogBaselineBefore(projections, { now = Date.now() } = {}) {
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

function fsrsEntriesFromSnapshot(snapshot) {
  return (snapshot?.projections || []).filter(p => p?.source === 'fsrs-v1').map(p => ({
    cardId: p.vocabulary.id, card: { state: p.memory.state, due: p.memory.due },
    nextQuestionAt: p.review.nextQuestionAt, firstQuestionAt: p.review.firstQuestionAt,
    eligible: p.review.eligible, known: p.review.known, excluded: p.review.excluded,
  }));
}

const time = value => (typeof value === 'number' ? value : Date.parse(value));
const empty = (status, reason) => ({ status, reason, engine: null, due: 0, newAllowed: 0, newLocked: 0, total: 0, deferred: 0,
  stored: 0, noMeaning: 0, backlog: null, queue: { items: [], ids: [], legacyIds: [], fsrsIds: [] }, scopedIds: [] });

// 뜻이 있는지(hasMeaning — NFC 정규화)는 표현 객체 · 뜻 문자열이 같으면 같다. 계획마다 다시 정규화하지 않는다(뜻이 바뀌면 다시 본다).
const MEANINGFUL = new WeakMap();
function meaningful(word) {
  const hit = MEANINGFUL.get(word);
  if (hit && hit.meaning === word.meaning) return hit.value;
  const value = hasMeaning(word);
  MEANINGFUL.set(word, { meaning: word.meaning, value });
  return value;
}

// 범위 안 학습 행(아는 단어 · 제외 · 지원 안 하는 언어 제외)과 상태 판정 — 개수와 FSRS 범위 id가 같은 판정을 쓴다.
// 뜻이 없는 표현은 복습 줄에서 빼고(noMeaning으로 따로 센다) 목록에 「뜻 채우기」를 낸다(§5-6).
// fragileIds = 지난 14일 집중 연습에서 「몰랐어요」 · 오답을 받은 표현(practiceEvents.practiceFragileIds) — 흐릿 범위에 더한다.
function scopedProjections({ snapshot, scope, now, levels, sourceIds, reviewSupported = () => true, fragileIds = null }) {
  const matcher = createScopeMatcher(scope, { levels, sourceIds });
  if (!matcher.ready) return { ready: false, reason: matcher.reason };
  const at = time(now);
  // 평가 시각은 한 snapshot 안에서 거의 다 같은 문자열이다 — 직전 문자열의 풀이를 다시 쓴다(VOCAB-SCOPE-COUNT-001: 계획마다 표현 수 × 여러 번
  // Date.parse가 이 계산의 가장 큰 몫이었다). 값은 그대로 Date.parse(…) || at.
  let lastEvaluated, lastParsed;
  const clock = p => {
    const value = p.review.evaluatedAt;
    if (value !== lastEvaluated) { lastEvaluated = value; lastParsed = Date.parse(value) || at; }
    return Math.max(at, lastParsed);
  };
  const practiced = new Set([...(fragileIds || [])].map(String));
  const fragile = p => practiced.has(String(p.vocabulary.id)) || (vocabularyRetrievability(p, clock(p)) ?? 1) < FRAGILE_RETRIEVABILITY;
  const stateOk = (p, isNew) => scope.state === 'new' ? isNew : scope.state === 'fragile' ? !isNew && fragile(p) : true;
  const stored = (snapshot?.projections || []).filter(p => p?.vocabulary && matcher.matches(p.vocabulary) && !p.review.known
    && !p.review.excluded && !p.vocabulary.is_excluded && !p.vocabulary.is_known && reviewSupported(p.vocabulary));
  const inScope = stored.filter(p => meaningful(p.vocabulary));
  const fsrsIds = inScope.filter(p => p.source === 'fsrs-v1' && isVocabularyReviewAvailable(p) && stateOk(p, isVocabularyUnreviewed(p)))
    .map(p => p.vocabulary.id);
  return { ready: true, at, clock, stateOk, stored, inScope, fsrsIds };
}

function scopedFsrsCardIds(args) {
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

// countOnly — 언어 칩 숫자(byLang) · 밀린 복습 판정(languageBacklog)은 개수만 쓴다. 줄 짜기(회상률 · 정렬 · 출처 띄우기)를 건너뛰고
// due · total만 낸다 — total은 줄 길이와 같다(orderReviewQueue는 넣은 항목을 빼거나 더하지 않는다, 계약 reviewScopeCount).
// 3,000단어 계정 첫 화면에서 이 계산이 언어마다 두 번씩 돌았다(VOCAB-SCOPE-COUNT-001).
function planReviewScope({ snapshot, fsrsEntries, quota, scope, now, levels, sourceIds, chapters = null,
  canLegacy = () => true, reviewSupported, fsrsEnabled, pendingIds = [], fragileIds = null, backlog = null, countOnly = false }) {
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
  // 카드 종류(CARD-TYPES-001 4단계): 범위는 카드가 묻는 단어(cardVocabularyId)로 본다 · 쉬는 카드(꺼진 종류)는 뺀다 · 같은 단어의 카드는 학습일에
  // 한 장(pickSiblings — 단어 페이지와 같은 공유 규칙) · 하루 새 단어 몫은 단어 → 뜻의 첫 질문만이라 막 붙은 종류 카드(New)는 복습 줄에 선다.
  // 종류 카드가 없으면(단어 → 뜻만 — 기본값) 지금 줄 그대로다(계약 reviewScopeCount · cardTypesRoom).
  const enabled = fsrsEnabled ?? snapshot?.enabled === true;
  const pending = new Set(pendingIds), fsrsIds = new Set(scoped.fsrsIds);
  const entries = enabled ? (fsrsEntries ?? fsrsEntriesFromSnapshot(snapshot)) : [];
  const fsrsScoped = entries.filter(e => fsrsIds.has(cardVocabularyId(e)) && e.resting !== true && e.eligible !== false && !e.known && !e.excluded && !pending.has(e.cardId));
  const dueAt = e => Math.max(time(e.card?.due), e.nextQuestionAt ? time(e.nextQuestionAt) : -Infinity);
  const fsrsDue = pickSiblings(fsrsScoped.filter(e => dueAt(e) <= at), { cards: entries, at });
  const fsrsOpen = quota?.active === true && remaining > 0;
  const fresh = e => cardKindOf(e) === 'recognition' && e.card?.state === 'New';
  const fsrsReviews = fsrsDue.filter(e => !fresh(e));
  const fsrsNew = fsrsDue.filter(fresh);

  // 밀린 복습 규칙 — 그 언어 전체의 기한 지난 복습이 기준의 2배를 넘으면 새 표현 0(계정 한도는 차감하지 않는다).
  const paused = !!backlog?.active;
  if (countOnly) {
    const due = legacyReviews.length + fsrsReviews.length;
    if (paused) return { status: 'ready', due, total: due };
    const resumedCount = legacyNew.filter(p => admitted.has(p.vocabulary.id)).length + fsrsNew.filter(e => e.firstQuestionAt).length;
    const unseenCount = legacyNew.filter(p => !admitted.has(p.vocabulary.id)).length
      + (fsrsOpen ? fsrsNew.filter(e => !e.firstQuestionAt).length : 0);
    return { status: 'ready', due, total: due + resumedCount + Math.min(unseenCount, remaining) };
  }
  const reviews = [
    ...legacyReviews.map(p => ({ id: p.vocabulary.id, engine: 'legacy', retrievability: retrievability(p),
      dueAt: time(p.review.nextQuestionAt) })),
    ...fsrsReviews.map(e => ({ id: e.cardId, engine: 'fsrs', retrievability: cardKindOf(e) === 'recognition' ? retrievability(byId.get(e.cardId)) : null,
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

// 언어별 밀린 복습 기준(backlogBaseline)은 같은 projections · 같은 시각이면 같다 — 범위 시트 · 안내가 countReviewScope를 여러 번 불러도
// 한 번만 잰다(VOCAB-SCOPE-COUNT-001). projections 배열이 바뀌면(새 snapshot · 채점 뒤 재투영) 새로 잰다.
const BASELINES = new WeakMap();
function languageBaseline(projections, lang, now) {
  let byLang = BASELINES.get(projections);
  if (!byLang) BASELINES.set(projections, byLang = new Map());
  const hit = byLang.get(lang);
  if (hit && Object.is(hit.now, now)) return hit.value;
  const value = backlogBaselineBefore(projections.filter(p => wordScopeLanguage(p?.vocabulary) === lang), { now });
  byLang.set(lang, { now, value });
  return value;
}

// 그 언어의 밀린 복습 상태 — 언어 전체(좁힌 범위와 무관)의 기한 지난 복습 수와 지난 14일 기준.
function languageBacklog(shared, lang) {
  const plan = planReviewScope({ ...shared, quota: { active: false, remaining: 0, admittedLegacyCardIds: [] },
    scope: { lang, level: null, source: null, state: 'due' }, sourceIds: null, countOnly: true });
  if (plan.status !== 'ready') return null;
  const baseline = languageBaseline(shared.snapshot?.projections || [], lang, time(shared.now));
  return { overdue: plan.due, baseline, active: isBacklogged(plan.due, baseline) };
}

/**
 * 새 표현 한도 → countReviewScope의 quota 입력(복습방 · 배움 칸 공용 — 두 화면 숫자가 같은 한도를 쓴다).
 * 호환 모드(서버 한도 없음)는 이 기기의 하루 한도에서 오늘 시작한 수를 빼고, 아니면 서버의 남은 수.
 * admission = useLearningAdmission 결과, newPerDay · introIds = 기기 설정(vocab_new_per_day · loadIntroIds),
 * vocabIds = 지금 계정에 있는 단어 id(지운 단어의 시작 기록은 빼고 센다). 한도를 아직 모르면 null.
 */
function reviewScopeQuota(admission, { newPerDay = 0, introIds = [], vocabIds = null } = {}) {
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
export function countReviewScopeBefore({ snapshot, fsrsEntries, quota, scope, now = Date.now(), grammar = null,
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
    byLang[lang] = planReviewScope({ ...shared, scope: { lang, level: null, source: null, state: 'due' }, backlog: backlogOf(lang), countOnly: true }).total;
  }
  return { ...plan, grammarDue: scope?.lang ? grammarDueCount(grammar, scope.lang, time(now)) : 0, byLang };
}
