import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';
import { describe, expect, it, vi } from 'vitest';
import {
  pageStep, pageCountFor, pageOfOffset, nearestPage, foreignScrollPage, pageProgress, pageLabel, pageHeightFor,
  pageKeyAction, swipeDirection, firstIndexAtOrAfter, createPagedController, overlayOrigin,
  fontFamilyNames, fontsAffectReader, mutationsAffectFlow,
} from '../usePagedReader';
import { compactSheetHeight, pagedSheetDock } from '../readingViewport';

// 쪽 넘김 보기(READER-PAGED-001) — 쪽 계산·기준 토큰 복원·키 판정. DOM 없이 다단 상자를 흉내 낸다:
// 토큰 i는 문서 순서로 perPage개씩 단을 채운다(다단은 문서 순서대로 채우므로 단 번호가 단조 증가).
function fakeReader({ tokens = 100, perPage = 10, width = 300, gap = 48, height = 600, top = 100 } = {}) {
  const state = { perPage, width, gap, top };
  const style = new Map();
  const tokenEls = Array.from({ length: tokens }, (_, i) => ({
    nodeType: 1, isConnected: true, dataset: { sourceToken: `t${i}` },
    getClientRects() { return [this.getBoundingClientRect()]; },
    getBoundingClientRect() {
      const column = Math.floor(i / state.perPage), row = i % state.perPage;
      const left = column * (state.width + state.gap) - pages.scrollLeft;
      return { left, right: left + 20, top: state.top + row * 40, bottom: state.top + row * 40 + 30, width: 20, height: 30 };
    },
  }));
  const end = { nodeType: 1, getClientRects() { return [this.getBoundingClientRect()]; }, getBoundingClientRect() {
    const column = Math.floor(Math.max(0, tokenEls.length - 1) / state.perPage), left = column * (state.width + state.gap) - pages.scrollLeft;
    return { left, right: left, top: state.top, bottom: state.top, width: 0, height: 0 };
  } };
  const pages = {
    scrollLeft: 0, clientLeft: 0,
    get clientWidth() { return state.width; },
    get scrollWidth() { const n = Math.ceil(tokenEls.length / state.perPage); return n * state.width + (n - 1) * state.gap; },
    style: { setProperty: (k, v) => style.set(k, v), removeProperty: k => style.delete(k) },
    getBoundingClientRect: () => ({ left: 0, top: state.top, right: state.width, bottom: state.top + height, width: state.width, height }),
    querySelectorAll: () => tokenEls,
    querySelector: selector => (selector === '[data-page-end]' ? end : tokenEls.find(el => selector.includes(`"${el.dataset.sourceToken}"`)) || null),
    contains: el => tokenEls.includes(el),
    ownerDocument: { activeElement: null, querySelector: () => null },
  };
  const win = {
    innerHeight: 844, scrollY: 0, visualViewport: { height: 844, scale: 1 },
    getComputedStyle: () => ({ columnGap: `${state.gap}px` }),
    requestAnimationFrame: null, setTimeout: null, getSelection: () => null,
  };
  return { pages, tokenEls, state, style, win };
}
function controller(reader, extra = {}) {
  const c = createPagedController(reader.pages, () => ({ window: reader.win, document: reader.pages.ownerDocument, reducedMotion: () => true, bottomGap: () => 12, ...extra }));
  c.relayout();
  return c;
}

describe('page math', () => {
  it('derives step, count and the page of an offset from the multicol box', () => {
    expect(pageStep(300, 48)).toBe(348);
    expect(pageCountFor({ scrollWidth: 300 * 4 + 48 * 3, width: 300, gap: 48 })).toBe(4);
    expect(pageCountFor({ scrollWidth: 300, width: 300, gap: 48 })).toBe(1);
    expect(pageCountFor({ scrollWidth: 0, width: 0, gap: 0 })).toBe(1);
    expect(pageOfOffset(0, 348)).toBe(0);
    expect(pageOfOffset(347, 348)).toBe(1); // 경계 1px 반올림 흡수
    expect(pageOfOffset(348 * 2 + 10, 348)).toBe(2);
    expect(nearestPage(348 * 1.4, 348, 4)).toBe(1);
    expect(nearestPage(348 * 1.6, 348, 4)).toBe(2);
    expect(nearestPage(99999, 348, 4)).toBe(3);
  });
  it('reports page-based progress and the bar label (mockup A/D)', () => {
    expect(pageProgress(11, 48)).toBe(25);
    expect(pageLabel(11, 48)).toBe('12 / 48쪽 · 25%');
    expect(pageProgress(47, 48)).toBe(100);
    expect(pageLabel(0, 1)).toBe('1 / 1쪽 · 100%');
    expect(pageProgress(-3, 10)).toBe(10);
  });
  it('fills the rest of the first screen, or a full screen when the header is tall', () => {
    expect(pageHeightFor({ visibleHeight: 844, top: 150, reserve: 64 })).toBe(630);
    expect(pageHeightFor({ visibleHeight: 844, top: 600, reserve: 64 })).toBe(844 - 64 - 16);
    expect(pageHeightFor({ visibleHeight: 844, top: 600, reserve: 64, inset: 56 })).toBe(844 - 64 - 56 - 16); // 고정 머리 아래
    expect(pageHeightFor({ visibleHeight: 300, top: 250, reserve: 64, min: 160 })).toBe(220);
  });
  it('finds the first item on a page by binary search', () => {
    const pages = [0, 0, 0, 1, 1, 2, 4, 4];
    expect(firstIndexAtOrAfter(pages.length, 1, i => pages[i])).toBe(3);
    expect(firstIndexAtOrAfter(pages.length, 3, i => pages[i])).toBe(6);
    expect(firstIndexAtOrAfter(pages.length, 9, i => pages[i])).toBe(8);
  });
});

