import { describe, expect, it } from 'vitest';
import { tokenizeJa } from '../jaTokenize';

describe('tokenizeJa additional contracts', () => {
  it.each([[null], [''], [undefined]])('returns no tokens for %j', (input) => {
    expect(tokenizeJa(input, [])).toEqual([]);
  });

  it.each([
    ['猫は学生です。', ['猫', 'は', '学生', 'です', '。']],
    ['A B\tC', ['A', 'B', 'C']],
    ['はい？いいえ！', ['は', 'い', '？', 'いいえ', '！']],
    ['これは本じゃありません', ['これ', 'は', '本', 'じゃありません']],
    ['行きましょう', ['行き', 'ましょう']],
    ['読みません', ['読み', 'ません']],
    ['abc,def!', ['abc', ',', 'def', '!']],
  ])('tokenizes %j', (input, expected) => expect(tokenizeJa(input, [])).toEqual(expected));

  it('prefers longest vocab and leaves its array order intact', () => {
    const vocab = [{ ja: '東京' }, { ja: '東京都' }];
    expect(tokenizeJa('東京都へ', vocab)).toEqual(['東京都', 'へ']);
    expect(vocab.map((v) => v.ja)).toEqual(['東京', '東京都']);
  });

  it.each([[null], [{}], [{ ja: '' }], [{ ja: 2 }]])('ignores invalid vocab %j', (entry) => {
    expect(tokenizeJa('本文', [entry])).toEqual(['本文']);
  });
});
