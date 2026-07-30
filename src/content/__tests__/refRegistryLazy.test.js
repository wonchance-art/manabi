import { describe, expect, it, vi } from 'vitest';
import {
  createLazyRegistry,
  createRegistry,
  GRAMMAR_CHAPTER_COMPARATOR,
} from '../refRegistry.js';

const LEVEL_META = [{ key: 'A' }, { key: 'B' }];
const A = [
  { slug: 'a-2', level: 'A', order: 2, sections: [{ pattern: 'two' }] },
  { slug: 'a-1', level: 'A', order: 1, sections: [{ pattern: 'one' }] },
];
const B = [
  { slug: 'b-1', level: 'B', order: 1, sections: [{ pattern: 'three' }] },
];
const MANIFEST = {
  levels: [
    {
      key: 'A',
      chapters: [
        { slug: 'a-1', level: 'A', order: 1 },
        { slug: 'a-2', level: 'A', order: 2 },
      ],
    },
    {
      key: 'B',
      chapters: [{ slug: 'b-1', level: 'B', order: 1 }],
    },
  ],
};

describe('createLazyRegistry', () => {
  it('#693 comparator exact 객체와 동기 Chapter[] shape를 eager/loaded view가 공유한다', async () => {
    const eager = createRegistry(LEVEL_META, { A, B }, {});
    const lazy = createLazyRegistry(
      LEVEL_META,
      MANIFEST,
      { A: async () => A, B: async () => B },
    );

    const loaded = await lazy.loadGrammarLevel('a');
    expect(eager.SORT_COMPARATOR).toBe(GRAMMAR_CHAPTER_COMPARATOR);
    expect(lazy.SORT_COMPARATOR).toBe(GRAMMAR_CHAPTER_COMPARATOR);
    expect(loaded.SORT_COMPARATOR).toBe(GRAMMAR_CHAPTER_COMPARATOR);
    expect(loaded.getGrammarChapters('A')).toEqual(eager.getGrammarChapters('A'));
    expect(loaded.getGrammarChapters('A')[0].sections).toEqual([{ pattern: 'one' }]);
    expect(loaded.getGrammarChapters('B')).toEqual([]);
  });

  it('같은 level 동시 요청은 loader 1회로 합치고 성공 payload를 재사용한다', async () => {
    const loadA = vi.fn(async () => A);
    const lazy = createLazyRegistry(
      LEVEL_META,
      MANIFEST,
      { A: loadA, B: async () => B },
    );

    const [first, second] = await Promise.all([
      lazy.loadGrammarLevel('A'),
      lazy.loadGrammarLevel('a'),
    ]);
    const third = await lazy.loadGrammarLevel('A');

    expect(loadA).toHaveBeenCalledTimes(1);
    expect(first.getGrammarChapters('A')).toBe(second.getGrammarChapters('A'));
    expect(second.getGrammarChapters('A')).toBe(third.getGrammarChapters('A'));
  });

  it('실패 Promise를 제거해 재시도하며 manifest mismatch는 fail closed한다', async () => {
    const loadA = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(A);
    const lazy = createLazyRegistry(
      LEVEL_META,
      MANIFEST,
      { A: loadA, B: async () => B },
    );

    await expect(lazy.loadGrammarLevel('A')).rejects.toThrow('temporary');
    await expect(lazy.loadGrammarLevel('A')).resolves.toBeTruthy();
    expect(loadA).toHaveBeenCalledTimes(2);

    const mismatch = createLazyRegistry(
      LEVEL_META,
      MANIFEST,
      { A: async () => [{ ...A[0], slug: 'wrong' }], B: async () => B },
    );
    await expect(mismatch.loadGrammarLevel('A')).rejects.toThrow(
      'payload does not match generated manifest',
    );
  });

  it('loadChapter는 target과 level 경계 인접 payload를 준비해 full prev/next를 반환한다', async () => {
    const loadA = vi.fn(async () => A);
    const loadB = vi.fn(async () => B);
    const lazy = createLazyRegistry(
      LEVEL_META,
      MANIFEST,
      { A: loadA, B: loadB },
    );

    const { registry, data } = await lazy.loadChapter('b-1');
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(1);
    expect(data).toEqual({
      chapter: B[0],
      prev: A[0],
      next: null,
    });
    expect(registry.getGrammarChapters('A')).toEqual([A[1], A[0]]);
    expect(registry.getGrammarChapters('B')).toEqual(B);
  });

  it('unknown slug는 import 없이 기존 null 조회 의미를 유지한다', async () => {
    const loadA = vi.fn(async () => A);
    const lazy = createLazyRegistry(
      LEVEL_META,
      MANIFEST,
      { A: loadA, B: async () => B },
    );

    const { registry, data } = await lazy.loadChapter('missing');
    expect(data).toBeNull();
    expect(registry.getChapter('missing')).toBeNull();
    expect(loadA).not.toHaveBeenCalled();
  });
});