describe('controls', () => {
  const key = (k, extra = {}) => ({ key: k, target: { closest: () => null }, ...extra });
  it('maps page keys and leaves modified keys, fields, dialogs and buttons alone', () => {
    expect(pageKeyAction(key('ArrowRight'))).toBe('next');
    expect(pageKeyAction(key('PageDown'))).toBe('next');
    expect(pageKeyAction(key(' '))).toBe('next');
    expect(pageKeyAction(key(' ', { shiftKey: true }))).toBe('prev');
    expect(pageKeyAction(key('ArrowLeft'))).toBe('prev');
    expect(pageKeyAction(key('PageUp'))).toBe('prev');
    expect(pageKeyAction(key('Home'))).toBe('first');
    expect(pageKeyAction(key('End'))).toBe('last');
    // Alt+↑↓(문장 이동)·Ctrl/⌘ 조합·Shift+화살표·조합 중 입력·이미 처리된 키는 건드리지 않는다
    for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }, { defaultPrevented: true }]) expect(pageKeyAction(key('ArrowRight', extra))).toBeNull();
    expect(pageKeyAction(key('ArrowDown'))).toBeNull();
    const inField = { closest: selector => (selector.includes('textarea') ? {} : null) };
    expect(pageKeyAction(key('ArrowRight', { target: inField }))).toBeNull();
    const onButton = { closest: selector => (selector.startsWith('button') ? {} : null) };
    expect(pageKeyAction(key(' ', { target: onButton }))).toBeNull(); // Space는 버튼·단어를 누르는 키
    expect(pageKeyAction(key('ArrowRight', { target: onButton }))).toBe('next');
  });
  it('treats only a quick, mostly horizontal drag as a swipe', () => {
    expect(swipeDirection({ dx: -120, dy: 10, dt: 200 })).toBe(1);
    expect(swipeDirection({ dx: 120, dy: -20, dt: 200 })).toBe(-1);
    expect(swipeDirection({ dx: -30, dy: 0, dt: 100 })).toBe(0);
    expect(swipeDirection({ dx: -100, dy: 90, dt: 100 })).toBe(0);
    expect(swipeDirection({ dx: -200, dy: 0, dt: 1500 })).toBe(0);
  });
  it('compacts the bottom sheet only when it would cover the selected word (mockup C)', () => {
    expect(compactSheetHeight({ tokenBottom: 300, sheetTop: 400, sheetBottom: 836 })).toBeNull();
    expect(compactSheetHeight({ tokenBottom: 420, sheetTop: 400, sheetBottom: 836 })).toBe(404);
    // 카드 핵심(표제어·뜻·등급)이 들어가는 높이 아래로는 줄이지 않는다(AE-R2 계약).
    expect(compactSheetHeight({ tokenBottom: 520, sheetTop: 400, sheetBottom: 836 })).toBe(368);
    expect(compactSheetHeight({ tokenBottom: 780, sheetTop: 400, sheetBottom: 836 })).toBe(368);
    expect(compactSheetHeight({ tokenBottom: NaN, sheetTop: 400, sheetBottom: 836 })).toBeNull();
  });
});

