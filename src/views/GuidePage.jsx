'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { parseTitle } from '../lib/seriesMeta';

async function fetchLevelData() {
  const { data } = await supabase
    .from('reading_materials')
    .select('id, title, processed_json')
    .eq('visibility', 'public')
    .limit(300);
  const counts = {};
  const byLevel = {};
  for (const m of data || []) {
    const lvl = m.processed_json?.metadata?.level;
    if (!lvl) continue;
    counts[lvl] = (counts[lvl] || 0) + 1;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(m);
  }
  // 레벨별로 시리즈→번호 순 정렬, 상위 6편만 샘플
  const samples = {};
  for (const lvl of Object.keys(byLevel)) {
    const arr = byLevel[lvl].slice().sort((a, b) => {
      const ma = parseTitle(a.title);
      const mb = parseTitle(b.title);
      const sa = ma.series || '￿';
      const sb = mb.series || '￿';
      if (sa !== sb) return sa.localeCompare(sb);
      if (ma.num != null && mb.num != null) return ma.num - mb.num;
      if (ma.num != null) return -1;
      if (mb.num != null) return 1;
      return 0;
    });
    samples[lvl] = arr.slice(0, 6).map(m => ({ id: m.id, title: m.title }));
  }
  return { counts, samples };
}

async function fetchCompletedIds() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return new Set();
  const { data } = await supabase
    .from('reading_progress')
    .select('material_id')
    .eq('user_id', session.user.id)
    .eq('is_completed', true);
  return new Set((data || []).map(r => r.material_id));
}

/* ── Warm gradient scale: beginner → advanced ── */
const W = [
  { dot: '#F5C34A', bg: 'rgba(245,195,74,0.12)', line: 'rgba(245,195,74,0.35)' },
  { dot: '#F0A040', bg: 'rgba(240,160,64,0.12)', line: 'rgba(240,160,64,0.35)' },
  { dot: '#E8763C', bg: 'rgba(232,118,60,0.12)', line: 'rgba(232,118,60,0.35)' },
  { dot: '#D85840', bg: 'rgba(216,88,64,0.12)', line: 'rgba(216,88,64,0.35)' },
  { dot: '#C03C42', bg: 'rgba(192,60,66,0.12)', line: 'rgba(192,60,66,0.35)' },
  { dot: '#A02840', bg: 'rgba(160,40,64,0.12)', line: 'rgba(160,40,64,0.35)' },
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
      },
      {
        name: 'N4', label: 'N4 기본', focus: '일상 회화', duration: '6–12개월',
        desc: '비교·이유·가능형·수동형 등 기초 문법 완성 (약 120패턴). 일상 대화 가능.',
        can: ['편의점·식당 대화', '기본 텍스트 독해', '간단한 SNS 이해'],
      },
      {
        name: 'N3', label: 'N3 중급', focus: '가교 단계', duration: '12–18개월',
        desc: '경어 체계 이해, 복합적 문법 운용. 일상 텍스트 대부분 이해 (약 200패턴).',
        can: ['드라마 자막 의존 감소', '간단한 뉴스 이해', '일본인과 문자 교환'],
      },
      {
        name: 'N2', label: 'N2 상급', focus: '사회·직업적 언어', duration: '2–3년',
        desc: '신문·잡지·비즈니스 문서 독해. 논리적 추론 및 고급 회화 (약 400패턴).',
        can: ['일본어로 업무', '원작 만화·소설 읽기', '뉴스 대부분 이해'],
      },
      {
        name: 'N1', label: 'N1 심화', focus: '원어민 수준', duration: '3–5년',
        desc: '추상적·논리적 복잡한 글 이해. 학술 용어·고급 관용구 완전 습득 (약 600패턴).',
        can: ['원서·학술서 독해', '통역·번역 가능', '일본 기업 취업 자격'],
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
      },
      {
        name: 'A2', label: 'A2 초급', focus: '단순 소통', duration: '3–6개월',
        desc: '친숙한 주제의 짧은 문장 이해, 일상적인 정보 교환.',
        can: ['짧은 이메일 작성', '쇼핑·길 묻기', '영어 노래 가사 이해'],
      },
      {
        name: 'B1', label: 'B1 중급', focus: '일상 회화', duration: '6–18개월',
        desc: '여행 상황 대처, 익숙한 주제에 대해 명확하고 표준적인 언어 구사.',
        can: ['팝송·드라마 70% 이해', '영어 회의 참여', '여행 완전 자립'],
      },
      {
        name: 'B2', label: 'B2 상급', focus: '전문적 소통', duration: '2–3년',
        desc: '전문 분야 논의 가능, 원어민과 자연스러운 상호작용 및 논리적 추론.',
        can: ['원어민과 자연스러운 대화', '영어 프레젠테이션', '해외 취업 지원'],
      },
      {
        name: 'C1', label: 'C1 고급', focus: '유창한 구사', duration: '3–5년',
        desc: '복잡한 텍스트의 암시적 의미 파악, 학술·직업 상황에서 유연하고 정확한 표현.',
        can: ['외국 대학 강의 수강', 'IELTS 7.0+ / TOEFL 100+', '원서 속독'],
      },
      {
        name: 'C2', label: 'C2 마스터', focus: '원어민 수준', duration: '5년+',
        desc: '모든 상황에서 정교하고 완벽한 언어 구사. 뉘앙스·유머·문화적 표현 완전 이해.',
        can: ['영어권 원어민 수준', '전문 번역·통역', '학술 논문 집필'],
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
    desc: '단어 하나보다 문맥이 담긴 문장을 함께 저장하면 실제 사용 능력이 훨씬 빠르게 늘어납니다.',
  },
];

