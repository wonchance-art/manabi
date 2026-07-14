import { describe, expect, it } from 'vitest';
import { cultureChapterHref, readingTextHref, toInteractiveNode } from '../cultureDoors.js';

describe('문화 도어 상호작용 계약', () => {
  it('Phaser 노드의 chapter·NPC·스탬프 필드를 React 근접 상태까지 보존한다', () => {
    expect(toInteractiveNode({
      id: 'ramen', name: 'ラーメン', desc: '설명', npc: 'ramen', noStamp: false,
      chapter: 'ot-10-ramen', reading: 'n5-tokyo-01', extra: '렌더 전용',
    })).toEqual({
      id: 'ramen', name: 'ラーメン', desc: '설명', gate: undefined,
      npc: 'ramen', noStamp: false, chapter: 'ot-10-ramen', reading: 'n5-tokyo-01',
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
});
