import { describe, expect, it } from 'vitest';
import { buildReadingCheckPrompt, validateReadingQuestions } from '../readingTestReliability';
const q = { type: 'mcq', question: '他喝什么？', options: ['茶', '水', '牛奶', '咖啡'], answer: 0, explanation: '차를 마셨다고 합니다.', evidence: '他喝茶。' };
const questions = () => Array.from({ length: 5 }, () => structuredClone(q));
describe('language-aware reading checks', () => {
  it('uses Chinese questions and Korean explanation without English exam instructions', () => {
    const prompt = buildReadingCheckPrompt('他喝茶。', 'Chinese');
    expect(prompt).toContain('질문과 선택지는 중국어');
    expect(prompt).toContain('explanation은 한국어');
    expect(prompt).not.toContain('IELTS');
    expect(() => buildReadingCheckPrompt('a', undefined)).toThrow();
  });
  it('accepts a complete, grounded response and rejects malformed indices, duplicates and invented evidence', () => {
    expect(validateReadingQuestions(questions(), '他喝茶。', 'Chinese')).toBe(true);
    for (const patch of [{ answer: 4 }, { answer: 0.5 }, { evidence: '他说不。' }, { question: 'What did he drink?' }, { options: ['茶', '茶', '水', '奶'] }, { explanation: '' }]) {
      const qs = questions(); qs[0] = { ...q, ...patch };
      expect(validateReadingQuestions(qs, '他喝茶。', 'Chinese')).toBe(false);
    }
    expect(validateReadingQuestions(questions().slice(1), '他喝茶。', 'Chinese')).toBe(false);
  });
});
