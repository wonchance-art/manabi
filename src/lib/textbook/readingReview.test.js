import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const ROOT=path.resolve('src/content/textbookEditions');
const OLD='e146271b705f753e1971c163',NEXT='54f70824da508cbcea7dd578';
const read=(id,name)=>fs.readFileSync(path.join(ROOT,id,name),'utf8');
const before=JSON.parse(read(OLD,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const plan=JSON.parse(fs.readFileSync('scripts/textbook/n5-reading-review.json','utf8'));
const at=(value,keys)=>keys.reduce((node,key)=>node[key],value);
const env={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
const hash=value=>createHash('sha256').update(value).digest('hex');

describe('N5 reading review preserves learning identity',()=>{
 it('restricts the revision to declared text, preserving every answer, page and source owner',async()=>{
  expect(hash(read(OLD,'bundle.json'))).toBe(plan.baseBundleSha256);
  const restored=structuredClone(after.manuscript);
  for(const edit of plan.edits){
   expect(at(before.manuscript,edit.path)).toBe(edit.before);
   expect(at(restored,edit.path)).toBe(edit.after);
   at(restored,edit.path.slice(0,-1))[edit.path.at(-1)]=edit.before;
  }
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toEqual(before.pages);
  expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  for(const [id,value] of Object.entries(before.sourceIndex))expect(after.sourceIndex[id].lesson).toBe(value.lesson);
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
 });
 it('keeps unaffected pages, ruby, example boxes and saved-input keys intact',()=>{
  const oldSections=extractReadingSections(read(OLD,'index.html'));
  const sections=extractReadingSections(read(NEXT,'index.html'));
  const changed=new Set(plan.edits.flatMap(edit=>edit.render.map(item=>item.target)));
  for(const section of oldSections)if(!changed.has(section.id))expect(sections.find(s=>s.id===section.id).html).toBe(section.html);
  for(const regex of [/\bid="([^"]+)"/g,/data-save="([^"]+)"/g,/<ruby>[\s\S]*?<\/ruby>/g,/<div class="examples">/g]){
   expect([...read(NEXT,'index.html').matchAll(regex)].map(m=>m[0])).toEqual([...read(OLD,'index.html').matchAll(regex)].map(m=>m[0]));
  }
  const next=sections.find(s=>s.id==='u33-practice').html;
  expect(next).toContain('<span class="phrase">まどの</span> <span class="phrase">ちかくで</span>');
  expect(after.sourceIndex['u33-practice'].text).toContain(after.manuscript.lessons[32].reading);
 });
 it('verifies assets and points the standalone page at its own edition, preserving media and runtime',async()=>{
  const book=await candidate(NEXT);
  for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
  for(const name of ['app.js','style.css'])expect(read(NEXT,name)).toBe(read(OLD,name));
  expect(read(NEXT,'index.html')).toContain(`<meta name="manuscript-revision" content="${NEXT}">`);
  for(const name of ['app.js','style.css'])expect(read(NEXT,'index.html')).toContain(`/${NEXT}/asset?file=${name}`);
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
 });
 it('rebuilds the revised artifact twice and refuses a phrase substitution inconsistent with its manuscript',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'n5-reading-review-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-copy-review.py','--plan','scripts/textbook/n5-reading-review.json','--out',path.join(temp,run)],{env});
    for(const name of ['index.html','app.js','style.css','bundle.json'])expect(fs.readFileSync(path.join(temp,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
   const code=`import sys,importlib.util,json\nsys.path.insert(0,'scripts/textbook')\ns=importlib.util.spec_from_file_location('copy_review','scripts/textbook/build-n5-copy-review.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\ne={'path':['reading'],'before':'ここで 読みます','after':'ここで 書きます','format':'phrase','phrase':{'before':'ここで','after':'まどの ちかくで'},'render':[{'target':'one','count':1}]}\ntry:m.apply_edits({'reading':e['before']},'<article id="one"><span class="phrase">ここで</span> 読みます</article>',[e])\nexcept AssertionError:print('rejected')\nelse:raise Exception('accepted mismatched phrase')`;
   expect(execFileSync('python3',['-c',code],{env,encoding:'utf8'}).trim()).toBe('rejected');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 },15000);
});
