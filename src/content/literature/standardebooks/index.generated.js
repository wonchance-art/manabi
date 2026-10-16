// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).
// Standard Ebooks 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.
import book0 from './se-adam-smith_the-theory-of-moral-sentiments/chapters.json';
import book1 from './se-adam-smith_the-wealth-of-nations/chapters.json';
import book2 from './se-arthur-conan-doyle_the-adventures-of-sherlock-holmes/chapters.json';
import book3 from './se-benjamin-franklin_the-autobiography-of-benjamin-franklin/chapters.json';
import book4 from './se-charles-dickens_a-christmas-carol/chapters.json';
import book5 from './se-f-scott-fitzgerald_the-great-gatsby/chapters.json';
import book6 from './se-henry-david-thoreau_walden/chapters.json';
import book7 from './se-herman-melville_moby-dick/chapters.json';
import book8 from './se-james-joyce_a-portrait-of-the-artist-as-a-young-man/chapters.json';
import book9 from './se-jane-austen_pride-and-prejudice/chapters.json';
import book10 from './se-john-stuart-mill_on-liberty/chapters.json';
import book11 from './se-lewis-carroll_alices-adventures-in-wonderland/chapters.json';
import book12 from './se-marcus-aurelius_meditations_george-long/chapters.json';

export const STANDARD_EBOOKS_BOOKS = Object.freeze([book0, book1, book2, book3, book4, book5, book6, book7, book8, book9, book10, book11, book12]);
