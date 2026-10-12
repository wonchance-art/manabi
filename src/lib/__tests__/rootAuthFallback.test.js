import { describe, expect, it, vi } from 'vitest';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn(target => { throw Object.assign(new Error('NEXT_REDIRECT'), { target }); }) }));
vi.mock('next/navigation', () => ({ redirect }));
import Page from '@/app/page';

// Supabase가 허용 목록 밖 redirectTo 대신 Site URL(/)로 로그인 결과를 보낼 때(manabi.co.kr 전환 실측 2026-10-11).
const land = async params => {
  try { await Page({ searchParams: Promise.resolve(params) }); } catch (error) { return error.target; }
  throw new Error('redirect expected');
};

describe('루트(/)의 로그인 결과 넘기기', () => {
  it('code는 버리지 않고 서버 교환 라우트로 넘긴다', async () => {
    const target = new URL(await land({ code: 'pkce-code-1' }), 'https://manabi.invalid');
    expect(target.pathname).toBe('/auth/callback');
    expect(target.searchParams.get('code')).toBe('pkce-code-1');
    expect(target.searchParams.get('next')).toBe('/home');
  });

  it('공급자 오류는 로그인 화면의 실패 안내로 보낸다', async () => {
    const target = new URL(await land({ error: 'access_denied', error_description: 'denied' }), 'https://manabi.invalid');
    expect(target.pathname).toBe('/auth');
    expect(target.searchParams.get('error')).toBe('auth_callback_failed');
    expect(target.toString()).not.toContain('denied');
  });

  it('그 밖에는 지금처럼 /home', async () => {
    expect(await land({})).toBe('/home');
    expect(await land({ code: ['a', 'b'] })).toBe('/home');
  });
});
