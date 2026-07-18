import Link from 'next/link';
import { STUDY_COUNTRIES } from '@/content/studies';

export const metadata = {
  title: '지역학 | Anatomy Studio',
  description: '언어 너머의 나라 이해 — 지리·역사·경제·사회·문화 레퍼런스',
};

// 지역학 인덱스 — 나라 목록. 1기: 문서가 있는 나라만 노출(빈 껍데기 카드 금지).
export default function Page() {
  return (
    <div className="page-container">
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 6px' }}>지역학</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          언어 너머의 나라 이해. 지리·역사·경제·사회·문화를 공적 통계와 통설 기준으로 정리한 레퍼런스 문서.
        </p>
      </header>
      {STUDY_COUNTRIES.map((country) => (
        <section className="fr-section" key={country.id}>
          <h2 className="fr-section__heading">
            <Link href={`/studies/${country.id}`}>{country.nameKo}</Link>
            <span style={{ marginLeft: 8, fontSize: '0.8rem', opacity: 0.6 }}>{country.nameLocal}</span>
          </h2>
          <p className="fr-section__para">{country.intro}</p>
          <p className="fr-section__para" style={{ fontSize: '0.82rem', opacity: 0.7 }}>
            문서 {country.docs.length}편
          </p>
        </section>
      ))}
    </div>
  );
}
