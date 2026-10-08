import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// AD-R4 PR② 계약 — 상수 꺼짐(ZH_SENSE_REVIEW = false)이면 /api/analyze(중국어)가 현행과 바이트 단위로 같다.
// 스냅숏(__snapshots__/zhSenseReviewRoute.off.json)은 이 PR의 제품 코드를 넣기 **전** 기준 커밋에서 떴다.
// 프롬프트 · 모델 응답 처리 · DB 쓰기(조회·upsert·자가 치유 update·touch) · 응답 JSON 모양을 한 번에 고정한다.
// 설계: docs/manabi-viewer-v2-ad-r4.md §7(상수 꺼짐 = 현행) · §9.2(disambiguateZhPos.test.js 무수정).

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/zhAnalyzeRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/zhAnalyzeRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/zhAnalyzeRouteHarness.js')).rateLimitModule);

import { POST } from '../../../app/api/analyze/route.js';
import { reset, runRoute } from './helpers/zhAnalyzeRouteHarness.js';

const NOW = Date.UTC(2026, 9, 7, 11, 0, 0);

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('상수 꺼짐 = 현행 스냅숏', () => {
  it('프롬프트·응답 처리·DB 쓰기·응답 JSON이 기준 커밋과 같다', async () => {
    const run = await runRoute(POST);
    expect(run.status).toBe(200);
    await expect(`${JSON.stringify(run, null, 2)}\n`).toMatchFileSnapshot('./__snapshots__/zhSenseReviewRoute.off.json');
  });

  it('꺼짐에서는 응답 토큰에 meaningCheck가, stats에 zhSense가 없다', async () => {
    const { body } = await runRoute(POST);
    const tokens = body.results.flatMap((r) => Object.values(r.dictionary));
    expect(tokens.some((t) => 'meaningCheck' in t)).toBe(false);
    expect(body.stats).not.toHaveProperty('zhSense');
  });
});
