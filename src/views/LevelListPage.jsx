'use client';
// 레벨별 단어 · 문형 목록(LEVEL-LIST-AJ-001) — 목업 docs/design/mocks/lv/lv.html 8판, 인계 #1337 6119208984 · 6146777048.
// 단어: 찾기 · 아는 단어 N · 뜻 가리기, 카드마다 [제외][저장]. 문형: 읽기 전용(저장 · 번호 · 캡션 · 펼치기 없음).
// 저장 = /api/learning/vocabulary action:'save'(FSRS 직접 추가 정본, 기존 카드는 그대로 돌려받는다).
// 제외 = 아는 단어 표시(useKnownWords → markKnown). 로그인 전에는 둘 다 로그인 안내만, 기록 0.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTTS } from '@/lib/useTTS';
import { useKnownWords } from '@/lib/useKnownWords';
import { knownWordKeys, knownWordSetOf } from '@/lib/knownWordControl';
import { createFsrsLearningClient } from '@/lib/fsrsLearningClient';
import { authEntryHref } from '@/lib/authRedirect';
import { alignFurigana } from '@/views/refShared';
import {
  LEVEL_LIST_LANGS, levelLabel, levelPill, levelListHref, jaHeadMode, matchesLevelQuery, splitKnown, fetchSavedLevelKeys,
} from '@/lib/levelList';
import '@/components/levels/level-list.css';

const KIND_LABEL = { vocab: '단어', bunkei: '문형' };
const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const SpeakerIcon = () => <svg {...svg} width={17} height={17} strokeWidth={1.5}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
const SearchIcon = () => <svg {...svg} width={17} height={17} strokeWidth={1.6}><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-5-5" /></svg>;
const PlusIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>;
const CheckIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const SpinIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.2}><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
const CrossIcon = () => <svg {...svg} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>;

const newId = () => globalThis.crypto.randomUUID();
// 처음엔 150개만 그린다(N3 2,108개를 한 번에 그리면 DOM 예산 초과 — smoke e2e 「vocab performance」). 찾기는 레벨 전체에서 한다.
export const LEVEL_LIST_PAGE = 150;

/** 위 읽기 — 한자 구간에만 루비(alignFurigana 재사용). 정렬이 안 되면 글자만. */
function Ruby({ text, reading }) {
  const segs = alignFurigana(text, reading);
  if (!segs) return text;
  return segs.map((s, i) => (s.rt ? <ruby key={i}>{s.text}<rt>{s.rt}</rt></ruby> : <span key={i}>{s.text}</span>));
}

function Headword({ entry, lang, levelKey }) {
  if (lang === 'chinese') return <><span className="lv-hw" lang="zh-CN">{entry.word}</span>{entry.reading && <span className="lv-py">{entry.reading}</span>}</>;
  const hasKanji = entry.reading && entry.reading !== entry.word && alignFurigana(entry.word, entry.reading);
  if (jaHeadMode(levelKey) === 'kana' && hasKanji) return <><span className="lv-hw" lang="ja">{entry.reading}</span><span className="lv-kj" lang="ja">{entry.word}</span></>;
  return <span className="lv-hw" lang="ja">{hasKanji ? <Ruby text={entry.word} reading={entry.reading} /> : entry.word}</span>;
}

function Example({ ex, lang, speak, hideTranslation }) {
  const zh = lang === 'chinese';
  return <p className="lv-ex">
    <span className="lv-ex__text" lang={zh ? 'zh-CN' : 'ja'}>{zh ? ex.text : <Ruby text={ex.text} reading={ex.reading} />}</span>
    {speak && <button type="button" className="lv-snd" aria-label="예문 듣기" title="예문 듣기" onClick={() => speak(ex.text)}><SpeakerIcon /></button>}
    {zh && ex.reading && <span className="lv-ex__py">{ex.reading}</span>}
    {!hideTranslation && ex.ko && <span className="lv-ex__tr">{ex.ko}</span>}
  </p>;
}

function SaveButton({ state, onSave }) {
  if (state === 'saved') return <button type="button" className="lv-fab lv-fab--have" aria-label="저장됨" title="저장됨" aria-disabled="true"><CheckIcon /></button>;
  if (state === 'saving') return <button type="button" className="lv-fab lv-fab--busy" aria-label="저장 중" title="저장 중" aria-disabled="true"><SpinIcon /></button>;
  return <button type="button" className="lv-fab lv-fab--save" aria-label="저장" title="저장" onClick={onSave}><PlusIcon /></button>;
}

