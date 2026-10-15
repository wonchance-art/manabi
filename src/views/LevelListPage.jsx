'use client';
// 레벨별 단어 · 문형 목록(LEVEL-LIST-AJ-001) — 목업 docs/design/mocks/lv/lv.html 8판, 인계 #1337 6119208984 · 6146777048.
// 단어(LEVEL-OX-AN-001 — 빠른 암기, 오너 지시 2026-10-15 · 목업 /mnt/project-files/notes/level-list-ox-mockup.md):
// 찾기 + ⚙(아는 단어 숨기기 · 중국어 훈음(기본 켬) · 한자 대조), 보기 탭 하나 고르기 [전체 · 단어 · 문장 · 뜻 · 소리], 카드마다 [O][X].
// 가린 칸을 누르면 그 카드가 10초 동안 전부 보였다가 다시 가려진다. 채점 · 입력창은 없다(채점 설계 폐기).
// 문형: 읽기 전용(저장 · 번호 · 캡션 · 펼치기 없음).
// X(모른다) = 공부 중인 단어로 저장 = /api/learning/vocabulary action:'save'(FSRS 직접 추가 정본, 기존 카드는 그대로 돌려받는다).
// O(안다) = 아는 단어 표시(useKnownWords → markKnown). 다시 누르면 되돌린다. 로그인 전에는 둘 다 로그인 안내만, 기록 0.
// 훈음 · 正日은 뷰어 부품을 그대로 쓴다(hunRubyCells + HunCell — 정체 꼴로 찾기, glyphRows — 正 대만 정체 · 日 일본어 표기).
// 한자(중국어 HSK 1–2): HanziBoard — 답 카드의 단어 칩이 같은 저장 · 제외 함수를 쓴다(HANZI-TAB-AL-001).
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
import { hunRubyCells } from '@/lib/viewerHunRuby';
import { glyphRows } from '@/lib/glyphColumn';
import { loadJaWordsTable, loadZhengTable } from '@/lib/glyphTables';
import HunCell from '@/components/viewer/HunCell';
import { alignFurigana } from '@/views/refShared';
import {
  LEVEL_LIST_LANGS, LEVEL_KIND_LABEL, levelKinds, levelLabel, levelPill, levelListHref, jaHeadMode, matchesLevelQuery, splitKnown, fetchSavedLevelKeys,
  LEVEL_PEEK_MS, LEVEL_PREFS_DEFAULT, LEVEL_VIEWS, normalizeLevelPrefs, levelCardShows,
} from '@/lib/levelList';
import HanziBoard from '@/components/levels/HanziBoard';
import '@/components/levels/level-list.css';

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const SpeakerIcon = () => <svg {...svg} width={17} height={17} strokeWidth={1.5}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
const SearchIcon = () => <svg {...svg} width={17} height={17} strokeWidth={1.6}><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-5-5" /></svg>;
const SpinIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.2}><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
const CrossIcon = () => <svg {...svg} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>;
const GearIcon = () => <svg {...svg} width={19} height={19} strokeWidth={1.6}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
const CircleIcon = () => <svg {...svg} strokeWidth={2.2}><circle cx="12" cy="12" r="7" /></svg>;
const PREFS_KEY = 'manabi:level-list-view';

const newId = () => globalThis.crypto.randomUUID();
// 처음엔 150개만 그린다(N3 2,108개를 한 번에 그리면 DOM 예산 초과 — smoke e2e 「vocab performance」). 찾기는 레벨 전체에서 한다.
export const LEVEL_LIST_PAGE = 150;

/** 위 읽기 — 한자 구간에만 루비(alignFurigana 재사용). 정렬이 안 되면 글자만. */
function Ruby({ text, reading }) {
  const segs = alignFurigana(text, reading);
  if (!segs) return text;
  return segs.map((s, i) => (s.rt ? <ruby key={i}>{s.text}<rt>{s.rt}</rt></ruby> : <span key={i}>{s.text}</span>));
}

