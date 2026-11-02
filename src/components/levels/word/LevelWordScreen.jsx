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
import { preservePendingVocabularyReviews, VOCAB_WORDS_STALE_MS, vocabWordsFromLearningCache } from '@/lib/viewerVocabularyCache';
import { LEVEL_LIST_LANGS, levelGroupsOf, levelKinds, LEVEL_KIND_LABEL } from '@/lib/levelList';
import {
  HARD_LAPSES, LEARN_AHEAD_MS, dueTomorrowCount, gradePreviews, gradeToastText, dueAmount, inLearningStep, lapsesOf, laterDueText, learnAheadable,
  entryKeys, levelProgressPercent, levelRowProjection, levelWordGraded, levelWordStatus, newStartedToday, nextDueMs, todayAgainAt,
} from '@/lib/levelWordStatus';
import { DEFAULT_NEW_PER_DAY, NEW_PER_DAY_UNLIMITED, isNewPerDayValue, loadNewPerDay } from '@/lib/vocabStudy';
import { wordAreaRecall, wordAreaState } from '@/lib/levelWordAreas';
import { RECOGNITION_ONLY, variantQuota } from '@/lib/fsrsCardKinds';
import { levelCardKey, parseLevelCardKey, planLevelCardKinds, toggleLevelCardKind } from '@/lib/levelCardKinds';
import { levelPackTiles } from '@/lib/levelCharTiles';
import {
  addLevelSessionKeys, arrangeLevelSession, dropLevelSessionKeys, gradeLevelSession, moreLevelSession, nextLevelKey, pullLevelSession, sessionAhead,
  sessionCurrent, sessionDone, sessionDue, sessionNextAt, sessionOrder, revertLevelGrade, sessionWaiting, splitLaterEntries, startLevelSession,
} from '@/lib/levelWordSession';
import { LEVEL_WORD_PREFS, levelStudyOptions, normalizeLevelWordPrefs } from '@/lib/levelWordPrefs';
import { indexEntry, searchLevelIndex } from '@/lib/levelWordIndex';
import { useLevelWordGrade } from '@/lib/useLevelWordGrade';
import { useLevelWords } from '@/lib/useLevelWords';
import { levelWordsUrl, warmLevelWords } from '@/lib/levelWordsPayload';
import { useHeightSettle } from '@/lib/useHeightSettle';
import { BackIcon, CaretIcon, CharTiles, ClearIcon, PieceDrillContext, SearchIcon, WaitChip, WaitText, WordRow } from '@/components/levels/word/WordParts';
import { WordCard } from '@/components/levels/word/WordCard';
import { GradeBar, MoreNewButton, MoreNewNote, NewDayTitle, OneWordCard, OneWordDone, OneWordWait } from '@/components/levels/word/OneWord';
import { BrowseBar } from '@/components/levels/word/WordAreas';
import { GuideFace } from '@/components/cards/CardFaces';
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

