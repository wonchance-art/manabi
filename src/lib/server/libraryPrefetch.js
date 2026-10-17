// 서재 첫 화면을 서버에서 미리 받는다(LIBRARY-PREFETCH-001 — 「읽던 곳 없음」 접힘 · 대화 묶음 밀림은 서버가 이미 안다).
// 쿠키 세션(requireUserClaims — JWT 서명을 서버에서 바로 검증, 인증 왕복 없음 · LIBRARY-PREFETCH-002)으로 브라우저와 **같은 키 · 같은 가져오기 함수**(libraryShelfQueries)를 불러
// dehydrate한다. page.jsx가 HydrationBoundary로 넘기면 브라우저 첫 그림이 이미 최종 배치다.
// 손님 · 세션 없음 · 실패 · 시간 초과 → null(지금처럼 브라우저가 받고 골격이 대신한다). 페이지를 막지 않는다: 전체 예산 안에
// 끝난 쿼리만 싣는다(dehydrate는 성공한 쿼리만 담는다 — 실패 · 대기 중은 빠지고 브라우저가 다시 받는다).
import { QueryClient, dehydrate } from '@tanstack/react-query';
import { requireUserClaims } from '@/lib/supabaseServer';
import { libraryFilters, libraryNarrowed } from '@/lib/personalLibrary';
import { libraryCollectionsQuery, libraryConversationsQuery, libraryListQuery, libraryRecentQuery } from '@/lib/libraryShelfQueries';

export const LIBRARY_PREFETCH_BUDGET_MS = 800;

const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve('timeout'), Math.max(0, ms)));

/** 서재가 아닌 화면(공개 읽을거리로 이동 · 자료 상세 · 맞춤도 정렬)이면 미리 받지 않는다 — LibraryPage와 같은 분기. */
export function shelfRendered(params) {
  return params.get('tab') !== 'public' && params.get('tools') !== '1' && params.get('sort') !== 'fit';
}

/** 화면이 그 조건에서 실제로 부를 쿼리들(LibraryShelf와 같은 조건 — 읽던 곳 · 대화는 좁히지 않은 첫 화면에서만). */
export function shelfQueries(client, ownerId, params) {
  const filters = libraryFilters(params);
  const queries = [libraryCollectionsQuery(client, ownerId)];
  if (!libraryNarrowed(filters)) queries.push(libraryRecentQuery(client, ownerId), libraryConversationsQuery(client, ownerId));
  // ?pinned=1은 이 기기에 받아둔 자료 목록(브라우저만 안다)이 키에 들어가 서버가 못 만든다.
  if (!filters.pinned) queries.push({ ...libraryListQuery(client, ownerId, filters, undefined), infinite: true });
  return queries;
}

/**
 * @returns {Promise<null | { userId: string, state: object }>}
 */
export async function prefetchLibraryShelf(searchParams, { budgetMs = LIBRARY_PREFETCH_BUDGET_MS, auth = requireUserClaims } = {}) {
  const deadline = Date.now() + budgetMs;
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams || {})) if (typeof value === 'string') params.set(key, value);
    if (!shelfRendered(params)) return null;
    const session = await Promise.race([auth(), timeout(deadline - Date.now())]);
    if (session === 'timeout' || !session?.user?.id) return null;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const jobs = shelfQueries(session.supabase, session.user.id, params).map(({ infinite, ...query }) =>
      (infinite ? client.prefetchInfiniteQuery(query) : client.prefetchQuery(query)));
    await Promise.race([Promise.allSettled(jobs), timeout(deadline - Date.now())]);
    const state = dehydrate(client);
    return state.queries.length ? { userId: session.user.id, state } : null;
  } catch {
    return null;
  }
}
