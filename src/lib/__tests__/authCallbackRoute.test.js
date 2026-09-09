import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { factory, exchange, state } = vi.hoisted(() => ({ factory: vi.fn(), exchange: vi.fn(), state: {} }));
vi.mock('@supabase/ssr', () => ({ createServerClient: factory }));
import { GET } from '@/app/auth/callback/route';

const origin = 'https://preview.manabi.test';
const request = (next, code = 'fixture-code') => {
  const url = new URL('/auth/callback', origin);
  if (code !== null) url.searchParams.set('code', code);
  if (next !== undefined) url.searchParams.set('next', next);
  return new NextRequest(url, { headers: { cookie: 'fixture-verifier=present' } });
};

beforeEach(() => {
  vi.clearAllMocks();
  factory.mockImplementation((_url, _key, options) => {
    state.cookies = options.cookies;
    return { auth: { exchangeCodeForSession: exchange } };
  });
  exchange.mockImplementation(async () => {
    state.cookies.setAll([{ name: 'fixture-session.0', value: 'part-a', options: { path: '/', httpOnly: true, sameSite: 'lax' } }, { name: 'fixture-session.1', value: 'part-b', options: { path: '/' } }]);
    return { error: null };
  });
});

describe('server PKCE callback', () => {
  it('exchanges the code, carries chunked cookies, and restores the reader anchor', async () => {
    const next = '/books/japanese-n5?edition=known#u29-patterns';
    const response = await GET(request(next));
    expect(exchange).toHaveBeenCalledWith('fixture-code');
    expect(state.cookies.getAll()).toEqual([{ name: 'fixture-verifier', value: 'present' }]);
    expect(response.headers.get('location')).toBe(origin + next);
    expect(response.cookies.get('fixture-session.0')).toMatchObject({ value: 'part-a', httpOnly: true, sameSite: 'lax' });
    expect(response.cookies.get('fixture-session.1').value).toBe('part-b');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps the email confirmation default destination', async () => {
    expect((await GET(request())).headers.get('location')).toBe(origin + '/materials');
  });

  it.each(['@example.invalid', '//example.invalid', '/\\example.invalid', '/\n/example.invalid', 'https://example.invalid', '/a/..//example.invalid'])(
    'does not follow an unsafe return after a successful exchange: %s', async next => {
      expect((await GET(request(next))).headers.get('location')).toBe(origin + '/materials');
    },
  );

  it('returns to sign-in without an exchange when the callback has no code', async () => {
    const response = await GET(request('/home', null));
    expect(factory).not.toHaveBeenCalled();
    const target = new URL(response.headers.get('location'));
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('error')).toBe('auth_callback_failed');
    expect(target.searchParams.get('from')).toBe('/home');
    expect(response.cookies.getAll()).toEqual([]);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('retains verifier cleanup cookies when the provider rejects a code', async () => {
    exchange.mockImplementation(async () => {
      state.cookies.setAll([{ name: 'fixture-verifier', value: '', options: { path: '/', maxAge: 0 } }]);
      return { error: { message: 'provider detail that must stay private' } };
    });
    const response = await GET(request('/auth?mode=reset'));
    const target = new URL(response.headers.get('location'));
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('from')).toBe('/auth?mode=reset');
    expect(response.cookies.get('fixture-verifier').maxAge).toBe(0);
    expect(response.headers.get('location')).not.toContain('provider detail');
  });

  it('handles a transport failure without a server-error page or external redirect', async () => {
    exchange.mockRejectedValue(new Error('fixture network failure'));
    const response = await GET(request('@example.invalid'));
    const target = new URL(response.headers.get('location'));
    expect(target.origin).toBe(origin);
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('from')).toBe('/materials');
    expect(response.status).toBe(307);
  });
});
