import { notFound } from 'next/navigation';
import BookCoverStatic, { BOOK_METADATA, COVER_HINTS } from '@/components/books/BookCoverStatic';
import { BUNDLED_EDITIONS } from '@/lib/textbook/bundledEditions';

// 일본어 N4 · 판본별 판(GUEST-STATIC-001 5단계) — middleware가 /books/japanese-n4?edition=<저장소 판본 id>(쿼리가 그 하나뿐)를 세션 쿠키 유무로 여기로 넘긴다
// (주소창은 그대로). 주소의 그 판본을 그린다 — 발행 도장이 없으면 동적 화면의 손님과 같은 안내. 다른 쿼리가 붙으면 동적 화면(../../../page.jsx) 그대로다.
export const revalidate = 3600;
export const dynamicParams = false;
const EDITIONS = BUNDLED_EDITIONS['japanese-n4'];
export function generateStaticParams() { return EDITIONS.flatMap(edition => COVER_HINTS.map(hint => ({ edition, hint }))); }
export const metadata = BOOK_METADATA['japanese-n4'];
export default async function Page({ params }) {
  const { edition, hint } = await params;
  if (!COVER_HINTS.includes(hint) || !EDITIONS.includes(edition)) notFound();
  return <BookCoverStatic bookId="japanese-n4" edition={edition} member={hint === 'member'} />;
}
