'use client';

// 복습 카드 공통 조각(REV-SCOPE-R1B-1 — 설계 §3-2 · §3-3 · §5-3 · §6-1 ⑥). 예전 일정 카드(VocabReview) · 새 일정
// 카드(FsrsReviewSession) · 처음 보는 표현 · 집중 연습이 같은 앞뒤 규격을 쓴다: 앞면 = 글자만(읽기 · 뜻 없음),
// 뒷면 = 뜻 + 읽기 + 소리. 판정(종류 · 발음 판정 대상 · 읽기 줄 · 문구)은 reviewCard.js가 진다.
import { useEffect, useRef, useState } from 'react';
import VocabularyContexts from '../learning/VocabularyContexts';
import { detectLang, displayWord } from '../../lib/constants';
import { EXPRESSION_KIND_LABELS, expressionKind, gradeGuide, readingLine, revealTrigger } from '../../lib/reviewCard';
import { focusIfFree } from '../../lib/focusAfterAction';

const LANG_TAG = { Japanese: 'ja', Chinese: 'zh', English: 'en', French: 'fr', Korean: 'ko' };
export const langTag = word => LANG_TAG[word?.language] || undefined;

/** 펼친 뒤 0.3초는 채점 입력을 받지 않는다(두 번 탭 오채점 방지, §5-3). key가 바뀌면 다시 잠근다. */
export const SCORE_ARM_MS = 300;
export function useScoreArmed(revealed, key) {
  const [armedKey, setArmedKey] = useState(null);
  useEffect(() => {
    if (!revealed) return undefined;
    const timer = setTimeout(() => setArmedKey(key), SCORE_ARM_MS);
    return () => clearTimeout(timer);
  }, [revealed, key]);
  return revealed && armedKey === key;
}

/**
 * 채점 막대로 초점 잇기(FOCUS-AFTER-ACTION-001 C2). 「정답 확인하기」는 누르면 사라져 초점이 body로 떨어졌다.
 * 막대가 잠김에서 풀림(뒷면 + armed)으로 바뀐 그 한 번만 **막대 자체**(tabIndex -1 · role=group 「기억 채점」)로 옮긴다.
 * 버튼이 아니므로 Space/Enter를 한 번 더 눌러도 채점되지 않는다. Tab을 누르면 네 버튼으로 들어간다.
 * 막 열린 화면(처음부터 풀린 상태)은 건드리지 않는다. 초점이 복습 화면 밖이면 뺏지 않는다.
 * 돌려준 ref는 막대 div에 단다.
 */
/**
 * 새 카드의 「정답 확인하기」로 초점 잇기(STUDY-FOCUS-001). 채점하거나 복습을 시작하면 누른 단추가 사라져 초점이 body로
 * 떨어졌다 — Space · 1~4 단축키는 되지만, 화면 읽기는 새 카드를 알리지 않고 Tab은 머리글부터 다시 돈다(실측 3~6번).
 * 카드(key)마다 앞면이 쓸 수 있게 된 그 한 번만 옮긴다(focusIfFree — 복습 화면 밖의 초점은 뺏지 않는다). ref는 단추에 단다.
 */
export function useRevealFocus(front, cardKey, disabled = false) {
  const button = useRef(null);
  const focusedKey = useRef(null);
  useEffect(() => {
    if (!front || disabled || cardKey == null || focusedKey.current === cardKey) return;
    if (focusIfFree(button.current, button.current?.closest('.review-room-session'))) focusedKey.current = cardKey;
  }, [front, cardKey, disabled]);
  return button;
}

export function useGradeBarFocus(locked, armed) {
  const bar = useRef(null);
  const sawLocked = useRef(false);
  useEffect(() => {
    if (locked) { sawLocked.current = true; return; }
    if (!armed || !sawLocked.current) return;
    sawLocked.current = false;
    focusIfFree(bar.current, bar.current?.closest('.review-room-session'));
  }, [locked, armed]);
  return bar;
}

