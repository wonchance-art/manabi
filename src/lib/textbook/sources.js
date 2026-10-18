import {BOOK_ID,BOOKS,isBookId,bookUnitSlug,BOOK_UNIT_SLUG,EDITION_ID,bookHref} from './contract';
export const compactText=s=>String(s||'').normalize('NFC').replace(/\s+/g,'');
export function resolveBookSelection(bundle,source,word) {
 const bookId=bundle.bookId||BOOK_ID;
 if(!isBookId(bookId)||source.bookId!==bookId||source.editionId!==bundle.editionId||!EDITION_ID.test(source.editionId||''))throw new Error('교재 판본을 다시 선택해 주세요.');
 const page=bundle.sourceIndex?.[source.pageId];if(!page)throw new Error('교재 위치를 다시 선택해 주세요.');
 const quote=String(source.quote||'').trim(),selected=String(word.base_form||word.word_text||'').trim();
 if(!quote||quote.length>4000||!selected||!compactText(page.text).includes(compactText(quote))||!compactText(quote).includes(compactText(selected)))throw new Error('현재 판본에서 표현을 다시 선택해 주세요.');
 const lesson=page.lesson;
 if(!Number.isInteger(lesson)||lesson<1||lesson>BOOKS[bookId].lessons)throw new Error('복습할 표현은 본문 과에서 선택해 주세요.');
 return {kind:'textbook',chapterSlug:bookUnitSlug(bookId,lesson),quote,translation:String(word.meaning||''),locator:{bookId,editionId:bundle.editionId,revision:bundle.editionId,pageId:source.pageId,blockId:`tb-book-${source.pageId}`}};
}
export function bookSourceHref(source){const loc=source.locator||{};return isBookId(loc.bookId)&&EDITION_ID.test(loc.editionId||'')&&/^[a-z0-9_-]{1,160}$/i.test(loc.pageId||'')?bookHref(loc.editionId,loc.pageId,loc.bookId):null}
export function bookChapterNumber(slug){return BOOK_UNIT_SLUG.test(slug||'')?Number(slug.slice(-2)):null}
export function bookIdForChapter(slug){return bookChapterNumber(slug)?`japanese-${slug.slice(0,2)}`:null}
