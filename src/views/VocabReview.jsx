import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import { detectLang } from '../lib/constants';

function ScoreSection({ word, onScore }) {
  return (
    <div className="review-card__answer">
      <p className="review-card__meaning">{word.meaning}</p>
      {word.source_sentence && (
        <p className="review-card__source">
          {word.source_sentence.split(word.word_text).map((part, i, arr) =>
            i < arr.length - 1
              ? <span key={i}>{part}<mark className="review-card__highlight">{word.word_text}</mark></span>
              : <span key={i}>{part}</span>
          )}
        </p>
      )}
      <p className="review-score-guide">기억이 얼마나 잘 됐나요?</p>
      <div className="review-score-grid">
        <button onClick={() => onScore(1)} className="review-score-btn review-score-btn--again" title="전혀 기억 못 했음 — 오늘 다시 나옴 (+5 XP)">다시<span className="review-score-btn__sub">+5 XP</span></button>
        <button onClick={() => onScore(2)} className="review-score-btn review-score-btn--hard" title="겨우 떠올렸음 — 복습 간격 짧아짐 (+8 XP)">어려움<span className="review-score-btn__sub">+8 XP</span></button>
        <button onClick={() => onScore(3)} className="review-score-btn review-score-btn--good" title="정확히 기억했음 — 권장 선택 (+12 XP)">알맞음<span className="review-score-btn__sub">+12 XP ★</span></button>
        <button onClick={() => onScore(4)} className="review-score-btn review-score-btn--easy" title="너무 쉬웠음 — 복습 간격 많이 늘어남 (+8 XP)">쉬움<span className="review-score-btn__sub">+8 XP</span></button>
      </div>
    </div>
  );
}

