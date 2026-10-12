import { describe, expect, it } from 'vitest';
import { zhPieces, zhRunCells, zhClosingCells, zhKinsokuMarks, zhKinsokuStyle, isZhFullWidth } from '../zhGrid';

// ZH-GRID-001(오너 승인 목업 2026-10-12): 한자·전각 부호 = 한 칸, 반각 묶음 = 올림 칸, 닫는 부호는 줄머리 금지.
describe('zhPieces — 전각 글자는 한 칸씩, 반각은 이어진 묶음', () => {
  it('splits hanzi and full-width punctuation into single cells', () => {
    expect(zhPieces('你好，世界。')).toEqual(['你', '好', '，', '世', '界', '。'].map(cell => ({ cell })));
    for (const ch of '「」『』《》（）！？：；、…—“”·') expect(isZhFullWidth(ch), ch).toBe(true);
  });
  it('keeps digits and Latin together as one run between cells', () => {
    expect(zhPieces('2024年')).toEqual([{ run: '2024' }, { cell: '年' }]);
    expect(zhPieces('买iPhone 15了')).toEqual([{ cell: '买' }, { run: 'iPhone 15' }, { cell: '了' }]);
    expect(zhPieces('T恤')).toEqual([{ run: 'T' }, { cell: '恤' }]);
    expect(zhPieces('')).toEqual([]);
    expect(zhPieces('你 好')).toEqual([{ cell: '你' }, { cell: '好' }]);
    expect(zhPieces(' ')).toEqual([]);
  });
});

describe('zhRunCells — 반각 폭을 칸 수로 올림', () => {
  it('a run fills k cells (k×cell + (k−1)×gap) and never less than one', () => {
    expect(zhRunCells(10, 44)).toBe(1);
    expect(zhRunCells(44, 44)).toBe(1);
    expect(zhRunCells(45, 44)).toBe(2);
    expect(zhRunCells(60, 25.6)).toBe(3);
    // With a gap the k-cell span is k×cell + (k−1)×gap: 2 cells of 20 + one gap of 8 hold 48px.
    expect(zhRunCells(48, 20, 8)).toBe(2);
    expect(zhRunCells(49, 20, 8)).toBe(3);
  });
  it('empty or broken measurements take no cells', () => {
    expect(zhRunCells(0, 44)).toBe(0);
    expect(zhRunCells(NaN, 44)).toBe(0);
    expect(zhRunCells(30, 0)).toBe(0);
  });
});

describe('줄머리 금칙 — 닫는 부호 묶음은 앞 토큰과 한 줄', () => {
  it('recognises closing marks and counts their cells', () => {
    expect(zhClosingCells('。')).toBe(1);
    expect(zhClosingCells('！」')).toBe(2);
    expect(zhClosingCells('……')).toBe(2);
    expect(zhClosingCells(',')).toBe(1);
    for (const t of ['「', '（', '你', '2024', '', '好。']) expect(zhClosingCells(t), t).toBe(0);
  });
  it('holds the token before a run of closing marks and pulls the first mark by the run width, per line', () => {
    const tokens = { a: { text: '壮观' }, b: { text: '，' }, c: { text: '好看' }, d: { text: '！' }, e: { text: '」' },
      f: { text: '吧' }, br: { text: '\n', pos: '개행' }, g: { text: '。' }, h: { text: '我' } };
    const marks = zhKinsokuMarks(['a', 'b', 'c', 'd', 'e', 'f', 'br', 'g', 'h'], id => tokens[id]);
    expect(Object.fromEntries(marks)).toEqual({ a: { hold: 1 }, b: { pull: 1 }, c: { hold: 2 }, d: { pull: 2 } });
    // A mark that opens a line after a hard break has nothing to hold on to.
    expect(marks.has('g')).toBe(false);
    expect(zhKinsokuStyle(marks.get('c'))).toEqual({ '--zh-hold': 2 });
    expect(zhKinsokuStyle(marks.get('d'))).toEqual({ '--zh-pull': 2 });
    expect(zhKinsokuStyle(undefined)).toBe(null);
  });
});
