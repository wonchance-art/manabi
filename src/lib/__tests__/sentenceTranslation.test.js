import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import {
  SENTENCE_TX_QUERY, canonicalSentence, classifySentenceOpen, createDwellTrigger, createRateLimiter,
  createSentenceTxStats, fetchSentenceTranslation, peekSentenceTranslationKey, sentenceBookMeaning,
  sentenceTranslationKey, sentenceTranslationQuery,
} from '../sentenceTranslation';
import { viewerCacheKey } from '../viewerReliability';
import { SENTENCE_TX_TIER } from '../gemini';

/**
 * 계약: 문장 번역 단일 키 — 뷰어 v2 AE-R2 PR ②(설계서 docs/manabi-viewer-v2-ae-r2.md §2·§4·§6.2, 정본 §4).
 * - 같은 문장·같은 설정 = 같은 키(viewer_tx:v2 SHA-256, 자르지 않음) = 같은 캐시·같은 요청(single-flight).
 * - 순서: 교재 맵 → localStorage viewer_tx → AI. 교재 맵·캐시 적중이면 AI 0.
 * - 선처리는 AI 1회(재시도 0), signal을 쓰지 않아 시트를 닫아도 끝까지 받아 저장한다. 실패는 저장 0.
 * - 0.3초 머무름: 같은 줄에 머물러야 1회. 그 전에 닫거나 줄을 바꾸면 0회.
 */
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  const log = [];
  return {
    log,
    getItem(k) { log.push(['get', k]); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) { log.push(['set', k]); data.set(k, String(v)); },
    has: (k) => data.has(k),
    value: (k) => data.get(k),
  };
}
function fakeAi(reply = '**번역**\n검수 번역') {
  const calls = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const fn = async (prompt, signal, opts) => { calls.push({ prompt, signal, opts }); await gate; if (reply instanceof Error) throw reply; return reply; };
  return { fn, calls, release: () => release() };
}
const base = { locale: 'ko', language: 'Chinese', langName: '중국어' };

describe('문장 키 — 같은 문장·같은 설정 = 같은 키, 자르지 않음', () => {
  it('canonicalSentence는 막대와 같은 정리(앞뒤 공백·제목 표지)만 한다 — 카드와 막대가 같은 키를 쓴다', () => {
    expect(canonicalSentence('  她尽量别熬夜。 ')).toBe('她尽量别熬夜。');
    expect(canonicalSentence('# 第一课')).toBe('第一课');
    expect(canonicalSentence('甲\n乙')).toBe('甲\n乙'); // 여러 줄(드래그 문맥)은 그대로
    expect(canonicalSentence('')).toBe(null);
    expect(canonicalSentence(null)).toBe(null);
  });

  it('키 형식은 기존 viewer_tx:v2와 같다(기존 캐시·사전 시드 호환), 범위·문장마다 1회 계산', async () => {
    const scope = ['u1', 7, 'Chinese', 'raw', { v: 1 }];
    const key = await sentenceTranslationKey(scope, '她尽量别熬夜。');
    expect(key).toBe(await viewerCacheKey('viewer_tx', scope, '她尽量别熬夜。'));
    expect(peekSentenceTranslationKey(scope, '她尽量别熬夜。')).toBe(key);
    expect(peekSentenceTranslationKey(scope, '没算过。')).toBe(null);
    expect(peekSentenceTranslationKey(['u1', 7, 'Chinese', 'raw', { v: 1 }], '她尽量别熬夜。')).toBe(null); // 범위가 바뀌면 다시 계산
  });

  it('500자 문장 두 개가 마지막 글자만 달라도 키가 다르다(120자 자르기 없음)', async () => {
    const scope = ['u1'];
    const long = '我'.repeat(499);
    expect(await sentenceTranslationKey(scope, `${long}。`)).not.toBe(await sentenceTranslationKey(scope, `${long}！`));
  });
});

