import { describe, it, expect, vi } from 'vitest';
import { MAIN_NAV, isFocusedReadingRoute } from '../webNavigation';
import { captureReadingAnchor, restoreReadingAnchor, selectedTokenScrollDelta } from '../readingViewport';

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
    // 메뉴 셋(LEARN-HOME-AK-001): 개인화 화면(배움 · 서재)은 prefetch를 끈다. 복습(/vocab)은 메뉴에서 빠지고
    // 배움의 단어 복습 칸(prefetch={false})으로 들어간다 — performanceRepairs P5가 그 칸을 함께 지킨다.
    for (const href of ['/home', '/materials']) expect(MAIN_NAV.find(item => item.href === href).prefetch).toBe(false);
    expect(MAIN_NAV.map(item => item.label)).toEqual(['배움', '서재', '산책']);
  });
});

describe('selected word stays between the toolbar and mobile inspector', () => {
  const bounds = { top: 190, bottom: 373 };
  it('moves a covered word just above the sheet and below the toolbar', () => {
    expect(selectedTokenScrollDelta({ top: 394, bottom: 450 }, bounds)).toBe(85);
    expect(selectedTokenScrollDelta({ top: 175, bottom: 231 }, bounds)).toBe(-23);
  });
  it('leaves an already visible word in place', () => {
    expect(selectedTokenScrollDelta({ top: 240, bottom: 296 }, bounds)).toBe(0);
  });
  it('reduces margins when a zoomed phone fits the word but not the normal padding', () => {
    const narrow = { top: 298, bottom: 356 };
    expect(selectedTokenScrollDelta({ top: 332, bottom: 377 }, narrow)).toBe(27.5);
    expect(selectedTokenScrollDelta({ top: 280, bottom: 325 }, narrow)).toBe(-24.5);
    expect(selectedTokenScrollDelta({ top: 320, bottom: 378 }, narrow)).toBe(22);
  });
  it('does not chase a word when an expanded sheet leaves no reading space', () => {
    expect(selectedTokenScrollDelta({ top: 394, bottom: 450 }, { top: 190, bottom: 120 })).toBe(0);
    expect(selectedTokenScrollDelta({ top: 180, bottom: 390 }, bounds)).toBe(0);
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

describe('display changes in the paged view (READER-PAGED-001)', () => {
  // 화면 좌표 기준점(captureReadingAnchor)은 세로 스크롤 전용이다 — 다단에서는 다른 단의 토큰도 같은 높이에 있어
  // 첫 단의 토큰을 잡는다. 쪽 넘김 보기에서는 Aa 변경을 그대로 적용하고, 기준 토큰 복원은 usePagedReader가 한다
  // (pagedReader.test.js 「restores the anchor token after a resize or font change」).
  it('bypasses the scroll anchor in the paged view and keeps it in the scroll view', async () => {
    const { readFileSync } = await import('node:fs');
    const viewer = readFileSync(new URL('../../views/ViewerPage.jsx', import.meta.url), 'utf8');
    expect(viewer).toContain('keepPosition={pagedActive?change=>change():keepReadingPosition}');
    const settings = readFileSync(new URL('../../components/viewer/ViewerSettings.jsx', import.meta.url), 'utf8');
    expect(settings).toContain("onChange={v=>onReaderView?onReaderView(v):s.setReaderView?.(v)}");
  });
});
