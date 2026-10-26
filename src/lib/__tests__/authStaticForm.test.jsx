import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';

// ROUTE-AUDIT-2 P1(오너 「권장대로」 2026-10-26 KST) — 로그인(/auth)은 정적 판에 폼이 실린다. 예전엔 useSearchParams를 Suspense(fallback null)
// 안에서 써 정적 HTML에 입력이 0개(BAILOUT_TO_CLIENT_SIDE_RENDERING)였고, 모바일에서 폼이 0.31 s가 아니라 하이드레이션 뒤 0.72 s에 떴다.
// 질의(from · error · mode)는 마운트 뒤 · 제출 때만 읽는다. ?mode=reset · ?error= 링크만 첫 그림을 미루는 판(/auth/from-link)으로 —
// 정적 로그인 폼이 잠깐 보였다가 재설정 · 오류 화면으로 바뀌지 않게(목업 합의).
const { createServerClientMock } = vi.hoisted(() => ({ createServerClientMock: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: createServerClientMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({}) }));
vi.mock('../supabase', () => ({ supabase: {} }));

import { config, middleware } from '../../middleware';
import AuthPage from '../../views/AuthPage';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('로그인 폼이 정적 HTML에 실린다', () => {
  it('질의 훅(useSearchParams) · Suspense 없이 그린다 — 서버 그림에 이메일 · 비밀번호 입력이 있다', () => {
    const src = read('src/views/AuthPage.jsx');
    expect(src).not.toMatch(/useSearchParams|<Suspense/);
    const html = renderToStaticMarkup(<AuthPage />);
    expect(html).toContain('id="auth-email"');
    expect(html).toContain('id="auth-password"');
  });
  it('미루는 판(deferred)은 서버 그림이 비어 있다 — 재설정 · 오류 링크는 지금처럼 하이드레이션 뒤 해당 화면', () => {
    expect(renderToStaticMarkup(<AuthPage deferred />)).toBe('');
    expect(read('src/app/(app)/auth/from-link/page.jsx')).toContain('<AuthPage deferred />');
  });
});

describe('middleware — 재설정 · 오류 링크만 미루는 판으로, 질의는 그대로', () => {
  it('matcher는 /auth 정확히 하나(판 경로 /auth/from-link는 다시 걸리지 않는다)', () => {
    expect(config.matcher).toContain('/auth');
    expect(config.matcher.filter((m) => m.startsWith('/auth'))).toEqual(['/auth']);
  });
  it.each(['/auth', '/auth?from=%2Fvocab', '/auth?from=%2Fauth%3Fmode%3Dreset'])('%s → 정적 판 그대로', async (input) => {
    const response = await middleware(new NextRequest(`https://example.test${input}`));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
  it.each(['/auth?mode=reset', '/auth?error=auth_callback_failed&from=%2Fhome'])('%s → /auth/from-link(질의 보존)', async (input) => {
    const response = await middleware(new NextRequest(`https://example.test${input}`));
    const target = new URL(response.headers.get('x-middleware-rewrite'));
    expect(target.pathname).toBe('/auth/from-link');
    expect(target.search).toBe(new URL(`https://example.test${input}`).search);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
