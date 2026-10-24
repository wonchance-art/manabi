// 게시할 정본 책 목록 — 관리자 게시 API(/api/admin/literature · /api/admin/art-books)와 서버 분석 작업(CANON-SERVER-ANALYSIS-001)이 같이 쓴다.
// 문학책 = 青空文庫 · Standard Ebooks · 위키문헌 · 전자책 사이트 빌드 산출물을 공개 차례로(classicsPublishRank). 그림 책 = 카탈로그(artBooks()).
import { LITERATURE_BOOKS } from '@/content/literature/aozora/index.generated.js';
import { STANDARD_EBOOKS_BOOKS } from '@/content/literature/standardebooks/index.generated.js';
import { WIKISOURCE_BOOKS } from '@/content/literature/wikisource/index.generated.js';
import { PDSITE_BOOKS } from '@/content/literature/pdsite/index.generated.js';
import { artBooks } from '@/lib/artBook';
import { sortByPublishRank } from '@/lib/classicsShelf';

// 목록 · 「모두 게시 · 분석」 대기열 차례 = 공개 차례(언어를 번갈아 대표작 먼저 — classicsPublishRank, 2026-10-23 KST).
const LITERATURE = Object.freeze(sortByPublishRank([...LITERATURE_BOOKS, ...STANDARD_EBOOKS_BOOKS, ...WIKISOURCE_BOOKS, ...PDSITE_BOOKS]));

export const PUBLISH_KINDS = Object.freeze(['literature', 'art']);

/** kind → 정본 책 배열. 그림 책은 요청마다 카탈로그에서 만든다(깨진 카탈로그면 throw — 부르는 쪽이 막는다). */
export function publishBooksOf(kind) {
  if (kind === 'literature') return LITERATURE;
  if (kind === 'art') return artBooks();
  throw new Error(`알 수 없는 책 종류: ${kind}`);
}
