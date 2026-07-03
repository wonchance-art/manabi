import Link from 'next/link';

/* ── 파트별 연습실 ── */
const PRACTICE = [
  {
    title: '어휘',
    desc: '저장해 둔 단어를 모아서 집중적으로 복습해요.',
    href: '/vocab',
  },
  {
    title: '문법 복습',
    desc: '지금까지 배운 문법 패턴을 다시 짚어봐요.',
    href: '/review/grammar',
  },
  {
    title: '작문',
    desc: '배운 표현으로 직접 문장을 쓰고 교정을 받아요.',
    href: '/writing',
  },
];

/* ── 소소한 팁 ── */
const TIPS = [
  '문단 속 문장을 탭하면 발음이 나타나요 (입문 단계에서는 처음부터 보여요).',
  '듣기 문항은 어려우면 ‘넘어가기’로 지나갈 수 있어요.',
  '틀린 문제는 세션이 끝날 때 한 번 더 나와요.',
  '매일 한 세션만 꾸준히 하면 복습 시점은 알아서 돌아가요.',
];

const linkStyle = {
  display: 'inline-block',
  marginTop: 14,
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#E8763C',
  textDecoration: 'none',
};

export default function GuidePage() {
  return (
    <div className="page-container" style={{ maxWidth: '760px' }}>

      {/* ── Hero ── */}
      <div className="guide-hero" style={{ marginBottom: 36 }}>
        <h1 className="guide-hero__title">
          오늘 하루,{' '}
          <span className="guide-hero__accent">학습 한 번이면 충분해요</span>
        </h1>
        <p className="guide-hero__sub">
          복습도, 새 문법도, 새 단어도 — 매일 새로 만들어지는 이야기 한 편에 담겨 있어요.
        </p>
      </div>

      {/* ── 1. 하루의 흐름 ── */}
      <section
        className="card"
        style={{
          padding: '28px 28px 30px',
          marginBottom: 20,
          textAlign: 'center',
          background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))',
        }}
      >
        <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>🌅</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>
          하루의 흐름
        </h2>
        <p
          style={{
            fontSize: '0.92rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
            maxWidth: 500,
            margin: '0 auto 22px',
          }}
        >
          오늘 학습을 한 번 하면 하루치가 모두 끝나요. 복습할 단어와 문법, 새로 배울 것,
          그리고 읽을 이야기까지 — 매일 새로 만들어지는 문단 한 편에 자연스럽게 녹아 있어요.
          10문항 안팎, 6~8분이면 충분해요. (격일로 짧은 쓰기도 살짝 섞여요.)
        </p>
        <Link href="/study" className="btn btn--md guide-cta__btn">
          오늘 학습 시작 →
        </Link>
      </section>

      {/* ── 2. 교재는 참고서 ── */}
      <section className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 10 }}>
          📖 교재는 참고서
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          교재는 처음부터 끝까지 정독하는 책이 아니에요. 궁금할 때 찾아보는 참고서에 가까워요.
          맨 앞 입문 챕터(글자·발음·어순)는 가볍게 훑고 넘어가면 돼요.
          학습하다 새 문법을 만나면, ‘자세히’ 링크가 이 교재의 해당 페이지로 데려다줘요.
        </p>
        <Link href="/lessons" style={linkStyle}>
          교재 열기 →
        </Link>
      </section>

      {/* ── 3. 더 하고 싶은 날 — 파트별 연습실 ── */}
      <section className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
          💪 더 하고 싶은 날 — 파트별 연습실
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
          오늘 학습만으로 충분하지만, 더 하고 싶은 날엔 파트별로 골라서 연습할 수 있어요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PRACTICE.map(p => (
            <Link
              key={p.href}
              href={p.href}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {p.title}
              </strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {p.desc}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 4. 서재와 성장 ── */}
      <section className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 10 }}>
          📚 서재와 성장
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          지난 이야기들은 서재에 차곡차곡 쌓여요. 예전에 읽은 문단을 발음 표기 없이 다시 읽어보면,
          그새 얼마나 늘었는지 몸으로 느껴져요. 지금까지 익힌 단어 수와 통과한 챕터도
          여기서 한눈에 볼 수 있어요.
        </p>
        <Link href="/study/library" style={linkStyle}>
          서재 →
        </Link>
      </section>

      {/* ── 5. 소소한 팁 ── */}
      <section className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>
          💡 소소한 팁
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TIPS.map(tip => (
            <li
              key={tip}
              style={{
                fontSize: '0.87rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                paddingLeft: 18,
                position: 'relative',
              }}
            >
              <span style={{ position: 'absolute', left: 0, color: '#E8763C' }}>·</span>
              {tip}
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
