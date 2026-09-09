import { beforeEach, describe, expect, it, vi } from 'vitest';

// AA R2 계약 — /api/admin/llm-stats: 비로그인 401(저장소를 건드리기 전에 닫힌다) · 비관리자 403 · 관리자 { since, tiers }.
// 하네스는 api/ai-relay/route.test.js(vi.hoisted + vi.mock('@supabase/supabase-js')) 재사용.

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import { GET } from './route';
import { resetLLMStats } from '../../../../lib/server/llm.js';

function request(token) {
  return new Request('https://example.test/api/admin/llm-stats', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function supabaseFor({ user, role }) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: user ? null : new Error('invalid') })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: role ? { role } : null })) })) })),
    })),
  };
}

describe('/api/admin/llm-stats', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  });

  it('비로그인 401 — 저장소를 건드리기 전에 닫힌다', async () => {
    const res = await GET(request(null));
    expect(res.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('세션 무효 401', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: null }));
    const res = await GET(request('stale'));
    expect(res.status).toBe(401);
  });

  it('비관리자 403 — 회원가입이 열려 있어 로그인 유저 = 인터넷 아무나', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'u1' }, role: 'user' }));
    const res = await GET(request('tok'));
    expect(res.status).toBe(403);
  });

  it('관리자 200 — { since, tiers, groqConfigured }', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'u1' }, role: 'admin' }));
    resetLLMStats();
    const res = await GET(request('tok'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.since).toBe('string');
    expect(body.tiers).toEqual({});
    expect(typeof body.groqConfigured).toBe('boolean');
  });
});
