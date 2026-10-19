'use client';
// 리스트 모드 카드(문서 「리스트 모드」) — 머리 줄(단어 · 읽기 · 듣기 · 레벨 태그 · 상태) → 뜻 → 글자 칸 → 예문.
// 네 칸은 카드마다 붙이지 않고 화면 아래 한 줄(가운데 카드를 채점 — 오너 확정 2026-10-19 KST 「아래 고정」). 단어 카드 창(grades)만 카드 안에 둔다.
// 보기 탭이 전체가 아니면 고른 것 하나만 남기고, 누르면 나머지가 아래로 펼쳐진다. 카드를 누르면 그 카드가 채점 대상(onPick).
// 레벨 태그 · ☆(담기)는 찾기 · 예문 단어 창에서 연 카드(search)에만 — 레벨 페이지 카드는 이미 그 레벨이고 채점이 곧 담기다(오너 2026-10-20 KST).
// 남은 시간 · 「시간 됨」은 줄을 늘리지 않고 카드 맨 아래 줄 오른쪽 끝에 회색 글자로(같은 줄 글자와 기준선 맞춤).
// 어려운 단어(자주 틀린 단어 · N번) · 오래된 단어(N일 만에 — 뜻을 보고 단어 떠올리기)는 오늘 복습 카드에만.
import { useState } from 'react';
import { CharTiles, GradeButtons, LevelTag, Listen, Reading, StatusPill, WaitChip } from './WordParts';
import { useWordLang } from './wordLang';

const HAN = /\p{Script=Han}/u;

/** 한 조각의 글자 — 후리가나(furi = [시작, 글자 수, 읽기])가 이 조각 안에 있으면 그 자리만 루비. */
function Furigana({ text, from, furi }) {
  if (!furi?.length) return text;
  const chars = [...text];
  const out = [];
  let at = 0;
  for (const [s, n, rt] of furi) {
    const a = s - from;
    if (a < at || a + n > chars.length) continue;
    if (a > at) out.push(chars.slice(at, a).join(''));
    out.push(<ruby key={a}>{chars.slice(a, a + n).join('')}<rt>{rt}</rt></ruby>);
    at = a + n;
  }
  if (at < chars.length) out.push(chars.slice(at).join(''));
  return out;
}

/**
 * 예문 — 빌드 때 나눈 단어 길이(seg)로 단어마다 점선 밑줄, 카드 단어는 장미색. 누르면 예문 단어 창(찾는 말 = 원형 lem, 없으면 조각 그대로).
 * lem(일본어) = 0 누르지 않음(조사 · 기호) · 1 조각 그대로 · '원형'(して → する). lem이 없으면(중국어) 한자 조각만 누른다.
 * 후리가나(furi)는 tone(설정의 「예문 후리가나」)이 켜졌을 때만. 후리가나를 맞추지 못한 예문 · 본문을 따로 그린 예문(문장 탭)은 읽기 줄을 보인다.
 */
export function Example({ ex, word, speak, onWord, openKey, showText = true, tone = true, tail = null }) {
  const L = useWordLang();
  if (!ex?.text) return null;
  const chars = [...ex.text];
  const parts = [];
  if (Array.isArray(ex.seg) && ex.seg.reduce((a, b) => a + b, 0) === chars.length) {
    let at = 0;
    for (const n of ex.seg) { parts.push({ text: chars.slice(at, at + n).join(''), from: at }); at += n; }
  } else parts.push({ text: ex.text, from: 0 });
  const lookupOf = (p, i) => {
    if (parts.length < 2 || !onWord) return null;
    if (Array.isArray(ex.lem)) return ex.lem[i] === 1 ? p.text : ex.lem[i] || null;
    return HAN.test(p.text) ? p.text : null;
  };
  const furi = tone ? ex.furi : null;
  const py = ex.reading && (!ex.furi || !showText);
  const last = ex.ko ? 'ko' : py ? 'py' : 'text';
  const end = (key) => (last === key ? tail : null); // 맨 아래 줄 끝(남은 시간)
  return <div className="lw-ex">
    {showText && <p className="lw-ex__line">
      <span className="lw-ex__text" lang={L.hw}>{parts.map((p, i) => {
        const look = lookupOf(p, i);
        const body = <Furigana text={p.text} from={p.from} furi={furi} />;
        return look
          ? <button key={i} type="button" className="lw-ex__w" data-self={look === word || p.text === word || undefined} aria-haspopup="dialog"
            aria-expanded={openKey === `${i}:${look}` || undefined} onClick={(e) => { e.stopPropagation(); onWord(look, e.currentTarget, `${i}:${look}`); }}>{body}</button>
          : <span key={i}>{body}</span>;
      })}</span>
      <Listen speak={speak} text={ex.text} label="예문 듣기" />{end('text')}
    </p>}
    {py && (end('py') ? <span className="lw-ex__py lw-tailrow"><span lang={L.exReading}>{ex.reading}</span>{tail}</span>
      : <span className="lw-ex__py" lang={L.exReading}>{ex.reading}</span>)}
    {ex.ko && (end('ko') ? <span className="lw-ex__ko lw-tailrow"><span>{ex.ko}</span>{tail}</span> : <span className="lw-ex__ko">{ex.ko}</span>)}
  </div>;
}

