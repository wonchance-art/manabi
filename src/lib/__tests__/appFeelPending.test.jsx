// 앱 손맛 ③(APP-FEEL-003, 2026-10-17 KST) — 이동 대기 표시 · 이동 뒤 포커스 · 눌림 상태.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from './helpers/sliceBetween.js';
import { focusPageIfLost, HEADING_WATCH_MS, watchPageHeading } from '../routeFocus';

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
  // drawn=false = display:none(그린 상자 0개), visibility='hidden' = 감춤 style(BOOK-HASH-ENTRY-001 표지) 아래.
  const heading = (d, { hidden = false, tabindex = null, focusable = true, drawn = true, visibility = 'visible' } = {}) => {
    const attrs = new Map(tabindex === null ? [] : [['tabindex', tabindex]]);
    const h = {
      hidden, attrs, drawn, visibility,
      getClientRects: () => (h.drawn ? [{}] : []),
      closest: (sel) => (hidden && sel.includes('[aria-hidden="true"]') ? {} : null),
      hasAttribute: (k) => attrs.has(k), setAttribute: vi.fn((k, v) => attrs.set(k, v)),
      focus: vi.fn(() => { if (focusable) d.activeElement = h; }),
    };
    return h;
  };
  const doc = (active, { connected = true, headings = [] } = {}) => {
    const d = { body: {}, defaultView: { getComputedStyle: (el) => ({ visibility: el.visibility }) } };
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
    // 그려지지 않은(display:none) · 감춘(visibility:hidden) 제목도 건너뛴다 — 교재 hash 진입의 감춘 표지 h1.
    const invisible = doc('body', { headings: [{ drawn: false }, { visibility: 'hidden' }, {}] });
    expect(focusPageIfLost(invisible)).toBe('heading');
    expect(invisible.headings[0].focus).not.toHaveBeenCalled();
    expect(invisible.headings[1].focus).not.toHaveBeenCalled();
    expect(invisible.headings[2].focus).toHaveBeenCalled();
    for (const d of [doc('body'), doc('body', { headings: [{ hidden: true }] }), doc('body', { headings: [{ focusable: false }] }), doc('body', { headings: [{ drawn: false }, { visibility: 'hidden' }] })]) {
      expect(focusPageIfLost(d)).toBe('main');
      expect(d.main.focus).toHaveBeenCalledWith({ preventScroll: true });
    }
  });
  it('대기 화면이라 본문으로 보냈으면 실제 제목이 나타날 때 한 번 그리로 — 포커스가 본문에 있을 때만 · 2초 · 조작 · 다음 이동에 끝', () => {
    // MutationObserver · 이벤트 대역 — 변화를 손으로 흘린다.
    const harness = (d) => {
      const listeners = {}, observers = [];
      d.addEventListener = vi.fn((type, fn) => { listeners[type] = fn; });
      d.removeEventListener = vi.fn((type, fn) => { if (listeners[type] === fn) delete listeners[type]; });
      class Observer { constructor(cb) { this.cb = cb; this.on = false; observers.push(this); } observe(node, opts) { this.on = true; this.node = node; this.opts = opts; } disconnect() { this.on = false; } }
      const timers = [];
      const opts = { Observer, schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, cancel: vi.fn() };
      return { listeners, observers, timers, opts, mutate: () => observers.forEach((o) => o.on && o.cb([])) };
    };
    // ① 대기 화면(숨긴 제목만) → 본문 → 실제 제목 등장 → 그 제목으로, 지켜보기 끝
    const d = doc('body', { headings: [{ hidden: true }] });
    expect(focusPageIfLost(d)).toBe('main');
    const t = harness(d);
    watchPageHeading(d, t.opts);
    expect(t.observers[0].node).toBe(d.main);
    expect(t.observers[0].opts).toMatchObject({ childList: true, subtree: true });
    expect(t.timers[0].ms).toBe(HEADING_WATCH_MS);
    t.mutate(); // 아직 숨긴 제목뿐 — 그대로
    expect(d.activeElement).toBe(d.main);
    d.headings.push(heading(d, { visibility: 'hidden' })); // 감춘 제목 — 아직 아니다
    t.mutate();
    expect(d.activeElement).toBe(d.main);
    d.headings[1].visibility = 'visible'; // 실제 화면이 보였다
    t.mutate();
    expect(d.activeElement).toBe(d.headings[1]);
    expect(t.observers[0].on).toBe(true); // 옮긴 제목을 2초 창 끝까지 계속 지킨다
    t.timers[0].fn();
    expect(t.observers[0].on).toBe(false);
    expect(t.listeners).toEqual({});
    // ② 그사이 포커스가 다른 데로 갔으면 빼앗지 않는다
    const moved = doc('body', { headings: [] });
    focusPageIfLost(moved);
    const t2 = harness(moved);
    watchPageHeading(moved, t2.opts);
    moved.activeElement = { isConnected: true };
    moved.headings.push(heading(moved));
    t2.mutate();
    expect(moved.headings[0].focus).not.toHaveBeenCalled();
    expect(t2.observers[0].on).toBe(false);
    // ③ 사용자가 누르거나 키를 쓰면 · 시간이 다 되면 · 정리 함수(다음 이동)로 멈춘다
    for (const end of [(t3) => t3.listeners.pointerdown(), (t3) => t3.listeners.keydown(), (t3) => t3.timers[0].fn(), (t3, stop) => stop()]) {
      const e = doc('body', { headings: [] });
      focusPageIfLost(e);
      const t3 = harness(e);
      const stop = watchPageHeading(e, t3.opts);
      end(t3, stop);
      e.headings.push(heading(e));
      t3.mutate();
      expect(e.activeElement).toBe(e.main);
      expect(t3.observers[0].on).toBe(false);
    }
  });

  it('옮긴 제목이 빠지거나 감춰져 포커스가 떨어지면 다음 보이는 제목(없으면 본문)으로 — 다른 데로 갔으면 빼앗지 않는다', () => {
    const harness = (d) => {
      const listeners = {}, observers = [];
      d.addEventListener = vi.fn((type, fn) => { listeners[type] = fn; });
      d.removeEventListener = vi.fn((type, fn) => { if (listeners[type] === fn) delete listeners[type]; });
      class Observer { constructor(cb) { this.cb = cb; this.on = false; observers.push(this); } observe(node, opts) { this.on = true; this.node = node; this.opts = opts; } disconnect() { this.on = false; } }
      const timers = [];
      const opts = { Observer, schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, cancel: vi.fn() };
      return { listeners, observers, timers, opts, mutate: () => observers.forEach((o) => o.on && o.cb([])) };
    };
    const remove = (d, h) => { h.isConnected = false; d.headings.splice(d.headings.indexOf(h), 1); };
    // ① 교재 실측: 표지 h1에 닿은 뒤 그 h1이 빠지고 body로 → 본문 h1이 들어오면 그리로
    const d = doc('body', { headings: [{}] });
    expect(focusPageIfLost(d)).toBe('heading');
    d.head = {};
    const t = harness(d);
    watchPageHeading(d, t.opts);
    expect(t.observers.map((o) => o.node)).toEqual([d.main, d.head]); // 감춤 style을 넣고 빼는 head도 본다
    const cover = d.headings[0];
    remove(d, cover); d.activeElement = d.body;
    t.mutate();
    expect(d.main.focus).toHaveBeenCalledTimes(1); // 다음 제목이 아직 없다 — 본문으로
    expect(d.activeElement).toBe(d.main);
    d.headings.push(heading(d));
    t.mutate();
    expect(d.activeElement).toBe(d.headings[0]);
    expect(t.observers[0].on).toBe(true);
    // ② 지키던 제목이 감춰졌다(포커스는 그 자리에 남음) → 다음 보이는 제목으로 바로
    const lesson = d.headings[0];
    d.headings.push(heading(d));
    lesson.visibility = 'hidden';
    t.mutate();
    expect(d.activeElement).toBe(d.headings[1]);
    // ③ 그사이 사용자가 다른 데로 옮겼으면 제목이 빠져도 빼앗지 않고 멈춘다
    const e = doc('body', { headings: [{}] });
    focusPageIfLost(e);
    const t2 = harness(e);
    watchPageHeading(e, t2.opts);
    const elsewhere = { isConnected: true };
    e.activeElement = elsewhere;
    remove(e, e.headings[0]); e.headings.push(heading(e));
    t2.mutate();
    expect(e.activeElement).toBe(elsewhere);
    expect(e.headings[0].focus).not.toHaveBeenCalled();
    expect(t2.observers[0].on).toBe(false);
    // ④ 처음부터 포커스가 우리 자리(본문 · 제목)가 아니면 지켜보지 않는다
    const f = doc('el', { headings: [{}] });
    const t3 = harness(f);
    watchPageHeading(f, t3.opts);
    expect(t3.observers).toHaveLength(0);
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
    expect(effect).toContain("const frame = requestAnimationFrame(() => { if (focusPageIfLost(document)) stopWatch = watchPageHeading(document); });");
    expect(effect).toContain('return () => { cancelAnimationFrame(frame); stopWatch?.(); };');
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
