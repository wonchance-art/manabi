import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 쪽 넘김 A안 리뷰 후속(2026-10-17 KST): useSelectedTokenVisibility의 시트 자리 수명.
// React 없이 effect를 직접 돌린다 — useEffect는 콜백을 받아 두고, 시험이 커밋 순서(정리 → 새 효과)를 흉내 낸다.
// ⑴ 아래 단어 → 다른 아래 단어: 시트가 위→바닥→위로 튀지 않는다(정리가 자리를 바로 지우지 않고, 새 판정은 첫 프레임).
// ⑵ 닫으면 다음 프레임에 자리가 지워진다. ⑶ 시트가 뒤 커밋에 붙어도 붙는 순간 다시 정한다(목업 C 낮추기 포함).
// ⑷ 판정 좌표는 visualViewport(offsetTop · height)와 같은 계 — 키보드가 열린 보이는 영역의 가운데 · 위 끝을 쓴다.
const effects = [];
vi.mock('react', () => ({ useEffect: fn => { effects.push(fn); }, useRef: () => ({}), useState: v => [v, () => {}], useCallback: fn => fn }));
const pager = { reveal: vi.fn() };
vi.mock('../usePagedReader', () => ({ pagerFor: () => pager }));

const { useSelectedTokenVisibility } = await import('../useReaderLayout');
const { pagedSheetDock } = await import('../readingViewport');

let queue = [], nextId = 1, mutationCallbacks = [], resizeCallbacks = [];
function flushFrame() { const run = queue; queue = []; for (const { fn } of run) fn(); }
function fakeStyle() {
  const props = new Map();
  return { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k), getPropertyValue: k => props.get(k) ?? '', props };
}
function fakeWorld({ withPanel = true } = {}) {
  const panel = {
    hidden: false, dataset: {}, style: fakeStyle(), classList: { contains: () => false },
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
  const topbar = { getBoundingClientRect: () => ({ top: 68, bottom: 126 }) };
  const children = { panel: withPanel ? panel : null };
  const layout = { querySelector: sel => (sel === '.viewer-inspector' ? children.panel : sel === '.viewer-topbar' ? topbar : null) };
  const root = { dataset: {}, closest: () => layout };
  const token = (top) => ({ isConnected: true, contains: () => false, getBoundingClientRect: () => ({ top, bottom: top + 56 }) });
  return { panel, layout, root, token, attach: () => { children.panel = panel; } };
}
function useMountedEffect(world, tokens, id, enabled = true) {
  const before = effects.length;
  useSelectedTokenVisibility({ current: world.root }, { current: tokens }, id, enabled, 0);
  return effects.slice(before)[0]();
}

beforeEach(() => {
  queue = []; mutationCallbacks = []; resizeCallbacks = []; effects.length = 0; pager.reveal.mockClear();
  vi.stubGlobal('requestAnimationFrame', fn => { const id = nextId++; queue.push({ id, fn }); return id; });
  vi.stubGlobal('cancelAnimationFrame', id => { queue = queue.filter(entry => entry.id !== id); });
  vi.stubGlobal('getComputedStyle', () => ({ position: 'fixed' }));
  vi.stubGlobal('ResizeObserver', class { constructor(cb) { this.cb = cb; this.on = true; resizeCallbacks.push(this); } observe() {} disconnect() { this.on = false; } });
  vi.stubGlobal('MutationObserver', class { constructor(cb) { this.cb = cb; mutationCallbacks.push(this); } observe() { this.on = true; } disconnect() { this.on = false; } });
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
    const world = fakeWorld(), tokens = { a: world.token(531) };
    world.panel.natural = 57;
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top' }); // 57px면 단어 위 자리(385)에 들어간다 — 원래 높이
    world.panel.natural = 440; world.panel.card = true; // 카드가 차서 440으로 커진다
    for (const observer of resizeCallbacks.filter(o => o.on)) observer.cb([]);
    flushFrame();
    expect(world.panel.dataset).toEqual({ dock: 'top', compact: 'true' });
    expect(world.panel.style.getPropertyValue('--reader-sheet-compact')).toBe('392px'); // max(핵심 392, 자리 385)
    const settled = { ...world.panel.dataset };
    for (const observer of resizeCallbacks.filter(o => o.on)) observer.cb([]); // 핵심을 잰 뒤에는 잠긴다(출렁임 없음)
    world.panel.card = false; flushFrame();
    expect(world.panel.dataset).toEqual(settled);
  });
  it('키보드가 열린 보이는 영역(offsetTop · height)으로 정한다 — 위 끝은 보이는 영역 아래', () => {
    window.visualViewport.offsetTop = 300; window.visualViewport.height = 400; // 보이는 영역 300–700, 가운데 500
    const world = fakeWorld(), tokens = { a: world.token(560) };
    useMountedEffect(world, tokens, 'a');
    flushFrame();
    expect(world.panel.dataset.dock).toBe('top');
    expect(world.panel.style.getPropertyValue('--reader-sheet-top')).toBe('308px'); // max(머리줄 126, 300) + 8
  });
});

describe('pagedSheetDock — visualViewport 좌표계', () => {
  const base = { viewportHeight: 400, topLimit: 308, naturalHeight: 440, min: 359 };
  it('가운데는 offsetTop + height/2', () => {
    expect(pagedSheetDock({ ...base, viewportTop: 300, tokenTop: 440, tokenBottom: 496 })).toEqual({ dock: 'bottom' }); // 468 ≤ 500
    expect(pagedSheetDock({ ...base, viewportTop: 300, tokenTop: 480, tokenBottom: 536 }).dock).toBe('top'); // 508 > 500
    expect(pagedSheetDock({ ...base, tokenTop: 440, tokenBottom: 496 }).dock).toBe('top'); // offsetTop 0이면 가운데 200
    expect(pagedSheetDock({ ...base, viewportTop: NaN, tokenTop: 480, tokenBottom: 536 })).toEqual({ dock: 'bottom' });
  });
});
