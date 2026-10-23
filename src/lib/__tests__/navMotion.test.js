import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { NAV_CAUSE_TTL_MS, canAnimateNav, navMotionKind } from '../navMotion';
import { NAV_TAP_FORWARD_SELECTOR, forwardSwallowedTaps, startNavMotion, watchNavCause } from '../useNavMotion';

// 화면 이동 손맛(NAV-MOTION-001). 새 화면이 도착한 커밋에서만 전환한다 — 메뉴 = 옅게 0.16s, 목록 → 상세 = 오른쪽에서 0.22s, 뒤로 = 왼쪽에서 0.22s.
// 지키는 것: ① 누른 순간에는 아무것도 하지 않는다(INP · 대기 밑줄 불변) ② 브라우저가 이미 넘김을 보여 준 뒤로가기는 움직이지 않는다
// ③ 동작 줄이기 · 미지원 · 숨은 문서면 시작하지 않는다 ④ 0.3초 이하 · var(--ease-settle) · transform/opacity만 · 축소 블록.
// 계약 = 배선 보증(ui-conventions §5). 실제 재생 · INP · CLS는 목업 문서의 Chromium 실측이 본다.
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const SHELL = 'src/components/web/web-shell.css';

describe('navMotionKind — 이번 이동을 어떻게 보여 줄까', () => {
  const now = 10_000;
  const at = now - 50;
  it('첫 화면 · 같은 경로(검색 조건 · 해시만)는 움직이지 않는다', () => {
    expect(navMotionKind({ from: null, to: '/home', now })).toBeNull();
    expect(navMotionKind({ from: '/materials', to: '/materials', cause: { type: 'tab', at }, now })).toBeNull();
  });
  it('메뉴에서 누른 이동 = tab(옅게)', () => {
    expect(navMotionKind({ from: '/books/japanese-n5', to: '/discover', cause: { type: 'tab', at }, now })).toBe('tab');
  });
  it('본문 링크 — 더 깊으면(같아도) push, 얕아지면 pop', () => {
    expect(navMotionKind({ from: '/materials', to: '/viewer/abc', now })).toBe('push');
    expect(navMotionKind({ from: '/home', to: '/discover', now })).toBe('push');
    expect(navMotionKind({ from: '/books/japanese-n5/l1', to: '/books/japanese-n5', now })).toBe('pop');
  });
  it('뒤로 · 앞으로 — 기록 위치가 있으면 그 방향, 없으면 뒤로(pop)', () => {
    const cause = { type: 'pop', at, uaVisual: false, uaVisualKnown: true, coarse: true };
    expect(navMotionKind({ from: '/viewer/abc', to: '/materials', cause, now, fromIndex: 4, toIndex: 3 })).toBe('pop');
    expect(navMotionKind({ from: '/materials', to: '/viewer/abc', cause, now, fromIndex: 3, toIndex: 4 })).toBe('push');
    expect(navMotionKind({ from: '/viewer/abc', to: '/materials', cause, now })).toBe('pop');
  });
  it('브라우저가 이미 넘김을 보여 줬으면(가장자리 밀기 · 뒤로 제스처) 움직이지 않는다', () => {
    const cause = { type: 'pop', at, uaVisual: true, uaVisualKnown: true, coarse: true };
    expect(navMotionKind({ from: '/viewer/abc', to: '/materials', cause, now, fromIndex: 4, toIndex: 3 })).toBeNull();
  });
  it('그 여부를 모르는 브라우저 — 터치 기기는 제스처일 수 있어 움직이지 않고, 마우스 기기는 뒤로(pop)', () => {
    expect(navMotionKind({ from: '/viewer/abc', to: '/materials', cause: { type: 'pop', at, uaVisualKnown: false, coarse: true }, now })).toBeNull();
    expect(navMotionKind({ from: '/viewer/abc', to: '/materials', cause: { type: 'pop', at, uaVisualKnown: false, coarse: false }, now })).toBe('pop');
  });
  it(`오래된 기록(${NAV_CAUSE_TTL_MS}ms 넘음)은 원인으로 쓰지 않는다`, () => {
    const stale = { type: 'pop', at: now - NAV_CAUSE_TTL_MS - 1, uaVisual: true, uaVisualKnown: true };
    expect(navMotionKind({ from: '/home', to: '/books/japanese-n5', cause: stale, now })).toBe('push');
  });
});

