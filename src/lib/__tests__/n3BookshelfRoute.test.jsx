import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({ publishedReading: vi.fn(), readingCatalog: vi.fn(), levelTileCounts: vi.fn() }));
vi.mock('@/lib/server/bookReading', () => ({ publishedReading: services.publishedReading, readingCatalog: services.readingCatalog }));
vi.mock('@/lib/levelListData', () => ({ levelTileCounts: services.levelTileCounts }));
vi.mock('@/components/books/Bookshelf', () => ({ default: function BookshelfBoundary() { return null; } }));
import Page from '@/app/(app)/lessons/page';
import Bookshelf from '@/components/books/Bookshelf';

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
  services.publishedReading.mockReset().mockImplementation(async (_edition, _preview, bookId) => ({ book: { bookId } }));
  services.readingCatalog.mockReset().mockImplementation(book => catalogs[book.bookId]);
  services.levelTileCounts.mockReset().mockImplementation(async language => tiles[language === 'japanese' ? 'Japanese' : 'Chinese']);
});
afterEach(() => vi.unstubAllGlobals());

describe('actual bookshelf route passes published courses across its client boundary', () => {
  it('starts all registered courses and both tile reads together, then passes N3 alongside N5/N4 in course order', async () => {
    const books = Object.fromEntries(ids.map(bookId => [bookId, deferred()]));
    const counts = { japanese: deferred(), chinese: deferred() };
    services.publishedReading.mockImplementation((_edition, _preview, bookId) => books[bookId].promise);
    services.levelTileCounts.mockImplementation(language => counts[language].promise);
    const pending = Page({ searchParams: Promise.resolve({ lang: 'Japanese' }) });
    try {
      await Promise.resolve();
      expect(services.publishedReading.mock.calls).toEqual(ids.map(bookId => [undefined, false, bookId]));
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

  it('keeps the N3 and N4 shelf entries and both tile groups when N5 publication is unavailable', async () => {
    services.publishedReading.mockImplementation(async (_edition, _preview, bookId) => {
      if (bookId === 'japanese-n5') throw new Error('publication unavailable');
      return { book: { bookId } };
    });
    const result = await Page({ searchParams: Promise.resolve({ lang: 'Japanese' }) });
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
    const result = await Page({ searchParams: Promise.resolve({ lang: 'Japanese' }) });
    expect(result.type).toBe(Bookshelf);
    expect(result.props.books).toEqual(ids.map(bookId => catalogs[bookId]));
    expect(result.props.levelTiles).toEqual({});
  });
});
