// 복습 범위 주소 문법(REV-SCOPE-R1A §6-1 ①) — 서버 페이지(/vocab)도 읽으므로 화면 훅 · 학습 계산을 끌어오지 않는 순수 모듈.
// 개수 · 범위 거르기는 reviewScope.js(이 모듈을 다시 내보낸다).
import { LEARNING_LANGUAGES } from './learningSources.js';
import { isBookId, bookHref } from './textbook/contract.js';
import { EXPRESSION_KINDS, EXPRESSION_KIND_LABELS } from './reviewCard.js';

export const REVIEW_SCOPE_LANGS = Object.freeze([...LEARNING_LANGUAGES]);
export const REVIEW_SCOPE_STATES = Object.freeze(['due', 'new', 'fragile']);
// 종류(REV-SCOPE-R1B-1 §6-1 ① type) — 단어 · 문장. 문형(pattern)은 R2. 판별은 reviewCard.expressionKind(읽을 때만).
export const REVIEW_SCOPE_TYPES = EXPRESSION_KINDS;
// 중국어 급수 = HSK 2026 표(zhHskLevel.js 정본, H7 = 7–9 밴드) · NONE = 표 밖(미분류). 일본어 N급은 R2.
export const ZH_SCOPE_LEVELS = Object.freeze(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'NONE']);
export const BOOK_LESSONS = 42;
export const STUDY_SOURCE_REF = '오늘 학습';
// 기억 건강 「흐릿 · 위험」 경계(VocabStats 기억 건강과 같은 값 — 0.7 미만).
export const FRAGILE_RETRIEVABILITY = 0.7;
export const MAX_SCOPE_MATERIALS = 20;
export const SCOPE_LANG_LABELS = Object.freeze({ Japanese: '일본어', Chinese: '중국어', English: '영어', French: '프랑스어', Korean: '한국어' });

const PAGE = /^(?:cover|u(?:0[1-9]|[1-3][0-9]|4[0-2])(?:-[a-z0-9_-]+)?)$/;
const SCOPE_KEYS = ['lang', 'level', 'src', 'state', 'type', 'book'];
const MATERIAL_ID = /^[1-9]\d{0,17}$/;
const LESSON = /^[1-9]\d?$/;

// 돌아갈 곳은 읽던 교재 위치뿐 — 임의 리다이렉트가 아니다(bookReviewNavigation이 다시 내보낸다).
export function safeBookReturn(value,bookId=null) {
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith('/books/')) return null;
  try {
    const url = new URL(value, 'https://manabi.invalid');
    const selectedBook=url.pathname.slice('/books/'.length);
    if (!isBookId(selectedBook)||(bookId!==null&&selectedBook!==bookId)||!/^[a-f0-9]{24}$/.test(url.searchParams.get('edition') || '')) return null;
    if ([...url.searchParams.keys()].some(key => key !== 'edition') || url.searchParams.getAll('edition').length !== 1) return null;
    const page = decodeURIComponent(url.hash.slice(1)) || 'cover';
    return PAGE.test(page) ? bookHref(url.searchParams.get('edition'), page,selectedBook) : null;
  } catch { return null; }
}

/** `src` 값 하나 → 출처 객체. 형식이 어긋나면 null(닫힘). */
export function parseScopeSource(raw) {
  if (typeof raw !== 'string' || raw.length > 600) return null;
  if (raw === 'study') return { kind: 'study' };
  let match = /^book:([a-z0-9-]+):(\d+)-(\d+)$/.exec(raw);
  if (match) {
    const [, bookId, a, b] = match;
    if (!isBookId(bookId) || !LESSON.test(a) || !LESSON.test(b)) return null;
    const from = Number(a), to = Number(b);
    return from <= to && to <= BOOK_LESSONS ? { kind: 'book', bookId, from, to } : null;
  }
  match = /^deck:(.+)$/.exec(raw);
  if (match) {
    let ref;
    try { ref = decodeURIComponent(match[1]); } catch { return null; }
    return ref.trim() && ref.length <= 200 && !/[\u0000-\u001f\u007f]/.test(ref) ? { kind: 'deck', ref } : null;
  }
  match = /^(material|note):(.+)$/.exec(raw);
  if (match) {
    const ids = match[2].split(',');
    if (!ids.every(id => MATERIAL_ID.test(id)) || new Set(ids).size !== ids.length) return null;
    if (match[1] === 'note') return ids.length === 1 ? { kind: 'note', ids } : null;
    return ids.length <= MAX_SCOPE_MATERIALS ? { kind: 'material', ids } : null;
  }
  return null;
}

export function formatScopeSource(source) {
  switch (source?.kind) {
    case 'book': return `book:${source.bookId}:${source.from}-${source.to}`;
    case 'deck': return `deck:${encodeURIComponent(source.ref)}`;
    case 'material': return `material:${source.ids.join(',')}`;
    case 'note': return `note:${source.ids[0]}`;
    case 'study': return 'study';
    default: return null;
  }
}

