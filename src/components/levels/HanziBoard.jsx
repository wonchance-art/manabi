'use client';
// 중국어 레벨 화면 「한자」 탭(HANZI-TAB-AL-001) — 목업 docs/design/mocks/al/al.html 2판, 인계 #1337 6146776723.
// 목록 · 문제 화면에는 글자만(병음 · 뜻 0). 「몰라요」 뒤 답 카드, 「알아요」 뒤 방금 줄에서만 답이 보인다.
// 기록 = 기존 logReviewEvents(source:'hanzi'), 글자마다 1건(대기 → 다음 결정 · 끝 · 나가기 때 확정, hanziSession).
// 로그인 전: 넘기기는 되고 표시는 이 화면에서만 — 기록 0 · 브라우저 저장 0.
// 단어 칩 → AJ 단어 카드(저장 · 제외는 LevelListPage가 넘겨주는 AJ 함수 그대로).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { logReviewEvents } from '@/lib/reviewEvents';
import { HANZI_STD, loadHanziTable } from '@/lib/zhHanzi';
import { hanziBrief, hanziCardModel, hanziChipModel } from '@/lib/hanziCard';
import { fetchLastHanziMarks, hanziRunMisses, hanziRunProgress, shuffleHanzi, startHanziRun, stepHanziRun } from '@/lib/hanziSession';
import { loadRefVocabIndex } from '@/lib/refVocabIndex';
import { loadHanjaPanelTable, onIdle } from '@/lib/viewerHanjaPanel';
import { loadZhengTable } from '@/lib/glyphTables';
import { loadPatternIndex } from '@/lib/patternIndex';
import { levelWordKey, shortMeaning } from '@/lib/levelList';
import './hanzi-board.css';

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const SpeakerIcon = () => <svg {...svg} width={16} height={16} strokeWidth={1.8}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>;
const PlusIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>;
const CheckIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const CrossIcon = () => <svg {...svg} width={18} height={18} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>;

const ZH = { lang: 'zh-CN' };
const PY = { lang: 'zh-Latn-pinyin' };
const markLabel = (m) => (m === false ? '모름' : m === true ? '확인함' : '아직');

/** 답 카드에 쓰는 표(정체 · 한국 음 · 훈 · 한자 창) — 한 번만 받는다. 실패하면 null(카드는 머리 줄 일부를 빼고 그린다). */
let tablesPromise = null;
function loadCardTables() {
  tablesPromise ||= Promise.all([
    import('@/lib/data/hanjaKo.json').then((m) => m.default || m),
    import('@/lib/data/hanjaHun.json').then((m) => m.default || m),
    loadZhengTable(),
    loadHanjaPanelTable(),
  ]).then(([koTable, hunTable, tradTable, panel]) => ({ koTable, hunTable, tradTable, panel }))
    .catch(() => { tablesPromise = null; return null; });
  return tablesPromise;
}

/** 칩 병음 — 누른 글자 자리만 장미색. */
function ChipPinyin({ chip }) {
  if (!chip.syl) return null;
  return <span className="hz-wc__py" {...PY}>{chip.syl.map((s, i) => (chip.at.includes(i) ? <em key={i}>{s}</em> : <span key={i}>{s}</span>))}</span>;
}

function ChipMeaning({ chip }) {
  if (!chip.koHi) return <span className="hz-wc__ko">{chip.ko}</span>;
  const { from, to } = chip.koHi;
  return <span className="hz-wc__ko">{chip.ko.slice(0, from)}<b>{chip.ko.slice(from, to)}</b>{chip.ko.slice(to)}</span>;
}

