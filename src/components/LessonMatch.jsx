'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from './Button';

const STORAGE_KEY = 'lesson_match:';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const ds = Math.floor((ms % 1000) / 100);
  return `${s}.${ds}초`;
}

/**
 * 단어 매칭 — 좌측 일본어 ↔ 우측 한국어.
 * 일본어 카드 클릭 시 TTS 재생 후 한국어 카드 선택. 일치하면 사라지고 다음.
 */
export default function LessonMatch({ items, lessonId, language = 'Japanese', ttsSupported, speak }) {
  const [round, setRound] = useState(0);
  const seeds = useMemo(() => ({
    left: shuffle(items.map((_, i) => i)),
    right: shuffle(items.map((_, i) => i)),
  }), [round, items]);

  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [shake, setShake] = useState(null);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [bestTime, setBestTime] = useState(null);

  useEffect(() => {
    if (!lessonId || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY + lessonId) || '{}');
      if (saved.bestTime) setBestTime(saved.bestTime);
    } catch {}
  }, [lessonId]);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(id);
  }, [startTime, done]);

  function selectJa(i) {
    if (matched.has(i)) return;
    setSelected(i);
    if (ttsSupported) speak(items[i].ja, language);
  }

  function selectKo(i) {
    if (selected == null || matched.has(i)) return;
    if (selected === i) {
      const m = new Set([...matched, i]);
      setMatched(m);
      setSelected(null);
      if (m.size === items.length) {
        const t = Date.now() - startTime;
        setDone(true);
        if (!bestTime || t < bestTime) {
          setBestTime(t);
          try { localStorage.setItem(STORAGE_KEY + lessonId, JSON.stringify({ bestTime: t })); } catch {}
        }
      }
    } else {
      setShake([selected, i]);
      setTimeout(() => { setShake(null); setSelected(null); }, 450);
    }
  }

  function restart() {
    setRound(r => r + 1);
    setSelected(null);
    setMatched(new Set());
    setShake(null);
    setStartTime(Date.now());
    setElapsed(0);
    setDone(false);
  }

  if (done) {
    return (
      <div className="lesson-match lesson-match--done">
        <div className="lesson-match__done-emoji">🎉</div>
        <div className="lesson-match__done-title">완성!</div>
        <div className="lesson-match__done-sub">
          ⏱ {fmt(elapsed)}{bestTime === elapsed && elapsed > 0 ? ' · 최고 기록!' : bestTime ? ` · 최고 ${fmt(bestTime)}` : ''}
        </div>
        <Button variant="ghost" size="sm" onClick={restart}>↺ 다시 도전</Button>
      </div>
    );
  }

  return (
    <div className="lesson-match">
      <div className="lesson-match__header">
        <span className="lesson-match__progress">{matched.size}/{items.length} 짝</span>
        <span className="lesson-match__time">⏱ {fmt(elapsed)}</span>
        {bestTime && <span className="lesson-match__best">최고 {fmt(bestTime)}</span>}
      </div>
      <div className="lesson-match__grid">
        <div className="lesson-match__col">
          {seeds.left.map(i => {
            const cls = [
              'lesson-match__card',
              'lesson-match__card--ja',
              matched.has(i) && 'lesson-match__card--matched',
              selected === i && 'lesson-match__card--selected',
              shake && shake[0] === i && 'lesson-match__card--shake',
            ].filter(Boolean).join(' ');
            return (
              <button key={`L${i}`} type="button" className={cls} onClick={() => selectJa(i)} disabled={matched.has(i)}>
                {items[i].ja}
              </button>
            );
          })}
        </div>
        <div className="lesson-match__col">
          {seeds.right.map(i => {
            const cls = [
              'lesson-match__card',
              'lesson-match__card--ko',
              matched.has(i) && 'lesson-match__card--matched',
              selected != null && !matched.has(i) && 'lesson-match__card--target',
              shake && shake[1] === i && 'lesson-match__card--shake',
            ].filter(Boolean).join(' ');
            return (
              <button
                key={`R${i}`}
                type="button"
                className={cls}
                onClick={() => selectKo(i)}
                disabled={matched.has(i) || selected == null}
              >
                {items[i].ko}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
