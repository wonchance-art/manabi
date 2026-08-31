import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

/**
 * 계약: 「비로그인이면 옛 버전이 뜬다」 수리 (#1077 · 오너 지시 2026-08-31 "해결 우선").
 *
 * ── 원인은 캐시가 아니었다
 *
 * 두 차례 조사가 SW 프리캐시와 `/lessons` CDN 캐시를 각각 1순위로 지목했으나 실측이
 * 둘 다 배제했다(SW는 network-first + activate에서 옛 캐시 전량 삭제, `/lessons`는
 * dynamic 라우트라 `Cache-Control: private, no-cache, no-store, …`).
 *
 * 진짜 원인은 **라우팅 비대칭**이었다: `/`가 쿠키를 보고 비로그인은 `/lessons`
 * (교재 목록 + 언어별 피치 카드), 로그인은 `/home`(대시보드)으로 **아예 다른 화면**을
 * 보냈다. 오너 지시로 한 곳(`/home`)으로 통일했다.
 *
 * 이 파일이 지키는 것은 **그 통일이 조용히 풀리지 않는 것**이다.
 */

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe("'/' — 로그인 여부로 갈리지 않는다", () => {
  const root = codeOf(read('src/app/page.jsx'));

  it('한 곳으로만 보낸다 — 목적지가 조건에 걸리면 다시 두 화면이 된다', () => {
    expect(root).toContain("redirect('/home')");
    // 삼항·분기가 되살아나면 실패한다(옛 형태: redirect(hasSession ? '/home' : '/lessons'))
    expect(root, "'/'가 조건부 목적지를 갖지 않는다").not.toMatch(/redirect\([^)]*\?/);
  });

  it('세션을 읽지 않는다 — 읽는 순간 갈래를 만들 재료가 생긴다', () => {
    for (const banned of ['cookies', 'auth-token', 'hasSession']) {
      expect(root, `'/'가 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });
});

describe('/home — 게스트가 와도 빈 벽이 아니다', () => {
  const home = read('src/views/HomePage.jsx');
  const guest = sliceBetween(home, '  if (!user) return (', '\n  );');

  it('게스트가 들어갈 문이 남아 있다 — 전에 가던 교재로 가는 길이 끊기면 안 된다', () => {
    // 통일 전 게스트는 /lessons(교재 목록)를 첫 화면으로 받았다. 로그인 벽만 세우면
    // "볼 것이 있던 화면"이 "볼 것 없는 화면"으로 나빠진다 — 그건 수리가 아니다.
    expect(guest).toContain('href="/lessons"');
    expect(guest).toContain('href="/materials"');
    expect(guest).toContain('href="/auth"');
  });

  it('로그인은 권유일 뿐 관문이 아니다', () => {
    expect(guest, '"로그인이 필요합니다"만 남기면 게스트가 막힌다').not.toContain('로그인이 필요합니다');
  });
});

describe('/lessons — 효과 없던 revalidate가 되살아나지 않는다', () => {
  const lessons = read('src/app/(app)/lessons/page.jsx');

  it('dynamic 라우트에 캐시 선언을 달지 않는다 — 그 한 줄이 조사를 오진으로 이끌었다', () => {
    // 실측: searchParams를 await하므로 빌드 산출이 `ƒ /lessons`(Dynamic)이고 응답은
    // no-store다. revalidate는 아무 효과가 없으면서 CDN 캐시 용의자로 오해만 샀다.
    expect(codeOf(lessons), 'revalidate가 되살아나면 같은 오진이 반복된다')
      .not.toMatch(/export const revalidate/);
    expect(lessons).toContain('await searchParams');   // 동적 판정의 근거가 사라지면 전제가 바뀐다
  });

  it('판정 근거를 주석으로 남긴다 — 세 번째 조사자가 또 캐시를 의심하지 않게', () => {
    expect(lessons).toContain('no-store');
    expect(lessons).toContain('#1077');
  });
});
