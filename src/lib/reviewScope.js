// 복습 범위(REV-SCOPE R1-A, #1337 6106712027). 범위 하나가 개수 · 시작 · 줄을 함께 정한다.
// 주소 문법 · 판정 · 개수는 이 파일 하나가 정본이다 — 배움 칸 · 국기 칩 · 복습방이 모두
// countReviewScope를 부른다(화면마다 따로 세지 않는다). 순수 모듈: 조회·저장은 하지 않는다.
import { detectLang } from './constants';
import { safeBookReturn } from './bookReviewNavigation';
import { BOOK_ID } from './textbook/contract';
import {
  isVocabularyReviewAvailable, isVocabularyReviewDue, isVocabularyUnreviewed, vocabularyRetrievability,
} from './vocabularyLearningRead';

export const REVIEW_SCOPE_LANGS = Object.freeze(['Japanese', 'Chinese', 'English', 'French']);
export const REVIEW_SCOPE_LEVELS = Object.freeze({ Chinese: Object.freeze(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'NONE']) });
export const REVIEW_SCOPE_STATES = Object.freeze(['due', 'new', 'fragile']);
/** 교재는 일본어 N5 한 권뿐이다(contract.js). 다른 언어 + 교재는 무효. */
export const REVIEW_SCOPE_BOOKS = Object.freeze({ [BOOK_ID]: Object.freeze({ lang: 'Japanese', lessons: 42 }) });
export const STUDY_SOURCE_REF = '오늘 학습';
/** 기억 건강의 흐릿(0.4–0.7) · 위험(0.4 미만) 경계 — VocabStats 기억 건강 칸과 같은 값. */
export const FRAGILE_RETRIEVABILITY = 0.7;
/** 밀린 복습 규칙: 기준 = 지난 14일 하루 평균 완료 복습 수, 기록이 없으면 20. 기준의 2배를 넘으면 새 표현 0. */
export const BACKLOG_HISTORY_DAYS = 14;
export const BACKLOG_DEFAULT_DAILY = 20;
export const BACKLOG_FACTOR = 2;

const KNOWN_KEYS = ['lang', 'level', 'src', 'state', 'book'];
const MATERIAL_ID = /^[1-9]\d{0,18}$/;
const MAX_MATERIALS = 20;
const invalid = reason => Object.freeze({ invalid: true, reason });

export const reviewWordLang = word => word?.language || detectLang(word?.word_text || '');

function one(params, key) {
  const value = params?.[key];
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : Symbol.for('invalid');
}

function parseSource(raw) {
  if (raw === 'study') return { kind: 'study' };
  const book = /^book:([a-z0-9-]{1,40}):([1-9]\d?)-([1-9]\d?)$/.exec(raw);
  if (book) {
    const spec = REVIEW_SCOPE_BOOKS[book[1]];
    const from = Number(book[2]), to = Number(book[3]);
    if (!spec || from > to || to > spec.lessons || raw !== `book:${book[1]}:${from}-${to}`) return null;
    return { kind: 'book', bookId: book[1], from, to };
  }
  if (raw.startsWith('deck:')) {
    // 주소에서는 `deck:<encodeURIComponent(source_ref)>`이고, 쿼리를 읽으면 원래 글자가 된다.
    const ref = raw.slice(5);
    if (!ref.trim() || ref.length > 200 || ref === STUDY_SOURCE_REF) return null;
    return { kind: 'deck', ref };
  }
  const material = /^(material|note):(.+)$/.exec(raw);
  if (material) {
    const ids = material[2].split(',');
    if (!ids.every(id => MATERIAL_ID.test(id)) || new Set(ids).size !== ids.length) return null;
    if (material[1] === 'note' ? ids.length !== 1 : ids.length > MAX_MATERIALS) return null;
    return { kind: material[1], ids };
  }
  return null;
}

/**
 * 주소 → 범위. 명시한 값이 하나라도 무효면 「전체」로 새지 않고 `{ invalid }`를 돌려준다.
 * 아무 범위 값이 없으면 `explicit:false`로 기본 범위(배움 언어 하나)를 낸다.
 * 예전 `?book=japanese-n5&returnTo=`는 `src=book:japanese-n5:1-42` + 돌아갈 곳으로 읽는다.
 */
