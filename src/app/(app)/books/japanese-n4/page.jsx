import { cookies } from 'next/headers';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { publishedReading, readingCatalog, readingSections } from '@/lib/server/bookReading';
import BookReader from '@/components/books/BookReader';
import { BOOK_METADATA, BookUnavailable } from '@/components/books/BookCoverStatic';

export const dynamic = 'force-dynamic';
// 쿼리가 붙은 요청(관리자 미리보기 ?edition=<미발행> · ?reference · ?returnTo · 책 안 이동 뒤 새로고침의 ?edition=<발행>)만 이 동적 화면에 온다.
// 쿼리 없는 첫 화면은 middleware가 표지 판(cover/[hint], ISR — GUEST-STATIC-001 4단계)으로 넘긴다. 미리보기 응답은 계정별이라 여기는 동적이다.
export const metadata = BOOK_METADATA['japanese-n4'];

export default async function Page({ searchParams }) {
  try {
    const params = await searchParams;
    // 세션 쿠키 이름만 본다(값은 읽지 않는다) — 로그인 확인 중 표지의 담기 버튼 자리를 서버 첫 그림부터 잡는다(BOOKS-FLOW-002, /materials 선례).
    const sessionHint = hasSupabaseSessionInJar(await cookies());
    const { book, preview } = await publishedReading(params?.edition, true, 'japanese-n4');
    const sections = await readingSections(book.editionId, 'japanese-n4');
    return <BookReader key={`${book.editionId}:${params?.reference === '1'}`} reference={params?.reference === '1'} book={readingCatalog(book)} preview={preview} sessionHint={sessionHint} sectionIndex={sections.map(({ id, unit, title, anchors }) => ({ id, unit, title, anchors }))} />;
  } catch {
    return <BookUnavailable />;
  }
}
