import Link from 'next/link';
import course from '@/content/community/nihongo42';

export const metadata = {
  title: course.title,
  description: course.subtitle,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

const THEME = { color: '#3b6ea5', bg: 'rgba(59,110,165,0.12)' };
const numSlot = { display: 'inline-block', minWidth: '1.4em', textAlign: 'right' };

export default function Nihongo42Page() {
  const { title, subtitle, intro, days } = course;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 90px' }}>
      <header style={{ marginBottom: 26 }}>
        <div style={{ fontSize: '0.82rem', color: THEME.color, fontWeight: 700, letterSpacing: '0.04em' }}>
          커뮤니티 수업
        </div>
        <h1 style={{ fontSize: '1.9rem', margin: '6px 0 8px', lineHeight: 1.25 }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 14px' }}>{subtitle}</p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.95rem', margin: 0 }}>{intro}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {days.map((d) => {
          const first = d.chapters[0].n;
          const last = d.chapters[d.chapters.length - 1].n;
          return (
            <Link
              key={d.day}
              href={`/nihongo/${d.day}`}
              className="card"
              style={{ display: 'block', padding: '14px 16px', textDecoration: 'none', color: 'inherit' }}
            >
              {/* 헤더 줄: Day N · Ch.X~Y */}
              <div
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9,
                  paddingBottom: 8, borderBottom: '1px solid var(--border, rgba(0,0,0,0.06))',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '1.02rem', color: THEME.color, whiteSpace: 'nowrap' }}>
                  Day <span style={numSlot}>{d.day}</span>
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Ch.<span style={numSlot}>{first}</span>~<span style={numSlot}>{last}</span>
                </span>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.95rem' }}>→</span>
              </div>

              {/* 그날의 표현 3개 — 전부 표시 (잘림 없음) */}
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {d.chapters.map((c) => (
                  <li key={c.n} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                    <span
                      style={{
                        flex: '0 0 auto', minWidth: '2.7em', color: THEME.color, fontWeight: 700,
                        fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Ch.{c.n}
                    </span>
                    <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                      {c.title}
                    </span>
                  </li>
                ))}
              </ol>
            </Link>
          );
        })}
      </div>

      <footer style={{ marginTop: 36, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Day 카드를 눌러 그날의 표현 3개를 패턴·예문과 함께 자세히 확인하세요.
      </footer>
    </div>
  );
}