export function parseReviewScope(params = {}, { defaultLang = 'Japanese' } = {}) {
  const values = Object.fromEntries(KNOWN_KEYS.map(key => [key, one(params, key)]));
  if (Object.values(values).some(value => typeof value === 'symbol')) return invalid('repeated');
  const explicit = KNOWN_KEYS.some(key => values[key] !== undefined);
  let src = null;
  if (values.book !== undefined) {
    if (values.src !== undefined || !REVIEW_SCOPE_BOOKS[values.book]) return invalid('src');
    src = { kind: 'book', bookId: values.book, from: 1, to: REVIEW_SCOPE_BOOKS[values.book].lessons };
  } else if (values.src !== undefined) {
    src = parseSource(values.src);
    if (!src) return invalid('src');
  }
  const bookLang = src?.kind === 'book' ? REVIEW_SCOPE_BOOKS[src.bookId].lang : null;
  const lang = values.lang ?? bookLang ?? (REVIEW_SCOPE_LANGS.includes(defaultLang) ? defaultLang : 'Japanese');
  if (!REVIEW_SCOPE_LANGS.includes(lang) || (bookLang && bookLang !== lang)) return invalid('lang');
  if (values.level !== undefined && !(REVIEW_SCOPE_LEVELS[lang] || []).includes(values.level)) return invalid('level');
  const state = values.state ?? 'due';
  if (!REVIEW_SCOPE_STATES.includes(state)) return invalid('state');
  const scope = Object.freeze({ lang, ...(values.level ? { level: values.level } : {}), ...(src ? { src: Object.freeze(src) } : {}), state });
  const returnTo = src?.kind === 'book' ? safeBookReturn(one(params, 'returnTo')) : null;
  return Object.freeze({ invalid: false, explicit, scope, returnTo });
}

export function serializeReviewSource(src) {
  if (!src) return null;
  if (src.kind === 'book') return `book:${src.bookId}:${src.from}-${src.to}`;
  if (src.kind === 'deck') return `deck:${encodeURIComponent(src.ref)}`;
  if (src.kind === 'material' || src.kind === 'note') return `${src.kind}:${src.ids.join(',')}`;
  return src.kind === 'study' ? 'study' : null;
}

// 주소에 쓰는 글자만 이스케이프한다. 「:」 「,」는 쿼리에서 그대로 읽히므로 남겨 두어 주소가 읽히게 한다.
const queryValue = value => encodeURIComponent(value).replace(/%3A/gi, ':').replace(/%2C/gi, ',');

/** 범위 → 쿼리 문자열(앞의 ?는 없음). 순서 고정: lang · level · src · state(기본 due는 생략). */
export function serializeReviewScope(scope) {
  const parts = [['lang', scope.lang]];
  if (scope.level) parts.push(['level', scope.level]);
  const src = serializeReviewSource(scope.src);
  if (src) parts.push(['src', src]);
  if (scope.state && scope.state !== 'due') parts.push(['state', scope.state]);
  return parts.map(([key, value]) => `${key}=${key === 'src' && scope.src.kind === 'deck' ? value : queryValue(value)}`).join('&');
}

export function reviewScopeHref(scope, { returnTo } = {}) {
  const safe = scope.src?.kind === 'book' ? safeBookReturn(returnTo) : null;
  return `/vocab?${serializeReviewScope(scope)}${safe ? `&returnTo=${encodeURIComponent(safe)}` : ''}`;
}

/** 저장 · 이어 하기 키. 주소와 같은 문자열이다. */
export const reviewScopeKey = scope => serializeReviewScope(scope);

export function bookChapterSlugs(src) {
  if (src?.kind !== 'book') return [];
  return Array.from({ length: src.to - src.from + 1 }, (_, index) => `n5-book-u${String(src.from + index).padStart(2, '0')}`);
}

/** 화면에 붙이는 범위 이름(예: 「교재 5–10과」). 칩 · 제목이 같은 글자를 쓴다. */
export function reviewScopeSourceLabel(src, { materialTitle } = {}) {
  if (!src) return null;
  if (src.kind === 'book') {
    const whole = src.from === 1 && src.to === REVIEW_SCOPE_BOOKS[src.bookId].lessons;
    return whole ? '교재 · 전체 과' : src.from === src.to ? `교재 ${src.from}과` : `교재 ${src.from}–${src.to}과`;
  }
  if (src.kind === 'deck') return src.ref;
  if (src.kind === 'study') return STUDY_SOURCE_REF;
  if (src.kind === 'note') return materialTitle?.(src.ids[0]) || '노트';
  if (src.ids.length === 1) return materialTitle?.(src.ids[0]) || '내 서재 자료';
  return `내 서재 자료 · ${src.ids.length}개`;
}

