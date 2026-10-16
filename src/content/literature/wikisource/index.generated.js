// 자동 생성 — node scripts/build-literature.mjs. 손으로 고치지 않는다(--check가 낡음을 잡는다).
// Wikisource 정본 책 장 원문을 싣는다 — 서버(관리자 게시 API)에서만 import한다. 뷰어는 manifest.generated.json을 쓴다.
import book0 from './ws-fr-alphonse-daudet_la-derniere-classe/chapters.json';
import book1 from './ws-fr-guy-de-maupassant_la-parure/chapters.json';
import book2 from './ws-fr-jules-verne_le-tour-du-monde-en-quatre-vingts-jours/chapters.json';
import book3 from './ws-fr-victor-hugo_les-miserables-2/chapters.json';
import book4 from './ws-fr-victor-hugo_les-miserables-3/chapters.json';
import book5 from './ws-fr-victor-hugo_les-miserables-4/chapters.json';
import book6 from './ws-fr-victor-hugo_les-miserables-5/chapters.json';
import book7 from './ws-zh-lu-xun_gu-xiang/chapters.json';
import book8 from './ws-zh-lu-xun_kong-yi-ji/chapters.json';
import book9 from './ws-zh-zhu-ziqing_bei-ying/chapters.json';

export const WIKISOURCE_BOOKS = Object.freeze([book0, book1, book2, book3, book4, book5, book6, book7, book8, book9]);
