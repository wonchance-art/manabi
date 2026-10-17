import Link from 'next/link';
import { cookies } from 'next/headers';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { publishedReading, readingCatalog, readingSections } from '@/lib/server/bookReading';
import BookReader from '@/components/books/BookReader';

export const dynamic = 'force-dynamic';
export const metadata = { title: '일본어 N5 · 작은 문장으로 시작하는 일본어', alternates: { canonical: '/books/japanese-n5' } };

export default async function Page({ searchParams }) {
  try {
    const params = await searchParams;
    // 세션 쿠키 이름만 본다(값은 읽지 않는다) — 로그인 확인 중 표지의 담기 버튼 자리를 서버 첫 그림부터 잡는다(BOOKS-FLOW-002, /materials 선례).
    const sessionHint = hasSupabaseSessionInJar(await cookies());
    const { book, preview } = await publishedReading(params?.edition, true);
    const sections = await readingSections(book.editionId);
    return <BookReader key={`${book.editionId}:${params?.reference === '1'}`} reference={params?.reference === '1'} book={readingCatalog(book)} preview={preview} sessionHint={sessionHint} sectionIndex={sections.map(({ id, unit, title, anchors }) => ({ id, unit, title, anchors }))} />;
  } catch {
    return <div className="manabi-page"><h1>교재를 불러오지 못했어요</h1><p>잠시 후 다시 열어 주세요.</p><Link href="/lessons">책장으로 돌아가기</Link></div>;
  }
}
