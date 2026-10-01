import MaterialsPage from '@/views/MaterialsPage';
import DiscoveryExplorer from '@/components/web/DiscoveryExplorer';
import Link from 'next/link';
import { STUDY_COUNTRIES, STUDY_DOMAINS } from '@/content/studies';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import { bookHref } from '@/lib/textbook/contract';
export const dynamic = 'force-dynamic';
export const metadata = { title: '발견', description: '언어가 살아가는 곳. 문화와 지역학, 새로운 읽을거리.' };
export default async function Page({searchParams}) {
  const params=await searchParams;
  if(params?.view==='reading')return <div className="manabi-page"><header className="manabi-page-heading"><div><Link className="manabi-link" href="/discover">← 발견</Link><h1>함께 읽는 글</h1></div><Link className="manabi-link" href="/materials">내 서재</Link></header><MaterialsPage libraryView="public"/></div>;
  let book = null;
  try { const published = await publishedReading(); book = readingCatalog(published.book); } catch { /* Regional documents remain available. */ }
  const japan = STUDY_COUNTRIES.find(country => country.id === 'japan');
  const featured = japan.docs.find(doc => doc.domain === 'culture');
  return <div className="manabi-page manabi-discover"><header className="manabi-page-heading"><h1>발견</h1><Link className="manabi-link" href="/discover?view=reading">외국어 읽을거리</Link></header>
    <div className="discover-opening"><Link className="discover-feature" href={`/studies/japan/${featured.slug}`}><p className="manabi-eyebrow">일본학 · 한국어로 읽기</p><div className="discover-glyph" lang="ja" aria-hidden="true">文<span>化</span></div><div><h2>{featured.title}</h2><p>{featured.summary}</p></div></Link><aside className="discover-topics"><h2>지역</h2>{STUDY_COUNTRIES.map((country, index) => <Link key={country.id} href={`/studies/${country.id}`}><span>0{index + 1}</span><div><strong>{country.nameKo}</strong><small>{country.docs.length}편 · 한국어 지역학</small></div></Link>)}<Link className="discover-all" href="/studies">모든 주제 →</Link></aside></div>
    <DiscoveryExplorer regions={STUDY_COUNTRIES.map(({ id, nameKo }) => ({ id, nameKo }))} topics={STUDY_DOMAINS} documents={STUDY_COUNTRIES.flatMap(country => country.docs.map(doc => ({ href: `/studies/${country.id}/${doc.slug}`, region: country.id, regionName: country.nameKo, domain: doc.domain, topicName: STUDY_DOMAINS.find(t => t.id === doc.domain)?.label || '', title: doc.title, summary: doc.summary, updated: doc.updated, sourceLabel: doc.sources?.[0]?.label || '문서 안에서 출처 확인' })))} />
    {book && book.cultures.length > 0 && <section><div className="manabi-section-heading"><h2>일본어 N5 · 문화 읽기</h2><Link className="manabi-link" href={`/books/japanese-n5/materials?edition=${book.edition}`}>모두 읽기</Link></div><div className="discover-cultures">{book.cultures.slice(0, 3).map((culture, index) => <Link href={bookHref(book.edition, culture.id)} key={culture.id}><span>0{index + 1}</span><h3>{culture.title}</h3><p>{culture.lead}</p></Link>)}</div></section>}
  </div>;
}
