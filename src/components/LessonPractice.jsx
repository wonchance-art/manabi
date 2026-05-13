'use client';

import { useState, useEffect, useRef } from 'react';
import Button from './Button';
import { isAnswerCorrect } from '../lib/lessonAccepts';

const STORAGE_KEY = 'lesson_practice:';

/**
 * 한 → 일 번역 미션
 *  - 입력 → 정규화 + 변형 자동 인정
 *  - fail 시 cloze(빈칸) 힌트 옵션
 *  - 전체 끝난 후 틀린 문항만 재시도 (mistake-driven re-loop)
 */
export default function LessonPractice({ items, lessonId, ttsSupported, speak, language }) {
  const [phase, setPhase] = useState('main'); // 'main' | 'review' | 'done'
  const [queue, setQueue] = useState(() => items.map((_, i) => i));
  const [queueIdx, setQueueIdx] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // null | 'pass' | 'fail'
  const [failed, setFailed] = useState(new Set());
  const [showCloze, setShowCloze] = useState(false);
  const [clozeChoice, setClozeChoice] = useState(null);
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);

  const sttSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const langCode = language === 'Japanese' ? 'ja-JP' : 'en-US';

  const total = queue.length;
  const current = items[queue[queueIdx]];

  useEffect(() => {
    if (!lessonId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
      if (Array.isArray(saved.queue) && saved.queue.length > 0) setQueue(saved.queue);
      if (typeof saved.queueIdx === 'number') setQueueIdx(saved.queueIdx);
      if (saved.phase === 'main' || saved.phase === 'review' || saved.phase === 'done') setPhase(saved.phase);
      if (Array.isArray(saved.failed)) setFailed(new Set(saved.failed));
    } catch {}
  }, [lessonId]);

  function persist(updates) {
    if (!lessonId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
      const next = { ...saved, ...updates };
      if (next.failed instanceof Set) next.failed = [...next.failed];
      localStorage.setItem(STORAGE_KEY + lessonId, JSON.stringify(next));
    } catch {}
  }

  function check() {
    if (!input.trim()) return;
    const ok = isAnswerCorrect(input, current);
    setResult(ok ? 'pass' : 'fail');
    const curIdx = queue[queueIdx];
    if (!ok && phase === 'main') {
      const n = new Set([...failed, curIdx]);
      setFailed(n);
      persist({ failed: [...n] });
    } else if (ok && phase === 'review') {
      const n = new Set(failed);
      n.delete(curIdx);
      setFailed(n);
      persist({ failed: [...n] });
    }
  }

  function nextQuestion() {
    if (queueIdx < total - 1) {
      const n = queueIdx + 1;
      setQueueIdx(n);
      setInput('');
      setResult(null);
      setShowCloze(false);
      setClozeChoice(null);
      persist({ queueIdx: n });
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setPhase('done');
      persist({ phase: 'done', done: true });
    }
  }

  function retry() {
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startReview() {
    const arr = [...failed];
    if (arr.length === 0) return;
    setQueue(arr);
    setQueueIdx(0);
    setInput('');
    setResult(null);
    setShowCloze(false);
    setClozeChoice(null);
    setPhase('review');
    persist({ phase: 'review', queue: arr, queueIdx: 0 });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function restartAll() {
    const q = items.map((_, i) => i);
    setQueue(q);
    setQueueIdx(0);
    setInput('');
    setResult(null);
    setFailed(new Set());
    setShowCloze(false);
    setClozeChoice(null);
    setPhase('main');
    persist({ phase: 'main', queue: q, queueIdx: 0, failed: [], done: false });
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
      else nextQuestion();
    }
  }

  // ── done 화면
  if (phase === 'done') {
    const passedCount = items.length - failed.size;
    return (
      <div className="lesson-practice lesson-practice--done">
        <div className="lesson-practice__done-emoji">{failed.size === 0 ? '🎉' : '👍'}</div>
        <div className="lesson-practice__done-title">
          {failed.size === 0 ? '미션 완료' : `${passedCount}/${items.length} 정답`}
        </div>
        <div className="lesson-practice__done-sub">
          {failed.size === 0
            ? '모든 문항을 통과했어요. 자기소개 한 컷 OK!'
            : `${failed.size}문항을 한 번 더 다듬으면 완벽해요.`}
        </div>
        <div className="lesson-practice__done-actions">
          {failed.size > 0 && <Button onClick={startReview}>↺ 틀린 {failed.size}개만 다시</Button>}
          <Button variant="ghost" size="sm" onClick={restartAll}>처음부터</Button>
        </div>
      </div>
    );
  }

  // ── 풀이 화면
  return (
    <div className="lesson-practice">
      <div className="lesson-practice__progress">
        <span className="lesson-practice__progress-num">
          {phase === 'review' && <span className="lesson-practice__review-tag">↺ 복습</span>}
          {queueIdx + 1} / {total}
        </span>
        <div className="lesson-practice__progress-bar">
          <div className="lesson-practice__progress-fill" style={{ width: `${(queueIdx / total) * 100}%` }} />
        </div>
      </div>

      <div className="lesson-practice__prompt">
        <div className="lesson-practice__label">아래 한국어를 일본어로 써 보세요</div>
        <div className="lesson-practice__ko">{current.ko}</div>
      </div>

      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => { setInput(e.target.value); if (result) setResult(null); }}
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
            <button
              type="button"
              className="lesson-practice__tts"
              onClick={() => speak(current.ja, language)}
              title="발음 듣기"
            >🔊</button>
          )}
        </div>
      )}

      {result === 'fail' && !showCloze && (
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
          {current.cloze && (
            <button
              type="button"
              className="btn btn--ghost btn--sm lesson-practice__hint-btn"
              onClick={() => setShowCloze(true)}
            >
              💡 힌트로 풀어 보기
            </button>
          )}
        </div>
      )}

      {result === 'fail' && showCloze && current.cloze && (
        <div className="lesson-practice__cloze">
          <div className="lesson-practice__cloze-label">💡 빈칸을 채워 보세요</div>
          <div className="lesson-practice__cloze-template" lang="ja">{current.cloze.template}</div>
          <div className="lesson-practice__cloze-options">
            {current.cloze.options.map((opt, i) => {
              const isAnswer = opt === current.cloze.answer;
              const isChoice = clozeChoice === i;
              const cls = [
                'lesson-practice__cloze-option',
                clozeChoice != null && isAnswer && 'lesson-practice__cloze-option--correct',
                clozeChoice != null && isChoice && !isAnswer && 'lesson-practice__cloze-option--wrong',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => clozeChoice == null && setClozeChoice(i)}
                  disabled={clozeChoice != null}
                  lang="ja"
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {clozeChoice != null && (
            <div className="lesson-practice__cloze-feedback">
              {current.cloze.options[clozeChoice] === current.cloze.answer
                ? '✓ 맞아요. 이제 한 줄 통째로 입에 익혀 보세요.'
                : `정답은 「${current.cloze.answer}」예요.`}
            </div>
          )}
        </div>
      )}

      <div className="lesson-practice__actions">
        {sttSupported && result === null && (
          <button
            type="button"
            onClick={startListening}
            disabled={listening}
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
            <Button onClick={nextQuestion}>{queueIdx < total - 1 ? '다음 →' : '결과 보기'}</Button>
          </>
        )}
        {result === 'pass' && (
          <Button onClick={nextQuestion}>{queueIdx < total - 1 ? '다음 →' : '결과 보기'}</Button>
        )}
      </div>
    </div>
  );
}
