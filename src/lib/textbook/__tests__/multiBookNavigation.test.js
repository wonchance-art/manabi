import {describe,it,expect,vi} from 'vitest';
import {BOOKS,bookUnitSlug,isBookId,validateManuscript} from '../contract';
import {contentHash,readEditionStamp} from '../server';
import {resolveBookSelection,bookSourceHref,bookIdForChapter} from '../sources';
import {bookReviewHref,bookExpressionListHref,fetchBookScope,safeBookReturn} from '../../bookReviewNavigation';
import {parseReviewScope,serializeReviewScope} from '../../reviewScopeUrl';
import {libraryItemHref} from '../../personalLibrary';
import {libraryResume} from '../../libraryActivity';

const edition='a'.repeat(24);
const reading=`/books/japanese-n4?edition=${edition}#u29-study1`;
const bundle={bookId:'japanese-n4',editionId:edition,sourceIndex:{'u29-study1':{lesson:29,text:'午後五時までに、受付に来てください。'}}};

describe('registered-book selection and exact source return',()=>{
 it('accepts only registered books and keeps N5/N4 chapter identities separate',()=>{
  expect(isBookId('constructor')).toBe(false);
  expect(isBookId('japanese-n2')).toBe(false);
  expect(Object.keys(BOOKS)).toEqual(['japanese-n5','japanese-n4','japanese-n3']);
  expect(bookUnitSlug('japanese-n4',29)).toBe('n4-book-u29');
  expect(bookIdForChapter('n5-book-u29')).toBe('japanese-n5');
  expect(bookIdForChapter('n4-book-u29')).toBe('japanese-n4');
  expect(bookUnitSlug('japanese-n4',43)).toBe(null);
 });
 it('derives the lesson from the edition index and cannot relabel a selected N4 passage as N5',()=>{
  const source={bookId:'japanese-n4',editionId:edition,pageId:'u29-study1',quote:'午後五時までに、受付に来てください。',lesson:1};
  const selected=resolveBookSelection(bundle,source,{word_text:'受付',meaning:'접수처'});
  expect(selected.chapterSlug).toBe('n4-book-u29');
  expect(bookSourceHref(selected)).toBe(reading);
  expect(()=>resolveBookSelection(bundle,{...source,bookId:'japanese-n5'},{word_text:'受付'})).toThrow();
  expect(()=>resolveBookSelection(bundle,{...source,quote:'今から行きます。'},{word_text:'今'})).toThrow();
 });
 it('round-trips N4 review scopes while refusing a different book as the return destination',()=>{
  const href=bookReviewHref(reading,{from:28,to:30});
  const parsed=parseReviewScope(new URL(href,'https://manabi.invalid').searchParams);
  expect(parsed.scope.source).toEqual({kind:'book',bookId:'japanese-n4',from:28,to:30});
  expect(parsed.returnTo).toBe(reading);
  expect(serializeReviewScope(parsed.scope,{returnTo:reading})).toBe(href);
  expect(bookExpressionListHref(reading)).toBe(`/books/japanese-n4/review?edition=${edition}&returnTo=${encodeURIComponent(reading)}`);
  expect(safeBookReturn(reading,'japanese-n5')).toBe(null);
  expect(parseReviewScope({src:'book:japanese-n5:1-42',returnTo:reading}).returnTo).toBe('/books/japanese-n5');
 });
 it('passes the selected book to review lookup without changing the legacy N5 request',async()=>{
  const fetcher=vi.fn(async()=>Response.json({wordIds:[1],chapters:{1:'n4-book-u29'},nextOffset:null}));
  await fetchBookScope({fetcher,bookId:'japanese-n4',from:28,to:30});
  expect(fetcher.mock.calls[0][0]).toBe('/api/learning/book-review?scope=1&book=japanese-n4&from=28&to=30&offset=0');
  await fetchBookScope({fetcher});
  expect(fetcher.mock.calls[1][0]).toBe('/api/learning/book-review?scope=1&offset=0');
 });
 it('keeps book and edition filters together without querying the manuscript body',async()=>{
  const eq=vi.fn(()=>query),select=vi.fn(()=>query);
  const query={eq,select,maybeSingle:async()=>({data:null,error:null})};
  const db={from:()=>query};
  await readEditionStamp(db,edition,'japanese-n4');
  expect(eq.mock.calls).toEqual([['book_id','japanese-n4'],['edition_id',edition]]);
  expect(select.mock.calls[0][0]).not.toContain('manuscript');
  await expect(readEditionStamp(db,edition,'japanese-n2')).rejects.toMatchObject({status:404});
 });
 it('keeps N4 full-manuscript hashes and immutable book identities while retaining N5 metadata hashing',()=>{
  const n4={bookId:'japanese-n4',level:'N4',source:{baseline:'one'},lessons:[]};
  expect(contentHash(n4)).not.toBe(contentHash({...n4,source:{baseline:'two'}}));
  expect(validateManuscript({...n4,bookId:'japanese-n5'},n4)).toBeTruthy();
  const n5={level:'N5',title:'기초',source:{baseline:'one'}};
  expect(contentHash(n5)).toBe(contentHash({...n5,source:{baseline:'two'}}));
 });
 it('opens N4 library entries and their saved device positions in N4',()=>{
  const row={target_kind:'edition',target_id:edition,level:'N4',context:{bookId:'japanese-n4',page:'u29-study1'}};
  expect(libraryItemHref(row)).toBe(`/books/japanese-n4?edition=${edition}#cover`);
  expect(libraryResume(row,'owner',{getItem:()=>JSON.stringify({page:'u29-practice',completed:[]})}).href).toBe(`/books/japanese-n4?edition=${edition}#u29-practice`);
  expect(libraryItemHref({...row,context:{bookId:'unsupported'}})).toBe(null);
 });
});
