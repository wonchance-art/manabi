// 앱 손맛 ③(APP-FEEL-003, 2026-10-17 KST) — 이동 대기 표시 · 이동 뒤 포커스 · 눌림 상태.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween.js';
import { focusMainIfLost } from '../routeFocus';

const h = vi.hoisted(() => ({ pending: false }));
vi.mock('next/link', async (importOriginal) => ({ ...(await importOriginal()), useLinkStatus: () => ({ pending: h.pending }) }));
const { default: NavPendingMark } = await import('../../components/NavPendingMark');
const read = (f) => fs.readFileSync(f, 'utf8');

describe('이동 대기 표시(NavPendingMark = useLinkStatus)', () => {
  it('평소엔 빈 표시(화면 읽기에 숨김), 이동 중이면 data-pending', () => {
    h.pending = false;
    expect(renderToStaticMarkup(<NavPendingMark />)).toBe('<span class="nav-pending" aria-hidden="true"></span>');
    h.pending = true;
    expect(renderToStaticMarkup(<NavPendingMark />)).toBe('<span class="nav-pending" data-pending="true" aria-hidden="true"></span>');
    h.pending = false;
  });

  it('GNB · 휴대폰 탭 막대 · 읽기 화면 메뉴 · 단어 목록 레벨 알약 · 목록 종류 탭의 Link 안에 있다', () => {
    const layout = read('src/components/Layout.jsx');
    expect(sliceBetween(layout, '<nav className="gnb__nav"', '</nav>')).toMatch(/\{l\.label\}\s*<NavPendingMark \/>\s*<\/Link>/);
    expect(sliceBetween(layout, '<nav className="mobile-nav"', '</nav>')).toMatch(/<span>\{l\.label\}<\/span>\s*<NavPendingMark \/>\s*<\/Link>/);
    expect(sliceBetween(layout, '<nav aria-label="읽기 화면 내비게이션"', '</nav>')).toContain('{item.label}<NavPendingMark /></Link>');
    const list = read('src/views/LevelListPage.jsx');
    expect(sliceBetween(list, '<nav className="lv-pills"', '</nav>')).toContain('{levelPill(key)}<NavPendingMark /></Link>');
    expect(sliceBetween(list, '<nav className="lv-tabs"', '</nav>')).toContain('{LEVEL_KIND_LABEL[k]}<NavPendingMark /></Link>');
    // prefetch 판단(performanceRepairs P5)은 그대로 — 대기 표시가 prefetch를 대신한다.
    expect(read('src/lib/webNavigation.js')).toMatch(/\{ href: '\/home', label: '배움', icon: 'learn', prefetch: false \}/);
  });

  it('CSS: 100ms 안의 이동엔 안 보이고(delay), 동작 줄이기면 깜빡이지 않고 멈춘 밑줄', () => {
    const css = sliceBetween(read('src/components/web/web-shell.css'), '/* ========= 앱 손맛 ③', '/* 눌림 —');
    expect(css).toContain('.nav-pending{position:absolute;left:0;right:0;bottom:0;height:2px;border-radius:1px;background:currentColor;opacity:0;pointer-events:none}');
    expect(css).toContain('.nav-pending[data-pending]{animation:nav-pending 1.1s ease-in-out 100ms infinite}');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.nav-pending[data-pending]{animation:nav-pending-still 1ms 100ms forwards}}');
  });
});

describe('이동 뒤 포커스 — 잃었을 때만 본문으로', () => {
  const doc = (active, { connected = true } = {}) => {
    const body = {}, main = { focus: vi.fn() };
    const el = active === 'body' ? body : active ? { isConnected: connected } : null;
    return { body, main, activeElement: el, getElementById: (id) => (id === 'main-content' ? main : null) };
  };
  it('body · 사라진 요소 · 없음이면 #main-content로(스크롤 없이)', () => {
    for (const d of [doc('body'), doc('el', { connected: false }), doc(null)]) {
      expect(focusMainIfLost(d)).toBe(true);
      expect(d.main.focus).toHaveBeenCalledWith({ preventScroll: true });
    }
  });
  it('살아 있는 포커스(누른 GNB 탭 등)는 빼앗지 않는다', () => {
    const d = doc('el');
    expect(focusMainIfLost(d)).toBe(false);
    expect(d.main.focus).not.toHaveBeenCalled();
  });
  it('Layout 배선 — 첫 마운트 · 같은 pathname(해시만 바뀜)은 건너뛰고, 다음 프레임에 판정', () => {
    const effect = sliceBetween(read('src/components/Layout.jsx'), 'const lastPathname = useRef(null);', '}, [pathname]);');
    expect(effect).toContain('if (lastPathname.current === null || lastPathname.current === pathname) { lastPathname.current = pathname; return undefined; }');
    expect(effect).toContain('const frame = requestAnimationFrame(() => focusMainIfLost(document));');
    expect(effect).toContain('return () => cancelAnimationFrame(frame);');
    expect(read('src/components/Layout.jsx')).toContain('<main className="app-layout" role="main" id="main-content" tabIndex={-1}>');

    // 본문 전체가 초점을 받으므로 둘레 테두리는 그리지 않는다(키보드 이동 때 화면 전체 테두리 방지).
    expect(read('src/components/web/web-shell.css')).toContain('#main-content:focus{outline:none}');
  });
});

describe('눌림 상태 — 카드 · 탭이 누르는 순간 반응한다', () => {
  const css = sliceBetween(read('src/components/web/web-shell.css'), '/* 눌림 —', null); // 파일 끝 블록
  it('일곱 곳에 :active 눌림(크기 · 밝기), 안쪽 버튼을 누를 땐 카드가 따라 눌리지 않는다', () => {
    for (const sel of ['a.learn-tile', '.next-lesson-card', '.lv-view button', '.lv-chips a', '.manabi-toc-group li > a']) expect(css, sel).toContain(sel);
    expect(css).toContain('.manabi-app .lv-entry--solo:active:not(:has(button:active))');
    expect(css).toContain('.manabi-app .suggestion-card:has(:is(a, button):active){transform:scale(.985);filter:brightness(.97)}');
  });
  it('호버가 없던 목차 · 칩 · 펼침 카드는 마우스 화면에서만 호버, 색은 토큰으로', () => {
    const hover = sliceBetween(css, '@media (hover:hover){', '}\n@media (prefers-reduced-motion:reduce)');
    expect(hover).toContain('.manabi-toc-group li > a:hover{background:color-mix(in srgb,var(--ink) 4%,transparent)}');
    expect(hover).toContain('.lv-chips a:hover{background:var(--lv-chip-hover)}');
    expect(hover).toMatch(/\.lv-entry--solo:hover\{border-color:color-mix\(in srgb,var\(--ink\) 18%,var\(--lv-line\)\)\}/);
    expect(hover).not.toMatch(/#[0-9a-f]{3,6}\b|rgba?\(/i);
  });
  it('동작 줄이기면 눌림의 크기 변화를 뺀다', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^@]*\.lv-entry--solo:active:not\(:has\(button:active\)\)[^@]*\{transform:none\}/);
  });
});
