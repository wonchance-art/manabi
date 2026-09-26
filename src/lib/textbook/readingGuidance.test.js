import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {extractReadingSections} from '../bookReadingHtml';

const PREVIOUS='486ee7a5c71a4ff19062d808',NEXT='c6ed2c215bbf36a50fe555cb';
const root=path.resolve('src/content/textbookEditions');
const read=(id,file)=>fs.readFileSync(path.join(root,id,file),'utf8');
const previous=JSON.parse(read(PREVIOUS,'bundle.json')),next=JSON.parse(read(NEXT,'bundle.json'));
const audit=JSON.parse(execFileSync('python3',['scripts/textbook/audit-n5-kanji.py','--edition',NEXT],{encoding:'utf8',maxBuffer:4*1024*1024}));
const tasks=value=>{
 if(Array.isArray(value))return value.flatMap(tasks);
 if(!value||typeof value!=='object')return [];
 return [...(value.id&&value.prompt&&value.answer?[value]:[]),...Object.values(value).flatMap(tasks)];
};

describe('N5 practice names and reading guidance',()=>{
 it('changes display names while preserving all previous questions, answer keys, page and source identities',()=>{
  expect(createHash('sha256').update(read(PREVIOUS,'bundle.json')).digest('hex')).toBe('dbc96526fb6ae4f5918c03f3d683cc4baa68f10befce850659d496be0c317a20');
  const questions=b=>tasks(b.manuscript).map(({id,prompt,cue,answer,why})=>({id,prompt,cue,answer,why}));
  expect(questions(next)).toEqual(questions(previous));expect(tasks(next.manuscript.lessons)).toHaveLength(309);
  expect(next.pages.map(({id,kind,lesson,page})=>({id,kind,lesson,page}))).toEqual(previous.pages.map(({id,kind,lesson,page})=>({id,kind,lesson,page})));
  expect(Object.keys(next.sourceIndex)).toEqual(Object.keys(previous.sourceIndex));
  const keys=id=>[...read(id,'index.html').matchAll(/data-save="([^"]+)"/g)].map(m=>m[1]);
  expect(keys(NEXT)).toEqual(keys(PREVIOUS));
  const sections=extractReadingSections(read(NEXT,'index.html'));
  expect(sections.find(s=>s.id==='u32-review1').html).toContain('연습 12');
  expect(sections.find(s=>s.id==='u39-recall').html).toContain('연습 A');
  expect(sections.find(s=>s.id==='u39-review1').html).toContain('연습 해설 보기');
  expect(read(NEXT,'index.html')).toContain('aria-label="연습 12 내 답"');
 });
 it('renames only display text and aria labels, including multiline HTML, not stored identifiers or script literals',()=>{
  const before='<h3 id="복습 1">복습 1 &amp; 해설</h3>\n<textarea data-save="u23-review-복습 1" aria-label="복습 1 내 답"></textarea><script>const label="복습 1";</script>';
  const after=execFileSync('python3',['-c','import sys;sys.path.insert(0,"scripts/textbook");from practice_labels import rename_html;print(rename_html(sys.stdin.read()))'],{input:before,encoding:'utf8'});
  expect(after).toContain('<h3 id="복습 1">연습 1 &amp; 해설</h3>');
  expect(after).toContain('data-save="u23-review-복습 1" aria-label="연습 1 내 답"');
  expect(after).toContain('const label="복습 1";');
 });
 it('separates ruby base, reading, navigation, answers, table help and back matter',()=>{
  const fixture='<article id="u01-start" data-unit-page="u01"><p lang="ja"><ruby>本<rt>頁ほん</rt></ruby></p><p lang="ko">韓</p><nav><a lang="ja">語</a></nav><details><p lang="ja">春</p></details><table><tr><td lang="ja">円</td><td>えん</td></tr></table><section class="review-task"><h3>글자 확인</h3><p lang="ja">休</p></section></article><article id="kanjiIndex-1" data-unit-page="reference"><p lang="ja">前</p></article>';
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'n5-kanji-'));
  try{
   const file=path.join(dir,'fixture.html');fs.writeFileSync(file,fixture);
   const result=JSON.parse(execFileSync('python3',['scripts/textbook/audit-n5-kanji.py','--html',file],{encoding:'utf8'}));
   expect(result.characters.map(c=>c.character)).toEqual(['本','円','休']);
   expect(result.occurrences.find(o=>o.text==='本').ruby).toBe('頁ほん');
   expect(result.occurrences.find(o=>o.text==='円').context).toContain('えん');
   expect(result.occurrences.find(o=>o.text==='春').role).toBe('answer');
   expect(result.characters.find(c=>c.character==='休').firstBody).toBeNull();
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
 it('keeps the kana-first opening and adds targeted support without exposing reading/spelling answers',()=>{
  expect(audit.lessons).toHaveLength(42);
  for(const lesson of audit.lessons.slice(0,5))expect(lesson.bodyCharacters).toEqual([]);
  const help=audit.occurrences.filter(o=>o.role==='guidance'&&o.ruby);
  for(const [page,text,ruby] of [['u32-review2','写真','しゃしん'],['u37-practice','持って','もって'],['u41-patterns','聞きながら','ききながら'],['u41-dialogue','名前','なまえ'],['u42-review3','多い','おおい'],['u42-review5','今度','こんど']])expect(help).toContainEqual(expect.objectContaining({page,text,ruby}));
  const beforeBody=audit.characters.filter(c=>c.firstUnassistedQuestion!==null&&(c.firstBody===null||c.firstUnassistedQuestion<c.firstBody));
  expect(beforeBody.map(c=>c.character)).toEqual(['体']);
  const section=extractReadingSections(read(NEXT,'index.html')).find(s=>s.id==='u42-review2');
  const questionHtml=section.html.split('<details')[0];
  expect(questionHtml).not.toContain('<ruby>本');expect(questionHtml).not.toContain('<ruby>休');
  expect(section.html).toContain('体み');
 });
});
