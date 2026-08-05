import { describe, expect, it } from 'vitest';
import n4Grammar from '../src/content/japanese/grammar/n4.js';
import n5Grammar from '../src/content/japanese/grammar/n5.js';
import {
  alignFurigana,
  checkFuriganaData,
  parseAlignmentYomi,
} from './check-furigana.mjs';

describe('check-furigana mixed-yomi gate', () => {
  it('terminal 한글 병기만 분리하고 kana 본문은 기존 정렬기에 전달한다', () => {
    expect(parseAlignmentYomi('こうです (코-데스)')).toEqual({
      kind: 'ko-annotated',
      yomi: 'こうです',
      annotation: '코-데스',
    });
    expect(alignFurigana('公です', 'こうです (코-데스)')).toEqual([
      { text: '公', rt: 'こう' },
      { text: 'です' },
    ]);
  });

  it('한글-only 또는 kana 본문에 섞인 한글 mutation은 hard fail한다', () => {
    expect(alignFurigana('公です', '완전히 잘못된 독음')).toBeNull();
    expect(alignFurigana('公です', 'こう한글です (코-데스)')).toBeNull();
    expect(alignFurigana('公です', 'こうです (코-데스) trailing')).toBeNull();
  });

  it('실콘텐츠 한글 병기 예문을 0건으로 축소하지 않고 전부 검사한다', () => {
    const n4 = checkFuriganaData(n4Grammar);
    const n5 = checkFuriganaData(n5Grammar);

    expect(n4.fail).toEqual([]);
    expect(n5.fail).toEqual([]);
    expect(n4.annotated + n5.annotated).toBe(61);
  });
});
