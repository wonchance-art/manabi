/* eslint-disable react-hooks/rules-of-hooks -- 훅을 아래 작은 런타임에서 평범한 함수로 직접 부르는 시험이다. */
// 낱말 탭 = 상태 갱신 0(VIEWER-TAP-INP-001). 범위 지정 훅은 뷰어(ViewerPage)의 훅이라 상태를 한 번 바꾸면 뷰어 전체가
// 다시 그려진다. 예전에는 톡 누를 때마다 pointerup → onCancel('tap') → setDragging(false)가 이미 false여도 불려
// 낱말 탭마다 버려지는 뷰어 렌더가 한 번 더 돌았다(e2e 빌드 · 390 · CPU×4 실측 pointerup 18~30ms → 2ms).
// DOM 시험 환경이 없어 React 훅을 아주 작은 런타임으로 돌리고(useOneRender = 렌더 한 번 + 효과), 문서 수준 포인터 리스너를 실제로 부른다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rt = vi.hoisted(() => {
  const state = { slots: [], i: 0, effects: [], sets: [] };
  const same = (a, b) => !!a && !!b && a.length === b.length && a.every((v, k) => Object.is(v, b[k]));
  return {
    state,
    react: {
      useState(init) {
        const k = state.i++;
        if (!(k in state.slots)) state.slots[k] = { v: typeof init === 'function' ? init() : init };
        const slot = state.slots[k];
        slot.set ||= (next) => { state.sets.push({ slot: k, next }); slot.v = typeof next === 'function' ? next(slot.v) : next; };
        return [slot.v, slot.set];
      },
      useRef(init) { const k = state.i++; if (!(k in state.slots)) state.slots[k] = { current: init }; return state.slots[k]; },
      useMemo(fn, deps) { const k = state.i++; const s = state.slots[k]; if (s && same(s.deps, deps)) return s.v; state.slots[k] = { v: fn(), deps }; return state.slots[k].v; },
      useCallback(fn, deps) { const k = state.i++; const s = state.slots[k]; if (s && same(s.deps, deps)) return s.v; state.slots[k] = { v: fn, deps }; return fn; },
      useEffect(fn, deps) { const k = state.i++; const s = state.slots[k]; if (s && deps && same(s.deps, deps)) return; state.slots[k] = { deps }; state.effects.push(() => { s?.cleanup?.(); state.slots[k].cleanup = fn(); }); },
    },
  };
});
vi.mock('react', () => ({ ...rt.react, default: rt.react }));

const { useTokenRangeSelect } = await import('../useTokenRangeSelect.js');

const sequence = ['id_0_0', 'id_0_1', 'id_0_2'];
const dictionary = { id_0_0: { text: '毎朝' }, id_0_1: { text: '駅' }, id_0_2: { text: 'まで' } };
function useOneRender(props = {}) {
  rt.state.i = 0;
  const out = useTokenRangeSelect({ sequence, dictionary, enabled: true, onSelect: () => {}, ...props });
  const effects = rt.state.effects.splice(0); effects.forEach((run) => run());
  return out;
}
// 처음 붙을 때의 정리(자료가 바뀌면 지정 해제 효과)는 탭과 무관하다 — 붙인 뒤부터 센다.
function mount(props) { const hook = useOneRender(props); rt.state.sets = []; return hook; }
const tokenTarget = (tid) => ({ closest: (sel) => (sel === '[data-tid]' ? { dataset: { tid } } : null) });
const pointer = (type, extra = {}) => Object.assign(new Event(type), { pointerId: 7, pointerType: 'touch', button: 0, clientX: 10, clientY: 10, ...extra });

beforeEach(() => {
  rt.state.slots = []; rt.state.effects = []; rt.state.sets = [];
  const doc = new EventTarget();
  doc.elementFromPoint = () => ({ closest: () => ({ dataset: { tid: 'id_0_2' } }) });
  globalThis.document = doc;
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
  globalThis.navigator ??= {};
});
afterEach(() => { vi.useRealTimers(); delete globalThis.document; });

describe('낱말 탭 — 범위 지정 훅이 상태를 건드리지 않는다', () => {
  it('누르고 바로 떼면(onCancel tap) 상태 갱신이 한 번도 없다 — 뷰어를 다시 그리지 않는다', () => {
    const hook = mount();
    hook.handlePointerDown({ ...pointer('pointerdown'), target: tokenTarget('id_0_1') });
    document.dispatchEvent(pointer('pointerup'));
    expect(rt.state.sets).toEqual([]);
    expect(useOneRender().dragging).toBe(false);
  });

  it('길게 눌러 끌면 표식이 켜지고, 떼면 꺼진다(바뀔 때만 한 번씩)', () => {
    vi.useFakeTimers();
    const hook = mount();
    hook.handlePointerDown({ ...pointer('pointerdown'), target: tokenTarget('id_0_0') });
    vi.advanceTimersByTime(301);
    expect(useOneRender().dragging).toBe(true);
    document.dispatchEvent(pointer('pointermove', { clientX: 60 }));
    document.dispatchEvent(pointer('pointerup'));
    const after = useOneRender();
    expect(after.dragging).toBe(false);
    expect(after.range).toEqual({ start: 0, end: 2 });
    const dragSlot = rt.state.sets.find((s) => s.next === true).slot;
    expect(rt.state.sets.filter((s) => s.slot === dragSlot).map((s) => s.next)).toEqual([true, false]);
  });

  it('스크롤로 넘어간 터치(pointercancel)도 상태를 건드리지 않는다', () => {
    const hook = mount();
    hook.handlePointerDown({ ...pointer('pointerdown'), target: tokenTarget('id_0_1') });
    document.dispatchEvent(pointer('pointercancel'));
    expect(rt.state.sets).toEqual([]);
  });
});
