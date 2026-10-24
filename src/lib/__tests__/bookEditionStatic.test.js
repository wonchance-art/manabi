// GUEST-STATIC-001 5단계 — `?edition=<저장소 판본 id>` 하나뿐인 교재 요청은 판본별 판(ISR 3600, /books/<책>/edition/<id>/<guest|member>).
//  · 판정(middleware, DB 없음): 쿼리 키가 정확히 edition 하나 · 값이 그 책의 저장소 판본(BUNDLED_EDITIONS)일 때만. 그 밖은 동적 화면 그대로.
//  · 판은 주소의 그 판본을 그린다(현재 발행본으로 바꾸지 않는다 — 진도 · 답안 · 앵커가 판본 키) · 발행 도장 없는 판본은 손님과 같은 안내(미리보기 없음).
//  · 관리자 미리보기는 표식(&preview=1 — 쿼리 둘)으로 동적 화면에 남는다(d2-i). 학습자 주소에는 붙지 않는다.
//  · 판본 표는 저장소 판본 폴더와 같아야 한다(generateStaticParams가 이 표로 굽는다 — 빠진 판본은 동적, 남은 판본은 없는 파일을 구우려 한다).
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';

const { createServerClient } = vi.hoisted(() => ({ createServerClient: vi.fn(() => { throw new Error('교재 갈래에서 Supabase 클라이언트를 만들었다'); }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
vi.mock('@/components/books/BookCoverStatic', () => ({ default: () => null, COVER_HINTS: Object.freeze(['guest', 'member']), BOOK_METADATA: {} }));
import { config, middleware } from '@/middleware';
import { BUNDLED_EDITIONS, isBundledEdition } from '@/lib/textbook/bundledEditions';
import { STATIC_ROUTES } from '@/lib/staticRoutes';
import { EDITION_ID, bookHref, previewBookHref } from '@/lib/textbook/contract';
import { safeBookReturn } from '@/lib/reviewScopeUrl';

const ROOT = process.cwd();
const EDITIONS_DIR = path.join(ROOT, 'src/content/textbookEditions');
const BOOKS = ['japanese-n5', 'japanese-n4', 'japanese-n3'];
const SESSION = 'sb-e2e-auth-token=base64-x';
const run = (url, cookie) => middleware(new NextRequest(new URL(url, 'https://manabi.test'), { headers: cookie ? { cookie } : {} }));
const rewrite = (res) => { const to = res.headers.get('x-middleware-rewrite'); return to ? new URL(to).pathname + new URL(to).search : null; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const page = (book) => `src/app/(app)/books/${book}/edition/[edition]/[hint]/page.jsx`;

describe('판본 표 = 저장소 판본 폴더', () => {
  const bundles = fs.readdirSync(EDITIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(EDITIONS_DIR, d.name, 'bundle.json')))
    .map(d => ({ dir: d.name, ...JSON.parse(fs.readFileSync(path.join(EDITIONS_DIR, d.name, 'bundle.json'), 'utf8')) }));
  it('번들 폴더(bookId · editionId)와 표가 책마다 같다 — 폴더 이름 = editionId', () => {
    expect(bundles.length, '공허 통과 방지').toBeGreaterThanOrEqual(3);
    for (const bundle of bundles) expect(bundle.editionId, bundle.dir).toBe(bundle.dir);
    const fromDisk = {};
    for (const { bookId, editionId } of bundles) (fromDisk[bookId] ||= []).push(editionId);
    const sorted = (table) => Object.fromEntries(Object.entries(table).map(([book, ids]) => [book, [...ids].sort()]).sort(([a], [b]) => a.localeCompare(b)));
    expect(sorted(BUNDLED_EDITIONS)).toEqual(sorted(fromDisk));
    for (const ids of Object.values(BUNDLED_EDITIONS)) for (const id of ids) expect(id).toMatch(EDITION_ID);
  });
  it('책마다 판본 목록(index.json)의 현재 · 검수 후보는 표 안에 있다', () => {
    const indexes = { 'japanese-n5': 'index.json', 'japanese-n4': 'japanese-n4/index.json', 'japanese-n3': 'japanese-n3/index.json' };
    for (const [book, file] of Object.entries(indexes)) {
      const index = JSON.parse(fs.readFileSync(path.join(EDITIONS_DIR, file), 'utf8'));
      for (const id of [index.current, ...(index.reviewCandidates || [])]) expect(BUNDLED_EDITIONS[book], `${book} ${id}`).toContain(id);
    }
  });
  it('세 책 모두 표에 있고 다른 책의 판본 id는 그 책이 아니다', () => {
    expect(Object.keys(BUNDLED_EDITIONS).sort()).toEqual([...BOOKS].sort());
    expect(isBundledEdition('japanese-n4', BUNDLED_EDITIONS['japanese-n5'][0])).toBe(false);
    expect(isBundledEdition('constructor', 'x')).toBe(false);
    expect(isBundledEdition('japanese-n5', undefined)).toBe(false);
  });
});

describe('판본별 판 갈래(middleware)', () => {
  it('?edition=<그 책의 저장소 판본> 하나뿐 → 판본별 판(세션 쿠키 이름 유무로 guest / member) · 판 경로의 쿼리는 비운다', async () => {
    for (const book of BOOKS) for (const id of BUNDLED_EDITIONS[book]) {
      expect(rewrite(await run(`/books/${book}?edition=${id}`)), `${book} ${id}`).toBe(`/books/${book}/edition/${id}/guest`);
      expect(rewrite(await run(`/books/${book}?edition=${id}`, SESSION))).toBe(`/books/${book}/edition/${id}/member`);
      expect(rewrite(await run(`/books/${book}?edition=${id}`, 'sb-e2e-auth-token-code-verifier=x'))).toBe(`/books/${book}/edition/${id}/guest`);
    }
  });
  it('그 밖은 동적 화면 그대로 — 미리보기 표식 · 참고 열람 · 돌아가기 · 모르는 id · 다른 책 판본 · 중복 키 · 대문자 · 빈 값 · utm', async () => {
    const id = BUNDLED_EDITIONS['japanese-n5'][0];
    const queries = [`?edition=${id}&preview=1`, `?edition=${id}&reference=1`, `?edition=${id}&returnTo=%2Flessons`, `?edition=${id}&utm_source=x`,
      `?edition=${id}&edition=${id}`, `?edition=${id.toUpperCase()}`, '?edition=000000000000000000000000', `?edition=${BUNDLED_EDITIONS['japanese-n4'][0]}`, '?edition=', `?preview=1&edition=${id}`];
    for (const query of queries) for (const cookie of [undefined, SESSION]) {
      const res = await run(`/books/japanese-n5${query}`, cookie);
      expect(rewrite(res), query).toBeNull();
      expect(res.headers.get('x-middleware-next'), query).toBe('1');
    }
  });
  it('판 경로(/books/*/edition/*)는 matcher 밖 · Set-Cookie 없음 · Supabase 클라이언트 없음', async () => {
    expect(config.matcher.filter(m => m.includes('/edition'))).toEqual([]);
    for (const cookie of [undefined, SESSION]) expect((await run(`/books/japanese-n5?edition=${BUNDLED_EDITIONS['japanese-n5'][0]}`, cookie)).headers.get('set-cookie')).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe('판 — 쿠키 · searchParams를 읽지 않는 ISR 3600, 주소의 판본 그대로 · 미리보기 없음', () => {
  it('고정표에 세 책의 판본별 판(ISR 3600)', () => {
    const table = Object.fromEntries(STATIC_ROUTES.map(({ route, revalidate }) => [route, revalidate]));
    for (const book of BOOKS) expect(table[`/books/${book}/edition/[edition]/[hint]`], book).toBe(3600);
  });
  it('판본 표 × 판 이름 둘만 굽는다(dynamicParams false) — 쿠키 · 헤더 · searchParams · force-dynamic 없음', async () => {
    for (const book of BOOKS) {
      const src = code(page(book));
      expect(src).toContain('export const revalidate = 3600;');
      expect(src).toContain('export const dynamicParams = false;');
      expect(src).toContain(`BUNDLED_EDITIONS['${book}']`);
      expect(src).toContain(`<BookCoverStatic bookId="${book}" edition={edition} member={hint === 'member'} />`);
      expect(src).not.toMatch(/searchParams|next\/headers|force-dynamic|requireAdmin|createSupabaseServerClient/);
      const mod = await import(`@/app/(app)/books/${book}/edition/[edition]/[hint]/page.jsx`);
      expect(mod.generateStaticParams()).toEqual(BUNDLED_EDITIONS[book].flatMap(edition => ['guest', 'member'].map(hint => ({ edition, hint }))));
    }
  });
  it('판 본문은 표지 판과 같은 부품 — 주소의 판본을 공개 클라이언트로(발행 도장 없으면 안내), 미리보기 · 관리자 확인 없음', () => {
    const cover = code('src/components/books/BookCoverStatic.jsx');
    expect(cover).toContain('export default async function BookCoverStatic({ bookId, member, edition = undefined })');
    expect(cover).toContain('publishedReadingWith(db, edition, false, bookId)');
    expect(cover).not.toMatch(/requireAdmin|createSupabaseServerClient|preview=\{/);
    // 발행 도장이 없으면(미리보기 허용 없음) 404 — publishedOrNull이 안내로 바꾼다(동적 화면의 손님도 requireAdmin 실패로 같은 안내).
    expect(read('src/lib/server/publishedBook.js')).toContain("if (!allowPreview || !requireAdmin) throw textbookError(404, '공개된 교재를 준비하고 있어요.');");
  });
  it('발행 · 복원 POST가 판본별 판도 무효화한다(도장 없이 구운 안내 판이 발행 즉시 그 판본을 그리게)', () => {
    expect(read('src/app/api/admin/books/japanese-n5/route.js')).toContain("revalidatePath(`/books/${bookId}/edition/[edition]/[hint]`,'page');");
  });
  it('CI 재생성(e2e-refresh-isr /books)은 판본별 판도 포함한다 — 발행 상태를 바꿔 띄운 N3 · N4 서버', () => {
    const ci = read('.github/workflows/ci.yml');
    for (const port of [8879, 8880]) expect(ci).toContain(`node scripts/e2e-refresh-isr.mjs http://127.0.0.1:${port} /lessons /books`);
  });
});

describe('관리자 미리보기 표식(d2-i) — 미리보기 안 교재 주소에만, 학습자 주소는 그대로', () => {
  it('previewBookHref는 쿼리를 둘로 만든다(판본 · 쪽 그대로) — 저장 · 돌아가기 주소(safeBookReturn)로는 쓰이지 않는다', () => {
    const href = bookHref('8a8c1c1fd452773810abaf8c', 'u03-study1', 'japanese-n4');
    expect(previewBookHref(href)).toBe('/books/japanese-n4?edition=8a8c1c1fd452773810abaf8c&preview=1#u03-study1');
    expect(previewBookHref(previewBookHref(href))).toBe(previewBookHref(href));
    expect(bookHref('8a8c1c1fd452773810abaf8c')).toBe('/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#cover');
    expect(safeBookReturn(previewBookHref(href))).toBeNull();
  });
  it('관리자 「검수용 교재 열기」는 표식, 발행 기록(도장 있는 판본)은 표식 없음', () => {
    const editor = code('src/components/books/BookEditor.jsx');
    expect(editor).toContain('href={previewBookHref(bookHref(data.candidate.editionId))}');
    expect(editor).toContain('<Link href={bookHref(h.edition_id)} target="_blank">');
  });
  it('미리보기 안의 교재 주소(표지 목차 · 책 안 이동 · 담은 표현 · 함께 읽기)는 preview일 때만 표식', () => {
    expect(code('src/components/books/BookHome.jsx')).toContain('return preview ? previewBookHref(href) : href;');
    const reader = code('src/components/books/BookReader.jsx');
    expect(reader).toContain("if(preview)destination.searchParams.set('preview','1');");
    expect(reader).toContain('return preview ? previewBookHref(linked) : linked;');
    expect(code('src/components/books/BookReview.jsx')).toContain('const readerLink = href => preview ? previewBookHref(href) : href;');
    expect(code('src/components/books/BookMaterials.jsx')).toContain('return preview ? previewBookHref(href) : href;');
    // 표식이 서버 판정을 바꾸지 않는다 — 동적 화면은 preview 쿼리를 읽지 않는다(미리보기 여부는 발행 도장 · 관리자 확인).
    for (const book of BOOKS) expect(code(`src/app/(app)/books/${book}/page.jsx`)).not.toMatch(/params\?\.preview/);
  });
});