export const reviewLevelLabel = level => (level === 'NONE' ? '미분류' : /^H[1-6]$/.test(level || '') ? `HSK ${level.slice(1)}` : null);
export const reviewStateLabel = state => ({ due: '복습할 때 된 것', new: '새 표현만', fragile: '흐릿 · 위험' })[state] || null;

/**
 * 범위 판정. `sourceIds`는 교재 · 자료 · 노트 범위에서 서버가 돌려준 단어 id 묶음이다(없으면 그 범위는 0개).
 * `levelOf(word)`는 레퍼런스 사전 급수(H1–H6, 그 밖은 미분류)를 돌려준다.
 */
export function reviewScopeMatcher(scope, { sourceIds = null, levelOf = () => null } = {}) {
  const src = scope.src;
  const ids = sourceIds instanceof Set ? sourceIds : sourceIds ? new Set(sourceIds) : null;
  return word => {
    if (!word || reviewWordLang(word) !== scope.lang) return false;
    if (scope.level) {
      const level = levelOf(word);
      if ((/^H[1-6]$/.test(level || '') ? level : 'NONE') !== scope.level) return false;
    }
    if (!src) return true;
    if (src.kind === 'deck') return word.source_ref === src.ref;
    if (src.kind === 'study') return word.source_ref === STUDY_SOURCE_REF;
    if (src.kind === 'material' && src.ids.includes(String(word.source_material_id ?? ''))) return true;
    return !!ids?.has(word.id);
  };
}

/** 밀린 복습 기준(그 언어의 지난 14일 하루 평균 완료 복습 수). 기록이 없거나 못 읽으면 20. */
export function backlogBaseline(history, lang) {
  const count = history?.[lang];
  return Number.isFinite(count) && count > 0 ? count / BACKLOG_HISTORY_DAYS : BACKLOG_DEFAULT_DAILY;
}

const hasMeaning = word => typeof word?.meaning === 'string' && word.meaning.trim().length > 0;
const fsrsEntryIsNew = entry => entry?.card?.state === 'New' && !entry.firstQuestionAt;

function retrievable(projection, at) {
  try { return vocabularyRetrievability(projection, at); } catch { return null; }
}

function buildLine({ projections, fsrsEntries, quota, scope, now, match, history, supported, canLegacy }) {
  const at = Math.max(now, ...projections.map(p => Date.parse(p.review.evaluatedAt) || 0));
  // 아는 단어 · 제외 · 뜻 없음 · 지원 안 하는 언어는 어느 범위에도 넣지 않는다.
  const eligible = projections.filter(p => isVocabularyReviewAvailable(p) && supported(p.vocabulary)
    && hasMeaning(p.vocabulary) && reviewWordLang(p.vocabulary) === scope.lang);
  const inScope = eligible.filter(p => match(p.vocabulary));
  const scopedIds = new Set(inScope.map(p => p.vocabulary.id));
  const legacy = inScope.filter(p => p.source === 'legacy' && canLegacy(p.vocabulary.id));
  const fsrsReady = fsrsEntries
    ? fsrsEntries.filter(entry => scopedIds.has(entry.cardId))
    : inScope.filter(p => p.source === 'fsrs-v1' && isVocabularyReviewDue(p, at))
      .map(p => ({ cardId: p.vocabulary.id, card: { state: p.memory.state }, firstQuestionAt: p.review.firstQuestionAt }));
  const byId = new Map(inScope.map(p => [p.vocabulary.id, p]));

  // 기준은 범위가 아니라 그 언어 전체의 밀린 복습이다.
  const languageOverdue = eligible.filter(p => !isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, at)
    && (p.source !== 'legacy' || canLegacy(p.vocabulary.id))).length;
  const backlogBlocked = languageOverdue > BACKLOG_FACTOR * backlogBaseline(history, scope.lang);

  let legacyReviews = [], legacyNew = [], fsrsReviewIds = [], fsrsNewIds = [];
  if (scope.state === 'fragile') {
    legacyReviews = legacy.filter(p => !isVocabularyUnreviewed(p) && (retrievable(p, at) ?? 1) < FRAGILE_RETRIEVABILITY);
    fsrsReviewIds = fsrsReady.filter(entry => !fsrsEntryIsNew(entry)
      && (retrievable(byId.get(entry.cardId), at) ?? 1) < FRAGILE_RETRIEVABILITY).map(entry => entry.cardId);
  } else {
    if (scope.state !== 'new') {
      legacyReviews = legacy.filter(p => !isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, at));
      fsrsReviewIds = fsrsReady.filter(entry => !fsrsEntryIsNew(entry)).map(entry => entry.cardId);
    }
    legacyNew = legacy.filter(p => isVocabularyUnreviewed(p) && isVocabularyReviewDue(p, at));
    fsrsNewIds = fsrsReady.filter(fsrsEntryIsNew).map(entry => entry.cardId);
  }
  // 새 표현 한도는 계정 하나다(서버 소유). 이미 오늘 시작한 예전 일정 카드는 한도를 다시 쓰지 않는다.
  const admitted = new Set(quota?.admittedLegacyCardIds || []);
  const resumed = legacyNew.filter(p => admitted.has(p.vocabulary.id));
  const unseen = legacyNew.filter(p => !admitted.has(p.vocabulary.id));
  const remaining = quota ? Math.max(0, quota.remaining || 0) : 0;
  let allowedFsrsNew = 0, allowedUnseen = 0, allowedResumed = 0;
  if (!backlogBlocked && quota) {
    allowedResumed = resumed.length;
    allowedFsrsNew = Math.min(fsrsNewIds.length, remaining);
    allowedUnseen = Math.min(unseen.length, Math.max(0, remaining - allowedFsrsNew));
  }
  const words = list => list.map(p => p.vocabulary);
  return {
    legacyReviews: words(legacyReviews),
    legacyNew: words([...resumed.slice(0, allowedResumed), ...unseen.slice(0, allowedUnseen)]),
    legacyNewAvailable: words([...resumed, ...unseen]),
    fsrsIds: [...fsrsReviewIds, ...fsrsNewIds.slice(0, allowedFsrsNew)],
    due: legacyReviews.length + fsrsReviewIds.length,
    newAllowed: allowedResumed + allowedFsrsNew + allowedUnseen,
    newLocked: legacyNew.length + fsrsNewIds.length - (allowedResumed + allowedFsrsNew + allowedUnseen),
    remaining: quota ? remaining : null,
    backlogBlocked,
    inScope: inScope.length,
  };
}

