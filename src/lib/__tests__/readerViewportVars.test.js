import { describe, expect, it } from 'vitest';
import { applyReaderViewportVars } from '../useReaderLayout.js';

// VIEWER-LAYOUT-VARS-001 — 보이는 높이 · 키보드 여백은 .viewer-layout에서 상속되는 사용자 속성이라, 쓸 때마다 본문 낱말 전부의
// 스타일을 다시 계산한다(단어 3,000 · CPU×4: 본문이 그려진 직후 한 번 0.14~0.23초). 키보드 전에는 쓰지 않고, 같은 값은 다시 쓰지 않는다.
function fakeRoot() {
  const props = new Map(), writes = [];
  return { writes, dataset: {}, style: {
    getPropertyValue: name => props.get(name) || '',
    setProperty: (name, value) => { writes.push([name, value]); props.set(name, value); },
  } };
}
const view = (height, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale });

describe('VIEWER-LAYOUT-VARS-001 — 보이는 높이 사용자 속성은 필요할 때만 쓴다', () => {
  it('키보드가 한 번도 열리지 않았으면 쓰지 않는다(CSS 기본값 100dvh · 0px와 같다) — 열림 표시만 false', () => {
    const root = fakeRoot();
    applyReaderViewportVars(root, view(844), 844);
    applyReaderViewportVars(root, view(780), 844); // 주소 막대 등 키보드 아닌 변화(여백 64 ≤ 100)
    expect(root.writes).toEqual([]);
    expect(root.dataset.keyboardOpen).toBe('false');
  });

  it('키보드가 열리면 쓰고, 같은 값은 다시 쓰지 않으며, 닫힌 뒤에도 지금 값을 따른다', () => {
    const root = fakeRoot();
    applyReaderViewportVars(root, view(500), 844);
    expect(root.dataset.keyboardOpen).toBe('true');
    expect(root.writes).toEqual([['--reader-visual-height', '500px'], ['--reader-keyboard-inset', '344px']]);
    applyReaderViewportVars(root, view(500), 844);
    expect(root.writes).toHaveLength(2);
    applyReaderViewportVars(root, view(844), 844);
    expect(root.dataset.keyboardOpen).toBe('false');
    expect(root.writes.slice(2)).toEqual([['--reader-visual-height', '844px'], ['--reader-keyboard-inset', '0px']]);
  });

  it('확대(scale ≠ 1) 중에는 아무것도 바꾸지 않는다', () => {
    const root = fakeRoot();
    applyReaderViewportVars(root, view(400, 0, 2), 844);
    expect(root.writes).toEqual([]);
    expect(root.dataset.keyboardOpen).toBeUndefined();
  });
});
