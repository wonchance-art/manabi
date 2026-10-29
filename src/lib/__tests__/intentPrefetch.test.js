// 의도 prefetch(APP-FEEL-004, 2026-10-17 KST) — 배움의 대기 화면을 첫 클릭에 띄우되 P5(뷰포트 prefetch 끔)는 지킨다.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { INTENT_DWELL_MS, INTENT_PREFETCH_TTL_MS, intentPrefetchProps, prefetchOnIntent } from '../intentPrefetch';
import { MAIN_NAV } from '../webNavigation';

const read = (f) => fs.readFileSync(f, 'utf8');
const fakeRouter = () => ({ prefetch: vi.fn() });

describe('prefetchOnIntent', () => {
  it("대기 화면까지만 받는다 — kind 'auto'(기본값 FULL이면 개인화 화면을 통째로 받는다)", () => {
    const router = fakeRouter();
    expect(prefetchOnIntent(router, '/home', { now: 0, nav: {}, seen: new Map() })).toBe(true);
    expect(router.prefetch).toHaveBeenCalledTimes(1);
    expect(router.prefetch).toHaveBeenCalledWith('/home', { kind: 'auto' });
  });

  it('같은 주소는 TTL 안에 한 번만, TTL이 지나면 다시 받는다(골격 재사용 창 5분보다 짧게)', () => {
    const router = fakeRouter();
    const seen = new Map();
    expect(INTENT_PREFETCH_TTL_MS).toBeLessThan(5 * 60 * 1000);
    prefetchOnIntent(router, '/home', { now: 0, nav: {}, seen });
    expect(prefetchOnIntent(router, '/home', { now: 1000, nav: {}, seen })).toBe(false);
    expect(prefetchOnIntent(router, '/materials', { now: 1000, nav: {}, seen })).toBe(true);
    expect(prefetchOnIntent(router, '/home', { now: INTENT_PREFETCH_TTL_MS, nav: {}, seen })).toBe(true);
    expect(router.prefetch.mock.calls.map(c => c[0])).toEqual(['/home', '/materials', '/home']);
  });

  it('지금 화면 · 데이터 절약 모드 · 라우터 없음이면 받지 않는다', () => {
    const router = fakeRouter();
    const seen = new Map();
    expect(prefetchOnIntent(router, '/home', { current: true, now: 0, nav: {}, seen })).toBe(false);
    expect(prefetchOnIntent(router, '/home', { now: 0, nav: { connection: { saveData: true } }, seen })).toBe(false);
    expect(prefetchOnIntent(null, '/home', { now: 0, nav: {}, seen })).toBe(false);
    expect(router.prefetch).not.toHaveBeenCalled();
    // 건너뛴 시도는 기록하지 않는다 — 다른 화면에서 다시 올라가면 받는다.
    expect(seen.size).toBe(0);
  });
});

describe('intentPrefetchProps', () => {
  // 가짜 타이머 — 머무름(dwell)을 손으로 진행한다.
  const harness = () => {
    const queue = new Map(); let id = 0;
    const prefetch = vi.fn();
    const opts = { timers: new Map(), dwellMs: INTENT_DWELL_MS, prefetch, schedule: (fn) => { queue.set(++id, fn); return id; }, cancel: (t) => queue.delete(t) };
    const flush = () => { for (const [t, fn] of [...queue]) { queue.delete(t); fn(); } };
    return { opts, prefetch, flush, pending: () => queue.size };
  };
  const item = { href: '/home', intentPrefetch: true };
  const mouse = { pointerType: 'mouse' };

  it('intentPrefetch 항목에만, 터치 이벤트 없이 붙인다', () => {
    expect(intentPrefetchProps({}, { href: '/discover' }, false)).toBeNull();
    const props = intentPrefetchProps({}, item, false, harness().opts);
    expect(Object.keys(props).sort()).toEqual(['onFocus', 'onPointerDown', 'onPointerEnter', 'onPointerLeave']);
    expect(props).not.toHaveProperty('onTouchStart');
  });

  it('마우스는 머문 뒤에만 받는다 — 지나가기(pointerleave) · 바로 누르기(pointerdown)는 요청 0', () => {
    expect(INTENT_DWELL_MS).toBe(80);
    const h = harness();
    const router = {};
    const props = intentPrefetchProps(router, item, false, h.opts);
    props.onPointerEnter(mouse);
    expect(h.prefetch).not.toHaveBeenCalled(); // 바로 받지 않는다
    props.onPointerLeave(mouse);
    h.flush();
    expect(h.prefetch).not.toHaveBeenCalled();
    props.onPointerEnter(mouse); props.onPointerDown(mouse); h.flush();
    expect(h.prefetch).not.toHaveBeenCalled();
    props.onPointerEnter(mouse); h.flush();
    expect(h.prefetch).toHaveBeenCalledTimes(1);
    expect(h.prefetch).toHaveBeenCalledWith(router, '/home', { current: false });
  });

  it('터치 포인터는 받지 않는다(touchstart → click 붙잡힘)', () => {
    const h = harness();
    intentPrefetchProps({}, item, false, h.opts).onPointerEnter({ pointerType: 'touch' });
    expect(h.pending()).toBe(0);
    h.flush();
    expect(h.prefetch).not.toHaveBeenCalled();
  });

  it('키보드 포커스(:focus-visible)는 바로, 마우스로 누를 때의 포커스는 건너뛴다', () => {
    const h = harness();
    const props = intentPrefetchProps({}, item, true, h.opts);
    props.onFocus({ currentTarget: { matches: () => false } });
    expect(h.prefetch).not.toHaveBeenCalled();
    props.onFocus({ currentTarget: { matches: (sel) => sel === ':focus-visible' } });
    expect(h.prefetch).toHaveBeenCalledWith({}, '/home', { current: true }); // 지금 화면 여부는 prefetchOnIntent가 거른다
    props.onFocus({ currentTarget: { matches: () => { throw new Error('old browser'); } } });
    expect(h.prefetch).toHaveBeenCalledTimes(1);
  });
});

