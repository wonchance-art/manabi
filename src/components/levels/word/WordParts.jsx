'use client';
// 단어 페이지 부품(오너 확정 2026-10-19 KST · 문서 「단어 설명 형식」) — 한 단어 모드 · 리스트 · 찾기 · 예문 창이 같이 쓴다.
// HSK · JLPT 두 판이 같이 쓴다: 표제어 lang · 태그 · 읽기 줄(병음 · 가나)은 판(useWordLang)에서 받는다.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { reducedMotion } from '@/lib/reducedMotion';
import { SAVE_GRADES } from '@/lib/vocabIO';
import { LEVEL_WORD_STATUS } from '@/lib/levelWordStatus';
import { useWordLang } from './wordLang';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true };
export const SpeakerIcon = () => <svg {...svg} width={20} height={20} strokeWidth={1.6}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
export const SearchIcon = ({ size = 24 }) => <svg {...svg} width={size} height={size} strokeWidth={1.7}><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-5-5" /></svg>;
// 해 모양 설정(문서 「상단바 한 줄」) — 상자 없는 24px.
export const BackIcon = () => <svg {...svg} width={24} height={24} strokeWidth={1.8}><path d="m15 5-7 7 7 7" /></svg>;
export const ClearIcon = () => <svg {...svg} width={20} height={20} strokeWidth={1.8}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const CaretIcon = () => <svg {...svg} width={16} height={16} strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>;

/** 읽기 줄 — 판의 Reading(HSK 병음 성조 색 · JLPT 가나). 읽기가 없거나 표제어와 같으면(メモ) 그리지 않는다. */
export function Reading({ text, word, tone = true }) {
  const L = useWordLang();
  if (!text || text === word) return null;
  return <L.Reading text={text} word={word} tone={tone} />;
}

