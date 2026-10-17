import Bookshelf from '@/components/books/Bookshelf';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import { levelTileCounts } from '@/lib/levelListData';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '나의 책장',
  description: '작은 문장부터 차근차근. 일본어 교재를 읽고, 기억할 표현과 내 자료를 연결하세요.',
  alternates: { canonical: '/lessons' },
};
// #1077: Cookie-verified publication and searchParams make this dynamic SSR: private, no-store.
// Do not add ineffective revalidate here; archived ?lang links still select the series notice.
export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const results = await Promise.allSettled(['japanese-n5', 'japanese-n4'].map(async bookId => readingCatalog((await publishedReading(undefined, false, bookId)).book)));
  const books = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  // 레벨별 단어 · 문형 타일(LEVEL-LIST-AJ-001) — 숫자는 목록과 같은 조립에서 센다.
  let levelTiles = {};
  try { levelTiles = { Japanese: await levelTileCounts('japanese'), Chinese: await levelTileCounts('chinese') }; } catch { /* 타일 없이 책장은 그대로 연다. */ }
  return <Bookshelf book={books[0] || null} books={books} initialLang={sp?.lang} levelTiles={levelTiles} />;
}
