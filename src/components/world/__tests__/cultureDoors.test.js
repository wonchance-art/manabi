import { describe, expect, it } from 'vitest';
import { cultureChapterHref, readingTextHref, toInteractiveNode, trackChapterHref } from '../cultureDoors.js';

describe('문화 도어 상호작용 계약', () => {
  it('Phaser 노드의 chapter·NPC·스탬프 필드를 React 근접 상태까지 보존한다', () => {
    expect(toInteractiveNode({
      id: 'ramen', name: 'ラーメン', desc: '설명', npc: 'ramen', noStamp: false,
      chapter: 'ot-10-ramen', reading: 'n5-tokyo-01', openNow: false, extra: '렌더 전용',
    })).toEqual({
      id: 'ramen', name: 'ラーメン', desc: '설명', gate: undefined,
      npc: 'ramen', noStamp: false, chapter: 'ot-10-ramen', reading: 'n5-tokyo-01', openNow: false,
    });
    expect(toInteractiveNode(null)).toBeNull();
  });

  it.each([
    ['ot-07-konbini', '/japanese/grammar/ot-07-konbini'],
    ['ot-08-izakaya', '/japanese/grammar/ot-08-izakaya'],
    ['ot-10-ramen', '/japanese/grammar/ot-10-ramen'],
    ['ot-12-menzei', '/japanese/grammar/ot-12-menzei'],
  ])('%s만 고정 문법 경로로 만든다', (chapter, href) => {
    expect(cultureChapterHref(chapter)).toBe(href);
  });

  it.each([null, '', '../admin', 'ot-10/ramen', 'ot-10-ramen?x=1', 'n5-01'])('안전하지 않은 챕터 값 %s은 거부한다', (chapter) => {
    expect(cultureChapterHref(chapter)).toBeNull();
  });

  it('A-2 독해 id만 고정 독해 경로로 만든다', () => {
    expect(readingTextHref('n5-tokyo-01')).toBe('/japanese/reading?node=n5-tokyo-01');
    expect(readingTextHref('n5-tokyo-15')).toBe('/japanese/reading?node=n5-tokyo-15');
  });

  it.each([null, '', '../admin', 'n5-tokyo-1', 'n5-tokyo-01&admin=1', 'ot-10-ramen'])('안전하지 않은 독해 값 %s은 거부한다', (reading) => {
    expect(readingTextHref(reading)).toBeNull();
  });

  // 가와구치코 ja 도어 선행 — track 명시 일본어 라우팅은 n5 본편 챕터까지 연다.
  describe('japanese track — n5 본편 확장', () => {
    it.each([
      ['n5-04-desu-da', '/japanese/grammar/n5-04-desu-da'],
      ['n5-07-existence', '/japanese/grammar/n5-07-existence'],
      ['n5-08-te-form', '/japanese/grammar/n5-08-te-form'],
      ['n5-10-kosoado', '/japanese/grammar/n5-10-kosoado'],
      ['n5-04b-meishi-neg-past', '/japanese/grammar/n5-04b-meishi-neg-past'],
      ['ot-10-ramen', '/japanese/grammar/ot-10-ramen'],
    ])('track 명시 %s 를 일본어 문법 경로로 만든다', (chapter, href) => {
      expect(trackChapterHref('japanese', chapter)).toBe(href);
    });

    it('레거시 폴백(cultureChapterHref)은 ot 전용 그대로 — n5 는 여전히 거부한다', () => {
      expect(cultureChapterHref('n5-04-desu-da')).toBeNull();
    });

    it('독해 텍스트·타 트랙 슬러그는 japanese track 에서 거부한다', () => {
      expect(trackChapterHref('japanese', 'n5-tokyo-01')).toBeNull();
      expect(trackChapterHref('japanese', 'n4-01-plain-form')).toBeNull();
      expect(trackChapterHref('japanese', 'h1-01-shi')).toBeNull();
      expect(trackChapterHref('japanese', 'a1-01-greetings')).toBeNull();
    });
  });
});
