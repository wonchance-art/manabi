import Link from 'next/link';
import ClassicsShelf from '@/components/web/ClassicsShelf';
import { classicsFilters } from '@/lib/classicsShelf';
import { releasedClassicsOf } from '@/lib/server/classicsReading';
import { suggestionClient } from '@/lib/server/suggestionReading';
export const dynamic = 'force-dynamic';
export const metadata = { title: '고전 명작', description: '원문 그대로 읽는 고전 — 일본어 · 영어 · 프랑스어 · 중국어 · 한국어 명작.' };

// 산책 「고전 명작」(DISCOVER-CLASSICS-001). 1차는 「책」 구간 하나라 구간 탭을 두지 않는다 — 그림 · 건축 구간이 생길 때 탭이 나타난다.
// 보이는 책 = 발행 기록(canonical_book_shelf)이 있는 정본만. 표시는 저장소 대조표(classicsShelf.js)에서.
export default async function Page({ searchParams }) {
  const filters = classicsFilters(await searchParams);
  const { items, failed } = await releasedClassicsOf(suggestionClient());
  return <div className="manabi-page classics-page">
    <header className="manabi-page-heading"><div><Link className="manabi-link" href="/discover">← 산책</Link><h1>고전 명작</h1></div></header>
    <ClassicsShelf items={items} filters={filters} failed={failed} />
  </div>;
}
