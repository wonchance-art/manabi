'use client';

import { useEffect } from 'react';
import Button from '../Button';
import VocabularyContexts from '../learning/VocabularyContexts';
import { displayWord } from '../../lib/constants';
import { canAutoStartFsrsReview, fsrsIntervalLabel } from '../../lib/useFsrsReview';

const RATINGS = [
  { rating: 1, label: '다시', style: 'again' },
  { rating: 2, label: '어려움', style: 'hard' },
  { rating: 3, label: '알맞음', style: 'good' },
  { rating: 4, label: '쉬움', style: 'easy' },
];

/** 개인 복습에서만 여는 질문 화면. 읽기 단어창의 노출·버튼은 이 회상 경로로 들어오지 않는다. */
export default function FsrsReviewSession({ review, onExit }) {
  const { current, busy, error, ready, nextWakeAt, lastGrade, controller } = review;
  useEffect(() => {
    if (canAutoStartFsrsReview({ current, busy, error, ready })) controller.question();
    // 판정은 ready.length만 본다 — 배열 정체성만 바뀐 갱신에서 질문을 다시 열지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, busy, error, ready.length, controller]);
  useEffect(() => {
    const keydown = event => {
      const target = event.target;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || busy) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && lastGrade) {
        event.preventDefault(); controller.undo(); return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || current?.phase !== 'revealed') return;
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); controller.grade(Number(event.key)); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [busy, current?.phase, lastGrade, controller]);
  const word = current?.word;
  const leave = () => { controller.leave(); onExit(); };
  return <div className="review-room-session">
    <div className="review-room-session-nav">
      <button type="button" className="review-topbar__exit" disabled={busy} onClick={leave}>← 나가기</button>
      <span role="status">{review.completed}</span>
      <button type="button" className="btn btn--ghost btn--sm" title="되돌리기 Ctrl/⌘+Z"
        disabled={!lastGrade || busy} onClick={() => controller.undo()}>↶</button>
    </div>
    {error && <p role="alert">복습 저장 실패 — 연결을 확인해주세요. 이 단어는 다음에 다시 나와요.
      <button type="button" disabled={busy} onClick={() => current && !current.attempt ? controller.question() : controller.refresh()}>다시 시도</button>
    </p>}
    {word ? <div className="card review-card" aria-busy={busy} style={{ padding: 0 }}>
      <div className="review-card__body">
        <p className="review-room-prompt">{current.phase === 'revealed' ? '뜻을 확인했어요. 기억의 정도를 골라 주세요.' : '이 표현, 어떤 뜻이었나요?'}</p>
        <h2 className="review-card__word">{displayWord(word.word_text, word.pos)}</h2>
        {current.phase === 'revealed' ? <>
          {word.furigana && <p className="review-card__furigana">[{word.furigana}]</p>}
          <div className="review-card__answer" role="status" aria-live="polite">
            <p className="review-card__meaning">{word.meaning}</p>
            <VocabularyContexts key={word.id} vocabularyId={word.id} word={word} readOnly />
            <p className="review-score-guide">기억이 얼마나 잘 됐나요?<span className="review-keys-hint"> · 키 1~4 · 되돌리기 Ctrl/⌘+Z</span></p>
            <div className="review-score-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              {RATINGS.map(({ rating, label, style }) => <button key={rating} type="button"
                onClick={() => controller.grade(rating)} disabled={busy || !review.registryAvailable || !review.enabled}
                className={`review-score-btn review-score-btn--${style}`} title={current.previews?.[rating]?.due}>
                {label}<span className="save-grade__key" aria-hidden="true">{rating}</span>
                <small>{fsrsIntervalLabel(current.previews?.[rating]?.due, current.previewAt)}</small>
              </button>)}
            </div>
          </div>
        </> : <Button variant="secondary" size="lg" disabled={busy || !current.attempt || !review.registryAvailable || !review.enabled}
          onClick={() => controller.reveal()} style={{ marginTop: '40px', borderRadius: 'var(--radius-full)' }}>정답 확인하기</Button>}
      </div>
    </div> : <div className="review-room-state" role="status">
      <p>{busy ? '복습 준비 중…' : '지금 다시 볼 표현은 없어요. 다음 복습까지 새로운 문장을 만나 보세요.'}</p>
      {nextWakeAt && <time dateTime={nextWakeAt}>{new Date(nextWakeAt).toLocaleTimeString()}</time>}
      <Button variant="ghost" disabled={busy} onClick={leave}>목록으로</Button>
    </div>}
  </div>;
}
