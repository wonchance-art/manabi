// 복습방 첫 화면 숫자(VOCAB-FIRST-NUMBERS-001 — 로그인 감사 F2, 오너 승인 2026-10-25 KST 「권장대로」).
// /vocab은 전부 브라우저가 받아 그렸다 — 하이드레이션 뒤에야 전체 학습 목록(3,000단어 계정 2.2 MB)을 요청해 모바일 첫 숫자가 2.3 s.
// 서버가 같은 정본(학습 snapshot · FSRS 목록 · 입장 한도 · 한국어 능력 · 프로필 언어)으로 「오늘」 카드 숫자를 미리 세어 HTML에 싣고,
// 전체 목록은 뒤에서 받는다. 숫자는 브라우저가 목록을 다 받은 뒤 세는 값과 **같은 함수 · 같은 입력**이다:
//   개수 = countReviewScope(복습방 countFor와 같은 인자 모양), 언어 칩 순서 · 기본 언어 = reviewLanguageCounts · defaultReviewLang,
//   집중 연습 유무 = scopePracticeWords. 계약: reviewRoomFirstScreen.test.js(서버 값 == 실제 FSRS controller · 입장 정규화로 센 브라우저 값).
// 브라우저 값만 아는 입력(이 기기의 대기 채점 · 호환 모드의 기기 한도)이 다르면 목록이 온 뒤 브라우저 값으로 조용히 바뀐다.
// 학습일 경계(04:00 KST, #1561)나 짧은 유효 시간을 넘긴 숫자는 쓰지 않는다(그때는 지금처럼 골격).
import { countReviewScope, createScopeMatcher, defaultReviewLang, reviewLanguageCounts, reviewScopeQuota, scopePracticeWords,
  REVIEW_SCOPE_LANGS } from './reviewScope.js';
import { canUseLegacyAdmissionCompatibility, normalizeAdmissionStatus } from './learningAdmission.js';
import { learningLanguageCapabilities } from './learningCapabilities.js';
import { learningDay, learningDayStart } from './fsrsScheduler.js';

export const FIRST_SCREEN_VERSION = 1;
/** 서버가 센 숫자를 믿는 시간 — 문서가 오고 하이드레이션 · 로그인 복원까지(모바일 약 1–2 s)면 충분하다. 넘으면 버린다(bfcache 등). */
export const FIRST_SCREEN_TTL_MS = 120000;

/** 첫 화면 숫자를 쓰는 범위 — 언어만 고른 「오늘」 범위. 급수 · 출처 · 상태 · 종류는 브라우저만 아는 조회(급수 표 · 출처 id)가 필요하다. */
export function plainReviewScope(scope) {
  return !!scope?.lang && REVIEW_SCOPE_LANGS.includes(scope.lang) && !scope.level && !scope.source
    && (scope.state || 'due') === 'due' && !scope.type;
}

/**
 * 서버 첫 화면 숫자 — 입력은 브라우저가 받는 것과 같은 응답 본문(JSON 모양)이다.
 *   learning = projectVocabularyLearningRows(GET /api/learning/vocabulary?view=learning 본문)
 *   fsrs = readFsrsStatus(GET /api/learning/fsrs 본문 — 입장 한도 admission 포함, GET /api/learning/admission과 같은 읽기)
 *   capabilities = readLearningCapabilities(한국어 표현이 있을 때만), profileLang = profiles.learning_language 첫 값
 * 브라우저 값과 같게 만들 수 없는 경우는 null(지금처럼 골격): 정본이 불완전 · 호환 모드(기기 하루 한도) · 계정 불일치.
 */