describe('paged controller', () => {
  it('sizes the box, counts pages and turns with keys and buttons', () => {
    const reader = fakeReader();
    const c = controller(reader);
    expect(reader.style.get('--reader-page-height')).toBe('732px'); // 844 − 100(상자 위) − 12(바닥 여백) − 막대 0
    expect(c.state).toMatchObject({ page: 0, count: 10, ready: true, progress: 10 });
    const event = { key: 'ArrowRight', target: { closest: () => null }, preventDefault: vi.fn() };
    expect(c.handleKey(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(reader.pages.scrollLeft).toBe(348);
    c.handleKey({ key: 'End', target: { closest: () => null }, preventDefault() {} });
    expect(c.state.page).toBe(9);
    c.next();
    expect(c.state.page).toBe(9); // 끝에서 멈춘다
    c.first();
    expect(reader.pages.scrollLeft).toBe(0);
  });
  it('records the first token of a page the reader turned to, never the page number', () => {
    const reader = fakeReader();
    const turned = [];
    const c = controller(reader, { onUserPage: anchor => turned.push(anchor.el.dataset.sourceToken) });
    c.goTo(3, { user: true });
    c.relayout(); // 다시 재기만 하면 저장하지 않는다
    expect(turned).toEqual(['t30']);
  });
  it('steps by the content width when the box has inline padding (hover devices keep the line bar inside the clip)', () => {
    const reader = fakeReader({ width: 356 }); // clientWidth = 300 + 28 × 2
    reader.state.width = 300;
    Object.defineProperty(reader.pages, 'clientWidth', { get: () => 356 });
    reader.win.getComputedStyle = () => ({ columnGap: '48px', paddingLeft: '28px', paddingRight: '28px' });
    const c = controller(reader);
    c.goTo(2);
    expect(c.metrics.step).toBe(348);
    expect(reader.pages.scrollLeft).toBe(696);
  });
  it('restores the anchor token after a resize or font change reflows the columns', () => {
    const reader = fakeReader();
    const c = controller(reader);
    c.goTo(4, { user: true }); // 기준 = t40
    reader.state.perPage = 5; // 글자를 키우면 쪽당 토큰이 준다
    c.relayout();
    expect(c.state).toMatchObject({ page: 8, count: 20 });
    expect(reader.pages.scrollLeft).toBe(8 * 348);
    reader.state.width = 500; reader.state.perPage = 20; // 가로로 돌리면
    c.relayout();
    expect(c.state).toMatchObject({ page: 2, count: 5 });
    expect(reader.pages.scrollLeft).toBe(2 * 548);
  });
  it('reveals a restored or selected token on its page and keeps it as the anchor', () => {
    const reader = fakeReader();
    const c = controller(reader);
    c.reveal(reader.tokenEls[57]);
    expect(c.state.page).toBe(5);
    reader.state.perPage = 4;
    c.relayout();
    expect(c.state.page).toBe(14); // 57 / 4
  });
  it('falls back to a re-rendered token with the same id and keeps tail pages after the text', () => {
    const reader = fakeReader();
    const c = controller(reader);
    const old = reader.tokenEls[33];
    c.reveal(old);
    old.isConnected = false;
    reader.tokenEls[33] = { ...old, isConnected: true, getClientRects: old.getClientRects, getBoundingClientRect: old.getBoundingClientRect };
    c.relayout();
    expect(c.state.page).toBe(3);
    // 토큰이 없는 쪽(읽기 완료·다음 편이 사는 끝 쪽)은 끝에서 몇 번째 쪽인지로 기억한다.
    expect(c.captureAnchor(99)).toMatchObject({ kind: 'tail' });
    expect(c.captureAnchor(0)).toMatchObject({ kind: 'element' });
  });
  it('snaps a foreign scroll (find, focus) to the nearest page, or to the element focus just moved to', () => {
    const reader = fakeReader();
    const c = controller(reader);
    reader.pages.scrollLeft = 348 * 2.3; // 브라우저 찾기가 어중간하게 끌고 감
    c.handleScroll();
    expect(c.state.page).toBe(2);
    expect(reader.pages.scrollLeft).toBe(696);
    c.handleScroll(); // 맞춤 자체가 낸 스크롤 이벤트는 무시하고 표식을 걷는다
    // 포커스 이동(쪽 2의 마지막 낱말 — focusin은 쪽을 바꾸지 않음)이 낸 nearest 정렬 — 가까운 쪽(3)이 아니라 포커스의 쪽
    reader.pages.ownerDocument.activeElement = reader.tokenEls[29];
    c.handleFocusIn({ target: reader.tokenEls[29] });
    expect(c.state.page).toBe(2);
    reader.pages.scrollLeft = 348 * 2.6;
    c.handleScroll();
    expect(c.state.page).toBe(2);
    c.handleFocusIn({ target: reader.tokenEls[5] });
    expect(c.state.page).toBe(0);
  });
  it('waits for the press to end before aligning, so a click is not moved between down and up', () => {
    const reader = fakeReader();
    const c = controller(reader);
    c.handlePointerDown({ pointerId: 3, pointerType: 'mouse', clientX: 10, clientY: 10 });
    reader.pages.ownerDocument.activeElement = reader.tokenEls[25];
    c.handleFocusIn({ target: reader.tokenEls[25] }); // 누르면서 받은 포커스
    reader.pages.scrollLeft = 348 * 2.2;
    c.handleScroll();
    expect(c.state.page).toBe(0); // 누르는 동안은 그대로
    c.handleRelease();
    expect(c.state.page).toBe(2); // 뗀 뒤 포커스의 쪽으로
    expect(reader.pages.scrollLeft).toBe(696);
  });
  it('ignores its own scroll and swipes while a word card is open or text is being selected', () => {
    const reader = fakeReader();
    let open = false;
    const c = controller(reader, { canSwipe: () => !open });
    c.goTo(1);
    c.handleScroll();
    expect(c.state.page).toBe(1);
    const swipe = (dx, extra = {}) => { c.handlePointerDown({ pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 300, ...extra }); return c.handlePointerUp({ pointerId: 1, clientX: 200 + dx, clientY: 305 }); };
    expect(swipe(-120)).toBe(1);
    expect(c.state.page).toBe(2);
    expect(swipe(120)).toBe(-1);
    expect(c.state.page).toBe(1);
    open = true;
    expect(swipe(-120)).toBe(0);
    open = false;
    reader.win.getSelection = () => ({ isCollapsed: false, toString: () => '池の中' });
    expect(swipe(-120)).toBe(0);
    reader.win.getSelection = () => null;
    expect(swipe(-120, { pointerType: 'mouse' })).toBe(0); // 마우스 끌기는 범위 지정 몫
    expect(c.state.page).toBe(1);
  });
  it('does not page while a dialog is open or the viewer blocks commands', () => {
    const reader = fakeReader();
    let blocked = true;
    const c = controller(reader, { canKey: () => !blocked });
    expect(c.handleKey({ key: 'ArrowRight', target: { closest: () => null }, preventDefault() {} })).toBe(false);
    blocked = false;
    reader.pages.ownerDocument.querySelector = selector => (selector === 'dialog[open]' ? {} : null);
    expect(c.handleKey({ key: 'ArrowRight', target: { closest: () => null }, preventDefault() {} })).toBe(false);
    expect(c.state.page).toBe(0);
  });
  it('moves overlays into the box coordinate space, which scrolls with the pages', () => {
    const pages = { getBoundingClientRect: () => ({ left: 20, top: 100 }), clientLeft: 0, clientTop: 0, scrollLeft: 696, scrollTop: 0 };
    const reader = { closest: () => pages, getBoundingClientRect: () => ({ left: 5, top: 5 }) };
    expect(overlayOrigin(reader)).toEqual({ left: 20 - 696, top: 100 });
    expect(overlayOrigin({ closest: () => null, getBoundingClientRect: () => ({ left: 5, top: 7 }) })).toEqual({ left: 5, top: 7 });
  });
});

// 글꼴 받기가 끝날 때 다시 재기(READER-FONT-REMEASURE-001) — 본문 글꼴에 속한 글꼴일 때만. 판단할 수 없으면 전처럼 잰다.
// 운영 실측(2026-10-17 KST): 읽기 설정 창의 글꼴이 받아질 때마다 본문 쪽을 통째로 다시 쟀다(390폭 · CPU 4배 46ms).
describe('re-measure on fonts loadingdone only for reader fonts', () => {
  it('normalizes computed font-family names', () => {
    expect(fontFamilyNames('"Noto Sans JP", "Noto Sans JP Fallback", sans-serif, \'Noto Sans KR\'')).toEqual(['noto sans jp', 'noto sans jp fallback', 'sans-serif', 'noto sans kr']);
    expect(fontFamilyNames('')).toEqual([]);
  });
  it('decides by family; undecidable → re-measure', () => {
    const body = fontFamilyNames('"Noto Sans JP", sans-serif, "Noto Sans KR"');
    expect(fontsAffectReader([{ family: 'Manrope' }, { family: '"Noto Serif KR"' }], body)).toBe(false);
    expect(fontsAffectReader([{ family: 'Manrope' }, { family: '"Noto Sans JP"' }], body)).toBe(true);
    expect(fontsAffectReader([{ family: 'NOTO SANS KR' }], body)).toBe(true);
    expect(fontsAffectReader(undefined, body)).toBe(true);
    expect(fontsAffectReader([], body)).toBe(true);
    expect(fontsAffectReader([{ family: 'Manrope' }], [])).toBe(true);
    expect(fontsAffectReader([{ family: '' }], body)).toBe(true);
  });
  it('the attached controller schedules a relayout only when a loaded face is in the box or probe font stack', () => {
    const reader = fakeReader();
    const listeners = {};
    const fonts = { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: (type) => { delete listeners[type]; }, ready: null };
    const doc = { activeElement: null, querySelector: () => null, addEventListener() {}, removeEventListener() {}, fonts };
    const probe = { nodeType: 1, font: '"Noto Sans JP", "Noto Sans JP Fallback", sans-serif, "Noto Sans KR", sans-serif' };
    Object.assign(reader.pages, { addEventListener() {}, removeEventListener() {}, parentElement: null, ownerDocument: doc, font: '"Noto Sans KR", sans-serif' });
    const tokens = reader.pages.querySelectorAll;
    reader.pages.querySelectorAll = (selector) => (selector === '[data-page-probe]' ? [probe] : tokens(selector));
    const frames = vi.fn(() => 1);
    reader.win.visualViewport = { height: 844, scale: 1, addEventListener() {}, removeEventListener() {} };
    Object.assign(reader.win, { addEventListener() {}, removeEventListener() {}, requestAnimationFrame: frames, ResizeObserver: undefined, MutationObserver: undefined,
      getComputedStyle: (node) => ({ columnGap: '48px', fontFamily: node.font || '' }) });
    const c = createPagedController(reader.pages, () => ({ window: reader.win, document: doc, reducedMotion: () => true }));
    const detach = c.attach();
    expect(typeof listeners.loadingdone).toBe('function');
    listeners.loadingdone({ fontfaces: [{ family: 'Manrope' }, { family: 'Noto Serif KR' }] });
    expect(frames).not.toHaveBeenCalled(); // 화면 글꼴만 받았다 — 본문 쪽은 그대로
    listeners.loadingdone({ fontfaces: [{ family: 'Noto Sans JP' }] });
    expect(frames).toHaveBeenCalledTimes(1); // 본문 글꼴(탐침) — 다시 잰다
    c.relayout(); frames.mockClear();
    reader.win.getComputedStyle = () => ({ columnGap: '48px' });
    listeners.loadingdone({ fontfaces: [{ family: 'Manrope' }] });
    expect(frames).toHaveBeenCalledTimes(1); // 본문 글꼴을 모르면 전처럼 잰다
    detach();
    expect(listeners.loadingdone).toBeUndefined();
  });
});

// 쪽 넘김의 크기 변화 없는 다시 재기(PAGE-TURN-REMEASURE-001) — 운영 실측(2026-10-17 KST, viewer/45 · 390폭): 쪽을 넘길 때마다 쪽 상자 안
// 진행 막대(쪽 보기에서 display:none)의 width · % 숫자가 바뀌어 MutationObserver가 쪽 전체 다시 재기를 불렀다(ResizeObserver 0건).
describe('page-turn mutations outside the page flow do not re-measure', () => {
  it('ignores mutations that are all inside [data-page-ignore]; unknown targets still re-measure', () => {
    const inside = { nodeType: 1, closest: (sel) => (sel === '[data-page-ignore]' ? {} : null) };
    const flow = { nodeType: 1, closest: () => null };
    expect(mutationsAffectFlow([{ type: 'attributes', target: inside }, { type: 'characterData', target: { nodeType: 3, parentElement: inside } }])).toBe(false);
    expect(mutationsAffectFlow([{ type: 'attributes', target: inside }, { type: 'childList', target: flow }])).toBe(true);
    expect(mutationsAffectFlow([{ type: 'childList', target: null }])).toBe(true);
    expect(mutationsAffectFlow([])).toBe(false);
  });
  it('wiring: the observer returns early on ignored mutations; the hidden progress bar is marked', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/usePagedReader.js'), 'utf8');
    expect(sliceBetween(src, 'new w.MutationObserver(records => {', '}) : null;')).toContain('if (!mutationsAffectFlow(records)) return;\n      watchProbes(); schedule();');
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('<div className="viewer-progress-bar" aria-label={`읽기 진행률 ${readProgress}%`} data-page-ignore>');
    expect(fs.readFileSync(path.join(process.cwd(), 'src/components/viewer/paged-reader.css'), 'utf8')).toContain('.viewer-layout[data-reader-view="paged"] .viewer-progress-bar { display: none; }');
  });
  it('the attached controller skips a relayout for an ignored mutation and schedules one for a flow mutation', () => {
    const reader = fakeReader();
    let observe = null;
    class FakeMO { constructor(cb) { observe = cb; } observe() {} disconnect() {} }
    const doc = { activeElement: null, querySelector: () => null, addEventListener() {}, removeEventListener() {}, fonts: null };
    Object.assign(reader.pages, { addEventListener() {}, removeEventListener() {}, parentElement: null, ownerDocument: doc });
    reader.win.visualViewport = { height: 844, scale: 1, addEventListener() {}, removeEventListener() {} };
    const frames = vi.fn(() => 1);
    Object.assign(reader.win, { addEventListener() {}, removeEventListener() {}, requestAnimationFrame: frames, ResizeObserver: undefined, MutationObserver: FakeMO });
    const c = createPagedController(reader.pages, () => ({ window: reader.win, document: doc, reducedMotion: () => true }));
    const detach = c.attach();
    const bar = { nodeType: 1, closest: (sel) => (sel === '[data-page-ignore]' ? {} : null) };
    observe([{ type: 'attributes', target: bar }, { type: 'characterData', target: { nodeType: 3, parentElement: bar } }]);
    expect(frames).not.toHaveBeenCalled();
    observe([{ type: 'childList', target: { nodeType: 1, closest: () => null } }]);
    expect(frames).toHaveBeenCalledTimes(1);
    detach();
  });
});

// Tab 초점이 다음 쪽 첫 줄의 문장 막대(.line-pick)에 들 때(PAGED-FOCUS-001, 2026-10-17 KST) — 막대는 낱말 왼쪽 여백에 떠서 단 사이 틈
// (현재 쪽 끝)에 놓인다. 막대 자리로 쪽을 재면 넘어가지 않아 초점이 화면 밖에 남았다(390 실측: 막대 x 384~408 · 낱말 x 414 · 쪽 그대로).
describe('focus on a line-head button follows its word page', () => {
  const buttonOf = (reader, index) => {
    const token = reader.tokenEls[index];
    return { nodeType: 1, closest: () => token,
      getClientRects() { return [this.getBoundingClientRect()]; },
      getBoundingClientRect() { const r = token.getBoundingClientRect(); return { ...r, left: r.left - 30, right: r.left - 6, width: 24 }; } };
  };
  it('focusin on the button turns to the page of its word, not of the gap the button sits in', () => {
    const reader = fakeReader();
    const c = controller(reader);
    c.goTo(1);
    const button = buttonOf(reader, 20); // 20 = 쪽 2의 첫 낱말, 막대는 쪽 1과 2 사이 틈
    reader.pages.contains = el => reader.tokenEls.includes(el) || el === button;
    c.handleFocusIn({ target: button });
    expect(c.state.page).toBe(2);
    expect(reader.pages.scrollLeft).toBe(696);
  });
  it('the focus scroll that follows the button focus aligns to the word page too', () => {
    let now = 5_000_000;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const reader = fakeReader();
      const c = controller(reader);
      c.goTo(1); now += 1000;
      c.handleScroll(); // 우리 이동이 낸 스크롤 이벤트 — 표식을 걷는다
      const button = buttonOf(reader, 20);
      reader.pages.contains = el => reader.tokenEls.includes(el) || el === button;
      reader.pages.ownerDocument.activeElement = button;
      c.handleFocusIn({ target: button });
      now += 200; // 우리 맞춤의 표식 시간(120ms)이 지난 뒤 도착한 브라우저의 포커스 스크롤 — 초점이 방금 바뀐 스크롤(500ms 안)
      reader.pages.scrollLeft = 348 * 1.1;
      c.handleScroll();
      expect(c.state.page).toBe(2);
    } finally { spy.mockRestore(); }
  });
  it('wiring: focus · scroll · release all measure through the word (focusPageTarget)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/usePagedReader.js'), 'utf8');
    expect(src).toContain("const focusPageTarget = el => { const item = el?.closest?.(opt().focusSelector || FOCUS_ITEM); return item && item !== pages && pages.contains?.(item) ? item : el; };");
    expect(src.match(/pageOf\(focusPageTarget\(active\)\)/g)).toHaveLength(1); // focusedPage 한 곳
    // 스크롤 · 뗀 뒤 맞춤은 초점이 방금 바뀐 경우에만 초점 쪽(FOREIGN-SCROLL-001)
    expect(sliceBetween(src, 'function handleScroll() {', '\n  }')).toContain('(Date.now() - focusAt < FOCUS_SCROLL_MS ? focusedPage() : null) ?? foreignScrollPage(left, page, { step, gap, count })');
    expect(sliceBetween(src, 'function settleDeferred() {', '\n  }')).toContain('(byFocus ? focusedPage() : null) ?? nearestPage(');
    expect(sliceBetween(src, 'function handleFocusIn(event) {', '\n  }')).toContain('focusAt = Date.now();');
    expect(sliceBetween(src, 'function handleFocusIn(event) {', '\n  }')).toContain('const next = pageOf(focusPageTarget(target));');
  });
});

