// GUEST-STATIC-001 4단계 — 배움(/home)과 교재 첫 화면(/books/<책>, 쿼리 없음)은 쿠키 유무 판(ISR 3600). 갈래는 middleware가 나눈다:
//  · /home        → 세션 쿠키 이름 유무(손님 /home · 로그인 /home/member) × 간체 힌트(/sc) — 계정 데이터 없음, 로그인한 모두가 같은 판
//  · /books/<책>  → 쿼리가 하나라도 있으면 동적 화면 그대로(관리자 미리보기 ?edition=<미발행>은 계정별 응답 — 공유 캐시에 넣으면 미발행 원고가 손님에게 나간다),
//                   쿼리 없음만 표지 판(/books/<책>/cover/guest · member)
//  · 판 경로는 matcher 밖(2단계 실측: rewrite된 요청이 middleware를 다시 지나 되돌리면 307 루프). 판은 쿠키 · 헤더 · searchParams를 읽지 않는다(staticSegments.test.js).
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn(() => { throw new Error('교재 갈래에서 Supabase 클라이언트를 만들었다'); }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
import { config, middleware } from '@/middleware';
import { STATIC_ROUTES } from '@/lib/staticRoutes';
import { sliceBetween } from './helpers/sliceBetween';
import { navigationOwner } from '@/lib/webNavigation';

const run = (url, cookie) => middleware(new NextRequest(new URL(url, 'https://manabi.test'), { headers: cookie ? { cookie } : {} }));
const rewrite = (res) => { const to = res.headers.get('x-middleware-rewrite'); return to ? new URL(to).pathname + new URL(to).search : null; };
const read = (f) => fs.readFileSync(f, 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const BOOKS = ['japanese-n5', 'japanese-n4', 'japanese-n3'];
const SESSION = 'sb-e2e-auth-token=base64-x';

describe('교재 첫 화면 갈래(middleware)', () => {
  it('쿼리 없음만 표지 판 — 세션 쿠키 이름 유무로 guest / member', async () => {
    for (const book of BOOKS) {
      expect(rewrite(await run(`/books/${book}`))).toBe(`/books/${book}/cover/guest`);
      expect(rewrite(await run(`/books/${book}`, SESSION))).toBe(`/books/${book}/cover/member`);
      expect(rewrite(await run(`/books/${book}`, 'sb-e2e-auth-token-code-verifier=x'))).toBe(`/books/${book}/cover/guest`);
    }
  });
  it('쿼리가 하나라도 있으면 동적 화면 그대로 — 미리보기 · 참고 자료 · 돌아가기 · 그 밖(utm 등), 손님 · 로그인 모두', async () => {
    for (const query of ['?edition=8a8c1c1fd452773810abaf8c', '?edition=000000000000000000000000', '?reference=1', '?returnTo=%2Fmaterials', '?utm_source=x', '?edition=']) {
      for (const cookie of [undefined, SESSION]) {
        const res = await run(`/books/japanese-n5${query}`, cookie);
        expect(rewrite(res), query).toBeNull();
        expect(res.headers.get('x-middleware-next'), query).toBe('1');
      }
    }
  });
  it('담은 표현 · 함께 읽기(하위 화면)는 middleware를 타지 않는다 — matcher에 책 첫 화면 셋만', () => {
    for (const book of BOOKS) expect(config.matcher).toContain(`/books/${book}`);
    expect(config.matcher.filter(m => m.startsWith('/books/') && !BOOKS.some(b => m === `/books/${b}`))).toEqual([]);
  });
});

describe('판 경로는 matcher 밖 · middleware는 쿠키를 쓰지 않는다', () => {
  it('판 경로(/home/* · /books/*/cover/*)는 matcher에 없다 — 다시 지나며 되돌리지 않게', () => {
    expect(config.matcher).toContain('/home');
    expect(config.matcher.filter(m => m.startsWith('/home/') || m.includes('/cover'))).toEqual([]);
  });
  it('미리 구운 판 HTML(판 경로로 그림)과 첫 그림(주소 /home · /books/…)이 같은 메뉴를 가리킨다 — aria-current 하이드레이션 불일치 방지', () => {
    for (const p of ['/home', '/home/member', '/home/sc', '/home/member/sc', '/books/japanese-n5', '/books/japanese-n5/cover/member']) expect(navigationOwner(p), p).toBe('/home');
    expect(navigationOwner('/homework')).toBeNull();
  });
  it('Set-Cookie 없음 · Supabase 클라이언트 없음', async () => {
    for (const url of ['/home', '/books/japanese-n5', '/books/japanese-n5?edition=x']) for (const cookie of [undefined, SESSION]) {
      expect((await run(url, cookie)).headers.get('set-cookie'), url).toBeNull();
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe('판 — 쿠키 · searchParams를 읽지 않는 ISR 3600, 미리보기 없음', () => {
  it('고정표에 배움 넷 · 표지 셋(ISR 3600)', () => {
    const table = Object.fromEntries(STATIC_ROUTES.map(({ route, revalidate }) => [route, revalidate]));
    for (const route of ['/home', '/home/sc', '/home/member', '/home/member/sc', ...BOOKS.map(b => `/books/${b}/cover/[hint]`)]) expect(table[route], route).toBe(3600);
  });
  it('표지 판: 판 이름 둘만 굽고(dynamicParams false) 발행 판본만 공개 클라이언트로 — requireAdmin · 쿠키 세션 · ?edition 없음', () => {
    for (const book of BOOKS) {
      const page = code(`src/app/(app)/books/${book}/cover/[hint]/page.jsx`);
      expect(page).toContain('export const revalidate = 3600;');
      expect(page).toContain('export const dynamicParams = false;');
      expect(page).not.toMatch(/searchParams|next\/headers|force-dynamic/);
    }
    const cover = code('src/components/books/BookCoverStatic.jsx');
    expect(cover).toContain('publishedReadingWith(db, undefined, false, bookId)');
    expect(cover).not.toMatch(/requireAdmin|createSupabaseServerClient|bookReading'|preview=\{|edition\s*[:=]\s*params/);
    expect(read('src/components/books/BookCoverStatic.jsx')).toContain("export const COVER_HINTS = Object.freeze(['guest', 'member']);");
  });
  it('쿼리가 붙은 교재 화면은 동적 그대로 — 미리보기 응답은 계정별(쿠키 관리자 확인)', () => {
    for (const book of BOOKS) {
      const page = read(`src/app/(app)/books/${book}/page.jsx`);
      expect(page).toContain("export const dynamic = 'force-dynamic';");
      expect(page).toMatch(/await publishedReading\(params\?\.edition, true/);
    }
  });
  it('정적 판의 교재 부품은 주소(useSearchParams)를 읽지 않는다 — 읽으면 표지 HTML이 비어(CSR bailout) 붙은 뒤에야 그려진다', () => {
    expect(sliceBetween(code('src/components/books/BookReader.jsx'), 'export function BookReaderView(', null)).not.toContain('useSearchParams(');
    expect(code('src/components/books/BookHome.jsx')).not.toContain('useSearchParams');
    expect(sliceBetween(code('src/components/web/LibraryReturnLink.jsx'), 'export function LibraryReturnLinkTo(', null)).not.toContain('useSearchParams(');
    expect(code('src/components/books/BookCoverStatic.jsx')).toContain('<BookReaderView ');
  });
  it('판 실패를 굳히지 않는다 — 다시 만들 때 발행 아닌 실패(503 · 연결)는 던져 앞 판을 두고, 발행 안 함(404) · 빌드 때는 그린다', () => {
    expect(read('src/lib/server/publishedBook.js')).toContain("if (error?.status !== 404 && process.env.NEXT_PHASE !== 'phase-production-build') throw error;");
    expect(code('src/components/learn/HomeVariant.jsx')).toContain('await publishedOrNull(');
    expect(code('src/components/books/BookCoverStatic.jsx')).toContain('await publishedOrNull(');
  });
});

describe('발행하면 판을 바로 버린다 · e2e는 발행 상태를 바꿔 띄운 서버에서 판을 새로 만든다', () => {
  it('발행 · 복원 POST가 책장과 함께 표지 판 · 배움 판(N5)을 무효화한다', () => {
    const route = read('src/app/api/admin/books/japanese-n5/route.js');
    expect(route).toContain("revalidatePath(`/books/${bookId}/cover/[hint]`,'page');if(bookId===BOOK_ID)revalidatePath('/home','layout');");
  });
  it('CI N3 · N4 서버는 책장과 함께 /books 판을 새로 만든다', () => {
    const ci = read('.github/workflows/ci.yml');
    for (const port of [8879, 8880]) expect(ci).toContain(`node scripts/e2e-refresh-isr.mjs http://127.0.0.1:${port} /lessons /books`);
  });
});
