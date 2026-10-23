'use client';

import { useEffect, useRef, useState } from 'react';
import { speechTagForLanguage } from '../lib/speechLang';
import ActionIcon from './ActionIcon';
import {t} from '../lib/viewerMessages';
import { splitListenSentences } from '../lib/listenFollow';
// 소리를 내지 못한 이유는 단어 발음과 같은 길(TTS-GAP-001)로 알린다 — 같은 조건 · 같은 문구(providers의 SpeechUnavailableNotice 토스트).
import { nativeSpeechAvailable, notifySpeechUnavailable, speechCanceled } from '../lib/useTTS';

// 재생 중 속도 칸의 글자 — 뷰어는 Aa 「재생 속도」와 같은 이름(1× 등)을 넘긴다. playbackRate는 Web Speech에 넣는 실제 값(보통 0.85)이라
// 그대로 보이면 설정은 1×인데 막대는 0.85×로 서로 다른 말을 했다(뷰어 기능 감사 2026-10-17 KST).
export function listenRateText(playbackRate, rateLabel) {
  return rateLabel || `${playbackRate}×`;
}

// onSentence(i) — 지금 읽기 시작한 문장 번호(splitListenSentences 순서), 멈추면 null. 뷰어가 쪽 따라가기에 쓴다(listenFollow.js).
// followActive — 뷰어가 쪽 넘김 따라가기 중(본문이 읽는 줄을 강조) — 좁은 폭에서는 「지금 문장」 줄을 숨긴다(CSS, reader-controls.css).
export default function ListenControls({ text, language = 'Japanese', stopSignal, playbackRate, rateLabel, onSentence, followActive = false, compact = false, uiLocale = 'ko' }) {
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentSentence, setCurrentSentence] = useState('');
  const sentencesRef = useRef([]);
  const indexRef = useRef(0);
  const sessionRef = useRef(0);
  const interruptedRef = useRef(false);
  // 듣기 버튼과 재생 막대는 서로 갈아 끼워진다 — 누른 손의 초점을 바뀐 쪽으로 넘긴다(시작 → 일시정지, 정지 → 듣기).
  // 넘기지 않으면 초점이 페이지 맨 앞으로 떨어졌다(뷰어 점검 2026-10-23).
  const rootRef = useRef(null);
  const focusAfter = useRef(false);
  const holdFocus = () => { focusAfter.current = !!rootRef.current?.contains(document.activeElement); };
  const rateRef = useRef(rate);
  const languageRef = useRef(language);
  const onSentenceRef = useRef(onSentence);
  onSentenceRef.current = onSentence;

  rateRef.current = playbackRate ?? rate;
  languageRef.current = language;

  useEffect(() => {
    setSupported(!!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function');
  }, []);

  useEffect(() => {
    sessionRef.current += 1;
    window.speechSynthesis?.cancel();
    indexRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setCurrentSentence('');
    onSentenceRef.current?.(null);
    if (!text) { sentencesRef.current = []; return; }
    const sentences = splitListenSentences(text);
    sentencesRef.current = sentences;
    setProgress({ current: 0, total: sentences.length });
  }, [text, language]);

  useEffect(() => () => {
    sessionRef.current += 1;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    onSentenceRef.current?.(null);
  }, []);

  useEffect(()=>{sessionRef.current+=1;interruptedRef.current=false;window.speechSynthesis?.cancel();setPlaying(false);setPaused(false);setCurrentSentence('');onSentenceRef.current?.(null);},[stopSignal]);

  function speakNext(sessionId) {
    if (sessionRef.current !== sessionId) return;
    const sentences = sentencesRef.current;
    const i = indexRef.current;
    if (i >= sentences.length) {
      stop();
      return;
    }
    setProgress({ current: i + 1, total: sentences.length });
    setCurrentSentence(sentences[i]);
    onSentenceRef.current?.(i);
    const utter = new window.SpeechSynthesisUtterance(sentences[i]);
    utter.lang = speechTagForLanguage(languageRef.current); // 단어 발음과 같은 태그(Korean → ko-KR)
    utter.rate = rateRef.current;
    // 음성 오류(엔진 · 목소리 없음 등) — 이 세션이면 재생 상태와 뷰어 강조를 정리한다(stop → onSentence(null)).
    // 취소 · 끊김(단어 발음이 이어받음 등)은 정리만, 그 밖의 실패는 단어 발음과 같은 'failed' 안내(TTS-GAP-001).
    // 취소(cancel)로 끝난 옛 세션의 오류는 세션 번호가 달라 무시된다.
    // 끊김(단어 발음이 이어받음)은 정지가 아니라 그 문장에서 멈춤이다 — ▶를 누르면 그 문장부터 다시 읽는다.
    // 정지로 처리하면 단어 하나 듣는 데 듣던 자리를 잃고 처음부터였다(뷰어 점검 2026-10-23).
    utter.onerror = (event) => { if (sessionRef.current === sessionId) { if (speechCanceled(event)) interrupt(); else fail('failed'); } };
    utter.onend = () => {
      if (sessionRef.current !== sessionId) return;
      indexRef.current += 1;
      if (indexRef.current < sentencesRef.current.length) speakNext(sessionId);
      else stop();
    };
    try { window.speechSynthesis.speak(utter); } catch { fail('failed'); } // 엔진이 발화를 바로 거절(iOS 등) — useTTS와 같다
  }

  function play() {
    holdFocus();
    if (paused && interruptedRef.current) {
      interruptedRef.current = false;
      const sessionId = ++sessionRef.current;
      setPaused(false);
      speakNext(sessionId);
      return;
    }
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }
    if (!sentencesRef.current.length) return;
    // 이 기기에 그 언어의 목소리가 없으면(한국어 음성 없음) 시작하지 않고 단어 발음과 같은 'no-voice' 안내.
    if (!nativeSpeechAvailable(languageRef.current)) { notifySpeechUnavailable('no-voice'); return; }
    const sessionId = ++sessionRef.current;
    indexRef.current = 0;
    setPlaying(true);
    setPaused(false);
    window.speechSynthesis.cancel();
    speakNext(sessionId);
  }

  function pause() {
    window.speechSynthesis.pause();
    setPaused(true);
  }

  function interrupt() {
    sessionRef.current += 1;
    interruptedRef.current = true;
    setPaused(true);
  }

  function stop() {
    holdFocus();
    interruptedRef.current = false;
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    onSentenceRef.current?.(null);
    indexRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setProgress(p => ({ ...p, current: 0 }));
    setCurrentSentence('');
  }

  function fail(reason) {
    stop();
    notifySpeechUnavailable(reason);
  }

  useEffect(() => {
    if (!focusAfter.current) return;
    focusAfter.current = false;
    if (rootRef.current?.contains(document.activeElement)) return;
    rootRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [playing]);

  if (!supported || !text) return null;
  const label=key=>compact?t(uiLocale,key):key;

  return (
    <div ref={rootRef} className={followActive ? 'listen-controls listen-controls--follow' : 'listen-controls'}>
      {!playing ? (
        // 뷰어 툴바(compact)도 보이는 라벨을 단다(AD-R2 §5) — 접근 이름 「본문 전체 듣기」 안에 보이는 「듣기」가 든다.
        // 재생 중 컨트롤(▶/⏸/⏹)은 지금처럼 아이콘만이다(설계 §9.2 — 라벨은 정지 상태 버튼에만).
        <button className={compact?'btn btn--ghost btn--sm viewer-tool':'btn btn--ghost btn--sm'} onClick={play} title={label('본문 전체 듣기')} aria-label={compact?label('본문 전체 듣기'):undefined}>
          {compact?<><ActionIcon name="audio"/><span>{label('듣기')}</span></>:'▷ 듣기'}
        </button>
      ) : (
        <div className="listen-controls__panel">
          {paused ? (
            <button className="listen-controls__btn" onClick={play} aria-label={label('재생')} title={label('재생')} data-icon-action={compact||undefined}>{compact?<ActionIcon name="play"/>:'▶'}</button>
          ) : (
            <button className="listen-controls__btn" onClick={pause} aria-label={label('일시정지')} title={label('일시정지')} data-icon-action={compact||undefined}>{compact?<ActionIcon name="pause"/>:'⏸'}</button>
          )}
          <button className="listen-controls__btn" onClick={stop} aria-label={label('정지')} title={label('정지')} data-icon-action={compact||undefined}>{compact?<ActionIcon name="stop"/>:'⏹'}</button>
          <span className="listen-controls__progress">{progress.current}/{progress.total}</span>
          {playbackRate != null ? (
            <span className="listen-controls__rate" title={compact?label('재생 속도'):'Aa 읽기 설정에서 재생 속도를 바꿀 수 있어요'}>{listenRateText(playbackRate, rateLabel)}</span>
          ) : <select
            className="listen-controls__rate"
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            aria-label="재생 속도"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>}
        </div>
      )}
      {playing && currentSentence && (
        <div className="listen-controls__current">{currentSentence}</div>
      )}
    </div>
  );
}