/** 남은 시간 글자 — 1분 미만 초 · 1시간 미만 분(올림) · 그 밖 시간. 0 이하면 null. */
export function waitLabel(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}초 뒤`;
  if (sec < 3600) return `${Math.ceil(sec / 60)}분 뒤`;
  return `${Math.round(sec / 3600)}시간 뒤`;
}

/** 기다리는 카드의 남은 시간(오늘 할 줄 ③) — 스스로 1초마다 줄어든다(목록 전체를 다시 그리지 않게). 배경 없는 회색 글자. */
export function WaitChip({ at }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const label = waitLabel(at - now);
  return <span className="lw-time" role="timer" aria-label={label ? `${label} 다시` : '곧 다시'}>{label || '곧'}</span>;
}

export function LevelTag({ level }) {
  return <span className="lw-tag">{useWordLang().tag(level)}</span>;
}

/** 듣기 — 44px 누르는 자리. 소리를 못 내는 기기면 그리지 않는다. */
export function Listen({ speak, text, label = '듣기', className = 'lw-listen' }) {
  if (!speak) return null;
  return <button type="button" className={className} aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); speak(text); }}><SpeakerIcon /></button>;
}

/**
 * 상태 칸(44px) — ☆(누르면 바로 담기) · 오늘 · 복습 · 졸업. 글자는 두 글자 이내, 화면 읽기에는 온전한 말.
 * pop = 막 담김(☆ → 오늘) — 한 번 튀어오름(vocabCounterPop).
 */
export function StatusPill({ status, onSave, busy = false, pop = false, saveLabel = '단어장에 담기' }) {
  if (!status) return <i className="lw-status" aria-hidden="true" />; // 단어장을 받기 전 — 자리만(☆가 먼저 보였다 바뀌지 않게)
  const s = LEVEL_WORD_STATUS[status] || LEVEL_WORD_STATUS.new;
  if (s.id === 'new') {
    return <button type="button" className="lw-status lw-status--new" aria-label={busy ? '담는 중' : saveLabel} title="담기"
      aria-busy={busy || undefined} onClick={(e) => { e.stopPropagation(); if (!busy) onSave?.(); }}>{s.short}</button>;
  }
  return <span className={`lw-status lw-status--${s.id}${pop ? ' is-popping' : ''}`} role="img" aria-label={s.label}>{s.short}</span>;
}

/**
 * 네 칸 — 등급 이름 + 다음 간격(굵은 색 글자). 칸 안 숫자는 표시하지 않고 키 1–4는 화면이 받는다.
 * previews = gradePreviews 결과(null이면 지금은 채점할 수 없음 — note가 그 이유).
 */
/**
 * 마우스 · 손가락으로 누른 채점 단추는 초점을 놓는다 — 남아 있으면 다음 카드에서 Space(정답 확인)가 그 단추를 다시 눌러
 * 보지도 않은 카드를 채점한다. 키보드로 누른 것(detail 0)은 초점을 그대로 둔다(Tab으로 고른 자리).
 */
export const releasePointerFocus = (event) => { if (event.detail > 0) event.currentTarget.blur(); };

export function GradeButtons({ previews, onGrade, disabled = false, note = null, className = '' }) {
  return <div className={`lw-grades ${className}`} role="group" aria-label="얼마나 기억났나요">
    {SAVE_GRADES.map((g) => {
      const p = previews?.[g.grade];
      return <button key={g.grade} type="button" className={`lw-grade lw-grade--${g.cls}`} disabled={disabled || !previews}
        aria-keyshortcuts={g.key} aria-label={p?.label ? `${g.label}, ${p.label === '오늘' ? '오늘 다시' : `${p.label} 뒤`}` : g.label}
        onClick={(e) => { e.stopPropagation(); releasePointerFocus(e); onGrade(g.grade); }}>
        <span className="lw-grade__name">{g.label}</span>
        <b className="lw-grade__gap">{p?.label || ' '}</b>
      </button>;
    })}
    {note && <p className="lw-grades__note">{note}</p>}
  </div>;
}

/**
 * 조각 파고들기(오너 10-23 「안1로」 — HSK 판만) — 화면이 주면 역할이 확인된 조각에 「뜻」 · 「음」을 붙이고,
 * 더 쪼갤 것이 있는 조각(open)은 「뜻 ›」 · 「음 ›」 단추가 된다. onPiece({ kind, ch, of }, 누른 단추) — kind 'char'(뜻 조각 → 그 글자) · 'sound'(음 조각 → 같은 소리 글자).
 * 펼침 표시(aria-expanded)는 창(PiecePopup)이 열린 동안 그 단추에 단다. 없으면(JLPT · 예문 단어 창의 작은 칸) 지금처럼 글자 · 훈음만.
 */
export const PieceDrillContext = createContext(null);
export const PIECE_ROLE_WORD = Object.freeze({ meaning: '뜻', sound: '음' });

function TilePiece({ piece: p, tile, more, drill }) {
  const L = useWordLang();
  const glyph = <span className="lw-tile__pch" lang={L.piece}>{p.ch}</span>;
  if (!drill || !p.role) return <span className="lw-tile__piece">{glyph}{p.label}{more ? ' …' : ''}</span>;
  const word = PIECE_ROLE_WORD[p.role];
  const inner = <>{glyph}<span className="lw-tile__pl">{p.label}</span><i className="lw-tile__role">{word}{p.open && <span aria-hidden="true"> ›</span>}</i></>;
  const cls = `lw-tile__piece is-${p.role}`;
  if (!p.open) return <span className={cls}>{inner}</span>;
  return <button type="button" className={cls} aria-haspopup="dialog" aria-label={`${p.ch} ${p.label}, ${word} 조각`}
    onClick={(e) => { e.stopPropagation(); drill.onPiece({ kind: p.role === 'sound' ? 'sound' : 'char', ch: p.open, of: tile.zheng || tile.ch }, e.currentTarget); }}>{inner}</button>;
}

/**
 * 글자 칸 — 왼쪽 글자(HSK 간체 · JLPT 신자체, 정체 · 한국 정자가 다르면 아래 회색 같은 크기), 오른쪽 첫 줄 훈음(굵게)
 * (JLPT는 그 뒤 이 단어 속 읽기 — 経 날 경 けい) · 그 아래 구성 조각 한 줄에 하나.
 * tiles = levelCharTiles 결과. 표가 아직 없으면 null → 그리지 않는다. small(예문 단어 창)은 파고들기 없이.
 */
export function CharTiles({ tiles, small = false }) {
  const L = useWordLang();
  const ctx = useContext(PieceDrillContext);
  const drill = small ? null : ctx;
  if (!tiles?.length) return null;
  return <ul className={`lw-tiles${small ? ' lw-tiles--small' : ''}`} aria-label="글자">
    {tiles.map((t, i) => <li key={`${t.ch}${i}`} className="lw-tile">
      <span className="lw-tile__glyph" lang={L.hw}>{t.ch}{t.zheng && t.zheng !== t.ch && <span className="lw-tile__zheng" lang={L.zheng}>{t.zheng}</span>}</span>
      <span className="lw-tile__info">
        <span className="lw-tile__hun"><b>{t.label || ' '}</b>{t.kana && <span className="lw-tile__kana" lang={L.hw}>{t.kana}</span>}</span>
        {t.pieces.slice(0, 2).map((p, j) => <TilePiece key={j} piece={p} tile={t} more={j === 1 && t.pieces.length > 2} drill={drill} />)}
      </span>
    </li>)}
  </ul>;
}

/**
 * 줄 형식 — 단어 + 병음 / 뜻 한 줄 · HSK 태그(52px) · 상태 칸(44px). 찾기 결과 · 예문 단어 창이 같이 쓴다.
 */
export function WordRow({ word, reading, meaning, level, status, onSave, onOpen, tone = true, saving = false, pop = false, current = false }) {
  const L = useWordLang();
  const body = <>
    <span className="lw-row__head"><span className="lw-row__word" lang={L.hw}>{word}</span><Reading text={reading} word={word} tone={tone} /></span>
    <span className="lw-row__mean">{meaning}</span>
  </>;
  return <div className="lw-row" data-current={current || undefined}>
    {onOpen ? <button type="button" className="lw-row__main" onClick={onOpen}>{body}</button> : <span className="lw-row__main">{body}</span>}
    {level ? <LevelTag level={level} /> : <i className="lw-tag lw-tag--empty" />}
    <StatusPill status={status} onSave={onSave} busy={saving} pop={pop} />
  </div>;
}

/** 끝 화면 숫자 — 앞 값(처음은 0)에서 n까지 0.3초에 올라간다(⑥-4 · 보상 순간은 짧게). 화면 읽기는 처음부터 n, 동작 줄이기면 바로 n. */
export function CountUp({ n }) {
  const from = useRef(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = from.current;
    from.current = n;
    if (reducedMotion() || start === n) { setShown(n); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 300);
      setShown(Math.round(start + (n - start) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <><span aria-hidden="true">{shown}</span><span className="sr-only">{n}</span></>;
}
