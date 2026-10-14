// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).
// 정본 문학책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.
import book0 from './aozora-000081-043754/chapters.json';
import book1 from './aozora-000121-000628/chapters.json';
import book2 from './aozora-000121-000637/chapters.json';
import book3 from './aozora-000148-000753/chapters.json';
import book4 from './aozora-000879-000042/chapters.json';

export const LITERATURE_BOOKS = Object.freeze([book0, book1, book2, book3, book4]);
