// 비로그인 「함께 읽는 글」 화면 흔들림(LIBRARY-GUEST-CLS-001). 운영 실측(2026-10-17 KST, www.manabi.co.kr /discover?view=reading):
// CLS 390폭 0.144–0.168 · 1440폭 0.018–0.028. 「오늘의 추천 자료」가 먼저 와 목록 골격(140px 6칸) 아래에 섰다가, 목록이 정해지는 순간
// 더 짧은 실제 목록으로 바뀌며 통째로 끌려 올라왔다. 목록은 reading_materials 응답 뒤에 public_book_catalog를 따로 기다렸다
// (DB 실행 0.5ms, 왕복 0.7–0.8초 직렬). 계약 = 추천은 목록이 정해진 뒤 · 책 장 메타는 목록 조회와 나란히 · 같은 응답 재사용.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { guestBookCatalogRows, withGuestBookCatalog } from '../guestBookCatalog.js';

const page = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');

describe('화면 — 추천은 목록이 정해진 뒤에만', () => {
  it('추천 칸은 목록 골격과 같은 조건(!tab || isLoading)이 풀린 뒤에 그린다', () => {
    expect(page).toContain('{(!tab || isLoading) ? (\n        <CardGridSkeleton />');
    const block = sliceBetween(page, '{/* 오늘의 추천(크론 수집)', '<h2 className="suggestions-section__title">오늘의 추천 자료</h2>');
    expect(block).toContain('{tab && !isLoading && (() => {');
    expect(block).toContain('const filteredSuggestions = filterSuggestionsByProfile(suggestions, profile);');
  });
  it('책 장 메타는 목록 조회를 기다리지 않고 먼저 출발한다', () => {
    const fetcher = sliceBetween(page, 'async function fetchMaterials(', '\nconst PAGE_SIZE');
    const start = fetcher.indexOf("const guestCatalog = tab === 'public' && !userId ? guestBookCatalogRows(supabase) : null;");
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(fetcher.indexOf('const { data, error } = await query;'));
    expect(fetcher).toContain('catalog: guestCatalog');
  });
});

describe('guestBookCatalogRows — 같은 응답을 잠시 다시 쓴다(거르기는 브라우저가 한다)', () => {
  const client = (result) => ({ rpc: vi.fn(async () => result) });
  it('같은 클라이언트 · 1분 안이면 한 번만 부르고, 1분이 지나면 다시 부른다', async () => {
    const c = client({ data: [], error: null });
    const first = guestBookCatalogRows(c, 1_000);
    expect(guestBookCatalogRows(c, 30_000)).toBe(first);
    expect(c.rpc).toHaveBeenCalledTimes(1);
    expect(c.rpc).toHaveBeenCalledWith('public_book_catalog');
    await first;
    guestBookCatalogRows(c, 62_000);
    expect(c.rpc).toHaveBeenCalledTimes(2);
  });
  it('실패한 응답은 담아 두지 않는다(다음 조회가 다시 묻는다) · 던져도 목록은 그대로', async () => {
    const c = client({ data: null, error: { code: 'PGRST202' } });
    await guestBookCatalogRows(c, 5_000);
    await guestBookCatalogRows(c, 5_001);
    expect(c.rpc).toHaveBeenCalledTimes(2);
    const broken = { rpc: vi.fn(async () => { throw new Error('offline'); }) };
    const row = { id: 1, title: 'a', created_at: '1' };
    expect(await withGuestBookCatalog(broken, [row], { catalog: guestBookCatalogRows(broken, 9_000) })).toEqual([row]);
  });
  it('받아 둔 응답(catalog)을 주면 RPC를 다시 부르지 않는다', async () => {
    const c = client({ data: [{ id: 2, title: 'Alice — I', created_at: '2', processed_json: { metadata: { language: 'English', book: { key: 'k' } } } }], error: null });
    const catalog = guestBookCatalogRows(c, 20_000);
    const merged = await withGuestBookCatalog(c, [{ id: 1, title: 'x', created_at: '1' }], { catalog });
    expect(merged.map((m) => m.id)).toEqual([2, 1]);
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
});
