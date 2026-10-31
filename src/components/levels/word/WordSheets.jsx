'use client';
// 제목 ▾ 시트 · 단어 카드 창 · 예문 단어 창 — 뷰어 시트와 같은 움직임(viewerSheetUp · 손잡이를 아래로 끌면 닫힘).
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/reducedMotion';
import { pinyinToneNumber } from '@/lib/pinyinTone';
import { hanjaPanelModel, normalizePinyin, selectSameHanjaTiles, splitPinyinSyllables } from '@/lib/viewerHanjaPanel';
import { jaKanjiReadingRows, kanaPerChar, loadJaReadingTables } from '@/lib/jaKanjiReadingRows';
import { CharTiles, WordRow } from './WordParts';
import { useWordLang } from './wordLang';
import { LEVEL_STUDY_AMOUNTS, LEVEL_STUDY_ORDERS } from '@/lib/levelWordPrefs';

const CLOSE_DRAG_PX = 80;
const JA_MIN_BELOW = 200; // 읽기 표 창을 아래에 둘 최소 높이(머리 + 읽기 약 3줄)

/**
 * 닫힘 움직임 — 닫기를 부르면 ms 동안 「닫히는 중」으로 두었다가 onClose(열릴 때만 움직이고 닫힐 때 뚝 사라지던 것, 오너 2026-10-21 KST ⑥-1).
 * 동작 줄이기면 바로 닫는다. 타이머라 animationend가 안 와도(숨은 탭) 닫히고, 먼저 지워지면 정리된다.
 */
function useClosing(onClose, ms) {
  const [closing, setClosing] = useState(false);
  const latest = useRef(onClose);
  latest.current = onClose;
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = useCallback(() => {
    if (timer.current) return;
    if (reducedMotion()) { latest.current(); return; }
    setClosing(true);
    timer.current = setTimeout(() => latest.current(), ms);
  }, [ms]);
  return [closing, close];
}

