import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,contentHash,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';
import {resolveBookSelection,bookSourceHref} from './sources';

const OLD='7f572327dc67893e9453246c',NEXT='6a1d083d5cf869c7ba0077c1';
const root=path.resolve('src/content/textbookEditions');
const load=id=>JSON.parse(fs.readFileSync(path.join(root,id,'bundle.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const base=load(OLD),next=load(NEXT);
const text=id=>fs.readFileSync(path.join(root,id,'index.html'),'utf8');
const changed=new Set(['u20','u23','u32','u35','u39','u42']);

describe('N5 staged study revision',()=>{
 it('leaves the publication candidate pointer, original bytes and unrelated content untouched',async()=>{
  expect((await currentCandidate()).editionId).toBe(OLD);
  expect(digest(fs.readFileSync(path.join(root,OLD,'bundle.json')))).toBe('ac5f4355474f88012f896d17e6925715f10140ed682092236b4d1bc9ad79bc1e');
  for(const lesson of next.manuscript.lessons){
   const original=base.manuscript.lessons.find(l=>l.id===lesson.id);
   if(!changed.has(lesson.id)&&![37,41].includes(lesson.number)){
    const unchanged=({durationNote,preparation,...rest})=>rest;
    expect(unchanged(lesson)).toEqual(unchanged(original));
   }
   for(const key of ['id','number','kanji','audioEnabled','patterns','study_pages','dialog','checks'])expect(lesson[key]).toEqual(original[key]);
  }
  expect(next.manuscript.kanjiIndex.map(({readingLink,...entry})=>entry)).toEqual(base.manuscript.kanjiIndex);
  for(const key of ['lexicon','grammarIndex','cultures'])expect(next.manuscript[key]).toEqual(base.manuscript[key]);
 });
 it('retains all page, source and learner answer identities while adding five routes',()=>{
  expect(next.pages).toHaveLength(base.pages.length+5);
  expect(next.pages.map(p=>p.page)).toEqual(Array.from({length:494},(_,i)=>i+1));
  const ids=new Set(next.pages.map(p=>p.id));expect(ids.size).toBe(next.pages.length);
  for(const page of base.pages)expect(ids.has(page.id)).toBe(true);
  for(const [id,source] of Object.entries(base.sourceIndex))expect(next.sourceIndex[id]?.lesson).toBe(source.lesson);
  const keys=html=>[...html.matchAll(/data-save="([^"]+)"/g)].map(m=>m[1]).sort();
  expect(keys(text(NEXT))).toEqual(keys(text(OLD)));
 });
 it('builds each route in reading order with a working start, stopping point and recall destination',()=>{
  const sections=extractReadingSections(text(NEXT)),ids=new Set(sections.flatMap(s=>s.anchors));
  for(const lesson of next.manuscript.lessons.filter(l=>changed.has(l.id)&&l.study_route)){
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
 it('preserves the earlier review candidate and every saved answer while clarifying three instructions',()=>{
  const previous=load('e44cd7230ef94ff7f6293e2d');
  expect(digest(fs.readFileSync(path.join(root,previous.editionId,'bundle.json')))).toBe('5b9378e80995893666ca16d0a7c6fa557b8f8bcb10c4287d391898291290471c');
  const tasks=value=>{
   if(Array.isArray(value))return value.flatMap(tasks);
   if(!value||typeof value!=='object')return [];
   return [...(value.id&&value.prompt&&value.answer?[value]:[]),...Object.values(value).flatMap(tasks)];
  };
  for(const number of [32,39]){
   const before=tasks(previous.manuscript.lessons.find(l=>l.number===number));
   const after=tasks(next.manuscript.lessons.find(l=>l.number===number));
   expect(after.map(({id,answer,cue})=>({id,answer,cue}))).toEqual(before.map(({id,answer,cue})=>({id,answer,cue})));
   expect(after.filter(q=>q.prompt!==before.find(p=>p.id===q.id).prompt).map(q=>q.id)).toEqual(number===32?['복습 12']:['복습 17','복습 A']);
  }
  const html=text(NEXT);expect(html).toContain('이 두 내용을 각각 한 문장으로');
  expect(html).toContain('별도의 문장으로');expect(html).toContain('“먹으면 안 된다”는 뜻인지도');
 });
 it('keeps lesson 39 learning order and separates optional practice, next-day recall and cumulative review',()=>{
  const previous=load('e44cd7230ef94ff7f6293e2d');
  expect(next.pages.filter(p=>p.id.startsWith('u39-')).map(p=>p.id)).toEqual(previous.pages.filter(p=>p.id.startsWith('u39-')).map(p=>p.id));
  const own=extractReadingSections(text(NEXT)).filter(s=>s.unit==='u39');
  const lesson=next.manuscript.lessons.find(l=>l.number===39);
  for(const [suffix,note] of Object.entries(lesson.reading_notes)){
   const html=own.find(s=>s.id==='u39-'+suffix).html;
   expect(html).toContain(note.text);expect(html).not.toContain(note.before);
   expect(html.match(new RegExp(note.text,'g'))).toHaveLength(1);
  }
  const ids=new Set(extractReadingSections(text(NEXT)).flatMap(s=>s.anchors));
  for(const {after,target,label} of lesson.recall_links){
   expect(ids.has(target)).toBe(true);expect(own.find(s=>s.id==='u39-'+after).html).toContain(label);
  }
  for(const pause of lesson.study_pauses){
   const html=own.find(s=>s.id==='u39-'+pause.after).html;
   expect(html).toContain(pause.body);for(const link of pause.links)expect(html).toContain(`href="#${link.target}"`);
  }
  expect(own.find(s=>s.id==='u39-extra-practice').html).toContain('건너뛰어도 돼요');
 });
 it('counts reused audio separately without reporting that the revision deleted it',()=>{
  const audit=JSON.parse(execFileSync(process.execPath,['scripts/audit-n5-edition.mjs',NEXT],{encoding:'utf8'}));
  expect(audit.issues).toEqual([]);expect(audit.summary.bundledAudioFiles).toBe(0);
  expect(audit.summary.inheritedAudioFiles).toBe(147);expect(audit.summary.preservedAudioFiles).toBe(147);
 });
});
