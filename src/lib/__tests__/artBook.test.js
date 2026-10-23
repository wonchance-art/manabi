import { describe, expect, it } from 'vitest';
import { ART_CATALOG } from '../../content/art/index.js';
import {
  ART_PUBLISHED_CURATIONS, artBookKey, artBookPublishable, artBooks, createArtBook, isArtBookMaterial,
  verifiedArtChapter, verifyArtBookTexts,
} from '../artBook.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const materialOf = (chapter, patch = {}) => ({ raw_text: chapter.rawText, processed_json: { metadata: chapter.metadata }, ...patch });

describe('큐레이션 책 — 카탈로그 → 정본 책 장', () => {
  const books = artBooks();
  const byKey = (key) => books.find((item) => item.book.key === key);
  const famous = byKey(artBookKey('aic-famous-paintings'));
  const book = byKey(artBookKey('ukiyoe-landscape-hokusai-hiroshige'));
  const second = byKey(artBookKey('ukiyoe-landscape-hokusai-hiroshige-2'));

  it('게시 책은 명화(영어) 한 권 + 풍경 우키요에 두 권(첫 권 그대로 + 속편), 작품 한 점 = 책 언어 해설 한 장', () => {
    expect(ART_PUBLISHED_CURATIONS).toEqual(['aic-famous-paintings', 'ukiyoe-landscape-hokusai-hiroshige', 'ukiyoe-landscape-hokusai-hiroshige-2']);
    expect(books.map((item) => item.book.key)).toEqual(ART_PUBLISHED_CURATIONS.map(artBookKey));
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

  it('속편: 호쿠사이 두 점 + 히로시게 다섯 점, 일곱 장 연대순', () => {
    expect(second.book).toEqual({
      key: artBookKey('ukiyoe-landscape-hokusai-hiroshige-2'), title: '続・北斎と広重の風景版画', author: '葛飾北斎・歌川広重', level: 'N2 상급', total: 7,
    });
    expect(second.chapters.map((chapter) => chapter.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const works = new Map(ART_CATALOG.works.map((work) => [work.id, work]));
    const chapterWorks = second.chapters.map((chapter) => works.get(chapter.metadata.literature.work));
    expect(chapterWorks.filter((work) => work.artist === 'katsushika-hokusai')).toHaveLength(2);
    expect(chapterWorks.filter((work) => work.artist === 'utagawa-hiroshige')).toHaveLength(5);
    const starts = chapterWorks.map((work) => work.date.startYear);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const chapter of second.chapters) {
      expect(chapter.materialTitle).toBe(`${second.book.title} — ${chapter.title}`);
      expect(chapter.metadata.book).toMatchObject({ key: second.book.key, order: chapter.order, total: 7 });
    }
  });

  it('명화 책(DISCOVER-ART-001): 시카고 미술관 영어 해설 여덟 장 — 자료 언어 English, 작가는 쉼표로', () => {
    expect(famous.book).toEqual({
      key: 'art-aic-famous-paintings', title: 'Famous Paintings at the Art Institute of Chicago',
      author: 'Vincent van Gogh, Claude Monet, Georges Seurat, Pierre-Auguste Renoir, Gustave Caillebotte, Henri de Toulouse-Lautrec',
      level: 'B2 상급', total: 8,
    });
    expect(famous.chapters[0].title).toBe('The Bedroom');
    for (const chapter of famous.chapters) {
      expect(chapter.metadata.language).toBe('English');
      expect(chapter.metadata.literature).toMatchObject({ provider: 'art', curation: 'aic-famous-paintings', source: 'aic', license: 'cc-by-4.0' });
    }
  });

  it('책 언어 해설이 없는 작품이 들면 책을 만들지 않는다(fail-closed)', () => {
    const catalog = clone(ART_CATALOG);
    catalog.curations.find((item) => item.id === 'aic-famous-paintings').language = 'ja';
    expect(() => createArtBook('aic-famous-paintings', catalog)).toThrow(/van-gogh-bedroom: ja 해설이 없다/);
  });

  it('게시 책끼리 작품이 겹치지 않는다 — 같은 해설이 두 행이 되지 않게', () => {
    const ids = books.flatMap((item) => item.chapters.map((chapter) => chapter.metadata.literature.work));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('장 원문은 카탈로그 해설 그대로 — 해시가 같고 게시 가능', async () => {
    for (const item of books) {
      expect(await verifyArtBookTexts(item), item.book.key).toEqual([]);
      expect(artBookPublishable(item), item.book.key).toBe(true);
    }
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
    const curation = catalog.curations.find((item) => item.id === 'ukiyoe-landscape-hokusai-hiroshige');
    curation.title.native = '北斎 — 広重';
    expect(() => createArtBook(curation.id, catalog)).toThrow(/장 제목 구분자/);
    delete curation.level;
    expect(() => createArtBook(curation.id, catalog)).toThrow(/level/);
  });
});

describe('뷰어 정보 카드 — 원문이 정본과 같을 때만', () => {
  const book = artBooks().find((item) => item.book.key === artBookKey('ukiyoe-landscape-hokusai-hiroshige'));
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
