import { describe, it, expect, vi } from 'vitest';
import { safeBookReturn, bookReviewHref, parseBookReview, bookReferenceHref, fetchBookVocabularyIds } from '../bookReviewNavigation';
import { parseReviewScope } from '../reviewScope';
const reading='/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u42-message-reading';
describe('book review scope and return',()=>{
 it('preserves the exact edition/anchor and separates a reference visit from the return',()=>{
  // 범위 주소(REV-SCOPE R1-A): 교재 범위 + 돌아갈 곳. 예전 ?book= 주소도 같은 범위로 읽힌다.
  const url=new URL(bookReviewHref(reading),'https://local');
  expect(url.pathname+url.search).toBe(`/vocab?lang=Japanese&src=book:japanese-n5:1-42&returnTo=${encodeURIComponent(reading)}`);
  expect(parseReviewScope(Object.fromEntries(url.searchParams))).toMatchObject({scope:{lang:'Japanese',src:{kind:'book',from:1,to:42}},returnTo:reading});
  expect(parseReviewScope({book:'japanese-n5',returnTo:reading})).toMatchObject({scope:{src:{kind:'book',from:1,to:42}},returnTo:reading});
  expect(new URL(bookReviewHref(reading,{from:7,to:7}),'https://local').searchParams.get('src')).toBe('book:japanese-n5:7-7');
  expect(parseBookReview({book:'japanese-n5',returnTo:reading})).toEqual({bookId:'japanese-n5',returnTo:reading});
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
 it('asks only for the chosen lessons when the range is narrower than the book',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({wordIds:[4],nextOffset:null}));
  expect(await fetchBookVocabularyIds({fetcher,from:5,to:10})).toEqual([4]);
  expect(fetcher.mock.calls[0][0]).toBe('/api/learning/book-review?scope=1&from=5&to=10&offset=0');
 });
 it('fails closed if any page fails, including a later page',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({wordIds:[1],nextOffset:200})).mockResolvedValueOnce(Response.json({error:'offline'},{status:503}));
  await expect(fetchBookVocabularyIds({fetcher})).rejects.toThrow('범위');
 });
 it('rejects a stalled cursor instead of retrying indefinitely',async()=>{
  await expect(fetchBookVocabularyIds({fetcher:async()=>Response.json({wordIds:[1],nextOffset:0})})).rejects.toThrow('다음 위치');
 });
});
