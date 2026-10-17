import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../../lib/gemini', () => ({ callGemini: vi.fn() }));

const { default: ViewerModal } = await import('../viewer/ViewerModal.jsx');
const { default: ReadingTest } = await import('../ReadingTest.jsx');

// 읽기 확인 창(오너 「권장대로」 2026-10-17 KST): 창(ViewerModal) 안의 ReadingTest는 자기 머리(h2 · ✕)를 그리지 않는다 —
// 닫기 두 개 · 제목 두 번이던 것. 뷰어의 다른 창과 같이 창 머리의 이름 하나 · 닫기 하나.
const closeButtons = (html) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0])
  .filter((b) => /aria-label="[^"]*닫기[^"]*"|>\s*닫기|[✕×]/.test(b));

describe('읽기 확인 창 — 닫기 하나 · 이름 하나', () => {
  for (const language of ['Japanese', 'English']) {
    it(`${language}: 창 안 닫기 버튼 1개, 제목(h2) 1개, 창 이름은 창 제목`, () => {
      const html = renderToStaticMarkup(createElement(ViewerModal, { title: '읽기 확인 · 전체 자료', onClose: () => {} },
        createElement(ReadingTest, { rawText: '本文', language, materialId: '1', onClose: () => {}, inline: true })));
      expect(closeButtons(html)).toHaveLength(1);
      expect(closeButtons(html)[0]).toContain('aria-label="읽기 확인 · 전체 자료 닫기"');
      expect(html.match(/<h2\b/g)).toHaveLength(1);
      expect(html).toContain('aria-label="읽기 확인 · 전체 자료"');
      expect(html).not.toContain('IELTS Reading Test');
    });
  }

  it('창 밖(혼자 띄우는 경로)에서는 지금처럼 자기 머리를 그린다', () => {
    const html = renderToStaticMarkup(createElement(ReadingTest, { rawText: '本文', language: 'Japanese', materialId: '1', onClose: () => {} }));
    expect(html).toContain('reading-test__header');
    expect(closeButtons(html)).toHaveLength(1);
  });
});
