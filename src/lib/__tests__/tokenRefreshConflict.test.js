import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INVALID_SESSION_CODES, authCookieRemovals, invalidSessionError, withoutServerSignOut } from '../authCookieGuard';

// TOKEN-REFRESH-409-001 — 운영 runtime error 「AuthApiError: Too many concurrent token refresh requests on the same session or
// refresh token」(409, /api/learning/vocabulary, 2026-10-10 · 10-16). 접근 토큰이 만료된 채 한 화면이 학습 API를 동시에 부르면
// route handler마다 같은 refresh token으로 갱신하고, 진 요청은 409를 받는다. 그때 supabase-js가 세션을 지우고(SIGNED_OUT)
// @supabase/ssr가 그 응답에 인증 쿠키 삭제(Set-Cookie 값 '' · maxAge 0)를 싣는다 — 이긴 갱신보다 늦게 닿으면 로그아웃.
// 계약: 진 요청은 그 요청만 401이고 인증 쿠키를 건드리지 않는다. 이긴 갱신은 새 쿠키를 그대로 심는다(남는 조각 지우기 포함).
const jar = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://e2e.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  return { cookies: new Map(), writes: [] };
});
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [...jar.cookies].map(([name, value]) => ({ name, value })),
    get: (name) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name) } : undefined),
    set: (name, value, options) => { jar.writes.push({ name, value, maxAge: options?.maxAge }); },
  }),
}));

import { requireAdmin, requireUser } from '../supabaseServer';

const ROOT = path.resolve(__dirname, '../../..');
const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
/** 브라우저가 심는 모양(@supabase/ssr — base64- 접두 · 조각 .0/.1)의 만료된 쿠키 세션. */
function expiredSession(offset = -60) {
  jar.cookies.clear(); jar.writes.length = 0;
  const exp = Math.floor(Date.now() / 1000) + offset;
  const session = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: 'u1', exp, aud: 'authenticated' })}.sig`, refresh_token: 'r-old', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: 'u1' } };
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const half = Math.ceil(value.length / 2);
  jar.cookies.set('sb-e2e-auth-token.0', value.slice(0, half));
  jar.cookies.set('sb-e2e-auth-token.1', value.slice(half));
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const authCookieWrites = () => jar.writes.filter((w) => /^sb-e2e-auth-token/.test(w.name));

afterEach(() => { vi.unstubAllGlobals(); });

describe('동시 갱신에서 진 요청(409) — 그 요청만 401, 인증 쿠키는 그대로', () => {
  it('Auth가 409 conflict로 거절하면 requireUser는 401이고 인증 쿠키 삭제를 내보내지 않는다', async () => {
    expiredSession();
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => {
      calls.push(`${init?.method || 'GET'} ${new URL(String(url)).pathname}${new URL(String(url)).search}`);
      return json({ code: 'conflict', error_code: 'conflict', msg: 'Too many concurrent token refresh requests on the same session or refresh token' }, 409);
    });
    const result = await requireUser();
    expect(result).toEqual({ error: '로그인이 필요해요.', status: 401 });
    expect(calls.some((c) => c.startsWith('POST /auth/v1/token') && c.includes('grant_type=refresh_token'))).toBe(true); // 실제로 갱신을 시도했다
    expect(authCookieWrites()).toEqual([]);
  });

  it('갱신이 이기면 새 토큰 쿠키를 심는다 — 가드는 갱신 성공 묶음을 막지 않는다', async () => {
    expiredSession();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const fresh = { access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: 'u1', exp, aud: 'authenticated' })}.sig`, refresh_token: 'r-new', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated' } };
    vi.stubGlobal('fetch', async (url) => {
      const { pathname } = new URL(String(url));
      if (pathname === '/auth/v1/token') return json(fresh);
      if (pathname === '/auth/v1/user') return json({ id: 'u1', aud: 'authenticated' });
      return json({ message: 'unexpected' }, 500);
    });
    const result = await requireUser();
    expect(result.user?.id).toBe('u1');
    const writes = authCookieWrites();
    expect(writes.some((w) => w.value && w.maxAge > 0)).toBe(true); // 새 세션
  });
});

