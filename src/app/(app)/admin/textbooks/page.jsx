import Link from 'next/link';
import { REF_LANGS } from '@/content/refLangs';
import { requireAdmin } from '@/lib/supabaseServer';
import TextbookEditor from '@/components/admin/TextbookEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '교재 편집 | manabi', robots: { index: false, follow: false } };

export default async function Page({ searchParams }) {
  const auth = await requireAdmin();
  if (auth.error) return <div className="page-container"><h1>관리자 전용 페이지</h1>
    <p>{auth.error}</p><Link href="/lessons">교재로 돌아가기</Link></div>;
  const params = await searchParams;
  const catalog = Object.entries(REF_LANGS).map(([lang, ref]) => ({
    lang, name: ref.name, base: ref.base,
    chapters: ref.ALL_CHAPTERS.map(({ slug, level, order, title }) => ({ slug, level, order, title })),
  }));
  return <TextbookEditor catalog={catalog} initialLang={params?.lang} initialSlug={params?.slug} />;
}
