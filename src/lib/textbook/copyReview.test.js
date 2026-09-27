import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const ROOT=path.resolve('src/content/textbookEditions'),OLD='6a1d083d5cf869c7ba0077c1',NEXT='c04e4e451a9ddc602fce8260';
const read=(id,name)=>fs.readFileSync(path.join(ROOT,id,name),'utf8');
const before=JSON.parse(read(OLD,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const edits=JSON.parse(fs.readFileSync('scripts/textbook/n5-copy-edits.json','utf8')).edits;
const hash=value=>createHash('sha256').update(value).digest('hex');
const pyEnv={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
const at=(value,keys)=>keys.reduce((node,key)=>node[key],value);

describe('N5 copy review preserves editions and learning records',()=>{
 it('changes only declared manuscript strings, never the answer key, source or published pointer',async()=>{
  expect(hash(read(OLD,'bundle.json'))).toBe('2f30b6a4d9297b115f48915e3cd96910d48b8f57d17baad045c77867a5807b92');
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
  const restored=structuredClone(after.manuscript);
  for(const edit of edits){
   expect(at(restored,edit.path)).toBe(edit.after);
   expect(at(before.manuscript,edit.path)).toBe(edit.before);
   at(restored,edit.path.slice(0,-1))[edit.path.at(-1)]=edit.before;
  }
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toEqual(before.pages);
  expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  for(const [id,source] of Object.entries(before.sourceIndex))expect(after.sourceIndex[id].lesson).toBe(source.lesson);
  for(const regex of [/\bid="([^"]+)"/g,/data-save="([^"]+)"/g,/href="([^"]+)"/g])expect([...read(NEXT,'index.html').matchAll(regex)].map(m=>m[1])).toEqual([...read(OLD,'index.html').matchAll(regex)].map(m=>m[1]));
 });
 it('touches only declared reading sections, keeping hiragana, dialogues, ruby, boxes and unrelated practice intact',()=>{
  const oldSections=extractReadingSections(read(OLD,'index.html')),sections=extractReadingSections(read(NEXT,'index.html'));
  const changed=new Set(edits.flatMap(e=>e.render.map(r=>r.target)));
  for(const section of oldSections)if(!changed.has(section.id))expect(sections.find(s=>s.id===section.id).html).toBe(section.html);
  expect(sections.find(s=>s.id==='guide-hiragana').html).toContain('ん은 한 박자');
  expect(sections.find(s=>s.id==='guide-katakana').html).toContain('ン은 한 박자');
  expect(sections.find(s=>s.id==='u14-start').html).toContain('먼저 좋아한다고');
  expect(sections.find(s=>s.id==='u17-start').html).toContain('처음 답한 음료');
  expect(read(NEXT,'index.html')).not.toContain('다음 날 다시 꺼내기은');
  expect(read(NEXT,'index.html')).not.toContain('웹의 쪽 번호와 PDF 쪽 번호는 같아요');
 });
 it('verifies the new artifact and inherits original media without changing runtime assets',async()=>{
  const book=await candidate(NEXT);expect(book.editionId).toBe(NEXT);
  for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
  for(const name of ['app.js','style.css'])expect(read(NEXT,name)).toBe(read(OLD,name));
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect(after.artifactManifest.media).toEqual({web:true,pdf:false,audio:'existing-only'});
 });
 it('rebuilds byte-identically twice and refuses drift in a scoped preimage',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'n5-copy-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-copy-review.py','--out',path.join(temp,run)],{env:pyEnv});
    for(const name of ['index.html','app.js','style.css','bundle.json'])expect(fs.readFileSync(path.join(temp,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
   const code=`import sys,importlib.util,json\nsys.path.insert(0,'scripts/textbook')\ns=importlib.util.spec_from_file_location('copy_review','scripts/textbook/build-n5-copy-review.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\ne={'path':['note'],'before':'old','after':'new','format':'rich','render':[{'target':'one','count':1}]}\nfor b,h in [({'note':'drift'},'<article id="one">old</article>'),({'note':'old'},'<article id="one">drift</article>')]:\n try:m.apply_edits(b,h,[e])\n except AssertionError:pass\n else:raise Exception('accepted stale copy')\nprint('rejected')`;
   expect(execFileSync('python3',['-c',code],{env:pyEnv,encoding:'utf8'}).trim()).toBe('rejected');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 },15000);
 it('requires current question evidence for all written types and never counts deferred listening as covered',()=>{
  const report=JSON.parse(execFileSync('python3',['scripts/textbook/audit-n5-coverage.py'],{env:pyEnv,encoding:'utf8'}));
  expect(report.types).toHaveLength(14);
  expect(report.types.filter(t=>t.verifiedRepresentativeQuestions>0)).toHaveLength(10);
  expect(report.types.find(t=>t.id==='v2').status).toBe('partial');
  expect(report.types.filter(t=>t.id.startsWith('l')).every(t=>t.status==='deferred'&&t.verifiedRepresentativeQuestions===0)).toBe(true);
  expect(report.passageLengths.find(p=>p.target==='u42-review4').charactersWithoutWhitespace).toBe(76);
  expect(report.passageLengths.find(p=>p.target==='u42-review5').charactersWithoutWhitespace).toBe(246);
 });
});
