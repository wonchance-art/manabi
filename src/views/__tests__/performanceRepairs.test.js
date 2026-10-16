import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MAIN_NAV } from '../../lib/webNavigation';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('P1–P5 초기 전송 성능 수리 회귀', () => {
  it('P1: root는 실제 sans weight만 로드하고 serif는 app scope, 번체 TC는 세그먼트 scope에 둔다', () => {
    const rootLayout = read('src/app/layout.jsx');
    const appLayout = read('src/app/(app)/layout.jsx');
    const css = read('src/index.css');

    expect(rootLayout).not.toContain("'300'");
    expect(rootLayout).not.toContain('Noto_Serif_KR');
    expect(rootLayout).toContain('Noto_Sans_JP');
    // 대만 번체 TC는 루트가 아니라 번체를 그리는 세그먼트 범위(TcFontScope)에서만 싣는다 — 지도는 src/app/__tests__/fontScope.test.js.
    expect(rootLayout).not.toContain('Noto_Sans_TC');
    expect(rootLayout).toContain("subsets: ['latin']");
    expect(appLayout).toContain('Noto_Serif_KR');
    expect(appLayout).toContain('className={notoSerifKr.variable}');
    expect(css).not.toContain('font-weight: 900');
    // 사용 '개수'를 못 박으면 정당한 serif 사용마다 깨진다 — 검사할 것은 스코프다:
    // (app) 레이아웃에서만 로드되고 root에는 없어야 한다(위 두 단언). 사용처는 존재만 확인한다.
    expect(css.split('var(--font-serif)').length - 1).toBeGreaterThan(0);
  });

  it('P2: lessons 지도는 client dynamic chunk로 분리된다', () => {
    const lessons = read('src/views/LessonsPage.jsx');

    expect(lessons).toContain("dynamic(() => import('../components/LanguageWorldMap')");
    expect(lessons).toContain('ssr: false');
    expect(lessons).not.toContain("import LanguageWorldMap, { TRACK_COLORS }");
  });

  it('P5: 개인화 홈과 빈도가 낮은 전역 링크의 prefetch를 끈다', () => {
    const layout = read('src/components/Layout.jsx');

    // 로그인 직후 홈의 부분 prefetch가 연속 탐색을 붙잡는 회귀를 함께 방어한다.
    expect(MAIN_NAV).toContainEqual(expect.objectContaining({ href: '/home', label: '배움', prefetch: false }));
    expect(MAIN_NAV).toContainEqual(expect.objectContaining({ href: '/materials', label: '서재', prefetch: false }));
    // 복습(/vocab)은 메뉴에서 빠지고 배움의 단어 복습 칸으로 들어간다 — 그 칸도 개인화 화면을 prefetch하지 않는다.
    expect(MAIN_NAV.some(item => item.href === '/vocab')).toBe(false);
    const tiles = read('src/components/learn/LearnTiles.jsx');
    expect(sliceBetween(tiles, 'export function ReviewTile(', '\n}\n')).toContain('prefetch={false}');
    expect(layout).toContain('const navLinks = MAIN_NAV');
    expect(layout).toContain('const mobileNavLinks = MAIN_NAV');
    expect(layout.split('prefetch={l.prefetch}').length - 1).toBe(2);
    // 의도 prefetch(APP-FEEL-004)는 뷰포트 prefetch를 되살리지 않는다 — 포인터 · 포커스 · 터치에만, 대기 화면까지(kind 'auto')만 받는다.
    expect(MAIN_NAV.find(item => item.href === '/home')).toEqual(expect.objectContaining({ prefetch: false, intentPrefetch: true }));
    // 서재는 자체 loading이 없어 AUTO가 라우터 상태만 받는다 — 의도 prefetch도 붙이지 않는다(붙잡힘 위험만).
    expect(MAIN_NAV.find(item => item.href === '/materials').intentPrefetch).toBeUndefined();
    expect(read('src/lib/intentPrefetch.js')).toContain("router.prefetch(href, { kind: 'auto' });");
    expect(layout).not.toMatch(/prefetch=\{true\}/);
    expect(layout).not.toContain('/review/grammar');
  });

  it('P4: 홈은 발행 교재의 작은 카탈로그만 전달하고 예전 30과 통계를 섞지 않는다', () => {
    const page = read('src/app/(app)/home/page.jsx');
    const home = read('src/views/HomePage.jsx');
    expect(page).toContain('readingCatalog(published.book)');
    expect(page).toContain('<HomePage book={book} />');
    expect(page).not.toContain('buildContinueManifest');
    expect(home).not.toContain('ProfileStats');
    expect(home).not.toContain('pullProgress');
  });

  it('P3: dynamic searchParams 구조를 유지한다 — 정적화하면 ?lang·?level이 안 먹는다', () => {
    // 이 계약이 지키는 것은 **동적 구조**다. 함께 얼려 뒀던 `revalidate = 60`은
    // 2026-08-31 실측에서 **런타임 효과가 0**으로 판명됐다(빌드 산출 `ƒ /lessons`,
    // 응답 헤더가 제거 전후 모두 `private, no-cache, no-store, …`). 효과 없는 그 줄이
    // "비로그인 옛 버전" 조사를 CDN 캐시 오진으로 이끌었기에 지웠다(#1077).
    // 되살아나지 않는 것은 guestLandingParity가 따로 지킨다.
    const page = read('src/app/(app)/lessons/page.jsx');

    expect(page).toContain('export default async function Page({ searchParams })');
    expect(page).toContain('const sp = await searchParams;');
    expect(page).toContain('dynamic SSR');
  });
});
