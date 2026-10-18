// 교재 화면 bfcache(BFCACHE-A-001 — 오너 승인 2026-10-17 KST 선택지 A). Next 15.5의 RSC prefetch 응답은
// Cache-Control: no-store라, 화면에 들어온 Link 하나가 prefetch만 해도 Chrome이 그 화면을 bfcache에 넣지 않는다
// (JsNetworkRequestReceivedCacheControlNoStoreResource). 교재에서 막던 둘 = GNB 「산책」(/discover) · breadcrumb 「교재」(/lessons).
// 둘 다 화면 진입 prefetch를 끄고, 산책은 배움과 같은 의도 prefetch(APP-FEEL-004: 마우스 80ms 머묾 · 키보드 포커스, 터치 없음)로 둔다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';
import { MAIN_NAV } from '../webNavigation';
import { INTENT_DWELL_MS, intentPrefetchProps } from '../intentPrefetch';

const read = (f) => fs.readFileSync(f, 'utf8');

describe('메뉴 — 화면 진입 prefetch 없음', () => {
  it('산책은 prefetch:false + 의도 prefetch(배움과 같은 항목 모양)', () => {
    expect(MAIN_NAV.find(item => item.href === '/discover')).toEqual(expect.objectContaining({ prefetch: false, intentPrefetch: true }));
    expect(MAIN_NAV.find(item => item.href === '/home')).toEqual(expect.objectContaining({ prefetch: false, intentPrefetch: true }));
    expect(MAIN_NAV.find(item => item.href === '/conversation/new')).toEqual(expect.objectContaining({ prefetch: false, intentPrefetch: true })); // CONV-INTENT-001
  });
  it('메뉴 넷 모두 화면 진입 prefetch를 하지 않는다(prefetch가 false가 아닌 항목 = 0)', () => {
    expect(MAIN_NAV.filter(item => item.prefetch !== false).map(item => item.href)).toEqual([]);
  });
  it('데스크톱 · 휴대폰 · 읽기 화면 메뉴 셋 다 같은 항목 값과 같은 의도 prefetch 도우미를 쓴다(두 번째 방식 없음)', () => {
    const layout = read('src/components/Layout.jsx');
    for (const nav of ['<nav className="gnb__nav"', '<nav className="mobile-nav"']) {
      const block = sliceBetween(layout, nav, '</nav>');
      expect(block).toContain('prefetch={l.prefetch}');
      expect(block).toContain('{...intentPrefetchProps(router, l, isNavActive(l.href))}');
    }
    const reader = sliceBetween(layout, '<nav aria-label="읽기 화면 내비게이션"', '</nav>');
    expect(reader).toContain('prefetch={item.prefetch} {...intentPrefetchProps(router, item,');
    expect(layout).not.toMatch(/router\.prefetch\(/); // 의도 prefetch는 intentPrefetch.js 한 곳에서만 부른다
  });
  it('의도 prefetch 규칙 그대로 — 마우스 80ms 머묾 · 키보드 포커스 · 터치 없음 · 대기 화면까지(kind auto)', () => {
    expect(INTENT_DWELL_MS).toBe(80);
    const discover = MAIN_NAV.find(item => item.href === '/discover');
    const props = intentPrefetchProps({}, discover, false, { timers: new Map(), schedule: () => 1, cancel: () => {}, prefetch: () => true });
    expect(Object.keys(props).sort()).toEqual(['onFocus', 'onPointerDown', 'onPointerEnter', 'onPointerLeave']);
    expect(read('src/lib/intentPrefetch.js')).toContain("router.prefetch(href, { kind: 'auto' });");
    // 산책은 자체 대기 화면(loading.jsx)이 있어 의도 prefetch가 골격을 받아 온다.
    expect(fs.existsSync('src/app/(app)/discover/loading.jsx')).toBe(true);
  });
});

describe('교재 breadcrumb 「교재」 — 화면 진입 prefetch 없음', () => {
  for (const file of ['src/components/books/BookHome.jsx', 'src/components/books/BookMaterials.jsx', 'src/components/books/BookReview.jsx']) {
    it(file, () => {
      const src = read(file);
      expect(src).toContain('<Link href="/lessons" prefetch={false}>교재</Link>');
      expect(src).not.toMatch(/<Link href="\/lessons">/); // prefetch를 끄지 않은 /lessons 링크가 다시 생기지 않게
    });
  }
});
