import { describe, it, expect, vi } from 'vitest';
import { safeBookReturn, bookReviewHref, parseBookReview, bookReferenceHref, fetchBookVocabularyIds } from '../bookReviewNavigation';
const reading='/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u42-message-reading';
describe('book review scope and return',()=>{
 it('preserves the exact edition/anchor and separates a reference visit from the return',()=>{
  const url=new URL(bookReviewHref(reading),'https://local');
  expect(parseBookReview(Object.fromEntries(url.searchParams))).toEqual({bookId:'japanese-n5',returnTo:reading});
  expect(bookReferenceHref(reading)).toBe(reading.replace('#','&reference=1#'));
  expect(bookReferenceHref('/viewer/91?sourceText=hi')).toBe('/viewer/91?sourceText=hi');
 });
 it.each(['https://evil.test','//evil.test','/admin/books','/books/japanese-n5?edition=bad#u42','/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c&returnTo=//evil','/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u99', [reading,reading]])('rejects unsafe or ambiguous reading return %s',value=>expect(safeBookReturn(value)).toBeNull());
 it('invalid explicit scope never means all vocabulary',()=>{
  expect(parseBookReview({book:'unknown'})).toEqual({invalid:true});
  expect(parseBookReview({book:['japanese-n5','unknown']})).toEqual({invalid:true});
  expect(parseBookReview({})).toBeNull();
 });
 it('loads every source page and deduplicates the same word across editions',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({wordIds:[1,1,2],nextOffset:200})).mockResolvedValueOnce(Response.json({wordIds:[2,3],nextOffset:null}));
  expect(await fetchBookVocabularyIds({fetcher})).toEqual([1,2,3]);
  expect(fetcher.mock.calls[1][0]).toContain('offset=200');
 });
 it('fails closed if any page fails, including a later page',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({wordIds:[1],nextOffset:200})).mockResolvedValueOnce(Response.json({error:'offline'},{status:503}));
  await expect(fetchBookVocabularyIds({fetcher})).rejects.toThrow('범위');
 });
 it('rejects a stalled cursor instead of retrying indefinitely',async()=>{
  await expect(fetchBookVocabularyIds({fetcher:async()=>Response.json({wordIds:[1],nextOffset:0})})).rejects.toThrow('다음 위치');
 });
});
