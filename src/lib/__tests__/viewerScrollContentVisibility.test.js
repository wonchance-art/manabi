import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealInReader, withFullReader } from '../usePagedReader.js';
import { sliceBetween } from './helpers/sliceBetween';

// VIEWER-CV-SCROLL-001 — 스크롤 보기는 화면 밖 줄의 배치 · 그리기를 건너뛴다(낱말 3,600개 글 390 · CPU×4: 배치 약 3 s → 0.55 s 실측).
// 그 대신 ① 줄 상자 그리기 경계에 후리가나가 잘리지 않게 위아래를 넓히고 같은 만큼 당기며 ② 멀리 뛸 때만 본문 전부를 그린다.
const css = fs.readFileSync('src/index.css', 'utf8');
const SCOPE = '.viewer-layout[data-reader-view="scroll"]:not([data-class-study="true"]) .reader-area > .reader-line';

function fakeArea() {
  const area = { dataset: {} };
  return { area, target: { closest: sel => (sel === '.reader-area' ? area : null), scrollIntoView: vi.fn() } };
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('VIEWER-CV-SCROLL-001 — 스크롤 보기 화면 밖 줄 생략', () => {
  it('스크롤 보기 · 수업 아님에서만, 어림 높이는 기억(auto), 넓힌 자리는 같은 만큼 당기고 누름은 통과', () => {
    const rule = sliceBetween(css, `${SCOPE} {`, '}');
    expect(rule).toContain('content-visibility: auto;');
    expect(rule).toContain('contain-intrinsic-size: auto 8em;');
    expect(rule).toContain('padding-block: 2em .75em;');
    expect(rule).toContain('margin-block: -2em -.75em;');
    expect(rule).toContain('pointer-events: none;');
    expect(css).toContain(`${SCOPE} > * { pointer-events: auto; }`);
    // 쪽 넘김(다단)에는 걸지 않는다 — 어림 높이가 쪽 수를 바꾼다(99 → 37쪽 실측).
    expect(css).not.toMatch(/data-reader-view="paged"[^{]*\.reader-line\s*\{[^}]*content-visibility/);
  });

  it('멀리 뛰는 동안(본문 전부 · 글자 크기 바꿈 · 선택 따라가기)에는 전부 그린다', () => {
    expect(css).toContain('.viewer-layout[data-reader-view="scroll"] .reader-area:is([data-reader-full], [data-layout-restoring], [data-selection-revealing]) > .reader-line {\n  content-visibility: visible;');
  });

  it('withFullReader — 그 순간만 data-reader-full, 두 프레임 뒤 푼다 · 겹치면 마지막이 끝날 때', () => {
    const frames = [];
    vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
    const { area, target } = fakeArea();
    let seen = null;
    withFullReader(target, () => { seen = area.dataset.readerFull; });
    expect(seen).toBe('true');
    const tick = () => frames.splice(0).forEach(fn => fn()); // 한 프레임 — 지금 줄 선 것만
    tick();
    expect(area.dataset.readerFull).toBe('true'); // 한 프레임 뒤에는 아직
    withFullReader(target, () => {}); // 겹쳐 부름
    tick();
    expect(area.dataset.readerFull).toBe('true'); // 첫 호출은 풀렸지만 두 번째가 남았다
    tick(); tick();
    expect(area.dataset.readerFull).toBeUndefined();
  });

  it('스크롤 보기의 대상 보이기(본문 귀환 · 읽던 곳)는 전부 그린 채 scrollIntoView — 쪽 넘김이면 그 쪽으로(그대로)', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    const { area, target } = fakeArea();
    target.scrollIntoView.mockImplementation(() => { expect(area.dataset.readerFull).toBe('true'); });
    expect(revealInReader(target, { block: 'center' })).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    const restore = fs.readFileSync('src/lib/useScrollRestore.js', 'utf8');
    expect(restore).toContain("else withFullReader(el, () => el.scrollIntoView({ behavior: 'instant', block: 'center' }));");
  });
});
