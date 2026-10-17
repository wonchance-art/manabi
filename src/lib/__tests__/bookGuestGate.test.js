import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { withGuestBookCatalog } from '../guestBookCatalog.js';
import { indexFromRows, isProtectedBookMetadata, materialBelongsToTeam } from '../server/classIndex.js';
import { sliceBetween } from './helpers/sliceBetween';

// 비로그인은 책 목록만 보고, 여는 것은 로그인 뒤(BOOK-GUEST-GATE-1, 오너 「권장대로 진행」 2026-10-16 KST).
// 막는 자리는 DB다(화면만 막으면 개발자 도구로 본문이 보인다) — 실제 PostgreSQL 검증은 supabase/tests/anon-book-catalog.mjs(CI).
// 여기서는 목록 합치기 동작과 화면 배선을 고정한다.

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const client = (data, error = null) => ({ rpc: async (name) => (name === 'public_book_catalog' ? { data, error } : { data: null, error: { message: 'unexpected' } }) });
const book = (id, title, created_at, metadata = {}) => ({ id, title, created_at, visibility: 'public', owner_id: 'o',
  processed_json: { status: 'completed', metadata: { language: 'English', level: 'B1 중급', book: { key: 'se-alice', title: 'Alice', order: id, total: 2 }, ...metadata } } });

describe('목록 합치기 — 공개 책 장 메타를 낱개 공개 글과 함께', () => {
  const article = { id: 9, title: 'A short article', created_at: '2026-10-16T04:00:00+00:00', processed_json: { status: 'completed', metadata: { language: 'English' } } };
  it('책 장 메타를 붙이고 만든 때 최신순 — 목록 조회가 이미 받은 행(id)이 이긴다', async () => {
    const full = { ...book(1, 'Alice — I', '2026-10-16T01:00:00+00:00'), raw_text: 'full' };
    const merged = await withGuestBookCatalog(client([book(2, 'Alice — II', '2026-10-16T02:00:00+00:00'), book(1, 'Alice — I', '2026-10-16T01:00:00+00:00')]), [article, full]);
    expect(merged.map((row) => row.id)).toEqual([9, 2, 1]);
    expect(merged.find((row) => row.id === 1).raw_text).toBe('full');
  });
  it('목록 조회와 같은 거르기 — 시리즈 제목 · 언어 · 레벨 · 제목 검색', async () => {
    const data = [book(1, 'Alice — I', '1'), book(2, '[N5 #1] 시리즈', '2'), book(3, 'Holmes — I', '3', { language: 'Japanese' }), book(4, 'Carol — I', '4', { level: 'B2 상급' })];
    expect((await withGuestBookCatalog(client(data), [])).map((row) => row.id)).toEqual([4, 3, 1]);
    expect((await withGuestBookCatalog(client(data), [], { langFilter: 'English' })).map((row) => row.id)).toEqual([4, 1]);
    expect((await withGuestBookCatalog(client(data), [], { levelFilter: 'B2 상급' })).map((row) => row.id)).toEqual([4]);
    expect((await withGuestBookCatalog(client(data), [], { searchQuery: 'aLiCe' })).map((row) => row.id)).toEqual([1]);
  });
  it('함수가 없거나 실패하면 목록 그대로(책 카드만 빠진다)', async () => {
    expect(await withGuestBookCatalog(client(null, { code: 'PGRST202' }), [article])).toEqual([article]);
    expect(await withGuestBookCatalog(client(undefined), [article])).toEqual([article]);
  });
});

describe('DB — anon 제한 정책 + 메타만 주는 함수', () => {
  const sql = read('supabase/migrations/20261016150000_anon_book_catalog.sql');
  it('anon만 · 제한(RESTRICTIVE) · 책 = metadata.book.key가 비어 있지 않은 자료', () => {
    expect(sql).toContain('AS RESTRICTIVE FOR SELECT TO anon');
    expect(sql).toContain("USING (NULLIF(processed_json #>> '{metadata,book,key}', '') IS NULL)");
  });
  it('함수는 공개 책 장의 메타만 — 본문(raw_text) · 분석(sequence · dictionary)을 고르지 않는다', () => {
    const body = sliceBetween(sql, 'CREATE OR REPLACE FUNCTION public.public_book_catalog', '$$;');
    expect(body).toContain("WHERE m.visibility = 'public'");
    for (const banned of ['raw_text', 'sequence', 'dictionary', 'm.processed_json,', 'm.processed_json AS', '#> \'{metadata}\'']) expect(body).not.toContain(banned);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.public_book_catalog(bigint) FROM PUBLIC;');
  });
  it('CI가 실제 PostgreSQL 검증을 돌린다', () => {
    expect(read('.github/workflows/ci.yml')).toContain('node supabase/tests/anon-book-catalog.mjs');
  });
});

