import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const DEMO_TOKENS = [
  { text: '日本語', furigana: 'にほんご', meaning: '일본어', pos: '명사' },
  { text: 'を', furigana: null,          meaning: '~을/를',  pos: '조사' },
  { text: '解剖',  furigana: 'かいぼう', meaning: '해부',     pos: '명사' },
  { text: 'する',  furigana: null,       meaning: '하다',     pos: '동사' },
  { text: '。',    furigana: null,       meaning: '마침표',   pos: '기호' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCTA = () => navigate(user ? '/materials' : '/auth');

  return (
    <div className="landing">
      {/* ── NAV ── */}
      <header className="landing-nav">
        <div className="landing-nav__logo">
          <span>🧬</span>
          <span>Anatomy Studio</span>
        </div>
        <div className="landing-nav__actions">
          <Link to="/guide" className="landing-nav__link">가이드</Link>
          <Link to="/materials" className="landing-nav__link">자료실</Link>
          {user
            ? <Link to="/materials" className="btn btn--primary btn--sm">대시보드</Link>
            : <Link to="/auth" className="btn btn--primary btn--sm">무료 시작</Link>
          }
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="landing-hero">
        <div className="landing-hero__badge">✨ AI 기반 언어 해부 학습</div>
        <h1 className="landing-hero__title">
          텍스트를 읽는 게 아니라<br />
          <span className="landing-hero__title--accent">해부합니다</span>
        </h1>
        <p className="landing-hero__sub">
          일본어·영어 원문을 붙여넣으면 AI가 형태소 단위로 분해하고,<br />
          후리가나·뜻·품사까지 즉시 분석해드립니다.<br />
          FSRS 알고리즘으로 수집한 어휘를 과학적으로 복습하세요.
        </p>
        <div className="landing-hero__cta">
          <button onClick={handleCTA} className="btn btn--primary btn--lg landing-hero__main-btn">
            무료로 시작하기 →
          </button>
          <a href="#how" className="btn btn--ghost btn--lg">작동 원리 보기</a>
        </div>

        {/* Demo Viewer */}
        <div className="demo-card">
          <div className="demo-card__bar">
            <span className="demo-dot demo-dot--red" />
            <span className="demo-dot demo-dot--yellow" />
            <span className="demo-dot demo-dot--green" />
            <span className="demo-card__label">뷰어 미리보기</span>
          </div>
          <div className="demo-viewer">
            {DEMO_TOKENS.map((t, i) => (
              <div key={i} className="demo-token">
                {t.furigana && <span className="demo-furigana">{t.furigana}</span>}
                <span className="demo-surface">{t.text}</span>
              </div>
            ))}
          </div>
          <div className="demo-sheet">
            <div className="demo-sheet__row">
              <span className="demo-sheet__pos">명사</span>
              <span className="demo-sheet__word">日本語</span>
              <span className="demo-sheet__reading">にほんご</span>
            </div>
            <p className="demo-sheet__meaning">일본어 · Japanese language</p>
            <div className="demo-sheet__btn">⭐ 단어장에 추가</div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="landing-section landing-section--alt">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">How it works</p>
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
              <h3 className="step__title">AI 해부 & 단어 수집</h3>
              <p className="step__desc">각 단어를 클릭하면 후리가나·품사·뜻이 나옵니다. 모르는 단어는 바로 단어장에 추가.</p>
            </div>
            <div className="step__arrow">→</div>
            <div className="step">
              <div className="step__num">03</div>
              <div className="step__icon">🧠</div>
              <h3 className="step__title">FSRS 과학적 복습</h3>
              <p className="step__desc">최신 간격 반복 알고리즘(FSRS v4)이 기억이 흐려질 때 딱 맞춰 복습을 제안합니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="landing-section">
        <div className="landing-section__inner">
          <p className="landing-section__eyebrow">Features</p>
          <h2 className="landing-section__title">왜 Anatomy Studio인가요?</h2>
          <div className="features">
            <div className="feature-item">
              <div className="feature-item__icon">⚡</div>
              <h3 className="feature-item__title">실시간 병렬 AI 분석</h3>
              <p className="feature-item__desc">Gemini API를 활용해 여러 문단을 동시에 분석합니다. 긴 텍스트도 빠르게 처리.</p>
            </div>
            <div className="feature-item">
              <div className="feature-item__icon">🇯🇵</div>
              <h3 className="feature-item__title">일본어 후리가나 자동 생성</h3>
              <p className="feature-item__desc">한자가 포함된 단어에 자동으로 후리가나를 달아줍니다. N5부터 N1까지 지원.</p>
            </div>
            <div className="feature-item">
              <div className="feature-item__icon">🇬🇧</div>
              <h3 className="feature-item__title">영어 IPA 발음 기호</h3>
              <p className="feature-item__desc">영어 단어에는 국제음성기호(IPA)가 자동으로 표시되어 발음까지 학습합니다.</p>
            </div>
            <div className="feature-item">
              <div className="feature-item__icon">📊</div>
              <h3 className="feature-item__title">FSRS v4 알고리즘</h3>
              <p className="feature-item__desc">단순 반복이 아닌 망각 곡선 기반 최적 복습 시점 계산. SM-2보다 40% 더 효율적.</p>
            </div>
            <div className="feature-item">
              <div className="feature-item__icon">🌐</div>
              <h3 className="feature-item__title">공개 자료 공유</h3>
              <p className="feature-item__desc">분석한 자료를 커뮤니티와 공유하거나 다른 학습자의 자료로 함께 공부하세요.</p>
            </div>
            <div className="feature-item">
              <div className="feature-item__icon">🔒</div>
              <h3 className="feature-item__title">개인 학습 데이터 보관</h3>
              <p className="feature-item__desc">내 단어장, 복습 기록, 학습 통계가 안전하게 클라우드에 저장됩니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="landing-section landing-section--alt">
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
            <span className="stat-pill__num">무료</span>
            <span className="stat-pill__label">지금 바로 시작</span>
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
        <span>🧬 Anatomy Studio</span>
        <span>AI 기반 언어 해부 학습 플랫폼</span>
      </footer>
    </div>
  );
}
