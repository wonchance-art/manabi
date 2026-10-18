import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 쪽 넘김 A안 리뷰 후속(2026-10-17 KST): useSelectedTokenVisibility의 시트 자리 수명.
// React 없이 effect를 직접 돌린다 — useEffect는 콜백을 받아 두고, 시험이 커밋 순서(정리 → 새 효과)를 흉내 낸다.
// ⑴ 아래 단어 → 다른 아래 단어: 시트가 위→바닥→위로 튀지 않는다(정리가 자리를 바로 지우지 않고, 새 판정은 첫 프레임).
// ⑵ 닫으면 다음 프레임에 자리가 지워진다. ⑶ 시트가 뒤 커밋에 붙어도 붙는 순간 다시 정한다(목업 C 낮추기 포함).
// ⑷ 판정 좌표는 visualViewport(offsetTop · height)와 같은 계 — 키보드가 열린 보이는 영역의 가운데 · 위 끝을 쓴다.
const effects = [];
vi.mock('react', () => ({ useEffect: fn => { effects.push(fn); }, useRef: () => ({}), useState: v => [v, () => {}], useCallback: fn => fn }));
const pager = { reveal: vi.fn() };
let pagerOn = true;
vi.mock('../usePagedReader', () => ({ pagerFor: () => (pagerOn ? pager : null) }));

const { useSelectedTokenVisibility } = await import('../useReaderLayout');
const { pagedSheetDock } = await import('../readingViewport');

let queue = [], nextId = 1, mutationCallbacks = [], resizeCallbacks = [];
function flushFrame() { const run = queue; queue = []; for (const { fn } of run) fn(); }
function fakeStyle() {
  const props = new Map();
  return { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k), getPropertyValue: k => props.get(k) ?? '', props };
}
function fakeWorld({ withPanel = true } = {}) {
  const panelClasses = new Set();
  const panel = {
    hidden: false, displayed: true, dataset: {}, style: fakeStyle(), classes: new Set(), classList: { contains: name => panelClasses.has(name) },
    getClientRects() { return this.displayed ? [this.getBoundingClientRect()] : []; },
    natural: 440, card: false,
    // 카드가 그려졌으면 핵심 = 뜻 아래(위 끝 + 300) + 등급 줄(80) + 12 = 392.
    querySelector(sel) {
      if (!this.card || sel !== '#inspector-word:not([hidden])') return null;
      const rect = () => this.getBoundingClientRect();
      return { querySelector: s => (s === '.word-detail-card__meaning' ? { getBoundingClientRect: () => ({ bottom: rect().top + 300 }) }
        : s === '.reader-card-actions' ? { getBoundingClientRect: () => ({ top: rect().bottom - 80 }) } : s === '.reader-card-body' ? { scrollTop: 0 } : null) };
    },
    // 바닥 시트(기본 440, 위 끝 396) — 위에 세우면 --reader-sheet-top부터.
    getBoundingClientRect() {
      const height = this.dataset.compact ? parseFloat(this.style.getPropertyValue('--reader-sheet-compact')) : this.natural;
      if (this.dataset.dock === 'top') { const top = parseFloat(this.style.getPropertyValue('--reader-sheet-top')); return { top, bottom: top + height, height }; }
      return { top: 836 - height, bottom: 836, height };
    },
  };
  const bar = { bottom: 126 };
  const topbar = { getBoundingClientRect: () => ({ top: 68, bottom: bar.bottom }) };
  const children = { panel: withPanel ? panel : null };
  const layout = { querySelector: sel => (sel === '.viewer-inspector' ? children.panel : sel === '.viewer-topbar' ? topbar : null) };
  const selected = { current: null };
  const root = { dataset: {}, closest: () => layout, querySelector: sel => (sel === '[data-selected]' ? selected.current : null) };
  const token = (top) => ({ isConnected: true, contains: () => false, getBoundingClientRect: () => ({ top, bottom: top + 56 }) });
  return { panel, panelClasses, layout, root, token, selected, bar, attach: () => { children.panel = panel; } };
}
// 둘째 효과(처음 열 때 첫 그리기 전 자리) — 시트를 보이게 한 DOM 변경을 MutationObserver가 알린다.
function useShowEffect(world) {
  const before = effects.length;
  useSelectedTokenVisibility({ current: world.root }, { current: {} }, undefined, false, 0);
  effects[before + 1]();
  const observer = mutationCallbacks[mutationCallbacks.length - 1];
  // 시트를 보이게 하는 변화(열기 · 접힘 풀기 · 고른 단어 표시)를 모두 지켜본다.
  expect(observer.on && observer.opts).toMatchObject({ subtree: true, childList: true, attributes: true });
  expect(observer.opts.attributeFilter).toEqual(expect.arrayContaining(['hidden', 'class', 'data-selected']));
  return () => { if (observer.on) observer.cb([]); };
}
function useMountedEffect(world, tokens, id, enabled = true) {
  const before = effects.length;
  useSelectedTokenVisibility({ current: world.root }, { current: tokens }, id, enabled, 0);
  return effects.slice(before)[0]();
}

