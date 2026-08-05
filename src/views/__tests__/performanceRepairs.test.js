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
    expect(css.split('var(--font-serif)').length - 1).toBe(15);
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

  it('P3: dynamic searchParams 구조와 revalidate 값은 그대로 두고 설명만 바로잡는다', () => {
    const page = read('src/app/(app)/lessons/page.jsx');

    expect(page).toContain('export const revalidate = 60;');
    expect(page).toContain('export default async function Page({ searchParams })');
    expect(page).toContain('const sp = await searchParams;');
    expect(page).toContain('현재 구조는 dynamic SSR이다');
  });
});
