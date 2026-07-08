'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '../components/Button';
import RefSpeak from '../components/RefSpeak';
import { useTTS } from '../lib/useTTS';
import { JaText } from './refShared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { calculateFSRS } from '../lib/fsrs';
import { gradeGrammarReview, ratingFromScore, enqueueGrammarReview } from '../lib/grammarSrs';
import { syncCheckRemote, syncReadRemote } from '../lib/refProgress';
import { createReviewEventBatcher } from '../lib/reviewEvents';
import { sentenceIncludesWord } from '../lib/skillRung';
import { recordActivity } from '../lib/streak';
import { gradeTyping, isChapterPassed, qtypeForItem, grammarDueChapterCounts } from '../lib/studySession';
import { mapParagraphToItems } from '../lib/studyParagraph';

/** 로컬 날짜 YYYY-MM-DD — 격일 산출 문항 노출 판정용 */
function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * KST 기준 이번 주 월요일 0시의 UTC ISO — 주간 회고 조회 하한.
 * studyMaterials의 kstWeekStartMs가 export되지 않아 로컬 재구현(근사).
 */
function kstWeekStartIso(nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const dow = kst.getUTCDay();               // 0=일 … 6=토
  const daysFromMon = (dow + 6) % 7;         // 월=0 … 일=6
  const monKstMidnightUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
    - daysFromMon * 24 * 3600 * 1000;        // 'KST 자정을 UTC인 척'한 값
  return new Date(monKstMidnightUtc - 9 * 3600 * 1000).toISOString(); // 실제 UTC 순간으로 보정
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 공부 모드 세션 — 서버가 조립한 ~12문항을 듀오링고식으로 진행한다.
 * 문항당 즉시 피드백, 오답은 세션 끝에 1회 재출제(첫 시도만 SRS·통과에 반영).
 * 종료 시: 어휘 FSRS 갱신 · 문법 due 재스케줄 · 신규 챕터 통과 처리 · 이벤트 적재.
 */
export default function StudySessionPage({
  session = null, paragraphMaterials = null, pregenerated = null, warmup = [], dial = 'normal',
  sourceMode = false,
  lang, langCode, langName, flag, readKey,
  band = 'beginner', languages = [], signedOut = false,
}) {
  // 입문 레벨(N5 등) 일본어 배려 — 답변 중에도 요미가나·후리가나를 보여준다.
  const kanjiCare = band === 'beginner' && langCode === 'ja';
  // 문단 발음 상시 노출은 입문에 한정 — 비입문은 문장 탭으로 지연 공개(한자 읽기 인출 기회 확보).
  const alwaysShowPron = band === 'beginner';
  const { user, fetchProfile } = useAuth();
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
  const [queue, setQueue] = useState(() =>
    usePregen ? pregenMapped.items : liveGen ? warmupItems : (session?.items || [])
  );
  const [gradedBase, setGradedBase] = useState(() =>
    usePregen ? pregenMapped.gradedCount : liveGen ? warmupItems.length : (session?.gradedCount || 0)
  );
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('answer');   // 'answer' | 'feedback'
  const [picked, setPicked] = useState(null);
  const [typing, setTyping] = useState('');
  const [orderPicks, setOrderPicks] = useState([]);
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
  const [produceReflected, setProduceReflected] = useState(false); // 산출 문장이 내일 문단에 반영됨(≥2점·연재 세션)
  const [parkingLong, setParkingLong] = useState(false); // 파킹 대기 8초 경과 여부
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
  const recordedRef = useRef(new Set());           // 이미 기록한 orig uid (중복 방지)
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
      try { sourceText = localStorage.getItem(`study_source_${lang}`) || ''; } catch {}
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
          if (sourceText) { try { localStorage.removeItem(`study_source_${lang}`); } catch {} }
          const mapped = mapParagraphToItems(data.paragraph, paragraphMaterials);
          if (mapped.gradedCount >= 3) {
            // 워밍업 뒤에 문단 문항을 이어붙이고 집계 기준을 갱신
            setQueue(prev => [...prev, ...mapped.items]);
            setGradedBase(prev => prev + mapped.gradedCount);
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
    setQueue(prev => [...prev, ...fb]);
    setGradedBase(prev => prev + fb.filter(i => i.type !== 'teach').length);
    setGenStatus('fallback');
  }

  const item = queue[idx] || null;

  // 문항 표시 시각 기록 — settle까지의 응답 시간(rt_ms) 계산용
  useEffect(() => { itemShownAtRef.current = Date.now(); }, [item?.uid]);

  // 문항 전환 시 팝오버·듣기 실패표시·오답 해설 리셋
  useEffect(() => { setActiveWord(null); setListenFailed(false); setExplainState(null); }, [item?.uid]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, user?.id, lang]);

  // 주간 회고 — weekly 세션 결과 화면에서 1회. review_events 본인 이번 주 count(전체·정답) head 카운트 2회.
  useEffect(() => {
    if (!finished || !paragraphMaterials?.weekly || !user?.id || weeklyRan.current) return;
    weeklyRan.current = true;
    (async () => {
      try {
        const sinceIso = kstWeekStartIso();
        const total = await supabase.from('review_events')
          .select('correct', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('created_at', sinceIso);
        const right = await supabase.from('review_events')
          .select('correct', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('correct', true).gte('created_at', sinceIso);
        if (total.error || right.error) return;
        setWeeklyStats({ n: total.count || 0, m: right.count || 0 });
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

  // ── 탭 닫힘·백그라운드 전환 시 잔여 이벤트 flush + 중도 이탈 스트릭(best-effort) ──
  useEffect(() => {
    function onPageHide() {
      batcherRef.current?.flush();
      // 1문항 이상 답변했고 아직 fireEffects 전이면 활동 기록 시도(스트릭 RPC는 멱등).
      if (!streakSentRef.current && recordedRef.current.size > 0 && user?.id) {
        streakSentRef.current = true;
        recordActivity(user.id, () => fetchProfile?.(user.id));
      }
    }
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 문법 due 챕터별 문항 수 (재출제 제외) — 챕터 마지막 문항 판정에 사용
  const grammarCounts = useMemo(
    () => grammarDueChapterCounts(queue.filter(it => !String(it.uid).endsWith('-r'))),
    [queue]
  );

  // 문항별 셔플 보기·토큰 (uid 기준 1회)
  const prepared = useMemo(() => {
    if (!item) return null;
    if (item.options) return { options: shuffle(item.options) };
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

  /** review_events 마이크로배치 큐 — user 확정 후 1회 생성 */
  function getBatcher() {
    if (!batcherRef.current && user?.id) {
      batcherRef.current = createReviewEventBatcher(user.id, { size: 4 });
    }
    return batcherRef.current;
  }

  /**
   * 세션에 등장한 어휘 단어(word_text) 목록 — 산출 문장 포함 판정용.
   * 문항 재료: 어휘 문항(item.word.word_text) + 문단 재료 단어(dueWords/newWords의 .word).
   * item_key를 word_text로 두어야 deriveVocabRungs(source==='vocab' && item_key===word_text)에 잡힌다.
   */
  function collectSessionVocab() {
    const seen = new Set();
    const out = [];
    const push = wt => { if (wt && !seen.has(wt)) { seen.add(wt); out.push(wt); } };
    for (const it of queue) if (it?.word?.word_text) push(it.word.word_text);
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
   * 이벤트 즉시 적재(마이크로배치) · 어휘 FSRS 갱신 · 문법 챕터 마지막 문항에서 재스케줄.
   * 중도 이탈해도 여기까지의 기록은 남는다.
   */
  function recordSettle(ok, it) {
    if (!user?.id || !it?.effect) return;
    const batcher = getBatcher();
    const rt_ms = Date.now() - itemShownAtRef.current;
    const qtype = qtypeForItem(it.type);
    const eff = it.effect;

    if (eff.kind === 'vocab') {
      const w = it.word;
      const nextStats = calculateFSRS(ok ? 3 : 1, {
        interval: w.interval ?? 0, ease_factor: w.ease_factor ?? 0,
        repetitions: w.repetitions ?? 0, next_review_at: w.next_review_at,
      });
      supabase.from('user_vocabulary')
        .update({ ...nextStats, last_reviewed_at: new Date().toISOString() })
        .eq('id', w.id).then(() => {}, () => {});
      batcher?.add({ lang, source: 'vocab', item_key: w.word_text, correct: ok, detail: { word_id: w.id, meaning: w.meaning, mode: 'study', qtype, rt_ms } });
    } else if (eff.kind === 'grammar-due') {
      const slug = eff.srs.slug;
      batcher?.add({ lang, source: 'grammar', item_key: slug, correct: ok, detail: { ko: it.quiz?.ko, mode: 'study', qtype, rt_ms } });
      // 챕터별 정답 누적 → 마지막 문항에서 챕터 정답률로 재스케줄
      const agg = grammarAggRef.current.get(slug) || { srs: eff.srs, right: 0, total: 0 };
      agg.total++; if (ok) agg.right++;
      grammarAggRef.current.set(slug, agg);
      if (agg.total >= (grammarCounts[slug] || 0)) {
        gradeGrammarReview({ ...agg.srs, user_id: user.id }, ratingFromScore(agg.right, agg.total));
      }
    } else if (eff.kind === 'new-chapter') {
      // 통과 판정은 세션 말미(fireEffects)에서 — 여기선 이벤트만 즉시 적재
      batcher?.add({ lang, source: 'grammar', item_key: eff.meta.slug, correct: ok, detail: { ko: it.quiz?.ko, mode: 'study', qtype, rt_ms } });
    } else if (eff.kind === 'reading') {
      batcher?.add({ lang, source: 'reading', item_key: String(eff.key).slice(0, 80), correct: ok, detail: { mode: 'study', qtype, rt_ms } });
    } else if (eff.kind === 'warmup') {
      // 비예정 조기 복습 — FSRS(user_vocabulary) 갱신 없이 이벤트만 적재.
      // source:'vocab'이라 rung 계산에도 흡수된다(qtype 'choice'로 반영 — 의도된 설계).
      batcher?.add({ lang, source: 'vocab', item_key: eff.key, correct: ok, detail: { qtype: 'choice', warmup: true, rt_ms, mode: 'study' } });
    }
  }

  /** 채점 확정 — 첫 시도만 집계·기록, 오답은 재출제 예약 */
  function settle(ok, pickedValue = null) {
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
    // 재출제(-r)는 기록·SRS 제외. 첫 시도만 1회 기록.
    if (!isRetryItem && !recordedRef.current.has(orig)) {
      recordedRef.current.add(orig);
      recordSettle(ok, item);
    }
  }

  function next() {
    transitionAtRef.current = Date.now();
    setPicked(null);
    setTyping('');
    setOrderPicks([]);
    setProduceState(null);
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
   * 공동 작가 — ≥2점 문장을 오늘 세션 행의 paragraph.userNext에 병합 저장(새 컬럼 없음, own-row UPDATE RLS).
   * 오늘 세션 행 = 이 유저·언어의 최신 status='used' 행(라이브·프리페치 소비 둘 다 used_at=지금).
   * 내일 문단 프리페치가 이 값을 읽어(deriveArc) 이야기를 이어가므로, 프리페치보다 먼저 커밋돼야 한다
   * — submitProduce가 이 저장을 await한 뒤에야 '계속' 버튼(→finished→프리페치)이 뜬다.
   * @returns {Promise<boolean>} 저장 성공 여부(결과 화면 안내 문구 표시용)
   */
  async function saveUserNext(text, score) {
    if (!user?.id) return false;
    try {
      const { data } = await supabase.from('study_paragraphs')
        .select('id, paragraph')
        .eq('user_id', user.id).eq('lang', lang).eq('status', 'used')
        .order('used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).limit(1);
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

    // 세션에서 쓴 문장을 작문 기록실(writing_practice)에도 남긴다 — /writing 히스토리에 노출.
    // WritingStudioPage.persist(:171)와 동일한 컬럼·형태. fire-and-forget이라 실패해도 세션 흐름 무영향.
    if (user?.id) {
      const allErrors = (feedback.sentences || []).flatMap(
        s => (s.errors || []).map(e => ({ ...e, sentence: s.original }))
      );
      const pat = item.targetPattern?.pattern || '';
      supabase.from('writing_practice').insert({
        user_id: user.id,
        sentence: textVal,
        corrected: feedback.sentences.map(s => s.corrected).join('\n'),
        feedback: feedback.summary,
        score: feedback.score,
        language: lang,
        prompt_type: 'produce',
        prompt: pat ? `이야기 이어쓰기 — ${pat}` : null,
        level: paragraphMaterials?.level || null,
        errors: allErrors,
      }).then(() => {}, () => {});
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

  /**
   * 세션 종료 사이드이펙트 — 1회.
   * 문항별 기록(이벤트·어휘 FSRS·문법 재스케줄)은 settle 시점에 이미 처리됐고,
   * 여기선 세션 전체로만 판정 가능한 것들만 남긴다:
   *  신규 챕터 통과 판정 · 새 단어 자동 등록 · 잔여 이벤트 flush · 활동 기록.
   */
  function fireEffects() {
    if (effectsFired.current || !user?.id) return;
    effectsFired.current = true;
    const results = Object.values(firstResults);

    // 신규 챕터 → 통과 판정 (통과 시 교재 진도·복습 큐에 연결)
    const newItems = results.filter(r => r.item.effect?.kind === 'new-chapter');
    if (newItems.length > 0) {
      const meta = newItems[0].item.effect.meta;
      const right = newItems.filter(r => r.ok).length;
      const passedNow = isChapterPassed(right, newItems.length);
      const checkResult = { right, total: newItems.length, passed: passedNow, at: Date.now() };
      try {
        const map = JSON.parse(localStorage.getItem(`${readKey}_check`) || '{}');
        map[meta.slug] = checkResult;
        localStorage.setItem(`${readKey}_check`, JSON.stringify(map));
        const reads = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'));
        reads.add(meta.slug);
        localStorage.setItem(readKey, JSON.stringify([...reads]));
      } catch {}
      syncReadRemote(user.id, lang, meta.slug);
      syncCheckRemote(user.id, lang, meta.slug, checkResult);
      if (passedNow) enqueueGrammarReview(user.id, lang, meta.slug);
    }

    // 오늘 배운 새 단어 → 단어장 등록 (FSRS 복습 루프 진입)
    if (genStatus === 'ready' && paragraphMaterials?.newWords?.length) {
      for (const w of paragraphMaterials.newWords) {
        const row = {
          user_id: user.id,
          word_text: w.word,
          base_form: w.word,
          furigana: w.pron || '',
          meaning: w.meaning,
          pos: '',
          language: lang,
          source_ref: '오늘 학습',
        };
        supabase.from('user_vocabulary').insert(row).then(({ error: err }) => {
          if (err && /column|schema/i.test(err.message || '')) {
            const { source_ref, base_form, ...base } = row;
            supabase.from('user_vocabulary').insert(base).then(() => {}, () => {});
          }
        }, () => {});
      }
    }

    // 잔여 이벤트 flush (마지막 마이크로배치)
    batcherRef.current?.flush();
    recordActivity(user.id, () => fetchProfile?.(user.id));
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
        <Link href="/auth" className="btn btn--primary btn--md">로그인 →</Link>
      </div>
    );
  }

  // ── 워밍업을 다 풀었는데 아직 문단 생성 중 — 그때만 짧은 대기 화면 ──
  if (parking) {
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 20px' }}>
          <Link href="/home" aria-label="나가기" onClick={handleExitClick} style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '6px 10px', margin: '-6px -10px' }}>✕</Link>
        </div>
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }} aria-hidden="true">✍️</div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8 }}>문단 마무리 중…</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {parkingLong ? '조금만 더 기다려주세요…' : '오늘의 이야기를 거의 다 엮었어요'}
          </p>
        </div>
      </div>
    );
  }

  // ── 세션 재료 부족 (생성 대기 중이 아닐 때만) ──
  if (gradedBase === 0 && genStatus !== 'loading') {
    return (
      <div className="page-container" style={{ maxWidth: 640, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 10 }}>{flag} {langName} 학습</h1>
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

  // ── 결과 화면 ──
  if (finished) {
    const newItems = Object.values(firstResults).filter(r => r.item.effect?.kind === 'new-chapter');
    const newMeta = newItems[0]?.item.effect.meta || session?.newChapter;
    const newRight = newItems.filter(r => r.ok).length;
    const chapterPassed = newItems.length > 0 && isChapterPassed(newRight, newItems.length);
    const wrong = Object.values(firstResults).filter(r => !r.ok);
    const pct = gradedTotal ? Math.round((rightCount / gradedTotal) * 100) : 0;
    const newWordCount = genStatus === 'ready' ? (paragraphMaterials?.newWords?.length || 0) : 0;
    return (
      <div className="page-container" style={{ maxWidth: 640 }}>
        {/* 1. 요약 */}
        <div style={{ textAlign: 'center', margin: '28px 0 20px' }}>
          <div style={{
            width: 92, height: 92, borderRadius: '50%', margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `6px solid ${pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'}`,
            fontSize: '1.5rem', fontWeight: 700,
          }}>{pct}%</div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>세션 완료</h1>
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
        {newMeta && newItems.length > 0 && (
          <Link href={newMeta.href} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 12 }}>
            {chapterPassed && <span style={{ fontSize: '1.3rem' }} aria-hidden="true">🎉</span>}
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600 }}>
                {chapterPassed ? '새 챕터 통과!' : '새 챕터 — 다음 세션에서 다시'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {newMeta.level} #{newMeta.order} {newMeta.title} · {newRight}/{newItems.length}
              </span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>
          </Link>
        )}

        {/* 3. 다시 볼 것 */}
        {wrong.length > 0 && (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>다시 볼 것 {wrong.length}개</div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {wrong.map((r, i) => (
                <li key={i} style={{ fontSize: '0.85rem', lineHeight: 1.6 }} lang={langCode}>
                  {r.item.word ? `${r.item.word.word_text} — ${r.item.word.meaning}`
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
              <p style={{ fontSize: '0.8rem', color: 'var(--accent)', margin: (newWordCount > 0 || nextPreview) ? '0 0 6px' : 0, fontWeight: 700, lineHeight: 1.6 }}>
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
      </div>
    );
  }

  // ── 진행 화면 ──
  const q = item?.quiz;

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      {/* 헤더 — 나가기 · 진행바 · 언어 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 20px' }}>
        <Link href="/home" aria-label="나가기" onClick={handleExitClick} style={{ color: 'var(--text-muted)', fontSize: '1.1rem', padding: '6px 10px', margin: '-6px -4px -6px -10px' }}>✕</Link>
        <div style={{ flex: 1, height: 10, borderRadius: 'var(--radius-full)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)',
            width: `${progressPct}%`, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, flexShrink: 0 }}>
          {isRetry ? '오답 다시 풀기'
            : item.type === 'produce-writing' ? `${flag} 보너스`
            : `${flag} ${progressDone}/${progressTotal}`}
        </span>
      </div>

      {isRetry && (
        <div style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700, marginBottom: 8 }}>↻ 다시 도전</div>
      )}

      {item.warmup && !isRetry && (
        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 8 }}>몸풀기</div>
      )}

      {/* ── 오늘의 문단 (읽기 카드) ── */}
      {item.type === 'paragraph' && (
        <div className="card" style={{ padding: '22px 20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 14 }}>
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
                <strong style={{ color: 'var(--primary)' }}>읽기 미션</strong> — {item.preQuestion.q}
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
            {item.newChapter && (
              <Link href={item.newChapter.href} className="study-textlink" style={{ flexShrink: 0 }}>
                새 문법 자세히
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── 티칭 카드 ── */}
      {item.type === 'teach' && (
        <div className="card" style={{ padding: '22px 20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
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
            <Link href={item.chapter.href} className="study-textlink" style={{ flexShrink: 0 }}>
              교재에서 자세히
            </Link>
          </div>
        </div>
      )}

      {/* ── 어휘: 뜻 고르기 ── */}
      {item.type === 'vocab-choice' && (
        <div className="fr-quiz__q">
          <div className="fr-quiz__prompt" lang={langCode} style={{ fontSize: '1.3rem' }}>
            {item.word.word_text}
            <RefSpeak text={item.word.word_text} lang={lang} size="xs" />
          </div>
          {item.word.furigana && (kanjiCare || phase === 'feedback') && (
            <div className="fr-quiz__sub">{item.word.furigana}</div>
          )}
          <div className="fr-quiz__opts fr-quiz__opts--col">
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === item.word.meaning ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === item.word.meaning, opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 어휘: 타이핑 / 듣기 ── */}
      {(item.type === 'vocab-typing' || item.type === 'vocab-listening') && (
        <div className="fr-quiz__q">
          {item.type === 'vocab-typing' ? (
            <div className="fr-quiz__prompt">“{item.word.meaning}”</div>
          ) : (
            <div className="fr-quiz__prompt" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              🔊 듣고 입력하세요 <RefSpeak text={item.word.word_text} lang={lang} size="sm" />
              {listenFailed && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>재생이 안 되면 ▷</span>}
            </div>
          )}
          <input
            type="text" className="form-input" lang={langCode} value={typing}
            onChange={e => setTyping(e.target.value)} disabled={phase === 'feedback'}
            placeholder={langName + '로 입력'}
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

      {/* ── 문법: 빈칸 ── */}
      {item.type === 'grammar-cloze' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.effect.kind === 'grammar-due' ? '복습' : '새 패턴'} · {item.chapter.title}
          </div>
          <div className="fr-quiz__prompt" lang={langCode}>{q.sentence}</div>
          <div className="fr-quiz__sub">“{q.ko}”</div>
          <div className="fr-quiz__opts fr-quiz__opts--grid">
            {prepared.options.map(opt => (
              <button key={opt} type="button" disabled={phase === 'feedback'}
                className={`fr-quiz__opt ${phase === 'feedback' ? (opt === q.correct ? 'is-correct' : opt === picked ? 'is-wrong' : 'is-locked') : ''}`}
                onClick={() => settle(opt === q.correct, opt)} lang={langCode}>
                {opt}
              </button>
            ))}
          </div>
          {phase === 'feedback' && (
            <div className="fr-quiz__answer">
              <span lang={langCode}>{renderMain(q.full, q.pron)}</span>
              <RefSpeak text={q.full} lang={lang} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* ── 문법: 어순 배열 ── */}
      {item.type === 'grammar-order' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.effect.kind === 'grammar-due' ? '복습' : '새 패턴'} · {item.chapter.title}
          </div>
          <div className="fr-quiz__prompt">“{q.ko}”</div>
          <div className={`fr-quiz__line ${phase === 'feedback' ? (firstResults[baseUid(item.uid)]?.ok || orderPicks.map(bi => prepared.bank[bi].t).join(' ') === q.tokens.join(' ') ? 'is-correct' : 'is-wrong') : ''}`}>
            {orderPicks.map((bi, pos) => (
              <button key={pos} type="button" className="fr-quiz__token is-picked" disabled={phase === 'feedback'}
                onClick={() => setOrderPicks(prev => prev.filter((_, i2) => i2 !== pos))} lang={langCode}>
                {prepared.bank[bi].t}
              </button>
            ))}
            {orderPicks.length === 0 && <span className="fr-quiz__line-hint">단어를 순서대로 탭하세요</span>}
          </div>
          {phase === 'answer' && (
            <div className="fr-quiz__tokens">
              {prepared.bank.map((tok, bi) => (
                orderPicks.includes(bi) ? null : (
                  <button key={bi} type="button" className="fr-quiz__token" lang={langCode}
                    onClick={() => {
                      if (isTapLocked()) return;
                      const nextPicks = [...orderPicks, bi];
                      setOrderPicks(nextPicks);
                      if (nextPicks.length === q.tokens.length) {
                        const built = nextPicks.map(b => prepared.bank[b].t).join(' ');
                        settle(built === q.tokens.join(' '), built);
                      }
                    }}>
                    {tok.t}
                  </button>
                )
              ))}
            </div>
          )}
          {phase === 'feedback' && (
            <div className="fr-quiz__answer">
              <span lang={langCode}>{renderMain(q.answer, q.pron)}</span>
              <RefSpeak text={q.answer} lang={lang} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* ── 독해: 뜻 고르기 / 내용 이해 ── */}
      {item.type === 'read-meaning' && (
        <div className="fr-quiz__q">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {item.sentence.isKoreanPrompt ? '내용 이해' : '독해'}
          </div>
          {item.sentence.isKoreanPrompt ? (
            <div className="fr-quiz__prompt">{item.sentence.main}</div>
          ) : (
            <div className="fr-quiz__prompt" lang={langCode}>
              {renderMain(item.sentence.main, (kanjiCare || phase === 'feedback') ? item.sentence.pron : null)}
              <RefSpeak text={item.sentence.main} lang={lang} size="xs" />
            </div>
          )}
          <div className="fr-quiz__opts fr-quiz__opts--col">
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
              <div className="fr-quiz__prompt" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                ✍️ 주인공이 다음에 어떻게 할까요? 이야기의 다음 문장을 <span style={{ fontWeight: 700 }}>{langName}</span>로 한 문장 쓰세요.
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
              <div className="fr-quiz__prompt" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
                ✍️ 이야기를 이어서 — <span lang={langCode} style={{ fontWeight: 700 }}>{item.targetPattern.pattern}</span>
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
                rows={2} maxLength={200} autoFocus
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

          {phase === 'feedback' && produceState?.status === 'grading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>첨삭 확인 중…</p>
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
                  작문 기록실에서 더 다듬기 →
                </Link>
              </div>
            );
          })()}

          {phase === 'feedback' && produceState?.status === 'error' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 14 }}>
              첨삭을 못 받았어요 — 다음에 다시
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

      {/* 계속 버튼 (산출 문항은 자체 버튼 사용) */}
      {phase === 'feedback' && item.type !== 'produce-writing' && (
        <div style={{ marginTop: 18 }}>
          <Button onClick={next} style={{ width: '100%' }}>
            {idx + 1 >= queue.length ? '결과 보기 →' : '계속 →'}
          </Button>
        </div>
      )}

      {/* 언어 전환 (세션 시작 전 첫 문항에서만) */}
      {idx === 0 && phase === 'answer' && languages.length > 1 && (
        <div className="chip-group" style={{ marginTop: 26, justifyContent: 'center' }}>
          {languages.map(l => (
            l.key === lang
              ? <span key={l.key} className="chip chip--active">{l.flag} {l.name}</span>
              : <a key={l.key} href={`/study?lang=${l.key}`} className="chip">{l.flag} {l.name}</a>
          ))}
        </div>
      )}
    </div>
  );
}
