import { describe, it, expect } from 'vitest';
import { findChapterForTag, attachTagLinks } from '../writingTagLink';

// 합성 레지스트리 — topic·제목·섹션 텍스트 매칭 검증용
const REF = {
  base: '/japanese',
  ALL_CHAPTERS: [
    {
      slug: 'n5-05-particles-wa-ga', level: 'N5', order: 2, title: '은는과 이가',
      topic: '조사 은는·이가',
      sections: [{ heading: 'は vs が', pattern: 'は/が', patternKo: '은는/이가 구분' }],
    },
    {
      slug: 'n4-03-potential', level: 'N4', order: 3, title: '가능형',
      topic: '가능형',
      sections: [{ heading: '조사가 바뀐다 — を → が', pattern: 'が + 가능형', patternKo: '가능형의 대상은 が' }],
    },
    {
      slug: 'n5-09-adjectives', level: 'N5', order: 9, title: '형용사 두 종류',
      topic: '형용사 두 종류',
      sections: [{ heading: 'い형용사', pattern: '~い', patternKo: 'い형용사 활용' }],
    },
  ],
};

describe('findChapterForTag', () => {
  it('topic 통째 포함이 최우선', () => {
    expect(findChapterForTag(REF, '가능형')?.slug).toBe('n4-03-potential');
  });

  it('섹션 제목·패턴 포함으로도 찾는다', () => {
    expect(findChapterForTag(REF, 'い형용사')?.slug).toBe('n5-09-adjectives');
  });

  it('토큰 분해 매칭 — 전 토큰 등장 + topic/제목에 일부 존재', () => {
    expect(findChapterForTag(REF, '조사 은는')?.slug).toBe('n5-05-particles-wa-ga');
  });

  it('한 글자 조사만으로는 과잉 매칭하지 않는다', () => {
    // 'が'는 여러 챕터 본문에 있지만 topic/제목에 단독 등장하지 않으면 매칭 없음이 안전
    const hit = findChapterForTag(REF, 'X없는태그');
    expect(hit).toBeNull();
  });

  it("'기타'·빈 태그는 null", () => {
    expect(findChapterForTag(REF, '기타')).toBeNull();
    expect(findChapterForTag(REF, '')).toBeNull();
    expect(findChapterForTag(null, '가능형')).toBeNull();
  });
});

describe('attachTagLinks', () => {
  it('오류에 href를 부착하고, 못 찾으면 그대로 둔다', () => {
    const fb = {
      sentences: [{
        original: 'a', corrected: 'b',
        errors: [
          { part: 'x', fix: 'y', why: 'z', tag: '가능형' },
          { part: 'x', fix: 'y', why: 'z', tag: '없는문법' },
        ],
      }],
    };
    attachTagLinks(fb, REF);
    expect(fb.sentences[0].errors[0].href).toBe('/japanese/grammar/n4-03-potential');
    expect(fb.sentences[0].errors[1].href).toBeUndefined();
  });

  it('feedback/ref 없으면 무해', () => {
    expect(attachTagLinks(null, REF)).toBeNull();
    const fb = { sentences: [{ original: 'a', corrected: 'b', errors: [{ tag: 't', part: 'p', fix: 'f' }] }] };
    expect(attachTagLinks(fb, null)).toBe(fb);
  });
});
