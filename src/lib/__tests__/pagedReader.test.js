import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';
import { describe, expect, it, vi } from 'vitest';
import {
  pageStep, pageCountFor, pageOfOffset, nearestPage, pageProgress, pageLabel, pageHeightFor,
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
  it('snaps a foreign scroll (find, focus) to the nearest page, or to the focused element', () => {
    const reader = fakeReader();
    const c = controller(reader);
    reader.pages.scrollLeft = 348 * 2.3; // 브라우저 찾기가 어중간하게 끌고 감
    c.handleScroll();
    expect(c.state.page).toBe(2);
    expect(reader.pages.scrollLeft).toBe(696);
    c.handleScroll(); // 맞춤 자체가 낸 스크롤 이벤트는 무시하고 표식을 걷는다
    reader.pages.ownerDocument.activeElement = reader.tokenEls[71];
    reader.pages.scrollLeft = 348 * 6.2; // 포커스 이동의 nearest 정렬 — 가까운 쪽이 아니라 포커스의 쪽
    c.handleScroll();
    expect(c.state.page).toBe(7);
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

// 쪽 넘김 A안(VIEWER-AUDIT 2, 오너 「권장대로」 2026-10-17 KST): 고른 단어가 화면 아래 절반이면 시트를 머리줄 아래에 세운다.
// 쪽 수 · 쪽 경계 · 시트 내용은 그대로 — 시트 자리만 바뀐다. 스크롤 보기 · 1440 옆 패널(position sticky)은 이 경로에 들지 않는다.
describe('paged sheet dock (A안 — 고른 단어의 반대편)', () => {
  const base = { viewportHeight: 844, topLimit: 120, naturalHeight: 440, min: 359 };
  it('위 절반의 단어는 지금처럼 바닥(목업 C 낮추기 그대로), 아래 절반은 위에 선다', () => {
    expect(pagedSheetDock({ ...base, tokenTop: 150, tokenBottom: 206 })).toEqual({ dock: 'bottom' });
    expect(pagedSheetDock({ ...base, tokenTop: 395, tokenBottom: 447 })).toEqual({ dock: 'bottom' }); // 가운데 421 ≤ 422
    expect(pagedSheetDock({ ...base, tokenTop: 684, tokenBottom: 740 })).toEqual({ dock: 'top', top: 120, height: null }); // 위 자리 552 ≥ 440
  });
  it('위에 세울 때 단어 위 자리가 모자라면 낮추되 카드 핵심(min) 아래로는 줄이지 않는다', () => {
    expect(pagedSheetDock({ ...base, tokenTop: 520, tokenBottom: 576 })).toEqual({ dock: 'top', top: 120, height: 388 });
    expect(pagedSheetDock({ ...base, tokenTop: 430, tokenBottom: 486 })).toEqual({ dock: 'top', top: 120, height: 359 });
    expect(pagedSheetDock({ ...base, tokenTop: NaN, tokenBottom: 486 })).toEqual({ dock: 'bottom' });
  });
  it('원래 높이보다 키우지 않는다 — 긴 문장 카드는 핵심이 440을 넘는다(실측 445, viewer-word-card zh 390 long sentence)', () => {
    expect(pagedSheetDock({ ...base, min: 445, tokenTop: 520, tokenBottom: 576 })).toEqual({ dock: 'top', top: 120, height: null });
    expect(pagedSheetDock({ ...base, min: 440, tokenTop: 520, tokenBottom: 576 })).toEqual({ dock: 'top', top: 120, height: null });
  });
  it('배선: 쪽 넘김 경로에서만 정하고(바닥 낮추기와 한 갈래), 닫을 때 자리 표시를 지운다', () => {
    const hook = fs.readFileSync(path.resolve(__dirname, '../useReaderLayout.js'), 'utf8');
    const pagedBranch = sliceBetween(hook, 'const placePaged = pager => {', 'const reveal = () => {');
    expect(pagedBranch).toContain("getComputedStyle(panel).position !== 'fixed'"); // 1440 옆 패널(sticky)은 들지 않는다
    expect(pagedBranch).toContain('const dock = pagedSheetDock({');
    expect(pagedBranch).toMatch(/\n\s+if \(dock\.dock === 'top'\) \{\n\s+panel\.dataset\.dock = 'top';/);
    expect(pagedBranch).toContain("panel.dataset.dock = 'top'; panel.style.setProperty('--reader-sheet-top', `${dock.top}px`);");
    expect(pagedBranch).toContain('const height = compactSheetHeight({ tokenBottom: tokenRect.bottom'); // 위 절반은 지금 그대로
    expect(pagedBranch).toContain("delete panel.dataset.compact; delete panel.dataset.dock; panel.style.removeProperty('--reader-sheet-top');");
    expect(hook).toContain('delete panel.dataset.compact; delete panel.dataset.dock;\n}'); // resetPagedSheet — 닫힘 · 스크롤 보기 전환
    expect(hook.split('pagedSheetDock(').length - 1).toBe(1); // 스크롤 보기 경로에는 없다
  });
  it('CSS: 1119 이하 쪽 넘김에서만 위에 세운다 — 펼침 · 접힘 상태는 지금 그대로', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../components/viewer/paged-reader.css'), 'utf8');
    const narrow = sliceBetween(css, '@container reader (max-width: 1119px) {', '── 원본 리더 ──');
    expect(narrow).toContain('.viewer-layout[data-reader-view="paged"] .viewer-inspector[data-dock="top"]:not(.is-expanded):not(.is-collapsed) { top: var(--reader-sheet-top, 64px); bottom: auto; max-height: calc(100dvh - var(--reader-keyboard-inset, 0px) - var(--reader-sheet-top, 64px) - max(8px, env(safe-area-inset-bottom))); }');
    expect(css.split('[data-dock="top"]').length - 1).toBe(1);
  });
});
