import { describe, expect, it, vi } from 'vitest';
import { createPublishedRegistry, chapterSources, loadPublishedRegistry } from '../publishedChapter';
import { buildChapterQuiz, buildReviewQuiz } from '../refQuiz';
import { buildCumulativeReview } from '../learn/cumulativeReview';

vi.mock('../contentOverrides', async importOriginal => ({
  ...await importOriginal(), getOverridesForLang: vi.fn(async () => new Map()),
}));

const chapter = {
  slug: 'first', title: '원본 제목', level: 'A1', order: 1,
  sections: [{ heading: '첫 장면', pattern: 'want', examples: [
    { en: 'I want coffee.', ko: '커피를 원해요.' },
    { en: 'We read the book.', ko: '책을 읽어요.' },
  ] }], drills: [{ id: 'drill-one', type: 'fill', prompt: 'original ___', answer: 'a' }],
};
const others = ['second','third','fourth','fifth'].map((slug, i) => ({
  slug, title: slug, level: 'A1', order: i + 2, sections: [{ pattern: ['need','like','have','drink'][i] }],
}));
const all = [chapter, ...others];
const base = {
  base: '/english', name: '영어', ALL_CHAPTERS: all,
  getChapter: slug => {
    const i = all.findIndex(c => c.slug === slug);
    return i < 0 ? null : { chapter: all[i], prev: all[i - 1], next: all[i + 1] };
  }, getGrammarChapters: () => all,
};
const edited = { ...chapter, title: '수정 제목', sections: [{ ...chapter.sections[0], examples: [
  { en: 'I want tea.', ko: '차를 원해요.' }, chapter.sections[0].examples[1],
] }], drills: [{ id: 'drill-one', type: 'fill', prompt: 'updated ___', answer: 'a' }] };

describe('공개 원고의 동일한 해석', () => {
  it('본문·이전/다음·전체 목차·복습은 같은 수정본을 읽고 정적 원본은 보존한다', () => {
    const ref = createPublishedRegistry('English', base, new Map([['first', edited]]));
    const resolved = ref.getChapter('first').chapter;
    expect(resolved.title).toBe('수정 제목');
    expect(ref.getChapter('second').prev).toBe(resolved);
    expect(ref.ALL_CHAPTERS[0]).toBe(resolved);
    expect(ref.getGrammarChapters('A1')[0]).toBe(resolved);
    const review = buildReviewQuiz(resolved, ref);
    expect(review.meaning[0].full).toBe('I want tea.');
    expect(buildChapterQuiz(resolved, ref).meaning[0]).toEqual(review.meaning[0]);
    expect(buildCumulativeReview(ref.getGrammarChapters('A1'), 'fifth')[0].prompt).toBe('updated ___');
    expect(chapter.title).toBe('원본 제목');
    expect(chapter.sections[0].examples[0].en).toBe('I want coffee.');
  });
  it('다른 챕터에서 가져오는 오답 보기에도 수정본을 적용한다', () => {
    const ref = createPublishedRegistry('English', base, new Map([['second', { sections: [{ pattern: 'prefer' }] }]]));
    const quiz = buildReviewQuiz(ref.getChapter('first').chapter, ref);
    expect(quiz.meaning[0].distractors).toContain('prefer');
    expect(quiz.meaning[0].distractors).not.toContain('need');
  });
  it('잘못된 수정본은 원본으로 안전하게 돌아가며 없는 챕터를 생성하지 않는다', () => {
    const ref = createPublishedRegistry('English', base, new Map([['first', { sections: null }]]));
    expect(ref.getChapter('first').chapter).toBe(chapter);
    expect(ref.getChapter('missing')).toBeNull();
  });
  it('네트워크 수정본 조회도 같은 resolver를 제공한다', async () => {
    const { getOverridesForLang } = await import('../contentOverrides');
    getOverridesForLang.mockResolvedValueOnce(new Map([['first', edited]]));
    const ref = await loadPublishedRegistry('English', base);
    expect(ref.getChapter('first').chapter.title).toBe('수정 제목');
    expect(getOverridesForLang).toHaveBeenCalledWith('English');
  });
});

describe('출처 위치와 내용 버전', () => {
  it('웹 문구 편집 전후에 출처 ID는 유지하고 내용 버전과 발췌만 바뀐다', () => {
    const before = chapterSources('English', chapter, chapter, '/english');
    const after = chapterSources('English', chapter, edited, '/english');
    expect(after.sections[0].examples[0].blockId).toBe(before.sections[0].examples[0].blockId);
    expect(after.revision).not.toBe(before.revision);
    expect(after.sections[0].examples[0]).toMatchObject({ bookId: 'English:A1', quote: 'I want tea.', legacySection: 0, legacyExample: 0 });
    expect(after.sections[0].examples[0].href).toContain(`#${after.sections[0].examples[0].blockId}`);
  });
  it('원본의 서로 다른 섹션을 재배치해도 내용 기반 ID는 따라간다', () => {
    const one = { ...chapter, sections: [...chapter.sections, { heading: '두 번째', examples: [{ en: 'Other.', ko: '다른 문장.' }] }] };
    const moved = { ...one, sections: [...one.sections].reverse() };
    const a = chapterSources('English', one, one, '/english');
    const b = chapterSources('English', moved, moved, '/english');
    expect(b.sections[1].examples[0].blockId).toBe(a.sections[0].examples[0].blockId);
  });
  it('중복 예문을 서로 구분하고 객체 키 순서는 버전에 영향을 주지 않는다', () => {
    const duplicated = { ...chapter, sections: [{ ...chapter.sections[0], examples: [chapter.sections[0].examples[0], chapter.sections[0].examples[0]] }] };
    const a = chapterSources('English', duplicated, duplicated, '/english');
    expect(new Set(a.sections[0].examples.map(s => s.blockId)).size).toBe(2);
    const reversedKeys = Object.fromEntries(Object.entries(duplicated).reverse());
    expect(chapterSources('English', reversedKeys, reversedKeys, '/english').revision).toBe(a.revision);
  });
  it('모든 복습 단계가 렌더 가능한 예문 위치와 당시 발췌를 갖는다', () => {
    const ref = createPublishedRegistry('English', base, new Map([['first', edited]]));
    const quiz = buildChapterQuiz(ref.getChapter('first').chapter, ref);
    for (const question of [...quiz.meaning, ...quiz.apply, ...quiz.produce]) {
      expect(question.sourceRef.quote).toBe(question.full || question.answer || question.main);
      expect(question.sourceRef.chapterSlug).toBe('first');
    }
  });
  it('4언어 기존 교재에서도 유효한 수정본과 출처를 함께 만든다', async () => {
    const { REF_LANGS } = await import('../../content/refLangs');
    for (const [lang, registry] of Object.entries(REF_LANGS)) {
      const original = registry.ALL_CHAPTERS.find(c => c.sections?.some(s => s.examples?.some(e => e.ko && (e.ja || e.zh || e.fr || e.en))));
      const ref = createPublishedRegistry(lang, registry, new Map([[original.slug, { title: '수정 제목' }]]));
      const resolved = ref.getChapter(original.slug).chapter;
      expect(resolved.title).toBe('수정 제목');
      const source = ref.getChapterSources(resolved).sections.flatMap(s => s.examples)[0];
      expect(source.lang).toBe(lang);
      expect(source.href.startsWith(registry.base)).toBe(true);
    }
  }, 30000);
});
