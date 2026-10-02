import { describe, expect, it } from 'vitest';
import { applyAozoraRubyLocks, indexAozoraTokenSpans } from '../aozoraRuby.js';

const analysis = () => ({
  rawText: '私は先生です。\n明日も読む。',
  sequence: ['t0', 't1', 't2', 't3', 'nl', 't4', 't5', 't6', 't7'],
  dictionary: {
    t0: { text: '私', furigana: 'わたし' },
    t1: { text: 'は' },
    t2: { text: '先生', furigana: 'せんせい' },
    t3: { text: 'です。' },
    nl: { text: '\n', pos: '개행' },
    t4: { text: '明日', furigana: 'あす' },
    t5: { text: 'も' },
    t6: { text: '読む' },
    t7: { text: '。' },
  },
});

describe('indexAozoraTokenSpans', () => {
  it('maps repeated and newline-separated analyzer tokens in source order', () => {
    const input = analysis();
    expect(indexAozoraTokenSpans(input.rawText, input.sequence, input.dictionary)).toEqual([
      { tokenId: 't0', sequenceIndex: 0, start: 0, end: 1, text: '私' },
      { tokenId: 't1', sequenceIndex: 1, start: 1, end: 2, text: 'は' },
      { tokenId: 't2', sequenceIndex: 2, start: 2, end: 4, text: '先生' },
      { tokenId: 't3', sequenceIndex: 3, start: 4, end: 7, text: 'です。' },
      { tokenId: 'nl', sequenceIndex: 4, start: 7, end: 8, text: '\n' },
      { tokenId: 't4', sequenceIndex: 5, start: 8, end: 10, text: '明日' },
      { tokenId: 't5', sequenceIndex: 6, start: 10, end: 11, text: 'も' },
      { tokenId: 't6', sequenceIndex: 7, start: 11, end: 13, text: '読む' },
      { tokenId: 't7', sequenceIndex: 8, start: 13, end: 14, text: '。' },
    ]);
  });
});

describe('applyAozoraRubyLocks', () => {
  it('overrides analyzer readings only for exact source ranges', () => {
    const input = analysis();
    const result = applyAozoraRubyLocks({
      ...input,
      rubyLocks: [{ start: 8, end: 10, base: '明日', reading: 'あした' }],
    });

    expect(result.dictionary.t4).toMatchObject({
      text: '明日', furigana: 'あした', reading_source: 'aozora', reading_locked: true,
    });
    expect(result.dictionary.t2).toEqual(input.dictionary.t2);
    expect(result.diagnostics).toEqual({ lockCount: 1, appliedCount: 1, unmatchedLocks: [] });
  });

  it('does not guess how to split one source ruby across multiple analyzer tokens', () => {
    const input = analysis();
    const result = applyAozoraRubyLocks({
      ...input,
      rubyLocks: [{ start: 11, end: 13, base: '読む', reading: 'よむ' }],
      dictionary: { ...input.dictionary, t6: { text: '読' }, t7: { text: 'む。' } },
      sequence: ['t0', 't1', 't2', 't3', 'nl', 't4', 't5', 't6', 't7'],
    });

    expect(result.diagnostics.appliedCount).toBe(0);
    expect(result.diagnostics.unmatchedLocks).toEqual([{ start: 11, end: 13, base: '読む', reading: 'よむ' }]);
    expect(result.dictionary.t6.reading_locked).toBeUndefined();
  });

  it('is deterministic, immutable, and leaves analysis input untouched', () => {
    const input = analysis();
    const args = { ...input, rubyLocks: [{ start: 2, end: 4, base: '先生', reading: 'せんせい' }] };
    const first = applyAozoraRubyLocks(args);
    const second = applyAozoraRubyLocks(args);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(input.dictionary.t2.reading_source).toBeUndefined();
    expect(Object.isFrozen(first.dictionary.t2)).toBe(true);
    expect(() => { first.dictionary.t2.furigana = 'changed'; }).toThrow();
  });

  it.each([
    [[{ start: 8, end: 10, base: '今日', reading: 'きょう' }], 'does not match'],
    [[{ start: 8, end: 99, base: '明日', reading: 'あした' }], 'exceeds'],
    [[{ start: 8, end: 10, base: '明日', reading: '' }], 'reading'],
    [[
      { start: 8, end: 10, base: '明日', reading: 'あした' },
      { start: 9, end: 10, base: '日', reading: 'ひ' },
    ], 'overlap'],
  ])('fails closed for invalid ruby locks', (rubyLocks, message) => {
    expect(() => applyAozoraRubyLocks({ ...analysis(), rubyLocks })).toThrow(message);
  });

  it('fails closed when analyzer tokens cannot be mapped back to raw text', () => {
    const input = analysis();
    expect(() => indexAozoraTokenSpans(input.rawText, ['missing'], input.dictionary)).toThrow('Missing token');
    expect(() => indexAozoraTokenSpans(input.rawText, ['t0'], { t0: { text: '僕' } })).toThrow('cannot be mapped');
    expect(() => indexAozoraTokenSpans(input.rawText, ['t0', 't0'], input.dictionary)).toThrow('must be unique');
  });
});
