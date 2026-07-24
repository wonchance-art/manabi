import { describe, expect, it } from 'vitest';
import {
  buildCourseMap,
  COURSE_TRACKS,
  getCourseLessonContext,
} from '../courseMapData';

describe('buildCourseMap', () => {
  it.each([
    ['japanese', 'N5', 'Japanese'],
    ['french', 'A1', 'French'],
    ['english', 'A1', 'English'],
    ['chinese', 'H1', 'Chinese'],
  ])('%s 트랙에서 getCourse 결과와 레슨 지도를 만든다', (track, level, language) => {
    const map = buildCourseMap(track, level);

    expect(map.selectedTrack).toBe(track);
    expect(map.selectedLevel).toBe(level);
    expect(map.course.language).toBe(language);
    expect(map.course.id).toBe(`${track}-${level.toLowerCase()}`);
    expect(map.units.length).toBeGreaterThan(0);
    expect(map.lessons.length).toBeGreaterThan(0);
    expect(map.tracks).toEqual(COURSE_TRACKS);
  });

  it('F4 일본어 N5 신규 8챕터를 레슨으로 포섭한다', () => {
    const map = buildCourseMap('japanese', 'N5');
    const slugs = map.lessons.map((lesson) => lesson.specialFields.originalChapterSlug);

    expect(slugs).toContain('n5-21-particles-list-range');
    expect(slugs).toContain('n5-28-frequency-state-adverbs');
  });

  it('F4 프랑스어 A1 신규 7챕터를 레슨으로 포섭한다', () => {
    const map = buildCourseMap('french', 'A1');
    const slugs = map.lessons.map((lesson) => lesson.specialFields.originalChapterSlug);

    expect(slugs).toContain('a1-14-ir-re-present');
    expect(slugs).toContain('a1-20-frequency-quantity-connectors');
  });

  it('F4 영어 신규 문법과 20개 어휘 세트를 레슨 번들에 포섭한다', () => {
    const f4Themes = [
      '집안일',
      '아침과 저녁 루틴',
      '진료와 약',
      '식당 이용',
      '장보기',
      '주방 기초',
      '공항 수속',
      '숙소 도착',
      '대중교통',
      '택시와 이동',
      '길 찾기',
      '관광과 관람',
      '여행 문제 해결',
      '전화와 인터넷',
      '약속과 모임',
      '사무실 물건',
      '회의 기초',
      '업무 관리',
      '이메일 기초',
      '구직과 근무 형태',
    ];
    const maps = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => buildCourseMap('english', level));
    const slugs = maps.flatMap((map) => map.lessons.map(
      (lesson) => lesson.specialFields.originalChapterSlug,
    ));
    const themes = maps.flatMap((map) => map.lessons.flatMap(
      (lesson) => lesson.specialFields.vocabThemeNames || [],
    ));

    expect(slugs).toContain('a1-draft-09-demonstratives-one');
    expect(slugs).toContain('c2-draft-06-ellipsis-substitution');
    expect(themes).toEqual(expect.arrayContaining(f4Themes));
    expect(new Set(f4Themes).size).toBe(20);
  });

  it('F4 중국어 생활 어휘 15세트를 어휘 레슨과 기존 페이지 딥링크로 포섭한다', () => {
    const map = buildCourseMap('chinese', 'LIFE');

    expect(map.course.id).toBe('chinese-life');
    expect(map.levelLabels.LIFE).toBe('생활');
    expect(map.lessons).toHaveLength(15);
    expect(map.lessons[0].title).toBe('공항 환승');
    expect(map.lessons[0].specialFields.contentHref).toBe('/chinese/vocab/life#theme-1');
    expect(map.lessons.at(-1).title).toBe('디지털 연락');
    expect(map.lessons.at(-1).specialFields.contentHref).toBe('/chinese/vocab/life#theme-15');
  });

  it('알 수 없는 트랙·레벨은 영어 A1으로 fail-closed 한다', () => {
    const map = buildCourseMap('unknown', 'Z9');

    expect(map.selectedTrack).toBe('english');
    expect(map.selectedLevel).toBe('A1');
  });

  it.each([
    ['japanese', 'N5', 'Japanese'],
    ['french', 'A1', 'French'],
    ['english', 'A1', 'English'],
    ['chinese', 'H1', 'Chinese'],
  ])('%s 문법 상세를 F1 레슨 id와 다음 코스 레슨에 연결한다', (track, level, language) => {
    const map = buildCourseMap(track, level);
    const lesson = map.lessons[0];
    const nextLesson = map.lessons[1];
    const slug = lesson.specialFields.originalChapterSlug;
    const context = getCourseLessonContext(language, level, slug);

    expect(context.lessonRef).toEqual({
      id: lesson.id,
      lang: language,
      slug,
      source: 'lesson',
    });
    expect(context.nextLesson).toEqual({
      id: nextLesson.id,
      href: `/${track}/grammar/${nextLesson.specialFields.originalChapterSlug}`,
    });
  });
});
