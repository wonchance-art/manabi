'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Button from './Button';
import { isAnswerCorrect } from '../lib/lessonAccepts';
import { diffChars } from '../lib/diffChars';
import { tokenizeJa } from '../lib/jaTokenize';

const STORAGE_KEY = 'lesson_practice:';
const MODE_KEY = 'lesson_practice_mode';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChipPool(ja, vocab) {
  const correct = tokenizeJa(ja, vocab);
  const correctChips = correct.map((text, idx) => ({ idx, text }));
  // distractor: vocab 중 정답에 없는 단어 최대 2개
  const usedSet = new Set(correct);
  const candidates = (vocab || [])
    .filter(v => v && v.ja && !usedSet.has(v.ja))
    .map(v => v.ja);
  const distractors = shuffle(candidates).slice(0, Math.min(2, candidates.length));
  const distractorChips = distractors.map((text, i) => ({ idx: 10000 + i, text }));
  return { correct, pool: shuffle([...correctChips, ...distractorChips]) };
}

/**
 * 한 → 일 번역 미션
 *  - 모드 keyboard / chips: IME 없어도 칩 클릭으로 풀이 가능
 *  - fail 시 cloze(빈칸) 힌트 + 입력 모드면 diff 표시
 *  - 끝난 후 틀린 문항만 재시도 (mistake-driven re-loop)
 */
