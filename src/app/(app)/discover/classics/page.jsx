import Link from 'next/link';
import ArtShelf from '@/components/web/ArtShelf';
import ClassicsShelf from '@/components/web/ClassicsShelf';
import { classicsFilters, classicsHref, classicsSection } from '@/lib/classicsShelf';
import { classicsProgressOf, releasedArtOf, releasedClassicsOf } from '@/lib/server/classicsReading';
import { suggestionClient } from '@/lib/server/suggestionReading';
import { requireUserClaims } from '@/lib/supabaseServer';
export const dynamic = 'force-dynamic';
export const metadata = { title: '고전 명작', description: '원문 그대로 읽는 고전 — 명작 책과 그림을 일본어 · 영어 · 프랑스어 · 중국어 · 한국어로.' };

// 산책 「고전 명작」(DISCOVER-CLASSICS-001) — 구간 둘: 「책」(발행 기록 서가 canonical_book_shelf)과 「그림」(그림 서가 canonical_art_shelf, DISCOVER-ART-001).
// 구간 탭은 두 구간 모두 열 것이 있을 때만 — 한쪽이 비면 탭 없이 있는 쪽만 보인다(누르면 빈 화면인 탭을 만들지 않는다).
// 고른 구간이 비었으면 다른 구간으로(주소에 shelf=art가 남아 있어도 그림이 0이면 책). 표시는 저장소 정본(대조표 · 카탈로그)에서.
export default async function Page({ searchParams }) {
  const filters = classicsFilters(await searchParams);
  const client = suggestionClient();
  // 서가(누구에게나 같은 anon 조회)와 로그인 확인(토큰 갱신 없음 — requireUserClaims)을 함께. 읽은 자리는 로그인했을 때만.
  const [books, art, session] = await Promise.all([releasedClassicsOf(client), releasedArtOf(client), requireUserClaims().catch(() => null)]);
  const { shelf, tabs } = classicsSection(filters.shelf, { books: books.items.length > 0 || books.failed, art: art.items.length > 0 || art.failed });
  const current = { ...filters, shelf };
  const { resume, read } = await classicsProgressOf(session, { books: shelf === 'art' ? [] : books.items, art: shelf === 'art' ? art.items : [] });
  return <div className="manabi-page classics-page">
    <header className="manabi-page-heading"><div><Link className="manabi-link" href="/discover">← 산책</Link><h1>고전 명작</h1></div></header>
    {tabs && <nav className="classics-tabs" aria-label="구간">
      <Link href={classicsHref({}, { shelf: '' })} aria-current={shelf === '' ? 'page' : undefined} prefetch={false}>책</Link>
      <Link href={classicsHref({}, { shelf: 'art' })} aria-current={shelf === 'art' ? 'page' : undefined} prefetch={false}>그림</Link>
    </nav>}
    {shelf === 'art'
      ? <ArtShelf items={art.items} filters={current} failed={art.failed} read={read} />
      : <ClassicsShelf items={books.items} filters={current} failed={books.failed} resume={resume} />}
  </div>;
}
