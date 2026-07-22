import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

import { config, middleware } from './middleware';

const EMEA_ASSET = '/assets/overworld/europe-mediterranean-middle-east-surface-preview-v1/manifest.json';

function mockSession({ user = null, role = null } = {}) {
  createServerClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: role == null ? null : { role } }),
        }),
      }),
    })),
  });
}

function request(pathname) {
  return new NextRequest(`https://example.test${pathname}`);
}

describe('오버월드 자산 공개 계약 (#306 EMEA 일반 공개 이후)', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('matcher는 관리자 경로만 남기고 오버월드 자산 경로를 더 이상 가로채지 않는다', () => {
    expect(config.matcher).toContain('/admin/:path*');
    expect(config.matcher).not.toContain('/assets/overworld/:path*');
  });

  it('EMEA 자산 요청도 세션 조회 없이 그대로 통과한다 (구 가드 회귀 방지)', async () => {
    const response = await middleware(request(EMEA_ASSET));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('APAC 자산 요청도 동일하게 통과한다', async () => {
    const response = await middleware(request(
      '/assets/overworld/asia-pacific-surface-preview-v1/manifest.json',
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});

describe('관리자 경로 보호 (기존 계약 유지)', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('미로그인 관리자 경로 접근은 /auth 로 보낸다', async () => {
    mockSession();

    const response = await middleware(request('/admin'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.test/auth');
  });

  it('일반 사용자는 홈으로 돌려보낸다', async () => {
    mockSession({ user: { id: 'member-1' }, role: 'member' });

    const response = await middleware(request('/admin'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.test/');
  });

  it('관리자만 통과한다', async () => {
    mockSession({ user: { id: 'admin-1' }, role: 'admin' });

    const response = await middleware(request('/admin'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
