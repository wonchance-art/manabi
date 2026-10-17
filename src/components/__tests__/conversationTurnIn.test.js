import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { turnRowClass } from '../conversation/ConversationThread';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// 계약: 대화의 가장 새 턴에만 등장 효과(CONV-TURN-IN-001, 2026-10-17 KST) — 지난 턴은 다시 움직이지 않고, 동작 줄이기면 없다.
const css = fs.readFileSync('src/components/conversation/conversation.css', 'utf8');
const thread = fs.readFileSync('src/components/conversation/ConversationThread.jsx', 'utf8');

describe('대화 새 턴 등장', () => {
  it('목록의 마지막 턴에만 conv__row--new', () => {
    const items = [{ index: 0 }, { index: 1 }, { index: 2 }];
    expect(items.map((item) => turnRowClass('conv__row', item, items))).toEqual(['conv__row', 'conv__row', 'conv__row conv__row--new']);
    expect(turnRowClass('conv__row', items[0], [items[0]])).toBe('conv__row conv__row--new');
  });

  it('튜터 · 내 턴 줄이 모두 같은 판정을 쓴다', () => {
    const log = sliceBetween(thread, '<div className="conv__log"', '{pending && (');
    expect(log).toContain("className={turnRowClass('conv__row conv__row--tutor', item, items)}");
    expect(log).toContain("className={turnRowClass('conv__row conv__row--me', item, items)}");
    expect(log).not.toMatch(/className="conv__row conv__row--(tutor|me)"/);
  });

  it('CSS: 투명도 · translateY(4px) · --transition-fast, 전용 동작 줄이기 분기', () => {
    expect(css).toContain('.conv__row--new { animation: conv-turn-in var(--transition-fast) both; }');
    expect(css).toMatch(/@keyframes conv-turn-in \{ from \{ opacity: 0; transform: translateY\(4px\); \}/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .conv__row--new { animation: none; } }');
  });
});
