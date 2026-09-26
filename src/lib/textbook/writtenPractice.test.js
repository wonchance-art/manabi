import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const OLD='c04e4e451a9ddc602fce8260',NEXT='e146271b705f753e1971c163';
const read=(id,name)=>fs.readFileSync(`src/content/textbookEditions/${id}/${name}`,'utf8');
const before=JSON.parse(read(OLD,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const plan=JSON.parse(fs.readFileSync('scripts/textbook/n5-written-practice.json','utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
const pyEnv={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
const questions=plan.pages.flatMap(p=>p.tasks);
const oldHtml=read(OLD,'index.html'),newHtml=read(NEXT,'index.html');

describe('N5 original written practice preserves the existing book',()=>{
 it('adds only declared manuscript pages without touching any old question, lesson or release',async()=>{
  expect(sha(read(OLD,'bundle.json'))).toBe(plan.baseBundleSha256);
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
  const restored=structuredClone(after.manuscript);
  expect(restored.frontMatter.splice(before.manuscript.frontMatter.length).map(p=>p.id)).toEqual(plan.pages.filter(p=>p.unit==='guide').map(p=>p.id));
  expect(restored.lessons[41].practice_pages.map(p=>p.id)).toEqual(['u42-order-plus','u42-text-plus']);
  delete restored.lessons[41].practice_pages;delete restored.writtenPractice;
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toHaveLength(before.pages.length+5);
  const added=new Set(plan.pages.map(p=>p.id));
  expect(after.pages.filter(p=>!added.has(p.id)).map(({page,...p})=>p)).toEqual(before.pages.map(({page,...p})=>p));
  expect(after.pages.map(p=>p.page)).toEqual(Array.from({length:499},(_,i)=>i+1));
  for(const [id,s]of Object.entries(before.sourceIndex))expect(after.sourceIndex[id].lesson).toBe(s.lesson);
  expect(Object.keys(after.sourceIndex).filter(id=>!before.sourceIndex[id])).toEqual(['u42-order-plus','u42-text-plus']);
 });
 it('keeps old draft keys and adds fifteen independent four-option groups',()=>{
  const keys=html=>new Set([...html.matchAll(/data-save="([^"]+)"/g)].map(m=>m[1]));
  expect([...keys(newHtml)].filter(k=>!keys(oldHtml).has(k)).sort()).toEqual(questions.map(q=>q.id).sort());
  for(const k of keys(oldHtml))expect(keys(newHtml).has(k)).toBe(true);
  expect(questions).toHaveLength(15);
  expect(after.manuscript.writtenPractice.optionMinHeight).toBe(44);
  expect([...newHtml.matchAll(/<label style="min-height:44px"><input type="radio" name="(?:kp|wp)-/g)]).toHaveLength(60);
  expect(new Set(questions.map(q=>q.id)).size).toBe(15);
  for(const q of questions){
   expect(new Set(q.options).size).toBe(4);
   expect(q.options.filter(o=>o===q.answer)).toHaveLength(1);
   expect(Object.keys(q.distractors).sort()).toEqual(q.options.filter(o=>o!==q.answer).sort());
   expect([...newHtml.matchAll(new RegExp(`name="${q.id}" data-save="${q.id}" value="([0-3])"`,'g'))].map(m=>m[1])).toEqual(['0','1','2','3']);
   if(q.order){expect([...q.order].sort()).toEqual([0,1,2,3]);expect(q.options[q.order[2]]).toBe(q.answer);}
  }
 });
 it('connects every new entry, prerequisite and old vocabulary evidence to a real section or anchor',()=>{
  const sections=extractReadingSections(newHtml),ids=new Set(sections.flatMap(s=>s.anchors));
  for(const p of plan.pages){
   const section=sections.find(s=>s.id===p.id);expect(section.unit).toBe(p.unit);
   expect(section.html).toContain('<details class="answers review-answers">');
   expect(section.html).not.toContain('review-answers" open');
   for(const link of p.help)expect(ids.has(link.target)).toBe(true);
   for(const q of p.tasks){
    if(q.wordSource){
     expect(q.answer.endsWith(q.wordSource.needle)).toBe(true);
     expect(ids.has(q.wordSource.target)).toBe(true);
     if(q.wordSource.target.startsWith('lex-'))expect(before.manuscript.lexicon.find(x=>x.id===q.wordSource.target).ja).toBe(q.wordSource.needle);
     else expect(sections.find(s=>s.id===q.wordSource.target).html).toContain(q.wordSource.needle);
    }
   }
  }
  for(const link of plan.entryLinks)expect(sections.find(s=>s.id===link.from).html).toContain(`href="#${link.target}"`);
 });
 it('changes old section content only by declared entry navigation and page-number metadata',()=>{
  const clean=html=>html.replace(/<nav class="book-recall-links" aria-label="조금 더 연습해 볼까요\?">[\s\S]*?<\/nav>/g,'')
   .replace(/(<div class="meta"><span>[^<]*<\/span><b>)\d+(<\/b>)/g,'$1#$2')
   .replace(/(<footer>manabi · 일본어 N5<span>)\d+ \/ \d+(<\/span>)/g,'$1#$2')
   .replace(/(href="#[^"]+">)\d+(?:–\d+)?(쪽 · 이 단계 시작 →)/g,'$1#$2');
  const sections=extractReadingSections(newHtml);
  for(const old of extractReadingSections(oldHtml))expect(clean(sections.find(s=>s.id===old.id).html),old.id).toBe(clean(old.html));
 });
 it('verifies assets, the standalone page catalog, original media and unchanged styling',async()=>{
  const book=await candidate(NEXT);expect(book.editionId).toBe(NEXT);
  for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
  expect(read(NEXT,'style.css')).toBe(read(OLD,'style.css'));
  const catalog=/const editionPages=[\s\S]*?;\nfunction syncEditionPdf/;
  expect(read(NEXT,'app.js').replace(catalog,'CATALOG')).toBe(read(OLD,'app.js').replace(catalog,'CATALOG'));
  expect(newHtml).toContain(`/api/books/japanese-n5/${NEXT}/asset?file=app.js`);
  expect(newHtml).toContain(`name="manuscript-revision" content="${NEXT}"`);
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect(after.artifactManifest.media).toEqual(before.artifactManifest.media);
 });
 it('builds byte-identically twice and rejects colliding IDs, stale vocabulary, bad keys and wrong star positions',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'n5-written-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-written-practice.py','--out',path.join(dir,run)],{env:pyEnv});
    for(const name of ['bundle.json','index.html','app.js','style.css'])expect(fs.readFileSync(path.join(dir,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
   const code=`import sys,copy,json,importlib.util\nsys.path.insert(0,'scripts/textbook')\ns=importlib.util.spec_from_file_location('written','scripts/textbook/build-n5-written-practice.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\np=json.load(open('scripts/textbook/n5-written-practice.json'));b=json.load(open('src/content/textbookEditions/${OLD}/bundle.json'));h=open('src/content/textbookEditions/${OLD}/index.html').read()\nfor case in range(5):\n x=copy.deepcopy(p)\n if case==0:x['pages'][0]['tasks'][0]['id']='kana-3'\n if case==1:x['pages'][0]['tasks'][0]['answer']='invalid'\n if case==2:x['pages'][0]['tasks'][0]['wordSource']['needle']='存在しない'\n if case==3:x['pages'][3]['tasks'][0]['order']=[0,1,2,3]\n if case==4:x['pages'][0]['help'][0]['target']='missing'\n try:m.validate(x,b,h)\n except (AssertionError,StopIteration):pass\n else:raise Exception('accepted invalid plan '+str(case))\nprint('five rejected')`;
   expect(execFileSync('python3',['-c',code],{env:pyEnv,encoding:'utf8'}).trim()).toBe('five rejected');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 },15000);
});
