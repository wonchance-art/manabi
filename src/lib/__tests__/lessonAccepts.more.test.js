import { describe, expect, it } from 'vitest';
import { isAnswerCorrect } from '../lessonAccepts';

describe('isAnswerCorrect additional contracts', () => {
  const item = { ja: 'これは本じゃないです。', accepts: ['これは本ではないです'] };
  it.each([
    ['これは本じゃないです', true], ['これは本じゃありません', true],
    ['これは本ではないです', true], ['これは本ではありません', true],
    ['これは 本 じゃないです。', true], ['これは　本　じゃないです！', true],
    ['', false], [null, false], ['これは本です', false],
  ])('checks %j', (input, expected) => expect(isAnswerCorrect(input, item)).toBe(expected));

  it('ignores a non-array accepts value', () => {
    expect(isAnswerCorrect('別', { ja: '本', accepts: '別' })).toBe(false);
  });

});
