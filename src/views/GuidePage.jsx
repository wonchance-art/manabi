'use client';

import Link from 'next/link';

/* ── Warm gradient scale: beginner → advanced ── */
const W = [
  { dot: '#F5C34A', bg: 'rgba(245,195,74,0.12)',  line: 'rgba(245,195,74,0.35)'  }, // gold
  { dot: '#F0A040', bg: 'rgba(240,160,64,0.12)',  line: 'rgba(240,160,64,0.35)'  }, // amber
  { dot: '#E8763C', bg: 'rgba(232,118,60,0.12)',  line: 'rgba(232,118,60,0.35)'  }, // terracotta
  { dot: '#D85840', bg: 'rgba(216,88,64,0.12)',   line: 'rgba(216,88,64,0.35)'   }, // coral
  { dot: '#C03C42', bg: 'rgba(192,60,66,0.12)',   line: 'rgba(192,60,66,0.35)'   }, // rose
  { dot: '#A02840', bg: 'rgba(160,40,64,0.12)',   line: 'rgba(160,40,64,0.35)'   }, // deep wine
];

const CURRICULUMS = [
  {
    lang: 'Japanese',
    icon: '🇯🇵',
    title: '일본어 로드맵',
    subtitle: 'JLPT N5 → N1',
    levels: [
      {
        name: 'N5', label: 'N5 기초', focus: '기초 입문', duration: '3–6개월',
        desc: '히라가나·가타카나 완독, 기본 조사와 필수 표현 약 60패턴 습득.',
        can: ['기본 인사', '숫자·날짜 읽기', '간단한 메뉴 이해'],
        quote: '첫 걸음이 가장 어렵습니다. 이미 시작했다면 반은 온 것입니다.',
      },
      {
        name: 'N4', label: 'N4 기본', focus: '일상 회화', duration: '6–12개월',
        desc: '비교·이유·가능형·수동형 등 기초 문법 완성 (약 120패턴). 일상 대화 가능.',
        can: ['편의점·식당 대화', '기본 텍스트 독해', '간단한 SNS 이해'],
        quote: null,
      },
      {
        name: 'N3', label: 'N3 중급', focus: '가교 단계', duration: '12–18개월',
        desc: '경어 체계 이해, 복합적 문법 운용. 일상 텍스트 대부분 이해 (약 200패턴).',
        can: ['드라마 자막 의존 감소', '간단한 뉴스 이해', '일본인과 문자 교환'],
        quote: '언어를 배우는 것은 또 하나의 시선을 갖는 것입니다.',
      },
      {
        name: 'N2', label: 'N2 상급', focus: '사회·직업적 언어', duration: '2–3년',
        desc: '신문·잡지·비즈니스 문서 독해. 논리적 추론 및 고급 회화 (약 400패턴).',
        can: ['일본어로 업무', '원작 만화·소설 읽기', '뉴스 대부분 이해'],
        quote: null,
      },
      {
        name: 'N1', label: 'N1 심화', focus: '원어민 수준', duration: '3–5년',
        desc: '추상적·논리적 복잡한 글 이해. 학술 용어·고급 관용구 완전 습득 (약 600패턴).',
        can: ['원서·학술서 독해', '통역·번역 가능', '일본 기업 취업 자격'],
        quote: '유창함은 언어를 생각 없이 쓰게 되는 순간부터 시작됩니다.',
      },
    ],
  },
  {
    lang: 'English',
    icon: '🇬🇧',
    title: '영어 로드맵',
    subtitle: 'CEFR A1 → C2',
    levels: [
      {
        name: 'A1', label: 'A1 기초', focus: '생존 영어', duration: '1–3개월',
        desc: '기초 인사·자기소개·숫자·날짜. 매우 단순한 일상 대화.',
        can: ['해외여행 기초 회화', '간판·메뉴 읽기', '영어 앱 사용'],
        quote: '모든 전문가는 한때 초보였습니다.',
      },
      {
        name: 'A2', label: 'A2 초급', focus: '단순 소통', duration: '3–6개월',
        desc: '친숙한 주제의 짧은 문장 이해, 일상적인 정보 교환.',
        can: ['짧은 이메일 작성', '쇼핑·길 묻기', '영어 노래 가사 이해'],
        quote: null,
      },
      {
        name: 'B1', label: 'B1 중급', focus: '일상 회화', duration: '6–18개월',
        desc: '여행 상황 대처, 익숙한 주제에 대해 명확하고 표준적인 언어 구사.',
        can: ['팝송·드라마 70% 이해', '영어 회의 참여', '여행 완전 자립'],
        quote: '언어의 한계가 곧 세계의 한계입니다.',
      },
      {
        name: 'B2', label: 'B2 상급', focus: '전문적 소통', duration: '2–3년',
        desc: '전문 분야 논의 가능, 원어민과 자연스러운 상호작용 및 논리적 추론.',
        can: ['원어민과 자연스러운 대화', '영어 프레젠테이션', '해외 취업 지원'],
        quote: null,
      },
      {
        name: 'C1', label: 'C1 고급', focus: '유창한 구사', duration: '3–5년',
        desc: '복잡한 텍스트의 암시적 의미 파악, 학술·직업 상황에서 유연하고 정확한 표현.',
        can: ['외국 대학 강의 수강', 'IELTS 7.0+ / TOEFL 100+', '원서 속독'],
        quote: '두 번째 언어를 배우는 것은 두 번째 삶을 얻는 것입니다.',
      },
      {
        name: 'C2', label: 'C2 마스터', focus: '원어민 수준', duration: '5년+',
        desc: '모든 상황에서 정교하고 완벽한 언어 구사. 뉘앙스·유머·문화적 표현 완전 이해.',
        can: ['영어권 원어민 수준', '전문 번역·통역', '학술 논문 집필'],
        quote: '언어는 영혼의 옷입니다.',
      },
    ],
  },
];

