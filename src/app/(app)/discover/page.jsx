import LazyMaterialsPage from '@/components/web/LazyMaterialsPage';
import DiscoverShelf from '@/components/web/DiscoverShelf';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { hasSupabaseSessionInJar } from '@/lib/authCookie';
import { SERIES_TITLE_ILIKE } from '@/lib/constants';
import { kstDateString } from '@/lib/growthStats';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import { suggestionClient, todaySuggestions } from '@/lib/server/suggestionReading';
import { bookHref } from '@/lib/textbook/contract';
export const dynamic = 'force-dynamic';
export const metadata = { title: '발견', description: '누구나 읽는 서가 — 매일 오는 소식과 함께 읽는 글.' };
export default async function Page({searchParams}) {
  const params=await searchParams;
  // 세션 쿠키(이름만)를 넘겨 로그인 사람의 고르기 줄을 서버 HTML부터 그린다 — 확인 뒤 칩이 끼며 목록이 밀리던 것(DISCOVER-CHIP-CLS-001).
  if(params?.view==='reading')return <div className="manabi-page"><header className="manabi-page-heading"><div><Link className="manabi-link" href="/discover">← 발견</Link><h1>함께 읽는 글</h1></div><Link className="manabi-link" href="/materials">내 서재</Link></header><LazyMaterialsPage libraryView="public" sessionHint={hasSupabaseSessionInJar(await cookies())}/></div>;
  // 지역학은 발견에서 내렸다(오너 「지역학 치워버려 지우진 말고」 2026-10-16 KST) — /studies 경로 · 콘텐츠는 그대로다.
  const client = suggestionClient();
  const [book, suggestions, looseCount, bookChapterCount] = await Promise.all([
    publishedReading().then(published => readingCatalog(published.book)).catch(() => null), // Shelf remains available.
    todaySuggestions(client),
    client.from('reading_materials').select('id', { count: 'exact', head: true }).eq('visibility', 'public')
      .not('title', 'ilike', SERIES_TITLE_ILIKE) // 목록(/discover?view=reading)과 같은 조건으로 센다
      .then(({ count, error }) => (error ? 0 : count || 0)),
    // 비로그인(anon)은 책 장 행을 못 센다(anon_book_chapters_hidden, #1504) — 목록이 책 카드를 채우는 것과 같은
    // public_book_catalog로 책 장을 따로 더한다. 안 더하면 정본 책 공개 뒤 「함께 읽는 글」 칸이 사라진다(리뷰 2026-10-17 KST).
    // 개수만 받는다(head) — 행을 받으면 장마다 책 · 문학 메타가 붙어 정본 공개 뒤 요청마다 MB 단위가 되고 1000행에서 잘린다(리뷰 2026-10-17 KST).
    client.rpc('public_book_catalog', {}, { count: 'exact', head: true }).not('title', 'ilike', SERIES_TITLE_ILIKE)
      .then(({ count, error }) => (error ? 0 : count || 0)),
  ]);
  const publicCount = looseCount + bookChapterCount;
  return <div className="manabi-page manabi-discover"><header className="manabi-page-heading"><h1>발견</h1></header>
    <DiscoverShelf suggestions={suggestions} publicCount={publicCount} date={kstDateString()} />
    {book && book.cultures.length > 0 && <section><div className="manabi-section-heading"><h2>일본어 N5 · 문화 읽기</h2><Link className="manabi-link" href={`/books/japanese-n5/materials?edition=${book.edition}`}>전체 보기</Link></div><div className="discover-cultures">{book.cultures.slice(0, 3).map((culture, index) => <Link href={bookHref(book.edition, culture.id)} key={culture.id}><span>0{index + 1}</span><h3>{culture.title}</h3><p>{culture.lead}</p></Link>)}</div></section>}
  </div>;
}
