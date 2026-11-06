import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { hasSupabaseSessionCookie, hasSupabaseSessionInJar } from '../authCookie';
import { withoutServerSignOut } from '../authCookieGuard';

// SUPA-SSR-0127 — @supabase/ssr 0.9 → 0.12.7(supabase-js 2.100 → 2.114) 판 올림의 쿠키 계약. 실물 SDK + 가짜 Auth 응답.
// 이 앱이 쿠키 이름 · 형식에 기대는 자리(authCookie의 세션 판정 · authCookieGuard의 서버 로그아웃 가드 · cookieAccessToken의
// 직접 읽기)가 SDK 판 올림으로 조용히 깨지면 「로그인했는데 새로고침하면 손님」이나 「로그인한 사용자가 전부 로그아웃」으로 나타난다.
//   ① 옛 판(0.9)이 심어 둔 세션 쿠키(base64- 접두 · .0/.1 조각)를 새 판이 네트워크 · 다시 쓰기 없이 그대로 읽는다(기존 로그인 유지)
//   ② 옛 판 verifier 쿠키 하나만 있어도 콜백의 code 교환이 된다(배포를 걸친 OAuth · 메일 PKCE)
//   ③ auth-js 2.111의 PKCE 흐름별 칸(`-flow-<id>-code-verifier`) · 목록(`-flows-code-verifier`) 쿠키는 세션이 아니다 — 세션 판정 ·
//      서버 로그아웃 가드 모두 건드리지 않는다
//   ④ 브라우저 로그아웃은 세션 쿠키 조각을 모두 지운다(maxAge 0)
const URL_ = 'https://e2e.supabase.co';
const KEY = 'e2e-anon-key';
const NAME = 'sb-e2e-auth-token';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const enc = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

