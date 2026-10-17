// LLM-COST-001 — /api/admin/llm-stats가 인스턴스 창 집계에 provider · 모델별 추정 비용을 붙인다(관리자만). 권한 계약은 route.test.js.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../lib/server/auth.js', () => ({ requireAdmin: async () => ({ user: { id: 'admin' } }) }));

describe('/api/admin/llm-stats — costs', () => {
  it('창에 쌓인 호출의 모델별 비용 · 합계 · 단가 기준을 돌려준다', async () => {
    vi.resetModules();
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    vi.stubEnv('ANTHROPIC_BASE_URL', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 1000, output_tokens: 200 } }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const llm = await import('../../../../lib/server/llm.js');
    llm.resetLLMStats();
    await llm.callLLM('light', 'p', { route: 'explain' });
    const { GET } = await import('./route');
    const body = await (await GET(new Request('https://example.test/api/admin/llm-stats'))).json();
    expect(body.costs.byModel).toEqual([{ model: 'claude-haiku-5-5', provider: 'anthropic', calls: 1, ok: 1, in: 1000, out: 200, thinking: 0, costUsd: llm.estimateCostUsd('claude-haiku-5-5', { in: 1000, out: 200 }) }]);
    expect(body.costs.totalUsd).toBe(body.costs.byModel[0].costUsd);
    expect(body.costs.priceAsOf).toBe(llm.PRICE_AS_OF);
    expect(body.tiers.light['claude-haiku-5-5'].calls).toBe(1); // 기존 창은 그대로
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