/* ── Subcomponent: single roadmap timeline ── */
function Roadmap({ curr, levelCounts = {}, levelSamples = {}, completedIds = new Set() }) {
  return (
    <section>
      <div className="roadmap-header">
        <span className="roadmap-header__icon">{curr.icon}</span>
        <div>
          <h2 className="roadmap-header__title">{curr.title}</h2>
          <span className="roadmap-header__subtitle">{curr.subtitle}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {curr.levels.map((level, idx) => {
          const w = W[idx];
          const isLast = idx === curr.levels.length - 1;
          return (
            <div key={level.name} className="roadmap-row">
              {/* ── dot + connector ── */}
              <div className="roadmap-track">
                <div
                  className="roadmap-dot"
                  style={{ background: w.bg, border: `2px solid ${w.dot}`, color: w.dot }}
                >
                  {level.name}
                </div>
                {!isLast && (
                  <div
                    className="roadmap-connector"
                    style={{ background: `linear-gradient(to bottom, ${W[idx].line}, ${W[idx + 1].line})` }}
                  />
                )}
              </div>

              {/* ── content ── */}
              <div className="roadmap-content" style={{ paddingBottom: isLast ? 0 : '28px' }}>
                <div className="roadmap-content__head">
                  <h3 className="roadmap-content__label">{level.label}</h3>
                  <span
                    className="roadmap-badge"
                    style={{ color: w.dot, background: w.bg, border: `1px solid ${w.line}` }}
                  >
                    {level.focus}
                  </span>
                  <span className="roadmap-badge--duration">⏱ {level.duration}</span>
                </div>

                <p className="roadmap-content__desc">{level.desc}</p>

                <div className="roadmap-cando">
                  {level.can.map(c => (
                    <span key={c} className="roadmap-cando__tag">✓ {c}</span>
                  ))}
                </div>

                {(levelSamples[level.label] || []).length > 0 && (
                  <ul className="roadmap-samples">
                    {levelSamples[level.label].map(s => {
                      const done = completedIds.has(s.id);
                      return (
                        <li key={s.id} className={`roadmap-sample ${done ? 'is-done' : ''}`}>
                          <Link href={`/viewer/${s.id}`} className="roadmap-sample__link">
                            <span className="roadmap-sample__status">{done ? '✓' : '🆕'}</span>
                            <span className="roadmap-sample__title">{s.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <Link
                  href={`/materials?lang=${curr.lang}&level=${encodeURIComponent(level.label)}`}
                  className="roadmap-link"
                  style={{ color: w.dot }}
                >
                  {level.label} 자료 전체 보기
                  {levelCounts[level.label] > 0 && (
                    <span style={{ marginLeft: 6, fontSize: '0.78rem', opacity: 0.75 }}>
                      ({levelCounts[level.label]}편)
                    </span>
                  )} →
                </Link>
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
  const { data: levelData = { counts: {}, samples: {} } } = useQuery({
    queryKey: ['guide-level-data'],
    queryFn: fetchLevelData,
    staleTime: 1000 * 60 * 10,
  });
  const { data: completedIds = new Set() } = useQuery({
    queryKey: ['guide-completed-ids'],
    queryFn: fetchCompletedIds,
    staleTime: 1000 * 60 * 5,
  });
  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>

      {/* ── Hero ── */}
      <div className="guide-hero">
        <div className="guide-hero__icon">🌏</div>
        <h1 className="guide-hero__title">
          외국어를 배운다는 것은<br />
          <span className="guide-hero__accent">새로운 세계를 여는 것</span>입니다
        </h1>
        <p className="guide-hero__sub">
          어느 레벨에 있든 괜찮습니다.
          지금 이 순간부터의 꾸준함이 전부입니다.
        </p>
      </div>

      {/* ── 앱 사용법 (현행화) ── */}
      <section style={{ margin: '40px 0 52px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
          🗺️ 3단계 사용법
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            {
              num: '1', icon: '📰',
              title: '자료 가져오기',
              desc: '텍스트 붙여넣기 또는 PDF 업로드. AI가 형태소 단위로 자동 분석.',
              sub: '스캔본 PDF도 OCR로 자동 처리 · 페이지 범위 선택',
              href: '/materials/add', cta: '자료 추가',
            },
            {
              num: '2', icon: '⭐',
              title: '읽으며 단어 저장',
              desc: '모르는 단어 클릭 → 뜻·발음 확인 → 단어장에 추가. 문장과 함께 저장됨.',
              sub: '💡 문맥 해설 버튼으로 이 단어가 왜 이 뜻인지 심화',
              href: '/materials', cta: '자료실 가기',
            },
            {
              num: '3', icon: '🧠',
              title: '읽기 = 복습',
              desc: '단어 저장 후 다시 자료를 읽으면, 복습 시점 된 단어가 노란색으로 표시됨. 클릭해서 바로 평가.',
              sub: 'FSRS 알고리즘이 최적 복습 간격 자동 계산',
              href: '/vocab', cta: '단어장 보기',
            },
          ].map(step => (
            <div key={step.num} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--primary-glow)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1.05rem',
                }}>
                  {step.num}
                </div>
                <div style={{ fontSize: '1.5rem' }}>{step.icon}</div>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>{step.title}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
                {step.desc}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                💡 {step.sub}
              </p>
              <Link href={step.href} className="btn btn--ghost btn--sm" style={{ padding: '6px 14px' }}>
                {step.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── 주요 기능 간략 소개 ── */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
          ✨ 이 앱이 특별한 이유
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {[
            { icon: '🤖', title: 'AI 형태소 해부', desc: '일본어는 오프라인 분석(kuromoji) + AI 의미. 빠르고 저렴.' },
            { icon: '📖', title: '읽기 기반 복습', desc: '별도 카드 복습 없이, 자료 읽다가 노란 단어 클릭하면 끝.' },
            { icon: '💡', title: '문맥별 해설 온디맨드', desc: '다의어도 지금 이 문장에서의 뜻을 AI가 설명해줌.' },
            { icon: '📚', title: 'PDF 책 한 권을 나눠 읽기', desc: '수백 페이지 PDF도 3~5장씩 분석, 캐시로 빠른 재분석.' },
            { icon: '✍️', title: '쓰기 연습', desc: '학습한 단어로 문장 만들기 → AI 교정 피드백.' },
            { icon: '🔧', title: 'AI 분석 수정 가능', desc: '틀린 뜻·후리가나 발견 시 ✏️로 직접 고치기.' },
          ].map(f => (
            <div key={f.title} style={{
              padding: 14,
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '1.1rem' }}>{f.icon}</span>
                <strong style={{ fontSize: '0.92rem' }}>{f.title}</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ margin: '52px 0 36px', borderTop: '1px solid var(--border)' }} />

      {/* ── Roadmaps ── */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
        📊 언어 레벨 로드맵
      </h2>
      <div className="guide-roadmap-grid">
        {CURRICULUMS.map(curr => (
          <Roadmap
            key={curr.lang}
            curr={curr}
            levelCounts={levelData.counts}
            levelSamples={levelData.samples}
            completedIds={completedIds}
          />
        ))}
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
        <div className="guide-tips-grid">
          {TIPS.map(tip => (
            <div key={tip.title} className="guide-tip">
              <div className="guide-tip__icon">{tip.icon}</div>
              <h4 className="guide-tip__title">{tip.title}</h4>
              <p className="guide-tip__desc">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="guide-cta">
        <div>
          <h3 className="guide-cta__title">지금 시작해도 결코 늦지 않았습니다</h3>
          <p className="guide-cta__desc">관심 있는 자료를 업로드하면 AI가 즉시 분석해드립니다.</p>
        </div>
        <Link href="/materials/add" className="btn btn--md guide-cta__btn">
          첫 자료 업로드하기 →
        </Link>
      </div>

    </div>
  );
}
