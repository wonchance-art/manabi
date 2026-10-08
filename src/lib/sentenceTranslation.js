// 문장 번역 단일 키 — 뷰어 v2 AE-R2 PR ②(설계서 docs/manabi-viewer-v2-ae-r2.md §2·§4, 정본 VIEWER-V2-ROUNDS-001 §4).
//
// 번역이 시작되는 모든 길(카드 [문장] 탭·문장 막대·이동 막대 「번역」·드래그·선처리)이 이 모듈 하나를 쓴다.
// - 순서: 교재 번역 맵(metadata.translations, 설명 언어 ko) → localStorage viewer_tx → AI(로그인 사용자).
// - 키: 기존 viewer_tx:v2 SHA-256(viewerCacheKey — 계정·자료·언어·[설명 언어]·원문·processed_json + 문장 전체,
//   자르지 않음). TanStack Query 키 = [SENTENCE_TX_QUERY, 그 문자열] — 같은 문장·같은 설정이면 같은 요청(single-flight).
// - 쿼리 함수는 signal을 쓰지 않는다 → 관찰자가 0이 돼도(시트 닫기·다른 단어) 끝까지 받아 저장한다(query-core 5.x).
// - 학습 이벤트 0: review_events·만남·재분석·FSRS를 건드리지 않는다. 쓰는 것은 viewer_tx 결과 한 칸뿐.
import { lookupTranslation, bookMeaningPanelText } from './bilingualSplit.js';
import { viewerCacheKey } from './viewerReliability.js';
import { buildContextPrompt } from './grammarDetail.js';
import { buildViewerSentencePrompt, parseViewerExplanation, formatViewerExplanation } from './viewerExplanation.js';
import { callGemini, SENTENCE_TX_TIER } from './gemini.js';
import { cleanLineText } from './sentenceNav.js';

export const SENTENCE_TX_QUERY = 'viewer-sentence-tx';
export const SENTENCE_TX_GC_MS = 30 * 60 * 1000;
export const SENTENCE_PREFETCH_DWELL_MS = 300;
export const SENTENCE_PREFETCH_PER_MINUTE = 20;
/**
 * 패널 결과 자리 표지 — 게스트가 캐시·교재 맵 없이 연 문장(AE-R2 PR ③ · 설계서 Q4). AI를 부르지 않고 번역 칸에
 * 로그인 안내를 그린다. 결과 문자열 자리에 두어 「패널에 내용이 있다」 판정(leftActive 등)이 그대로 성립한다.
 */
export const SENTENCE_TX_LOGIN_REQUIRED = '\u0000viewer-sentence:login-required';

/** 카드 문장 = 막대와 같은 정리(앞뒤 공백·`# ` 제목 표지)를 한 원문 줄. 여러 줄(드래그 문맥)은 그대로. */
export function canonicalSentence(text) {
  if (typeof text !== 'string') return null;
  const out = text.includes('\n') ? text : cleanLineText(text);
  return out.trim() ? out : null;
}

/** 교재 번역 맵 적중이면 패널 본문(📘 한 줄 포함), 아니면 null. 정확 일치만 — 적중하면 요청 0. */
export function sentenceBookMeaning({ translations, locale, sentence }) {
  const meaning = lookupTranslation(locale === 'ko' ? translations : null, sentence);
  return meaning ? bookMeaningPanelText(meaning) : null;
}

// 키 메모 — 범위 배열(cacheScope, useMemo라 설정이 바뀌면 새 객체)마다 문장 → 키. 같은 줄 재탭에 다시 해시하지 않는다.
const keyMemo = new WeakMap();
export function sentenceTranslationKey(scope, sentence) {
  let byScope = keyMemo.get(scope);
  if (!byScope) { byScope = new Map(); keyMemo.set(scope, byScope); }
  let entry = byScope.get(sentence);
  if (!entry) {
    entry = { value: null, promise: null };
    entry.promise = viewerCacheKey('viewer_tx', scope, sentence).then(
      (key) => { entry.value = key; return key; },
      (err) => { byScope.delete(sentence); throw err; },
    );
    byScope.set(sentence, entry);
  }
  return entry.promise;
}
/** 이미 계산된 키만 동기로(측정용 — 열 때 그 키가 준비됐는지 보려고). 없으면 null. */
export function peekSentenceTranslationKey(scope, sentence) {
  return keyMemo.get(scope)?.get(sentence)?.value ?? null;
}

/**
 * 번역 핵심 — localStorage viewer_tx → AI → 저장. 교재 맵은 호출부가 먼저 본다(sentenceBookMeaning, 요청·해시 0).
 * @returns {Promise<{text: string, source: 'cache'|'ai'}>}
 */
