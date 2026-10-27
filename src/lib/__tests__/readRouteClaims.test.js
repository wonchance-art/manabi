import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// AUTH-READ-CLAIMS-001 — 읽기 전용 API 라우트(GET)는 인증 서버 왕복(getUser) 대신 쿠키 접근 토큰의 서명을 서버에서 확인한다
// (오너 승인 2026-10-25 KST 「권장대로」 · 로그인 감사 F6: /vocab 첫 로드 getUser 5번 · 채점 3번).
// 받아들인 차이: 다른 기기에서 로그아웃 · 폐기한 세션도 접근 토큰이 끝날 때(최대 약 1시간)까지 자기 데이터 **읽기**는 된다.
// 쓰기 · 할당량 · 입장 영수증 · 관리자 판정은 지금처럼 getUser(requireUser)로 폐기 세션을 바로 막는다.
// 이 파일의 READ_ROUTES가 「어느 처리기가 서명 확인을 쓰는가」의 정본이다 — 목록 밖 · GET이 아닌 처리기가 쓰면 깨진다.
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

import { requireUser, requireUserForRead } from '../supabaseServer';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

/**
 * 서명 확인(requireUserForRead)을 쓰는 GET 처리기 — 경로 → 이유 · 거치는 RPC(전부 STABLE이어야 한다: DB가 읽기 전용을 보장).
 * 넣는 기준: 처리기와 그 읽기 함수가 행을 쓰지 않는다(지연 upsert · 할당량 소비 · 입장 영수증 · 사용 표시 없음) · 권한(관리자) 판정 없음 ·
 * 결과가 본인 행뿐이다(쿠키 클라이언트 RLS + user_id 필터, service client는 p_actor = 검증된 sub).
 */
const READ_ROUTES = {
  'src/app/api/learning/capabilities/route.js': { reason: '언어별 저장 · 복습 가능 여부(쿠키 클라이언트 RLS) — /vocab 첫 로드', rpcs: ['learning_language_capabilities'] },
  'src/app/api/learning/vocabulary/route.js': { reason: '담은 단어 snapshot(view=learning · 요약은 가벼운 읽기 · ids=카드 몇 장) · 문맥 목록 읽기 — 저장(POST) · 문맥 삭제(DELETE)는 getUser', rpcs: ['fsrs_vocabulary_snapshot', 'fsrs_vocabulary_snapshot_light', 'fsrs_vocabulary_snapshot_cards'] },
  'src/app/api/learning/admission/route.js': { reason: '오늘 입장 상태 읽기 — 첫 질문 영수증(POST)은 getUser', rpcs: ['fsrs_capabilities', 'learning_admission_status', 'fsrs_learning_admission_marker', 'fsrs_vocabulary_snapshot'] },
  'src/app/api/learning/fsrs/route.js': { reason: 'FSRS 카드 상태 · 입장 상태 읽기 — 채점(POST)은 getUser', rpcs: ['fsrs_capabilities', 'fsrs_list_states', 'learning_admission_status', 'fsrs_learning_admission_marker', 'fsrs_vocabulary_snapshot'] },
  'src/app/api/learning/exclusions/route.js': { reason: '제외 단어 목록 읽기(쿠키 클라이언트 RLS) — 제외 설정(POST)은 getUser', rpcs: [] },
  'src/app/api/learning/book-review/route.js': { reason: '교재 복습 범위(내 문맥 · 내 단어) 읽기', rpcs: [] },
  'src/app/api/learning/material-review/route.js': { reason: '자료 범위의 내 단어 id 읽기', rpcs: [] },
};
// 일부러 getUser에 남긴 GET(참고 — 넣으려면 위 기준을 확인하고 READ_ROUTES로 옮긴다):
//   learning/material-links GET — 관리자 보관 교재 열람 판정(canReadLegacyTextbook)이 끼어 있다(권한 판정).
//   notes/[id] GET · notes/dictionary GET — 쓰기(PUT · POST)와 같은 noteAuth 헬퍼를 쓴다(헬퍼째 바꾸면 쓰기도 바뀐다).
//   world/position · world/stamps GET — 보류 중인 월드(범위 밖 · 저빈도).
//   admin/* GET — requireAdmin(권한 판정). Bearer 토큰 라우트(src/lib/server/auth.js requireUser)는 이 작업 범위 밖.

