import { describe, it, expect, vi } from 'vitest';
import { MAIN_NAV, isFocusedReadingRoute } from '../webNavigation';
import { captureReadingAnchor, restoreReadingAnchor } from '../readingViewport';

const node = (top, width = 30) => ({ isConnected: true, getBoundingClientRect: () => ({ top, bottom: top + 40, width }) });
const root = (...nodes) => ({ querySelectorAll: () => nodes });

describe('focused reader boundaries', () => {
  it('applies to an actual text reader, including a trailing slash', () => {
    expect(isFocusedReadingRoute('/viewer/123')).toBe(true);
    expect(isFocusedReadingRoute('/viewer/123/')).toBe(true);
  });
  it('does not hide navigation on the library, book or PDF reader', () => {
    for (const path of [null, '/viewer', '/viewer/123/edit', '/materials', '/books/japanese-n5', '/pdf/123']) expect(isFocusedReadingRoute(path)).toBe(false);
  });
  it('does not prefetch personalized home, review and library across login', () => {
    for (const href of ['/home', '/vocab', '/materials']) expect(MAIN_NAV.find(item => item.href === href).prefetch).toBe(false);
    expect(MAIN_NAV.map(item => item.label)).toEqual(['오늘', '교재', '발견', '복습', '내 서재']);
  });
});

describe('display changes preserve the visible text', () => {
  it('captures the first visible token, including a partially visible line', () => {
    const visible = node(65);
    expect(captureReadingAnchor(root(node(0), node(90, 0), visible, node(160)), 72, 800)).toEqual({ element: visible, top: 65 });
  });
  it('does not invent an anchor for missing, empty or offscreen text', () => {
    expect(captureReadingAnchor(null)).toBeNull();
    expect(captureReadingAnchor(root())).toBeNull();
    expect(captureReadingAnchor(root(node(0), node(900)), 72, 800)).toBeNull();
  });
  it('compensates downward reflow by the actual token displacement', () => {
    const scroll = vi.fn();
    restoreReadingAnchor({ element: node(230), top: 110 }, scroll);
    expect(scroll).toHaveBeenCalledWith({ top: 120, behavior: 'instant' });
  });
  it('also preserves upward reflow', () => {
    const scroll = vi.fn();
    restoreReadingAnchor({ element: node(90), top: 150 }, scroll);
    expect(scroll).toHaveBeenCalledWith({ top: -60, behavior: 'instant' });
  });
  it('does not scroll for removed, stationary or invalid anchors', () => {
    const scroll = vi.fn();
    for (const anchor of [null, { element: { ...node(140), isConnected: false }, top: 100 }, { element: node(100), top: 100 }, { element: node(NaN), top: 100 }]) restoreReadingAnchor(anchor, scroll);
    expect(scroll).not.toHaveBeenCalled();
  });
});
