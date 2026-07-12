import { describe, it, expect } from 'vitest';
import { mergeChapter, isValidOverride } from '../contentOverrides';

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

  // ── Codex P1 회귀: malformed override는 fail-closed로 base 렌더 ──
  it('sections가 null인 override는 무시하고 base를 반환한다 (렌더 크래시 방지)', () => {
    expect(mergeChapter(base, { sections: null })).toBe(base);
  });

  it('sections가 배열이 아니거나 빈 배열인 override는 무시한다', () => {
    expect(mergeChapter(base, { sections: {} })).toBe(base);
    expect(mergeChapter(base, { sections: [] })).toBe(base);
    expect(mergeChapter(base, { sections: 'x' })).toBe(base);
  });

  it('섹션 항목이 객체가 아니면 무시한다', () => {
    expect(mergeChapter(base, { sections: [null] })).toBe(base);
    expect(mergeChapter(base, { sections: ['문자열'] })).toBe(base);
    expect(mergeChapter(base, { sections: [[1]] })).toBe(base);
  });

  it('문자열 필드에 비문자열이 오면 무시한다', () => {
    expect(mergeChapter(base, { title: 42 })).toBe(base);
    expect(mergeChapter(base, { sections: [{ heading: '유효', body: 123 }] })).toBe(base);
  });
});

describe('isValidOverride', () => {
  it('정상 오버라이드는 통과한다', () => {
    expect(isValidOverride({ title: '수정 제목' })).toBe(true);
    expect(isValidOverride({ sections: [{ heading: 'h', body: 'b', examples: [] }] })).toBe(true);
    expect(isValidOverride({ title: null, sections: [{ tip: null }] })).toBe(true); // null은 허용(렌더가 스킵)
  });

  it('렌더를 깨는 형태는 거부한다', () => {
    expect(isValidOverride(null)).toBe(false);
    expect(isValidOverride([])).toBe(false);
    expect(isValidOverride({ sections: null })).toBe(false);
    expect(isValidOverride({ sections: {} })).toBe(false);
    expect(isValidOverride({ sections: [] })).toBe(false);
    expect(isValidOverride({ sections: [{ examples: {} }] })).toBe(false);
    expect(isValidOverride({ summary: ['배열'] })).toBe(false);
  });
});
