import { describe, expect, it, vi } from 'vitest';

vi.mock('../llm.js', () => ({ callLLM: vi.fn() }));
import { analyzeKoreanLines, koreanSourceUnits } from '../koreanAnalysis.js';

describe('Korean analysis requested explanation language', () => {
  it.each([
    ['ko', 'Korean', '빛을 내는 곤충', '주어를 나타내는 조사'],
    ['zh-CN', 'Chinese', '萤火虫', '表示主语的助词'],
    ['zh-TW', 'Chinese', '螢火蟲', '表示主詞的助詞'],
  ])('uses a consistent %s instruction in the actual provider request', async (locale, terms, meaning, functionText) => {
    const lines = ['반딧불이가'];
    const llm = vi.fn(async () => {
      return { text: JSON.stringify({ lines: [{ tokens: [{
        surface: lines[0], start: 0, end: lines[0].length, pos: '명사',
        lemma: '반딧불이', meaning,
        morphology: [{ form: '가', function: functionText }],
      }] }] }) };
    });
    const result = await analyzeKoreanLines({ language: 'Korean', lines, explanationLocale: locale }, { llm });
    expect(llm).toHaveBeenCalledOnce();
    const prompt = llm.mock.calls[0][1];
    expect(prompt).toContain(`must use complete ${terms} terms`);
    if (locale === 'ko') expect(prompt).not.toContain('must use complete Chinese terms');
    if (locale === 'zh-CN') expect(prompt).toContain('natural Simplified Chinese (mainland usage)');
    if (locale === 'zh-TW') expect(prompt).toContain('natural Taiwan Traditional Chinese');
    expect(JSON.parse(prompt.split('SOURCE_UNITS_JSON=')[1])).toEqual(koreanSourceUnits(lines));
    expect(result.results[0].failed).toBeUndefined();
    const word = Object.values(result.results[0].dictionary)[0];
    expect(word.meaning).toBe(meaning);
    expect(word.explanationLocale).toBe(locale);
    expect(result.results[0].sequence.map(id => result.results[0].dictionary[id].text).join('')).toBe(lines[0]);
  });
});
