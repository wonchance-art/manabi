'use client';
// HSK 단어 페이지(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지 개편 구현 정리」 · 시안 9판) — /chinese/vocab/h1–h7.
// O/X 목록을 FSRS 네 칸 채점 + 한 단어 모드(기본) + 전 레벨 사전 찾기로 바꿨다. 새 표 없음: 뷰어 · 복습실과 같은 단어장 행과 기록을 쓴다
// (채점 한 길 = useLevelWordGrade, 상태 · 미리보기 = levelWordStatus, 세션 줄 = levelWordSession, 글자 칸 = 한자 창 모델).
// 상단 네 줄 중 상단바와 진행바만 붙는다. 로그인 전에는 모두 보이고 네 칸 · ☆만 로그인 안내(보던 카드로 돌아온다), 진행바는 숨긴다.
// 일본어(JLPT) 판은 다음 PR에서 같은 부품(components/levels/word)을 입힌다 — 그때까지 일본어 · 문형 · 한자 목록은 LevelListPage.
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { useTTS } from '@/lib/useTTS';
import { useKnownWords } from '@/lib/useKnownWords';
import { knownWordKeys, knownWordSetOf, normalizeKnownWord } from '@/lib/knownWordControl';
import { authEntryHref } from '@/lib/authRedirect';
import { failureMessage } from '@/lib/errorMessage';
import { reducedMotion } from '@/lib/reducedMotion';
import { fetchVocabularyLearningRows } from '@/lib/vocabularyLearningRows';
import { buildVocabularyWordIndex } from '@/lib/vocabularyDueIndex';
import { preservePendingVocabularyReviews } from '@/lib/viewerVocabularyCache';
import { LEVEL_LIST_LANGS, levelGroupsOf, levelKinds, LEVEL_KIND_LABEL } from '@/lib/levelList';
import {
  HARD_LAPSES, LEVEL_RANGES, OLD_DAYS, daysSinceReview, dueTomorrowCount, entriesInRange, gradePreviews, gradeToastText, lapsesOf,
  levelProgressPercent, levelRowProjection, levelWordGraded, levelWordStatus,
} from '@/lib/levelWordStatus';
import { gradeLevelSession, nextLevelScope, sessionCurrent, sessionDone, startLevelSession, undoLevelSession } from '@/lib/levelWordSession';
import { indexEntry, searchLevelIndex } from '@/lib/levelWordIndex';
import { levelCharTiles, loadLevelCharTables } from '@/lib/levelCharTiles';
import { useLevelWordGrade } from '@/lib/useLevelWordGrade';
import { useHeightSettle } from '@/lib/useHeightSettle';
import { BackIcon, CaretIcon, CharTiles, ClearIcon, SearchIcon, SunIcon, WordRow } from '@/components/levels/word/WordParts';
import { WordCard } from '@/components/levels/word/WordCard';
import { GradeBar, OneWordCard, OneWordDone } from '@/components/levels/word/OneWord';
import { Sheet, TitleSheet, WordPopup } from '@/components/levels/word/WordSheets';
import { WordSearchResults } from '@/components/levels/word/WordSearch';
import '@/components/levels/word/level-word.css';

const PREFS_KEY = 'manabi:level-word';
const RETURN_KEY = 'manabi:level-word-return';
export const LEVEL_WORD_VIEWS = Object.freeze([
  { id: 'all', label: '전체' }, { id: 'word', label: '단어' }, { id: 'sentence', label: '문장' }, { id: 'meaning', label: '뜻' }, { id: 'sound', label: '소리' },
]);
// 처음 범위는 전체, 그 뒤에는 마지막으로 고른 범위를 기억한다(오너 확정 2026-10-19 KST). 한 단어 모드가 기본.
export const LEVEL_WORD_PREFS = Object.freeze({ mode: 'one', view: 'all', range: '전체', tone: true });
export const LEVEL_WORD_LIST_PAGE = 150;
const NOTICE_MS = 8000;
const LANGUAGE = 'Chinese';

