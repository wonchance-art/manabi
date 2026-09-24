import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,contentHash,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';
import {resolveBookSelection,bookSourceHref} from './sources';

const OLD='7f572327dc67893e9453246c',NEXT='e44cd7230ef94ff7f6293e2d';
const root=path.resolve('src/content/textbookEditions');
const load=id=>JSON.parse(fs.readFileSync(path.join(root,id,'bundle.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=load(OLD),next=load(NEXT);
const text=id=>fs.readFileSync(path.join(root,id,'index.html'),'utf8');
const changed=new Set(['u20','u23','u35','u42']);

describe('N5 staged study revision',()=>{
 it('leaves the publication candidate pointer, original bytes and unrelated content untouched',async()=>{
  expect((await currentCandidate()).editionId).toBe(OLD);
  expect(digest(fs.readFileSync(path.join(root,OLD,'bundle.json')))).toBe('ac5f4355474f88012f896d17e6925715f10140ed682092236b4d1bc9ad79bc1e');
  for(const lesson of next.manuscript.lessons){
   const original=base.manuscript.lessons.find(l=>l.id===lesson.id);
   if(!changed.has(lesson.id))expect(lesson).toEqual(original);
   for(const key of ['id','number','kanji','audioEnabled','patterns','study_pages','dialog','checks'])expect(lesson[key]).toEqual(original[key]);
  }
  for(const key of ['lexicon','grammarIndex','kanjiIndex','cultures'])expect(next.manuscript[key]).toEqual(base.manuscript[key]);
 });
 it('retains all page, source and learner answer identities while adding four routes',()=>{
  expect(next.pages).toHaveLength(base.pages.length+4);
  expect(next.pages.map(p=>p.page)).toEqual(Array.from({length:493},(_,i)=>i+1));
  const ids=new Set(next.pages.map(p=>p.id));expect(ids.size).toBe(next.pages.length);
  for(const page of base.pages)expect(ids.has(page.id)).toBe(true);
  for(const [id,source] of Object.entries(base.sourceIndex))expect(next.sourceIndex[id]?.lesson).toBe(source.lesson);
  const keys=html=>[...html.matchAll(/data-save="([^"]+)"/g)].map(m=>m[1]).sort();
  expect(keys(text(NEXT))).toEqual(keys(text(OLD)));
 });
 it('builds each route in reading order with a working start, stopping point and recall destination',()=>{
  const sections=extractReadingSections(text(NEXT)),ids=new Set(sections.flatMap(s=>s.anchors));
  for(const lesson of next.manuscript.lessons.filter(l=>changed.has(l.id))){
   const own=sections.filter(s=>s.unit===lesson.id),order=own.map(s=>s.id);
   expect(order.slice(0,2)).toEqual([lesson.id+'-start',lesson.id+'-route']);
   const covered=[];
   for(const stage of lesson.study_route){
    const targets=stage.targets.map(s=>lesson.id+'-'+s),positions=targets.map(id=>order.indexOf(id));
    expect(positions.every(n=>n>=0)).toBe(true);expect(positions).toEqual([...positions].sort((a,b)=>a-b));
    const last=own.find(s=>s.id===targets.at(-1));expect(last.html).toContain(stage.pause);
    covered.push(...targets);
   }
   expect(covered).toEqual(order.filter(id=>!id.endsWith('-start')&&!id.endsWith('-route')));
   for(const {after,target,label} of lesson.recall_links){expect(ids.has(target)).toBe(true);expect(own.find(s=>s.id===lesson.id+'-'+after).html).toContain(label);}
  }
 });
 it('makes the final contrast question explicit without changing its saved key or correct answer',()=>{
  const question=book=>book.manuscript.lessons[41].review_pages[2].tasks[2];
  expect(question(next).id).toBe(question(base).id);expect(question(next).answer).toBe(question(base).answer);
  expect(question(next).cue).toContain('いつも 人が 多いです');expect(question(next).cue).toContain('今日は だれも いません');
  expect(question(next).cue).not.toContain('それから');expect(question(next).why).toContain('평소의 모습');
  const html=extractReadingSections(text(NEXT)).find(s=>s.id==='u42-review3').html;
  expect(html).toContain('今日は');expect(html).not.toContain('小さかったです');
 });
 it('still resolves examples to their own edition without moving a saved source to the revision',()=>{
  for(const b of [base,next]){
   const locator={bookId:'japanese-n5',editionId:b.editionId,pageId:'u20-patterns',quote:'としょかんに 行きます。'};
   const source=resolveBookSelection(b,locator,{word_text:'としょかん',meaning:'도서관'});
   expect(bookSourceHref(source)).toContain(`edition=${b.editionId}#u20-patterns`);
  }
 });
 it('verifies the revision and reuses only declared media from the intact original edition',async()=>{
  const b=await candidate(NEXT);expect(b.contentHash).toBe(contentHash(b.manuscript));
  expect(b.editionId).toBe(b.contentHash.slice(0,24));
  for(const file of Object.keys(b.assets))expect((await verifiedAsset(b,file)).bytes.length).toBe(b.assets[file].bytes);
  expect(b.artifactManifest.media).toEqual({web:true,pdf:false,audio:'existing-only'});
  expect(b.qa.pdfFields).toBeUndefined();expect(b.qa.visuallyReviewedPages).toBeUndefined();
  const all=text(NEXT)+fs.readFileSync(path.join(root,NEXT,'style.css'),'utf8');
  for(const match of all.matchAll(/\/api\/books\/japanese-n5\/([a-f0-9]{24})\/asset\?file=([-a-zA-Z0-9_./]+)/g)){
   expect([OLD,NEXT]).toContain(match[1]);expect(load(match[1]).assets[match[2]]).toBeTruthy();
   if(match[1]===OLD)expect(/^(fonts|audio)\//.test(match[2])).toBe(true);
  }
  expect(text(NEXT)).not.toMatch(/data-mode="pdf"|href="[^"]*\.pdf|id="edition-pdf"/);
 });
 it('reproduces the checked files byte for byte without touching the current edition index',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'n5-rebuild-'));
  try{
   execFileSync('python3',['scripts/textbook/build-n5-study-routes.py','--out',dir]);
   for(const name of ['bundle.json','index.html','app.js','style.css'])expect(digest(fs.readFileSync(path.join(dir,NEXT,name)))).toBe(digest(fs.readFileSync(path.join(root,NEXT,name))));
   expect(JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8')).current).toBe(OLD);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
 it('counts reused audio separately without reporting that the revision deleted it',()=>{
  const audit=JSON.parse(execFileSync(process.execPath,['scripts/audit-n5-edition.mjs',NEXT],{encoding:'utf8'}));
  expect(audit.issues).toEqual([]);expect(audit.summary.bundledAudioFiles).toBe(0);
  expect(audit.summary.inheritedAudioFiles).toBe(147);expect(audit.summary.preservedAudioFiles).toBe(147);
 });
});