export default function LevelListPage({ lang, kind, levelKey, groups }) {
  const conf = LEVEL_LIST_LANGS[lang];
  const vocab = kind === 'vocab';
  const pathname = usePathname();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { speak, supported: ttsSupported } = useTTS();
  const say = useCallback((text) => speak(text, conf.language), [speak, conf.language]);
  const known = useKnownWords(conf.langCode, vocab && !!userId);

  const [query, setQuery] = useState('');
  const [hideMeaning, setHideMeaning] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const [showKnown, setShowKnown] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [saving, setSaving] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [activeGroup, setActiveGroup] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [limit, setLimit] = useState(LEVEL_LIST_PAGE);
  const [jumpTo, setJumpTo] = useState(null);
  const moreRef = useRef(null);
  const pendingExclude = useRef(null);
  const fsrs = useRef(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  // 하이드레이션: 서버 렌더와 첫 화면을 같게 — 계정 상태(저장됨 · 아는 단어)는 붙은 뒤에만 그린다.
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const allEntries = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const knownSet = useMemo(() => (mounted && userId ? knownWordSetOf(known.rows, [], conf.langCode) : new Set()), [mounted, userId, known.rows, conf.langCode]);

  // 저장됨 — 이미 단어장에 있는 단어는 처음부터 「저장됨」.
  useEffect(() => {
    setSaved(new Set());
    if (!vocab || !userId) return undefined;
    let alive = true;
    fetchSavedLevelKeys(supabase, userId, conf.language, allEntries.map((e) => e.key))
      .then((set) => { if (alive) setSaved((prev) => new Set([...prev, ...set])); })
      .catch(() => {});
    return () => { alive = false; };
  }, [vocab, userId, conf.language, allEntries]);

  // FSRS 저장 클라이언트 — 계정마다 하나, 계정이 바뀌면 버린다.
  useEffect(() => {
    if (!vocab || !userId) return undefined;
    const client = createFsrsLearningClient({ accountId: userId, getAccountId: () => userRef.current });
    client.start();
    fsrs.current = client;
    return () => { client.dispose?.(); if (fsrs.current === client) fsrs.current = null; };
  }, [vocab, userId]);

  const loginToast = (message) => setToast({ message, href: authEntryHref(pathname), action: '로그인' });

  const save = async (entry) => {
    if (!userId) return loginToast('로그인하면 단어를 저장할 수 있어요');
    const client = fsrs.current;
    if (!client || saving.has(entry.key) || saved.has(entry.key)) return;
    setSaving((s) => new Set(s).add(entry.key));
    const done = (ok) => {
      setSaving((s) => { const n = new Set(s); n.delete(entry.key); return n; });
      if (ok) setSaved((s) => new Set(s).add(entry.key));
    };
    try {
      // 예문은 붙이지 않는다(인계 §5 — 저장 카드 예문은 보류). 뜻 · 읽기는 새 카드에만 쓰이고, 있던 카드는 그대로다.
      const vocabulary = { language: conf.language, word_text: entry.key, base_form: entry.key,
        meaning: entry.fullMeaning.slice(0, 2000), furigana: entry.reading.slice(0, 500), pos: entry.pos.slice(0, 80) };
      const response = await client.save({ action: 'save', accountId: userId, operationId: newId(), cardId: newId(), vocabulary });
      if (response?.ok === true || response?.status === 'pending' || response?.status === 'applied' || response?.status === 'replayed') return done(true);
      done(false);
      setToast({ message: /excluded|known/.test(response?.blockReason || '') ? '아는 단어로 옮긴 단어라 저장하지 않았어요' : '저장하지 못했어요. 잠시 후 다시 시도해 주세요' });
    } catch {
      done(false);
      setToast({ message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요' });
    }
  };

  const unmark = (key) => known.mutation.mutate({ lang: conf.langCode, wordText: key, known: false,
    removeKeys: knownWordKeys(known.rows, conf.langCode, { text: key }, []) });
  const exclude = (entry) => {
    if (!userId) return loginToast('로그인하면 아는 단어로 옮길 수 있어요');
    pendingExclude.current = entry.key;
    known.mutation.mutate({ lang: conf.langCode, wordText: entry.key, known: true });
  };
  // 제외가 반영되면(아는 단어에 들어오면) 카드가 사라지고 토스트 — 실패는 useKnownWords가 알린다.
  useEffect(() => {
    const key = pendingExclude.current;
    if (!key || !knownSet.has(key)) return;
    pendingExclude.current = null;
    setToast({ message: '아는 단어로 옮겼어요', action: '되돌리기', onAction: () => { unmark(key); setToast(null); } });
  }, [knownSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const { shown, knownEntries } = useMemo(() => {
    const filtered = groups.map((g) => {
      const split = vocab ? splitKnown(g.entries, knownSet) : { shown: g.entries, known: [] };
      return { name: g.name, entries: split.shown.filter((e) => matchesLevelQuery(e, query)), known: split.known };
    });
    return { shown: filtered.filter((g) => g.entries.length), knownEntries: filtered.flatMap((g) => g.known) };
  }, [groups, vocab, knownSet, query]);
  const knownView = vocab && showKnown && knownEntries.length > 0;
  useEffect(() => setLimit(LEVEL_LIST_PAGE), [query]);
  // 점진 그리기 — 묶음 순서대로 limit개까지만. 묶음 제목의 개수는 전체 개수다.
  const { visible, total } = useMemo(() => {
    let budget = limit;
    const out = shown.map((g) => {
      const entries = g.entries.slice(0, Math.max(0, budget));
      budget -= entries.length;
      return { ...g, entries, count: g.entries.length };
    });
    return { visible: out, total: shown.reduce((n, g) => n + g.entries.length, 0) };
  }, [shown, limit]);
  const rest = Math.max(0, total - limit);
  useEffect(() => {
    const node = moreRef.current;
    if (!node || !rest || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((items) => {
      if (items.some((i) => i.isIntersecting)) setLimit((n) => n + LEVEL_LIST_PAGE);
    }, { rootMargin: '600px 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [rest, knownView]);
  // 목차로 아직 안 그린 묶음에 가면 그 묶음까지 그린 뒤 옮겨 간다.
  const openGroup = (event, gi) => {
    const start = shown.slice(0, gi).reduce((n, g) => n + g.entries.length, 0);
    if (start < limit) return;
    event.preventDefault();
    setLimit(start + LEVEL_LIST_PAGE);
    setJumpTo(gi);
  };
  useEffect(() => {
    if (jumpTo == null) return;
    document.getElementById(`lv-${kind}-${jumpTo}`)?.scrollIntoView();
    setJumpTo(null);
  }, [jumpTo, kind]);
  useEffect(() => { if (showKnown && knownEntries.length === 0) setShowKnown(false); }, [showKnown, knownEntries.length]);

  // 목차 — 보이는 묶음을 따라간다.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const nodes = [...document.querySelectorAll('[data-lv-group]')];
    const io = new IntersectionObserver((items) => {
      const top = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActiveGroup(Number(top.target.dataset.lvGroup));
    }, { rootMargin: '-20% 0px -70% 0px' });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [shown]);

  const title = `${levelLabel(levelKey)} ${KIND_LABEL[kind]}`;
  const groupId = (i) => `lv-${kind}-${i}`;
  const nav = shown.map((g, i) => ({ i, name: g.name, href: `#${groupId(i)}`, current: i === activeGroup }));
  const speakOk = mounted && ttsSupported;

  return <div className={`manabi-page lv-page lv-page--${kind}`}>
    <p className="lv-crumb"><Link href={`/lessons?lang=${conf.language}`}>← 교재</Link></p>
    <div className="lv-head">
      <h1>{title}</h1>
      <nav className="lv-pills" aria-label="레벨">
        {conf.levels.map((key) => <Link key={key} href={levelListHref(lang, kind, key)} aria-current={key === levelKey ? 'page' : undefined}
          aria-label={levelLabel(key)}>{levelPill(key)}</Link>)}
      </nav>
    </div>
    <nav className="lv-tabs" aria-label="목록 종류">
      {Object.entries(KIND_LABEL).map(([k, label]) => <Link key={k} href={levelListHref(lang, k, levelKey)} aria-current={k === kind ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <div className="lv-tools">
      <label className="lv-search"><SearchIcon /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="찾기" aria-label={`${title}에서 찾기`} /></label>
      {vocab && knownEntries.length > 0 && <button type="button" className="lv-toggle lv-known-count" aria-pressed={knownView} onClick={() => setShowKnown((v) => !v)}>아는 단어 {knownEntries.length}</button>}
      {vocab && !knownView && <button type="button" className="lv-toggle" aria-pressed={hideMeaning} onClick={() => { setHideMeaning((v) => !v); setRevealed(new Set()); }}>{hideMeaning ? '뜻 보기' : '뜻 가리기'}</button>}
    </div>

    {knownView ? <div className="lv-split lv-split--wide"><div className="lv-col">
      <ul className="lv-entries">{knownEntries.filter((e) => matchesLevelQuery(e, query)).map((e) => <li key={e.key} className="lv-entry lv-entry--known">
        <div className="lv-entry__top"><div className="lv-entry__word"><Headword entry={e} lang={lang} levelKey={levelKey} /></div>
          <button type="button" className="lv-undo" onClick={() => unmark(e.key)} disabled={known.isPendingWord(conf.langCode, e.key)}>되돌리기</button></div>
        <p className="lv-mean">{e.meaning}</p>
      </li>)}</ul>
    </div></div> : <>
      <nav className="lv-chips" aria-label="주제">{nav.map((n) => <a key={n.href} href={n.href} aria-current={n.current || undefined} onClick={(e) => openGroup(e, n.i)}>{n.name}</a>)}</nav>
      <div className={vocab ? 'lv-split' : 'lv-split lv-split--wide'}>
        {vocab && <nav aria-label="주제 목차"><ul className="lv-toc">{nav.map((n) => <li key={n.href}><a href={n.href} aria-current={n.current || undefined} onClick={(e) => openGroup(e, n.i)}>{n.name}</a></li>)}</ul></nav>}
        <div className="lv-col">
          {shown.length === 0 && <p className="lv-empty" role="status">{query ? '이 레벨에서 찾지 못했어요' : '모든 단어를 아는 단어로 옮겼어요'}</p>}
          {visible.map((g, gi) => g.entries.length > 0 && <section key={g.name} className="lv-group" id={groupId(gi)} data-lv-group={gi} aria-labelledby={`${groupId(gi)}-h`}>
            <h2 id={`${groupId(gi)}-h`}>{g.name}<span>{g.count}</span></h2>
            <ul className="lv-entries">{g.entries.map((e) => vocab ? <li key={e.key} className="lv-entry">
              <div className="lv-entry__top">
                <div className="lv-entry__word"><Headword entry={e} lang={lang} levelKey={levelKey} />
                  {speakOk && <button type="button" className="lv-snd" aria-label="듣기" title="듣기" onClick={() => say(e.word)}><SpeakerIcon /></button>}</div>
                <div className="lv-acts">
                  <button type="button" className="lv-fab lv-fab--ex" aria-label="제외 — 아는 단어로 옮기기" title="제외" onClick={() => exclude(e)}
                    disabled={mounted && !!userId && known.isPendingWord(conf.langCode, e.key)}><CrossIcon /></button>
                  <SaveButton state={saved.has(e.key) ? 'saved' : saving.has(e.key) ? 'saving' : 'idle'} onSave={() => save(e)} />
                </div>
              </div>
              <p className="lv-mean">{hideMeaning && !revealed.has(e.key)
                ? <button type="button" className="lv-veil" aria-label="뜻 보기" onClick={() => setRevealed((r) => new Set(r).add(e.key))} />
                : e.meaning}</p>
              {e.ex && <Example ex={e.ex} lang={lang} speak={speakOk ? say : null} hideTranslation={hideMeaning && !revealed.has(e.key)} />}
            </li> : <li key={e.key} className="lv-pat">
              <div className="lv-pat__head"><span className="lv-hw" lang={lang === 'chinese' ? 'zh-CN' : 'ja'}>{e.pattern}</span>{e.ko && <span className="lv-pat__ko">{e.ko}</span>}</div>
              {e.conn && <p className="lv-formula">{e.conn}</p>}
              {e.note && <p className="lv-note">{e.note}</p>}
              {e.exs.length > 0 && <div className="lv-pat__exs">{e.exs.map((ex, i) => <Example key={i} ex={ex} lang={lang} speak={speakOk ? say : null} />)}</div>}
            </li>)}</ul>
          </section>)}
          {rest > 0 && <div ref={moreRef} className="lv-more"><button type="button" onClick={() => setLimit((n) => n + LEVEL_LIST_PAGE)}>더 보기 · {rest.toLocaleString('en-US')}개 남음</button></div>}
          <p className="lv-src">{conf.source}</p>
        </div>
      </div>
    </>}
    {toast && <div className="lv-toast" role="status">
      <span>{toast.message}</span>
      {toast.href ? <Link href={toast.href}>{toast.action}</Link> : toast.onAction ? <button type="button" onClick={toast.onAction}>{toast.action}</button> : null}
    </div>}
  </div>;
}
