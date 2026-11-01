// 정본 문학책 장 원문 읽기(BUILD-OOM-001 근본, 2026-11-01 KST). 장 원문 chapters.json(85권 · 약 33MB)을 정적 import하면 webpack 서버
// 묶음 하나(28.8MB)로 들어가 Vercel 빌드 컨테이너(8GB)를 넘겼다. 번들에는 key 목록(<출처>/index.generated.js)만 싣고, 원문은
// 부른 책만 파일에서 읽어 모듈 안에 둔다(같은 함수 인스턴스에서는 책마다 한 번만 읽는다 — 정적 import 때처럼 같은 객체를 돌려준다).
// 배포 함수에 파일이 실리는 것은 next.config.mjs outputFileTracingIncludes가 맡는다 — 계약 scripts/output-file-tracing.test.js.
// 서버 전용(node:fs). 뷰어는 manifest.generated.json을 쓴다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LITERATURE_BOOK_KEYS } from '@/content/literature/aozora/index.generated.js';
import { STANDARD_EBOOKS_BOOK_KEYS } from '@/content/literature/standardebooks/index.generated.js';
import { WIKISOURCE_BOOK_KEYS } from '@/content/literature/wikisource/index.generated.js';
import { PDSITE_BOOK_KEYS } from '@/content/literature/pdsite/index.generated.js';

/** 출처 폴더 · key 목록 — 차례 = 예전 정적 목록을 이어 붙인 차례(青空文庫 · Standard Ebooks · 위키문헌 · 전자책 사이트). */
const SOURCES = Object.freeze([
  ['aozora', LITERATURE_BOOK_KEYS], ['standardebooks', STANDARD_EBOOKS_BOOK_KEYS], ['wikisource', WIKISOURCE_BOOK_KEYS], ['pdsite', PDSITE_BOOK_KEYS],
]);
const DIR_OF = new Map(SOURCES.flatMap(([dir, keys]) => keys.map((key) => [key, dir])));

/** 모든 정본 문학책 key — 출처 차례. 공개 차례로 줄 세우기는 publishBooks.js(sortByPublishRank)가 한다. */
export const LITERATURE_KEYS = Object.freeze(SOURCES.flatMap(([, keys]) => keys));

const cache = new Map();

/**
 * key → 정본 책(그 작품 폴더의 chapters.json 그대로) | null(목록에 없는 key — 경로를 만들지 않는다).
 * 파일을 읽지 못하면 throw — 부르는 쪽이 「정본 책 목록을 만들지 못함」으로 막는다(게시 API 500/422 · 분석 작업 실패 기록).
 */
export function literatureBook(key) {
  const dir = DIR_OF.get(key);
  if (!dir) return null;
  let book = cache.get(key);
  if (!book) {
    book = JSON.parse(readFileSync(path.join(process.cwd(), 'src/content/literature', dir, key, 'chapters.json'), 'utf8'));
    cache.set(key, book);
  }
  return book;
}