// 기기 설정(모드 · 학습 옵션)의 정본은 levelWordPrefs — 리스트는 아직 채점하지 않은 카드를 한 번에 page장(20 고정)까지 그린다.
// 채점하면 아래 카드가 올라와 다시 page장 · 끝까지 내리면 다음 page장을 저절로 이어 그린다(「다음 20개 보기」 단추는 없앴다 — LEVEL-WAIT-001).
// 접힌 두 줄(복습 예정 · 새 단어)은 세지 않는다 · 시간이 된 카드는 그 위에 더한다. 기다리는 카드(아직 채점할 수 없음)는 그리지 않는다.
const NOTICE_MS = 8000;

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
  // 기기 설정은 언어마다 따로(cfg.prefsKey) — HSK와 JLPT의 학습 옵션(순서)이 서로 바꾸지 않게. 하루 새 단어 수는 기기 설정이 아니다(아래 changePerDay).
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
  // 신선도 · 시작 값도 뷰어와 같다(SNAPSHOT-SHARE-001): 같은 키에 30초를 따로 두어 뷰어가 2분 신선하게 둔 색인을 이 화면만 다시 받았고
  // (실측 — 뷰어 · 단어장 37초 뒤 전체 2.1 MB), 단어장이 막 받은 완전 snapshot이 있으면 그것으로 시작한다(받은 시각 그대로).
  const indexQuery = useQuery({
    queryKey: ['vocab-words', userId],
    queryFn: async ({ signal }) => preservePendingVocabularyReviews(buildVocabularyWordIndex(await fetchVocabularyLearningRows(userId, { signal })),
      queryClient.getQueryData(['vocab-words', userId])),
    enabled: mounted && !!userId,
    staleTime: VOCAB_WORDS_STALE_MS,
    initialData: () => vocabWordsFromLearningCache(queryClient, userId),
    initialDataUpdatedAt: () => queryClient.getQueryState(['vocab', userId, 'learning'])?.dataUpdatedAt,
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

  // ── 카드 종류(CARD-TYPES-001 3단계 · 오너 결정 2026-11-01 KST) — 단어 하나에 카드 셋(단어 → 뜻 · 뜻 → 단어 · 듣기) ──
  // 켜진 종류는 계정 설정(서버 입장 정책 — levelNewSlots가 같은 읽기로 싣는다). 모르거나 단어 → 뜻 하나면 지금 화면 그대로: 카드 목록을 읽지 않고
  // 종류 카드 · 형제 규칙 · 붙이기가 모두 빈 값이다. 켜져 있으면 카드 목록(복습실과 같은 상태 읽기)에서 이 레벨 단어의 종류 카드를 받아
  // 줄 · 리스트에 세운다(카드 열쇠 = 「단어 열쇠@@종류」 — levelCardKinds). 형제 규칙(학습일 하나에 단어당 한 장)은 공유 pickSiblings,
  // 차례로 붙이기는 공유 nextVariantKind(서버가 다시 본다) — 듣기는 이 레벨 예문(e.ex)이 있는 단어만.
  const [kindsChoice, setKindsChoice] = useState(null); // 「카드」 줄에서 막 고른 값(저장 중) — 저장되면 서버 값으로 돌아간다
  const cardKinds = kindsChoice || slots?.cardKinds || RECOGNITION_ONLY;
  const kindsOn = !!userId && cardKinds.length > 1;
  const variantQuery = useQuery({
    queryKey: ['level-card-kinds', userId],
    queryFn: () => Promise.race([import('@/lib/levelFsrsGrade').then((m) => m.loadLevelFsrsCards({ accountId: userId })),
      new Promise((resolve) => { setTimeout(() => resolve(null), 4000); })]).catch(() => null),
    enabled: mounted && kindsOn,
    staleTime: 30_000,
  });
  const variantsSettled = !kindsOn || variantQuery.isFetched;
  const kindPlan = useMemo(() => planLevelCardKinds({ entries: allEntries, vocabularyIdOf: (k) => table.get(k)?.row?.id ?? null,
    hasExampleOf: (k) => !!byKey.get(k)?.ex?.text, cards: kindsOn ? variantQuery.data?.cards : null, cardKinds, actorId: userId, at: clock }),
  [allEntries, table, byKey, kindsOn, variantQuery.data, cardKinds, userId, clock]);
  /** 종류 카드 열쇠 → 표시 값(상태 · 투영) — 단어 → 뜻의 table과 같은 모양. */
  const variantTable = useMemo(() => {
    const out = new Map();
    for (const [key, v] of kindPlan.variants) {
      const status = levelWordStatus({ projection: v.projection, at: clock });
      // 막 붙은 종류 카드(New)는 오늘 복습과 같이 선다 — 하루 새 단어 몫을 쓰지 않는다(설계 §3 · 서버 fsrsTakesNewQuota).
      out.set(key, { status: status === 'saved' ? 'today' : status, graded: true, projection: v.projection, row: { id: v.entry.cardId }, known: false, variant: v });
    }
    return out;
  }, [kindPlan, clock]);
  /** 카드 열쇠 → 그 카드의 항목(단어 항목에 kind · cardKey를 더한 것). 단어 → 뜻은 단어 항목 그대로. */
  const byCard = useMemo(() => {
    if (!kindPlan.variants.size) return byKey;
    const out = new Map(byKey);
    for (const [key, v] of kindPlan.variants) {
      const e = byKey.get(v.wordKey);
      if (e) out.set(key, { ...e, key, wordKey: e.key, kind: v.kind });
    }
    return out;
  }, [byKey, kindPlan]);
  const cardTable = useCallback((key) => table.get(key) || variantTable.get(key), [table, variantTable]);

  // ── 카드 기억률 줄(AreaRow) — 켜진 종류마다 그 카드의 기억률(단어장 상세 카드와 같은 계산). 예전 네 영역(문장 · 뜻 · 소리 = 연습 답)은 없앴다. ──
  const areasOf = useCallback((key) => {
    if (!ready || !userId) return null;
    const info = table.get(key);
    if (!info) return null;
    return cardKinds.map((kind) => {
      const own = kind === 'recognition' ? info : variantTable.get(levelCardKey(key, kind));
      const projection = own?.projection ?? null, known = kind === 'recognition' ? info.known : false;
      const state = wordAreaState({ projection, known, at: clock });
      return { kind, state, recall: wordAreaRecall({ state, projection, known, at: clock }) };
    });
  }, [ready, userId, table, variantTable, cardKinds, clock]);
  const nextLine = useCallback((key) => {
    const next = table.get(key)?.projection?.review?.nextQuestionAt;
    if (!next) return null;
    const a = dueAmount(next, clock);
    return a ? `${a.n}${a.unit} 후 복습` : null;
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
  const studyOpts = useMemo(() => levelStudyOptions(prefs), [prefs.order]); // eslint-disable-line react-hooks/exhaustive-deps -- 순서만
  // 줄에 세울 카드 — 단어(목록 순)마다 단어 → 뜻 다음 그 단어의 종류 카드. 형제 규칙에 걸린 카드(오늘 같은 단어의 다른 카드가 나온다)는 세우지 않는다.
  // 종류가 꺼져 있으면 단어 항목 그대로다(지금 줄과 같다).
  const lineEntries = useMemo(() => (kindPlan.variants.size ? allEntries.flatMap((e) => [e,
    ...['production', 'listening'].map((kind) => byCard.get(levelCardKey(e.key, kind))).filter(Boolean)]) : allEntries), [allEntries, byCard, kindPlan]);
  const lineStatus = useCallback((k) => (kindPlan.hidden.has(k) ? null : cardTable(k)?.status), [kindPlan, cardTable]);
  useEffect(() => {
    if (!ready || !loaded || !slotsSettled || !variantsSettled || startedFor.current === scope) return;
    startedFor.current = scope;
    // 하루 새 단어(시안 ⑦-1 추천) — 복습실과 같은 숫자(복습 설정 · vocab_new_per_day)에서 오늘 이미 시작한 수를 뺀 만큼만 줄에 세운다.
    // 서버 몫을 읽었으면 그 남은 수 · 한도 그대로(LEVEL-SAVED-TAG-001 — 담음 단어도 새 단어로 이 몫 안에 선다).
    const perDay = userId ? loadNewPerDay() : null;
    const newCap = perDay === null ? Infinity : slots ? slots.remaining : perDay - newStartedToday(index, language, Date.now());
    let next = startLevelSession(lineEntries, lineStatus, (k) => nextDueMs(cardTable(k)?.projection), Date.now(),
      { newCap, learningOf: (k) => inLearningStep(cardTable(k) || {}), ...studyOpts });
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
  }, [ready, loaded, slotsSettled, variantsSettled, slots, scope, lineEntries, lineStatus, cardTable, pathname, byKey, userId, index, language, studyOpts]);
  // 줄을 세운 뒤 생긴 종류 카드(「카드」 줄로 켬 · 막 붙임)는 줄에 더하고, 끈 종류의 카드는 뺀다(쉰다 — 기억 상태는 서버에 그대로).
  useEffect(() => {
    if (!session) return;
    const today = learningDay(schedulerTime(Date.now()));
    const items = [];
    lineEntries.forEach((e, i) => {
      if (!e.kind || e.kind === 'recognition' || kindPlan.hidden.has(e.key)) return;
      const info = cardTable(e.key);
      if (info?.status !== 'today') return;
      const at = nextDueMs(info.projection);
      if (at && learningDay(at) > today) return;
      items.push({ key: e.key, at, learning: inLearningStep(info), rank: i });
    });
    let next = addLevelSessionKeys(session, items);
    next = dropLevelSessionKeys(next, (k) => {
      const { kind } = parseLevelCardKey(k);
      return kind === 'recognition' || (cardKinds.includes(kind) && byCard.has(k));
    });
    if (next !== session) setSession(next);
  }, [session, lineEntries, kindPlan, cardTable, cardKinds, byCard]);
  // 차례로 붙이기 — 단어 → 뜻이 날 단위로 넘어간 다음 학습일에 뜻 → 단어, 그다음 학습일에 듣기(nextVariantKind — 서버 등록 조건의 거울).
  // 하루에 붙이는 수는 하루 새 단어 수까지(켠 날 밀린 단어가 한꺼번에 붙어 줄이 갑자기 늘지 않게 — 나머지는 다음 학습일에). 거절(조건 어긋남 ·
  // 연결 끊김)은 조용히 넘긴다 — 다음 읽기가 다시 판정한다. 붙인 뒤 카드 목록을 다시 읽으면 위 효과가 줄에 더한다.
  const enrollTried = useRef(new Set());
  const started = !!session;
  useEffect(() => {
    if (!kindsOn || !started || !kindPlan.enroll.length) return;
    const day = learningDay(schedulerTime(Date.now()));
    // 오늘 더 붙일 수 있는 수 — 하루 새 단어 수와 같은 숫자를 학습일마다(오늘 이미 붙인 종류 카드를 뺀다 · 「제한 없음」이면 막지 않음 — variantQuota).
    const quota = variantQuota({ cards: variantQuery.data?.cards || [], dailyNewLimit: newPerDay, at: schedulerTime(Date.now()) });
    const todo = kindPlan.enroll.filter((it) => !enrollTried.current.has(`${day}:${it.vocabularyId}:${it.kind}`)).slice(0, quota);
    if (!todo.length) return;
    todo.forEach((it) => enrollTried.current.add(`${day}:${it.vocabularyId}:${it.kind}`));
    // 화면을 떠나도 보낸 것은 끝까지 보낸다(한 장씩 · 채점과 같은 줄) — 끊으면 「시도함」으로 적힌 단어가 그날 다시 붙지 않는다.
    import('@/lib/levelFsrsGrade').then(async (m) => {
      let added = 0;
      for (const it of todo) {
        const res = await m.enrollLevelVariant({ accountId: userId, vocabularyId: it.vocabularyId, kind: it.kind, hasExample: it.hasExample }).catch(() => null);
        if (res?.ok) added += 1;
      }
      if (added) queryClient.invalidateQueries({ queryKey: ['level-card-kinds', userId] });
    }).catch(() => {});
  }, [kindsOn, started, kindPlan, userId, queryClient, variantQuery.data, newPerDay]);
  // 미리 학습(LEARN-AHEAD-001 · 오너 승인 2026-11-01 KST — Anki 「learn ahead limit」 20분). 지금 채점할 줄(① + ②)이 비었을 때만, 기다리는 카드 중
  // 20분 안에 차례가 오는 학습 · 재학습 단계 카드를 기다리지 않고 바로 위 목록 · 한 단어 카드로 올린다(남은 시간 「4분 후」 · 네 칸 켜짐 ·
  // 간격은 지금부터). 줄에 채점할 카드가 남아 있는 동안은 지금 그대로(60초 창). 날 단위 복습 카드는 미리 올리지 않는다.
  const aheadMode = !!session && !sessionOrder(session, clock).length;
  const canAhead = useCallback((key) => {
    const info = cardTable(key);
    return !!info && !info.known && learnAheadable({ projection: info.projection, row: info.row }, clock);
  }, [cardTable, clock]);
  const aheadKeys = useMemo(() => (aheadMode ? sessionAhead(session, clock, canAhead) : []), [aheadMode, session, clock, canAhead]);
  /** 미리 올린 카드의 다음 차례 시각(ms) — 카드의 「4분 후」. 줄의 시각(방금 채점한 카드는 그 미리보기 — 단어장 색인이 새로 오기 전에도 맞다), 없으면 투영. */
  const aheadAt = useCallback((key) => session?.waiting.find((w) => w.key === key)?.at || nextDueMs(cardTable(key)?.projection) || clock, [cardTable, session, clock]);
  /** 카드 하나의 표시 값 — 상태 · 네 칸 미리보기 · 어려운 단어. 미리 학습 중이면 20분 안의 학습 · 재학습 카드도 지금부터 잰 네 칸. */
  const cardInfo = useCallback((key) => {
    const base = cardTable(key) || infoOf(key);
    if (!base.status) return { ...base, previews: null };
    const previews = base.known ? (base.status === 'grad' ? gradePreviews({ projection: null, row: null, at: clock }) : null)
      : gradePreviews({ projection: base.projection, row: base.row, at: clock, ahead: aheadMode });
    const hard = lapsesOf(base.projection) >= HARD_LAPSES ? lapsesOf(base.projection) : 0;
    return { ...base, previews, hard };
  }, [cardTable, infoOf, clock, aheadMode]);
  // 기다리던 카드의 시각이 되면 다시 그린다(맨 위로 올라온다). 학습 · 재학습 카드는 20분 창에 드는 시각(riseAt)에도 — 그때 미리 올린다.
  const nextAt = sessionNextAt(session, clock);
  const riseAt = useMemo(() => {
    let at = Infinity;
    for (const w of sessionWaiting(session, clock)) {
      const info = cardTable(w.key);
      if (!info || !inLearningStep(info)) continue;
      const enters = (nextDueMs(info.projection) || w.at) - LEARN_AHEAD_MS;
      if (enters > clock) at = Math.min(at, enters);
    }
    return Number.isFinite(at) ? at : null;
  }, [session, clock, cardTable]);
  /** 다음 카드가 위로 올라오는 시각 — 차례(nextAt)와 미리 학습 창(riseAt) 중 이른 것. 「다음 카드는 N분 후」 · 대기 화면이 센다. */
  const comesAt = riseAt && (!nextAt || riseAt < nextAt) ? riseAt : nextAt;
  useEffect(() => {
    if (!comesAt) return undefined;
    const t = setTimeout(() => setClock(Date.now()), Math.max(0, comesAt - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [comesAt]);
  // 지금 보고 있는 카드(head) — 두 모드가 같이 쓴다. 기다리던 카드가 시간이 돼도 보던 카드를 밀어내지 않고 바로 다음 차례로 선다.
  // head가 줄에서 빠지면(채점) 다음 차례 = 시간이 된 카드 → 오늘 복습 · 새 단어 → (그것도 없으면) 가장 먼저 될 기다리는 카드.
  const [headKey, setHeadKey] = useState(null);
  // 미리 학습 중이면 보던 미리 올린 카드 → 첫 미리 올린 카드(남은 시간 짧은 순) → 가장 먼저 될 기다리는 카드.
  const head = !session ? null : sessionOrder(session, clock).includes(headKey) || aheadKeys.includes(headKey) ? headKey
    : aheadKeys[0] ?? sessionCurrent(session, clock);
  useEffect(() => { if (head !== headKey) setHeadKey(head); }, [head, headKey]);
  // 학습 옵션(순서)을 바꾸면 아직 채점하지 않은 몫만 다시 짠다 — 채점 수 · 누른 횟수 · 기다리는 카드 · 되돌리기 기록은 그대로.
  // 되돌리기 · 저장 실패 복구가 옛 옵션으로 짠 줄(sessionBefore)을 돌려놓아도 여기서 지금 옵션으로 다시 짠다(보던 카드는 ② 맨 앞에 남는다).
  useLayoutEffect(() => {
    if (!session) return;
    const next = arrangeLevelSession(session, studyOpts, { pin: head });
    if (next !== session) setSession(next);
  }, [session, studyOpts, head]);
  const currentKey = head;
  const current = currentKey ? byCard.get(currentKey) : null;
  const done = sessionDone(session);
  // 한도 뒤에 남긴 새 단어 — 그사이 다른 곳에서 채점한 단어는 빼고 센다. 「새 단어 N개 더」는 하루 몫만큼(0개로 둔 사람은 기본 15개).
  const stillNew = useCallback((k) => ['new', 'saved'].includes(table.get(k)?.status), [table]); // 담음 = 담기만 한 새 단어
  const heldCount = useMemo(() => (session?.held?.length ? session.held.filter(stillNew).length : 0), [session, stillNew]);
  const moreBatch = Math.min(heldCount, newPerDay || DEFAULT_NEW_PER_DAY);
  const moreNew = () => { setSession((cur) => moreLevelSession(cur, moreBatch, stillNew)); setRevealed(false); };
  // 오늘 시작한 새 단어 — 서버 몫의 쓴 수(전에 담고 오늘 처음 공부한 단어 포함), 못 읽으면 기기 셈.
  const startedToday = useMemo(() => (!heldCount ? 0 : slots ? slots.used : newStartedToday(index, language, clock)), [heldCount, slots, index, language, clock]);

  // ── 훑어보기(채점 없음 — 끝 화면 「전체 훑어보기」 · CARD-TYPES-001 A안으로 보기 탭에서 옮김). 한 단어는 앞뒤로 넘기고, 리스트는 레벨 순서 그대로.
  // 기기 설정이 아니다 — 다시 열면 오늘 줄부터. 「학습으로」 · Esc로 나온다.
  const [browse, setBrowse] = useState(false);
  const [browseAt, setBrowseAt] = useState(0);
  const [browseLimit, setBrowseLimit] = useState(LEVEL_WORD_PREFS.page);
  useEffect(() => { setBrowseAt(0); setBrowseLimit(prefs.page); setBrowse(false); }, [levelKey, prefs.page]);
  const browseEntry = browse ? allEntries[Math.min(browseAt, allEntries.length - 1)] || null : null;

  // 모드 줄은 첫 채점 뒤 접힌다(두 모드 모두 — 문서 「상단 네 줄」). 다시 바꾸려면 제목을 눌러
  // 맨 위로 가며 펼친다(오너 2026-10-21 KST — 모드는 페이지 줄에만 있다). 펼친 줄은 다음 채점에서 다시 접힌다.
  const foldKey = `g${session?.graded ?? 0}`;
  const [unfoldedAt, setUnfoldedAt] = useState(null);
  const folded = unfoldedAt !== foldKey && !browse && !!session && session.graded > 0 && !done;
  const rowsRef = useHeightSettle(folded);

  // ── 리스트 — 위 목록 = 지금 채점할 차례인 카드만(① 시간이 된 카드 ② 오늘 복습 · 새 단어). 그 밖은 접힌 두 줄 ──
  // 기다리는 카드(③ 아직 채점할 수 없음)는 아예 그리지 않는다(LEVEL-WAIT-001 · 오너 결정 2026-11-01 KST — Anki처럼. 전에는 위 목록 바로 아래 붙어
  // 잠긴 카드가 지금 풀 카드처럼 보였다). 시간이 되면 위 목록에 「지금」으로 올라온다(펼침 움직임). 위 목록이 비면 「오늘 할 카드 끝」만.
  // 「복습 예정」 = 한 번 본 단어(다음 복습이 가까운 순 · 날짜 없는 알아요 단어는 끝에 「졸업」), 「새 단어」 = 아직 안 본 단어(목록 순서).
  // 한 줄에 섞여 있으면 진도가 어디까지인지 안 보였다(오너 2026-10-26 KST · 시안 ⑨). 기다리는 카드는 오늘 줄이라 두 줄에도 없다(inLine).
  const [laterOpen, setLaterOpen] = useState({ review: false, fresh: false });
  const [laterLimit, setLaterLimit] = useState({ review: LEVEL_WORD_PREFS.page, fresh: LEVEL_WORD_PREFS.page });
  useEffect(() => { setLimit(prefs.page); setLaterLimit({ review: prefs.page, fresh: prefs.page }); }, [prefs.page]);
  const listed = useMemo(() => {
    if (!session) return null;
    const due = sessionDue(session, clock);
    const waiting = sessionWaiting(session, clock);
    const pick = (keys) => keys.map((k) => byCard.get(k)).filter(Boolean);
    // 미리 학습 — 줄(① + ②)이 비면 20분 안의 학습 · 재학습 카드가 그 자리에(남은 시간 칩 · 네 칸 켜짐). 「오늘 할 카드 끝」은 20분 넘게 남은 카드만 남을 때.
    const order = sessionOrder(session, clock);
    const line = order.length ? order : aheadKeys;
    const active = pick(line.includes(head) ? [head, ...line.filter((k) => k !== head)] : line);
    const ahead = new Map(aheadKeys.map((k) => [k, aheadAt(k)]));
    // 줄에 있는 열쇠는 한 번 모아 둔다 — 단어마다 sessionHas(줄 전체 훑기)를 부르면 손님 줄(레벨 전체)에서 N²(H7 5,562장 = 약 3천만 번).
    const inLine = new Set([...session.queue, ...session.waiting.map((w) => w.key)]);
    const { review, fresh } = splitLaterEntries(allEntries, inLine, (k) => table.get(k)?.graded, (k) => table.get(k)?.projection?.review?.nextQuestionAt);
    return { active, due: new Set(due), ahead, rise: new Set([...due, ...aheadKeys]),
      waiting: waiting.filter((w) => !ahead.has(w.key)).map((w) => ({ entry: byCard.get(w.key), at: w.at })).filter((w) => w.entry),
      later: { review: review.map((r) => r.entry), fresh }, laterNext: new Map(review.map((r) => [r.entry.key, r.next])) };
  }, [session, clock, head, byCard, allEntries, table, aheadKeys, aheadAt]);
  const laterChip = (key) => laterDueText(listed?.laterNext.get(key) ?? null, clock);
  const shown = limit + (listed?.due.size || 0); // 시간이 된 카드는 page장 위에 더한다(지금 카드를 밀어내지 않게)
  // 끝까지 내리면 다음 page장(LEVEL-WAIT-001 — 「다음 20개 보기」 단추 대신). 데이터는 이미 다 받아 두었고 그리는 양만 나눈다.
  // 위 목록 끝의 빈 표시(lw-more-sentinel)가 화면 아래 400px 안으로 들어오면 늘린다 — 늘린 뒤에도 보이면 다음 그림에서 또 늘린다.
  const moreRef = useRef(null);
  const moreLeft = listed && prefs.mode === 'list' ? listed.active.length > shown : false;
  useEffect(() => {
    const el = moreRef.current;
    if (!moreLeft || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((hits) => { if (hits.some((h) => h.isIntersecting)) setLimit((n) => n + prefs.page); }, { rootMargin: '0px 0px 400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [moreLeft, shown, prefs.page]);
  const cardEl = (key) => document.querySelector(`.lw-list[data-main] .lw-card[data-key="${CSS.escape(key)}"]`);
  // 기다리던 카드가 시간이 되어(또는 미리 학습으로) 지금 카드 다음 자리로 올라오면 펼쳐 보인다(처음 그릴 때 · 지금 카드는 빼고).
  const dueSeen = useRef(null);
  useLayoutEffect(() => {
    if (!listed || prefs.mode !== 'list') { dueSeen.current = null; return; }
    const prev = dueSeen.current;
    dueSeen.current = listed.rise;
    if (!prev || reducedMotion()) return;
    for (const key of listed.rise) {
      const el = !prev.has(key) && key !== head ? cardEl(key) : null;
      if (el?.animate) playArrive(el);
    }
  }, [listed, prefs.mode, head]);
  useEffect(() => {
    if (!jumpTo || prefs.mode !== 'list' || charTables === null || !listed) return; // charTables false = 표를 못 받음(칸 없이 옮긴다)
    const at = listed.active.findIndex((e) => e.key === jumpTo);
    if (at >= shown) { setLimit(at + prefs.page); return; }
    // 접힌 단어로 가면 그 단어가 든 줄(복습 예정 · 새 단어)만 펼친다. 기다리는 카드는 그리지 않으니 옮길 자리가 없다(아래 cardEl이 없음).
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

  // 리스트의 채점 대상(아래 네 칸) = 위 목록 맨 위 카드(head). 카드를 누르면 그 카드(오너 확정 2026-10-19 KST 「아래 고정」 · 「오늘 할 줄」).
  // 누른 카드를 채점하면 그 다음 카드가 대상으로 이어지고, 맨 위 카드를 채점하면 다음 차례가 맨 위로 온다.
  // 기본 대상은 위 목록에서만 — 위 목록이 비면 네 칸을 그리지 않는다(LEVEL-WAIT-001). 접힌 두 줄의 카드는 눌렀을 때만 대상이 되고,
  // 지금 채점할 수 없는 카드(차례 전 복습 예정)면 네 칸이 꺼진 채 「N일 후 채점해요」.
  const [focusKey, setFocusKey] = useState(null);
  const pickCard = useCallback((key) => setFocusKey(key), []);
  const topList = useMemo(() => (listed ? listed.active.slice(0, shown) : []), [listed, shown]);
  const listOrder = useMemo(() => (listed ? [...topList,
    ...(laterOpen.review ? listed.later.review.slice(0, laterLimit.review) : []),
    ...(laterOpen.fresh ? listed.later.fresh.slice(0, laterLimit.fresh) : [])] : []), [listed, topList, laterOpen, laterLimit]);
  const wordList = prefs.mode === 'list' && !browse;
  const focusEntry = wordList ? listOrder.find((e) => e.key === focusKey) || topList[0] || null : null;
  const focusInfo = focusEntry ? cardInfo(focusEntry.key) : null;
  // 듣기 카드 자동 읽기(예전 소리 탭 시안 ⑦-3을 듣기 카드가 이어받음) — 한 단어는 문제 면이 나올 때, 리스트는 채점 대상이 바뀔 때 한 번(예문).
  // 첫 소리는 브라우저 규칙상 누른 뒤에.
  const sayEntry = browse ? null : prefs.mode === 'one' ? (current?.kind === 'listening' && !revealed ? current : null) : (focusEntry?.kind === 'listening' ? focusEntry : null);
  const sayKey = sayEntry?.key ?? null;
  const sayTurn = prefs.mode === 'one' ? turn : 0;
  useEffect(() => { if (sayKey && speak) { const e = byCard.get(sayKey); if (e) speak(e.ex?.text || e.word); } }, [sayKey, sayTurn, speak]); // eslint-disable-line react-hooks/exhaustive-deps
  const listCard = (e, { due = false, wait = null, later = null, focused = e.key === focusEntry?.key, view = null } = {}) => <WordCard key={e.key} cardKey={e.key}
    entry={e} kind={e.kind} view={view} level={level} info={cardInfo(e.key)}
    tiles={tilesOf(e.word, e.kr)} speak={speak} tone={prefs.tone} onSave={() => onStar(e)} saving={saving === e.key} pop={pops.has(e.key)}
    onWord={onExampleWord} openKey={pop?.id} focused={focused} onPick={() => pickCard(e.key)} due={due} wait={wait} later={later}
    areas={areasOf(e.wordKey || e.key)} next={nextLine(e.wordKey || e.key)} />;
  // 누른 카드를 채점하면 바로 아래 카드로 — 지금 채점할 수 없는 카드로는 넘기지 않는다(맨 위 카드로 돌아간다).
  const followFocus = useCallback((key) => {
    const at = listOrder.findIndex((e) => e.key === key);
    const below = key !== head && at >= 0 ? listOrder[at + 1] : null;
    setFocusKey(below && cardInfo(below.key).previews ? below.key : null);
  }, [listOrder, head, cardInfo]);

  // ── 채점 ──
  const inFlight = useRef(new Set());
  // 오늘 새 단어 몫을 다 쓴 학습일(LEVEL-NEW-LIMIT-001) — 한 번도 공부하지 않은 카드(담기만 한 단어 포함)는 서버가 첫 문제 때 하루 새 단어
  // 몫을 쓴다. 다 쓴 뒤에는 그런 카드를 넘기지 않고(튕김 없이) 안내만 한다. 몫을 늘리면(단어장 설정) 다음 시도에서 다시 서버에 묻는다.
  const newLimitHit = useRef(null);
  // [한도 늘리기] = 단어장 복습 설정(하루 새 표현 한도)을 펼친 채로(#review-settings — 내 정보 시트와 같은 길). 예전 둘째 단추 [연습만 하기]
  // (그 단어 하나로 문장 연습 — LEVEL-SAVED-TAG-001)는 연습 탭을 없애며 뺐다(CARD-TYPES-001 A안).
  const newLimitNotice = (limit) => setNotice({ id: Date.now(), text: limit && limit < NEW_PER_DAY_UNLIMITED ? `오늘 새 단어 ${limit}개를 다 했어요` : '오늘 새 단어를 다 했어요',
    href: '/vocab#review-settings', action: '한도 늘리기', ms: 8000 });
  // 「하루」 줄(제목 시트 · LEVEL-WAIT-001) — 하루 새 단어 수를 바꾼다. 정본은 단어장 복습 설정과 같은 값(levelSetNewPerDay — 입장 한도
  // configure · 호환 모드는 vocab_new_per_day). 먼저 화면에 반영하고(아직 채점하지 않은 줄의 새 단어 · held를 새 몫으로 다시 나눈다 —
  // 채점 수 · 기다리는 카드 · 되돌리기 기록은 그대로), 저장에 실패하면 앞 값으로 되돌린다. 오늘 이미 시작한 수는 서버 몫(못 읽으면 기기 셈).
  const capFor = useCallback((limit) => (limit === NEW_PER_DAY_UNLIMITED ? Infinity
    : Math.max(0, limit - (slots ? slots.used : newStartedToday(index, language, Date.now())))), [slots, index, language]);
  const changePerDay = useCallback(async (limit) => {
    if (!userId || !isNewPerDayValue(limit)) return;
    const before = newPerDay;
    setNewPerDay(limit);
    setSession((cur) => arrangeLevelSession(cur, studyOpts, { pin: head, newCap: capFor(limit), keepNew: stillNew }));
    const res = await import('@/lib/levelDailyLoad').then((m) => m.levelSetNewPerDay(userId, limit)).catch(() => ({ ok: false }));
    if (!res.ok) {
      setNewPerDay(before);
      if (isNewPerDayValue(before)) setSession((cur) => arrangeLevelSession(cur, studyOpts, { pin: head, newCap: capFor(before), keepNew: stillNew }));
      toast('하루 새 단어 수를 바꾸지 못했어요. 잠시 뒤 다시 해 주세요.', 'error');
      return;
    }
    newLimitHit.current = null; // 몫을 늘렸으면 새 카드를 다시 서버에 묻는다
    queryClient.invalidateQueries({ queryKey: ['level-new-slots', userId] });
  }, [userId, newPerDay, studyOpts, head, capFor, stillNew, toast, queryClient]);
  const onGrade = useCallback(async (entry, rating, opts = {}) => {
    if (!userId) return askLogin(entry.key);
    if (!ready || inFlight.current.has(entry.key) || leaving.current) return undefined;
    const info = cardInfo(entry.key);
    if (info.known && rating > 1) {
      setNotice({ id: Date.now(), text: '졸업한 단어예요. 「다시」를 누르면 복습으로 돌아와요', ms: 4000 });
      return undefined;
    }
    // 지금 채점할 수 없는 카드(차례 전 · 60초 창 밖 — 옛 일정 카드도 같은 규칙, LEVEL-WAIT-001) — 네 칸이 꺼져 있고, 숫자 키도 받지 않는다.
    if (!info.previews) return undefined;
    const hit = newLimitHit.current;
    if (hit && hit.day === learningDay(schedulerTime(Date.now())) && hit.tries++ % 3 !== 2
        && !info.variant && info.projection?.source === 'fsrs-v1' && info.projection.memory?.state === 'New') { // 종류 카드는 몫을 쓰지 않는다
      newLimitNotice(hit.limit); // 세 번째마다는 서버에 다시 묻는다 — 그사이 설정에서 몫을 늘렸을 수 있다
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
      // 종류 카드(뜻 → 단어 · 듣기)는 그 카드 id로 같은 한 번 채점(gradeCard) — 담기 · 옛 일정 길이 없다.
      const res = info.variant ? await grader.gradeCard(info.variant, rating, { ahead: aheadMode }) : await grader.grade(entry, rating, { ahead: aheadMode });
      if (!res.ok) {
        if (advance) { setSession((cur) => revertLevelGrade(cur, before, moved, entry.key, rating)); setHeadKey(head); }
        if (res.reason === 'not-due') setNotice({ id: Date.now(), text: '복습실 카드라 복습 차례에만 채점할 수 있어요', href: '/review', action: '복습실', ms: 5000 });
        if (res.reason === 'new-limit') { newLimitHit.current = { day: learningDay(schedulerTime(Date.now())), limit: res.limit, tries: 0 }; newLimitNotice(res.limit); }
        return undefined;
      }
      setClock(Date.now());
      if (!info.graded) queryClient.invalidateQueries({ queryKey: ['level-new-slots', userId] }); // 첫 채점 — 서버 몫의 쓴 수를 다시 읽는다
      if (info.status === 'new') popKey(entry.key);
      setNotice({ id: Date.now(), quiet: { word: cfg.head(entry).hw, lang: cfg.hw, what: gradeToastText(rating, null) }, text: gradeToastText(rating, info.previews?.[rating]), action: grader.undoable(res.undo) ? '되돌리기' : null,
        onAction: grader.undoable(res.undo) ? () => undoRef.current?.({ undo: res.undo, sessionBefore: advance ? before : null, headBefore: advance ? head : null, key: entry.key }) : null });
      lastRef.current = { undo: res.undo, sessionBefore: advance ? before : null, headBefore: advance ? head : null, key: entry.key };
    } catch (error) {
      if (advance) { setSession((cur) => revertLevelGrade(cur, before, moved, entry.key, rating)); setHeadKey(head); }
      toast(failureMessage('채점하지 못했어요.', error), 'error');
    } finally { inFlight.current.delete(entry.key); }
    return undefined;
  }, [userId, ready, askLogin, cardInfo, session, prefs.mode, currentKey, head, followFocus, known.mutation, known.rows, queryClient, grader, toast, cfg, aheadMode]);

  const lastRef = useRef(null);
  const undoRef = useRef(null);
  const undo = useCallback(async (last = lastRef.current) => {
    if (!last) return;
    lastRef.current = null;
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

  // ── 상단 · 제목 시트(레벨 · 목록 · 학습 옵션 — 해 모양 설정 창은 여기로 합쳤다, 오너 2026-10-21 KST · 학습 옵션 2026-10-31 KST) ──
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
  // 훑어보기 열기 · 닫기 — 모드와 같은 0.2초 겹침(⑥-3). 끝 화면 「전체 훑어보기」 · 하루 몫에서 멈춘 리스트의 같은 단추가 연다.
  const setBrowsing = (on) => {
    if (on === browse) return;
    const go = () => flushSync(() => { setBrowse(on); setRevealed(false); setFocusKey(null); });
    if (typeof document !== 'undefined' && document.startViewTransition && !reducedMotion()) document.startViewTransition(go); else go();
    if (on) window.scrollTo({ top: 0 });
  };
  // 「카드」 줄(CARD-TYPES-001 — 학습 옵션 시트) — 켜진 카드 종류를 바꾼다. 「하루」와 같은 길(levelSetCardKinds — 입장 configure, 복습실과 같은 값):
  // 먼저 화면에 반영하고(끈 종류의 카드는 줄에서 빠져 쉰다 · 켠 종류는 카드 목록을 읽어 줄에 더한다), 저장에 실패하면 앞 값으로 되돌린다.
  const changeCardKinds = useCallback(async (kind) => {
    if (!userId || !slots) return;
    const before = cardKinds;
    const next = toggleLevelCardKind(before, kind);
    if (next.length === before.length && next.every((k, i) => k === before[i])) return;
    setKindsChoice(next);
    const res = await import('@/lib/levelDailyLoad').then((m) => m.levelSetCardKinds(userId, next)).catch(() => ({ ok: false }));
    if (!res.ok) {
      setKindsChoice(null);
      toast('카드 종류를 바꾸지 못했어요. 잠시 뒤 다시 해 주세요.', 'error');
      return;
    }
    queryClient.setQueryData(['level-new-slots', userId], (cur) => (cur ? { ...cur, cardKinds: res.cardKinds } : cur));
    setKindsChoice(null);
    queryClient.invalidateQueries({ queryKey: ['level-card-kinds', userId] });
  }, [userId, slots, cardKinds, toast, queryClient]);
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

  const currentInfo = current ? cardInfo(current.key) : null;
  // 한 단어 대기 화면(LEVEL-WAIT-001 시안 ③) — 줄에 기다리는 카드만 남았고 가장 빠른 카드(current = 앞당긴 카드)도 아직 채점할 수 없을 때.
  // 잠긴 카드를 띄우지 않고 남은 시간만 센다. 시간이 되면 comesAt 타이머가 시계를 당겨 카드가 저절로 뜬다. 20분 안의 학습 · 재학습 카드는
  // 대기 화면 없이 바로 이어진다(미리 학습 — current = 미리 올린 카드, 네 칸이 켜져 있다).
  const oneWait = !!session && !!current && !browse && prefs.mode === 'one' && !sessionOrder(session, clock).length
    && !!nextAt && !currentInfo?.previews;

  // ── 키보드 — Space 정답 확인 · 1–4 채점(리스트는 아래 네 칸의 대상 카드) · Ctrl/⌘+Z 되돌리기(복습실과 같은 키) ──
  const keyState = useRef({});
  keyState.current = { current: oneWait ? null : current, revealed, mode: prefs.mode, blocked: searchOpen || sheetOpen || !!card, onGrade, undo, focus: focusEntry, browse,
    leaveBrowse: () => setBrowsing(false),
    // 다음 카드를 펼치면 직전 채점의 조용한 되돌리기는 거둔다(뒷면 안내 줄과 겹치지 않게 — Ctrl/⌘+Z는 창 안이면 그대로).
    reveal: () => { setRevealed(true); setNotice((n) => (n?.quiet ? null : n)); },
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
        if (event.key === 'Escape') { event.preventDefault(); h.leaveBrowse(); }
        return;
      }
      // 숫자 키는 정답을 펼치지 않아도 바로 채점한다(네 칸은 앞면에서도 누를 수 있다 — 오너 결정, 2026-10-21 KST 재확인).
      const rating = ['1', '2', '3', '4'].includes(event.key) ? Number(event.key) : 0;
      if (h.mode === 'list') { if (h.focus && rating) { event.preventDefault(); h.onGrade(h.focus, rating, { next: true }); } return; }
      if (h.mode !== 'one' || !h.current) return;
      if ((event.key === ' ' || event.key === 'Enter') && !h.revealed && !event.target.closest?.('button, a')) { event.preventDefault(); h.reveal(); return; }
      if (rating) { event.preventDefault(); h.onGrade(h.current, rating); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (done && prefs.mode === 'one' && session?.graded && !browse) document.getElementById('lw-done-title')?.focus({ preventScroll: true }); },
    [done, prefs.mode, session?.graded, browse]);

  const title = cfg.title(level);
  const tone = prefs.tone;
  // 차례 전 카드는 채점할 수 없다(FSRS 서버 규칙 · 옛 일정 카드도 같은 규칙 — LEVEL-WAIT-001 · 오너 결정 2026-11-01 KST). 네 칸은 꺼지고
  // 안내는 「N분 후 채점해요」 하나(예전의 복습실 카드 머리말은 뺐다 — 옛 일정 카드도 같은 규칙이라). 날 단위 기한은 「1일 후」처럼 학습일 수로(접힌 칸 글자와 같은 셈).
  const gradeNote = (info) => {
    if (!(info?.status && !info.previews && info.projection)) return null;
    const at = nextDueMs(info.projection);
    if (!at) return '지금은 채점할 수 없어요';
    const later = laterDueText(at, clock);
    return later.endsWith('일 후') ? `${later} 채점해요` : <><WaitChip at={at} /> 채점해요</>;
  };
  const tomorrow = useMemo(() => (done ? dueTomorrowCount(allEntries.map((e) => table.get(e.key)?.projection), clock) : 0), [done, allEntries, table, clock]);
  // 끝 화면 — 한 단어 · 리스트 공통(리스트에서는 「리스트로」가 없다).
  const doneScreen = ({ onList = null } = {}) => <OneWordDone graded={session.graded} tomorrow={tomorrow} counts={session.counts}
    onNext={next ? goNext : null} nextLabel={next ? cfg.tag(cfg.levelOf(next)) : null} onList={onList}
    more={moreBatch} perDay={newPerDay || 0} started={startedToday} onMore={moreNew} onBrowse={() => setBrowsing(true)} />;

  // 묶음을 받기 전 자리 — 붙기 전과 같은 「고르는 중」, 받지 못하면 그 자리에 다시 시도.
  const pending = words.failed
    ? <div className="lw-empty" role="alert"><p>단어 목록을 불러오지 못했어요.</p><button type="button" className="lw-btn" onClick={words.retry}>다시 시도</button></div>
    : <p className="lw-empty" aria-busy="true">단어를 고르는 중…</p>;

  const cardEntry = card ? byKey.get(card.word) : null;
  const popRow = pop ? rowOfWord(pop.text) : null;

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
        <h1 className="lw-title"><button type="button" onClick={onTitle} title="맨 위로 · 레벨 · 목록 · 학습 옵션">{title}</button></h1>
        <button type="button" className="lw-title__caret lw-icon" aria-label="레벨 · 목록 · 학습 옵션" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}><CaretIcon /></button>
        <button type="button" className="lw-icon" aria-label="단어 찾기" onClick={openSearch}><SearchIcon /></button>
      </header>}

    {!searchOpen && <>
      <div className="lw-rows" ref={rowsRef} hidden={folded || undefined}>
        <div className="lw-seg" role="group" aria-label="모드" data-thumb="" style={{ '--i': prefs.mode === 'list' ? 1 : 0 }}>
          {[['one', '한 단어'], ['list', '리스트']].map(([id, label]) => <button key={id} type="button" aria-pressed={prefs.mode === id} onClick={() => switchMode(id)}>{label}</button>)}
        </div>
      </div>
      {userId && <div className="lw-prog" ref={progRef} data-stuck={stuck || undefined}>
        {ready && loaded ? <>
          <div className="lw-bar" role="progressbar" aria-label="이 레벨에서 채점한 단어" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ '--p': percent / 100 }} /></div>
          <span className="lw-pct">{percent}%</span>
        </> : <span className="lw-bar lw-bar--off" aria-hidden="true" style={{ visibility: 'hidden' }} />}
      </div>}
      {/* 훑어보기 머리 — 보기 탭이 없으니 나가는 길을 여기 둔다(채점 없음 · Esc도 같다). */}
      {browse && <div className="lw-browsing"><p>전체 훑어보기</p>
        <button type="button" className="lw-btn" onClick={() => setBrowsing(false)} aria-keyshortcuts="Escape">학습으로</button></div>}
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
          <ul className="lw-list" data-main="">{allEntries.slice(0, browseLimit).map((e) => listCard(e, { focused: false, view: 'all' }))}</ul>
          {allEntries.length > browseLimit && <div className="lw-more"><button type="button" onClick={() => setBrowseLimit((n) => n + prefs.page)}>
            다음 {Math.min(prefs.page, allEntries.length - browseLimit)}개 보기 · 남은 {allEntries.length - browseLimit}개</button></div>}
          {!allEntries.length && <p className="lw-empty">이 레벨에는 단어가 없어요</p>}
        </>
      : prefs.mode === 'one'
        ? <div className="lw-one">
          {!session && pending}
          {session && done && doneScreen({ onList: () => switchMode('list') })}
          {oneWait && <OneWordWait at={comesAt} onList={() => switchMode('list')} />}
          {session && current && !oneWait && <OneWordCard entry={current} kind={current.kind} info={currentInfo} tiles={tilesOf(current.word, current.kr)}
            speak={speak} tone={tone} revealed={revealed} onReveal={() => keyState.current.reveal()} turnKey={turn ? `${turn}:${current.key}` : null}
            onWord={onExampleWord} openKey={pop?.id} wait={aheadKeys.includes(current.key) ? aheadAt(current.key) : null} />}
          {session && current && !oneWait && <GradeBar previews={currentInfo.previews} onGrade={(r) => onGrade(current, r)} disabled={!ready} note={gradeNote(currentInfo)} />}
        </div>
        : <>
          {!listed && pending}
          {listed && <>
            {topList.length > 0 && <ul className="lw-list" data-main="">{topList.map((e) => listCard(e, { due: listed.due.has(e.key), wait: listed.ahead.get(e.key) ?? null }))}</ul>}
            {moreLeft && <div className="lw-more-sentinel" ref={moreRef} aria-hidden="true" />}
            {/* 리스트도 다 끝나면 한 단어와 같은 끝 화면(시안 「단어 페이지 손질」 정리) */}
            {done && allEntries.length > 0 && doneScreen()}
            {/* 위 목록을 다 풀었고 20분 넘게 남은 카드만 남음(20분 안의 학습 · 재학습 카드는 미리 학습으로 위에 있다) — 다음 카드가 올라올 때까지
                (LEVEL-WAIT-001 시안 ② 「드문 경우」). 하루 몫에서 멈췄으면 「새 단어 N개 더」. */}
            {!listed.active.length && listed.waiting.length > 0 && <div className="lw-capped" role="status">
              <p className="lw-capped__t">{moreBatch > 0 ? <NewDayTitle started={startedToday} /> : '오늘 할 카드 끝'}</p>
              {/* 남은 시간은 1초마다 바뀐다 — 알림 영역(status) 안에서 매초 읽히지 않게 이 줄만 끈다. */}
              <p className="lw-capped__s" aria-live="off"><WaitText at={comesAt}>{(amount) => (amount ? `다음 카드는 ${amount} 후에 위로 올라와요` : '다음 카드가 곧 위로 올라와요')}</WaitText></p>
              {moreBatch > 0 && <>
                <div className="lw-done__row">
                  <MoreNewButton more={moreBatch} onMore={moreNew} />
                  <button type="button" className="lw-btn" onClick={() => setBrowsing(true)}>전체 훑어보기</button>
                </div>
                <MoreNewNote perDay={newPerDay || 0} />
              </>}
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
            disabled={!ready} label={<GuideFace kind={focusEntry.kind} meaning={focusEntry.meaning} hw={cfg.head(focusEntry).hw} hwLang={cfg.hw} />} />}
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

    {sheetOpen && <TitleSheet levels={levels} levelKey={levelKey} kinds={kindLinks} prefs={prefs} onPrefs={setPrefs}
      perDay={userId ? newPerDay : null} onPerDay={changePerDay} cardKinds={userId && slots ? cardKinds : null} onCardKinds={changeCardKinds}
      onClose={() => setSheetOpen(false)} />}

    {notice && <Notice key={notice.id} notice={notice} onDone={dropNotice} />}
  </div></PieceDrillContext.Provider></WordLangContext.Provider>;
}