function readParam(params, key) {
  if (params instanceof URLSearchParams) {
    const all = params.getAll(key);
    return all.length === 0 ? undefined : all.length === 1 ? all[0] : all;
  }
  return params?.[key];
}

/**
 * 주소 → 범위. 범위 키(lang · level · src · state · type · 옛 book)가 하나도 없으면 명시 범위가 아니다(저장 설정을 쓴다).
 * 반환: { explicit:false } | { explicit:true, scope, returnTo } | { explicit:true, invalid:true, reason }.
 * lang이 비면 null로 두고 화면이 기본 언어(배움 언어 칩 · 학습 언어)로 채운다 — 교재는 일본어, 급수는 중국어로 정해진다.
 */
export function parseReviewScope(params = {}) {
  if (!SCOPE_KEYS.some(key => readParam(params, key) !== undefined)) return { explicit: false };
  const invalid = reason => ({ explicit: true, invalid: true, reason });
  const values = {};
  for (const key of [...SCOPE_KEYS, 'returnTo']) {
    const value = readParam(params, key);
    if (Array.isArray(value)) return invalid(key);
    values[key] = value;
  }
  let source = null;
  // 호환: 옛 ?book=japanese-n5&returnTo= 는 src=book:japanese-n5:1-42 와 같다.
  if (values.book !== undefined) {
    if (!isBookId(values.book) || values.src !== undefined) return invalid('book');
    source = { kind: 'book', bookId: values.book, from: 1, to: BOOK_LESSONS };
  }
  if (values.src !== undefined) {
    source = parseScopeSource(values.src);
    if (!source) return invalid('src');
  }
  let lang = values.lang ?? null;
  if (lang !== null && !REVIEW_SCOPE_LANGS.includes(lang)) return invalid('lang');
  const level = values.level ?? null;
  if (level !== null) {
    if (!ZH_SCOPE_LEVELS.includes(level) || (lang && lang !== 'Chinese')) return invalid('level');
    lang = 'Chinese';
  }
  if (source?.kind === 'book') {
    if (lang && lang !== 'Japanese') return invalid('src');
    lang = 'Japanese';
  }
  const state = values.state ?? 'due';
  if (!REVIEW_SCOPE_STATES.includes(state)) return invalid('state');
  const type = values.type ?? null;
  if (type !== null && !REVIEW_SCOPE_TYPES.includes(type)) return invalid('type');
  // 종류는 고른 경우에만 범위에 싣는다(없으면 「전체」 — R1-A 범위 모양 그대로).
  return { explicit: true, scope: { lang, level, source, state, ...(type ? { type } : {}) },
    returnTo: source?.kind === 'book' ? safeBookReturn(values.returnTo,source.bookId) || `/books/${source.bookId}` : null };
}

/** 범위 → 주소(정본 순서 lang · level · src · state · type · returnTo). state=due는 기본값이라 쓰지 않는다. */
export function serializeReviewScope(scope, { returnTo } = {}) {
  const params = new URLSearchParams();
  if (scope?.lang) params.set('lang', scope.lang);
  if (scope?.level) params.set('level', scope.level);
  if (scope?.source) params.set('src', formatScopeSource(scope.source));
  if (scope?.state && scope.state !== 'due') params.set('state', scope.state);
  if (REVIEW_SCOPE_TYPES.includes(scope?.type)) params.set('type', scope.type);
  if (scope?.source?.kind === 'book') {
    const safe = safeBookReturn(returnTo,scope.source.bookId);
    if (safe) params.set('returnTo', safe);
  }
  const query = params.toString();
  return query ? `/vocab?${query}` : '/vocab';
}

export function scopeSourceLabel(source, { materialTitles } = {}) {
  switch (source?.kind) {
    case 'book':
      if(source.bookId==='japanese-n4')return source.from===1&&source.to===BOOK_LESSONS?'N4 교재 전체':source.from===source.to?`N4 교재 ${source.from}과`:`N4 교재 ${source.from}–${source.to}과`;
      if (source.from === 1 && source.to === BOOK_LESSONS) return '교재 전체';
      return source.from === source.to ? `교재 ${source.from}과` : `교재 ${source.from}–${source.to}과`;
    case 'deck': return source.ref;
    case 'material': {
      const title = source.ids.length === 1 ? materialTitles?.get?.(Number(source.ids[0])) ?? materialTitles?.get?.(source.ids[0]) : null;
      return title || `내 서재 자료 · ${source.ids.length}개`;
    }
    case 'note': return '노트';
    case 'study': return STUDY_SOURCE_REF;
    default: return null;
  }
}

export function scopeTypeLabel(type) {
  return EXPRESSION_KIND_LABELS[type] || null;
}

export function scopeStateLabel(state) {
  return ({ due: '복습할 때 된 것', new: '새 표현만', fragile: '흐릿 · 위험' })[state] || null;
}

/** 화면 제목용 — 「복습 · 교재 5–10과」(§6-1 ⑧). 출처가 없으면 「복습」. */
export function scopeHeading(scope, options) {
  const label = scope?.source ? scopeSourceLabel(scope.source, options) : null;
  return label ? `복습 · ${label}` : '복습';
}