describe('순서 — 교재 맵 → viewer_tx → AI', () => {
  it('교재 맵은 설명 언어 ko에서만, 정확 일치만 — 적중하면 패널 본문(📘)을 돌려준다', () => {
    const translations = { '她尽量别熬夜。': '그녀는 되도록 밤을 새지 않는다.' };
    expect(sentenceBookMeaning({ translations, locale: 'ko', sentence: '她尽量别熬夜。' })).toContain('📘');
    expect(sentenceBookMeaning({ translations, locale: 'zh-TW', sentence: '她尽量别熬夜。' })).toBe(null);
    expect(sentenceBookMeaning({ translations, locale: 'ko', sentence: '她尽量' })).toBe(null);
  });

  it('캐시 적중 → AI 0, 저장 0', async () => {
    const storage = memoryStorage({ k1: '캐시 번역' });
    const ai = fakeAi();
    const out = await fetchSentenceTranslation({ ...base, sentence: 'A。', cacheKey: 'k1', storage, callAi: ai.fn });
    expect(out).toEqual({ text: '캐시 번역', source: 'cache' });
    expect(ai.calls).toHaveLength(0);
    expect(storage.log.filter(([op]) => op === 'set')).toHaveLength(0);
  });

  it('캐시 없음 → AI 1(번역 등급 상수·signal 없음·용도 꼬리표) → 저장 1', async () => {
    const storage = memoryStorage();
    const ai = fakeAi('**번역**\n번역 결과');
    ai.release();
    const out = await fetchSentenceTranslation({ ...base, sentence: 'B。', cacheKey: 'k2', storage, callAi: ai.fn, purpose: 'viewer-sentence-prefetch', attempts: 1 });
    expect(out).toEqual({ text: '**번역**\n번역 결과', source: 'ai' });
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].signal).toBeUndefined();
    expect(ai.calls[0].opts).toEqual({ tier: SENTENCE_TX_TIER, purpose: 'viewer-sentence-prefetch', attempts: 1 });
    expect(ai.calls[0].prompt).toContain('B。');
    expect(storage.value('k2')).toBe('**번역**\n번역 결과');
  });

  it('설명 언어가 ko가 아니면 구조화 문장 프롬프트 + 서식(지금 분기 그대로)', async () => {
    const storage = memoryStorage();
    const ai = fakeAi(JSON.stringify({ translation: '来到了学校。', context: '这是第二句。' }));
    ai.release();
    const out = await fetchSentenceTranslation({ ...base, locale: 'zh-TW', language: 'Korean', sentence: '학교에 왔어요.', cacheKey: 'k3', storage, callAi: ai.fn });
    expect(ai.calls[0].prompt).toContain('"translation": string');
    expect(out.text).toContain('来到了学校。');
  });

  it('beforeAi가 거절하면(선처리 상한) AI 0·저장 0으로 실패한다', async () => {
    const storage = memoryStorage();
    const ai = fakeAi();
    await expect(fetchSentenceTranslation({ ...base, sentence: 'C。', cacheKey: 'k4', storage, callAi: ai.fn, beforeAi: () => false })).rejects.toThrow();
    expect(ai.calls).toHaveLength(0);
    expect(storage.has('k4')).toBe(false);
  });

  it('빈 응답·실패는 저장하지 않는다', async () => {
    const storage = memoryStorage();
    const ai = fakeAi(new Error('503'));
    ai.release();
    await expect(fetchSentenceTranslation({ ...base, sentence: 'D。', cacheKey: 'k5', storage, callAi: ai.fn })).rejects.toThrow();
    expect(storage.has('k5')).toBe(false);
  });

  it('번역 등급은 한 상수(SENTENCE_TX_TIER) — 정본 §4 「light로 시작」, 클라 티어 계약(GEMINI_TIER)은 그대로', () => {
    expect(SENTENCE_TX_TIER).toBe('light');
    const client = read('src/lib/gemini.js');
    expect(client).toContain("export const GEMINI_TIER = 'standard'");
    expect(client).toContain("export const SENTENCE_TX_TIER = 'light'");
  });
});

describe('single-flight · 닫아도 저장 — 실제 QueryClient', () => {
  const clients = [];
  const client = () => { const c = new QueryClient({ defaultOptions: { queries: { retry: 1 } } }); clients.push(c); return c; };
  afterEach(() => { for (const c of clients.splice(0)) c.clear(); });

  it('선처리 두 번 + 사용자 열기 한 번 = AI 1회, 결과는 셋 모두 같다', async () => {
    const qc = client();
    const storage = memoryStorage();
    const ai = fakeAi('**번역**\n하나');
    const opts = (purpose) => sentenceTranslationQuery({ ...base, sentence: 'E。', cacheKey: 'k6', storage, callAi: ai.fn, purpose });
    const p1 = qc.prefetchQuery(opts('viewer-sentence-prefetch'));
    const p2 = qc.prefetchQuery(opts('viewer-sentence-prefetch'));
    const user = qc.fetchQuery(opts('viewer-sentence'));
    await Promise.resolve();
    ai.release();
    await Promise.all([p1, p2]);
    expect((await user).text).toBe('**번역**\n하나');
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].opts.purpose).toBe('viewer-sentence-prefetch');
    // 끝난 뒤 다시 열어도 0회(staleTime Infinity)
    await qc.fetchQuery(opts('viewer-sentence'));
    expect(ai.calls).toHaveLength(1);
    expect(opts('x').queryKey).toEqual([SENTENCE_TX_QUERY, 'k6']);
  });

  it('관찰자를 붙였다 떼도(시트 닫기) 요청은 끝까지 받아 저장소에 쓴다 — signal 미사용', async () => {
    const qc = client();
    const storage = memoryStorage();
    const ai = fakeAi('**번역**\n닫아도');
    const opts = sentenceTranslationQuery({ ...base, sentence: 'F。', cacheKey: 'k7', storage, callAi: ai.fn });
    const { QueryObserver } = await import('@tanstack/react-query');
    const observer = new QueryObserver(qc, opts);
    const unsubscribe = observer.subscribe(() => {});
    await Promise.resolve();
    unsubscribe();
    ai.release();
    await vi.waitFor(() => expect(storage.value('k7')).toBe('**번역**\n닫아도'));
    expect(qc.getQueryData(opts.queryKey)?.text).toBe('**번역**\n닫아도');
    expect(ai.calls).toHaveLength(1);
  });

  it('실패하면 재시도 0(앱 기본 retry:1을 덮는다)·저장 0, 다음 사용자 열기가 새로 1회 시도한다', async () => {
    const qc = client();
    const storage = memoryStorage();
    let n = 0;
    const callAi = async () => { n += 1; if (n === 1) throw Object.assign(new Error('429'), { status: 429 }); return '**번역**\n두 번째'; };
    const opts = (purpose) => sentenceTranslationQuery({ ...base, sentence: 'G。', cacheKey: 'k8', storage, callAi, purpose });
    expect(opts('p').retry).toBe(false);
    await qc.prefetchQuery(opts('viewer-sentence-prefetch'));
    expect(n).toBe(1);
    expect(storage.has('k8')).toBe(false);
    expect((await qc.fetchQuery(opts('viewer-sentence'))).text).toBe('**번역**\n두 번째');
    expect(n).toBe(2);
  });
});

