import { notFound } from 'next/navigation';
import BookCoverStatic, { BOOK_METADATA, COVER_HINTS } from '@/components/books/BookCoverStatic';

// 일본어 N3 첫 화면 · 쿼리 없는 판(GUEST-STATIC-001 4단계) — middleware가 /books/japanese-n3(쿼리 없음)를 세션 쿠키 유무로 여기로 넘긴다(주소창은 그대로).
// 쿼리가 붙으면(?edition · ?reference · ?returnTo …) 동적 화면(../../page.jsx) 그대로다. 판 설명은 BookCoverStatic.jsx.
export const revalidate = 3600;
export const dynamicParams = false;
export function generateStaticParams() { return COVER_HINTS.map(hint => ({ hint })); }
export const metadata = BOOK_METADATA['japanese-n3'];
export default async function Page({ params }) {
  const { hint } = await params;
  if (!COVER_HINTS.includes(hint)) notFound();
  return <BookCoverStatic bookId="japanese-n3" member={hint === 'member'} />;
}
