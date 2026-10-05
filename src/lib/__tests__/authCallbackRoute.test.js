import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { factory, exchange, state } = vi.hoisted(() => ({ factory: vi.fn(), exchange: vi.fn(), state: {} }));
vi.mock('@supabase/ssr', () => ({ createServerClient: factory }));
import { GET } from '@/app/auth/callback/route';

const origin = 'https://preview.manabi.test';
const actor = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const request = (next, code = 'fixture-code') => {
  const url = new URL('/auth/callback', origin);
  if (code !== null) url.searchParams.set('code', code);
  if (next !== undefined) url.searchParams.set('next', next);
  return new NextRequest(url, { headers: { cookie: 'fixture-verifier=present' } });
};

beforeEach(() => {
  vi.clearAllMocks();
  state.profileReads = []; state.profileWrites = []; state.profile = { id: actor };
  state.readError = null; state.writeError = null; state.profileThrows = false;
  factory.mockImplementation((_url, _key, options) => {
    state.cookies = options.cookies;
    return { auth: { exchangeCodeForSession: exchange }, from(table) {
      let owner, payload;
      const query = {
        select() { return query; }, eq(column, value) { owner = value; return query; },
        async single() {
          state.profileReads.push({ table, owner });
          if (state.profileThrows) throw new Error('profile transport unavailable');
          return { data: state.profile, error: state.readError };
        },
        async upsert(rows, options) { state.profileWrites.push({ table, kind: 'upsert', rows, options }); return { error: state.writeError }; },
        update(value) { payload = value; return query; },
        then(resolve, reject) {
          state.profileWrites.push({ table, kind: 'update', owner, payload });
          return Promise.resolve({ error: state.writeError }).then(resolve, reject);
        },
      }; return query;
    } };
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

  function successfulExchange(data) {
    exchange.mockImplementation(async () => {
      state.cookies.setAll([{ name: 'fixture-session', value: 'verified', options: { path: '/', httpOnly: true } }]);
      return { data, error: null };
    });
  }

  it('a verified successful OAuth session writes only its owner last_login_at', async () => {
    const user = { id: actor, user_metadata: { display_name: 'known owner' } };
    successfulExchange({ user, session: { user, access_token: 'verified-session-token' } });
    const target = request('/materials'); target.nextUrl.searchParams.set('accountId', foreign);
    const response = await GET(target);
    expect(response.headers.get('location')).toBe(origin + '/materials');
    expect(response.cookies.get('fixture-session').value).toBe('verified');
    expect(state.profileReads).toEqual([{ table: 'profiles', owner: actor }]);
    expect(state.profileWrites).toHaveLength(1);
    expect(state.profileWrites[0]).toMatchObject({ kind: 'update', table: 'profiles', owner: actor });
    expect(Object.keys(state.profileWrites[0].payload)).toEqual(['last_login_at']);
  });

  it('a verified first login creates only default-safe owned profile metadata before last_login_at', async () => {
    state.profile = null; state.readError = { code: 'PGRST116' };
    const user = { id: actor, user_metadata: { name: 'new owner', role: 'admin', streak_count: 999 } };
    successfulExchange({ user, session: { user, access_token: 'verified-session-token' } });
    await GET(request('/home'));
    expect(state.profileWrites).toHaveLength(2);
    expect(state.profileWrites[0]).toEqual({ kind: 'upsert', table: 'profiles',
      rows: [{ id: actor, display_name: 'new owner' }], options: { onConflict: 'id', ignoreDuplicates: true } });
    expect(Object.keys(state.profileWrites[1].payload)).toEqual(['last_login_at']);
  });

  it.each([
    undefined, {}, { user: { id: actor } }, { session: {} },
    { session: { access_token: 'verified' } }, { session: { user: { id: actor } } },
    { session: { access_token: 'verified', user: { id: actor, is_anonymous: true } } },
    { session: { access_token: 'verified', user: { id: 'not-an-actor' } } },
    { user: { id: foreign }, session: { access_token: 'verified', user: { id: actor } } },
  ])('no profile reads/writes without consistent authenticated exchange session proof: %j', async data => {
    successfulExchange(data);
    const response = await GET(request('/home'));
    expect(response.headers.get('location')).toBe(origin + '/home');
    expect(response.cookies.get('fixture-session').value).toBe('verified');
    expect(state.profileReads).toEqual([]); expect(state.profileWrites).toEqual([]);
  });

  it.each(['read', 'write', 'foreign profile'])('profile %s failure preserves successful login cookie and redirect', async failure => {
    if (failure === 'read') state.profileThrows = true;
    if (failure === 'write') state.writeError = new Error('profile write unavailable');
    if (failure === 'foreign profile') state.profile = { id: foreign };
    const user = { id: actor }; successfulExchange({ user, session: { user, access_token: 'verified' } });
    const response = await GET(request('/books/japanese-n5#u3'));
    expect(response.headers.get('location')).toBe(origin + '/books/japanese-n5#u3');
    expect(response.cookies.get('fixture-session').value).toBe('verified');
    if (failure !== 'write') expect(state.profileWrites).toEqual([]);
  });
});
