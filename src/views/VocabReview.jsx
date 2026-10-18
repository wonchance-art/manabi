import { useEffect, useId, useRef } from 'react';
import { focusIfFree } from '../lib/focusAfterAction';
import Link from 'next/link';
import Button from '../components/Button';
import { detectLang, splitSentenceAroundWord } from '../lib/constants';
import VocabularyContexts from '../components/learning/VocabularyContexts';
import { ReviewCardMeta, ReviewHeadword, ReviewReadingRow, langTag, useGradeBarFocus, useRevealFocus } from '../components/vocab/ReviewCardParts';
import { gradeGuide, isCardRevealClick, revealTrigger } from '../lib/reviewCard';
import { wordStage } from '../lib/growthStats';
import { vocabularyReviewCalendar } from '../lib/vocabularyLearningRows';

/**
 * 채점 막대(REV-SCOPE-R1B-1 §5-3) — 하단 고정, 뒷면 전엔 잠금, 펼친 뒤 0.3초 입력 무시(armed). 버튼은 넷뿐이다.
 * 기준 문구는 발음 판정 대상에만 발음을 말한다(gradeGuide). 라벨 · 순서 · 접미사는 저장 4등급(vocabIO.SAVE_GRADES)과 같다.
 */
function ScoreSection({ word, onScore, armed = true, locked = false }) {
  const off = locked || !armed;
  const bar = useGradeBarFocus(locked, armed); // 뒷면이 열리면 막대(버튼 아님)로 초점 — FOCUS-AFTER-ACTION-001 C2
  return (
    <div ref={bar} tabIndex={-1} className={`review-grade-bar${locked ? ' is-locked' : ''}`} role="group" aria-label="기억 채점">
      {/* 안내 줄 자리는 앞면(잠김)에서도 비워 둔다 — 정답 확인 때 막대가 73→100px로 자라던 것(VOCAB-FLOW-001 C). 잠김엔 숨김 · 화면 읽기 제외. */}
      <p className={`review-score-guide review-grade-guide${locked ? ' review-grade-guide--reserve' : ''}`} aria-hidden={locked || undefined}>{gradeGuide(word)}<span className="review-keys-hint"> · 키 1~4 · 되돌리기 Ctrl/⌘+Z</span></p>
      {/* 숫자 배지 = 키 안내(W R2) — 라벨 텍스트는 버튼 첫 자식 그대로(saveGrade 계약이 이 소스에서 라벨을 뽑는다) */}
      <div className="review-score-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <button onClick={() => onScore(1)} className="review-score-btn review-score-btn--again" disabled={off} title="오늘 다시 나와요">다시<span className="save-grade__key" aria-hidden="true">1</span></button>
        <button onClick={() => onScore(2)} className="review-score-btn review-score-btn--hard" disabled={off} title="간격이 짧아져요">어려움<span className="save-grade__key" aria-hidden="true">2</span></button>
        <button onClick={() => onScore(3)} className="review-score-btn review-score-btn--good" disabled={off} title="정확히 기억했다면 이걸로">알맞음<span className="save-grade__key" aria-hidden="true">3</span></button>
        <button onClick={() => onScore(4)} className="review-score-btn review-score-btn--easy" disabled={off} title="간격이 많이 늘어나요">쉬움<span className="save-grade__key" aria-hidden="true">4</span></button>
      </div>
    </div>
  );
}

/** 집중 연습 두 단계(§5-3) — 일정 · 한도는 그대로, 연습 기록만. 키 1 · 2. */
function PracticeButtons({ onResult, armed = true }) {
  return (
    <div className="review-grade-bar review-grade-bar--practice" role="group" aria-label="집중 연습 결과">
      <div className="review-score-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <button type="button" onClick={() => onResult(1)} className="review-score-btn review-score-btn--again" disabled={!armed}>몰랐어요<span className="practice-key" aria-hidden="true">1</span></button>
        <button type="button" onClick={() => onResult(3)} className="review-score-btn review-score-btn--good" disabled={!armed}>알았어요<span className="practice-key" aria-hidden="true">2</span></button>
      </div>
    </div>
  );
}

/**
 * 복습 입장(admission) 준비 실패 문구 — 단어장 상단 알림과 복습 카드가 같이 쓴다(WALL-STATES-001 ⑤).
 * 채점 저장 실패 문구(「복습 저장 실패 … 이 단어는 다음에 다시 나와요」)는 저장할 채점이 있을 때만
 * 맞는 말이라, 저장 전 단계인 준비 실패에 쓰지 않는다.
 */