/** 아래 시트 — Esc · 뒷배경 · 손잡이 끌기로 닫힌다. 열리면 첫 조작 요소에 초점, 닫히면 연 자리로 돌려준다. */
export function Sheet({ label, onClose, children, returnTo = null }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dy, setDy] = useState(0);
  const [closing, close] = useClosing(onClose, 200);
  useLayoutEffect(() => {
    const opener = returnTo || document.activeElement; // 예문 단어 창에서 열면 창은 이미 사라졌다 — 누른 예문 단어로 돌려준다
    ref.current?.querySelector('a, button:not(.lw-sheet__handle), input, select')?.focus({ preventScroll: true });
    return () => { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 열릴 때 한 번(돌려줄 자리는 그때 정해진다)
  useEffect(() => {
    const onKey = (event) => {
      if (document.querySelector('.lw-dp')) return; // 시트 안 조각 창이 열려 있으면 Esc · Tab은 그 창 몫(창이 먼저 닫힌다)
      if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
      // aria-modal — Tab이 뒤의 네 칸(화면 아래 고정)으로 새지 않게 시트 안에서 돈다(ClassCopyNotice와 같은 방식).
      if (event.key !== 'Tab' || !ref.current) return;
      const nodes = [...ref.current.querySelectorAll('button:not(:disabled), [href], input, select')];
      const first = nodes[0], last = nodes.at(-1), inside = ref.current.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (!inside || document.activeElement === last)) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close]);
  const down = (event) => { drag.current = { y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture?.(event.pointerId); };
  const move = (event) => { if (drag.current?.id === event.pointerId) setDy(Math.max(0, event.clientY - drag.current.y)); };
  const up = (event) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (dy > CLOSE_DRAG_PX) close(); else setDy(0);
  };
  return <>
    <div className={`lw-scrim${closing ? ' is-closing' : ''}`} onClick={close} aria-hidden="true" />
    {/* 닫히는 중에는 끌던 자리(--dy)에서 아래로 내려간다. */}
    <div className={`lw-sheet${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label={label} ref={ref}
      style={closing ? { '--dy': `${dy}px` } : dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : reducedMotion() ? undefined : { transition: 'transform .2s var(--ease-settle)' }}>
      <button type="button" className="lw-sheet__handle" aria-label="닫기" onClick={close}
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
        : <button key={it.id} type="button" aria-pressed={it.id === value} aria-label={it.aria} data-sym={it.sym || undefined} onClick={() => onPick(it.id)}>{it.label}</button>))}
    </div></div>;
}

/**
 * 제목 ▾ 시트 — 레벨 · 목록 | 순서 · 분량 · 세부(오너 2026-10-21 KST 「두 곳」 안: 페이지 줄 = 지금 공부하는 방식, 제목 = 나머지 전부 ·
 * 학습 옵션 LEVEL-STUDY-OPTIONS-001, 오너 2026-10-31 KST 시안 4차 · 단순화). 모드 · 보기 탭은 페이지 줄에만 둔다(시트에 또 두면 겹친다).
 * 목록은 그 레벨에 있는 것만(한자 1 · 2급, 7–9급은 단어뿐이라 줄 없음). 찾아가기(레벨 · 목록)와 오늘 공부(순서 · 분량 · 세부)는 묶음 제목 없이 가는 선 하나로 나눈다.
 * 이름표는 모두 두 글자(40px 열 그대로) · 고르는 줄은 모두 세 칸이라 칸 경계가 목록 줄과 같은 세로선에 선다. 예전 「보기」 줄(도움 스위치 · 리스트 한 번에)은 없앴다(고정 기본값).
 */
export function TitleSheet({ levels, levelKey, kinds, prefs, onPrefs, onClose }) {
  const L = useWordLang();
  return <Sheet label="레벨 · 목록 · 학습 옵션" onClose={onClose}>
    <div className="lw-sheet__rows">
      <Seg label="레벨" value={levelKey} items={levels.map((k) => ({ id: k, label: L.levelPill(k), aria: L.tag(L.levelOf(k)), href: L.levelHref(k) }))} />
      {kinds.length > 1 && <Seg label="목록" value="vocab" items={kinds} />}
      <div className="lw-sheet__sep" role="presentation" />
      <Seg label="순서" value={prefs.order} items={LEVEL_STUDY_ORDERS} onPick={(order) => onPrefs({ order })} />
      <Seg label="분량" value={prefs.amount} items={LEVEL_STUDY_AMOUNTS} onPick={(amount) => onPrefs({ amount })} />
    </div>
  </Sheet>;
}

/** 예문 단어 창 — 누른 단어 바로 아래(넘치면 위)에 줄 형식 + 글자 칸 + 「단어 카드 열기 ›」. */
export function WordPopup({ anchor, row, tiles, tone, status, onSave, onOpen, onClose }) {
  const ref = useRef(null);
  const [closing, close] = useClosing(onClose, 120);
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
  // 창은 문서 끝에 그려진다 — 열리면 창 안 첫 단추로, 닫히면 누른 예문 단어로 초점을 옮겨 키보드로도 ☆ · 카드 열기에 닿는다.
  useEffect(() => {
    const el = ref.current;
    el?.querySelector('button')?.focus({ preventScroll: true });
    return () => {
      const at = document.activeElement;
      if (anchor && document.contains(anchor) && (!at || at === document.body || el?.contains(at))) anchor.focus({ preventScroll: true });
    };
  }, [anchor]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    const onDown = (event) => { if (!ref.current?.contains(event.target) && event.target !== anchor) close(); };
    const onScroll = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, { passive: true, once: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('scroll', onScroll); };
  }, [anchor, close]);
  return <div className={`lw-pop${closing ? ' is-closing' : ''}`} role="dialog" aria-label={`${row.word} 단어`} ref={ref} style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
    <WordRow word={row.word} reading={row.reading} meaning={row.meaning || '사전에 없는 단어예요'} level={row.level} status={status} onSave={onSave} tone={tone} />
    <CharTiles tiles={tiles} small />
    {onOpen && <button type="button" className="lw-pop__open" onClick={onOpen}>단어 카드 열기 ›</button>}
  </div>;
}

const toneCls = (on, syl) => (on && syl ? `lw-tone--${pinyinToneNumber(syl) ?? 0}` : undefined);
const CloseIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/**
 * JLPT 글자 창의 읽기 표 — [음 · 훈 | 읽기 | 단어 두 칸]. 읽기와 단어 사이 세로선, 음과 훈 사이 진한 가로선, 지금 단어의 읽기 줄은 장미색.
 * 단어 칸 너비는 그 칸에서 가장 긴 단어에 맞추고(창 전체가 한 격자 · subgrid), 후리가나는 한자 덩어리 위 가운데,
 * 모든 단어가 후리가나 자리를 비워 두어 단어 줄과 뜻 줄이 칸마다 같은 높이에 선다. JLPT 단어가 없는 읽기는 낮은 흐린 줄.
 */
export function JaReadingTable({ ch, model, failed }) {
  const L = useWordLang();
  if (failed) return <p className="lw-dp__note">읽기 자료를 불러오지 못했어요</p>;
  if (!model) return <div className="lw-rd is-empty" aria-hidden="true" />;
  const firstKun = model.rows.findIndex((r) => r.type === 'kun');
  const mark = (text) => [...text].map((c, i) => (c === ch ? <em key={i}>{c}</em> : c));
  return <div className="lw-rd" lang={L.hw}>
    {model.rows.map((r, i) => <div key={`${r.type}${r.stem}${r.okuri}`}
      className={['lw-rd__row', r.current && 'is-current', i > 0 && i === firstKun && 'is-kun', !r.words.length && 'is-empty', r.rare && 'is-rare'].filter(Boolean).join(' ')}>
      <span className="lw-rd__lab" lang="ko">{i === 0 || i === firstKun ? (r.type === 'on' ? '음' : '훈') : ''}</span>
      <span className="lw-rd__r">{r.stem}{r.okuri && <i>({r.okuri})</i>}</span>
      {[0, 1].map((j) => {
        const w = r.words[j];
        if (!w) return <span key={j} className="lw-rd__w" />;
        return <span key={j} className="lw-rd__w">
          <span className="lw-rd__b">{w.runs.map((u, k) => (u.r
            ? <span key={k} className="lw-rd__k">{mark(u.t)}<span className="lw-rd__f">{u.r}</span></span> : <span key={k}>{mark(u.t)}</span>))}</span>
          {w.meaning && <span className="lw-rd__m" lang="ko">{w.meaning}</span>}
        </span>;
      })}
    </div>)}
  </div>;
}

/**
 * 글자 창(오너 2026-10-25 KST — 글자 칸의 큰 한자를 누름, HSK 판). 뷰어 한자 창(ViewerHanjaPopover)의 글자 화면과 같은 자료 ·
 * 같은 규격(높이 170 · 너비 min(346, 화면 − 32))이고, 놓는 일은 예문 단어 창(WordPopup)을 따른다 — 누른 칸 바로 아래(넘치면 위).
 * Esc · 바깥 누르기 · 칸이 화면 밖으로 나가면 닫히고, 열리면 창으로 · 닫히면 누른 글자로 초점. 표시만 한다(저장 · 복습 기록 0).
 * 머리(글자 · 이 단어 속 병음 · 훈음) · 구성(누르지 않는다) · 같은 한자 단어 3칸(내 단어 먼저 · HSK 1–9 색인, 못 받으면 이 레벨 목록 —
 * 지금 단어는 뺀다). req = { ch, word, index } — 병음은 색인의 그 단어 병음에서 그 자리 음절, 없으면 표의 대표 병음.
 * tables = 글자 칸 표 네 벌(받는 중이면 빈 창 — aria-busy).
 * 머리에 正 꼴은 없다 — 글자 칸에 이미 나와 있다(오너 2026-10-26 KST 「본 단어에 들어가는 한자만」).
 * JLPT 판(mode 'ja')은 같은 창 · 같은 머리에 구성 · 같은 한자 단어 대신 음 · 훈 읽기 표(JaReadingTable, 오너 2026-10-25 KST 시안 ⑧).
 * 읽기 표는 높이가 내용만큼 자라고(채점 바 위까지), 넘치면 창 안에서 넘긴다.
 */
export function PiecePopup({ req, tables, refIndex, savedRows, tone, onClose }) {
  const L = useWordLang();
  const ref = useRef(null);
  const [closing, close] = useClosing(onClose, 120);
  const [pos, setPos] = useState(null);
  const { anchor } = req;
  const ready = !!tables && typeof tables === 'object';
  // 자리 — 누른 칸 아래 8px(넘치면 위, 아래 끝은 채점 바 위), 좌우는 글자 칸 줄 가운데. 스크롤하면 칸을 따라가고, 칸이 화면 밖으로 나가면 닫는다
  // (예문 단어 창처럼 스크롤 한 번에 닫으면 누르는 순간의 관성 스크롤에도 닫혔다 — 실화면 캡처 2026-10-23 KST).
  const place = useCallback(() => {
    const tile = anchor?.closest?.('.lw-tile') || anchor;
    const r = tile?.getBoundingClientRect?.();
    const list = (anchor?.closest?.('.lw-tiles') || tile)?.getBoundingClientRect?.();
    const el = ref.current;
    if (!r || !el) return false;
    const bar = [...document.querySelectorAll('.lw-gradebar')].find((b) => b.getClientRects().length)?.getBoundingClientRect().top;
    const floor = Math.min(window.innerHeight, bar ?? Infinity) - 8;
    if (r.bottom < 0 || r.top > floor) return false;
    // 읽기 표(JLPT)는 높이가 내용만큼 — 아래에 다 들어가거나 아래 자리가 JA_MIN_BELOW 이상이면 아래(넘치면 그 높이까지 · 표 안에서 넘김),
    // 아니면 위에 다 들어가면 위, 둘 다 모자라면 넓은 쪽. 지금 단어(카드 머리)를 덮지 않으려고 아래를 먼저 쓴다.
    let below = null;
    if (el.classList.contains('lw-dp--ja')) {
      el.style.maxHeight = '';
      const natural = el.offsetHeight, room = floor - (r.bottom + 8), above = r.top - 8 - 16;
      if (natural <= room || room >= JA_MIN_BELOW) { below = true; if (natural > room) el.style.maxHeight = `${room}px`; }
      else if (natural <= above) below = false;
      else { below = room >= above; el.style.maxHeight = `${Math.max(room, above)}px`; }
    }
    const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth;
    const left = Math.min(Math.max(16, list.left + list.width / 2 - w / 2), vw - w - 16);
    const top = below === true ? r.bottom + 8 : below === false ? Math.max(16, r.top - h - 8)
      : r.bottom + 8 + h > floor ? Math.max(16, r.top - h - 8) : r.bottom + 8;
    setPos((cur) => (cur && Math.abs(cur.left - left) < 0.5 && Math.abs(cur.top - top) < 0.5 ? cur : { left, top }));
    return true;
  }, [anchor]);
  useLayoutEffect(() => { place(); }, [place]);
  useEffect(() => {
    anchor?.setAttribute('aria-expanded', 'true');
    ref.current?.focus({ preventScroll: true });
    const el = ref.current;
    return () => {
      anchor?.removeAttribute('aria-expanded');
      const at = document.activeElement;
      if (anchor && document.contains(anchor) && (!at || at === document.body || el?.contains(at))) anchor.focus({ preventScroll: true });
    };
  }, [anchor]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    const onDown = (event) => { if (!ref.current?.contains(event.target) && !anchor?.contains(event.target)) close(); };
    let frame = 0;
    const onMove = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (!place()) close(); }); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onMove, { passive: true, capture: true });
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onMove, { capture: true }); window.removeEventListener('resize', onMove);
    };
  }, [anchor, close, place]);

  const ja = L.mode === 'ja';
  const reading = useMemo(() => {
    const chars = [...String(req.word || '')];
    if (!Number.isInteger(req.index) || chars[req.index] !== req.ch) return null;
    if (ja) return kanaPerChar(req.word, refIndex?.get?.(req.word)?.kr)?.[req.index] || null;
    const sylls = splitPinyinSyllables(refIndex?.get?.(req.word)?.word?.pinyin, chars.length, { erhua: chars[chars.length - 1] === '儿' });
    return sylls?.[req.index] || null;
  }, [req.word, req.index, req.ch, refIndex, ja]);
  // JLPT는 훈음만 — 한국 정자 꼴로 찾는다(経 → 經 날 경). 읽기 표는 창을 처음 열 때 받는다.
  const model = useMemo(() => {
    if (!ready) return null;
    if (ja) return hanjaPanelModel({ ch: tables.jeongja?.[req.ch] || req.ch, index: null, word: '', reading: null, tables });
    return hanjaPanelModel({ ch: req.ch, index: req.index, word: req.word || '', reading, tables });
  }, [ready, ja, req.ch, req.index, req.word, reading, tables]);
  const [jaTables, setJaTables] = useState(null);
  useEffect(() => {
    if (!ja) return undefined;
    let live = true;
    loadJaReadingTables().then((t) => { if (live) setJaTables(t); }, () => { if (live) setJaTables(false); });
    return () => { live = false; };
  }, [ja]);
  const jaRows = useMemo(() => (ja && jaTables ? jaKanjiReadingRows({ ch: req.ch, word: req.word || '', index: req.index,
    kr: refIndex?.get?.(req.word)?.kr, savedRows, refIndex, tables: jaTables }) : null), [ja, jaTables, req.ch, req.word, req.index, refIndex, savedRows]);
  useLayoutEffect(() => { if (ja) place(); }, [ja, jaRows, place]);
  const headReading = model ? (ja ? reading : model.head.reading || tables.panel?.py?.[req.ch] || null) : null;
  const words = useMemo(() => (headReading && !ja
    ? selectSameHanjaTiles({ ch: req.ch, reading: headReading, headText: req.word || '', index: req.index, savedRows, refIndex, tables }) : []),
  [headReading, ja, req.ch, req.word, req.index, savedRows, refIndex, tables]);

  const py = (text) => (!text ? null : ja ? <span className="lw-dp__py" lang={L.hw}>{text}</span>
    : <span className={['lw-dp__py', toneCls(tone, text)].filter(Boolean).join(' ')}>{normalizePinyin(text)}</span>);

  let body = null;
  if (model) {
    const ps = model.parts;
    body = <>
      <div className="lw-dp__head">
        <b className="lw-dp__ch" lang={L.hw}>{req.ch}</b>
        {py(headReading)}
        {model.head.label && <span className="lw-dp__hun">{model.head.label}</span>}
      </div>
      {ja ? <JaReadingTable ch={req.ch} model={jaRows} failed={jaTables === false} />
        : <>{ps ? <div className={`lw-dp__parts${ps.known ? '' : ' is-unknown'}`} style={{ '--n': ps.pieces.length }}>
        {ps.pieces.map((p, i) => <span key={`${p.ch}${i}`} className="lw-dp__piece">
          <b lang={L.zheng}>{p.ch}</b><span className="lw-dp__pl">{p.label || ''}</span>
        </span>)}
      </div> : <div className="lw-dp__parts is-empty" aria-hidden="true" />}
      {words.length ? <div className="lw-dp__words">{words.map((t) => <div key={t.word} className={`lw-dp__tile${t.dim ? ' is-dim' : ''}`}>
        <span className="lw-dp__tzh" lang={L.hw}>{[...t.word].map((c, i) => (i === t.at ? <em key={i}>{c}</em> : <span key={i}>{c}</span>))}</span>
        <span className="lw-dp__tpy">{t.syllables.map((y, i) => <span key={i} className={toneCls(tone, y)}>{y}</span>)}</span>
        {t.ko ? <span className="lw-dp__tko">{t.koSylls.map((y, i) => (i === t.at ? <em key={i}>{y}</em> : <span key={i}>{y}</span>))}</span>
          : <span className="lw-dp__tko is-short">{t.short}</span>}
      </div>)}</div> : <div className="lw-dp__words is-empty" aria-hidden="true" />}</>}
    </>;
  } else if (tables === false) {
    body = <p className="lw-dp__note">글자 자료를 불러오지 못했어요</p>;
  }
  return <div className={`lw-dp${ja ? ' lw-dp--ja' : ''}${closing ? ' is-closing' : ''}`} role="dialog" aria-modal="false" aria-label={`${req.ch} 글자`} tabIndex={-1} ref={ref}
    aria-busy={tables === 'loading' || tables === null || (ja && jaTables === null) || undefined}
    style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}>
    {body}
    <button type="button" className="lw-dp__close" aria-label="닫기" title="닫기" onClick={close}><CloseIcon /></button>
  </div>;
}