/**
 * info = { status, previews, hard(번), old(일) } — 화면이 상태 · 채점 미리보기를 계산해 넘긴다.
 * view = 'all' | 'word' | 'sentence' | 'meaning' | 'sound'.
 */
export function WordCard({ entry: e, level, view = 'all', info, tiles, speak, tone, onGrade, onSave, saving, pop, onWord, openKey, note, id,
  grades: inline = false, search = false, focused = false, onPick, onShow, due = false, wait = null }) {
  const L = useWordLang();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const { hw, sub } = L.head(e);
  const reverse = view === 'all' && info.old != null && !shown;
  const listen = <Listen speak={speak} text={e.word} />;
  const reading = <Reading text={sub} word={hw} tone={tone} />;
  // 레벨 페이지 카드는 담은 단어의 상태(오늘 · 복습 · 졸업)만, 찾기 카드는 레벨 태그 + 상태(☆ 담기 포함).
  const marks = search ? <><LevelTag level={level} /><StatusPill status={info.status} onSave={onSave} busy={saving} pop={pop} /></>
    : info.status && info.status !== 'new' ? <StatusPill status={info.status} pop={pop} /> : null;
  const head = <div className="lw-card__head">
    <span className="lw-card__word"><span className="lw-card__hw" lang={L.hw} style={{ '--n': [...String(hw || '')].length }}>{hw}</span>{reading}</span>
    {listen}{marks}
  </div>;
  // 오늘 할 줄 표시 — 기다리는 카드는 남은 시간, 기다리다 차례가 온 카드는 「시간 됨」. 맨 아래 줄 끝에 붙인다.
  const time = wait ? <WaitChip at={wait} /> : due ? <span className="lw-time">시간 됨</span> : null;
  const chips = info.hard ? <span className="lw-card__chips"><span className="lw-chip">자주 틀린 단어 · {info.hard}번</span></span> : null;
  const meanLine = (tail) => (tail ? <p className="lw-card__mean lw-tailrow"><span>{e.meaning}</span>{tail}</p> : <p className="lw-card__mean">{e.meaning}</p>);
  const mean = meanLine(null);
  const ex = <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} tone={tone} />;
  const grades = inline ? <GradeButtons previews={info.previews} onGrade={onGrade} note={note} /> : null;
  const pick = (event) => { if (!event.target.closest('button, a')) onPick?.(); };
  const attrs = { id, 'data-key': e.key, 'data-focus': focused || undefined };
  if (reverse) {
    return <li className="lw-card" {...attrs} onClick={pick}>
      {chips}<div className="lw-reverse"><span className="lw-reverse__label">{info.old}일 만에 · 뜻 보고 단어 떠올리기</span>{meanLine(time)}
        <button type="button" className="lw-reverse__show" onClick={() => { setShown(true); onShow?.(); onPick?.(); }}>떠올렸으면 눌러서 단어 보기</button></div>
    </li>;
  }
  if (view === 'all') {
    const last = e.ex?.text ? <Example ex={e.ex} word={e.word} speak={speak} onWord={onWord} openKey={openKey} tone={tone} tail={time} /> : null;
    return <li className="lw-card" {...attrs} onClick={pick}>{head}{chips}{last ? mean : meanLine(time)}<CharTiles tiles={tiles} />{last}{grades}</li>;
  }
  // 접힌 카드는 한 줄뿐 — 남은 시간은 그 줄 끝.
  const soloLine = (cls, body, lang) => (time ? <p className={`${cls} lw-tailrow`}><span lang={lang}>{body}</span>{time}</p> : <p className={cls} lang={lang}>{body}</p>);
  const solo = view === 'word' ? <div className="lw-card__head"><span className="lw-card__word"><span className="lw-card__hw" lang={L.hw} style={{ '--n': [...String(hw || '')].length }}>{hw}</span></span>
    {marks}{time}</div>
    : view === 'sentence' ? (e.ex?.text ? soloLine('lw-card__solo', e.ex.text, L.hw) : soloLine('lw-card__solo', '예문 없음'))
      : view === 'meaning' ? soloLine('lw-card__solo lw-card__mean', e.meaning)
        : <div className="lw-card__head"><Listen speak={speak} text={e.word} /><span className="lw-card__word" />{time}</div>;
  const rest = view === 'word' ? <>{<span className="lw-card__word">{reading}{listen}</span>}{mean}<CharTiles tiles={tiles} />{ex}</>
    : view === 'sentence' ? <>{e.ex && <Example ex={e.ex} word={e.word} speak={speak} showText={false} tone={tone} />}{head}{mean}<CharTiles tiles={tiles} /></>
      : view === 'meaning' ? <>{head}<CharTiles tiles={tiles} />{ex}</>
        : <>{head}{mean}<CharTiles tiles={tiles} />{ex}</>;
  const toggle = (event) => { if (!event.target.closest('button, a')) { setOpen((v) => !v); onPick?.(); } };
  return <li className="lw-card" {...attrs} data-view={view} onClick={toggle}>
    {solo}{chips}
    <button type="button" className="sr-only" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? '접기' : '펼쳐 보기'}</button>
    {grades}
    {open && <div className="lw-card__more">{rest}</div>}
  </li>;
}
