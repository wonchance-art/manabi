import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const ROOT=path.resolve('src/content/textbookEditions'),NEXT='978a06f6d8d9f1c0fc0df88b';
const plan=JSON.parse(fs.readFileSync('scripts/textbook/n5-early-prerequisites.json','utf8'));
const read=(id,name)=>fs.readFileSync(path.join(ROOT,id,name),'utf8');
const before=JSON.parse(read(plan.baseEdition,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const hash=text=>createHash('sha256').update(text).digest('hex');

describe('N5 prerequisite help is additive and isolated from saved learning',()=>{
 it('preserves tasks, answers, prior teaching, sources and runtime while placing help before its use',async()=>{
  expect(hash(read(plan.baseEdition,'bundle.json'))).toBe(plan.baseBundleSha256);
  const restored=structuredClone(after.manuscript);
  for(const edit of plan.edits){let node=restored;for(const key of edit.path.slice(0,-1))node=node[key];node[edit.path.at(-1)]=edit.before;}
  for(const help of plan.readingVocabulary)delete restored.lessons.find(l=>l.id===help.lesson).reading_vocabulary;
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toEqual(before.pages);
  const changed=new Set([...plan.edits.flatMap(e=>e.render.map(r=>r.target)),...plan.readingVocabulary.map(e=>e.lesson+'-practice')]);
  const sections=extractReadingSections(read(NEXT,'index.html'));
  for(const section of extractReadingSections(read(plan.baseEdition,'index.html')))if(!changed.has(section.id))expect(sections.find(s=>s.id===section.id).html).toBe(section.html);
  for(const regex of [/\bid="([^"]+)"/g,/<input\b[^>]*>/g,/<textarea\b[^>]*>/g,/<a\b[^>]*\bhref="([^"]+)"/g,/<ruby>[\s\S]*?<\/ruby>/g,/<div class="examples">/g])expect([...read(NEXT,'index.html').matchAll(regex)].map(m=>m[0])).toEqual([...read(plan.baseEdition,'index.html').matchAll(regex)].map(m=>m[0]));
  expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  for(const [id,source] of Object.entries(before.sourceIndex)){
   expect(after.sourceIndex[id].lesson).toBe(source.lesson);
   if(!changed.has(id))expect(after.sourceIndex[id]).toEqual(source);
  }
  for(const support of plan.readingVocabulary){
   const section=sections.find(s=>s.id===support.lesson+'-practice').html;
   const help=section.match(/<aside class="note book-reading-help">[\s\S]*?<\/aside>/)?.[0];
   expect(help).toBeTruthy();expect(section.indexOf('book-reading-help')).toBeLessThan(section.indexOf('class="reading"'));
   const lesson=after.manuscript.lessons.find(l=>l.id===support.lesson);
   for(const e of support.entries){expect(lesson.reading).toContain(e.word);expect(help).toContain(e.meaning);}
   expect(help).not.toContain(lesson.reading_answer);
  }
  expect(sections.findIndex(s=>s.id==='u03-study1')).toBeLessThan(sections.findIndex(s=>s.id==='u03-family-check'));
  for(const name of ['app.js','style.css'])expect(read(NEXT,name)).toBe(read(plan.baseEdition,name));
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
  const book=await candidate(NEXT);for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
 });
 it('rebuilds identical artifacts twice from the pinned prior edition',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'n5-prerequisites-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-copy-review.py','--plan','scripts/textbook/n5-early-prerequisites.json','--out',path.join(temp,run)],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
    for(const name of ['bundle.json','index.html','app.js','style.css'])expect(fs.readFileSync(path.join(temp,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
   expect(hash(read(plan.baseEdition,'bundle.json'))).toBe(plan.baseBundleSha256);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 },15000);
});
