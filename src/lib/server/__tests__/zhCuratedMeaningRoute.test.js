import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 중국어 빈 뜻 예방 — /api/analyze 끝까지: 뜻 조회가 비면(모델 실패) 교재 표제어 뜻이 토큰에만 들어간다.
// 공유 사전 행이 있는 낱말은 그대로, 사전 쓰기(upsert)에 교재 뜻이 섞이지 않는다.

vi.mock('../llm.js', async () => {
  const harness = await import('./helpers/zhAnalyzeRouteHarness.js');
  return {
    callLLM: async (tier, prompt, opts = {}) => {
      if (opts.route === 'fetchMeanings') { harness.state.calls.push({ tier, route: opts.route, prompt, opts }); return { text: '[]' }; }
      return harness.callLLM(tier, prompt, opts);
    },
  };
});
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/zhAnalyzeRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/zhAnalyzeRouteHarness.js')).rateLimitModule);

import { POST } from '../../../app/api/analyze/route.js';
import { reset, runRoute } from './helpers/zhAnalyzeRouteHarness.js';

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('뜻 조회가 비었을 때 교재 표제어로', () => {
  it('사전에 없는 妈妈는 교재 뜻 + 출처 표식, 사전에 있는 낱말은 지금 그대로', async () => {
    const { body, ops } = await runRoute(POST);
    const tokens = body.results.flatMap((r) => Object.values(r.dictionary));
    const mama = tokens.find((t) => t.text === '妈妈');
    expect(mama.meaning).toBeTruthy();
    expect(mama.meaning_src).toBe('curated');
    const phone = tokens.find((t) => t.text === '电话');
    expect(phone.meaning).toBe('전화');
    expect(phone).not.toHaveProperty('meaning_src');
    expect(body.stats.zhCuratedFills).toBeGreaterThan(0);
    const written = JSON.stringify(ops.filter((o) => o.op === 'upsert' || o.op === 'update'));
    expect(written).not.toContain(mama.meaning);
  });
});
