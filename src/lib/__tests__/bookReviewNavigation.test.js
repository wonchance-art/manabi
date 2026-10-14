import { describe, it, expect, vi } from 'vitest';
import { safeBookReturn, bookReviewHref, bookReferenceHref, bookExpressionListHref, fetchBookVocabularyIds, fetchMaterialVocabularyIds } from '../bookReviewNavigation';
import { parseReviewScope } from '../reviewScope';
const reading='/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u42-message-reading';
const parseHref=href=>parseReviewScope(new URL(href,'https://local').searchParams);
describe('book review scope and return',()=>{
 it('preserves the exact edition/anchor and separates a reference visit from the return',()=>{
  // REV-SCOPE-R1A: 교재 범위는 범위 주소 정본(src=book:…)으로 만든다 — 판본 · 문단 돌아갈 곳은 그대로.
  expect(parseHref(bookReviewHref(reading))).toEqual({explicit:true,scope:{lang:'Japanese',level:null,source:{kind:'book',bookId:'japanese-n5',from:1,to:42},state:'due'},returnTo:reading});
  expect(parseHref(bookReviewHref(reading,{from:5,to:10})).scope.source).toEqual({kind:'book',bookId:'japanese-n5',from:5,to:10});
  expect(bookReferenceHref(reading)).toBe(reading.replace('#','&reference=1#'));
  expect(bookReferenceHref('/viewer/91?sourceText=hi')).toBe('/viewer/91?sourceText=hi');
  expect(bookExpressionListHref(reading)).toBe(`/books/japanese-n5/review?edition=8a8c1c1fd452773810abaf8c&returnTo=${encodeURIComponent(reading)}`);
  expect(bookExpressionListHref('//evil.test')).toBeNull();
 });
 it('the legacy ?book= link keeps working as the whole-book scope with its return',()=>{
  const legacy=parseReviewScope({book:'japanese-n5',returnTo:reading});
  expect(legacy).toEqual(parseHref(bookReviewHref(reading)));
  expect(parseReviewScope({book:'japanese-n5'}).returnTo).toBe('/books/japanese-n5');
 });
 it.each(['https://evil.test','//evil.test','/admin/books','/books/japanese-n5?edition=bad#u42','/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c&returnTo=//evil','/books/japanese-n5?edition=8a8c1c1fd452773810abaf8c#u99', [reading,reading]])('rejects unsafe or ambiguous reading return %s',value=>expect(safeBookReturn(value)).toBeNull());
 it('invalid explicit scope never means all vocabulary',()=>{
  expect(parseReviewScope({book:'unknown'})).toMatchObject({explicit:true,invalid:true});
  expect(parseReviewScope({book:['japanese-n5','unknown']})).toMatchObject({explicit:true,invalid:true});
  expect(parseReviewScope({})).toEqual({explicit:false});
 });
 it('loads every source page and deduplicates the same word across editions',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({wordIds:[1,1,2],nextOffset:200})).mockResolvedValueOnce(Response.json({wordIds:[2,3],nextOffset:null}));
  expect(await fetchBookVocabularyIds({fetcher})).toEqual([1,2,3]);
  expect(fetcher.mock.calls[0][0]).toBe('/api/learning/book-review?scope=1&offset=0');
  expect(fetcher.mock.calls[1][0]).toContain('offset=200');
 });
 it('a lesson range asks the server for those chapters only; the whole book keeps the old request',async()=>{
  const fetcher=vi.fn(async()=>Response.json({wordIds:[7],nextOffset:null}));
  await fetchBookVocabularyIds({fetcher,from:5,to:10});
  expect(fetcher.mock.calls[0][0]).toBe('/api/learning/book-review?scope=1&from=5&to=10&offset=0');
  await fetchBookVocabularyIds({fetcher,from:1,to:42});
  expect(fetcher.mock.calls[1][0]).toBe('/api/learning/book-review?scope=1&offset=0');
 });
 it('fails closed if any page fails, including a later page',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({wordIds:[1],nextOffset:200})).mockResolvedValueOnce(Response.json({error:'offline'},{status:503}));
  await expect(fetchBookVocabularyIds({fetcher})).rejects.toThrow('범위');
  const material=vi.fn().mockResolvedValueOnce(Response.json({wordIds:[1],nextOffset:500})).mockResolvedValueOnce(Response.json({error:'offline'},{status:503}));
  await expect(fetchMaterialVocabularyIds({ids:['91','92'],fetcher:material})).rejects.toThrow('범위');
  expect(material.mock.calls[0][0]).toBe('/api/learning/material-review?ids=91,92&offset=0');
 });
 it('rejects a stalled cursor instead of retrying indefinitely',async()=>{
  await expect(fetchBookVocabularyIds({fetcher:async()=>Response.json({wordIds:[1],nextOffset:0})})).rejects.toThrow('다음 위치');
 });
});
