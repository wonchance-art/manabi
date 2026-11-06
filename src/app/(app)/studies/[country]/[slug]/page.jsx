import { notFound } from 'next/navigation';
import StudiesDocPage from '@/views/StudiesDocPage';
import { STUDY_COUNTRIES, getStudyDoc } from '@/content/studies';
import { publicMetadata } from '@/lib/seo';

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
    title: `${doc.title} | 지역학`,
    description: doc.summary,
  });
}

export default async function Page({ params }) {
  const { country: countryId, slug } = await params;
  const doc = getStudyDoc(countryId, slug);
  if (!doc) notFound();
  return <StudiesDocPage countryId={countryId} slug={slug} />;
}
