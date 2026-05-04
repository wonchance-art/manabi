'use client';
import { useEffect, useRef } from 'react';
import { useTTS } from '../lib/useTTS';

export default function KanaTracer({ char, onClose }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const { speak, supported } = useTTS();

  useEffect(() => {
    if (!char || !supported) return;
    const t = setTimeout(() => speak(char, 'Japanese'), 200);
    return () => clearTimeout(t);
  }, [char]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function getPos(e) {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top) * (c.height / rect.height);
    return { x, y };
  }

  function start(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = getPos(e);
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7C5CFC';
    ctx.stroke();
    last.current = pos;
  }

  function end(e) {
    drawing.current = false;
    last.current = null;
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }

  if (!char) return null;

  return (
    <div className="kana-tracer__overlay" onClick={onClose}>
      <div className="kana-tracer" onClick={e => e.stopPropagation()}>
        <button className="kana-tracer__close" onClick={onClose} aria-label="닫기">×</button>
        <div className="kana-tracer__title">따라 써보기</div>
        <div className="kana-tracer__stage">
          <div className="kana-tracer__guide" aria-hidden="true">{char}</div>
          <canvas
            ref={canvasRef}
            width={560}
            height={560}
            className="kana-tracer__canvas"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
          />
        </div>
        <div className="kana-tracer__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => supported && speak(char, 'Japanese')}>
            🔊 발음
          </button>
          <button className="btn btn--ghost btn--sm" onClick={clearCanvas}>
            ↺ 지우기
          </button>
        </div>
        <p className="kana-tracer__hint">
          옅게 보이는 글자 위에 따라 그려보세요. 회색 숫자가 획 순서예요.
        </p>
      </div>
    </div>
  );
}
