import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
  const guest = home;

  it('게스트가 들어갈 문이 남아 있다 — 전에 가던 교재로 가는 길이 끊기면 안 된다', () => {
    // 통일 전 게스트는 /lessons(교재 목록)를 첫 화면으로 받았다. 로그인 벽만 세우면
    // "볼 것이 있던 화면"이 "볼 것 없는 화면"으로 나빠진다 — 그건 수리가 아니다.
    // 배움(LEARN-HOME-AK-001): 게스트도 이어 읽기 칸으로 발행 교재 첫 페이지에 들어가고, 교재 정보를 못 받으면 교재 목록으로 간다.
    // 서재 · 산책은 메뉴가 늘 연다. 로그인은 「로그인하면 여기에 쌓여요」 칸의 권유일 뿐이다.
    expect(guest).toContain('bookHref(book.edition, resume.page)');
    expect(guest).toContain("href: '/lessons'");
    // 로그인 권유는 정본 진입(authEntryHref)으로 — 로그인 뒤 배움으로 돌아온다(맨 /auth 금지 계약: authReturnLinks.test.js).
    expect(guest).toContain("<GuestLoginTile href={authEntryHref('/home')} />");
    // 칸 글은 손님 화면과 손님 대기 화면(B1)이 함께 쓰는 GuestLoginTile에 있다.
    expect(read('src/components/learn/LearnTiles.jsx')).toContain('로그인하면 여기에 쌓여요');
    expect(guest).not.toContain('if (!user) return');
  });

  it('로그인은 권유일 뿐 관문이 아니다', () => {
    expect(guest, '"로그인이 필요합니다"만 남기면 게스트가 막힌다').not.toContain('로그인이 필요합니다');
  });
});

describe('/lessons — 캐시 선언은 실제로 효과가 있을 때만 단다(#1077 판정의 다음 판)', () => {
  // 옛 판(2026-08-31): /lessons는 searchParams를 await해 동적(ƒ)이었고 응답은 no-store였다. revalidate 한 줄은 아무 효과가 없으면서
  // CDN 캐시 용의자로 오해만 샀다(「옛 버전이 뜬다」 조사 오진). 그래서 「동적 라우트에 캐시 선언을 달지 않는다 · 판정 근거를 주석으로 남긴다」를 지켰다.
  // 그 계약의 뜻은 둘이다 — ⑴ 선언과 실제가 어긋나지 않는다 ⑵ 다음 조사자가 무엇을 먼저 볼지 안다.
  // 새 판(GUEST-STATIC-001 3단계, 2026-10-23 KST): 동적 재료(쿠키 세션 조회 · searchParams)를 걷어 내 ISR이 실제로 효과가 있다. 같은 뜻을 이렇게 지킨다.
  const lessons = read('src/app/(app)/lessons/page.jsx');
  const shelf = read('src/components/books/LessonsShelf.jsx');
  const langPage = read('src/app/(app)/lessons/lang/[lang]/page.jsx');

  it('⑴ 선언(revalidate 3600)과 빌드 산출 대조표가 같은 값이고, 대조가 CI에서 돈다 — 선언만 있고 효과가 없는 상태를 산출로 막는다', async () => {
    const { STATIC_ROUTES } = await import('@/lib/staticRoutes');
    expect(codeOf(lessons)).toMatch(/export const revalidate = 3600;/);
    expect(codeOf(langPage)).toMatch(/export const revalidate = 3600;/);
    expect(STATIC_ROUTES).toContainEqual({ route: '/lessons', revalidate: 3600 });
    expect(STATIC_ROUTES).toContainEqual({ route: '/lessons/lang/[lang]', revalidate: 3600 });
    expect(read('.github/workflows/ci.yml')).toContain('run: node scripts/check-static-routes.mjs');
  });

  it('⑴ 동적 재료를 읽지 않는다 — 읽는 순간 선언이 다시 무효가 된다(옛 오진의 조건)', () => {
    for (const [name, src] of [['page', lessons], ['LessonsShelf', shelf], ['lang page', langPage]]) {
      expect(codeOf(src), name).not.toMatch(/searchParams|next\/headers|force-dynamic|createSupabaseServerClient/);
    }
    // 발행 판본은 쿠키 없는 공개 클라이언트로(발행 · 판본 표는 RLS using (true) — 누구에게나 같은 행)
    expect(shelf).toContain('const client = createSupabasePublicClient();');
    expect(shelf).toContain('publishedReadingWith(client, undefined, false, bookId)');
    // 옛 ?lang 링크 · 단어 목록의 「← 교재」는 언어 판으로 — 첫 그림부터 그 언어가 골라져 있다(쿼리를 화면이 읽지 않는다)
    expect(read('src/middleware.js')).toContain('? rewriteTo(request, `/lessons/lang/${lang}`) : NextResponse.next();');
    expect(langPage).toContain('return <LessonsShelf lang={lang} />;');
  });

  it('⑵ 판정 근거를 주석으로 남긴다 — 「옛 버전」 보고가 오면 판 수명(1시간)과 발행 즉시 무효화를 먼저 본다', () => {
    expect(lessons).toContain('#1077');
    expect(lessons).toContain('revalidatePath');
    // 발행 · 복원하면 책장 판(기본 · 언어)을 바로 버린다 — 판 수명 1시간이 발행 반영을 늦추지 않게
    const publish = read('src/app/api/admin/books/japanese-n5/route.js');
    expect(publish).toContain("revalidatePath('/lessons');");
    expect(publish).toContain("revalidatePath('/lessons/lang/[lang]', 'page');");
  });
});