export function normalizeLevelWordPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    mode: p.mode === 'list' ? 'list' : 'one',
    view: LEVEL_WORD_VIEWS.some((v) => v.id === p.view) ? p.view : 'all',
    range: LEVEL_RANGES.includes(p.range) ? p.range : '전체',
    tone: p.tone !== false,
  };
}

const readJson = (store, key) => { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (store, key, value) => { try { store.setItem(key, JSON.stringify(value)); } catch { /* 저장소 없음 — 이번 화면만 */ } };

/** 되돌리기 · 로그인 안내 — 네 칸 위에 잠깐. 올라왔다 .15s에 사라지고, 손가락을 올리면 멈춘다. */
function Notice({ notice, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const hold = useRef(false);
  const timer = useRef(null);
  const close = useCallback(() => {
    if (reducedMotion()) return onDone();
    setLeaving(true);
    timer.current = setTimeout(onDone, 150);
    return undefined;
  }, [onDone]);
  const arm = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => { if (!hold.current) close(); }, notice.ms || NOTICE_MS); }, [close, notice]);
  useEffect(() => { setLeaving(false); arm(); return () => clearTimeout(timer.current); }, [arm]);
  const pause = () => { hold.current = true; clearTimeout(timer.current); };
  const resume = () => { hold.current = false; arm(); };
  return <div className={`lw-undo${leaving ? ' is-leaving' : ''}`} role="status" onPointerEnter={pause} onPointerLeave={resume} onFocus={pause} onBlur={resume}>
    <span>{notice.text}</span>
    {notice.href && <Link href={notice.href}>{notice.action}</Link>}
    {notice.onAction && <button type="button" onClick={() => { clearTimeout(timer.current); notice.onAction(); onDone(); }}>{notice.action}</button>}
  </div>;
}