function sessionFixture(tag) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${enc({ alg: 'HS256' })}.${enc({ sub: USER_ID, exp, aud: 'authenticated', tag })}.sig`,
    refresh_token: `r-${tag}`, expires_in: 3600, expires_at: exp, token_type: 'bearer',
    // 4 kB 한도를 넘겨 조각(.0/.1)으로 심기게 한다 — 실제 OAuth 사용자 정보(아바타 · 공급자 메타)도 이 크기를 넘는다.
    user: { id: USER_ID, aud: 'authenticated', email: 'a@example.com', user_metadata: { pad: 'x'.repeat(3500) }, app_metadata: { provider: 'google' } },
  };
}

/** 0.9가 심던 그대로의 모양 — `base64-` + base64url(JSON), 3180자마다 `.0`, `.1` …(chunker · base64url 소스는 0.9와 0.12.7이 같다). */
function legacyChunkedCookies(value) {
  const encoded = `base64-${Buffer.from(JSON.stringify(value)).toString('base64url')}`;
  const chunks = [];
  for (let i = 0; i < encoded.length; i += 3180) chunks.push(encoded.slice(i, i + 3180));
  return chunks.length === 1 ? [[NAME, chunks[0]]] : chunks.map((chunk, i) => [`${NAME}.${i}`, chunk]);
}

function cookieJar(entries = []) {
  const jar = new Map(entries);
  const writes = [];
  const cookies = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list, headers) => {
      writes.push({ list, headers });
      for (const { name, value, options } of list) {
        if (value === '' || options?.maxAge === 0) jar.delete(name); else jar.set(name, value);
      }
    },
  };
  return { jar, writes, cookies, names: () => [...jar.keys()].sort() };
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function fakeAuth() {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    const { pathname, search } = new URL(String(url));
    calls.push({ route: `${init?.method || 'GET'} ${pathname}${search}`, body: init?.body ? JSON.parse(init.body) : null });
    if (pathname === '/auth/v1/token') return json(sessionFixture('new'));
    if (pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    return json({ message: 'unexpected' }, 500);
  });
  return calls;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('SUPA-SSR-0127 — 옛 판 쿠키를 새 판이 그대로 읽는다', () => {
  it('① 0.9 모양의 조각 세션 쿠키: getSession이 네트워크 0 · 쿠키 다시 쓰기 0으로 같은 세션을 돌려준다', async () => {
    const calls = fakeAuth();
    const old = sessionFixture('old');
    const { cookies, writes, names } = cookieJar(legacyChunkedCookies(old));
    expect(names()).toEqual([`${NAME}.0`, `${NAME}.1`]);
    const { data, error } = await createServerClient(URL_, KEY, { cookies }).auth.getSession();
    expect(error).toBeNull();
    expect(data.session?.access_token).toBe(old.access_token);
    expect(data.session?.refresh_token).toBe('r-old');
    expect(calls).toEqual([]);
    expect(writes).toEqual([]); // 0.12.1부터 바뀌지 않은 쿠키는 다시 쓰지 않는다 — 읽기만으로 Set-Cookie가 생기지 않는다
  });

  it('② 옛 판 verifier 쿠키만 있어도 서버 콜백의 code 교환이 그 verifier로 된다', async () => {
    const calls = fakeAuth();
    const verifier = 'legacy-verifier-0123456789abcdefghijklmnopqrstuvwxyz-ABCDEFG';
    const { cookies, writes, names } = cookieJar([[`${NAME}-code-verifier`, `base64-${enc(verifier)}`]]);
    const { error } = await createServerClient(URL_, KEY, { cookies }).auth.exchangeCodeForSession('code-1');
    expect(error).toBeNull();
    expect(calls.map((c) => c.route)).toEqual(['POST /auth/v1/token?grant_type=pkce']);
    expect(calls[0].body.code_verifier).toBe(verifier);
    expect(names()).toEqual([`${NAME}.0`, `${NAME}.1`]); // verifier는 지우고 새 세션 조각을 심었다
    expect(hasSupabaseSessionInJar({ getAll: cookies.getAll })).toBe(true);
    // 0.10부터 첫 쿠키 쓰기에 캐시 금지 헤더가 함께 온다 — 콜백 응답은 따로 Cache-Control: private, no-store를 건다.
    expect(writes[0].headers).toMatchObject({ 'Cache-Control': expect.stringContaining('no-store') });
  });
});

describe('SUPA-SSR-0127 — PKCE 흐름별 칸 쿠키는 세션이 아니다', () => {
  it('③ OAuth 시작이 심는 쿠키(고정 verifier · 흐름별 칸 · 목록): 세션 판정 false, 서버 로그아웃 가드는 그대로 통과', async () => {
    fakeAuth();
    const { cookies, writes, names } = cookieJar();
    const { data } = await createServerClient(URL_, KEY, { cookies }).auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: 'http://localhost:3100/auth/callback', skipBrowserRedirect: true },
    });
    // 실험 옵션(appendPkceFlowIdToRedirects)을 켜지 않았다 — 콜백 주소에 sb_flow_id가 없고 교환은 고정 verifier 칸을 읽는다.
    expect(data.url).not.toMatch(/sb_flow_id/);
    const written = names();
    expect(written).toContain(`${NAME}-code-verifier`);
    expect(written).toContain(`${NAME}-flows-code-verifier`);
    expect(written.some((name) => /^sb-e2e-auth-token-flow-[0-9a-f]{32}-code-verifier$/.test(name))).toBe(true);
    for (const name of written) expect(hasSupabaseSessionCookie(`${name}=v`), name).toBe(false);
    expect(hasSupabaseSessionInJar({ getAll: cookies.getAll })).toBe(false);
    // 칸 쿠키 지우기(0.12.4 — 서버에서 바로 내보낸다)를 가드가 「서버 로그아웃」으로 오인해 버리지 않는다.
    const removals = written.map((name) => ({ name, value: '', options: { maxAge: 0 } }));
    expect(withoutServerSignOut(removals)).toEqual(removals);
    for (const { list } of writes) expect(withoutServerSignOut(list)).toEqual(list);
  });
});

describe('SUPA-SSR-0127 — 브라우저 로그아웃은 세션 쿠키를 지운다', () => {
  it('④ 옛 판 조각 세션에서 signOut: logout 요청 후 .0/.1 모두 maxAge 0으로 지우고 세션 쿠키가 남지 않는다', async () => {
    const calls = fakeAuth();
    const { cookies, writes, names } = cookieJar(legacyChunkedCookies(sessionFixture('old')));
    const client = createBrowserClient(URL_, KEY, { isSingleton: false, cookies });
    const { error } = await client.auth.signOut();
    expect(error).toBeNull();
    expect(calls.map((c) => c.route)).toEqual(['POST /auth/v1/logout?scope=global']);
    const removed = writes.flatMap(({ list }) => list).filter(({ value, options }) => value === '' && options?.maxAge === 0).map(({ name }) => name).sort();
    expect(removed).toEqual([`${NAME}.0`, `${NAME}.1`]);
    expect(names()).toEqual([]);
  });
});