export default function LessonPractice({ items, lessonId, ttsSupported, speak, language, vocab }) {
  const [phase, setPhase] = useState('main');
  const [queue, setQueue] = useState(() => items.map((_, i) => i));
  const [queueIdx, setQueueIdx] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(new Set());
  const [showCloze, setShowCloze] = useState(false);
  const [clozeChoice, setClozeChoice] = useState(null);
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState('chips');
  const [chipPool, setChipPool] = useState([]);
  const [chipPicked, setChipPicked] = useState([]);
  const [correctChips, setCorrectChips] = useState([]);
  const inputRef = useRef(null);

  const sttSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const langCode = language === 'Japanese' ? 'ja-JP' : 'en-US';

  const total = queue.length;
  const current = items[queue[queueIdx]];

  // 초기 로드 — 진척 + 모드
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (lessonId) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
        if (Array.isArray(saved.queue) && saved.queue.length > 0) setQueue(saved.queue);
        if (typeof saved.queueIdx === 'number') setQueueIdx(saved.queueIdx);
        if (saved.phase === 'main' || saved.phase === 'review' || saved.phase === 'done') setPhase(saved.phase);
        if (Array.isArray(saved.failed)) setFailed(new Set(saved.failed));
      } catch {}
    }
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === 'keyboard' || m === 'chips') setMode(m);
    } catch {}
  }, [lessonId]);

  // 문항 또는 모드 변경 시 chips 리셋
  useEffect(() => {
    if (mode !== 'chips' || !current) return;
    const { correct, pool } = buildChipPool(current.ja, vocab);
    setChipPool(pool);
    setCorrectChips(correct);
    setChipPicked([]);
  }, [queue, queueIdx, mode, current?.ja, vocab]);

  function persist(updates) {
    if (!lessonId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
      const next = { ...saved, ...updates };
      if (next.failed instanceof Set) next.failed = [...next.failed];
      localStorage.setItem(STORAGE_KEY + lessonId, JSON.stringify(next));
    } catch {}
  }

  function changeMode(m) {
    setMode(m);
    setResult(null);
    setShowCloze(false);
    setClozeChoice(null);
    try { localStorage.setItem(MODE_KEY, m); } catch {}
    if (m === 'keyboard') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function currentValue() {
    if (mode === 'chips') return chipPicked.map(c => c.text).join(' ');
    return input;
  }

  function check() {
    const value = currentValue();
    if (!value.trim()) return;
    const ok = isAnswerCorrect(value, current);
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
      if (mode === 'keyboard') setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setPhase('done');
      persist({ phase: 'done', done: true });
    }
  }

  function retry() {
    setResult(null);
    if (mode === 'chips') {
      const { correct, pool } = buildChipPool(current.ja, vocab);
      setChipPool(pool);
      setCorrectChips(correct);
      setChipPicked([]);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
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
    if (mode === 'keyboard') setTimeout(() => inputRef.current?.focus(), 50);
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
    if (mode === 'keyboard') setTimeout(() => inputRef.current?.focus(), 50);
  }

  function pickChip(c) {
    if (result === 'pass') return;
    setChipPicked(prev => [...prev, c]);
    setChipPool(prev => prev.filter(p => p.idx !== c.idx));
    if (result === 'fail') setResult(null);
  }

  function unpickChip(at) {
    if (result === 'pass') return;
    const c = chipPicked[at];
    setChipPicked(prev => prev.filter((_, i) => i !== at));
    setChipPool(prev => [...prev, c]);
    if (result === 'fail') setResult(null);
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

  // diff 계산 (keyboard 모드 + fail 시)
  const diff = useMemo(() => {
    if (mode !== 'keyboard' || result !== 'fail' || !current?.ja || !input) return null;
    return diffChars(input, current.ja);
  }, [mode, result, current?.ja, input]);

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

  return (
    <div className="lesson-practice">
      <div className="lesson-practice__mode-toggle" role="group" aria-label="입력 방식">
        <button
          type="button"
          className={`lesson-practice__mode-btn ${mode === 'chips' ? 'is-active' : ''}`}
          onClick={() => changeMode('chips')}
          aria-pressed={mode === 'chips'}
        >🧩 단어 조립</button>
        <button
          type="button"
          className={`lesson-practice__mode-btn ${mode === 'keyboard' ? 'is-active' : ''}`}
          onClick={() => changeMode('keyboard')}
          aria-pressed={mode === 'keyboard'}
        >⌨️ 직접 입력</button>
      </div>

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
        <div className="lesson-practice__label">아래 한국어를 일본어로 옮겨 보세요</div>
        <div className="lesson-practice__ko">{current.ko}</div>
      </div>

      {mode === 'chips' ? (
        <div className="lesson-practice__chips">
          <div className="lesson-practice__chips-slot" aria-label="조립 영역">
            {chipPicked.length === 0 ? (
              <span className="lesson-practice__chips-placeholder">아래 칩을 순서대로 눌러 보세요</span>
            ) : (
              chipPicked.map((c, i) => (
                <button
                  key={`${c.idx}-${i}`}
                  type="button"
                  className="lesson-practice__chip lesson-practice__chip--picked"
                  onClick={() => unpickChip(i)}
                  lang="ja"
                  title="다시 칩 풀로"
                >{c.text}</button>
              ))
            )}
          </div>
          <div className="lesson-practice__chips-pool" aria-label="칩 풀">
            {chipPool.map(c => (
              <button
                key={c.idx}
                type="button"
                className="lesson-practice__chip"
                onClick={() => pickChip(c)}
                lang="ja"
                disabled={result === 'pass'}
              >{c.text}</button>
            ))}
          </div>
        </div>
      ) : (
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
      )}

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
          {diff && (
            <div className="lesson-practice__diff">
              <div className="lesson-practice__diff-row">
                <span className="lesson-practice__diff-label">내 답</span>
                <span className="lesson-practice__diff-text" lang="ja">
                  {diff.map((s, i) => {
                    if (s.type === 'ins') return null;
                    const cls = s.type === 'del' ? 'lesson-practice__diff-char--extra' : 'lesson-practice__diff-char--eq';
                    return <span key={i} className={cls}>{s.text}</span>;
                  })}
                </span>
              </div>
              <div className="lesson-practice__diff-row">
                <span className="lesson-practice__diff-label">정답</span>
                <span
                  className="lesson-practice__diff-text"
                  lang="ja"
                  onClick={() => ttsSupported && speak(current.ja, language)}
                  role="button"
                  tabIndex={0}
                >
                  {diff.map((s, i) => {
                    if (s.type === 'del') return null;
                    const cls = s.type === 'ins' ? 'lesson-practice__diff-char--missing' : 'lesson-practice__diff-char--eq';
                    return <span key={i} className={cls}>{s.text}</span>;
                  })}
                </span>
              </div>
            </div>
          )}
          {!diff && mode !== 'chips' && (
            <div className="lesson-practice__answer">
              <span className="lesson-practice__answer-label">예시 답</span>
              <span
                className="lesson-practice__answer-ja"
                onClick={() => ttsSupported && speak(current.ja, language)}
                role="button"
                tabIndex={0}
                lang="ja"
              >
                {current.ja}
              </span>
            </div>
          )}
          {mode === 'chips' && correctChips.length > 0 && (
            <div className="lesson-practice__chip-answer">
              <div className="lesson-practice__chip-answer-label">정답 순서</div>
              <div
                className="lesson-practice__chip-answer-list"
                onClick={() => ttsSupported && speak(current.ja, language)}
                role="button"
                tabIndex={0}
              >
                {correctChips.map((t, i) => (
                  <span key={i} className="lesson-practice__chip-answer-item">
                    <span className="lesson-practice__chip-answer-num">{i + 1}</span>
                    <span lang="ja">{t}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
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
                >{opt}</button>
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
        {sttSupported && mode === 'keyboard' && result === null && (
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
          <Button onClick={check} disabled={!currentValue().trim()}>확인</Button>
        )}
        {result === 'fail' && (
          <>
            <Button variant="ghost" onClick={retry}>↺ 다시</Button>
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