// 초점이 본문 낱말에 그대로 남은 채 브라우저 찾기(Ctrl+F) · 화면 읽기 도구가 다른 쪽으로 스크롤하면(FOREIGN-SCROLL-001, 2026-10-17 KST)
// 그 스크롤이 닿은 쪽으로 맞춘다 — 예전엔 handleScroll이 초점 낱말의 쪽으로 되돌려 찾은 글자가 화면에서 사라졌다.
// 초점이 「방금」 바뀐 스크롤(Tab · 클릭이 낸 nearest 정렬)만 초점 쪽으로 끌어온다. Tab 초점 따라가기(focusin)는 그대로.
describe('a foreign scroll with unchanged focus stays where it landed', () => {
  const clock = start => { let now = start; const spy = vi.spyOn(Date, 'now').mockImplementation(() => now); return { tick: ms => { now += ms; }, restore: () => spy.mockRestore() }; };
  it('find / screen reader: focus left on a word earlier does not pull the scroll back', () => {
    const t = clock(1_000_000);
    try {
      const reader = fakeReader();
      const c = controller(reader);
      reader.pages.ownerDocument.activeElement = reader.tokenEls[5]; // 앞서 누른 낱말(쪽 0)에 초점이 남아 있다
      c.handleFocusIn({ target: reader.tokenEls[5] });
      t.tick(5000); // 한참 뒤 Ctrl+F
      reader.pages.scrollLeft = 348 * 5.2;
      c.handleScroll();
      expect(c.state.page).toBe(5);
      expect(reader.pages.scrollLeft).toBe(348 * 5);
      t.tick(1000);
      c.handleScroll(); // 맞춤이 낸 스크롤 — 표식만 걷는다
      reader.pages.scrollLeft = 348 * 7.4; // 화면 읽기 도구의 다음 줄 스크롤
      c.handleScroll();
      expect(c.state.page).toBe(7);
    } finally { t.restore(); }
  });
  it('the focus-driven scroll right after a focus change still aligns to the focused word', () => {
    const t = clock(2_000_000);
    try {
      const reader = fakeReader();
      const c = controller(reader);
      c.goTo(2); t.tick(1000); c.handleScroll();
      reader.pages.ownerDocument.activeElement = reader.tokenEls[29];
      c.handleFocusIn({ target: reader.tokenEls[29] });
      t.tick(16); // 다음 프레임의 스크롤 이벤트
      reader.pages.scrollLeft = 348 * 2.6;
      c.handleScroll();
      expect(c.state.page).toBe(2);
    } finally { t.restore(); }
  });
  it('after a press: a focus taken by the press aligns to it; a press without a focus change lands on the nearest page', () => {
    const t = clock(3_000_000);
    try {
      const reader = fakeReader();
      const c = controller(reader);
      reader.pages.ownerDocument.activeElement = reader.tokenEls[5];
      c.handleFocusIn({ target: reader.tokenEls[5] });
      t.tick(5000);
      c.handlePointerDown({ pointerId: 4, pointerType: 'mouse', clientX: 10, clientY: 10 }); // 초점은 그대로(글자 끌어 고르기 등)
      reader.pages.scrollLeft = 348 * 3.2;
      c.handleScroll();
      expect(c.state.page).toBe(0);
      c.handleRelease();
      expect(c.state.page).toBe(3);
    } finally { t.restore(); }
  });
});

