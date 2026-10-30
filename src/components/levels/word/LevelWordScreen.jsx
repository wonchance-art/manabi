'use client';
// 레벨 단어 페이지 공통 화면(오너 확정 2026-10-19 KST · 문서 「HSK 단어 페이지 개편 구현 정리」) — HSK(/chinese/vocab/h1–h7) · JLPT(/japanese/vocab/n5–n1).
// O/X 목록을 FSRS 네 칸 채점 + 한 단어 모드(기본) + 전 레벨 사전 찾기로 바꿨다. 새 표 없음: 뷰어 · 복습실과 같은 단어장 행과 기록을 쓴다
// (채점 한 길 = useLevelWordGrade, 상태 · 미리보기 = levelWordStatus, 세션 줄 = levelWordSession, 글자 칸 = 한자 창 모델).
// 상단 네 줄 중 상단바와 진행바만 붙는다. 로그인 전에는 모두 보이고 네 칸 · ☆만 로그인 안내(보던 카드로 돌아온다), 진행바는 숨긴다.
// 언어마다 다른 것(문구 · 읽기 줄 · 글자 칸 · 색인)은 판(cfg)으로 받는다 — 판은 views/LevelWordPage(HSK) · views/JlptWordPage(JLPT).
// 이 화면은 언어 값을 직접 적지 않는다(일본어 라우트가 중국어 글꼴 범위 밖에 남게 — fontScope 계약).
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { learningDay, schedulerTime } from '@/lib/fsrsScheduler';
import { fetchVocabularyLearningRows } from '@/lib/vocabularyLearningRows';
import { buildVocabularyWordIndex } from '@/lib/vocabularyDueIndex';
import { preservePendingVocabularyReviews } from '@/lib/viewerVocabularyCache';
import { LEVEL_LIST_LANGS, levelGroupsOf, levelKinds, LEVEL_KIND_LABEL } from '@/lib/levelList';
import {
  HARD_LAPSES, dueTomorrowCount, gradePreviews, gradeToastText, dueAmount, inLearningStep, lapsesOf, laterDueText,
  entryKeys, levelProgressPercent, levelRowProjection, levelWordGraded, levelWordStatus, newStartedToday, nextDueMs, todayAgainAt,
} from '@/lib/levelWordStatus';
import { DEFAULT_NEW_PER_DAY, loadNewPerDay } from '@/lib/vocabStudy';
import {
  areaOfView, levelWordAreas, practiceCounts, practiceOrder, seenTodayElsewhere, soundCheckKeys, wordGradedOn,
} from '@/lib/levelWordAreas';
import { useLevelWordAreas } from '@/lib/useLevelWordAreas';
import { levelPackTiles } from '@/lib/levelCharTiles';
import {
  gradeLevelSession, moreLevelSession, nextLevelKey, pullLevelSession, sessionCurrent, sessionDone, sessionDue, sessionNextAt, sessionOrder,
  revertLevelGrade, sessionWaiting, splitLaterEntries, startLevelSession,
} from '@/lib/levelWordSession';
import { indexEntry, searchLevelIndex } from '@/lib/levelWordIndex';
import { useLevelWordGrade } from '@/lib/useLevelWordGrade';
import { useLevelWords } from '@/lib/useLevelWords';
import { levelWordsUrl, warmLevelWords } from '@/lib/levelWordsPayload';
import { recordActivity } from '@/lib/streak';
import { useHeightSettle } from '@/lib/useHeightSettle';
import { BackIcon, CaretIcon, CharTiles, ClearIcon, PieceDrillContext, SearchIcon, WaitChip, WordRow } from '@/components/levels/word/WordParts';
import { WordCard } from '@/components/levels/word/WordCard';
import { GradeBar, MoreNewButton, MoreNewNote, NewDayTitle, OneWordCard, OneWordDone } from '@/components/levels/word/OneWord';
import { BrowseBar, PracticeBar, PracticeDone, PracticeIntro } from '@/components/levels/word/WordAreas';
import { PiecePopup, Sheet, TitleSheet, WordPopup } from '@/components/levels/word/WordSheets';
import { WordSearchResults } from '@/components/levels/word/WordSearch';
import { WordLangContext } from '@/components/levels/word/wordLang';
import '@/components/levels/word/level-word.css';

const RETURN_KEY = 'manabi:level-word-return';
const SHEET_KIND_ORDER = ['vocab', 'hanzi', 'bunkei'];

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
// 화면 위(고정 머리 아래 선)로 올라가 있는 카드가 줄에서 빠지면 보이는 카드가 그 높이만큼 올라간다 — 브라우저 스크롤 고정(overflow-anchor)이
// 없는 iOS Safari에서 「네 칸을 눌렀는데 스크롤이 됨」(오너 2026-10-27 KST · 리스트에서 내려 본 채 맨 위 카드를 채점). 그 카드는 접는 움직임 없이
// 빼고, 보이는 첫 카드의 자리를 재 두었다가 어긋난 만큼 되돌린다. 브라우저가 이미 맞췄으면(Chrome) 차이가 0이라 겹치지 않는다.
const LIST_CARDS = '.lw-list[data-main] .lw-card[data-key]';
function viewTop() {
  const bar = document.querySelector('.lw-prog') || document.querySelector('.lw-top');
  return bar ? bar.getBoundingClientRect().bottom : 0;
}
function holdViewIfAbove(el) {
  const top = viewTop();
  if (!el || el.getBoundingClientRect().bottom > top) return null;
  const ref = [...document.querySelectorAll(LIST_CARDS)].find((c) => c !== el && c.getBoundingClientRect().top >= top);
  if (!ref) return null;
  const key = ref.getAttribute('data-key'), at = ref.getBoundingClientRect().top;
  return () => {
    const now = document.querySelector(`.lw-list[data-main] .lw-card[data-key="${CSS.escape(key)}"]`);
    const moved = now ? now.getBoundingClientRect().top - at : 0;
    if (Math.abs(moved) >= 1) window.scrollBy({ top: moved, behavior: 'instant' });
  };
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

// 보기 탭(네 영역 체크 — 오너 승인 2026-10-21 KST): [단어]가 기본이고 실제 복습 일정(네 칸)은 이 탭만 바꾼다.
// 문장 · 뜻 · 소리는 스스로 더 다지고 싶은 사람의 연습(두 칸 · 일정 없음), 전체는 훑어보기(채점 없음).
export const LEVEL_WORD_VIEWS = Object.freeze([
  { id: 'word', label: '단어' }, { id: 'sentence', label: '문장' }, { id: 'meaning', label: '뜻' }, { id: 'sound', label: '소리' }, { id: 'all', label: '전체' },
]);
// 한 단어 모드가 기본. 품사 범위(전체 ▾)는 없앴다 — 늘 레벨 전체(오너 2026-10-20 KST 「그 기능은 아예 없애」).
// 리스트는 아직 채점하지 않은 카드를 한 번에 page장까지 펼친다(오너 2026-10-20 KST — 설정에서 10 · 20 · 50, 기본 20).
// 채점하면 아래 카드가 올라와 다시 page장 · 기다리는 카드와 접힌 두 줄(복습 예정 · 새 단어)은 세지 않는다 · 시간이 된 카드는 그 위에 더한다.
export const LEVEL_WORD_PAGE_SIZES = Object.freeze([10, 20, 50]);
export const LEVEL_WORD_PREFS = Object.freeze({ mode: 'one', view: 'word', tone: true, page: 20, v: 2 });
const NOTICE_MS = 8000;

export function normalizeLevelWordPrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  // v2 전에 저장된 「전체」는 그때의 기본값이라 새 기본(단어)으로 옮긴다 — 전체가 채점 없는 훑기로 바뀌었다.
  const view = p.v !== 2 && p.view === 'all' ? 'word' : p.view;
  return {
    mode: p.mode === 'list' ? 'list' : 'one',
    view: LEVEL_WORD_VIEWS.some((v) => v.id === view) ? view : 'word',
    tone: p.tone !== false,
    page: LEVEL_WORD_PAGE_SIZES.includes(p.page) ? p.page : LEVEL_WORD_PREFS.page,
    v: 2,
  };
}