function Headword({ entry, lang, levelKey, hunCells }) {
  if (lang === 'chinese' && hunCells) return <><span className="lv-hw lv-hw--hun" lang="zh-CN">{hunCells.map((c, i) => <span key={i} className="lv-hc">
    <span className="lv-hc__ch">{c.ch}</span><HunCell cell={c} /></span>)}</span>{entry.reading && <span className="lv-py">{entry.reading}</span>}</>;
  if (lang === 'chinese') return <><span className="lv-hw" lang="zh-CN">{entry.word}</span>{entry.reading && <span className="lv-py">{entry.reading}</span>}</>;
  const hasKanji = entry.reading && entry.reading !== entry.word && alignFurigana(entry.word, entry.reading);
  if (jaHeadMode(levelKey) === 'kana' && hasKanji) return <><span className="lv-hw" lang="ja">{entry.reading}</span><span className="lv-kj" lang="ja">{entry.word}</span></>;
  return <span className="lv-hw" lang="ja">{hasKanji ? <Ruby text={entry.word} reading={entry.reading} /> : entry.word}</span>;
}

function Example({ ex, lang, speak, hideTranslation, hideText = false }) {
  const zh = lang === 'chinese';
  if (hideText) return !hideTranslation && ex.ko ? <p className="lv-ex"><span className="lv-ex__tr">{ex.ko}</span></p> : null;
  return <p className="lv-ex">
    <span className="lv-ex__text" lang={zh ? 'zh-CN' : 'ja'}>{zh ? ex.text : <Ruby text={ex.text} reading={ex.reading} />}</span>
    {speak && <button type="button" className="lv-snd" aria-label="예문 듣기" title="예문 듣기" onClick={() => speak(ex.text)}><SpeakerIcon /></button>}
    {zh && ex.reading && <span className="lv-ex__py">{ex.reading}</span>}
    {!hideTranslation && ex.ko && <span className="lv-ex__tr">{ex.ko}</span>}
  </p>;
}

/** [O] 안다(아는 단어) · [X] 모른다(공부 중인 단어) — 누른 쪽이 채워진다. 아는 단어가 먼저다(저장돼 있어도 O면 O만). */
function OxButtons({ known, studying, saving, pendingKnown, onO, onX }) {
  return <div className="lv-acts">
    <button type="button" className="lv-fab lv-fab--o" aria-pressed={known} aria-label="안다 — 아는 단어로" title="안다"
      onClick={onO} disabled={pendingKnown}><CircleIcon /></button>
    <button type="button" className={`lv-fab lv-fab--x${saving ? ' lv-fab--busy' : ''}`} aria-pressed={!known && studying}
      aria-label={saving ? '공부 중인 단어로 담는 중' : '모른다 — 공부 중인 단어로'} title="모른다"
      aria-disabled={saving || undefined} onClick={saving ? undefined : onX} disabled={pendingKnown}>{saving ? <SpinIcon /> : <CrossIcon />}</button>
  </div>;
}

/** 가린 칸 — 누르면 그 카드가 10초 동안 전부 보인다. */
const Veil = ({ onPeek, wide = false }) => <button type="button" className={`lv-veil${wide ? ' lv-veil--word' : ''}`} aria-label="가린 내용 10초 보기" onClick={onPeek} />;

/** 正(대만 정체) · 日(일본어 표기) 한 줄 — 뷰어 자형 열과 같은 판정(glyphRows). 둘 다 없으면 없음. */
function GlyphLine({ rows }) {
  if (!rows?.zheng && !rows?.ja) return null;
  return <p className="lv-glyph">
    {rows.zheng && <span title="대만 정체"><b aria-label="대만 정체">正</b><span lang="zh-TW">{rows.zheng.form}</span></span>}
    {rows.ja && <span title="일본어 표기"><b aria-label="일본어 표기">日</b><span lang="ja">{rows.ja.form}</span><small lang="ja">{rows.ja.yomi}</small></span>}
  </p>;
}

/**
 * 단어 카드 — [O][X] + 보기 옵션. 가린 칸(Veil)이나 카드의 빈 곳을 누르면 그 카드가 10초 동안 전부 보인다.
 * 표제어(훈음 · 正日 포함)는 [단어]에서만 — [의미]만 볼 때 훈음이 답을 알려 주지 않게 함께 가린다.
 */
