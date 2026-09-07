import { describe, expect, it } from 'vitest';
import { editableEntries, updateChapterValue, chapterEditorHref } from '../chapterEditorModel';

describe('교재 편집 데이터 보존', () => {
  it('출처 객체와 문항 식별자는 텍스트 입력으로 노출하지 않는다', () => {
    expect(editableEntries({ id: 'q1', type: 'choice', ja: 'これ', ko: '이것', src: { provider: 'Tatoeba', license: 'CC BY' } }).map(([key]) => key)).toEqual(['ja', 'ko']);
  });
  it('중첩 대사 한 줄을 고쳐도 다른 대사·출처·원본은 그대로다', () => {
    const chapter = { slug: 'unit', sections: [{ examples: [{ dialogue: [{ speaker: 'A', ja: 'これ' }, { speaker: 'B', ja: 'はい' }], src: { id: 'source-1' } }] }] };
    const next = updateChapterValue(chapter, ['sections', 0, 'examples', 0, 'dialogue', 1, 'ja'], 'どうぞ');
    expect(next.sections[0].examples[0].dialogue[1].ja).toBe('どうぞ');
    expect(chapter.sections[0].examples[0].dialogue[1].ja).toBe('はい');
    expect(next.sections[0].examples[0].src).toEqual({ id: 'source-1' });
    expect(next.sections[0].examples[0].dialogue[0]).toEqual({ speaker: 'A', ja: 'これ' });
  });
  it('문항 정답 인덱스를 고쳐도 문항 ID와 보기 순서는 보존한다', () => {
    const chapter = { sections: [{ story: { questions: [{ id: 'q1', choices: ['하나', '둘'], answer: 0 }] } }] };
    const next = updateChapterValue(chapter, ['sections', 0, 'story', 'questions', 0, 'answer'], 1);
    expect(next.sections[0].story.questions[0]).toEqual({ id: 'q1', choices: ['하나', '둘'], answer: 1 });
  });
  it('교재에서 연 언어와 챕터를 편집 링크에 전달한다', () => {
    expect(chapterEditorHref('Japanese', 'n5-08')).toBe('/admin/textbooks?lang=Japanese&slug=n5-08');
  });
});
