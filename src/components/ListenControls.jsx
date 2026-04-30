'use client';

import { useEffect, useRef, useState } from 'react';

export default function ListenControls({ text, language = 'Japanese' }) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentSentence, setCurrentSentence] = useState('');
  const sentencesRef = useRef([]);
  const indexRef = useRef(0);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!text) { sentencesRef.current = []; return; }
    const sentences = text
      .replace(/\n+/g, ' ')
      .split(/(?<=[。.!?！？])\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    sentencesRef.current = sentences;
    setProgress({ current: 0, total: sentences.length });
  }, [text]);

  useEffect(() => () => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  function speakNext() {
    const sentences = sentencesRef.current;
    const i = indexRef.current;
    if (i >= sentences.length) {
      stop();
      return;
    }
    setProgress({ current: i + 1, total: sentences.length });
    setCurrentSentence(sentences[i]);
    const utter = new SpeechSynthesisUtterance(sentences[i]);
    utter.lang = language === 'Japanese' ? 'ja-JP' : 'en-US';
    utter.rate = rate;
    utter.onend = () => {
      indexRef.current += 1;
      if (indexRef.current < sentences.length) speakNext();
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
    indexRef.current = 0;
    setPlaying(true);
    setPaused(false);
    window.speechSynthesis.cancel();
    speakNext();
  }

  function pause() {
    window.speechSynthesis.pause();
    setPaused(true);
  }

  function stop() {
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
          🎧 듣기
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
