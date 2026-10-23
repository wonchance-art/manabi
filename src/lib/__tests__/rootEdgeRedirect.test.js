import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ROOT-EDGE-REDIRECT-001 (2026-10-23 KST 현장 감사 F3) — '/' → /home을 페이지 함수가 아니라 middleware(엣지)에서 보낸다.
// 지키는 것은 「옮겨도 결과가 같다」는 것이다: 아래 표는 옮기기 전 page.jsx가 실제로 낸 Location을 e2e 빌드(127.0.0.1:8903)에서
// 그대로 받아 적은 값이다. 질의는 버리고(next.config redirects()는 질의를 붙여 넘긴다 — 그래서 쓰지 않았다),
// 로그인 결과(code · error · error_description)는 page.jsx가 그대로 맡는다.
const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }));

import { config, middleware } from '../../middleware';
import RootPage from '../../app/page';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// 옮기기 전(page.jsx 단독) 실측 — 307 · Location
const BEFORE = {
  '/': '/home',
  '/?utm_source=x&lang=ja': '/home',
  '/?code=fixture-code': '/auth/callback?next=%2Fhome&code=fixture-code',
  '/?code=a&code=b': '/home',
  '/?code=': '/home',
  '/?error=access_denied': '/auth?error=auth_callback_failed&from=%2Fhome',
  '/?error_description=bad': '/auth?error=auth_callback_failed&from=%2Fhome',
  '/?code=fixture-code&error=access_denied': '/auth/callback?next=%2Fhome&code=fixture-code', // 이 줄만 실측이 아니라 page.jsx 순서(code 먼저)에서 나온 값
};

// middleware가 통과시키면 page.jsx를 그대로 부른다(Next와 같은 순서) — 둘을 이은 최종 Location.
async function resolveRoot(pathAndQuery) {
  const response = await middleware(new NextRequest(`https://example.test${pathAndQuery}`));
  if (response.headers.get('x-middleware-next') !== '1') {
    const location = new URL(response.headers.get('location'));
    return { by: 'middleware', status: response.status, location: location.pathname + location.search };
  }
  const url = new URL(pathAndQuery, 'https://example.test');
  const params = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    params[key] = all.length > 1 ? all : all[0];
  }
  try {
    await RootPage({ searchParams: Promise.resolve(params) });
  } catch (error) {
    const [, , location, status] = String(error.digest).split(';');
    return { by: 'page', status: Number(status), location };
  }
  throw new Error('page.jsx did not redirect');
}

describe("'/' 리다이렉트 — 엣지로 옮겨도 결과는 그대로", () => {
  beforeEach(() => createServerClientMock.mockReset());

  it("matcher가 '/'만 정확히 받는다(다른 경로는 middleware를 타지 않는다)", () => {
    expect(config.matcher).toContain('/');
    expect(config.matcher.filter((m) => m.startsWith('/:') || m === '/:path*')).toEqual([]);
  });

  it.each(Object.entries(BEFORE))('%s → %s (307)', async (input, location) => {
    const result = await resolveRoot(input);
    expect(result.status).toBe(307);
    expect(result.location).toBe(location);
  });

  it('로그인 결과가 없는 요청은 함수(page.jsx)까지 가지 않는다 — 감사가 지목한 비용', async () => {
    for (const input of ['/', '/?utm_source=x&lang=ja', '/?from=pwa']) {
      expect((await resolveRoot(input)).by, input).toBe('middleware');
    }
  });

  it('로그인 결과(code · error · error_description)는 page.jsx가 그대로 맡는다(교환 분기 한 곳)', async () => {
    for (const input of ['/?code=fixture-code', '/?code=', '/?code=a&code=b', '/?error=access_denied', '/?error_description=bad']) {
      expect((await resolveRoot(input)).by, input).toBe('page');
    }
    const page = read('src/app/page.jsx');
    expect(page).toContain('authCallbackUrl(');
    expect(page).toContain("'auth_callback_failed'");
  });

  it("'/'는 세션을 읽지 않는다 — 로그인 여부로 갈리지 않는다(guestLandingParity와 같은 약속)", async () => {
    await resolveRoot('/');
    await resolveRoot('/?code=fixture-code');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("다른 층에 '/' 리다이렉트가 없다 — next.config redirects() · vercel.json redirects/routes와 겹치면 질의 처리가 달라진다", () => {
    expect(read('next.config.mjs')).not.toMatch(/\bredirects\s*\(/);
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.redirects).toBeUndefined();
    expect(vercel.routes).toBeUndefined();
    expect(vercel.rewrites).toBeUndefined();
  });
});
