// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).
// 정본 문학책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.
import book0 from './aozora-000074-000424/chapters.json';
import book1 from './aozora-000081-000456/chapters.json';
import book2 from './aozora-000081-000462/chapters.json';
import book3 from './aozora-000081-000470/chapters.json';
import book4 from './aozora-000081-000473/chapters.json';
import book5 from './aozora-000081-043754/chapters.json';
import book6 from './aozora-000081-046605/chapters.json';
import book7 from './aozora-000119-000624/chapters.json';
import book8 from './aozora-000121-000628/chapters.json';
import book9 from './aozora-000121-000637/chapters.json';
import book10 from './aozora-000129-045245/chapters.json';
import book11 from './aozora-000148-000752/chapters.json';
import book12 from './aozora-000148-000753/chapters.json';
import book13 from './aozora-000148-000773/chapters.json';
import book14 from './aozora-000879-000042/chapters.json';
import book15 from './aozora-000879-000092/chapters.json';
import book16 from './aozora-000879-000127/chapters.json';
import book17 from './aozora-000879-043015/chapters.json';
import book18 from './aozora-000879-043016/chapters.json';
import book19 from './aozora-001383-056641/chapters.json';
import book20 from './aozora-001779-056648/chapters.json';

export const LITERATURE_BOOKS = Object.freeze([book0, book1, book2, book3, book4, book5, book6, book7, book8, book9, book10, book11, book12, book13, book14, book15, book16, book17, book18, book19, book20]);
