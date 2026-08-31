import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildContinueManifest } from '../../content/refManifest';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('P1–P5 초기 전송 성능 수리 회귀', () => {
  it('P1: root는 실제 sans weight만 로드하고 serif는 app scope에 둔다', () => {
    const rootLayout = read('src/app/layout.jsx');
    const appLayout = read('src/app/(app)/layout.jsx');
    const css = read('src/index.css');

    expect(rootLayout).not.toContain("'300'");
    expect(rootLayout).not.toContain('Noto_Serif_KR');
    expect(rootLayout).toContain('Noto_Sans_JP');
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

  it('P5: 빈도가 낮은 전역 링크만 prefetch를 끈다', () => {
    const layout = read('src/components/Layout.jsx');

    expect(layout.split("{ href: '/home', label: '홈' }").length - 1).toBe(2);
    expect(layout.split("{ href: '/lessons',   label: '교재' }").length - 1).toBe(2);
    expect(layout.split("{ href: '/vocab',     label: '복습', prefetch: false }").length - 1).toBe(2);
    expect(layout.split("{ href: '/materials', label: '자료', prefetch: false }").length - 1).toBe(2);
    expect(layout).toContain("{ href: '/auth', label: '로그인', prefetch: false }");
    expect(layout.split('prefetch={l.prefetch}').length - 1).toBe(2);
    expect(layout).not.toContain('/review/grammar');
  });

  it('P4: home용 단일 매니페스트가 이어보기와 ProfileStats 형태를 함께 만족한다', () => {
    const page = read('src/app/(app)/home/page.jsx');
    const home = read('src/views/HomePage.jsx');
    const manifest = buildContinueManifest();

    expect(page).not.toContain('buildRefManifest');
    expect(page).toContain('<HomePage continueManifest={buildContinueManifest()} />');
    expect(home).toContain('export default function HomePage({ continueManifest = {} })');
    expect(home).toContain('<ProfileStats refManifest={continueManifest} />');
    for (const ref of Object.values(manifest)) {
      for (const level of ref.levels) {
        expect(level.key).toBeTruthy();
        expect(level.short).toBeTruthy();
        expect(level.label).toBeTruthy();
        expect(Array.isArray(level.chapters)).toBe(true);
      }
    }
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