// 초점 귀속 대상(focusSelector)은 쪽 기준 요소(anchorSelector)와 따로다 — 원본 리더의 기준 요소는 본문 전체 article(.original-writing,
// 여러 쪽에 걸침)이라, 그 안 초점을 article로 귀속하면 어느 쪽에 있든 첫 쪽으로 튄다(PAGED-FOCUS-001 리뷰 2026-10-17 KST).
describe('focus attribution is separate from the page anchor selector', () => {
  it('a focused element inside a multi-page anchor container measures by itself, not by the container', () => {
    const reader = fakeReader();
    const article = { nodeType: 1, getClientRects() { return [this.getBoundingClientRect()]; },
      getBoundingClientRect() { const left = -reader.pages.scrollLeft; return { left, right: left + 300, top: 100, bottom: 700, width: 300, height: 600 }; } };
    const link = { nodeType: 1, closest: sel => (sel === '.original-writing' ? article : null),
      getClientRects() { return [this.getBoundingClientRect()]; },
      getBoundingClientRect() { const left = 3 * 348 - reader.pages.scrollLeft; return { left, right: left + 40, top: 140, bottom: 170, width: 40, height: 30 }; } };
    reader.pages.contains = el => reader.tokenEls.includes(el) || el === article || el === link;
    const c = controller(reader, { anchorSelector: '.original-writing' });
    c.handleFocusIn({ target: link });
    expect(c.state.page).toBe(3);
  });
  it('wiring: focusPageTarget reads focusSelector (default word), never anchorSelector; the original reader passes no focusSelector', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/usePagedReader.js'), 'utf8');
    const fn = sliceBetween(src, 'const focusPageTarget = el =>', '\n');
    expect(fn).toContain('opt().focusSelector || FOCUS_ITEM');
    expect(fn).not.toContain('anchorSelector');
    expect(src).toContain("const FOCUS_ITEM = '[data-source-token]';");
    expect(src).toMatch(/latest\.current = \{[^}]*\bfocusSelector\b/);
    const original = fs.readFileSync(path.join(process.cwd(), 'src/components/materials/OriginalMaterialReader.jsx'), 'utf8');
    expect(original).toContain("anchorSelector:'.original-writing'");
    expect(original).not.toMatch(/focusSelector/);
  });
});

