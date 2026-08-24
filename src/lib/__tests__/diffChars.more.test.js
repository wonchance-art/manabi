import { describe, expect, it } from 'vitest';
import { diffChars } from '../diffChars';

describe('diffChars additional contracts', () => {
  it.each([
    [null, null, []], ['', 'abc', [{ type: 'ins', text: 'abc' }]],
    ['abc', '', [{ type: 'del', text: 'abc' }]],
    ['abc', 'abc', [{ type: 'eq', text: 'abc' }]],
    ['a b', 'ab', [{ type: 'eq', text: 'ab' }]],
    ['a　b', 'ab', [{ type: 'eq', text: 'ab' }]],
    ['abc', 'axc', [{ type: 'eq', text: 'a' }, { type: 'ins', text: 'x' }, { type: 'del', text: 'b' }, { type: 'eq', text: 'c' }]],
    ['ab', 'zab', [{ type: 'ins', text: 'z' }, { type: 'eq', text: 'ab' }]],
    ['abc', 'ab', [{ type: 'eq', text: 'ab' }, { type: 'del', text: 'c' }]],
    [0, false, []],
  ])('diffs %j against %j', (a, b, expected) => {
    expect(diffChars(a, b)).toEqual(expected);
  });
});