export function buildReviewRoomFirstScreen({ actorId, learning, fsrs, capabilities = null, profileLang, now = Date.now(), langs = null }) {
  if (!actorId || learning?.actorId !== actorId || learning.complete !== true || !Array.isArray(learning.projections)) return null;
  if (fsrs?.actorId !== actorId || fsrs.registryAvailable !== true || !Array.isArray(fsrs.cards)) return null;
  let quota;
  try { quota = normalizeAdmissionStatus(fsrs.admission, { actorId }); } catch { return null; }
  if (canUseLegacyAdmissionCompatibility(quota)) return null;
  const at = Math.max(now, Date.parse(learning.now) || 0);
  // 브라우저 VocabWorkspace의 입력과 같은 모양: 한도(reviewScopeQuota) · FSRS controller(cards · enabled · canLegacy) · 한국어 능력.
  const scopeQuota = reviewScopeQuota({ quota, compatibility: false });
  const cardIds = new Set(fsrs.cards.map(entry => entry.cardId));
  const koreanReview = learningLanguageCapabilities('Korean', capabilities).review;
  const reviewSupported = word => word?.language !== 'Korean' || koreanReview;
  const learningById = new Map(learning.projections.map(row => [row.vocabulary.id, row]));
  const counts = reviewLanguageCounts(learning.rows);
  const defaultLang = defaultReviewLang(profileLang, counts);
  const plans = {};
  let byLang = {};
  for (const lang of langs || new Set([...counts.keys(), defaultLang])) {
    const scope = { lang, level: null, source: null, state: 'due' };
    const count = countReviewScope({ snapshot: { projections: learning.projections, enabled: true }, scope, now: at, levels: null,
      sourceIds: null, reviewSupported, chapters: null, quota: scopeQuota, fsrsEntries: fsrs.cards, fsrsEnabled: fsrs.enabled === true,
      pendingIds: [], canLegacy: id => !cardIds.has(id), grammar: null, fragileIds: [] });
    if (count.status !== 'ready') return null;
    byLang = count.byLang;
    const matcher = createScopeMatcher(scope);
    const practice = scopePracticeWords(learning.rows.filter(matcher.matches), learningById, { reviewSupported, state: 'due', fragileIds: [], now: at }).length > 0;
    plans[lang] = { total: count.total, due: count.due, newAllowed: count.newAllowed, newLocked: count.newLocked, noMeaning: count.noMeaning,
      stored: count.stored, backlog: count.backlog, practice };
  }
  return { version: FIRST_SCREEN_VERSION, actorId, at: new Date(at).toISOString(),
    // 학습일이 바뀌면(04:00 KST) 기한 · 새 표현 한도가 한꺼번에 바뀐다 — 그 전까지만, 그리고 TTL 안에서만 쓴다.
    validUntil: new Date(Math.min(at + FIRST_SCREEN_TTL_MS, learningDayStart(learningDay(at) + 1))).toISOString(),
    profileLang: profileLang ?? null, languages: [...counts.entries()], hasAnyWords: learning.rows.length > 0,
    remainingNew: scopeQuota?.remaining ?? 0, byLang, plans };
}

/**
 * 브라우저: 지금 범위에 쓸 첫 화면 값(오늘 카드 · 범위 막대가 그리는 모양) — 쓸 수 없으면 null.
 * session은 countReviewScope 결과에서 화면이 읽는 칸만 같은 이름으로 담는다(줄 queue는 비어 있다 — 시작 단추는 목록이 온 뒤에 연다).
 */
export function firstScreenSession(first, { actorId, scope, now = Date.now() } = {}) {
  if (!first || first.version !== FIRST_SCREEN_VERSION || !actorId || first.actorId !== actorId || !plainReviewScope(scope)) return null;
  if (!(now < Date.parse(first.validUntil))) return null;
  const plan = first.plans?.[scope.lang];
  if (!plan) return null;
  return {
    session: { status: 'ready', reason: null, engine: null, total: plan.total, due: plan.due, newAllowed: plan.newAllowed, newLocked: plan.newLocked,
      noMeaning: plan.noMeaning, stored: plan.stored, deferred: 0, backlog: plan.backlog, grammarDue: 0, byLang: first.byLang || {},
      scopedIds: [], queue: { items: [], ids: [], legacyIds: [], fsrsIds: [] } },
    practice: plan.practice === true, remainingNew: first.remainingNew ?? 0, hasAnyWords: first.hasAnyWords === true,
  };
}

/** 브라우저: 서버가 실은 첫 화면 값을 이 계정 · 유효 시간 안에서만 꺼낸다(다른 계정 · 손님 · 지난 값은 null). */
export function ownFirstScreen(first, actorId, now = Date.now()) {
  return first && first.version === FIRST_SCREEN_VERSION && actorId && first.actorId === actorId && now < Date.parse(first.validUntil) ? first : null;
}
