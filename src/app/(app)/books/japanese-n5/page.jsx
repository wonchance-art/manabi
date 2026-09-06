import Link from 'next/link';
import { publishedReading, readingCatalog, readingSections } from '@/lib/server/bookReading';
import BookReader from '@/components/books/BookReader';

export const dynamic = 'force-dynamic';
export const metadata = { title: '일본어 N5 · 작은 문장으로 시작하는 일본어', alternates: { canonical: '/books/japanese-n5' } };

export default async function Page({ searchParams }) {
  try {
    const params = await searchParams;
    const { book, preview } = await publishedReading(params?.edition, true);
    const sections = await readingSections(book.editionId);
    return <BookReader book={readingCatalog(book)} preview={preview} sectionIndex={sections.map(({ id, unit, title, anchors }) => ({ id, unit, title, anchors }))} />;
  } catch {
    return <div className="manabi-page"><h1>교재를 불러오지 못했어요</h1><p>잠시 후 다시 열어 주세요.</p><Link href="/lessons">책장으로 돌아가기</Link></div>;
  }
}
