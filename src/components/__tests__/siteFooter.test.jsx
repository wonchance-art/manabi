import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// 공통 푸터(오너 승인 2026-11-07 KST — 목업 CrsGiHf5bS4tmQk3n2HVBx ③-1 권장 A).
const nav = vi.hoisted(() => ({ path: '/home' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
const { default: SiteFooter, siteFooterHidden } = await import('../web/SiteFooter.jsx');
const read = (p) => readFileSync(p, 'utf8');

describe('공통 푸터 — 처리방침을 일반 화면 어디서나', () => {
  it('일반 화면에는 있고 몰입 화면에는 없다', () => {
    for (const p of ['/home', '/materials', '/vocab', '/books/japanese-n5', '/profile', '/groups', '/discover', '/study/library', '/conversation/lobby', '/lessons', '/auth']) {
      expect(siteFooterHidden(p), p).toBe(false);
    }
    for (const p of ['/viewer/50', '/suggestions/abc', '/study', '/review/grammar', '/world', '/class/team1', '/conversation/new', '/pdf/3', '/notes/7', '/admin', '/offline']) {
      expect(siteFooterHidden(p), p).toBe(true);
    }
  });
  it('네 링크 — 이용약관 · 처리방침(굵게 구분) · 도움말 · 자료 출처, 모두 있는 화면', () => {
    nav.path = '/home';
    const html = renderToStaticMarkup(createElement(SiteFooter));
    expect(html).toContain('<nav class="site-footer__links" aria-label="사이트 정보">');
    expect([...html.matchAll(/href="([^"]+)"[^>]*>([^<]+)</g)].map(m => [m[1], m[2]])).toEqual([
      ['/terms', '이용약관'], ['/privacy', '개인정보 처리방침'], ['/help', '도움말'], ['/credits', '자료 출처'],
    ]);
    expect(html).toContain('<a class="site-footer__privacy" href="/privacy">개인정보 처리방침</a>');
    for (const r of ['terms', 'privacy', 'help', 'credits']) expect(existsSync(`src/app/${r}/page.jsx`), r).toBe(true);
    nav.path = '/viewer/50';
    expect(renderToStaticMarkup(createElement(SiteFooter))).toBe('');
  });
  it('Layout은 세그먼트 뒤에 자리만 — 글자는 부품 파일에(하위 집합 출처 밖)', () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).toContain("import SiteFooter from './web/SiteFooter';");
    expect(layout).toContain('<SegmentSlot>{children}</SegmentSlot>\n        <SiteFooter />\n      </main>');
    expect(layout).not.toMatch(/개인정보 처리방침|이용약관|자료 출처/);
  });
  it('셸 토큰만 · 누름 칸 44px · 처리방침 먹색 굵게', () => {
    const css = read('src/components/web/site-footer.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(css).toMatch(/\.site-footer a\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.site-footer \.site-footer__privacy\{color:var\(--ink\);font-weight:700\}/);
  });
});
