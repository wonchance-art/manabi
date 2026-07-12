import { describe, expect, it, vi } from 'vitest';
import { chunkSavedWords, fetchSavedWordSet, takeThemeWords } from '../referenceVocab';

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
});
