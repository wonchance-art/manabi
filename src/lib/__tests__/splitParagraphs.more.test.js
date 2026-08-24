import { describe, expect, it } from 'vitest';
import { autoSplitParagraphs } from '../splitParagraphs';

describe('autoSplitParagraphs additional contracts', () => {
  it.each([[null], [''], [undefined]])('preserves falsy input %j', (input) => {
    expect(autoSplitParagraphs(input)).toBe(input);
  });
  it.each(['「대화', '『인용', '【제목', '# heading', '＃ heading', '※ note', '● item', '■ item', '□ item', '▶ item', '▷ item', '► item', '☆ item', '★ item', '・ item'])('breaks before marker %j', (line) => {
    expect(autoSplitParagraphs(`앞줄\n${line}`)).toBe(`앞줄\n\n${line}`);
  });
  it('does not add another break after an existing blank line', () => {
    expect(autoSplitParagraphs('one\n\n# two')).toBe('one\n\n# two');
  });
  it('leaves sufficiently blank-separated content unchanged', () => {
    const text = 'a\n\nb\n\nc';
    expect(autoSplitParagraphs(text)).toBe(text);
  });
});
