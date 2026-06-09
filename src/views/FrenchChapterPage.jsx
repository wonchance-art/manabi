import Link from 'next/link';
import { getChapter, getLevelMeta } from '../content/french';
import { frInline, Callout, CALLOUT_ORDER, LevelDot } from './frenchShared';
import FrenchReadMark from '../components/FrenchReadMark';

function ExampleList({ examples }) {
  if (!examples?.length) return null;
  return (
    <ul className="fr-examples">
      {examples.map((ex, i) => (
        <li key={i} className="fr-example">
          <div className="fr-example__fr">
            <span lang="fr">{ex.fr}</span>
            {ex.ipa && <span className="fr-example__ipa">{ex.ipa}</span>}
          </div>
          <div className="fr-example__ko">{ex.ko}</div>
          {ex.note && <div className="fr-example__note">└ {frInline(ex.note)}</div>}
        </li>
      ))}
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
            <tr key={i}>{row.map((cell, j) => <td key={j} lang={j > 0 ? undefined : 'fr'}>{frInline(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 프랑스어 문법 챕터 상세 페이지
 */
export default function FrenchChapterPage({ slug }) {
  const data = getChapter(slug);

  if (!data) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>챕터를 찾을 수 없어요</h1>
        <Link href="/lessons?lang=French" className="btn btn--ghost btn--sm">프랑스어 강의 목록으로 →</Link>
      </div>
    );
  }

  const { chapter, prev, next } = data;
  const meta = getLevelMeta(chapter.level);

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      <FrenchReadMark slug={chapter.slug} />

      {/* ── 브레드크럼 ── */}
      <nav style={{ marginBottom: 18 }} aria-label="브레드크럼">
        <Link href="/lessons?lang=French" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ← 프랑스어 강의 목록
        </Link>
      </nav>

      {/* ── 헤더 ── */}
      <header style={{ marginBottom: 28 }}>
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
          <p lang="fr" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
            {chapter.titleFr}
          </p>
        )}
        {chapter.summary && (
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10 }}>
            {chapter.summary}
          </p>
        )}
      </header>

      {/* ── 본문 섹션 ── */}
      {chapter.sections.map((sec, i) => (
        <section key={i} className="card fr-section">
          <h2 className="fr-section__heading">
            <span className="fr-section__num" style={{ color: meta?.color }}>{i + 1}</span>
            {sec.heading}
          </h2>
          {sec.body && sec.body.split(/\n\n/).map((para, j) => (
            <p key={j} className="fr-section__para">{frInline(para)}</p>
          ))}
          <SectionTable table={sec.table} />
          <ExampleList examples={sec.examples} />
          {CALLOUT_ORDER.map(kind => (
            <Callout key={kind} kind={kind} text={sec[kind]} />
          ))}
        </section>
      ))}

      {/* ── 이전/다음 ── */}
      <nav className="fr-pager" aria-label="챕터 이동">
        {prev ? (
          <Link href={`/french/grammar/${prev.slug}`} className="fr-pager__link">
            <span className="fr-pager__dir">← 이전 · {getLevelMeta(prev.level)?.label}</span>
            <span className="fr-pager__title">{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/french/grammar/${next.slug}`} className="fr-pager__link fr-pager__link--next">
            <span className="fr-pager__dir">{getLevelMeta(next.level)?.label} · 다음 →</span>
            <span className="fr-pager__title">{next.title}</span>
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
