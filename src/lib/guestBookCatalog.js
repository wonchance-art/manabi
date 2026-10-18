// 비로그인 「함께 읽는 글」의 책 카드(BOOK-GUEST-GATE-1, 오너 「권장대로 진행」 2026-10-16 KST).
//
// 비로그인(anon)은 책 장 행을 읽지 못한다 — DB 제한 정책 anon_book_chapters_hidden(supabase/migrations/20261016150000_anon_book_catalog.sql).
// 목록에는 public_book_catalog(제목·책 정보·레벨·분석 상태만, 본문·뜻 없음)로 책 카드를 채운다. 여는 것은 로그인 뒤(뷰어가 안내).

// 공개 책 장 메타는 거르기와 무관하다(거르기는 아래에서 브라우저가 한다) — 같은 클라이언트면 잠시 같은 응답을 다시 쓴다.
// 목록 조회(reading_materials)와 나란히 출발시키려고 따로 꺼냈다(LIBRARY-GUEST-CLS-001 — 운영 실측: 목록 1.0–1.1초 뒤에야
// 이 RPC가 출발해 0.7–0.8초를 더 기다렸다. DB 실행은 0.5ms, 나머지는 왕복).
const CATALOG_TTL_MS = 60_000;
let catalogCache = null; // { client, at, promise }
export function guestBookCatalogRows(client, now = Date.now()) {
  if (catalogCache && catalogCache.client === client && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.promise;
  const promise = Promise.resolve(client.rpc('public_book_catalog')).then(
    (result) => { if (result?.error || !Array.isArray(result?.data)) catalogCache = null; return result; },
    (error) => { catalogCache = null; return { data: null, error }; });
  catalogCache = { client, at: now, promise };
  return promise;
}

/**
 * 목록 조회 결과(rows) + 공개 책 장 메타 → 만든 때 최신순. 목록 조회와 같은 거르기(시리즈 제목 [..#..] · 언어 · 레벨 · 제목 검색)를 하고,
 * 세션이 이미 붙어 목록 조회가 책 장을 받아 왔으면 그 행이 이긴다(id 중복 없음). 함수가 없거나 실패하면 rows 그대로(책 카드만 빠진다).
 */
export async function withGuestBookCatalog(client, rows, { langFilter = 'all', levelFilter = 'all', searchQuery = '', catalog = null } = {}) {
  const { data, error } = (await (catalog || client.rpc('public_book_catalog'))) || {};
  if (error || !Array.isArray(data)) return rows;
  const seen = new Set(rows.map((row) => row.id));
  const query = searchQuery ? searchQuery.toLowerCase() : '';
  const books = data.filter((row) => {
    const metadata = row.processed_json?.metadata || {};
    const title = String(row.title || '');
    return !seen.has(row.id) && !/^\[.*#/u.test(title)
      && (!query || title.toLowerCase().includes(query))
      && (langFilter === 'all' || metadata.language === langFilter)
      && (levelFilter === 'all' || metadata.level === levelFilter);
  });
  return [...rows, ...books].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
