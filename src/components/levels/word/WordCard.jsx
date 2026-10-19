'use client';
// 리스트 모드 카드(문서 「리스트 모드」) — 머리 줄(단어 · 병음 · 듣기 · HSK 태그 · 상태) → 뜻 → 글자 칸 → 예문 → 네 칸.
// 보기 탭이 전체가 아니면 고른 것 하나만 남기고, 누르면 나머지가 네 칸 아래로 펼쳐진다(네 칸은 펼치기 전후 같은 자리).
// 어려운 단어(자주 틀린 단어 · N번) · 오래된 단어(N일 만에 — 뜻을 보고 단어 떠올리기)는 오늘 복습 카드에만.
import { useState } from 'react';
import { CharTiles, GradeButtons, LevelTag, Listen, Pinyin, StatusPill } from './WordParts';

/** 예문 — 빌드 때 나눈 단어 길이(seg)로 단어마다 점선 밑줄, 카드 단어는 장미색. 누르면 예문 단어 창. */
export function Example({ ex, word, speak, onWord, openKey, showText = true }) {
  if (!ex?.text) return null;
  const chars = [...ex.text];
  const parts = [];
  if (Array.isArray(ex.seg) && ex.seg.reduce((a, b) => a + b, 0) === chars.length) {
    let at = 0;
    for (const n of ex.seg) { parts.push(chars.slice(at, at + n).join('')); at += n; }
  } else parts.push(ex.text);
  const han = /\p{Script=Han}/u;
  return <div className="lw-ex">
    {showText && <p className="lw-ex__line">
      <span className="lw-ex__text" lang="zh-CN">{parts.map((p, i) => (parts.length > 1 && han.test(p) && onWord
        ? <button key={i} type="button" className="lw-ex__w" data-self={p === word || undefined} aria-haspopup="dialog"
          aria-expanded={openKey === `${i}:${p}` || undefined} onClick={(e) => { e.stopPropagation(); onWord(p, e.currentTarget, `${i}:${p}`); }}>{p}</button>
        : <span key={i}>{p}</span>))}</span>
      <Listen speak={speak} text={ex.text} label="예문 듣기" />
    </p>}
    {ex.reading && <span className="lw-ex__py">{ex.reading}</span>}
    {ex.ko && <span className="lw-ex__ko">{ex.ko}</span>}
  </div>;
}

/**
 * info = { status, previews, hard(번), old(일) } — 화면이 상태 · 채점 미리보기를 계산해 넘긴다.
 * view = 'all' | 'word' | 'sentence' | 'meaning' | 'sound'.
 */
export function WordCard({ entry: e, level, view = 'all', info, tiles, speak, tone, onGrade, onSave, saving, pop, onWord, openKey, note, id }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const reverse = view === 'all' && info.old != null && !shown;
  const listen = <Listen speak={speak} text={e.word} />;
  const head = <div className="lw-card__head">
    <span className="lw-card__word"><span className="lw-card__hw" lang="zh-CN">{e.word}</span><Pinyin text={e.reading} word={e.word} tone={tone} /></span>
    {listen}<LevelTag level={level} /><StatusPill status={info.status} onSave={onSave} busy={saving} pop={pop} />
  </div>;
  const chips = info.hard ? <span className="lw-chip">자주 틀린 단어 · {info.hard}번</span> : null;
  const mean = <p className="lw-card__mean">{e.meaning}</p>;
  const ex = <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} />;
  const grades = <GradeButtons previews={info.previews} onGrade={onGrade} note={note} />;
  if (reverse) {
    return <li className="lw-card" id={id} data-key={e.key}>
      <div className="lw-reverse"><span className="lw-reverse__label">{info.old}일 만에 · 뜻 보고 단어 떠올리기</span>{mean}
        <button type="button" className="lw-reverse__show" onClick={() => setShown(true)}>떠올렸으면 눌러서 단어 보기</button></div>
    </li>;
  }
  if (view === 'all') {
    return <li className="lw-card" id={id} data-key={e.key}>{head}{chips}{mean}<CharTiles tiles={tiles} />{ex}{grades}</li>;
  }
  const solo = view === 'word' ? <div className="lw-card__head"><span className="lw-card__word"><span className="lw-card__hw" lang="zh-CN">{e.word}</span></span>
    <LevelTag level={level} /><StatusPill status={info.status} onSave={onSave} busy={saving} pop={pop} /></div>
    : view === 'sentence' ? (e.ex?.text ? <p className="lw-card__solo" lang="zh-CN">{e.ex.text}</p> : <p className="lw-card__solo">예문 없음</p>)
      : view === 'meaning' ? <p className="lw-card__solo lw-card__mean">{e.meaning}</p>
        : <div className="lw-card__head"><Listen speak={speak} text={e.word} /><span className="lw-card__word" /></div>;
  const rest = view === 'word' ? <>{<span className="lw-card__word"><Pinyin text={e.reading} word={e.word} tone={tone} />{listen}</span>}{mean}<CharTiles tiles={tiles} />{ex}</>
    : view === 'sentence' ? <>{e.ex && <Example ex={e.ex} word={e.word} speak={speak} showText={false} />}{head}{mean}<CharTiles tiles={tiles} /></>
      : view === 'meaning' ? <>{head}<CharTiles tiles={tiles} />{ex}</>
        : <>{head}{mean}<CharTiles tiles={tiles} />{ex}</>;
  const toggle = (event) => { if (!event.target.closest('button, a')) setOpen((v) => !v); };
  return <li className="lw-card" id={id} data-key={e.key} data-view={view} onClick={toggle}>
    {solo}{chips}
    <button type="button" className="sr-only" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? '접기' : '펼쳐 보기'}</button>
    {grades}
    {open && <div className="lw-card__more">{rest}</div>}
  </li>;
}
