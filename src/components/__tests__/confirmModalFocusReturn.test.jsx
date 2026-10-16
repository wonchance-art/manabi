import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 렌더 테스트(훅 대역 — toastAccessibility.test.js 관례, DOM 환경 없음): 확인창이 닫히면 연 자리로 포커스를 돌려준다.
// 선례 ViewerModal.jsx:11 · LibraryCollections.jsx:10 — 연결이 살아 있고(isConnected) 포커스가 body로 떨어졌을 때만, 스크롤 없이.
const h = vi.hoisted(() => ({ effects: [] }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useRef(initial) { return { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(fn) { h.effects.push(fn); },
  };
});
const { default: ConfirmModal } = await import('../ConfirmModal');

function setup({ connected = true } = {}) {
  const body = { id: 'body' };
  const opener = { isConnected: connected, focus: vi.fn() };
  const doc = { body, activeElement: opener, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const frames = [];
  vi.stubGlobal('document', doc);
  vi.stubGlobal('requestAnimationFrame', (cb) => { frames.push(cb); return frames.length; });
  h.effects = [];
  const tree = ConfirmModal({ open: true, title: '자료를 휴지통으로 옮길까요?', confirmLabel: '휴지통으로', onConfirm() {}, onCancel() {} });
  const cleanup = h.effects.map((fn) => fn()).find((fn) => typeof fn === 'function');
  return { tree, doc, body, opener, frames, cleanup };
}

describe('ConfirmModal — 닫히면 연 자리로 포커스', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('열 때 포커스가 있던 요소를 기억했다가, 닫힌 뒤 다음 프레임에 스크롤 없이 돌려준다', () => {
    const { tree, doc, body, opener, frames, cleanup } = setup();
    expect(tree.props.role).toBe('dialog');
    doc.activeElement = { id: 'cancel-button' }; // 열린 동안은 「취소」에 있다
    cleanup();
    doc.activeElement = body; // 확인창이 사라지면 포커스는 body로 떨어진다
    expect(opener.focus).not.toHaveBeenCalled(); // 같은 프레임에서는 아직
    frames.forEach((cb) => cb());
    expect(opener.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(doc.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('연 요소가 화면에서 사라졌으면 돌려주지 않는다', () => {
    const { doc, body, opener, frames, cleanup } = setup({ connected: false });
    cleanup(); doc.activeElement = body; frames.forEach((cb) => cb());
    expect(opener.focus).not.toHaveBeenCalled();
  });

  it('닫는 동작이 포커스를 다른 곳으로 옮겼으면 빼앗지 않는다', () => {
    const { doc, opener, frames, cleanup } = setup();
    cleanup(); doc.activeElement = { id: 'next-field' }; frames.forEach((cb) => cb());
    expect(opener.focus).not.toHaveBeenCalled();
  });

  it('닫혀 있으면 아무것도 걸지 않는다', () => {
    h.effects = [];
    vi.stubGlobal('document', { activeElement: null, addEventListener: vi.fn() });
    expect(ConfirmModal({ open: false, confirmLabel: '삭제' })).toBeNull();
    expect(h.effects.map((fn) => fn())).toEqual([undefined]);
  });
});
