'use client';
// 레벨 단어 페이지 공통 화면(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지 개편 구현 정리」) — HSK(/chinese/vocab/h1–h7) · JLPT(/japanese/vocab/n5–n1).
// O/X 목록을 FSRS 네 칸 채점 + 한 단어 모드(기본) + 전 레벨 사전 찾기로 바꿨다. 새 표 없음: 뷰어 · 복습실과 같은 단어장 행과 기록을 쓴다
// (채점 한 길 = useLevelWordGrade, 상태 · 미리보기 = levelWordStatus, 세션 줄 = levelWordSession, 글자 칸 = 한자 창 모델).
// 상단 네 줄 중 상단바와 진행바만 붙는다. 로그인 전에는 모두 보이고 네 칸 · ☆만 로그인 안내(보던 카드로 돌아온다), 진행바는 숨긴다.
// 언어마다 다른 것(문구 · 읽기 줄 · 글자 칸 · 색인)은 판(cfg)으로 받는다 — 판은 views/LevelWordPage(HSK) · views/JlptWordPage(JLPT).
// 이 화면은 언어 값을 직접 적지 않는다(일본어 라우트가 중국어 글꼴 범위 밖에 남게 — fontScope 계약).
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
  HARD_LAPSES, OLD_DAYS, daysSinceReview, dueTomorrowCount, gradePreviews, gradeToastText, lapsesOf,
  levelProgressPercent, levelRowProjection, levelWordGraded, levelWordStatus, nextDueMs, todayAgainAt,
} from '@/lib/levelWordStatus';
import {
  gradeLevelSession, nextLevelKey, sessionCurrent, sessionDone, sessionDue, sessionHas, sessionNextAt, sessionOrder, sessionWaiting,
  startLevelSession,
} from '@/lib/levelWordSession';
import { indexEntry, searchLevelIndex } from '@/lib/levelWordIndex';
import { useLevelWordGrade } from '@/lib/useLevelWordGrade';
import { useHeightSettle } from '@/lib/useHeightSettle';
import { BackIcon, CaretIcon, CharTiles, ClearIcon, SearchIcon, SunIcon, WordRow } from '@/components/levels/word/WordParts';
import { WordCard } from '@/components/levels/word/WordCard';
import { GradeBar, OneWordCard, OneWordDone } from '@/components/levels/word/OneWord';
import { Sheet, TitleSheet, WordPopup } from '@/components/levels/word/WordSheets';
import { WordSearchResults } from '@/components/levels/word/WordSearch';
import { WordLangContext } from '@/components/levels/word/wordLang';
import '@/components/levels/word/level-word.css';

const RETURN_KEY = 'manabi:level-word-return';