export function VocabCard({ entry: e, lang, levelKey, show, onPeek, speak, hunCells, glyph, known, studying, saving, pendingKnown, onO, onX }) {
  // 카드의 빈 곳(버튼 · 링크 밖)을 눌러도 잠깐 보기 — 가린 칸 버튼이 키보드 · 화면 읽기 경로다.
  const tapBlank = show.hidden ? (event) => { if (!event.target.closest('button, a')) onPeek(); } : undefined;
  return <li className="lv-entry" data-known={known || undefined} data-hidden={show.hidden || undefined} onClick={tapBlank}>
    <div className="lv-entry__top">
      <div className="lv-entry__word">{show.word ? <Headword entry={e} lang={lang} levelKey={levelKey} hunCells={hunCells} /> : <Veil onPeek={onPeek} wide />}
        {show.audio && speak && <button type="button" className="lv-snd" aria-label="듣기" title="듣기" onClick={() => speak(e.word)}><SpeakerIcon /></button>}</div>
      <OxButtons known={known} studying={studying} saving={saving} pendingKnown={pendingKnown} onO={onO} onX={onX} />
    </div>
    {show.word && <GlyphLine rows={glyph} />}
    <p className="lv-mean">{show.meaning ? e.meaning : <Veil onPeek={onPeek} />}</p>
    {e.ex && <Example ex={e.ex} lang={lang} speak={show.audio ? speak : null} hideText={!show.sentence} hideTranslation={!show.meaning} />}
  </li>;
}

