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
    // 요구는 이름 그대로 **「0건으로 축소하지 않는다」** — 게이트가 빈 코퍼스를 검사하며
    // 공허하게 통과하는 것을 막는 것이다. 등호(toBe)는 그 요구를 넘어서 **콘텐츠가 늘어도**
    // 깨진다(IP v2 되살리기로 예문 하나가 늘며 61→62로 실제로 깨졌다). 위 `fail` 단언이
    // 품질을 이미 책임지므로, 여기서 지킬 것은 축소되지 않는다는 하한 하나다.
    expect(n4.annotated + n5.annotated).toBeGreaterThanOrEqual(61);
  });
});