/** 답 카드 본문. */
function AnswerCard({ model, words, onWord, onPattern, say }) {
  const { head } = model;
  return <div className="hz-card">
    <div className="hz-card__head">
      <span className="hz-card__ch" {...ZH}>{head.ch}</span>
      <div className="hz-card__meta">
        <span className="hz-card__rd" {...PY}>{head.readings.map((p) => <span key={p}>{p}</span>)}</span>
        {head.perReading ? <span className="hz-card__ref">참고 소리마다 정체가 달라요</span>
          : (head.zheng || head.hun) && <span className="hz-card__ref">참고 {head.zheng && <b lang="zh-Hant">正 {head.zheng}</b>}{head.zheng && head.hun && ' · '}{head.hun}</span>}
        {head.parts?.length > 0 && <span className="hz-card__parts">구성 <span lang="zh-Hant">{head.parts.join(' · ')}</span></span>}
      </div>
    </div>
    {model.watch.length > 0 && <div className="hz-watch"><span className="hz-watch__lab">주의</span>
      {model.watch.map((w) => <div key={w.zh}><span {...ZH}>{w.zh}</span>{w.py && <span className="hz-watch__py" {...PY}>{w.py}</span>}<span>{w.ko}{w.note && ` — ${w.note}`}</span></div>)}
    </div>}
    {model.rd.map((r) => <div key={r.py} className="hz-rd">
      <div className="hz-rd__h">
        <span className="hz-rd__py" {...PY}>{r.py}</span>
        {r.zheng && <span className="hz-rd__zh" lang="zh-Hant" title="정체">正 {r.zheng}</span>}
        {r.hun && <span className="hz-rd__n">참고 {r.hun}</span>}
        <span className="hz-rd__n">{r.n ? `단어 ${r.n}` : '문법'}</span>
        {r.hear && say && <button type="button" className="hz-hear" aria-label={`${r.hear} 듣기`} onClick={() => say(r.hear)}><SpeakerIcon /><span {...ZH}>{r.hear}</span></button>}
      </div>
      {r.senses.map((s) => <div key={s.g} className="hz-sense">
        <span className="hz-sense__g">{s.g}</span>
        {s.chips && <div className="hz-chips">{s.chips.map((c) => {
          const key = levelWordKey(c.zh);
          const mine = words.isSaved(key);
          const known = words.knownSet.has(key);
          return <button key={c.zh} type="button" className={`hz-wc${mine ? ' hz-wc--mine' : ''}${known ? ' hz-wc--known' : ''}`}
            aria-label={`${c.zh} ${c.syl ? c.syl.join('') : ''} ${c.ko}${mine ? ', 내 단어' : ''}${known ? ', 아는 단어' : ''}`} onClick={() => onWord(c.zh)}>
            <ChipPinyin chip={c} /><span className="hz-wc__zh" {...ZH}>{c.chars.map((x, i) => (c.at.includes(i) ? <em key={i}>{x}</em> : x))}</span><ChipMeaning chip={c} />
          </button>;
        })}</div>}
        {s.phr && <>
          <div className="hz-phr">{s.phr.map((p) => <span key={p} {...ZH}>{p}</span>)}</div>
          <button type="button" className="hz-link" onClick={() => onPattern(s.fn)}>문형 보기 ›</button>
        </>}
      </div>)}
    </div>)}
    {model.other.length > 0 && <p className="hz-other">다른 소리 · {model.other.map((o, i) => <span key={o.py}>{i > 0 && ' · '}<b {...PY}>{o.py}</b> {o.g}</span>)}</p>}
  </div>;
}

/** AJ 단어 카드(같은 자리, 「‹ 学 카드로」). */
function WordCard({ ch, zh, dict, tables, words, onBack, say }) {
  const w = dict?.get(zh)?.word;
  if (!w) return null;
  const key = levelWordKey(zh);
  const entry = { key, word: zh, reading: w.pinyin || '', meaning: shortMeaning(w.ko), fullMeaning: w.ko || '', pos: w.pos || '' };
  const chip = hanziChipModel(zh, ch, w, tables || {});
  const state = words.isSaved(key) ? 'saved' : words.isSaving(key) ? 'saving' : 'idle';
  return <div className="hz-card hz-word">
    <button type="button" className="hz-back" onClick={onBack}>‹ <span {...ZH}>{ch}</span> 카드로</button>
    <div className="hz-word__hw"><span {...ZH}>{zh}</span><ChipPinyin chip={chip} />
      {say && <button type="button" className="lv-snd" aria-label="듣기" title="듣기" onClick={() => say(zh)}><SpeakerIcon /></button>}</div>
    <p className="hz-word__mean">{w.ko}</p>
    {w.ex?.zh && <p className="lv-ex"><span className="lv-ex__text" {...ZH}>{w.ex.zh}</span>
      {w.ex.pinyin && <span className="lv-ex__py">{w.ex.pinyin}</span>}{w.ex.ko && <span className="lv-ex__tr">{w.ex.ko}</span>}</p>}
    <div className="lv-acts hz-word__acts">
      <button type="button" className="lv-fab lv-fab--ex" aria-label="제외 — 아는 단어로 옮기기" title="제외" onClick={() => words.exclude(entry)} disabled={words.isPendingKnown(key)}><CrossIcon /></button>
      {state === 'saved' ? <button type="button" className="lv-fab lv-fab--have" aria-label="저장됨" title="저장됨" aria-disabled="true"><CheckIcon /></button>
        : <button type="button" className={`lv-fab ${state === 'saving' ? 'lv-fab--busy' : 'lv-fab--save'}`} aria-label={state === 'saving' ? '저장 중' : '저장'} title="저장"
          aria-disabled={state === 'saving' || undefined} onClick={() => state === 'idle' && words.save(entry)}><PlusIcon /></button>}
    </div>
  </div>;
}