describe('canAnimateNav — 시작해도 되나', () => {
  afterEach(() => vi.unstubAllGlobals());
  const doc = (extra = {}) => ({ startViewTransition: () => ({}), visibilityState: 'visible', ...extra });
  const win = (reduce = false, extra = {}) => ({ matchMedia: (q) => ({ matches: reduce && q === '(prefers-reduced-motion: reduce)' }), ...extra });
  it('지원 · 보이는 문서 · 동작 줄이기 꺼짐이면 true', () => {
    vi.stubGlobal('window', win(false));
    expect(canAnimateNav(doc(), win(false))).toBe(true);
  });
  it('동작 줄이기면 false(판정 정본 reducedMotion)', () => {
    vi.stubGlobal('window', win(true));
    expect(canAnimateNav(doc(), win(true))).toBe(false);
  });
  it('미지원(startViewTransition 없음) · 숨은 문서 · 창 스위치 off면 false', () => {
    vi.stubGlobal('window', win(false));
    expect(canAnimateNav(doc({ startViewTransition: undefined }), win(false))).toBe(false);
    expect(canAnimateNav(doc({ visibilityState: 'hidden' }), win(false))).toBe(false);
    expect(canAnimateNav(doc(), win(false, { __MANABI_NAV_MOTION__: 'off' }))).toBe(false);
  });
});

describe('startNavMotion — 전환 한 번', () => {
  function fakeDoc({ throws = false } = {}) {
    const finished = [];
    const page = { animationName: 'pageEnter', done: false, finish() { this.done = true; } };
    const other = { animationName: 'hlStroke', done: false, finish() { this.done = true; } };
    const doc = {
      documentElement: { dataset: {} },
      getAnimations: () => [page, other],
      addEventListener() {}, removeEventListener() {},
      calls: [],
      startViewTransition(cb) {
        if (throws) throw new Error('InvalidStateError');
        doc.calls.push({ capture: 'navMotionCapture' in doc.documentElement.dataset, kind: doc.documentElement.dataset.navMotion });
        cb();
        let resolve;
        const p = new Promise((r) => { resolve = r; });
        finished.push(resolve);
        return { ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: p };
      },
    };
    return { doc, page, other, finish: () => finished.forEach((r) => r()) };
  }
  it('시작 전에 「이전」 사진용 비움 표식 + 종류를 달고, 콜백에서 비움을 지우고 옛 등장(pageEnter)만 끝낸다', async () => {
    const { doc, page, other, finish } = fakeDoc();
    expect(startNavMotion(doc, 'push')).toBe(true);
    expect(doc.calls).toEqual([{ capture: true, kind: 'push' }]);
    expect('navMotionCapture' in doc.documentElement.dataset).toBe(false);
    expect(page.done).toBe(true);
    expect(other.done).toBe(false); // 담기 순간 등 다른 효과는 건드리지 않는다
    expect(doc.documentElement.dataset.navMotion).toBe('push');
    finish();
    await new Promise((r) => setTimeout(r, 0));
    expect('navMotion' in doc.documentElement.dataset).toBe(false);
  });
  it('시작이 실패하면 표식을 남기지 않는다(본문이 투명한 채 남지 않게)', () => {
    const { doc } = fakeDoc({ throws: true });
    expect(startNavMotion(doc, 'tab')).toBe(false);
    expect(doc.documentElement.dataset).toEqual({});
  });
});

describe('watchNavCause — 누른 곳 · 뒤로가기 기록', () => {
  function fakeWin({ coarse = false } = {}) {
    const listeners = {};
    const add = (type, fn) => { listeners[type] = fn; };
    const win = {
      performance: { now: () => 123 },
      matchMedia: (q) => ({ matches: coarse && q === '(pointer: coarse)' }),
      addEventListener: add, removeEventListener: () => {},
      document: { addEventListener: add, removeEventListener: () => {} },
    };
    return { win, fire: (type, event) => listeners[type](event) };
  }
  const link = (inNav) => ({ closest: (sel) => (sel === 'a[href]' ? { closest: () => (inNav ? {} : null) } : null) });
  it('메뉴 안 링크 = tab, 본문 링크 = 기록 지움, 보조 키 클릭(새 탭)은 무시', () => {
    const ref = { current: null };
    const { win, fire } = fakeWin();
    watchNavCause(win, ref);
    fire('click', { button: 0, target: link(true) });
    expect(ref.current).toEqual({ type: 'tab', at: 123 });
    fire('click', { button: 0, metaKey: true, target: link(false) });
    expect(ref.current).toEqual({ type: 'tab', at: 123 });
    fire('click', { button: 0, target: link(false) });
    expect(ref.current).toBeNull();
  });
  it('뒤로가기 — 브라우저 넘김 효과 여부 · 그 값을 아는지 · 터치 기기', () => {
    const ref = { current: null };
    const { win, fire } = fakeWin({ coarse: true });
    watchNavCause(win, ref);
    fire('popstate', { hasUAVisualTransition: true });
    expect(ref.current).toEqual({ type: 'pop', at: 123, uaVisual: true, uaVisualKnown: true, coarse: true });
    fire('popstate', {});
    expect(ref.current).toEqual({ type: 'pop', at: 123, uaVisual: false, uaVisualKnown: false, coarse: true });
  });
});

