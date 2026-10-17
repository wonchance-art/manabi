'use client';

import { usePathname } from 'next/navigation';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { recordReviewCompleted } from '../lib/learn/progressStore';
import { useTTS } from '../lib/useTTS';
import { useLearningCapabilities } from '../lib/useLearningCapabilities';
import { useFsrsReview, fsrsIntervalLabel } from '../lib/useFsrsReview';
import { useLearningAdmission } from '../lib/useLearningAdmission';
import { isSettledFsrsActivity } from '../lib/learningActivity';
import FsrsReviewSession from '../components/vocab/FsrsReviewSession';
import { callGemini } from '../lib/gemini';
import Button from '../components/Button';
import OfflineNotice, { PendingReviewsNotice } from '../components/OfflineNotice';
import ConfirmModal from '../components/ConfirmModal';
import VocabularyExclusionList from '../components/VocabularyExclusionList';
import VocabReview, { REVIEW_PREP_FAILED } from './VocabReview';
import { CardGridSkeleton, SkeletonLine } from '../components/Skeleton';
import { failureMessage } from '../lib/errorMessage';
import { detectLang, detectLangConfident, hasCjkText } from '../lib/constants';
import { choiceLabels, choiceMeaning } from '../lib/meaningClean';
import { authEntryHref } from '../lib/authRedirect';
import { bookExpressionListHref, fetchBookScope, fetchMaterialVocabularyIds } from '../lib/bookReviewNavigation';
import {
  countReviewScope, reviewScopeQuota, scopedFsrsCardIds, createScopeMatcher, scopeNeedsLookup, serializeReviewScope, scopeHeading,
  wordScopeLanguage, formatScopeSource, parseReviewScope, REVIEW_SCOPE_LANGS, ZH_SCOPE_LEVELS, SCOPE_LANG_LABELS, scopeSummaryLabel, FRAGILE_RETRIEVABILITY,
} from '../lib/reviewScope';
import {
  DEFAULT_SESSION_LENGTH, SESSION_LENGTHS, initialSteps, insertAfterIntro, insertLearningStep,
  readResume, restoreResume, sessionLengthOptions, sliceSession, stepProgress, writeResume,
} from '../lib/reviewQueue';
import { hasMeaning, readReviewSound, saveReviewSound, shouldAutoplay } from '../lib/reviewCard';
import { textbookThemeStyle } from '../lib/textbookTheme';
import { buildPracticeEvent, practiceFragileIds } from '../lib/practiceEvents';
import { ReviewIntroCard, ReviewSoundToggle, useScoreArmed } from '../components/vocab/ReviewCardParts';
import { useKnownWords } from '../lib/useKnownWords';
import { knownWordsLang } from '../lib/knownWords';
import ReviewScopeBar, { ReviewScopeNotice } from '../components/vocab/ReviewScopeBar';
import { useVocabData, invalidateVocabularyLearning } from '../lib/useVocabData';
import { isVocabularyReviewAvailable, isVocabularyUnreviewed, vocabularyRetrievability } from '../lib/vocabularyLearningRead';
import { wordStage } from '../lib/growthStats';
import { confusedVocabWords, CONFUSED_MIN, CONFUSED_SINCE_DAYS } from '../lib/confusedQueue';
import { dropUndoneEvents } from '../lib/undoneReviews';
import { fetchUndoMarkers } from '../lib/undoneReviewsRows';
import { weaknessProfile } from '../lib/weaknessProfile';
import { weakDrillPrescription, weakDrillWords, hasWeakDrill } from '../lib/weakDrill';
import { tagLabel } from '../lib/errorTags';
import { exportCSV, exportAnki } from '../lib/vocabIO';
import { zhHskLevelOf, loadZhHskLevels } from '../lib/zhHskLevel';
import { useZhHskLevels } from '../lib/useZhHskLevels';
import { prefetchSpeech, unlockSpeechAudio } from '../lib/useTTS';
import { logReviewEvents } from '../lib/reviewEvents';
import { withLegacyReviewLock } from '../lib/legacyReviewSync';
import {
  deckOf, fisherYatesShuffle, isNewWord, usableVocabReviewMode,
  loadIntroIds, saveIntroIds,
  NEW_PER_DAY_OPTIONS, DEFAULT_NEW_PER_DAY,
} from '../lib/vocabStudy';

import '../components/web/review-room.css';
import dynamic from 'next/dynamic';
import Spinner from '../components/Spinner';

// 둘러보기 탭 · 상세 카드는 첫 화면(복습방)에 없다 — 페이지 청크에서 뺀다(2026-10-17 KST 번들 조사, refShared 포함 소스 약 44KB).
// 오프라인 첫 화면(오류 분기의 캐시 목록)도 목록을 쓰므로 첫 렌더 뒤 유휴 시간에 미리 받는다(SW가 청크를 캐시).
const loadVocabList = () => import('./VocabList');
const loadVocabDetailCard = () => import('./VocabDetailCard');
const VocabList = dynamic(loadVocabList, { loading: () => <Spinner message="담은 표현 불러오는 중…" /> });
const VocabDetailCard = dynamic(loadVocabDetailCard, { loading: () => null });

const MAX_EXAMPLE_CACHE = 50;

// W R2 undo 스냅샷이 복원하는 SRS 5필드 — persistVocabGrade 페이로드와 같은 snake_case
const SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];

const NOT_EXPLICIT = Object.freeze({ explicit: false });
const EMPTY_IDS = Object.freeze([]);
const SAVED_SCOPE_KEY = 'vocab_reviewScope';

export default function VocabPage({ reviewScope = NOT_EXPLICIT }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-container manabi-review-room" role="status">계정을 확인하고 있어요…</div>;
  // 명시 범위 주소가 무효면 닫힌다 — 「전체」로 새지 않고 저장된 설정도 건드리지 않는다(REV-SCOPE-R1A 원칙 5).
  if (reviewScope?.invalid) return (
    <div className="page-container manabi-review-room">
      <header className="review-room-heading"><div><p className="manabi-eyebrow">THE REVIEW ROOM</p><h1>복습</h1></div></header>
      <section className="review-room-state" role="alert"><h2>범위 주소를 읽지 못했어요.</h2><p>전체로 바꾸지 않았어요. 범위를 풀고 다시 골라 주세요.</p><Link href="/vocab" className="btn btn--primary btn--md">범위 풀기</Link></section>
    </div>
  );
  // 계정이 바뀌면 큐·답·undo·열린 상세를 함께 폐기한다. 이전 계정 세션을 재사용하지 않는다.
  const scopeKey = reviewScope?.explicit ? serializeReviewScope(reviewScope.scope, { returnTo: reviewScope.returnTo }) : 'saved';
  return <VocabWorkspace key={`${user?.id || 'guest'}:${scopeKey}`} reviewScope={reviewScope?.explicit ? reviewScope : NOT_EXPLICIT} />;
}

// 저장된 범위(명시 주소가 없을 때) — 새 키를 먼저, 없으면 옛 언어 · 급수 필터 값을 한 번 옮겨 읽는다(덱 값은 출처로 흡수돼 버린다).
function readSavedScope() {
  const saved = localStorage.getItem(SAVED_SCOPE_KEY);
  if (saved !== null) {
    const parsed = parseReviewScope(new URLSearchParams(saved));
    if (parsed.explicit && !parsed.invalid) return parsed.scope;
  }
  const lang = localStorage.getItem('vocab_langFilter');
  const level = localStorage.getItem('vocab_levelFilter');
  const validLang = REVIEW_SCOPE_LANGS.includes(lang) ? lang : null;
  const validLevel = ZH_SCOPE_LEVELS.includes(level) && (!validLang || validLang === 'Chinese') ? level : null;
  if (!validLang && !validLevel) return null;
  return { lang: validLevel ? 'Chinese' : validLang, level: validLevel, source: null, state: 'due' };
}

