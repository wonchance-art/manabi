'use client';

import { useEffect, useId, useRef } from 'react';
import Button from '../Button';
import { canAutoStartFsrsReview, fsrsIntervalLabel } from '../../lib/useFsrsReview';
import { isCardRevealClick, revealTrigger } from '../../lib/reviewCard';
import { ReviewBack, ReviewCardMeta, ReviewHeadword, useGradeBarFocus, useRevealFocus, useScoreArmed } from './ReviewCardParts';
import { ListenFace, MeaningFace } from '../cards/CardFaces';
import { detectLang } from '../../lib/constants';

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
// ahead = 미리 학습 단계(LEARN-AHEAD-001 — 복습방이 줄을 다 푼 뒤 끼운 20분 안의 학습 · 재학습 카드). 차례 전이어도 그 카드를 연다.
//
// 카드 세 종류(CARD-TYPES-001 4단계 · 오너 결정 2026-11-01 KST) — 문제 면은 단어 페이지와 같은 부품(CardFaces)이다: 단어 → 뜻 = 표제어,
// 뜻 → 단어 = 뜻(표제어 자리 · 같은 칸), 듣기 = 소리 단추만(저장한 원문 문장 source_sentence, 없으면 그 단어). 종류 글씨는 없다. 답 면은 이 방의
// 답 면 그대로(표제어 루비 · 뜻 · 읽기 · 소리 · 원문) — 듣기는 소리 단추가 그 자리에 남아 다시 들을 수 있다.
/** 문제 면 — current.kind가 고른다. headwordId = 「정답 확인하기」가 함께 읽는 이름(답을 흘리지 않는 면만). */
export function FsrsQuestionFace({ kind = 'recognition', word, revealed, id, speak, ttsSupported }) {
  if (kind === 'listening') {
    const say = ttsSupported && speak ? text => speak(text, word.language || detectLang(word.word_text)) : null;
    return <>
      <div className="review-card__play" id={id}><ListenFace speak={say} text={word.source_sentence || word.word_text} /></div>
      {revealed && <ReviewHeadword word={word} revealed />}
    </>;
  }
  // 뜻 → 단어는 답 면에서도 묻는 뜻을 위에 그대로 두고 답(표제어 · 루비)을 바로 아래에 — 단어 페이지와 같은 원칙(오너 2026-11-01 KST
  // 「갑자기 뜻이 사라지는 거?」). 아래 답 칸(ReviewBack)은 뜻 줄을 다시 쓰지 않는다(meaning={false}).
  if (kind === 'production') return <>
    <MeaningFace meaning={word.meaning} className="review-card__word" as="h2" id={id} />
    {revealed && <ReviewHeadword word={word} revealed />}
  </>;
  return <ReviewHeadword word={word} revealed={revealed} id={id} />;
}
export default function FsrsReviewSession({ review, onExit, embedded = false, cardId = null, stepKey = null, ahead = false, onGraded, onUnavailable,
  onReveal, speak, ttsSupported = false, onKnown, knownDisabled = false }) {
  const { current, busy, error, ready, nextWakeAt, lastGrade, controller } = review;
  const asked = useRef(null);
  useEffect(() => {
    if (embedded) {
      // 줄이 고른 카드만 연다. 출제할 수 없는 카드(다른 곳에서 채점 · 아는 단어 · 제외)는 한 번 확인한 뒤 건너뛴다.
      if (!cardId || busy || current?.cardId === cardId || asked.current === stepKey) return;
      asked.current = stepKey;
      controller.question(cardId, ahead ? { ahead: true } : undefined).then(opened => { if (!opened && !controller.getSnapshot().error) onUnavailable?.(cardId); });
      return;
    }
    if (canAutoStartFsrsReview({ current, busy, error, ready })) controller.question();
    // 판정은 ready.length만 본다 — 배열 정체성만 바뀐 갱신에서 질문을 다시 열지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, busy, error, ready.length, controller, embedded, cardId, stepKey, ahead]);
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
  // 듣기 카드 자동 1회(오너 2026-11-01 KST 권장대로 — 단어 페이지와 같다): 문제 면이 처음 뜰 때(시도마다 한 번) 문제 소리를 들려준다.
  // 소리 = 문제 면 단추와 같은 글(저장한 원문 문장, 없으면 단어). 소리를 쓸 수 없으면 아무것도 하지 않는다 · 첫 소리는 브라우저 규칙상 누른 뒤.
  const sayAttempt = word && current?.kind === 'listening' && current.phase === 'question' && ttsSupported && speak ? current.attempt?.id || current.cardId : null;
  useEffect(() => {
    if (!sayAttempt || !word) return;
    speak(word.source_sentence || word.word_text, word.language || detectLang(word.word_text));
  }, [sayAttempt]); // eslint-disable-line react-hooks/exhaustive-deps -- 시도마다 한 번만
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
          <FsrsQuestionFace kind={current.kind} word={word} revealed={revealed} id={headwordId} speak={speak} ttsSupported={ttsSupported} />
          {revealed ? <ReviewBack word={word} speak={speak} ttsSupported={ttsSupported} meaning={current.kind !== 'production'} />
            : <Button ref={revealRef} variant="secondary" size="lg" disabled={disabled || !current.attempt} className="review-reveal-btn"
              aria-describedby={headwordId} onClick={event => reveal(revealTrigger(event))}>정답 확인하기<span className="review-keys-hint review-keys-hint--space" aria-hidden="true"> · Space</span></Button>}
        </div>
      </div>
      <div ref={bar} tabIndex={-1} className={`review-grade-bar${revealed ? '' : ' is-locked'}`} role="group" aria-label="기억 채점">
        {/* 안내 줄 · 간격 글 자리는 앞면(잠김)에서도 비워 둔다 — 정답 확인 때 막대가 자라지 않게(VOCAB-FLOW-001 C). 잠김엔 숨김 · 화면 읽기 제외. */}
        <p className={`review-score-guide review-grade-guide${revealed ? '' : ' review-grade-guide--reserve'}`} aria-hidden={!revealed || undefined}><span className="review-keys-hint">키 1~4 · 되돌리기 Ctrl/⌘+Z</span></p>
        <div className="review-score-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {RATINGS.map(({ rating, label, style }) => <button key={rating} type="button"
            onClick={() => grade(rating)} disabled={!revealed || !armed || disabled}
            className={`review-score-btn review-score-btn--${style}`} title={revealed ? current.previews?.[rating]?.due : undefined}>
            {label}<span className="save-grade__key" aria-hidden="true">{rating}</span>
            {/* 보조 글 첫 글자 띄어쓰기 = 화면 읽기 이름 「다시 10분」(GRADE-NAME-001). 줄 첫머리 공백이라 화면에는 그려지지 않는다. */}
            {revealed ? <small>{' '}{fsrsIntervalLabel(current.previews?.[rating]?.due, current.previewAt)}</small>
              : <small className="review-grade-guide--reserve" aria-hidden="true">{'\u00a0'}</small>}
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
