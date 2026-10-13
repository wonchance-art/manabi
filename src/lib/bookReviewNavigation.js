import { BOOK_ID } from './textbook/contract';
import { BOOK_LESSONS, safeBookReturn, serializeReviewScope } from './reviewScopeUrl';

// 돌아갈 곳 판정은 범위 주소 정본(reviewScope)이 소유한다 — 여기서는 기존 import 경로만 이어 준다.
export { safeBookReturn };

/**
 * 교재 범위 복습 주소(REV-SCOPE-R1A) — 범위 주소 정본(serializeReviewScope)으로 만든다.
 * 과 범위를 주지 않으면 교재 전체(1–42과). 옛 `?book=japanese-n5&returnTo=` 주소는 parseReviewScope가 같은 범위로 읽는다.
 */
export function bookReviewHref(returnTo, { from = 1, to = BOOK_LESSONS } = {}) {
  return serializeReviewScope({ lang: 'Japanese', level: null, source: { kind: 'book', bookId: BOOK_ID, from, to }, state: 'due' }, { returnTo });
}

/** 「교재의 담은 표현」 목록(/books/japanese-n5/review) — 돌아갈 판본 · 위치를 그대로 넘긴다. 안전한 돌아갈 곳이 없으면 null. */
export function bookExpressionListHref(returnTo) {
  const safe = safeBookReturn(returnTo);
  if (!safe) return null;
  const edition = new URL(safe, 'https://manabi.invalid').searchParams.get('edition');
  return `/books/${BOOK_ID}/review?edition=${edition}&returnTo=${encodeURIComponent(safe)}`;
}

// Keep stored source URLs canonical; only the act of consulting them is marked.
export function bookReferenceHref(href) {
  const safe = safeBookReturn(href);
  if (!safe) return href;
  const url = new URL(safe, 'https://manabi.invalid');
  url.searchParams.set('reference', '1');
  return url.pathname + url.search + url.hash;
}

async function fetchScopeIds(path, { signal, fetcher = fetch, failure }) {
  const ids = new Set();
  let offset = 0;
  do {
    const response = await fetcher(`${path}${path.includes('?') ? '&' : '?'}offset=${offset}`, { cache: 'no-store', signal });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.wordIds)) throw new Error(failure);
    for (const id of result.wordIds) ids.add(id);
    if (result.nextOffset == null) return [...ids];
    if (!Number.isSafeInteger(result.nextOffset) || result.nextOffset <= offset) throw new Error('표현 목록의 다음 위치를 확인하지 못했어요.');
    offset = result.nextOffset;
  } while (!signal?.aborted);
  throw new DOMException('Aborted', 'AbortError');
}

/** 교재 범위의 내 단어 id — 과 범위(from · to)를 주면 그 과에서 담은 것만. 한 쪽이라도 실패하면 전체 실패(닫힘). */
export function fetchBookVocabularyIds({ signal, fetcher = fetch, from = 1, to = BOOK_LESSONS } = {}) {
  const range = from === 1 && to === BOOK_LESSONS ? '' : `&from=${from}&to=${to}`;
  return fetchScopeIds(`/api/learning/book-review?scope=1${range}`, { signal, fetcher, failure: '이 교재의 표현 범위를 불러오지 못했어요.' });
}

/** 자료(노트 포함) 범위의 내 단어 id — 저장 출처(source_material_id) ∪ 담은 문맥(vocabulary_contexts.material_id). */
export function fetchMaterialVocabularyIds({ ids, signal, fetcher = fetch } = {}) {
  return fetchScopeIds(`/api/learning/material-review?ids=${ids.join(',')}`, { signal, fetcher, failure: '이 자료의 표현 범위를 불러오지 못했어요.' });
}