/** 카드 머리 — 「복습 · 단어」 · 「처음 보는 표현」 · 「집중 연습 · 7 / 42」. */
export function ReviewCardMeta({ label, word }) {
  const kind = word ? EXPRESSION_KIND_LABELS[expressionKind(word)] : null;
  return <p className="review-card__meta">{[label, kind].filter(Boolean).join(' · ')}</p>;
}

/** 표제어 — 뒷면의 일본어 한자어는 한자 위 후리가나(ruby). 앞면에는 읽기를 내지 않는다. */
export function ReviewHeadword({ word, revealed = false }) {
  const line = revealed ? readingLine(word) : { kind: 'none' };
  const text = displayWord(word.word_text, word.pos);
  return <h2 className="review-card__word" lang={langTag(word)}>
    {line.kind === 'ruby' ? <ruby>{text}<rt>{line.text}</rt></ruby> : text}
  </h2>;
}

/** ▷ 듣기 — 음성을 쓸 수 없으면 숨긴다(읽기 글만). 44px 터치 영역. */
export function ListenButton({ word, speak, ttsSupported, label = '듣기' }) {
  if (!ttsSupported || !speak) return null;
  return <button type="button" className="review-listen" aria-label={`${word.word_text} 발음 듣기`}
    onClick={() => speak(word.word_text, word.language || detectLang(word.word_text))}>
    <span aria-hidden="true">▷</span> {label}
  </button>;
}

/** 뒷면 읽기 줄 — 중국어 병음 · 영어/프랑스어 발음 표기 + ▷. 후리가나는 표제어 위(ruby)에 있다. */
export function ReviewReadingRow({ word, speak, ttsSupported }) {
  const line = readingLine(word);
  const text = line.kind === 'pinyin' || line.kind === 'phonetic' ? line.text : null;
  if (!text && !(ttsSupported && speak)) return null;
  return <p className="review-card__reading-row">
    {text && <span className={`review-card__reading review-card__reading--${line.kind}`} lang={langTag(word)}>{text}</span>}
    <ListenButton word={word} speak={speak} ttsSupported={ttsSupported} />
  </p>;
}

/** 뒷면 — 뜻 + 읽기 + 소리 + 원문(출처 없는 표현은 원문 보기 없음 — VocabularyContexts). 화면 읽기 프로그램에는 글로 알린다. */
export function ReviewBack({ word, speak, ttsSupported, contexts = true }) {
  return <div className="review-card__answer" role="status" aria-live="polite">
    <p className="review-card__meaning">{word.meaning}</p>
    <ReviewReadingRow word={word} speak={speak} ttsSupported={ttsSupported} />
    {contexts && <VocabularyContexts key={word.id} vocabularyId={word.id} word={word} readOnly />}
  </div>;
}

/** 채점 기준 문구(§6-1 ⑥) — 발음 판정 대상에만 발음을 말한다. */
export function GradeGuide({ word }) {
  return <p className="review-grade-guide">{gradeGuide(word)}</p>;
}

/** 처음 보는 표현(§3-4 · §6-1 ⑥) — 채점 없음. 전부 보여 주고 「다음 →」, 잠시 뒤 다시 묻는다. */
export function ReviewIntroCard({ word, speak, ttsSupported, onNext, disabled = false }) {
  return <div className="card review-card review-card--intro">
    <div className="review-card__body">
      <ReviewCardMeta label="처음 보는 표현" />
      <ReviewHeadword word={word} revealed />
      <ReviewBack word={word} speak={speak} ttsSupported={ttsSupported} />
      <button type="button" className="btn btn--primary btn--lg review-intro__next" disabled={disabled}
        onClick={event => onNext(revealTrigger(event))}>다음 →</button>
      <p className="review-intro__note">잠시 뒤 다시 물어볼게요</p>
    </div>
  </div>;
}

/** 🔈/🔇 — 펼칠 때 소리 자동 재생(기기별 기억). */
export function ReviewSoundToggle({ on, onToggle }) {
  return <button type="button" className="review-sound-toggle" aria-pressed={on} aria-label="소리 자동 재생"
    title={on ? '소리 켜짐' : '소리 꺼짐'} onClick={() => onToggle(!on)}><span aria-hidden="true">{on ? '🔈' : '🔇'}</span></button>;
}
