import { describe, expect, it } from 'vitest';
import { ART_CATALOG } from '../../content/art/index.js';
import {
  ART_PUBLISHED_CURATIONS, artBookKey, artBookPublishable, artBooks, createArtBook, isArtBookMaterial,
  verifiedArtChapter, verifyArtBookTexts,
} from '../artBook.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const materialOf = (chapter, patch = {}) => ({ raw_text: chapter.rawText, processed_json: { metadata: chapter.metadata }, ...patch });

describe('큐레이션 책 — 카탈로그 → 정본 책 장', () => {
  const [book] = artBooks();

  it('게시 책은 풍경 우키요에 한 권, 작품 한 점 = 일본어 해설 한 장', () => {
    expect(ART_PUBLISHED_CURATIONS).toEqual(['ukiyoe-landscape-hokusai-hiroshige']);
    expect(book.book).toEqual({
      key: artBookKey('ukiyoe-landscape-hokusai-hiroshige'), title: '北斎と広重の風景版画', author: '葛飾北斎・歌川広重', level: 'N2 상급', total: 8,
    });
    expect(book.chapters.map((chapter) => chapter.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const chapter of book.chapters) {
      expect(chapter.materialTitle).toBe(`${book.book.title} — ${chapter.title}`);
      expect(chapter.metadata.language).toBe('Japanese');
      expect(chapter.metadata.book).toMatchObject({ key: book.book.key, title: book.book.title, order: chapter.order, total: 8 });
      expect(chapter.metadata.literature.provider).toBe('art');
      expect(chapter.metadata.literature).not.toHaveProperty('rubyLocks');
      expect(chapter.metadata.literature).not.toHaveProperty('reviewHints');
    }
  });

  it('장 원문은 카탈로그 해설 그대로 — 해시가 같고 게시 가능', async () => {
    expect(await verifyArtBookTexts(book)).toEqual([]);
    expect(artBookPublishable(book)).toBe(true);
  });

  it('원문을 고친 장·허용 밖 라이선스가 있으면 게시하지 않는다', () => {
    const edited = clone(book);
    edited.chapters[0].rawText += '（追記）';
    expect(artBookPublishable(edited)).toBe(false);
    const licensed = clone(book);
    licensed.chapters[1].metadata.literature.license = 'all-rights-reserved';
    expect(artBookPublishable(licensed)).toBe(false);
    expect(artBookPublishable({ chapters: [] })).toBe(false);
  });

  it('없는 큐레이션·제목에 장 구분자 「 — 」·레벨 없음은 실패(fail-closed)', () => {
    expect(() => createArtBook('nope')).toThrow(/없는 큐레이션/);
    const catalog = clone(ART_CATALOG);
    catalog.curations[0].title.native = '北斎 — 広重';
    expect(() => createArtBook(catalog.curations[0].id, catalog)).toThrow(/장 제목 구분자/);
    delete catalog.curations[0].level;
    expect(() => createArtBook(catalog.curations[0].id, catalog)).toThrow(/level/);
  });
});

describe('뷰어 정보 카드 — 원문이 정본과 같을 때만', () => {
  const [book] = artBooks();
  const chapter = book.chapters[5];

  it('정본 장이면 카드·출처·책 위치', async () => {
    const verified = await verifiedArtChapter(materialOf(chapter));
    expect(verified.card.id).toBe('hiroshige-ohashi-atake-no-yudachi');
    expect(verified.credit).toEqual({
      credit: chapter.metadata.literature.credit, license: '정부표준이용규약 2.0', sourceUrl: 'https://colbase.nich.go.jp/collection_items/tnm/A-10569-7342',
    });
    expect(verified.book).toEqual({ key: book.book.key, title: book.book.title, order: 6, total: 8 });
    expect(isArtBookMaterial(materialOf(chapter))).toBe(true);
  });

  it('원문이 다르거나 순서·작품·책 키·큐레이션을 꾸미면 카드가 없다', async () => {
    const meta = chapter.metadata;
    expect(await verifiedArtChapter(materialOf(chapter, { raw_text: `${chapter.rawText}x` }))).toBeNull();
    expect(await verifiedArtChapter({ raw_text: chapter.rawText, processed_json: { metadata: { ...meta, book: { ...meta.book, order: 1 } } } })).toBeNull();
    expect(await verifiedArtChapter({ raw_text: chapter.rawText, processed_json: { metadata: { ...meta, literature: { ...meta.literature, work: 'hokusai-gaifu-kaisei' } } } })).toBeNull();
    expect(await verifiedArtChapter({ raw_text: chapter.rawText, processed_json: { metadata: { ...meta, book: { ...meta.book, key: 'art-x' } } } })).toBeNull();
    expect(await verifiedArtChapter({ raw_text: chapter.rawText, processed_json: { metadata: { ...meta, literature: { ...meta.literature, curation: 'katsushika-hokusai-fugaku' } } } })).toBeNull();
    expect(await verifiedArtChapter({ raw_text: 'x', processed_json: { metadata: { language: 'Japanese' } } })).toBeNull();
    expect(isArtBookMaterial({ processed_json: { metadata: { literature: { provider: 'aozora' } } } })).toBe(false);
  });
});
