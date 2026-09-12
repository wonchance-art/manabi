import { describe, expect, it } from 'vitest';
import { authEntryHref } from '../authRedirect';

const destination = value => new URL(authEntryHref(value), 'https://manabi.test').searchParams.get('from');

describe('shared sign-in entry', () => {
  it.each([
    '/class/fixture-class',
    '/class/fixture-class?view=history&q=%E5%9B%BE%E4%B9%A6%E9%A6%86&restoreY=355',
    '/viewer/10?class=fixture-class&day=2026-09-12&returnTo=%2Fclass%2Ffixture-class#sentence-2',
    '/books/japanese-n5?edition=current#u29-study1',
  ])('preserves the complete learning destination: %s', path => {
    expect(destination(path)).toBe(path);
  });

  it('keeps an existing sign-in intent without nesting the auth page', () => {
    const path = '/class/fixture-class?view=history#record';
    expect(destination(authEntryHref(path))).toBe(path);
  });

  it.each([
    '/auth', '/auth?mode=reset', '/auth/callback?code=not-a-real-code',
    '/auth?from=%2Fauth%3Ffrom%3D%252Fclass%252Ffixture-class',
    '/auth?from=%2Fauth%2Fcallback',
    '//example.invalid', '/a/..//example.invalid', '/\\example.invalid',
    '/auth?from=https%3A%2F%2Fexample.invalid', null,
  ])('avoids auth loops and unsafe destinations: %j', path => {
    expect(destination(path)).toBe('/home');
  });
});
