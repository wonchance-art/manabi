import { describe, expect, it } from 'vitest';
import { tokenizeZhLine } from '../tokenizeZh.js';

describe('중국어 토큰화', () => {
  it('단어 단위로 분할한다(글자 단위가 아니다)', () => {
    const tokens = tokenizeZhLine('我在北京大学读书。');
    const words = tokens.map((t) => t.text);
    expect(words).toContain('北京大学');   // 4글자 고유명사가 한 토큰
    expect(words).toContain('读书');
    expect(words).not.toContain('北');      // 글자 단위 분해가 아님
  });

  it('한자 토큰에 성조 병음을 단다(furigana 슬롯 — 영어 IPA와 같은 관례)', () => {
    const [first] = tokenizeZhLine('图书馆');
    expect(first.text).toBe('图书馆');
    expect(first.furigana).toBe('tú shū guǎn');
  });

  it('base_form은 표면형과 같다(중국어는 굴절이 없다)', () => {
    for (const t of tokenizeZhLine('他昨天买了三本书。')) {
      expect(t.base_form).toBe(t.text);
    }
  });

  it('문장부호는 기호로 표시하고 병음을 달지 않는다', () => {
    const tokens = tokenizeZhLine('好。');
    const punct = tokens.find((t) => t.text === '。');
    expect(punct?.pos).toBe('기호');
    expect(punct?.furigana).toBe('');
  });

  it('품사 태그를 한국어로 옮긴다', () => {
    const tokens = tokenizeZhLine('我读书。');
    expect(tokens.find((t) => t.text === '我')?.pos).toBe('대명사');
  });

  it('빈 줄·공백은 빈 배열', () => {
    expect(tokenizeZhLine('')).toEqual([]);
    expect(tokenizeZhLine('   ')).toEqual([]);
  });
});
