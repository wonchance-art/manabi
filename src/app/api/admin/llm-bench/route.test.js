// 관리자 측정 API 권한·입력 계약 — 비로그인 401 · 비관리자 403 · 모르는 모델 400. 측정 자체는 llmBench.test.js.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), run: vi.fn() }));
vi.mock('../../../../lib/server/auth.js', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('../../../../lib/server/llmBench.js', async (orig) => ({ ...(await orig()), runBenchModel: mocks.run }));

import { GET, POST } from './route';

const req = (body) => new Request('http://localhost/api/admin/llm-bench', { method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ user: { id: 'admin' } });
  mocks.run.mockResolvedValue({ model: 'gpt-6-luna', calls: { total: 1 } });
});

describe('/api/admin/llm-bench', () => {
  it('비로그인 401 · 비관리자 403 — 측정을 돌리지 않는다', async () => {
    mocks.requireAdmin.mockResolvedValueOnce({ error: '로그인이 필요합니다.', status: 401 });
    expect((await POST(req({ model: 'gpt-6-luna' }))).status).toBe(401);
    mocks.requireAdmin.mockResolvedValueOnce({ error: '관리자 전용 기능이에요.', status: 403 });
    expect((await GET(req())).status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('GET은 모델 목록과 키 설정 여부만(값 없음)', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'secret-value');
    const body = await (await GET(req())).json();
    expect(body.models.find((m) => m.id === 'gpt-6-luna')).toMatchObject({ configured: true, env: 'OPENAI_API_KEY' });
    expect(JSON.stringify(body)).not.toContain('secret-value');
    vi.unstubAllEnvs();
  });
  it('모르는 모델은 400, 아는 모델은 그 모델 하나만 돌린다', async () => {
    expect((await POST(req({ model: 'gpt-4' }))).status).toBe(400);
    const res = await POST(req({ model: 'gpt-6-luna' }));
    expect(res.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith('gpt-6-luna');
    expect((await res.json()).result).toMatchObject({ model: 'gpt-6-luna' });
  });
});
