import { describe, expect, it } from 'vitest';
import { authCallbackUrl, authReturnPath } from '../authRedirect';

describe('auth return destinations', () => {
  it.each(['/home', '/materials?view=owned&q=caf%C3%A9', '/books/japanese-n5?edition=current#u29-patterns', '/auth?mode=reset'])(
    'preserves an internal destination: %s', value => expect(authReturnPath(value)).toBe(value),
  );

  it.each([undefined, null, '', {}, 'https://example.invalid', '//example.invalid', '///example.invalid', '@example.invalid', 'javascript:alert(1)', '/\\example.invalid', '/\n/example.invalid', '/\t/example.invalid'])(
    'rejects a destination that is not an internal absolute path: %j', value => {
      expect(authReturnPath(value)).toBe('/home');
      expect(authReturnPath(value, '/materials')).toBe('/materials');
    },
  );

  it('also refuses an unsafe fallback', () => {
    expect(authReturnPath(null, '//example.invalid')).toBe('/home');
  });

  it.each(['/a/..//example.invalid', '/%2e//example.invalid', '/a/%2e%2e//example.invalid'])(
    'rejects paths that normalize to a protocol-relative destination: %s', value => {
      expect(authReturnPath(value)).toBe('/home');
    },
  );

  it('preserves an exact reader location through the encoded callback parameter', () => {
    const next = '/books/japanese-n5?edition=known&mode=read#u29-patterns';
    const callback = new URL(authCallbackUrl('https://preview.manabi.test', next));
    expect(callback.origin).toBe('https://preview.manabi.test');
    expect(callback.pathname).toBe('/auth/callback');
    expect(callback.searchParams.get('next')).toBe(next);
    expect(callback.hash).toBe('');
  });

  it('exchanges a recovery code before opening the password form', () => {
    const callback = new URL(authCallbackUrl('https://manabi.test', '/auth?mode=reset'));
    expect(callback.pathname).toBe('/auth/callback');
    expect(callback.searchParams.get('next')).toBe('/auth?mode=reset');
  });

  it('keeps email confirmation on the existing callback and permits local development', () => {
    expect(authCallbackUrl('https://manabi.test')).toBe('https://manabi.test/auth/callback');
    expect(authCallbackUrl('http://localhost:3000', '/home')).toBe('http://localhost:3000/auth/callback?next=%2Fhome');
  });
});
