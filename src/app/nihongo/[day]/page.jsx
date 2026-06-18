import Link from 'next/link';
import { notFound } from 'next/navigation';
import course from '@/content/community/nihongo42';

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

const JP = { fontFamily: 'var(--font-noto-jp), var(--font-klee), sans-serif' };

function Example({ ja, yomi, ko }) {
  return (
    <li style={{ listStyle: 'none', padding: '8px 0', borderTop: '1px solid var(--border, rgba(0,0,0,0.06))' }}>
      <div style={{ ...JP, fontSize: '1.05rem', lineHeight: 1.5 }}>{ja}</div>
      {yomi ? <div style={{ ...JP, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{yomi}</div> : null}
      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 3 }}>{ko}</div>
    </li>
  );
}

function Chapter({ c }) {
  return (
    <div className="card" style={{ padding: '18px 18px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            flex: '0 0 auto', minWidth: 30, height: 30, padding: '0 8px', borderRadius: 8,
            background: 'var(--bg-subtle)', color: 'var(--text-secondary)', fontWeight: 700,
            fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
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
            {c.ko[i] ? <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{c.ko[i]}</span> : null}
          </div>
        ))}
        {c.ko.length === 1 && c.jp.length > 1 ? (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{c.ko[0]}</span>
        ) : null}
      </div>

      <p style={{ marginTop: 12, lineHeight: 1.75, fontSize: '0.94rem', color: 'var(--text-secondary)' }}>{c.explain}</p>

      {c.examples?.length ? (
        <ul style={{ margin: '12px 0 0', padding: 0 }}>
          {c.examples.map((e, i) => <Example key={i} {...e} />)}
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

export default function Nihongo42DayPage({ params }) {
  const d = course.days.find((x) => String(x.day) === String(params.day));
  if (!d) notFound();
  const idx = course.days.findIndex((x) => x.day === d.day);
  const prev = course.days[idx - 1];
  const next = course.days[idx + 1];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 90px' }}>
      <Link href="/nihongo" className="btn btn--ghost btn--sm" style={{ marginBottom: 18, display: 'inline-flex' }}>
        ← 목록
      </Link>

      <h1 style={{ fontSize: '1.55rem', margin: '6px 0 18px', fontVariantNumeric: 'tabular-nums' }}>
        Day {d.day} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '1.1rem' }}>· {d.range}</span>
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {d.chapters.map((c) => <Chapter key={c.n} c={c} />)}
      </div>

      <nav
        style={{
          marginTop: 32, display: 'flex', justifyContent: 'space-between', gap: 10,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {prev ? (
          <Link href={`/nihongo/${prev.day}`} className="btn btn--ghost btn--sm">← Day {prev.day}</Link>
        ) : <span />}
        {next ? (
          <Link href={`/nihongo/${next.day}`} className="btn btn--ghost btn--sm">Day {next.day} →</Link>
        ) : <span />}
      </nav>
    </div>
  );
}