const readJson = (store, key) => { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (store, key, value) => { try { store.setItem(key, JSON.stringify(value)); } catch { /* 저장소 없음 — 이번 화면만 */ } };

/** 되돌리기 · 로그인 안내 — 네 칸 위에 잠깐. 올라왔다 .15s에 사라지고, 손가락을 올리면 멈춘다. 단추는 먼저 닫고 실행한다(실행이 띄운 「되돌렸어요」를 지우지 않게). */
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
  // quiet = 평소 채점 — 창 없이 네 칸 바로 위 가운데에 「爸爸 알맞음 · 되돌리기」 한 줄(간격은 단추에 이미 있다 · 오너 10-22 「단어 처리 될 때마다 창 떠야겠나?」 →
  // 「되돌리기만 남기고」 → 「중앙 배치, 한자 굵기 빼고」 · 화살표 없음). 떠 있는 동안 안내 줄(리스트의 지금 카드 단어)은 숨긴다. 긴 글(10분 뒤 다시)은 화면 읽기에만.
  if (notice.quiet) {
    const { word, what, lang } = notice.quiet;
    return <div className={`lw-undo lw-undo--quiet${leaving ? ' is-leaving' : ''}`} role="status" onPointerEnter={pause} onPointerLeave={resume} onFocus={pause} onBlur={resume}>
      <span className="sr-only">{word} {notice.text}</span>
      {notice.onAction && <button type="button" aria-label={`${word} ${what} 되돌리기`} onClick={() => { clearTimeout(timer.current); onDone(); notice.onAction(); }}>
        <span lang={lang}>{word}</span>{what} · <u>되돌리기</u></button>}
    </div>;
  }
  const act = (run) => () => { clearTimeout(timer.current); onDone(); run(); };
  const first = <>{notice.href && <Link href={notice.href}>{notice.action}</Link>}
    {notice.onAction && <button type="button" onClick={act(notice.onAction)}>{notice.action}</button>}</>;
  // also = 두 번째 단추(LEVEL-SAVED-TAG-001 — 새 단어 몫 안내의 [한도 늘리기] [연습만 하기]). 좁은 화면에서는 단추 둘이 다음 줄 오른쪽으로.
  return <div className={`lw-undo${notice.also ? ' lw-undo--two' : ''}${leaving ? ' is-leaving' : ''}`} role="status" onPointerEnter={pause} onPointerLeave={resume} onFocus={pause} onBlur={resume}>
    <span>{notice.text}</span>
    {notice.also ? <span className="lw-undo__acts">{first}<button type="button" onClick={act(notice.also.onAction)}>{notice.also.action}</button></span> : first}
  </div>;
}

