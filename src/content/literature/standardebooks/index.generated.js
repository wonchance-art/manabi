// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).
// Standard Ebooks 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.
import book0 from './se-arthur-conan-doyle_the-adventures-of-sherlock-holmes/chapters.json';
import book1 from './se-charles-dickens_a-christmas-carol/chapters.json';
import book2 from './se-lewis-carroll_alices-adventures-in-wonderland/chapters.json';

export const STANDARD_EBOOKS_BOOKS = Object.freeze([book0, book1, book2]);