beforeEach(() => {
  queue = []; mutationCallbacks = []; resizeCallbacks = []; effects.length = 0; pager.reveal.mockClear(); pagerOn = true;
  vi.stubGlobal('requestAnimationFrame', fn => { const id = nextId++; queue.push({ id, fn }); return id; });
  vi.stubGlobal('cancelAnimationFrame', id => { queue = queue.filter(entry => entry.id !== id); });
  vi.stubGlobal('getComputedStyle', () => ({ position: 'fixed' }));
  vi.stubGlobal('ResizeObserver', class { constructor(cb) { this.cb = cb; this.on = true; resizeCallbacks.push(this); } observe() {} disconnect() { this.on = false; } });
  vi.stubGlobal('MutationObserver', class { constructor(cb) { this.cb = cb; mutationCallbacks.push(this); } observe(target, opts) { this.on = true; this.opts = opts; } disconnect() { this.on = false; } });
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844, visualViewport: { offsetTop: 0, height: 844, addEventListener() {}, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('쪽 넘김 시트 자리 — 바꿔 누를 때 · 닫을 때 · 늦게 붙을 때', () => {
  it('아래 단어에서 다른 아래 단어로: 정리 뒤에도 위 자리가 남고, 새 판정은 첫 프레임에 나온다', () => {
    const world = fakeWorld(), tokens = { a: world.token(617), b: world.token(688) };
    const cleanupA = useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset.dock).toBe('top');
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('134px');
    cleanupA(); // 커밋: 이전 효과 정리
    expect(world.panel.dataset.dock).toBe('top'); // 바로 지우지 않는다 — 지우면 다음 그리기에 바닥(396)으로 튄다
    useMountedEffect(world, tokens, 'b'); // 같은 커밋의 새 효과가 시트를 이어받는다
    flushFrame(); // 첫 프레임
    expect(world.panel.dataset.dock).toBe('top');
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('134px');
    flushFrame();
    expect(world.panel.dataset.dock).toBe('top'); // 미뤄 둔 지우기는 거둬졌다
  });
  it('시트를 닫으면(이어받는 효과 없음) 다음 프레임에 위 자리 · 낮춘 높이를 지운다', () => {
    const world = fakeWorld(), tokens = { a: world.token(531) };
    const cleanup = useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset).toMatchObject({ dock: 'top', compact: 'true' });
    cleanup();
    useMountedEffect(world, tokens, 'a', false); // 닫힘: 효과가 아무것도 걸지 않는다
    flushFrame();
    expect(world.panel.dataset.dock).toBeUndefined();
    expect(world.panel.dataset.compact).toBeUndefined();
    expect([...world.panel.style.props.keys()]).toEqual([]);
  });
  it('위 단어로 바꿔 누르면 첫 프레임에 바닥으로 — 중간에 위 자리가 남지 않는다', () => {
    const world = fakeWorld(), tokens = { low: world.token(688), high: world.token(200) };
    const cleanup = useMountedEffect(world, tokens, 'low');
    flushFrame();
    cleanup(); useMountedEffect(world, tokens, 'high');
    flushFrame();
    expect(world.panel.dataset.dock).toBeUndefined();
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('');
  });
  it('시트가 같은 커밋에 없으면 붙는 순간 다시 정한다(낮추기 경로도 같은 길)', () => {
    const world = fakeWorld({ withPanel: false }), tokens = { a: world.token(688) };
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset.dock).toBeUndefined();
    world.attach();
    for (const observer of mutationCallbacks.filter(o => o.on)) observer.cb([]);
    flushFrame();
    expect(world.panel.dataset.dock).toBe('top');
    expect(mutationCallbacks.every(o => !o.on)).toBe(true); // 붙은 뒤에는 지켜보지 않는다
  });
  it('카드 핵심이 그려지기 전(머리줄만 57px)의 판정은 잠그지 않는다 — 다 차서 커지면 다시 정한다', () => {
    const world = fakeWorld(), tokens = { a: world.token(560) };
    world.panel.natural = 57;
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' }); // 57px면 단어 위 자리(414)에 들어간다 — 원래 높이
    world.panel.natural = 440; world.panel.card = true; // 카드가 차서 440으로 커진다
    for (const observer of resizeCallbacks.filter(o => o.on)) observer.cb([]);
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top', compact: 'true' });
    expect(world.panel.style.getPropertyValue('--reader-sheet-compact')).toBe('414px'); // 자리 414 ≥ 핵심 392 — 원래 440보다 낮게
    const settled = { ...world.panel.dataset };
    for (const observer of resizeCallbacks.filter(o => o.on)) observer.cb([]); // 핵심을 잰 뒤에는 잠긴다(출렁임 없음)
    world.panel.card = false; flushFrame();
    expect(world.panel.dataset).toEqual(settled);
  });
  it('키보드가 열린 보이는 영역(offsetTop · height)으로 정한다 — 위 끝은 보이는 영역 아래', () => {
    window.visualViewport.offsetTop = 200; window.visualViewport.height = 640; // 보이는 영역 200–840, 가운데 520
    const world = fakeWorld(), tokens = { a: world.token(680) };
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset.dock).toBe('top');
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('208px'); // max(머리줄 126, 200) + 8
  });
});

