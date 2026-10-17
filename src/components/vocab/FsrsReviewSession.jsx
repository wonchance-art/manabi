'use client';

import { useEffect, useId, useRef } from 'react';
import Button from '../Button';
import { canAutoStartFsrsReview, fsrsIntervalLabel } from '../../lib/useFsrsReview';
import { gradeGuide, isCardRevealClick, revealTrigger } from '../../lib/reviewCard';
import { ReviewBack, ReviewCardMeta, ReviewHeadword, useGradeBarFocus, useRevealFocus, useScoreArmed } from './ReviewCardParts';

const RATINGS = [
  { rating: 1, label: '다시', style: 'again' },
  { rating: 2, label: '어려움', style: 'hard' },
  { rating: 3, label: '알맞음', style: 'good' },
  { rating: 4, label: '쉬움', style: 'easy' },
];

/**
 * 개인 복습에서만 여는 질문 화면. 읽기 단어창의 노출·버튼은 이 회상 경로로 들어오지 않는다.
 *
 * REV-SCOPE-R1B-1: 두 엔진이 섞인 복습 줄 안에서는 embedded로 쓴다 — 복습방이 고른 카드(cardId)만 열고, 채점이
 * 정착하면 onGraded로 줄을 넘긴다. 진행 · 나가기 · 되돌리기는 복습방 상단바가 진다. 카드 규격(앞면 글자만 ·
 * 뒷면 뜻 + 읽기 + 소리 · 하단 고정 채점 막대 · 펼친 뒤 0.3초 잠금)은 예전 일정 카드와 같다(ReviewCardParts).
 */
