import LibraryPage from '@/components/web/LibraryPage';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
export const dynamic = 'force-dynamic';
export const metadata = { title: '내 서재', description: '읽던 글과 교재, 내 자료와 노트를 한자리에서.' };
export default async function Page() {
  let book = null;
  try { book = readingCatalog((await publishedReading()).book); } catch { /* Personal materials remain available. */ }
  return <LibraryPage book={book} />;
}