// 진짜 무효 세션(TOKEN-REFRESH-409-001 후속 · a775 리뷰): 409와 달리 다시 살아나지 않는 세션이면 서버가 인증 쿠키를 지운다 —
// 지우지 않으면 그 브라우저는 접근 토큰 수명 동안 로그인한 것처럼 보이는데 서버 API는 모두 401이었다. 실물 @supabase/ssr · supabase-js +
// 가짜 Auth 응답(GoTrue 모양 { code, error_code, msg }). 코드 목록 정본: @supabase/auth-js 2.100 lib/error-codes.d.ts.
describe('진짜 무효 세션이면 인증 쿠키를 지운다 — 409 · 재사용 · bad_jwt · 5xx는 지우지 않는다', () => {
  const removedChunks = () => authCookieWrites().filter((w) => w.value === '' && w.maxAge === 0).map((w) => w.name).sort();
  const refreshFails = (status, code) => vi.stubGlobal('fetch', async (url) => {
    const { pathname } = new URL(String(url));
    if (pathname === '/auth/v1/token') return json({ code: status, error_code: code, msg: code }, status);
    return json({ message: 'unexpected' }, 500);
  });
  const userFails = (status, code) => vi.stubGlobal('fetch', async (url) => {
    const { pathname } = new URL(String(url));
    if (pathname === '/auth/v1/user') return json({ code: status, error_code: code, msg: code }, status);
    return json({ message: 'unexpected' }, 500);
  });
  for (const [label, arrange] of [
    ['갱신: refresh_token_not_found', () => { expiredSession(); refreshFails(400, 'refresh_token_not_found'); }],
    ['갱신: session_expired', () => { expiredSession(); refreshFails(400, 'session_expired'); }],
    ['토큰 살아 있음 · /user: session_not_found(다른 기기 로그아웃)', () => { expiredSession(3600); userFails(403, 'session_not_found'); }],
    ['토큰 살아 있음 · /user: user_banned', () => { expiredSession(3600); userFails(403, 'user_banned'); }],
    ['토큰 살아 있음 · /user: user_not_found(계정 삭제)', () => { expiredSession(3600); userFails(404, 'user_not_found'); }],
  ]) {
    it(`지운다 — ${label}`, async () => {
      arrange();
      expect(await requireUser()).toEqual({ error: '로그인이 필요해요.', status: 401 });
      expect(removedChunks()).toEqual(['sb-e2e-auth-token.0', 'sb-e2e-auth-token.1']);
    });
  }
  for (const [label, arrange] of [
    ['갱신: conflict(409 동시 갱신)', () => { expiredSession(); refreshFails(409, 'conflict'); }],
    ['갱신: refresh_token_already_used', () => { expiredSession(); refreshFails(400, 'refresh_token_already_used'); }],
    ['토큰 살아 있음 · /user: bad_jwt', () => { expiredSession(3600); userFails(403, 'bad_jwt'); }],
    ['갱신: 503(재시도 가능)', () => { expiredSession(); refreshFails(503, 'unexpected_failure'); }],
  ]) {
    it(`지우지 않는다 — ${label}`, async () => {
      arrange();
      expect((await requireUser()).status).toBe(401);
      expect(authCookieWrites()).toEqual([]);
    });
  }
  it('requireAdmin도 같은 판정으로 지운다', async () => {
    expiredSession(); refreshFails(400, 'refresh_token_not_found');
    expect((await requireAdmin()).status).toBe(401);
    expect(removedChunks()).toEqual(['sb-e2e-auth-token.0', 'sb-e2e-auth-token.1']);
  });
  it('판정 · 쓰기 모양: 코드 목록은 auth-js ErrorCode 안의 것만 · 삭제 속성은 @supabase/ssr와 같다', () => {
    const codes = fs.readFileSync(path.join(ROOT, 'node_modules/@supabase/auth-js/dist/main/lib/error-codes.d.ts'), 'utf8');
    for (const code of [...INVALID_SESSION_CODES, 'session_not_found', 'conflict', 'refresh_token_already_used', 'bad_jwt']) expect(codes, code).toContain(`'${code}'`);
    expect(INVALID_SESSION_CODES).not.toContain('conflict');
    expect(INVALID_SESSION_CODES).not.toContain('refresh_token_already_used');
    expect(invalidSessionError({ name: 'AuthSessionMissingError' })).toBe(true);
    expect(invalidSessionError({ name: 'AuthApiError', code: 'conflict' })).toBe(false);
    expect(invalidSessionError(null)).toBe(false);
    expect(authCookieRemovals(['sb-e2e-auth-token', 'sb-e2e-auth-token.1', 'sb-e2e-auth-token-code-verifier', 'other']))
      .toEqual(['sb-e2e-auth-token', 'sb-e2e-auth-token.1'].map((name) => ({ name, value: '', options: { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 0 } })));
  });
});

