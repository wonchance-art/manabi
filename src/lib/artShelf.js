// 산책 「고전 명작」 그림 구간(DISCOVER-ART-001, 오너 「권장대로 ㄱㄱ」 2026-10-23 KST) — 서버에서만 쓰는 순수 모듈.
//
// 작품 한 점 = 카드 한 장. 표시(그림 · 한국어 제목 · 작가 · 한 줄 이야기 · 언어 · 레벨)는 저장소 카탈로그(src/content/art)의 게시 책에서,
// 「어느 자료를 열까」만 DB의 그림 서가(canonical_art_shelf() — 발행 기록 + 그 관리자의 공개 장)에서 받는다.
// 책 key · 장 순서 · 작품 id가 카탈로그와 모두 맞는 줄만 연다(fail closed — 발행 뒤 카탈로그 차례가 바뀌면 그 장은 보이지 않는다).
// 차례는 shelf-order.json(한국에서 익숙한 그림 먼저) 다음 게시 책 차례. 카탈로그(수백 KB)를 브라우저에 싣지 않도록 서버 화면만 import한다.
import { ART_CATALOG } from '../content/art/index.js';
import shelfOrder from '../content/art/shelf-order.json';
import { ART_PUBLISHED_CURATIONS, createArtBook } from './artBook.js';
import { artTitleLang } from './artCatalog.js';

/**
 * 게시 책의 작품 전부 → 카드 모양(차례 = shelf-order.json 앞줄, 나머지는 게시 책 차례).
 * @returns {{key, bookKey, order, workId, language, level, title, titleNative, titleLang, artist, hook, image}[]}
 */
export function artShelfWorks(catalog = ART_CATALOG, first = shelfOrder.first) {
  const works = new Map(catalog.works.map((work) => [work.id, work]));
  const artists = new Map(catalog.artists.map((artist) => [artist.id, artist]));
  const items = ART_PUBLISHED_CURATIONS.flatMap((curationId) => {
    const book = createArtBook(curationId, catalog);
    return book.chapters.map((chapter) => {
      const work = works.get(chapter.metadata.literature.work);
      const image = work.image;
      return {
        key: `${book.book.key}:${chapter.order}`, bookKey: book.book.key, order: chapter.order, workId: work.id,
        language: chapter.metadata.language, level: book.book.level,
        title: work.title.ko, titleNative: work.title.native, titleLang: artTitleLang(work.title),
        artist: artists.get(work.artist)?.name?.ko || '', hook: work.hook || '',
        image: image ? { url: image.url, width: image.width, height: image.height } : null,
      };
    });
  });
  const rank = (item) => { const at = first.indexOf(item.workId); return at < 0 ? first.length : at; };
  return items.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index).map(({ item }) => item);
}

/** 그림 서가(canonical_art_shelf 행)와 맞는 작품만 — 자료 id를 붙인다. 차례는 artShelfWorks 그대로. */
export function releasedArt(works, rows) {
  const byKey = new Map((rows || []).filter((row) => row && Number.isSafeInteger(Number(row.material_id)) && Number.isSafeInteger(Number(row.chapter_order)))
    .map((row) => [`${row.book_key}:${Number(row.chapter_order)}`, row]));
  return works.filter((item) => byKey.get(item.key)?.work === item.workId)
    .map((item) => ({ ...item, materialId: Number(byKey.get(item.key).material_id) }));
}
