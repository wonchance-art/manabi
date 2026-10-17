// 서재 첫 화면의 쿼리 정본(LIBRARY-PREFETCH-001) — 키 · 가져오기 함수 · 캐시 시간을 **한 곳**에서 만든다.
// 브라우저(LibraryShelf · ConversationShelf · useCollections)는 브라우저 Supabase로, 서버(materials/page.jsx →
// prefetchLibraryShelf)는 쿠키 세션 Supabase로 같은 함수를 부른다. 키가 하나라도 갈리면 서버가 받아 온 결과를
// 브라우저가 못 찾아 다시 받는다(골격 → 접힘이 그대로) — libraryPrefetch.test.js가 같은 함수를 쓰는지 지킨다.
// 30초 캐시는 쓰기 지점이 모두 무효화하므로 안전하다(browserQueryTrim.test.js).
import { fetchCollections, fetchLibraryPage } from './personalLibrary';
import { fetchConversations } from './conversation/conversationLibrary';

export const LIBRARY_SHELF_STALE_MS = 30000;

/** 읽던 곳(최근 연 자료 3개). */
export const libraryRecentQuery = (client, ownerId) => ({
  queryKey: ['library-recent', ownerId], staleTime: LIBRARY_SHELF_STALE_MS,
  queryFn: () => fetchLibraryPage(client, {}, 0, { recent: true }),
});

/** 대화 묶음. */
export const libraryConversationsQuery = (client, ownerId) => ({
  queryKey: ['library-conversations', ownerId], staleTime: LIBRARY_SHELF_STALE_MS,
  queryFn: () => fetchConversations(client, ownerId),
});

/** 폴더 목록(위치 목록). */
export const libraryCollectionsQuery = (client, ownerId) => ({
  queryKey: ['library-collections', ownerId], staleTime: LIBRARY_SHELF_STALE_MS, enabled: !!ownerId,
  queryFn: () => fetchCollections(client, ownerId),
});

/**
 * 서재 목록(무한 목록). 키에는 「더 보기」로 늘린 수(shown)를 넣지 않는다 — 같은 조건의 목록을 이어 받는다.
 * pinnedIds = 이 기기에 받아둔 자료(?pinned=1일 때만, 브라우저에서만 안다).
 */
export function libraryListQuery(client, ownerId, filters, pinnedIds) {
  const keyFilters = { ...filters };
  delete keyFilters.shown;
  return {
    queryKey: ['personal-library', ownerId, keyFilters, pinnedIds], staleTime: LIBRARY_SHELF_STALE_MS, initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchLibraryPage(client, filters, pageParam, { pinned: pinnedIds }),
    getNextPageParam: (last, pages) => {
      const length = pages.reduce((n, p) => n + p.items.length, 0);
      return length < last.total ? length : undefined;
    },
  };
}
