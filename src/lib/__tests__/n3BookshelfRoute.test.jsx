import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 책장은 ISR 판(GUEST-STATIC-001 3단계)이라 판본 확인을 쿠키 없는 공개 클라이언트로 한다 — publishedBook.publishedReadingWith(client, …).
const services = vi.hoisted(() => ({ publishedReading: vi.fn(), readingCatalog: vi.fn(), levelTileCounts: vi.fn(), client: { anon: true } }));
vi.mock('@/lib/server/publishedBook', () => ({ publishedReadingWith: services.publishedReading, readingCatalog: services.readingCatalog }));
vi.mock('@/lib/supabaseServer', () => ({ createSupabasePublicClient: () => services.client }));
vi.mock('@/lib/levelListData', () => ({ levelTileCounts: services.levelTileCounts }));
vi.mock('@/components/books/Bookshelf', () => ({ default: function BookshelfBoundary() { return null; } }));
import LessonsShelf from '@/components/books/LessonsShelf';
import LangPage from '@/app/(app)/lessons/lang/[lang]/page';
import Bookshelf from '@/components/books/Bookshelf';
// /lessons?lang=Japanese는 middleware가 언어 판(/lessons/lang/Japanese)으로 넘기고, 그 판이 LessonsShelf에 lang을 준다.
const Page = async ({ lang }) => { const element = await LangPage({ params: Promise.resolve({ lang }) }); expect(element.type).toBe(LessonsShelf); return LessonsShelf(element.props); };

const ids = ['japanese-n5', 'japanese-n4', 'japanese-n3'];
const catalogs = Object.fromEntries(ids.map(bookId => [bookId, Object.freeze({ bookId, title: `${bookId} 공개 교재`, catalog: true })]));
const tiles = { Japanese: [{ level: 'N3', words: 25 }], Chinese: [{ level: 'HSK3', words: 30 }] };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  services.publishedReading.mockReset().mockImplementation(async (_client, _edition, _preview, bookId) => ({ book: { bookId } }));
  services.readingCatalog.mockReset().mockImplementation(book => catalogs[book.bookId]);
  services.levelTileCounts.mockReset().mockImplementation(async language => tiles[language === 'japanese' ? 'Japanese' : 'Chinese']);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('actual bookshelf route passes published courses across its client boundary', () => {
  it('starts all registered courses and both tile reads together, then passes N3 alongside N5/N4 in course order', async () => {
    const books = Object.fromEntries(ids.map(bookId => [bookId, deferred()]));
    const counts = { japanese: deferred(), chinese: deferred() };
    services.publishedReading.mockImplementation((_client, _edition, _preview, bookId) => books[bookId].promise);
    services.levelTileCounts.mockImplementation(language => counts[language].promise);
    const pending = Page({ lang: 'Japanese' });
    try {
      for (let i = 0; i < 4; i++) await Promise.resolve();
      expect(services.publishedReading.mock.calls).toEqual(ids.map(bookId => [services.client, undefined, false, bookId]));
      expect(services.levelTileCounts.mock.calls).toEqual([['japanese'], ['chinese']]);
      // Publication responses finish in a different order; the shelf order is stable.
      books['japanese-n3'].resolve({ book: { bookId: 'japanese-n3' } });
      books['japanese-n5'].resolve({ book: { bookId: 'japanese-n5' } });
      books['japanese-n4'].resolve({ book: { bookId: 'japanese-n4' } });
      counts.chinese.resolve(tiles.Chinese); counts.japanese.resolve(tiles.Japanese);
      const result = await pending;
      expect(result.type).toBe(Bookshelf);
      expect(result.props).toMatchObject({ books: ids.map(bookId => catalogs[bookId]), book: catalogs['japanese-n5'], initialLang: 'Japanese', levelTiles: tiles });
    } finally {
      for (const bookId of ids) books[bookId].resolve({ book: { bookId } });
      counts.japanese.resolve(tiles.Japanese); counts.chinese.resolve(tiles.Chinese);
      await pending.catch(() => {});
    }
  });

  it('keeps the N3 and N4 shelf entries and both tile groups when N5 is not published (404)', async () => {
    services.publishedReading.mockImplementation(async (_client, _edition, _preview, bookId) => {
      if (bookId === 'japanese-n5') throw Object.assign(new Error('publication unavailable'), { status: 404 });
      return { book: { bookId } };
    });
    const result = await Page({ lang: 'Japanese' });
    expect(result.props.books).toEqual([catalogs['japanese-n4'], catalogs['japanese-n3']]);
    expect(result.props.book).toBe(catalogs['japanese-n4']);
    expect(result.props.levelTiles).toEqual(tiles);
    expect(services.readingCatalog.mock.calls.map(([book]) => book.bookId)).toEqual(['japanese-n4', 'japanese-n3']);
  });

  it('keeps all published shelf entries when a level-tile read fails', async () => {
    services.levelTileCounts.mockImplementation(async language => {
      if (language === 'chinese') throw new Error('tile count unavailable');
      return tiles.Japanese;
    });
    const result = await Page({ lang: 'Japanese' });
    expect(result.type).toBe(Bookshelf);
    expect(result.props.books).toEqual(ids.map(bookId => catalogs[bookId]));
    expect(result.props.levelTiles).toEqual({});
  });

  // ISR 판은 1시간 모두에게 간다 — 발행이 아닌 이유(503 · 연결)로 한 권을 못 받은 판을 굳히지 않는다(GUEST-STATIC-001 3단계).
  it('a non-404 publication failure throws on revalidation (Next keeps the previous shelf) but still renders the partial shelf at build', async () => {
    services.publishedReading.mockImplementation(async (_client, _edition, _preview, bookId) => {
      if (bookId === 'japanese-n5') throw Object.assign(new Error('publication unavailable'), { status: 503 });
      return { book: { bookId } };
    });
    vi.stubEnv('NEXT_PHASE', '');
    await expect(Page({ lang: 'Japanese' })).rejects.toThrow('lessons_shelf_unavailable');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const result = await Page({ lang: 'Japanese' });
    expect(result.props.books).toEqual([catalogs['japanese-n4'], catalogs['japanese-n3']]);
  });

  it('the default shelf has no language and unknown languages are not built (dynamicParams false)', async () => {
    const { default: Default } = await import('@/app/(app)/lessons/page');
    expect(Default().type).toBe(LessonsShelf);
    expect(Default().props.lang).toBeUndefined();
    const lang = await import('@/app/(app)/lessons/lang/[lang]/page');
    expect(lang.dynamicParams).toBe(false);
    expect(lang.generateStaticParams()).toEqual([{ lang: 'Japanese' }, { lang: 'Chinese' }, { lang: 'English' }, { lang: 'French' }]);
  });
});
