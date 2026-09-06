import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/supabaseServer';
import { buildRefManifest } from '@/content/refManifest';
import { applyManifestOverrides } from '@/lib/contentOverrides';
import LessonsPage from '@/views/LessonsPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: '기존 교재 보관함', robots: { index: false, follow: false } };
const languages = { japanese: 'Japanese', chinese: 'Chinese', english: 'English', french: 'French' };
// Explicit loaders prevent arbitrary filesystem traversal and keep legacy rendering intact.
const pages = {
  japanese: { grammar: () => import('../../../japanese/grammar/[slug]/page'), vocab: () => import('../../../japanese/vocab/[level]/page'), bunkei: () => import('../../../japanese/bunkei/[level]/page') },
  chinese: { grammar: () => import('../../../chinese/grammar/[slug]/page'), vocab: () => import('../../../chinese/vocab/[level]/page'), bunkei: () => import('../../../chinese/bunkei/[level]/page') },
  english: { grammar: () => import('../../../english/grammar/[slug]/page'), vocab: () => import('../../../english/vocab/[level]/page'), bunkei: () => import('../../../english/bunkei/[level]/page') },
  french: { grammar: () => import('../../../french/grammar/[slug]/page'), vocab: () => import('../../../french/vocab/[level]/page'), bunkei: () => import('../../../french/bunkei/[level]/page') },
};
export default async function Page({ params, searchParams }) {
  const auth = await requireAdmin();
  if (auth.error) return <div className="page-container"><h1>관리자 전용 보관함</h1><p>{auth.error}</p><Link href="/lessons">새 교재로 돌아가기</Link></div>;
  const { path = [] } = await params;
  const query = await searchParams;
  const [lang, kind, slug] = path;
  if (path.length > 3 || (lang && !languages[lang]) || (kind && (!pages[lang]?.[kind] || !slug))) notFound();
  const header = <div className="page-container"><p><Link href="/admin">관리자</Link> / <Link href="/admin/legacy-textbooks">기존 교재 보관함</Link></p><p>기존 네 언어의 문법·어휘·문형 교재입니다.</p><div className="manabi-row"><Link href="/admin/textbooks">기존 원고 편집 →</Link><Link href="/admin/books/japanese-n5">새 일본어 N5 원고 편집 →</Link><Link href="/lessons">새 책장 →</Link></div></div>;
  if (kind) {
    const LegacyPage = (await pages[lang][kind]()).default;
    return <>{header}<LegacyPage params={Promise.resolve(kind === 'grammar' ? { slug } : { level: slug })} /></>;
  }
  const manifest = await applyManifestOverrides(buildRefManifest());
  return <>{header}<LessonsPage refManifest={manifest} initialLang={languages[lang] || query?.lang} initialLevel={query?.level} bookAvailable={false} /></>;
}
