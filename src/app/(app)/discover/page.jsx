import MaterialsPage from '@/views/MaterialsPage';
import DiscoverShelf from '@/components/web/DiscoverShelf';
import Link from 'next/link';
import { SERIES_TITLE_ILIKE } from '@/lib/constants';
import { kstDateString } from '@/lib/growthStats';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import { suggestionClient, todaySuggestions } from '@/lib/server/suggestionReading';
import { bookHref } from '@/lib/textbook/contract';
export const dynamic = 'force-dynamic';
export const metadata = { title: '발견', description: '누구나 읽는 서가 — 매일 오는 소식과 함께 읽는 글.' };
export default async function Page({searchParams}) {
  const params=await searchParams;
  if(params?.view==='reading')return <div className="manabi-page"><header className="manabi-page-heading"><div><Link className="manabi-link" href="/discover">← 발견</Link><h1>함께 읽는 글</h1></div><Link className="manabi-link" href="/materials">내 서재</Link></header><MaterialsPage libraryView="public"/></div>;
  // 지역학은 발견에서 내렸다(오너 「지역학 치워버려 지우진 말고」 2026-10-16 KST) — /studies 경로 · 콘텐츠는 그대로다.
  const client = suggestionClient();
  const [book, suggestions, publicCount] = await Promise.all([
    publishedReading().then(published => readingCatalog(published.book)).catch(() => null), // Shelf remains available.
    todaySuggestions(client),
    client.from('reading_materials').select('id', { count: 'exact', head: true }).eq('visibility', 'public')
      .not('title', 'ilike', SERIES_TITLE_ILIKE) // 목록(/discover?view=reading)과 같은 조건으로 센다
      .then(({ count, error }) => (error ? 0 : count || 0)),
  ]);
  return <div className="manabi-page manabi-discover"><header className="manabi-page-heading"><h1>발견</h1></header>
    <DiscoverShelf suggestions={suggestions} publicCount={publicCount} date={kstDateString()} />
    {book && book.cultures.length > 0 && <section><div className="manabi-section-heading"><h2>일본어 N5 · 문화 읽기</h2><Link className="manabi-link" href={`/books/japanese-n5/materials?edition=${book.edition}`}>모두 읽기</Link></div><div className="discover-cultures">{book.cultures.slice(0, 3).map((culture, index) => <Link href={bookHref(book.edition, culture.id)} key={culture.id}><span>0{index + 1}</span><h3>{culture.title}</h3><p>{culture.lead}</p></Link>)}</div></section>}
  </div>;
}