export default function LevelWordScreen({ cfg, levelKey, wordsUrl, groups: givenGroups }) {
  // 레벨 줄 — 영어 · 프랑스어 판은 책장 타일(LEVEL_LIST_LANGS) 밖에서 몇 단어로 먼저 연다(오너 2026-10-26 KST) — 판이 레벨을 직접 준다.
  const levels = cfg.levels || LEVEL_LIST_LANGS[cfg.lang].levels;
  const language = cfg.language;
  const level = cfg.levelOf(levelKey);
  // 항목은 조각 밖 정적 묶음(LEVEL-LIST-RSC-001 — 서버 페이지가 주소를 주고 문서 머리에서 preload). 받기 전(loaded false)에는
  // 세션 · 연습 · 훑기를 시작하지 않고 「고르는 중」 자리를 그대로 둔다 — 붙기 전 첫 그림과 같은 화면이다.
  const words = useLevelWords(wordsUrl, givenGroups);
  const loaded = !!words.groups;
  const groups = useMemo(() => levelGroupsOf(words.groups), [words.groups]);
  const allEntries = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const byKey = useMemo(() => new Map(allEntries.map((e) => [e.key, e])), [allEntries]);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, refreshProfileAfterActivity } = useAuth();
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
  // 오늘 새 단어 몫 — 서버 입장 한도가 정본(LEVEL-SAVED-TAG-001 · levelNewSlots). 한도 모듈은 첫 그림에 싣지 않는다(import()).
  // 손님 · 호환 모드 · 못 읽음이면 null → 지금처럼 기기 셈(newStartedToday). 줄은 이 값을 받은 뒤(늦으면 4초 뒤 기기 셈으로) 세운다.
  const slotsQuery = useQuery({
    queryKey: ['level-new-slots', userId],
    queryFn: () => Promise.race([import('@/lib/levelDailyLoad').then((m) => m.levelNewSlots(userId)),
      new Promise((resolve) => { setTimeout(() => resolve(null), 4000); })]).catch(() => null),
    enabled: mounted && !!userId,
    staleTime: 30_000,
  });
  const slots = userId ? slotsQuery.data ?? null : null;
  const slotsSettled = !userId || slotsQuery.isFetched;
  const known = useKnownWords(cfg.code, mounted && !!userId);
  const knownSet = useMemo(() => (userId ? knownWordSetOf(known.rows, [], cfg.code) : new Set()), [userId, known.rows, cfg.code]);
  // 상태를 셀 수 있는가 — 손님은 로그인 확인이 끝난 뒤(모두 ☆), 로그인은 단어장을 받은 뒤. 받기 전에는 상태 칸 자리만.
  // 확인 전에 손님으로 줄을 세우면 로그인에서 돌아온 표시(RETURN_KEY)를 그 줄이 먹고 지워, 진짜 사용자 줄은 첫 카드부터 선다.
  const ready = mounted && !authLoading && (!userId || !!index || indexQuery.isError);

  const lookup = useCallback((key) => (userId && index ? levelRowProjection(index, key, language, clock) : { row: null, projection: null }), [userId, index, clock, language]);
  const infoOf = useCallback((key) => {
    if (!ready) return { status: null, graded: false, projection: null, row: null };
    if (!userId) return { status: 'new', graded: false, projection: null, row: null };
    const { row, projection } = lookup(entryKeys(byKey.get(key)) ?? key);
    const isKnown = knownSet.has(normalizeKnownWord(key));
    const status = levelWordStatus({ projection, known: isKnown, at: clock });
    return { status, graded: levelWordGraded({ projection, known: isKnown }), projection, row, known: isKnown };
  }, [ready, userId, lookup, byKey, knownSet, clock]);

  const table = useMemo(() => new Map(allEntries.map((e) => [e.key, infoOf(e.key)])), [allEntries, infoOf]);
  const percent = useMemo(() => levelProgressPercent(allEntries.map((e) => e.key), (k) => table.get(k)?.graded), [allEntries, table]);

  /** 카드 하나의 표시 값 — 상태 · 네 칸 미리보기 · 어려운 단어. */
  const cardInfo = useCallback((key) => {
    const base = table.get(key) || infoOf(key);
    if (!base.status) return { ...base, previews: null };
    const previews = base.known ? (base.status === 'grad' ? gradePreviews({ projection: null, row: null, at: clock }) : null)
      : gradePreviews({ projection: base.projection, row: base.row, at: clock });
    const hard = lapsesOf(base.projection) >= HARD_LAPSES ? lapsesOf(base.projection) : 0;
    return { ...base, previews, hard };
  }, [table, infoOf, clock]);

  // ── 네 영역 체크 — 단어 = 카드의 마지막 결과, 문장 · 뜻 · 소리 = 연습 답(그날 첫 답 · FSRS로 다시 돌린 기억률) ──
  const areaRec = useLevelWordAreas(mounted ? userId : null, { lang: cfg.code, level: String(levelKey || '') });
  const { noteGrade: noteAreaGrade, answer: answerArea } = areaRec;
  const areaTable = useMemo(() => {
    if (!ready || !userId) return null;
    return new Map(allEntries.map((e) => {
      const k = normalizeKnownWord(e.key);
      const info = table.get(e.key);
      return [e.key, levelWordAreas({ firsts: areaRec.firsts.get(k), projection: info?.projection, known: info?.known,
        todayFirst: areaRec.dayRec.first[k] ?? null, at: clock })];
    }));
  }, [ready, userId, allEntries, table, areaRec.firsts, areaRec.dayRec.first, clock]);
  const areasOf = useCallback((key) => areaTable?.get(key) || null, [areaTable]);
  /** 오늘 이 단어를 area 말고 다른 곳에서 먼저 봤는가 — 같은 날 규칙(알아요를 진도에 넣지 않는다). */
  const seenElsewhere = useCallback((key, area) => {
    const k = normalizeKnownWord(key);
    return seenTodayElsewhere({ area, wordGradedToday: wordGradedOn(table.get(key)?.projection, clock) || !!areaRec.dayRec.first[k],
      answeredToday: areaRec.answeredToday.get(k) || [], openedIn: areaRec.dayRec.opened[k] ?? null });
  }, [table, clock, areaRec.dayRec, areaRec.answeredToday]);
  const nextLine = useCallback((key) => {
    const next = table.get(key)?.projection?.review?.nextQuestionAt;
    if (!next) return null;
    const a = dueAmount(next, clock);
    return a ? `${a.n}${a.unit} 뒤 복습` : null;
  }, [table, clock]);

  // 글자 칸 — 붙은 뒤 이 레벨 단어의 칸 묶음(/api/level-tiles, 빌드 때 계산)을 먼저 받는다. 받기 전에는 칸을 그리지 않는다.
  // 묶음에 없는 단어(찾기 · 예문 단어 창의 다른 레벨 단어)가 그려질 때만 표 네 벌(판의 loadTiles — 훈 · 음 · 정체/정자 · 한자 창)을 받아 계산한다.
  // 묶음을 못 받으면 표로 전부 계산한다(예전 길). kr = 글자별 읽기(JLPT — 빌드 때 실은 「けい,けん」).
  const [tilePack, setTilePack] = useState(null); // null 받는 중 · false 못 받음
  const [charTables, setCharTables] = useState(null); // null 아직 · 'loading' · false 실패
  useEffect(() => {
    if (!mounted) return undefined;
    if (!cfg.loadTiles) { setTilePack(false); return undefined; } // 글자 칸이 없는 판(영어 · 프랑스어)
    let live = true;
    setTilePack(null);
    fetch(`/api/level-tiles/${cfg.lang}/${String(levelKey || '').toLowerCase()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((pack) => { if (live) setTilePack(pack?.w ? pack : false); }, () => { if (live) setTilePack(false); });
    return () => { live = false; };
  }, [mounted, cfg, levelKey]);
  const tablesAsked = useRef(false);
  const askTables = useCallback(() => {
    if (tablesAsked.current) return;
    tablesAsked.current = true;
    setCharTables('loading');
    cfg.loadTiles().then(setCharTables, () => setCharTables(false));
  }, [cfg]);
  const tileCache = useRef(new Map());
  const tilesOf = useCallback((word, kr) => {
    if (tilePack === null || !cfg.loadTiles) return null;
    const packed = tilePack ? levelPackTiles(tilePack, word, kr) : undefined;
    if (packed !== undefined) return packed;
    // 묶음에 없는 단어 — 표를 그때 받는다(그리는 중에는 상태를 바꾸지 않게 다음 틈에).
    if (!charTables || charTables === 'loading') { if (charTables === null) queueMicrotask(askTables); return null; }
    const k = `${word}\u0000${kr || ''}`;
    if (!tileCache.current.has(k)) tileCache.current.set(k, cfg.tilesOf(word, kr, charTables));
    return tileCache.current.get(k);
  }, [tilePack, charTables, cfg, askTables]);

  // 알림(되돌리기 · 로그인 안내) — 화면에 하나.
  const [notice, setNotice] = useState(null);
  const dropNotice = useCallback(() => setNotice(null), []);
  const askLogin = useCallback((key, text = '로그인하면 채점이 기록돼요') => {
    writeJson(sessionStorage, RETURN_KEY, { path: pathname, key });
    setNotice({ id: Date.now(), text, action: '로그인', href: authEntryHref(pathname) });
  }, [pathname]);

  const grader = useLevelWordGrade({ user, fetchProfile: refreshProfileAfterActivity, language, onError: (message) => toast(message, 'error') });
  const [pops, setPops] = useState(() => new Set()); // 막 ☆ → 담음이 된 단어(한 번 튀어오름)
  const [saving, setSaving] = useState(null);
  const popKey = (key) => setPops((s) => new Set(s).add(key));

  const [limit, setLimit] = useState(LEVEL_WORD_PREFS.page);
  const [jumpTo, setJumpTo] = useState(null); // 리스트에서 그 단어로(로그인 뒤 · 다른 레벨 단어 카드에서)

  // ── 한 단어 세션 ──
  const [session, setSession] = useState(null);
  const [newPerDay, setNewPerDay] = useState(null); // 복습 설정의 하루 새 단어 수(손님은 null — 채점하지 않는다)
  const [revealed, setRevealed] = useState(false);
  const [turn, setTurn] = useState(0);
  const leaving = useRef(false); // 나가는 움직임 동안은 다음 채점을 받지 않는다(줄이 어긋나지 않게)
  const scope = `${userId || 'guest'}:${levelKey}`;
  const startedFor = useRef(null);
  useEffect(() => {
    if (!ready || !loaded || !slotsSettled || startedFor.current === scope) return;
    startedFor.current = scope;
    // 하루 새 단어(시안 ⑦-1 추천) — 복습실과 같은 숫자(복습 설정 · vocab_new_per_day)에서 오늘 이미 시작한 수를 뺀 만큼만 줄에 세운다.
    // 서버 몫을 읽었으면 그 남은 수 · 한도 그대로(LEVEL-SAVED-TAG-001 — 담음 단어도 새 단어로 이 몫 안에 선다).
    const perDay = userId ? loadNewPerDay() : null;
    const newCap = perDay === null ? Infinity : slots ? slots.remaining : perDay - newStartedToday(index, language, Date.now());
    let next = startLevelSession(allEntries, (k) => table.get(k)?.status, (k) => nextDueMs(table.get(k)?.projection), Date.now(),
      { newCap, learningOf: (k) => inLearningStep(table.get(k) || {}) });
    setNewPerDay(slots ? slots.limit : perDay);
    // 로그인 · 다른 레벨 단어 카드에서 돌아오면 보던 카드부터(한도 뒤에 남긴 새 단어여도).
    const back = readJson(sessionStorage, RETURN_KEY);
    const wanted = back?.path === pathname ? back.key : new URLSearchParams(window.location.search).get('w');
    if (wanted) next = pullLevelSession(next, wanted);
    if (wanted && next.queue.includes(wanted)) next = { ...next, queue: [wanted, ...next.queue.filter((k) => k !== wanted)] };
    if (back?.path === pathname) try { sessionStorage.removeItem(RETURN_KEY); } catch { /* 없음 */ }
    setSession(next);
    setHeadKey(wanted && next.queue.includes(wanted) ? wanted : null);
    setRevealed(false);
    if (wanted && byKey.has(wanted)) setJumpTo(wanted);
  }, [ready, loaded, slotsSettled, slots, scope, allEntries, table, pathname, byKey, userId, index, language]);
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
  // 한도 뒤에 남긴 새 단어 — 그사이 다른 곳에서 채점한 단어는 빼고 센다. 「새 단어 N개 더」는 하루 몫만큼(0개로 둔 사람은 기본 15개).
  const stillNew = useCallback((k) => ['new', 'saved'].includes(table.get(k)?.status), [table]); // 담음 = 담기만 한 새 단어
  const heldCount = useMemo(() => (session?.held?.length ? session.held.filter(stillNew).length : 0), [session, stillNew]);
  const moreBatch = Math.min(heldCount, newPerDay || DEFAULT_NEW_PER_DAY);
  const moreNew = () => { setSession((cur) => moreLevelSession(cur, moreBatch, stillNew)); setRevealed(false); };
  // 오늘 시작한 새 단어 — 서버 몫의 쓴 수(전에 담고 오늘 처음 공부한 단어 포함), 못 읽으면 기기 셈.
  const startedToday = useMemo(() => (!heldCount ? 0 : slots ? slots.used : newStartedToday(index, language, clock)), [heldCount, slots, index, language, clock]);

  // ── 연습 탭(문장 · 뜻 · 소리) — 두 칸, 한 번에 page장. 순서 = 놓침 → 흐려진 맞힘 → 처음 → 맞힘, 오늘 이미 본 단어는 맨 뒤 ──
  const viewArea = areaOfView(prefs.view);
  const practice = viewArea && viewArea !== 'word' ? viewArea : null;
  const browse = prefs.view === 'all';
  const [round, setRound] = useState(null); // { area, keys, answers: Map(key → { correct, row }) }
  const touchedToday = useCallback((key) => seenElsewhere(key, null), [seenElsewhere]);
  const practiceBatch = useCallback((which) => practiceOrder(allEntries, (k) => areasOf(k)?.[which], touchedToday).slice(0, prefs.page).map((e) => e.key),
    [allEntries, areasOf, touchedToday, prefs.page]);
  const startPractice = useCallback((which, keys = null) => {
    setRound({ area: which, keys: keys || practiceBatch(which), answers: new Map() });
    setRevealed(false);
    setFocusKey(null);
  }, [practiceBatch]);
  // 손님은 기록이 없으니 바로(모두 처음), 로그인은 네 영역을 센 뒤.
  const areasReady = loaded && ((!!areaTable && areaRec.loaded) || (ready && !userId));
  useEffect(() => { if (practice && areasReady && round?.area !== practice) startPractice(practice); }, [practice, areasReady, round?.area, startPractice]);
  useEffect(() => { setRevealed(false); }, [prefs.view]);
  const roundOn = !!practice && round?.area === practice;
  const roundLeft = roundOn ? round.keys.filter((k) => !round.answers.has(k)) : [];
  const roundDone = roundOn && round.keys.length > 0 && roundLeft.length === 0;
  const practiceKey = roundLeft[0] || null;
  const practiceEntry = practiceKey ? byKey.get(practiceKey) : null;
  const practiceChips = useMemo(() => (practice && areaTable ? practiceCounts(allEntries.map((e) => e.key), (k) => areasOf(k)?.[practice]) : null),
    [practice, areaTable, allEntries, areasOf]);

  // ── 전체 탭 — 훑어보기(채점 없음). 한 단어는 앞뒤로 넘기고, 리스트는 레벨 순서 그대로 ──
  const [browseAt, setBrowseAt] = useState(0);
  const [browseLimit, setBrowseLimit] = useState(LEVEL_WORD_PREFS.page);
  useEffect(() => { setBrowseAt(0); setBrowseLimit(prefs.page); }, [levelKey, prefs.page]);
  const browseEntry = browse ? allEntries[Math.min(browseAt, allEntries.length - 1)] || null : null;
  useEffect(() => { if (browseEntry && prefs.mode === 'one') areaRec.noteOpen(browseEntry.key, 'all'); }, [browseEntry, prefs.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 모드 · 보기 줄은 첫 채점(연습 탭은 첫 답) 뒤 접힌다(두 모드 모두 — 문서 「상단 네 줄」). 다시 바꾸려면 제목을 눌러
  // 맨 위로 가며 펼친다(오너 2026-10-21 KST — 모드 · 보기는 페이지 줄에만 있다). 펼친 줄은 다음 채점 · 답에서 다시 접힌다.
  const foldKey = practice ? `p${roundOn ? round.answers.size : 0}` : `g${session?.graded ?? 0}`;
  const [unfoldedAt, setUnfoldedAt] = useState(null);
  const folded = unfoldedAt !== foldKey && (practice ? roundOn && round.answers.size > 0 && !roundDone
    : !browse && !!session && session.graded > 0 && !done);
  const rowsRef = useHeightSettle(folded);

  // ── 리스트 — 같은 오늘 할 줄: ① 시간이 된 카드 ② 오늘 복습 · 새 단어 ③ 기다리는 카드(남은 시간), 그 밖은 두 줄로 접는다 ──
  // 「복습 예정」 = 한 번 본 단어(다음 복습이 가까운 순 · 날짜 없는 알아요 단어는 끝에 「졸업」), 「새 단어」 = 아직 안 본 단어(목록 순서).
  // 한 줄에 섞여 있으면 진도가 어디까지인지 안 보였다(오너 2026-10-26 KST · 시안 ⑨).
  const [laterOpen, setLaterOpen] = useState({ review: false, fresh: false });
  const [laterLimit, setLaterLimit] = useState({ review: LEVEL_WORD_PREFS.page, fresh: LEVEL_WORD_PREFS.page });
  useEffect(() => { setLimit(prefs.page); setLaterLimit({ review: prefs.page, fresh: prefs.page }); }, [prefs.page]);
  const listed = useMemo(() => {
    if (!session) return null;
    const due = sessionDue(session, clock);
    const waiting = sessionWaiting(session, clock);
    const pick = (keys) => keys.map((k) => byKey.get(k)).filter(Boolean);
    const order = sessionOrder(session, clock);
    const active = pick(order.includes(head) ? [head, ...order.filter((k) => k !== head)] : order);
    // 줄에 있는 열쇠는 한 번 모아 둔다 — 단어마다 sessionHas(줄 전체 훑기)를 부르면 손님 줄(레벨 전체)에서 N²(H7 5,562장 = 약 3천만 번).
    const inLine = new Set([...session.queue, ...session.waiting.map((w) => w.key)]);
    const { review, fresh } = splitLaterEntries(allEntries, inLine, (k) => table.get(k)?.graded, (k) => table.get(k)?.projection?.review?.nextQuestionAt);
    return { active, due: new Set(due), waiting: waiting.map((w) => ({ entry: byKey.get(w.key), at: w.at })).filter((w) => w.entry),
      later: { review: review.map((r) => r.entry), fresh }, laterNext: new Map(review.map((r) => [r.entry.key, r.next])) };
  }, [session, clock, head, byKey, allEntries, table]);
  const laterChip = (key) => laterDueText(listed?.laterNext.get(key) ?? null, clock);
  const shown = limit + (listed?.due.size || 0); // 시간이 된 카드는 page장 위에 더한다(지금 카드를 밀어내지 않게)
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
    if (at >= shown) { setLimit(at + prefs.page); return; }
    // 접힌 단어로 가면 그 단어가 든 줄(복습 예정 · 새 단어)만 펼친다.
    for (const part of ['review', 'fresh']) {
      const later = listed.later[part].findIndex((e) => e.key === jumpTo);
      if (later >= 0 && (!laterOpen[part] || later >= laterLimit[part])) {
        setLaterOpen((o) => ({ ...o, [part]: true }));
        setLaterLimit((l) => ({ ...l, [part]: Math.max(l[part], later + 20) }));
        return;
      }
    }
    // 글자 칸 표가 붙은 뒤(카드 높이가 정해진 뒤)에 바로 옮긴다 — 먼 거리를 부드럽게 굴리면 그사이 위 카드가 자라 다른 단어에 멈췄다(?w=準備 실측).
    const go = () => cardEl(jumpTo)?.scrollIntoView({ block: 'center' });
    go();
    const raf = requestAnimationFrame(go);
    pickCard(jumpTo);
    setJumpTo(null);
    return () => cancelAnimationFrame(raf);
  }, [jumpTo, prefs.mode, listed, shown, laterOpen, laterLimit, charTables]); // eslint-disable-line react-hooks/exhaustive-deps

  // 리스트의 채점 대상(아래 네 칸) = 줄 맨 위 카드(head). 카드를 누르면 그 카드(오너 확정 2026-10-19 KST 「아래 고정」 · 「오늘 할 줄」).
  // 누른 카드를 채점하면 그 다음 카드가 대상으로 이어지고, 맨 위 카드를 채점하면 다음 차례가 맨 위로 온다.
  const [focusKey, setFocusKey] = useState(null);
  const pickCard = useCallback((key) => setFocusKey(key), []);
  const listOrder = useMemo(() => (listed ? [...listed.active.slice(0, shown), ...listed.waiting.map((w) => w.entry),
    ...(laterOpen.review ? listed.later.review.slice(0, laterLimit.review) : []),
    ...(laterOpen.fresh ? listed.later.fresh.slice(0, laterLimit.fresh) : [])] : []), [listed, shown, laterOpen, laterLimit]);
  const wordList = prefs.mode === 'list' && !practice && !browse;
  const focusEntry = wordList ? listOrder.find((e) => e.key === focusKey) || listOrder[0] || null : null;
  const focusInfo = focusEntry ? cardInfo(focusEntry.key) : null;
  // 연습 리스트의 답할 카드 — 누른 카드, 없으면 맨 위.
  const practiceFocus = prefs.mode === 'list' && roundOn ? byKey.get(roundLeft.includes(focusKey) ? focusKey : roundLeft[0]) || null : null;
  const openArea = practice || (browse ? 'all' : 'word');
  // 소리 탭 자동 읽기(시안 ⑦-3) — 한 단어는 카드가 나올 때, 리스트는 답할 카드가 바뀔 때 한 번. 첫 소리는 브라우저 규칙상 누른 뒤에.
  const sayKey = practice === 'audio' && roundOn ? (prefs.mode === 'one' ? practiceEntry?.key : practiceFocus?.key) ?? null : null;
  const sayTurn = prefs.mode === 'one' ? turn : 0;
  useEffect(() => { if (sayKey && speak) speak(byKey.get(sayKey)?.word || sayKey); }, [sayKey, sayTurn, speak, byKey]);
  const listCard = (e, { due = false, wait = null, later = null, focused = e.key === focusEntry?.key } = {}) => <WordCard key={e.key} entry={e} level={level} view={prefs.view} info={cardInfo(e.key)}
    tiles={tilesOf(e.word, e.kr)} speak={speak} tone={prefs.tone} onSave={() => onStar(e)} saving={saving === e.key} pop={pops.has(e.key)}
    onWord={onExampleWord} openKey={pop?.id} focused={focused} onPick={() => { pickCard(e.key); if (browse) areaRec.noteOpen(e.key, 'all'); }} due={due} wait={wait} later={later}
    onOpen={() => areaRec.noteOpen(e.key, openArea)} areas={areasOf(e.key)} next={nextLine(e.key)} />;
  const followFocus = useCallback((key) => {
    const at = listOrder.findIndex((e) => e.key === key);
    setFocusKey(key !== head && at >= 0 ? listOrder[at + 1]?.key ?? null : null);
  }, [listOrder, head]);

  // ── 채점 ──
  const inFlight = useRef(new Set());
  // 오늘 새 단어 몫을 다 쓴 학습일(LEVEL-NEW-LIMIT-001) — 한 번도 공부하지 않은 카드(담기만 한 단어 포함)는 서버가 첫 문제 때 하루 새 단어
  // 몫을 쓴다. 다 쓴 뒤에는 그런 카드를 넘기지 않고(튕김 없이) 안내만 한다. 몫을 늘리면(단어장 설정) 다음 시도에서 다시 서버에 묻는다.
  const newLimitHit = useRef(null);
  const practiceOnlyRef = useRef(null);
  // 단추 둘(LEVEL-SAVED-TAG-001): [한도 늘리기] = 단어장 복습 설정(하루 새 표현 한도)을 펼친 채로(#review-settings — 내 정보 시트와 같은 길),
  // [연습만 하기] = 그 단어 하나로 문장 연습(일정 · 몫에 닿지 않는다 — practiceOnlyRef).
  const newLimitNotice = (limit, entry) => setNotice({ id: Date.now(), text: limit ? `오늘 새 단어 ${limit}개를 다 했어요 — 내일 이어서 나와요` : '오늘 새 단어를 다 했어요 — 내일 이어서 나와요',
    href: '/vocab#review-settings', action: '한도 늘리기', also: entry ? { action: '연습만 하기', onAction: () => practiceOnlyRef.current?.(entry) } : null, ms: 8000 });
  const onGrade = useCallback(async (entry, rating, opts = {}) => {
    if (!userId) return askLogin(entry.key);
    if (!ready || inFlight.current.has(entry.key) || leaving.current) return undefined;
    const info = cardInfo(entry.key);
    if (info.known && rating > 1) {
      setNotice({ id: Date.now(), text: '졸업한 단어예요. 「다시」를 누르면 복습으로 돌아와요', ms: 4000 });
      return undefined;
    }
    const hit = newLimitHit.current;
    if (hit && hit.day === learningDay(schedulerTime(Date.now())) && hit.tries++ % 3 !== 2
        && info.projection?.source === 'fsrs-v1' && info.projection.memory?.state === 'New') {
      newLimitNotice(hit.limit, entry); // 세 번째마다는 서버에 다시 묻는다 — 그사이 설정에서 몫을 늘렸을 수 있다
      return undefined;
    }
    inFlight.current.add(entry.key);
    const before = session;
    // 오늘 할 줄에서 옮긴다(다음 차례가 오늘 안이면 기다리는 카드로, 아니면 줄에서 빠진다) — 기록을 기다리지 않고 먼저.
    const moved = gradeLevelSession(session, entry.key, rating, todayAgainAt(info.previews?.[rating]));
    const advance = moved !== session;
    if (advance) {
      const one = prefs.mode === 'one';
      const keep = one ? null : holdViewIfAbove(cardEl(entry.key)); // 화면 위 카드 — 움직임 없이 빼고 보이는 자리를 지킨다
      const el = keep || reducedMotion() ? null : one ? (currentKey === entry.key ? document.querySelector('.lw-one__card') : null) : cardEl(entry.key);
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
      keep?.();
    }
    try {
      if (info.known) {
        // 졸업(아는 단어 표시)한 단어의 「다시」 — 표시를 풀고 복습으로 돌린다(서버가 풀어 준 뒤에만 채점).
        await known.mutation.mutateAsync({ lang: cfg.code, wordText: entry.key, known: false, removeKeys: knownWordKeys(known.rows, cfg.code, { text: entry.key }, []) });
        await queryClient.refetchQueries({ queryKey: ['vocab-words', userId], exact: true });
      }
      const res = await grader.grade(entry, rating);
      if (!res.ok) {
        if (advance) { setSession((cur) => revertLevelGrade(cur, before, moved, entry.key, rating)); setHeadKey(head); }
        if (res.reason === 'not-due') setNotice({ id: Date.now(), text: '복습실 카드라 복습 차례에만 채점할 수 있어요', href: '/review', action: '복습실', ms: 5000 });
        if (res.reason === 'new-limit') { newLimitHit.current = { day: learningDay(schedulerTime(Date.now())), limit: res.limit, tries: 0 }; newLimitNotice(res.limit, entry); }
        return undefined;
      }
      setClock(Date.now());
      if (!info.graded) queryClient.invalidateQueries({ queryKey: ['level-new-slots', userId] }); // 첫 채점 — 서버 몫의 쓴 수를 다시 읽는다
      noteAreaGrade(entry.key, rating);
      if (info.status === 'new') popKey(entry.key);
      setNotice({ id: Date.now(), quiet: { word: cfg.head(entry).hw, lang: cfg.hw, what: gradeToastText(rating, null) }, text: gradeToastText(rating, info.previews?.[rating]), action: grader.undoable(res.undo) ? '되돌리기' : null,
        onAction: grader.undoable(res.undo) ? () => undoRef.current?.({ undo: res.undo, sessionBefore: advance ? before : null, headBefore: advance ? head : null, key: entry.key }) : null });
      lastRef.current = { undo: res.undo, sessionBefore: advance ? before : null, headBefore: advance ? head : null, key: entry.key };
    } catch (error) {
      if (advance) { setSession((cur) => revertLevelGrade(cur, before, moved, entry.key, rating)); setHeadKey(head); }
      toast(failureMessage('채점하지 못했어요.', error), 'error');
    } finally { inFlight.current.delete(entry.key); }
    return undefined;
  }, [userId, ready, askLogin, cardInfo, session, prefs.mode, currentKey, head, followFocus, known.mutation, known.rows, queryClient, grader, toast, cfg, noteAreaGrade]);

  const lastRef = useRef(null);
  const undoRef = useRef(null);
  const undoPracticeRef = useRef(null);
  const undo = useCallback(async (last = lastRef.current) => {
    if (!last) return;
    lastRef.current = null;
    // 연습 답(문장 · 뜻 · 소리)도 같은 키로 되돌린다 — 복습실과 같은 Ctrl/⌘+Z.
    if (last.practice) { undoPracticeRef.current?.(...last.practice); return; }
    // 알림에 손을 올려 둔 사이 되돌리기 창(8초)이 지났으면 말없이 넘기지 않는다.
    if (!grader.undoable(last.undo)) { setNotice({ id: Date.now(), text: '되돌릴 수 있는 시간이 지났어요', ms: 3000 }); return; }
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

  // ── 연습 답 — 기록은 활동 전용(일정 · 정답률에 닿지 않는다). 오늘 다른 곳에서 먼저 본 단어의 알아요는 진도에 넣지 않는다 ──
  const onPractice = useCallback(async (entry, correct) => {
    if (!userId) return askLogin(entry.key, '로그인하면 연습이 기록돼요');
    if (!roundOn || leaving.current || round.answers.has(entry.key)) return undefined;
    const which = round.area;
    const sameDay = correct && seenElsewhere(entry.key, which);
    const one = prefs.mode === 'one';
    const keep = one ? null : holdViewIfAbove(cardEl(entry.key));
    const el = keep || reducedMotion() ? null : one ? document.querySelector('.lw-one__card') : cardEl(entry.key);
    if (el?.animate) {
      leaving.current = true;
      const anim = playLeave(el, one);
      await anim.finished.catch(() => {});
      leaving.current = false;
      requestAnimationFrame(() => { anim.cancel(); el.style.overflow = ''; });
    }
    const row = answerArea(entry.key, which, correct, sameDay);
    recordActivity(userId, () => refreshProfileAfterActivity?.(userId)); // 연속 기록 — 누른 횟수 전부(학습량은 활동 기록이 센다)
    flushSync(() => {
      setRound((r) => (r && r.area === which ? { ...r, answers: new Map(r.answers).set(entry.key, { correct, row }) } : r));
      setFocusKey(null);
      if (one) { setRevealed(false); setTurn((n) => n + 1); }
    });
    keep?.();
    const text = !correct ? '다시 볼래요 · 다음 연습에 먼저 나와요' : sameDay ? '알아요 · 오늘 먼저 본 단어라 진도에는 안 들어가요' : '알아요';
    lastRef.current = { practice: [entry.key, which, row] };
    // 같은 날 규칙에 걸린 알아요만 창으로 알린다(진도에 안 들어가는 까닭) — 나머지는 조용한 되돌리기.
    setNotice({ id: Date.now(), quiet: correct && sameDay ? null : { word: cfg.head(entry).hw, what: correct ? '알아요' : '다시 볼래요' }, text, action: '되돌리기', onAction: () => undoRef.current?.({ practice: [entry.key, which, row] }) });
    return undefined;
  }, [userId, askLogin, roundOn, round, seenElsewhere, prefs.mode, answerArea, refreshProfileAfterActivity, cfg]);
  undoPracticeRef.current = (key, which, row) => {
    areaRec.cancel(key, which, row);
    setRound((r) => {
      if (!r || r.area !== which || !r.answers.has(key)) return r;
      const answers = new Map(r.answers);
      answers.delete(key);
      return { ...r, answers };
    });
    setRevealed(false);
    setTurn((n) => n + 1);
    setNotice({ id: Date.now(), text: '되돌렸어요', ms: 2500 });
  };

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
    setNotice({ id: Date.now(), quiet: { word: cfg.head(entry).hw, lang: cfg.hw, what: '담음' }, text: '담았어요 · 새 단어로 나와요', action: res.undo ? '되돌리기' : null,
      onAction: res.undo ? () => undoRef.current?.({ undo: res.undo, sessionBefore: null, key: entry.key }) : null });
    return undefined;
  }, [userId, askLogin, saving, grader, cfg]);

  // ── 찾기 ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [dict, setDict] = useState({ state: 'idle', entries: null });
  const savedScroll = useRef(0);
  const loadDict = useCallback(() => {
    if (dict.state !== 'idle') return;
    // 전 레벨 색인이 없는 판은 지금 레벨 안에서만 찾는다(받지 못했을 때와 같은 길).
    if (!cfg.indexUrl) { setDict({ state: 'failed', entries: null }); return; }
    setDict({ state: 'loading', entries: null });
    fetch(cfg.indexUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body) => setDict({ state: 'ready', entries: body.rows.map((row, i) => indexEntry(row, i, cfg.mode)) }))
      .catch(() => setDict({ state: 'failed', entries: null }));
  }, [dict.state, cfg]);
  // 색인을 받지 못하면 지금 레벨 안에서만 찾는다. 그때만 만든다 — 첫 그림마다 레벨 전체(H7 5,562개)를 색인하지 않게(JS-CRIT-001).
  const levelOnly = useMemo(() => (dict.state === 'failed' ? allEntries.map((e, i) => indexEntry([e.word, e.reading, e.meaning, level, e.kr], i, cfg.mode)) : null),
    [dict.state, allEntries, level, cfg.mode]);
  const searchEntries = dict.state === 'ready' ? dict.entries : dict.state === 'failed' ? levelOnly : null;
  const result = useMemo(() => (searchEntries ? searchLevelIndex(searchEntries, deferred, level, { mode: cfg.mode, levelRank: cfg.levelRank }) : null),
    [searchEntries, deferred, level, cfg]);
  const openSearch = () => { savedScroll.current = window.scrollY; setSearchOpen(true); loadDict(); };
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

  // ── 글자 창(오너 2026-10-25 KST — HSK 판의 글자 칸 큰 한자를 누름) — 표 네 벌(askTables)과 HSK 1–9 색인(loadDict)을 그때 받는다.
  // 같은 한자 단어는 내 단어 → 색인(급 낮은 순), 색인을 못 받으면 이 레벨 목록에서. 같은 글자를 다시 누르면 닫는다.
  const [piece, setPiece] = useState(null); // { kind, ch, of, word, index, anchor, id }
  const onPiece = useCallback((req, anchor) => {
    loadDict();
    if (charTables === null) askTables();
    setPiece((cur) => (cur?.anchor === anchor ? null : { ...req, anchor, id: Date.now() }));
  }, [loadDict, charTables, askTables]);
  const drillCtx = useMemo(() => (cfg.pieceDrill ? { onPiece } : null), [cfg.pieceDrill, onPiece]);
  const pieceOpen = !!piece;
  const pieceRefIndex = useMemo(() => {
    if (!pieceOpen) return null;
    const rows = dict.state === 'ready' ? dict.entries : allEntries.map((e) => ({ ...e, level }));
    // JLPT 읽기 표는 글자별 읽기(kr)로 단어를 읽기 줄에 놓는다.
    if (cfg.mode === 'ja') return new Map(rows.map((e) => [e.word, { level: e.level, reading: e.reading, meaning: e.meaning, kr: e.kr }]));
    return new Map(rows.map((e) => [e.word, { level: `H${e.level}`, word: { zh: e.word, pinyin: e.reading, ko: e.meaning } }]));
  }, [pieceOpen, dict, allEntries, level, cfg.mode]);
  const pieceSaved = useMemo(() => (pieceOpen && index ? [...new Set(index.byKey.values())].filter((r) => r.language === language) : []), [pieceOpen, index, language]);

  // ── 상단 · 제목 시트(레벨 · 목록 · 보기 — 해 모양 설정 창은 여기로 합쳤다, 오너 2026-10-21 KST) ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const progRef = useRef(null);
  const [stuck, setStuck] = useState(false);
  const [scrolled, setScrolled] = useState(false); // 찾기 줄 그림자(시안 ⑪ — 내려 보면 결과 위에 떠 보인다)
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 0);
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
  // 보기 탭도 모드와 같은 0.2초 겹침(⑥-3). 줄(.lw-rows)은 따로 이름을 붙여 겹치지 않고, 고른 표시가 미끄러지는 게 그대로 보인다.
  const switchView = (view) => {
    if (view === prefs.view) return;
    const go = () => flushSync(() => setPrefs({ view }));
    if (typeof document !== 'undefined' && document.startViewTransition && !reducedMotion()) document.startViewTransition(go); else go();
  };
  // 「연습만 하기」(LEVEL-SAVED-TAG-001) — 몫이 찬 날의 새 카드를 그 단어 하나짜리 문장 연습으로(두 칸 · 기록은 활동 전용, 일정 · 몫 그대로).
  // 줄을 먼저 세워 두면 탭이 바뀐 뒤 연습 시작 효과가 page장 묶음으로 덮지 않는다(round.area === practice).
  practiceOnlyRef.current = (entry) => { startPractice('sentence', [entry.key]); switchView('sentence'); };
  // 탭 밑줄 — 고른 탭의 자리 · 너비를 재서 막대 하나를 옮긴다(탭 글자 폭이 달라 칸 수로는 못 정한다). 글꼴이 늦게 와도 다시 잰다.
  const tabsRef = useRef(null);
  const [tabBar, setTabBar] = useState(null);
  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      const b = live && tabsRef.current?.querySelector('button[aria-pressed="true"]');
      if (b && b.offsetWidth) setTabBar((old) => (old?.x === b.offsetLeft && old?.w === b.offsetWidth ? old : { x: b.offsetLeft, w: b.offsetWidth }));
    };
    measure();
    document.fonts?.ready?.then(measure);
    return () => { live = false; };
  }, [prefs.view, folded, searchOpen, mounted]);
  // 제목: 내려와 있거나 줄이 접혀 있으면 맨 위로 가며 펼치고, 이미 맨 위에 다 보이면 시트를 연다.
  const onTitle = () => {
    if (window.scrollY <= 0 && !folded) { setSheetOpen(true); return; }
    if (folded) setUnfoldedAt(foldKey);
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
  const next = nextLevelKey(levels, levelKey);
  const goNext = () => { if (next) { warmLevelWords(levelWordsUrl(cfg.lang, next)); router.push(cfg.levelHref(next)); } };
  // 목록 칸 — 제목 「HSK 1 단어」의 「단어」 자리를 바꾼다(단어 · 한자 · 문형 순, 그 레벨에 있는 것만).
  const kindLinks = SHEET_KIND_ORDER.filter((k) => (cfg.kinds || levelKinds(cfg.lang, levelKey)).includes(k))
    .map((k) => ({ id: k, label: LEVEL_KIND_LABEL[k], href: k === 'vocab' ? cfg.levelHref(levelKey) : `/${cfg.lang}/${k}/${levelKey.toLowerCase()}` }));

  // ── 키보드 — Space 정답 확인 · 1–4 채점(리스트는 아래 네 칸의 대상 카드) · Ctrl/⌘+Z 되돌리기(복습실과 같은 키) ──
  const keyState = useRef({});
  keyState.current = { current, revealed, mode: prefs.mode, blocked: searchOpen || sheetOpen || !!card, onGrade, undo, focus: focusEntry,
    practice: roundOn ? (prefs.mode === 'one' ? practiceEntry : practiceFocus) : null, onPractice, browse,
    // 다음 카드를 펼치면 직전 채점의 조용한 되돌리기는 거둔다(뒷면 안내 줄과 겹치지 않게 — Ctrl/⌘+Z는 창 안이면 그대로).
    reveal: () => { const k = roundOn ? practiceEntry?.key : current?.key; if (k) areaRec.noteOpen(k, practice || 'word'); setRevealed(true); setNotice((n) => (n?.quiet ? null : n)); },
    step: (d) => setBrowseAt((i) => Math.max(0, Math.min(allEntries.length - 1, i + d))) };
  useEffect(() => {
    const onKey = (event) => {
      const h = keyState.current;
      const field = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if (field || event.isComposing || event.repeat || event.defaultPrevented || event.altKey) return;
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); h.undo(); return; }
      if (event.metaKey || event.ctrlKey || h.blocked) return;
      if (h.browse) {
        if (h.mode === 'one' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); h.step(event.key === 'ArrowLeft' ? -1 : 1); }
        return;
      }
      // 숫자 키는 정답을 펼치지 않아도 바로 채점한다(네 칸은 앞면에서도 누를 수 있다 — 오너 결정, 2026-10-21 KST 재확인).
      if (h.practice) {
        if (h.mode === 'one' && (event.key === ' ' || event.key === 'Enter') && !h.revealed && !event.target.closest?.('button, a')) { event.preventDefault(); h.reveal(); return; }
        if (event.key === '1' || event.key === '2') { event.preventDefault(); h.onPractice(h.practice, event.key === '2'); }
        return;
      }
      if (h.mode === 'list') { if (h.focus && ['1', '2', '3', '4'].includes(event.key)) { event.preventDefault(); h.onGrade(h.focus, Number(event.key), { next: true }); } return; }
      if (h.mode !== 'one' || !h.current) return;
      if ((event.key === ' ' || event.key === 'Enter') && !h.revealed && !event.target.closest?.('button, a')) { event.preventDefault(); h.reveal(); return; }
      if (['1', '2', '3', '4'].includes(event.key)) { event.preventDefault(); h.onGrade(h.current, Number(event.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (done && prefs.mode === 'one' && session?.graded && !practice && !browse) document.getElementById('lw-done-title')?.focus({ preventScroll: true }); },
    [done, prefs.mode, session?.graded, practice, browse]);
  useEffect(() => { if (roundDone) document.getElementById('lw-done-title')?.focus({ preventScroll: true }); }, [roundDone]);

  const title = cfg.title(level);
  const tone = prefs.tone;
  const currentInfo = current ? cardInfo(current.key) : null;
  // 복습실(FSRS) 카드는 서버 규칙상 차례 전에는 채점할 수 없다 — 기다리는 카드만 남아 앞당겨 보여도 남은 시간을 세며 기다린다.
  const gradeNote = (info) => {
    if (!(info?.status && !info.previews && info.projection?.source === 'fsrs-v1')) return null;
    const at = nextDueMs(info.projection);
    return at ? <>복습실 카드 · <WaitChip at={at} /> 채점해요</> : '복습실 카드 · 지금은 채점할 수 없어요';
  };
  const tomorrow = useMemo(() => (done ? dueTomorrowCount(allEntries.map((e) => table.get(e.key)?.projection), clock) : 0), [done, allEntries, table, clock]);
  // 끝 화면 「소리로 확인할 단어 N개」 — 어제까지 본 단어 중 소리가 맞힘이 아닌 것, 한 번에 page장.
  const soundKeys = useMemo(() => (done && areaTable ? soundCheckKeys(allEntries, { projectionOf: (k) => table.get(k)?.projection, areasOf, at: clock }).slice(0, prefs.page) : []),
    [done, areaTable, allEntries, table, areasOf, clock, prefs.page]);
  const openSound = () => { startPractice('audio', soundKeys); setPrefs({ view: 'sound' }); };
  // 단어 탭 끝 화면 — 한 단어 · 리스트 공통(리스트에서는 「리스트로」가 없다).
  const doneScreen = ({ onList = null } = {}) => <OneWordDone graded={session.graded} tomorrow={tomorrow} counts={session.counts}
    onNext={next ? goNext : null} nextLabel={next ? cfg.tag(cfg.levelOf(next)) : null}
    onList={onList} soundCount={soundKeys.length} onSound={openSound}
    more={moreBatch} perDay={newPerDay || 0} started={startedToday} onMore={moreNew} onBrowse={() => switchView('all')} />;
  const nextBatch = roundDone ? practiceBatch(round.area).filter((k) => !touchedToday(k)).length : 0;
  const practiceDone = roundDone && <PracticeDone area={round.area} hits={[...round.answers.values()].filter((a) => a.correct).length}
    misses={[...round.answers.values()].filter((a) => !a.correct).length}
    onAgain={() => startPractice(round.area, round.keys.filter((k) => !round.answers.get(k)?.correct))}
    moreCount={nextBatch} onMore={() => startPractice(round.area)} onWordTab={() => setPrefs({ view: 'word' })} />;

  // 묶음을 받기 전 자리 — 붙기 전과 같은 「고르는 중」, 받지 못하면 그 자리에 다시 시도.
  const pending = words.failed
    ? <div className="lw-empty" role="alert"><p>단어 목록을 불러오지 못했어요.</p><button type="button" className="lw-btn" onClick={words.retry}>다시 시도</button></div>
    : <p className="lw-empty" aria-busy="true">단어를 고르는 중…</p>;

  const cardEntry = card ? byKey.get(card.word) : null;
  const popRow = pop ? rowOfWord(pop.text) : null;
  useEffect(() => { if (cardEntry) areaRec.noteOpen(cardEntry.key, 'all'); }, [cardEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  return <WordLangContext.Provider value={cfg}><PieceDrillContext.Provider value={drillCtx}><div className="lw-page" data-mode={searchOpen ? 'search' : prefs.mode} data-language={cfg.code}>
    {searchOpen
      ? <header className="lw-top lw-top--search" data-stuck={scrolled || undefined}>
        <button type="button" className="lw-icon" aria-label="찾기 닫기" onClick={closeSearch}><BackIcon /></button>
        <label className="lw-searchbox"><span className="sr-only">{cfg.scope}에서 찾기</span>
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
        <h1 className="lw-title"><button type="button" onClick={onTitle} title="맨 위로 · 레벨 · 목록 · 보기">{title}</button></h1>
        <button type="button" className="lw-title__caret lw-icon" aria-label="레벨 · 목록 · 보기" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}><CaretIcon /></button>
        <button type="button" className="lw-icon" aria-label="단어 찾기" onClick={openSearch}><SearchIcon /></button>
      </header>}

    {!searchOpen && <>
      <div className="lw-rows" ref={rowsRef} hidden={folded || undefined}>
        <div className="lw-seg" role="group" aria-label="모드" data-thumb="" style={{ '--i': prefs.mode === 'list' ? 1 : 0 }}>
          {[['one', '한 단어'], ['list', '리스트']].map(([id, label]) => <button key={id} type="button" aria-pressed={prefs.mode === id} onClick={() => switchMode(id)}>{label}</button>)}
        </div>
        <div className="lw-tabs" role="group" aria-label="보기" ref={tabsRef} data-bar={tabBar ? '' : undefined}>
          {/* 탭은 이름만 — 영역 %는 단어마다 영역 줄에 있다(오너 2026-10-21 KST 「상단 퍼센트는 없애도 된다」). */}
          {LEVEL_WORD_VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={prefs.view === v.id} onClick={() => switchView(v.id)}>{v.label}</button>)}
          {tabBar && <i className="lw-tabs__bar" aria-hidden="true" style={{ '--x': tabBar.x, '--w': tabBar.w }} />}
        </div>
      </div>
      {userId && <div className="lw-prog" ref={progRef} data-stuck={stuck || undefined}>
        {ready && loaded ? <>
          <div className="lw-bar" role="progressbar" aria-label="이 레벨에서 채점한 단어" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ '--p': percent / 100 }} /></div>
          <span className="lw-pct">{percent}%</span>
        </> : <span className="lw-bar lw-bar--off" aria-hidden="true" style={{ visibility: 'hidden' }} />}
      </div>}
      {practice && <PracticeIntro counts={userId ? practiceChips : null} />}
    </>}

    {searchOpen
      ? <WordSearchResults query={deferred} result={result} level={level} loading={dict.state === 'loading'} fallback={dict.state === 'failed'}
        statusOf={statusOfWord} onSave={(r) => onStar(entryOfRow(r))} savingKey={saving} popKey={null} tone={tone}
        onOpen={(r) => setCard({ word: r.word, row: r })} currentWord={current?.word ?? null} />
      : browse && !loaded ? <div className="lw-one">{pending}</div>
      : browse && prefs.mode === 'one'
        ? <div className="lw-one">
          {browseEntry && <OneWordCard entry={browseEntry} view="all" info={cardInfo(browseEntry.key)} tiles={tilesOf(browseEntry.word, browseEntry.kr)}
            speak={speak} tone={tone} revealed onReveal={() => {}} onWord={onExampleWord} openKey={pop?.id} />}
          {!allEntries.length && <p className="lw-empty">이 레벨에는 단어가 없어요</p>}
          {browseEntry && <BrowseBar at={browseAt} total={allEntries.length} onPrev={() => setBrowseAt((i) => Math.max(0, i - 1))}
            onNext={() => setBrowseAt((i) => Math.min(allEntries.length - 1, i + 1))} />}
        </div>
      : browse
        ? <>
          <ul className="lw-list" data-main="">{allEntries.slice(0, browseLimit).map((e) => listCard(e, { focused: false }))}</ul>
          {allEntries.length > browseLimit && <div className="lw-more"><button type="button" onClick={() => setBrowseLimit((n) => n + prefs.page)}>
            다음 {Math.min(prefs.page, allEntries.length - browseLimit)}개 보기 · 남은 {allEntries.length - browseLimit}개</button></div>}
          {!allEntries.length && <p className="lw-empty">이 레벨에는 단어가 없어요</p>}
        </>
      : practice && prefs.mode === 'one'
        ? <div className="lw-one">
          {!roundOn && pending}
          {practiceDone}
          {roundOn && !round.keys.length && <p className="lw-empty">이 레벨에는 단어가 없어요</p>}
          {practiceEntry && <OneWordCard entry={practiceEntry} view={prefs.view} info={cardInfo(practiceEntry.key)} tiles={tilesOf(practiceEntry.word, practiceEntry.kr)}
            speak={speak} tone={tone} revealed={revealed} onReveal={() => keyState.current.reveal()}
            turnKey={turn ? `${turn}:${practiceEntry.key}` : null} onWord={onExampleWord} openKey={pop?.id} />}
          {practiceEntry && <PracticeBar onAnswer={(ok) => onPractice(practiceEntry, ok)} disabled={!ready} />}
        </div>
      : practice
        ? <>
          {!roundOn && pending}
          {practiceDone}
          {roundLeft.length > 0 && <ul className="lw-list" data-main="">{roundLeft.map((k) => byKey.get(k)).filter(Boolean)
            .map((e) => listCard(e, { focused: e.key === practiceFocus?.key }))}</ul>}
          {practiceFocus && <PracticeBar onAnswer={(ok) => onPractice(practiceFocus, ok)} disabled={!ready} label="카드를 눌러 확인한 뒤 답해요" />}
        </>
      : prefs.mode === 'one'
        ? <div className="lw-one">
          {!session && pending}
          {session && done && doneScreen({ onList: () => switchMode('list') })}
          {session && current && <OneWordCard entry={current} view={prefs.view} info={currentInfo} tiles={tilesOf(current.word, current.kr)}
            speak={speak} tone={tone} revealed={revealed} onReveal={() => keyState.current.reveal()} turnKey={turn ? `${turn}:${current.key}` : null}
            onWord={onExampleWord} openKey={pop?.id} />}
          {session && current && <GradeBar previews={currentInfo.previews} onGrade={(r) => onGrade(current, r)} disabled={!ready} note={gradeNote(currentInfo)} />}
        </div>
        : <>
          {!listed && pending}
          {listed && <>
            {listed.active.length > 0 && <ul className="lw-list" data-main="">{listed.active.slice(0, shown).map((e) => listCard(e, { due: listed.due.has(e.key) }))}</ul>}
            {listed.active.length > shown && <div className="lw-more"><button type="button" onClick={() => setLimit((n) => n + prefs.page)}>
              다음 {Math.min(prefs.page, listed.active.length - shown)}개 보기 · 남은 {listed.active.length - shown}개</button></div>}
            {listed.waiting.length > 0 && <ul className="lw-list" data-main="" aria-label="기다리는 카드">{listed.waiting.map((w) => listCard(w.entry, { wait: w.at }))}</ul>}
            {/* 리스트도 다 끝나면 한 단어와 같은 끝 화면(시안 「단어 페이지 손질」 정리) · 기다리는 카드가 남았으면 그 위에 더 단추만 */}
            {done && allEntries.length > 0 && doneScreen()}
            {!listed.active.length && listed.waiting.length > 0 && moreBatch > 0 && <div className="lw-capped" role="status">
              <p className="lw-capped__t"><NewDayTitle started={startedToday} /></p>
              <p className="lw-capped__s">기다리는 카드는 시간이 되면 위로 올라와요</p>
              <div className="lw-done__row">
                <MoreNewButton more={moreBatch} onMore={moreNew} />
                <button type="button" className="lw-btn" onClick={() => switchView('all')}>전체 훑어보기</button>
              </div>
              <MoreNewNote perDay={newPerDay || 0} />
            </div>}
            {[['review', '복습 예정'], ['fresh', '새 단어']].map(([part, name]) => {
              const list = listed.later[part], open = laterOpen[part], cap = laterLimit[part];
              if (!list.length) return null;
              return <Fragment key={part}>
                <button type="button" className="lw-later" aria-expanded={open} onClick={() => setLaterOpen((o) => ({ ...o, [part]: !o[part] }))}>
                  {name} {list.length}개<CaretIcon /></button>
                {open && <ul className="lw-list" data-main="" aria-label={name}>
                  {list.slice(0, cap).map((e) => listCard(e, part === 'review' ? { later: laterChip(e.key) } : {}))}</ul>}
                {open && list.length > cap && <div className="lw-more">
                  <button type="button" onClick={() => setLaterLimit((l) => ({ ...l, [part]: l[part] + prefs.page }))}>
                    다음 {Math.min(prefs.page, list.length - cap)}개 보기 · 남은 {list.length - cap}개</button></div>}
              </Fragment>;
            })}
          </>}
          {loaded && !allEntries.length && <p className="lw-empty">이 레벨에는 단어가 없어요</p>}
          {focusEntry && <GradeBar previews={focusInfo.previews} onGrade={(r) => onGrade(focusEntry, r, { next: true })} note={gradeNote(focusInfo)}
            disabled={!ready} label={<b lang={cfg.hw}>{cfg.head(focusEntry).hw}</b>} />}
        </>}

    {piece && <PiecePopup key={piece.id} req={piece} tables={charTables} refIndex={pieceRefIndex} savedRows={pieceSaved} tone={tone} onClose={() => setPiece(null)} />}

    {pop && popRow && <WordPopup key={pop.id} anchor={pop.anchor} row={popRow} tiles={tilesOf(popRow.word, popRow.kr)} tone={tone} status={statusOfWord(pop.text)}
      onSave={() => onStar(entryOfRow(popRow))} onClose={() => setPop(null)}
      onOpen={() => { setCard({ word: pop.text, row: popRow, from: pop.anchor }); setPop(null); }} />}

    {card && <Sheet label={`${card.word} 단어 카드`} onClose={() => setCard(null)} returnTo={card.from}>
      {cardEntry
        ? <ul className="lw-list"><WordCard entry={cardEntry} level={level} view="all" info={cardInfo(cardEntry.key)} tiles={tilesOf(cardEntry.word, cardEntry.kr)}
          speak={speak} tone={tone} onGrade={(r) => onGrade(cardEntry, r)} onSave={() => onStar(cardEntry)} saving={saving === cardEntry.key}
          pop={pops.has(cardEntry.key)} note={gradeNote(cardInfo(cardEntry.key))} grades search areas={areasOf(cardEntry.key)} next={nextLine(cardEntry.key)} /></ul>
        : <div className="lw-card">
          <WordRow word={card.row.word} reading={card.row.reading} meaning={card.row.meaning || '사전에 없는 단어예요'} level={card.row.level}
            status={statusOfWord(card.row.word)} tone={tone} onSave={() => onStar(entryOfRow(card.row))} saving={saving === card.row.word} pop={pops.has(card.row.word)} />
          <CharTiles tiles={tilesOf(card.row.word, card.row.kr)} word={card.row.word} />
          {card.row.level && <Link className="lw-pop__open" href={`${cfg.levelHref(cfg.levelKeyOf(card.row.level))}?w=${encodeURIComponent(card.row.word)}`}>{cfg.tag(card.row.level)} 단어에서 보기 ›</Link>}
        </div>}
    </Sheet>}

    {sheetOpen && <TitleSheet levels={levels} levelKey={levelKey} kinds={kindLinks} aidLabel={cfg.aidLabel} aid={tone}
      page={prefs.page} pageSizes={LEVEL_WORD_PAGE_SIZES} onAid={(v) => setPrefs({ tone: v })} onPage={(n) => setPrefs({ page: n })} onClose={() => setSheetOpen(false)} />}

    {notice && <Notice key={notice.id} notice={notice} onDone={dropNotice} />}
  </div></PieceDrillContext.Provider></WordLangContext.Provider>;
}
