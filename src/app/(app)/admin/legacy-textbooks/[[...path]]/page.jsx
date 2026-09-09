import Link from '@/components/ArchiveLink';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/supabaseServer';
import { buildRefManifest } from '@/content/refManifest';
import { applyManifestOverrides } from '@/lib/contentOverrides';
import LessonsPage from '@/views/LessonsPage';
import ReferenceChapterPage from '@/views/ReferenceChapterPage';
import { loadChapter } from '@/content/refGrammarLoaders';

export const dynamic = 'force-dynamic';
export const metadata = { title: '기존 교재 보관함', robots: { index: false, follow: false } };
const languages = { japanese: 'Japanese', chinese: 'Chinese', english: 'English', french: 'French' };
// Only the two secondary page kinds need route adapters. Grammar shares its renderer directly.
const pages = {
  japanese: { vocab: () => import('../../../japanese/vocab/[level]/page'), bunkei: () => import('../../../japanese/bunkei/[level]/page') },
  chinese: { vocab: () => import('../../../chinese/vocab/[level]/page'), bunkei: () => import('../../../chinese/bunkei/[level]/page') },
  english: { vocab: () => import('../../../english/vocab/[level]/page'), bunkei: () => import('../../../english/bunkei/[level]/page') },
  french: { vocab: () => import('../../../french/vocab/[level]/page'), bunkei: () => import('../../../french/bunkei/[level]/page') },
};
export default async function Page({ params, searchParams }) {
  const auth = await requireAdmin();
  if (auth.error) return <div className="page-container"><h1>관리자 전용 보관함</h1><p>{auth.error}</p><Link href="/lessons">새 교재로 돌아가기</Link></div>;
  const { path = [] } = await params;
  const query = await searchParams;
  const [lang, kind, slug] = path;
  if (path.length > 3 || (lang && !languages[lang]) || (kind && ((kind !== 'grammar' && !pages[lang]?.[kind]) || !slug))) notFound();
  const header = <div className="page-container"><p><Link href="/admin">관리자</Link> / <Link href="/admin/legacy-textbooks">기존 교재 보관함</Link></p><p>기존 네 언어의 문법·어휘·문형 교재입니다.</p><div className="manabi-row"><Link href="/admin/textbooks">기존 원고 편집 →</Link><Link href="/admin/books/japanese-n5">새 일본어 N5 원고 편집 →</Link><Link href="/lessons">새 책장 →</Link></div></div>;
  if (kind === 'grammar') {
    // Share the canonical loader and renderer rather than importing another route's
    // page module: the archive must own its RSC/client-reference rendering boundary.
    const loaded = await loadChapter(languages[lang], slug);
    if (!loaded?.data) notFound();
    return <>{header}<ReferenceChapterPage lang={languages[lang]} slug={slug} {...loaded} /></>;
  }
  if (kind) {
    const LegacyPage = (await pages[lang][kind]()).default;
    return <>{header}<LegacyPage params={Promise.resolve({ level: slug })} /></>;
  }
  const manifest = await applyManifestOverrides(buildRefManifest());
  return <>{header}<LessonsPage refManifest={manifest} initialLang={languages[lang] || query?.lang} initialLevel={query?.level} bookAvailable={false} /></>;
}
