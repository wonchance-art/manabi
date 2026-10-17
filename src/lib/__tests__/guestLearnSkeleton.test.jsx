// 손님 배움 골격(B1 — 오너 승인 목업 ① 「권장대로」, 2026-10-17 KST).
// 손님이 배움에 들어오면 로그인 배치 골격(현황 칸 · 단어 복습)이 0.7초 보였다가 손님 화면(이어 읽기 · 오늘 문단 · 로그인 칸)으로
// 바뀌었다. 서버가 세션 쿠키(이름만)로 손님 / 로그인을 고르고, 대기 화면 · 서버 HTML · 첫 그림이 같은 손님 배치를 그린다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
const h = vi.hoisted(() => ({ cookies: [] }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => h.cookies }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined, isError: false, isPending: true, refetch: () => {} }) }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: null, loading: true }) }));

import HomeLoading from '../../app/(app)/home/loading';
import { GuestLoginTile } from '../../components/learn/LearnTiles';
import { hasSupabaseSessionInJar } from '../authCookie';

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

describe('배움 대기 화면 — 손님 / 로그인 골격', () => {
  it('손님(쿠키 없음): 이어 읽기 · 오늘 문단(맛보기) 한 줄, 아래 로그인 칸 — 알림 한 번 · 링크 0', async () => {
    h.cookies = [];
    const html = renderToStaticMarkup(await HomeLoading());
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
  it('로그인(세션 쿠키 있음): 예전 로그인 배치 골격 그대로', async () => {
    h.cookies = [{ name: 'sb-e2e-auth-token', value: 'x' }];
    const html = renderToStaticMarkup(await HomeLoading());
    expect(html).toContain('learn-quad');
    expect(html).toContain('learn-toplink');
    expect(html).not.toContain('learn-guest');
    h.cookies = [];
  });
});

describe('화면 배선 — 서버 HTML · 첫 그림이 손님 배치', () => {
  it('page.jsx가 같은 판정을 sessionHint로 넘기고, HomePage 손님 분기는 확인을 기다리지 않는다', () => {
    const page = read('src/app/(app)/home/page.jsx');
    expect(page).toContain("export const dynamic = 'force-dynamic';"); // 쿠키를 읽어도 새 동적 비용 없음
    expect(page).toContain('const sessionHint = hasSupabaseSessionInJar(await cookies());');
    expect(page).toContain('<HomePage book={book} sessionHint={sessionHint} />');
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain('export default function HomePage({ book = null, sessionHint })');
    expect(home).toContain('if (!user && (!authLoading || sessionHint === false)) {');
    expect(read('src/app/(app)/home/loading.jsx')).toContain('if (!hasSupabaseSessionInJar(await cookies())) {');
  });
  it('손님 화면과 손님 골격이 같은 칸 순서 · 같은 로그인 칸(GuestLoginTile)', () => {
    const guest = sliceBetween(read('src/views/HomePage.jsx'), 'if (!user && (!authLoading || sessionHint === false)) {', '</div>;');
    const order = ['<ResumeTile item={resumeItem} pending={resumePending} />', "kicker=\"오늘 문단 · 맛보기\" />", "<GuestLoginTile href={authEntryHref('/home')} />"];
    const at = order.map(part => guest.indexOf(part));
    expect(at.every(i => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(renderToStaticMarkup(createElement(GuestLoginTile, { href: '/auth?from=%2Fhome' })))
      .toContain('<a href="/auth?from=%2Fhome" class="learn-tile learn-goal--empty learn-guest">');
  });
  it('로그인 · 로그아웃 뒤 router.refresh() — 미리 받아 둔 다른 쪽 골격을 버린다(이동 뒤 차례로)', () => {
    expect(read('src/views/AuthPage.jsx')).toMatch(/await signIn\(email, password\);\s*router\.push\(from\);\s*\/\/[^\n]*\n\s*router\.refresh\(\);/);
    // 로그아웃 쪽은 AuthContext 관문 하나(AUTH-ROUTER-REFRESH-001 — accountQueryCache.test 「서버 렌더 관문」): 이동이 먼저, 새로고침은 그린 뒤 effect.
    // 머리말에는 로그아웃 갈래가 없다(죽은 경로 삭제) — 로그아웃 쪽 refresh는 AuthContext 관문 하나(accountRouterRefresh.test).
    expect(read('src/components/Layout.jsx').replace(/(^|[^:'"`])\/\/[^\n]*/gm, '$1')).not.toMatch(/signOut|router\.refresh\(/);
    expect(read('src/views/MyPage.jsx')).toContain('onClick={() => signOut() /* 서버 렌더 버리기는 AuthContext 관문(AUTH-ROUTER-REFRESH-001) */}');
    expect(read('src/app/providers.jsx')).toContain('onAccountLeft={() => router.refresh()}');
  });
});
