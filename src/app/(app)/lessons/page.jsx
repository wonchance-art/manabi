import Bookshelf from '@/components/books/Bookshelf';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '나의 책장',
  description: '작은 문장부터 차근차근. 일본어 N5 한 권을 읽고, 기억할 표현과 내 자료를 연결하세요.',
  alternates: { canonical: '/lessons' },
};
// #1077: Cookie-verified publication and searchParams make this dynamic SSR: private, no-store.
// Do not add ineffective revalidate here; archived ?lang links still select the series notice.
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  let book = null;
  try { book = readingCatalog((await publishedReading()).book); } catch { /* Fail closed until a verified edition is available. */ }
  return <Bookshelf book={book} initialLang={sp?.lang} />;
}
