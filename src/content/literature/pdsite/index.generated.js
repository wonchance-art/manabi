// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).
// 퍼블릭 도메인 전자책 사이트 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.
import book0 from './pd-fp-albert-camus_l-etranger/chapters.json';
import book1 from './pd-fp-albert-camus_le-mythe-de-sisyphe/chapters.json';
import book2 from './pd-fp-ernest-hemingway_the-old-man-and-the-sea/chapters.json';
import book3 from './pd-fp-virginia-woolf_a-room-of-ones-own/chapters.json';
import book4 from './pd-gau-antoine-de-saint-exupery_le-petit-prince/chapters.json';
import book5 from './pd-gau-george-orwell_animal-farm/chapters.json';
import book6 from './pd-gau-george-orwell_nineteen-eighty-four/chapters.json';

export const PDSITE_BOOKS = Object.freeze([book0, book1, book2, book3, book4, book5, book6]);