describe('메뉴 배선', () => {
  it('배움 · 대화 · 산책만 의도 prefetch — 뷰포트 prefetch(P5 · BFCACHE-A-001)는 끄고, 서재(자체 loading 없음 → 라우터 상태만)는 붙이지 않는다', () => {
    const intent = MAIN_NAV.filter(item => item.intentPrefetch).map(item => item.href);
    expect(intent).toEqual(['/home', '/conversation/new', '/discover']);
    for (const item of MAIN_NAV) expect(item.prefetch, item.href).toBe(false);
    // 받을 것이 있어야 의미가 있다 — 대기 화면(loading.jsx)이 있거나(골격까지), 정적 화면이라 auto가 화면을 통째로 받거나.
    // 배움은 판마다 대기 화면이 있다(GUEST-STATIC-001 4단계 — 손님 (guest) · 로그인 member, 둘 다 ISR이라 auto가 화면을 통째로 받는다).
    for (const f of ['home/(guest)/loading.jsx', 'home/member/loading.jsx', 'discover/loading.jsx']) expect(fs.existsSync(`src/app/(app)/${f}`), f).toBe(true);
  });

  it('대화(CONV-INTENT-001)는 대기 화면 없이 정적 화면이라서 의도 prefetch가 이득이다 — 동적으로 바뀌면 이 근거가 사라진다', () => {
    // 정적 판정: 이 세그먼트(conversation · conversation/new)의 서버 파일이 요청별 값을 읽지 않는다.
    // 동적이 되면 auto prefetch는 대기 화면이 없어 라우터 상태만 받는다(서재와 같은 처지) — 그때는 loading.jsx를 두거나 의도 prefetch를 뺀다.
    const files = ['src/app/(app)/conversation/layout.jsx', 'src/app/(app)/conversation/new/page.jsx'];
    for (const file of files) {
      const src = read(file);
      expect(src, file).not.toMatch(/next\/headers|export const dynamic|export const revalidate|cookies\(|headers\(|draftMode\(|connection\(/);
      expect(src, file).not.toMatch(/export default async function|searchParams/);
    }
    expect(fs.existsSync('src/app/(app)/conversation/new/loading.jsx')).toBe(false); // 실측 — 통째로 받으므로 대기 경계가 앞당길 몫이 없다
  });

  it('GNB · 휴대폰 탭 막대 · 읽기 화면 메뉴의 MAIN_NAV Link 셋 모두에 붙는다', () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).toContain("import { intentPrefetchProps } from '@/lib/intentPrefetch';");
    const gnb = sliceBetween(layout, '<nav className="gnb__nav"', '</nav>');
    const mobile = sliceBetween(layout, '<nav className="mobile-nav"', '</nav>');
    for (const nav of [gnb, mobile]) {
      expect(nav).toMatch(/prefetch=\{l\.prefetch\}\s*\{\.\.\.intentPrefetchProps\(router, l, isNavActive\(l\.href\)\)\}/);
    }
    const reader = sliceBetween(layout, 'function ReaderSiteMenu(', '</nav>');
    expect(reader).toContain('const router = useRouter();');
    expect(reader).toContain('prefetch={item.prefetch} {...intentPrefetchProps(router, item, navigationOwner(pathname) === item.href)}');
    // FULL로 받는 우회(kind 생략 · 'full')를 막는다.
    const src = read('src/lib/intentPrefetch.js');
    expect(src.match(/router\.prefetch\(href/g)).toHaveLength(1);
    expect(src).toContain("router.prefetch(href, { kind: 'auto' });");
  });
});