describe('처음 열 때 — 자리 판정 전에는 시트를 그리지 않는다(data-placing)', () => {
  const ro = () => { for (const observer of resizeCallbacks.filter(o => o.on)) observer.cb([]); };
  it('처음 연 아래 단어: 효과에서 바로 숨기고, 첫 프레임에 위 자리와 함께 보인다', () => {
    const world = fakeWorld(), tokens = { a: world.token(688) };
    useMountedEffect(world, tokens, 'a');
    expect(world.panel.dataset.placing).toBe('true'); // 그리기 전 — 바닥 자리는 그려지지 않는다
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
  });
  it('바꿔 누를 때는 숨기지 않는다(이미 자리 잡고 보인 시트)', () => {
    const world = fakeWorld(), tokens = { a: world.token(688), b: world.token(617) };
    const cleanup = useMountedEffect(world, tokens, 'a');
    flushFrame();
    cleanup(); useMountedEffect(world, tokens, 'b');
    expect(world.panel.dataset.placing).toBeUndefined();
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
  });
  it('스크롤 보기에서 열린 채 쪽 넘김으로 이어받은 시트도 숨기지 않는다(앞 효과에서 이어받음)', () => {
    const world = fakeWorld(), tokens = { a: world.token(688), b: world.token(617) };
    pagerOn = false;
    const cleanup = useMountedEffect(world, tokens, 'a');
    flushFrame(); // 스크롤 보기의 첫 프레임(쪽 넘김 아님 — 숨김 없음)
    pagerOn = true;
    cleanup(); useMountedEffect(world, tokens, 'b');
    expect(world.panel.dataset.placing).toBeUndefined();
  });
  it('판정이 안 오면 2프레임 뒤 그냥 보인다(안전 시간)', () => {
    const world = fakeWorld(), tokens = { a: world.token(688) };
    tokens.a.isConnected = false; // 판정 프레임이 아무것도 못 한다
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset.placing).toBe('true');
    flushFrame();
    expect(world.panel.dataset.placing).toBeUndefined();
  });
  it('효과 때 아직 안 보이던 시트는 보이게 되는 순간(ResizeObserver, 그리기 전) 숨긴다', () => {
    const world = fakeWorld(), tokens = { a: world.token(688) };
    world.panel.displayed = false;
    useMountedEffect(world, tokens, 'a');
    expect(world.panel.dataset.placing).toBeUndefined();
    flushFrame();
    world.panel.displayed = true; ro();
    expect(world.panel.dataset.placing).toBe('true');
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
  });
  it('닫았다 다시 열면 다시 숨겼다 보인다 — 닫힌 동안 안 보이던 같은 시트', () => {
    const world = fakeWorld(), tokens = { a: world.token(688) };
    const cleanup = useMountedEffect(world, tokens, 'a');
    flushFrame();
    cleanup(); world.panel.displayed = false; useMountedEffect(world, tokens, 'a', false);
    flushFrame(); // 닫힘 정리
    world.panel.displayed = true;
    useMountedEffect(world, tokens, 'a');
    expect(world.panel.dataset.placing).toBe('true');
  });
  it('옆 패널(sticky) · 스크롤 보기는 숨기지 않는다', () => {
    const sticky = fakeWorld(), tokens = { a: sticky.token(688) };
    vi.stubGlobal('getComputedStyle', () => ({ position: 'sticky' }));
    useMountedEffect(sticky, tokens, 'a');
    expect(sticky.panel.dataset.placing).toBeUndefined();
    vi.stubGlobal('getComputedStyle', () => ({ position: 'fixed' }));
    const scroll = fakeWorld();
    pagerOn = false;
    useMountedEffect(scroll, { a: scroll.token(688) }, 'a');
    expect(scroll.panel.dataset.placing).toBeUndefined();
  });
});