describe('withoutServerSignOut — 지우기만 하는 묶음만 버린다', () => {
  const del = (name) => ({ name, value: '', options: { maxAge: 0 } });
  const put = (name, value) => ({ name, value, options: { maxAge: 34560000 } });
  it('인증 쿠키를 지우기만 하면 그 인증 쿠키 삭제는 빼고, 다른 쿠키 쓰기는 남긴다', () => {
    expect(withoutServerSignOut([del('sb-e2e-auth-token.0'), del('sb-e2e-auth-token.1'), del('sb-e2e-auth-token-code-verifier')])).toEqual([del('sb-e2e-auth-token-code-verifier')]);
    expect(withoutServerSignOut([del('sb-e2e-auth-token')])).toEqual([]);
  });
  it('새 토큰을 심는 묶음은 남는 조각 지우기까지 그대로 — 지우지 않으면 옛 조각이 붙어 세션이 깨진다', () => {
    const batch = [del('sb-e2e-auth-token.2'), put('sb-e2e-auth-token.0', 'a'), put('sb-e2e-auth-token.1', 'b')];
    expect(withoutServerSignOut(batch)).toBe(batch);
    expect(withoutServerSignOut([])).toEqual([]);
    expect(withoutServerSignOut([put('other', 'x')])).toEqual([put('other', 'x')]);
  });
});

describe('배선 — 서버의 쿠키 세션 클라이언트 두 곳이 같은 가드를 쓴다 · 서버 로그아웃 0', () => {
  it('쿠키를 쓰는 서버 createServerClient는 모두 가드를 거친다 — setAll() {}(서버 컴포넌트, 쓰기 없음)만 예외', () => {
    const offenders = [];
    const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(full); } else if (/\.(m?js|jsx)$/.test(e.name)) {
      const src = fs.readFileSync(full, 'utf8');
      if (!/createServerClient\(/.test(src)) continue;
      const writes = /setAll\s*\(\s*cookiesToSet\s*\)/.test(src);
      if (writes && !/withoutServerSignOut\(cookiesToSet\)/.test(src)) offenders.push(path.relative(ROOT, full));
    } } };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
    // auth/callback · auth/confirm(code 교환 · OTP 확인)도 같은 규칙 — 새 세션을 심는 묶음은 그대로 지나간다
    for (const file of ['src/app/auth/callback/route.js', 'src/app/auth/confirm/route.js']) expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).toContain('pendingCookies.push(...withoutServerSignOut(cookiesToSet));');
  });
  it('supabaseServer · middleware의 setAll이 withoutServerSignOut을 거친다', () => {
    expect(fs.readFileSync(path.join(ROOT, 'src/lib/supabaseServer.js'), 'utf8')).toContain('withoutServerSignOut(cookiesToSet).forEach(({ name, value, options }) =>');
    expect(fs.readFileSync(path.join(ROOT, 'src/middleware.js'), 'utf8')).toContain('withoutServerSignOut(cookiesToSet).forEach(({ name, value, options }) =>');
  });
  it('서버 코드(app/api · lib/server · middleware · supabaseServer)는 auth.signOut을 부르지 않는다 — 가드의 전제', () => {
    const offenders = [];
    const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); } else if (/\.(m?js|jsx)$/.test(e.name) && /auth\.signOut\(/.test(fs.readFileSync(full, 'utf8'))) offenders.push(path.relative(ROOT, full)); } };
    walk(path.join(ROOT, 'src/app/api')); walk(path.join(ROOT, 'src/lib/server'));
    for (const file of ['src/middleware.js', 'src/lib/supabaseServer.js']) if (/auth\.signOut\(/.test(fs.readFileSync(path.join(ROOT, file), 'utf8'))) offenders.push(file);
    expect(offenders).toEqual([]);
  });
});
