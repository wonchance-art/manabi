import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {candidate,currentCandidate,verifiedAsset} from './server';
import {extractReadingSections} from '../bookReadingHtml';

const ROOT=path.resolve('src/content/textbookEditions');
const OLD='12d69782944b95ef7a11e529',NEXT='8f6d1f66189502aafa146305';
const read=(id,name)=>fs.readFileSync(path.join(ROOT,id,name),'utf8');
const before=JSON.parse(read(OLD,'bundle.json')),after=JSON.parse(read(NEXT,'bundle.json'));
const plan=JSON.parse(fs.readFileSync('scripts/textbook/n5-check-review.json','utf8'));
const env={...process.env,PYTHONDONTWRITEBYTECODE:'1'};
const hash=value=>createHash('sha256').update(value).digest('hex');

describe('N5 distractor review preserves question identity and edition isolation',()=>{
 it('changes only the declared distractors/explanations, preserving correct answers and every other exercise',async()=>{
  expect(hash(read(OLD,'bundle.json'))).toBe(plan.baseBundleSha256);
  const restored=structuredClone(after.manuscript);
  for(const edit of plan.checkRevisions){
   const prior=before.manuscript.lessons.find(l=>l.id===edit.lesson).checks.find(c=>c.id===edit.before.id);
   const check=restored.lessons.find(l=>l.id===edit.lesson).checks.find(c=>c.id===edit.before.id);
   expect(prior).toEqual(edit.before);expect(check).toEqual(edit.after);
   for(const key of ['id','prompt','answer'])expect(check[key]).toBe(prior[key]);
   expect(check.options.indexOf(check.answer)).toBe(prior.options.indexOf(prior.answer));
   Object.assign(check,prior);
  }
  restored.revision=before.manuscript.revision;restored.editorialChanges=before.manuscript.editorialChanges;
  expect(restored).toEqual(before.manuscript);
  expect(after.pages).toEqual(before.pages);
  expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  expect((await currentCandidate()).editionId).toBe('7f572327dc67893e9453246c');
 });
 it('keeps unrelated pages and all controls; source text agrees with the revised options/explanations',()=>{
  const oldSections=extractReadingSections(read(OLD,'index.html'));
  const sections=extractReadingSections(read(NEXT,'index.html'));
  const changed=new Set(plan.checkRevisions.map(e=>`${e.lesson}-practice`));
  for(const old of oldSections)if(!changed.has(old.id))expect(sections.find(s=>s.id===old.id).html).toBe(old.html);
  for(const regex of [/\bid="([^"]+)"/g,/<input\b[^>]*>/g,/<textarea\b[^>]*>/g]){
   expect([...read(NEXT,'index.html').matchAll(regex)].map(m=>m[0])).toEqual([...read(OLD,'index.html').matchAll(regex)].map(m=>m[0]));
  }
  for(const [id,value] of Object.entries(before.sourceIndex)){
   expect(after.sourceIndex[id].lesson).toBe(value.lesson);
   if(!changed.has(id))expect(after.sourceIndex[id]).toEqual(value);
  }
  for(const edit of plan.checkRevisions){
   const text=after.sourceIndex[`${edit.lesson}-practice`].text.replace(/\s/g,'');
   for(const value of [...edit.after.options,edit.after.why])expect(text).toContain(value.replace(/\s/g,''));
  }
 });
 it('verifies the candidate without replacing runtime/media or modifying an existing edition',async()=>{
  const book=await candidate(NEXT);
  for(const name of ['index.html','app.js','style.css'])expect((await verifiedAsset(book,name)).bytes).toBeTruthy();
  for(const name of ['app.js','style.css'])expect(read(NEXT,name)).toBe(read(OLD,name));
  expect(after.artifactManifest.inheritedMedia).toEqual(before.artifactManifest.inheritedMedia);
  expect(hash(read(OLD,'bundle.json'))).toBe(plan.baseBundleSha256);
 });
 it('rebuilds twice and rejects stale, incomplete, ambiguous or answer-changing revisions',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'n5-check-review-'));
  try{
   for(const run of ['a','b']){
    execFileSync('python3',['scripts/textbook/build-n5-copy-review.py','--plan','scripts/textbook/n5-check-review.json','--out',path.join(temp,run)],{env});
    for(const name of ['index.html','app.js','style.css','bundle.json'])expect(fs.readFileSync(path.join(temp,run,NEXT,name),'utf8')).toBe(read(NEXT,name));
   }
   const code=`import sys,importlib.util,json,copy
sys.path.insert(0,'scripts/textbook')
s=importlib.util.spec_from_file_location('review','scripts/textbook/build-n5-copy-review.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=json.load(open('scripts/textbook/n5-check-review.json'));b=json.load(open('src/content/textbookEditions/'+p['baseEdition']+'/bundle.json'));html=open('src/content/textbookEditions/'+p['baseEdition']+'/index.html').read()
r=p['checkRevisions'][0]
def check(mutator,render=html):
 revision=copy.deepcopy(r);mutator(revision)
 try:m.apply_check_revisions(copy.deepcopy(b['manuscript']),render,[revision])
 except AssertionError:print('rejected')
 else:raise Exception('accepted unsafe revision')
check(lambda x:x['before'].update(why='stale'))
check(lambda x:x['after'].pop('why'))
check(lambda x:x['after'].update(answer=x['after']['options'][1]))
check(lambda x:x['after'].update(id='renamed'))
check(lambda x:x['after'].update(prompt='different question'))
check(lambda x:x['after']['options'].reverse())
check(lambda x:x['after']['options'].append('extra'))
check(lambda x:x['after']['options'].__setitem__(1,x['after']['answer']))
check(lambda x:None,html.replace('すわないでください','stale'))
try:m.apply_check_revisions(copy.deepcopy(b['manuscript']),html,[r,r])
except AssertionError:print('rejected')
else:raise Exception('accepted duplicate revision')
try:m.apply_edits({'options':['a','b']},'',[{'path':['options',1],'before':'b','after':'c'}])
except AssertionError:print('rejected')
else:raise Exception('copy-only option edit accepted')`;
   expect(execFileSync('python3',['-c',code],{env,encoding:'utf8'}).trim().split('\n')).toEqual(Array(11).fill('rejected'));
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 },20000);
});
