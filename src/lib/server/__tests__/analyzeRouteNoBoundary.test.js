import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AD-R3 PR② 회귀 계약 — 경계 기록을 싣지 않은 /api/analyze(중·일·영)는 기준 커밋과 바이트 단위로 같다.
// 스냅숏(__snapshots__/analyzeRouteNoBoundary.json)은 PR②의 제품 코드를 넣기 **전** 기준 커밋(PR① 15e9500a)에서 떴다.
// 프롬프트 · 모델 응답 처리 · DB 쓰기(조회·upsert·touch) · 응답 JSON을 한 번에 고정한다. 정본: docs/manabi-viewer-v2-ad-r3.md §9 PR②
// 「기록이 없는 자료의 분석 결과가 바이트 단위로 같음」.

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/boundaryRouteHarness.js')).rateLimitModule);

import { POST } from '../../../app/api/analyze/route.js';
import { LINES, reset, runRoute } from './helpers/boundaryRouteHarness.js';

const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('경계 기록 없음 = 기준 커밋과 같은 분석(중·일·영)', () => {
  it('프롬프트·응답 처리·DB 쓰기·응답 JSON이 스냅숏과 같다', async () => {
    const runs = {};
    for (const language of ['Chinese', 'Japanese', 'English']) {
      reset();
      runs[language] = await runRoute(POST, { lines: LINES[language], language });
      expect(runs[language].status).toBe(200);
    }
    await expect(`${JSON.stringify(runs, null, 2)}\n`).toMatchFileSnapshot('./__snapshots__/analyzeRouteNoBoundary.json');
  });

  it('빈 boundaries 배열도 기록 없음과 같다(응답에 boundaryApplied 키가 없다)', async () => {
    for (const language of ['Chinese', 'Japanese', 'English']) {
      reset();
      const plain = await runRoute(POST, { lines: LINES[language], language });
      reset();
      const empty = await runRoute(POST, { lines: LINES[language], language, boundaries: [] });
      expect(JSON.stringify(empty)).toBe(JSON.stringify(plain));
      expect(plain.body.results.some((r) => 'boundaryApplied' in r)).toBe(false);
    }
  });
});
