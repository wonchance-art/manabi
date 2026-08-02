import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

import { LearnProgressPanel } from '../LearnProgressWidget';

const progress = {
  language: 'English',
  name: '영어',
  track: 'english',
  hasProgress: true,
  levels: [
    {
      key: 'A1',
      short: 'A1',
      label: 'A1 입문',
      totalCount: 3,
      visitedCount: 2,
      completedCount: 1,
    },
  ],
};

describe('LearnProgressWidget', () => {
  it('레벨별 방문·완료와 게스트 스트릭을 한 카드에 렌더한다', () => {
    const markup = renderToStaticMarkup(
      <LearnProgressPanel
        progress={progress}
        streakCount={7}
        source="guest"
      />,
    );

    expect(markup).toContain('data-learn-progress="ready"');
    expect(markup).toContain('data-learn-level="A1"');
    expect(markup).toContain('방문 2 · 완료 1/3');
    expect(markup).toContain('data-learn-streak="7"');
    expect(markup).toContain('7일');
    expect(markup).toContain('이 기기 기준');
    expect(markup).toContain('href="/learn/course?track=english"');
  });

  it('기록이 없는 첫 방문에는 시작 카피를 보여준다', () => {
    const markup = renderToStaticMarkup(
      <LearnProgressPanel
        progress={{
          ...progress,
          hasProgress: false,
          levels: progress.levels.map((level) => ({
            ...level,
            visitedCount: 0,
            completedCount: 0,
          })),
        }}
        streakCount={0}
      />,
    );

    expect(markup).toContain('data-learn-progress="empty"');
    expect(markup).toContain('data-learn-progress-empty');
    expect(markup).toContain('아직 학습 기록이 없어요');
    expect(markup).toContain('첫 챕터 시작하기');
  });

  it('마운트 전에는 localStorage 로딩 상태를 유지한다', () => {
    const markup = renderToStaticMarkup(
      <LearnProgressPanel progress={progress} ready={false} />,
    );

    expect(markup).toContain('data-learn-progress="loading"');
    expect(markup).toContain('학습 기록을 불러오는 중');
  });
});