export default function LevelWordPage({ levelKey, groups: rawGroups }) {
  const conf = LEVEL_LIST_LANGS.chinese;
  const level = Number(String(levelKey).slice(1));
  const groups = useMemo(() => levelGroupsOf(rawGroups), [rawGroups]);
  const allEntries = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const byKey = useMemo(() => new Map(allEntries.map((e) => [e.key, e])), [allEntries]);
  const pathname = usePathname();
  const router = useRouter();
  const { user, fetchProfile } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { speak: ttsSpeak, supported: ttsSupported } = useTTS();

  // 하이드레이션: 서버 렌더와 첫 화면을 같게 — 계정 상태 · 기기 설정은 붙은 뒤에만.
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefsState] = useState(LEVEL_WORD_PREFS);
  useLayoutEffect(() => { setPrefsState(normalizeLevelWordPrefs(readJson(localStorage, PREFS_KEY))); setMounted(true); }, []);
  const setPrefs = useCallback((patch) => setPrefsState((cur) => {
    const next = normalizeLevelWordPrefs({ ...cur, ...patch });
    writeJson(localStorage, PREFS_KEY, next);
    return next;
  }), []);
  const speak = useMemo(() => (mounted && ttsSupported ? (text) => ttsSpeak(text, LANGUAGE) : null), [mounted, ttsSupported, ttsSpeak]);

  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(t); }, []);

  // 단어장 색인 — 뷰어와 같은 캐시(['vocab-words', userId]) · 같은 읽기(완전 snapshot)라 한쪽의 채점이 다른 쪽에 바로 보인다.
  const indexQuery = useQuery({
    queryKey: ['vocab-words', userId],
    queryFn: async ({ signal }) => preservePendingVocabularyReviews(buildVocabularyWordIndex(await fetchVocabularyLearningRows(userId, { signal })),
      queryClient.getQueryData(['vocab-words', userId])),
    enabled: mounted && !!userId,
    staleTime: 30_000,
  });
  const index = indexQuery.data;
  const known = useKnownWords('zh', mounted && !!userId);
  const knownSet = useMemo(() => (userId ? knownWordSetOf(known.rows, [], 'zh') : new Set()), [userId, known.rows]);
  // 상태를 셀 수 있는가 — 손님은 바로(모두 ☆), 로그인은 단어장을 받은 뒤. 받기 전에는 상태 칸 자리만.
  const ready = mounted && (!userId || !!index || indexQuery.isError);

  const lookup = useCallback((key) => (userId && index ? levelRowProjection(index, key, LANGUAGE, clock) : { row: null, projection: null }), [userId, index, clock]);
  const infoOf = useCallback((key) => {
    if (!ready) return { status: null, graded: false, projection: null, row: null };
    if (!userId) return { status: 'new', graded: false, projection: null, row: null };
    const { row, projection } = lookup(key);
    const isKnown = knownSet.has(normalizeKnownWord(key));
    const status = levelWordStatus({ projection, known: isKnown, at: clock });
    return { status, graded: levelWordGraded({ projection, known: isKnown }), projection, row, known: isKnown };
  }, [ready, userId, lookup, knownSet, clock]);

  const rangeEntries = useMemo(() => entriesInRange(groups, prefs.range), [groups, prefs.range]);
  const table = useMemo(() => new Map(rangeEntries.map((e) => [e.key, infoOf(e.key)])), [rangeEntries, infoOf]);
  const percent = useMemo(() => levelProgressPercent(rangeEntries.map((e) => e.key), (k) => table.get(k)?.graded), [rangeEntries, table]);

  /** 카드 하나의 표시 값 — 상태 · 네 칸 미리보기 · 어려운 단어 · 오래된 단어. */
  const cardInfo = useCallback((key) => {
    const base = table.get(key) || infoOf(key);
    if (!base.status) return { ...base, previews: null };
    const previews = base.known ? (base.status === 'grad' ? gradePreviews({ projection: null, row: null, at: clock }) : null)
      : gradePreviews({ projection: base.projection, row: base.row, at: clock });
    const hard = lapsesOf(base.projection) >= HARD_LAPSES ? lapsesOf(base.projection) : 0;
    const since = base.status === 'today' ? daysSinceReview(base.projection, clock) : null;
    return { ...base, previews, hard, old: since !== null && since >= OLD_DAYS ? since : null };
  }, [table, infoOf, clock]);

  // 글자 칸 표(훈 · 음 · 정체 · 한자 창) — 붙은 뒤 한 번 받는다. 받기 전에는 칸을 그리지 않는다.
  const [charTables, setCharTables] = useState(null);
  useEffect(() => { if (mounted) loadLevelCharTables().then(setCharTables, () => {}); }, [mounted]);
  const tileCache = useRef(new Map());
  const tilesOf = useCallback((word) => {
    if (!charTables) return null;
    if (!tileCache.current.has(word)) tileCache.current.set(word, levelCharTiles(word, charTables));
    return tileCache.current.get(word);
  }, [charTables]);

  // 알림(되돌리기 · 로그인 안내) — 화면에 하나.
  const [notice, setNotice] = useState(null);
  const dropNotice = useCallback(() => setNotice(null), []);
  const askLogin = useCallback((key, text = '로그인하면 채점이 기록돼요') => {
    writeJson(sessionStorage, RETURN_KEY, { path: pathname, key });
    setNotice({ id: Date.now(), text, action: '로그인', href: authEntryHref(pathname) });
  }, [pathname]);

  const grader = useLevelWordGrade({ user, fetchProfile, language: LANGUAGE, onError: (message) => toast(message, 'error') });
  const [pops, setPops] = useState(() => new Set()); // 막 ☆ → 오늘이 된 단어(한 번 튀어오름)
  const [saving, setSaving] = useState(null);
  const popKey = (key) => setPops((s) => new Set(s).add(key));

  const [limit, setLimit] = useState(LEVEL_WORD_LIST_PAGE);
  const [jumpTo, setJumpTo] = useState(null); // 리스트에서 그 단어로(로그인 뒤 · 다른 레벨 단어 카드에서)

  // ── 한 단어 세션 ──
  const [session, setSession] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [turn, setTurn] = useState(0);
  const scope = `${userId || 'guest'}:${levelKey}:${prefs.range}`;
  const startedFor = useRef(null);
  useEffect(() => {
    if (!ready || startedFor.current === scope) return;
    startedFor.current = scope;
    let next = startLevelSession(rangeEntries, (k) => table.get(k)?.status);
    // 로그인 · 다른 레벨 단어 카드에서 돌아오면 보던 카드부터.
    const back = readJson(sessionStorage, RETURN_KEY);
    const wanted = back?.path === pathname ? back.key : new URLSearchParams(window.location.search).get('w');
    if (wanted && next.queue.includes(wanted)) next = { ...next, queue: [wanted, ...next.queue.filter((k) => k !== wanted)] };
    if (back?.path === pathname) try { sessionStorage.removeItem(RETURN_KEY); } catch { /* 없음 */ }
    setSession(next);
    setRevealed(false);
    if (wanted && byKey.has(wanted)) setJumpTo(wanted);
  }, [ready, scope, rangeEntries, table, pathname, byKey]);
  const currentKey = sessionCurrent(session);
  const current = currentKey ? byKey.get(currentKey) : null;
  const done = sessionDone(session);
  const folded = prefs.mode === 'one' && !!session && session.graded > 0 && !done;
  const rowsRef = useHeightSettle(folded);

  // ── 리스트 ──
  useEffect(() => setLimit(LEVEL_WORD_LIST_PAGE), [prefs.range]);
  useEffect(() => {
    if (!jumpTo || prefs.mode !== 'list') return;
    const at = rangeEntries.findIndex((e) => e.key === jumpTo);
    if (at >= limit) { setLimit(at + 20); return; }
    document.getElementById(`lw-w-${at}`)?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    setJumpTo(null);
  }, [jumpTo, prefs.mode, rangeEntries, limit]);

  // ── 채점 ──
  const inFlight = useRef(new Set());
  const onGrade = useCallback(async (entry, rating) => {
    if (!userId) return askLogin(entry.key);
    if (!ready || inFlight.current.has(entry.key)) return undefined;
    const info = cardInfo(entry.key);
    if (info.known && rating > 1) {
      setNotice({ id: Date.now(), text: '졸업한 단어예요. 「다시」를 누르면 복습으로 돌아와요', ms: 4000 });
      return undefined;
    }
    inFlight.current.add(entry.key);
    const before = session;
    const advance = prefs.mode === 'one' && currentKey === entry.key;
    if (advance) { setSession((s) => gradeLevelSession(s, entry.key, rating)); setRevealed(false); setTurn((n) => n + 1); }
    try {
      if (info.known) {
        // 졸업(아는 단어 표시)한 단어의 「다시」 — 표시를 풀고 복습으로 돌린다(서버가 풀어 준 뒤에만 채점).
        await known.mutation.mutateAsync({ lang: 'zh', wordText: entry.key, known: false, removeKeys: knownWordKeys(known.rows, 'zh', { text: entry.key }, []) });
        await queryClient.refetchQueries({ queryKey: ['vocab-words', userId], exact: true });
      }
      const res = await grader.grade(entry, rating);
      if (!res.ok) {
        if (advance) setSession(before);
        if (res.reason === 'not-due') setNotice({ id: Date.now(), text: '복습실 카드라 복습 차례에만 채점할 수 있어요', href: '/review', action: '복습실', ms: 5000 });
        return undefined;
      }
      setClock(Date.now());
      if (info.status === 'new') popKey(entry.key);
      setNotice({ id: Date.now(), text: gradeToastText(rating, info.previews?.[rating]), action: grader.undoable(res.undo) ? '되돌리기' : null,
        onAction: grader.undoable(res.undo) ? () => undoRef.current?.({ undo: res.undo, sessionBefore: advance ? before : null, key: entry.key }) : null });
      lastRef.current = { undo: res.undo, sessionBefore: advance ? before : null, key: entry.key };
    } catch (error) {
      if (advance) setSession(before);
      toast(failureMessage('채점하지 못했어요.', error), 'error');
    } finally { inFlight.current.delete(entry.key); }
    return undefined;
  }, [userId, ready, askLogin, cardInfo, session, prefs.mode, currentKey, known.mutation, known.rows, queryClient, grader, toast]);

  const lastRef = useRef(null);
  const undoRef = useRef(null);
  const undo = useCallback(async (last = lastRef.current) => {
    if (!last || !grader.undoable(last.undo)) return;
    lastRef.current = null;
    setNotice(null);
    try {
      await grader.undo(last.undo);
      if (last.sessionBefore) { setSession(last.sessionBefore); setRevealed(false); setTurn((n) => n + 1); }
      setClock(Date.now());
      setNotice({ id: Date.now(), text: '되돌렸어요', ms: 2500 });
    } catch (error) {
      toast(failureMessage('되돌리지 못했어요.', error), 'error');
    }
  }, [grader, toast]);
  undoRef.current = undo;

  const onStar = useCallback(async (entry) => {
    if (!userId) return askLogin(entry.key, '로그인하면 단어장에 담을 수 있어요');
    if (saving) return undefined;
    setSaving(entry.key);
    const res = await grader.star(entry);
    setSaving(null);
    if (!res.ok) return undefined;
    setClock(Date.now());
    popKey(entry.key);
    lastRef.current = res.undo ? { undo: res.undo, sessionBefore: null, key: entry.key } : null;
    setNotice({ id: Date.now(), text: '담았어요 · 오늘 복습', action: res.undo ? '되돌리기' : null,
      onAction: res.undo ? () => undoRef.current?.({ undo: res.undo, sessionBefore: null, key: entry.key }) : null });
    return undefined;
  }, [userId, askLogin, saving, grader]);

  // ── 찾기 ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [dict, setDict] = useState({ state: 'idle', entries: null });
  const savedScroll = useRef(0);
  const loadDict = useCallback(() => {
    if (dict.state !== 'idle') return;
    setDict({ state: 'loading', entries: null });
    fetch('/api/level-index/chinese').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => setDict({ state: 'ready', entries: body.rows.map((row, i) => indexEntry(row, i)) }))
      .catch(() => setDict({ state: 'failed', entries: null }));
  }, [dict.state]);
  // 색인을 받지 못하면 지금 레벨 안에서만 찾는다.
  const levelOnly = useMemo(() => allEntries.map((e, i) => indexEntry([e.word, e.reading, e.meaning, level], i)), [allEntries, level]);
  const searchEntries = dict.state === 'ready' ? dict.entries : dict.state === 'failed' ? levelOnly : null;
  const result = useMemo(() => (searchEntries ? searchLevelIndex(searchEntries, deferred, level) : null), [searchEntries, deferred, level]);
  const openSearch = () => { savedScroll.current = window.scrollY; setSearchOpen(true); setSettingsOpen(false); loadDict(); };
  const closeSearch = () => {
    setSearchOpen(false);
    setQuery('');
    requestAnimationFrame(() => window.scrollTo({ top: savedScroll.current }));
  };
  const statusOfWord = useCallback((word) => {
    if (!ready) return null;
    if (!userId) return 'new';
    return infoOf(word).status;
  }, [ready, userId, infoOf]);
  const entryOfRow = (r) => byKey.get(r.word) || { key: r.word, word: r.word, reading: r.reading, meaning: r.meaning, fullMeaning: r.meaning, pos: '' };

  // ── 단어 카드 창 · 예문 단어 창 ──
  const [card, setCard] = useState(null); // { word, row }
  const [pop, setPop] = useState(null); // { text, anchor, id }
  const rowOfWord = useCallback((word) => {
    const e = byKey.get(word);
    if (e) return { word: e.word, reading: e.reading, meaning: e.meaning, level };
    const hit = dict.entries?.find((x) => x.word === word);
    return hit ? { word: hit.word, reading: hit.reading, meaning: hit.meaning, level: hit.level } : { word, reading: '', meaning: '', level: null };
  }, [byKey, dict.entries, level]);
  const onExampleWord = useCallback((text, anchor, id) => { loadDict(); setPop({ text, anchor, id }); }, [loadDict]);

  // ── 상단 · 시트 · 설정 ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  useEffect(() => {
    if (!settingsOpen) return undefined;
    // 해 단추 · 창 밖을 누르거나 Esc면 닫는다(단추 자체는 onClick이 토글).
    const onDown = (event) => { if (!settingsRef.current?.contains(event.target)) setSettingsOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') { setSettingsOpen(false); settingsRef.current?.querySelector('button')?.focus(); } };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [settingsOpen]);
  const progRef = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const el = progRef.current;
      const top = document.querySelector('.lw-top')?.getBoundingClientRect().bottom ?? 0;
      setStuck(!!el && window.scrollY > 0 && el.getBoundingClientRect().top <= top + 1);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [searchOpen]);
  const switchMode = (mode) => {
    if (mode === prefs.mode) return;
    const go = () => flushSync(() => setPrefs({ mode }));
    if (typeof document !== 'undefined' && document.startViewTransition && !reducedMotion()) document.startViewTransition(go); else go();
  };
  const onTitle = () => {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    else setSheetOpen(true);
  };
  const next = nextLevelScope({ levels: conf.levels, levelKey, range: prefs.range, ranges: LEVEL_RANGES });
  const goNext = () => {
    if (!next) return;
    if (next.levelKey === levelKey) { setPrefs({ range: next.range }); window.scrollTo({ top: 0 }); return; }
    setPrefs({ range: next.range });
    router.push(`/chinese/vocab/${next.levelKey.toLowerCase()}`);
  };
  const otherLinks = levelKinds('chinese', levelKey).filter((k) => k !== 'vocab')
    .map((k) => ({ href: `/chinese/${k}/${levelKey.toLowerCase()}`, label: `${LEVEL_KIND_LABEL[k]} 목록` }));

  // ── 키보드 — Space 정답 확인 · 1–4 채점 · Ctrl/⌘+Z 되돌리기(복습실과 같은 키) ──
  const keyState = useRef({});
  keyState.current = { current, revealed, mode: prefs.mode, blocked: searchOpen || sheetOpen || !!card, onGrade, undo };
  useEffect(() => {
    const onKey = (event) => {
      const h = keyState.current;
      const field = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if (field || event.isComposing || event.repeat || event.defaultPrevented || event.altKey) return;
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); h.undo(); return; }
      if (event.metaKey || event.ctrlKey || h.blocked || h.mode !== 'one' || !h.current) return;
      if ((event.key === ' ' || event.key === 'Enter') && !h.revealed && !event.target.closest?.('button, a')) { event.preventDefault(); setRevealed(true); return; }
      if (['1', '2', '3', '4'].includes(event.key)) { event.preventDefault(); h.onGrade(h.current, Number(event.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (done && prefs.mode === 'one' && session?.graded) document.getElementById('lw-done-title')?.focus({ preventScroll: true }); }, [done, prefs.mode, session?.graded]);

  const title = `HSK ${level} 단어`;
  const tone = prefs.tone;
  const currentInfo = current ? cardInfo(current.key) : null;
  const gradeNote = (info) => (info?.status && !info.previews && info.projection?.source === 'fsrs-v1'
    ? `복습실 카드 · ${info.projection.review.nextQuestionAt ? '복습 차례에 채점해요' : '지금은 채점할 수 없어요'}` : null);
  const tomorrow = useMemo(() => (done ? dueTomorrowCount(rangeEntries.map((e) => table.get(e.key)?.projection), clock) : 0), [done, rangeEntries, table, clock]);

  const cardEntry = card ? byKey.get(card.word) : null;
  const popRow = pop ? rowOfWord(pop.text) : null;

  return <div className="lw-page" data-mode={searchOpen ? 'search' : prefs.mode} data-language="zh">
    {searchOpen
      ? <header className="lw-top lw-top--search">
        <button type="button" className="lw-icon" aria-label="찾기 닫기" onClick={closeSearch}><BackIcon /></button>
        <label className="lw-searchbox"><span className="sr-only">단어 찾기</span>
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
            placeholder="한자 · 병음 · 뜻" autoComplete="off" autoCapitalize="off" spellCheck={false} />
          {query && <button type="button" className="lw-icon" aria-label="지우기" onClick={() => setQuery('')}><ClearIcon /></button>}
        </label>
      </header>
      : <header className="lw-top">
        <Link href="/home" className="lw-home" aria-label="manabi 홈" prefetch={false}>
          {/* 앱 아이콘(정적 SVG 32px) — 최적화할 래스터가 아니다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" width={32} height={32} />
        </Link>
        <h1 className="lw-title"><button type="button" onClick={onTitle} title="맨 위로 · 보기 설정">{title}</button></h1>
        <button type="button" className="lw-title__caret lw-icon" aria-label="레벨 · 모드 · 보기 · 범위" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}><CaretIcon /></button>
        <button type="button" className="lw-icon" aria-label="단어 찾기" onClick={openSearch}><SearchIcon /></button>
        <span style={{ position: 'relative' }} ref={settingsRef}>
          <button type="button" className="lw-icon" aria-label="설정" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}><SunIcon /></button>
          {settingsOpen && <div className="lw-settings" role="group" aria-label="화면 설정">
            <label>성조 색<input type="checkbox" checked={tone} onChange={(e) => setPrefs({ tone: e.target.checked })} /></label>
          </div>}
        </span>
      </header>}

    {!searchOpen && <>
      <div className="lw-rows" ref={rowsRef} hidden={folded || undefined}>
        <div className="lw-seg" role="group" aria-label="모드">
          {[['one', '한 단어'], ['list', '리스트']].map(([id, label]) => <button key={id} type="button" aria-pressed={prefs.mode === id} onClick={() => switchMode(id)}>{label}</button>)}
        </div>
        <div className="lw-tabs" role="group" aria-label="보기">
          {LEVEL_WORD_VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={prefs.view === v.id} onClick={() => setPrefs({ view: v.id })}>{v.label}</button>)}
        </div>
      </div>
      <div className="lw-prog" ref={progRef} data-stuck={stuck || undefined}>
        <label className="lw-range"><span className="sr-only">범위</span>
          <select value={prefs.range} onChange={(e) => setPrefs({ range: e.target.value })}>
            {LEVEL_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select><CaretIcon /></label>
        {userId && ready ? <>
          <div className="lw-bar" role="progressbar" aria-label="이 범위에서 채점한 단어" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ '--p': percent / 100 }} /></div>
          <span className="lw-pct">{percent}%</span>
        </> : <span className="lw-bar lw-bar--off" aria-hidden="true" style={{ visibility: 'hidden' }} />}
      </div>
    </>}

    {searchOpen
      ? <WordSearchResults query={deferred} result={result} level={level} loading={dict.state === 'loading'} fallback={dict.state === 'failed'}
        statusOf={statusOfWord} onSave={(r) => onStar(entryOfRow(r))} savingKey={saving} popKey={null} tone={tone}
        onOpen={(r) => setCard({ word: r.word, row: r })} />
      : prefs.mode === 'one'
        ? <div className="lw-one">
          {!session && <p className="lw-empty" aria-busy="true">단어를 고르는 중…</p>}
          {session && done && <OneWordDone graded={session.graded} tomorrow={tomorrow} counts={session.counts}
            onNext={next ? goNext : null} nextLabel={next ? (next.levelKey === levelKey ? next.range : `HSK ${next.levelKey.slice(1)}`) : null}
            onList={() => switchMode('list')} />}
          {session && current && <OneWordCard entry={current} level={level} view={prefs.view} info={currentInfo} tiles={tilesOf(current.word)}
            speak={speak} tone={tone} revealed={revealed} onReveal={() => setRevealed(true)} turnKey={turn ? `${turn}:${current.key}` : null}
            onWord={onExampleWord} openKey={pop?.id} onSave={() => onStar(current)} saving={saving === current.key} pop={pops.has(current.key)} />}
          {session && current && <GradeBar previews={currentInfo.previews} onGrade={(r) => onGrade(current, r)} disabled={!ready} note={gradeNote(currentInfo)} />}
        </div>
        : <>
          <ul className="lw-list">
            {rangeEntries.slice(0, limit).map((e, i) => {
              const info = cardInfo(e.key);
              return <WordCard key={e.key} id={`lw-w-${i}`} entry={e} level={level} view={prefs.view} info={info} tiles={tilesOf(e.word)}
                speak={speak} tone={tone} onGrade={(r) => onGrade(e, r)} onSave={() => onStar(e)} saving={saving === e.key} pop={pops.has(e.key)}
                onWord={onExampleWord} openKey={pop?.id} note={gradeNote(info)} />;
            })}
          </ul>
          {rangeEntries.length > limit && <div className="lw-more"><button type="button" onClick={() => setLimit((n) => n + LEVEL_WORD_LIST_PAGE)}>더 보기 · {rangeEntries.length - limit}개</button></div>}
          {!rangeEntries.length && <p className="lw-empty">이 범위에는 단어가 없어요</p>}
        </>}

    {pop && popRow && <WordPopup anchor={pop.anchor} row={popRow} tiles={tilesOf(pop.text)} tone={tone} status={statusOfWord(pop.text)}
      onSave={() => onStar(entryOfRow(popRow))} onClose={() => setPop(null)}
      onOpen={() => { setCard({ word: pop.text, row: popRow }); setPop(null); }} />}

    {card && <Sheet label={`${card.word} 단어 카드`} onClose={() => setCard(null)}>
      {cardEntry
        ? <ul className="lw-list"><WordCard entry={cardEntry} level={level} view="all" info={cardInfo(cardEntry.key)} tiles={tilesOf(cardEntry.word)}
          speak={speak} tone={tone} onGrade={(r) => onGrade(cardEntry, r)} onSave={() => onStar(cardEntry)} saving={saving === cardEntry.key}
          pop={pops.has(cardEntry.key)} note={gradeNote(cardInfo(cardEntry.key))} /></ul>
        : <div className="lw-card">
          <WordRow word={card.row.word} reading={card.row.reading} meaning={card.row.meaning || '사전에 없는 단어예요'} level={card.row.level}
            status={statusOfWord(card.row.word)} tone={tone} onSave={() => onStar(entryOfRow(card.row))} saving={saving === card.row.word} pop={pops.has(card.row.word)} />
          <CharTiles tiles={tilesOf(card.row.word)} />
          {card.row.level && <Link className="lw-pop__open" href={`/chinese/vocab/h${card.row.level}?w=${encodeURIComponent(card.row.word)}`}>HSK {card.row.level} 단어에서 보기 ›</Link>}
        </div>}
    </Sheet>}

    {sheetOpen && <TitleSheet levels={conf.levels} levelKey={levelKey} mode={prefs.mode} view={prefs.view} range={prefs.range}
      views={LEVEL_WORD_VIEWS} ranges={LEVEL_RANGES} links={otherLinks}
      onMode={(m) => { switchMode(m); }} onView={(v) => setPrefs({ view: v })} onRange={(r) => setPrefs({ range: r })} onClose={() => setSheetOpen(false)} />}

    {notice && <Notice key={notice.id} notice={notice} onDone={dropNotice} />}
  </div>;
}