const defaults = args => ({
  projections: Array.isArray(args.snapshot) ? args.snapshot : args.snapshot?.projections || [],
  fsrsEntries: args.fsrsEntries ?? null,
  quota: args.quota ?? null,
  now: Number.isFinite(args.now) ? args.now : Date.parse(args.now) || Date.now(),
  match: args.match || reviewScopeMatcher(args.scope, args.context),
  history: args.history ?? null,
  supported: args.supported || (() => true),
  canLegacy: args.canLegacy || (() => true),
});

/**
 * 범위의 오늘 줄. 복습방이 시작하는 줄과 숫자가 같은 출처다(화면 숫자 = 시작하는 줄 길이).
 * 순서: 예전 일정 복습 → 예전 일정 새 표현(이미 시작한 것 먼저) → FSRS. 두 엔진 합치기는 R1-B다.
 */
export function reviewScopeLine(args) {
  return buildLine({ ...defaults(args), scope: args.scope });
}

/**
 * 개수 함수 — 배움 칸 · 국기 칩 · 복습방 공용(설계 §6-1 ②).
 * → { due, newAllowed, newLocked, total, grammarDue, byLang, backlogBlocked, remaining }
 *   total = due + newAllowed(화면 숫자 = 시작하는 줄 길이), 문법은 total에 넣지 않는다.
 *   byLang = 언어마다 그 언어 하나만 고른 범위의 total(국기 칩 숫자).
 */
export function countReviewScope(args) {
  const base = defaults(args);
  const line = buildLine({ ...base, scope: args.scope });
  const byLang = Object.fromEntries(REVIEW_SCOPE_LANGS.map(lang => {
    if (lang === args.scope.lang && !args.scope.level && !args.scope.src && args.scope.state === 'due') return [lang, line.due + line.newAllowed];
    const own = buildLine({ ...base, scope: { lang, state: 'due' }, match: reviewScopeMatcher({ lang, state: 'due' }) });
    return [lang, own.due + own.newAllowed];
  }));
  return Object.freeze({
    due: line.due, newAllowed: line.newAllowed, newLocked: line.newLocked, total: line.due + line.newAllowed,
    grammarDue: Number.isSafeInteger(args.grammarDue) && args.grammarDue > 0 ? args.grammarDue : 0,
    byLang: Object.freeze(byLang), backlogBlocked: line.backlogBlocked, remaining: line.remaining, inScope: line.inScope,
  });
}
