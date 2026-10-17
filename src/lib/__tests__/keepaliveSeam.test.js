// 닫힘 전송 이음새 하나(리뷰 2026-10-17 KST): 문법 보류함 · 아는 단어 쓰기가 같은 전송기를 따로 만들었던 것을 하나로 모았다.
// 계약 = ① 정본 postgrestKeepalive 동작 ② 정본 sessionTokenFor 동작 ③ 두 번째 구현 금지(grep) — CLAUDE.md 「중복 신설 금지」.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

const h = vi.hoisted(() => ({ session: { access_token: 'tok-u1', user: { id: 'u1' } } }));
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: h.session } }) } } }));
const { postgrestKeepalive, sessionTokenFor } = await import('../keepalive.js');

const ROOT = process.cwd();
const walk = (dir) => fs.readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  if (fs.statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
  return /\.(m?js|jsx)$/u.test(name) && !/\.test\./u.test(name) ? [full] : [];
});
const files = walk(path.join(ROOT, 'src')).map((file) => [path.relative(ROOT, file), fs.readFileSync(file, 'utf8')]);
const read = (rel) => files.find(([r]) => r === rel)[1];

describe('① postgrestKeepalive — PostgREST 요청 하나를 keepalive로', () => {
  const opts = (fetchImpl) => ({ accessToken: 'tok', url: 'https://x.supabase.co', apiKey: 'anon', fetchImpl });
  it('URL(표 · 조건) · keepalive · 인증 헤더 · Prefer · JSON 본문', async () => {
    const res = { ok: true };
    const fetchImpl = vi.fn(async () => res);
    const out = await postgrestKeepalive({ ...opts(fetchImpl), path: 'grammar_review', method: 'PATCH',
      query: { user_id: 'eq.u1', last_reviewed_at: 'eq.2026-10-10T01:02:03+00:00' }, body: { a: 1 }, prefer: 'return=representation' });
    expect(out).toBe(res);
    const [href, init] = fetchImpl.mock.calls[0];
    expect(href).toBe('https://x.supabase.co/rest/v1/grammar_review?user_id=eq.u1&last_reviewed_at=eq.2026-10-10T01%3A02%3A03%2B00%3A00');
    expect(init).toEqual({ method: 'PATCH', keepalive: true, body: '{"a":1}',
      headers: { apikey: 'anon', Authorization: 'Bearer tok', 'Content-Type': 'application/json', Prefer: 'return=representation' } });
  });
  it('본문 · Prefer · 조건이 없으면 싣지 않는다', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await postgrestKeepalive({ ...opts(fetchImpl), path: 't', method: 'DELETE' });
    const [href, init] = fetchImpl.mock.calls[0];
    expect(href).toBe('https://x.supabase.co/rest/v1/t');
    expect('body' in init).toBe(false);
    expect(init.headers.Prefer).toBeUndefined();
  });
  it('토큰 · 키 · 표 · 방법이 없으면 보내지 않고 null, 네트워크 실패 · 예외도 null', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    for (const miss of [{ accessToken: null }, { apiKey: '' }, { url: '' }, { path: '' }, { method: '' }]) {
      expect(await postgrestKeepalive({ ...opts(fetchImpl), path: 't', method: 'POST', ...miss })).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await postgrestKeepalive({ ...opts(async () => { throw new TypeError('offline'); }), path: 't', method: 'POST' })).toBeNull();
    expect(await postgrestKeepalive({ ...opts(() => { throw new Error('sync'); }), path: 't', method: 'POST' })).toBeNull();
  });
});

describe('② sessionTokenFor — 그 계정의 세션일 때만 토큰', () => {
  it('같은 계정이면 토큰, 다른 계정 · 세션 없음 · 계정 없음이면 null', async () => {
    h.session = { access_token: 'tok-u1', user: { id: 'u1' } };
    expect(await sessionTokenFor('u1')).toBe('tok-u1');
    expect(await sessionTokenFor('u2')).toBeNull();
    expect(await sessionTokenFor(null)).toBeNull();
    h.session = null;
    expect(await sessionTokenFor('u1')).toBeNull();
  });
});

describe('③ 두 번째 구현 금지 — 닫힘 전송 · 토큰 판정 · best-effort 주석은 keepalive.js 한 곳', () => {
  const OWN = 'src/lib/keepalive.js';
  it('PostgREST(/rest/v1)로 keepalive를 직접 보내는 곳은 정본뿐', () => {
    const offenders = files.filter(([rel, src]) => rel !== OWN && /\/rest\/v1/u.test(src) && /keepalive\s*:\s*true/u.test(src)).map(([rel]) => rel);
    expect(offenders).toEqual([]);
    expect(read(OWN)).toMatch(/keepalive: true/u);
  });
  it('sessionTokenFor 정의 · 세션 토큰을 계정과 대조하는 코드는 정본뿐', () => {
    expect(files.filter(([rel, src]) => rel !== OWN && /function sessionTokenFor\b|sessionTokenFor\s*=/u.test(src)).map(([rel]) => rel)).toEqual([]);
    // getSession으로 받은 토큰을 계정과 대조해 붙잡는 손짓(예전 rememberGrammarToken)이 다시 생기지 않게
    const tokenMatch = /access_token[^;\n]*(?:===|!==)\s*(?:owner|accountId)|(?:owner|accountId)\s*(?:===|!==)[^;\n]*access_token|user\??\.id\s*===\s*(?:owner|accountId)[^;\n]*access_token/u;
    expect(files.filter(([rel, src]) => rel !== OWN && tokenMatch.test(src)).map(([rel]) => rel)).toEqual([]);
  });
  it('사전 요청(preflight) best-effort 한계는 한 곳에만 적는다', () => {
    expect(files.filter(([, src]) => /preflight/u.test(src)).map(([rel]) => rel)).toEqual([OWN]);
  });
  it('두 닫힘 전송기 · 학습 화면이 정본을 쓴다', () => {
    expect(read('src/lib/grammarSrs.js')).toMatch(/import \{ postgrestKeepalive \} from '\.\/keepalive\.js';/u);
    expect(sliceBetween(read('src/lib/grammarSrs.js'), 'export function sendGrammarGradeKeepalive(', 'export const GRAMMAR_RETRY_LIMIT')).toContain('postgrestKeepalive({');
    expect(read('src/lib/knownWords.js')).toMatch(/import \{ postgrestKeepalive, sessionTokenFor \} from '\.\/keepalive';/u);
    expect(sliceBetween(read('src/lib/knownWords.js'), 'export function sendKnownWordKeepalive(', '\n}\n')).toContain('postgrestKeepalive({');
    const page = read('src/views/StudySessionPage.jsx');
    expect(page).toContain("import { sessionTokenFor } from '../lib/keepalive';");
    expect(sliceBetween(page, 'function rememberGrammarToken(owner) {', '\n  }\n')).toContain('sessionTokenFor(owner)');
  });
});
