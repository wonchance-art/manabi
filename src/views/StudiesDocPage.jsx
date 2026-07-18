import Link from 'next/link';
import { getStudyCountry, getStudyDoc, studyDomainLabel } from '../content/studies';

// 📚 지역학 문서 뷰 — 순수 서버 렌더(클라이언트 JS 0). 문법 레퍼런스의 fr-* 문서 타이포그래피를
// 재사용해 일관된 판면을 유지한다. 문서 스키마: sections[{heading, paras[], table?}], sources[],
// verification. 출처·검증 노트는 전문성 요건의 핵심이라 본문 아래 고정 블록으로 노출한다.

function DocTable({ table }) {
  if (!table?.rows?.length) return null;
  return (
    <div className="fr-table-wrap">
      <table className="fr-table">
        <thead>
          <tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudiesDocPage({ countryId, slug }) {
  const country = getStudyCountry(countryId);
  const doc = getStudyDoc(countryId, slug);
  if (!country || !doc) return null;

  return (
    <div className="page-container">
      <nav style={{ fontSize: '0.82rem', marginBottom: 12, opacity: 0.8 }}>
        <Link href="/studies">지역학</Link>
        {' / '}
        <Link href={`/studies/${country.id}`}>{country.nameKo}</Link>
        {' / '}
        <span>{studyDomainLabel(doc.domain)}</span>
      </nav>

      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 6px' }}>{doc.title}</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>{doc.summary}</p>
        <p style={{ margin: '6px 0 0', fontSize: '0.78rem', opacity: 0.6 }}>최종 갱신 {doc.updated}</p>
      </header>

      {doc.sections.map((section, index) => (
        <section className="fr-section" key={section.heading} id={`sec-${index + 1}`}>
          <h2 className="fr-section__heading">
            <span className="fr-section__num">{index + 1}</span> {section.heading}
          </h2>
          {section.paras.map((para) => (
            <p className="fr-section__para" key={para.slice(0, 24)}>{para}</p>
          ))}
          <DocTable table={section.table} />
        </section>
      ))}

      <section className="fr-section" aria-label="출처와 검증">
        <h2 className="fr-section__heading">출처·검증 노트</h2>
        <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
          {doc.sources.map((source) => (
            <li key={source.label} style={{ marginBottom: 4 }}>
              <strong>{source.label}</strong>
              <span style={{ opacity: 0.75 }}> — {source.scope}</span>
            </li>
          ))}
        </ul>
        <p className="fr-section__para" style={{ fontSize: '0.82rem', opacity: 0.8 }}>{doc.verification}</p>
      </section>
    </div>
  );
}
