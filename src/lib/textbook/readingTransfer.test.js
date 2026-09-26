import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const ROOT=path.resolve('src/content/textbookEditions');
const OLD='54f70824da508cbcea7dd578',NEXT='12d69782944b95ef7a11e529';
const read=(id,name)=>fs.readFileSync(path.join(ROOT,id,name),'utf8');
const before=JSON.parse(read(OLD,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const plan=JSON.parse(fs.readFileSync('scripts/textbook/n5-reading-transfer.json','utf8'));
const env={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const oldSections=extractReadingSections(read(OLD,'index.html'));
const sections=extractReadingSections(read(NEXT,'index.html'));
const compact=text=>text.replace(/\s/g,'');

describe('N5 revised short readings stay coherent and edition isolated',()=>{
 it('changes only the complete declared readings and prerequisite vocabulary',async()=>{
  expect(hash(read(OLD,'bundle.json'))).toBe(plan.baseBundleSha256);
  const restored=structuredClone(after.manuscript);
  for(const edit of plan.readingRevisions){
   const old=before.manuscript.lessons.find(l=>l.id===edit.lesson);
   const next=restored.lessons.find(l=>l.id===edit.lesson);
   expect(Object.keys(edit.after).sort()).toEqual(['reading','reading_answer','reading_question','reading_title','reading_why']);
   for(const key of Object.keys(edit.before)){
    expect(old[key]).toBe(edit.before[key]);expect(next[key]).toBe(edit.after[key]);next[key]=edit.before[key];
   }
  }
  for(const support of plan.readingVocabulary){
   const lesson=restored.lessons.find(l=>l.id===support.lesson);
   expect(lesson.reading_vocabulary).toEqual(support.entries);delete lesson.reading_vocabulary;
  }
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toEqual(before.pages);
  expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  for(const [id,value] of Object.entries(before.sourceIndex))expect(after.sourceIndex[id].lesson).toBe(value.lesson);
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
 });
 it('keeps every unaffected page and saved control; updates visible source text and help before reading',()=>{
  const changed=new Set([...plan.readingRevisions,...plan.readingVocabulary].map(e=>`${e.lesson}-practice`));
  for(const old of oldSections)if(!changed.has(old.id))expect(sections.find(s=>s.id===old.id).html).toBe(old.html);
  for(const regex of [/\bid="([^"]+)"/g,/data-save="([^"]+)"/g,/<div class="examples">/g]){
   expect([...read(NEXT,'index.html').matchAll(regex)].map(m=>m[0])).toEqual([...read(OLD,'index.html').matchAll(regex)].map(m=>m[0]));
  }
  for(const revision of plan.readingRevisions){
   const id=`${revision.lesson}-practice`,section=sections.find(s=>s.id===id).html;
   const source=compact(after.sourceIndex[id].text);
   for(const value of Object.values(revision.after))expect(source).toContain(compact(value));
   expect(source).not.toContain(compact(revision.before.reading));
   const controls=html=>[...html.matchAll(/<(?:fieldset|textarea)\b[\s\S]*?<\/(?:fieldset|textarea)>/g)].map(m=>m[0]);
   expect(controls(section)).toEqual(controls(oldSections.find(s=>s.id===id).html));
  }
  expect(sections.find(s=>s.id==='u37-practice').html).toContain('<ruby>持って<rt>もって</rt></ruby>');
  for(const support of plan.readingVocabulary){
   const html=sections.find(s=>s.id===`${support.lesson}-practice`).html;
   const help=html.match(/<aside class="note book-reading-help">[\s\S]*?<\/aside>/)?.[0];
   expect(help).toBeTruthy();expect(html.indexOf('class="reading"')).toBeGreaterThan(-1);
   expect(html.indexOf('book-reading-help')).toBeLessThan(html.indexOf('class="reading"'));
   for(const e of support.entries)expect(help).toContain(e.meaning);
  }
 });
 it('verifies assets and retains the existing runtime, styles, media and old edition',async()=>{
  const book=await candidate(NEXT);
  for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
  for(const name of ['app.js','style.css']){
   expect(read(NEXT,name)).toBe(read(OLD,name));
   expect(read(NEXT,'index.html')).toContain(`/${NEXT}/asset?file=${name}`);
  }
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect(hash(read(OLD,'bundle.json'))).toBe(plan.baseBundleSha256);
 });
 it('rebuilds twice and rejects incomplete reading bundles, unknown ruby and copy-only answer changes',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'n5-reading-transfer-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-copy-review.py','--plan','scripts/textbook/n5-reading-transfer.json','--out',path.join(temp,run)],{env});
    for(const name of ['index.html','app.js','style.css','bundle.json'])expect(fs.readFileSync(path.join(temp,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
   const code=`import sys,importlib.util,json,copy\nsys.path.insert(0,'scripts/textbook')\ns=importlib.util.spec_from_file_location('copy_review','scripts/textbook/build-n5-copy-review.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\np=json.load(open('scripts/textbook/n5-reading-transfer.json'));b=json.load(open('src/content/textbookEditions/'+p['baseEdition']+'/bundle.json'))\nr=copy.deepcopy(p['readingRevisions'][0]);del r['after']['reading_answer']\ncases=[lambda:m.apply_reading_revisions(b['manuscript'],'',[r],[]),lambda:m.reading_html('猫',{'kanji':{}}),lambda:m.apply_edits({'reading_answer':'old'},'',[{'path':['reading_answer'],'before':'old','after':'new'}])]\nfor case in cases:\n try:case()\n except AssertionError:print('rejected')\n else:raise Exception('accepted unsafe revision')`;
   expect(execFileSync('python3',['-c',code],{env,encoding:'utf8'}).trim().split('\n')).toEqual(['rejected','rejected','rejected']);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 },15000);
});
