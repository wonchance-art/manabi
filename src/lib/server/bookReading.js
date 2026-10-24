import { createSupabaseServerClient, requireAdmin } from '@/lib/supabaseServer';
import { BOOK_ID } from '@/lib/textbook/contract';
import { publishedReadingWith, readingCatalog, readingSections } from '@/lib/server/publishedBook';

// 판본 확인은 publishedBook.js가 정본이다(쿠키를 모르는 모듈 — 책장 · 배움 · 교재 표지 ISR이 같은 함수를 공개 클라이언트로 쓴다, GUEST-STATIC-001 3 · 4단계).
// 교재 화면(쿼리가 붙은 동적 갈래)은 쿠키 세션 클라이언트 + 관리자 미리보기(?edition=<미발행>)를 넘긴다 — 미리보기 응답은 계정별이라 그 갈래는 동적이다.
export async function publishedReading(editionId, allowPreview = false, bookId = BOOK_ID) {
  return publishedReadingWith(await createSupabaseServerClient(), editionId, allowPreview, bookId, requireAdmin);
}
export { readingCatalog, readingSections };
