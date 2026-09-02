import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TokenPosLabel from '../TokenPosLabel';

// 계약: 중국어 겸류사 토큰(pos_all)은 품사 후보 전체를 보여주되 문장 맥락에서 짚힌 pos만
// 강조한다. pos_all이 없으면 기존 단일 pos 표기와 완전히 동일해야 한다(ja·en 무영향).

const render = (token) => renderToStaticMarkup(<TokenPosLabel token={token} />);

describe('TokenPosLabel', () => {
  it('X 2차 방어 — 정본 밖 조각(단어가 품사 칸에 든 행)은 렌더하지 않는다', () => {
    const html = render({ pos: '동사', pos_all: '동사·喝咖啡' });
    expect(html).toContain('동사');
    expect(html).not.toContain('喝咖啡');
    expect(render({ pos: '喝咖啡' })).toBe('');
    expect(render({ pos: '喝咖啡', pos_all: '喝咖啡·boire' })).toBe('');
  });

  it('pos_all이 없으면 단일 pos 문자열 그대로', () => {
    expect(render({ pos: '명사' })).toBe('명사');
  });

  it('pos도 pos_all도 없으면 아무것도 렌더하지 않는다', () => {
    expect(render({})).toBe('');
    expect(renderToStaticMarkup(<TokenPosLabel token={null} />)).toBe('');
  });

  it('겸류 토큰은 후보 전체를 나열하고 맥락 pos만 강조한다', () => {
    const html = render({ pos: '동사', pos_all: '동사·명사' });
    expect(html).toContain('동사');
    expect(html).toContain('명사');
    // 짚힌 품사(동사)는 강조 스타일, 나머지(명사)는 흐림
    expect(html).toMatch(/font-weight:700[^>]*>동사/);
    expect(html).toMatch(/opacity:0\.5[^>]*>명사/);
    expect(html).toContain('이 문장에서는 동사로 쓰였어요');
  });

  it('pos가 비어 있으면 첫 후보를 짚는다(판별 실패 디그레이드)', () => {
    const html = render({ pos: '', pos_all: '동사·명사' });
    expect(html).toMatch(/font-weight:700[^>]*>동사/);
  });

  it('사용자 교정으로 pos가 후보 밖이면 교정값을 짚힌 항목으로 앞에 붙인다', () => {
    const html = render({ pos: '양사', pos_all: '동사·명사' });
    expect(html).toMatch(/font-weight:700[^>]*>양사/);
    expect(html).toContain('동사');
    expect(html).toContain('명사');
  });

  it('후보가 1개뿐인 pos_all은 단일 표기로 취급한다', () => {
    expect(render({ pos: '명사', pos_all: '명사' })).toBe('명사');
  });
});
