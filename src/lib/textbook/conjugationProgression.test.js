import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const ROOT=path.resolve('src/content/textbookEditions'),NEXT='594bc48ffc62dff84e9b7bf3';
const planFile='scripts/textbook/n5-conjugation-progression.json';
const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
const read=(id,name)=>fs.readFileSync(path.join(ROOT,id,name),'utf8');
const before=JSON.parse(read(plan.baseEdition,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const hash=text=>createHash('sha256').update(text).digest('hex');
const pyEnv={...process.env,PYTHONDONTWRITEBYTECODE:'1'};

describe('N5 conjugation help and prerequisite returns preserve learning',()=>{
 it('adds the missing prerequisite destination while retaining every existing answer, source and navigation target',async()=>{
  expect(hash(read(plan.baseEdition,'bundle.json'))).toBe(plan.baseBundleSha256);
  const restored=structuredClone(after.manuscript);
  for(const add of plan.recallLinkAdditions){
   const lesson=restored.lessons.find(l=>l.id===add.lesson);
   expect(lesson.recall_links.slice(-add.add.length)).toEqual(add.add.map(l=>({after:add.after,...l})));
   lesson.recall_links.splice(-add.add.length);
  }
  for(const edit of plan.edits){let node=restored;for(const key of edit.path.slice(0,-1))node=node[key];expect(node[edit.path.at(-1)]).toBe(edit.after);node[edit.path.at(-1)]=edit.before;}
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toEqual(before.pages);
  const changed=new Set(plan.edits.flatMap(e=>e.render.map(r=>r.target)));
  const sections=extractReadingSections(read(NEXT,'index.html'));
  for(const s of extractReadingSections(read(plan.baseEdition,'index.html')))if(!changed.has(s.id))expect(sections.find(n=>n.id===s.id).html).toBe(s.html);
  const addedLink='<li><a href="#u30-patterns">연습 12 · い형용사의 과거 (30과) →</a></li>';
  const revised=read(NEXT,'index.html');expect(revised.split(addedLink)).toHaveLength(2);
  expect(sections.find(s=>s.id==='u32-review1').html).toContain(addedLink);
  expect(sections.find(s=>s.id==='u30-patterns')).toBeTruthy();
  for(const regex of [/\bid="([^"]+)"/g,/<input\b[^>]*>/g,/<textarea\b[^>]*>/g,/<a\b[^>]*\bhref="([^"]+)"/g,/<ruby>[\s\S]*?<\/ruby>/g,/<div class="examples">/g])expect([...revised.replace(addedLink,'').matchAll(regex)].map(m=>m[0])).toEqual([...read(plan.baseEdition,'index.html').matchAll(regex)].map(m=>m[0]));
  expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  for(const [id,source] of Object.entries(before.sourceIndex)){expect(after.sourceIndex[id].lesson).toBe(source.lesson);if(!changed.has(id))expect(after.sourceIndex[id]).toEqual(source);}
  for(const name of ['app.js','style.css'])expect(read(NEXT,name)).toBe(read(plan.baseEdition,name));
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
  const book=await candidate(NEXT);for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
 });
 it('rebuilds the immutable candidate identically twice',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'n5-conjugation-'));
  try{for(const run of ['a','b']){
   execFileSync('python3',['scripts/textbook/build-n5-copy-review.py','--plan',planFile,'--out',path.join(temp,run)],{env:pyEnv});
   for(const name of ['bundle.json','index.html','app.js','style.css'])expect(fs.readFileSync(path.join(temp,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
  }}finally{fs.rmSync(temp,{recursive:true,force:true});}
 },15000);
 it('rejects stale navigation, duplicate or invalid prerequisites and hidden retargeting',()=>{
  const script=`import sys,importlib.util,json,copy
from pathlib import Path
sys.path.insert(0,'scripts/textbook')
s=importlib.util.spec_from_file_location('review','scripts/textbook/build-n5-copy-review.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=json.loads(Path('${planFile}').read_text());root=Path('src/content/textbookEditions')/p['baseEdition'];base=json.loads((root/'bundle.json').read_text())['manuscript'];original=(root/'index.html').read_text()
b,h=m.apply_edits(copy.deepcopy(base),original,p['edits']);valid=p['recallLinkAdditions'][0]
cases=[]
c=copy.deepcopy(valid);c['before'][0]['target']='u18-patterns';cases.append((c,h))
c=copy.deepcopy(valid);c['add'][0]['target']='u29-patterns';cases.append((c,h))
c=copy.deepcopy(valid);c['add'][0]['target']='u30-missing';cases.append((c,h))
c=copy.deepcopy(valid);c['add'][0]['target']='u33-patterns';cases.append((c,h))
c=copy.deepcopy(valid);c['add'][0]['target']='https://example.com';cases.append((c,h))
c=copy.deepcopy(valid);c['add'].append(copy.deepcopy(c['add'][0]));cases.append((c,h))
c=copy.deepcopy(valid);c['add'][0]['label']=' ';cases.append((c,h))
c=copy.deepcopy(valid);c['after']='missing';c['before']=[];cases.append((c,h))
cases.append((valid,h.replace('연습 11 · 하기 전의 일 (31과)','drift')))
for c,html in cases:
 try:m.apply_recall_link_additions(copy.deepcopy(b),html,[c])
 except (AssertionError,ValueError):pass
 else:raise Exception('accepted invalid navigation')
e={'path':['lessons',31,'recall_links',4,'target'],'before':'u29-patterns','after':'u30-patterns','format':'plain','render':[{'target':'u32-review1','count':1}]}
try:m.apply_edits(copy.deepcopy(base),original,[e])
except AssertionError:pass
else:raise Exception('ordinary copy edit retargeted a link')
print('rejected 10 unsafe changes')`;
  expect(execFileSync('python3',['-c',script],{env:pyEnv,encoding:'utf8'}).trim()).toBe('rejected 10 unsafe changes');
 });
});