/** 규칙 본문에서 `animation: <이름> <길이> <곡선> both;`. */
function animationOf(css, selector) {
  const body = sliceBetween(css, `${selector} {`, '}');
  const m = body.match(/animation:\s*(\w+)\s+([\d.]+)s\s+([^;]+?)\s+both\s*;/);
  expect(m, `${selector}에 애니메이션이 없다`).not.toBeNull();
  return { name: m[1], duration: Number(m[2]), easing: m[3].trim() };
}
const reducedBlock = (css) => sliceBetween(css, '@media (prefers-reduced-motion: reduce) {\n  html[data-nav-motion]', '\n}');

describe('움직임 값 — 0.3초 이하 · 감속 토큰 · transform/opacity만 · 동작 줄이기 none', () => {
  const css = read(SHELL);
  const block = sliceBetween(css, '/* ========= 화면 이동 손맛(NAV-MOTION-001)');
  const rules = [
    { selector: 'html[data-nav-motion]::view-transition-new(root)', name: 'navTabIn', max: 0.16 },
    { selector: 'html[data-nav-motion="push"]::view-transition-new(root)', name: 'navPushIn', max: 0.22 },
    { selector: 'html[data-nav-motion="pop"]::view-transition-new(root)', name: 'navPopIn', max: 0.22 },
  ];
  for (const { selector, name, max } of rules) {
    it(`${selector} — ${name} ${max}s 이하 · var(--ease-settle) · 축소 시 none`, () => {
      const a = animationOf(block, selector);
      expect(a.name).toBe(name);
      expect(a.duration).toBeLessThanOrEqual(max);
      expect(a.duration).toBeLessThanOrEqual(0.3);
      expect(a.easing).toBe('var(--ease-settle)');
      expect(reducedBlock(block)).toContain(`${selector} { animation: none; }`);
    });
  }
  it('키프레임은 transform · opacity만 — 밀림은 16px 이하', () => {
    for (const name of ['navTabIn', 'navPushIn', 'navPopIn']) {
      const frames = sliceBetween(block, `@keyframes ${name} {`, '\n}');
      const props = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) expect(['opacity', 'transform']).toContain(prop);
      for (const m of frames.matchAll(/translateX\((-?\d+)px\)/g)) expect(Math.abs(Number(m[1]))).toBeLessThanOrEqual(16);
    }
  });
  it('「이전」 사진 비움은 표식이 있을 때만 · 동작 줄이기에서는 되돌린다(본문이 사라진 채 남지 않게)', () => {
    expect(block).toContain('html[data-nav-motion-capture] #main-content {\n  opacity: 0;\n}');
    expect(reducedBlock(block)).toContain('html[data-nav-motion-capture] #main-content { opacity: 1; }');
  });
  it('머리말 · 아래 메뉴는 전환 중에만 이름을 받고 제자리(움직임 없음 · 이전 사진 숨김)', () => {
    expect(css).not.toMatch(/(?<!html\[data-nav-motion\] )\.(gnb|mobile-nav) \{\s*view-transition-name/);
    expect(block).toMatch(/html\[data-nav-motion\]::view-transition-old\(manabi-gnb\),\nhtml\[data-nav-motion\]::view-transition-old\(manabi-tabbar\) \{\n {2}animation: none;\n {2}opacity: 0;/);
  });
  it('새 화면은 섞지 않고 위에 그린다(plus-lighter 밝아짐 방지)', () => {
    for (const { selector } of rules) expect(sliceBetween(block, `${selector} {`, '}')).toContain('mix-blend-mode: normal;');
  });
  it('효과 없는 pointer-events:none을 다시 두지 않는다 — 전환 중 탭은 forwardSwallowedTaps가 넘긴다(Chromium 실측 elementFromPoint = HTML)', () => {
    expect(block).not.toMatch(/::view-transition\s*\{[^}]*pointer-events/);
  });
});

describe('forwardSwallowedTaps — 전환 중 삼켜진 탭(실측 4/4 유실)을 손가락 아래 조작 요소로', () => {
  function setup() {
    const listeners = {};
    const root = { tag: 'html' };
    const link = { clicked: 0, click() { this.clicked += 1; } };
    const span = { closest: (sel) => (sel === NAV_TAP_FORWARD_SELECTOR ? link : null) };
    const doc = {
      documentElement: root,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      removeEventListener: (type) => { delete listeners[type]; },
      elementFromPoint: (x, y) => (x === 10 && y === 20 ? span : null),
    };
    let finish;
    const transition = { skipped: 0, skipTransition() { this.skipped += 1; }, finished: new Promise((r) => { finish = r; }) };
    let stopLater;
    const stop = forwardSwallowedTaps(doc, transition, { schedule: (fn) => { stopLater = fn; } });
    return { listeners, root, link, transition, finish: () => finish(), stop, stopLater: () => stopLater?.() };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));
  it('<html>이 받은 누름 → 전환을 끝내고, 그 click은 끝난 뒤 손가락 아래 링크로 다시 보낸다', async () => {
    const t = setup();
    t.listeners.pointerdown({ target: t.root });
    expect(t.transition.skipped).toBe(1);
    t.listeners.click({ target: t.root, isTrusted: true, clientX: 10, clientY: 20 });
    expect(t.link.clicked).toBe(0); // 전환이 끝나기 전에는 보내지 않는다(아직 <html>이 받는다)
    t.finish();
    await tick();
    expect(t.link.clicked).toBe(1);
  });
  it('실제 요소가 받은 click · 합성 click(넘겨준 click 자신)은 건드리지 않는다', async () => {
    const t = setup();
    t.listeners.click({ target: { tag: 'a' }, isTrusted: true, clientX: 10, clientY: 20 });
    t.listeners.click({ target: t.root, isTrusted: false, clientX: 10, clientY: 20 });
    t.finish();
    await tick();
    expect(t.link.clicked).toBe(0);
    expect(t.transition.skipped).toBe(0);
  });
  it('손가락 아래가 조작 요소가 아니면 아무것도 누르지 않는다', async () => {
    const t = setup();
    t.listeners.click({ target: t.root, isTrusted: true, clientX: 1, clientY: 1 });
    t.finish();
    await tick();
    expect(t.link.clicked).toBe(0);
  });
  it('전환이 끝나고 유예 뒤에는 리스너를 뗀다(평소 <html> click에 끼어들지 않음)', async () => {
    const t = setup();
    t.finish();
    await tick();
    expect(Object.keys(t.listeners).sort()).toEqual(['click', 'pointerdown']);
    t.stopLater();
    expect(Object.keys(t.listeners)).toEqual([]);
  });
});

