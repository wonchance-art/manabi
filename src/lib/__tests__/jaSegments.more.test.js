import { describe, expect, it } from 'vitest';
import { parseJaSegments } from '../jaSegments';

describe('parseJaSegments additional contracts', () => {
  it.each([[null], [''], [undefined]])('returns no segments for %j', (input) => {
    expect(parseJaSegments(input, [])).toEqual([]);
  });

  it('prefers the longest vocabulary match without mutating vocab', () => {
    const vocab = [{ ja: '学校', ko: 'school' }, { ja: '学校生活', ko: 'school life' }];
    expect(parseJaSegments('学校生活です', vocab)).toEqual([
      { type: 'vocab', text: '学校生活', ko: 'school life' },
      { type: 'text', text: 'です' },
    ]);
    expect(vocab.map((v) => v.ja)).toEqual(['学校', '学校生活']);
  });

  it('marks は only when it immediately follows vocabulary', () => {
    expect(parseJaSegments('私は学生は', [{ ja: '私', ko: 'I' }])).toEqual([
      { type: 'vocab', text: '私', ko: 'I' },
      { type: 'particle', text: 'は', reading: 'わ' },
      { type: 'text', text: '学生は' },
    ]);
  });

  it.each([[null], [undefined], [{}], [{ ja: '' }], [{ ja: 1 }]])('ignores invalid vocab %j', (entry) => {
    expect(parseJaSegments('本文', [entry])).toEqual([{ type: 'text', text: '本文' }]);
  });
});
