import Link from 'next/link';
import { getRefLang } from '../content/refLangs';
import { refInline, refMain, refPron, Callout, CALLOUT_ORDER, LevelDot } from './refShared';
import RefReadMark from '../components/RefReadMark';

function ExampleList({ examples, langCode }) {
  if (!examples?.length) return null;
  return (
    <ul className="fr-examples">
      {examples.map((ex, i) => {
        const pron = refPron(ex);
        return (
          <li key={i} className="fr-example">
            <div className="fr-example__fr">
              <span lang={langCode}>{refMain(ex)}</span>
              {pron && <span className="fr-example__ipa">{pron}</span>}
            </div>
            <div className="fr-example__ko">{ex.ko}</div>
            {ex.note && <div className="fr-example__note">└ {refInline(ex.note)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function SectionTable({ table }) {
  if (!table?.rows?.length) return null;
  return (
    <div className="fr-table-wrap">
      <table className="fr-table">
        {table.caption && <caption>{table.caption}</caption>}
        {table.headers?.length > 0 && (
          <thead>
            <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{refInline(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 언어 레퍼런스 — 문법 챕터 상세 페이지 (프랑스어·일본어·영어 공용)
 */
export default function ReferenceChapterPage({ lang, slug }) {
  const ref = getRefLang(lang);
  const data = ref?.getChapter(slug);
  const backHref = `/lessons?lang=${lang}&view=ref`;

  if (!data) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>챕터를 찾을 수 없어요</h1>
        <Link href={backHref} className="btn btn--ghost btn--sm">{ref?.name || ''} 강의 목록으로 →</Link>
      </div>
    );
  }

  const { chapter, prev, next } = data;
  const meta = ref.getLevelMeta(chapter.level);
  // 핵심 패턴 한눈에 — pattern이 있는 섹션만 모아 상단 요약
  const patternIndex = chapter.sections
    .map((sec, i) => ({ i, pattern: sec.pattern }))
    .filter(p => p.pattern);

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <RefReadMark storageKey={ref.readKey} slug={chapter.slug} />

      {/* ── 브레드크럼 ── */}
      <nav style={{ marginBottom: 18 }} aria-label="브레드크럼">
        <Link href={backHref} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ← {ref.flag} {ref.name} 강의 목록
        </Link>
      </nav>

      {/* ── 헤더 ── */}
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <LevelDot meta={meta} size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {meta?.label} · 문법 #{chapter.order}
          </span>
          {chapter.duration && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>⏱ {chapter.duration}</span>
          )}
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.35 }}>{chapter.title}</h1>
        {chapter.titleFr && (
          <p lang={ref.langCode} style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
            {chapter.titleFr}
          </p>
        )}
        {chapter.summary && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
            {chapter.summary}
          </p>
        )}
      </header>

      {/* ── 핵심 패턴 한눈에 ── */}
      {patternIndex.length > 0 && (
        <div className="fr-pattern-summary" style={{ borderColor: meta?.line, background: meta?.bg }}>
          <div className="fr-pattern-summary__title" style={{ color: meta?.color }}>📌 핵심 패턴 한눈에</div>
          <ol className="fr-pattern-summary__list">
            {patternIndex.map(p => (
              <li key={p.i}>
                <a href={`#sec-${p.i + 1}`} className="fr-pattern-summary__item">
                  <span className="fr-pattern-summary__num" style={{ color: meta?.color }}>{p.i + 1}</span>
                  <span className="fr-pattern-summary__text">{refInline(p.pattern)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── 본문 섹션 ── */}
      {chapter.sections.map((sec, i) => (
        <section key={i} id={`sec-${i + 1}`} className="card fr-section">
          <h2 className="fr-section__heading">
            <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
            {sec.heading}
          </h2>

          {/* 패턴 공식 박스 — 섹션의 핵심을 가장 먼저, 가장 크게 */}
          {sec.pattern && (
            <div className="fr-pattern" style={{ borderColor: meta?.color }}>
              <div className="fr-pattern__text">{refInline(sec.pattern)}</div>
              {sec.patternKo && <div className="fr-pattern__ko">{sec.patternKo}</div>}
            </div>
          )}

          <SectionTable table={sec.table} />
          <ExampleList examples={sec.examples} langCode={ref.langCode} />

          {/* 상세 설명 — 패턴·예문 아래의 부가 설명 */}
          {sec.body && (
            <div className="fr-section__detail">
              {sec.body.split(/\n\n/).map((para, j) => (
                <p key={j} className="fr-section__para">{refInline(para)}</p>
              ))}
            </div>
          )}

          {CALLOUT_ORDER.map(kind => (
            <Callout key={kind} kind={kind} text={sec[kind]} />
          ))}
        </section>
      ))}

      {/* ── 이전/다음 ── */}
      <nav className="fr-pager" aria-label="챕터 이동">
        {prev ? (
          <Link href={`${ref.base}/grammar/${prev.slug}`} className="fr-pager__link">
            <span className="fr-pager__dir">← 이전 · {ref.getLevelMeta(prev.level)?.label}</span>
            <span className="fr-pager__title">{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`${ref.base}/grammar/${next.slug}`} className="fr-pager__link fr-pager__link--next">
            <span className="fr-pager__dir">{ref.getLevelMeta(next.level)?.label} · 다음 →</span>
            <span className="fr-pager__title">{next.title}</span>
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
