import { notFound } from 'next/navigation';
import StudiesDocPage from '@/views/StudiesDocPage';
import { STUDY_COUNTRIES, getStudyDoc } from '@/content/studies';
import { publicMetadata } from '@/lib/seo';
import KrStudiesSubset from '@/components/fonts/kr-viewer/KrStudiesSubset';

export function generateStaticParams() {
  return STUDY_COUNTRIES.flatMap((country) =>
    country.docs.map((doc) => ({ country: country.id, slug: doc.slug })),
  );
}

export async function generateMetadata({ params }) {
  const { country: countryId, slug } = await params;
  const doc = getStudyDoc(countryId, slug);
  if (!doc) return { title: '지역학', robots: null }; // 없는 주소 — 쪽의 notFound()가 noindex 한 줄을 단다(루트 index와 겹치지 않게)
  return publicMetadata(`/studies/${countryId}/${doc.slug}`, {
    title: `${doc.title} · 지역학`,
    description: doc.summary,
  });
}

export default async function Page({ params }) {
  const { country: countryId, slug } = await params;
  const doc = getStudyDoc(countryId, slug);
  if (!doc) notFound();
  // 첫 화면 한글 하위 집합(STUDIES-CLS-001) — 본문 한글이 대체 글꼴로 그려졌다가 바뀌며 줄이 다시 흐르지 않게 첫 그림 전에 받는다.
  return (
    <>
      <KrStudiesSubset countryId={countryId} slug={doc.slug} />
      <StudiesDocPage countryId={countryId} slug={slug} />
    </>
  );
}
