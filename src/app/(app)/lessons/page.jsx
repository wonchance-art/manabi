import Bookshelf from '@/components/books/Bookshelf';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import { levelTileCounts } from '@/lib/levelListData';
import { BOOKS } from '@/lib/textbook/contract';

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
  // 등록 교재 · 레벨 타일(일본어 · 중국어)을 한꺼번에 시작한다 — 전에는 교재를 다 받은 뒤 타일을 언어마다 차례로 셌다(LEARN-PAGES 2026-10-17 KST).
  // 타일 수는 서버 프로세스마다 한 번 세고 기억하므로(levelTileCounts) 차이는 첫 요청(콜드)에서 난다.
  const [results, tiles] = await Promise.all([
    Promise.allSettled(Object.keys(BOOKS).map(async bookId => readingCatalog((await publishedReading(undefined, false, bookId)).book))),
    // 레벨별 단어 · 문형 타일(LEVEL-LIST-AJ-001) — 숫자는 목록과 같은 조립에서 센다. 실패하면 타일 없이 책장은 그대로 연다.
    Promise.all([levelTileCounts('japanese'), levelTileCounts('chinese')]).then(([Japanese, Chinese]) => ({ Japanese, Chinese }), () => ({})),
  ]);
  const books = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  const levelTiles = tiles;
  return <Bookshelf book={books[0] || null} books={books} initialLang={sp?.lang} levelTiles={levelTiles} />;
}