export async function fetchSentenceTranslation({
  sentence, locale, language, langName, cacheKey, storage, callAi = callGemini,
  purpose = 'viewer-sentence', attempts, beforeAi, onAi,
}) {
  if (cacheKey && storage) {
    let cached = null;
    try { cached = storage.getItem(cacheKey); } catch { cached = null; }
    if (cached) return { text: cached, source: 'cache' };
  }
  if (beforeAi && beforeAi() === false) throw new Error('SENTENCE_TX_SKIPPED');
  const prompt = locale === 'ko'
    ? buildContextPrompt(sentence, langName)
    : buildViewerSentencePrompt({ text: sentence, language, locale });
  const started = Date.now();
  const raw = await callAi(prompt, undefined, { tier: SENTENCE_TX_TIER, purpose, ...(attempts ? { attempts } : {}) });
  onAi?.({ key: cacheKey, purpose, ms: Date.now() - started });
  const text = locale === 'ko'
    ? raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || ''
    : formatViewerExplanation(parseViewerExplanation(raw, 'sentence'), locale, 'sentence');
  if (!text) throw new Error('SENTENCE_TX_EMPTY');
  if (cacheKey && storage) { try { storage.setItem(cacheKey, text); } catch { /* 용량 초과면 쓰기 생략(지금과 같음) */ } }
  return { text, source: 'ai' };
}

/** TanStack Query 옵션 — 재시도 0(앱 기본 retry:1을 덮는다), 끝난 결과는 세션 동안 그대로. */
export function sentenceTranslationQuery({ cacheKey, ...args }) {
  return {
    queryKey: [SENTENCE_TX_QUERY, cacheKey],
    queryFn: () => fetchSentenceTranslation({ cacheKey, ...args }),
    retry: false,
    staleTime: Infinity,
    gcTime: SENTENCE_TX_GC_MS,
  };
}

/**
 * 머무름 타이머 — 같은 키(줄)에 delay ms 머물면 onFire(key) 1회. 키가 같으면 다시 세지 않고, 바뀌거나 null이면 취소.
 * 한 번 쏜 키는 다른 키로 갔다 돌아오기 전까지 다시 쏘지 않는다(돌아오면 쿼리 캐시가 요청 0을 보장한다).
 */
export function createDwellTrigger({ delay = SENTENCE_PREFETCH_DWELL_MS, onFire, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let current = null, timer = null;
  const stop = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  return {
    update(key) {
      const next = key || null;
      if (next === current) return;
      stop();
      current = next;
      if (!next) return;
      timer = setTimer(() => { timer = null; if (current === next) onFire(next); }, delay);
    },
    dispose() { stop(); current = null; },
  };
}

/** 선처리 AI 클라이언트 상한(설계서 §4.3 — 프록시 분당 60회를 다른 기능과 공유하므로 선처리가 먼저 채우지 않게). */
export function createRateLimiter({ max = SENTENCE_PREFETCH_PER_MINUTE, windowMs = 60_000, now = Date.now } = {}) {
  const stamps = [];
  return {
    take() {
      const t = now();
      while (stamps.length && t - stamps[0] > windowMs) stamps.shift();
      if (stamps.length >= max) return false;
      stamps.push(t);
      return true;
    },
  };
}

/** [문장] 탭을 연 순간의 쿼리 상태 → 적중(준비됨)·합류(진행 중)·없음. */
export function classifySentenceOpen(state) {
  if (state?.status === 'success') return 'hit';
  if (state?.fetchStatus === 'fetching') return 'join';
  return 'miss';
}

/**
 * 측정(설계서 §4.2 (다)) — 탭 세션 집계. 숫자만 내보낸다(키·원문·사용자 식별자 0).
 * 적중률 = 적중 / 열기(합류는 분모에만). 낭비 = 선처리 AI 중 그 키의 탭을 끝까지 안 연 수.
 */
export function createSentenceTxStats() {
  const s = { prefetchStarts: 0, prefetchAi: 0, prefetchLimited: 0, aiCalls: 0, opens: 0, hits: 0, joins: 0, misses: 0, books: 0 };
  const aiMs = [], openToReadyMs = [], prefetchedKeys = new Set(), openedKeys = new Set();
  const cap = (list, v) => { list.push(Math.round(v)); if (list.length > 200) list.shift(); };
  return {
    prefetchStart() { s.prefetchStarts += 1; },
    prefetchLimited() { s.prefetchLimited += 1; },
    ai({ key, purpose, ms }) {
      s.aiCalls += 1;
      if (purpose === 'viewer-sentence-prefetch') { s.prefetchAi += 1; if (key) prefetchedKeys.add(key); }
      cap(aiMs, ms);
    },
    open({ key, ready }) {
      s.opens += 1;
      if (key) openedKeys.add(key);
      if (ready === 'hit') s.hits += 1;
      else if (ready === 'join') s.joins += 1;
      else if (ready === 'book') s.books += 1;
      else s.misses += 1;
    },
    ready({ ms }) { cap(openToReadyMs, ms); },
    snapshot() {
      let wasted = 0;
      for (const key of prefetchedKeys) if (!openedKeys.has(key)) wasted += 1;
      return { ...s, wasted, hitRate: s.opens ? s.hits / s.opens : null, aiMs: [...aiMs], openToReadyMs: [...openToReadyMs] };
    },
  };
}

// 탭 하나의 집계·상한 — 자료를 옮겨 다녀도 한 세션으로 센다. 개발자 도구 `window.__viewerPrefetchStats()`로 읽는다
// (Preview 정상 실계정 측정 대본용, 설계서 §4.2 (다)). 수집·전송 경로는 없다.
export const sentenceTxStats = createSentenceTxStats();
export const sentencePrefetchLimiter = createRateLimiter();
if (typeof window !== 'undefined' && !window.__viewerPrefetchStats) {
  Object.defineProperty(window, '__viewerPrefetchStats', { value: () => sentenceTxStats.snapshot(), configurable: true });
}
