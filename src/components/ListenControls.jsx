'use client';

import { useEffect, useRef, useState } from 'react';
import { bcp47ForLanguage } from '../lib/speechLang';
import ActionIcon from './ActionIcon';
import {t} from '../lib/viewerMessages';

export default function ListenControls({ text, language = 'Japanese', stopSignal, playbackRate, compact = false, uiLocale = 'ko' }) {
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentSentence, setCurrentSentence] = useState('');
  const sentencesRef = useRef([]);
  const indexRef = useRef(0);
  const sessionRef = useRef(0);
  const rateRef = useRef(rate);
  const languageRef = useRef(language);

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
    if (!text) { sentencesRef.current = []; return; }
    const sentences = text
      .replace(/\n+/g, ' ')
      .split(/(?<=[。.!?！？])\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    sentencesRef.current = sentences;
    setProgress({ current: 0, total: sentences.length });
  }, [text, language]);

  useEffect(() => () => {
    sessionRef.current += 1;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  useEffect(()=>{sessionRef.current+=1;window.speechSynthesis?.cancel();setPlaying(false);setPaused(false);setCurrentSentence('');},[stopSignal]);

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
    const utter = new window.SpeechSynthesisUtterance(sentences[i]);
    utter.lang = bcp47ForLanguage(languageRef.current);
    utter.rate = rateRef.current;
    utter.onend = () => {
      if (sessionRef.current !== sessionId) return;
      indexRef.current += 1;
      if (indexRef.current < sentencesRef.current.length) speakNext(sessionId);
      else stop();
    };
    window.speechSynthesis.speak(utter);
  }

  function play() {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }
    if (!sentencesRef.current.length) return;
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

  function stop() {
    sessionRef.current += 1;
    window.speechSynthesis.cancel();
    indexRef.current = 0;
    setPlaying(false);
    setPaused(false);
    setProgress(p => ({ ...p, current: 0 }));
    setCurrentSentence('');
  }

  if (!supported || !text) return null;
  const label=key=>compact?t(uiLocale,key):key;

  return (
    <div className="listen-controls">
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
            <span className="listen-controls__rate" title={compact?label('재생 속도'):'Aa 읽기 설정에서 재생 속도를 바꿀 수 있어요'}>{playbackRate}×</span>
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