export default function LevelListPage({ lang, kind, levelKey, groups }) {
  const conf = LEVEL_LIST_LANGS[lang];
  const vocab = kind === 'vocab';
  const hanzi = kind === 'hanzi';
  const wordsOn = vocab || hanzi; // 단어 저장 · 제외를 쓰는 탭
  const pathname = usePathname();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { speak, supported: ttsSupported } = useTTS();
  const say = useCallback((text) => speak(text, conf.language), [speak, conf.language]);
  const known = useKnownWords(conf.langCode, wordsOn && !!userId);

  const [query, setQuery] = useState('');
  const [prefs, setPrefsState] = useState(LEVEL_PREFS_DEFAULT);
  const [peek, setPeek] = useState(() => new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tables, setTables] = useState({});
  const [saved, setSaved] = useState(() => new Set());
  const [saving, setSaving] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [activeGroup, setActiveGroup] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [limit, setLimit] = useState(LEVEL_LIST_PAGE);
  const [jumpTo, setJumpTo] = useState(null);
  const moreRef = useRef(null);
  const pendingExclude = useRef(null);
  const pendingStudy = useRef(null);
  const peekTimers = useRef(new Map());
  const fsrs = useRef(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  // 하이드레이션: 서버 렌더와 첫 화면을 같게 — 계정 상태(저장됨 · 아는 단어)는 붙은 뒤에만 그린다.
  useEffect(() => setMounted(true), []);
  // 보기 설정은 이 기기에 기억한다(붙은 뒤에 읽는다 — 서버 렌더는 기본값).
  useEffect(() => {
    if (!vocab) return;
    try { const raw = localStorage.getItem(PREFS_KEY); if (raw) setPrefsState(normalizeLevelPrefs(JSON.parse(raw))); } catch { /* 저장소 없음 — 기본값 */ }
  }, [vocab]);
  const setPrefs = (patch) => setPrefsState((cur) => {
    const next = normalizeLevelPrefs({ ...cur, ...patch });
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* 저장소 없음 — 이번 화면만 */ }
    return next;
  });
  // 가린 칸을 누르면 그 카드만 10초 동안 전부 보인다. 다시 누르면 10초를 새로 센다.
  const peekCard = useCallback((key) => {
    const timers = peekTimers.current;
    clearTimeout(timers.get(key));
    setPeek((cur) => (cur.has(key) ? cur : new Set(cur).add(key)));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      setPeek((cur) => { const n = new Set(cur); n.delete(key); return n; });
    }, LEVEL_PEEK_MS));
  }, []);
  useEffect(() => () => { for (const t of peekTimers.current.values()) clearTimeout(t); }, []);
  useEffect(() => {
    for (const t of peekTimers.current.values()) clearTimeout(t);
    peekTimers.current.clear();
    setPeek(new Set());
  }, [prefs.view]);

  // 훈음 · 正日 표 — 중국어 단어 목록에서 켠 것만 받는다(뷰어와 같은 표 · 같은 지연 로드 모듈).
  const zhVocab = lang === 'chinese' && vocab;
  useEffect(() => {
    if (!zhVocab || !mounted || !(prefs.hun || prefs.glyph)) return undefined;
    let alive = true;
    const safe = (p) => p.catch(() => ({}));
    const jobs = [safe(loadZhengTable().then((trad) => ({ trad })))];
    if (prefs.hun) jobs.push(safe(Promise.all([import('@/lib/data/hanjaKo.json'), import('@/lib/data/hanjaHun.json')])
      .then(([ko, hun]) => ({ ko: ko.default || ko, hun: hun.default || hun }))));
    if (prefs.glyph) jobs.push(safe(loadJaWordsTable().then((ja) => ({ ja }))));
    Promise.all(jobs).then((parts) => { if (alive) setTables((cur) => Object.assign({}, cur, ...parts)); });
    return () => { alive = false; };
  }, [zhVocab, mounted, prefs.hun, prefs.glyph]);
  const hunOf = useCallback((word) => (zhVocab && prefs.hun && tables.ko && tables.hun
    ? hunRubyCells(word, { koTable: tables.ko, hunTable: tables.hun, tradTable: tables.trad || null }, { glyphPx: 27, hunPx: 12 }) : null),
  [zhVocab, prefs.hun, tables]);
  const glyphOf = useCallback((word) => (zhVocab && prefs.glyph && (tables.trad || tables.ja)
    ? glyphRows({ word, tradTable: tables.trad || null, jaTable: tables.ja || null }) : null), [zhVocab, prefs.glyph, tables]);
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
    if (!wordsOn || !userId) return undefined;
    const client = createFsrsLearningClient({ accountId: userId, getAccountId: () => userRef.current });
    client.start();
    fsrs.current = client;
    return () => { client.dispose?.(); if (fsrs.current === client) fsrs.current = null; };
  }, [wordsOn, userId]);

  // 한자 탭 — 답 카드를 열 때 그 칩 단어들의 「저장됨」만 받아 합친다.
  const loadSaved = useCallback((keys) => {
    if (!userId || !keys?.length) return;
    fetchSavedLevelKeys(supabase, userId, conf.language, keys)
      .then((set) => setSaved((prev) => (set.size ? new Set([...prev, ...set]) : prev)))
      .catch(() => {});
  }, [userId, conf.language]);

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
  // O가 반영되면(아는 단어에 들어오면) — 숨기기를 켰을 때만 카드가 사라지므로 그때만 되돌리기 토스트. 실패는 useKnownWords가 알린다.
  // 아는 단어에 X를 누르면 먼저 아는 단어를 풀고, 풀린 뒤에 공부 중으로 담는다(아는 단어는 저장이 막힌다).
  useEffect(() => {
    const key = pendingExclude.current;
    if (key && knownSet.has(key)) {
      pendingExclude.current = null;
      if (prefs.hideKnown) setToast({ message: '아는 단어로 옮겼어요', action: '되돌리기', onAction: () => { unmark(key); setToast(null); } });
    }
    const study = pendingStudy.current;
    if (study && !knownSet.has(study.key)) {
      pendingStudy.current = null;
      save(study);
    }
  }, [knownSet]); // eslint-disable-line react-hooks/exhaustive-deps
  const markO = (entry) => (knownSet.has(entry.key) ? unmark(entry.key) : exclude(entry));
  const markX = (entry) => {
    if (!userId) return loginToast('로그인하면 단어를 저장할 수 있어요');
    if (!knownSet.has(entry.key)) return save(entry);
    pendingStudy.current = entry;
    unmark(entry.key);
  };

  const hideKnown = vocab && prefs.hideKnown;
  const { shown, knownCount } = useMemo(() => {
    let known = 0;
    const filtered = groups.map((g) => {
      const split = vocab ? splitKnown(g.entries, knownSet) : { shown: g.entries, known: [] };
      known += split.known.length;
      return { name: g.name, entries: (hideKnown ? split.shown : g.entries).filter((e) => matchesLevelQuery(e, query)) };
    });
    return { shown: filtered.filter((g) => g.entries.length), knownCount: known };
  }, [groups, vocab, knownSet, query, hideKnown]);
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
  }, [rest]);
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

  const title = `${levelLabel(levelKey)} ${LEVEL_KIND_LABEL[kind]}`;
  const groupId = (i) => `lv-${kind}-${i}`;
  const nav = shown.map((g, i) => ({ i, name: g.name, href: `#${groupId(i)}`, current: i === activeGroup }));
  const speakOk = mounted && ttsSupported;

  return <div className={`manabi-page lv-page lv-page--${kind}`}>
    <p className="lv-crumb"><Link href={`/lessons?lang=${conf.language}`}>← 교재</Link></p>
    <div className="lv-head">
      <h1>{title}</h1>
      <nav className="lv-pills" aria-label="레벨">
        {conf.levels.map((key) => <Link key={key} href={levelListHref(lang, levelKinds(lang, key).includes(kind) ? kind : 'vocab', key)} aria-current={key === levelKey ? 'page' : undefined}
          aria-label={levelLabel(key)}>{levelPill(key)}</Link>)}
      </nav>
    </div>
    <nav className="lv-tabs" aria-label="목록 종류">
      {levelKinds(lang, levelKey).map((k) => <Link key={k} href={levelListHref(lang, k, levelKey)} aria-current={k === kind ? 'page' : undefined}>{LEVEL_KIND_LABEL[k]}</Link>)}
    </nav>
    {hanzi ? <HanziBoard levelKey={levelKey} groups={groups} userId={mounted ? userId : null} mounted={mounted} say={speakOk ? say : null}
      loginHref={authEntryHref(pathname)} words={{
        knownSet, save, exclude, loadSaved,
        isSaved: (key) => saved.has(key), isSaving: (key) => saving.has(key),
        isPendingKnown: (key) => mounted && !!userId && known.isPendingWord(conf.langCode, key),
      }} /> : <>
    <div className="lv-tools">
      <label className="lv-search"><SearchIcon /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="찾기" aria-label={`${title}에서 찾기`} /></label>
      {vocab && <button type="button" className="lv-gear" aria-label="설정" title="설정" aria-expanded={settingsOpen} aria-controls="lv-settings"
        onClick={() => setSettingsOpen((v) => !v)}><GearIcon /></button>}
    </div>
    {vocab && settingsOpen && <div className="lv-settings" id="lv-settings">
      {[['hideKnown', '아는 단어 숨기기', knownCount > 0 ? `${knownCount}개` : null],
        ...(zhVocab ? [['hun', '훈음', '한자마다 뜻과 소리'], ['glyph', '한자 대조', '正 대만 정체 · 日 일본어 표기']] : [])]
        .map(([key, label, note]) => <button key={key} type="button" role="switch" className="lv-switch" aria-checked={prefs[key]}
          onClick={() => setPrefs({ [key]: !prefs[key] })}><span>{label}{note && <small>{note}</small>}</span><i aria-hidden="true" /></button>)}
    </div>}
    {vocab && <div className="lv-view" role="group" aria-label="보기">
      {LEVEL_VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={prefs.view === v.id}
        onClick={() => setPrefs({ view: v.id })}>{v.label}</button>)}
    </div>}

      <nav className="lv-chips" aria-label="주제">{nav.map((n) => <a key={n.href} href={n.href} aria-current={n.current || undefined} onClick={(e) => openGroup(e, n.i)}>{n.name}</a>)}</nav>
      <div className={vocab ? 'lv-split' : 'lv-split lv-split--wide'}>
        {vocab && <nav aria-label="주제 목차"><ul className="lv-toc">{nav.map((n) => <li key={n.href}><a href={n.href} aria-current={n.current || undefined} onClick={(e) => openGroup(e, n.i)}>{n.name}</a></li>)}</ul></nav>}
        <div className="lv-col">
          {shown.length === 0 && <p className="lv-empty" role="status">{query ? '이 레벨에서 찾지 못했어요' : '모든 단어를 아는 단어로 옮겼어요. 「아는 단어 숨기기」를 끄면 다시 보여요'}</p>}
          {visible.map((g, gi) => g.entries.length > 0 && <section key={g.name} className="lv-group" id={groupId(gi)} data-lv-group={gi} aria-labelledby={`${groupId(gi)}-h`}>
            <h2 id={`${groupId(gi)}-h`}>{g.name}<span>{g.count}</span></h2>
            <ul className="lv-entries">{g.entries.map((e) => vocab ? <VocabCard key={e.key} entry={e} lang={lang} levelKey={levelKey}
              show={levelCardShows(prefs.view, peek.has(e.key))} onPeek={() => peekCard(e.key)} speak={speakOk ? say : null}
              hunCells={hunOf(e.word)} glyph={glyphOf(e.word)}
              known={knownSet.has(e.key)} studying={saved.has(e.key)} saving={saving.has(e.key)}
              pendingKnown={mounted && !!userId && known.isPendingWord(conf.langCode, e.key)}
              onO={() => markO(e)} onX={() => markX(e)} /> : <li key={e.key} className="lv-pat">
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