function VocabWorkspace({ reviewScope }) {
  // 로그인 뒤 지금 화면으로 돌아온다(맨 /auth는 /home으로 보낸다) — 대상 검증은 authEntryHref 규칙.
  const signInHref = authEntryHref(usePathname());
  const { user, profile, refreshProfileReadOnly } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { speak: speakSupported, supported: ttsSupported } = useTTS();
  const koreanCapabilities = useLearningCapabilities('Korean');
  // 카드의 「아는 단어」 — 표시 · 해제만 쓴다(목록 조회는 하지 않는다). 표시하면 복습 보호와 출제 소비자가 함께 갱신된다.
  const knownWords = useKnownWords(null, false);
  const reviewSupported = useCallback(word => word?.language !== 'Korean' || koreanCapabilities.review, [koreanCapabilities.review]);
  const speak = useCallback((text, language, ...options) => {
    if (language !== 'Korean') speakSupported(text, language, ...options);
  }, [speakSupported]);
  const [tab, setTab] = useState('list');
  const [startingReview, setStartingReview] = useState(false);
  const startingRef = useRef(false);
  useEffect(() => {
    const warm = () => { loadVocabList(); loadVocabDetailCard(); };
    const id = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(warm, { timeout: 3000 }) : window.setTimeout(warm, 1500);
    return () => (typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);
  const workspaceAlive = useRef(true);
  const gradeLifetimeRef = useRef(0);
  useEffect(() => {
    workspaceAlive.current = true;
    const lifetime = gradeLifetimeRef.current;
    return () => {
      workspaceAlive.current = false;
      gradeLifetimeRef.current = lifetime + 1;
      pendingGradeRef.current = 0;
      scoringRef.current = false;
      lastGradeRef.current = null;
    };
  }, []);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);
  // 끝 공지(화면 읽기) — 끝 제목이 초점을 받지 못했을 때만 채운다(초점이 간 제목과 같은 말을 두 번 읽지 않게, a3ba 리뷰 ②).
  const [finishNotice, setFinishNotice] = useState(false);
  const scoringRef = useRef(false);
  const csvInputRef = useRef(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('due');
  const [showHint, setShowHint] = useState(false);
  // 복습 범위(REV-SCOPE-R1A) — 언어 · 급수 · 출처 · 상태 하나가 목록 · 개수 · 시작 · 줄을 함께 정한다.
  // 명시 주소(진입점)로 들어오면 그 범위로 시작하고, 바꿔도 저장 설정을 덮지 않는다. 주소가 없으면 저장된 범위를 복원 · 저장한다.
  const explicitScope = reviewScope.explicit ? reviewScope : null;
  const isBookScope = reviewScope.scope?.source?.kind === 'book';
  const [scopeDraft, setScopeDraft] = useState(reviewScope.explicit ? reviewScope.scope : null);
  const [settingsRestored, setSettingsRestored] = useState(false);
  useEffect(() => {
    if (!settingsRestored || explicitScope || !scopeDraft) return;
    try { localStorage.setItem(SAVED_SCOPE_KEY, serializeReviewScope(scopeDraft).replace(/^\/vocab\??/, '')); } catch { /* 저장소 차단 시 이 화면에서만 유지 */ }
  }, [scopeDraft, settingsRestored, explicitScope]);
  // 명시 주소로 들어온 범위를 칩 · 시트로 바꾸면 주소도 같은 범위로 바꾼다 — 새로고침 · 공유 · 뒤로 가기가 지금 범위를 잃지 않게
  // (M09 6152793665: HSK 3 적용 뒤에도 주소가 /vocab?lang=Chinese로 남아 새로고침하면 급수가 사라짐). 저장 설정은 여전히 덮지 않는다.
  // history.replaceState는 서버 페이지를 다시 그리지 않으므로 작업 공간(key)이 다시 마운트되지 않는다.
  const entryUrlRef = useRef(null);
  useEffect(() => {
    if (!explicitScope || !scopeDraft || typeof window === 'undefined') return;
    const current = `${window.location.pathname}${window.location.search}`;
    entryUrlRef.current ??= current;
    const href = serializeReviewScope(scopeDraft, { returnTo: explicitScope.returnTo });
    // 처음 범위로 돌아오면 들어온 주소 그대로(옛 ?book= 주소 포함), 바뀐 범위는 정본 주소로 쓴다.
    const target = href === serializeReviewScope(explicitScope.scope, { returnTo: explicitScope.returnTo }) ? entryUrlRef.current : href;
    if (current !== target) window.history.replaceState(window.history.state, '', target);
  }, [scopeDraft, explicitScope]);

  // 집중 연습 갈래(REV-SCOPE-R1B-1 §6-1 ④) — 스스로 확인(flash) · 뜻 쓰기(typing) · 듣고 고르기(listening).
  // 본 복습은 플래시(버튼 넷)뿐이다. 예전 「단어 복습 방식」(자동 · 문맥 · 타이핑 · 리스닝)의 타이핑 · 리스닝이 여기로 왔다.
  const [practiceMode, setPracticeMode] = useState('flash');
  useEffect(() => {
    if (settingsRestored) { try { localStorage.setItem('as_review_mode', practiceMode); } catch {} }
  }, [practiceMode, settingsRestored]);
  // 세션 길이(서로 다른 카드 수 — 20 · 50 · 전부) · 소리 자동 재생은 기기별로 기억한다.
  const [sessionLength, setSessionLength] = useState(DEFAULT_SESSION_LENGTH);
  useEffect(() => {
    if (settingsRestored) { try { localStorage.setItem('vocab_session_length', String(sessionLength ?? 'all')); } catch {} }
  }, [sessionLength, settingsRestored]);
  const [soundOn, setSoundOn] = useState(true);
  const toggleSound = on => { setSoundOn(on); saveReviewSound(on); };

  // 하루 새 단어 한도
  const [newPerDay, setNewPerDay] = useState(DEFAULT_NEW_PER_DAY);
  useEffect(() => {
    if (settingsRestored) { try { localStorage.setItem('vocab_new_per_day', String(newPerDay)); } catch {} }
  }, [newPerDay, settingsRestored]);

  // SSR와 hydration 첫 렌더는 고정 기본값을 사용하고 저장된 환경설정은 마운트 후 복원한다.
  useEffect(() => {
    try {
      if (!explicitScope) setScopeDraft(readSavedScope());
      const storedMode = localStorage.getItem('as_review_mode');
      setPracticeMode(['typing', 'listening'].includes(storedMode) ? storedMode : 'flash');
      const storedLength = localStorage.getItem('vocab_session_length');
      setSessionLength(storedLength === 'all' ? null : SESSION_LENGTHS.includes(Number(storedLength)) ? Number(storedLength) : DEFAULT_SESSION_LENGTH);
      setSoundOn(readReviewSound());
      const storedNewPerDay = parseInt(localStorage.getItem('vocab_new_per_day'), 10);
      setNewPerDay(NEW_PER_DAY_OPTIONS.includes(storedNewPerDay) ? storedNewPerDay : DEFAULT_NEW_PER_DAY);
    } catch { /* 저장소 차단 시 기본값 유지 */ }
    setSettingsRestored(true);
  }, [explicitScope]);

  // 오늘 새로 시작한 단어 ID (날짜 바뀌면 자동 리셋)
  const [introIds, setIntroIds] = useState([]);
  useEffect(() => setIntroIds(loadIntroIds()), []);
  const registerNewIntro = (id) => {
    setIntroIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { saveIntroIds(next); } catch {}
      return next;
    });
  };

  // 복습 줄(REV-SCOPE-R1B-1) — 단계 [{ id, engine:'fsrs'|'legacy', phase }]. 시작할 때 고정하고, 처음 보는 표현 뒤의
  // 채점 · 예전 일정 재질문 · 「다시」 재노출 · FSRS 학습 단계만 줄 메타데이터로 끼운다(일정은 저장하지 않는다).
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewSessionId, setReviewSessionId] = useState(0);
  // 이번 세션의 서로 다른 카드(진행 n / N · 세션 길이) · 끝낸 카드 · 「다시」 수 · 시작 시각 · 이어 하기 기록.
  const [reviewRun, setReviewRun] = useState(null);
  // 비동기 채점(FSRS 정착 · 예전 일정 계산 모듈 로드) 뒤에 줄을 넘길 때는 그사이 끼운 단계(학습 단계)를 놓치지 않게 최신 줄을 본다.
  const reviewQueueRef = useRef(reviewQueue);
  reviewQueueRef.current = reviewQueue;
  const reviewIdxRef = useRef(reviewIdx);
  reviewIdxRef.current = reviewIdx;
  const lastEngineRef = useRef('legacy');
  const lastTriggerRef = useRef('pointer');
  // 집중 연습(§6-1 ④) — { ids, idx, total, unknown, mode, scopeKey }. 일정 · 한도 호출 0회, 연습 기록만.
  const [practice, setPractice] = useState(null);
  // 카드에서 「아는 단어」(#1335) — 하단 「아는 단어로 옮겼어요 [되돌리기]」.
  const [knownUndo, setKnownUndo] = useState(null);
  const [missingMeaningOnly, setMissingMeaningOnly] = useState(false);
  // 이 세션에서 채점한 새 일정 카드(학습 단계 재확인 · 끝 화면 「잠시 뒤」) · 새 일정 「다시」 수.
  const [sessionFsrsIds, setSessionFsrsIds] = useState([]);
  const [fsrsAgain, setFsrsAgain] = useState(0);
  // 이어 하기 기록(세션 저장소) — 마운트 후 읽는다(SSR · hydration 첫 렌더는 비어 있음).
  const [resumeStore, setResumeStore] = useState(null);
  useEffect(() => {
    if (user?.id) setResumeStore(readResume(typeof window === 'undefined' ? null : window.sessionStorage, user.id));
  }, [user?.id]);

  // 미전송 복습 수(v2-N R2). 폴링하지 않는다 — 카드가 넘어갈 때(reviewIdx)와 Layout이
  // 동기화를 마치고 쏘는 신호, 두 시점에만 다시 센다. 게스트·큐 불가 환경은 0.
  const [legacyPendingReviewCount, setPendingReviewCount] = useState(0);
  useEffect(() => {
    if (!user?.id) { setPendingReviewCount(0); return; }
    let alive = true;
    const recount = async () => {
      try {
        const { pendingReviews } = await import('../lib/reviewOutbox');
        const rows = await pendingReviews(user.id);
        if (alive) setPendingReviewCount(rows.length);
      } catch { /* 큐를 못 써도 화면은 그대로 */ }
    };
    recount();
    window.addEventListener('manabi:outbox-flushed', recount);
    return () => { alive = false; window.removeEventListener('manabi:outbox-flushed', recount); };
  }, [user?.id, reviewIdx]);
  const [typingAnswer, setTypingAnswer] = useState('');
  const [contextSelected, setContextSelected] = useState(null);
  const exampleCacheRef = useRef(new Map());
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleSentences, setExampleSentences] = useState(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [confirmAction, setConfirmAction] = useState(null);
  const [detailWord, setDetailWord] = useState(null);

  const {
    vocab: allVocab, projections, learningAvailable, learningNow, materialTitles, isOffline, isLoading, error: vocabError, refetch: refetchVocab,
    scoreMutation, deleteMutation, csvImportMutation,
    updateVocabMutation, bulkDeleteMutation,
  } = useVocabData();
  const effectiveNow = Math.max(Date.now(), Date.parse(learningNow) || 0);
  const learningById = useMemo(() => new Map(projections.map(row => [row.vocabulary.id, row])), [projections]);
  const deckFor = useCallback(word => deckOf({ ...word, reading_materials: { title: materialTitles.get(word.source_material_id) } }), [materialTitles]);
  const reviewAvailable = useCallback(word => learningAvailable && isVocabularyReviewAvailable(learningById.get(word.id)), [learningAvailable, learningById]);
  const reviewDueAt = useCallback(word => {
    const projection = learningById.get(word.id);
    return projection?.review.available && projection.review.nextQuestionAt ? Date.parse(projection.review.nextQuestionAt) : Infinity;
  }, [learningById]);
  const mutationGuard = useRef(null);
  mutationGuard.current = { accountId: user?.id, koreanSave: koreanCapabilities.save, rows: allVocab };
  const canMutateWords = ids => {
    const current = mutationGuard.current;
    return workspaceAlive.current && !!user?.id && current.accountId === user.id && learningAvailable
      && ids.every(id => {
        const word = current.rows.find(row => row.id === id);
        return !!word && (word.language !== 'Korean' || current.koreanSave);
      });
  };
  const guardedDeleteMutation = { ...deleteMutation, mutate: (id, ...options) => {
    if (canMutateWords([id])) deleteMutation.mutate(id, ...options);
  } };
  const guardedBulkDeleteMutation = { ...bulkDeleteMutation, mutate: (ids, ...options) => {
    if (canMutateWords(ids)) bulkDeleteMutation.mutate(ids, ...options);
  } };
  const guardedUpdateVocabMutation = { ...updateVocabMutation, mutate: (body, ...options) => {
    if (canMutateWords([body.id])) updateVocabMutation.mutate(body, ...options);
  } };
  // 범위의 언어 — 주소 · 저장값이 없으면 학습 언어(배움 언어 칩이 생기면 그 값), 그 언어에 담은 표현이 없으면 가장 많은 언어.
  const languageCounts = useMemo(() => {
    const counts = new Map();
    for (const word of allVocab) {
      const lang = wordScopeLanguage(word);
      if (REVIEW_SCOPE_LANGS.includes(lang)) counts.set(lang, (counts.get(lang) || 0) + 1);
    }
    return counts;
  }, [allVocab]);
  const profileLang = Array.isArray(profile?.learning_language) ? profile.learning_language[0] : profile?.learning_language;
  const defaultLang = languageCounts.has(profileLang) ? profileLang
    : [...languageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || (REVIEW_SCOPE_LANGS.includes(profileLang) ? profileLang : 'Japanese');
  const scope = useMemo(() => ({ lang: scopeDraft?.lang || defaultLang, level: scopeDraft?.level ?? null,
    source: scopeDraft?.source ?? null, state: scopeDraft?.state || 'due' }), [scopeDraft, defaultLang]);
  const scopeKey = serializeReviewScope(scope);
  // 출처 id 조회(교재 과 범위 · 자료 · 노트) — 서버가 본인 단어 id 묶음을 주고 클라이언트가 좁힌다(교재 범위 선례).
  // 쿼리 키 접두사 'book-review'는 저장 · 제외 · 아는 단어 변경 때 이미 무효화된다.
  const lookupSource = scopeNeedsLookup(scope.source) ? scope.source : null;
  // 교재 범위는 단어별 과(chapter_slug)도 받는다 — 복습 줄에서 같은 과의 새 표현끼리 띄우는 단위(R1-B-1 §6-1 ③).
  const sourceScope = useQuery({
    queryKey: ['book-review', user?.id, 'scope', lookupSource ? formatScopeSource(lookupSource) : null],
    enabled: !!user && !!lookupSource,
    queryFn: async ({ signal }) => lookupSource.kind === 'book'
      ? fetchBookScope({ signal, from: lookupSource.from, to: lookupSource.to, bookId: lookupSource.bookId })
      : { ids: await fetchMaterialVocabularyIds({ signal, ids: lookupSource.ids }), chapters: null },
  });
  // 급수 범위는 HSK 2026 표가 있어야 판정한다. 표를 못 받으면 범위를 닫는다(전체로 세지 않는다).
  const scopeLevelsQuery = useQuery({ queryKey: ['zh-hsk-levels'], queryFn: loadZhHskLevels, enabled: !!scope.level, staleTime: Infinity, gcTime: Infinity });
  const scopeLevels = scope.level ? scopeLevelsQuery.data ?? null : null;
  const scopeSourceIds = lookupSource ? sourceScope.data?.ids ?? null : null;
  const scopeChapters = lookupSource ? sourceScope.data?.chapters ?? null : null;
  const scopeFailed = (!!lookupSource && sourceScope.isError) || (!!scope.level && scopeLevelsQuery.isError);
  const scopePending = !scopeFailed && ((!!lookupSource && !sourceScope.isSuccess) || (!!scope.level && !scopeLevels));
  const scopeMatcher = useMemo(() => createScopeMatcher(scope, { levels: scopeLevels, sourceIds: scopeSourceIds }), [scope, scopeLevels, scopeSourceIds]);
  // 범위 안 표현 — 목록 · 문맥 보기 · 재대결이 모두 이 범위를 본다. 범위를 아직 판정할 수 없으면 비어 있다(전체로 새지 않는다).
  const vocab = useMemo(() => scopeMatcher.ready ? allVocab.filter(scopeMatcher.matches) : EMPTY_IDS, [allVocab, scopeMatcher]);
  const scopeArgs = { snapshot: { projections, enabled: learningAvailable }, scope, now: effectiveNow, levels: scopeLevels,
    sourceIds: scopeSourceIds, reviewSupported };
  const hasAnyWords = isBookScope ? vocab.length > 0 : allVocab.length > 0;
  // FSRS 줄의 범위 — 개수(countReviewScope)와 같은 판정(scopedFsrsCardIds)으로 controller를 좁힌다.
  const fsrsScopeIds = useMemo(() => (learningAvailable ? scopedFsrsCardIds(scopeArgs) : null) ?? EMPTY_IDS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learningAvailable, projections, scopeKey, scopeLevels, scopeSourceIds, reviewSupported, Math.floor(effectiveNow / 60000)]);
  const fsrsControllerRef = useRef(null), quotaSignature = useRef(null);
  // 입장 한도가 **바뀌면** FSRS 목록을 다시 읽는다. 첫 한도는 바뀐 것이 아니다 — FSRS 목록은 마운트 때 이미 같은 서버 상태
  // (입장 상태 포함)를 읽고 있어, 첫 한도에 다시 읽으면 fsrs_capabilities · fsrs_list_states · learning_admission_status가
  // 한 번씩 더 나갔다(응답 순서에 따라 — 능력 RPC 중복 조사 2026-10-17 KST). 다만 FSRS 첫 읽기가 실패해 있으면 예전처럼
  // 그 김에 다시 읽는다(진행 중이면 refresh가 같은 약속을 돌려준다). 계정이 바뀌면 처음부터 센다.
  const quotaOwner = useRef(null);
  const admission = useLearningAdmission({ accountId: user?.id, onQuota: quota => {
    const signature = JSON.stringify([quota.learningDay, quota.policyRevision, quota.used, quota.active, quota.fsrsEnabled]);
    if (quotaOwner.current !== quota.actorId) {
      quotaOwner.current = quota.actorId; quotaSignature.current = signature;
      if (fsrsControllerRef.current?.getSnapshot?.().status === 'error') fsrsControllerRef.current.refresh();
      return;
    }
    if (signature !== quotaSignature.current) {
      quotaSignature.current = signature;
      fsrsControllerRef.current?.refresh();
    }
  } });
  const fsrsReview = useFsrsReview({ accountId: user?.id, words: allVocab, scopeIds: fsrsScopeIds, dailyNewLimit: newPerDay,
    onAdmission: () => admission.controller.refresh(),
    onApplied: (actorId, event) => {
      invalidateVocabularyLearning(queryClient, actorId);
      if (isSettledFsrsActivity(event, actorId)) refreshProfileReadOnly(actorId)?.catch(() => {});
    } });
  fsrsControllerRef.current = fsrsReview.controller;
  const pendingReviewCount = legacyPendingReviewCount + fsrsReview.pending.length;

  // 수동 단어 추가 모달
  const [manualAddOpen, setManualAddOpen] = useState(false);

  // W R2(#1077 5504350927) — 키 `1`~`4`는 「화면에 있는 4버튼 줄」에 작용한다: 채점(ScoreSection) /
  // 보기 선택(객관식·듣기, 클릭과 같은 함수) / 오답 후 2버튼(1 다시 · 2 정답 보기). 그 외 무시.
  // `Ctrl/⌘+Z` = 직전 채점 되돌리기(단일 레벨). 판정은 DOM 질의가 아니라 **상태**로(ScoreSection이
  // 세 군데 마운트된다). 수동 추가 다이얼로그가 열려 있으면 그 리스너(Escape/Tab)만 산다 — 두
  // 리스너가 경쟁하지 않는다. 핸들러는 ref로 읽어 렌더마다 리스너를 갈아 끼우지 않는다.
  const lastGradeRef = useRef(null);
  const pendingGradeRef = useRef(0);
  const gradeSequenceRef = useRef(0);
  const gradeSessionRef = useRef(0);
  const reviewKeysRef = useRef({});
  useEffect(() => {
    if ((tab !== 'review' && tab !== 'practice') || (tab === 'review' && reviewFinished) || manualAddOpen) return undefined;
    function onKeyDown(e) {
      const t = e.target;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const h = reviewKeysRef.current;
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.altKey) {
        if (inField || !h.canUndo) return;   // 입력 요소 안 기본 undo 무간섭 · 되돌릴 게 없으면 무동작
        e.preventDefault();
        h.undo?.();
        return;
      }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      // Space = 뒷면 보기(앞면일 때만 — REV-SCOPE-R1B-1 §5-3). 새 일정 카드는 그 화면이 같은 키를 처리한다.
      if (e.key === ' ' && h.space) { e.preventDefault(); h.space(); return; }
      if (!/^[1-4]$/.test(e.key)) return;
      const n = Number(e.key);
      if (!h.row) return;                    // 화면에 4버튼 줄이 없으면 아무 일도 하지 않는다
      e.preventDefault();
      if (h.row === 'score') h.score?.(n);
      else if (h.row === 'practice') { if (n <= 2) h.practice?.(n === 1 ? 1 : 3); }   // 집중 연습: 1 몰랐어요 · 2 알았어요
      else if (h.row === 'options') h.pick?.(n - 1);
      else if (h.row === 'wrong') { if (n === 1) h.score?.(1); else if (n === 2) h.reveal?.(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [tab, reviewFinished, manualAddOpen]);
  // 종료 화면에서는 숫자 채점을 재개하지 않고 직전 채점 undo만 받는다.
  useEffect(() => {
    if (tab !== 'review' || !reviewFinished || manualAddOpen) return undefined;
    function onFinishedUndo(e) {
      const t = e.target;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      const h = reviewKeysRef.current;
      if (inField || !h.canUndo || e.altKey || !(e.metaKey || e.ctrlKey) || !/^[zZ]$/.test(e.key)) return;
      e.preventDefault();
      h.undo?.();
    }
    document.addEventListener('keydown', onFinishedUndo);
    return () => document.removeEventListener('keydown', onFinishedUndo);
  }, [tab, reviewFinished, manualAddOpen]);
  const [manualDraft, setManualDraft] = useState({ word_text: '', furigana: '', meaning: '', pos: '', language: 'Japanese' });
  const manualDialogRef = useRef(null);
  const manualAddPendingRef = useRef(false);

  const manualAddMutation = useMutation({
    mutationFn: async (draft) => {
      const actorId = user?.id;
      const text = draft.word_text.trim();
      if (!text) throw new Error('단어를 입력해 주세요');
      // 사용자가 고른 언어가 먼저다. 없으면 **확신할 때만** 채우고, 못 가르면 비워 둔다
      // (표기 추측을 DB에 박지 않는다 — 옛 중국어 단어가 일본어로 굳던 자리다).
      const guess = draft.language || detectLangConfident(text);
      if (guess === 'Korean') throw new Error('지원하는 언어를 선택해 주세요.');
      if (!(await fsrsReview.controller.refresh()) || !workspaceAlive.current || mutationGuard.current.accountId !== actorId) {
        throw new Error('복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.');
      }
      const vocabulary = {
        word_text: text,
        base_form: hasCjkText(text) ? text : text.toLowerCase(),
        furigana: draft.furigana.trim(),
        meaning: draft.meaning.trim(),
        pos: draft.pos.trim(),
        ...(guess ? { language: guess } : {}),
      };
      if (fsrsReview.controller.getSnapshot().enabled) {
        // 활성 경로는 저장과 등록이 같은 트랜잭션이다. 실패를 기존 INSERT로 바꾸지 않는다.
        return fsrsReview.controller.saveVocabulary(vocabulary);
      }
      const row = { user_id: actorId, ...vocabulary, next_review_at: new Date().toISOString() };
      const { error } = await supabase.from('user_vocabulary')
        .upsert([row], { onConflict: 'user_id,word_text', ignoreDuplicates: true });
      if (error) throw error;
      return { ok: true, actorId, stale: !workspaceAlive.current || mutationGuard.current.accountId !== actorId };
    },
    onSuccess: (result) => {
      if (!workspaceAlive.current || result?.stale || (result?.actorId && result.actorId !== mutationGuard.current.accountId)) return;
      if (result?.ok !== true) {
        toast('복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.', 'error', 5000);
        return;
      }
      if (result.actorId !== user?.id) return;
      invalidateVocabularyLearning(queryClient, result.actorId);
      toast('단어를 추가했어요', 'success');
      setManualAddOpen(false);
      setManualDraft({ word_text: '', furigana: '', meaning: '', pos: '', language: 'Japanese' });
    },
    onError: (err) => { if (workspaceAlive.current && mutationGuard.current.accountId === user?.id) toast(failureMessage('단어를 추가하지 못했어요.', err), 'error'); },
  });
  manualAddPendingRef.current = manualAddMutation.isPending;

  useEffect(() => {
    if (!manualAddOpen) return undefined;
    const previousFocus = document.activeElement;
    const dialog = manualDialogRef.current;
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusInitial = window.setTimeout(() => dialog?.querySelector('[data-dialog-initial-focus]')?.focus(), 0);
    function onKeyDown(event) {
      if (event.key === 'Escape' && !manualAddPendingRef.current) {
        event.preventDefault();
        setManualAddOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll(selector) || [])].filter(el => !el.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [manualAddOpen]);

  // 급수 자동 분류(오너 승인 ②) — 급수는 저장하지 않고 표시 시점에 계산한다(기존 단어 소급 적용).
  // 기준은 HSK 2026 표(ZH-LEVEL-2026-001) — 중국어 단어가 있을 때만 1회 지연 로드. 표 밖 단어는 급수 없음.
  const hasZhVocab = useMemo(() => allVocab.some(v => v.language === 'Chinese'), [allVocab]);
  const zhHskLevels = useZhHskLevels(hasZhVocab);
  const refLevelOf = useCallback((v) => (
    v?.language === 'Chinese' ? zhHskLevelOf(v.word_text, zhHskLevels) : null
  ), [zhHskLevels]);
  // 급수는 범위의 축이다(목록 전용이 아니다 — REV-SCOPE-R1A). 중국어 범위에서만 고를 수 있다.
  const showLevelFilter = hasZhVocab && !!zhHskLevels && scope.lang === 'Chinese';
  // 범위 바꾸기 — 언어를 바꾸면 그 언어만의 범위로 돌아간다(언어 칩 숫자 = 그 범위의 개수). 멈춘 줄은 범위와 함께 버린다.
  const changeScope = useCallback(next => {
    setScopeDraft(next);
    setReviewQueue([]);
    setReviewIdx(0);
    setReviewFinished(false);
    setReviewRun(null);
    setPractice(null);
  }, []);
  const selectLanguage = useCallback(lang => changeScope({ lang, level: null, source: null, state: 'due' }), [changeScope]);
  const selectLevel = useCallback(level => changeScope({ ...scope, lang: 'Chinese', level: level === 'all' ? null : level,
    source: scope.source?.kind === 'book' ? null : scope.source }), [changeScope, scope]);

  // 검색용 인덱스 사전 계산 (vocab이 바뀔 때만 1회)
  const vocabSearchIndex = useMemo(() => {
    return vocab.map(v => ({
      _item: v,
      _searchKey: `${v.word_text || ''} ${v.meaning || ''} ${v.furigana || ''}`.toLowerCase(),
    }));
  }, [vocab]);

  const filteredVocab = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = vocabSearchIndex;

    // 언어 · 급수 · 출처는 이미 범위(vocab)가 걸렀다 — 목록은 검색 · 정렬만 더한다.
    if (q) {
      list = list.filter(x => x._searchKey.includes(q));
    }
    list = list.map(x => x._item); // 인덱스 랩 해제
    // 「뜻 채우기」(§5-6) — 뜻이 없어 복습에서 빠진 표현만 모아 본다.
    if (missingMeaningOnly) list = list.filter(word => !hasMeaning(word));

    if (sortBy === 'due') {
      list = [...list].sort((a, b) => reviewDueAt(a) - reviewDueAt(b));
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'alpha') {
      list = [...list].sort((a, b) => (a.word_text || '').localeCompare(b.word_text || '', 'ja'));
    }
    return list;
  }, [vocabSearchIndex, search, sortBy, reviewDueAt, missingMeaningOnly]);

  useEffect(() => { setVisibleCount(30); }, [search, sortBy, scopeKey]);

  // 범위 안 복습 대상 단어(아는 단어 · 제외 빼고) — 구성 집계와 임박 목록이 공유한다.
  const deckScope = useMemo(() => vocab.filter(v => {
    const projection = learningById.get(v.id);
    return projection && !projection.review.excluded && !projection.review.known && reviewSupported(v);
  }), [vocab, reviewSupported, learningById]);

  // 범위 구성 — 카드 단계(D15, growthStats.wordStage): 신규 · 학습 · 익히는 중 · 익숙 · 재학습(서로 안 겹치게 분할).
  const deckStats = useMemo(() => {
    const stages = new Map();
    for (const v of deckScope) {
      const stage = wordStage(learningById.get(v.id));
      stages.set(stage.key, { label: stage.label, count: (stages.get(stage.key)?.count || 0) + 1 });
    }
    const order = ['new', 'learning', 'young', 'mature', 'relearning'];
    return { total: deckScope.length, stages: order.filter(key => stages.has(key)).map(key => ({ key, ...stages.get(key) })) };
  }, [deckScope, learningById]);

  // 오늘 세션 미리보기 — 복습 예정 + (하루 한도 내) 새 단어
  // 한도 → quota 입력은 배움 칸과 같은 함수(reviewScopeQuota)로 만든다 — 두 화면 숫자가 같은 한도를 쓴다.
  const scopeQuota = reviewScopeQuota(admission, { newPerDay, introIds, vocabIds: allVocab.map(v => v.id) });
  const remainingNew = scopeQuota?.remaining ?? 0;
  // 문법 대기/예정은 같은 계정 조회에서 유도한다. 실패를 0개 완료로 표시하지 않는다.
  // 행(lang · next_review_at)은 countReviewScope의 grammarDue(언어별 별줄)에도 넘긴다.
  const { data: grammarQueue, error: grammarError, isLoading: grammarLoading, refetch: refetchGrammar } = useQuery({
    queryKey: ['review-room-grammar', user?.id], enabled: !!user && !isBookScope,
    queryFn: async () => {
      const { data, error } = await supabase.from('grammar_review').select('lang, next_review_at').eq('user_id', user.id);
      if (error) throw error;
      const now = Date.now();
      const times = (data || []).map(r => new Date(r.next_review_at).getTime()).filter(Number.isFinite);
      const future = times.filter(t => t > now).sort((a, b) => a - b);
      return { due: times.filter(t => t <= now).length, total: times.length, nextAt: future[0] ?? null, rows: data || [] };
    },
  });
  const dueGrammarCount = grammarQueue?.due || 0;
  const grammarRows = grammarQueue?.rows ?? null;

  // ⚔ 헷갈린 단어 재대결(#1077-15) — 최근 2주 오답 가중 상위(computeWeakness 정본)만 모은
  // 집중 큐. 배너·선택은 조회만 하고, 채점은 위 공통 경로 그대로라 여기서 맞히면 약점
  // 점수가 내려가 일요일 약점 세션에서 자연히 빠진다(공유 원장이 곧 dedup — 승인된 이음새).
  // 같은 조회가 집중 연습 기록(source 'practice')도 받는다 — 「몰랐어요」 · 오답은 헷갈린 표현 · 흐릿 범위에 들어간다
  // (REV-SCOPE-R1B-1 §6-1 ⑤ 읽는 곳 표).
  const { data: recentVocabEvents = [] } = useQuery({
    queryKey: ['confused-events', user?.id],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - CONFUSED_SINCE_DAYS * 86400000).toISOString();
      const [{ data, error }, markers] = await Promise.all([
        supabase
          .from('review_events')
          // detail은 유형 큐(v2-A R3)가 qtype을 보려고 함께 받는다 — 새 조회 대신 컬럼 하나.
          .select('source, item_key, correct, created_at, detail')
          .eq('user_id', user.id)
          .in('source', ['vocab', 'practice'])
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(400),
        // undo 마커(source ui)는 위 source='vocab' 조회에 없다 — 마커 전용 조회를 붙여 되돌린
        // 채점을 뺀다(W 후속 ②). 마커 조회 실패는 빈 배열 = 현행 집계로 수렴.
        fetchUndoMarkers(user.id, { sinceIso }),
      ]);
      if (error) throw error;
      return dropUndoneEvents(data || [], markers);
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  // 흐릿 범위(state=fragile)에 더할 표현 — 지난 14일 집중 연습에서 「몰랐어요」 · 오답을 받은 것.
  const practiceFragile = useMemo(() => [...practiceFragileIds(recentVocabEvents)], [recentVocabEvents]);

  // 오늘 복습 개수와 시작할 줄 — countReviewScope 하나가 낸다(배움 칸 · 언어 칩 · 복습방 공용, 계약 reviewScopeCount).
  // 같은 결과의 queue(두 엔진이 섞인 한 줄 — R1-B-1)로 복습을 시작하므로 화면 숫자 = 시작하는 줄 길이다.
  // 출처 id(교재는 과까지)는 지금 범위와 같은 출처일 때만 쓴다 — 다른 출처(시트의 후보)는 조회 전이라 pending으로 센다.
  const countFor = useCallback(target => {
    const sameSource = scopeNeedsLookup(target.source) && formatScopeSource(target.source) === formatScopeSource(scope.source);
    return countReviewScope({
      ...scopeArgs, scope: target, levels: target.level ? scopeLevels || zhHskLevels : null,
      sourceIds: sameSource ? scopeSourceIds : null, chapters: sameSource ? scopeChapters : null, quota: scopeQuota,
      fsrsEntries: fsrsReview.cards, fsrsEnabled: fsrsReview.enabled, pendingIds: fsrsReview.pending.map(entry => entry.cardId),
      // 예전 일정 줄은 FSRS에 등록된 id를 다시 내지 않는다(등록 id · 대기 연산 모두 — 기존 오늘 세션 계산과 같은 가드).
      canLegacy: id => !fsrsReview.enrolledIds.includes(id) && fsrsReview.controller.canLegacy(id), grammar: grammarRows,
      fragileIds: practiceFragile,
    });
    // controller는 안정 객체라 canLegacy 판정 신호(registryAvailable · enrolledIds)를 명시한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projections, learningAvailable, scopeKey, effectiveNow, scopeLevels, scopeSourceIds, scopeChapters, zhHskLevels, reviewSupported, remainingNew,
    admission.quota, fsrsReview.cards, fsrsReview.enabled, fsrsReview.pending, fsrsReview.enrolledIds, fsrsReview.registryAvailable, fsrsReview.controller, grammarRows, practiceFragile]);
  const scopeCount = useMemo(() => (admission.quota && learningAvailable ? countFor(scope) : null), [countFor, scope, admission.quota, learningAvailable]);
  const session = scopeCount && scopeCount.status === 'ready' ? scopeCount : { status: 'pending', total: 0, due: 0, newAllowed: 0, newLocked: 0, deferred: 0,
    noMeaning: 0, backlog: null, byLang: scopeCount?.byLang || {}, queue: { items: [], ids: [], legacyIds: [], fsrsIds: [] } };
  // 오늘 카드의 「준비 중」 — 제목 · 안내 줄이 같은 판정을 쓴다(VOCAB-FLOW-001).
  // FSRS 목록을 받는 중(status 'loading')도 준비 중이다 — 그동안 canLegacy가 거짓이라 예전 일정 카드가 0으로 세어져 session이
  // 「준비됨 · 0개」가 되고, 제목이 「잠시, 읽기로 돌아가요.」로 0.15초쯤 보였다가 「6개」로 바뀌었다(빌드 실측 d8f15fc0, 390 · 1440).
  // 시작 단추의 「복습 준비 중…」과 같은 판정이다. 받기 실패(error)는 준비 중으로 묶지 않는다(아래 다시 시도 안내가 맡는다).
  const heroPending = admission.status !== 'ready' || session.status !== 'ready' || fsrsReview.status === 'loading';
  // 세션 길이(§6-1 ③) — 「5분 ≈ 20 · 50 · 전부」는 서로 다른 카드 수(새 표현 포함, 학습 단계 · 재질문 제외). 줄 앞에서 자른다.
  // 버튼 숫자 = 시작하는 줄 길이(sessionCards.length).
  const lengthOptions = sessionLengthOptions(session.total);
  const activeLength = lengthOptions.length && sessionLength && sessionLength < session.total ? sessionLength : null;
  const sessionCards = sliceSession(session.queue.items, activeLength);

  // 집중 연습 대상(§6-1 ④) — 범위 안 표현 전체(기한과 무관). 새 표현만 · 흐릿 · 위험 범위는 그 상태만. 잊기 쉬운 순서.
  const practiceWords = useMemo(() => {
    const fragile = new Set(practiceFragile);
    const rows = [];
    for (const word of vocab) {
      const p = learningById.get(word.id);
      if (!p || p.review.known || p.review.excluded || !reviewSupported(word) || !hasMeaning(word)) continue;
      const r = vocabularyRetrievability(p, Math.max(effectiveNow, Date.parse(p.review.evaluatedAt) || 0));
      const isNew = isVocabularyUnreviewed(p);
      if (scope.state === 'new' && !isNew) continue;
      if (scope.state === 'fragile' && (isNew || !(fragile.has(String(word.id)) || (r ?? 1) < FRAGILE_RETRIEVABILITY))) continue;
      rows.push({ word, r: r ?? 2 });
    }
    return rows.sort((a, b) => a.r - b.r).map(row => row.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, learningById, reviewSupported, scope.state, practiceFragile, Math.floor(effectiveNow / 60000)]);

  // 복습 줄(단계) → 단어 객체. 길이 안정(삭제돼도 null 유지)해 인덱스 정렬 보존.
  const reviewSessionWords = useMemo(
    () => reviewQueue.map(step => vocab.find(v => v.id === step.id) || null),
    [reviewQueue, vocab]
  );
  const currentStep = reviewQueue[reviewIdx];
  // 「다시」 재노출 단계 — 방금 채점해 다음 일정이 하루 뒤라, 입장권을 다시 받지 않고 일정도 다시 저장하지 않는다
  // (입장 RPC는 채점된 적 있고 next_review_at이 미래인 카드를 learning_card_not_due로 거절한다 — M09 #1337 6171362813).
  const againWord = useMemo(() => {
    const step = reviewQueue[reviewIdx];
    return step?.engine === 'legacy' && step.phase === 'again' && fsrsReview.controller.canLegacy(step.id)
      ? vocab.find(v => v.id === step.id && reviewSupported(v) && !v.is_excluded && !v.is_known) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewQueue, reviewIdx, vocab, reviewSupported, fsrsReview.controller, fsrsReview.registryAvailable, fsrsReview.enrolledIds]);
  // 예전 일정 단계 — 입장권(admission)을 받은 뒤에만 연다(처음 보는 표현 카드도 새 표현 한도를 여기서 쓴다).
  const candidateWord = useMemo(() => {
    const step = reviewQueue[reviewIdx];
    return step?.engine === 'legacy' && step.phase !== 'skipped' && step.phase !== 'again' && fsrsReview.controller.canLegacy(step.id) ? vocab.find(v => v.id === step.id && reviewAvailable(v) && reviewSupported(v)) : undefined;
    // controller는 안정 객체라 canLegacy 결과가 바뀌는 신호(registryAvailable·enrolledIds)를 명시해 다시 판정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewQueue, reviewIdx, vocab, reviewSupported, reviewAvailable, fsrsReview.controller, fsrsReview.registryAvailable, fsrsReview.enrolledIds]);
  // 새 일정(FSRS) 단계 — 카드는 controller가 연다(질문 · 노출 · 채점은 FSRS 경로 그대로).
  const fsrsStepValid = useCallback(id => {
    const projection = learningById.get(id);
    return vocab.some(row => row.id === id && reviewSupported(row)) && !!projection && !projection.review.known && !projection.review.excluded;
  }, [learningById, vocab, reviewSupported]);
  const fsrsStepWord = currentStep?.engine === 'fsrs' && currentStep.phase !== 'skipped' && fsrsStepValid(currentStep.id) ? vocab.find(v => v.id === currentStep.id) : undefined;

  const questionKey = `${reviewSessionId}:${reviewIdx}`;
  // 로그인 전에는 user?.id·current가 둘 다 비어 undefined === undefined가 되지 않게 사용자 id를 먼저 본다(게스트 /vocab 크래시).
  const currentWord = againWord || (!!user?.id && admission.current?.accountId === user.id && admission.current.cardId === candidateWord?.id
    && admission.current.questionKey === questionKey ? candidateWord : undefined);
  // 같은 카드면 새 객체여도 다시 묻지 않는다 — id에만 반응한다.
  const candidateId = candidateWord?.id;
  useEffect(() => {
    if (tab === 'review' && !reviewFinished && candidateId !== undefined) admission.controller.question(candidateId, questionKey);
  }, [tab, reviewFinished, candidateId, questionKey, admission.controller]);

  // 집중 연습 — 일정 · 한도 밖이라 입장권을 받지 않는다. 지금 카드 = 연습 줄의 카드.
  const practiceWord = tab === 'practice' && practice && !practice.finished ? allVocab.find(v => v.id === practice.ids[practice.idx]) : undefined;
  const activeWord = tab === 'practice' ? practiceWord : currentWord;
  const contextOptions = useMemo(() => {
    if (!activeWord) return [];
    const others = vocab.filter(v => v.id !== activeWord.id && v.meaning);
    const distractors = fisherYatesShuffle(others).slice(0, 3);
    // 보기 텍스트는 보기 규칙으로 정리(원어 병기 · 낱말이 드러나는 괄호 용례 — meaningClean choiceMeaning · choiceLabels,
    // 네 보기에 같은 규칙). 정답 식별은 id 기준이라 채점엔 무영향.
    const shuffled = fisherYatesShuffle([...distractors, activeWord]);
    const labels = choiceLabels(shuffled.map(v => choiceMeaning(v.meaning, activeWord.word_text)), activeWord.word_text);
    return shuffled.map((v, i) => ({ ...v, meaning: labels[i] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewIdx, practice?.idx, activeWord?.id]);
  // 본 복습은 플래시(버튼 넷)뿐이다. 집중 연습은 고른 갈래 — 보기를 만들 수 없으면 스스로 확인으로 돌린다.
  const effectiveMode = tab === 'practice'
    ? usableVocabReviewMode(activeWord?.language === 'Korean' && practiceMode === 'listening' ? 'flash' : practiceMode, activeWord, contextOptions)
    : 'flash';
  // 펼친 뒤 0.3초는 채점을 받지 않는다(두 번 탭 오채점 방지 — 버튼 · 키 모두).
  const scoreArmed = useScoreArmed(showAnswer && !!activeWord, `${tab}:${questionKey}:${practice?.idx ?? ''}`);
  const autoplay = (word, trigger) => {
    if (word && word.language !== 'Korean' && shouldAutoplay({ soundOn, ttsSupported, trigger })) speak(word.word_text, word.language || detectLang(word.word_text));
  };

  const handleScore = async (rating) => {
    // 「다시」 재노출은 확인만 — 일정 · 기록은 첫 채점 한 번뿐이다. 또 「다시」면 한 번 더 끝에 둔다.
    if (againWord && currentWord?.id === againWord.id) {
      if (!scoringRef.current) goNextReview(rating === 1 ? againWord.id : null);
      return;
    }
    const actorId = user?.id;
    const lifetime = gradeLifetimeRef.current;
    const currentActor = () => workspaceAlive.current && gradeLifetimeRef.current === lifetime && mutationGuard.current.accountId === actorId;
    const currentQuestion = () => admission.controller.getSnapshot().current?.questionKey === questionKey
      && admission.controller.getSnapshot().current?.cardId === currentWord?.id;
    if (!currentActor() || !currentQuestion() || !currentWord || !fsrsReview.controller.canLegacy(currentWord.id) || !reviewSupported(currentWord) || currentWord.is_excluded || scoringRef.current) return;
    scoringRef.current = true;
    let calculateFSRS;
    try {
      ({ calculateFSRS } = await import('../lib/fsrs'));
    } catch {
      if (!currentActor()) return;
      scoringRef.current = false;
      toast('복습 계산을 불러오지 못했어요. 다시 시도해 주세요.', 'error');
      return;
    }
    if (!currentActor()) return;
    if (!currentQuestion()) { scoringRef.current = false; return; }
    const wasNew = isNewWord(currentWord);
    // W R2 undo 스냅샷 — 채점 직전 SRS 5필드(행에 있는 값 그대로, null 포함) + 세션 상태. 단일
    // 레벨. 저장 실패에도 마지막 성공 스냅샷을 남기며, 저장 중 undo는 차단한다.
    const sequence = ++gradeSequenceRef.current;
    const gradeSession = gradeSessionRef.current;
    const snapshot = {
      wordId: currentWord.id, itemKey: currentWord.word_text, word: currentWord.word_text,
      lang: currentWord.language || detectLang(currentWord.word_text), rating,
      prev: Object.fromEntries(SRS_FIELDS.filter((k) => currentWord[k] !== undefined).map((k) => [k, currentWord[k]])),
      wasNew, reviewIdx, requeued: rating === 1, sequence,
      legacyBudgetCompatibility: admission.current?.compatibility === true,
    };
    const prevInterval = currentWord.interval ?? 0;
    const nextStats = calculateFSRS(rating, {
      interval: prevInterval,
      ease_factor: currentWord.ease_factor ?? 0,
      repetitions: currentWord.repetitions ?? 0,
      next_review_at: currentWord.next_review_at,
    });
    // progressStore로 통합: 복습 기록 + SRS + 보상 일괄 처리
    const qtype = ({ flash: 'flash', context: 'choice', typing: 'typing', listening: 'listening' })[effectiveMode] || 'choice';
    // 낙관 전진(카드는 즉시 넘어감) + 실패는 반드시 표면화 — 과거 '채점해도 SRS가
    // 안 전진하는 조용한 실패' 재발 방지의 두 번째 겹(첫 겹은 아래 페이로드 계약).
    pendingGradeRef.current++;
    recordReviewCompleted(user.id, {
      type: 'vocab',
      itemKey: currentWord.word_text,
      lang: currentWord.language || detectLang(currentWord.word_text),
      correct: rating > 1,
      detail: { word_id: currentWord.id, meaning: currentWord.meaning, rating, mode: effectiveMode, qtype },
    }, {
      // calculateFSRS 반환 키를 그대로 쓴다 — DB 컬럼과 동일(snake_case).
      // 이전엔 easeFactor(비존재 컬럼)를 보내고 repetitions를 빠뜨려, PostgREST가 UPDATE 전체를
      // 거부 → 채점해도 SRS가 전진하지 않는 조용한 실패였다(PATCH 페이로드 실측으로 확인).
      interval: nextStats.interval ?? 0,
      ease_factor: nextStats.ease_factor ?? 0,
      repetitions: nextStats.repetitions ?? 0,
      next_review_at: nextStats.next_review_at,
    }).then((r) => {
      if (!currentActor()) return;
      if (r?.ok === false) { toast('복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.', 'error', 5000); return; }
      invalidateVocabularyLearning(queryClient, actorId);
      if (!r?.queued) refreshProfileReadOnly(actorId)?.catch(() => {});
      if (gradeSessionRef.current !== gradeSession) return;
      if ((lastGradeRef.current?.sequence ?? 0) <= sequence) {
        lastGradeRef.current = { ...snapshot, reviewedAt: r?.reviewedAt || null, queued: !!r?.queued };
      }
    }).catch(() => {
      if (currentActor()) toast('복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.', 'error', 5000);
    }).finally(() => {
      if (currentActor()) pendingGradeRef.current = Math.max(0, pendingGradeRef.current - 1);
    });
    // 기존 scoreMutation은 progressStore 내부에서 처리됨
    if (wasNew && admission.current?.compatibility) registerNewIntro(currentWord.id);            // 새 단어 첫 학습 → 오늘 한도 차감
    goNextReview(rating === 1 ? currentWord.id : null);      // '다시'는 이번 세션 끝에 재노출(줄 메타데이터 — 일정은 위 채점 한 번)
    scoringRef.current = false;
  };

  const handleSkip = () => {
    if (againWord && currentWord?.id === againWord.id) { if (!scoringRef.current) goNextReview(); return; }
    if (scoringRef.current || pendingGradeRef.current || !currentWord || !fsrsReview.controller.canLegacy(currentWord.id) || !reviewSupported(currentWord) || currentWord.is_excluded) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    // 미루기도 last_reviewed_at을 찍으므로 undo 대상 — 이벤트가 없으니 보상 이벤트도 없다
    lastGradeRef.current = {
      wordId: currentWord.id, itemKey: currentWord.word_text, word: currentWord.word_text,
      lang: currentWord.language || detectLang(currentWord.word_text), rating: null, skip: true,
      prev: Object.fromEntries(SRS_FIELDS.filter((k) => currentWord[k] !== undefined).map((k) => [k, currentWord[k]])),
      wasNew: false, reviewIdx, requeued: false, reviewedAt: null, queued: false, sequence: ++gradeSequenceRef.current,
    };
    scoreMutation.mutate({ id: currentWord.id, nextStats: { next_review_at: tomorrow.toISOString() } });
    goNextReview();
  };

  // W R2 undo = 「SRS 복원 + 보상 이벤트」. review_events는 RLS가 SELECT·INSERT뿐이라 원 이벤트를
  // 못 지운다 → ① 스냅샷 5필드를 그대로 UPDATE(last_reviewed_at이 null이었으면 null — 그래야
  // isNewWord가 다시 참) ② 세션 되감기 ③ source:'ui' 보상 이벤트(isGradedReviewEvent가 ui를 이미
  // 제외하므로 리포트·약점 진단 무오염, detail.undo_of가 원 채점을 가리킨다) — 오프라인 큐에 있던
  // 채점도 전송/부분 성공과 조정하는 내구성 undo를 기다린다. redo 없음.
  const undoLastGrade = async () => {
    const actorId = user?.id;
    const lifetime = gradeLifetimeRef.current;
    const currentActor = () => workspaceAlive.current && gradeLifetimeRef.current === lifetime && mutationGuard.current.accountId === actorId;
    const last = lastGradeRef.current;
    if (!last || scoringRef.current) return;
    if (pendingGradeRef.current) return;
    if (!currentActor() || !fsrsReview.controller.canLegacy(last.wordId)) return;
    scoringRef.current = true;
    try {
      // 기존 호출 계약은 유지하며 로컬 삭제 대신 확인된 undo 완료로 연결한다.
      const removeOutboxEntry = async identity => {
        const { undoQueuedReview } = await import('../lib/reviewOutbox');
        if (!currentActor()) throw new Error('fsrs_stale_account');
        const result = await undoQueuedReview(supabase, { ...last, ...identity }, {
          getAccountId: () => workspaceAlive.current && gradeLifetimeRef.current === lifetime ? mutationGuard.current.accountId : null,
        });
        if (result?.ok !== true || result.queued !== false || result.status !== 'settled') {
          throw result?.error || new Error('review_undo_failed');
        }
        return result;
      };
      if (last.queued) {
        await removeOutboxEntry({ userId: user.id, itemKey: last.itemKey, reviewedAt: last.reviewedAt });
      } else {
        const { persistVocabGrade } = await import('../lib/fsrs');
        await withLegacyReviewLock(actorId, async () => {
          if (!currentActor()) throw new Error('fsrs_stale_account');
          const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev;
          await persistVocabGrade(supabase, last.wordId, prevStats, prevReviewedAt);
          if (!currentActor()) throw new Error('fsrs_stale_account');
          if (!last.skip && last.reviewedAt) {
            await logReviewEvents(user.id, [{
              lang: last.lang, source: 'ui', item_key: last.itemKey, correct: true,
              detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },
            }], { strict: true });
          }
        });
      }
    } catch (err) {
      if (!currentActor()) return;
      toast(failureMessage('되돌리지 못했어요.', err), 'error');
      return;
    } finally {
      if (currentActor()) scoringRef.current = false;
    }
    if (!currentActor() || lastGradeRef.current !== last) return;
    lastGradeRef.current = null;
    // 세션 되감기 — 재노출된 큐 항목 제거 · 신규 한도 복원 · 종료 화면이었으면 되살림
    if (last.requeued) setReviewQueue((q) => (q[q.length - 1]?.id === last.wordId ? q.slice(0, -1) : q));
    if (last.wasNew && last.legacyBudgetCompatibility) {
      setIntroIds((prev) => { const next = prev.filter((id) => id !== last.wordId); saveIntroIds(next); return next; });
    }
    admission.controller.leave();
    setReviewSessionId(id => id + 1);
    setReviewIdx(last.reviewIdx);
    setShowAnswer(true);
    setContextSelected(null);
    setTypingAnswer('');
    setReviewFinished(false);
    invalidateVocabularyLearning(queryClient, user?.id);
    toast(`되돌렸어요 — 「${last.word}」 다시 채점`, 'info');
  };

  // 객관식·듣기의 보기 선택 — 클릭과 키 `1`~`4`가 같은 함수를 탄다(정답이면 700ms 뒤 자동 3점,
  // 오답이면 「다시/정답 보기」 노출은 렌더가 contextSelected로 판정). 본 복습은 플래시뿐이라 집중 연습의 듣기 갈래가 쓴다.
  const pickContextOption = (i) => {
    if (contextSelected !== null || !activeWord) return;
    const opt = contextOptions[i];
    if (!opt) return;
    setContextSelected(i);
    const score = tab === 'practice' ? handlePractice : handleScore;
    if (opt.id === activeWord.id) setTimeout(() => score(3), 700);
  };

  useEffect(() => {
    setExampleSentences(null);
    setExampleLoading(false);
  }, [currentWord?.id]);

  async function loadExamples() {
    if (!currentWord) return;
    const cached = exampleCacheRef.current.get(currentWord.id);
    if (cached) { setExampleSentences(cached); return; }
    setExampleLoading(true);
    try {
      const lang = currentWord.language || detectLang(currentWord.word_text);
      const prompt = `단어: ${currentWord.word_text}\n언어: ${lang}\n의미: ${currentWord.meaning || ''}\n\n이 단어를 자연스럽게 활용한 예문 2개를 만들어주세요. 학습자가 문맥 속에서 단어를 익힐 수 있도록 간결하고 자연스러운 문장으로 작성해주세요.\n\n반드시 아래 JSON 형식으로만 응답하세요:\n{"examples":[{"sentence":"...","translation":"한국어 번역"},{"sentence":"...","translation":"한국어 번역"}]}`;
      const raw = await callGemini(prompt);
      const { parseGeminiJSON } = await import('../lib/gemini');
      const parsed = parseGeminiJSON(raw);
      if (!parsed.examples || !Array.isArray(parsed.examples)) throw new Error('예문 형식 오류');
      const cache = exampleCacheRef.current;
      if (cache.size >= MAX_EXAMPLE_CACHE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(currentWord.id, parsed.examples);
      setExampleSentences(parsed.examples);
    } catch {
      toast('예문을 만들지 못했어요.', 'error');
    } finally {
      setExampleLoading(false);
    }
  }

  // 세션 끝 — 낙관 전진을 서버 정본과 재동기한다.
  const finishRun = () => {
    setReviewFinished(true);
    // 끝 토스트 없음(VOCAB-FLOW-001 B) — 화면 읽기는 끝 제목 초점, 못 받으면 review-finish-announce(onTitleNotFocused).
    // 세션 동안의 낙관 전진을 서버 정본과 재동기 — 채점 저장이 fire-and-forget이라
    // 여기서 한 번 무효화하지 않으면 다음 화면이 낡은 FSRS 값을 계속 본다.
    queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
    // 복습 완료 시 진도 갱신 — 현재 시리즈 필터의 모든 복습 완료 단어를 학습 진도로 기록
    updateReadingProgress();
  };

  // 다음 단계로(두 엔진 공통). queue를 넘기면 그 줄 기준으로 끝을 판정한다(방금 끼운 단계 포함).
  const advanceStep = (queue = reviewQueueRef.current) => {
    admission.controller.leave();
    setShowHint(false);
    setTypingAnswer('');
    setContextSelected(null);
    const index = reviewIdxRef.current;
    if (index < queue.length - 1) {
      reviewIdxRef.current = index + 1;
      setReviewIdx(index + 1);
      setShowAnswer(false);
    } else finishRun();
  };

  // 예전 일정 채점 · 미루기 뒤 — 「다시」는 이번 세션 끝에 재노출(줄 메타데이터만, 일정 저장은 채점 한 번).
  const goNextReview = (requeueId = null) => {
    lastEngineRef.current = 'legacy';
    admission.controller.leave();
    setShowHint(false);
    setTypingAnswer('');
    setContextSelected(null);
    const newLen = reviewQueueRef.current.length + (requeueId ? 1 : 0);
    if (requeueId) setReviewQueue(q => [...q, { id: requeueId, engine: 'legacy', phase: 'again' }]);
    if (reviewIdxRef.current < newLen - 1) {
      reviewIdxRef.current += 1;
      setReviewIdx(i => i + 1);
      setShowAnswer(false);
    } else finishRun();
  };

  // 처음 보는 표현 「다음 →」 — 채점 없음. 3장 뒤 같은 표현을 채점 카드로 다시 묻는다(FSRS = 첫 질문,
  // 예전 일정 = 세션 내 재질문). 호환 모드(기기 한도)는 첫 학습 카드에서 오늘 한도 1을 쓴다(증거 모델 §2-1).
  const advanceIntro = trigger => {
    lastTriggerRef.current = trigger;
    if (currentStep?.engine === 'legacy' && currentWord && isNewWord(currentWord) && admission.current?.compatibility) registerNewIntro(currentWord.id);
    const next = insertAfterIntro(reviewQueueRef.current, reviewIdxRef.current);
    setReviewQueue(next);
    advanceStep(next);
  };

  // 지금 단계를 건너뛴다(그 카드의 남은 단계도) — 아는 단어로 옮겼거나 다른 곳에서 이미 채점 · 제외돼 열 수 없을 때.
  const skipCard = id => {
    const next = reviewQueueRef.current.map((step, index) => (index >= reviewIdxRef.current && step.id === id ? { ...step, phase: 'skipped' } : step));
    setReviewQueue(next);
    advanceStep(next);
  };

  // 새 일정(FSRS) 채점이 정착했다 — 학습 단계 카드는 때가 되면 줄에 다시 끼운다(아래 효과).
  const onFsrsGraded = (cardId, rating) => {
    lastEngineRef.current = 'fsrs';
    lastGradeRef.current = null;
    if (rating === 1) setFsrsAgain(n => n + 1);
    setSessionFsrsIds(ids => (ids.includes(cardId) ? ids : [...ids, cardId]));
    advanceStep();
  };
  // 새 일정 채점 되돌리기 — 새 연산(revision +1)으로 되돌리고, 그 카드는 노출 대기 뒤 학습 단계처럼 다시 나온다.
  const undoFsrsGrade = async () => {
    const last = fsrsReview.lastGrade;
    if (!last || fsrsReview.busy) return;
    if (!(await fsrsReview.controller.undo()) || !workspaceAlive.current) return;
    const cardId = last.payload.cardId;
    if (last.payload.rating === 1) setFsrsAgain(n => Math.max(0, n - 1));
    setReviewQueue(q => {
      let at = -1;
      q.forEach((step, index) => { if (index < reviewIdx && step.id === cardId && step.phase !== 'intro' && step.phase !== 'skipped') at = index; });
      return at < 0 ? q : q.map((step, index) => (index === at ? { ...step, phase: 'undone' } : step));
    });
    setSessionFsrsIds(ids => (ids.includes(cardId) ? ids : [...ids, cardId]));
    const word = vocab.find(v => v.id === cardId);
    toast(`되돌렸어요 — 「${word?.word_text || ''}」 잠시 뒤 다시 나와요`, 'info');
  };

  // 카드에서 「아는 단어」(#1335) — 바로 빼고 하단에 되돌리기. 일정 · 평가 기록은 보존된다(DB 트리거가 복습 보호만 바꾼다).
  const markKnownInSession = word => {
    const lang = knownWordsLang(word?.language, koreanCapabilities.known);
    if (!word || !lang || knownWords.mutation.isPending) return;
    knownWords.mutation.mutate({ lang, wordText: word.word_text, known: true });
    setKnownUndo({ lang, wordText: word.word_text });
    if (tab === 'practice') { advancePractice(false); return; }
    fsrsReview.controller.leave();
    skipCard(word.id);
  };
  const undoKnownInSession = () => {
    if (!knownUndo) return;
    knownWords.mutation.mutate({ lang: knownUndo.lang, wordText: knownUndo.wordText, known: false, removeKeys: [knownUndo.wordText] });
    setKnownUndo(null);
  };
  useEffect(() => {
    if (!knownUndo) return undefined;
    const timer = setTimeout(() => setKnownUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [knownUndo]);

  const updateReadingProgress = () => {
    if (isBookScope || !user?.id) return;
    try {
      // 현재 시리즈 필터의 복습 완료 단어들 중 review_events에 기록된 것들을 학습 진도로 반영
      const reviewedWords = reviewSessionWords.filter(w => w != null);
      if (reviewedWords.length === 0) return;

      // 시리즈별 reading_progress 갱신 (교재 진도와 동일한 키 사용)
      // 복습한 단어가 속한 시리즈를 mark as completed
      const deck = deckFor(reviewedWords[0]); // 현재 필터의 덱/시리즈
      if (!deck || !deck.key) return;

      // localStorage에 기록 (StudySessionPage 라인 768-773과 동일 패턴)
      const readKey = `studied_${user.id}`;
      try {
        const reads = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'));
        reads.add(deck.key); // 시리즈 키를 진도에 추가
        localStorage.setItem(readKey, JSON.stringify([...reads]));
      } catch {}
    } catch {}
  };

  // 세션 시작 공통 경로 — 진입점(오늘 복습 · 이어 하기 · 재대결)은 **줄만** 다르고, 상태 초기화 · 채점(예전 일정 =
  // handleScore → recordReviewCompleted, 새 일정 = FSRS controller)은 이 한 길이다. 본 복습은 두 엔진이 섞인 줄
  // (countReviewScope의 queue.items — FSRS 독점 해제, R1-B-1), 재대결은 예전 일정 카드만(기존 경로).
  const startSession = async (queueWords, { items = null, resumeFrom = null } = {}) => {
    // 입장 한도 · FSRS 목록은 서로 기다릴 이유가 없는 읽기 둘이다 — 함께 보낸다(VOCAB-FLOW-001). 차례로 보내면 시작을 누른 뒤
    // 첫 카드까지 왕복이 하나 더 들었다(픽스처 실측 390 · CPU 4배 · 지연 150ms: 입장 57–212 → FSRS 235–388 → 첫 질문 424–606ms).
    // 둘 다 진행 중이면 같은 약속을 돌려주고(refresh 중복 방지), 하나라도 실패하면 지금처럼 시작하지 않는다.
    const [admissionOk, fsrsOk] = await Promise.all([admission.controller.refresh(), fsrsReview.controller.refresh()]);
    if (!admissionOk || !fsrsOk || !workspaceAlive.current) return;
    const planned = items
      ? items.filter(item => (item.engine === 'fsrs' ? fsrsStepValid(item.id)
        : fsrsReview.controller.canLegacy(item.id) && vocab.some(v => v.id === item.id && reviewAvailable(v) && reviewSupported(v))))
      : queueWords.filter(v => reviewAvailable(v) && reviewSupported(v) && fsrsReview.controller.canLegacy(v.id))
        .map(v => ({ id: v.id, engine: 'legacy', isNew: false, introduced: true }));
    const queue = initialSteps(planned);
    // 범위를 아직 판정하지 못했거나 조회가 실패했으면 시작하지 않는다 — 다른 범위 카드로 대신 열지 않는다.
    if (queue.length === 0 || startingRef.current || scopePending || scopeFailed || (explicitScope && vocabError)) return;
    gradeSessionRef.current++;
    lastGradeRef.current = null;
    lastEngineRef.current = 'legacy';
    setSessionFsrsIds([]);
    setFsrsAgain(0);
    setKnownUndo(null);
    setReviewRun({ scopeKey, cardIds: resumeFrom?.cardIds || planned.map(item => item.id), priorDone: resumeFrom?.doneIds || [],
      startedAt: resumeFrom?.startedAt || new Date().toISOString(), cut: !items || resumeFrom ? false : planned.length < session.total });

    admission.controller.leave();
    fsrsReview.controller.leave();
    setReviewSessionId(id => id + 1);
    setReviewQueue(queue);
    setTab('review');
    setReviewIdx(0);
    setShowAnswer(false);
    setReviewFinished(false);
    setTypingAnswer('');
    setContextSelected(null);
    // 알림 권한은 여기서 묻지 않는다(WALL-STATES-001 ⑥) — 복습을 시작할 때마다 설명 없이 묻던 자리라,
    // 한 번 거부하면 학습 끝의 푸시 안내(StudySessionPage 「내일 이야기가 도착하면 알려드릴까요?」)와
    // 내 정보의 알림 켜기까지 막혔다. 권한은 그 두 곳에서 사용자가 고른 뒤에만 요청한다.
  };

  // 다른 탭에서 제외 · 삭제 · 아는 단어가 된 지금 카드는 채점 없이 다음 남은 단계로 건너뛴다(두 엔진).
  // 「다시」 재노출은 방금 채점해 일정상 아직 때가 아니므로 reviewAvailable 대신 제외 · 아는 단어만 본다(againWord와 같은 조건).
  const stepValid = step => step.phase !== 'skipped' && (step.engine === 'fsrs' ? fsrsStepValid(step.id)
    : fsrsReview.controller.canLegacy(step.id) && vocab.some(row => row.id === step.id && reviewSupported(row)
      && (step.phase === 'again' ? !row.is_excluded && !row.is_known : reviewAvailable(row))));
  const stepReady = !!candidateWord || !!againWord || !!fsrsStepWord;
  useEffect(() => {
    if (stepReady || reviewFinished || !reviewQueue.length || isLoading || vocabError || koreanCapabilities.isLoading || !fsrsReview.registryAvailable) return;
    const next = reviewQueue.findIndex((step, index) => index > reviewIdx && stepValid(step));
    if (next >= 0) setReviewIdx(next);
    else { setReviewIdx(reviewQueue.length); finishRun(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepReady, reviewFinished, reviewQueue, reviewIdx, vocab, isLoading, vocabError, koreanCapabilities.isLoading, reviewSupported, reviewAvailable, fsrsReview.registryAvailable, fsrsReview.controller, fsrsStepValid]);

  // 새 일정 학습 단계(1분 · 10분 — 지금 정책은 30초 · 10분) 카드는 다시 물을 때가 되면 지금 카드 바로 뒤에 끼운다.
  useEffect(() => {
    if (tab !== 'review' || reviewFinished || !reviewQueue.length || !sessionFsrsIds.length) return;
    let next = reviewQueue;
    for (const entry of fsrsReview.ready) if (sessionFsrsIds.includes(entry.cardId)) next = insertLearningStep(next, reviewIdx, entry.cardId);
    if (next !== reviewQueue) setReviewQueue(next);
  }, [tab, reviewFinished, reviewQueue, reviewIdx, sessionFsrsIds, fsrsReview.ready]);

  // 끝 화면의 「잠시 뒤」 — 이 세션에서 채점한 새 일정 카드 중 학습 · 재학습 단계에 남은 것.
  const waitingFsrs = useMemo(() => {
    const cards = fsrsReview.cards.filter(entry => sessionFsrsIds.includes(entry.cardId) && ['Learning', 'Relearning'].includes(entry.card?.state));
    if (!cards.length) return null;
    const readyIds = cards.filter(entry => fsrsReview.ready.some(row => row.cardId === entry.cardId)).map(entry => entry.cardId);
    const times = cards.map(entry => Math.max(Date.parse(entry.card.due), entry.nextQuestionAt ? Date.parse(entry.nextQuestionAt) : 0)).filter(Number.isFinite);
    return { count: cards.length, readyIds, ready: readyIds.length > 0, nextAt: times.length ? new Date(Math.min(...times)).toISOString() : null };
  }, [fsrsReview.cards, fsrsReview.ready, sessionFsrsIds]);
  const resumeWaiting = () => {
    if (!waitingFsrs?.ready) return;
    const next = [...reviewQueue, ...waitingFsrs.readyIds.map(id => ({ id, engine: 'fsrs', phase: 'learn' }))];
    setReviewQueue(next);
    setReviewIdx(reviewQueue.length);
    setShowAnswer(false);
    setReviewFinished(false);
  };

  // 진행 n / N(서로 다른 카드) · 이어 하기 기록(세션 저장소 — 새로고침 · 24시간). 끝냈고 기다리는 카드가 없으면 지운다.
  const runProgress = reviewRun ? stepProgress(reviewQueue, reviewFinished ? reviewQueue.length : reviewIdx, reviewRun.cardIds, reviewRun.priorDone) : null;
  useEffect(() => {
    if (!user?.id || !reviewRun || !runProgress) return;
    const storage = typeof window === 'undefined' ? null : window.sessionStorage;
    if (reviewFinished && !waitingFsrs?.count) { writeResume(storage, user.id, null); setResumeStore(null); return; }
    const value = { scopeKey: reviewRun.scopeKey, cardIds: [...runProgress.doneIds, ...runProgress.remainingIds], index: runProgress.doneIds.length, startedAt: reviewRun.startedAt };
    writeResume(storage, user.id, value);
    setResumeStore(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reviewRun, reviewQueue, reviewIdx, reviewFinished, waitingFsrs?.count]);
  // 새로고침 뒤 「멈춘 복습 이어 하기 (n / N)」 — 같은 범위 · 24시간 안 · 다른 곳에서 채점된 카드는 건너뛴다.
  const restorable = useMemo(() => {
    if (!resumeStore || !learningAvailable || (reviewRun && reviewRun.scopeKey === scopeKey)) return null;
    return restoreResume(resumeStore, { scopeKey, now: effectiveNow,
      reviewedAt: id => { const at = Date.parse(learningById.get(id)?.memory.lastReview); return Number.isFinite(at) ? at : null; },
      available: id => { const p = learningById.get(id); return !!p && isVocabularyReviewAvailable(p) && !p.review.known && !p.review.excluded && hasMeaning(p.vocabulary) && vocab.some(v => v.id === id); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeStore, learningAvailable, reviewRun, scopeKey, learningById, vocab, Math.floor(effectiveNow / 60000)]);
  const inMemoryResume = reviewRun && reviewRun.scopeKey === scopeKey && !reviewFinished && reviewQueue.length > reviewIdx ? runProgress : null;
  const resumeRun = () => {
    if (inMemoryResume) { setTab('review'); return; }
    if (!restorable) return;
    unlockSpeechAudio();
    const admitted = new Set(scopeQuota?.admittedLegacyCardIds || []);
    const items = restorable.remaining.map(id => {
      const p = learningById.get(id), fsrs = p.source === 'fsrs-v1';
      return { id, engine: fsrs ? 'fsrs' : 'legacy', isNew: isVocabularyUnreviewed(p), introduced: fsrs ? !!p.review.firstQuestionAt : admitted.has(id) };
    });
    startSession(null, { items, resumeFrom: { cardIds: resumeStore.cardIds, startedAt: resumeStore.startedAt,
      doneIds: resumeStore.cardIds.filter(id => !restorable.remaining.includes(id)) } });
  };

  // 끝 화면(§5-5) — 범위 이름 · 끝낸 수 · 「다시」 수 · 길이 칩으로 남긴 오늘 몫 · 학습 단계 대기 · 읽던 자료 · 범위 밖 이어서.
  const narrowed = !!(scope.level || scope.source || scope.state !== 'due' || scope.type);
  const outOfScopeCount = useMemo(() => {
    if (!reviewFinished || !narrowed || !reviewRun) return 0;
    const wide = countFor({ lang: scope.lang, level: null, source: null, state: 'due' });
    if (wide.status !== 'ready') return 0;
    const seen = new Set([...reviewRun.cardIds, ...session.queue.ids]);
    return wide.queue.ids.filter(id => !seen.has(id)).length;
  }, [reviewFinished, narrowed, reviewRun, countFor, scope.lang, session.queue.ids]);
  const finishInfo = reviewRun && runProgress ? {
    scopeLabel: scopeSummaryLabel(scope, { materialTitles }),
    total: runProgress.done,
    // 「다시」 재노출에서 또 「다시」를 눌러 같은 표현이 여러 번 끝에 붙어도 한 번으로 센다.
    again: new Set(reviewQueue.filter(step => step.phase === 'again').map(step => step.id)).size + fsrsAgain,
    cutRemaining: reviewRun.cut ? session.queue.ids.filter(id => !reviewRun.cardIds.includes(id)).length : 0,
    onContinueCut: () => startReview(),
    waiting: waitingFsrs, onResumeWaiting: resumeWaiting,
    returnLink: scope.source?.kind === 'material' && scope.source.ids.length === 1 ? { href: `/viewer/${scope.source.ids[0]}`, label: '읽던 자료로 돌아가기' } : null,
    outOfScope: outOfScopeCount ? { count: outOfScopeCount, label: SCOPE_LANG_LABELS[scope.lang], onClick: () => { selectLanguage(scope.lang); setTab('list'); } } : null,
    onTitleNotFocused: () => setFinishNotice(true), // 끝 제목이 초점을 못 받았을 때만 끝 공지(a3ba 리뷰 ②)
  } : null;
  // 끝 화면을 벗어나면 공지를 거둔다 — 다음 끝 화면은 그때 초점 여부로 다시 정한다.
  useEffect(() => { if (!reviewFinished) setFinishNotice(false); }, [reviewFinished]);

  // 화면 숫자(session.total)와 같은 계산 결과의 줄로 시작한다 — 보이는 개수 = 시작하는 줄 길이(계약 reviewScopeCount).
  // 세션 길이 칩을 고르면 같은 줄의 앞에서 자른 sessionCards(버튼 숫자)로 시작한다.
  const startReview = () => {
    unlockSpeechAudio();
    return startSession(null, { items: sessionCards });
  };

  const confused = useMemo(
    () => confusedVocabWords(recentVocabEvents, vocab),
    [recentVocabEvents, vocab],
  );
  const startRematch = () => startSession(confused.map((c) => c.word));

  // ── 집중 연습(§6-1 ④) — FSRS · 예전 일정 · 새 표현 한도(admission) 호출 0회(계약). 연습 기록(review_events
  // source 'practice')만 남긴다. 채점 경로(handleScore · recordReviewCompleted · controller.grade)를 타지 않는다.
  const startPractice = (words, { mode = null } = {}) => {
    const ids = (words || []).filter(word => word && hasMeaning(word) && reviewSupported(word)).map(word => word.id);
    if (!ids.length) return;
    unlockSpeechAudio();
    if (mode) setPracticeMode(mode);
    setKnownUndo(null);
    setPractice({ ids, idx: 0, total: ids.length, unknown: 0, finished: false, scopeKey });
    setTab('practice');
    setShowAnswer(false);
    setShowHint(false);
    setTypingAnswer('');
    setContextSelected(null);
  };
  const advancePractice = missed => {
    setShowAnswer(false);
    setShowHint(false);
    setTypingAnswer('');
    setContextSelected(null);
    setPractice(current => {
      if (!current) return current;
      const done = current.idx + 1 >= current.ids.length;
      return { ...current, unknown: current.unknown + (missed ? 1 : 0), ...(done ? { finished: true } : { idx: current.idx + 1 }) };
    });
  };
  const handlePractice = rating => {
    const word = practiceWord;
    if (!word || !practice || practice.finished || !user?.id) return;
    const qtype = effectiveMode === 'typing' ? 'typing' : effectiveMode === 'listening' ? 'listening' : effectiveMode === 'context' ? 'choice' : 'self';
    const result = qtype === 'self' ? (rating > 1 ? 'known' : 'unknown') : rating > 1 ? 'correct' : 'wrong';
    const event = buildPracticeEvent({ word, qtype, scope: practice.scopeKey, result });
    if (event) logReviewEvents(user.id, [event]);
    advancePractice(result === 'unknown' || result === 'wrong');
  };
  // 연습 중 지운 · 아는 단어가 된 표현은 기록 없이 넘긴다.
  useEffect(() => {
    if (tab === 'practice' && practice && !practice.finished && !practiceWord && !isLoading) advancePractice(false);
  }, [tab, practice, practiceWord, isLoading]);
  // 연습을 마치면 헷갈린 표현 · 흐릿 범위가 새 기록을 읽게 한다.
  useEffect(() => {
    if (practice?.finished) queryClient.invalidateQueries({ queryKey: ['confused-events', user?.id] });
  }, [practice?.finished, queryClient, user?.id]);

  // 🎯 유형 큐(v2-A R3) — R1이 진단하고 R2가 편성에 반영한 약점을, 사용자가 **한 번에
  // 그 연습으로 들어갈** 길로 잇는다. 같은 이벤트 배열을 재사용하므로 추가 조회 0. 처방할 축이 없거나 표본이 얕으면 null.
  // 타이핑 · 리스닝은 집중 연습의 갈래라(R1-B-1) 처방도 집중 연습으로 연다 — 일정은 바뀌지 않는다.
  const weakDrill = useMemo(() => {
    const pick = weakDrillPrescription(weaknessProfile(recentVocabEvents), { ttsSupported });
    if (!pick) return null;
    const words = weakDrillWords(recentVocabEvents, vocab, pick.mode);
    return hasWeakDrill(words) ? { ...pick, words } : null;
  }, [recentVocabEvents, vocab, ttsSupported]);

  // 처방을 누르면 그 방식으로 고정해 연다 — 사용자가 갈래를 찾아 바꾸지 않아도 된다.
  const startWeakDrill = () => {
    if (!weakDrill) return;
    startPractice(weakDrill.words.map((c) => c.word), { mode: weakDrill.mode });
  };

  // 지금 카드가 바뀌면 다음 카드 소리를 미리 받는다(소리 켬 · 음성 가능할 때).
  useEffect(() => {
    if (tab !== 'review' || reviewFinished || !soundOn || !ttsSupported) return;
    const next = reviewQueue.slice(reviewIdx + 1).find(step => step.phase !== 'skipped');
    const word = next && vocab.find(v => v.id === next.id);
    if (word && word.language !== 'Korean') prefetchSpeech(word.word_text, word.language || detectLang(word.word_text));
  }, [tab, reviewFinished, reviewIdx, reviewQueue, soundOn, ttsSupported, vocab]);
  // 처음 보는 표현은 펼친 채로 나온다 — 직전 동작이 포인터 · 단축키였으면 소리를 낸다(보조기술이면 글로만).
  const introWord = currentStep?.phase === 'intro' ? (currentStep.engine === 'legacy' ? currentWord : fsrsStepWord) : undefined;
  useEffect(() => {
    if (tab === 'review' && !reviewFinished && introWord) autoplay(introWord, lastTriggerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reviewFinished, introWord?.id, questionKey]);

  // 복습 세션 중에는 페이지 크롬(헤더·통계·필터·하단 네비)을 걷어낸다.
  // 하단 네비는 Layout 소유라 컴포넌트에서 못 지운다 — body 클래스로 CSS에 알린다.
  // 훅은 아래 `if (!user)` 조기 return보다 **위**에 있어야 한다(#838 Hooks 순서 사고와 같은 자리).
  const inSession = tab === 'review' && !reviewFinished || tab === 'practice' && !!practice && !practice.finished;
  // 끝 화면(복습 · 집중 연습) — 세션 머리줄을 그대로 두고 복습방 머리(「THE REVIEW ROOM 복습」)는 「목록으로」 뒤에만 그린다
  // (VOCAB-FLOW-001 A, 오너 「권장대로」 2026-10-17 KST). 끝으로 넘어가는 순간 머리가 다시 생겨 본문이 390 +107px · 1440 +131px
  // 내려앉았다(layout-shift 0.074 · 0.030, 입력 직후라 CLS 밖이지만 눈에 보인다).
  const onEndScreen = tab === 'review' && reviewFinished || tab === 'practice' && !!practice && practice.finished;
  const sessionChrome = inSession || onEndScreen;
  // W R2 — 지금 화면에 있는 4버튼 줄(상태로 판정, DOM 질의 금지). 집중 연습은 두 버튼 줄(키 1 · 2).
  const quizMode = effectiveMode === 'context' || effectiveMode === 'listening';
  // 처음 보는 표현 카드에는 채점 줄이 없다(Space = 「다음 →」).
  const introStep = tab === 'review' && currentStep?.phase === 'intro';
  const keyWord = tab === 'practice' ? practiceWord : introStep ? undefined : currentWord;
  const reviewKeyRow = !keyWord ? null
    : tab === 'practice' && showAnswer ? (effectiveMode === 'listening' ? null : 'practice')
    : showAnswer ? 'score'
    : quizMode && contextSelected === null && contextOptions.length > 0 && (effectiveMode !== 'listening' || ttsSupported) ? 'options'
    : quizMode && contextSelected !== null && contextOptions[contextSelected]?.id !== keyWord.id ? 'wrong'
    : null;
  const revealCard = trigger => {
    lastTriggerRef.current = trigger;
    setShowAnswer(true);
    setShowHint(false);
    if (tab === 'review') autoplay(currentWord, trigger);
  };
  reviewKeysRef.current = {
    row: inSession && (reviewKeyRow !== 'score' && reviewKeyRow !== 'practice' || scoreArmed) ? reviewKeyRow : null,
    score: handleScore, pick: pickContextOption, reveal: () => setShowAnswer(true), practice: handlePractice,
    space: inSession && introStep && introWord ? () => advanceIntro('shortcut')
      : inSession && keyWord && !showAnswer && effectiveMode === 'flash' ? () => revealCard('shortcut') : undefined,
    undo: undoLastGrade, canUndo: !!lastGradeRef.current && !scoringRef.current,
    // 직전 채점이 새 일정 카드였으면 ⌘Z · ↶는 그 카드를 되돌린다(되돌리기는 한 단계).
    ...(lastEngineRef.current === 'fsrs' && tab === 'review' ? { undo: undoFsrsGrade, canUndo: !!fsrsReview.lastGrade && !fsrsReview.busy } : {}),
  };
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.toggle('is-review-session', inSession);
    // 위 여백(8px)은 끝 화면까지 같게 — 끝으로 넘어가며 40px로 돌아가 본문이 32px 더 내려앉던 몫(A). 하단 내비는 끝 화면에서 다시 보인다.
    document.body.classList.toggle('is-review-chrome', sessionChrome);
    return () => document.body.classList.remove('is-review-session', 'is-review-chrome');
  }, [inSession, sessionChrome]);

  if (!user && explicitScope) return <div className="page-container"><h1>{scopeHeading(explicitScope.scope)}</h1><p>담은 표현은 로그인한 계정에 보관돼요.</p><div className="manabi-row"><Link href={authEntryHref(serializeReviewScope(explicitScope.scope, { returnTo: explicitScope.returnTo }))}>로그인하고 이어가기 →</Link>{explicitScope.returnTo && <Link href={explicitScope.returnTo}>← 교재로</Link>}</div></div>;
  if (!user) {
    // 단어장은 계정 기반이지만 문법 복습은 이 기기 기록만으로도 이어갈 수 있다 —
    // '복습' 탭이 게스트에게 막다른 길이 되지 않도록 경로를 함께 연다.
    return (
      <div className="page-container manabi-review-room review-guest">
        <p className="manabi-eyebrow">THE REVIEW ROOM</p><h1>기억에 남는 건,<br />다시 만난 문장.</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '6px 0 16px', lineHeight: 1.6 }}>
          단어장은 로그인 후 기기 간 동기화와 함께 쓸 수 있어요.<br />
          문법 복습은 지금 이 기기의 기록만으로도 바로 이어갈 수 있어요.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/review/grammar" className="btn btn--primary btn--md">문법 복습 이어가기 →</Link>
          <Link href={signInHref} className="btn btn--ghost btn--md">로그인하고 단어장 쓰기</Link>
        </div>
      </div>
    );
  }

  const vocabList = (<VocabList
          vocab={vocab}
          readOnly={!learningAvailable}
          learningById={learningAvailable ? learningById : undefined}
          now={effectiveNow}
          filteredVocab={filteredVocab}
          visibleCount={visibleCount}
          setVisibleCount={setVisibleCount}
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          setSortBy={setSortBy}
          langFilter={scope.lang}
          setLangFilter={selectLanguage}
          langAllOption={false}
          languages={[...languageCounts.keys()]}
          levelFilter={scope.level || 'all'}
          setLevelFilter={selectLevel}
          showLevelFilter={showLevelFilter}
          refLevelOf={refLevelOf}
          ttsSupported={ttsSupported}
          koreanLearningSupported={koreanCapabilities.save}
          speak={speak}
          setConfirmAction={setConfirmAction}
          deleteMutation={guardedDeleteMutation}
          bulkDeleteMutation={guardedBulkDeleteMutation}
          updateVocabMutation={guardedUpdateVocabMutation}
          onWordClick={setDetailWord}
          />);

  return (
    <div className={`page-container manabi-review-room${isBookScope ? ' is-book-scoped' : ''}`} style={textbookThemeStyle(scope.lang)}>

      {/* 네트워크가 죽어 캐시 스냅샷으로 살아난 화면임을 알린다(v2-N R1) */}
      {isOffline && <OfflineNotice what="단어장" />}
      {admission.error && tab !== 'review' && <div role="alert" className="card">
        <p>{REVIEW_PREP_FAILED}</p>
        <Button variant="ghost" onClick={() => admission.controller.retryConfiguration().catch(() => {})}>다시 시도</Button>
      </div>}
      <PendingReviewsNotice count={pendingReviewCount} />
      {/* 복습 끝 공지(B) — 화면 읽기 전용. 영역은 늘 그려 두고 내용만 넣는다(내용과 함께 생기는 status는 놓칠 수 있다). */}
      <p className="sr-only review-finish-announce" role="status">{tab === 'review' && reviewFinished && finishNotice ? '이번 표현 복습을 마쳤어요' : ''}</p>

      {/* 헤더 — 세션 중 · 끝 화면에는 없앤다(끝 화면은 세션 머리줄 유지). 부제와 총계는 아래 통계와 중복이라 뺐다. */}
      {!sessionChrome && (
        <header className="review-room-heading">
          <div><p className="manabi-eyebrow">THE REVIEW ROOM</p><h1>{tab === 'browse' ? '담은 표현' : scopeHeading(scope, { materialTitles })}</h1></div>
          {!isBookScope && <p>읽다가 담은 표현을,<br />내가 쓰는 말로.</p>}
        </header>
      )}


      {/* 범위 막대(설계 §5-1) — 언어 칩(byLang) · 범위 칩 · ＋ 범위 시트. 세션 중 · 목록 화면에서는 걷어낸다. */}
      {!inSession && tab === 'list' && user && learningAvailable && <ReviewScopeBar
        scope={scope} languages={[...languageCounts.keys()]} byLang={session.byLang} countFor={countFor}
        allVocab={allVocab} learningById={learningById} materialTitles={materialTitles} levels={scopeLevels || zhHskLevels}
        onChange={changeScope} onSelectLanguage={selectLanguage} />}
      {isBookScope && !sessionChrome && <section className="review-room-scope review-room-book-scope" aria-label="교재 범위 안내">
        <p>같은 표현은 판본이 달라도 한 카드로 복습해요. 과별 답안 · 학습 완료와는 별개예요.</p>
        <div className="manabi-row"><Link href={reviewScope.returnTo}>← 교재로</Link>{bookExpressionListHref(reviewScope.returnTo) && <Link href={bookExpressionListHref(reviewScope.returnTo)} prefetch={false}>교재의 담은 표현</Link>}</div>
      </section>}
      {/* 세션 상단바 — 나가기 · 진행(서로 다른 카드 n / N) · 🔈/🔇 · 되돌리기. 카드 안에는 문항만 남긴다.
          끝 화면에도 같은 자리에 남긴다(A). 되돌리기는 끝 화면에서도 쓴다(Ctrl/⌘+Z = onFinishedUndo, reviewFinishedUndoKeyboard 계약) — 되돌릴 것이 없을 때만 잠근다. 빼면 진행 수 · 소리 단추가 옆으로 밀린다(실측 layout-shift 0.0009). */}
      {sessionChrome && (() => {
        const progress = tab === 'practice' ? { done: practice.idx, total: practice.total } : runProgress || { done: 0, total: 0 };
        const total = progress.total || 1;
        const doneCount = Math.min(progress.done, total);
        return (
          <div className="review-topbar">
            <button type="button" className="review-topbar__exit" onClick={() => { fsrsReview.controller.leave(); setTab('list'); }}>
              ← 나가기
            </button>
            <div
              className="review-topbar__track"
              role="progressbar"
              aria-label={tab === 'practice' ? '집중 연습 진행' : '복습 진행'}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={doneCount}
            >
              <div className="review-topbar__fill" style={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
            <span className="review-topbar__count" role="status" aria-live="polite" aria-atomic="true">
              {doneCount} / {progress.total}
            </span>
            {ttsSupported && <ReviewSoundToggle on={soundOn} onToggle={toggleSound} />}
            {tab === 'review' && <button type="button" className="review-topbar__undo" aria-label="직전 채점 되돌리기" title="되돌리기 Ctrl/⌘+Z"
              disabled={!reviewKeysRef.current.canUndo} onClick={() => reviewKeysRef.current.undo?.()}>↶</button>}
          </div>
        );
      })()}

      {isLoading || (tab !== 'review' && tab !== 'practice' && scopePending && !vocabError) ? (
        <CardGridSkeleton height={120} />
      ) : tab !== 'review' && tab !== 'practice' && scopeFailed ? (
        // 범위를 못 읽으면 닫는다(설계 §5-6) — 시작 버튼 없음, 「전체」로 바꾸지 않음, 저장 설정 그대로.
        <section className="review-room-state" role="alert"><h2>범위를 불러오지 못했어요.</h2><p>전체로 바꾸지 않았어요. 다시 시도하거나 범위를 풀어 주세요.</p>
          <div className="manabi-row"><button type="button" className="btn btn--primary btn--md" onClick={() => (lookupSource && sourceScope.isError ? sourceScope.refetch() : scopeLevelsQuery.refetch())}>다시 시도</button>
            <button type="button" className="btn btn--ghost btn--md" onClick={() => selectLanguage(scope.lang)}>범위 풀기</button></div></section>
      ) : vocabError || !learningAvailable ? (
        <>
        <section className="review-room-state" role="alert"><h2>표현을 불러오지 못했어요.</h2><p>연결을 확인한 뒤 다시 시도해 주세요. 복습 기록은 그대로 남아 있어요.</p><button type="button" className="btn btn--primary" onClick={() => refetchVocab()}>다시 시도</button></section>
        {vocab.length > 0 && vocabList}
        </>
      ) : tab === 'list' ? (
        /* ── 대시보드 — 각 영역을 같은 문법(제목·수 / 오른쪽 진입 / 요약 / 미리보기)으로 조망한다.
           목록을 다 펼치지 않는다: 단어장은 임박 5개만, 나머지는 클릭해서 들어간다.
           넓은 화면에선 2열(행동·짧은 조망 | 목록)로 조판해 세로로 길어지지 않게 한다. */
        <div className="review-dash review-room-grid">
          {/* 오늘-할-일 카드 — 위계는 셋뿐: 얼마나(수) → 무엇을(버튼) → 어떻게(조용한 셀렉트).
              현황은 단어장 카드 안, 단어장 관리는 ⋯ 메뉴 — 시선이 시작 버튼에 모이게. */}
          <section className="card vocab-hero" aria-labelledby="review-today-title">
            <div className="vocab-hero__top"><span className="vocab-hero__kicker">이 범위에서 오늘</span><span className="manabi-eyebrow">01 / RECALL</span></div>
            {/* 「첫 표현」 안내는 정말 담은 표현이 없을 때만 — 좁힌 범위가 비었을 뿐이면 범위 문구가 말한다(교재 범위는 그 교재 기준). */}
            {/* 준비 중(입장 한도 · FSRS 목록을 받는 중)에는 제목도 골격이다(VOCAB-FLOW-001 · LOADING-SKELETON-001 「받는 중엔 빈 상태 대신
                골격」). session.total이 아직 0이라 「잠시, 읽기로 돌아가요.」(오늘 끝)가 0.1~1초 보였다가 「오늘 다시 볼 표현」으로 바뀌었다
                (픽스처 실측 390 · CPU 4배: 1331 → 1482ms, FSRS 1초 지연 시 약 1초). 제목 자리 · 크기는 같다. */}
            {/* FSRS 목록을 못 받으면(error) 예전 일정 카드도 0으로 세어져 「잠시, 읽기로 돌아가요.」(오늘 끝)가 거짓으로 섰다 — 제목은 중립
                「오늘 복습」. 실패 사실은 아래 알림 「복습 일정을 불러오지 못했어요. 다시 시도」가 말한다(같은 말을 제목에 겹치지 않음, a3ba 리뷰 ③). */}
            <h2 id="review-today-title">{heroPending
              ? <><span className="sr-only">오늘 복습</span><SkeletonLine width="8em" height="1em" /></>
              : fsrsReview.status === 'error' ? '오늘 복습'
                : session.total ? '오늘 다시 볼 표현' : hasAnyWords ? '잠시, 읽기로 돌아가요.' : '첫 표현을 담아 보세요.'}</h2>
            {heroPending ? <p aria-busy="true" className="review-room-note">복습 준비 중…</p> : session.total > 0 ? <>
              <div className="review-room-number"><strong className="vocab-hero__num">{session.total}</strong><span>개의 표현</span></div>
              {/* 0인 갈래는 적지 않는다(learning-flow e2e 「복습 0」 금지) — 「복습 14 · 새 표현 4」(설계 §5-1). */}
              <p className="review-room-note">{[session.due > 0 && `복습 ${session.due}`, session.newAllowed > 0 && `새 표현 ${session.newAllowed}`].filter(Boolean).join(' · ')}</p>
              {/* 세션 길이(§5-1) — 서로 다른 카드 수. 20개보다 많을 때만. */}
              {lengthOptions.length > 0 && <div className="review-length" role="group" aria-label="세션 길이">
                {lengthOptions.map(length => (
                  <button key={length ?? 'all'} type="button" className={`review-length__chip${activeLength === length ? ' is-active' : ''}`} aria-pressed={activeLength === length}
                    onClick={() => setSessionLength(length)}>
                    {length === null ? `전부 ${session.total}` : length === DEFAULT_SESSION_LENGTH ? `5분 · 약 ${length}개` : `${length}개`}
                  </button>
                ))}
              </div>}
              <div className="review-room-actions">
                <Button onClick={startReview} disabled={startingReview || !fsrsReview.registryAvailable || admission.status !== 'ready'} className="review-room-start">{startingReview || fsrsReview.status === 'loading' ? '복습 준비 중…' : `표현 ${sessionCards.length}개 복습 →`}</Button>
                {practiceWords.length > 0 && <Button variant="ghost" onClick={() => startPractice(practiceWords)} className="review-room-practice">집중 연습</Button>}
              </div>
              {practiceWords.length > 0 && <p className="review-room-note review-room-practice-note">복습 {session.total}개 먼저 하면 일정에 반영돼요. 집중 연습은 일정을 바꾸지 않아요.</p>}
              <ReviewScopeNotice scope={scope} count={session} countFor={countFor} remainingNew={remainingNew} languages={[...languageCounts.keys()]} onChange={changeScope} materialTitles={materialTitles}
                onPractice={practiceWords.length ? () => startPractice(practiceWords) : null} onFillMeaning={() => { setMissingMeaningOnly(true); setTab('browse'); }} />
            </> : fsrsReview.status === 'error' ? null : <>
              {/* FSRS 목록을 못 받으면(error) 빈 상태(「지금 다시 볼 표현은 없어요」 · 「오늘로 →」)를 그리지 않는다 — 예전 일정 카드도 0으로
                  세어진 거짓 빈 상태다. 이때는 아래 오류 알림 「복습 일정을 불러오지 못했어요. 다시 시도」 하나만 말한다(제목 중립과 같은 판정). */}
              <ReviewScopeNotice empty scope={scope} count={session} countFor={countFor} remainingNew={remainingNew} languages={[...languageCounts.keys()]} onChange={changeScope} materialTitles={materialTitles}
                onPractice={practiceWords.length ? () => startPractice(practiceWords) : null} onFillMeaning={() => { setMissingMeaningOnly(true); setTab('browse'); }}
                fallback={!hasAnyWords ? '교재 예문의 ‘예문 담기’로 기억하고 싶은 문장을 골라 주세요.' : '지금 다시 볼 표현은 없어요. 다음 복습까지 새로운 문장을 만나 보세요.'} />
              <Link href={isBookScope ? reviewScope.returnTo : hasAnyWords ? '/home' : '/books/japanese-n5'} className="btn btn--primary">{isBookScope ? '읽던 교재로 돌아가기 →' : hasAnyWords ? '오늘로 →' : '교재에서 표현 고르기 →'}</Link>
            </>}
            {/* 멈춘 복습 이어 하기(§5-6) — 같은 화면이면 메모리의 줄, 새로고침 뒤면 세션 저장소의 기록(24시간). */}
            {(inMemoryResume || restorable) && <button type="button" className="review-room-resume" onClick={resumeRun}>
              멈춘 복습 이어 하기 ({(inMemoryResume || restorable).done} / {(inMemoryResume || restorable).total}) →</button>}
            {vocabError && <p role="alert">최신 표현을 확인하지 못했어요. <button type="button" onClick={() => refetchVocab()}>다시 시도</button></p>}
            {fsrsReview.status === 'error' && <p role="alert">복습 일정을 불러오지 못했어요. <button type="button" onClick={() => fsrsReview.controller.refresh()}>다시 시도</button></p>}
            {fsrsReview.error?.message === 'fsrs_sync_blocked' && <p role="alert">복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.
              <button type="button" onClick={() => fsrsReview.controller.retrySync()}>다시 시도</button>
            </p>}
            {fsrsReview.pendingSaves.length > 0 && <p role="alert">복습을 저장하지 못했어요. 연결을 확인해 주세요 — 이 단어는 다음에 다시 나와요.
              <button type="button" onClick={() => fsrsReview.pendingSaves.forEach(row => fsrsReview.controller.retrySave(row.operationId))}>다시 시도</button>
            </p>}
          </section>
          {!isBookScope && <section className="review-room-grammar" aria-labelledby="review-grammar-title">
            <p className="manabi-eyebrow">02 / PATTERNS</p><h2 id="review-grammar-title">문법도 한 번 더.</h2>
            {grammarLoading ? <p aria-busy="true">복습 일정을 확인하고 있어요…</p> : grammarError ? <p role="alert">문법 일정을 불러오지 못했어요. <button type="button" className="btn btn--ghost btn--sm" onClick={() => refetchGrammar()}>다시 시도</button></p> : <p>{dueGrammarCount ? `다시 확인할 문법 ${dueGrammarCount}개가 있어요.` : grammarQueue?.total ? '지금 복습할 문법이 없어요. 다음 일정에 다시 만나요.' : '이야기 학습에서 연습한 문법의 복습 일정이 여기에 모여요. N5 과별 답안과는 별개예요.'}</p>}
            <Link href="/review/grammar" prefetch={false} className="manabi-link">{dueGrammarCount ? `문법 ${dueGrammarCount}개 →` : '문법 복습 확인 →'}</Link>
            <div className="review-room-extra"><p>글 한 편으로 함께 연습하고 싶다면</p><Link href="/study" prefetch={false} className="manabi-link">이야기로 연습 →</Link></div>
                  {confused.length >= CONFUSED_MIN && (
                    <button type="button" className="vocab-rematch" onClick={startRematch}>
                      ⚔ 헷갈린 말 <strong>{confused.length}개</strong> — 재대결 시작 →
                    </button>
                  )}
                  {/* 🎯 유형 큐(v2-A R3) — 헷갈린 말 큐의 형제. 저쪽은 "어떤 말"이고
                      이쪽은 "어떤 방식"이다. 처방할 축이 없으면 줄 자체가 없다. */}
                  {weakDrill && (
                    <button type="button" className="vocab-rematch" onClick={startWeakDrill}>
                      🎯 {tagLabel(weakDrill.tag)}가 약해요
                      {' '}<span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                        · {weakDrill.total}번 중 {weakDrill.wrong}번
                      </span>
                      {' '}— 그 방식으로 <strong>{weakDrill.words.length}개</strong> 복습 →
                    </button>
                  )}

          </section>}
          <section className="card review-sec review-sec--vocab" aria-labelledby="dash-vocab">
            <div className="review-sec__head">
              <h2 id="dash-vocab" className="review-sec__title">담은 표현 <span className="review-sec__count">{vocab.length}</span></h2>
              {vocab.length > 0 && (
                <button type="button" className="review-sec__more" onClick={() => setTab('browse')}>
                  전체 보기 →
                </button>
              )}
            </div>
            {vocab.length > 0 && (
              <p className="review-sec__meta">
                {deckStats.stages.map(stage => `${stage.label} ${stage.count}`).join(' · ')}
              </p>
            )}
            <VocabularyExclusionList vocab={allVocab} scopeIds={lookupSource ? scopeSourceIds || EMPTY_IDS : null} capabilities={koreanCapabilities} />
            {vocab.length === 0 ? (
              <p className="review-sec__empty">교재나 자료에서 단어를 저장하면 여기에 모여요.</p>
            ) : (
              <div className="review-sec__rows">
                {[...deckScope]
                  .sort((x, y) => reviewDueAt(x) - reviewDueAt(y))
                  .slice(0, 5)
                  .map(v => {
                    const t = Number.isFinite(reviewDueAt(v)) ? new Date(reviewDueAt(v)) : null;
                    const remaining = t ? t.getTime() - effectiveNow : null;
                    const days = t ? Math.ceil(remaining / 86400000) : null;
                    const due = !t ? '—' : remaining <= 0 ? '지금' : remaining < 86400000 ? fsrsIntervalLabel(t.toISOString(), new Date(effectiveNow).toISOString()) : days === 1 ? '내일' : `${days}일 후`;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className="review-sec__row"
                        onPointerDown={loadVocabDetailCard}
                        onFocus={loadVocabDetailCard}
                        onClick={() => setDetailWord(v)}
                        aria-label={`${v.word_text} — ${v.meaning} 상세 열기`}
                      >
                        <span className="review-sec__word" lang={({ French: 'fr', Japanese: 'ja', English: 'en', Chinese: 'zh', Korean: 'ko' })[v.language]}>{v.word_text}</span>
                        <span className="review-sec__meaning">{v.meaning}</span>
                        <span className={`review-sec__due${due === '지금' ? ' review-sec__due--now' : ''}`}>{due}</span>
                      </button>
                    );
                  })}
              </div>
            )}
          </section>

              <details className="review-room-settings">
                <summary aria-label="단어장 도구">{isBookScope ? '복습 설정' : '복습 설정과 단어장 관리'} <span>{isBookScope ? '하루 새 표현 한도' : '한도 · 가져오기'}</span></summary>
                <div className="vocab-tools__menu">
                  {!isBookScope && <>
                  <button type="button" className="vocab-tools__item" onClick={() => setManualAddOpen(true)}>
                    단어 직접 추가
                  </button>
                  <button type="button" className="vocab-tools__item" disabled={!learningAvailable} onClick={() => exportCSV(vocab, projections)}>
                    CSV 내보내기
                  </button>
                  <button type="button" className="vocab-tools__item" onClick={() => exportAnki(vocab)}>
                    Anki 내보내기
                  </button>
                  <button type="button" className="vocab-tools__item" disabled={csvImportMutation.isPending} onClick={() => csvInputRef.current?.click()}>
                    {csvImportMutation.isPending ? 'CSV 가져오는 중…' : 'CSV 가져오기'}
                  </button>
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" disabled={csvImportMutation.isPending}
                    aria-label="CSV 파일 선택"
                    onChange={e => { const f = e.target.files?.[0]; if (f) csvImportMutation.mutate(f); e.target.value = ''; }}
                    style={{ display: 'none' }} />
                  </>}
                  {/* 덱 선택은 범위 막대의 「출처 · 사전 급수 덱」으로 흡수했다(REV-SCOPE-R1A). 단어 복습 방식(타이핑 · 리스닝)은
                      집중 연습의 갈래로 옮겼다(REV-SCOPE-R1B-1) — 본 복습은 플래시(버튼 넷)뿐이다. 여기는 한도만. */}
                  <div className="vocab-tools__limit">
                    <label htmlFor="new-per-day" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 5 }}>
                      하루 새 단어 한도{explicitScope && ' · 전체 복습과 공유'}
                    </label>
                    <select
                      id="new-per-day"
                      value={admission.compatibility ? newPerDay : admission.quota?.limit ?? newPerDay}
                      disabled={admission.status !== 'ready' || admission.busy}
                      onChange={e => admission.compatibility ? setNewPerDay(Number(e.target.value)) : admission.controller.configure(Number(e.target.value))}
                      style={{
                        width: '100%', padding: '6px 8px', fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                      }}
                    >
                      {NEW_PER_DAY_OPTIONS.map(n => (
                        <option key={n} value={n}>{n === 0 ? '없음 (복습만)' : `${n}개`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>
          {/* 서재와 작문 — 교재의 두 타일을 이전해 온 상시 입구(앱 유일). 서재=지난 문단 재독,
              작문=쓰고 첨삭 받는 연습장(지난 작문 히스토리 포함) — '기록실'이 아니다. */}
          {!isBookScope && <section className="card review-sec review-sec--revisit" aria-labelledby="dash-revisit">
            <div className="review-sec__head">
              <h2 id="dash-revisit" className="review-sec__title">다른 연습</h2>
            </div>
            <div className="review-sec__rows">
              <Link href="/study/library" className="review-sec__row">
                <span className="review-sec__word">지난 이야기</span>
                <span className="review-sec__meaning">지난 문단 다시 읽기 · 내 글감으로 학습</span>
                <span className="review-sec__due">열기 →</span>
              </Link>
              <Link href="/writing" className="review-sec__row">
                <span className="review-sec__word">작문</span>
                <span className="review-sec__meaning">배운 문법으로 쓰고 첨삭 받기</span>
                <span className="review-sec__due">열기 →</span>
              </Link>
            </div>
          </section>}

        </div>
      ) : tab === 'browse' ? (
        <>
          <button type="button" className="chip" style={{ marginBottom: 12 }} onClick={() => { setMissingMeaningOnly(false); setTab('list'); }}>
            ← 돌아가기
          </button>
          {missingMeaningOnly && <p className="review-room-note review-missing-meaning">뜻이 없는 표현만 보고 있어요. 뜻을 채우면 다음 복습부터 나와요.
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setMissingMeaningOnly(false)}>전체 보기</button></p>}
          <VocabularyExclusionList vocab={allVocab} scopeIds={lookupSource ? scopeSourceIds || EMPTY_IDS : null} capabilities={koreanCapabilities} />
          {vocabList}
        </>
      ) : tab === 'review' ? (
        currentStep && !reviewFinished && currentStep.engine === 'fsrs' && currentStep.phase !== 'intro' ? (
          // 새 일정 카드 — 같은 카드 규격으로 controller가 연다(질문 · 노출 · 채점 · 학습 단계는 FSRS 경로 그대로).
          <FsrsReviewSession review={fsrsReview} embedded cardId={currentStep.id} stepKey={questionKey} onExit={() => setTab('list')}
            onGraded={onFsrsGraded} onUnavailable={skipCard} speak={speak} ttsSupported={ttsSupported && fsrsStepWord?.language !== 'Korean'}
            onReveal={(trigger, word) => { lastTriggerRef.current = trigger; autoplay(word, trigger); }}
            onKnown={markKnownInSession} knownDisabled={knownWords.mutation.isPending} />
        ) : currentStep && !reviewFinished && currentStep.phase === 'intro' && (currentStep.engine === 'fsrs' ? fsrsStepWord : currentWord) ? (
          // 처음 보는 표현 — 채점 없음. 3장 뒤 다시 묻는다.
          <div className="review-room-session">
            <ReviewIntroCard word={currentStep.engine === 'fsrs' ? fsrsStepWord : currentWord} speak={speak}
              ttsSupported={ttsSupported && (currentStep.engine === 'fsrs' ? fsrsStepWord : currentWord)?.language !== 'Korean'} onNext={advanceIntro} />
          </div>
        ) : (
          <VocabReview
            bookReview={isBookScope ? { returnTo: reviewScope.returnTo } : null}
            vocab={vocab}
            projections={projections.filter(row => vocab.some(word => word.id === row.vocabulary.id))}
            learningAvailable={learningAvailable}
            now={effectiveNow}
            reviewWords={reviewSessionWords}
            reviewIdx={reviewIdx}
            currentWord={currentWord}
            admissionPending={!!candidateWord && !currentWord && !admission.error}
            admissionError={!!candidateWord && !currentWord ? admission.error : null}
            onAdmissionRetry={() => admission.controller.question(candidateWord.id, questionKey)}
            reviewFinished={reviewFinished}
            pickContextOption={pickContextOption}
            effectiveMode={effectiveMode}
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            showHint={showHint}
            setShowHint={setShowHint}
            typingAnswer={typingAnswer}
            setTypingAnswer={setTypingAnswer}
            contextSelected={contextSelected}
            contextOptions={contextOptions}
            handleScore={handleScore}
            handleSkip={handleSkip}
            ttsSupported={ttsSupported && currentWord?.language !== 'Korean'}
            speak={speak}
            exampleSentences={exampleSentences}
            exampleLoading={exampleLoading}
            loadExamples={loadExamples}
            setTab={setTab}
            armed={scoreArmed}
            onReveal={trigger => { lastTriggerRef.current = trigger; autoplay(currentWord, trigger); }}
            onKnown={markKnownInSession}
            knownDisabled={knownWords.mutation.isPending}
            finish={finishInfo}
          />
        )
      ) : tab === 'practice' && practice ? (
        <>
          {!practice.finished && <div className="review-practice-modes" role="group" aria-label="연습 방식">
            {[['flash', '스스로 확인'], ['typing', '뜻 쓰기'], ['listening', '듣고 고르기']].map(([mode, label]) => (
              <button key={mode} type="button" className={`review-length__chip${practiceMode === mode ? ' is-active' : ''}`} aria-pressed={practiceMode === mode}
                disabled={mode === 'listening' && !ttsSupported}
                onClick={() => { setPracticeMode(mode); setShowAnswer(false); setTypingAnswer(''); setContextSelected(null); }}>{label}</button>
            ))}
          </div>}
          <VocabReview
            vocab={vocab}
            reviewWords={practice.ids}
            reviewIdx={practice.idx}
            currentWord={practiceWord}
            reviewFinished={practice.finished}
            pickContextOption={pickContextOption}
            effectiveMode={effectiveMode}
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            showHint={showHint}
            setShowHint={setShowHint}
            typingAnswer={typingAnswer}
            setTypingAnswer={setTypingAnswer}
            contextSelected={contextSelected}
            contextOptions={contextOptions}
            handleScore={handlePractice}
            ttsSupported={ttsSupported && practiceWord?.language !== 'Korean'}
            speak={speak}
            setTab={setTab}
            armed={scoreArmed}
            onReveal={trigger => { lastTriggerRef.current = trigger; autoplay(practiceWord, trigger); }}
            onKnown={markKnownInSession}
            knownDisabled={knownWords.mutation.isPending}
            metaLabel={`집중 연습 · ${Math.min(practice.idx + 1, practice.total)} / ${practice.total}`}
            practice={{ total: practice.total, unknown: practice.unknown,
              onFragile: () => { changeScope({ ...scope, state: 'fragile' }); setTab('list'); } }}
          />
        </>
      ) : null}

      {knownUndo && inSession && <div className="review-known-undo" role="status">
        아는 단어로 옮겼어요 <button type="button" className="btn btn--ghost btn--sm" onClick={undoKnownInSession}>되돌리기</button>
      </div>}

      {detailWord && (
        <div lang={detailWord.language === 'Korean' ? 'ko' : undefined}><VocabDetailCard now={effectiveNow} projection={learningAvailable ? learningById.get(detailWord.id) : undefined} showBookContexts={isBookScope || (detailWord.language === 'Korean' && koreanCapabilities.review)} word={detailWord} onClose={() => setDetailWord(null)} speak={speak} ttsSupported={ttsSupported && detailWord.language !== 'Korean'} /></div>
      )}

      {/* 수동 단어 추가 모달 */}
      {manualAddOpen && (
        <div className="modal-overlay" onClick={() => !manualAddMutation.isPending && setManualAddOpen(false)}>
          <div ref={manualDialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="vocab-add-title" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 id="vocab-add-title" style={{ margin: '0 0 16px', fontSize: '1.05rem' }}>단어 직접 추가</h3>

            <span id="vocab-add-language-label" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>언어</span>
            <div role="group" aria-labelledby="vocab-add-language-label" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['Japanese', 'English', 'French', 'Chinese'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setManualDraft(d => ({ ...d, language: lang }))}
                  className={`btn btn--sm ${manualDraft.language === lang ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flex: 1 }}
                  aria-pressed={manualDraft.language === lang}
                >
                  {({ Japanese: '일본어', English: '영어', French: '프랑스어', Chinese: '중국어' })[lang]}
                </button>
              ))}
            </div>

            <label htmlFor="vocab-add-word" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>단어 *</label>
            <input
              id="vocab-add-word"
              type="text"
              value={manualDraft.word_text}
              onChange={e => setManualDraft(d => ({ ...d, word_text: e.target.value }))}
              className="form-input"
              placeholder={manualDraft.language === 'Japanese' ? '예: 食べる' : manualDraft.language === 'French' ? 'ex: bonjour' : manualDraft.language === 'Chinese' ? '例: 北京' : 'e.g. eloquent'}
              autoFocus
              data-dialog-initial-focus
              style={{ marginBottom: 12 }}
            />

            <label htmlFor="vocab-add-reading" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>
              {manualDraft.language === 'Japanese' ? '후리가나' : '발음 (선택)'}
            </label>
            <input
              id="vocab-add-reading"
              type="text"
              value={manualDraft.furigana}
              onChange={e => setManualDraft(d => ({ ...d, furigana: e.target.value }))}
              className="form-input"
              placeholder={manualDraft.language === 'Japanese' ? 'たべる' : '(선택)'}
              style={{ marginBottom: 12 }}
            />

            <label htmlFor="vocab-add-meaning" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>의미</label>
            <input
              id="vocab-add-meaning"
              type="text"
              value={manualDraft.meaning}
              onChange={e => setManualDraft(d => ({ ...d, meaning: e.target.value }))}
              className="form-input"
              placeholder="한국어 뜻"
              style={{ marginBottom: 12 }}
            />

            <label htmlFor="vocab-add-pos" className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>품사 (선택)</label>
            <input
              id="vocab-add-pos"
              type="text"
              value={manualDraft.pos}
              onChange={e => setManualDraft(d => ({ ...d, pos: e.target.value }))}
              className="form-input"
              placeholder="동사 / 명사 / 형용사…"
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setManualAddOpen(false)} disabled={manualAddMutation.isPending} style={{ flex: 1 }}>
                취소
              </Button>
              <Button
                onClick={() => manualAddMutation.mutate(manualDraft)}
                disabled={manualAddMutation.isPending || !manualDraft.word_text.trim()}
                style={{ flex: 2 }}
              >
                {manualAddMutation.isPending ? '추가 중…' : '추가'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
