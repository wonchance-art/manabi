import { describe, it, expect } from 'vitest';
import { mergeChapter } from '../contentOverrides';

const base = {
  slug: 'n5-04-desu-da',
  level: 'N5',
  order: 1,
  title: '원본 제목',
  topic: '원본 주제',
  summary: '원본 요약',
  sections: [{ heading: '원본 섹션' }],
};

describe('mergeChapter', () => {
  it('override의 필드로 얕게 병합한다', () => {
    const merged = mergeChapter(base, { title: '수정 제목', summary: '수정 요약' });
    expect(merged.title).toBe('수정 제목');
    expect(merged.summary).toBe('수정 요약');
    // override에 없는 필드는 base 유지
    expect(merged.topic).toBe('원본 주제');
    expect(merged.sections).toEqual([{ heading: '원본 섹션' }]);
  });

  it('slug·level·order는 override가 있어도 base 값을 강제한다', () => {
    const merged = mergeChapter(base, {
      slug: '해킹된-slug',
      level: 'N1',
      order: 999,
      title: '수정 제목',
    });
    expect(merged.slug).toBe('n5-04-desu-da');
    expect(merged.level).toBe('N5');
    expect(merged.order).toBe(1);
    expect(merged.title).toBe('수정 제목');
  });

  it('override가 null이면 base를 그대로 반환한다', () => {
    expect(mergeChapter(base, null)).toBe(base);
    expect(mergeChapter(base, undefined)).toBe(base);
  });

  it('override가 객체가 아니면 base를 그대로 반환한다', () => {
    expect(mergeChapter(base, 'not-an-object')).toBe(base);
    expect(mergeChapter(base, 42)).toBe(base);
  });

  it('base가 falsy면 그대로 반환한다', () => {
    expect(mergeChapter(null, { title: 'x' })).toBe(null);
    expect(mergeChapter(undefined, { title: 'x' })).toBe(undefined);
  });

  it('base에 없던 새 필드는 override로 추가된다', () => {
    const merged = mergeChapter(base, { duration: '약 8분' });
    expect(merged.duration).toBe('약 8분');
  });

  it('원본 객체를 변형하지 않는다(불변)', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    mergeChapter(base, { title: '수정', slug: 'x' });
    expect(base).toEqual(snapshot);
  });
});