// 남의 스크롤이 「새로 드러낸」 쪽(FOREIGN-SCROLL-001 후속, 2026-10-17 KST). 화면 읽기 도구는 다음 쪽 앞머리 요소를 화면 끝에 겨우 보이게
// (nearest 정렬) 스크롤한다 — 가장 가까운 쪽(반올림)은 지금 쪽이라 되돌아가 요소가 다시 화면 밖이 됐다(390: 쪽 454px, 다음 쪽 앞 약 160px).
// 지금 쪽 옆 쪽의 글자 칸이 화면에 들어왔으면(단 사이 틈을 넘게 밀렸으면) 그 옆 쪽. 손으로 밀다 놓은 맞춤은 가장 가까운 쪽 그대로.
describe('a foreign scroll lands on the page it newly revealed', () => {
  const at390 = { step: 454, gap: 64, count: 10 }; // 390 폭: 단 390 + 틈 64
  const nearAlign = (page, intoNext) => page * 454 + 64 + intoNext; // 다음 쪽 앞 intoNext px 요소의 오른쪽 끝을 화면 끝에 맞춘 스크롤

  it('next page head (first ~160px) revealed at the right edge → the next page, where rounding went back', () => {
    for (const into of [20, 100, 160, 180]) {
      expect(foreignScrollPage(nearAlign(2, into), 2, at390), `${into}px`).toBe(3);
    }
    expect(nearestPage(nearAlign(2, 100), 454, 10)).toBe(2); // 반올림이었다면 되돌아간 경우
    expect(nearestPage(nearAlign(2, 160), 454, 10)).toBe(2);
  });
  it('previous page tail revealed at the left edge → the previous page', () => {
    // 앞 쪽 끝 요소의 왼쪽을 화면 왼쪽에 맞춤: 앞 쪽 단 안 300px 지점
    expect(foreignScrollPage(454 + 300, 2, at390)).toBe(1);
    expect(nearestPage(454 + 300, 454, 10)).toBe(2);
  });
  it('a nudge inside the column gap stays; a jump past the neighbour (find far away) is the nearest page; edges clamp', () => {
    for (const nudge of [0, 1, 30, 64]) expect(foreignScrollPage(908 + nudge, 2, at390)).toBe(2);
    for (const nudge of [-1, -30, -64]) expect(foreignScrollPage(908 + nudge, 2, at390)).toBe(2);
    expect(foreignScrollPage(454 * 6.2, 2, at390)).toBe(6);
    expect(foreignScrollPage(454 * 5.7, 2, at390)).toBe(6);
    expect(foreignScrollPage(454 * 9 + 100, 9, at390)).toBe(9);
    expect(foreignScrollPage(-200, 0, at390)).toBe(0);
  });
  it('find centring a match on the next page still lands on it (either half)', () => {
    const centre = (page, x) => page * 454 + x - 390 / 2;
    for (const x of [10, 150, 250, 380]) expect(foreignScrollPage(centre(3, x), 2, at390), `x ${x}`).toBe(3);
    for (const x of [10, 150, 250, 380]) expect(foreignScrollPage(centre(1, x), 2, at390), `back x ${x}`).toBe(1);
  });

  const clock = start => { let now = start; const spy = vi.spyOn(Date, 'now').mockImplementation(() => now); return { tick: ms => { now += ms; }, restore: () => spy.mockRestore() }; };
  it('controller: an unfocused foreign scroll to the next page head turns to it; the same offset after a press (hand swipe) keeps the nearest page', () => {
    const t = clock(4_000_000);
    try {
      const reader = fakeReader(); // 단 300 + 틈 48 = 쪽 348
      const c = controller(reader);
      c.goTo(2); t.tick(1000); c.handleScroll();
      reader.pages.scrollLeft = 2 * 348 + 48 + 100; // 화면 읽기 도구: 다음 쪽 앞 100px 요소를 화면 끝에
      c.handleScroll();
      expect(c.state.page).toBe(3);
      expect(reader.pages.scrollLeft).toBe(3 * 348);

      const swiped = fakeReader(), d = controller(swiped);
      d.goTo(2); t.tick(1000); d.handleScroll();
      d.handlePointerDown({ pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 300 });
      swiped.pages.scrollLeft = 2 * 348 + 48 + 100;
      d.handleScroll();
      d.handleRelease();
      expect(d.state.page).toBe(2); // 손으로 밀다 놓은 맞춤 = 가장 가까운 쪽(그대로)
      expect(swiped.pages.scrollLeft).toBe(2 * 348);
    } finally { t.restore(); }
  });
  it('wiring: only the unpressed, unfocused scroll path uses foreignScrollPage; release keeps nearestPage', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/usePagedReader.js'), 'utf8');
    expect(src.match(/foreignScrollPage\(/g)).toHaveLength(2); // 정의 + handleScroll 한 곳
    expect(sliceBetween(src, 'function settleDeferred() {', '\n  }')).not.toContain('foreignScrollPage');
    expect(sliceBetween(src, 'function settleDeferred() {', '\n  }')).toContain('?? nearestPage(pages.scrollLeft || 0, step, count)');
  });
});

// 끝의 테두리 상자(NEXT-CARD-SPLIT-001): 1440 쪽 넘김에서 「다음 편」 카드(a.next-lesson-card)가 쪽 경계에서 둘로 갈라졌다(abaa 보고
// 2026-10-17 KST). 같은 실측(8px씩 옮기기)에서 연결한 교재 단원(details.learning-links)과 토론 상자도 갈라졌다 — 쪽 넘김 상자 안에서만
// 통째로 다음 쪽에 둔다(break-inside: avoid). 「다 읽었다면」 줄은 index.css가 이미 묶는다. 본문 문단 · 스크롤 보기에는 걸지 않는다.
describe('end boxes stay whole across page boundaries', () => {
  const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const css = read('src/components/viewer/paged-reader.css');
  const viewer = read('src/views/ViewerPage.jsx');
  const rule = '[data-reader-pages="paged"] :is(.next-lesson-card, .series-end-card, .learning-links, .viewer-comments) { break-inside: avoid; }';
  it('paged-only rule keeps every end box whole — body text keeps filling pages', () => {
    expect(css).toContain(rule);
    expect(css.match(/break-inside:\s*avoid/g)).toHaveLength(1);
    expect(read('src/index.css')).toContain('.post-reading { margin-top: 20px; break-inside: avoid; }'); // 「다 읽었다면」 줄은 원래 묶음
  });
  it('every card in the single 「다음」 slot uses one of the covered classes', () => {
    const slot = sliceBetween(viewer, "{(isDone || isPending) && (() => {", 'return null;\n      })()}');
    const roots = [...slot.matchAll(/className="([^"]+)"/g)].map((m) => m[1]).filter((c) => !/__/.test(c));
    expect(roots.length).toBeGreaterThanOrEqual(5); // 다음 편 · 다음 과 · 다음 과 적기 · 다음 범위 · 완주(공허 통과 방지)
    for (const c of roots) expect(['next-lesson-card', 'series-end-card'].some((k) => c.split(' ').includes(k)), c).toBe(true);
  });
  it('the linked-chapter box and the discussion box carry the covered classes', () => {
    const links = read('src/components/learning/MaterialChapterLinks.jsx');
    expect(links).toContain('<section className="learning-links learning-links--browse">');
    expect(links).toContain('<details className="learning-links" onToggle=');
    expect(read('src/views/ViewerComments.jsx')).toContain('<div className="card viewer-comments" style=');
    // 뷰어의 연결한 교재 단원 상자는 2026-10-23 KST 오너 지시로 뺐다(viewerAuditFollowup.test.js) — 규칙은 교재 쪽 상자에 남는다.
  });
});

