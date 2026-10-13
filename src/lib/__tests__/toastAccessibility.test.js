import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from './helpers/sliceBetween';

// WALL-STATES-001 항목 7(화면 벽 상태 재고 2026-10-13): 토스트가 모두 role=alert라 성공 알림도 화면 낭독기를 끊었고,
// 닫기 버튼·개수 상한이 없었으며, 액션 버튼은 호출부가 pointerEvents:'auto'를 넘겨야만 눌렸다.
// DOM 환경 없이 리포 관례(훅 대역 — AuthProfileReadOnly.test.jsx)로 ToastProvider를 직접 렌더해 트리를 본다.
const h = vi.hoisted(() => ({ slots: [], index: 0 }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useState(initial) {
      const i = h.index++;
      if (!(i in h.slots)) h.slots[i] = initial;
      return [h.slots[i], (value) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; }];
    },
    useRef(initial) { const i = h.index++; if (!(i in h.slots)) h.slots[i] = { current: initial }; return h.slots[i]; },
    useCallback(fn) { h.index++; return fn; },
    useEffect() { h.index++; },
  };
});

const { ToastProvider, TOAST_STACK_LIMIT, toastRole } = await import('../ToastContext');

function render() {
  h.index = 0;
  const tree = ToastProvider({ children: null });
  const container = tree.props.children[1];
  const toasts = (container.props.children || []).map((el) => {
    const [body, close] = el.props.children;
    const message = body.props.children[1].props.children;
    return { className: el.props.className, role: body.props.role, message, close };
  });
  return { toast: tree.props.value, container, toasts };
}

describe('WALL-STATES-001 ⑦ 토스트 접근성', () => {
  beforeEach(() => { h.slots = []; vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('실패(error)·막힘(warning)만 alert, 성공·안내·축하는 status', () => {
    const { toast } = render();
    toast('저장했어요', 'success');
    toast('삭제 실패 — 문제가 발생했어요. 잠시 후 다시 시도해 주세요.', 'error');
    toast('로그인이 필요합니다.', 'warning');
    const roles = render().toasts.map((t) => [t.message, t.role]);
    expect(roles).toEqual([
      ['저장했어요', 'status'],
      ['삭제 실패 — 문제가 발생했어요. 잠시 후 다시 시도해 주세요.', 'alert'],
      ['로그인이 필요합니다.', 'alert'],
    ]);
    expect(['info', 'celebrate', undefined].map(toastRole)).toEqual(['status', 'status', 'status']);
    // 컨테이너는 계속 polite 라이브 영역이다(처음부터 DOM에 있어야 성공 알림이 낭독된다).
    expect(render().container.props['aria-live']).toBe('polite');
  });

  it(`한 번에 ${TOAST_STACK_LIMIT}개까지 — 넘치면 가장 오래된 것부터 내린다`, () => {
    const { toast } = render();
    for (const n of [1, 2, 3, 4, 5]) toast(`알림 ${n}`, 'info');
    expect(TOAST_STACK_LIMIT).toBe(3);
    expect(render().toasts.map((t) => t.message)).toEqual(['알림 3', '알림 4', '알림 5']);
  });

  it('닫기 버튼(이름 「알림 닫기」)이 그 토스트만 내리고, 시간이 지나면 저절로 내려간다', () => {
    const { toast } = render();
    toast('첫째', 'success', 8000);
    toast('둘째', 'error');
    const first = render().toasts[0];
    expect(first.close.type).toBe('button');
    expect(first.close.props.type).toBe('button');
    expect(first.close.props['aria-label']).toBe('알림 닫기');
    first.close.props.onClick();
    expect(render().toasts.map((t) => t.message)).toEqual(['둘째']);
    vi.advanceTimersByTime(4000);
    expect(render().toasts).toEqual([]);
  });

  it('토스트 안의 버튼은 호출부 인라인 없이 눌리고, 닫기 버튼은 44px 터치 타깃이다', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const block = sliceBetween(css, '/* ========= Toast Notifications ========= */', '/* ========= 오늘의 추천 자료 ========= */');
    // 컨테이너는 아래 화면을 막지 않고(none), 토스트 자체는 눌린다(auto).
    expect(block).toMatch(/\.toast-container\s*\{[^}]*pointer-events:\s*none/);
    expect(block).toMatch(/\.toast\s*\{\s*pointer-events:\s*auto;\s*\}/);
    const close = block.match(/\.toast__close\s*\{([^}]*)\}/)?.[1] || '';
    expect(close).toMatch(/min-width:\s*44px/);
    expect(close).toMatch(/min-height:\s*44px/);
  });

  it('종류별 바탕은 불투명 --bg-elevated 위에 얹는다 — 밝은 셸 밖에서도 글자가 비쳐 흐려지지 않는다(M09 실측)', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const block = sliceBetween(css, '/* ========= Toast Notifications ========= */', '/* ========= 오늘의 추천 자료 ========= */');
    for (const kind of ['success', 'error', 'warning', 'info', 'celebrate']) {
      const rule = block.match(new RegExp(`\\.toast--${kind}\\s*\\{([^}]*)\\}`))?.[1] || '';
      const background = rule.match(/background:\s*([^;]*);/)?.[1] || '';
      expect(background, `toast--${kind}`).toContain('var(--bg-elevated)');
    }
  });
});
