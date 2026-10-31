'use client';
// 영어 · 프랑스어 판 부품(오너 2026-10-26 KST 목업 v2 「다음 ㄱㄱ」) — 공통 단어 화면의 표제어 · 뜻 옆 표 · 글자 칸 자리를 라틴 문자 판이 채운다.
// 표제어: 크기는 글자 수가 아니라 폭으로(라틴 글자 ≈ CJK 0.55칸). 프랑스어 관사는 명사 왼쪽에 매달아 명사가 가운데(la famille 쏠림 — 오너 지적).
// 성은 「f.」 · 「m.」만(여성 · 남성 글자 없이 — 오너 2026-10-26 KST), 색은 늘 칠한다(tone 고정 — 시트의 「성 색」 스위치는 없앴다, 2026-10-31 KST) · 색 없이도 글자로 구별된다.
// 불규칙 형태 · 활용 · 어원은 한 단어 화면에만(리스트는 표제어만 — 오너 「눌러서 나오는 화면에만」). 어원이 없으면 칸을 그리지 않는다.
import { useState } from 'react';
import { splitFrArticle } from '@/lib/latinLevelWords';
import { CaretIcon } from './WordParts';
import { useWordLang } from './wordLang';

/** 라틴 글자 폭 → 표제어 크기 칸 수(--n). CJK 한 글자 = 1. */
export const latinN = (text) => Math.max(1, Math.round([...String(text || '')].length * 5.5) / 10);

const LANG_OF = { 영어: 'en', 프랑스어: 'fr', 라틴어: 'la' };

function Article({ art, g, tone }) {
  return <span className="lw-art" data-g={tone ? g || undefined : undefined}>{art}</span>;
}

/**
 * 표제어 — size 'one'(한 단어 카드 52px 자리) | 'card'(리스트 줄). 관사가 있으면 한 단어 카드는 [관사 | 명사 | 빈 칸] 세 칸으로 명사를 가운데에,
 * 리스트 줄은 관사를 작게 앞에. 엘리지옹(l')은 붙여 쓴다.
 */
export function LatinHeadword({ entry: e, size = 'one', tone = true }) {
  const L = useWordLang();
  const { art, noun } = e.art ? splitFrArticle(e.word) : { art: null, noun: e.word };
  if (size === 'card') {
    return <span className="lw-card__hw" lang={L.hw} style={{ '--n': latinN(e.word) }}>
      {art && <><Article art={art} g={e.g} tone={tone} />{/['’]$/.test(art) ? '' : ' '}</>}{noun}</span>;
  }
  if (!art) return <span className="lw-one__hw" lang={L.hw} style={{ '--n': latinN(noun) }}>{noun}</span>;
  return <span className="lw-one__hw lw-one__hw--art" lang={L.hw} style={{ '--n': latinN(noun) }}>
    <Article art={art} g={e.g} tone={tone} /><span>{noun}</span><span aria-hidden="true" /></span>;
}

/** 성 표 — 「f.」 · 「m.」. 화면 읽기는 온전한 말. */
export function GenderChip({ g, tone = true }) {
  if (!g) return null;
  return <span className="lw-gchip" data-g={tone ? g : undefined}><span aria-hidden="true">{g}.</span><span className="sr-only">{g === 'f' ? '여성 명사' : '남성 명사'}</span></span>;
}

/** 리스트 줄 표제어 뒤 — 성만(불규칙은 한 단어 화면에만). */
export function LatinHeadTag({ entry: e, tone }) {
  return <GenderChip g={e.g} tone={tone} />;
}

/** 한 단어 화면 뜻 옆 — 불규칙이면 「불규칙」, 명사면 성. */
export function LatinMeanTag({ entry: e, tone }) {
  if (e.irregular) return <span className="lw-irr">불규칙</span>;
  return <GenderChip g={e.g} tone={tone} />;
}

function Forms({ forms }) {
  const L = useWordLang();
  return <ul className="lw-forms" aria-label="형태" style={{ '--n': forms.length }}>
    {forms.map(([label, form]) => <li key={label}><b lang={L.hw}>{form}</b><span>{label}</span></li>)}
  </ul>;
}

function Conj({ conj }) {
  const L = useWordLang();
  const [open, setOpen] = useState(true);
  return <div className="lw-conj">
    <button type="button" className="lw-conj__head" aria-expanded={open} onClick={(ev) => { ev.stopPropagation(); setOpen((v) => !v); }}>
      <span className="lw-box__lbl">현재형</span><span className="lw-conj__caret"><CaretIcon /></span></button>
    {open && <ul className="lw-conj__grid" lang={L.hw}>{conj.map(([who, form]) => <li key={who}><span>{who}</span><b>{form}</b></li>)}</ul>}
  </div>;
}

function Etym({ ety }) {
  const L = useWordLang();
  const { parts, root, kin, note } = ety;
  return <div className="lw-ety" aria-label="어원">
    {parts?.length ? <ul className="lw-ety__parts">{parts.map(([w, ko]) => <li key={w}><span className="lw-ety__pw" lang={L.hw}>{w}</span><b>{ko}</b></li>)}</ul> : null}
    {root && <p className="lw-ety__root"><span className="lw-box__lbl">어원</span><i lang={LANG_OF[root[1]]}>{root[0]}</i><span>{root[1]}</span></p>}
    {kin?.length ? <p className="lw-ety__kin" aria-label="같은 뿌리">{kin.map(([lang, w]) => <span key={`${lang}${w}`} className="lw-ety__chip">
      {lang && <i>{lang}</i>}<span lang={LANG_OF[lang] || L.hw}>{w}</span></span>)}</p> : null}
    {note && <p className="lw-ety__note">{note}</p>}
  </div>;
}

/** 한 단어 화면 글자 칸 자리 — 형태 · 현재형 · 어원(있는 것만). */
export function LatinExtras({ entry: e }) {
  if (!e.forms && !e.conj && !e.ety) return null;
  return <>
    {e.forms && <Forms forms={e.forms} />}
    {e.conj && <Conj conj={e.conj} />}
    {e.ety && <Etym ety={e.ety} />}
  </>;
}