// 카드 움직임(오너 2026-10-20 KST 「애니메이션 시안」 추천 조합) — 한 단어: 왼쪽으로 밀려남(0.18초) → 오른쪽에서 들어옴(CSS lwCardIn).
// 리스트: 채점한 카드가 접히며 사라지고(0.24초, 아래 카드가 따라 올라옴) · 시간이 된 카드는 자리가 펼쳐진 뒤 테두리 한 번 반짝(is-arrived).
// 높이는 CSS로 auto까지 못 늘려 Web Animations로 잰다. 동작 줄이기면 없다.
const EASE = 'cubic-bezier(0.23,1,0.32,1)';
const LIST_GAP = 12; // .lw-list gap — 접힌 카드 자리의 간격까지 거둔다
const SHUT = { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px', borderBottomWidth: '0px' };
// 시작 시각을 지금으로 박는다 — 큰 목록을 다시 그린 직후에는 문서 시계가 그 앞 프레임에 머물러 있어(실측 0.34초)
// 그대로 두면 펼침이 시작하자마자 끝난다. 시계가 따라올 때까지는 첫 장면(backwards)을 보인다.
function play(el, frames, duration, fill) {
  const anim = el.animate(frames, { duration, easing: EASE, fill });
  anim.startTime = performance.now();
  return anim;
}
function playLeave(el, one) {
  if (one) return play(el, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24px)', opacity: 0 }], 180, 'both');
  el.style.overflow = 'hidden';
  return play(el, [{ height: `${el.offsetHeight}px`, opacity: 1, marginBottom: '0px' }, { ...SHUT, marginBottom: `-${LIST_GAP}px` }], 240, 'both');
}
function playArrive(el) {
  const h = el.offsetHeight;
  el.style.overflow = 'hidden';
  const open = play(el, [{ ...SHUT, marginTop: `-${LIST_GAP}px`, boxSizing: 'border-box' }, { height: `${h}px`, opacity: 1, marginTop: '0px', boxSizing: 'border-box' }], 200, 'backwards');
  open.finished.then(() => {
    el.style.overflow = '';
    el.classList.add('is-arrived');
    el.addEventListener('animationend', () => el.classList.remove('is-arrived'), { once: true });
  }, () => { el.style.overflow = ''; });
}

export const LEVEL_WORD_VIEWS = Object.freeze([
  { id: 'all', label: '전체' }, { id: 'word', label: '단어' }, { id: 'sentence', label: '문장' }, { id: 'meaning', label: '뜻' }, { id: 'sound', label: '소리' },
]);
// 한 단어 모드가 기본. 품사 범위(전체 ▾)는 없앴다 — 늘 레벨 전체(오너 2026-10-20 KST 「그 기능은 아예 없애」).
export const LEVEL_WORD_PREFS = Object.freeze({ mode: 'one', view: 'all', tone: true });
export const LEVEL_WORD_LIST_PAGE = 150;
const NOTICE_MS = 8000;

export function normalizeLevelWordPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    mode: p.mode === 'list' ? 'list' : 'one',
    view: LEVEL_WORD_VIEWS.some((v) => v.id === p.view) ? p.view : 'all',
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

export default function LevelWordScreen({ cfg, levelKey, groups: rawGroups }) {
  const conf = LEVEL_LIST_LANGS[cfg.lang];
  const language = cfg.language;
  const level = cfg.levelOf(levelKey);
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
  // 기기 설정은 언어마다 따로(cfg.prefsKey) — HSK 「성조 색」과 JLPT 「예문 후리가나」가 같은 칸(tone)이라 서로 끄지 않게.
  useLayoutEffect(() => { setPrefsState(normalizeLevelWordPrefs(readJson(localStorage, cfg.prefsKey))); setMounted(true); }, [cfg.prefsKey]);
  const setPrefs = useCallback((patch) => setPrefsState((cur) => {
    const next = normalizeLevelWordPrefs({ ...cur, ...patch });
    writeJson(localStorage, cfg.prefsKey, next);
    return next;
  }), [cfg.prefsKey]);
  const speak = useMemo(() => (mounted && ttsSupported ? (text) => ttsSpeak(text, language) : null), [mounted, ttsSupported, ttsSpeak, language]);

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
  const known = useKnownWords(cfg.code, mounted && !!userId);
  const knownSet = useMemo(() => (userId ? knownWordSetOf(known.rows, [], cfg.code) : new Set()), [userId, known.rows, cfg.code]);
  // 상태를 셀 수 있는가 — 손님은 바로(모두 ☆), 로그인은 단어장을 받은 뒤. 받기 전에는 상태 칸 자리만.
  const ready = mounted && (!userId || !!index || indexQuery.isError);

  const lookup = useCallback((key) => (userId && index ? levelRowProjection(index, key, language, clock) : { row: null, projection: null }), [userId, index, clock, language]);
  const infoOf = useCallback((key) => {
    if (!ready) return { status: null, graded: false, projection: null, row: null };
    if (!userId) return { status: 'new', graded: false, projection: null, row: null };
    const { row, projection } = lookup(key);
    const isKnown = knownSet.has(normalizeKnownWord(key));
    const status = levelWordStatus({ projection, known: isKnown, at: clock });
    return { status, graded: levelWordGraded({ projection, known: isKnown }), projection, row, known: isKnown };
  }, [ready, userId, lookup, knownSet, clock]);

  const table = useMemo(() => new Map(allEntries.map((e) => [e.key, infoOf(e.key)])), [allEntries, infoOf]);
  const percent = useMemo(() => levelProgressPercent(allEntries.map((e) => e.key), (k) => table.get(k)?.graded), [allEntries, table]);

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

  // 글자 칸 표(판의 loadTiles — 훈 · 음 · 정체/정자 · 한자 창) — 붙은 뒤 한 번 받는다. 받기 전에는 칸을 그리지 않는다.
  // kr = 글자별 읽기(JLPT — 빌드 때 실은 「けい,けん」).
  const [charTables, setCharTables] = useState(null);
  useEffect(() => { if (mounted) cfg.loadTiles().then(setCharTables, () => setCharTables(false)); }, [mounted, cfg]);
  const tileCache = useRef(new Map());
  const tilesOf = useCallback((word, kr) => {
    if (!charTables) return null;
    const k = `${word}\u0000${kr || ''}`;
    if (!tileCache.current.has(k)) tileCache.current.set(k, cfg.tilesOf(word, kr, charTables));
    return tileCache.current.get(k);
  }, [charTables, cfg]);

  // 알림(되돌리기 · 로그인 안내) — 화면에 하나.
  const [notice, setNotice] = useState(null);
  const dropNotice = useCallback(() => setNotice(null), []);
  const askLogin = useCallback((key, text = '로그인하면 채점이 기록돼요') => {
    writeJson(sessionStorage, RETURN_KEY, { path: pathname, key });
    setNotice({ id: Date.now(), text, action: '로그인', href: authEntryHref(pathname) });
  }, [pathname]);

  const grader = useLevelWordGrade({ user, fetchProfile, language, onError: (message) => toast(message, 'error') });
  const [pops, setPops] = useState(() => new Set()); // 막 ☆ → 오늘이 된 단어(한 번 튀어오름)
  const [saving, setSaving] = useState(null);
  const popKey = (key) => setPops((s) => new Set(s).add(key));

  const [limit, setLimit] = useState(LEVEL_WORD_LIST_PAGE);
  const [jumpTo, setJumpTo] = useState(null); // 리스트에서 그 단어로(로그인 뒤 · 다른 레벨 단어 카드에서)

  // ── 한 단어 세션 ──
  const [session, setSession] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [turn, setTurn] = useState(0);
  const leaving = useRef(false); // 나가는 움직임 동안은 다음 채점을 받지 않는다(줄이 어긋나지 않게)
  const scope = `${userId || 'guest'}:${levelKey}`;
  const startedFor = useRef(null);
  useEffect(() => {
    if (!ready || startedFor.current === scope) return;
    startedFor.current = scope;
    let next = startLevelSession(allEntries, (k) => table.get(k)?.status, (k) => nextDueMs(table.get(k)?.projection), Date.now());
    // 로그인 · 다른 레벨 단어 카드에서 돌아오면 보던 카드부터.
    const back = readJson(sessionStorage, RETURN_KEY);
    const wanted = back?.path === pathname ? back.key : new URLSearchParams(window.location.search).get('w');
    if (wanted && next.queue.includes(wanted)) next = { ...next, queue: [wanted, ...next.queue.filter((k) => k !== wanted)] };
    if (back?.path === pathname) try { sessionStorage.removeItem(RETURN_KEY); } catch { /* 없음 */ }
    setSession(next);
    setHeadKey(wanted && next.queue.includes(wanted) ? wanted : null);
    setRevealed(false);
    if (wanted && byKey.has(wanted)) setJumpTo(wanted);
  }, [ready, scope, allEntries, table, pathname, byKey]);
  // 기다리던 카드의 시각이 되면 다시 그린다(맨 위로 올라온다).
  const nextAt = sessionNextAt(session, clock);
  useEffect(() => {
    if (!nextAt) return undefined;
    const t = setTimeout(() => setClock(Date.now()), Math.max(0, nextAt - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [nextAt]);
  // 지금 보고 있는 카드(head) — 두 모드가 같이 쓴다. 기다리던 카드가 시간이 돼도 보던 카드를 밀어내지 않고 바로 다음 차례로 선다.
  // head가 줄에서 빠지면(채점) 다음 차례 = 시간이 된 카드 → 오늘 복습 · 새 단어 → (그것도 없으면) 가장 먼저 될 기다리는 카드.
  const [headKey, setHeadKey] = useState(null);
  const head = !session ? null : sessionOrder(session, clock).includes(headKey) ? headKey : sessionCurrent(session, clock);
  useEffect(() => { if (head !== headKey) setHeadKey(head); }, [head, headKey]);
  const currentKey = head;
  const current = currentKey ? byKey.get(currentKey) : null;
  const done = sessionDone(session);
  // 모드 · 보기 줄은 첫 채점 뒤 접힌다(두 모드 모두 — 문서 「상단 네 줄」). 다시 바꾸려면 제목 시트.
  const folded = !!session && session.graded > 0 && !done;
  const rowsRef = useHeightSettle(folded);

  // ── 리스트 — 같은 오늘 할 줄: ① 시간이 된 카드 ② 오늘 복습 · 새 단어 ③ 기다리는 카드(남은 시간), 그 밖(내일 이후 · 졸업)은 「다음에 볼 단어」에 접는다 ──
  const [laterOpen, setLaterOpen] = useState(false);
  const [laterLimit, setLaterLimit] = useState(LEVEL_WORD_LIST_PAGE);
  const listed = useMemo(() => {
    if (!session) return null;
    const due = sessionDue(session, clock);
    const waiting = sessionWaiting(session, clock);
    const pick = (keys) => keys.map((k) => byKey.get(k)).filter(Boolean);
    const order = sessionOrder(session, clock);
    const active = pick(order.includes(head) ? [head, ...order.filter((k) => k !== head)] : order);
    return { active, due: new Set(due), waiting: waiting.map((w) => ({ entry: byKey.get(w.key), at: w.at })).filter((w) => w.entry),
      later: allEntries.filter((e) => !sessionHas(session, e.key)) };
  }, [session, clock, head, byKey, allEntries]);
  const cardEl = (key) => document.querySelector(`.lw-list[data-main] .lw-card[data-key="${CSS.escape(key)}"]`);
  // 기다리던 카드가 시간이 되어 지금 카드 다음 자리로 올라오면 펼쳐 보인다(처음 그릴 때 · 지금 카드는 빼고).
  const dueSeen = useRef(null);
  useLayoutEffect(() => {
    if (!listed || prefs.mode !== 'list') { dueSeen.current = null; return; }
    const prev = dueSeen.current;
    dueSeen.current = listed.due;
    if (!prev || reducedMotion()) return;
    for (const key of listed.due) {
      const el = !prev.has(key) && key !== head ? cardEl(key) : null;
      if (el?.animate) playArrive(el);
    }
  }, [listed, prefs.mode, head]);
  useEffect(() => {
    if (!jumpTo || prefs.mode !== 'list' || charTables === null || !listed) return; // charTables false = 표를 못 받음(칸 없이 옮긴다)
    const at = listed.active.findIndex((e) => e.key === jumpTo);
    if (at >= limit) { setLimit(at + 20); return; }
    const later = listed.later.findIndex((e) => e.key === jumpTo);
    if (later >= 0 && (!laterOpen || later >= laterLimit)) { setLaterOpen(true); setLaterLimit(Math.max(laterLimit, later + 20)); return; }
    // 글자 칸 표가 붙은 뒤(카드 높이가 정해진 뒤)에 바로 옮긴다 — 먼 거리를 부드럽게 굴리면 그사이 위 카드가 자라 다른 단어에 멈췄다(?w=準備 실측).
    const go = () => cardEl(jumpTo)?.scrollIntoView({ block: 'center' });
    go();
    const raf = requestAnimationFrame(go);
    pickCard(jumpTo);
    setJumpTo(null);
    return () => cancelAnimationFrame(raf);
  }, [jumpTo, prefs.mode, listed, limit, laterOpen, laterLimit, charTables]); // eslint-disable-line react-hooks/exhaustive-deps

  // 리스트의 채점 대상(아래 네 칸) = 줄 맨 위 카드(head). 카드를 누르면 그 카드(오너 확정 2026-10-19 KST 「아래 고정」 · 「오늘 할 줄」).
  // 누른 카드를 채점하면 그 다음 카드가 대상으로 이어지고, 맨 위 카드를 채점하면 다음 차례가 맨 위로 온다.
  const [focusKey, setFocusKey] = useState(null);
  const [shownOld, setShownOld] = useState(() => new Set()); // 「N일 만에」 카드 중 단어를 본 것 — 보기 전에는 네 칸을 잠근다
  const pickCard = useCallback((key) => setFocusKey(key), []);
  const listOrder = useMemo(() => (listed ? [...listed.active.slice(0, limit), ...listed.waiting.map((w) => w.entry),
    ...(laterOpen ? listed.later.slice(0, laterLimit) : [])] : []), [listed, limit, laterOpen, laterLimit]);
  const focusEntry = prefs.mode === 'list' ? listOrder.find((e) => e.key === focusKey) || listOrder[0] || null : null;
  const focusInfo = focusEntry ? cardInfo(focusEntry.key) : null;
  const focusLocked = !!focusInfo && focusInfo.old != null && prefs.view === 'all' && !shownOld.has(focusEntry.key);
  const listCard = (e, { due = false, wait = null } = {}) => <WordCard key={e.key} entry={e} level={level} view={prefs.view} info={cardInfo(e.key)}
    tiles={tilesOf(e.word, e.kr)} speak={speak} tone={prefs.tone} onSave={() => onStar(e)} saving={saving === e.key} pop={pops.has(e.key)}
    onWord={onExampleWord} openKey={pop?.id} focused={e.key === focusEntry?.key} onPick={() => pickCard(e.key)} due={due} wait={wait}
    onShow={() => setShownOld((set) => new Set(set).add(e.key))} />;
  const followFocus = useCallback((key) => {
    const at = listOrder.findIndex((e) => e.key === key);
    setFocusKey(key !== head && at >= 0 ? listOrder[at + 1]?.key ?? null : null);
  }, [listOrder, head]);

  // ── 채점 ──
  const inFlight = useRef(new Set());
  const onGrade = useCallback(async (entry, rating, opts = {}) => {
    if (!userId) return askLogin(entry.key);
    if (!ready || inFlight.current.has(entry.key) || leaving.current) return undefined;
    const info = cardInfo(entry.key);
    if (info.known && rating > 1) {
      setNotice({ id: Date.now(), text: '졸업한 단어예요. 「다시」를 누르면 복습으로 돌아와요', ms: 4000 });
      return undefined;
    }
    inFlight.current.add(entry.key);
    const before = session;
    // 오늘 할 줄에서 옮긴다(다음 차례가 오늘 안이면 기다리는 카드로, 아니면 줄에서 빠진다) — 기록을 기다리지 않고 먼저.
    const moved = gradeLevelSession(session, entry.key, rating, todayAgainAt(info.previews?.[rating]));
    const advance = moved !== session;
    if (advance) {
      const one = prefs.mode === 'one';
      const el = reducedMotion() ? null : one ? (currentKey === entry.key ? document.querySelector('.lw-one__card') : null) : cardEl(entry.key);
      let anim = null;
      if (el?.animate) {
        leaving.current = true;
        anim = playLeave(el, one);
        await anim.finished.catch(() => {});
        leaving.current = false;
      }
      flushSync(() => {
        if (opts.next) followFocus(entry.key);
        setSession(moved);
        if (one && currentKey === entry.key) { setRevealed(false); setTurn((n) => n + 1); }
      });
      if (anim) { anim.cancel(); el.style.overflow = ''; } // 같은 카드가 다시 그려져도 접힌 채 남지 않게
    }
    try {
      if (info.known) {
        // 졸업(아는 단어 표시)한 단어의 「다시」 — 표시를 풀고 복습으로 돌린다(서버가 풀어 준 뒤에만 채점).
        await known.mutation.mutateAsync({ lang: cfg.code, wordText: entry.key, known: false, removeKeys: knownWordKeys(known.rows, cfg.code, { text: entry.key }, []) });
        await queryClient.refetchQueries({ queryKey: ['vocab-words', userId], exact: true });
      }
      const res = await grader.grade(entry, rating);
      if (!res.ok) {
        if (advance) { setSession(before); setHeadKey(head); }
        if (res.reason === 'not-due') setNotice({ id: Date.now(), text: '복습실 카드라 복습 차례에만 채점할 수 있어요', href: '/review', action: '복습실', ms: 5000 });
        return undefined;
      }
      setClock(Date.now());
      if (info.status === 'new') popKey(entry.key);
      setNotice({ id: Date.now(), text: gradeToastText(rating, info.previews?.[rating]), action: grader.undoable(res.undo) ? '되돌리기' : null,
        onAction: grader.undoable(res.undo) ? () => undoRef.current?.({ undo: res.undo, sessionBefore: advance ? before : null, headBefore: advance ? head : null, key: entry.key }) : null });
      lastRef.current = { undo: res.undo, sessionBefore: advance ? before : null, headBefore: advance ? head : null, key: entry.key };
    } catch (error) {
      if (advance) { setSession(before); setHeadKey(head); }
      toast(failureMessage('채점하지 못했어요.', error), 'error');
    } finally { inFlight.current.delete(entry.key); }
    return undefined;
  }, [userId, ready, askLogin, cardInfo, session, prefs.mode, currentKey, head, followFocus, known.mutation, known.rows, queryClient, grader, toast, cfg.code]);

  const lastRef = useRef(null);
  const undoRef = useRef(null);
  const undo = useCallback(async (last = lastRef.current) => {
    if (!last || !grader.undoable(last.undo)) return;
    lastRef.current = null;
    setNotice(null);
    try {
      await grader.undo(last.undo);
      if (last.sessionBefore) { setSession(last.sessionBefore); setHeadKey(last.headBefore); setRevealed(false); setTurn((n) => n + 1); }
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
    fetch(cfg.indexUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => setDict({ state: 'ready', entries: body.rows.map((row, i) => indexEntry(row, i, cfg.mode)) }))
      .catch(() => setDict({ state: 'failed', entries: null }));
  }, [dict.state, cfg]);
  // 색인을 받지 못하면 지금 레벨 안에서만 찾는다.
  const levelOnly = useMemo(() => allEntries.map((e, i) => indexEntry([e.word, e.reading, e.meaning, level, e.kr], i, cfg.mode)), [allEntries, level, cfg.mode]);
  const searchEntries = dict.state === 'ready' ? dict.entries : dict.state === 'failed' ? levelOnly : null;
  const result = useMemo(() => (searchEntries ? searchLevelIndex(searchEntries, deferred, level, { mode: cfg.mode, levelRank: cfg.levelRank }) : null),
    [searchEntries, deferred, level, cfg]);
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
  const entryOfRow = (r) => byKey.get(r.word) || { key: r.word, word: r.word, reading: r.reading, meaning: r.meaning, fullMeaning: r.meaning, pos: '', kr: r.kr };

  // ── 단어 카드 창 · 예문 단어 창 ──
  const [card, setCard] = useState(null); // { word, row }
  const [pop, setPop] = useState(null); // { text, anchor, id }
  const rowOfWord = useCallback((word) => {
    const e = byKey.get(word);
    if (e) return { word: e.word, reading: e.reading, meaning: e.meaning, level, kr: e.kr };
    const hit = dict.entries?.find((x) => x.word === word);
    return hit ? { word: hit.word, reading: hit.reading, meaning: hit.meaning, level: hit.level, kr: hit.kr } : { word, reading: '', meaning: '', level: null };
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
  const next = nextLevelKey(conf.levels, levelKey);
  const goNext = () => { if (next) router.push(cfg.levelHref(next)); };
  const otherLinks = levelKinds(cfg.lang, levelKey).filter((k) => k !== 'vocab')
    .map((k) => ({ href: `/${cfg.lang}/${k}/${levelKey.toLowerCase()}`, label: `${LEVEL_KIND_LABEL[k]} 목록` }));

  // ── 키보드 — Space 정답 확인 · 1–4 채점(리스트는 아래 네 칸의 대상 카드) · Ctrl/⌘+Z 되돌리기(복습실과 같은 키) ──
  const keyState = useRef({});
  keyState.current = { current, revealed, mode: prefs.mode, blocked: searchOpen || sheetOpen || !!card, onGrade, undo, focus: focusLocked ? null : focusEntry };
  useEffect(() => {
    const onKey = (event) => {
      const h = keyState.current;
      const field = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if (field || event.isComposing || event.repeat || event.defaultPrevented || event.altKey) return;
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); h.undo(); return; }
      if (event.metaKey || event.ctrlKey || h.blocked) return;
      if (h.mode === 'list') { if (h.focus && ['1', '2', '3', '4'].includes(event.key)) { event.preventDefault(); h.onGrade(h.focus, Number(event.key), { next: true }); } return; }
      if (h.mode !== 'one' || !h.current) return;
      if ((event.key === ' ' || event.key === 'Enter') && !h.revealed && !event.target.closest?.('button, a')) { event.preventDefault(); setRevealed(true); return; }
      if (['1', '2', '3', '4'].includes(event.key)) { event.preventDefault(); h.onGrade(h.current, Number(event.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (done && prefs.mode === 'one' && session?.graded) document.getElementById('lw-done-title')?.focus({ preventScroll: true }); }, [done, prefs.mode, session?.graded]);

  const title = cfg.title(level);
  const tone = prefs.tone;
  const currentInfo = current ? cardInfo(current.key) : null;
  const gradeNote = (info) => (info?.status && !info.previews && info.projection?.source === 'fsrs-v1'
    ? `복습실 카드 · ${info.projection.review.nextQuestionAt ? '복습 차례에 채점해요' : '지금은 채점할 수 없어요'}` : null);
  const tomorrow = useMemo(() => (done ? dueTomorrowCount(allEntries.map((e) => table.get(e.key)?.projection), clock) : 0), [done, allEntries, table, clock]);

  const cardEntry = card ? byKey.get(card.word) : null;
  const popRow = pop ? rowOfWord(pop.text) : null;

  return <WordLangContext.Provider value={cfg}><div className="lw-page" data-mode={searchOpen ? 'search' : prefs.mode} data-language={cfg.code}>
    {searchOpen
      ? <header className="lw-top lw-top--search">
        <button type="button" className="lw-icon" aria-label="찾기 닫기" onClick={closeSearch}><BackIcon /></button>
        <label className="lw-searchbox"><span className="sr-only">단어 찾기</span>
          <SearchIcon size={18} />
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search"
            placeholder={cfg.placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false} />
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
        <button type="button" className="lw-title__caret lw-icon" aria-label="레벨 · 모드 · 보기" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}><CaretIcon /></button>
        <button type="button" className="lw-icon" aria-label="단어 찾기" onClick={openSearch}><SearchIcon /></button>
        <span style={{ position: 'relative' }} ref={settingsRef}>
          <button type="button" className="lw-icon" aria-label="설정" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}><SunIcon /></button>
          {settingsOpen && <div className="lw-settings" role="group" aria-label="화면 설정">
            <label>{cfg.aidLabel}<input type="checkbox" checked={tone} onChange={(e) => setPrefs({ tone: e.target.checked })} /></label>
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
      {userId && <div className="lw-prog" ref={progRef} data-stuck={stuck || undefined}>
        {ready ? <>
          <div className="lw-bar" role="progressbar" aria-label="이 레벨에서 채점한 단어" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ '--p': percent / 100 }} /></div>
          <span className="lw-pct">{percent}%</span>
        </> : <span className="lw-bar lw-bar--off" aria-hidden="true" style={{ visibility: 'hidden' }} />}
      </div>}
    </>}

    {searchOpen
      ? <WordSearchResults query={deferred} result={result} level={level} loading={dict.state === 'loading'} fallback={dict.state === 'failed'}
        statusOf={statusOfWord} onSave={(r) => onStar(entryOfRow(r))} savingKey={saving} popKey={null} tone={tone}
        onOpen={(r) => setCard({ word: r.word, row: r })} />
      : prefs.mode === 'one'
        ? <div className="lw-one">
          {!session && <p className="lw-empty" aria-busy="true">단어를 고르는 중…</p>}
          {session && done && <OneWordDone graded={session.graded} tomorrow={tomorrow} counts={session.counts}
            onNext={next ? goNext : null} nextLabel={next ? cfg.tag(cfg.levelOf(next)) : null}
            onList={() => switchMode('list')} />}
          {session && current && <OneWordCard entry={current} view={prefs.view} info={currentInfo} tiles={tilesOf(current.word, current.kr)}
            speak={speak} tone={tone} revealed={revealed} onReveal={() => setRevealed(true)} turnKey={turn ? `${turn}:${current.key}` : null}
            onWord={onExampleWord} openKey={pop?.id} />}
          {session && current && <GradeBar previews={currentInfo.previews} onGrade={(r) => onGrade(current, r)} disabled={!ready} note={gradeNote(currentInfo)} guide={revealed} />}
        </div>
        : <>
          {!listed && <p className="lw-empty" aria-busy="true">단어를 고르는 중…</p>}
          {listed && <>
            {listed.active.length > 0 && <ul className="lw-list" data-main="">{listed.active.slice(0, limit).map((e) => listCard(e, { due: listed.due.has(e.key) }))}</ul>}
            {listed.active.length > limit && <div className="lw-more"><button type="button" onClick={() => setLimit((n) => n + LEVEL_WORD_LIST_PAGE)}>더 보기 · {listed.active.length - limit}개</button></div>}
            {listed.waiting.length > 0 && <ul className="lw-list" data-main="" aria-label="기다리는 카드">{listed.waiting.map((w) => listCard(w.entry, { wait: w.at }))}</ul>}
            {!listed.active.length && !listed.waiting.length && allEntries.length > 0 && <p className="lw-empty">오늘 이 레벨은 다 봤어요</p>}
            {listed.later.length > 0 && <>
              <button type="button" className="lw-later" aria-expanded={laterOpen} onClick={() => setLaterOpen((v) => !v)}>
                다음에 볼 단어 {listed.later.length}개<CaretIcon /></button>
              {laterOpen && <ul className="lw-list" data-main="" aria-label="다음에 볼 단어">{listed.later.slice(0, laterLimit).map((e) => listCard(e))}</ul>}
              {laterOpen && listed.later.length > laterLimit && <div className="lw-more">
                <button type="button" onClick={() => setLaterLimit((n) => n + LEVEL_WORD_LIST_PAGE)}>더 보기 · {listed.later.length - laterLimit}개</button></div>}
            </>}
          </>}
          {!allEntries.length && <p className="lw-empty">이 레벨에는 단어가 없어요</p>}
          {focusEntry && <GradeBar previews={focusInfo.previews} onGrade={(r) => onGrade(focusEntry, r, { next: true })} note={gradeNote(focusInfo)}
            disabled={!ready || focusLocked} label={focusLocked ? '단어를 떠올린 뒤 카드를 눌러 확인해요' : <b lang={cfg.hw}>{cfg.head(focusEntry).hw}</b>} />}
        </>}

    {pop && popRow && <WordPopup anchor={pop.anchor} row={popRow} tiles={tilesOf(popRow.word, popRow.kr)} tone={tone} status={statusOfWord(pop.text)}
      onSave={() => onStar(entryOfRow(popRow))} onClose={() => setPop(null)}
      onOpen={() => { setCard({ word: pop.text, row: popRow }); setPop(null); }} />}

    {card && <Sheet label={`${card.word} 단어 카드`} onClose={() => setCard(null)}>
      {cardEntry
        ? <ul className="lw-list"><WordCard entry={cardEntry} level={level} view="all" info={cardInfo(cardEntry.key)} tiles={tilesOf(cardEntry.word, cardEntry.kr)}
          speak={speak} tone={tone} onGrade={(r) => onGrade(cardEntry, r)} onSave={() => onStar(cardEntry)} saving={saving === cardEntry.key}
          pop={pops.has(cardEntry.key)} note={gradeNote(cardInfo(cardEntry.key))} grades search /></ul>
        : <div className="lw-card">
          <WordRow word={card.row.word} reading={card.row.reading} meaning={card.row.meaning || '사전에 없는 단어예요'} level={card.row.level}
            status={statusOfWord(card.row.word)} tone={tone} onSave={() => onStar(entryOfRow(card.row))} saving={saving === card.row.word} pop={pops.has(card.row.word)} />
          <CharTiles tiles={tilesOf(card.row.word, card.row.kr)} />
          {card.row.level && <Link className="lw-pop__open" href={`${cfg.levelHref(cfg.levelKeyOf(card.row.level))}?w=${encodeURIComponent(card.row.word)}`}>{cfg.tag(card.row.level)} 단어에서 보기 ›</Link>}
        </div>}
    </Sheet>}

    {sheetOpen && <TitleSheet levels={conf.levels} levelKey={levelKey} mode={prefs.mode} view={prefs.view} views={LEVEL_WORD_VIEWS} links={otherLinks}
      onMode={(m) => { switchMode(m); }} onView={(v) => setPrefs({ view: v })} onClose={() => setSheetOpen(false)} />}

    {notice && <Notice key={notice.id} notice={notice} onDone={dropNotice} />}
  </div></WordLangContext.Provider>;
}