describe('배선 — 도착한 커밋에서 한 곳만', () => {
  it('Layout이 경로마다 useNavMotion(pathname)을 부른다', () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).toContain("import { useNavMotion } from '@/lib/useNavMotion';");
    expect(layout).toContain('  useNavMotion(pathname);\n');
  });
  it('전환은 useLayoutEffect(커밋 · 그리기 전)에서만 시작한다 — 누름 리스너는 기록만', () => {
    const hook = read('src/lib/useNavMotion.js');
    const effect = sliceBetween(hook, 'useLayoutEffect(() => {', '}, [pathname]);');
    expect(effect).toContain('if (startNavMotion(document, kind))');
    const watch = sliceBetween(hook, 'export function watchNavCause', '\n}\n');
    expect(watch).not.toMatch(/startViewTransition|startNavMotion/);
  });
  it('화면 이동 전환은 이 한 곳 — 그 밖은 같은 화면 안 전환(단어 목록 모드 바꾸기)뿐', () => {
    const walk = (dir, out = []) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__') continue;
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p, out);
        else if (/\.(jsx?|mjs|tsx?)$/.test(name)) out.push(p);
      }
      return out;
    };
    const callers = walk(path.join(ROOT, 'src')).filter((f) => /\.startViewTransition\(/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).replaceAll('\\', '/'));
    expect(callers).toEqual(['src/components/levels/word/LevelWordScreen.jsx', 'src/lib/useNavMotion.js']);
    // 화면 안 전환이다 — 모드 · 보기 상태(setPrefs)만 감싼다(경로를 바꾸지 않는다).
    const word = read('src/components/levels/word/LevelWordScreen.jsx');
    expect(word.match(/document\.startViewTransition\(go\)/g)).toHaveLength(2);
    expect(word.match(/const go = \(\) => flushSync\(\(\) => setPrefs\(\{ (mode|view) \}\)\);/g)).toHaveLength(2);
  });
  it('늘 붙어 있는 전환 이름은 화면 이동 중에 none — 이름이 새로 생기면 여기 목록이 신호다', () => {
    const files = ['src/index.css', SHELL, 'src/components/levels/word/level-word.css'];
    const names = files.flatMap((f) => [...read(f).matchAll(/([^{}]+)\{[^}]*view-transition-name:\s*([\w-]+)/g)])
      .filter((m) => !m[1].includes('html[data-nav-motion]')).map((m) => m[2]);
    expect(names).toEqual(['lw-rows']);
    expect(read(SHELL)).toContain('html[data-nav-motion] .lw-rows {\n  view-transition-name: none;\n}');
  });
  it('배제 기록 — 실험판 React를 끌어오는 experimental.viewTransition · 문서 간 @view-transition은 켜지 않는다', () => {
    expect(read('next.config.mjs')).not.toMatch(/viewTransition/);
    expect(read('src/index.css') + read(SHELL)).not.toMatch(/@view-transition/);
  });
});