export default function VocabReview({
  vocab, reviewWords, reviewIdx, currentWord,
  reviewFinished, reviewMode, setReviewMode,
  showAnswer, setShowAnswer, showHint, setShowHint,
  typingAnswer, setTypingAnswer, contextSelected, setContextSelected, contextOptions,
  handleScore, handleSkip, ttsSupported, speak,
  exampleSentences, exampleLoading, loadExamples,
  setTab, hardWords,
}) {
  // 리스닝 모드: 카드 전환 시 자동 TTS 재생
  const prevIdxRef = useRef(reviewIdx);
  useEffect(() => {
    if (reviewMode === 'listening' && ttsSupported && currentWord && prevIdxRef.current !== reviewIdx) {
      speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text));
    }
    prevIdxRef.current = reviewIdx;
  }, [reviewIdx, reviewMode, ttsSupported, currentWord, speak]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      {reviewFinished ? (
        <div className="review-done">
          <div className="review-done__header">
            <div className="review-done__emoji">🎉</div>
            <h2 className="review-done__title">오늘의 복습 완료!</h2>
            <p className="review-done__sub">FSRS 알고리즘이 당신의 기억을 강화했습니다.</p>
          </div>

          <div className="review-done__stats">
            <div className="review-done__stat">
              <span className="review-done__stat-value">{reviewWords.length}</span>
              <span className="review-done__stat-label">복습한 단어</span>
            </div>
            <div className="review-done__stat-divider" />
            <div className="review-done__stat">
              <span className="review-done__stat-value">{vocab.filter(v => v.interval >= 30).length}</span>
              <span className="review-done__stat-label">숙련 단어</span>
            </div>
            <div className="review-done__stat-divider" />
            <div className="review-done__stat">
              <span className="review-done__stat-value">{vocab.length}</span>
              <span className="review-done__stat-label">총 단어</span>
            </div>
          </div>

          {/* 향후 7일 복습 스케줄 미리보기 */}
          {(() => {
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i + 1); // 내일부터
              d.setHours(0, 0, 0, 0);
              const next = new Date(d);
              next.setDate(d.getDate() + 1);
              const count = vocab.filter(v => {
                const r = new Date(v.next_review_at);
                return r >= d && r < next;
              }).length;
              return { date: d, count };
            });
            const max = Math.max(...days.map(d => d.count), 1);
            const total = days.reduce((s, d) => s + d.count, 0);
            return (
              <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    📅 앞으로 7일 복습 일정
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>총 {total}개 예정</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 50 }}>
                  {days.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div
                        style={{
                          width: '100%',
                          height: d.count > 0 ? `${Math.max(8, (d.count / max) * 40)}px` : '2px',
                          background: d.count > 0 ? 'var(--primary-light)' : 'var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'height 0.4s',
                        }}
                        title={`${d.date.toLocaleDateString('ko-KR')}: ${d.count}개`}
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {['일','월','화','수','목','금','토'][d.date.getDay()]}
                      </span>
                      {d.count > 0 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)' }}>{d.count}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <p className="review-done__next-label">다음에 뭘 할까요?</p>

          <div className="review-done__actions">
            {hardWords > 0 && (
              <button
                className="review-done__card"
                onClick={() => setTab('stats')}
              >
                <span className="review-done__card-icon">🔥</span>
                <div className="review-done__card-text">
                  <strong>요주의 단어 확인</strong>
                  <span>{hardWords}개 단어가 어려워하고 있어요</span>
                </div>
              </button>
            )}
            <Link href="/materials" className="review-done__card">
              <span className="review-done__card-icon">📖</span>
              <div className="review-done__card-text">
                <strong>새 자료 읽기</strong>
                <span>읽으면서 새 단어를 수집해요</span>
              </div>
            </Link>
            <Link href="/forum" className="review-done__card">
              <span className="review-done__card-icon">💬</span>
              <div className="review-done__card-text">
                <strong>학습 인증 올리기</strong>
                <span>커뮤니티에 오늘의 학습을 공유해요</span>
              </div>
            </Link>
            <Link href="/leaderboard" className="review-done__card">
              <span className="review-done__card-icon">🏆</span>
              <div className="review-done__card-text">
                <strong>랭킹 확인</strong>
                <span>내 순위가 올라갔을지도?</span>
              </div>
            </Link>
          </div>

          <Button variant="ghost" onClick={() => setTab('list')} style={{ marginTop: 8 }}>
            단어장으로 돌아가기
          </Button>
        </div>
      ) : reviewWords.length > 0 ? (
        <>
          {/* 복습 모드 선택 */}
          <div className="chip-group" style={{ marginBottom: '16px', justifyContent: 'center' }}>
            {[
              { value: 'flash',     label: '🃏 플래시카드' },
              { value: 'typing',    label: '✏️ 타이핑' },
              { value: 'context',   label: '📝 문맥 퀴즈' },
              { value: 'listening', label: '🎧 리스닝' },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => {
                  setReviewMode(m.value);
                  setTypingAnswer('');
                  setContextSelected(null);
                  setShowAnswer(false);
                  setShowHint(false);
                }}
                className={`chip ${reviewMode === m.value ? 'chip--active' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="card review-card">
            <div className="review-card__progress">
              <span>남은 단어: {reviewWords.length - reviewIdx}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {reviewMode === 'flash' && !showAnswer && currentWord?.source_sentence && (
                  <button className="review-hint-btn" onClick={() => setShowHint(h => !h)}>
                    {showHint ? '힌트 숨기기' : '💡 힌트'}
                  </button>
                )}
                <button className="review-skip-btn" onClick={() => { setShowHint(false); handleSkip(); }} title="내일로 미루기">
                  스킵 →
                </button>
              </div>
            </div>

            <div className="review-card__body">
              {/* 문법 노트 배지 */}
              {currentWord?._isGrammar && (
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    background: 'var(--primary-glow)', color: 'var(--primary)',
                    fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.04em',
                  }}>📝 문법 노트</span>
                </div>
              )}

              {/* 단어 헤더 (문맥 퀴즈는 정답 공개 전까지 숨김) */}
              {currentWord && (reviewMode !== 'context' && reviewMode !== 'listening' || showAnswer) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <h2 className="review-card__word">{currentWord.word_text}</h2>
                  {ttsSupported && !currentWord._isGrammar && (
                    <button
                      onClick={() => speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text))}
                      title="발음 듣기"
                      style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-full)', padding: '4px 10px',
                        fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-secondary)',
                      }}
                    >
                      🔊
                    </button>
                  )}
                </div>
              )}

              {showAnswer && currentWord.furigana && (
                <p className="review-card__furigana">[{currentWord.furigana}]</p>
              )}

              {/* 플래시카드 모드 */}
              {reviewMode === 'flash' && (
                <>
                  {!showAnswer && showHint && currentWord.source_sentence && (
                    <p className="review-card__hint">
                      {currentWord.source_sentence.split(currentWord.word_text).map((part, i, arr) => (
                        i < arr.length - 1
                          ? <span key={i}>{part}<mark className="review-card__highlight review-card__highlight--hint">{currentWord.word_text}</mark></span>
                          : <span key={i}>{part}</span>
                      ))}
                    </p>
                  )}
                  {showAnswer ? (
                    <ScoreSection word={currentWord} onScore={handleScore} />
                  ) : (
                    <Button variant="secondary" size="lg" onClick={() => { setShowAnswer(true); setShowHint(false); }}
                      style={{ marginTop: '40px', borderRadius: 'var(--radius-full)' }}>
                      정답 확인하기
                    </Button>
                  )}
                </>
              )}

              {/* 타이핑 모드 */}
              {reviewMode === 'typing' && (
                <>
                  {!showAnswer ? (
                    <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <input
                        type="text"
                        value={typingAnswer}
                        onChange={e => setTypingAnswer(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && typingAnswer.trim() && setShowAnswer(true)}
                        placeholder="의미를 입력하세요..."
                        className="search-input"
                        autoFocus
                        style={{ fontSize: '1rem', textAlign: 'center' }}
                      />
                      <Button onClick={() => setShowAnswer(true)} disabled={!typingAnswer.trim()}>
                        확인하기 →
                      </Button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '16px' }}>
                      {typingAnswer && (
                        <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>내 답: </span>
                          <span>{typingAnswer}</span>
                        </div>
                      )}
                      <ScoreSection word={currentWord} onScore={handleScore} />
                    </div>
                  )}
                </>
              )}

              {/* 문맥 퀴즈 모드 */}
              {reviewMode === 'context' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    {currentWord.source_sentence ? (
                      <p className="review-card__hint" style={{ fontSize: '1rem', lineHeight: 1.8 }}>
                        {currentWord.source_sentence.split(currentWord.word_text).map((part, i, arr) =>
                          i < arr.length - 1
                            ? <span key={i}>{part}<mark style={{ background: 'var(--bg-elevated)', color: 'transparent', borderRadius: '4px', padding: '0 4px' }}>{'　'.repeat(Math.max(2, currentWord.word_text.length))}</mark></span>
                            : <span key={i}>{part}</span>
                        )}
                      </p>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', marginBottom: '8px' }}>
                        (예문 없음 — 의미를 선택하세요)
                      </p>
                    )}
                  </div>

                  {!showAnswer ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {contextOptions.map((opt, i) => (
                        <button
                          key={i}
                          disabled={contextSelected !== null}
                          onClick={() => {
                            setContextSelected(i);
                            const isCorrect = opt.id === currentWord.id;
                            if (isCorrect) {
                              setTimeout(() => handleScore(3), 700);
                            }
                          }}
                          style={{
                            padding: '12px 16px',
                            background: contextSelected === null
                              ? 'var(--bg-secondary)'
                              : opt.id === currentWord.id
                                ? 'rgba(74,138,92,0.25)'
                                : contextSelected === i
                                  ? 'rgba(200,64,64,0.2)'
                                  : 'var(--bg-secondary)',
                            border: `1px solid ${
                              contextSelected !== null && opt.id === currentWord.id
                                ? 'var(--accent)'
                                : 'var(--border)'
                            }`,
                            borderRadius: 'var(--radius-md)',
                            textAlign: 'left',
                            cursor: contextSelected !== null ? 'default' : 'pointer',
                            fontSize: '0.92rem',
                            color: 'var(--text-primary)',
                            transition: 'background 0.2s, border-color 0.2s',
                          }}
                        >
                          {opt.meaning}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <ScoreSection word={currentWord} onScore={handleScore} />
                  )}

                  {contextSelected !== null && contextOptions[contextSelected]?.id !== currentWord.id && !showAnswer && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      <Button onClick={() => handleScore(1)} variant="secondary" style={{ flex: 1 }}>
                        다시 (Again)
                      </Button>
                      <Button onClick={() => { setShowAnswer(true); }} variant="ghost" style={{ flex: 1 }}>
                        정답 보기
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* 리스닝 모드 */}
              {reviewMode === 'listening' && (
                <>
                  {ttsSupported ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
                      <button
                        onClick={() => speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text))}
                        className="review-listen-btn"
                        style={{
                          width: 80, height: 80, borderRadius: '50%',
                          background: 'var(--primary-glow)', border: '2px solid var(--primary)',
                          fontSize: '2rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'transform 0.15s',
                        }}
                        title="다시 듣기"
                      >
                        🔊
                      </button>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        소리를 듣고 알맞은 뜻을 고르세요
                      </p>

                      {!showAnswer ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          {contextOptions.map((opt, i) => (
                            <button
                              key={i}
                              disabled={contextSelected !== null}
                              onClick={() => {
                                setContextSelected(i);
                                const isCorrect = opt.id === currentWord.id;
                                if (isCorrect) {
                                  setTimeout(() => handleScore(3), 700);
                                }
                              }}
                              style={{
                                padding: '12px 16px',
                                background: contextSelected === null
                                  ? 'var(--bg-secondary)'
                                  : opt.id === currentWord.id
                                    ? 'rgba(74,138,92,0.25)'
                                    : contextSelected === i
                                      ? 'rgba(200,64,64,0.2)'
                                      : 'var(--bg-secondary)',
                                border: `1px solid ${
                                  contextSelected !== null && opt.id === currentWord.id
                                    ? 'var(--accent)'
                                    : 'var(--border)'
                                }`,
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'left',
                                cursor: contextSelected !== null ? 'default' : 'pointer',
                                fontSize: '0.92rem',
                                color: 'var(--text-primary)',
                                transition: 'background 0.2s, border-color 0.2s',
                              }}
                            >
                              {opt.meaning}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <ScoreSection word={currentWord} onScore={handleScore} />
                      )}

                      {contextSelected !== null && contextOptions[contextSelected]?.id !== currentWord.id && !showAnswer && (
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <Button onClick={() => handleScore(1)} variant="secondary" style={{ flex: 1 }}>
                            다시 (Again)
                          </Button>
                          <Button onClick={() => setShowAnswer(true)} variant="ghost" style={{ flex: 1 }}>
                            정답 보기
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '24px' }}>
                      이 브라우저에서는 TTS를 지원하지 않아요. 다른 모드를 선택해주세요.
                    </p>
                  )}
                </>
              )}

              {/* AI 예문 (정답 공개 후 공통) */}
              {(showAnswer || contextSelected !== null) && (
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  {exampleSentences ? (
                    <>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        ✨ AI 예문
                      </p>
                      {exampleSentences.map((ex, i) => (
                        <div key={i} style={{
                          marginBottom: '10px', padding: '10px 14px',
                          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                        }}>
                          <p style={{ fontSize: '0.95rem', marginBottom: '4px', lineHeight: 1.6 }}>{ex.sentence}</p>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{ex.translation}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <button
                      onClick={loadExamples}
                      disabled={exampleLoading}
                      style={{
                        width: '100%', padding: '8px',
                        background: 'none', border: '1px dashed var(--border)',
                        borderRadius: 'var(--radius-md)', cursor: exampleLoading ? 'default' : 'pointer',
                        color: 'var(--text-muted)', fontSize: '0.85rem',
                        opacity: exampleLoading ? 0.6 : 1,
                      }}
                    >
                      {exampleLoading ? '예문 생성 중...' : '✨ AI 예문 보기'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card review-card review-card--center">
          <div className="review-card__emoji">{vocab.length === 0 ? '⭐' : '✅'}</div>
          <h2 style={{ marginBottom: '10px' }}>
            {vocab.length === 0 ? '단어를 먼저 수집해볼까요?' : '지금은 복습할 단어가 없어요'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            {vocab.length === 0
              ? '자료를 읽으면서 모르는 단어를 탭하면 자동 저장돼요'
              : 'FSRS가 다음 복습 시점을 계산해 줄 거예요.'}
          </p>
          {vocab.length === 0 && (
            <Link href="/materials" className="btn btn--primary btn--md">📰 자료 읽으러 가기</Link>
          )}
        </div>
      )}
    </div>
  );
}
