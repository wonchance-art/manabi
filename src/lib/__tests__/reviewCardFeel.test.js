import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCardRevealClick } from '../reviewCard';
import { MAIN_NAV } from '../webNavigation';

// 복습 손맛(웹) — 실험실 제안안 중 웹 몫(오너 「모바일은 제외하고 웹 위주로 ㄱㄱ」 2026-10-16):
// 카드 넘김 효과 · 앞면 몸통 클릭으로 펼치기. 404의 돌아갈 곳은 메인 메뉴를 그대로 쓴다.
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const clickOn = (closestMatch) => ({ target: { closest: (selector) => (closestMatch(selector) ? {} : null) } });

describe('앞면 몸통 클릭 판정', () => {
  it('카드 안의 버튼 · 링크 · 입력을 누른 클릭은 펼치기로 가로채지 않는다', () => {
    expect(isCardRevealClick(clickOn(() => true))).toBe(false);
    expect(isCardRevealClick(clickOn(() => false))).toBe(true);
    for (const control of ['button', 'a', 'input', 'textarea', 'select', 'summary', 'label', '[role="button"]']) {
      expect(isCardRevealClick(clickOn((selector) => selector.split(', ').includes(control)))).toBe(false);
    }
  });
  it('대상이 없는 이벤트는 펼치지 않는다', () => {
    expect(isCardRevealClick(null)).toBe(false);
    expect(isCardRevealClick({ target: null })).toBe(false);
  });
});

describe('두 복습 카드(예전 일정 · 새 일정)가 같은 손맛을 쓴다', () => {
  for (const file of ['src/components/vocab/FsrsReviewSession.jsx', 'src/views/VocabReview.jsx']) {
    it(`${file} — 카드마다 key로 새로 그려 넘김 효과가 돌고, 앞면 몸통 클릭은 isCardRevealClick을 거친다`, () => {
      const source = read(file);
      expect(source).toMatch(/<div key=\{[^}]+\} className="card review-card review-card--turn"/);
      expect(source).toContain('review-card__body--front');
      expect(source).toMatch(/onClick=\{event => \{ if \([^)]*isCardRevealClick\(event\)\) reveal\(/);
    });
  }
  it('넘김 효과는 0.3초 이하이고 모션 감소 분기를 함께 둔다', () => {
    const css = read('src/index.css');
    const rule = css.match(/\.review-card--turn \{ animation: reviewCardTurn ([\d.]+)s/);
    expect(rule).not.toBeNull();
    expect(Number(rule[1])).toBeLessThanOrEqual(0.3);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.review-card--turn \{ animation: none; \}/);
  });
});

describe('404 — 돌아갈 곳은 메인 메뉴', () => {
  it('MAIN_NAV에서 그리고, 옛 메뉴 이름을 박아 두지 않는다', () => {
    const source = read('src/app/not-found.jsx');
    expect(source).toContain("import { MAIN_NAV } from '@/lib/webNavigation'");
    expect(source).toContain('MAIN_NAV.map(');
    for (const stale of ['자료실', '단어장', '홈으로']) expect(source).not.toContain(`>${stale}<`);
    expect(MAIN_NAV.map((item) => item.label)).toEqual(['배움', '대화', '서재', '산책']);
  });
});
