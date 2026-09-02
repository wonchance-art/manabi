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

  it('story 대사와 노래 한 줄도 같은 정렬기로 검사한다 — 한글 병기 요미의 숫자 독음·… 누락이 잡힌다', () => {
    // check-content.mjs의 복제 정렬기는 한글 병기를 KO_MIXED로 통째 면제해 스토리 대사 2건이 숨었다
    // (분석기 리뷰 라운드 6). 정렬기를 이 파일 하나로 모으고 story.body·media.line까지 순회한다.
    const chapter = (body, line) => [{ slug: 'x', sections: [
      { examples: [{ ja: '公です', yomi: 'こうです (코-데스)' }] },
      { story: { body: [{ narr: '내레이션 문단은 건너뛴다' }, ...body] } },
      { media: { line } },
    ] }];
    const good = checkFuriganaData(chapter(
      [{ speaker: 'A', ja: '指定席の ほうが よかったかな…?', yomi: 'していせきの ほうが よかったかな…? (시테-세키노 호-가 요캇타카나…?)' }],
      { ja: '公です', yomi: 'こうです' },
    ));
    expect(good.total).toBe(3);
    expect(good.annotated).toBe(2);
    expect(good.fail).toEqual([]);
    const bad = checkFuriganaData(chapter(
      [{ speaker: 'A', ja: 'うん、5,000えん こえたよ。', yomi: 'うん、5,000えん こえたよ (웅, 고셍엔 코에타요)' },
       { speaker: 'B', ja: '指定席の ほうが よかったかな…?', yomi: 'していせきの ほうが よかったかな (시테-세키노 호-가 요캇타카나)' }],
      { ja: '公です', yomi: 'こうです (코-데스) 꼬리' },
    ));
    expect(bad.fail.map((f) => f.where)).toEqual(['x §2 story[1]', 'x §2 story[2]', 'x §3 media']);
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
