// 비로그인 「함께 읽는 글」의 책 카드(BOOK-GUEST-GATE-1, 오너 「권장대로 진행」 2026-10-16 KST).
//
// 비로그인(anon)은 책 장 행을 읽지 못한다 — DB 제한 정책 anon_book_chapters_hidden(supabase/migrations/20261016150000_anon_book_catalog.sql).
// 목록에는 public_book_catalog(제목·책 정보·레벨·분석 상태만, 본문·뜻 없음)로 책 카드를 채운다. 여는 것은 로그인 뒤(뷰어가 안내).

/**
 * 목록 조회 결과(rows) + 공개 책 장 메타 → 만든 때 최신순. 목록 조회와 같은 거르기(시리즈 제목 [..#..] · 언어 · 레벨 · 제목 검색)를 하고,
 * 세션이 이미 붙어 목록 조회가 책 장을 받아 왔으면 그 행이 이긴다(id 중복 없음). 함수가 없거나 실패하면 rows 그대로(책 카드만 빠진다).
 */
export async function withGuestBookCatalog(client, rows, { langFilter = 'all', levelFilter = 'all', searchQuery = '' } = {}) {
  const { data, error } = await client.rpc('public_book_catalog');
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
