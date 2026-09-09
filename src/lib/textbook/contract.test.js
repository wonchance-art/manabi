import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {editableFields,validateManuscript,withField} from './contract';
import {candidate,currentCandidate,contentHash,verifiedAsset,publishedBookCatalog} from './server';
import {resolveBookSelection,bookSourceHref} from './sources';
import {sourceHref} from '../learningSources';
const base={id:'japanese-n5',revision:'a'.repeat(24),lessons:[{id:'u01',number:1,title:'인사',dialog:[{ja:'こんにちは',ko:'안녕하세요'}]}]};
describe('one-book publication contract',()=>{
 it('copy editing preserves IDs and structure',()=>{const edited=withField(base,['lessons',0,'dialog',0,'ko'],'안녕');expect(validateManuscript(edited,base)).toBe(null);expect(base.lessons[0].dialog[0].ko).toBe('안녕하세요');expect(validateManuscript({...edited,lessons:[]},base)).toBeTruthy();expect(validateManuscript(withField(base,['lessons',0,'id'],'u02'),base)).toBeTruthy();expect(validateManuscript(withField(base,['lessons',0,'title'],''),base)).toBeTruthy();expect(editableFields(base).some(f=>f.path.includes('revision'))).toBe(false)});
 it('hash ignores transport metadata but changes when learner content changes',()=>{expect(contentHash({...base,source:{url:'elsewhere'}})).toBe(contentHash(base));expect(contentHash(withField(base,['lessons',0,'title'],'다른 과'))).not.toBe(contentHash(base))});
 it('the real bundle has all checked assets and canonical hash agreement',async()=>{const b=await currentCandidate();expect(b.editionId).toBe(contentHash(b.manuscript).slice(0,24));expect(b.pages).toHaveLength(489);expect(b.manuscript.lessons).toHaveLength(42);expect(b.manuscript.lexicon).toHaveLength(625);expect(b.manuscript.grammarIndex).toHaveLength(125);expect(b.manuscript.kanjiIndex).toHaveLength(103);for(const file of Object.keys(b.assets)){const a=await verifiedAsset(b,file);expect(a.bytes.length).toBe(b.assets[file].bytes)}expect(b.assets['pages/page-01.png']).toBeUndefined();expect(Object.keys(b.sourceIndex).length).toBeGreaterThan(1000)});
 it('asset paths are restricted to verified manifest entries',async()=>{const b=await currentCandidate();for(const file of ['../bundle.json','bundle.json','%2e%2e/secret','missing'])await expect(verifiedAsset(b,file)).rejects.toMatchObject({status:404});await expect(candidate('../')).rejects.toMatchObject({status:404})});
 it('selecting actual source text keeps the exact edition when revisiting',async()=>{const b=await currentCandidate();const id='u03-study1';const quote='ちちは せんせいです。';const s=resolveBookSelection(b,{bookId:'japanese-n5',editionId:b.editionId,pageId:id,quote},{word_text:'ちち',meaning:'아버지'});expect(s.chapterSlug).toBe('n5-book-u03');expect(sourceHref({...s,lang:'Japanese',chapter_slug:s.chapterSlug})).toBe(`/books/japanese-n5?edition=${b.editionId}#${id}`);expect(bookSourceHref({locator:{...s.locator,pageId:'javascript:alert(1)'}})).toBe(null)});
 it('rejects forged quotes, edition IDs and lesson overrides',async()=>{const b=await currentCandidate();const s={bookId:'japanese-n5',editionId:b.editionId,pageId:'u03-study1',quote:'ちちは せんせいです。',lesson:42};expect(resolveBookSelection(b,s,{word_text:'ちち'}).chapterSlug).toBe('n5-book-u03');for(const change of [{quote:'存在しない文章だ'},{pageId:'missing'},{editionId:'0'.repeat(24)}])expect(()=>resolveBookSelection(b,{...s,...change},{word_text:'ちち'})).toThrow();expect(()=>resolveBookSelection(b,s,{word_text:'forged'})).toThrow()});
 it('keeps legacy catalogs working before additive DB migration',async()=>{const db={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({error:{code:'42P01'}})})};expect(await publishedBookCatalog(db)).toEqual([])});
 it('offers the accepted web without a PDF entry or automatic PDF load',async()=>{
  const b=await currentCandidate();const html=(await verifiedAsset(b,'index.html')).bytes.toString();
  expect(html).not.toMatch(/data-mode="pdf"|href="[^"]*\.pdf|id="edition-pdf"/);
  expect(html).toContain('일본어 N5 · 웹 교재');
  const js=(await verifiedAsset(b,'app.js')).bytes.toString();
  expect(js).toContain("if(mode==='pdf')mode='web'");
 });
});