const HANDLER = /^export\s+(?:async\s+function|const)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/gm;
/** 라우트 파일 → { 메서드: 처리기 본문 }(다음 export 직전까지). */
function handlers(source) {
  const marks = [...source.matchAll(HANDLER)].map((m) => ({ method: m[1], at: m.index }));
  const out = {};
  marks.forEach((mark, i) => {
    const rest = source.slice(mark.at + 1);
    const next = rest.search(/^export\s/m);
    const end = i + 1 < marks.length ? marks[i + 1].at : next < 0 ? source.length : mark.at + 1 + next;
    out[mark.method] = source.slice(mark.at, end);
  });
  return out;
}
function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(rel);
    return /\.(js|jsx|mjs|ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [rel] : [];
  });
}
const routeFiles = walk('src/app/api').filter((f) => /\/route\.(js|ts)$/.test(f));

/** supabase/migrations에서 함수의 마지막 정의 머리(create … function name(…) … AS) — 휘발성 표기를 본다. */
function latestDefinition(name) {
  const dir = path.join(ROOT, 'supabase/migrations');
  let last = null;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${name}\\s*\\(`, 'ig');
    for (const m of sql.matchAll(re)) {
      const head = sql.slice(m.index, m.index + 1500);
      const body = head.search(/\bas\s+\$[a-z_]*\$/i);
      last = { file, head: body < 0 ? head : head.slice(0, body) };
    }
  }
  return last;
}

describe('라우트 목록 — 서명 확인은 목록에 오른 GET에만', () => {
  it('목록의 파일이 모두 있고, 그 GET은 requireUserForRead만 · 같은 파일의 쓰기 처리기는 requireUser 그대로', () => {
    for (const [file, entry] of Object.entries(READ_ROUTES)) {
      expect(entry.reason.length, file).toBeGreaterThan(5);
      const byMethod = handlers(read(file));
      expect(byMethod.GET, `${file} GET`).toMatch(/await requireUserForRead\(\)/);
      expect(byMethod.GET, `${file} GET`).not.toMatch(/\brequireUser\(\)/);
      for (const [method, body] of Object.entries(byMethod)) {
        if (method === 'GET') continue;
        expect(body, `${file} ${method}`).not.toMatch(/requireUserForRead|requireUserClaims/);
        expect(body, `${file} ${method}`).toMatch(/await requireUser\(\)/);
      }
    }
  });

  it('목록 밖 라우트 · GET이 아닌 처리기는 서명 확인을 쓰지 않는다 — 쓰기 라우트가 폐기 세션을 통과시키지 않게', () => {
    const offenders = [];
    for (const file of routeFiles) {
      const source = read(file);
      // requireUserClaims는 갱신으로 물러서지 않는다(만료 임박이면 401) — 라우트는 반드시 requireUserForRead를 거친다.
      if (/requireUserClaims|getClaims\(/.test(source)) offenders.push(`${file}: requireUserClaims/getClaims 직접 사용`);
      for (const [method, body] of Object.entries(handlers(source))) {
        if (!/requireUserForRead/.test(body)) continue;
        if (method !== 'GET') offenders.push(`${file} ${method}: 쓰기 처리기`);
        else if (!READ_ROUTES[file]) offenders.push(`${file} GET: READ_ROUTES 밖`);
      }
    }
    expect(offenders).toEqual([]);
    // 헬퍼 안에 숨기지 않는다(예: GET · PUT이 함께 쓰는 noteAuth) — 앱 코드에서 requireUserForRead를 부르는 곳은 목록의 라우트뿐.
    const callers = walk('src').filter((f) => /requireUserForRead\(/.test(read(f)) && f !== 'src/lib/supabaseServer.js');
    expect(callers.sort()).toEqual(Object.keys(READ_ROUTES).sort());
  });

  it('목록의 GET 본문은 직접 쓰지 않고, 거치는 RPC는 모두 STABLE(읽기 전용)로 정의돼 있다', () => {
    for (const [file, entry] of Object.entries(READ_ROUTES)) {
      const body = handlers(read(file)).GET;
      expect(body, file).not.toMatch(/\.(insert|upsert|update|delete)\(/);
      for (const name of entry.rpcs) {
        const def = latestDefinition(name);
        expect(def, `${name} 정의`).not.toBeNull();
        expect(def.head, `${name} @ ${def.file}`).toMatch(/\b(STABLE|IMMUTABLE)\b/i);
        expect(def.head, `${name} @ ${def.file}`).not.toMatch(/\bVOLATILE\b/i);
      }
    }
  });

  it('입장 영수증 · 채점 · 저장(POST)은 지금처럼 getUser — 대표 쓰기 라우트 고정', () => {
    for (const file of ['src/app/api/learning/admission/route.js', 'src/app/api/learning/fsrs/route.js', 'src/app/api/learning/vocabulary/route.js', 'src/app/api/learning/exclusions/route.js']) {
      expect(handlers(read(file)).POST, file).toMatch(/await requireUser\(\)/);
    }
    expect(handlers(read('src/app/api/learning/vocabulary/route.js')).DELETE).toMatch(/await requireUser\(\)/);
  });
});

// ── 동작: 실물 @supabase/ssr · supabase-js + 가짜 Auth(JWKS · /user · /token). ──
const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const KEY = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const OTHER = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const KID = 'read-claims-kid';
const JWK = { ...KEY.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'ES256', use: 'sig', key_ops: ['verify'] };
function es256(exp, { key = KEY.privateKey, sub = 'u1' } = {}) {
  const body = `${enc({ alg: 'ES256', typ: 'JWT', kid: KID })}.${enc({ sub, aud: 'authenticated', role: 'authenticated', session_id: 's1', exp, iat: exp - 3600 })}`;
  return `${body}.${sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
/** 브라우저가 심는 모양(@supabase/ssr — base64- 접두 · 조각 .0/.1)의 쿠키 세션. expIn = 남은 초. */
function cookieSession(expIn, { token } = {}) {
  jar.cookies.clear(); jar.writes.length = 0;
  const exp = Math.floor(Date.now() / 1000) + expIn;
  const session = { access_token: token || es256(exp), refresh_token: 'r-old', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: 'u1' } };
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const half = Math.ceil(value.length / 2);
  jar.cookies.set('sb-e2e-auth-token.0', value.slice(0, half));
  jar.cookies.set('sb-e2e-auth-token.1', value.slice(half));
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** 가짜 Auth — /user 응답을 고를 수 있다. 부른 경로를 센다. */
function auth({ user = () => json({ id: 'u1', aud: 'authenticated' }) } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    const { pathname } = new URL(String(url));
    calls.push(`${init?.method || 'GET'} ${pathname}`);
    if (pathname.endsWith('/.well-known/jwks.json')) return json({ keys: [JWK] });
    if (pathname === '/auth/v1/user') return user();
    if (pathname === '/auth/v1/token') {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      return json({ access_token: es256(exp), refresh_token: 'r-new', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated' } });
    }
    return json({ message: 'unexpected' }, 500);
  });
  return { calls, userCalls: () => calls.filter((c) => c.endsWith('/auth/v1/user')).length, refreshCalls: () => calls.filter((c) => c.endsWith('/auth/v1/token')).length };
}
const authCookieWrites = () => jar.writes.filter((w) => /^sb-e2e-auth-token/.test(w.name));
afterEach(() => { vi.unstubAllGlobals(); });

describe('requireUserForRead — 빠른 길은 서명 확인, 그 밖은 오늘의 requireUser', () => {
  it('토큰이 넉넉하면 인증 서버 /user 0번 · 갱신 0번 · 쿠키 쓰기 0 — user는 검증된 sub', async () => {
    cookieSession(3600);
    const net = auth();
    const result = await requireUserForRead();
    expect(result.user).toEqual({ id: 'u1' });
    expect(result.supabase?.from).toBeTypeOf('function');
    expect(net.userCalls()).toBe(0);
    expect(net.refreshCalls()).toBe(0);
    expect(authCookieWrites()).toEqual([]);
    await requireUserForRead();
    expect(net.userCalls()).toBe(0); // JWKS는 프로세스 안에 캐시(두 번째도 왕복 0)
  });

  it('만료된 토큰 → requireUser와 같은 갱신(새 쿠키를 심는다)', async () => {
    cookieSession(-60);
    const net = auth();
    const result = await requireUserForRead();
    expect(result.user?.id).toBe('u1');
    expect(net.refreshCalls()).toBe(1);
    expect(authCookieWrites().some((w) => w.value && w.maxAge > 0)).toBe(true);
  });

  for (const [label, expIn] of [['60초 안에 만료(갱신 여유 안)', 60], ['100초 남음(서명 확인 여유 120초 안)', 100]]) {
    it(`${label} → 서명 확인을 건너뛰고 requireUser(getUser)로`, async () => {
      cookieSession(expIn);
      const net = auth();
      expect((await requireUserForRead()).user?.id).toBe('u1');
      expect(net.userCalls()).toBe(1);
    });
  }

  it('쿠키 없음 → requireUser와 같은 401(네트워크 0)', async () => {
    jar.cookies.clear(); jar.writes.length = 0;
    const net = auth();
    expect(await requireUserForRead()).toEqual({ error: '로그인이 필요해요.', status: 401 });
    expect(net.calls).toEqual([]);
  });

  it('다른 키로 서명한 토큰 → 받아들이지 않고 getUser로 물러선다(인증 서버가 거절하면 401)', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    cookieSession(3600, { token: es256(exp, { key: OTHER.privateKey }) });
    const net = auth({ user: () => json({ code: 403, error_code: 'bad_jwt', msg: 'invalid JWT' }, 403) });
    expect(await requireUserForRead()).toEqual({ error: '로그인이 필요해요.', status: 401 });
    expect(net.userCalls()).toBe(1);
  });

  it('대칭(HS) · kid 없는 토큰 → getClaims가 getUser(token)으로 확인(한 번), 통과하면 그대로', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    cookieSession(3600, { token: `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'u1', aud: 'authenticated', exp })}.sig` });
    const net = auth();
    expect((await requireUserForRead()).user).toEqual({ id: 'u1' });
    expect(net.userCalls()).toBe(1);
  });

  it('받아들인 차이(오너 승인): 폐기된 세션도 토큰이 살아 있는 동안 읽기는 통과 — 같은 쿠키로 쓰기(requireUser)는 401 · 쿠키 삭제', async () => {
    cookieSession(3600);
    auth({ user: () => json({ code: 403, error_code: 'session_not_found', msg: 'session_not_found' }, 403) });
    expect((await requireUserForRead()).user).toEqual({ id: 'u1' });
    cookieSession(3600);
    auth({ user: () => json({ code: 403, error_code: 'session_not_found', msg: 'session_not_found' }, 403) });
    expect(await requireUser()).toEqual({ error: '로그인이 필요해요.', status: 401 });
    expect(authCookieWrites().filter((w) => w.value === '' && w.maxAge === 0).map((w) => w.name).sort()).toEqual(['sb-e2e-auth-token.0', 'sb-e2e-auth-token.1']);
  });
});
