import { describe, expect, it } from 'vitest';
import { groupPdfTextLines, reconstructPdfPageText } from '../pdfText';

function item(str, x, y, width, height = 10, extra = {}) {
  return { str, width, height, transform: [1, 0, 0, height, x, y], ...extra };
}

describe('pdfText', () => {
  it('좌표 순서로 줄을 재구성하고 큰 세로 간격을 문단으로 보존한다', () => {
    const content = {
      items: [
        item('paragraph.', 24, 60, 48),
        item('world', 24, 100, 25),
        item('Last line.', 0, 48, 42),
        item('Hello', 0, 100, 20),
        item('again.', 0, 88, 28),
        item('New', 0, 60, 18),
      ],
    };

    expect(groupPdfTextLines(content).map(line => line.text)).toEqual([
      'Hello world',
      'again.',
      'New paragraph.',
      'Last line.',
    ]);
    expect(reconstructPdfPageText(content)).toBe(
      'Hello world\nagain.\n\nNew paragraph.\nLast line.',
    );
  });

  it('영어 줄끝 하이픈을 다음 줄 소문자 단어와 병합한다', () => {
    const content = {
      items: [
        item('inter-', 0, 100, 30),
        item('national', 0, 88, 38),
        item('standards.', 0, 76, 45),
      ],
    };

    expect(reconstructPdfPageText(content)).toBe('international\nstandards.');
  });

  it('공백 간격이 없는 CJK 조각은 임의 띄어쓰기를 넣지 않고 입력을 변경하지 않는다', () => {
    const items = [
      item('日', 0, 100, 10),
      item('本', 10, 100, 10),
      item('語', 20, 100, 10),
    ];
    const snapshot = structuredClone(items);

    expect(reconstructPdfPageText(items)).toBe('日本語');
    expect(items).toEqual(snapshot);
  });

  it('빈 TextContent는 빈 문자열과 빈 줄 배열을 반환한다', () => {
    expect(groupPdfTextLines({ items: [] })).toEqual([]);
    expect(reconstructPdfPageText(null)).toBe('');
  });
});
