import HomePage from '@/views/HomePage';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
export const dynamic = 'force-dynamic';
export const metadata = { title: '배움', description: '읽던 페이지 · 단어 복습 · 오늘 문단을 한 화면에서.' };
export default async function Page() {
  let book = null;
  try { const published = await publishedReading(); book = readingCatalog(published.book); } catch { /* Reading and account services can fail independently. */ }
  return <HomePage book={book} />;
}
