import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const ssr = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://e2e.supabase.co';
  return { auth: null, jar: new Map(), created: 0 };
});
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [...ssr.jar].map(([name, value]) => ({ name, value })), get: (name) => (ssr.jar.has(name) ? { name, value: ssr.jar.get(name) } : undefined), set: () => {} }) }));
// 쿠키 조각 합치기 · base64 풀기는 실물(@supabase/ssr) 그대로, 클라이언트 생성만 가짜로 센다.
vi.mock('@supabase/ssr', async (importOriginal) => ({ ...(await importOriginal()), createServerClient: () => { ssr.created += 1; return { auth: ssr.auth }; } }));

import { requireUserClaims } from '../supabaseServer';
import { fetchConversations } from '../conversation/conversationLibrary';
import { filterActiveSources } from '../libraryOperations';

// LIBRARY-PREFETCH-002 — 서재 미리 받기의 서버 대기를 줄인다.
// ⑴ 신원은 JWT 서명을 서버에서 바로 검증(getClaims — 프로젝트 JWKS가 ES256 비대칭 키, 2026-10-17 KST 확인) — 인증 왕복 0.
//    만료 · 서명 불일치 · 세션 없음은 requireUser처럼 { error } → 미리 받기 null → 지금처럼 브라우저가 받는다.
// ⑵ 대화 조회의 두 왕복(대화 행 → 숨긴 항목)을 동시에 — 브라우저와 서버가 같은 fetchConversations.
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** ES256 JWT 한 장과 그 공개 JWKS. */
function es256({ exp = Math.floor(Date.now() / 1000) + 3600, sub = 'u1' } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'ES256', use: 'sig', key_ops: ['verify'] };
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const body = `${enc({ alg: 'ES256', typ: 'JWT', kid: 'test-kid' })}.${enc({ sub, aud: 'authenticated', role: 'authenticated', exp, iat: exp - 3600 })}`;
  const sig = sign('sha256', Buffer.from(body), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return { token: `${body}.${sig}`, jwk };
}
/** supabase-js 실물 + 가짜 네트워크 — 어떤 경로가 몇 번 불렸는지 센다. */
function realClient(jwk) {
  const calls = [];
  const fetch = async (url) => {
    const pathname = new URL(String(url)).pathname;
    calls.push(pathname);
    if (pathname.endsWith('/.well-known/jwks.json')) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ message: 'network not expected' }), { status: 500, headers: { 'content-type': 'application/json' } });
  };
  const client = createClient('https://jwks-test.supabase.co', 'anon', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
  return { client, calls };
}

/** 브라우저가 심는 모양 그대로(@supabase/ssr — base64- 접두 · 조각 .0/.1) 쿠키 세션을 넣는다. expIn = 남은 초. */
function setCookieSession(expIn, { chunked = true } = {}) {
  ssr.jar.clear();
  const exp = Math.floor(Date.now() / 1000) + expIn;
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const session = { access_token: `${enc({ alg: 'ES256', kid: 'k' })}.${enc({ sub: 'u1', exp })}.sig`, refresh_token: 'r', expires_at: exp, token_type: 'bearer', user: { id: 'u1' } };
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  if (!chunked) { ssr.jar.set('sb-e2e-auth-token', value); return; }
  const half = Math.ceil(value.length / 2);
  ssr.jar.set('sb-e2e-auth-token.0', value.slice(0, half));
  ssr.jar.set('sb-e2e-auth-token.1', value.slice(half));
}