export default function FsrsReviewSession({ review, onExit, embedded = false, cardId = null, stepKey = null, onGraded, onUnavailable,
  onReveal, speak, ttsSupported = false, onKnown, knownDisabled = false }) {
  const { current, busy, error, ready, nextWakeAt, lastGrade, controller } = review;
  const asked = useRef(null);
  useEffect(() => {
    if (embedded) {
      // 줄이 고른 카드만 연다. 출제할 수 없는 카드(다른 곳에서 채점 · 아는 단어 · 제외)는 한 번 확인한 뒤 건너뛴다.
      if (!cardId || busy || current?.cardId === cardId || asked.current === stepKey) return;
      asked.current = stepKey;
      controller.question(cardId).then(opened => { if (!opened && !controller.getSnapshot().error) onUnavailable?.(cardId); });
      return;
    }
    if (canAutoStartFsrsReview({ current, busy, error, ready })) controller.question();
    // 판정은 ready.length만 본다 — 배열 정체성만 바뀐 갱신에서 질문을 다시 열지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, busy, error, ready.length, controller, embedded, cardId, stepKey]);
  const revealed = current?.phase === 'revealed' && (!embedded || current.cardId === cardId);
  const armed = useScoreArmed(revealed, current?.attempt?.id || cardId);
  const bar = useGradeBarFocus(!revealed, armed); // 뒷면이 열리면 막대(버튼 아님)로 초점 — FOCUS-AFTER-ACTION-001 C2(예전 일정 카드와 같은 규격)
  const word0 = current?.word && (!embedded || current.cardId === cardId);
  const revealRef = useRevealFocus(!!word0 && !revealed, current?.attempt?.id || null, busy || !current?.attempt); // 새 카드 「정답 확인하기」로 초점(STUDY-FOCUS-001)
  const headwordId = useId(); // 그 단추가 표제어를 함께 읽게(aria-describedby)
  const reveal = async trigger => {
    if (await controller.reveal()) onReveal?.(trigger, current?.word);
  };
  const grade = async rating => {
    if (!armed) return;
    const graded = current?.cardId;
    if (await controller.grade(rating)) onGraded?.(graded, rating);
  };
  const keys = useRef({});
  keys.current = { grade, reveal, armed, phase: current?.phase };
  useEffect(() => {
    const keydown = event => {
      const target = event.target;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || busy) return;
      // 되돌리기(⌘Z)는 embedded일 때 복습방이 엔진에 맞춰 처리한다 — 두 리스너가 같은 키를 쓰지 않게.
      if (!embedded && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && lastGrade) {
        event.preventDefault(); controller.undo(); return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const h = keys.current;
      if (event.key === ' ' && h.phase === 'question') { event.preventDefault(); h.reveal('shortcut'); return; }
      if (h.phase !== 'revealed') return;
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); h.grade(Number(event.key)); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [busy, lastGrade, controller, embedded]);
  const word = current?.word && (!embedded || current.cardId === cardId) ? current.word : null;
  const leave = () => { controller.leave(); onExit(); };
  const disabled = busy || !review.registryAvailable || !review.enabled;
  return <div className="review-room-session">
    {!embedded && <div className="review-room-session-nav">
      <button type="button" className="review-topbar__exit" disabled={busy} onClick={leave}>← 나가기</button>
      <span role="status">{review.completed}</span>
      <button type="button" className="btn btn--ghost btn--sm" title="되돌리기 Ctrl/⌘+Z" aria-label="직전 채점 되돌리기"
        disabled={!lastGrade || busy} onClick={() => controller.undo()}>↶</button>
    </div>}
    {error && <p role="alert">복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.
      <button type="button" disabled={busy} onClick={() => current && !current.attempt ? controller.question(embedded ? cardId : undefined) : controller.refresh()}>다시 시도</button>
    </p>}
    {word ? <>
      {/* key = 카드마다 새로 그려 넘김 효과(review-card--turn)가 한 장마다 한 번 돈다. */}
      <div key={current.cardId} className="card review-card review-card--turn" aria-busy={busy} style={{ padding: 0 }}>
        {onKnown && <div className="review-card__progress review-card__progress--tools"><div className="review-card__tools">
          <button type="button" className="review-known-btn" disabled={knownDisabled || busy} onClick={() => onKnown(word)}>아는 단어</button>
        </div></div>}
        <div className={`review-card__body${revealed ? '' : ' review-card__body--front'}`}
          onClick={event => { if (!revealed && !disabled && current.attempt && isCardRevealClick(event)) reveal(revealTrigger(event)); }}>
          <ReviewCardMeta label="복습" word={word} />
          <ReviewHeadword word={word} revealed={revealed} id={headwordId} />
          {revealed ? <ReviewBack word={word} speak={speak} ttsSupported={ttsSupported} />
            : <Button ref={revealRef} variant="secondary" size="lg" disabled={disabled || !current.attempt} className="review-reveal-btn"
              aria-describedby={headwordId} onClick={event => reveal(revealTrigger(event))}>정답 확인하기<span className="review-keys-hint review-keys-hint--space" aria-hidden="true"> · Space</span></Button>}
        </div>
      </div>
      <div ref={bar} tabIndex={-1} className={`review-grade-bar${revealed ? '' : ' is-locked'}`} role="group" aria-label="기억 채점">
        {/* 안내 줄 · 간격 글 자리는 앞면(잠김)에서도 비워 둔다 — 정답 확인 때 막대가 자라지 않게(VOCAB-FLOW-001 C). 잠김엔 숨김 · 화면 읽기 제외. */}
        <p className={`review-score-guide review-grade-guide${revealed ? '' : ' review-grade-guide--reserve'}`} aria-hidden={!revealed || undefined}>{gradeGuide(word)}<span className="review-keys-hint"> · 키 1~4 · 되돌리기 Ctrl/⌘+Z</span></p>
        <div className="review-score-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {RATINGS.map(({ rating, label, style }) => <button key={rating} type="button"
            onClick={() => grade(rating)} disabled={!revealed || !armed || disabled}
            className={`review-score-btn review-score-btn--${style}`} title={revealed ? current.previews?.[rating]?.due : undefined}>
            {label}<span className="save-grade__key" aria-hidden="true">{rating}</span>
            {/* 보조 글 첫 글자 띄어쓰기 = 화면 읽기 이름 「다시 10분」(GRADE-NAME-001). 줄 첫머리 공백이라 화면에는 그려지지 않는다. */}
            {revealed ? <small>{' '}{fsrsIntervalLabel(current.previews?.[rating]?.due, current.previewAt)}</small>
              : <small className="review-grade-guide--reserve" aria-hidden="true">{' '}{' '}</small>}
          </button>)}
        </div>
      </div>
    </> : <div className="review-room-state" role="status" aria-busy={busy || embedded || undefined}>
      <p>{busy || embedded ? '복습 준비 중…' : '지금 복습할 표현이 없어요. 다음 복습까지 새로운 문장을 만나 보세요.'}</p>
      {!embedded && nextWakeAt && <time dateTime={nextWakeAt}>{new Date(nextWakeAt).toLocaleTimeString()}</time>}
      {!embedded && <Button variant="ghost" disabled={busy} onClick={leave}>목록으로</Button>}
    </div>}
  </div>;
}
