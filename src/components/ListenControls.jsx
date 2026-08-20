'use client';

import { useEffect, useRef, useState } from 'react';
import { bcp47ForLanguage } from '../lib/speechLang';

export default function ListenControls({ text, language = 'Japanese' }) {
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

  rateRef.current = rate;
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

  return (
    <div className="listen-controls">
      {!playing ? (
        <button className="btn btn--ghost btn--sm" onClick={play} title="본문 전체 듣기">
          ▷ 듣기
        </button>
      ) : (
        <div className="listen-controls__panel">
          {paused ? (
            <button className="listen-controls__btn" onClick={play} aria-label="재생">▶</button>
          ) : (
            <button className="listen-controls__btn" onClick={pause} aria-label="일시정지">⏸</button>
          )}
          <button className="listen-controls__btn" onClick={stop} aria-label="정지">⏹</button>
          <span className="listen-controls__progress">{progress.current}/{progress.total}</span>
          <select
            className="listen-controls__rate"
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            aria-label="재생 속도"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </div>
      )}
      {playing && currentSentence && (
        <div className="listen-controls__current">{currentSentence}</div>
      )}
    </div>
  );
}
