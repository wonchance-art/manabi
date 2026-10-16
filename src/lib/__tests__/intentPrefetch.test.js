// 의도 prefetch(APP-FEEL-004, 2026-10-17 KST) — 배움 · 서재의 대기 화면을 첫 클릭에 띄우되 P5(뷰포트 prefetch 끔)는 지킨다.
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { INTENT_PREFETCH_TTL_MS, intentPrefetchProps, prefetchOnIntent } from '../intentPrefetch';
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
  it('intentPrefetch 항목에만 포인터 · 포커스 · 터치 의도를 붙인다', () => {
    const router = fakeRouter();
    expect(intentPrefetchProps(router, { href: '/discover' }, false)).toBeNull();
    const props = intentPrefetchProps(router, { href: '/x-intent-test', intentPrefetch: true }, false);
    expect(Object.keys(props).sort()).toEqual(['onFocus', 'onPointerEnter', 'onTouchStart']);
    props.onTouchStart();
    props.onPointerEnter(); // 터치 뒤 따라오는 pointerenter는 중복으로 걸러진다
    expect(router.prefetch).toHaveBeenCalledTimes(1);
    const currentProps = intentPrefetchProps(router, { href: '/x-intent-current', intentPrefetch: true }, true);
    currentProps.onFocus();
    expect(router.prefetch).toHaveBeenCalledTimes(1);
  });
});

describe('메뉴 배선', () => {
  it('배움 · 서재만 의도 prefetch — 뷰포트 prefetch(P5)는 계속 끈다', () => {
    const intent = MAIN_NAV.filter(item => item.intentPrefetch).map(item => item.href);
    expect(intent).toEqual(['/home', '/materials']);
    for (const href of intent) expect(MAIN_NAV.find(item => item.href === href).prefetch).toBe(false);
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
