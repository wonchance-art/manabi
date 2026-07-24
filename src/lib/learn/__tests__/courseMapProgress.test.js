import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
};

query.select.mockReturnValue(query);
query.eq.mockReturnValue(query);

vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => query),
  },
}));

import { buildCourseMap, getCourseLessonContext } from '../courseMapData';
import { getLessonProgress, recordLessonCompleted } from '../progressStore';

describe('getLessonProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({ data: [], error: null });
    global.window = {};
    global.localStorage = {
      data: {},
      getItem(key) { return this.data[key] || null; },
      setItem(key, value) { this.data[key] = value; },
      clear() { this.data = {}; },
    };
  });

  it('게스트는 F2 localStorage 진도를 사용한다', async () => {
    localStorage.setItem('studied_lesson', JSON.stringify(['a1-01', 'other-track']));
    localStorage.setItem('en_read_chapters_check', JSON.stringify({
      'a1-02': { passed: true },
      'a1-03': { passed: false },
    }));

    const result = await getLessonProgress(undefined, {
      lang: 'English',
      slugs: ['a1-01', 'a1-02', 'a1-03'],
    });

    expect(result).toEqual({
      completedSlugs: ['a1-01', 'a1-02'],
      source: 'guest',
    });
  });

  it('로그인 진도는 원격과 이 기기 값을 합친다', async () => {
    localStorage.setItem('studied_lesson', JSON.stringify(['a1-01']));
    query.in.mockResolvedValue({
      data: [{ slug: 'a1-02', read: false, passed: true }],
      error: null,
    });

    const result = await getLessonProgress('user-1', {
      lang: 'English',
      slugs: ['a1-01', 'a1-02'],
    });

    expect(result).toEqual({
      completedSlugs: ['a1-01', 'a1-02'],
      source: 'remote',
    });
  });

  it('원격 조회 실패 시 이 기기 진도로 폴백한다', async () => {
    localStorage.setItem('en_read_chapters', JSON.stringify(['a1-01']));
    query.in.mockRejectedValue(new Error('offline'));

    const result = await getLessonProgress('user-1', {
      lang: 'English',
      slugs: ['a1-01'],
    });

    expect(result).toEqual({
      completedSlugs: ['a1-01'],
      source: 'local-fallback',
    });
  });

  it('어휘 세트의 전 단어를 체크하면 같은 레슨 진도로 합친다', async () => {
    localStorage.setItem('as_vcheck_Chinese_LIFE', JSON.stringify(['国际转机', '转机柜台']));

    const result = await getLessonProgress(undefined, {
      lang: 'Chinese',
      slugs: ['vocab:chinese:life:1', 'vocab:chinese:life:2'],
      vocabLessons: [
        {
          slug: 'vocab:chinese:life:1',
          storageKey: 'as_vcheck_Chinese_LIFE',
          words: ['国际转机', '转机柜台'],
        },
        {
          slug: 'vocab:chinese:life:2',
          storageKey: 'as_vcheck_Chinese_LIFE',
          words: ['预订确认单'],
        },
      ],
    });

    expect(result).toEqual({
      completedSlugs: ['vocab:chinese:life:1'],
      source: 'guest',
    });
  });

  it('게스트가 영어 A1 첫 레슨을 마치면 코스 지도 진도가 1/9가 된다', async () => {
    const map = buildCourseMap('english', 'A1');
    const firstSlug = map.lessons[0].specialFields.originalChapterSlug;
    const context = getCourseLessonContext('English', 'A1', firstSlug);
    const slugs = map.lessons.map(
      (lesson) => lesson.specialFields.originalChapterSlug,
    );

    expect(map.lessons).toHaveLength(9);

    await recordLessonCompleted(undefined, context.lessonRef);
    await recordLessonCompleted(undefined, context.lessonRef);

    const progress = await getLessonProgress(undefined, {
      lang: 'English',
      slugs,
    });

    expect(progress.completedSlugs).toEqual([firstSlug]);
    expect(JSON.parse(localStorage.getItem('studied_lesson'))).toEqual([firstSlug]);
    expect(progress.completedSlugs).toHaveLength(1);
    expect(map.lessons).toHaveLength(9);
  });
});
