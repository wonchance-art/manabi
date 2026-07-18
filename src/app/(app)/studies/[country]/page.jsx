import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STUDY_COUNTRIES, STUDY_DOMAINS, getStudyCountry } from '@/content/studies';

export function generateStaticParams() {
  return STUDY_COUNTRIES.map((country) => ({ country: country.id }));
}

export async function generateMetadata({ params }) {
  const { country: countryId } = await params;
  const country = getStudyCountry(countryId);
  if (!country) return { title: '지역학 | Anatomy Studio' };
  return {
    title: `${country.nameKo} | 지역학 | Anatomy Studio`,
    description: country.intro,
  };
}

// 나라 허브 — 도메인별 문서 목차. 저작된 문서만 링크, 미저작 도메인은 준비 중 표기.
export default async function Page({ params }) {
  const { country: countryId } = await params;
  const country = getStudyCountry(countryId);
  if (!country) notFound();

  return (
    <div className="page-container">
      <nav style={{ fontSize: '0.82rem', marginBottom: 12, opacity: 0.8 }}>
        <Link href="/studies">지역학</Link>{' / '}<span>{country.nameKo}</span>
      </nav>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 6px' }}>{country.nameKo} <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>{country.nameLocal}</span></h1>
        <p style={{ margin: 0, opacity: 0.85 }}>{country.intro}</p>
      </header>
      {STUDY_DOMAINS.map((domain) => {
        const docs = country.docs.filter((doc) => doc.domain === domain.id);
        return (
          <section className="fr-section" key={domain.id}>
            <h2 className="fr-section__heading">{domain.label}</h2>
            {docs.length === 0 ? (
              <p className="fr-section__para" style={{ opacity: 0.55 }}>준비 중</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {docs.map((doc) => (
                  <li key={doc.slug} style={{ marginBottom: 6 }}>
                    <Link href={`/studies/${country.id}/${doc.slug}`}>{doc.title}</Link>
                    <p style={{ margin: '2px 0 0', fontSize: '0.82rem', opacity: 0.75 }}>{doc.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
