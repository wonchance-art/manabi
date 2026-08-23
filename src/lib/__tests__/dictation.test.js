import { describe, expect, it } from 'vitest';
import { gradeDictation, normalizeDictation } from '../dictation.js';

// 계약: 받아쓰기 채점(#1077-6) — 정규화 규칙은 결정적, diff는 diffChars 위임.

describe('normalizeDictation — 언어별 정규화', () => {
  it('ja — 구두점 제거·공백 정리, 가나/한자 표기는 그대로', () => {
    expect(normalizeDictation('  国境の長いトンネルを抜けると、雪国であった。 ', 'Japanese'))
      .toBe('国境の長いトンネルを抜けると雪国であった');
    expect(normalizeDictation('「はい」と言った！', 'Japanese')).toBe('はいと言った');
  });

  it('en — 소문자화·구두점 제거·연속 공백 1개', () => {
    expect(normalizeDictation('Hello,   World!', 'English')).toBe('hello world');
  });

  it('fr — 소문자화 + NFC(분해 악상 합성)', () => {
    const decomposed = 'Café'; // e + 결합 악상
    expect(normalizeDictation(decomposed, 'French')).toBe('café');
  });

  it('zh — 표기 그대로(대소문자 개념 없음), 중문 구두점 제거', () => {
    expect(normalizeDictation('你好，世界。', 'Chinese')).toBe('你好世界');
  });
});

describe('gradeDictation — 채점', () => {
  it('완전 일치(정규화 후)', () => {
    const g = gradeDictation('雪国であった。', '雪国であった', 'Japanese');
    expect(g.correct).toBe(true);
    expect(g.accuracy).toBe(1);
  });

  it('부분 일치 — accuracy는 정답 글자 수 대비 일치 글자 비율(소수 그대로)', () => {
    const g = gradeDictation('雪国であった', '雪国だった', 'Japanese');
    expect(g.correct).toBe(false);
    expect(g.accuracy).toBeGreaterThan(0);
    expect(g.accuracy).toBeLessThan(1);
    // 정답에만 있는 글자는 ins(누락), 입력에만 있는 글자는 del(잉여)
    expect(g.segments.some((s) => s.type === 'ins')).toBe(true);
  });

  it('en — 대소문자·구두점 차이는 채점에 영향 없음', () => {
    const g = gradeDictation('Hello, world!', 'hello world', 'English');
    expect(g.correct).toBe(true);
    expect(g.accuracy).toBe(1);
  });

  it('전무 입력 — 정답 전체가 누락(ins), accuracy 0', () => {
    const g = gradeDictation('你好', '', 'Chinese');
    expect(g.correct).toBe(false);
    expect(g.accuracy).toBe(0);
    expect(g.segments).toEqual([{ type: 'ins', text: '你好' }]);
  });

  it('빈 정답은 accuracy null(채점 불가 표지)', () => {
    expect(gradeDictation('', 'abc', 'English').accuracy).toBeNull();
    expect(gradeDictation('。、！', 'x', 'Japanese').accuracy).toBeNull(); // 구두점뿐 → 정규화 후 빈 정답
  });
});
