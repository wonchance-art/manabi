import Spinner from '../components/Spinner';
import Button from '../components/Button';

export default function ViewerQuizModal({
  quizState, handleQuizAnswer, advanceQuiz, finishQuiz,
  completionModal, setCompletionModal, material, nextMaterial,
}) {
  return (
    <>
      {/* 이해도 퀴즈 모달 */}
      {quizState && (
        <div className="modal-overlay completion-overlay">
          <div className="modal completion-modal">
            {quizState.status === 'loading' && (
              <>
                <div className="completion-modal__fireworks">📝</div>
                <h2 className="completion-modal__title">이해도 확인 중...</h2>
                <Spinner message="AI가 퀴즈를 만들고 있어요" />
              </>
            )}

            {quizState.status === 'active' && (() => {
              const q = quizState.questions[quizState.currentQ];
              return (
                <>
                  <div className="modal__header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
                    <h2 className="modal__title">📝 이해도 퀴즈</h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {quizState.currentQ + 1} / {quizState.questions.length}
                    </span>
                  </div>
                  <p style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.6, marginBottom: '20px', color: 'var(--text-primary)' }}>
                    {q.question}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {q.options.map((opt, i) => {
                      const isSelected = quizState.selected === i;
                      const isCorrect = q.answer === i;
                      const revealed = quizState.selected !== null;
                      let bg = 'var(--bg-secondary)';
                      let border = 'var(--border)';
                      if (revealed) {
                        if (isCorrect) { bg = 'rgba(74,138,92,0.2)'; border = 'var(--accent)'; }
                        else if (isSelected) { bg = 'rgba(200,64,64,0.15)'; border = 'rgba(200,64,64,0.5)'; }
                      }
                      return (
                        <button key={i}
                          disabled={quizState.selected !== null}
                          onClick={() => handleQuizAnswer(i)}
                          style={{
                            padding: '12px 16px', background: bg,
                            border: `1px solid ${border}`, borderRadius: 'var(--radius-md)',
                            textAlign: 'left', cursor: revealed ? 'default' : 'pointer',
                            fontSize: '0.92rem', color: 'var(--text-primary)',
                            transition: 'background 0.2s, border-color 0.2s',
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizState.selected !== null && (
                    <Button onClick={advanceQuiz} style={{ width: '100%' }}>
                      다음 문제 →
                    </Button>
                  )}
                </>
              );
            })()}

            {quizState.status === 'done' && (
              <>
                <div className="completion-modal__fireworks">
                  {quizState.score === quizState.total ? '🏆' : quizState.score >= quizState.total / 2 ? '👍' : '📚'}
                </div>
                <h2 className="completion-modal__title">퀴즈 완료!</h2>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', margin: '12px 0' }}>
                  {quizState.score} / {quizState.total} 정답
                </p>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
                  {quizState.score === quizState.total
                    ? '완벽해요! 내용을 완전히 이해했네요.'
                    : quizState.score >= quizState.total / 2
                      ? '잘 읽었어요. 틀린 부분을 다시 확인해보세요.'
                      : '단어를 복습하고 다시 읽어보세요.'}
                </p>
                <Button onClick={finishQuiz} style={{ width: '100%' }}>
                  결과 확인하기 →
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 읽기 완료 요약 모달 */}
      {completionModal && (
        <div className="modal-overlay completion-overlay">
          <div className="modal completion-modal">
            <div className="completion-modal__fireworks">🎉</div>
            <h2 className="completion-modal__title">읽기 완료!</h2>
            <p className="completion-modal__subtitle">{material?.title}</p>

            <div className="completion-stats">
              <div className="completion-stat">
                <span className="completion-stat__value">{completionModal.wordsSaved}</span>
                <span className="completion-stat__label">저장한 단어</span>
              </div>
              <div className="completion-stat completion-stat--divider" />
              <div className="completion-stat">
                <span className="completion-stat__value">🔥 {completionModal.streak}</span>
                <span className="completion-stat__label">일 연속</span>
              </div>
              <div className="completion-stat completion-stat--divider" />
              {completionModal.quizTotal != null ? (
                <div className="completion-stat">
                  <span className="completion-stat__value" style={{ color: completionModal.quizScore === completionModal.quizTotal ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {completionModal.quizScore}/{completionModal.quizTotal}
                  </span>
                  <span className="completion-stat__label">퀴즈 정답</span>
                </div>
              ) : (
                <div className="completion-stat">
                  <span className="completion-stat__value">{completionModal.dueCount}</span>
                  <span className="completion-stat__label">복습 대기 중</span>
                </div>
              )}
            </div>

            <div className="completion-modal__actions">
              {completionModal.dueCount > 0 && (
                <a href="/vocab" className="btn btn--primary btn--md">
                  🧠 지금 복습하기 ({completionModal.dueCount}개)
                </a>
              )}

              {nextMaterial && (
                <a href={`/viewer/${nextMaterial.id}`} className="completion-next-card">
                  <span className="completion-next-card__badge">다음 추천</span>
                  <span className="completion-next-card__flag">
                    {nextMaterial.processed_json?.metadata?.language === 'English' ? '🇬🇧' : '🇯🇵'}
                  </span>
                  <span className="completion-next-card__title">{nextMaterial.title}</span>
                  <span className="completion-next-card__arrow">→</span>
                </a>
              )}

              {!nextMaterial && completionModal.dueCount === 0 && (
                <a href="/materials" className="btn btn--primary btn--md">
                  📰 다른 자료 보기
                </a>
              )}

              <button onClick={() => setCompletionModal(null)} className="btn btn--ghost btn--md">
                계속 읽기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
