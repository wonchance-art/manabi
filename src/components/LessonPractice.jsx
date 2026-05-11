'use client';

import { useState, useEffect, useRef } from 'react';
import Button from './Button';

const STORAGE_KEY = 'lesson_practice:';

// 띄어쓰기·구두점·전각 공백 흡수
function normalize(s) {
  return String(s || '')
    .replace(/[\s　。、・！？!?,.]/g, '')
    .trim();
}

function isCorrect(input, item) {
  const n = normalize(input);
  if (!n) return false;
  if (n === normalize(item.ja)) return true;
  if (Array.isArray(item.accepts)) {
    return item.accepts.some(a => normalize(a) === n);
  }
  return false;
}

export default function LessonPractice({ items, lessonId, ttsSupported, speak, language }) {
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // null | 'pass' | 'fail'
  const [done, setDone] = useState(false);
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);

  const sttSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const langCode = language === 'Japanese' ? 'ja-JP' : 'en-US';

  const total = items.length;
  const current = items[idx];

  useEffect(() => {
    if (!lessonId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
      if (typeof saved.idx === 'number' && saved.idx >= 0 && saved.idx < items.length) setIdx(saved.idx);
      if (saved.done) setDone(true);
    } catch {}
  }, [lessonId, items.length]);

  function persist(updates) {
    if (!lessonId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
      localStorage.setItem(STORAGE_KEY + lessonId, JSON.stringify({ ...saved, ...updates }));
    } catch {}
  }

  function check() {
    if (!input.trim()) return;
    setResult(isCorrect(input, current) ? 'pass' : 'fail');
  }

  function next() {
    if (idx < total - 1) {
      const n = idx + 1;
      setIdx(n);
      setInput('');
      setResult(null);
      persist({ idx: n });
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setDone(true);
      persist({ done: true });
    }
  }

  function retry() {
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function restart() {
    setIdx(0);
    setInput('');
    setResult(null);
    setDone(false);
    persist({ idx: 0, done: false });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startListening() {
    if (listening || !sttSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = langCode;
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    setListening(true);
    try { recog.start(); } catch { setListening(false); }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (result === null) check();
      else if (result === 'pass') next();
    }
  }

  if (done) {
    return (
      <div className="lesson-practice lesson-practice--done">
        <div className="lesson-practice__done-emoji">🎉</div>
        <div className="lesson-practice__done-title">미션 완료</div>
        <div className="lesson-practice__done-sub">{total}문항 모두 작성했어요. 자기소개 한 컷 OK!</div>
        <Button variant="ghost" size="sm" onClick={restart}>↺ 다시 풀기</Button>
      </div>
    );
  }

  return (
    <div className="lesson-practice">
      <div className="lesson-practice__progress">
        <span className="lesson-practice__progress-num">{idx + 1} / {total}</span>
        <div className="lesson-practice__progress-bar">
          <div className="lesson-practice__progress-fill" style={{ width: `${((idx) / total) * 100}%` }} />
        </div>
      </div>

      <div className="lesson-practice__prompt">
        <div className="lesson-practice__label">아래 한국어를 일본어로 써 보세요</div>
        <div className="lesson-practice__ko">{current.ko}</div>
      </div>

      <textarea
        ref={inputRef}
        value={input}
        onChange={e => { setInput(e.target.value); if (result) setResult(null); }}
        onKeyDown={onKeyDown}
        placeholder="일본어로 입력…"
        className="lesson-practice__input"
        rows={2}
        disabled={result === 'pass'}
        autoFocus
        lang="ja"
      />

      {result === 'pass' && (
        <div className="lesson-practice__feedback lesson-practice__feedback--pass">
          <span className="lesson-practice__mark">✓</span>
          <span>정답이에요</span>
          {ttsSupported && (
            <button type="button" className="lesson-practice__tts" onClick={() => speak(current.ja, language)} title="발음 듣기">🔊</button>
          )}
        </div>
      )}

      {result === 'fail' && (
        <div className="lesson-practice__feedback lesson-practice__feedback--fail">
          <div className="lesson-practice__mark">⚠️ 다시 한번</div>
          <div className="lesson-practice__answer">
            <span className="lesson-practice__answer-label">예시 답</span>
            <span
              className="lesson-practice__answer-ja"
              onClick={() => ttsSupported && speak(current.ja, language)}
              role="button"
              tabIndex={0}
            >
              {current.ja}
            </span>
          </div>
        </div>
      )}

      <div className="lesson-practice__actions">
        {sttSupported && (
          <button
            type="button"
            onClick={startListening}
            disabled={listening || result === 'pass'}
            className="btn btn--ghost btn--sm"
            title="음성 입력"
          >
            {listening ? '🔴 듣는 중' : '🎤'}
          </button>
        )}
        {result === null && (
          <Button onClick={check} disabled={!input.trim()}>확인</Button>
        )}
        {result === 'fail' && (
          <>
            <Button variant="ghost" onClick={retry}>↺ 다시 입력</Button>
            <Button onClick={next}>{idx < total - 1 ? '다음 →' : '미션 완료'}</Button>
          </>
        )}
        {result === 'pass' && (
          <Button onClick={next}>{idx < total - 1 ? '다음 →' : '미션 완료'}</Button>
        )}
      </div>
    </div>
  );
}