describe('처음 열 때 — 시트를 보이게 한 DOM 변경에서 바로 자리(그리기 전)', () => {
  it('고른 단어가 아래 절반이면 첫 그리기 전에 위에 선다 — 숨길 일도 없다', () => {
    const world = fakeWorld(); world.selected.current = world.token(688);
    const show = useShowEffect(world);
    show();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
    useMountedEffect(world, { a: world.selected.current }, 'a'); // 뒤늦은 선택 효과
    expect(world.panel.dataset.placing).toBeUndefined();
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
  });
  it('접힌 막대 · 펼친 시트 · 스크롤 보기 · 고른 단어 없음은 건드리지 않는다', () => {
    const world = fakeWorld(); world.selected.current = world.token(688);
    const show = useShowEffect(world);
    world.panelClasses.add('is-collapsed'); show();
    world.panelClasses.clear(); world.panelClasses.add('is-expanded'); show();
    world.panelClasses.clear(); pagerOn = false; show();
    pagerOn = true; world.selected.current = null; show();
    expect(world.panel.dataset).toEqual({});
  });
  it('닫았다(접힌 막대) 다시 열면 다시 정한다', () => {
    const world = fakeWorld(); world.selected.current = world.token(688);
    const show = useShowEffect(world);
    show();
    const cleanup = useMountedEffect(world, { a: world.selected.current }, 'a');
    flushFrame();
    cleanup(); world.panelClasses.add('is-collapsed');
    flushFrame(); // 닫힘 정리 — 자리 표시를 지우고 「자리 잡음」을 잊는다
    expect(world.panel.dataset).toEqual({});
    world.panelClasses.clear(); show();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
  });
});

describe('pagedSheetDock — visualViewport 좌표계', () => {
  const base = { viewportHeight: 400, topLimit: 308, naturalHeight: 440, min: 100 }; // 가운데 판정만 — 단어 위 자리(≥ 120)는 핵심(100)보다 크다
  it('가운데는 offsetTop + height/2', () => {
    expect(pagedSheetDock({ ...base, viewportTop: 300, tokenTop: 440, tokenBottom: 496 })).toEqual({ dock: 'bottom' }); // 468 ≤ 500
    expect(pagedSheetDock({ ...base, viewportTop: 300, tokenTop: 480, tokenBottom: 536 }).dock).toBe('top'); // 508 > 500
    expect(pagedSheetDock({ ...base, tokenTop: 440, tokenBottom: 496 }).dock).toBe('top'); // offsetTop 0이면 가운데 200
    expect(pagedSheetDock({ ...base, viewportTop: NaN, tokenTop: 480, tokenBottom: 536 })).toEqual({ dock: 'bottom' });
  });
});

