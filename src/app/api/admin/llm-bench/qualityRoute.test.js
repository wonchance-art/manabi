// 관리자 측정 API — 품질 세트(LLM-BENCH-QUALITY-001) 갈래. 핵심 세트 호출 계약(route.test.js)은 그대로다.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), run: vi.fn(), quality: vi.fn() }));
vi.mock('../../../../lib/server/auth.js', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('../../../../lib/server/llmBench.js', async (orig) => ({ ...(await orig()), runBenchModel: mocks.run, runQualityBench: mocks.quality }));

import { POST } from './route';

const post = (body) => POST(new Request('http://localhost/api/admin/llm-bench', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ user: { id: 'admin' } });
  mocks.run.mockResolvedValue({ model: 'claude-haiku-5-5', calls: { total: 1 } });
  mocks.quality.mockResolvedValue({ model: 'claude-haiku-5-5', set: 'quality', calls: { total: 13 }, conversation: { pass: 5 }, writing: { pass: 4 }, paragraph: { pass: 3 } });
});

describe('/api/admin/llm-bench — set', () => {
  it("set:'quality'는 품질 세트만 돌린다(핵심 세트는 부르지 않는다)", async () => {
    const res = await post({ model: 'claude-haiku-5-5', set: 'quality' });
    expect(res.status).toBe(200);
    expect(mocks.quality).toHaveBeenCalledWith('claude-haiku-5-5');
    expect(mocks.run).not.toHaveBeenCalled();
    expect((await res.json()).result).toMatchObject({ set: 'quality' });
  });
  it('set이 없으면 지금처럼 핵심 세트 · 모르는 set은 400(아무것도 돌리지 않는다)', async () => {
    await post({ model: 'claude-haiku-5-5' });
    expect(mocks.run).toHaveBeenCalledWith('claude-haiku-5-5');
    expect(mocks.quality).not.toHaveBeenCalled();
    vi.clearAllMocks();
    expect((await post({ model: 'claude-haiku-5-5', set: 'all' })).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.quality).not.toHaveBeenCalled();
  });
  it('비관리자는 품질 세트도 403 — 돌리지 않는다', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ error: '관리자 전용 기능이에요.', status: 403 });
    expect((await post({ model: 'claude-haiku-5-5', set: 'quality' })).status).toBe(403);
    expect(mocks.quality).not.toHaveBeenCalled();
  });
});
