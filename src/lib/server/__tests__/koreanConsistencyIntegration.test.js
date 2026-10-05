import { expect, it, vi } from 'vitest';
vi.mock('../llm.js', () => ({ callLLM: vi.fn() }));
import { parseKoreanAnalysis } from '../koreanAnalysis.js';

it.each(['ko', 'zh-CN', 'zh-TW'])('preserves the original failed line in %s without changing valid lines or quality claims', locale => {
  const token = (surface, lemma, form) => ({ start: 0, end: surface.length, surface, lemma, pos: '동사', meaning: 'go', morphology: [{ form, function: 'polite ending' }] });
  const raw = JSON.stringify({ lines: [
    { tokens: [token('가요', '가다', '-어요')] }, { tokens: [token('갔어요', '가다', '-어요')] },
  ] });
  const result = parseKoreanAnalysis(raw, ['가요', '갔어요'], locale);
  expect(result[0]).toMatchObject({ failed: true, errorCode: 'inconsistent_morphology', metadata: { analysisVersion: 'ko-llm-v1', analysisQuality: 'unreviewed' } });
  expect(result[0].dictionary[result[0].sequence[0]].text).toBe('가요');
  expect(result[1].failed).toBeUndefined();
  expect(result[1].dictionary[result[1].sequence[0]]).toMatchObject({ meaning: 'go', lemma: '가다', explanationLocale: locale });
});
