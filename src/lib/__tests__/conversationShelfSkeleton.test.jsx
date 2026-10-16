import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween';
import { settleHeight } from '../useHeightSettle';

vi.mock('next/link', () => ({ default: ({ children, prefetch, ...props }) => createElement('a', props, children) }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../../components/web/LibraryReaderLink', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));

import ConversationShelf from '../../components/library/ConversationShelf';
import { LibraryShelfSkeleton } from '../../components/library/LibrarySkeleton';

// LOADING-SKELETON-001 후속 — 서재 「대화」 묶음이 골격 없이 나타나 아래 목록을 ~111px 밀던 자리.
// 받기 전에 아는 것: 묶음은 받으면 늘 나온다(대화 없음 = 「새 대화」 입구 + 안내 한 줄). 그래서 머리줄은 실제 그대로,
// 몸은 대화 한 줄 자리. 줄 수가 다르면(없음 · 2~3개) useHeightSettle이 0.2초에 높이를 옮긴다(점프 대신, 동작 줄이기면 즉시).
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const shelf = (query) => renderToStaticMarkup(createElement(ConversationShelf, { query }));
const row = (id) => ({ id, title: `대화 ${id}`, language: 'Japanese', turns: 2, updated_at: '2026-10-17T00:00:00Z' });

describe('대화 묶음 — 받는 중 자리 · 받은 뒤 상태', () => {
  it('받는 중: 실제 머리줄(대화 · 새 대화) + 대화 한 줄 골격, aria-busy와 「대화 불러오는 중…」', () => {
    const html = shelf({ isPending: true });
    expect(html).toContain('<h2 id="shelf-conversations-title">대화</h2>');
    expect(html).toContain('href="/conversation/new?returnTo=%2Fmaterials"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="skeleton-sr" role="status">대화 불러오는 중…</span>');
    expect(html.match(/<li class="shelf-row">/g)).toHaveLength(1);
  });
  it('받은 뒤: 대화 없음 = 입구 + 안내(구멍 없음), 대화 있음 = 줄, 실패 = 숨김 — 골격은 남지 않는다', () => {
    const empty = shelf({ isPending: false, isSuccess: true, data: [] });
    expect(empty).toContain('AI 튜터와 목표어로 이야기해요.');
    expect(empty).not.toContain('aria-busy');
    const some = shelf({ isPending: false, isSuccess: true, data: [row(1), row(2)] });
    expect(some.match(/<li class="shelf-row">/g)).toHaveLength(2);
    expect(some).not.toContain('skeleton');
    expect(shelf({ isPending: false, isError: true })).toBe('');
  });
  it('자리 · 실제 묶음이 같은 높이 옮기기 래퍼를 쓴다(골격 → 실제가 같은 DOM 자리)', () => {
    const src = read('src/components/library/ConversationShelf.jsx');
    expect(src).toContain("const settle=useHeightSettle(query.isPending?'pending':'ready');");
    expect(src.match(/<div ref=\{settle\}>/g)).toHaveLength(3);
  });
  it('로그인 확인 골격에도 같은 자리(읽던 곳과 목록 사이) — 다만 aria-hidden 안이라 링크가 아니다', () => {
    const html = renderToStaticMarkup(createElement(LibraryShelfSkeleton));
    const between = sliceBetween(html, '읽던 곳에서', 'shelf-list-section');
    expect(between).toContain('<section class="shelf-conversations">');
    expect(between).toContain('<span class="shelf-conversations-new">새 대화</span>');
    expect(between).not.toContain('href=');
  });
});

describe('settleHeight — 점프 대신 짧게 옮기기', () => {
  const fake = () => {
    const log = [];
    const el = { style: {}, classList: { add: (c) => log.push(`+${c}`), remove: (c) => log.push(`-${c}`) },
      getBoundingClientRect: () => { log.push(`measure ${el.style.height}`); return { height: 0 }; },
      addEventListener: (type, fn) => { el.end = fn; }, removeEventListener: () => {} };
    return { el, log };
  };
  it('이전 높이에 고정 → 확정 → 새 높이, 끝나면 원래대로(인라인 높이 · 클래스 제거)', () => {
    const { el, log } = fake();
    const cleanup = settleHeight(el, 186, 111, false);
    expect(log).toEqual(['+is-height-settling', 'measure 186px']);
    expect(el.style.height).toBe('111px');
    el.end();
    expect(el.style.height).toBe('');
    expect(log.at(-1)).toBe('-is-height-settling');
    cleanup();
  });
  it('첫 측정 · 1px 미만 차이 · 동작 줄이기면 아무것도 안 한다', () => {
    for (const [prev, next, reduce] of [[null, 111, false], [111, 111.5, false], [186, 111, true]]) {
      const { el, log } = fake();
      expect(settleHeight(el, prev, next, reduce)).toBeUndefined();
      expect(log).toEqual([]);
      expect(el.style.height).toBeUndefined();
    }
  });
  it('CSS: 높이만 0.2초 · var(--ease-settle), 전용 모션 축소 블록', () => {
    const css = read('src/components/library/library.css');
    expect(css).toContain('.is-height-settling{overflow:hidden;transition:height .2s var(--ease-settle)}');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.is-height-settling{transition:none}}');
    expect(read('src/lib/useHeightSettle.js')).toContain('return settleHeight(el, prev, next, reducedMotion());');
  });
});