// 비차단 2(B1 후속, 2026-10-17 KST): 따라갈 수 없는 쪽 넘김 자료(분석 어긋남 · 미분석 줄)는 듣기 「지금 문장」 줄이 보여 문장마다
// 머리줄이 자라고 준다(390 실측 59→160px). 위에 세운 시트의 위 끝은 열 때의 머리줄 바닥으로 잠겨 있어 자란 머리줄과 겹쳤다.
// 머리줄 크기 변화(ResizeObserver, 그리기 전)는 --reader-sheet-top만 다시 맞춘다 — 높이 · 위/바닥 판정은 그대로.
describe('위에 세운 시트 — 머리줄이 문장마다 자라고 줄면 위 끝만 따라간다', () => {
  const ro = () => { for (const observer of resizeCallbacks.filter(o => o.on)) observer.cb([]); };
  it('문장마다 바뀌는 머리줄 바닥 + 8로 위 끝을 옮기고, 낮춘 높이 · 자리는 다시 정하지 않는다', () => {
    const world = fakeWorld(), tokens = { a: world.token(560) };
    world.panel.card = true;
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top', compact: 'true' });
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('134px');
    const height = world.panel.style.getPropertyValue('--reader-sheet-compact');
    for (const bottom of [214, 150, 278, 126]) { // 긴 문장 · 짧은 문장 · 더 긴 문장 · 듣기 끝
      world.bar.bottom = bottom; ro();
      expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe(`${bottom + 8}px`); // 같은 콜백(그리기 전)
      flushFrame();
      expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe(`${bottom + 8}px`); // 다음 프레임의 끌어오기가 되돌리지 않는다
      expect(world.panel.dataset).toEqual({ dock: 'top', compact: 'true' });
      expect(world.panel.style.getPropertyValue('--reader-sheet-compact')).toBe(height);
    }
  });
  it('펼친 동안 자란 머리줄도 맞춰 둔다 — 펼침을 풀면 지금 머리줄 아래에 선다(다시 판정 없음)', () => {
    const world = fakeWorld(), tokens = { a: world.token(560) };
    world.panel.card = true;
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    world.panelClasses.add('is-expanded');
    world.bar.bottom = 214; ro(); flushFrame();
    world.panelClasses.delete('is-expanded'); ro(); flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top', compact: 'true' });
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('222px');
  });
  it('첫 열림 판정 중(data-placing)에는 건드리지 않는다 — 판정이 그때의 머리줄로 정한다', () => {
    const world = fakeWorld(), tokens = { a: world.token(688) };
    useMountedEffect(world, tokens, 'a');
    expect(world.panel.dataset.placing).toBe('true');
    world.bar.bottom = 214; ro();
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('');
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' });
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('222px');
  });
  it('바닥 시트 · 보이는 영역 위 끝 아래 머리줄', () => {
    const low = fakeWorld(), tokens = { high: low.token(200) };
    low.panel.card = true; // 핵심을 재 잠긴 바닥 시트 — 다시 판정이 지워 주지 않는다
    useMountedEffect(low, tokens, 'high');
    flushFrame();
    low.bar.bottom = 278; ro(); flushFrame();
    expect(low.panel.dataset.dock).toBeUndefined();
    expect(low.panel.style.getPropertyValue('--reader-sheet-top')).toBe(''); // 바닥 시트에는 위 끝을 걸지 않는다
    resizeCallbacks.forEach(o => { o.on = false; });
    window.visualViewport.offsetTop = 200; window.visualViewport.height = 640; // 키보드 — 보이는 영역 200–840
    const kb = fakeWorld(), more = { a: kb.token(680) };
    useMountedEffect(kb, more, 'a');
    flushFrame();
    expect(kb.panel.style.getPropertyValue('--reader-sheet-top')).toBe('208px');
    kb.bar.bottom = 190; ro();
    expect(kb.panel.style.getPropertyValue('--reader-sheet-top')).toBe('208px'); // max(머리줄 190, 보이는 위 끝 200) + 8
    kb.bar.bottom = 240; ro();
    expect(kb.panel.style.getPropertyValue('--reader-sheet-top')).toBe('248px'); // 머리줄이 보이는 위 끝을 넘으면 머리줄
  });
  it('배선 — 판정과 다시 맞추기가 같은 위 끝 식(sheetTopLimit)을 쓴다', async () => {
    const fs = await import('node:fs'), path = await import('node:path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/useReaderLayout.js'), 'utf8');
    expect(src).toContain('topLimit: sheetTopLimit(layout, viewTop), naturalHeight: natural.height');
    expect(src).toContain('new ResizeObserver(() => { holdSheet(); retopPagedSheet(panel, layout); reveal(); })');
  });
});