describe('화면 배선', () => {
  it('서재: 비로그인 「함께 읽는 글」만 메타로 책 카드를 채우고, 책 카드는 「로그인하고 읽기」(첫 장으로 돌아옴)', () => {
    const page = read('src/views/MaterialsPage.jsx');
    expect(page).toContain("const guestCatalog = tab === 'public' && !userId ? guestBookCatalogRows(supabase) : null;");
    expect(page).toContain("const rows = guestCatalog ? await withGuestBookCatalog(supabase, data || [], { langFilter, levelFilter, searchQuery, catalog: guestCatalog }) : data || [];");
    expect(page).toContain('footer={!user ? (');
    expect(page).toContain('<Link href={authEntryHref(`/viewer/${b.chapters[0]?.id}`)} className="btn btn--primary btn--sm">로그인하고 읽기</Link>');
  });
  it('뷰어: 비로그인 + 숨겨진 공개 책 장 → 「로그인이 필요해요」(로그인 후 같은 장), 일반 「찾을 수 없어요」보다 먼저', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("const guestBookGate = !user && error?.code === 'NOT_FOUND' && /^\\d+$/.test(String(id));");
    expect(viewer).toContain("supabase.rpc('public_book_catalog', { p_id: Number(id) })");
    const gate = sliceBetween(viewer, 'if (guestBookGate && guestBook) {', '\n  }\n');
    expect(gate).toContain('vt("로그인이 필요해요")');
    expect(gate).toContain('<Link href={authEntryHref(`/viewer/${id}`)} className="btn btn--primary">{vt("로그인")}</Link>');
    expect(gate).not.toMatch(/processed_json|raw_text/u);
    expect(viewer.indexOf('if (guestBookGate && guestBook) {')).toBeLessThan(viewer.indexOf('  if (error) {\n    const isNotFound'));
    expect(viewer).toContain("useEffect(() => { if (user?.id && error?.code === 'NOT_FOUND') refetch(); }, [user?.id, error?.code, refetch]);");
  });
  it('뷰어 오프라인 사본: 로그아웃 뒤에는 책 장 사본을 열지 않는다', () => {
    const fetcher = sliceBetween(read('src/views/ViewerPage.jsx'), 'async function fetchMaterial(id) {', '\n}\n');
    expect(fetcher).toContain('if (getBook(cached.processed_json?.metadata) && !(await supabase.auth.getSession()).data?.session) throw err;');
  });
});

describe('팀 화면 — 수업 암호로 열려도 정본 책은 내주지 않는다(오너 「팀 화면 접근은 가능해도 정본 책 접근은 못하도록」)', () => {
  const root = { id: 1, owner_id: 'admin' };
  const team = { key: 'tm1', bookKey: 'se-alice' };
  const row = (id, provider) => ({ id, owner_id: 'admin', title: `ch${id}`, raw_text: 'text', processed_json: { status: 'completed',
    metadata: { book: { key: 'se-alice', title: 'Alice', order: id, total: 3 }, ...(provider ? { literature: { provider } } : {}) } } });
  it('정본(青空文庫 · Standard Ebooks) · 그림 큐레이션 책만 막는다 — 사용자가 만든 책은 그대로', () => {
    for (const provider of ['aozora', 'standardebooks', 'art']) expect(isProtectedBookMetadata({ literature: { provider } }), provider).toBe(true);
    for (const metadata of [{}, { book: { key: 'bk_1' } }, { literature: { provider: 'youtube' } }, undefined]) expect(isProtectedBookMetadata(metadata)).toBe(false);
  });
  it('목차에서 빠지고, 장 열기 · 출처(loadTeamMaterial)도 null', () => {
    expect(indexFromRows({ team, chapterRows: [row(1, 'standardebooks'), row(2, 'aozora'), row(3, null)] }).chapters.map((chapter) => chapter.id)).toEqual([3]);
    expect(materialBelongsToTeam(row(1, 'standardebooks'), team, root)).toBe(null);
    expect(materialBelongsToTeam(row(2, 'art'), team, root)).toBe(null);
    expect(materialBelongsToTeam(row(3, null), team, root)).toBe('chapter');
  });
  it('사본 만들기(copy 라우트)도 같은 판정으로 막는다 — RPC 전에', () => {
    const copy = read('src/app/api/class/[team]/copy/route.js');
    expect(copy).toContain("if(source&&isProtectedBookMetadata(source.metadata))return reply({error:'정본 책은 수업 자료로 열 수 없어요.'},403);");
    expect(copy.indexOf('isProtectedBookMetadata(source.metadata)')).toBeLessThan(copy.indexOf("rpc('classroom_copy_state'"));
  });
});
