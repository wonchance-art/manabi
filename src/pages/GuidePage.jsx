export default function GuidePage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">📚 가이드 & 커리큘럼</h1>
        <p className="page-header__subtitle">레벨별 체계적인 문법과 표현을 학습하세요</p>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <span className="feature-card__icon">🇯🇵</span>
          <h3 className="feature-card__title">일본어 (JLPT)</h3>
          <p className="feature-card__desc">
            N5부터 N1까지 단계별 문법 가이드와 필수 표현을 제공합니다.
          </p>
          <br />
          <span className="badge badge--coming-soon">🚧 준비 중</span>
        </div>

        <div className="feature-card">
          <span className="feature-card__icon">🇬🇧</span>
          <h3 className="feature-card__title">영어 (CEFR)</h3>
          <p className="feature-card__desc">
            A1부터 C2까지 국제 표준 기반의 문법 커리큘럼을 열람할 수 있습니다.
          </p>
          <br />
          <span className="badge badge--coming-soon">🚧 준비 중</span>
        </div>

        <div className="feature-card">
          <span className="feature-card__icon">🎓</span>
          <h3 className="feature-card__title">운영자 티칭 가이드</h3>
          <p className="feature-card__desc">
            모임 호스트를 위한 AI 기반 수업 가이드라인과 교안을 자동 생성합니다.
          </p>
          <br />
          <span className="badge badge--coming-soon">🚧 준비 중</span>
        </div>
      </div>
    </div>
  );
}
