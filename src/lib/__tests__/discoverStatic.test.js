// GUEST-STATIC-001 2단계 — 산책(/discover, 쿼리 없음)은 ISR 5분. 갈래는 middleware가 나누고, 갈래마다 한 판씩 공유 캐시에 맡긴다.
//  · /discover?view=reading(+ lang · q 등)   → /discover/reading(동적 — 고르기 줄 세션 힌트 DISCOVER-CHIP-CLS-001)
//  · /discover + 간체 힌트 쿠키(manabi_sc=1) → /discover/sc(같은 화면 + 간체 스타일시트 미리 걸기, ISR)
//  · /discover                              → 그대로(ISR)
//  · 내부 판 경로는 matcher 밖이다 — rewrite된 요청이 middleware를 다시 지나므로 거기서 되돌리면 판을 고른 요청까지 돌아간다(e2e 빌드 실측 307 루프).
// middleware는 이 갈래에서 쿠키를 읽기만 한다(이름 · 값 '1') — Supabase 클라이언트를 만들지 않고 쿠키를 쓰지 않는다(PUBLIC-CACHE-COOKIE-001 ③).
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn(() => { throw new Error('산책 갈래에서 Supabase 클라이언트를 만들었다'); }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
import { config, middleware } from '@/middleware';

const ORIGIN = 'https://manabi.test';
const run = (url, { cookie, rsc } = {}) => {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (rsc) headers.set('rsc', '1');
  return middleware(new NextRequest(new URL(url, ORIGIN), { headers }));
};
const rewrite = (res) => { const to = res.headers.get('x-middleware-rewrite'); return to ? new URL(to).pathname + new URL(to).search : null; };
const read = (f) => fs.readFileSync(f, 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

describe('산책 갈래(middleware)', () => {
  it('쿼리 없는 산책은 그대로 — 손님 · 로그인 · 세션 쿠키가 있어도 같은 판(계정으로 가르지 않는다)', async () => {
    for (const cookie of [undefined, 'sb-e2e-auth-token=base64-x']) {
      const res = await run('/discover', { cookie });
      expect(rewrite(res)).toBeNull();
      expect(res.headers.get('x-middleware-next')).toBe('1');
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });
  it('「함께 읽는 글」은 쿼리를 그대로 들고 /discover/reading으로', async () => {
    expect(rewrite(await run('/discover?view=reading'))).toBe('/discover/reading?view=reading');
    expect(rewrite(await run('/discover?view=reading&lang=French&q=school&shown=40'))).toBe('/discover/reading?view=reading&lang=French&q=school&shown=40');
    expect(rewrite(await run('/discover?view=reading', { cookie: 'manabi_sc=1' }))).toBe('/discover/reading?view=reading'); // 힌트는 그 화면이 직접 읽는다
  });
  it('간체 힌트 쿠키(값 1)만 /discover/sc로 — 다른 값 · 세션 쿠키는 기본 판', async () => {
    expect(rewrite(await run('/discover', { cookie: 'manabi_sc=1' }))).toBe('/discover/sc');
    expect(rewrite(await run('/discover', { cookie: 'manabi_sc=0' }))).toBeNull();
    expect(rewrite(await run('/discover', { cookie: 'sb-e2e-auth-token=x; manabi_sc=1' }))).toBe('/discover/sc');
  });
  it('Supabase 클라이언트를 만들지 않는다 · matcher에는 /discover만(내부 판 경로는 밖 — 다시 지나며 되돌리지 않게)', () => {
    expect(createServerClient).not.toHaveBeenCalled();
    expect(config.matcher).toContain('/discover');
    for (const p of ['/discover/reading', '/discover/sc', '/discover/:path*']) expect(config.matcher).not.toContain(p);
  });
});

describe('산책 판 — 쿠키를 읽지 않는 두 판(ISR 300)과 쿠키를 읽는 동적 갈래', () => {
  const base = 'src/app/(app)/discover';
  it('기본 판 · 간체 판은 revalidate 300, 쿠키 · searchParams 없음 — 간체 판은 링크를 늘 싣는다', () => {
    for (const f of [`${base}/page.jsx`, `${base}/sc/page.jsx`]) {
      const src = code(f);
      expect(src, f).toContain('export const revalidate = 300;');
      expect(src, f).not.toMatch(/next\/headers|searchParams|force-dynamic/);
    }
    expect(read(`${base}/sc/page.jsx`)).toContain('return <><ScFontLink /><DiscoverPage /></>;');
  });
  it('세그먼트 layout은 없다(있으면 쿠키를 읽어 두 판을 동적으로 만들 수 있다) — 간체 힌트는 동적 화면이 직접 단다', () => {
    expect(fs.existsSync(`${base}/layout.jsx`)).toBe(false);
    for (const f of [`${base}/reading/page.jsx`, `${base}/classics/page.jsx`]) {
      expect(read(f), f).toContain("export const dynamic = 'force-dynamic';");
      expect(read(f), f).toContain('<ScFontCookieHint />');
    }
  });
  it('ISR 판은 서가 조회 실패를 굳히지 않는다 — 다시 만들 때 실패면 던져 앞 판을 둔다(빌드 때는 그리기)', () => {
    expect(read(`${base}/page.jsx`)).toContain("if ((classicsShelf.failed || artShelf.failed) && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('discover_shelf_unavailable');");
  });
});

// 3단계 — 책장(/lessons)도 같은 방식이다: ?lang=<언어>는 언어 판(/lessons/lang/<언어>, ISR 3600)으로, 나머지는 기본 판.
describe('책장 갈래(middleware)', () => {
  it('알려진 언어만 언어 판으로 — 모르는 언어 · 쿼리 없음은 기본 판(옛 동작처럼 「전체 시리즈」)', async () => {
    expect(rewrite(await run('/lessons?lang=Japanese'))).toBe('/lessons/lang/Japanese?lang=Japanese');
    expect(rewrite(await run('/lessons?lang=French', { cookie: 'sb-e2e-auth-token=x' }))).toBe('/lessons/lang/French?lang=French');
    for (const url of ['/lessons', '/lessons?lang=Korean', '/lessons?lang=']) {
      const res = await run(url);
      expect(rewrite(res), url).toBeNull();
      expect(res.headers.get('x-middleware-next'), url).toBe('1');
    }
  });
  it('matcher에는 /lessons만 — 언어 판 경로는 밖(rewrite된 요청이 다시 지나도 되돌리지 않게)', () => {
    expect(config.matcher).toContain('/lessons');
    expect(config.matcher.filter(p => p.startsWith('/lessons/'))).toEqual([]);
  });
});
