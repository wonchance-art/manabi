import { describe, it, expect, vi } from 'vitest';

// studyMaterials.js는 @/ 별칭으로 뷰·콘텐츠 모듈을 끌어온다(vitest엔 별칭·DOM 없음).
// deriveVocabRungs가 실제로 쓰는 건 skillRung.computeRung 뿐이라, 그것만 실물로 두고 나머진 목.
vi.mock('@/lib/skillRung', async () => await vi.importActual('../skillRung'));
vi.mock('@/content/refLangs', () => ({ getRefLang: () => ({}) }));
vi.mock('@/views/refShared', () => ({ refMain: () => '', refPron: () => '' }));
vi.mock('@/lib/refQuiz', () => ({ buildChapterQuiz: () => ({}) }));
vi.mock('@/lib/studySession', () => ({ composeSession: () => ({}), buildWarmupItems: () => [] }));
vi.mock('@/lib/writingPrompts', () => ({ levelBand: () => null }));
vi.mock('@/lib/studyParagraph', () => ({ THEMES: [] }));

const { deriveVocabRungs } = await import('../studyMaterials');

// review_events 행 헬퍼 (시간 오름차순으로 넘긴다)
const ev = (source, item_key, correct, qtype = 'choice') => ({
  source, item_key, correct, detail: { qtype },
});

describe('deriveVocabRungs', () => {
  it('vocab 소스 이벤트만으로 rung을 유도한다 (choice 2연속 → 2)', () => {
    const eventsAsc = [
      ev('vocab', '猫', true),
      ev('vocab', '猫', true),
    ];
    const rungs = deriveVocabRungs(eventsAsc, [{ word_text: '猫' }]);
    expect(rungs['猫']).toBe(2);
  });

  it('같은 item_key라도 타 소스(grammar/reading) 이벤트는 rung에 섞이지 않는다', () => {
    // vocab 정답 2연속으로 rung 2를 만든 뒤, 같은 item_key의 grammar 오답 2건을 덧붙인다.
    // source 필터가 없으면 강등되어 1이 되지만, 필터가 있으면 2로 유지되어야 한다.
    const eventsAsc = [
      ev('vocab', '猫', true),
      ev('vocab', '猫', true),
      ev('grammar', '猫', false),
      ev('reading', '猫', false),
    ];
    const rungs = deriveVocabRungs(eventsAsc, [{ word_text: '猫' }]);
    expect(rungs['猫']).toBe(2);
  });

  it('이벤트가 없으면 rung 0', () => {
    const rungs = deriveVocabRungs([], [{ word_text: '犬' }]);
    expect(rungs['犬']).toBe(0);
  });

  it('빈/누락 입력에 방어적', () => {
    expect(deriveVocabRungs(undefined, undefined)).toEqual({});
    expect(deriveVocabRungs([ev('vocab', '猫', true)], [])).toEqual({});
  });
});