describe('0.3초 머무름 — createDwellTrigger(가짜 타이머)', () => {
  afterEach(() => vi.useRealTimers());
  const setup = () => {
    vi.useFakeTimers();
    const fired = [];
    const trigger = createDwellTrigger({ delay: 300, onFire: (key) => fired.push(key) });
    return { fired, trigger };
  };

  it('299ms에 닫으면 0회, 300ms 머물면 1회', () => {
    const { fired, trigger } = setup();
    trigger.update('m:1');
    vi.advanceTimersByTime(299);
    trigger.update(null);
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
    trigger.update('m:1');
    vi.advanceTimersByTime(300);
    expect(fired).toEqual(['m:1']);
  });

  it('같은 줄의 다른 단어(같은 키)는 타이머를 다시 세지 않고, 한 번 쏜 줄은 머무는 동안 다시 쏘지 않는다', () => {
    const { fired, trigger } = setup();
    trigger.update('m:1');
    vi.advanceTimersByTime(200);
    trigger.update('m:1');
    vi.advanceTimersByTime(100);
    expect(fired).toEqual(['m:1']);
    trigger.update('m:1');
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual(['m:1']);
  });

  it('다른 줄로 가면 다시 센다, 해제(dispose) 뒤에는 0', () => {
    const { fired, trigger } = setup();
    trigger.update('m:1');
    vi.advanceTimersByTime(200);
    trigger.update('m:2');
    vi.advanceTimersByTime(299);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['m:2']);
    trigger.update('m:3');
    trigger.dispose();
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual(['m:2']);
  });

  it('키 없음(수업 모드·게스트·무id 리스트 단어·시트 닫힘) = 0회', () => {
    const { fired, trigger } = setup();
    trigger.update(null);
    trigger.update(undefined);
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual([]);
  });
});

describe('선처리 상한 · 측정', () => {
  it('createRateLimiter — 분당 상한을 넘으면 그 창 동안 거절', () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => t });
    expect(limiter.take()).toBe(true);
    expect(limiter.take()).toBe(true);
    expect(limiter.take()).toBe(false);
    t = 60_001;
    expect(limiter.take()).toBe(true);
  });

  it('classifySentenceOpen — 준비됨(적중)·진행 중(합류)·없음', () => {
    expect(classifySentenceOpen({ status: 'success', fetchStatus: 'idle' })).toBe('hit');
    expect(classifySentenceOpen({ status: 'pending', fetchStatus: 'fetching' })).toBe('join');
    expect(classifySentenceOpen({ status: 'error', fetchStatus: 'idle' })).toBe('miss');
    expect(classifySentenceOpen(undefined)).toBe('miss');
  });

  it('세션 집계 — 적중률 분모는 열기, 낭비 = 선처리 AI 중 끝까지 안 연 키, 지연은 숫자만', () => {
    const stats = createSentenceTxStats();
    stats.prefetchStart('a'); stats.prefetchStart('b'); stats.prefetchStart('c');
    stats.ai({ key: 'a', purpose: 'viewer-sentence-prefetch', ms: 800 });
    stats.ai({ key: 'b', purpose: 'viewer-sentence-prefetch', ms: 1200 });
    stats.ai({ key: 'd', purpose: 'viewer-sentence', ms: 900 });
    stats.open({ key: 'a', ready: 'hit' });
    stats.open({ key: 'd', ready: 'miss' });
    stats.open({ key: 'c', ready: 'join' });
    stats.ready({ key: 'd', ms: 950 });
    const s = stats.snapshot();
    expect(s).toMatchObject({ prefetchStarts: 3, prefetchAi: 2, aiCalls: 3, opens: 3, hits: 1, joins: 1, misses: 1, wasted: 1 });
    expect(s.hitRate).toBeCloseTo(1 / 3);
    expect(s.aiMs).toEqual([800, 1200, 900]);
    expect(s.openToReadyMs).toEqual([950]);
    expect(JSON.stringify(s)).not.toMatch(/"a"|"b"|"d"/); // 키·원문은 싣지 않는다
  });
});