/** 문형 카드(문형 색인 — 링크 없이 시트 안에서). */
function PatternCard({ ch, fn, patterns, onBack }) {
  const list = (patterns?.get(fn) || []).filter((p) => /^H[12]$/.test(p.level)).slice(0, 3);
  const shown = list.length ? list : (patterns?.get(fn) || []).slice(0, 3);
  return <div className="hz-card hz-word">
    <button type="button" className="hz-back" onClick={onBack}>‹ <span {...ZH}>{ch}</span> 카드로</button>
    {!patterns ? <p className="hz-note" role="status">불러오는 중…</p> : shown.length === 0 ? <p className="hz-note">이 글자의 문형을 찾지 못했어요</p>
      : shown.map((p) => <div key={p.id} className="lv-pat">
        <div className="lv-pat__head"><span className="lv-hw" {...ZH}>{p.pattern}</span>{p.ko && <span className="lv-pat__ko">{shortMeaning(p.ko)}</span>}</div>
        {p.conn && <p className="lv-formula">{p.conn}</p>}
        {p.ex?.zh && <p className="lv-ex"><span className="lv-ex__text" {...ZH}>{p.ex.zh}</span>{p.ex.pinyin && <span className="lv-ex__py">{p.ex.pinyin}</span>}{p.ex.ko && <span className="lv-ex__tr">{p.ex.ko}</span>}</p>}
      </div>)}
  </div>;
}

/**
 * @param {object} p
 * @param {string} p.levelKey
 * @param {{name: string, set: number, entries: {key: string}[]}[]} p.groups
 * @param {string|null} p.userId
 * @param {boolean} p.mounted
 * @param {object} p.words - AJ 단어 동작 {knownSet, isSaved, isSaving, isPendingKnown, save, exclude, loadSaved}
 * @param {Function|null} p.say - 듣기(TTS)
 * @param {string} p.loginHref
 */
