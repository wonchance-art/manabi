// 복습 범위 조회(REV-SCOPE R1-A). 범위 판정 · 개수는 reviewScope.js(순수)가 하고,
// 여기서는 서버가 알아야 하는 것만 읽는다: 출처 범위의 단어 id, 밀린 복습 기준이 되는 지난 14일 복습 수.
import { fetchBookVocabularyIds } from './bookReviewNavigation';
import { BACKLOG_HISTORY_DAYS, REVIEW_SCOPE_LANGS, serializeReviewSource } from './reviewScope';

/** 출처가 id 묶음으로만 정해지는 범위(교재 · 자료 · 노트). 그 밖은 null(단어 행만으로 판정). */
export const reviewSourceNeedsIds = src => ['book', 'material', 'note'].includes(src?.kind);

/** 실패는 그대로 던진다 — 호출하는 쪽이 닫힘 상태를 보여 준다(전체로 넓히지 않는다). */
export async function fetchReviewScopeIds(src, { signal, fetcher = fetch } = {}) {
  if (!reviewSourceNeedsIds(src)) return null;
  if (src.kind === 'book') {
    const whole = src.from === 1 && src.to === 42;
    return fetchBookVocabularyIds({ signal, fetcher, ...(whole ? {} : { from: src.from, to: src.to }) });
  }
  const response = await fetcher(`/api/learning/review-scope?src=${encodeURIComponent(serializeReviewSource(src))}`, { cache: 'no-store', signal });
  const result = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(result?.wordIds)) throw new Error('범위를 불러오지 못했어요.');
  return result.wordIds;
}

/**
 * 언어별 지난 14일 완료 복습 수(review_events source='vocab' — 예전 일정 · FSRS 채점이 모두 남긴다).
 * 못 읽은 언어는 빠진다 → 기준은 기본값(하루 20)이 된다.
 */
export async function fetchReviewHistory(client, userId, { now = Date.now() } = {}) {
  const since = new Date(now - BACKLOG_HISTORY_DAYS * 86400000).toISOString();
  const counts = await Promise.all(REVIEW_SCOPE_LANGS.map(async lang => {
    try {
      const { count, error } = await client.from('review_events').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('source', 'vocab').eq('lang', lang).gte('created_at', since);
      return error || !Number.isSafeInteger(count) ? null : [lang, count];
    } catch { return null; }
  }));
  return Object.fromEntries(counts.filter(Boolean));
}
