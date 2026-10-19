'use client';
// 제목 ▾ 시트 · 단어 카드 창 · 예문 단어 창 — 뷰어 시트와 같은 움직임(viewerSheetUp · 손잡이를 아래로 끌면 닫힘).
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/reducedMotion';
import { CharTiles, WordRow } from './WordParts';

const CLOSE_DRAG_PX = 80;

/** 아래 시트 — Esc · 뒷배경 · 손잡이 끌기로 닫힌다. 열리면 첫 조작 요소에 초점, 닫히면 연 자리로 돌려준다. */
export function Sheet({ label, onClose, children }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dy, setDy] = useState(0);
  useLayoutEffect(() => {
    const opener = document.activeElement;
    ref.current?.querySelector('a, button:not(.lw-sheet__handle), input, select')?.focus({ preventScroll: true });
    return () => { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  const down = (event) => { drag.current = { y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture?.(event.pointerId); };
  const move = (event) => { if (drag.current?.id === event.pointerId) setDy(Math.max(0, event.clientY - drag.current.y)); };
  const up = (event) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (dy > CLOSE_DRAG_PX) onClose(); else setDy(0);
  };
  return <>
    <div className="lw-scrim" onClick={onClose} aria-hidden="true" />
    <div className="lw-sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref}
      style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : reducedMotion() ? undefined : { transition: 'transform .2s var(--ease-settle)' }}>
      <button type="button" className="lw-sheet__handle" aria-label="닫기" onClick={onClose}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {children}
    </div>
  </>;
}

function Seg({ label, items, value, onPick }) {
  return <div className="lw-sheet__row"><span id={`lw-seg-${label}`}>{label}</span>
    <div className="lw-seg" role="group" aria-labelledby={`lw-seg-${label}`} style={{ '--n': items.length }}>
      {items.map((it) => (it.href
        ? <Link key={it.id} href={it.href} aria-current={it.id === value ? 'page' : undefined} aria-label={it.aria || it.label}>{it.label}</Link>
        : <button key={it.id} type="button" aria-pressed={it.id === value} onClick={() => onPick(it.id)}>{it.label}</button>))}
    </div></div>;
}

/** 제목 ▾ 시트 — 레벨 · 모드 · 보기 · 범위 네 줄의 분할 단추(제목 · ✕ 없음). */
export function TitleSheet({ levels, levelKey, mode, view, range, views, ranges, links, onMode, onView, onRange, onClose }) {
  return <Sheet label="보기 설정" onClose={onClose}>
    <div className="lw-sheet__rows">
      <Seg label="레벨" value={levelKey} items={levels.map((k) => ({ id: k, label: k.slice(1), aria: `HSK ${k.slice(1)}`, href: `/chinese/vocab/${k.toLowerCase()}` }))} />
      <Seg label="모드" value={mode} onPick={onMode} items={[{ id: 'one', label: '한 단어' }, { id: 'list', label: '리스트' }]} />
      <Seg label="보기" value={view} onPick={onView} items={views} />
      <Seg label="범위" value={range} onPick={onRange} items={ranges.map((r) => ({ id: r, label: r }))} />
      {links?.length > 0 && <div className="lw-sheet__links">{links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}</div>}
    </div>
  </Sheet>;
}

/** 예문 단어 창 — 누른 단어 바로 아래(넘치면 위)에 줄 형식 + 글자 칸 + 「단어 카드 열기 ›」. */
export function WordPopup({ anchor, row, tiles, tone, status, onSave, onOpen, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect?.();
    const el = ref.current;
    if (!r || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), vw - w - 16);
    const top = r.bottom + 8 + h > vh - 16 ? Math.max(16, r.top - h - 8) : r.bottom + 8;
    setPos({ left, top });
  }, [anchor, row]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    const onDown = (event) => { if (!ref.current?.contains(event.target) && event.target !== anchor) onClose(); };
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, { passive: true, once: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('scroll', onScroll); };
  }, [anchor, onClose]);
  return <div className="lw-pop" role="dialog" aria-label={`${row.word} 단어`} ref={ref} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
    <WordRow word={row.word} reading={row.reading} meaning={row.meaning || '사전에 없는 단어예요'} level={row.level} status={status} onSave={onSave} tone={tone} />
    <CharTiles tiles={tiles} small />
    {onOpen && <button type="button" className="lw-pop__open" onClick={onOpen}>단어 카드 열기 ›</button>}
  </div>;
}
