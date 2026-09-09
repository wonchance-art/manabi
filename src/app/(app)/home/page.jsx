import HomePage from '@/views/HomePage';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
export const dynamic = 'force-dynamic';
export const metadata = { title: '오늘', description: '읽던 페이지에서 시작하는 오늘의 언어.' };
export default async function Page() {
  let book = null;
  try { const published = await publishedReading(); book = readingCatalog(published.book); } catch { /* Reading and account services can fail independently. */ }
  return <HomePage book={book} />;
}
