import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('../../lib/learn/progressStore', () => ({
  getLessonProgress: vi.fn().mockResolvedValue({
    completedSlugs: [],
    source: 'guest',
  }),
  recordLessonCompleted: vi.fn(),
}));

import {
  claimLessonCompletion,
  LessonCompletionActions,
} from '../LessonCompletionCta';

describe('LessonCompletionCta', () => {
  it('완료 전에는 최소 완료 CTA만 렌더한다', () => {
    const markup = renderToStaticMarkup(
      <LessonCompletionActions
        completed={false}
        disabled={false}
        lessonId="english-a1-u01-l01"
        nextLesson={{ id: 'english-a1-u01-l02', href: '/english/grammar/a1-02' }}
        onComplete={() => {}}
      />,
    );

    expect(markup).toContain('data-lesson-completion="pending"');
    expect(markup).toContain('data-lesson-id="english-a1-u01-l01"');
    expect(markup).toContain('이 레슨 마치기');
    expect(markup).not.toContain('다음 레슨');
  });

  it('완료 상태와 코스 지도 기반 다음 레슨 버튼을 렌더한다', () => {
    const markup = renderToStaticMarkup(
      <LessonCompletionActions
        completed
        disabled
        lessonId="english-a1-u01-l01"
        nextLesson={{ id: 'english-a1-u01-l02', href: '/english/grammar/a1-02' }}
        onComplete={() => {}}
      />,
    );

    expect(markup).toContain('data-lesson-completion="complete"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('다음 레슨');
    expect(markup).toContain('href="/english/grammar/a1-02"');
    expect(markup).toContain('data-next-lesson-id="english-a1-u01-l02"');
  });

  it('저장 중이거나 이미 완료된 레슨은 중복 완료 요청을 막는다', () => {
    const pendingRef = { current: false };

    expect(claimLessonCompletion(pendingRef, false)).toBe(true);
    expect(claimLessonCompletion(pendingRef, false)).toBe(false);

    pendingRef.current = false;
    expect(claimLessonCompletion(pendingRef, true)).toBe(false);
  });
});
