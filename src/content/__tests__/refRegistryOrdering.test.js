import { describe, expect, it } from 'vitest';
import { createRegistry } from '../refRegistry.js';
import frApi from '../french/index.js';

describe('레지스트리 챕터 정렬 (오너 버그 신고: 프랑스어 목록 뒤죽박죽)', () => {
  it('getGrammarChapters는 order 오름차순으로 반환한다 (order 없는 항목은 뒤·원순서 유지)', () => {
    const reg = createRegistry(
      [{ key: 'X' }],
      { X: [{ slug: 'c', order: 3 }, { slug: 'noorder-1' }, { slug: 'a', order: 1 }, { slug: 'noorder-2' }, { slug: 'b', order: 2 }] },
      {},
    );
    expect(reg.getGrammarChapters('X').map((c) => c.slug)).toEqual(['a', 'b', 'c', 'noorder-1', 'noorder-2']);
    expect(reg.ALL_CHAPTERS.map((c) => c.slug)).toEqual(['a', 'b', 'c', 'noorder-1', 'noorder-2']);
  });

  it('프랑스어 A1은 order 1..33 연속으로 나온다 (첫 챕터 = 생존 a1-13)', () => {
    const a1 = frApi.getGrammarChapters('A1');
    expect(a1[0].slug).toBe('a1-13-survival');
    expect(a1.map((c) => c.order)).toEqual(Array.from({ length: a1.length }, (_, i) => i + 1));
  });

  it('프랑스어 A2는 order 1..18 연속으로 나온다', () => {
    const a2 = frApi.getGrammarChapters('A2');
    expect(a2.map((c) => c.order)).toEqual(Array.from({ length: a2.length }, (_, i) => i + 1));
  });
});
