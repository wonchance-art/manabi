import { notFound } from 'next/navigation';
import LessonsShelf from '@/components/books/LessonsShelf';
import { BOOK_SERIES } from '@/lib/bookNavigation';

// 책장 · 언어 갈래(GUEST-STATIC-001 3단계) — /lessons?lang=<언어>를 middleware가 여기로 넘긴다(주소창은 그대로). 언어 넷만 굽는다(ISR 1시간).
// 모르는 언어는 middleware가 넘기지 않는다(옛 동작처럼 「전체 시리즈」). 바로 열면(/lessons/lang/…) middleware가 /lessons?lang=…으로 돌려보낸다.
export const revalidate = 3600;
export const dynamicParams = false;
export function generateStaticParams() { return BOOK_SERIES.map(({ language }) => ({ lang: language })); }
export { metadata } from '../../page';
export default async function Page({ params }) {
  const { lang } = await params;
  if (!BOOK_SERIES.some(s => s.language === lang)) notFound();
  return <LessonsShelf lang={lang} />;
}
