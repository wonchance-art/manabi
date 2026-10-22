import { describe, expect, it } from 'vitest';
import { decodeExampleSeg, decodeFuri, encodeExampleSeg, encodeFuri } from '../levelExampleCode.js';
import { levelListData } from '../levelListData.js';

// 예문 나눔 · 후리가나의 짧은 꼴 — 값 손실 0(왕복 동치) · 실제 레벨 데이터가 모두 줄인 꼴로 실린다(배열이면 페이로드 값 수가 그대로다).
describe('예문 짧은 꼴', () => {
  it('왕복 동치 — 중국어 seg · 일본어 seg + lem · 후리가나', () => {
    expect(encodeExampleSeg([2, 1, 3])).toEqual({ seg: '2,1,3' });
    expect(decodeExampleSeg({ seg: '2,1,3' })).toEqual({ seg: [2, 1, 3], lem: null });
    expect(encodeExampleSeg([2, 1, 3], [1, 0, 'する'])).toEqual({ seg: '2.,1-,3=する' });
    expect(decodeExampleSeg({ seg: '2.,1-,3=する' })).toEqual({ seg: [2, 1, 3], lem: [1, 0, 'する'] });
    expect(encodeFuri([[0, 2, 'いっさい'], [2, 1, 'かた']])).toBe('0,2,いっさい;2,1,かた');
    expect(decodeFuri('0,2,いっさい;2,1,かた')).toEqual([[0, 2, 'いっさい'], [2, 1, 'かた']]);
  });
  it('구분 글자가 든 값은 줄이지 않고 배열 그대로 — 되살리기는 배열도 받는다', () => {
    expect(encodeExampleSeg([1, 1], [1, 'a,b'])).toEqual({ seg: [1, 1], lem: [1, 'a,b'] });
    expect(decodeExampleSeg({ seg: [1, 1], lem: [1, 'a,b'] })).toEqual({ seg: [1, 1], lem: [1, 'a,b'] });
    expect(encodeFuri([[0, 1, 'x;y']])).toEqual([[0, 1, 'x;y']]);
    expect(decodeFuri([[0, 1, 'x;y']])).toEqual([[0, 1, 'x;y']]);
    expect(decodeExampleSeg({ seg: '2,x' })).toEqual({ seg: null, lem: null });
    expect(decodeExampleSeg({})).toEqual({ seg: null, lem: null });
    expect(decodeFuri(undefined)).toBeNull();
  });
  it.each([['chinese', 'H1'], ['chinese', 'H4'], ['japanese', 'N5'], ['japanese', 'N3']])('실제 데이터 %s %s — 줄인 꼴로 싣고 되살리면 예문 글자 수와 맞는다', async (lang, lv) => {
    const entries = (await levelListData(lang, 'vocab', lv)).groups.flatMap((g) => g.entries).filter((e) => e.ex?.seg);
    expect(entries.length).toBeGreaterThan(100);
    for (const e of entries) {
      expect(typeof e.ex.seg, e.word).toBe('string');
      expect(e.ex.lem, e.word).toBeUndefined();
      const { seg, lem } = decodeExampleSeg(e.ex);
      expect(seg.reduce((a, b) => a + b, 0), e.word).toBe([...e.ex.text].length);
      expect(lem === null, e.word).toBe(lang === 'chinese');
      if (e.ex.furi) {
        expect(typeof e.ex.furi, e.word).toBe('string');
        for (const [s, n, rt] of decodeFuri(e.ex.furi)) expect(s >= 0 && n > 0 && s + n <= [...e.ex.text].length && !!rt, e.word).toBe(true);
      }
    }
  }, 60000);
});