const TIPS = [
  {
    icon: '📖',
    title: '매일 15분 읽기',
    desc: '관심 있는 주제의 원문을 매일 15분씩 읽는 것만으로 1년 뒤 어휘력이 3배 성장합니다.',
  },
  {
    icon: '🧠',
    title: '간격 반복 복습',
    desc: 'FSRS 알고리즘으로 기억이 흐릿해지는 정확한 타이밍에 복습하면 최소 노력으로 최대 기억 효과를 얻습니다.',
  },
  {
    icon: '✍️',
    title: '문장 단위로 저장',
    desc: '단어 하나보다 문맥이 담긴 문장을 함께 저장하면 실제 사용 능력이 훨씬 빠르게 늡니다.',
  },
];

/* ── Subcomponent: single roadmap timeline ── */
function Roadmap({ curr }) {
  return (
    <section>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '10px',
        marginBottom: '28px', paddingBottom: '14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{curr.icon}</span>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {curr.title}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.06em', fontWeight: 500 }}>
            {curr.subtitle}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {curr.levels.map((level, idx) => {
          const w = W[idx];
          const isLast = idx === curr.levels.length - 1;
          return (
            <div key={level.name} style={{ display: 'flex', gap: '18px' }}>
              {/* ── dot + connector ── */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '34px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%',
                  background: w.bg,
                  border: `2px solid ${w.dot}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 800,
                  color: w.dot,
                  marginTop: '10px',
                  flexShrink: 0,
                  letterSpacing: '-0.02em',
                }}>
                  {level.name}
                </div>
                {!isLast && (
                  <div style={{
                    width: '1px', flex: 1, minHeight: '24px',
                    background: `linear-gradient(to bottom, ${W[idx].line}, ${W[idx + 1].line})`,
                    margin: '4px 0',
                  }} />
                )}
              </div>

              {/* ── content ── */}
              <div style={{ flex: 1, paddingBottom: isLast ? '0' : '28px', paddingTop: '8px' }}>
                {/* title row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {level.label}
                  </h3>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600,
                    color: w.dot,
                    background: w.bg,
                    border: `1px solid ${w.line}`,
                    padding: '2px 9px', borderRadius: '99px',
                  }}>
                    {level.focus}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    padding: '2px 8px', borderRadius: '99px',
                  }}>
                    ⏱ {level.duration}
                  </span>
                </div>

                {/* desc */}
                <p style={{ fontSize: '0.855rem', color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: '10px' }}>
                  {level.desc}
                </p>

                {/* can-do tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: level.quote ? '10px' : '0' }}>
                  {level.can.map(c => (
                    <span key={c} style={{
                      fontSize: '0.7rem', color: 'var(--text-muted)',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      padding: '3px 10px', borderRadius: '99px',
                    }}>
                      ✓ {c}
                    </span>
                  ))}
                </div>

                {/* quote */}
                {level.quote && (
                  <div style={{
                    marginTop: '10px',
                    paddingLeft: '12px',
                    borderLeft: `2px solid ${w.line}`,
                    fontSize: '0.775rem',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    lineHeight: 1.65,
                  }}>
                    "{level.quote}"
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Main Page ── */
export default function GuidePage() {
  return (
    <div className="page-container" style={{ maxWidth: '820px' }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: 'center', marginBottom: '56px', padding: '0 8px' }}>
        <div style={{ fontSize: '2rem', marginBottom: '14px' }}>🌏</div>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 4vw, 2.1rem)',
          fontWeight: 800, lineHeight: 1.35,
          marginBottom: '14px',
          color: 'var(--text-primary)',
        }}>
          외국어를 배운다는 것은<br />
          <span style={{ color: '#E8763C' }}>새로운 세계를 여는 것</span>입니다
        </h1>
        <p style={{
          color: 'var(--text-secondary)', fontSize: '0.95rem',
          maxWidth: '440px', margin: '0 auto', lineHeight: 1.8,
        }}>
          어느 레벨에 있든 괜찮습니다.
          지금 이 순간부터의 꾸준함이 전부입니다.
        </p>
      </div>

      {/* ── Roadmaps ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '52px' }}>
        {CURRICULUMS.map(curr => <Roadmap key={curr.lang} curr={curr} />)}
      </div>

      {/* ── Divider ── */}
      <div style={{ margin: '52px 0', borderTop: '1px solid var(--border)' }} />

      {/* ── Tips ── */}
      <div>
        <h2 style={{
          fontSize: '1.1rem', fontWeight: 700,
          marginBottom: '20px', color: 'var(--text-primary)',
        }}>
          💡 효과적인 학습을 위한 세 가지 원칙
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {TIPS.map(tip => (
            <div key={tip.title} style={{
              padding: '20px 22px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '10px' }}>{tip.icon}</div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                {tip.title}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                {tip.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{
        marginTop: '40px',
        padding: '32px 36px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-primary)' }}>
            지금 시작해도 결코 늦지 않았습니다
          </h3>
          <p style={{ fontSize: '0.835rem', color: 'var(--text-secondary)' }}>
            관심 있는 자료를 업로드하면 AI가 즉시 분석해드립니다.
          </p>
        </div>
        <Link
          href="/materials/add"
          className="btn btn--md"
          style={{
            whiteSpace: 'nowrap',
            background: '#E8763C',
            color: '#fff',
            boxShadow: 'none',
            borderRadius: 'var(--radius-md)',
          }}
        >
          첫 자료 업로드하기 →
        </Link>
      </div>

    </div>
  );
}
