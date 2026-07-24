import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}));

vi.mock('../../lib/learn/learningActivity', () => ({
  LEARNING_ACTIVITY_EVENT: 'manabi:learning-activity',
  getLearningMotivation: vi.fn(() => ({
    streakCount: 0,
    dailyGoalComplete: false,
    source: 'guest',
  })),
}));

vi.mock('../../lib/learn/progressStore', () => ({
  getLessonProgress: vi.fn().mockResolvedValue({
    completedSlugs: [],
    source: 'guest',
  }),
}));

import { CourseMap } from '../CourseMapPage.jsx';
import { buildCourseMap } from '../../lib/learn/courseMapData';

const course = {
  id: 'english-a1',
  language: 'English',
  level: 'A1',
  title: '영어 A1 입문',
};

const units = [
  { id: 'english-a1-u01', courseId: course.id, week: 1, title: '1주차: 문장 기초' },
  { id: 'english-a1-u02', courseId: course.id, week: 2, title: '2주차: 시제 기초' },
];

const lessons = [
  {
    id: 'english-a1-u01-l01',
    unitId: units[0].id,
    order: 1,
    title: 'be동사',
    estimatedMinutes: 9,
    specialFields: { originalChapterSlug: 'a1-01-be-verb' },
  },
  {
    id: 'english-a1-u01-l02',
    unitId: units[0].id,
    order: 2,
    title: '현재형',
    estimatedMinutes: 10,
    specialFields: { originalChapterSlug: 'a1-02-present-simple' },
  },
  {
    id: 'english-a1-u02-l01',
    unitId: units[1].id,
    order: 1,
    title: '과거형',
    estimatedMinutes: 12,
    specialFields: { originalChapterSlug: 'a1-03-past-simple' },
  },
];

const tracks = [
  { id: 'japanese', label: '일본어', defaultLevel: 'N5' },
  { id: 'french', label: '프랑스어', defaultLevel: 'A1' },
  { id: 'english', label: '영어', defaultLevel: 'A1' },
  { id: 'chinese', label: '중국어', defaultLevel: 'H1' },
];

const baseProps = {
  course,
  units,
  lessons,
  tracks,
  selectedTrack: 'english',
  trackLabel: '영어',
  levels: ['OT', 'A1', 'A2'],
  selectedLevel: 'A1',
};

describe('CourseMap', () => {
  it.each([
    ['japanese', '일본어', 'Japanese'],
    ['french', '프랑스어', 'French'],
    ['english', '영어', 'English'],
    ['chinese', '중국어', 'Chinese'],
  ])('%s Course → Unit → Lesson 트리와 기존 학습 링크를 렌더한다', (track, label, language) => {
    const markup = renderToStaticMarkup(
      <CourseMap
        {...baseProps}
        course={{ ...course, language, title: `${label} A1 입문` }}
        selectedTrack={track}
        trackLabel={label}
      />,
    );

    expect(markup).toContain('data-course-map="ready"');
    expect(markup).toContain(`data-course-track="${track}"`);
    expect(markup).toContain(`${label} A1 입문`);
    expect(markup).toContain('1주차: 문장 기초');
    expect(markup).toContain('2주차: 시제 기초');
    expect(markup).toContain('be동사');
    expect(markup).toContain(`href="/${track}/grammar/a1-01-be-verb"`);
    tracks.forEach(({ label: trackLabel }) => {
      expect(markup).toContain(trackLabel);
    });
  });

  it('완료 진도를 표시하고 첫 미완료 레슨을 다음 CTA로 고른다', () => {
    const markup = renderToStaticMarkup(
      <CourseMap
        {...baseProps}
        completedSlugs={['a1-01-be-verb']}
        progressSource="guest"
      />,
    );

    expect(markup).toContain('게스트 · 이 기기');
    expect(markup).toContain('1 / 3');
    expect(markup).toContain('data-lesson-status="complete"');
    expect(markup).toContain('data-course-next="a1-02-present-simple"');
    expect(markup).toContain('href="/english/grammar/a1-02-present-simple"');
  });

  it('로그인 스트릭 배지와 오늘 레슨 완료 체크 카드를 표시한다', () => {
    const markup = renderToStaticMarkup(
      <CourseMap
        {...baseProps}
        streakCount={7}
        dailyGoalComplete
        motivationSource="remote"
      />,
    );

    expect(markup).toContain('data-course-streak="7"');
    expect(markup).toContain('7일');
    expect(markup).toContain('계정 기준');
    expect(markup).toContain('data-daily-goal="complete"');
    expect(markup).toContain('오늘 레슨 1개 완료');
    expect(markup).toContain('오늘 목표를 채웠어요');
  });

  it('게스트는 이 기기 기준 0일·오늘 목표 미완료 폴백을 표시한다', () => {
    const markup = renderToStaticMarkup(
      <CourseMap
        {...baseProps}
        streakCount={0}
        dailyGoalComplete={false}
        motivationSource="guest"
      />,
    );

    expect(markup).toContain('data-course-streak="0"');
    expect(markup).toContain('0일');
    expect(markup).toContain('이 기기 기준');
    expect(markup).toContain('data-daily-goal="pending"');
    expect(markup).toContain('레슨을 마치면 체크돼요');
  });

  it('영어 A1 첫 완료를 코스 지도에서 1 / 9로 렌더한다', () => {
    const map = buildCourseMap('english', 'A1');
    const firstSlug = map.lessons[0].specialFields.originalChapterSlug;
    const markup = renderToStaticMarkup(
      <CourseMap
        {...map}
        completedSlugs={[firstSlug]}
        progressSource="guest"
      />,
    );

    expect(map.lessons).toHaveLength(9);
    expect(markup).toContain('1 / 9');
    expect(markup).toContain(`data-course-next="${map.lessons[1].specialFields.originalChapterSlug}"`);
  });

  it('레슨이 없으면 빈 상태를 렌더한다', () => {
    const markup = renderToStaticMarkup(
      <CourseMap {...baseProps} units={[]} lessons={[]} />,
    );

    expect(markup).toContain('data-course-map="empty"');
    expect(markup).toContain('레슨이 없습니다.');
    expect(markup).not.toContain('data-course-next=');
  });

  it('어휘 전용 레슨은 기존 레벨별 어휘 페이지의 테마로 딥링크한다', () => {
    const vocabLesson = {
      ...lessons[0],
      title: '공항 환승',
      specialFields: {
        contentType: 'vocabulary',
        progressSlug: 'vocab:chinese:life:1',
        contentHref: '/chinese/vocab/life#theme-1',
        vocabThemeNames: ['공항 환승'],
      },
    };
    const markup = renderToStaticMarkup(
      <CourseMap
        {...baseProps}
        course={{ ...course, language: 'Chinese', title: '중국어 LIFE 생활 어휘' }}
        units={[units[0]]}
        lessons={[vocabLesson]}
        selectedTrack="chinese"
        trackLabel="중국어"
        selectedLevel="LIFE"
      />,
    );

    expect(markup).toContain('data-lesson-type="vocabulary"');
    expect(markup).toContain('href="/chinese/vocab/life#theme-1"');
    expect(markup).toContain('data-course-next="vocab:chinese:life:1"');
  });
});
