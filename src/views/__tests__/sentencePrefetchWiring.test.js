import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약: 문장 번역 단일 키 · 선처리 배선 — 뷰어 v2 AE-R2 PR ②(설계서 docs/manabi-viewer-v2-ae-r2.md §2·§4.1·§6.2).
 * - 모든 번역 길(카드 [문장] 탭·막대·이동 막대 「번역」·드래그)은 같은 쿼리 키(sentenceTranslationQuery)를 쓴다.
 * - 선처리는 학습 기록·재분석·패널 상태를 건드리지 않는다(학습 이벤트 0). 수업 모드·게스트는 선처리 0.
 * - 수업 모드 경로(runSelectionAnalysis)는 그대로다.
 */
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const sliceBetween = (src, start, end) => {
  const i = src.indexOf(start);
  expect(i, `missing ${start}`).toBeGreaterThan(-1);
  const j = src.indexOf(end, i + start.length);
  expect(j, `missing end after ${start}`).toBeGreaterThan(i);
  return src.slice(i, j);
};

describe('선처리 — 학습 이벤트 0 · 조건', () => {
  const prefetch = () => sliceBetween(viewer, 'const prefetchCardSentence = async () => {', '\n  };');

  it('선처리는 같은 키의 prefetchQuery 하나 — AI 1회(attempts 1)·용도 꼬리표', () => {
    const fn = prefetch();
    expect(fn).toContain('queryClient.prefetchQuery(sentenceTranslationQuery(');
    expect(fn).toContain("purpose: 'viewer-sentence-prefetch'");
    expect(fn).toContain('attempts: 1');
    expect(fn).toContain('beforeAi:');
    expect(fn).toContain('sentenceBookMeaningOf(sentence)'); // 교재 맵 적중이면 요청 0
  });

  it('선처리 경로에 학습 기록·재분석·패널 상태 변경이 없다', () => {
    const fn = prefetch();
    for (const banned of ['logReviewEvents', 'recordVocabEncounters', 'setDragTokens', '/api/analyze', 'setLeftPanel', 'setSentenceTabSignal', 'selectionGate', 'detailGate', 'runSelectedSentence', 'runSelectionAnalysis']) {
      expect(fn, banned).not.toContain(banned);
    }
  });

  it('선처리 키는 수업 모드·게스트·닫힌 시트·무id 단어에서 null(요청 0)', () => {
    const key = sliceBetween(viewer, 'const prefetchLineKey =', ';\n');
    for (const cond of ['!classStudyActive', 'user', 'isSheetOpen', 'lineIndexOfToken(selectedToken)']) expect(key, cond).toContain(cond);
    expect(viewer).toContain('useSentencePrefetch({ lineKey: prefetchLineKey, start: prefetchCardSentence })');
    expect(viewer).toMatch(/import \{ useSentencePrefetch \} from '\.\.\/lib\/useSentencePrefetch'/);
  });
});

describe('번역 단일 키 — 사용자가 연 번역도 같은 쿼리', () => {
  const run = () => sliceBetween(viewer, 'const runSelectedSentence = async (sel, explanationOnly = false) => {', 'explainSelectedSentenceRef.current = runSelectedSentence;');

  it('runSelectedSentence의 번역은 fetchQuery(같은 키) — 진행 중 선처리에 합류하고 끝난 것은 즉시 읽는다', () => {
    const fn = run();
    expect(fn).toContain('queryClient.fetchQuery(sentenceTranslationQuery(');
    expect(fn).toContain("purpose: 'viewer-sentence'");
    expect(fn).toContain('sentenceTranslationKey(cacheScope, sel)');
    // 번역 AI를 직접 부르지 않는다(사용자 요청 signal로 끊기면 저장도 없던 결함 — 설계서 §1.2)
    expect(fn).not.toContain('callGemini(');
    expect(fn).not.toContain("localStorage.setItem(cacheKey");
  });

  it('[문장] 탭 열기는 측정만 더하고 경로는 그대로(runSelectedSentence(sentence, true)) — 열 때 바로 시작(대기 없음)', () => {
    const handler = sliceBetween(viewer, 'const openSentenceTranslation = () => {', '\n  };');
    expect(handler).toContain('runSelectedSentence(sentence, true)');
    expect(handler).toContain('canonicalSentence(ctxSentenceOf(selectedToken))');
    expect(handler).not.toMatch(/setTimeout|await /);
  });

  it('수업 모드 경로(runSelectionAnalysis)는 무변경', () => {
    expect(viewer).toContain('const runSelectionAnalysis = async (sel) => {\n    return runSelectedSentence(sel);\n  };');
  });
});

describe('측정 — 용도 꼬리표(서버 [llm] route)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('callGemini는 purpose·attempts를 generationConfig로 흘리지 않는다 — purpose는 본문 최상위, attempts 1 = 재시도 0', async () => {
    const bodies = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return { ok: false, status: 503, text: async () => JSON.stringify({ error: { message: 'overloaded' } }) };
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { callGemini } = await import('../../lib/gemini');
    await expect(callGemini('p', undefined, { tier: 'light', purpose: 'viewer-sentence-prefetch', attempts: 1 })).rejects.toThrow();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual({ contents: [{ parts: [{ text: 'p' }] }], tier: 'light', purpose: 'viewer-sentence-prefetch' });
  });

  it('프록시는 허용 목록 용도만 route 꼬리표로 찍는다(그 밖은 gemini-proxy 그대로)', () => {
    const proxy = read('src/app/api/gemini/route.js');
    expect(proxy).toContain("const PROXY_PURPOSES = new Set(['viewer-sentence', 'viewer-sentence-prefetch'])");
    expect(proxy).toContain('route: proxyRoute(body.purpose)');
    expect(proxy).toMatch(/PROXY_PURPOSES\.has\(purpose\) \? `gemini-proxy:\$\{purpose\}` : 'gemini-proxy'/);
  });
});
