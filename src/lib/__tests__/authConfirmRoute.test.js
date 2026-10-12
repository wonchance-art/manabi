import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { EMAIL_OTP_TYPES } from '@/lib/authConfirm';

const { factory, verifyOtp, state } = vi.hoisted(() => ({ factory: vi.fn(), verifyOtp: vi.fn(), state: {} }));
vi.mock('@supabase/ssr', () => ({ createServerClient: factory }));
import { GET } from '@/app/auth/confirm/route';

// AUTH-GUIDE-001 E: 메일 링크(token_hash)는 링크를 요청한 브라우저의 쿠키 없이 확인된다.
const origin = 'https://preview.manabi.test';
const actor = '11111111-1111-4111-8111-111111111111';
const request = (params) => {
  const url = new URL('/auth/confirm', origin);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, value);
  return new NextRequest(url);
};

beforeEach(() => {
  vi.clearAllMocks();
  state.profileWrites = [];
  factory.mockImplementation((_url, _key, options) => {
    state.cookies = options.cookies;
    return { auth: { verifyOtp }, from() {
      const query = {
        select() { return query; }, eq() { return query; },
        async single() { return { data: { id: actor }, error: null }; },
        update(value) { state.profileWrites.push(value); return query; },
        then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
      }; return query;
    } };
  });
  verifyOtp.mockImplementation(async () => {
    state.cookies.setAll([{ name: 'fixture-session', value: 'verified', options: { path: '/', httpOnly: true } }]);
    const user = { id: actor, user_metadata: {} };
    return { data: { user, session: { user, access_token: 'verified-session-token' } }, error: null };
  });
});

describe('메일 링크 확인 라우트(/auth/confirm)', () => {
  it('가입 인증 링크를 확인하고 세션 쿠키를 실어 서재로 보낸다', async () => {
    const response = await GET(request({ token_hash: 'hash-1', type: 'email' }));
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'hash-1' });
    expect(response.headers.get('location')).toBe(origin + '/materials');
    expect(response.cookies.get('fixture-session').value).toBe('verified');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(state.profileWrites.length).toBeGreaterThan(0);
  });

  it('재설정 링크는 새 비밀번호 화면으로 간다', async () => {
    expect((await GET(request({ token_hash: 'hash-2', type: 'recovery' }))).headers.get('location')).toBe(origin + '/auth?mode=reset');
  });

  it.each(['//example.invalid', 'https://example.invalid', '/a/..//example.invalid'])('외부 next는 따르지 않는다: %s', async next => {
    expect((await GET(request({ token_hash: 'hash-3', type: 'email', next }))).headers.get('location')).toBe(origin + '/materials');
  });

  it.each([
    [{ type: 'email' }, '토큰 없음'],
    [{ token_hash: 'hash-4', type: 'sms' }, '이메일 링크가 아닌 종류'],
    [{ token_hash: 'hash-4' }, '종류 없음'],
  ])('%j(%s)은 확인하지 않고 로그인 화면으로 돌린다', async params => {
    const response = await GET(request(params));
    expect(factory).not.toHaveBeenCalled();
    const target = new URL(response.headers.get('location'));
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('error')).toBe('auth_callback_failed');
  });

  it('만료·재사용 링크는 공급자 오류를 숨기고, 재설정이면 재설정 안내로 돌린다', async () => {
    verifyOtp.mockResolvedValue({ data: null, error: { message: 'provider detail that must stay private' } });
    const response = await GET(request({ token_hash: 'hash-5', type: 'recovery' }));
    const target = new URL(response.headers.get('location'));
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('from')).toBe('/auth?mode=reset');
    expect(response.headers.get('location')).not.toContain('provider detail');
    expect(state.profileWrites).toEqual([]);
  });

  it('전송 실패도 서버 오류 화면 없이 로그인 화면으로', async () => {
    verifyOtp.mockRejectedValue(new Error('network'));
    const response = await GET(request({ token_hash: 'hash-6', type: 'email' }));
    expect(new URL(response.headers.get('location')).pathname).toBe('/auth');
    expect(response.status).toBe(307);
  });
});

describe('메일 템플릿 안내 문서', () => {
  it('문서의 모든 템플릿 링크가 /auth/confirm과 받는 종류를 가리킨다', () => {
    const doc = readFileSync('docs/auth-email-links.md', 'utf8');
    const links = [...doc.matchAll(/`\{\{ \.SiteURL \}\}(\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=([a-z_]+))`/g)];
    expect(links).toHaveLength(5);
    for (const [, , type] of links) expect(EMAIL_OTP_TYPES.has(type)).toBe(true);
    expect(links.map(link => link[2])).toContain('recovery');
  });
});