// 자동 이동 우선순위(LISTEN-FOLLOW, 2026-10-17 KST) — 듣기 따라가기 같은 자동 이동(reveal auto)은 사람과 다른 이동에 진다:
// 본문을 누르는 중이거나 canAutoReveal()이 거절하면(시트 열림 · 드래그 범위 지정 · 키 차단) 옮기지도 기준을 바꾸지도 않는다.
// 시트의 단어 보이기(useSelectedTokenVisibility)는 auto가 아니라 늘 이긴다.
describe('auto reveal yields to people (listen follow)', () => {
  it('canAutoReveal false → 다른 쪽 대상은 false · 쪽 · 기준 그대로, 같은 쪽 대상은 true(옮기지 않고 보인다), 보통 reveal은 지금처럼 옮긴다', () => {
    const reader = fakeReader();
    let allow = false;
    const c = controller(reader, { canAutoReveal: () => allow });
    expect(c.reveal(reader.tokenEls[57], { auto: true })).toBe(false);
    expect(c.state.page).toBe(0);
    expect(c.reveal(reader.tokenEls[4], { auto: true })).toBe(true); // 지금 쪽(0) — 밑줄은 달 수 있다
    expect(c.state.page).toBe(0);
    expect(c.reveal(reader.tokenEls[57])).toBe(true);
    expect(c.state.page).toBe(5);
    allow = true;
    expect(c.reveal(reader.tokenEls[3], { auto: true })).toBe(true);
    expect(c.state.page).toBe(0);
  });
  it('누르는 중에는 auto reveal을 거절하고, 손을 떼면 다시 받는다', () => {
    const reader = fakeReader();
    const c = controller(reader, { canAutoReveal: () => true });
    c.handlePointerDown({ pointerId: 9, pointerType: 'mouse', clientX: 10, clientY: 10 });
    expect(c.reveal(reader.tokenEls[57], { auto: true })).toBe(false);
    expect(c.state.page).toBe(0);
    c.handleRelease();
    expect(c.reveal(reader.tokenEls[57], { auto: true })).toBe(true);
    expect(c.state.page).toBe(5);
  });
  // 진도 보존(LISTEN-FOLLOW 리뷰 5-①) — 따라가기 전 듣기는 쪽을 옮기지 않아 읽기 진도(진행 막대 · 그룹 material_pct)가 그대로였다.
  // 자동 이동은 쪽(progress · 쪽 막대)은 옮겨도 readProgress는 올리지 않는다. 사람의 넘김과 auto 아닌 reveal은 지금처럼 진도.
  it('auto reveal은 readProgress를 올리지 않는다 — 다시 흐름(relayout)에도 그대로, 사람 넘김 · 보통 reveal은 올린다', () => {
    const reader = fakeReader();
    const c = controller(reader, { canAutoReveal: () => true });
    const start = c.state.readProgress;
    expect(c.reveal(reader.tokenEls[57], { auto: true })).toBe(true);
    expect(c.state.page).toBe(5);
    expect(c.state.readProgress).toBe(start);
    expect(c.state.progress).not.toBe(start); // 쪽 막대의 지금 쪽 표시는 옮긴다
    c.relayout();
    expect(c.state.page).toBe(5);
    expect(c.state.readProgress).toBe(start);
    c.next({ user: true });
    expect(c.state.page).toBe(6);
    expect(c.state.readProgress).toBe(c.state.progress);
    expect(c.reveal(reader.tokenEls[57], { auto: true })).toBe(true);
    const held = c.state.readProgress;
    expect(c.state.page).toBe(5);
    expect(held).toBeGreaterThan(c.state.progress); // 6쪽 진도 그대로 — 자동으로 5쪽에 와도 내려가지 않는다(올라가지도 않는다)
    expect(c.reveal(reader.tokenEls[3])).toBe(true); // [지금 문장으로] · 시트 단어 = auto 아님 → 진도
    expect(c.state.page).toBe(0);
    expect(c.state.readProgress).toBe(c.state.progress);
  });
  it('배선 — 쪽 넘김 진도는 readProgress(진행 막대 · 그룹 push), 쪽 막대 글은 progress', () => {
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('const readProgress = pagedActive ? pager.readProgress : scrollReadProgress;');
    expect(viewer).not.toContain('pagedActive ? pager.progress');
    expect(viewer).toContain('useGroupReadPush(material?.id, user?.id, readProgress);');
  });
  it('배선 — 뷰어는 시트 · 범위 지정 · 키 차단을 canAutoReveal로 넘기고 듣기는 auto로만 옮긴다; 시트 단어 보이기는 auto가 아니다', () => {
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('canAutoReveal: () => { const g = pagedGuard.current; return !(g.sheetOpen || g.dragging || g.blocked); },');
    expect(sliceBetween(viewer, 'const handleListenSentence = useCallback((index) => {', '}, [listenRanges'))
      .toContain('if (paged.reveal(el, { auto: true })) flushSync(() => setListenTokens(new Set(ids)));');
    const layout = fs.readFileSync(path.join(process.cwd(), 'src/lib/useReaderLayout.js'), 'utf8');
    expect(layout).toContain('pager.reveal(token);');
    expect(layout).not.toContain('auto: true');
    const hook = fs.readFileSync(path.join(process.cwd(), 'src/lib/usePagedReader.js'), 'utf8');
    expect(sliceBetween(hook, 'function reveal(target, {', 'anchor = target.nodeType'))
      .toContain("if (auto && (pressed || opt().canAutoReveal?.() === false)) return ready && pageOf(target) === page;");
    // 훅이 뷰어의 판정을 컨트롤러로 넘긴다 — 빠지면 시트가 열려 있어도 듣기가 쪽을 옮긴다.
    expect(sliceBetween(hook, 'export function usePagedReader({', '}) {')).toContain('canAutoReveal');
    expect(hook).toContain('latest.current = { onUserPage, canSwipe, canKey, canAutoReveal,');
  });
});

