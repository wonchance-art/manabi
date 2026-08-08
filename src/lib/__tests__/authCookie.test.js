import { describe, it, expect } from 'vitest';
import { hasSupabaseSessionCookie } from '../authCookie';

// 이 판정은 "게스트면 Supabase SDK를 아예 받지 않는다"의 관문이다.
// 틀리면 로그인 상태가 새로고침 후 사라지는 형태로 조용히 깨지므로,
// @supabase/ssr의 실제 쿠키 이름 규약을 여기에 고정한다.
describe('hasSupabaseSessionCookie', () => {
  const REF = 'abcdefghijklmnop';

  it('기본 세션 쿠키를 인식한다', () => {
    expect(hasSupabaseSessionCookie(`sb-${REF}-auth-token=base64-eyJhbGciOi`)).toBe(true);
  });

  it('조각난 세션 쿠키(.0/.1)를 인식한다 — 4kB 초과 시 ssr이 쪼갠다', () => {
    expect(hasSupabaseSessionCookie(`sb-${REF}-auth-token.0=part0; sb-${REF}-auth-token.1=part1`)).toBe(true);
    expect(hasSupabaseSessionCookie(`sb-${REF}-auth-token.1=part1`)).toBe(true);
  });

  it('다른 쿠키에 섞여 있어도 인식한다', () => {
    expect(hasSupabaseSessionCookie(`theme=dark; sb-${REF}-auth-token=v; other=1`)).toBe(true);
    expect(hasSupabaseSessionCookie(`theme=dark;sb-${REF}-auth-token=v`)).toBe(true);
  });

  it('세션이 없으면 false — SDK를 받지 않는 경로', () => {
    expect(hasSupabaseSessionCookie('')).toBe(false);
    expect(hasSupabaseSessionCookie('theme=dark; lang=ko')).toBe(false);
    expect(hasSupabaseSessionCookie(undefined)).toBe(false);
    expect(hasSupabaseSessionCookie(null)).toBe(false);
  });

  it('code-verifier는 세션이 아니다 — OAuth 진행 중 쿠키로 SDK를 깨우지 않는다', () => {
    expect(hasSupabaseSessionCookie(`sb-${REF}-auth-token-code-verifier=xyz`)).toBe(false);
  });

  it('이름이 비슷한 남의 쿠키에 속지 않는다', () => {
    expect(hasSupabaseSessionCookie('my-auth-token=v')).toBe(false);
    expect(hasSupabaseSessionCookie('xsb-ref-auth-token=v')).toBe(false);
  });
});