export const REVIEW_PREP_FAILED = '복습을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';

/**
 * 문맥 퀴즈 보기의 상태 클래스 (v2-K 잔여).
 *
 * 색이 삼항 **안**에 있어 한 줄 색 계약도 여러 줄 라쳇도 못 잡던 자리다 — 판정을 여기
 * 한 곳에 두고 값은 CSS 토큰이 진다.
 */
export function quizOptClass(selected, isAnswer, isThis) {
  const state = selected === null ? '' : isAnswer ? ' quiz-opt--right' : isThis ? ' quiz-opt--wrong' : '';
  return `quiz-opt${state}${selected === null ? '' : ' quiz-opt--done'}`;
}

/** 7일 복습 일정 — 끝 화면 공통. */
function UpcomingCalendar({ projections, learningAvailable, now }) {
  const at = Math.max(new Date(now).getTime(), ...projections.map(row => Date.parse(row.review.evaluatedAt)));
  const days = learningAvailable ? vocabularyReviewCalendar(projections, at, { startOffset: 1 }) : [];
  const max = Math.max(...days.map(d => d.count), 1);
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <div className="review-done__calendar">
      <div className="review-done__calendar-head">
        <span>앞으로 7일 복습 일정</span>
        <span>총 {learningAvailable ? total : '—'}개 예정</span>
      </div>
      <div className="review-done__bars">
        {days.map((d, i) => (
          <div key={i} className="review-done__bar-col">
            <div className={`review-done__bar${d.count > 0 ? ' has-count' : ''}`}
              style={{ height: d.count > 0 ? `${Math.max(8, (d.count / max) * 40)}px` : '2px', '--i': i }} title={`${d.key}: ${d.count}개`} />
            <span className="review-done__bar-day">{d.key.slice(5).replace('-', '/')}</span>
            {d.count > 0 && <span className="review-done__bar-count">{d.count}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 끝 화면(§5-5) — 「전체 복습 끝」이라고 하지 않는다(기존 계약). 학습 단계 카드가 남았으면 끝이 아니라 「잠시 뒤」.
 * finish = { scopeLabel, total, again, cutRemaining?, onContinueCut?, waiting?:{count, nextAt, ready}, onResumeWaiting?,
 *            returnLink?:{href,label}, outOfScope?:{count,label,onClick}, onTitleNotFocused?:() => void }
 */
/**
 * 끝 화면 제목으로 초점(VOCAB-FLOW-001 — /study 「세션 완료」 선례). 마지막 채점 단추가 사라지며 초점이 body로 떨어졌다(a3ba 탐침).
 * 떨어진 초점만 줍는다 — 범위 없이 focusIfFree(초점이 body일 때만, canTakeFocus(undefined) = focusIsLost). 화면 안 범위
 * (.page-container)를 주면 상단바(🔈 · ← 나가기)에 둔 초점까지 뺏었다(🔈에 두고 숫자키로 마지막 채점 — a3ba 리뷰 ②).
 * 제목은 읽는 자리라 고리를 그리지 않는다(tabIndex −1). 초점을 옮기지 못했으면(다른 곳에 초점이 살아 있음) onNotFocused로 알린다 —
 * 그때만 끝 공지를 읽힌다(초점이 간 제목과 같은 말을 두 번 읽지 않게).
 */
function useEndTitleFocus(onNotFocused) {
  const title = useRef(null);
  useEffect(() => { if (!focusIfFree(title.current)) onNotFocused?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 끝 화면이 열린 그 한 번
  return title;
}

function ReviewFinished({ finish = {}, bookReview, vocab, projections, learningAvailable, now, setTab }) {
  const title = useEndTitleFocus(finish.onTitleNotFocused);
  const { scopeLabel, total = 0, again = 0, cutRemaining = 0, onContinueCut, waiting, onResumeWaiting, returnLink, outOfScope } = finish;
  const returnTo = returnLink || (bookReview ? { href: bookReview.returnTo, label: '읽던 교재로 돌아가기' } : null);
  const mature = learningAvailable ? projections.filter(row => wordStage(row).key === 'mature').length : null;
  return (
    <div className="review-done">
      <div className="review-done__header">
        {scopeLabel && <p className="review-done__scope">{scopeLabel}</p>}
        <h2 ref={title} tabIndex={-1} className="review-done__title">{cutRemaining > 0 ? `${total}개 끝 · 오늘 몫 ${cutRemaining}개 남음` : '오늘 몫 끝'}</h2>
        <p className="review-done__summary">{[`${total}개`, again > 0 && `다시 ${again}`].filter(Boolean).join(' · ')}</p>
        {waiting?.count > 0 && <p className="review-done__waiting" role="status">「다시」 {waiting.count}개는 잠시 뒤 다시 나와요{waiting.nextAt && !waiting.ready ? <> · <time dateTime={waiting.nextAt}>{new Date(waiting.nextAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</time></> : null}</p>}
      </div>

      <div className="review-done__actions">
        {waiting?.count > 0 && <button type="button" className="btn btn--primary btn--md" disabled={!waiting.ready} onClick={onResumeWaiting}>잠시 뒤 이어 하기</button>}
        {cutRemaining > 0 && onContinueCut && <button type="button" className="btn btn--primary btn--md" onClick={onContinueCut}>이어서 {cutRemaining}개</button>}
        {returnTo && <Link href={returnTo.href} className="review-done__card"><div className="review-done__card-text"><strong>{returnTo.label}</strong><span>복습을 시작하기 전의 판본과 위치로 돌아가요.</span></div></Link>}
        {outOfScope?.count > 0 && <button type="button" className="btn btn--ghost btn--md" onClick={outOfScope.onClick}>범위 밖 {outOfScope.label} {outOfScope.count}개 이어서</button>}
        {!returnTo && !outOfScope?.count && !(waiting?.count > 0) && <>
          <Link href="/materials" className="review-done__card">
            <div className="review-done__card-text"><strong>새 자료 읽기</strong><span>읽으면서 새 단어를 수집해요</span></div>
          </Link>
          <Link href="/lessons" className="review-done__card">
            <div className="review-done__card-text"><strong>교재 둘러보기</strong><span>읽고 싶은 교재를 골라 주세요</span></div>
          </Link>
        </>}
      </div>

      <div className="review-done__stats">
        <div className="review-done__stat">
          <span className="review-done__stat-value">{mature ?? '—'}</span>
          <span className="review-done__stat-label">익숙 표현(21일 이상)</span>
        </div>
        <div className="review-done__stat-divider" />
        <div className="review-done__stat">
          <span className="review-done__stat-value">{vocab.length}</span>
          <span className="review-done__stat-label">이 범위 표현</span>
        </div>
      </div>
      <UpcomingCalendar projections={projections} learningAvailable={learningAvailable} now={now} />

      <Button variant="ghost" onClick={() => setTab('list')} style={{ marginTop: 8 }}>
        {bookReview ? '이 교재 표현 목록으로' : '목록으로'}
      </Button>
    </div>
  );
}

/** 집중 연습 끝 — 일정은 바뀌지 않았다는 것과 「몰랐어요」가 흐릿 범위로 이어진다는 것만 말한다. */
function PracticeFinished({ practice, setTab }) {
  const title = useEndTitleFocus();
  return (
    <div className="review-done review-done--practice">
      <div className="review-done__header">
        <p className="review-done__scope">집중 연습</p>
        <h2 ref={title} tabIndex={-1} className="review-done__title">집중 연습 {practice.total}개 끝</h2>
        <p className="review-done__summary">{[`${practice.total}개`, practice.unknown > 0 && `몰랐어요 ${practice.unknown}`].filter(Boolean).join(' · ')}</p>
        <p className="review-room-note">일정은 바뀌지 않았어요.{practice.unknown > 0 ? ' 「몰랐어요」 표현은 「흐릿 · 위험」 범위에 나와요.' : ''}</p>
      </div>
      <div className="review-done__actions">
        {practice.unknown > 0 && practice.onFragile && <button type="button" className="btn btn--primary btn--md" onClick={practice.onFragile}>흐릿 · 위험 보기</button>}
        <Button variant="ghost" onClick={() => setTab('list')}>목록으로</Button>
      </div>
    </div>
  );
}

export default function VocabReview({
  vocab, projections = [], learningAvailable = false, now = new Date(), reviewWords, reviewIdx, currentWord, admissionPending = false, admissionError = null, onAdmissionRetry, bookReview = null,
  reviewFinished, reviewMode, effectiveMode,
  showAnswer, setShowAnswer, showHint, setShowHint,
  typingAnswer, setTypingAnswer, contextSelected, contextOptions,
  handleScore, handleSkip, pickContextOption, ttsSupported, speak,
  exampleSentences, exampleLoading, loadExamples,
  setTab, armed = true, onReveal, onKnown, knownDisabled = false, metaLabel = '복습', finish = null, practice = null,
}) {
  const hintId = useId();
  // 실제 출제 유형 — 본 복습은 플래시(스스로 채점)뿐이다(REV-SCOPE-R1B-1). 타이핑 · 리스닝은 집중 연습의 갈래(practice).
  const mode = effectiveMode || reviewMode;

  // 리스닝 갈래: 카드 전환 시 자동 TTS 재생
  const prevIdxRef = useRef(reviewIdx);
  useEffect(() => {
    if (mode === 'listening' && ttsSupported && currentWord && prevIdxRef.current !== reviewIdx) {
      speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text));
    }
    prevIdxRef.current = reviewIdx;
  }, [reviewIdx, mode, ttsSupported, currentWord, speak]);

  const reveal = event => { setShowAnswer(true); setShowHint?.(false); onReveal?.(revealTrigger(event)); };
  // 새 카드가 열리면 「정답 확인하기」로 초점(STUDY-FOCUS-001) — 시작 · 채점 단추가 사라져 body로 떨어지던 자리.
  const revealRef = useRevealFocus(mode === 'flash' && !reviewFinished && !showAnswer && !!currentWord, currentWord?.id);
  const headwordId = useId(); // 「정답 확인하기」가 표제어를 함께 읽게(aria-describedby)
  const finishBar = practice
    ? (showAnswer && mode !== 'listening' ? <PracticeButtons onResult={handleScore} armed={armed} /> : null)
    : currentWord && mode === 'flash' && <ScoreSection word={currentWord} onScore={handleScore} armed={armed} locked={!showAnswer} />;

  return (
    <div className="review-room-session">
      {reviewFinished ? (
        practice ? <PracticeFinished practice={practice} setTab={setTab} />
          : <ReviewFinished finish={finish || { total: new Set(reviewWords.filter(Boolean).map(word => word.id)).size }} bookReview={bookReview} vocab={vocab}
            projections={projections} learningAvailable={learningAvailable} now={now} setTab={setTab} />
      ) : admissionPending || admissionError ? (
        <div className="card review-card review-card--center" role={admissionError ? 'alert' : 'status'} aria-busy={!admissionError || undefined}>
          <p>{admissionError ? REVIEW_PREP_FAILED : '복습 준비 중…'}</p>
          {admissionError && <Button variant="ghost" onClick={onAdmissionRetry}>다시 시도</Button>}
        </div>
      ) : reviewWords.length > 0 && currentWord ? (
        <>
          {practice && <p className="review-practice-banner" role="note">집중 연습 · 일정은 바뀌지 않아요</p>}
          {/* key = 카드마다 새로 그려 넘김 효과(review-card--turn)가 한 장마다 한 번 돈다. */}
          <div key={currentWord.id} className="card review-card review-card--turn" style={{ padding: 0 }}>
            <div className="review-card__progress review-card__progress--tools">
              <div className="review-card__tools">
                {mode === 'flash' && !showAnswer && currentWord?.source_sentence && (
                  <button type="button" className="review-hint-btn" onClick={() => setShowHint(h => !h)} aria-expanded={showHint} aria-controls={hintId}>
                    {showHint ? '힌트 숨기기' : '힌트'}
                  </button>
                )}
                {onKnown && (
                  <button type="button" className="review-known-btn" disabled={knownDisabled} onClick={() => onKnown(currentWord)}>
                    아는 단어
                  </button>
                )}
                {!practice && handleSkip && (
                  <button type="button" className="review-skip-btn" onClick={() => { setShowHint(false); handleSkip(); }} title="내일로 미루기">
                    스킵 →
                  </button>
                )}
              </div>
            </div>

            <div className={`review-card__body${mode === 'flash' && !showAnswer ? ' review-card__body--front' : ''}`}
              onClick={event => { if (mode === 'flash' && !showAnswer && isCardRevealClick(event)) reveal(event); }}>
              <ReviewCardMeta label={metaLabel} word={currentWord} />
              {mode !== 'flash' && <p className="review-room-prompt">{showAnswer ? '뜻을 확인했어요.' : mode === 'typing' ? '이 표현의 뜻을 써 보세요.' : mode === 'context' ? '문장 속 표현의 뜻을 골라 보세요.' : '듣고, 뜻을 골라 보세요.'}</p>}
              {/* 표제어 — 앞면은 글자만(읽기 · 소리 없음). 문맥 · 듣기 갈래는 답을 보기 전까지 숨긴다(예문이 없으면 단어가 문제). */}
              {((mode !== 'context' && mode !== 'listening') || showAnswer || (mode === 'context' && !currentWord.source_sentence)) && (
                <ReviewHeadword word={currentWord} revealed={showAnswer} id={headwordId} />
              )}

              {/* 플래시카드(본 복습 · 집중 연습 「스스로 확인」) */}
              {mode === 'flash' && (
                <>
                  {!showAnswer && showHint && currentWord.source_sentence && (() => {
                    const { parts, term } = splitSentenceAroundWord(currentWord.source_sentence, currentWord.word_text, currentWord.base_form);
                    return (
                      <p id={hintId} className="review-card__hint" role="status" aria-live="polite" aria-atomic="true" lang={langTag(currentWord)}>
                        {parts.map((part, i, arr) => (
                          i < arr.length - 1
                            ? <span key={i}>{part}<mark className="review-card__highlight review-card__highlight--hint">{term}</mark></span>
                            : <span key={i}>{part}</span>
                        ))}
                      </p>
                    );
                  })()}
                  {!showAnswer && (
                    <Button ref={revealRef} variant="secondary" size="lg" onClick={reveal} className="review-reveal-btn" aria-describedby={headwordId}>
                      {practice ? '뜻 보기' : '정답 확인하기'}<span className="review-keys-hint review-keys-hint--space" aria-hidden="true"> · Space</span>
                    </Button>
                  )}
                </>
              )}

              {/* 뒷면 — 뜻 + 읽기 + 소리 + 원문(출처 없는 표현은 원문 보기 없음) */}
              {showAnswer && (mode === 'flash' || mode === 'typing') && (
                <div className="review-card__answer" role="status" aria-live="polite">
                  {mode === 'typing' && typingAnswer && <p className="review-card__typed"><span>내 답: </span>{typingAnswer}</p>}
                  <p className="review-card__meaning">{currentWord.meaning}</p>
                  <ReviewReadingRow word={currentWord} speak={speak} ttsSupported={ttsSupported} />
                  <VocabularyContexts key={currentWord.id} vocabularyId={currentWord.id} word={currentWord} readOnly />
                </div>
              )}

              {/* 쓰기 갈래(집중 연습) */}
              {mode === 'typing' && !showAnswer && (
                <div className="review-typing">
                  <input
                    type="text"
                    value={typingAnswer}
                    onChange={e => setTypingAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && typingAnswer.trim() && setShowAnswer(true)}
                    placeholder="의미를 입력하세요…"
                    aria-label={`${currentWord.word_text}의 의미`}
                    className="search-input"
                    autoFocus
                  />
                  <Button onClick={() => setShowAnswer(true)} disabled={!typingAnswer.trim()}>
                    확인하기 →
                  </Button>
                </div>
              )}

              {/* 문맥 퀴즈 갈래 */}
              {mode === 'context' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    {currentWord.source_sentence ? (() => {
                      const { parts, term } = splitSentenceAroundWord(currentWord.source_sentence, currentWord.word_text, currentWord.base_form);
                      return (
                        <p className="review-card__hint" style={{ fontSize: '1rem', lineHeight: 1.8 }} lang={langTag(currentWord)}>
                          {parts.map((part, i, arr) =>
                            i < arr.length - 1
                              ? <span key={i}>{part}<mark style={{ background: 'var(--bg-elevated)', color: 'transparent', borderRadius: '4px', padding: '0 4px' }}>{'　'.repeat(Math.max(2, term.length))}</mark></span>
                              : <span key={i}>{part}</span>
                          )}
                        </p>
                      );
                    })() : null /* 예문 없음 — 위 단어 헤더가 문제 역할(뜻 고르기) */}
                  </div>

                  {!showAnswer ? (
                    <div role="group" aria-label="문맥에 맞는 뜻 고르기" className="review-quiz-options">
                      {contextOptions.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={contextSelected !== null}
                          onClick={() => pickContextOption(i)}
                          className={quizOptClass(contextSelected, opt.id === currentWord.id, contextSelected === i)}
                          aria-pressed={contextSelected === i}
                          aria-label={`${opt.meaning}${contextSelected !== null ? (opt.id === currentWord.id ? ', 정답' : contextSelected === i ? ', 선택한 오답' : '') : ''}`}
                        >
                          {opt.meaning}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="review-card__answer" role="status" aria-live="polite"><p className="review-card__meaning">{currentWord.meaning}</p></div>
                  )}

                  {contextSelected !== null && contextOptions[contextSelected]?.id !== currentWord.id && !showAnswer && (
                    <div className="review-quiz-wrong">
                      <Button onClick={() => handleScore(1)} variant="secondary" style={{ flex: 1 }}>{practice ? '다음 →' : '다시 (Again)'}</Button>
                      <Button onClick={() => { setShowAnswer(true); }} variant="ghost" style={{ flex: 1 }}>정답 보기</Button>
                    </div>
                  )}
                </>
              )}

              {/* 듣기 갈래(집중 연습) */}
              {mode === 'listening' && (
                <>
                  {ttsSupported ? (
                    <div className="review-listening">
                      <button
                        onClick={() => speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text))}
                        className="review-listen-btn"
                        title="다시 듣기"
                        aria-label={`${currentWord.word_text} 다시 듣기`}
                      >
                        ▷
                      </button>
                      <p className="review-listening__note">소리를 듣고 알맞은 뜻을 고르세요</p>

                      {!showAnswer ? (
                        <div role="group" aria-label="들은 단어의 뜻 고르기" className="review-quiz-options">
                          {contextOptions.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              disabled={contextSelected !== null}
                              onClick={() => pickContextOption(i)}
                              className={quizOptClass(contextSelected, opt.id === currentWord.id, contextSelected === i)}
                              aria-pressed={contextSelected === i}
                              aria-label={`${opt.meaning}${contextSelected !== null ? (opt.id === currentWord.id ? ', 정답' : contextSelected === i ? ', 선택한 오답' : '') : ''}`}
                            >
                              {opt.meaning}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="review-card__answer" role="status" aria-live="polite"><p className="review-card__meaning">{currentWord.meaning}</p></div>
                      )}

                      {contextSelected !== null && contextOptions[contextSelected]?.id !== currentWord.id && !showAnswer && (
                        <div className="review-quiz-wrong">
                          <Button onClick={() => handleScore(1)} variant="secondary" style={{ flex: 1 }}>{practice ? '다음 →' : '다시 (Again)'}</Button>
                          <Button onClick={() => setShowAnswer(true)} variant="ghost" style={{ flex: 1 }}>정답 보기</Button>
                        </div>
                      )}
                      {showAnswer && practice && <Button onClick={() => handleScore(1)} variant="secondary">다음 →</Button>}
                    </div>
                  ) : (
                    <p className="review-listening__note">이 브라우저에서는 소리를 낼 수 없어요. 다른 방식을 골라 주세요.</p>
                  )}
                </>
              )}

              {/* AI 예문 (정답 공개 후 공통) */}
              {!practice && (showAnswer || contextSelected !== null) && (
                <div className="review-examples">
                  {exampleSentences ? (
                    <>
                      <p className="review-examples__label">AI 예문</p>
                      {exampleSentences.map((ex, i) => (
                        <div key={i} className="review-examples__item">
                          <p lang={langTag(currentWord)}>{ex.sentence}</p>
                          <p className="review-examples__tr">{ex.translation}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <button onClick={loadExamples} disabled={exampleLoading} aria-live="polite" className="review-examples__load">
                      {exampleLoading ? '예문 만드는 중…' : 'AI 예문 보기'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {finishBar}
        </>
      ) : (
        <div className="card review-card review-card--center">
          <div className="review-card__emoji">{vocab.length === 0 ? '★' : '✓'}</div>
          <h2 style={{ marginBottom: '10px' }}>
            {vocab.length === 0 ? '아직 담은 표현이 없어요' : '지금 복습할 표현이 없어요'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            {vocab.length === 0
              ? '자료를 읽으면서 모르는 단어를 누르면 담을 수 있어요.'
              : '다음 복습 때가 되면 여기에 모여요. 새 자료를 읽으며 표현을 더 담아 보세요.'}
          </p>
          <Link href="/materials" className="btn btn--primary btn--md">
            자료 {vocab.length === 0 ? '읽으러 가기' : '더 읽기'}
          </Link>
        </div>
      )}
    </div>
  );
}
