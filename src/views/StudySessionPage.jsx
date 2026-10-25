'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { seededShuffle } from '../lib/seededShuffle';
import Button from '../components/Button';
import ExerciseEnginePrototype from '../components/ExerciseEnginePrototype';
import RefSpeak from '../components/RefSpeak';
import { useTTS } from '../lib/useTTS';
import { JaText } from './refShared';
import { supabase } from '../lib/supabase';
import { VOCAB_UPSERT, buildVocabRow } from '../lib/vocabIO';
import { useAuth } from '../lib/AuthContext';
import { addRefRead, setRefCheck } from '../lib/refReadStore';
import { clearStudySource, readStudySource } from '../lib/studySourceHandoff';
import { useToast } from '../lib/ToastContext';
import { createGrammarRetry, gradeGrammarReview, ratingFromScore, sendGrammarGradeKeepalive } from '../lib/grammarSrs';
import { sessionTokenFor, keepaliveTokenUsable } from '../lib/keepalive';
import { createReviewEventBatcher, logReviewEvents, sendReviewEventsOnHide } from '../lib/reviewEvents';
import { hasVapidKey, isPushSupported, isIosNeedsInstall, getSubscriptionState, subscribePush } from '../lib/push';
import { sentenceIncludesWord } from '../lib/skillRung';
import { recordActivity } from '../lib/streak';
import { recordLessonCompleted, recordNewWord } from '../lib/learn/progressStore';
import { recordStudyReviewCompleted } from '../lib/studyExerciseBridge';
import { gradeTyping, isChapterPassed, grammarDueChapterCounts } from '../lib/studySession';
import { buildWeeklyReport } from '../lib/weeklyReport';
import { fetchWeeklyReportRows } from '../lib/weeklyReportRows';
import { splitSentenceAroundWord } from '../lib/constants';
import { mapParagraphToItems } from '../lib/studyParagraph';
import { ARCHIVED_TEXTBOOK_NOTICE, learnerHref } from '../lib/bookNavigation';
import { authEntryHref } from '../lib/authRedirect';
import { focusIfFree, focusItemHead, ignoreHeldKey } from '../lib/focusAfterAction';
import { STUDY_OFFLINE_LINE } from '../lib/studyUnavailable';

/** 문법 일정을 끝내 못 보냈다(재시도 상한 · 오프라인으로 화면 떠남) — copy-standard 실패 + 보존 여부 한 문장. */
const GRAMMAR_NOT_SAVED = '문법 복습 일정을 저장하지 못했어요. 이 문법은 다음 학습에 다시 나와요.';

/** 로컬 날짜 YYYY-MM-DD — 격일 산출 문항 노출 판정용 */
function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function persistWritingPractice(row) {
  try {
    const { error } = await supabase.from('writing_practice').insert(row);
    if (error) console.warn('[writing practice] history save failed:', error.message);
  } catch (error) {
    console.warn('[writing practice] history save failed:', error);
  }
}


/**
 * 공부 모드 세션 — 서버가 조립한 ~12문항을 듀오링고식으로 진행한다.
 * 문항당 즉시 피드백, 오답은 세션 끝에 1회 재출제(첫 시도만 SRS·통과에 반영).
 * 종료 시: 어휘 FSRS 갱신 · 문법 due 재스케줄 · 신규 챕터 통과 처리 · 이벤트 적재.
 */
