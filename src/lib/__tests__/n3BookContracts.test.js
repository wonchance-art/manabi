import { describe, expect, it, vi } from 'vitest';
import vm from 'node:vm';
import { BOOKS, BOOK_UNIT_SLUG, bookUnitSlug, isBookPage } from '@/lib/textbook/contract';
import { bookChapterNumber, bookIdForChapter, resolveBookSelection } from '@/lib/textbook/sources';
import { candidate, contentHash } from '@/lib/textbook/server';
import { readingUnit, validReadingProgress } from '@/lib/bookNavigation';
import { bookReviewHref, fetchBookScope } from '@/lib/bookReviewNavigation';
import { parseReviewScope, parseScopeSource, safeBookReturn, scopeSourceLabel } from '@/lib/reviewScopeUrl';
import { libraryItemHref } from '@/lib/personalLibrary';
import { libraryResume } from '@/lib/libraryActivity';
import { resumeHintScript } from '@/components/books/bookEntryGate';

const edition='c'.repeat(24), bookId='japanese-n3';
const href=`/books/${bookId}?edition=${edition}#u48-practice`;
const quote='地域の人と話し合った結果、計画を見直すことにしました。';
const bundle={bookId,editionId:edition,sourceIndex:{'u48-practice':{lesson:48,text:quote}}};
const source={bookId,editionId:edition,pageId:'u48-practice',lesson:1,quote};

describe('N3 book boundaries across saving, review and source return',()=>{
  it('registers 48 N3 units while preserving the 42-unit boundaries of both earlier books',()=>{
    expect(BOOKS[bookId].lessons).toBe(48);
    expect(bookUnitSlug(bookId,48)).toBe('n3-book-u48');
    for(const earlier of ['japanese-n5','japanese-n4'])expect(bookUnitSlug(earlier,43)).toBeNull();
    for(const slug of ['n5-book-u43','n4-book-u48','n3-book-u49','n2-book-u01'])expect(BOOK_UNIT_SLUG.test(slug)).toBe(false);
    expect(bookChapterNumber('n3-book-u48')).toBe(48);
    expect(bookIdForChapter('n3-book-u48')).toBe(bookId);
    expect(bookUnitSlug(bookId,49)).toBeNull();
  });
  it('derives the final lesson from the verified source rather than a client-provided lesson',()=>{
    expect(resolveBookSelection(bundle,source,{word_text:'計画',meaning:'계획'})).toMatchObject({chapterSlug:'n3-book-u48',locator:{bookId,editionId:edition,pageId:'u48-practice'},quote});
    expect(()=>resolveBookSelection(bundle,{...source,bookId:'japanese-n4'},{word_text:'計画'})).toThrow();
    expect(()=>resolveBookSelection(bundle,{...source,quote:'別の計画です。'},{word_text:'計画'})).toThrow();
    expect(()=>resolveBookSelection(bundle,{...source,editionId:'d'.repeat(24)},{word_text:'計画'})).toThrow();
  });
  it('returns to N3 lesson 48 only in the same book and a valid exact edition',()=>{
    expect(safeBookReturn(href,bookId)).toBe(href);
    expect(safeBookReturn(href,'japanese-n4')).toBeNull();
    for(const bad of [href.replace('u48','u49'),href.replace('japanese-n3','japanese-n4'),href.replace('#u48','&edition='+edition+'#u48'),'/books/japanese-n3/review?edition='+edition])expect(safeBookReturn(bad)).toBeNull();
    expect(isBookPage('japanese-n4','u43-practice')).toBe(false);
  });
  it('serializes the full N3 course and rejects a scope beyond its final lesson',()=>{
    const parsed=parseReviewScope(new URL(bookReviewHref(href),'https://local.invalid').searchParams);
    expect(parsed.scope.source).toEqual({kind:'book',bookId,from:1,to:48});
    expect(parsed.returnTo).toBe(href);
    expect(scopeSourceLabel(parsed.scope.source)).toBe('N3 교재 전체');
    expect(parseReviewScope({book:bookId}).scope.source.to).toBe(48);
    expect(parseScopeSource('book:japanese-n3:43-48')).toEqual({kind:'book',bookId,from:43,to:48});
    expect(parseScopeSource('book:japanese-n3:1-49')).toBeNull();
    expect(parseScopeSource('book:japanese-n4:1-43')).toBeNull();
    expect(parseReviewScope({book:'japanese-n5'}).scope.source.to).toBe(42);
    expect(scopeSourceLabel({kind:'book',bookId:'japanese-n5',from:1,to:42})).toBe('교재 전체');
  });
  it('asks the owner-scoped API for the actual N3 range without changing the N5 default request',async()=>{
    const fetcher=vi.fn(async()=>({ok:true,json:async()=>({wordIds:[],chapters:{},nextOffset:null})}));
    await fetchBookScope({fetcher,bookId});
    await fetchBookScope({fetcher,bookId,from:43,to:48});
    await fetchBookScope({fetcher});
    expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['/api/learning/book-review?scope=1&book=japanese-n3&offset=0','/api/learning/book-review?scope=1&book=japanese-n3&from=43&to=48&offset=0','/api/learning/book-review?scope=1&offset=0']);
  });
  it('keeps the last N3 position across local restore and library entry without widening N4',()=>{
    const value={page:'u48-practice',completed:['u42','u48','u49','u48']};
    expect(validReadingProgress(value,bookId)).toEqual({page:'u48-practice',completed:['u42','u48']});
    expect(validReadingProgress(value,'japanese-n4')).toEqual({page:'u01-start',completed:['u42']});
    expect(readingUnit('u48',[],bookId)).toBe('u48');
    expect(readingUnit('u48',[])).toBeNull();
    const row={target_kind:'edition',target_id:edition,level:'N3',context:{bookId}};
    expect(libraryItemHref(row)).toBe(`/books/${bookId}?edition=${edition}#cover`);
    expect(libraryResume(row,'owner',{getItem:()=>JSON.stringify(value)}).href).toBe(href);
  });
  it('keeps the pre-hydration resume hint consistent with the N3 final lesson',()=>{
    function hintFor(selectedBook){
      const styles=[];const key=`manabi-book-progress:${edition}:guest`;
      vm.runInNewContext(resumeHintScript(edition,false,selectedBook),{localStorage:{length:1,key:()=>key,getItem:()=>JSON.stringify({page:'u48-practice'})},document:{getElementById:()=>null,createElement:()=>({}),head:{appendChild:style=>styles.push(style)}}});
      return styles;
    }
    expect(hintFor(bookId)).toHaveLength(1);
    expect(hintFor('japanese-n4')).toHaveLength(0);
    expect(hintFor('japanese-n5')).toHaveLength(0);
  });
  it('binds N3 provenance to its immutable hash and cannot load a verified N4 edition as N3',async()=>{
    const manuscript={bookId,level:'N3',source:{revision:'one'},lessons:[]};
    expect(contentHash({...manuscript,source:{revision:'two'}})).not.toBe(contentHash(manuscript));
    const earlier={...manuscript,bookId:'japanese-n5',level:'N5'};
    expect(contentHash({...earlier,source:{revision:'two'}})).toBe(contentHash(earlier));
    await expect(candidate('f4a6411c0945bbd3f8767af7',bookId)).rejects.toMatchObject({status:404});
  });
});