// 쪽 넘김 A안(VIEWER-AUDIT 2, 오너 「권장대로」 2026-10-17 KST): 고른 단어가 화면 아래 절반이면 시트를 머리줄 아래에 세운다.
// 쪽 수 · 쪽 경계 · 시트 내용은 그대로 — 시트 자리만 바뀐다. 스크롤 보기 · 1440 옆 패널(position sticky)은 이 경로에 들지 않는다.
describe('paged sheet dock (A안 — 고른 단어의 반대편)', () => {
  const base = { viewportHeight: 844, topLimit: 120, naturalHeight: 440, min: 359 };
  it('위 절반의 단어는 지금처럼 바닥(목업 C 낮추기 그대로), 아래 절반은 위에 선다', () => {
    expect(pagedSheetDock({ ...base, tokenTop: 150, tokenBottom: 206 })).toEqual({ dock: 'bottom' });
    expect(pagedSheetDock({ ...base, tokenTop: 395, tokenBottom: 447 })).toEqual({ dock: 'bottom' }); // 가운데 421 ≤ 422
    expect(pagedSheetDock({ ...base, tokenTop: 684, tokenBottom: 740 })).toEqual({ dock: 'top', top: 120, height: null }); // 위 자리 552 ≥ 440
  });
  it('위에 세울 때 단어 위 자리가 모자라면 낮추되 카드 핵심(min)까지만 — 핵심 높이로도 단어를 덮으면 바닥', () => {
    expect(pagedSheetDock({ ...base, tokenTop: 520, tokenBottom: 576 })).toEqual({ dock: 'top', top: 120, height: 388 });
    expect(pagedSheetDock({ ...base, tokenTop: 490, tokenBottom: 546 })).toEqual({ dock: 'top', top: 120, height: 359 }); // 120–479 · 단어 490 — 덮지 않는다
    expect(pagedSheetDock({ ...base, tokenTop: 479, tokenBottom: 535 })).toEqual({ dock: 'top', top: 120, height: 359 }); // 바닥 479 = 단어 위 끝
    expect(pagedSheetDock({ ...base, tokenTop: 478, tokenBottom: 534 })).toEqual({ dock: 'bottom' }); // 120–479가 단어 478을 덮는다
    expect(pagedSheetDock({ ...base, tokenTop: 430, tokenBottom: 486 })).toEqual({ dock: 'bottom' }); // 예전: 위 120–479가 단어 430–486을 덮었다
    expect(pagedSheetDock({ ...base, tokenTop: NaN, tokenBottom: 486 })).toEqual({ dock: 'bottom' });
  });
  it('머리줄이 큰 배치(390 듣기 중 머리줄 바닥 386 — 실측)의 아래 단어는 바닥 — 위 시트 394–834가 단어 540–596을 덮었다', () => {
    expect(pagedSheetDock({ ...base, topLimit: 394, min: 392, tokenTop: 540, tokenBottom: 596 })).toEqual({ dock: 'bottom' });
    expect(pagedSheetDock({ ...base, topLimit: 242, min: 392, tokenTop: 684, tokenBottom: 740 })).toEqual({ dock: 'top', top: 242, height: 430 });
  });
  it('원래 높이보다 키우지 않는다 — 핵심이 원래 높이를 넘으면 원래 높이로 덮는지 잰다(긴 문장 카드 445 · 게스트 카드 실측 1113)', () => {
    expect(pagedSheetDock({ ...base, min: 445, tokenTop: 520, tokenBottom: 576 })).toEqual({ dock: 'bottom' }); // 120–560이 단어 520을 덮는다
    expect(pagedSheetDock({ ...base, min: 445, tokenTop: 560, tokenBottom: 616 })).toEqual({ dock: 'top', top: 120, height: null }); // 120–560 — 덮지 않는다
    expect(pagedSheetDock({ ...base, topLimit: 242, min: 1113, tokenTop: 689, tokenBottom: 745 })).toEqual({ dock: 'top', top: 242, height: null }); // 242–682
    expect(pagedSheetDock({ ...base, topLimit: 242, min: 1113, tokenTop: 546, tokenBottom: 602 })).toEqual({ dock: 'bottom' }); // 242–682가 546을 덮는다
    expect(pagedSheetDock({ ...base, min: 440, tokenTop: 620, tokenBottom: 676 })).toEqual({ dock: 'top', top: 120, height: null }); // 자리 488 ≥ 원래 440
    expect(pagedSheetDock({ ...base, min: 359, tokenTop: 684, tokenBottom: 740 })).toEqual({ dock: 'top', top: 120, height: null });
  });
  it('반대쪽 붙이기 · floor까지 낮추기(뷰어 점검 A1) — 바닥이 단어를 덮으면 위로, 어느 쪽도 핵심이 안 되면 floor가 되는 쪽(카드 안 스크롤)', () => {
    const a1 = { ...base, sheetBottom: 836, floor: 200 };
    // 위 절반 · 바닥 자리 836−300−12=524 ≥ 359 — 지금처럼 바닥
    expect(pagedSheetDock({ ...a1, tokenTop: 250, tokenBottom: 300 })).toEqual({ dock: 'bottom' });
    // 위 절반이지만 바닥 자리 836−560−12=264 < 359 · 위 자리 300−120=180 < 359 — 바닥이 floor(200)는 되니 바닥(낮춤)
    expect(pagedSheetDock({ ...a1, viewportHeight: 1200, tokenTop: 300, tokenBottom: 560 })).toEqual({ dock: 'bottom' });
    expect(compactSheetHeight({ tokenBottom: 560, sheetTop: 396, sheetBottom: 836, min: 359, floor: 200 })).toBe(264); // 핵심 359 아래로 낮춘다
    expect(compactSheetHeight({ tokenBottom: 560, sheetTop: 396, sheetBottom: 836, min: 359 })).toBe(359); // floor 없으면 예전 그대로(덮는다)
    // 위 절반 · 바닥 자리 836−700−12=124 < floor · 위 자리 600−120=480 ≥ 359 — 위에 선다
    expect(pagedSheetDock({ ...a1, viewportHeight: 1600, tokenTop: 600, tokenBottom: 700 })).toEqual({ dock: 'top', top: 120, height: null }); // 원래 높이 440 ≤ 자리 468 — 120–560
    // 아래 절반 · 위 자리 300 < 359(핵심)이지만 ≥ floor 200, 바닥 자리 836−700−12=124 < 200 — 위에 낮춰 세운다(단어를 덮지 않는다)
    expect(pagedSheetDock({ ...a1, topLimit: 380, tokenTop: 680, tokenBottom: 700 })).toEqual({ dock: 'top', top: 380, height: 288 });
    // 둘 다 floor도 안 되면 지금처럼 바닥
    expect(pagedSheetDock({ ...a1, topLimit: 600, tokenTop: 700, tokenBottom: 760 })).toEqual({ dock: 'bottom' });
  });
  it('배선: 쪽 넘김 경로에서만 정하고(바닥 낮추기와 한 갈래), 닫을 때 자리 표시를 지운다', () => {
    const hook = fs.readFileSync(path.resolve(__dirname, '../useReaderLayout.js'), 'utf8');
    const pagedBranch = sliceBetween(hook, 'function sheetViewport() {', 'export function useSelectedTokenVisibility');
    expect(pagedBranch).toContain("const sheetPlaceable = panel => getComputedStyle(panel).position === 'fixed'"); // 1440 옆 패널(sticky)은 들지 않는다
    expect(pagedBranch).toContain('const dock = pagedSheetDock({');
    expect(pagedBranch).toMatch(/\n\s+if \(dock\.dock === 'top'\) \{\n\s+panel\.dataset\.dock = 'top';/);
    expect(pagedBranch).toContain("panel.dataset.dock = 'top'; panel.style.setProperty('--reader-sheet-top', `${dock.top}px`);");
    expect(pagedBranch).toContain('const height = compactSheetHeight({ tokenBottom: tokenRect.bottom'); // 위 절반은 지금 그대로
    expect(pagedBranch).toContain("delete panel.dataset.compact; delete panel.dataset.dock; panel.style.removeProperty('--reader-sheet-top');");
    expect(sliceBetween(hook, 'function resetPagedSheet(panel) {', 'export function useSelectedTokenVisibility')).toContain('delete panel.dataset.compact; delete panel.dataset.dock; delete panel.dataset.placing;'); // 닫힘 · 스크롤 보기 전환
    expect(hook.split('pagedSheetDock(').length - 1).toBe(1); // 스크롤 보기 경로에는 없다
    // 처음 열 때 자리(시트를 보이게 한 DOM 변경)는 본문이 붙은 뒤에도 걸려야 한다 — 자료가 오기 전 마운트에는 본문이 없다.
    expect(hook).toContain('  }, [readerRef, revision]); // 본문(readerRef)은 자료가 온 뒤에 붙는다');
  });
  it('CSS: 1119 이하 쪽 넘김에서만 위에 세운다 — 펼침 · 접힘 상태는 지금 그대로', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../components/viewer/paged-reader.css'), 'utf8');
    const narrow = sliceBetween(css, '@container reader (max-width: 1119px) {', '── 원본 리더 ──');
    expect(narrow).toContain('.viewer-layout[data-reader-view="paged"] .viewer-inspector[data-dock="top"]:not(.is-expanded):not(.is-collapsed) { top: var(--reader-sheet-top, 64px); bottom: auto; max-height: calc(100dvh - var(--reader-keyboard-inset, 0px) - var(--reader-sheet-top, 64px) - max(8px, env(safe-area-inset-bottom))); }');
    expect(css.split('[data-dock="top"]').length - 1).toBe(1);
    // 처음 열 때 판정 전 숨김: 투명 + 누르기 막음. visibility는 초점을 막아(카드 첫 초점) 쓰지 않는다. 옮겨 가는 동작도 없다.
    const placing = css.split('\n').filter(line => line.includes('[data-placing="true"]') && line.includes('{'));
    expect(placing).toEqual(['    .viewer-layout[data-reader-view="paged"] .viewer-inspector[data-placing="true"] { opacity: 0; pointer-events: none; }']);
    expect(narrow).toContain(placing[0]);
  });
});
