import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { NAV_CAUSE_TTL_MS, NAV_MOTION_MS, canAnimateNav, navMotionKind } from '../navMotion';
import { startNavMotion, watchNavCause } from '../useNavMotion';

// 화면 이동 손맛(NAV-MOTION-001). 새 화면이 도착한 커밋에서만 본문 등장 효과(CSS)를 건다 — 메뉴 = 옅게 0.16s, 목록 → 상세 = 오른쪽에서 0.22s, 뒤로 = 왼쪽에서 0.22s.
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
  it('숨은 문서(animationend가 안 온다) · 창 스위치 off면 false · View Transitions 지원 여부와 무관', () => {
    vi.stubGlobal('window', win(false));
    expect(canAnimateNav(doc({ startViewTransition: undefined }), win(false))).toBe(true);
    expect(canAnimateNav(doc({ visibilityState: 'hidden' }), win(false))).toBe(false);
    expect(canAnimateNav(doc(), win(false, { __MANABI_NAV_MOTION__: 'off' }))).toBe(false);
  });
});

describe('startNavMotion — 등장 한 번', () => {
  function fakeDoc({ main = true } = {}) {
    const page = { animationName: 'pageEnter', done: false, finish() { this.done = true; } };
    const other = { animationName: 'hlStroke', done: false, finish() { this.done = true; } };
    const listeners = {};
    const mainEl = { addEventListener: (t, fn) => { listeners[t] = fn; }, removeEventListener: (t) => { delete listeners[t]; } };
    const doc = { documentElement: { dataset: {} }, getAnimations: () => [page, other], getElementById: (id) => (main && id === 'main-content' ? mainEl : null) };
    return { doc, page, other, mainEl, listeners };
  }
  it('표식을 달고 옛 등장(pageEnter)만 끝 상태로 — 다른 효과는 그대로', () => {
    const { doc, page, other } = fakeDoc();
    expect(startNavMotion(doc, 'push', { schedule: () => 1, cancel: () => {} })).toBeTypeOf('function');
    expect(doc.documentElement.dataset.navMotion).toBe('push');
    expect(page.done).toBe(true);
    expect(other.done).toBe(false);
  });
  it('본문의 옅어짐(navFadeIn)이 끝나야 표식을 뗀다 — 자식 · 밀림 취소(고정 요소 생김)는 무시(옅어짐이 끊기지 않게)', () => {
    const { doc, mainEl, listeners } = fakeDoc();
    startNavMotion(doc, 'push', { schedule: () => 1, cancel: () => {} });
    listeners.animationend({ target: {}, animationName: 'navFadeIn' });
    listeners.animationend({ target: mainEl, animationName: 'pageEnter' });
    listeners.animationcancel({ target: mainEl, animationName: 'navFromRight' });
    expect(doc.documentElement.dataset.navMotion).toBe('push');
    listeners.animationend({ target: mainEl, animationName: 'navFadeIn' });
    expect('navMotion' in doc.documentElement.dataset).toBe(false);
    expect(listeners).toEqual({});
  });
  it('animationend가 오지 않아도(취소 · 숨은 탭) 길이 + 여유 뒤 표식을 뗀다', () => {
    const { doc } = fakeDoc();
    let fire, wait;
    startNavMotion(doc, 'pop', { schedule: (fn, ms) => { fire = fn; wait = ms; return 1; }, cancel: () => {} });
    expect(wait).toBe(NAV_MOTION_MS.pop + 200);
    fire();
    expect('navMotion' in doc.documentElement.dataset).toBe(false);
  });
  it('본문이 없으면 아무것도 하지 않는다', () => {
    const { doc } = fakeDoc({ main: false });
    expect(startNavMotion(doc, 'tab')).toBeNull();
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

/** 규칙 본문의 `animation:` 목록 → [{ name, duration, easing }] (각 항목 `<이름> <길이>s <곡선> both`). */
function animationsOf(css, selector) {
  const body = sliceBetween(css, `${selector} {`, '}');
  const m = body.match(/animation:\s*([^;]+);/);
  expect(m, `${selector}에 애니메이션이 없다`).not.toBeNull();
  return m[1].split(/,\s*(?=nav)/).map((item) => {
    const a = item.trim().match(/^(\w+)\s+([\d.]+)s\s+(.+?)\s+both$/);
    expect(a, `${selector}: ${item}`).not.toBeNull();
    return { name: a[1], duration: Number(a[2]), easing: a[3] };
  });
}
const GUARD = 'html:is([data-nav-motion="push"], [data-nav-motion="pop"]) #main-content:has(';
// 본문 밖이라 본문 transform과 무관한 고정 요소(머리말 · 아래 메뉴 · 오프라인 띠 · 알림 · 포털 · 온보딩 — Layout · Provider에서 main 바깥).
const FIXED_OUTSIDE_MAIN = ['.gnb', '.mobile-nav', '.offline-banner', '.toast-container', '.onboarding-overlay', '.hz-portal'];

describe('움직임 값 — 0.3초 이하 · 감속 토큰 · transform/opacity만 · 동작 줄이기 none', () => {
  const css = read(SHELL);
  const block = sliceBetween(css, '/* ========= 화면 이동 손맛(NAV-MOTION-001)');
  const kinds = [
    { kind: 'tab', expected: [['navFadeIn', 0.16]] },
    { kind: 'push', expected: [['navFadeIn', 0.22], ['navFromRight', 0.22]] },
    { kind: 'pop', expected: [['navFadeIn', 0.22], ['navFromLeft', 0.22]] },
  ];
  for (const { kind, expected } of kinds) {
    const selector = `html[data-nav-motion="${kind}"] #main-content`;
    it(`${selector} — ${expected.map(([n, d]) => `${n} ${d}s`).join(' + ')} · 0.3s 이하 · var(--ease-settle) · JS 길이와 같음`, () => {
      const list = animationsOf(block, selector);
      expect(list.map((a) => [a.name, a.duration])).toEqual(expected);
      for (const a of list) {
        expect(a.duration).toBeLessThanOrEqual(0.3);
        expect(a.duration * 1000).toBe(NAV_MOTION_MS[kind]);
        expect(a.easing).toBe('var(--ease-settle)');
      }
    });
  }
  it('본문에 고정 요소가 있으면(push · pop) 밀림만 떼고 같은 이름의 옅어짐은 이어 간다', () => {
    const guard = sliceBetween(block, GUARD, '\n}');
    expect(guard).toMatch(/\) \{\n {2}animation: navFadeIn 0\.22s var\(--ease-settle\) both;$/);
  });
  it(':has 목록 = src CSS의 position:fixed 규칙(마지막 단위) 전부 − 본문 밖 목록 — 새 고정 규칙이 생기면 여기서 잡힌다', () => {
    const walk = (dir, out = []) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p, out); else if (name.endsWith('.css')) out.push(p);
      }
      return out;
    };
    const fixed = new Set();
    for (const file of walk(path.join(ROOT, 'src'))) {
      const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of src.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
        if (!/position\s*:\s*fixed/.test(m[2])) continue;
        for (const sel of m[1].split(',')) fixed.add(sel.trim().split(/\s+/).at(-1).replace(/^\.manabi-app(?=\.)/, ''));
      }
    }
    const has = sliceBetween(block, GUARD, '\n) {').slice(GUARD.length).split(',').map((x) => x.trim()).filter(Boolean);
    const expected = [...fixed].filter((sel) => !FIXED_OUTSIDE_MAIN.includes(sel)).sort();
    expect([...has].sort()).toEqual(expected);
    expect(FIXED_OUTSIDE_MAIN.filter((sel) => !fixed.has(sel))).toEqual([]); // 낡은 예외가 남지 않게
  });
  it('키프레임은 transform · opacity만 — 밀림은 16px 이하', () => {
    for (const name of ['navFadeIn', 'navFromRight', 'navFromLeft']) {
      const frames = sliceBetween(block, `@keyframes ${name} {`, '\n}');
      const props = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) expect(['opacity', 'transform']).toContain(prop);
      for (const m of frames.matchAll(/translateX\((-?\d+)px\)/g)) expect(Math.abs(Number(m[1]))).toBeLessThanOrEqual(16);
    }
  });
  it('동작 줄이기 — 고정 요소 규칙까지 포함해 모두 none', () => {
    const reduced = sliceBetween(block, '@media (prefers-reduced-motion: reduce) {', '\n}');
    expect(reduced).toContain('html[data-nav-motion] #main-content { animation: none !important; }');
  });
  it('움직이는 것은 본문뿐 — 머리말 · 아래 메뉴 · View Transitions 의사 요소를 건드리지 않는다', () => {
    expect(block.replace(sliceBetween(block, GUARD, '\n) {'), '')).not.toMatch(/\.gnb|\.mobile-nav|::view-transition|view-transition-name/);
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
    expect(hook).not.toMatch(/startViewTransition/); // 화면 이동은 View Transitions를 쓰지 않는다(전환 중 탭 유실 — 목업 §6)
    const watch = sliceBetween(hook, 'export function watchNavCause', '\n}\n');
    expect(watch).not.toMatch(/startNavMotion|dataset/);
  });
  it('startViewTransition은 같은 화면 안 전환(단어 목록 모드 바꾸기)만 — 화면 이동에는 없다', () => {
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
    expect(callers).toEqual(['src/components/levels/word/LevelWordScreen.jsx']);
    // 화면 안 전환이다 — 모드 · 보기 상태(setPrefs)만 감싼다(경로를 바꾸지 않는다).
    const word = read('src/components/levels/word/LevelWordScreen.jsx');
    expect(word.match(/document\.startViewTransition\(go\)/g)).toHaveLength(2);
    expect(word.match(/const go = \(\) => flushSync\(\(\) => setPrefs\(\{ (mode|view) \}\)\);/g)).toHaveLength(2);
  });
  it('배제 기록 — 실험판 React를 끌어오는 experimental.viewTransition · 문서 간 @view-transition은 켜지 않는다', () => {
    expect(read('next.config.mjs')).not.toMatch(/viewTransition/);
    expect(read('src/index.css') + read(SHELL)).not.toMatch(/@view-transition/);
  });
});
