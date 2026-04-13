'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';

const DEMO_TOKENS = [
  { text: '日本語', furigana: 'にほんご', meaning: '일본어', pos: '명사' },
  { text: 'を',    furigana: null,        meaning: '~을/를', pos: '조사' },
  { text: '解剖',  furigana: 'かいぼう', meaning: '해부',    pos: '명사' },
  { text: 'する',  furigana: null,        meaning: '하다',   pos: '동사' },
  { text: '。',    furigana: null,        meaning: '마침표', pos: '기호' },
];

const PERSONAS = [
  { icon: '📺', text: '일드·애니·유튜브를 자막 없이 이해하고 싶은 분' },
  { icon: '📰', text: '뉴스·소설·원서를 읽으며 어휘력을 키우고 싶은 분' },
  { icon: '🎯', text: 'JLPT·토익을 앞두고 효율적으로 단어를 암기해야 하는 분' },
  { icon: '🔁', text: '열심히 외워도 금방 잊어버리는 패턴에서 벗어나고 싶은 분' },
];

const FEATURES = [
  { icon: '⚡', title: '실시간 AI 병렬 분석', desc: 'Gemini AI가 여러 문단을 동시에 처리합니다. 긴 텍스트도 수십 초 안에 완료.' },
  { icon: '🇯🇵', title: '후리가나 자동 생성', desc: '한자가 포함된 모든 단어에 후리가나를 자동으로 달아드립니다. N5~N1 전 범위 지원.' },
  { icon: '🇬🇧', title: '영어 IPA 발음 기호', desc: '영어 단어에 국제음성기호(IPA)를 자동 표시. 발음까지 함께 학습하세요.' },
  { icon: '📊', title: 'FSRS v4 알고리즘', desc: '망각 곡선 기반 최적 시점 복습 알림. 단순 반복보다 40% 더 기억에 오래 남습니다.' },
  { icon: '🌐', title: '공개 자료 공유', desc: '분석한 자료를 커뮤니티와 공유하거나 다른 학습자의 자료로 함께 공부하세요.' },
  { icon: '🔒', title: '클라우드 학습 데이터', desc: '단어장·복습 기록·학습 통계가 안전하게 저장됩니다. 어디서든 이어서 학습.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const handleCTA = () => router.push(user ? '/materials' : '/auth');

  // 데모 인터랙션: 첫 방문자가 토큰 클릭해서 AI 분석을 체감
  const [demoSelectedIdx, setDemoSelectedIdx] = useState(0);
  const [demoSavedIds, setDemoSavedIds] = useState(new Set());
  const demoSelected = DEMO_TOKENS[demoSelectedIdx];

  const handleDemoSave = () => {
    setDemoSavedIds(prev => new Set(prev).add(demoSelectedIdx));
    setTimeout(() => handleCTA(), 600);
  };

  return (
    <div className="landing">

      {/* ── NAV ── */}
      <header className="landing-nav">
        <div className="landing-nav__logo">
          <span>🧬</span>
          <span>Anatomy Studio</span>
        </div>
        <div className="landing-nav__actions">
          <Link href="/guide"     className="landing-nav__link landing-nav__link--desktop">사용 가이드</Link>
          <Link href="/materials" className="landing-nav__link landing-nav__link--desktop">자료실</Link>
          {user
            ? <Link href="/materials" className="btn btn--primary btn--sm">대시보드 →</Link>
            : <Link href="/auth"      className="btn btn--primary btn--sm">무료 시작</Link>
          }
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="landing-hero">
        <div className="landing-hero__badge anim-fade-up" style={{ animationDelay: '0.05s' }}>
          ✨ AI 기반 언어 해부 학습
        </div>
        <h1 className="landing-hero__title anim-fade-up" style={{ animationDelay: '0.15s' }}>
          텍스트를 읽는 게 아니라<br />
          <span className="landing-hero__title--accent">해부합니다</span>
        </h1>
        <p className="landing-hero__sub anim-fade-up" style={{ animationDelay: '0.28s' }}>
          일본어·영어 원문을 붙여넣으면 AI가 형태소 단위로 분해하고<br className="landing-hero__sub-br" />
          후리가나·품사·뜻을 즉시 분석합니다. FSRS 알고리즘으로<br className="landing-hero__sub-br" />
          단어를 과학적으로 기억하세요.
        </p>
        <div className="landing-hero__cta anim-fade-up" style={{ animationDelay: '0.42s' }}>
          <button onClick={handleCTA} className="btn btn--primary btn--lg landing-hero__main-btn">
            무료로 시작하기 →
          </button>
          <a href="#how" className="btn btn--ghost btn--lg">작동 원리 보기</a>
        </div>

        {/* Demo Viewer */}
        <div className="demo-card anim-fade-up" style={{ animationDelay: '0.6s' }}>
          <div className="demo-card__bar">
            <span className="demo-dot demo-dot--red" />
            <span className="demo-dot demo-dot--yellow" />
            <span className="demo-dot demo-dot--green" />
            <span className="demo-card__label">뷰어 미리보기 — 단어를 직접 클릭해보세요 👇</span>
          </div>
          <div className="demo-viewer">
            {DEMO_TOKENS.map((t, i) => {
              const active = demoSelectedIdx === i;
              const saved = demoSavedIds.has(i);
              return (
                <button
                  key={i}
                  className="demo-token demo-token--interactive"
                  style={{
                    outline: active ? '2px solid var(--primary)' : 'none',
                    background: saved ? 'var(--primary-glow)' : active ? 'var(--bg-elevated)' : undefined,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title={`${t.pos} · ${t.meaning}`}
                  onClick={() => setDemoSelectedIdx(i)}
                >
                  {t.furigana && <span className="demo-furigana">{t.furigana}</span>}
                  <span className="demo-surface">{t.text}{saved && ' ⭐'}</span>
                </button>
              );
            })}
          </div>
          <div className="demo-sheet" style={{ transition: 'all 0.3s ease' }}>
            <div className="demo-sheet__row">
              <span className="demo-sheet__pos">{demoSelected.pos}</span>
              <span className="demo-sheet__word">{demoSelected.text}</span>
              {demoSelected.furigana && (
                <span className="demo-sheet__reading">{demoSelected.furigana}</span>
              )}
            </div>
            <p className="demo-sheet__meaning">{demoSelected.meaning}</p>
            <button
              className="demo-sheet__btn"
              onClick={handleDemoSave}
              disabled={demoSavedIds.has(demoSelectedIdx)}
            >
              {demoSavedIds.has(demoSelectedIdx) ? '✓ 추가됨' : '⭐ 단어장에 추가'}
            </button>
          </div>
        </div>
      </section>

      {/* ── PERSONA ── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">이런 분께 추천해요</p>
          <h2 className="landing-section__title">혹시 이런 경험 있으신가요?</h2>
          <div className="persona-grid">
            {PERSONAS.map((p, i) => (
              <div key={i} className="persona-item">
                <span className="persona-item__icon">{p.icon}</span>
                <span className="persona-item__text">{p.text}</span>
              </div>
            ))}
          </div>
          <div className="persona-cta">
            <p className="persona-cta__text">Anatomy Studio가 딱 맞는 솔루션입니다.</p>
            <button onClick={handleCTA} className="btn btn--primary btn--md">
              지금 무료로 체험하기
            </button>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="landing-section">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">사용법</p>
          <h2 className="landing-section__title">3단계로 끝나는 학습 루틴</h2>
          <div className="steps">
            <div className="step">
              <div className="step__num">01</div>
              <div className="step__icon">📋</div>
              <h3 className="step__title">텍스트 붙여넣기</h3>
              <p className="step__desc">뉴스 기사, 소설, 자막 등 원하는 텍스트를 붙여넣으면 AI가 즉시 분석합니다.</p>
            </div>
            <div className="step__arrow">→</div>
            <div className="step">
              <div className="step__num">02</div>
              <div className="step__icon">🔬</div>
              <h3 className="step__title">AI 해부 &amp; 단어 수집</h3>
              <p className="step__desc">각 단어를 클릭하면 후리가나·품사·뜻이 나옵니다. 모르는 단어는 바로 단어장에 추가.</p>
            </div>
            <div className="step__arrow">→</div>
            <div className="step">
              <div className="step__num">03</div>
              <div className="step__icon">🧠</div>
              <h3 className="step__title">FSRS 과학적 복습</h3>
              <p className="step__desc">최신 간격 반복 알고리즘이 기억이 흐려질 타이밍에 딱 맞춰 복습을 제안합니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="landing-section landing-section--alt">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">기능 소개</p>
          <h2 className="landing-section__title">왜 Anatomy Studio인가요?</h2>
          <div className="features">
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-item">
                <div className="feature-item__icon">{f.icon}</div>
                <h3 className="feature-item__title">{f.title}</h3>
                <p className="feature-item__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="landing-section">
        <div className="landing-section__inner landing-stats">
          <div className="stat-pill">
            <span className="stat-pill__num">FSRS v4</span>
            <span className="stat-pill__label">최신 간격 반복 알고리즘</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill__num">2개 언어</span>
            <span className="stat-pill__label">일본어 · 영어</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill__num">완전 무료</span>
            <span className="stat-pill__label">신용카드 불필요</span>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="landing-section landing-cta-section">
        <div className="landing-section__inner landing-section__inner--center">
          <h2 className="landing-cta__title">지금 바로 첫 텍스트를 해부해보세요</h2>
          <p className="landing-cta__sub">가입 후 30초면 AI 분석을 시작할 수 있습니다. 신용카드 불필요.</p>
          <button onClick={handleCTA} className="btn btn--primary btn--lg">
            무료로 시작하기 →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <div className="landing-footer__left">
          <span className="landing-footer__brand">🧬 Anatomy Studio</span>
          <span className="landing-footer__copy">AI 기반 언어 해부 학습 플랫폼 · © 2025</span>
        </div>
        <div className="landing-footer__links">
          <Link href="/guide"    className="landing-footer__link">사용 가이드</Link>
          <Link href="/forum"    className="landing-footer__link">커뮤니티</Link>
          <Link href="/materials" className="landing-footer__link">자료실</Link>
        </div>
      </footer>

    </div>
  );
}
