import Link from 'next/link';
import course from '@/content/community/nihongo42';

export const metadata = {
  title: course.title,
  description: course.subtitle,
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

const numSlot = { display: 'inline-block', minWidth: '1.5em', textAlign: 'right' };

export default function Nihongo42Page() {
  const { title, subtitle, intro, days } = course;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 90px' }}>
      <header style={{ marginBottom: 26 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--accent, #4a8a5c)', fontWeight: 700, letterSpacing: '0.04em' }}>
          커뮤니티 수업
        </div>
        <h1 style={{ fontSize: '1.9rem', margin: '6px 0 8px', lineHeight: 1.25 }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 14px' }}>{subtitle}</p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.95rem', margin: 0 }}>{intro}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((d) => {
          const first = d.chapters[0].n;
          const last = d.chapters[d.chapters.length - 1].n;
          return (
            <Link
              key={d.day}
              href={`/nihongo/${d.day}`}
              className="card"
              style={{
                display: 'grid',
                gridTemplateColumns: '62px 98px 1fr',
                gap: 12,
                alignItems: 'baseline',
                padding: '14px 16px',
                textDecoration: 'none',
                color: 'inherit',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                Day <span style={numSlot}>{d.day}</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                Ch.<span style={numSlot}>{first}</span>~<span style={numSlot}>{last}</span>
              </span>
              <span
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.chapters.map((c) => c.title).join(' · ')}
              </span>
            </Link>
          );
        })}
      </div>

      <footer style={{ marginTop: 36, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Day를 눌러 그날의 표현 3개를 자세히 확인하세요.
      </footer>
    </div>
  );
}
