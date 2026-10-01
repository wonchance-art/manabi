// Actual viewer with disposable fixture data. No live identity, provider or DB writes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const entries=[
 ['连弩','lián nǔ','연발 쇠뇌'],['俑','','부장 인형'],['T恤','T xù','티셔츠'],['弩弩弩弩','nǔ nǔ nǔ nǔ','반복 글자 검수'],
];
async function open(width) {
 const f=await fixture({width});
 await f.context.addInitScript(()=>localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{Chinese:{showHanjaKo:true,autoSpeakOnClick:false}}})));
 f.rows.push({id:94102,user_id:owner,title:'훈음 배치 검수',raw_text:entries.map(e=>e[0]).join(' '),source_type:'text',created_at:new Date().toISOString(),processed_json:{status:'completed',metadata:{language:'Chinese'},sequence:entries.map((_,i)=>`id_0_${i}`),dictionary:Object.fromEntries(entries.map(([text,furigana,meaning],i)=>[`id_0_${i}`,{text,base_form:text,furigana,meaning,pos:'명사'}]))}});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.page.goto('/viewer/94102',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 return f;
}
async function select(f,index) {
 const token=f.page.locator(`[data-source-token="id_0_${index}"]`);
 await token.focus();await f.page.keyboard.press('Enter');
 await f.page.locator('.reader-hun').waitFor();
}
async function checkGeometry(f) {
 const data=await f.page.locator('.reader-hun').evaluate(e=>{
  const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom}};
  return {section:r(e),meaning:r(e.closest('.word-detail-card').querySelector('.word-detail-card__meaning')),pairs:[...e.children].map(p=>({cell:r(p),ch:r(p.querySelector('dt')),label:r(p.querySelector('dd'))})),overflow:document.documentElement.scrollWidth-innerWidth};
 });
 for(const {cell,ch,label} of data.pairs){assert.ok(ch.right<=label.x+.5);assert.ok(label.right<=cell.right+.5);assert.ok(label.bottom<=cell.bottom+.5);}
 assert.ok(data.meaning.y>=data.section.bottom-.5);assert.equal(data.overflow,0);
 const actions=f.page.locator('.reader-card-actions').filter({visible:true}).first();
 for(const grade of ['다시','어려움','알맞음','쉬움'])assert.equal(await actions.getByRole('button',{name:new RegExp(`^${grade}`)}).count(),1);
 assert.equal(await f.page.getByRole('button',{name:'발음 듣기',exact:true}).filter({visible:true}).count(),1);
 assert.deepEqual(f.errors,[]);
}
for(const width of [1440,390,320])test(`viewer Korean labels/${width}px: long, absent reading, mixed and repeated characters`,async()=>{
 const f=await open(width);
 try{
  for(let i=0;i<entries.length;i++){
   await select(f,i);await checkGeometry(f);
   if(i===1)assert.equal(await f.page.locator('.reader-hun__pair').count(),1);
   if(i===2)assert.equal(await f.page.locator('.reader-hun dt').textContent(),'恤');
   if(i===3)assert.equal(await f.page.locator('.reader-hun__pair').count(),4);
   if(i===0&&process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/hun-${width}.png`,fullPage:true});
  }
  await f.page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await checkGeometry(f);
  await f.page.evaluate(()=>document.documentElement.style.fontSize='');
  await f.page.getByRole('button',{name:'읽기 설정',exact:true}).click();
  await f.page.getByText('성조·문법·한자 표시',{exact:true}).click();
  const toggle=f.page.getByRole('checkbox',{name:'한자 대조'});
  await toggle.click();await f.page.keyboard.press('Escape');
  assert.equal(await f.page.locator('.reader-hun').count(),0);
  await f.page.reload({waitUntil:'domcontentloaded'});
  await f.page.locator('[data-source-token="id_0_0"]').focus();await f.page.keyboard.press('Enter');
  assert.equal(await f.page.locator('.reader-hun').count(),0,'disabled preference survives reload');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
