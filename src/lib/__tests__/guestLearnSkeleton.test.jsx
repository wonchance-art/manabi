// 손님 배움 골격(B1 — 오너 승인 목업 ① 「권장대로」, 2026-10-17 KST).
// 손님이 배움에 들어오면 로그인 배치 골격(현황 칸 · 단어 복습)이 0.7초 보였다가 손님 화면(이어 읽기 · 오늘 문단 · 로그인 칸)으로
// 바뀌었다. 서버가 세션 쿠키(이름만)로 손님 / 로그인을 고르고, 대기 화면 · 서버 HTML · 첫 그림이 같은 손님 배치를 그린다.
// 다음 판(GUEST-STATIC-001 4단계, 2026-10-24 KST): 고르는 자리가 페이지(cookies())에서 middleware로 옮겼다 — 같은 함수(hasSupabaseSessionInJar)로
// 배움 판(/home = 손님 · /home/member = 로그인, × 간체 힌트)을 고르고, 판(ISR)과 그 대기 화면은 쿠키를 읽지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn(() => { throw new Error('배움 갈래에서 Supabase 클라이언트를 만들었다'); }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isError: false, isPending: true, refetch: () => {} }) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null, loading: true }) }));

import { NextRequest } from 'next/server';
import GuestLoading from '../../app/(app)/home/(guest)/loading';
import MemberLoading from '../../app/(app)/home/member/loading';
import { GuestLoginTile } from '../../components/learn/LearnTiles';
import { hasSupabaseSessionInJar } from '../authCookie';
import { middleware } from '../../middleware';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const jar = (...names) => ({ getAll: () => names.map(name => ({ name, value: 'v' })) });
const statuses = (html) => html.match(/role="status"/g) || [];

describe('세션 쿠키 판정(이름만) — 화면과 대기 화면이 같은 함수', () => {
  it('sb-…-auth-token(조각 포함)만 세션, code-verifier · 빈 저장소는 손님', () => {
    expect(hasSupabaseSessionInJar(jar('sb-abc-auth-token'))).toBe(true);
    expect(hasSupabaseSessionInJar(jar('theme', 'sb-abc-auth-token.0'))).toBe(true);
    expect(hasSupabaseSessionInJar(jar('sb-abc-auth-token-code-verifier'))).toBe(false);
    expect(hasSupabaseSessionInJar(jar())).toBe(false);
    expect(hasSupabaseSessionInJar(null)).toBe(false);
  });
});

