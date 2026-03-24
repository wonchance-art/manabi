export default function VocabPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">⭐ 내 단어장</h1>
        <p className="page-header__subtitle">독서 중 수집한 어휘를 Anki 방식으로 복습하세요</p>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <span className="feature-card__icon">🗂️</span>
          <h3 className="feature-card__title">나의 어휘 카드</h3>
          <p className="feature-card__desc">
            Viewer에서 클릭 한 번으로 저장한 단어들이 여기에 쌓입니다.
          </p>
          <br />
          <span className="badge badge--coming-soon">🚧 Sprint 4</span>
        </div>

        <div className="feature-card">
          <span className="feature-card__icon">🧠</span>
          <h3 className="feature-card__title">플래시카드 퀴즈</h3>
          <p className="feature-card__desc">
            Anki의 망각 곡선(SM-2) 알고리즘으로 최적의 타이밍에 복습합니다.
          </p>
          <br />
          <span className="badge badge--coming-soon">🚧 Sprint 4</span>
        </div>

        <div className="feature-card">
          <span className="feature-card__icon">📊</span>
          <h3 className="feature-card__title">학습 통계</h3>
          <p className="feature-card__desc">
            나의 일일 학습량, 정답률, 연속 출석(Streak) 현황을 한눈에 확인합니다.
          </p>
          <br />
          <span className="badge badge--coming-soon">🚧 Sprint 5</span>
        </div>
      </div>
    </div>
  );
}
