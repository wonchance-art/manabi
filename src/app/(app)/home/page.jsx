import { cookies } from 'next/headers';
import HomePage from '@/views/HomePage';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
export const dynamic = 'force-dynamic';
export const metadata = { title: '배움', description: '읽던 페이지 · 단어 복습 · 오늘 문단을 한 화면에서.' };
export default async function Page() {
  let book = null;
  try { const published = await publishedReading(); book = readingCatalog(published.book); } catch { /* Reading and account services can fail independently. */ }
  // 세션 쿠키 유무(이름만) — 손님이면 서버 HTML부터 손님 배치(B1). force-dynamic이라 쿠키를 읽어도 추가 동적 비용이 없다.
  const sessionHint = hasSupabaseSessionInJar(await cookies());
  return <HomePage book={book} sessionHint={sessionHint} />;
}
