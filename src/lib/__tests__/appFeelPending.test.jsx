// 앱 손맛 ③(APP-FEEL-003, 2026-10-17 KST) — 이동 대기 표시 · 이동 뒤 포커스 · 눌림 상태.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween.js';
import { focusPageIfLost } from '../routeFocus';

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
    expect(read('src/lib/webNavigation.js')).toMatch(/\{ href: '\/home', label: '배움', icon: 'learn', prefetch: false, intentPrefetch: true \}/);
  });

  it('CSS: 100ms 안의 이동엔 안 보이고(delay), 동작 줄이기면 깜빡이지 않고 멈춘 밑줄', () => {
    const css = sliceBetween(read('src/components/web/web-shell.css'), '/* ========= 앱 손맛 ③', '/* 눌림 —');
    expect(css).toContain('.nav-pending{position:absolute;left:14px;right:14px;bottom:4px;height:2px;border-radius:1px;background:currentColor;opacity:0;pointer-events:none}');
    expect(css).toContain('.lv-tabs a>.nav-pending{left:0;right:0;bottom:0}');
    expect(css).toContain('.nav-pending[data-pending]{animation:nav-pending 1.1s ease-in-out 100ms infinite}');
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.nav-pending[data-pending]{animation:nav-pending-still 1ms 100ms forwards}}');
  });
});

describe('대기 밑줄 자리 = 지금 탭 밑줄 자리(두 번째 줄로 보이지 않게)', () => {
  it('GNB 지금 탭 밑줄의 좌우 · 아래 · 두께와 같고, 목록 종류 탭은 그 탭 밑줄(맨 아래 전폭) 자리', () => {
    const shell = read('src/components/web/web-shell.css');
    const geometry = (rule) => ['left', 'right', 'bottom', 'height'].map((k) => rule.match(new RegExp(`(?:^|[;{])${k}:([^;}]+)`))?.[1]);
    const active = sliceBetween(shell, '.gnb__link--text[aria-current="page"]::after{', '}');
    const pending = sliceBetween(shell, '.nav-pending{position:absolute;', '}');
    expect(geometry(pending)).toEqual(geometry(active));
    expect(geometry(active)).toEqual(['14px', '14px', '4px', '2px']);
    expect(read('src/components/levels/level-list.css')).toContain('.lv-tabs a[aria-current=page]{color:var(--ink);font-weight:700;box-shadow:inset 0 -2px 0 var(--ink)}');
  });
});

describe('이동 뒤 포커스 — 잃었을 때만 새 화면의 첫 제목(없으면 본문)으로', () => {
  /** 제목 대역 — 초점을 받으면 activeElement가 된다(focusable=false면 받지 못한다). */
  const heading = (d, { hidden = false, tabindex = null, focusable = true } = {}) => {
    const attrs = new Map(tabindex === null ? [] : [['tabindex', tabindex]]);
    const h = {
      hidden, attrs,
      closest: (sel) => (hidden && sel === '[aria-hidden="true"]' ? {} : null),
      hasAttribute: (k) => attrs.has(k), setAttribute: vi.fn((k, v) => attrs.set(k, v)),
      focus: vi.fn(() => { if (focusable) d.activeElement = h; }),
    };
    return h;
  };
  const doc = (active, { connected = true, headings = [] } = {}) => {
    const d = { body: {} };
    const main = { focus: vi.fn(() => { d.activeElement = main; }), querySelectorAll: (sel) => (sel === 'h1' ? d.headings : []) };
    d.main = main;
    d.activeElement = active === 'body' ? d.body : active ? { isConnected: connected } : null;
    d.getElementById = (id) => (id === 'main-content' ? main : null);
    d.headings = headings.map((o) => heading(d, o));
    return d;
  };
  it('body · 사라진 요소 · 없음이면 첫 제목으로 — tabindex가 없을 때만 -1을 붙이고 스크롤 없이', () => {
    for (const d of [doc('body', { headings: [{}] }), doc('el', { connected: false, headings: [{}] }), doc(null, { headings: [{}] })]) {
      expect(focusPageIfLost(d)).toBe('heading');
      const [h] = d.headings;
      expect(h.setAttribute).toHaveBeenCalledWith('tabindex', '-1');
      expect(h.focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(d.main.focus).not.toHaveBeenCalled();
    }
    const own = doc('body', { headings: [{ tabindex: '0' }] });
    expect(focusPageIfLost(own)).toBe('heading');
    expect(own.headings[0].setAttribute).not.toHaveBeenCalled(); // 이미 초점을 받는 제목은 건드리지 않는다
  });
  it('대기 화면(aria-hidden) 제목은 건너뛰고 다음 제목, 제목이 없거나 초점을 못 받으면 #main-content', () => {
    const skip = doc('body', { headings: [{ hidden: true }, {}] });
    expect(focusPageIfLost(skip)).toBe('heading');
    expect(skip.headings[0].focus).not.toHaveBeenCalled();
    expect(skip.headings[1].focus).toHaveBeenCalled();
    for (const d of [doc('body'), doc('body', { headings: [{ hidden: true }] }), doc('body', { headings: [{ focusable: false }] })]) {
      expect(focusPageIfLost(d)).toBe('main');
      expect(d.main.focus).toHaveBeenCalledWith({ preventScroll: true });
    }
  });
  it('살아 있는 포커스(누른 GNB 탭 등)는 빼앗지 않는다', () => {
    const d = doc('el', { headings: [{}] });
    expect(focusPageIfLost(d)).toBeNull();
    expect(d.headings[0].focus).not.toHaveBeenCalled();
    expect(d.main.focus).not.toHaveBeenCalled();
  });
  it('Layout 배선 — 첫 마운트 · 같은 pathname(해시만 바뀜)은 건너뛰고, 다음 프레임에 판정', () => {
    const effect = sliceBetween(read('src/components/Layout.jsx'), 'const lastPathname = useRef(null);', '}, [pathname]);');
    expect(effect).toContain('if (lastPathname.current === null || lastPathname.current === pathname) { lastPathname.current = pathname; return undefined; }');
    expect(effect).toContain('const frame = requestAnimationFrame(() => focusPageIfLost(document));');
    expect(effect).toContain('return () => cancelAnimationFrame(frame);');
    expect(read('src/components/Layout.jsx')).toContain('<main className="app-layout" role="main" id="main-content" tabIndex={-1}>');

    // 본문 전체가 초점을 받으므로 둘레 테두리는 그리지 않는다(키보드 이동 때 화면 전체 테두리 방지).
    expect(read('src/components/web/web-shell.css')).toContain('#main-content:focus{outline:none}');
    expect(read('src/components/web/web-shell.css')).toContain('#main-content h1[tabindex="-1"]:focus{outline:none}');
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
