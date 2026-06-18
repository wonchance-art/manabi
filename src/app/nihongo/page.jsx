import Link from 'next/link';
import course from '@/content/community/nihongo42';

export const metadata = {
  title: course.title,
  description: course.subtitle,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

const JP = { fontFamily: 'var(--font-noto-jp), var(--font-klee), sans-serif' };

function Example({ ja, yomi, ko }) {
  return (
    <li style={{ listStyle: 'none', padding: '8px 0', borderTop: '1px solid var(--border, rgba(0,0,0,0.06))' }}>
      <div style={{ ...JP, fontSize: '1.05rem', lineHeight: 1.5 }}>{ja}</div>
      {yomi ? (
        <div style={{ ...JP, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{yomi}</div>
      ) : null}
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 3 }}>{ko}</div>
    </li>
  );
}

function Chapter({ c }) {
  return (
    <div id={`ch-${c.n}`} className="card" style={{ padding: '18px 18px 16px', scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            flex: '0 0 auto', minWidth: 30, height: 30, padding: '0 8px', borderRadius: 8,
            background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontWeight: 700,
            fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          Ch.{c.n}
        </span>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{c.title}</h3>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {c.jp.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ ...JP, fontSize: '1.2rem', fontWeight: 600 }}>{f}</span>
            {c.ko[i] ? (
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{c.ko[i]}</span>
            ) : null}
          </div>
        ))}
        {c.ko.length === 1 && c.jp.length > 1 ? (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{c.ko[0]}</span>
        ) : null}
      </div>

      <p style={{ marginTop: 12, lineHeight: 1.75, fontSize: '0.94rem', color: 'var(--text-secondary)' }}>
        {c.explain}
      </p>

      {c.examples?.length ? (
        <ul style={{ margin: '12px 0 0', padding: 0 }}>
          {c.examples.map((e, i) => (
            <Example key={i} {...e} />
          ))}
        </ul>
      ) : null}

      {c.links?.length ? (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📖 레퍼런스</span>
          {c.links.map((l, i) => (
            <Link key={i} href={`/japanese/grammar/${l.slug}`} className="btn btn--ghost btn--sm">
              {l.label} ↗
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Nihongo42Page() {
  const { title, subtitle, intro, days } = course;
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 20px 90px' }}>
      <header style={{ marginBottom: 28 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--accent, #4a8a5c)', fontWeight: 700, letterSpacing: '0.04em' }}>
          커뮤니티 수업
        </div>
        <h1 style={{ fontSize: '1.9rem', margin: '6px 0 8px', lineHeight: 1.25 }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 14px' }}>{subtitle}</p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.95rem', margin: 0 }}>{intro}</p>
      </header>

      {/* 목차 — Day 리스트 */}
      <nav
        className="card"
        style={{ padding: '14px 16px', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8 }}>📅 14일 커리큘럼</div>
        {days.map((d) => (
          <a
            key={d.day}
            href={`#day-${d.day}`}
            style={{
              display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 6px', borderRadius: 8,
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{ flex: '0 0 auto', fontWeight: 700, fontSize: '0.9rem', minWidth: 92 }}>
              Day{d.day} · {d.range}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {d.chapters.map((c) => c.title).join(' · ')}
            </span>
          </a>
        ))}
      </nav>

      {/* 본문 — Day 섹션 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {days.map((d) => (
          <section key={d.day} id={`day-${d.day}`} style={{ scrollMarginTop: 16 }}>
            <h2
              style={{
                fontSize: '1.25rem', margin: '0 0 14px', paddingBottom: 8,
                borderBottom: '2px solid var(--border, rgba(0,0,0,0.08))',
              }}
            >
              Day{d.day} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· {d.range}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {d.chapters.map((c) => (
                <Chapter key={c.n} c={c} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer style={{ marginTop: 48, paddingTop: 16, borderTop: '1px solid var(--border, rgba(0,0,0,0.08))', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        더 깊이 공부하고 싶다면 각 표현의 <strong>📖 레퍼런스</strong> 링크에서 일본어 문법 챕터를 확인하세요.
      </footer>
    </div>
  );
}
