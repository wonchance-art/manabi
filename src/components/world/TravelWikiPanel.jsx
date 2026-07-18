'use client';

// 📱 여행 폰 — 게임 안 다이제틱 위키 브라우저(여행 수첩의 「폰」 탭).
// GTA 휴대폰·포켓몬 PC처럼 게임 밖으로 나가지 않고, 폰 화면 프레임 안에서 지역학 문서를
// 검색·열람한다. 데이터는 travelWiki(→ studies 레지스트리 단일 진실원)만 소비한다.

import { useMemo, useState } from 'react';
import { searchWiki, wikiCountries, wikiDoc, wikiDomainLabel } from '../../lib/world/travelWiki';
import { GBC, gbcButtonPrimary } from './QuestReview';

function PhoneFrame({ title, onBack, children }) {
  return (
    <div style={{
      border: `3px solid ${GBC.border}`, borderRadius: 10, background: '#101613',
      padding: '6px 6px 10px', display: 'grid', gridTemplateRows: '20px 1fr', gap: 6, minHeight: 300,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#9fc9a8', fontSize: '0.52rem', padding: '0 4px' }}>
        <span>{onBack ? (
          <button type="button" onClick={onBack} style={{ border: 0, background: 'transparent', color: '#9fc9a8', fontFamily: GBC.font, fontSize: '0.56rem', cursor: 'pointer', padding: 0 }}>
            ← 뒤로
          </button>
        ) : '📶 manabi'}</span>
        <span aria-hidden>🔋</span>
      </div>
      <div style={{ background: GBC.cream, border: `2px solid ${GBC.border}`, borderRadius: 4, padding: 7, overflowY: 'auto', maxHeight: 340 }}>
        <strong style={{ display: 'block', fontSize: '0.62rem', marginBottom: 6 }}>{title}</strong>
        {children}
      </div>
    </div>
  );
}

function DocReader({ countryId, slug, onBack }) {
  const found = wikiDoc(countryId, slug);
  if (!found) return null;
  const { doc } = found;
  return (
    <PhoneFrame title={`🌏 ${doc.title}`} onBack={onBack}>
      <p style={{ margin: '0 0 7px', fontSize: '0.56rem', lineHeight: 1.5, color: GBC.inkSoft }}>{doc.summary}</p>
      {doc.sections.map((section, index) => (
        <section key={section.heading} style={{ marginBottom: 8 }}>
          <strong style={{ display: 'block', fontSize: '0.6rem', marginBottom: 3 }}>{index + 1}. {section.heading}</strong>
          {section.paras.map((para) => (
            <p key={para.slice(0, 20)} style={{ margin: '0 0 5px', fontSize: '0.56rem', lineHeight: 1.55 }}>{para}</p>
          ))}
          {section.table && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.52rem', margin: '3px 0 5px' }}>
              <thead>
                <tr>{section.table.head.map((cell) => <th key={cell} style={{ border: `1px solid ${GBC.border}`, padding: '2px 4px', background: GBC.creamShade, textAlign: 'left' }}>{cell}</th>)}</tr>
              </thead>
              <tbody>
                {section.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={{ border: `1px solid ${GBC.border}`, padding: '2px 4px' }}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      <p style={{ margin: 0, fontSize: '0.5rem', color: GBC.inkSoft, lineHeight: 1.5 }}>
        출처: {doc.sources.map((source) => source.label).join(' · ')} — 최종 갱신 {doc.updated}
      </p>
    </PhoneFrame>
  );
}

export default function TravelWikiPanel({ initialDoc = null }) {
  const [query, setQuery] = useState('');
  // { countryId, slug } — 딥링크(장소 「더 알아보기」)로 열리면 해당 문서 리더에서 시작한다.
  const [reading, setReading] = useState(initialDoc);
  const results = useMemo(() => searchWiki(query), [query]);
  const countries = wikiCountries();

  if (reading) {
    return <DocReader countryId={reading.countryId} slug={reading.slug} onBack={() => setReading(null)} />;
  }

  return (
    <PhoneFrame title="🔎 여행 위키">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="위키 검색 (예: 경어, 마쓰리, 반도체)"
        aria-label="여행 위키 검색"
        style={{ width: '100%', boxSizing: 'border-box', fontFamily: GBC.font, fontSize: '0.6rem', padding: '6px 7px', background: GBC.creamHi, color: GBC.ink, border: `2px solid ${GBC.border}`, marginBottom: 7 }}
      />
      {!query && (
        <p style={{ margin: '0 0 6px', fontSize: '0.53rem', color: GBC.inkSoft, lineHeight: 1.5 }}>
          나라 사전 {countries.length}권 · 문서 {results.length}편 — 언어 너머의 나라 이해를 폰으로 찾아봐요.
        </p>
      )}
      <div style={{ display: 'grid', gap: 5 }}>
        {results.map((result) => (
          <button
            key={`${result.countryId}:${result.slug}`}
            type="button"
            onClick={() => setReading({ countryId: result.countryId, slug: result.slug })}
            style={{ ...gbcButtonPrimary, textAlign: 'left', padding: 6, background: GBC.creamHi, color: GBC.ink, display: 'block' }}
          >
            <strong style={{ display: 'block', fontSize: '0.58rem' }}>
              {result.countryName} · {wikiDomainLabel(result.domain)} — {result.title}
            </strong>
            <span style={{ display: 'block', marginTop: 3, fontSize: '0.52rem', lineHeight: 1.45, color: GBC.inkSoft, fontWeight: 400 }}>{result.snippet}</span>
          </button>
        ))}
        {results.length === 0 && <p style={{ textAlign: 'center', fontSize: '0.58rem', color: GBC.inkSoft }}>검색 결과가 없어요.</p>}
      </div>
    </PhoneFrame>
  );
}
