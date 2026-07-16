import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

import {
  config,
  isProtectedOverworldPreviewAssetPath,
  middleware,
} from './middleware';

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

describe('EMEA 미출시 오버월드 자산 접근 경계', () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
  });

  it('EMEA 원본 계열만 보호하고 출시된 APAC과 일반 미리보기는 공개 경로로 둔다', () => {
    for (const layer of ['surface', 'playability', 'terrain', 'transport', 'transport-nodes', 'boundary']) {
      expect(isProtectedOverworldPreviewAssetPath(
        `/assets/overworld/europe-mediterranean-middle-east-${layer}-preview-v1/chunk.bin`,
      )).toBe(true);
    }
    expect(isProtectedOverworldPreviewAssetPath(
      '/assets/overworld/asia-pacific-surface-preview-v1/manifest.json',
    )).toBe(false);
    expect(isProtectedOverworldPreviewAssetPath(
      '/assets/overworld/map-previews/asia-pacific.png',
    )).toBe(false);
    expect(config.matcher).toContain('/assets/overworld/:path*');
  });

  it('출시된 APAC 자산은 세션 조회 없이 그대로 통과시킨다', async () => {
    const response = await middleware(request(
      '/assets/overworld/asia-pacific-surface-preview-v1/manifest.json',
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('미로그인 직접 자산 요청은 로그인 위치를 노출하지 않고 404로 닫는다', async () => {
    mockSession();

    const response = await middleware(request(EMEA_ASSET));

    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('일반 사용자의 직접 자산 요청도 404로 닫는다', async () => {
    mockSession({ user: { id: 'member-1' }, role: 'member' });

    const response = await middleware(request(EMEA_ASSET));

    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });

  it('관리자 요청만 원본 자산으로 통과시키고 공유 캐시를 금지한다', async () => {
    mockSession({ user: { id: 'admin-1' }, role: 'admin' });

    const response = await middleware(request(EMEA_ASSET));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie');
  });
});
