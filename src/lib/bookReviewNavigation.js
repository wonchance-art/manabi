import { BOOK_ID, bookHref } from './textbook/contract';

const BOOK_PATH = `/books/${BOOK_ID}`;
const PAGE = /^(?:cover|u(?:0[1-9]|[1-3][0-9]|4[0-2])(?:-[a-z0-9_-]+)?)$/;

// A return destination is reading context, never an arbitrary redirect.
export function safeBookReturn(value) {
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith(`${BOOK_PATH}?`)) return null;
  try {
    const url = new URL(value, 'https://manabi.invalid');
    if (url.pathname !== BOOK_PATH || !/^[a-f0-9]{24}$/.test(url.searchParams.get('edition') || '')) return null;
    if ([...url.searchParams.keys()].some(key => key !== 'edition') || url.searchParams.getAll('edition').length !== 1) return null;
    const page = decodeURIComponent(url.hash.slice(1)) || 'cover';
    return PAGE.test(page) ? bookHref(url.searchParams.get('edition'), page) : null;
  } catch { return null; }
}

// 채점 복습방의 교재 범위(REV-SCOPE R1-A 주소 문법). 과를 주지 않으면 전체 과(1–42).
// 예전 `?book=` 주소도 계속 읽는다(parseBookReview · parseReviewScope).
export function bookReviewHref(returnTo, { from = 1, to = 42 } = {}) {
  const safe = safeBookReturn(returnTo);
  return `/vocab?lang=Japanese&src=book:${BOOK_ID}:${from}-${to}${safe ? `&returnTo=${encodeURIComponent(safe)}` : ''}`;
}

export function parseBookReview(params = {}) {
  if (params.book === undefined) return null;
  if (params.book !== BOOK_ID) return { invalid: true };
  return { bookId: BOOK_ID, returnTo: safeBookReturn(params.returnTo) || BOOK_PATH };
}

// Keep stored source URLs canonical; only the act of consulting them is marked.
export function bookReferenceHref(href) {
  const safe = safeBookReturn(href);
  if (!safe) return href;
  const url = new URL(safe, 'https://manabi.invalid');
  url.searchParams.set('reference', '1');
  return url.pathname + url.search + url.hash;
}

export async function fetchBookVocabularyIds({ signal, fetcher = fetch, from = null, to = null } = {}) {
  const ids = new Set();
  // 과 범위(REV-SCOPE R1-A). 전체 과는 예전 주소 그대로 부른다.
  const range = from !== null && to !== null ? `&from=${from}&to=${to}` : '';
  let offset = 0;
  do {
    const response = await fetcher(`/api/learning/book-review?scope=1${range}&offset=${offset}`, { cache: 'no-store', signal });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.wordIds)) throw new Error('이 교재의 표현 범위를 불러오지 못했어요.');
    for (const id of result.wordIds) ids.add(id);
    if (result.nextOffset == null) return [...ids];
    if (!Number.isSafeInteger(result.nextOffset) || result.nextOffset <= offset) throw new Error('표현 목록의 다음 위치를 확인하지 못했어요.');
    offset = result.nextOffset;
  } while (!signal?.aborted);
  throw new DOMException('Aborted', 'AbortError');
}
