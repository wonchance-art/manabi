import { notFound } from 'next/navigation';
import StudiesDocPage from '@/views/StudiesDocPage';
import { STUDY_COUNTRIES, getStudyDoc } from '@/content/studies';

export function generateStaticParams() {
  return STUDY_COUNTRIES.flatMap((country) =>
    country.docs.map((doc) => ({ country: country.id, slug: doc.slug })),
  );
}

export async function generateMetadata({ params }) {
  const { country: countryId, slug } = await params;
  const doc = getStudyDoc(countryId, slug);
  if (!doc) return { title: '지역학 | Anatomy Studio' };
  return {
    title: `${doc.title} | 지역학 | Anatomy Studio`,
    description: doc.summary,
  };
}

export default async function Page({ params }) {
  const { country: countryId, slug } = await params;
  const doc = getStudyDoc(countryId, slug);
  if (!doc) notFound();
  return <StudiesDocPage countryId={countryId} slug={slug} />;
}