describe('배움 판 고르기(middleware) — 세션 쿠키 이름 유무 × 간체 힌트', () => {
  const pick = async (cookie, url = '/home') => {
    const res = await middleware(new NextRequest(new URL(url, 'https://manabi.test'), { headers: cookie ? { cookie } : {} }));
    const to = res.headers.get('x-middleware-rewrite');
    return { to: to ? new URL(to).pathname + new URL(to).search : null, next: res.headers.get('x-middleware-next'), setCookie: res.headers.get('set-cookie') };
  };
  it('쿠키 없음 = 손님 판(/home 그대로), 세션 쿠키(조각 포함) = /home/member, code-verifier만은 손님', async () => {
    expect(await pick()).toEqual({ to: null, next: '1', setCookie: null });
    expect((await pick('sb-e2e-auth-token=base64-x')).to).toBe('/home/member');
    expect((await pick('theme=dark; sb-e2e-auth-token.0=base64-x')).to).toBe('/home/member');
    expect((await pick('sb-e2e-auth-token-code-verifier=x')).to).toBeNull();
  });
  it('간체 힌트(값 1)는 /sc 판 — 손님 · 로그인 모두, 다른 값은 무시. 쿼리는 그대로 붙어 간다(판은 읽지 않는다)', async () => {
    expect((await pick('manabi_sc=1')).to).toBe('/home/sc');
    expect((await pick('manabi_sc=0')).to).toBeNull();
    expect((await pick('sb-e2e-auth-token=x; manabi_sc=1')).to).toBe('/home/member/sc');
    expect((await pick('sb-e2e-auth-token=x', '/home?utm_source=t')).to).toBe('/home/member?utm_source=t');
  });
  it('쿠키를 쓰지 않고 Supabase 클라이언트를 만들지 않는다(PUBLIC-CACHE-COOKIE-001 ③)', async () => {
    for (const cookie of [undefined, 'sb-e2e-auth-token=x', 'sb-e2e-auth-token=x; manabi_sc=1']) expect((await pick(cookie)).setCookie).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe('배움 대기 화면 — 손님 / 로그인 골격(판마다 하나, 쿠키를 읽지 않는다)', () => {
  it('손님 판(쿠키 없음): 이어 읽기 · 오늘 문단(맛보기) 한 줄, 아래 로그인 칸 — 알림 한 번 · 링크 0', () => {
    const html = renderToStaticMarkup(createElement(GuestLoading));
    expect(statuses(html)).toHaveLength(1);
    expect(html.startsWith('<span class="skeleton-sr" role="status">배움 화면 불러오는 중…</span>')).toBe(true);
    const grid = sliceBetween(html, '<div class="learn-grid" aria-hidden="true">', null);
    expect(grid.indexOf('learn-resume')).toBeLessThan(grid.indexOf('learn-paragraph'));
    expect(grid.indexOf('learn-paragraph')).toBeLessThan(grid.indexOf('learn-guest'));
    expect(html).toContain('오늘 문단 · 맛보기');
    expect(html).toContain('<a class="learn-tile learn-goal--empty learn-guest"><span><span class="learn-goal__title">로그인하면 여기에 쌓여요</span>');
    expect(html).not.toContain('href='); // [로그인]은 자리표 — 초점 · 이동 없음
    for (const member of ['learn-quad', 'learn-review', 'learn-toplink', 'learn-stat']) expect(html).not.toContain(member);
  });
  it('로그인 판(세션 쿠키 있음): 예전 로그인 배치 골격 그대로', () => {
    const html = renderToStaticMarkup(createElement(MemberLoading));
    expect(html).toContain('learn-quad');
    expect(html).toContain('learn-toplink');
    expect(html).not.toContain('learn-guest');
    // 칩 자리(오너 실기 2026-10-25 KST — 좁은 화면에서 칩이 「현황 전체」에 겹쳤다): 셸 480 이하는 칩이 둘째 줄이라
    // 대기 화면도 같은 줄(빈 .learn-chips, 높이 44)을 먼저 둔다 — 칩이 붙을 때 아래 칸이 밀리지 않게.
    expect(html).toContain('<h1>배움</h1><span class="learn-chips"></span></div><span class="learn-toplink">');
    const css = read('src/components/learn/learn.css');
    expect(css).toContain('.learn-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-width:0;min-height:44px}');
    const narrow = sliceBetween(css, '@container manabi-shell (max-width:480px){', '\n}');
    expect(narrow).toContain('.learn-top__title{display:contents}');
    expect(narrow).toContain('.learn-top .learn-chips{grid-column:1/-1;grid-row:2}');
  });
  it('판 · 대기 화면 · 판 부품은 쿠키를 읽지 않는다 — 고르기는 middleware 한 곳', () => {
    for (const f of ['src/app/(app)/home/layout.jsx', 'src/app/(app)/home/(guest)/page.jsx', 'src/app/(app)/home/(guest)/sc/page.jsx', 'src/app/(app)/home/member/page.jsx',
      'src/app/(app)/home/member/sc/page.jsx', 'src/app/(app)/home/(guest)/loading.jsx', 'src/app/(app)/home/member/loading.jsx', 'src/components/learn/HomeVariant.jsx', 'src/components/learn/HomeSkeleton.jsx']) {
      const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1'); // 주석 제외
      expect(src, f).not.toMatch(/next\/headers|cookies\(|ScFontCookieHint|hasSupabaseSessionInJar|createSupabaseServerClient/);
    }
  });
});

describe('화면 배선 — 서버 HTML · 첫 그림이 손님 배치', () => {
  it('판이 고른 배치를 sessionHint로 넘기고, HomePage 손님 분기는 확인을 기다리지 않는다', () => {
    expect(read('src/middleware.js')).toContain("const member = hasSupabaseSessionInJar(request.cookies), sc = request.cookies.get(SC_HINT_COOKIE)?.value === '1';");
    expect(read('src/components/learn/HomeVariant.jsx')).toContain('<HomePage book={book} sessionHint={member} />');
    expect(read('src/app/(app)/home/(guest)/page.jsx')).toContain('<HomeVariant member={false} sc={false} />');
    expect(read('src/app/(app)/home/member/page.jsx')).toContain('<HomeVariant member sc={false} />');
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain('export default function HomePage({ book = null, bookPromise, sessionHint })');
    expect(home).toContain('const guestLayout = !user && (!authLoading || sessionHint === false);');
    expect(home).toContain('if (guestLayout) {');
  });
  it('손님 화면과 손님 골격이 같은 칸 순서 · 같은 로그인 칸(GuestLoginTile)', () => {
    const guest = sliceBetween(read('src/views/HomePage.jsx'), 'if (guestLayout) {', '</div>;');
    // 이어 읽기 칸은 판본을 받는 안쪽 Suspense(resumeSlot) — 대기 그림은 손님 골격과 같은 <ResumeTile pending />(LCP-UNSUSPEND).
    // 손님 골격의 장식 글자(glyph)는 HOME-GLYPH-LCP-001 — homeResumeGlyph.test.jsx가 지킨다.
    const order = ['{resumeSlot}', "kicker=\"오늘 문단 · 맛보기\" />", "<GuestLoginTile href={authEntryHref('/home')} />"];
    const at = order.map(part => guest.indexOf(part));
    expect(at.every(i => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain('const resumeSlot = <Suspense fallback={<ResumeTile pending glyph={pendingGlyph} />}><ResumeSlot ');
    expect(home).toContain('return <ResumeTile item={resumeItem} pending={resumePending} glyph={pendingGlyph} />;');
    expect(renderToStaticMarkup(createElement(GuestLoginTile, { href: '/auth?from=%2Fhome' })))
      .toContain('<a href="/auth?from=%2Fhome" class="learn-tile learn-goal--empty learn-guest">');
  });
  it('로그인 · 로그아웃 뒤 router.refresh() — 미리 받아 둔 다른 쪽 골격을 버린다(이동 뒤 차례로)', () => {
    expect(read('src/views/AuthPage.jsx')).toMatch(/await signIn\(email, password\);\s*router\.push\(from\);\s*\/\/[^\n]*\n\s*router\.refresh\(\);/);
    // 로그아웃 쪽은 AuthContext 관문 하나(AUTH-ROUTER-REFRESH-001 — accountQueryCache.test 「서버 렌더 관문」): 이동이 먼저, 새로고침은 그린 뒤 effect.
    // 머리말에는 로그아웃 갈래가 없다(죽은 경로 삭제) — 로그아웃 쪽 refresh는 AuthContext 관문 하나(accountRouterRefresh.test).
    expect(read('src/components/Layout.jsx').replace(/(^|[^:'"`])\/\/[^\n]*/gm, '$1')).not.toMatch(/signOut|router\.refresh\(/);
    expect(read('src/components/AccountSettings.jsx')).toContain('onClick={() => signOut() /* 서버 렌더 버리기는 AuthContext 관문(AUTH-ROUTER-REFRESH-001) */}');
    expect(read('src/app/providers.jsx')).toContain('onAccountLeft={() => router.refresh()}');
  });
});
