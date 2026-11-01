// 게시할 정본 책 목록 — 관리자 게시 API(/api/admin/literature)와 서버 분석 작업(CANON-SERVER-ANALYSIS-001 — 문학책 · 그림 책)이 같이 쓴다.
// 문학책 = 青空文庫 · Standard Ebooks · 위키문헌 · 전자책 사이트 빌드 산출물을 공개 차례로(classicsPublishRank). 그림 책 = 카탈로그(artBooks()). /api/admin/art-books는 artBooks()를 바로 쓴다(원문 파일이 그 함수에 실리지 않게).
// 문학책 장 원문은 번들에 싣지 않고 부른 책만 읽는다(literatureBooks.js — BUILD-OOM-001) — 책 하나만 쓰는 요청은 keys로 좁힌다.
import { artBooks } from '@/lib/artBook';
import { sortByPublishRank } from '@/lib/classicsShelf';
import { LITERATURE_KEYS, literatureBook } from './literatureBooks';

export const PUBLISH_KINDS = Object.freeze(['literature', 'art']);

// 목록 · 「모두 게시 · 분석」 대기열 차례 = 공개 차례(언어를 번갈아 대표작 먼저 — classicsPublishRank, 2026-10-23 KST).
// 줄 세우기는 key만 본다 — 원문을 읽지 않고 차례를 정해 둔다(처음 부를 때 한 번).
let literatureOrder = null;
const literatureKeys = () => (literatureOrder ??= Object.freeze(sortByPublishRank(LITERATURE_KEYS.map((key) => ({ book: { key } })))
  .map(({ book }) => book.key)));
let literatureAll = null;

/**
 * kind → 정본 책 배열(공개 차례). keys를 주면 그 key의 책만(차례는 그대로 · 모르는 key는 빠진다) — 문학책은 그 책 원문만 읽는다.
 * 그림 책은 요청마다 카탈로그에서 만든다(깨진 카탈로그면 throw — 부르는 쪽이 막는다). 문학책 원문을 읽지 못해도 throw.
 * @param {'literature'|'art'} kind
 * @param {string[]} [keys]
 */
export function publishBooksOf(kind, keys) {
  if (kind === 'literature') {
    if (!keys) return (literatureAll ??= Object.freeze(literatureKeys().map(literatureBook)));
    const wanted = new Set(keys);
    return Object.freeze(literatureKeys().filter((key) => wanted.has(key)).map(literatureBook));
  }
  if (kind === 'art') {
    const books = artBooks();
    if (!keys) return books;
    const wanted = new Set(keys);
    return books.filter((book) => wanted.has(book.book.key));
  }
  throw new Error(`알 수 없는 책 종류: ${kind}`);
}
