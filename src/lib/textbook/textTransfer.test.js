import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

describe.each([
 {label:'text grammar',old:'595b398b6d8f19c98aeb7ae7',next:'d98e42bd66b8b4d593014dde',planFile:'n5-text-transfer.json'},
 {label:'short messages',old:'d98e42bd66b8b4d593014dde',next:'31e53cf1221211035c8770b6',planFile:'n5-message-reading.json'},
 {label:'library information',old:'31e53cf1221211035c8770b6',next:'fdf070fa5123b18cc55f24c7',planFile:'n5-information-reading.json'},
])('independent $label practice preserves earlier teaching and answers',({old:OLD,next:NEXT,planFile})=>{
 const read=(id,file)=>fs.readFileSync(`src/content/textbookEditions/${id}/${file}`,'utf8');
 const before=JSON.parse(read(OLD,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
 const planPath=`scripts/textbook/${planFile}`;
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
 it('appends only the new practice and retains the original practice catalog and published edition',async()=>{
  const restored=structuredClone(after.manuscript);
  expect(restored.lessons[41].practice_pages.pop()).toEqual(plan.pages[0]);
  expect(restored.writtenPractice.pageIds).toEqual([...before.manuscript.writtenPractice.pageIds,plan.pages[0].id]);
  expect(restored.writtenPractice.entryLinks).toEqual([...before.manuscript.writtenPractice.entryLinks,...plan.entryLinks]);
  restored.writtenPractice=before.manuscript.writtenPractice;
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
  expect(after.pages.filter(p=>p.id!==plan.pages[0].id).map(({page,...p})=>p)).toEqual(before.pages.map(({page,...p})=>p));
  for(const [id,source] of Object.entries(before.sourceIndex))expect(after.sourceIndex[id].lesson).toBe(source.lesson);
 });
 it('retains every old answer control and section; new explanations are closed and no cue is injected',()=>{
  const old=read(OLD,'index.html'),html=read(NEXT,'index.html');
  const controls=h=>[...h.matchAll(/<(?:input|textarea)\b[^>]*>/g)].map(m=>m[0]);
  expect(controls(html).filter(tag=>!plan.pages[0].tasks.some(t=>tag.includes(`data-save="${t.id}"`)))).toEqual(controls(old));
  const clean=h=>h.replace(/<nav class="book-recall-links" aria-label="조금 더 연습해 볼까요\?">[\s\S]*?<\/nav>/g,'')
   .replace(/(<div class="meta"><span>[^<]*<\/span><b>)\d+(<\/b>)/g,'$1#$2')
   .replace(/(<footer>manabi · 일본어 N5<span>)\d+ \/ \d+(<\/span>)/g,'$1#$2')
   .replace(/(href="#[^"]+">)\d+(?:–\d+)?(쪽 · 이 단계 시작 →)/g,'$1#$2');
  const sections=extractReadingSections(html),newPage=sections.find(s=>s.id===plan.pages[0].id);
  for(const s of extractReadingSections(old))expect(clean(sections.find(n=>n.id===s.id).html),s.id).toBe(clean(s.html));
  expect(newPage.html).not.toContain('class="cue"');
  expect(newPage.html).toContain('<details class="answers review-answers">');
  expect(newPage.html).not.toContain('review-answers" open');
  const answerStart=newPage.html.indexOf('<details');
  const visibleText=newPage.html.slice(0,answerStart).replace(/<[^>]+>/g,'');
  const answerText=newPage.html.slice(answerStart).replace(/<[^>]+>/g,'');
  for(const t of plan.pages[0].tasks){
   expect(visibleText).not.toContain(t.why);
   expect(answerText).toContain(t.why);
   for(const reason of Object.values(t.distractors))expect(answerText).toContain(reason);
  }
  const ids=new Set(sections.flatMap(s=>s.anchors));
  for(const target of [...newPage.html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]))expect(ids.has(target)).toBe(true);
 });
 it('keeps styling, media, source returns and runtime unchanged apart from the page catalog',async()=>{
  const book=await candidate(NEXT);
  for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
  expect(read(NEXT,'style.css')).toBe(read(OLD,'style.css'));
  const catalog=/const editionPages=[\s\S]*?;\nfunction syncEditionPdf/;
  expect(read(NEXT,'app.js').replace(catalog,'CATALOG')).toBe(read(OLD,'app.js').replace(catalog,'CATALOG'));
  expect(after.artifactManifest.media).toEqual(before.artifactManifest.media);
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect(Object.keys(after.sourceIndex).filter(id=>!before.sourceIndex[id])).toEqual([plan.pages[0].id]);
 });
 it('rebuilds byte-identically from the pinned base while the original generator plan stays reproducible',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'n5-text-transfer-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-written-practice.py','--plan',planPath,'--out',path.join(dir,run)],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
    for(const name of ['bundle.json','index.html','app.js','style.css'])expect(fs.readFileSync(path.join(dir,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 },15000);
});

it('rejects a new practice continuation that cannot return to a real book section',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'n5-continuation-'));
 try{
  for(const field of ['back','following']){
   const plan=JSON.parse(fs.readFileSync('scripts/textbook/n5-information-reading.json','utf8'));
   plan.pages[0][field].target='missing-book-section';
   const file=path.join(dir,`${field}.json`);fs.writeFileSync(file,JSON.stringify(plan));
   expect(()=>execFileSync('python3',['scripts/textbook/build-n5-written-practice.py','--plan',file,'--out',path.join(dir,'out')],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:'pipe'})).toThrow();
   expect(fs.existsSync(path.join(dir,'out'))).toBe(false);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
},15000);
