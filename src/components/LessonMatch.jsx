'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import Button from './Button';
import { fireSparkle } from '../lib/celebration';

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

function DraggableCard({ id, text, leftIsJa, isMatched, isShaking, onActivate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: isMatched });
  const cls = [
    'lesson-match__card',
    leftIsJa ? 'lesson-match__card--ja' : 'lesson-match__card--ko',
    isMatched && 'lesson-match__card--matched',
    isDragging && 'lesson-match__card--dragging',
    isShaking && 'lesson-match__card--shake',
  ].filter(Boolean).join(' ');
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cls}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e);
        onActivate?.();
      }}
      disabled={isMatched}
      aria-label={`드래그 가능: ${text}`}
    >
      {text}
    </button>
  );
}

function DroppableSlot({ id, text, isMatched, leftIsJa, isOver, isShaking }) {
  const { setNodeRef } = useDroppable({ id, disabled: isMatched });
  const cls = [
    'lesson-match__card',
    'lesson-match__card--target',
    leftIsJa ? 'lesson-match__card--ko' : 'lesson-match__card--ja',
    isMatched && 'lesson-match__card--matched',
    isOver && 'lesson-match__card--over',
    isShaking && 'lesson-match__card--shake',
  ].filter(Boolean).join(' ');
  return (
    <div
      ref={setNodeRef}
      className={cls}
      role="region"
      aria-label={`드롭 영역: ${text}`}
    >
      {text}
    </div>
  );
}

export default function LessonMatch({ items, lessonId, language = 'Japanese', ttsSupported, speak }) {
  const [round, setRound] = useState(0);
  const [direction, setDirection] = useState('ja-to-ko');
  const seeds = useMemo(() => ({
    left: shuffle(items.map((_, i) => i)),
    right: shuffle(items.map((_, i) => i)),
  }), [round, items]);

  const [matched, setMatched] = useState(new Set());
  const [shake, setShake] = useState(null);
  const [overId, setOverId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [startTime, setStartTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [bestTime, setBestTime] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const leftIsJa = direction === 'ja-to-ko';

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

  function onDragStart(e) {
    setActiveId(e.active.id);
    // 드래그 시작 시 일본어면 TTS
    const draggedIdx = e.active.id;
    if (leftIsJa && ttsSupported) {
      speak(items[draggedIdx].ja, language);
    }
  }

  function onDragOver(e) {
    setOverId(e.over?.id ?? null);
  }

  function onDragEnd(e) {
    setActiveId(null);
    setOverId(null);
    const dragIdx = e.active.id;
    const dropIdx = e.over?.id;
    if (dropIdx == null) return;
    if (dragIdx === dropIdx) {
      // 매치 — fade
      const m = new Set([...matched, dragIdx]);
      setMatched(m);
      if (!leftIsJa && ttsSupported) speak(items[dragIdx].ja, language);
      // sparkle 좌표는 drop slot 위치
      fireSparkle({ source: e.over.rect, count: 14, colors: ['accent'] });
      if (m.size === items.length) {
        const t = Date.now() - startTime;
        setDone(true);
        if (!bestTime || t < bestTime) {
          setBestTime(t);
          try { localStorage.setItem(STORAGE_KEY + lessonId, JSON.stringify({ bestTime: t })); } catch {}
        }
      }
    } else {
      setShake([dragIdx, dropIdx]);
      setTimeout(() => setShake(null), 450);
    }
  }

  function restart(flip = false) {
    setRound(r => r + 1);
    if (flip) setDirection(d => (d === 'ja-to-ko' ? 'ko-to-ja' : 'ja-to-ko'));
    setMatched(new Set());
    setShake(null);
    setStartTime(Date.now());
    setElapsed(0);
    setDone(false);
    setActiveId(null);
    setOverId(null);
  }

  if (done) {
    return (
      <div className="lesson-match lesson-match--done">
        <div className="lesson-match__done-emoji">🎉</div>
        <div className="lesson-match__done-title">완성!</div>
        <div className="lesson-match__done-sub">
          ⏱ {fmt(elapsed)}{bestTime === elapsed && elapsed > 0 ? ' · 최고 기록!' : bestTime ? ` · 최고 ${fmt(bestTime)}` : ''}
        </div>
        <div className="lesson-match__done-actions">
          <Button variant="ghost" size="sm" onClick={() => restart(false)}>↺ 다시 도전</Button>
          <Button size="sm" onClick={() => restart(true)}>↔ 반대 방향</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="lesson-match">
      <div className="lesson-match__header">
        <span className="lesson-match__progress">{matched.size}/{items.length} 짝</span>
        <span className="lesson-match__direction">{leftIsJa ? '日 → 韓' : '韓 → 日'}</span>
        <span className="lesson-match__time">⏱ {fmt(elapsed)}</span>
        {bestTime && <span className="lesson-match__best">최고 {fmt(bestTime)}</span>}
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="lesson-match__grid">
          <div className="lesson-match__col" aria-label="끌어 옮길 카드들">
            {seeds.left.map(i => (
              <DraggableCard
                key={`L${i}`}
                id={i}
                text={leftIsJa ? items[i].ja : items[i].ko}
                leftIsJa={leftIsJa}
                isMatched={matched.has(i)}
                isShaking={shake && shake[0] === i}
                onActivate={() => leftIsJa && ttsSupported && speak(items[i].ja, language)}
              />
            ))}
          </div>
          <div className="lesson-match__col" aria-label="짝을 맞출 카드들">
            {seeds.right.map(i => (
              <DroppableSlot
                key={`R${i}`}
                id={i}
                text={leftIsJa ? items[i].ko : items[i].ja}
                leftIsJa={leftIsJa}
                isMatched={matched.has(i)}
                isOver={overId === i}
                isShaking={shake && shake[1] === i}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeId != null ? (
            <div className="lesson-match__card lesson-match__card--ghost">
              {leftIsJa ? items[activeId].ja : items[activeId].ko}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
