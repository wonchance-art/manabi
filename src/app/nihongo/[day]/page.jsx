import Link from 'next/link';
import { notFound } from 'next/navigation';
import course from '@/content/community/nihongo42';
import { JaText, refInline, Callout } from '@/views/refShared';

export function generateStaticParams() {
  return course.days.map((d) => ({ day: String(d.day) }));
}

export function generateMetadata({ params }) {
  const d = course.days.find((x) => String(x.day) === String(params.day));
  return {
    title: d ? `Day ${d.day} · ${course.title}` : course.title,
    robots: { index: false, follow: false },
    alternates: { canonical: null },
  };
}

// 특별 페이지 고정 테마색 (레퍼런스의 레벨색 자리)
const THEME = { color: '#3b6ea5', bg: 'rgba(59,110,165,0.12)', line: 'rgba(59,110,165,0.32)' };

// ・로 구분된 표현은 한 줄씩. 단, 괄호 안의 ・(예: （時間・お金が）)는 나누지 않음
function splitForms(f) {
  const out = [];
  let buf = '', depth = 0;
  for (const ch of f) {
    if (ch === '（' || ch === '(') depth++;
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '・' && depth === 0) { out.push(buf); buf = ''; }
    else buf += ch;
  }
  out.push(buf);
  return out;
}

function Chapter({ c, i }) {
  return (
    <section id={`sec-${i + 1}`} className="card fr-section">
      <h2 className="fr-section__heading">
        <span className="fr-section__num" style={{ background: THEME.bg, color: THEME.color }}>{c.n}</span>
        {c.title}
      </h2>

      {/* 패턴 공식 박스 — 한자 위 후리가나 */}
      <div className="fr-pattern" style={{ borderColor: THEME.color }}>
        <div className="fr-pattern__text">
          {c.jp.map((form, fi) => {
            const lines = splitForms(form);
            return (
              <div key={fi} lang="ja" style={{ marginTop: fi ? 4 : 0 }}>
                {lines.length === 1 ? (
                  <JaText ja={form} yomi={c.jpYomi?.[fi]} fallbackPron={false} />
                ) : (
                  lines.map((line, k) => (
                    <div key={k} style={{ marginTop: k ? 2 : 0 }}>{line}</div>
                  ))
                )}
              </div>
            );
          })}
        </div>
        <div className="fr-pattern__ko">{c.ko.join('  /  ')}</div>
      </div>

      {/* 설명 */}
      {c.explain && (
        <div className="fr-section__detail">
          <p className="fr-section__para">{refInline(c.explain)}</p>
        </div>
      )}

      {/* 🚨 한국인이 헷갈리는 포인트 */}
      {c.pitfall ? <Callout kind="pitfall" text={c.pitfall} /> : null}

      {/* 예문 — 한자 위 후리가나 */}
      {c.examples?.length ? (
        <ul className="fr-examples">
          {c.examples.map((ex, j) => (
            <li key={j} className="fr-example">
              <div className="fr-example__fr">
                <JaText ja={ex.ja} yomi={ex.yomi} />
              </div>
              <div className="fr-example__ko">{ex.ko}</div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 레퍼런스 링크 — 팁 콜아웃 스타일 */}
      {c.links?.length ? (
        <div className="fr-callout fr-callout--tip">
          <span className="fr-callout__label">📖 더 깊이 — 레퍼런스</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {c.links.map((l, k) => (
              <Link key={k} href={`/japanese/grammar/${l.slug}`} className="btn btn--ghost btn--sm">
                {l.label} ↗
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function Nihongo42DayPage({ params }) {
  const d = course.days.find((x) => String(x.day) === String(params.day));
  if (!d) notFound();
  const idx = course.days.findIndex((x) => x.day === d.day);
  const prev = course.days[idx - 1];
  const next = course.days[idx + 1];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 90px' }}>
      <Link href="/nihongo" className="btn btn--ghost btn--sm" style={{ marginBottom: 16, display: 'inline-flex' }}>
        ← 목록
      </Link>

      <header style={{ marginBottom: 18 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.03em', color: THEME.color }}>
          일본어 회화 표현 42
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
          Day {d.day} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '1.05rem' }}>· {d.range}</span>
        </h1>
      </header>

      {/* 핵심 표현 한눈에 */}
      <div className="fr-pattern-summary" style={{ borderColor: THEME.line, background: THEME.bg }}>
        <div className="fr-pattern-summary__title" style={{ color: THEME.color }}>오늘의 표현 한눈에</div>
        <ol className="fr-pattern-summary__list">
          {d.chapters.map((c, i) => (
            <li key={c.n}>
              <a href={`#sec-${i + 1}`} className="fr-pattern-summary__item">
                <span className="fr-pattern-summary__num" style={{ color: THEME.color }}>Ch.{c.n}</span>
                <span className="fr-pattern-summary__text">{c.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <div style={{ marginTop: 16 }}>
        {d.chapters.map((c, i) => (
          <Chapter key={c.n} c={c} i={i} />
        ))}
      </div>

      <nav className="fr-pager" aria-label="Day 이동">
        {prev ? (
          <Link href={`/nihongo/${prev.day}`} className="fr-pager__link">
            <span className="fr-pager__dir">← 이전</span>
            <span className="fr-pager__title">Day {prev.day} · {prev.range}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/nihongo/${next.day}`} className="fr-pager__link fr-pager__link--next">
            <span className="fr-pager__dir">다음 →</span>
            <span className="fr-pager__title">Day {next.day} · {next.range}</span>
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
