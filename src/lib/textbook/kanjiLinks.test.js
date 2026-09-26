import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {extractReadingSections} from '../bookReadingHtml';
const root=path.resolve('src/content/textbookEditions'),previous='c6ed2c215bbf36a50fe555cb',next='6a1d083d5cf869c7ba0077c1';
const read=(id,name)=>fs.readFileSync(path.join(root,id,name),'utf8');
const before=JSON.parse(read(previous,'bundle.json')),after=JSON.parse(read(next,'bundle.json'));
const html=read(next,'index.html'),sections=extractReadingSections(html);
const python=code=>execFileSync('python3',['-c',`import sys;sys.path.insert(0,'scripts/textbook');\n${code}`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});

describe('reviewed N5 kanji reading destinations',()=>{
 it('preserves the previous edition and all lessons, cards, input keys and source identities',()=>{
  expect(createHash('sha256').update(read(previous,'bundle.json')).digest('hex')).toBe('437ad80dbe1d8f823767b02ac4e5786d965da64abcdf5efa8eaf090784e3a281');
  expect(after.manuscript.lessons).toEqual(before.manuscript.lessons);
  expect(after.manuscript.kanjiIndex.map(({readingLink,...entry})=>entry)).toEqual(before.manuscript.kanjiIndex);
  expect(after.pages).toEqual(before.pages);expect(Object.keys(after.sourceIndex)).toEqual(Object.keys(before.sourceIndex));
  const inputs=id=>[...read(id,'index.html').matchAll(/data-save="([^"]+)"/g)].map(m=>m[1]);expect(inputs(next)).toEqual(inputs(previous));
  for(const section of extractReadingSections(read(previous,'index.html')).filter(s=>s.unit!=='reference'))expect(sections.find(s=>s.id===section.id).html).toBe(section.html);
 });
 it('keeps mixed-case reference page counters aligned with the 494-page web model',()=>{
  for(const page of after.pages.filter(p=>/[A-Z]/.test(p.id))){
   expect(sections.find(s=>s.id===page.id).html).toContain(`<span>${page.page} / ${after.pages.length}</span>`);
  }
 });
 it('links only explicitly reviewed word/reading pairs outside answers and questions',()=>{
  const proof=JSON.parse(python(`import json\nfrom pathlib import Path\nfrom kanji_links import verify_links\np=Path('${root}/${next}')\nb=json.loads((p/'bundle.json').read_text())\nprint(json.dumps(verify_links((p/'index.html').read_text(),b['manuscript']['kanjiIndex'])))`));
  expect(proof).toHaveLength(38);
  const linked=after.manuscript.kanjiIndex.filter(e=>e.readingLink);expect(linked).toHaveLength(38);
  for(const entry of linked){
   const card=sections.find(s=>s.anchors.includes(entry.id));
   expect(card.html).toContain(`href="#${entry.readingLink.target}"`);
   expect(sections.some(s=>s.id===entry.readingLink.target)).toBe(true);
  }
 });
 it('does not confuse numbers, counters or shared compound characters with the representative reading',()=>{
  for(const character of ['一','月','木','水','車','間','今','分','人'])expect(after.manuscript.kanjiIndex.find(e=>e.character===character).readingLink).toBeNull();
  expect(python("from kanji_links import _audit,has_reading\nt=_audit.Tree();t.feed('<span lang=\"ja\"><ruby>日本<rt>にほん</rt></ruby><ruby>大<rt>おお</rt></ruby>きい</span>')\nn=t.root.children[0]\nassert not has_reading(n,'本','ほん')\nassert has_reading(n,'大きい','おおきい')\nprint('OK')").trim()).toBe('OK');
 });
 it('rejects an answer-only target even if its spelling and ruby are correct',()=>{
  const output=python("from kanji_links import verify_links\nh='<article id=\"u01-start\" data-unit-page=\"u01\"><details><span lang=\"ja\"><ruby>本<rt>ほん</rt></ruby></span></details></article>'\ne=[{'character':'本','ja':'本','reading':'ほん','readingLink':{'target':'u01-start','word':'本','reading':'ほん','kind':'word'}}]\ntry: verify_links(h,e)\nexcept AssertionError: print('rejected')\nelse: raise Exception('answer used as teaching')");expect(output.trim()).toBe('rejected');
 });
 it('labels different forms and meanings and keeps the earlier related lesson separate',()=>{
  const entry=c=>after.manuscript.kanjiIndex.find(e=>e.character===c);
  expect(entry('名').target).toBe('u01-start');expect(entry('名').readingLink.target).toBe('u41-dialogue');
  for(const [character,word,kind] of [['聞','聞きながら','form'],['中','この中で','usage'],['前','前に','usage'],['時','1時間','usage']])expect(entry(character).readingLink).toMatchObject({word,kind});
  const page=sections.find(s=>s.anchors.includes(entry('名').id)).html;
  expect(page).toContain('본문에서 읽기 · 41과');expect(page).toContain('관련 과 · 01과');
  expect(html.match(/class="book-kanji-links"/g)).toHaveLength(103);
  expect(html.match(/class="kanji-reading-link"/g)).toHaveLength(38);
 });
});