export default function StudySessionPage({
  session = null, paragraphMaterials = null, pregenerated = null, warmup = [], encounterItems = [], dial = 'normal',
  sourceMode = false,
  lang, langCode, langName, readKey,
  band = 'beginner', languages = [], signedOut = false, shuffleSeed = '', sessionUserId = null,
}) {
  // 로그인 뒤 지금 화면으로 돌아온다(맨 /auth는 /home으로 보낸다) — 대상 검증은 authEntryHref 규칙.
  const signInHref = authEntryHref(usePathname());
  // 입문 레벨(N5 등) 일본어 배려 — 답변 중에도 요미가나·후리가나를 보여준다.
  const kanjiCare = band === 'beginner' && langCode === 'ja';
  // 문단 발음 상시 노출은 입문에 한정 — 비입문은 문장 탭으로 지연 공개(한자 읽기 인출 기회 확보).
  const alwaysShowPron = band === 'beginner';
  const { user, fetchProfile, loading: authLoading } = useAuth();
  // 세션 계정 — 서버가 확인한 사용자로 시작할 때 고정한다. 도중에 로그아웃하거나 다른 계정이 되면 기록을 멈추고
  // 로그인을 안내한다(로그인 없는 기록은 기기 로컬로 새고, 다른 계정이면 남의 기록이 된다). 기록하는 곳은 recorderRef만 본다.
  const sessionUserRef = useRef(sessionUserId || null);
  if (!sessionUserRef.current && user?.id) sessionUserRef.current = user.id;
  const authLost = !!sessionUserRef.current && !authLoading && user?.id !== sessionUserRef.current;
  const recorderRef = useRef(null);
  recorderRef.current = authLost ? null : sessionUserRef.current;
  // 이 화면의 채점 · 새 단어 저장은 뷰어의 저장 · 만기 색인(['vocab-words'], 신선도 2분 — VOCAB_WORDS_STALE_MS)을 무효화하지 않는다.
  // 떠날 때 세션 계정의 것을 낡음으로만 표시한다 — 다시 읽지 않는다(요청 0). 다음에 뷰어를 열면 그때 새로 받는다(로그인 감사 F3③).
  const queryClient = useQueryClient();
  useEffect(() => () => {
    if (sessionUserRef.current) queryClient.invalidateQueries({ queryKey: ['vocab-words', sessionUserRef.current], refetchType: 'none' });
  }, [queryClient]);
  const [lostRecordUid, setLostRecordUid] = useState(null); // 큐에도 못 담은 문항(첫 시도 uid — 재출제 -r에는 다시 띄우지 않는다) — 인라인 한 줄
  const [grammarGaveUp, setGrammarGaveUp] = useState(false); // 문법 일정 재시도 상한을 넘겨 버렸다 — 한 줄 알림
  const toast = useToast();
  const { speak: ttsSpeak, supported: ttsSupported } = useTTS();
  // 프리페치된 문단이 있으면 API 없이 즉시 매핑 (마운트 전 결정) — 로딩 화면 스킵.
  const pregenMapped = useMemo(
    () => (pregenerated?.paragraph ? mapParagraphToItems(pregenerated.paragraph, pregenerated.materials || {}) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const usePregen = !!(pregenMapped && pregenMapped.gradedCount >= 3);
  // 라이브 생성 경로 — 프리페치가 없고 문단 재료가 있으면 워밍업부터 시작하고
  // 문단은 뒤에서 생성해 이어붙인다(로딩 화면으로 막지 않는다).
  const liveGen = !!(paragraphMaterials && !pregenerated?.paragraph);
  const warmupItems = liveGen ? (warmup || []) : [];
  // 만남 인지 문항(rfc-adaptive-quiz §4.1, 목업 A)은 문단·프리페치·폴백 세 경로 공통으로
  // 큐 말미에 붙는다 — 프리페치·즉시 폴백은 초기 큐에서, 라이브 생성은 성공/폴백 합류 시.
  const [queue, setQueue] = useState(() =>
    usePregen ? [...pregenMapped.items, ...encounterItems]
      : liveGen ? warmupItems
        : [...(session?.items || []), ...encounterItems]
  );
  const [gradedBase, setGradedBase] = useState(() =>
    (usePregen ? pregenMapped.gradedCount : liveGen ? warmupItems.length : (session?.gradedCount || 0))
    + (liveGen ? 0 : encounterItems.length)
  );
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('answer');   // 'answer' | 'feedback'
  const [picked, setPicked] = useState(null);
  const [typing, setTyping] = useState('');
  const [orderPicks, setOrderPicks] = useState([]);
  const [matchState, setMatchState] = useState({ selectedId: null, matches: {} });
  const [firstResults, setFirstResults] = useState({}); // 원본 uid → { ok, item }
  const [requeued, setRequeued] = useState(() => new Set());
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState(() => new Set()); // 건너뛴 문항(듣기) — 집계·SRS 제외
  const [showTranslation, setShowTranslation] = useState(false);
  const [revealedPron, setRevealedPron] = useState(() => new Set()); // 비입문 문단 — 발음 공개한 문장 인덱스
  const [activeWord, setActiveWord] = useState(null);      // 재료 단어 팝오버(문맥 확인)
  const [listenFailed, setListenFailed] = useState(false); // 듣기 자동재생 미지원·실패 표시
  const [nextPreview, setNextPreview] = useState(''); // 결과 화면 — 내일 문단 예고
  const [explainState, setExplainState] = useState(null); // 오답 해설: null | 'loading' | {text} | 'failed'
  const [weeklyStats, setWeeklyStats] = useState(null);   // 주간 회고: { n, m } (weekly 세션 결과 화면)
  const [produceState, setProduceState] = useState(null); // 산출 문항 채점: {status:'grading'|'done'|'error', feedback, targetScore}
  const [encounterSaveState, setEncounterSaveState] = useState(null); // 만남 담기(목업 B): null|'saving'|'saved'
  const [produceReflected, setProduceReflected] = useState(false); // 산출 문장이 내일 문단에 반영됨(≥2점·연재 세션)
  const [parkingLong, setParkingLong] = useState(false); // 파킹 대기 8초 경과 여부
  const [pushPrime, setPushPrime] = useState(null);       // 푸시 프라이밍: null(숨김) | 'show' | 'ios' | 'done'
  const [pushBusy, setPushBusy] = useState(false);        // 알림 받기 요청 중
  const pushOpenRef = useRef(false);                      // push_open 계측 1회 가드
  const produceAddedRef = useRef(false);           // 산출 문항 큐 추가 1회 가드
  const produceDoneRef = useRef(false);            // 산출 문항 확정 1회 가드(늦은 fetch 이중 처리 방지)
  const transitionAtRef = useRef(0);               // 마지막 문항 전환 시각(연타 tap-through 잠금)
  const streakSentRef = useRef(false);             // pagehide 스트릭 기록 1회 가드(effectsFired와 분리 — bfcache 복귀 시 종료 이펙트가 억제되지 않게)
  // 문단 생성 — 재료가 있으면 세션 시작 전에 오늘의 문단을 만든다. 실패 시 폴백(조립 세션).
  // 프리페치된 문단이 있으면 이미 매핑 완료 → 'ready'(gradedCount 부족 시 'fallback').
  const [genStatus, setGenStatus] = useState(
    pregenerated?.paragraph ? (usePregen ? 'ready' : 'fallback') : (paragraphMaterials ? 'loading' : 'off')
  );
  const genRan = useRef(false);
  const effectsFired = useRef(false);
  const prefetchRan = useRef(false);
  // 문항 확정(settle) 시점 사이드이펙트용 refs (렌더 유발 없이 동기 접근)
  const batcherRef = useRef(null);                 // review_events 마이크로배치 큐
  const grammarAggRef = useRef(new Map());         // slug → { srs, right, total } 챕터별 누적
  // 문법 재스케줄 보류함 — 저장 실패(오프라인 등)한 챕터 채점을 남겨 online · 세션 종료 · 화면 떠남 · pagehide 때 다시 보낸다.
  // 같은 화면 안(메모리)까지다. 기기 큐(reviewOutbox · fsrsOperationOutbox)를 검토했지만 싣지 않았다 — reviewOutbox는
  // 어휘 이벤트 행(flush가 review_events로 insert) · user_vocabulary FSRS 전용이고 같은 저장소의 다른 형식을 kind 제외 목록으로
  // 거르는 소비자(pendingReviews · flush · 단어장 대기 수)가 여럿이라 새 형식이 이벤트로 새고, fsrsOperationOutbox는 서버 FSRS
  // 작업(UUID 어휘 카드) 계약이다. 대신 오프라인이면 횟수를 쓰지 않고, 닫힐 때는 keepalive로 보내고, 못 보내고 떠나면 알린다.
  const pendingGrammarRef = useRef(null);
  const grammarGiveUpsRef = useRef(0);            // 포기한 문법 일정 수 — 화면을 떠난 뒤(알림 영역이 없을 때) 포기도 토스트로 알린다
  if (!pendingGrammarRef.current) {
    pendingGrammarRef.current = createGrammarRetry({ grade: gradeGrammarReview, onGiveUp: () => { grammarGiveUpsRef.current += 1; setGrammarGaveUp(true); } });
  }
  const grammarTokenRef = useRef(null);            // keepalive용 세션 계정 토큰 { userId, token } — 보류가 생길 때 받아 둔다
  const heldSettlesRef = useRef([]);               // 로그인이 풀린 동안 확정한 문항 — 같은 세션 계정이 돌아오면 그때 기록한다
  const heldEventsRef = useRef([]);                // 같은 이유로 멈춰 둔 review_events(어시스트 · 해설 · 산출)
  const effectsHeldRef = useRef(false);            // 로그인이 풀린 채 끝나 못 한 세션 종료 이펙트
  const recordedRef = useRef(new Set());           // 이미 확정한 orig uid (중복 방지) — 기록했거나, 로그인이 풀려 heldSettlesRef에 보류했다
  const itemShownAtRef = useRef(Date.now());       // 현재 문항 표시 시각 (rt_ms 계산)
  const assistSeenRef = useRef(new Set());         // 재료 단어 어시스트 열람 기록(세션당 단어별 1회)
  const listenAutoRef = useRef(null);              // 듣기 자동재생 1회 가드(uid 기준)
  const explainCountRef = useRef(0);               // 오답 해설 세션당 캡 카운터(3회)
  const weeklyRan = useRef(false);                 // 주간 회고 조회 1회 가드

  useEffect(() => {
    if (genRan.current) return;
    genRan.current = true;
    // 프리페치된 문단은 초기화에서 이미 매핑됨 — 라이브 생성 스킵.
    if (pregenerated?.paragraph) return;
    if (!paragraphMaterials) return;
    // 내 자료 모드 — 사용자가 서재에서 붙여넣은 소재를 localStorage에서 읽어 소재로 전달(1회용).
    // 텍스트가 없으면(직접 URL 진입 등) 일반 세션으로 조용히 진행.
    let sourceText = '';
    if (sourceMode) {
      sourceText = readStudySource(lang, user?.id ?? null); // 이 계정이 30분 안에 넘긴 글만(lib/studySourceHandoff)
    }
    (async () => {
      try {
        let authHeader = {};
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s?.access_token) authHeader = { Authorization: `Bearer ${s.access_token}` };
        } catch {}
        const res = await fetch('/api/study-paragraph', {
          method: 'POST',
          signal: AbortSignal.timeout(20000), // 20초 넘으면 abort → catch → 폴백 세션으로 합류
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            language: paragraphMaterials.language,
            level: paragraphMaterials.level,
            newPattern: paragraphMaterials.newPattern,
            duePatterns: paragraphMaterials.duePatterns.map(p => ({ pattern: p.pattern, patternKo: p.patternKo })),
            dueWords: paragraphMaterials.dueWords.map(w => ({ word: w.word, meaning: w.meaning })),
            newWords: paragraphMaterials.newWords.map(w => ({ word: w.word, meaning: w.meaning })),
            knownWords: paragraphMaterials.knownWords || [],
            whitelistWords: paragraphMaterials.whitelistWords || [],
            theme: paragraphMaterials.theme || '',
            avoidThemes: paragraphMaterials.avoidThemes || [],
            ...(sourceText.trim() ? { sourceText } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.paragraph) {
          // 생성 성공 → 내 자료 소재는 1회용이므로 즉시 소거(재사용·다음 세션 오염 방지).
          if (sourceText) clearStudySource(lang);
          const mapped = mapParagraphToItems(data.paragraph, paragraphMaterials);
          if (mapped.gradedCount >= 3) {
            // 워밍업 뒤에 문단 문항 + 만남 인지 문항을 이어붙이고 집계 기준을 갱신
            setQueue(prev => [...prev, ...mapped.items, ...encounterItems]);
            setGradedBase(prev => prev + mapped.gradedCount + encounterItems.length);
            setGenStatus('ready');
            return;
          }
        }
        applyFallback();
      } catch {
        applyFallback();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 문단 생성 실패 — 폴백 세션 문항을 워밍업 뒤에 이어붙인다.
   * 워밍업과 겹치는 어휘 문항은 폴백 쪽에서 제외(중복 출제 방지).
   */
  function applyFallback() {
    const warmupWords = new Set(warmupItems.map(w => w.word?.word_text).filter(Boolean));
    const fb = (session?.items || []).filter(it => !(it.word && warmupWords.has(it.word.word_text)));
    setQueue(prev => [...prev, ...fb, ...encounterItems]);
    setGradedBase(prev => prev + fb.filter(i => i.type !== 'teach').length + encounterItems.length);
    setGenStatus('fallback');
  }

  const item = queue[idx] || null;

  // 문항 표시 시각 기록 — settle까지의 응답 시간(rt_ms) 계산용
  useEffect(() => { itemShownAtRef.current = Date.now(); }, [item?.uid]);

  // 문항 전환 시 팝오버·듣기 실패표시·오답 해설 리셋
  useEffect(() => { setActiveWord(null); setListenFailed(false); setExplainState(null); }, [item?.uid]);
  // FOCUS-AFTER-ACTION-001 C3 — 답하면 보기 · 입력칸이 잠겨 초점이 사라졌다. 피드백에 들어서면 「계속 →」/「결과 보기 →」로 잇는다
  // (산출 문항은 자체 버튼이라 제외). 초점이 세션 화면 밖이면 뺏지 않는다. 화면 아래쪽 버튼이라 preventScroll(focusIfFree).
  const continueRef = useRef(null);
  useEffect(() => {
    if (phase !== 'feedback' || item?.type === 'produce-writing') return;
    const button = continueRef.current;
    focusIfFree(button, button?.closest('.page-container'));
  }, [phase, item?.uid, item?.type]);
  // STUDY-FOCUS-001 — 「계속 →」을 누르면 그 단추가 사라져 초점이 body로 떨어졌고, 키보드로는 머리글 메뉴부터 2~12번 Tab을
  // 눌러야 다음 문항에 닿았다(합성 로그인 실측 2026-10-17 KST). 새 문항의 질문/제목 머리(headId · data-item-head)로 잇는다 —
  // 첫 답 컨트롤로 보내면 설명 · 문단 카드에서 내용을 건너뛴다(리뷰 차단). 다른 곳에 살아 있는 초점은 뺏지 않는다(focusIfFree).
  // 첫 문항(화면 진입)은 화면 이동 초점(제목, routeFocus)에, 온보딩 「시작하기 →」 뒤 첫 문항은 StudyOnboarding에 맡긴다.
  const itemRef = useRef(null);
  const headId = useId();
  const firstItemUidRef = useRef(item?.uid);
  useEffect(() => {
    if (phase !== 'answer' || !item?.uid || item.uid === firstItemUidRef.current) return;
    const root = itemRef.current;
    focusItemHead(root, root?.closest('.page-container'));
  }, [phase, item?.uid]);
  // 오프라인 동안만 진행 막대 아래 한 줄(STUDY-OFFLINE-LINE, 오너 「권장대로」 2026-10-17 KST) — 답은 기기 보류함에 남았다가
  // 연결되면 저장된다(Layout의 online 동기화). 서버 렌더 · 첫 그림은 온라인으로 두고 붙은 뒤 navigator.onLine을 읽는다.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    sync();
    window.addEventListener('online', sync); window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  // 마지막 「결과 보기 →」도 누르면 사라진다 — 결과 화면 제목(「세션 완료」)으로 잇는다.
  const resultHeadingRef = useRef(null);
  useEffect(() => {
    if (!finished) return;
    const heading = resultHeadingRef.current;
    focusIfFree(heading, heading?.closest('.page-container'));
  }, [finished]);

  // 재료 단어 팝오버 — 바깥 탭 시 닫기(트리거·팝오버는 stopPropagation으로 유지)
  useEffect(() => {
    if (!activeWord) return;
    const onDoc = () => setActiveWord(null);
    window.addEventListener('click', onDoc);
    return () => window.removeEventListener('click', onDoc);
  }, [activeWord]);

  // ── 듣기 문항 진입 시 1회 자동 재생 — 직전 "계속" 탭 제스처로 대체로 허용, 실패해도 무해 ──
  useEffect(() => {
    if (item?.type !== 'vocab-listening' || phase !== 'answer') return;
    if (listenAutoRef.current === item.uid) return;
    listenAutoRef.current = item.uid;
    if (!ttsSupported) { setListenFailed(true); return; }
    try { ttsSpeak(item.word.word_text, lang); }
    catch { setListenFailed(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.uid, item?.type, phase]);

  // ── 격일 산출 문항 — 문단(ready)이 준비되면 조건 충족 시 큐 맨 끝에 1개 추가 ──
  // 조건: 마지막 산출이 오늘·어제가 아니거나 dial이 hard.
  useEffect(() => {
    if (produceAddedRef.current || genStatus !== 'ready') return;
    produceAddedRef.current = true;
    const today = new Date();
    const todayStr = ymdLocal(today);
    const yestStr = ymdLocal(new Date(today.getTime() - 24 * 3600 * 1000));
    let last = '';
    try { last = localStorage.getItem(`study_last_produce_${lang}`) || ''; } catch {}
    const recent = last === todayStr || last === yestStr;
    if (recent && dial !== 'hard') return;
    // 대상 문법 — 새 문법 우선, 없으면 복습 문법 첫 번째
    const tp = paragraphMaterials?.newPattern
      ? { pattern: paragraphMaterials.newPattern.pattern, patternKo: paragraphMaterials.newPattern.patternKo || '' }
      : paragraphMaterials?.duePatterns?.[0]
        ? { pattern: paragraphMaterials.duePatterns[0].pattern, patternKo: paragraphMaterials.duePatterns[0].patternKo || '' }
        : null;
    if (!tp?.pattern) return;
    // 연재 세션(주간 약점·내 자료 아님)이면 산출 슬롯을 '이야기의 다음 문장 쓰기'로 프레이밍한다.
    const serial = !paragraphMaterials?.weekly && !sourceMode;
    setQueue(prev => {
      const para = prev.find(it => it.type === 'paragraph');
      // 오늘 문단의 '마지막 상황' 1줄 — 마지막 문장 뜻 우선, 없으면 번역 요약.
      const lastKo = para?.sentences?.length ? para.sentences[para.sentences.length - 1]?.ko : '';
      const context = String(lastKo || para?.translation || '').slice(0, 80);
      return [...prev, { uid: 'p-1', type: 'produce-writing', context, serial, targetPattern: tp, effect: { kind: 'produce' } }];
    });
    setGradedBase(prev => prev + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genStatus, lang, dial]);

  // ── 워밍업 소진 후 파킹 상태에서 문단이 폴백으로 끝나 이어붙일 게 없으면 종료 ──
  useEffect(() => {
    if (finished) return;
    if (queue.length > 0 && idx >= queue.length && genStatus !== 'loading') {
      setFinished(true);
      fireEffects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue.length, genStatus]);

  // 결과 화면 — 내일 문단 프리페치 + 예고 (1회). ready/fallback 무관하게 시도, 실패는 조용히 생략.
  useEffect(() => {
    if (!finished || prefetchRan.current || !user?.id) return;
    prefetchRan.current = true;
    (async () => {
      try {
        let authHeader = {};
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s?.access_token) authHeader = { Authorization: `Bearer ${s.access_token}` };
        } catch {}
        const res = await fetch('/api/study-paragraph', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({ prefetch: true, language: lang }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.ok && data.preview) setNextPreview(data.preview);
      } catch {}
    })();
  }, [finished, user?.id, lang]);

  // ── push_open 계측 — /study 진입 URL에 src=push면 review_events 1회 적재(기획 v4 §5) ──
  useEffect(() => {
    if (pushOpenRef.current || !user?.id) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('src') === 'push') {
        pushOpenRef.current = true;
        logReviewEvents(user.id, [{ lang, source: 'ui', item_key: '-', correct: true, detail: { qtype: 'push_open' } }]);
      }
    } catch {}
  }, [user?.id, lang]);

  // ── 푸시 프라이밍 노출 판정 — 결과 화면 진입 시 1회(기획 v4 §4, 원칙 3: 가치 먼저 권한 나중) ──
  useEffect(() => {
    if (!finished) return;
    // env 키 부재 → 모든 푸시 표면 조용히 숨김
    if (!hasVapidKey()) { setPushPrime(null); return; }
    // iOS Safari + 미설치(PWA) → 버튼 대신 안내 1줄(억지 유도 금지)
    if (isIosNeedsInstall()) { setPushPrime('ios'); return; }
    if (!isPushSupported()) { setPushPrime(null); return; }
    if (Notification.permission !== 'default') { setPushPrime(null); return; }
    // 거부 이력 30일 침묵
    try {
      const ts = Number(localStorage.getItem('pushPrimeDismissed') || 0);
      if (ts && Date.now() - ts < 30 * 24 * 60 * 60 * 1000) { setPushPrime(null); return; }
    } catch {}
    // 미구독일 때만 노출
    getSubscriptionState().then((s) => {
      setPushPrime(s.subscribed ? null : 'show');
    }).catch(() => setPushPrime(null));
  }, [finished]);

  // 주간 회고 — weekly 세션 결과 화면에서 1회. 주간 리포트 정본(fetchWeeklyReportRows → buildWeeklyReport)
  // 그대로 — 채점 문항만(ui·dict 제외) 세고 되돌린 채점은 뺀다(W 후속 ②). 예전 head 카운트 2회는 모든
  // 행(ui 마커·자가 채점 포함)을 세어 프로필 「이번 주」 카드와 수치가 달랐다(중복 신설 해소).
  useEffect(() => {
    if (!finished || !paragraphMaterials?.weekly || !user?.id || weeklyRan.current) return;
    weeklyRan.current = true;
    (async () => {
      try {
        const { reviews } = buildWeeklyReport(await fetchWeeklyReportRows(user.id));
        setWeeklyStats({ n: reviews.total, m: reviews.correct });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, user?.id]);

  // ── 파킹 화면(문단 생성 대기) 표시 시점 기준 8초 경과 시 안내 문구 한 단계 전환 ──
  const parking = genStatus === 'loading' && idx >= queue.length;
  useEffect(() => {
    if (!parking) { setParkingLong(false); return; }
    const t = setTimeout(() => setParkingLong(true), 8000);
    return () => clearTimeout(t);
  }, [parking]);

  // ── 탭 닫힘·백그라운드 전환 시 잔여 이벤트 flush + 문법 보류분 keepalive + 중도 이탈 스트릭(best-effort) ──
  useEffect(() => {
    function onPageHide() {
      // 세션 계정일 때만 — 계정이 바뀐 뒤 flush하면 A의 이벤트가 B의 토큰으로 나가 RLS에 막혀 조용히 사라진다.
      // 알려진 한계(리뷰 N3, 2026-10-17 KST): 로그인이 풀린 채(authLost) 탭을 닫으면 보류한 문항(heldSettlesRef) ·
      // 이벤트(heldEventsRef) · 배치에 남은 이벤트 · 문법 보류분은 보낼 계정 토큰이 없어 여기서 함께 사라진다.
      // 화면에는 「로그인이 필요해요」 배너가 떠 있다. 문구를 바꾸려면 오너 목업이 먼저라 지금은 동작만 이대로 둔다.
      const recorder = recorderRef.current;
      if (!recorder) return;
      beaconPendingEvents(recorder);
      beaconPendingGrammar(recorder);
      // 1문항 이상 답변했고 아직 fireEffects 전이면 활동 기록 시도(스트릭 RPC는 멱등).
      if (!streakSentRef.current && recordedRef.current.size > 0) {
        streakSentRef.current = true;
        recordActivity(recorder, () => fetchProfile?.(recorder));
      }
    }
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── 연결이 돌아오면 보류한 문법 재스케줄을 다시 보낸다. 화면을 떠날 때(「홈으로」 등)도 한 번 —
  // 그 시도가 끝난 뒤에도 남았거나(오프라인 · 서버 오류 · 토큰 만료 · 로그인 풀림) 그 시도에서 포기했으면, 보류함은 이 화면과
  // 함께 사라지므로 조용히 버리지 않고 전역 토스트로 알린다(연결 여부와 무관 — 알림 영역은 화면과 함께 사라졌다). ──
  // retryPendingGrammar는 ref만 읽어 첫 렌더의 함수로도 지금 계정을 본다.
  useEffect(() => {
    window.addEventListener('online', retryPendingGrammar);
    return () => {
      window.removeEventListener('online', retryPendingGrammar);
      const box = pendingGrammarRef.current, giveUpsBefore = grammarGiveUpsRef.current;
      if (box.size() === 0) return;
      Promise.resolve(retryPendingGrammar()).catch(() => {}).then(() => {
        if (box.size() > 0 || grammarGiveUpsRef.current > giveUpsBefore) toast(GRAMMAR_NOT_SAVED, 'warning', 6000);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 로그인이 풀렸다가 같은 세션 계정이 돌아왔다 — 멈춰 둔 기록을 그 계정에 보낸다 ──
  // recorderRef는 세션 계정이 아니면 null이라, 다른 계정으로 로그인해서는 여기 오지 않는다(A의 기록이 B에 가지 않는다).
  useEffect(() => {
    const recorder = recorderRef.current;
    if (authLost || !recorder) return;
    for (const entry of heldSettlesRef.current.splice(0)) writeSettle(recorder, entry);
    const events = heldEventsRef.current.splice(0);
    if (events.length) { const batcher = getBatcher(); for (const event of events) batcher.add(event); }
    if (effectsHeldRef.current) { effectsHeldRef.current = false; fireEffects(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLost]);

  // 문법 due 챕터별 문항 수 (재출제 제외) — 챕터 마지막 문항 판정에 사용
  const grammarCounts = useMemo(
    () => grammarDueChapterCounts(queue.filter(it => !String(it.uid).endsWith('-r'))),
    [queue]
  );

  // 문항별 셔플 보기·토큰 (uid 기준 1회). 첫 문항은 서버에서도 렌더되므로 무작위로 섞으면 서버와 첫 클라이언트 렌더의
  // 순서가 달라 하이드레이션 오류(React #418)가 났다(M09 #1337 6176524870). 서버가 요청마다 만든 shuffleSeed + uid로
  // 결정적으로 섞는다 — 같은 세션 안에서는 서버 · 클라이언트가 같고, 세션마다 순서는 바뀐다.
  const prepared = useMemo(() => {
    if (!item) return null;
    const shuffle = arr => seededShuffle(arr, `${shuffleSeed}:${item.uid}`);
    if (item.options) return { options: shuffle(item.options) };
    if (item.tokens) return { bank: shuffle(item.tokens.map((t, ti) => ({ t, ti }))) };
    if (item.quiz?.tokens) return { bank: shuffle(item.quiz.tokens.map((t, ti) => ({ t, ti }))) };
    if (item.quiz?.distractors) return { options: shuffle([item.quiz.correct, ...item.quiz.distractors.slice(0, 3)]) };
    return {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.uid]);

  // 집계용 분모 — 결과 화면 통계(기존 정의 유지, 산출 포함).
  const gradedTotal = Math.max(0, gradedBase - skipped.size);
  const firstAnswered = Object.keys(firstResults).length;
  const rightCount = Object.values(firstResults).filter(r => r.ok).length;

  const isRetry = !!(item && String(item.uid).endsWith('-r'));

  // ── 진행 표시용 분모(집계용과 분리) — 산출(보너스) 문항 제외, 라이브 생성 중엔 예상 문단 수 선반영 ──
  const RESERVED_PARA = 7; // 라이브 생성 중 문단 예상 문항 수(하드캡). 실제 도착 시 실제 수로 교체.
  const produceInQueue = queue.some(it => it.type === 'produce-writing');
  const produceSkipped = produceInQueue && skipped.has('p-1');
  // 산출 제외 집계 분모(도착 후 사용).
  const nonProduceTotal = Math.max(0, gradedBase - (produceInQueue ? 1 : 0) - (skipped.size - (produceSkipped ? 1 : 0)));
  // 라이브 생성 대기 중엔 gradedBase가 워밍업만이므로 문단 예상분(7)을 선반영해 분모 급락 방지.
  const progressTotal = (liveGen && genStatus === 'loading')
    ? Math.max(0, gradedBase + RESERVED_PARA - skipped.size)
    : nonProduceTotal;
  const progressDone = Object.values(firstResults).filter(r => r.item.type !== 'produce-writing').length;
  const progressPct = progressTotal ? Math.min(100, Math.round((progressDone / progressTotal) * 100)) : 0;

  function baseUid(u) { return String(u).replace(/-r$/, ''); }

  /** 진행 중 이탈 방지 — 첫 답변 이후 && 미완료면 1단계 확인 (답변 전·결과 화면은 바로 나감) */
  function handleExitClick(e) {
    if (finished || firstAnswered === 0) return;
    if (!window.confirm('세션을 나갈까요? 진행은 저장돼 있어요.')) e.preventDefault();
  }

  /** 문항 전환 직후(300ms) 답변 입력 무시 — 계속 버튼 연타 tap-through 방지 */
  function isTapLocked() { return Date.now() - transitionAtRef.current < 300; }

  /** 듣기 문항 건너뛰기 — 채점 없이 다음으로 (집계·SRS 제외) */
  function skipItem() {
    if (!item || phase === 'feedback') return;
    setSkipped(prev => new Set(prev).add(baseUid(item.uid)));
    next();
  }

  /** review_events 마이크로배치 큐 — 세션 계정으로 1회 생성 */
  function getBatcher() {
    const recorder = recorderRef.current;
    // 로그인이 풀렸거나 계정이 바뀌었다 — 보내지 않고 멈춰 둔다(같은 세션 계정이 돌아오면 복귀 효과가 보낸다).
    if (!recorder) return sessionUserRef.current ? heldEventsBox : null;
    if (!batcherRef.current) batcherRef.current = createReviewEventBatcher(recorder, { size: 4 });
    // 탭이 닫힐 때 남은 묶음을 keepalive로 보내려면 토큰을 미리 받아 둬야 한다(pagehide에서는 기다릴 수 없다) — 문법 보류분과 같은 토큰.
    rememberGrammarToken(recorder);
    return batcherRef.current;
  }
  const heldEventsBox = { add: event => { if (event) heldEventsRef.current.push(event); } };

  /**
   * 세션에 등장한 어휘 단어(word_text) 목록 — 산출 문장 포함 판정용.
   * 문항 재료: 어휘 문항(item.word.word_text) + 문단 재료 단어(dueWords/newWords의 .word).
   * item_key를 word_text로 두어야 deriveVocabRungs(source==='vocab' && item_key===word_text)에 잡힌다.
   */
  function collectSessionVocab() {
    const seen = new Set();
    const out = [];
    const push = wt => { if (wt && !seen.has(wt)) { seen.add(wt); out.push(wt); } };
    for (const it of queue) {
      if (it?.word?.word_text) push(it.word.word_text);
      for (const word of it?.words || []) push(word?.word_text);
    }
    for (const w of paragraphMaterials?.dueWords || []) push(w?.word);
    for (const w of paragraphMaterials?.newWords || []) push(w?.word);
    return out;
  }

  /**
   * 재료 단어 팝오버 열기 — 문맥 안 확인 + 어시스트 기록.
   * source='assist'(vocab 아님)이라 rung 유도(source==='vocab' 필터)엔 영향 없이 데이터만 쌓인다.
   * 같은 단어 중복 열람은 세션당 1회만 기록.
   */
  function openAssist(w) {
    setActiveWord(prev => (prev?.word === w.word ? null : w));
    if (!assistSeenRef.current.has(w.word)) {
      assistSeenRef.current.add(w.word);
      getBatcher()?.add({ lang, source: 'assist', item_key: w.word, correct: false, detail: { qtype: 'assist' } });
    }
  }

  /**
   * 오답 해설 페이로드 — 지원 문항(cloze/vocab/comprehension)의 '오답일 때만' 생성.
   * 정답이거나 미지원 문항이면 null → 링크 자체가 노출되지 않는다.
   */
  function buildExplainQuestion() {
    if (!item || phase !== 'feedback' || picked == null) return null;
    if (item.type === 'grammar-cloze') {
      const qz = item.quiz;
      if (!qz || picked === qz.correct) return null;
      return { type: 'cloze', sentence: qz.full || qz.sentence, correct: qz.correct, picked, ko: qz.ko || '' };
    }
    if (item.type === 'vocab-choice') {
      const w = item.word;
      if (!w || picked === w.meaning) return null;
      return { type: 'vocab', sentence: w.word_text, correct: w.meaning, picked, ko: w.meaning };
    }
    if (item.type === 'read-meaning') {
      if (picked === item.correct) return null;
      const ko = item.sentence?.isKoreanPrompt ? item.sentence.main : '';
      return { type: 'comprehension', sentence: item.sentence?.main || '', correct: item.correct, picked, ko };
    }
    return null;
  }

  /**
   * "왜 이게 답이에요?" — 오답 해설 요청. 세션당 3회 캡(카운터), 열람 시 이벤트 1회 기록.
   * 실패·타임아웃은 조용히 'failed'(링크만 사라지고 에러 문구 없음).
   */
  async function openExplain() {
    const eq = buildExplainQuestion();
    if (!eq || explainCountRef.current >= 3) return;
    explainCountRef.current += 1;
    setExplainState('loading');
    getBatcher()?.add({ lang, source: 'assist', item_key: eq.correct, correct: false, detail: { qtype: 'explain' } });
    let text = '';
    try {
      let authHeader = {};
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.access_token) authHeader = { Authorization: `Bearer ${s.access_token}` };
      } catch {}
      const res = await fetch('/api/explain', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ language: langName, question: eq }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.explanation) text = data.explanation;
    } catch {}
    setExplainState(text ? { text } : 'failed');
  }

  /** 문장 텍스트를 재료 단어 기준으로 분절(비-ja 인라인 감싸기용) — 긴 단어 우선 매칭 */
  function segmentSentence(text, words) {
    if (!words || words.length === 0) return [{ t: 'text', s: text }];
    const sorted = [...words].sort((a, b) => b.word.length - a.word.length);
    const segs = [];
    let buf = '', i = 0;
    while (i < text.length) {
      const hit = sorted.find(w => w.word && text.startsWith(w.word, i));
      if (hit) {
        if (buf) { segs.push({ t: 'text', s: buf }); buf = ''; }
        segs.push({ t: 'word', s: hit.word, w: hit });
        i += hit.word.length;
      } else { buf += text[i]; i++; }
    }
    if (buf) segs.push({ t: 'text', s: buf });
    return segs;
  }

  /**
   * 문항 확정 시점 사이드이펙트 (첫 시도만) —
   * F2 progressStore 이벤트·어휘 FSRS 갱신 · 문법 챕터 마지막 문항에서 재스케줄.
   * 중도 이탈해도 여기까지의 기록은 남는다.
   */
  function recordSettle(ok, it, result = null, response = null) {
    if (!it?.effect) return;
    // 문법 챕터 정답 누적은 기록 여부와 무관하게 먼저 센다 — 로그인이 풀린 동안의 문항도 챕터 분모를 채워야
    // 돌아왔을 때 그 챕터가 재스케줄된다.
    const entry = { ok, it, result, response, rtMs: Date.now() - itemShownAtRef.current, chapter: tallyGrammar(ok, it) };
    // 세션 계정이 아니면(로그아웃 · 계정 바뀜) 지금은 쓰지 않는다 — 기기 로컬 · 남의 계정으로 새지 않게.
    // 버리지도 않는다: 같은 세션 계정이 돌아오면 복귀 효과가 writeSettle로 그 계정에 기록한다.
    const recorder = recorderRef.current;
    if (!recorder) { heldSettlesRef.current.push(entry); return; }
    writeSettle(recorder, entry);
  }

  /** 문법 due 문항 정답 누적 — 챕터 마지막 문항이면 그 챕터의 재스케줄 채점({ srs, rating })을 돌려준다. */
  function tallyGrammar(ok, it) {
    if (it.effect.kind !== 'grammar-due') return null;
    const slug = it.effect.srs.slug;
    // 챕터별 정답 누적 → 마지막 문항에서 챕터 정답률로 재스케줄
    const agg = grammarAggRef.current.get(slug) || { srs: it.effect.srs, right: 0, total: 0 };
    agg.total++; if (ok) agg.right++;
    grammarAggRef.current.set(slug, agg);
    if (agg.total < (grammarCounts[slug] || 0)) return null;
    return { srs: agg.srs, rating: ratingFromScore(agg.right, agg.total) };
  }

  /** 확정한 문항을 세션 계정에 기록한다(recordSettle · 복귀 효과 공통). */
  function writeSettle(recorder, { ok, it, result, response, rtMs, chapter }) {
    // 답안 완료 기록은 F2 단일 경계로 보낸다. recorder는 세션 계정뿐이다 — 게스트 · 로그인 풀림은 여기 오지 않는다
    // (게스트는 이 화면 대신 signedOut 안내를 본다).
    // response는 settle의 pickedValue다 — 여기까지 오지 않아 v2-A R1 진단이 유형까지만
    // 볼 수 있었다(글자 어긋남은 응답이 있어야 난다). 오답 적재는 브리지가 판단한다.
    recordStudyReviewCompleted(recorder, {
      correct: ok,
      item: it,
      lang,
      rtMs,
      result,
      response,
    }).then(saved => {
      // 서버에도 큐에도 못 담았을 때만 알린다(큐에 담긴 기록은 연결이 돌아오면 간다). 첫 시도 uid로 — 재출제(-r)에는 띄우지 않는다.
      if (saved?.lost) setLostRecordUid(it.uid);
    }, () => { /* 저장 거절(아는 단어 등)은 기존처럼 조용히 — 세션은 이어진다. */ });

    if (chapter) {
      // 실패하면 보류함에 남는다(같은 챕터는 마지막 채점만) — 결과를 버리면 일정이 조용히 사라진다.
      pendingGrammarRef.current.submit({ ...chapter.srs, user_id: recorder }, chapter.rating)
        .then(saved => { if (!saved) rememberGrammarToken(recorder); }, () => {});
    }
  }

  /** 채점 확정 — 첫 시도만 집계·기록, 오답은 재출제 예약 */
  function settle(ok, pickedValue = null, result = null) {
    if (!item || phase === 'feedback') return;
    if (isTapLocked()) return;
    setPicked(pickedValue);
    setPhase('feedback');
    const orig = baseUid(item.uid);
    const isRetryItem = String(item.uid).endsWith('-r');
    if (!(orig in firstResults)) {
      setFirstResults(prev => ({ ...prev, [orig]: { ok, item } }));
      if (!ok && !requeued.has(orig)) {
        setRequeued(prev => new Set(prev).add(orig));
        setQueue(prev => [...prev, { ...item, uid: `${orig}-r` }]);
      }
    }
    // 재출제(-r)는 기록·SRS 제외. 첫 시도만 1회 — 로그인이 풀렸으면 recordSettle이 버리지 않고 보류한다.
    if (!isRetryItem && !recordedRef.current.has(orig)) {
      recordedRef.current.add(orig);
      recordSettle(ok, item, result, pickedValue);
    }
  }

  function next() {
    transitionAtRef.current = Date.now();
    setPicked(null);
    setTyping('');
    setOrderPicks([]);
    setMatchState({ selectedId: null, matches: {} });
    setProduceState(null);
    setEncounterSaveState(null);
    setPhase('answer');
    if (idx + 1 >= queue.length) {
      // 큐 끝 — 문단이 아직 생성 중이면 종료하지 않고 파킹(도착 시 이어붙음).
      if (genStatus === 'loading') { setIdx(i => i + 1); return; }
      setFinished(true);
      fireEffects();
    } else {
      setIdx(i => i + 1);
    }
  }

  /**
   * 만남 담기(rfc-adaptive-quiz §4.2, 목업 B) — 만남 문항 정답 직후에만 제안되는 [+ 담기].
   * NpcDialog 선례 그대로: user_vocabulary ignoreDuplicates upsert(이미 담긴 단어의 FSRS
   * 상태를 절대 덮지 않음), meaning은 정본 뜻 전문(meaningFull). 실패는 조용히 되돌려
   * 재시도 가능. 자동 담김 금지 — 수집은 명시적 선택.
   */
  async function saveEncounterWord() {
    if (!recorderRef.current || !item?.word?.word_text || encounterSaveState) return;
    setEncounterSaveState('saving');
    try {
      // 세션 단어는 이미 사전 표제어라 surface/base가 갈리지 않는다 — 그래도 조립은
      // 정본으로 보내, 나중에 필드가 늘 때 이 자리만 뒤처지지 않게 한다.
      const { error } = await supabase.from('user_vocabulary').upsert([buildVocabRow({
        userId: recorderRef.current,
        surface: item.word.word_text,
        base: item.word.word_text,
        reading: item.word.furigana,
        meaning: item.word.meaningFull || item.word.meaning,
        pos: item.word.pos,
        language: lang,
      })], VOCAB_UPSERT);
      if (error) throw error;
      setEncounterSaveState('saved');
    } catch {
      setEncounterSaveState(null);
    }
  }

  /**
   * 공동 작가 — ≥2점 문장을 오늘 세션 행의 paragraph.userNext에 병합 저장(새 컬럼 없음, own-row UPDATE RLS).
   * 오늘 세션 행 = 이 유저·언어의 최신 status='used' 행(라이브·프리페치 소비 둘 다 used_at=지금).
   * 내일 문단 프리페치가 이 값을 읽어(deriveArc) 이야기를 이어가므로, 프리페치보다 먼저 커밋돼야 한다
   * — submitProduce가 이 저장을 await한 뒤에야 '계속' 버튼(→finished→프리페치)이 뜬다.
   * @returns {Promise<boolean>} 저장 성공 여부(결과 화면 안내 문구 표시용)
   */
  async function saveUserNext(text, score) {
    const recorder = recorderRef.current;
    if (!recorder) return false;
    try {
      const { data, error: loadError } = await supabase.from('study_paragraphs')
        .select('id, paragraph')
        .eq('user_id', recorder).eq('lang', lang).eq('status', 'used')
        .order('used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).limit(1);
      if (loadError) return false;
      const row = data && data[0];
      if (!row || !row.paragraph) return false;
      const merged = { ...row.paragraph, userNext: { text: String(text).slice(0, 200), score } };
      const { error } = await supabase.from('study_paragraphs').update({ paragraph: merged }).eq('id', row.id);
      return !error;
    } catch { return false; }
  }

  /**
   * 격일 산출 문항 제출 — /api/writing-feedback 경량 모드로 한 문장 채점.
   * targetScore>=2면 correct=true로 review_events에 기록(FSRS·챕터 통과 미반영).
   * API 실패는 집계 제외(skipped)로 우아하게 강등한다.
   */
  async function submitProduce() {
    if (!item || phase === 'feedback') return;
    if (isTapLocked()) return;
    const textVal = typing.trim();
    if (!textVal) return;
    const rt_ms = Date.now() - itemShownAtRef.current;
    const orig = baseUid(item.uid);
    produceDoneRef.current = false;
    setPhase('feedback');
    setProduceState({ status: 'grading' });
    let feedback = null;
    try {
      let authHeader = {};
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.access_token) authHeader = { Authorization: `Bearer ${s.access_token}` };
      } catch {}
      const res = await fetch('/api/writing-feedback', {
        method: 'POST',
        signal: AbortSignal.timeout(12000), // 12초 초과 시 abort → error 경로(skipped 강등)
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          language: lang,
          level: paragraphMaterials?.level,
          text: textVal,
          mode: 'sentence',
          targetPattern: item.targetPattern,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.feedback) feedback = data.feedback;
    } catch {}

    // 사용자가 대기 중 "건너뛰고 마치기"로 이미 진행했으면 늦게 도착한 결과는 무시(이중 처리 방지).
    if (produceDoneRef.current) return;
    produceDoneRef.current = true;

    if (!feedback) {
      // 채점 실패/타임아웃 — 집계 제외 처리
      setSkipped(prev => new Set(prev).add(orig));
      setProduceState({ status: 'error' });
      return;
    }
    const targetScore = typeof feedback.targetScore === 'number' ? feedback.targetScore : null;
    const ok = targetScore != null && targetScore >= 2;
    // review_events 기록 (settle과 동일 소스지만 FSRS·챕터 통과에는 미반영)
    getBatcher()?.add({
      lang, source: 'writing',
      item_key: `${lang}:${String(item.targetPattern?.pattern || '').slice(0, 40)}`,
      correct: ok,
      detail: { qtype: 'produce', score: targetScore, rt_ms },
    });
    // P1 배선 봉합 — 산출을 어휘 rung 사다리 상단(4)에 반영.
    // 제출 문장에 실제로 포함된 세션 어휘 단어별로 vocab/produce 이벤트를 추가 발행해
    // deriveVocabRungs(source==='vocab') 파이프라인에 자연 합류시킨다(위 writing 이벤트는 측정용 유지).
    // FSRS·챕터 통과에는 절대 반영하지 않는다(v2 헌법 M7).
    for (const wt of collectSessionVocab()) {
      if (sentenceIncludesWord(textVal, wt, langCode)) {
        getBatcher()?.add({
          lang, source: 'vocab',
          item_key: wt,
          correct: ok,
          detail: { qtype: 'produce', score: targetScore, rt_ms },
        });
      }
    }
    setFirstResults(prev => ({ ...prev, [orig]: { ok, item } }));
    try { localStorage.setItem(`study_last_produce_${lang}`, ymdLocal(new Date())); } catch {}

    // ── 공동 작가 — ≥2점 && 연재 세션일 때만 오늘 행에 userNext 저장(안전장치 ①≥2점 ②연재 한정). ──
    // 프리페치보다 먼저 커밋되도록 여기서 await한 뒤 done 상태로 전환(그 뒤에야 '계속'→finished→프리페치).
    let reflected = false;
    if (ok && item.serial) {
      reflected = await saveUserNext(textVal, targetScore);
    }
    setProduceReflected(reflected);

    // 세션에서 쓴 문장을 writing_practice에도 남긴다 — 작문(/writing) 히스토리에 노출.
    // WritingStudioPage.persist(:171)와 동일한 컬럼·형태. 세션 흐름은 막지 않되 저장 오류를 기록한다.
    if (recorderRef.current) {
      const allErrors = (feedback.sentences || []).flatMap(
        s => (s.errors || []).map(e => ({ ...e, sentence: s.original }))
      );
      const pat = item.targetPattern?.pattern || '';
      void persistWritingPractice({
        user_id: recorderRef.current,
        sentence: textVal,
        corrected: feedback.sentences.map(s => s.corrected).join('\n'),
        feedback: feedback.summary,
        score: feedback.score,
        language: lang,
        prompt_type: 'produce',
        prompt: pat ? `이야기 이어쓰기 — ${pat}` : null,
        level: paragraphMaterials?.level || null,
        errors: allErrors,
      });
    }

    setProduceState({ status: 'done', feedback, targetScore });
  }

  /** 산출 채점 대기 중 건너뛰기 — 해당 문항 skipped 처리 후 진행(늦게 온 fetch는 무시됨) */
  function skipProduceGrading() {
    if (!item) return;
    produceDoneRef.current = true;
    setSkipped(prev => new Set(prev).add(baseUid(item.uid)));
    next();
  }

  /** 보류한 문법 재스케줄 재시도 — 세션 계정의 채점만 보낸다(오프라인이면 보류함이 횟수를 쓰지 않고 기다린다). */
  function retryPendingGrammar() {
    const owner = recorderRef.current;
    if (!owner) return Promise.resolve();
    return pendingGrammarRef.current.retry(row => row.user_id === owner).catch(() => {});
  }

  /** keepalive용 토큰을 미리 받아 둔다 — pagehide에서는 기다릴 수 없다. 세션 계정의 토큰일 때만(정본 sessionTokenFor). */
  function rememberGrammarToken(owner) {
    sessionTokenFor(owner).then((token) => {
      if (token && recorderRef.current === owner) grammarTokenRef.current = { userId: owner, token };
    }, () => {});
  }

  /** 페이지가 닫힐 때 남은 이벤트 묶음을 keepalive로(경계 확인이 필요한 어휘 행 · 토큰 없음은 보통 전송). 세션 계정 몫만. */
  function beaconPendingEvents(owner) {
    const events = batcherRef.current?.drain() || [];
    if (!events.length) return;
    const held = grammarTokenRef.current;
    // 만료됐거나 곧 만료될 토큰이면 keepalive가 401로 조용히 사라진다 — 보통 전송으로 돌린다.
    sendReviewEventsOnHide(owner, events, { accessToken: held?.userId === owner && keepaliveTokenUsable(held.token) ? held.token : null });
  }

  /** 페이지가 닫힐 때 문법 보류분을 keepalive로 — 토큰이 없으면 보통 재시도로. 둘 다 세션 계정 몫만. */
  function beaconPendingGrammar(owner) {
    const held = grammarTokenRef.current;
    if (held?.userId !== owner || !keepaliveTokenUsable(held.token)) { retryPendingGrammar(); return; }
    pendingGrammarRef.current.beacon(row => row.user_id === owner,
      (row, rating, { reviewedAt }) => sendGrammarGradeKeepalive(row, rating, { reviewedAt, accessToken: held.token }))
      .catch(() => {});
  }

  /**
   * 세션 종료 사이드이펙트 — 1회.
   * 문항별 기록(이벤트·어휘 FSRS·문법 재스케줄)은 settle 시점에 이미 처리됐고,
   * 여기선 세션 전체로만 판정 가능한 것들만 남긴다:
   *  신규 챕터 통과 판정 · 새 단어 자동 등록 · 잔여 이벤트 flush · 활동 기록.
   */
  function fireEffects() {
    const recorder = recorderRef.current;
    if (effectsFired.current) return;
    // 로그인이 풀린 채 끝났다 — 버리지 않고 같은 세션 계정이 돌아오면 복귀 효과가 한 번 다시 부른다.
    if (!recorder) { effectsHeldRef.current = true; return; }
    effectsFired.current = true;
    const results = Object.values(firstResults);

    // 신규 챕터 → 통과 판정 (progressStore로 일괄 처리)
    const newItems = results.filter(r => r.item.effect?.kind === 'new-chapter');
    if (newItems.length > 0) {
      const meta = newItems[0].item.effect.meta;
      const right = newItems.filter(r => r.ok).length;
      const passedNow = isChapterPassed(right, newItems.length);
      const checkResult = { right, total: newItems.length, passed: passedNow, at: Date.now() };

      // 기기 진도 기록 — 세션 계정의 키에(LOCAL-PROGRESS-ACCOUNT-001 · lib/refReadStore)
      setRefCheck(readKey, recorder, meta.slug, checkResult);
      addRefRead(readKey, recorder, meta.slug);

      // progressStore: 진도 + SRS + 보상 일괄 처리
      recordLessonCompleted(recorder, {
        lang,
        slug: meta.slug,
        source: 'lesson',
      }, { checkResult });
    }

    // 오늘 배운 새 단어 → progressStore로 통합 (FSRS 복습 루프 진입)
    if (genStatus === 'ready' && paragraphMaterials?.newWords?.length) {
      for (const w of paragraphMaterials.newWords) {
        recordNewWord(recorder, {
          word: w.word,
          pron: w.pron || '',
          meaning: w.meaning || '',
          language: lang,
          source_ref: '오늘 학습',
        });
      }
    }

    // 잔여 이벤트 flush (마지막 마이크로배치) · 보류한 문법 재스케줄 재시도
    batcherRef.current?.flush();
    retryPendingGrammar();
    // recordActivity는 progressStore 내부에서 처리됨
    fetchProfile?.(recorder);
  }

  const renderMain = (text, pron) =>
    langCode === 'ja'
      ? <JaText ja={text} yomi={pron} />
      : <>{text}{pron && <span className="fr-check__pron"> {pron}</span>}</>;

  // 재료 단어 팝오버 — 단어·발음·뜻 (라벨 없이 값만)
  const wordPop = (w) => (
    <span className="study-wordpop" onClick={e => e.stopPropagation()}>
      <span lang={langCode} style={{ fontWeight: 700 }}>
        {w.word}{w.pron ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> {w.pron}</span> : null}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{w.meaning}</span>
    </span>
  );

  // ── 비로그인 ──
  if (signedOut) {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>오늘 학습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          로그인하면 어휘·문법·독해가 섞인 맞춤 세션으로 매일 이어서 학습할 수 있어요.
        </p>
        <Link href={signInHref} className="btn btn--primary btn--md">로그인 →</Link>
        <p style={{ marginTop: 14 }}>
          <Link href="/lessons" className="study-textlink">로그인 없이 교재 둘러보기 →</Link>
        </p>
      </div>
    );
  }

  // ── 워밍업을 다 풀었는데 아직 문단 생성 중 — 그때만 짧은 대기 화면 ──
  if (parking) {
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 20px' }}>
          <Link href="/home" prefetch={false} aria-label="나가기" onClick={handleExitClick} style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '6px 10px', margin: '-6px -10px' }}>✕</Link>
        </div>
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>문단 마무리 중…</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {parkingLong ? '조금만 더 기다려 주세요…' : '오늘의 이야기를 거의 다 엮었어요'}
          </p>
        </div>
      </div>
    );
  }

  // ── 세션 재료 부족 (생성 대기 중이 아닐 때만) ──
  if (gradedBase === 0 && genStatus !== 'loading') {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>{langName} 학습</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          아직 세션을 만들 재료가 부족해요. 교재를 한 챕터 읽거나 단어를 몇 개 모으면 시작할 수 있어요.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/lessons" className="btn btn--primary btn--md">교재 보기 →</Link>
          <Link href="/materials" className="btn btn--ghost btn--md">자료 읽기 →</Link>
        </div>
      </div>
    );
  }

  // 문법 일정 포기 한 줄 — 알림 영역은 늘 그려 두고 내용만 바꾼다(내용과 함께 생기는 role=status는 화면 낭독기가 놓칠 수 있다).
  // 진행 · 결과 화면 루트의 같은 자리(첫 자식)에 두어 화면이 바뀌어도 같은 영역이 이어진다.
  const grammarNotice = (
    <div role="status" aria-live="polite">
      {grammarGaveUp && <p className="study-record-lost">{GRAMMAR_NOT_SAVED}</p>}
    </div>
  );

  // 로그인이 풀렸거나 다른 계정이 됐다 — 기록은 멈췄다. 세션 화면 · 결과 화면 맨 위에 안내(copy-standard 「로그인 필요」).
  const authBanner = authLost && (
    <div className="study-auth-lost" role="alert">
      <span>로그인이 필요해요</span>
      <Link href={signInHref} className="btn btn--primary btn--sm">로그인</Link>
    </div>
  );

  // ── 결과 화면 ──
  if (finished) {
    const newItems = Object.values(firstResults).filter(r => r.item.effect?.kind === 'new-chapter');
    const newMeta = newItems[0]?.item.effect.meta || session?.newChapter;
    const newRight = newItems.filter(r => r.ok).length;
    const chapterPassed = newItems.length > 0 && isChapterPassed(newRight, newItems.length);
    const wrong = Object.values(firstResults).filter(r => !r.ok);
    const pct = gradedTotal ? Math.round((rightCount / gradedTotal) * 100) : 0;
    const newWordCount = genStatus === 'ready' ? (paragraphMaterials?.newWords?.length || 0) : 0;

    // 프라이밍 — [알림 받기]: 권한 요청 → 구독. 성공 시 옵트인 계측 + 「내일 만나요」.
    const acceptPush = async () => {
      if (pushBusy || !user?.id) return;
      setPushBusy(true);
      try {
        const ok = await subscribePush(user.id, lang);
        if (ok) {
          logReviewEvents(user.id, [{ lang, source: 'ui', item_key: '-', correct: true, detail: { qtype: 'push_optin' } }]);
          setPushPrime('done');
        } else {
          // 거부·실패 → 조용히 숨김(권한이 default가 아니게 되면 자연히 재노출 안 됨)
          setPushPrime(null);
        }
      } finally {
        setPushBusy(false);
      }
    };
    // [나중에]: 30일 침묵
    const laterPush = () => {
      try { localStorage.setItem('pushPrimeDismissed', String(Date.now())); } catch {}
      setPushPrime(null);
    };

    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        {grammarNotice}
        {authBanner}
        {/* 1. 요약 */}
        <div style={{ textAlign: 'center', margin: '28px 0 20px' }}>
          <div style={{
            width: 92, height: 92, borderRadius: '50%', margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `6px solid ${pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'}`,
            fontSize: '1.5rem', fontWeight: 700,
          }}>{pct}%</div>
          <h1 ref={resultHeadingRef} tabIndex={-1} style={{ fontSize: '1.3rem', fontWeight: 700 }}>세션 완료</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 6, fontWeight: 700 }}>
            강해진 기억 {rightCount} · 곧 다시 만날 {wrong.length}
            {skipped.size > 0 && ` · 건너뜀 ${skipped.size}`}
          </p>
          {paragraphMaterials?.weekly && weeklyStats && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
              이번 주: 세션을 포함해 문항 {weeklyStats.n}개, 강해진 기억 {weeklyStats.m}개
            </p>
          )}
        </div>

        {/* 2. 새 챕터 */}
        {/* 옛 교재 챕터는 보관함으로 옮겨져 열 수 없다 — 링크 없는 요약 카드(VIEWER-R0-BUGS-001 버그 3).
            프리페치로 저장된 문단 재료에는 옛 주소가 남아 있을 수 있어 화면에서도 관문을 지난다. */}
        {newMeta && newItems.length > 0 && (() => {
          const href = learnerHref(newMeta.href);
          const Card = href ? Link : 'div';
          return (
            <Card {...(href ? { href } : {})} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 12 }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>
                  {chapterPassed ? '새 챕터 통과!' : '새 챕터 — 다음 세션에서 다시'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {newMeta.level} #{newMeta.order} {newMeta.title} · {newRight}/{newItems.length}
                </span>
              </span>
              {href && <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>}
            </Card>
          );
        })()}

        {/* 3. 다시 볼 것 */}
        {wrong.length > 0 && (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>다시 볼 것 {wrong.length}개</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {wrong.map((r, i) => (
                <li key={i} style={{ fontSize: '0.85rem', lineHeight: 1.6 }} lang={langCode}>
                  {r.item.word ? `${r.item.word.word_text} — ${r.item.word.meaning}`
                    : r.item.words ? `어휘 매칭 — ${r.item.words.map(word => word.word_text).join(' · ')}`
                    : r.item.type === 'produce-writing' ? `작문 — ${r.item.targetPattern?.pattern || ''}`
                    : r.item.quiz ? (r.item.quiz.full || r.item.quiz.answer)
                    : r.item.sentence?.main}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 4. 이어가기 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <a href={`/study?lang=${lang}`} className="btn btn--primary btn--md" style={{ flex: 1.4, textAlign: 'center' }}>한 세션 더 →</a>
          <Link href="/lessons" className="btn btn--ghost btn--md" style={{ flex: 1, textAlign: 'center' }}>교재로</Link>
        </div>
        <p style={{ textAlign: 'center', marginBottom: 14 }}>
          <Link href={`/study/library?lang=${lang}`} className="study-textlink">지난 이야기 다시 읽기 →</Link>
        </p>

        {/* 5. 내일 */}
        {(newWordCount > 0 || nextPreview || produceReflected) && (
          <div style={{ textAlign: 'center' }}>
            {produceReflected && (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-text)', margin: (newWordCount > 0 || nextPreview) ? '0 0 6px' : 0, fontWeight: 700, lineHeight: 1.6 }}>
                당신이 정한 전개로 내일 이야기가 이어져요.
              </p>
            )}
            {newWordCount > 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: nextPreview ? '0 0 6px' : 0, lineHeight: 1.6 }}>
                새 단어 {newWordCount}개를 앞으로 만나게 돼요
              </p>
            )}
            {nextPreview && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                내일 이야기 살짝 보기: {nextPreview}…
              </p>
            )}
          </div>
        )}

        {/* 5-b. 푸시 프라이밍 — 내일 예고 아래. 가치 먼저 권한 나중(원칙 3). */}
        {pushPrime === 'show' && (
          <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.6 }}>
              내일 이야기가 도착하면 알려드릴까요?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button size="sm" onClick={acceptPush} disabled={pushBusy}>
                {pushBusy ? '설정 중…' : '알림 받기'}
              </Button>
              <Button size="sm" variant="ghost" onClick={laterPush} disabled={pushBusy}>나중에</Button>
            </div>
          </div>
        )}
        {pushPrime === 'done' && (
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: '0.85rem', color: 'var(--accent-text)', fontWeight: 700 }}>
            내일 만나요.
          </p>
        )}
        {pushPrime === 'ios' && (
          <p style={{ textAlign: 'center', marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            iOS에서는 홈 화면에 추가하면 알림을 받을 수 있어요.
          </p>
        )}
      </div>
    );
  }

  // ── 진행 화면 ──
  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      {grammarNotice}
      {authBanner}
      {/* 헤더 — 나가기 · 진행바 · 언어 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 20px' }}>
        <Link href="/home" prefetch={false} aria-label="나가기" onClick={handleExitClick} style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '6px 10px', margin: '-6px -4px -6px -10px' }}>✕</Link>
        <div className="study-progress" role="progressbar" aria-label="세션 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPct}
          aria-valuetext={`${progressDone}/${progressTotal}`}>
          <div className="study-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>
          {isRetry ? '오답 다시 풀기'
            : item.type === 'produce-writing' ? '보너스'
            : `${progressDone}/${progressTotal}`}
        </span>
      </div>

      {/* 오프라인 한 줄 — 알림 영역은 늘 두고 내용만 넣는다(A11Y-SWEEP-001). 보이는 줄은 한 번만 읽히게 aria-hidden. */}
      <span className="sr-only" role="status">{offline ? STUDY_OFFLINE_LINE : ''}</span>
      {offline && <p className="study-offline-line" aria-hidden="true">{STUDY_OFFLINE_LINE}</p>}

      {/* 문항 한 장 — uid마다 새로 그려 짧게 내려앉는다(.study-item, 0.16초 · 모션 축소 시 없음). */}
      <div key={item.uid} ref={itemRef} className="study-item">
      {isRetry && (
        <div style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700, marginBottom: 8 }}>↻ 다시 도전</div>
      )}

      {item.warmup && !isRetry && (
        <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 700, marginBottom: 8 }}>몸풀기</div>
      )}

      {/* ── 오늘의 문단 (읽기 카드) ── */}
      {item.type === 'paragraph' && (
        <div className="card" style={{ padding: '22px 20px' }}>
          <div id={headId} tabIndex={-1} data-item-head="" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)', marginBottom: 14 }}>
            {paragraphMaterials?.weekly ? '이번 주 헷갈린 것들' : '오늘의 문단'}
          </div>
          {item.preQuestion?.q && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 12px', marginBottom: 14,
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--primary)',
            }}>
              <span style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--primary-light)' }}>읽기 미션</strong> — {item.preQuestion.q}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {item.sentences.map((s, i) => {
              const showSentPron = alwaysShowPron || revealedPron.has(i);
              const togglable = !alwaysShowPron && !!s.pron;
              const toggle = () => setRevealedPron(prev => {
                const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
              });
              return (
                <div key={i} style={{ fontSize: '1.05rem', lineHeight: 2 }} lang={langCode}>
                  <span
                    className={togglable ? (showSentPron ? 'study-sent--tap' : 'study-sent--peek') : undefined}
                    onClick={togglable ? toggle : undefined}
                  >
                    {langCode === 'ja'
                      ? renderMain(s.text, showSentPron ? s.pron : null)
                      : <>
                          {segmentSentence(s.text, item.materialWords).map((seg, si) =>
                            seg.t === 'word'
                              ? <span key={si} className="study-word" style={{ position: 'relative' }}
                                  onClick={e => { e.stopPropagation(); openAssist(seg.w); }}>
                                  {seg.s}
                                  {activeWord?.word === seg.w.word && wordPop(activeWord)}
                                </span>
                              : <span key={si}>{seg.s}</span>
                          )}
                          {showSentPron && s.pron && <span className="fr-check__pron"> {s.pron}</span>}
                        </>
                    }
                  </span>
                  <RefSpeak text={s.text} lang={lang} size="xs" />
                </div>
              );
            })}
          </div>
          {/* ja: 루비 정렬을 깨지 않도록 인라인 대신 카드 하단 재료 단어 칩(탭 → 뜻 팝오버) */}
          {langCode === 'ja' && item.materialWords?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {item.materialWords.map(w => (
                <span key={w.word} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button type="button" className="chip" lang={langCode}
                    onClick={e => { e.stopPropagation(); openAssist(w); }}>
                    {w.word}
                  </button>
                  {activeWord?.word === w.word && wordPop(w)}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-expanded={showTranslation}
            onClick={() => setShowTranslation(v => !v)}
            className="study-textlink"
            style={{ marginTop: 14 }}
          >
            {showTranslation ? '번역 접기 ▴' : '번역 보기 ▾'}
          </button>
          {showTranslation && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 8, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              {item.translation}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <Button onClick={next} style={{ flex: 1 }}>문제 풀기 →</Button>
            {learnerHref(item.newChapter?.href) && (
              <Link href={learnerHref(item.newChapter.href)} className="study-textlink" style={{ flexShrink: 0 }}>
                새 문법 자세히
              </Link>
            )}
            {item.newChapter && !learnerHref(item.newChapter.href) && (
              <span className="study-archived-note" style={{ flexShrink: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ARCHIVED_TEXTBOOK_NOTICE}</span>
            )}
          </div>
        </div>
      )}

      {/* ── 티칭 카드 ── */}
      {item.type === 'teach' && (
        <div className="card" style={{ padding: '22px 20px' }}>
          <div id={headId} tabIndex={-1} data-item-head="" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-light)', marginBottom: 10 }}>
            새로 배우기 · {item.chapter.level} #{item.chapter.order} {item.chapter.title}
          </div>
          <div className="fr-pattern" style={{ borderColor: 'var(--primary)' }}>
            <div className="fr-pattern__text" lang={langCode}>{item.pattern}</div>
            {item.patternKo && <div className="fr-pattern__ko">{item.patternKo}</div>}
          </div>
          <ul className="fr-examples" style={{ marginTop: 14 }}>
            {(item.examples || []).map((ex, i) => (
              <li key={i} className="fr-example">
                <div className="fr-example__fr">
                  {renderMain(ex.main, ex.pron)}
                  <RefSpeak text={ex.main} lang={lang} size="xs" />
                </div>
                <div className="fr-example__ko">{ex.ko}</div>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
            <Button onClick={next} style={{ flex: 1 }}>바로 문제로 →</Button>
            {learnerHref(item.chapter.href) ? (
              <Link href={learnerHref(item.chapter.href)} className="study-textlink" style={{ flexShrink: 0 }}>
                교재에서 자세히
              </Link>
            ) : (
              <span className="study-archived-note" style={{ flexShrink: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ARCHIVED_TEXTBOOK_NOTICE}</span>
            )}
          </div>
        </div>
      )}

      {/* ── 어휘: 뜻 고르기 ── */}
      {item.type === 'vocab-choice' && (
        <div className="fr-quiz__q">
          {/* 만남 배지(rfc-adaptive-quiz 목업 A) — 만났지만 담지 않은 말임을 조용히 알린다 */}
          {item.origin === 'encounter' && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              🈁 만난 말 — 월드·읽기에서 마주친 말이에요
            </div>
          )}
          <div className="fr-quiz__prompt" lang={langCode} style={{ fontSize: '1.3rem' }}>
            <span id={headId} tabIndex={-1} data-item-head="">{item.word.word_text}</span>
            <RefSpeak text={item.word.word_text} lang={lang} size="xs" />
          </div>
          {item.word.furigana && (kanjiCare || phase === 'feedback') && (
            <div className="fr-quiz__sub">{item.word.furigana}</div>
          )}
          <div className="fr-quiz__opts fr-quiz__opts--col" role="group" aria-labelledby={headId}>
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === item.word.meaning ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === item.word.meaning, opt)}>
                {opt}
              </button>
            ))}
          </div>
          {/* 보기는 낱말이 드러나지 않게 줄인 꼴(meaningClean choiceMeaning)이다 — 답한 뒤에는 뜻 전문(용례 포함)을 보여 준다. */}
          {phase === 'feedback' && item.word.meaningFull && item.word.meaningFull !== item.word.meaning && (
            <div className="fr-quiz__answer">{item.word.meaningFull}</div>
          )}
        </div>
      )}

      {/* ── 어휘: 단서회상(빈칸) / 타이핑 / 듣기 ── */}
      {(item.type === 'vocab-cloze' || item.type === 'vocab-typing' || item.type === 'vocab-listening') && (
        <div className="fr-quiz__q">
          {item.type === 'vocab-cloze' ? (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>빈칸에 알맞은 단어를 입력하세요</div>
              <div className="fr-quiz__prompt" lang={langCode} id={headId} tabIndex={-1} data-item-head="">
                {(() => {
                  const { parts, term } = splitSentenceAroundWord(item.sentence.main, item.word.word_text, item.word.furigana);
                  const blankLen = Math.max(2, (term || item.word.word_text || '').length);
                  return parts.map((part, i, arr) =>
                    i < arr.length - 1
                      ? <span key={i}>{part}<mark style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: 4, padding: '0 6px', letterSpacing: 2 }}>{'＿'.repeat(blankLen)}</mark></span>
                      : <span key={i}>{part}</span>
                  );
                })()}
              </div>
              <div className="fr-quiz__sub">“{item.word.meaning}”</div>
            </>
          ) : item.type === 'vocab-typing' ? (
            <div className="fr-quiz__prompt" id={headId} tabIndex={-1} data-item-head="">“{item.word.meaning}”</div>
          ) : (
            <div className="fr-quiz__prompt" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span id={headId} tabIndex={-1} data-item-head="">🔊 듣고 입력하세요</span> <RefSpeak text={item.word.word_text} lang={lang} size="sm" />
              {listenFailed && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>재생이 안 되면 ▷</span>}
            </div>
          )}
          <input
            type="text" className="form-input" lang={langCode} value={typing}
            onChange={e => setTyping(e.target.value)} disabled={phase === 'feedback'}
            placeholder={langName + '로 입력'} aria-describedby={headId}
            enterKeyHint="go"
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              // IME 조합 중(일본어·중국어 변환 확정) Enter는 미확정 텍스트로 채점되므로 무시.
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (typing.trim() && phase === 'answer') settle(gradeTyping(typing, item.word), typing);
            }}
            style={{ marginTop: 10, fontSize: '1.05rem' }}
            autoFocus
          />
          {phase === 'answer' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
              <Button onClick={() => settle(gradeTyping(typing, item.word), typing)} disabled={!typing.trim()}>
                확인
              </Button>
              {item.type === 'vocab-listening' && (
                <button type="button" onClick={skipItem} className="study-textlink">
                  넘어가기
                </button>
              )}
            </div>
          )}
          {phase === 'feedback' && (
            <div className="fr-quiz__answer">
              {firstResults[baseUid(item.uid)]?.ok || gradeTyping(typing, item.word) ? '○' : '×'}{' '}
              <span lang={langCode}>{item.word.word_text}</span>
              {item.word.furigana && <span style={{ color: 'var(--text-muted)' }}> ({item.word.furigana})</span>}
              {' — '}{item.word.meaning}
              <RefSpeak text={item.word.word_text} lang={lang} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* ── 공통 연습 엔진: 문법 choice/order + 어휘 match + 예문 order ── */}
      {(['grammar-cloze', 'grammar-order', 'vocab-match', 'example-order'].includes(item.type)) && (
        <ExerciseEnginePrototype
          studyItem={item}
          phase={phase}
          picked={picked}
          prepared={prepared}
          orderPicks={orderPicks}
          onOrderPicksChange={setOrderPicks}
          matchState={matchState}
          onMatchStateChange={setMatchState}
          onAnswer={result => settle(result.correct, result.response, result)}
          isTapLocked={isTapLocked}
          lang={lang}
          langCode={langCode}
          renderMain={renderMain}
          headId={headId}
        />
      )}

      {/* ── 독해: 뜻 고르기 / 내용 이해 ── */}
      {item.type === 'read-meaning' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.sentence.isKoreanPrompt ? '내용 이해' : '독해'}
          </div>
          {item.sentence.isKoreanPrompt ? (
            <div className="fr-quiz__prompt" id={headId} tabIndex={-1} data-item-head="">{item.sentence.main}</div>
          ) : (
            <div className="fr-quiz__prompt" lang={langCode}>
              <span id={headId} tabIndex={-1} data-item-head="">{renderMain(item.sentence.main, (kanjiCare || phase === 'feedback') ? item.sentence.pron : null)}</span>
              <RefSpeak text={item.sentence.main} lang={lang} size="xs" />
            </div>
          )}
          <div className="fr-quiz__opts fr-quiz__opts--col" role="group" aria-labelledby={headId}>
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === item.correct ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === item.correct, opt)}>
                {opt}
              </button>
            ))}
          </div>
          {/* 읽기 미션 클로징 — 문단 파생 내용이해 문항의 피드백에서 목적 고리를 닫는다(1회) */}
          {phase === 'feedback' && item.sentence.isKoreanPrompt && (() => {
            const hint = queue.find(it => it.type === 'paragraph')?.preQuestion?.answerHint;
            return hint ? <div className="fr-quiz__answer" style={{ color: 'var(--text-secondary)' }}>읽기 미션 — {hint}</div> : null;
          })()}
        </div>
      )}

      {/* ── 격일 산출: 이야기를 이어서 한 문장 쓰기 ── */}
      {item.type === 'produce-writing' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.serial ? '이야기의 다음 문장' : '쓰기 한 문장'}
          </div>
          {item.serial ? (
            <>
              <div className="fr-quiz__prompt" id={headId} tabIndex={-1} data-item-head="" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                주인공이 다음에 어떻게 할까요? 이야기의 다음 문장을 <span style={{ fontWeight: 700 }}>{langName}</span>로 한 문장 쓰세요.
              </div>
              {item.context && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>
                  지금까지: {item.context}…
                </p>
              )}
              {item.targetPattern?.pattern && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                  가능하면 <span lang={langCode} style={{ fontWeight: 700 }}>{item.targetPattern.pattern}</span>
                  {item.targetPattern.patternKo && <span> ({item.targetPattern.patternKo})</span>} 표현을 써 보세요.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="fr-quiz__prompt" id={headId} tabIndex={-1} data-item-head="" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                이야기를 이어서 — <span lang={langCode} style={{ fontWeight: 700 }}>{item.targetPattern.pattern}</span>
                {item.targetPattern.patternKo && <span style={{ color: 'var(--text-muted)' }}> ({item.targetPattern.patternKo})</span>}
                을(를) 써서 한 문장
              </div>
              {item.context && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>
                  이야기: {item.context}…
                </p>
              )}
            </>
          )}

          {phase === 'answer' && (
            <>
              <textarea
                className="form-input" lang={langCode} value={typing}
                onChange={e => setTyping(e.target.value.slice(0, 200))}
                placeholder={`${langName}로 1~2문장`}
                rows={2} maxLength={200} autoFocus aria-describedby={headId}
                style={{ marginTop: 12, fontSize: '1.05rem', resize: 'vertical', width: '100%' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                <Button onClick={submitProduce} disabled={!typing.trim()}>제출</Button>
                <button type="button" onClick={skipItem} className="study-textlink">
                  오늘은 패스
                </button>
              </div>
            </>
          )}

          {/* 첨삭(AI — 긴 작업) 알림 — 영역은 늘 두고 내용만, 끝 상태(받지 못함)까지 같은 영역에(LOADING-ANNOUNCE-002). 보이는 줄은 한 번만 읽히게 숨긴다. */}
          <span className="sr-only" role="status">{phase === 'feedback' && produceState?.status === 'grading' ? '첨삭 확인 중…' : phase === 'feedback' && produceState?.status === 'error' ? '첨삭을 받지 못했어요 — 다음에 다시 해 봐요' : ''}</span>
          {phase === 'feedback' && produceState?.status === 'grading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
              <p className="study-produce__pending" aria-hidden="true" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>첨삭 확인 중…</p>
              <button type="button" onClick={skipProduceGrading} className="study-textlink">
                건너뛰고 마치기
              </button>
            </div>
          )}

          {phase === 'feedback' && produceState?.status === 'done' && (() => {
            const ts = produceState.targetScore;
            const badgeColor = ts >= 2 ? 'var(--accent)' : ts === 1 ? 'var(--warning)' : 'var(--danger)';
            const badgeLabel = ts >= 3 ? '완벽해요' : ts === 2 ? '잘 썼어요' : ts === 1 ? '조금 아쉬워요' : '다시 도전해요';
            const s0 = produceState.feedback?.sentences?.[0];
            const why = s0?.errors?.[0]?.why || produceState.feedback?.summary || '';
            return (
              <div style={{ marginTop: 14 }}>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--radius-full)',
                  background: badgeColor, color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                }}>
                  {ts != null ? badgeLabel : '채점'}
                </span>
                {s0?.corrected && (
                  <div className="fr-quiz__answer" style={{ marginTop: 10 }} lang={langCode}>
                    {s0.corrected}
                    <RefSpeak text={s0.corrected} lang={lang} size="xs" />
                  </div>
                )}
                {why && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8 }}>{why}</p>
                )}
                <Link href="/writing" className="study-textlink" style={{ display: 'inline-block', marginTop: 8 }}>
                  작문에서 더 다듬기 →
                </Link>
              </div>
            );
          })()}

          {phase === 'feedback' && produceState?.status === 'error' && (
            <p className="study-produce__error" aria-hidden="true" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 14 }}>
              첨삭을 받지 못했어요 — 다음에 다시 해 봐요
            </p>
          )}

          {phase === 'feedback' && produceState?.status !== 'grading' && (
            <div style={{ marginTop: 16 }}>
              <Button onClick={next} style={{ width: '100%' }}>
                {idx + 1 >= queue.length ? '결과 보기 →' : '계속 →'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 오답 해설 "왜?" — 지원 문항의 오답일 때만, 세션당 3회 캡. 실패 시 조용히 사라짐. */}
      {phase === 'feedback' && buildExplainQuestion() && (
        <div style={{ marginTop: 12 }}>
          {explainState == null && explainCountRef.current < 3 && (
            <button type="button" className="study-textlink" onClick={openExplain}>
              왜 이게 답이에요?
            </button>
          )}
          {explainState === 'loading' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>…</p>
          )}
          {explainState?.text && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {explainState.text}
            </p>
          )}
        </div>
      )}

      {/* 만남 담기 제안(rfc-adaptive-quiz §4.2, 목업 B) — 만남 문항 정답일 때만.
          오답 무제안(압박 없음), 넘어가기는 아래 계속 버튼이 그 역할. */}
      {phase === 'feedback' && item.origin === 'encounter' && user
        && picked === item.word?.meaning && (
        <div style={{ marginTop: 12, fontSize: '0.9rem' }}>
          {encounterSaveState === 'saved' ? (
            <span style={{ color: 'var(--text-muted)' }}>✓ 담은 표현에 있음</span>
          ) : (
            <button type="button" className="study-textlink" disabled={encounterSaveState === 'saving'}
              onClick={saveEncounterWord}>
              {encounterSaveState === 'saving' ? '…' : '+ 담기'}
            </button>
          )}
        </div>
      )}

      {/* 서버에도 기기 큐에도 못 담은 기록 — 그 문항 첫 시도에만 한 줄(세션은 막지 않는다). 재출제(-r)는 uid가 달라 다시 띄우지 않는다.
          알림 영역은 문항마다 먼저 그려 두고 내용만 넣는다 — 내용과 함께 생기는 role=status는 화면 낭독기가 놓칠 수 있다. */}
      <div role="status" aria-live="polite">
        {phase === 'feedback' && lostRecordUid === item.uid && (
          <p className="study-record-lost">이 문항 기록을 저장하지 못했어요. 세션은 계속할 수 있어요.</p>
        )}
      </div>

      {/* 계속 버튼 (산출 문항은 자체 버튼 사용) */}
      {phase === 'feedback' && item.type !== 'produce-writing' && (
        <div style={{ marginTop: 18 }} onKeyDown={ignoreHeldKey}>
          <Button ref={continueRef} onClick={next} style={{ width: '100%' }}>
            {idx + 1 >= queue.length ? '결과 보기 →' : '계속 →'}
          </Button>
        </div>
      )}
      </div>

      {/* 언어 전환 (세션 시작 전 첫 문항에서만) */}
      {idx === 0 && phase === 'answer' && languages.length > 1 && (
        <div className="chip-group" style={{ marginTop: 26, justifyContent: 'center' }}>
          {languages.map(l => (
            l.key === lang
              ? <span key={l.key} className="chip chip--active" aria-current="page">{l.name}</span>
              : <a key={l.key} href={`/study?lang=${l.key}`} className="chip">{l.name}</a>
          ))}
        </div>
      )}
    </div>
  );
}