export default function HanziBoard({ levelKey, groups, userId, mounted, words, say, loginHref }) {
  const [table, setTable] = useState(null);
  const [dict, setDict] = useState(null);
  const [tables, setTables] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [serverMarks, setServerMarks] = useState(() => new Map());
  const [localMarks, setLocalMarks] = useState(() => ({}));
  const [setIdx, setSetIdx] = useState(0);
  const [run, setRun] = useState(null);
  const [sub, setSub] = useState(null); // 답 카드 안에서 연 단어 · 문형 카드 {type, zh|fn}
  const [peek, setPeek] = useState(null); // 끝 목록에서 연 답 카드 글자
  const runRef = useRef(null);
  runRef.current = run;
  const hintedRef = useRef(false); // 「소리 내어 읽고…」 안내는 이 화면에서 처음 한 번만

  useEffect(() => {
    let alive = true;
    loadHanziTable(levelKey).then((t) => { if (alive) setTable(t); }).catch(() => {});
    // 답 카드 자료는 유휴 시간에 미리(알아요 → 다음 전환이 기다리지 않게, 인계 §1).
    const cancel = onIdle(() => {
      loadRefVocabIndex('Chinese').then((d) => { if (alive) setDict(d); }).catch(() => {});
      loadCardTables().then((t) => { if (alive && t) setTables(t); });
    });
    return () => { alive = false; cancel(); };
  }, [levelKey]);

  // 표시 — 그 글자의 마지막 hanzi 기록. 로그인 전에는 읽지도 쓰지도 않는다.
  const allChars = useMemo(() => groups.flatMap((g) => g.entries.map((e) => e.key)), [groups]);
  useEffect(() => {
    setServerMarks(new Map());
    if (!userId) return undefined;
    let alive = true;
    // 1000행 상한에 잘리지 않게 묶음 · 페이지로 읽는다(REVIEW-ROWS-CAP-001). 실패면 빈 표시 그대로.
    fetchLastHanziMarks(supabase, userId, allChars)
      .then((marks) => { if (alive) setServerMarks(marks); }, () => {});
    return () => { alive = false; };
  }, [userId, allChars]);

  const markOf = useCallback((ch) => {
    if (run && ch in run.results) return run.results[ch];
    if (ch in localMarks) return localMarks[ch];
    return mounted ? serverMarks.get(ch) : undefined;
  }, [run, localMarks, serverMarks, mounted]);

  const group = groups[setIdx] || groups[0];
  const missIn = (g) => g.entries.filter((e) => markOf(e.key) === false).length;
  const yetIn = (g) => g.entries.filter((e) => markOf(e.key) === undefined).length;

  const record = useCallback((commits, set) => {
    if (!commits.length) return;
    setLocalMarks((m) => ({ ...m, ...Object.fromEntries(commits.map((c) => [c.ch, c.correct])) }));
    if (!userId) return;
    logReviewEvents(userId, commits.map((c) => ({ lang: 'zh', source: 'hanzi', item_key: c.ch, correct: c.correct, detail: { level: levelKey, set, std: HANZI_STD } })));
  }, [userId, levelKey]);

  const act = useCallback((action) => {
    const s = runRef.current;
    if (!s) return;
    const { state, commits } = stepHanziRun(s, action);
    if (state === s) return;
    record(commits, s.set);
    if (state.hinted) hintedRef.current = true;
    if (state.view === 'end') setLocalMarks((m) => ({ ...m, ...state.results }));
    setSub(null);
    runRef.current = state;
    setRun(state);
  }, [record]);

  // 나가기(✕) — 그때까지의 기록은 남기고 목록으로.
  const close = useCallback(() => {
    const s = runRef.current;
    if (!s) return;
    const { commits } = stepHanziRun(s, 'exit');
    record(commits, s.set);
    setLocalMarks((m) => ({ ...m, ...s.results }));
    runRef.current = null;
    setRun(null);
    setSub(null);
    setPeek(null);
  }, [record]);
  // 화면을 떠나도 대기 1건은 확정한다.
  useEffect(() => () => {
    const s = runRef.current;
    if (s && s.pending && userId) {
      logReviewEvents(userId, [{ lang: 'zh', source: 'hanzi', item_key: s.pending.ch, correct: s.pending.correct, detail: { level: levelKey, set: s.set, std: HANZI_STD } }]);
      runRef.current = { ...s, pending: null };
    }
  }, [userId, levelKey]);

  const start = (chars, first = null) => {
    const rest = shuffleHanzi(chars.filter((c) => c !== first));
    const order = first ? [first, ...rest] : rest;
    const s = { ...startHanziRun(order, { set: group.set }), hinted: hintedRef.current };
    runRef.current = s;
    setRun(s);
    setSub(null);
    setPeek(null);
  };
  const setChars = group ? group.entries.map((e) => e.key) : [];
  const missChars = setChars.filter((c) => markOf(c) === false);

  // 키보드(넓은 화면) — Space · → 알아요/다음, ↓ · X 몰라요, ← 이전, Esc 끝내기.
  useEffect(() => {
    if (!run) return undefined;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
      const s = runRef.current;
      if (!s) return;
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); close(); return; }
      if (s.view === 'end' || sub) return;
      if (k === ' ' || k === 'ArrowRight') { e.preventDefault(); act(s.view === 'card' ? 'next' : 'know'); }
      else if ((k === 'ArrowDown' || k === 'x' || k === 'X') && s.view === 'q') { e.preventDefault(); act('dontKnow'); }
      else if (k === 'ArrowLeft') { e.preventDefault(); act('prev'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, sub, act, close]);

  // 답 카드를 열면 칩 단어의 「저장됨」을 받아 둔다(AJ와 같은 조회).
  const cardCh = run?.view === 'card' ? run.order[run.i] : peek;
  useEffect(() => {
    if (!cardCh || !table?.chars?.[cardCh] || !userId) return;
    const ws = (table.chars[cardCh].rd || []).flatMap((r) => (r.s || []).flatMap((s) => s.w || []));
    words.loadSaved(ws.map(levelWordKey));
  }, [cardCh, table, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 답 카드가 열리면 [다음 →]에 초점(키보드 · 화면 읽기 프로그램).
  useEffect(() => {
    if (run?.view !== 'card') return;
    // 넓은 화면 칸과 좁은 화면 덮개 중 보이는 쪽의 [다음 →]
    const btn = [...document.querySelectorAll('.hz-nextbar button')].find((b) => b.offsetParent !== null);
    btn?.focus({ preventScroll: true });
  }, [run?.view, run?.i]);

  const openPattern = (fn) => {
    setSub({ type: 'pattern', fn });
    if (!patterns) loadPatternIndex('Chinese', { allKernels: true }).then(setPatterns).catch(() => {});
  };
  const cardBody = (ch) => {
    if (sub?.type === 'word') return <WordCard ch={ch} zh={sub.zh} dict={dict} tables={tables} words={words} say={say} onBack={() => setSub(null)} />;
    if (sub?.type === 'pattern') return <PatternCard ch={ch} fn={sub.fn} patterns={patterns} onBack={() => setSub(null)} />;
    const model = table?.chars?.[ch] ? hanziCardModel(ch, table.chars[ch], { dict, tables: tables || {} }) : null;
    if (!model) return <p className="hz-note" role="status">불러오는 중…</p>;
    return <AnswerCard model={model} words={words} say={say} onWord={(zh) => setSub({ type: 'word', zh })} onPattern={openPattern} />;
  };

  const flow = () => {
    if (!run) return <div className="hz-flow hz-flow--idle"><p>글자를 누르거나 [넘기며 확인]으로 시작해요.</p><p>글자만 보고 소리 내어 읽고, 뜻을 떠올려 보세요.</p></div>;
    const { n, total } = hanziRunProgress(run);
    const setName = group?.name || '';
    if (run.view === 'end') {
      const misses = hanziRunMisses(run);
      const nextGroup = groups[setIdx + 1];
      return <div className="hz-flow" role="region" aria-label="넘기기 끝">
        <div className="hz-top"><button type="button" aria-label="목록으로" onClick={close}><CrossIcon /></button><span className="hz-top__prog">{setName} · 끝</span><span className="hz-top__pad" /></div>
        <div className="hz-bar"><i style={{ width: '100%' }} /></div>
        {peek ? <div className="hz-peek">
          {!sub && <button type="button" className="hz-back" onClick={() => setPeek(null)}>‹ 끝 화면으로</button>}
          {cardBody(peek)}
        </div> : <div className="hz-end">
          <h3>{total}자 중 모름 {misses.length}</h3>
          {userId ? <p>다음에 이 묶음을 열면 모름 표시로 남아 있어요.</p> : <p>로그인하면 모름 표시가 남아요. <a href={loginHref}>로그인</a></p>}
          {misses.length > 0 && <div className="hz-endlist">{misses.map((c) => {
            const b = hanziBrief(table?.chars?.[c]);
            return <button key={c} type="button" onClick={() => setPeek(c)}><span className="hz-endlist__ch" {...ZH}>{c}</span>
              <span className="hz-endlist__body"><span className="hz-endlist__py" {...PY}>{b.readings}</span><span className="hz-endlist__gl">{b.gloss}</span></span></button>;
          })}</div>}
          <div className="hz-endbtns">
            {misses.length > 0 && <button type="button" className="hz-pri" onClick={() => start(misses)}>모른 {misses.length}자만 다시</button>}
            {nextGroup && <button type="button" className="hz-sec" onClick={() => { setSetIdx(setIdx + 1); close(); }}>다음 묶음 →</button>}
          </div>
        </div>}
      </div>;
    }
    const ch = run.order[run.i];
    const top = <>
      <div className="hz-top">
        <button type="button" aria-label="이전 글자" onClick={() => act('prev')} disabled={!(run.pending && run.pending.ch === run.order[run.i - 1])}>‹ 이전</button>
        <span className="hz-top__prog" role="status">{setName} · {n} / {total}</span>
        <button type="button" aria-label="끝내기" onClick={close}><CrossIcon /></button>
      </div>
      <div className="hz-bar"><i style={{ width: `${Math.round(((run.view === 'card' ? n : n - 1) / total) * 100)}%` }} /></div>
    </>;
    if (run.view === 'card') {
      return <div className="hz-flow hz-flow--card" role="region" aria-label={`${ch} 답`}>
        {top}
        <div className="hz-marked"><span>모름 체크됨</span><button type="button" onClick={() => act('cancel')}>취소</button></div>
        {cardBody(ch)}
        <div className="hz-nextbar"><button type="button" onClick={() => act('next')}>다음 →</button></div>
      </div>;
    }
    const last = run.last && table?.chars?.[run.last] ? { ch: run.last, ...hanziBrief(table.chars[run.last]) } : null;
    return <div className="hz-flow" role="region" aria-label="넘기기">
      {top}
      {last && <div className="hz-last" aria-label="방금 넘긴 글자의 답"><span className="hz-last__k">방금</span><span className="hz-last__ch" {...ZH}>{last.ch}</span>
        <span className="hz-last__body"><span className="hz-last__py" {...PY}>{last.readings}</span><span className="hz-last__gl">{last.gloss}</span></span>
        <button type="button" className="hz-last__fix" onClick={() => act('fixLast')}>몰랐어요</button></div>}
      {run.fixed && <div className="hz-last hz-last--fixed" role="status"><span className="hz-last__ch" {...ZH}>{run.fixed}</span><span className="hz-last__body">모름으로 고쳤어요</span></div>}
      <div className="hz-q"><span className="hz-q__big" {...ZH} aria-label={`문제 글자 ${ch}`}>{ch}</span>{!run.hinted && <span className="hz-q__hint">소리 내어 읽고, 뜻을 떠올려 보세요</span>}</div>
      <div className="hz-ans"><button type="button" className="hz-ans__no" onClick={() => act('dontKnow')}>몰라요</button><button type="button" className="hz-ans__yes" onClick={() => act('know')}>알아요</button></div>
      <div className="hz-keys" aria-hidden="true"><span><kbd>↓</kbd> 몰라요</span><span><kbd>Space</kbd> 알아요</span><span><kbd>←</kbd> 이전</span><span><kbd>Esc</kbd> 끝내기</span></div>
    </div>;
  };

  return <div className={`hz-board${run ? ' hz-board--run' : ''}`}>
    <nav className="lv-chips hz-setchips" aria-label="묶음">{groups.map((g, i) => <a key={g.name} href={`#hz-set-${i}`} aria-current={i === setIdx || undefined}
      onClick={(e) => { e.preventDefault(); setSetIdx(i); }}>{g.name}</a>)}</nav>
    <div className="hz-layout">
      <nav aria-label="묶음 목차"><ul className="hz-toc">{groups.map((g, i) => {
        const miss = missIn(g);
        const touched = g.entries.length - yetIn(g);
        return <li key={g.name}>{i === 1 && groups[0].set === 0 && <span className="hz-toc__sep" />}
          <a href={`#hz-set-${i}`} aria-current={i === setIdx || undefined} onClick={(e) => { e.preventDefault(); setSetIdx(i); }}>
            {g.name}<small className={miss ? 'hz-toc__miss' : undefined}>{miss ? `모름 ${miss}` : touched ? '' : '아직'}</small></a></li>;
      })}</ul></nav>
      <section className="hz-set" id={`hz-set-${setIdx}`} aria-labelledby="hz-set-h">
        <div className="hz-set__h"><h2 id="hz-set-h">{group?.name}</h2><small>{setChars.length}자{missChars.length ? ` · 모름 ${missChars.length}` : ''}{yetIn(group) ? ` · 아직 ${yetIn(group)}` : ''}</small></div>
        <div className="hz-start">
          <button type="button" className="hz-pri" onClick={() => start(setChars)}>넘기며 확인 <small>{setChars.length}</small></button>
          {missChars.length > 0 && <button type="button" className="hz-sec" onClick={() => start(missChars)}>모름만 <small>{missChars.length}</small></button>}
        </div>
        <div className="hz-grid">{setChars.map((c) => {
          const m = markOf(c);
          return <button key={c} type="button" className={`hz-cell${m === false ? ' hz-cell--miss' : m === true ? ' hz-cell--ok' : ''}`}
            aria-label={`${c}, ${markLabel(m)} — 이 글자부터 넘기기`} onClick={() => start(setChars, c)}><span {...ZH}>{c}</span></button>;
        })}</div>
        <div className="hz-legend"><span><i className="hz-lg hz-lg--miss" />모름(마지막 확인에서)</span><span><i className="hz-lg" />✓ 확인함 · 표시 없음 = 아직</span></div>
      </section>
      <div className="hz-flowwrap">{flow()}</div>
    </div>
    {/* 좁은 화면: 넘기기가 화면 전체를 덮는다. 셸(.manabi-app)은 컨테이너라 그 안의 fixed가 화면에 붙지 않아 body로 옮긴다 —
        같은 셸 클래스로 토큰 · 컨테이너 폭을 그대로 받고, 넓으면 CSS가 숨긴다(새 뷰포트 쿼리 0). */}
    {run && mounted && createPortal(<div className="manabi-app hz-portal"><div className="hz-overlay">{flow()}</div></div>, document.body)}
  </div>;
}
