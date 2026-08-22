import { describe, expect, it, vi } from 'vitest';
import { chunkSavedWords, fetchLearnedWordSet, fetchSavedWordSet, takeThemeWords } from '../referenceVocab';

describe('reference vocab progressive loading', () => {
  it('keeps theme order while limiting rendered rows', () => {
    const themes = [
      { name: 'a', words: [1, 2] },
      { name: 'b', words: [3, 4, 5] },
    ];

    expect(takeThemeWords(themes, 4)).toEqual([
      { name: 'a', words: [1, 2], totalWords: 2 },
      { name: 'b', words: [3, 4], totalWords: 3 },
    ]);
  });

  it('deduplicates and chunks saved-word lookups', () => {
    expect(chunkSavedWords(['a', 'b', 'a', '', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('merges chunked saved-word responses', async () => {
    const queried = [];
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            in: async (_column, words) => {
              queried.push(words);
              return { data: words.map(word_text => ({ word_text })), error: null };
            },
          }),
        }),
      })),
    };

    const saved = await fetchSavedWordSet(client, 'user-1', ['a', 'b', 'c'], 2);
    expect(queried).toEqual([['a', 'b'], ['c']]);
    expect([...saved]).toEqual(['a', 'b', 'c']);
  });

  it('익힘 조회는 repetitions 하한을 걸어 청크 조회한다 (rfc-vocab-encounter §4.3)', async () => {
    const gteArgs = [];
    const client = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            gte: (column, min) => {
              gteArgs.push([column, min]);
              return {
                in: async (_column, words) => (
                  { data: words.filter(w => w !== 'fresh').map(word_text => ({ word_text })), error: null }
                ),
              };
            },
          }),
        }),
      })),
    };

    const learned = await fetchLearnedWordSet(client, 'user-1', ['a', 'fresh', 'b'], 2, 2);
    expect(gteArgs.every(([column, min]) => column === 'repetitions' && min === 2)).toBe(true);
    expect([...learned].sort()).toEqual(['a', 'b']);
    expect((await fetchLearnedWordSet(null, 'user-1', ['a'])).size).toBe(0);
  });
});
