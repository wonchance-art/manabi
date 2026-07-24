import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

import { FormulaicChapterIntro } from '../ReferenceChapterPage.jsx';

describe('FormulaicChapterIntro', () => {
  it('formulaic 챕터 도입부에 고정구 안내 한 줄을 표시한다', () => {
    const markup = renderToStaticMarkup(<FormulaicChapterIntro formulaic />);

    expect(markup).toContain('data-formulaic-intro="true"');
    expect(markup).toContain('장면 고정구');
    expect(markup).toContain('여기 나온 문형은 통째로 익히는 고정구예요.');
    expect(markup).toContain('문법 분석은 후속 챕터에서 다룹니다.');
  });

  it('일반 챕터에는 고정구 안내를 표시하지 않는다', () => {
    expect(renderToStaticMarkup(<FormulaicChapterIntro formulaic={false} />)).toBe('');
  });
});
