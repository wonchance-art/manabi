import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 페이지 Suspense의 fallback(2026-10-17 KST 실측): 자식이 useSearchParams를 쓰면 서버 HTML이 비고(BAILOUT_TO_CLIENT_SIDE_RENDERING)
// JS가 붙을 때까지 빈 화면이었다 — /conversation/new 직접 진입. 앱 공통 대기 화면(app/(app)/loading.jsx)을 같이 쓴다.
const APP = path.resolve(__dirname, '../../app');
const pages = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return pages(full);
  return entry.name === 'page.jsx' ? [full] : [];
});

describe('페이지 Suspense는 빈 화면을 남기지 않는다', () => {
  const withSuspense = pages(APP).filter((file) => fs.readFileSync(file, 'utf8').includes('<Suspense'));
  // 추천 읽을거리(/suggestions/[id])는 GUEST-STATIC-001 6단계부터 리더가 searchParams를 읽지 않는 ISR 판이라 Suspense가 없다
  // (돌아갈 곳은 판이 넘긴다 — src/lib/__tests__/suggestionPageStatic.test.jsx).
  it('대상 페이지가 있다(검사가 빈 목록을 통과하지 않게)', () => {
    expect(withSuspense.map((file) => path.relative(APP, file))).toEqual(expect.arrayContaining([
      '(app)/conversation/new/page.jsx', '(app)/materials/add/page.jsx']));
  });
  it.each(withSuspense.map((file) => [path.relative(APP, file), file]))('%s — 모든 <Suspense>에 fallback', (_, file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source.match(/<Suspense(?=[\s>])[^>]*>/g).filter((tag) => !tag.includes('fallback='))).toEqual([]);
  });
});
