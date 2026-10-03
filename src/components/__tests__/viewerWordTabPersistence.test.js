import { describe, expect, it } from 'vitest';
import { resolveSignalTransition } from '../ViewerBottomSheet.jsx';

describe('an open word tab survives sentence activity', () => {
  it('keeps the word when sentence content becomes active', () => {
    expect(resolveSignalTransition(true, false, true)).toEqual({ tab: 'right' });
  });

  it('keeps the word when a sentence refresh emits both signals', () => {
    expect(resolveSignalTransition(true, true, true)).toEqual({ tab: 'right' });
  });

  it('does not reopen a dismissed panel without a new signal', () => {
    expect(resolveSignalTransition(false, false, true)).toBeNull();
  });

  it('preserves sentence selection when the word is not open or opted in', () => {
    expect(resolveSignalTransition(true, false, false)).toEqual({ tab: 'left' });
    expect(resolveSignalTransition(true, true)).toEqual({ tab: 'left' });
  });

  it('an explicit new word still selects the word tab', () => {
    expect(resolveSignalTransition(false, true, false)).toEqual({ tab: 'right' });
  });

  it('an explicit sentence request selects its tab without discarding word content', () => {
    expect(resolveSignalTransition(true, true, true, true)).toEqual({ tab: 'left' });
    expect(resolveSignalTransition(false, false, true, true)).toEqual({ tab: 'left' });
  });
});