describe('⓪ 미리 받기는 토큰 갱신을 절대 일으키지 않는다(서버 컴포넌트는 새 쿠키를 못 쓴다 → refresh token 재사용 감지)', () => {
  for (const [label, expIn] of [['만료됨', -30], ['60초 안에 만료', 60], ['갱신 여유(90초) 안', 100], ['쿠키 없음', null]]) {
    it(`${label} → 인증 · 네트워크 호출 0, 클라이언트도 만들지 않고 { error }`, async () => {
      if (expIn == null) ssr.jar.clear(); else setCookieSession(expIn);
      ssr.created = 0;
      ssr.auth = { getClaims: vi.fn(), getUser: vi.fn(), getSession: vi.fn(), refreshSession: vi.fn() };
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      expect(await requireUserClaims()).toEqual({ error: '로그인이 필요해요.', status: 401 });
      expect(ssr.created).toBe(0);
      for (const fn of Object.values(ssr.auth)) expect(fn).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  }
  it('만료 판정은 쿠키 세션 expires_at과 토큰 exp 중 이른 쪽 · 조각 없는 한 덩어리 쿠키도 같은 결과', async () => {
    const { cookieAccessToken, PREFETCH_TOKEN_MARGIN_SEC } = await import('../supabaseServer');
    expect(PREFETCH_TOKEN_MARGIN_SEC).toBeGreaterThan(90);
    setCookieSession(3600, { chunked: false });
    const one = await cookieAccessToken();
    setCookieSession(3600);
    const chunked = await cookieAccessToken();
    expect(one.exp).toBe(chunked.exp);
    expect(one.exp * 1000 - Date.now()).toBeGreaterThan(3500 * 1000);
  });
  it('미리 받기 전체: 만료가 가까우면 null(브라우저가 받고 골격) — 쿼리도 띄우지 않는다', async () => {
    const { prefetchLibraryShelf } = await import('../server/libraryPrefetch');
    setCookieSession(30);
    ssr.created = 0;
    expect(await prefetchLibraryShelf({})).toBeNull();
    expect(ssr.created).toBe(0);
  });
});

describe('⑴ 신원 — 인증 서버 왕복 없이 서명 검증(getClaims)', () => {
  it('설치된 supabase-js가 ES256 토큰을 JWKS로 서버에서 바로 검증한다 — /auth/v1/user 0회, JWKS는 한 번 받아 캐시', async () => {
    const { token, jwk } = es256();
    const { client, calls } = realClient(jwk);
    const first = await client.auth.getClaims(token);
    const second = await client.auth.getClaims(token);
    expect(first.data.claims.sub).toBe('u1');
    expect(second.data.claims.sub).toBe('u1');
    expect(calls.filter((p) => p.endsWith('/auth/v1/user'))).toEqual([]);
    expect(calls.filter((p) => p.endsWith('/.well-known/jwks.json'))).toHaveLength(1);
  });
  it('서명이 다른 키 · 만료된 토큰은 거절한다(인증 서버에 묻지 않고)', async () => {
    const good = es256();
    const other = es256();
    const forged = `${good.token.split('.').slice(0, 2).join('.')}.${other.token.split('.')[2]}`;
    // 거절은 { error }로 오거나(서명) 던져진다(만료 — validateExp). 어느 쪽도 claims를 주지 않는다.
    const outcome = (p) => p.then((r) => (r.error ? 'error' : 'ok'), () => 'thrown');
    const a = realClient(good.jwk);
    expect(await outcome(a.client.auth.getClaims(forged))).toBe('error');
    const expired = es256({ exp: Math.floor(Date.now() / 1000) - 60 });
    const b = realClient(expired.jwk);
    expect(await outcome(b.client.auth.getClaims(expired.token))).toBe('thrown');
    expect([...a.calls, ...b.calls].filter((p) => p.endsWith('/auth/v1/user'))).toEqual([]);
  });
  it('requireUserClaims: 검증된 sub만 { id }로, 오류 · sub 없음 · 던짐은 requireUser와 같은 { error }', async () => {
    setCookieSession(3600);
    ssr.auth = { getClaims: vi.fn(async () => ({ data: { claims: { sub: 'u1' } }, error: null })), getUser: vi.fn(), getSession: vi.fn() };
    const ok = await requireUserClaims();
    expect(ok.user).toEqual({ id: 'u1' });
    // 쿠키 토큰을 명시해 검증한다 — getClaims()가 세션을 다시 읽으면(getSession) 갱신이 일어날 수 있다.
    expect(ssr.auth.getClaims.mock.calls[0][0]).toMatch(/^ey/);
    expect(ssr.auth.getUser).not.toHaveBeenCalled();
    expect(ssr.auth.getSession).not.toHaveBeenCalled();
    setCookieSession(3600);
    ssr.auth = { getClaims: async () => ({ data: null, error: new Error('Invalid JWT signature') }) };
    expect(await requireUserClaims()).toEqual({ error: '로그인이 필요해요.', status: 401 });
    ssr.auth = { getClaims: async () => ({ data: { claims: {} }, error: null }) };
    expect(await requireUserClaims()).toEqual({ error: '로그인이 필요해요.', status: 401 });
    ssr.auth = { getClaims: async () => { throw new Error('JWT has expired'); } };
    expect(await requireUserClaims()).toEqual({ error: '로그인이 필요해요.', status: 401 });
  });
  it('미리 받기의 기본 신원이 requireUserClaims다(쓰기 · 권한 자리는 그대로 requireUser)', () => {
    const server = read('src/lib/server/libraryPrefetch.js');
    expect(server).toContain("import { requireUserClaims } from '@/lib/supabaseServer';");
    expect(server).toContain('auth = requireUserClaims }');
    expect(server).not.toMatch(/\brequireUser\b(?!Claims)/);
  });
});

describe('⑵ 대화 조회 — 두 왕복을 동시에', () => {
  /** 표마다 50ms 뒤 답하는 가짜 클라이언트. 시작 · 끝 순서를 적는다. */
  function slowClient() {
    const log = [];
    const reply = { reading_materials: [{ id: 1, title: 'a', marker: '1' }, { id: 2, title: 'b', marker: '1' }, { id: 3, title: '일반', marker: null }],
      library_item_state: [{ target_kind: 'material', target_id: '2' }] };
    const from = (table) => {
      const proxy = new Proxy({}, { get: (_, prop) => (prop === 'then'
        ? (resolve) => { log.push(`start ${table}`); setTimeout(() => { log.push(`end ${table}`); resolve({ data: reply[table], error: null }); }, 50); }
        : () => proxy) });
      return proxy;
    };
    return { client: { from }, log };
  }
  it('대화 행과 숨긴 항목을 함께 띄워 한 왕복 시간 — 결과(휴지통 대화 · 일반 자료 제외)는 그대로', async () => {
    const { client, log } = slowClient();
    const started = Date.now();
    const rows = await fetchConversations(client, 'u1');
    expect(Date.now() - started).toBeLessThan(95);
    expect(log.slice(0, 2).sort()).toEqual(['start library_item_state', 'start reading_materials']);
    expect(rows.map((r) => r.id)).toEqual(['1']);
  });
  it('다른 화면이 쓰는 filterActiveSources는 같은 결과(숨긴 키 읽기 → 거르기)', async () => {
    const { client } = slowClient();
    const kept = await filterActiveSources(client, 'u1', [{ id: 1 }, { id: 2 }]);
    expect(kept.map((r) => r.id)).toEqual([1]);
  });
  it('서버 · 브라우저가 같은 함수 — 대화 쿼리는 정본(libraryShelfQueries)의 fetchConversations 하나', () => {
    expect(read('src/lib/libraryShelfQueries.js')).toContain('queryFn: () => fetchConversations(client, ownerId),');
    expect(read('src/lib/conversation/conversationLibrary.js')).toContain('hiddenLibraryKeys(client, userId),\n  ]);');
  });
});
