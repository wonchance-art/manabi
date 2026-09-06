import Link from 'next/link';
import { STUDY_COUNTRIES } from '@/content/studies';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import { bookHref } from '@/lib/textbook/contract';
export const dynamic = 'force-dynamic';
export const metadata = { title: '발견', description: '언어가 살아가는 곳. 문화와 지역학, 새로운 읽을거리.' };
export default async function Page() {
  let book = null;
  try { const published = await publishedReading(); book = readingCatalog(published.book); } catch { /* Regional documents remain available. */ }
  const japan = STUDY_COUNTRIES.find(country => country.id === 'japan');
  const featured = japan.docs.find(doc => doc.domain === 'culture');
  return <div className="manabi-page manabi-discover"><header className="manabi-page-heading"><div><p className="manabi-eyebrow">BEYOND THE LANGUAGE / 발견</p><h1>말이 태어나는 곳<span>.</span></h1></div><Link className="manabi-link" href="/materials?tab=public">외국어 읽을거리 ↗</Link></header>
    <div className="discover-opening"><Link className="discover-feature" href={`/studies/japan/${featured.slug}`}><p className="manabi-eyebrow">CULTURE / 일본학 · 한국어로 읽기</p><div className="discover-glyph" lang="ja" aria-hidden="true">文<span>化</span></div><div><h2>{featured.title}</h2><p>{featured.summary}</p><span className="discover-feature-link">이야기 펼치기 ↗</span></div></Link><aside className="discover-topics"><p className="manabi-eyebrow">PLACES & PERSPECTIVES</p><h2>어디부터<br /> 읽어볼까요?</h2>{STUDY_COUNTRIES.map((country, index) => <Link key={country.id} href={`/studies/${country.id}`}><span>0{index + 1}</span><div><strong>{country.nameKo}</strong><small>{country.docs.length}편 · 한국어 지역학</small></div><span>↗</span></Link>)}<Link className="discover-all" href="/studies">모든 주제 살펴보기 →</Link></aside></div>
    {book && book.cultures.length > 0 && <section><div className="manabi-section-heading"><div><p className="manabi-eyebrow">BETWEEN THE LESSONS</p><h2>교재 사이, 일상의 일본어</h2></div><Link className="manabi-link" href={`/books/japanese-n5/materials?edition=${book.edition}`}>모두 읽기 ↗</Link></div><div className="discover-cultures">{book.cultures.slice(0, 3).map((culture, index) => <Link href={bookHref(book.edition, culture.id)} key={culture.id}><span>0{index + 1}</span><small>일본어 N5 · 문화 읽기</small><h3>{culture.title}</h3><p>{culture.lead}</p><b aria-hidden="true">↗</b></Link>)}</div></section>}
    <div className="shelf-footnote"><div><p className="manabi-eyebrow">MAKE IT YOURS</p><h2>다음 이야기는<br />당신의 서재에서.</h2></div><div><p>읽고 싶은 글과 PDF, EPUB을 가져와<br />필요한 표현을 담으며 읽어보세요.</p><Link href="/materials/add" prefetch={false} className="manabi-link">내 자료 가져오기 ↗</Link></div></div>
  </div>;
}
