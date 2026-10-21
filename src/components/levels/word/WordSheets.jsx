'use client';
// 제목 ▾ 시트 · 단어 카드 창 · 예문 단어 창 — 뷰어 시트와 같은 움직임(viewerSheetUp · 손잡이를 아래로 끌면 닫힘).
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/reducedMotion';
import { CharTiles, WordRow } from './WordParts';
import { useWordLang } from './wordLang';

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

/**
 * 제목 ▾ 시트 — 레벨 · 목록 · 보기(오너 2026-10-21 KST 「두 곳」 안: 페이지 줄 = 지금 공부하는 방식, 제목 = 나머지 전부).
 * 모드 · 보기 탭은 페이지 줄에만 둔다(시트에 또 두면 겹친다). 목록은 그 레벨에 있는 것만(한자 1 · 2급, 7–9급은 단어뿐이라 줄 없음).
 */
export function TitleSheet({ levels, levelKey, kinds, aidLabel, aid, page, pageSizes, onAid, onPage, onClose }) {
  const L = useWordLang();
  return <Sheet label="레벨 · 목록 · 보기" onClose={onClose}>
    <div className="lw-sheet__rows">
      <Seg label="레벨" value={levelKey} items={levels.map((k) => ({ id: k, label: L.levelPill(k), aria: L.tag(L.levelOf(k)), href: L.levelHref(k) }))} />
      {kinds.length > 1 && <Seg label="목록" value="vocab" items={kinds} />}
      <div className="lw-sheet__row lw-sheet__row--top"><span>보기</span>
        <div className="lw-sheet__view">
          <button type="button" role="switch" className="lw-switch" aria-checked={aid} onClick={() => onAid(!aid)}>{aidLabel}<i aria-hidden="true" /></button>
          <div className="lw-sheet__page"><span id="lw-page-size">리스트 한 번에</span>
            <span className="lw-mini" role="group" aria-labelledby="lw-page-size">
              {pageSizes.map((n) => <button key={n} type="button" aria-pressed={page === n} onClick={() => onPage(n)}>{n}</button>)}
            </span></div>
        </div></div>
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
