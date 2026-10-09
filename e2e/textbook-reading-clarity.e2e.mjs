// Local production reader and isolated synthetic accounts; no hosted writes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture} from './fixtures/material-editing-backend.mjs';

const edition='8a8c1c1fd452773810abaf8c',old='7f572327dc67893e9453246c';
async function open(f,page,version=edition){
 await f.page.goto(`/books/japanese-n5?edition=${version}#${page}`,{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator(`#${page}`).waitFor();await f.page.evaluate(()=>document.fonts.ready);
}
async function check(f,name){
 assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(f.errors,[]);
 if(process.env.COMPOSER_SCREENSHOTS){await mkdir(process.env.COMPOSER_SCREENSHOTS,{recursive:true});await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/${name}.png`});}
}

test('caption stays inside the passage; answers keep inset space and radio answers survive reload in both editions',async()=>{
 const f=await fixture({guest:true,width:390});try{
  for(const version of [old,edition]){
   const target=version===old?'u42-practice':'u42-message-reading';await open(f,target,version);
   if(version===edition){
    const geometry=await f.page.locator(`#${target} .examples`).first().evaluate(box=>{
     const caption=box.querySelector('.caption'),b=box.getBoundingClientRect(),c=caption.getBoundingClientRect();
     return {inside:c.top>b.top+10&&c.bottom<b.bottom,position:getComputedStyle(caption).position};
    });assert.equal(geometry.inside,true);assert.equal(geometry.position,'static');
    if(process.env.COMPOSER_SCREENSHOTS)await f.page.locator(`#${target} .examples`).first().screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/passage-caption-390.png`});
   }
   const answer=f.page.locator(`#${target} details.answers`).first();assert.equal(await answer.getAttribute('open'),null);
   await answer.locator('summary').focus();await f.page.keyboard.press('Enter');await answer.locator('.answer').first().waitFor();
   const inset=await answer.evaluate(box=>{const a=box.querySelector('.answer>b').getBoundingClientRect(),b=box.getBoundingClientRect();return {left:a.left-b.left,right:b.right-a.right};});
   assert.ok(inset.left>=15&&inset.right>=15,JSON.stringify(inset));
   if(process.env.COMPOSER_SCREENSHOTS&&version===edition)await answer.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/answers-expanded-390.png`});
   const field=f.page.locator(`#${target} input[type=radio]`).first();await field.check();const key=await field.getAttribute('data-save'),value=await field.getAttribute('value');
   await check(f,`answers-${version.slice(0,2)}-390`);await f.page.reload();await f.page.locator(`#${target}`).waitFor();
   await f.page.waitForFunction(({key,value})=>[...document.querySelectorAll('input[data-save]')].some(n=>n.dataset.save===key&&n.value===value&&n.checked),{key,value});
   assert.equal(await f.page.locator(`#${target} details.answers`).first().getAttribute('open'),null);
  }
 }finally{await f.context.close();}
});

test('dialogue meaning control shares its heading; long speaking prompts align inputs without cropping at large text',async()=>{
 const f=await fixture({guest:true,width:1440});try{
  await open(f,'u42-dialogue');
  const title=f.page.locator('#u42-dialogue h2');await f.page.locator('#u42-dialogue .book-dialogue-heading .translation').waitFor();
  assert.equal(await f.page.locator('#u42-dialogue .stage').isVisible(),false);assert.equal(await title.isVisible(),true);
  const toggle=f.page.locator('#u42-dialogue .translation');await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.equal(await f.page.locator('#u42-dialogue .ko').first().isVisible(),false);await toggle.click();
  await check(f,'dialogue-desktop');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.locator('#u42-dialogue .oral').screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/speaking-normal.png`});
  const fields=f.page.locator('#u42-dialogue .oral textarea');await fields.first().fill('계속 이어 쓸 답안');
  await f.page.locator('#u42-dialogue .oral>div>p').first().evaluate(p=>{p.textContent+=' 긴 질문이 여러 줄로 이어져도 입력과 내용을 모두 읽을 수 있어야 해요.'.repeat(4);});
  await f.page.addStyleTag({content:'.book-reading-content{font-size:24px!important}.book-reading-content .oral p{font-size:24px!important}'});
  const a=await fields.nth(0).boundingBox(),b=await fields.nth(1).boundingBox();assert.ok(Math.abs(a.y-b.y)<2,JSON.stringify({a,b}));assert.ok(Math.abs(a.width-b.width)<2);
  assert.ok(await f.page.locator('#u42-dialogue .oral>div').first().evaluate(card=>card.scrollHeight<=card.clientHeight+1));await f.page.locator('#u42-dialogue .oral').scrollIntoViewIfNeeded();await check(f,'speaking-large-text');
  await f.page.setViewportSize({width:320,height:1000});const smallA=await fields.nth(0).boundingBox(),smallB=await fields.nth(1).boundingBox();assert.ok(smallB.y>smallA.y+smallA.height);await check(f,'speaking-320');
  await f.page.reload();await fields.first().waitFor();await f.page.waitForFunction(()=>document.querySelector('#u42-dialogue .oral textarea')?.value==='계속 이어 쓸 답안');
 }finally{await f.context.close();}
});

test('one reference menu exposes distinct destinations; linked materials open for reading before private connection management',async()=>{
 const f=await fixture({width:390});try{
  const linkId='00000000-0000-4000-8000-000000000173',calls=[];let links=[{id:linkId,title:'내 약속 글',href:'/viewer/94001'}];
  await f.context.route('**/api/learning/material-links*',async r=>{
   const method=r.request().method();calls.push({method,body:method==='GET'?null:r.request().postDataJSON()});
   if(method==='DELETE')links=[];
   if(method==='POST')links=[{id:linkId,title:'내 두 번째 글',href:'/viewer/94002'}];
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(method==='GET'?{links,candidates:[{id:'94002',kind:'reading',title:'내 두 번째 글'}]}:{ok:true})});
  });
  await open(f,'u42-message-reading');assert.equal(calls.length,0);
  const menu=f.page.locator('.manabi-reference-menu'),summary=menu.locator('summary');await summary.focus();await f.page.keyboard.press('Enter');
  const ref=menu.getByRole('link',{name:'어휘·문형·한자',exact:true});assert.match(await ref.getAttribute('href'),new RegExp(`${edition}#reference-start`));
  assert.match(await menu.getByRole('link',{name:'문화 읽기',exact:true}).getAttribute('href'),/\/materials\?edition=/);
  await f.page.keyboard.press('Escape');assert.equal(await menu.getAttribute('open'),null);assert.equal(await summary.evaluate(el=>el===document.activeElement),true);
  await summary.click();await menu.getByRole('link',{name:'문화 읽기',exact:true}).focus();await f.page.keyboard.press('Tab');assert.equal(await menu.getAttribute('open'),null);
  await summary.click();await f.page.locator('#u42-message-reading h2').click();assert.equal(await menu.getAttribute('open'),null);
  await summary.click();await menu.getByRole('button',{name:'이 과의 연결 자료',exact:true}).click();
  const dialog=f.page.getByRole('dialog',{name:'이 과의 연결 자료',exact:true});await dialog.getByRole('link',{name:'내 약속 글',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('combobox',{name:'내 자료 선택'}).isVisible(),false);assert.equal(await dialog.getByRole('button',{name:'내 약속 글 연결 해제',exact:true}).isVisible(),false);
  assert.equal(calls.filter(c=>c.method!=='GET').length,0);await check(f,'linked-materials-390');
  await dialog.locator('summary').click();await dialog.getByRole('combobox',{name:'내 자료 선택'}).waitFor();await dialog.getByRole('button',{name:'내 약속 글 연결 해제',exact:true}).click();await dialog.getByText('연결한 자료가 없어요.',{exact:true}).waitFor();
  assert.deepEqual(calls.find(c=>c.method==='DELETE').body,{id:linkId});
  await dialog.getByRole('combobox',{name:'내 자료 선택'}).selectOption('reading:94002');await dialog.getByRole('button',{name:'연결하기',exact:true}).click();await dialog.getByRole('link',{name:'내 두 번째 글',exact:true}).waitFor();
  assert.deepEqual(calls.find(c=>c.method==='POST').body,{lang:'Japanese',slug:'n5-book-u42',kind:'reading',materialId:'94002'});
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();await f.page.waitForFunction(()=>document.activeElement?.matches('.manabi-reference-menu>summary'));assert.equal(await summary.evaluate(el=>el===document.activeElement),true);
  assert.equal(await f.page.getByRole('link',{name:'담은 표현',exact:true}).isVisible(),true);
  await check(f,'references-390');
 }finally{await f.context.close();}
});

test('answer reasons stay readable (AA contrast, 14px+) and recall/example controls keep 44px targets in both editions',async()=>{
 const f=await fixture({guest:true,width:390});try{
  // 글자색과, 실제로 칠해진 가장 가까운 조상 배경의 WCAG 대비.
  const reason=async(scope)=>f.page.locator(`${scope} details.answers .answer>:is(small,.small)`).first().evaluate(el=>{
   const rgb=c=>c.match(/[\d.]+/g).map(Number),lum=([r,g,b])=>{const t=[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*t[0]+.7152*t[1]+.0722*t[2];};
   let bg=el;while(bg&&(getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)'||getComputedStyle(bg).backgroundColor==='transparent'))bg=bg.parentElement;
   const a=lum(rgb(getComputedStyle(el).color)),b=lum(rgb(bg?getComputedStyle(bg).backgroundColor:'rgb(255,255,255)'));
   return {contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size:parseFloat(getComputedStyle(el).fontSize)};
  });
  const expand=async(scope,kind='details.answers')=>{const box=f.page.locator(`${scope} ${kind}`).first();await box.locator('summary').click();await box.locator('.answer').first().waitFor();return box;};
  for(const version of [old,edition]){
   await open(f,'u01-practice',version);await expand('#u01-practice');
   const r=await reason('#u01-practice');assert.ok(r.contrast>=4.5&&r.size>=14,JSON.stringify(r));
   await open(f,'u03-family-check',version);const box=await expand('#u03-family-check');
   const h3=await box.evaluate(b=>{const a=b.querySelector('.answer>h3:first-child'),ps=[...a.parentElement.querySelectorAll(':scope>p')].map(p=>parseFloat(getComputedStyle(p).fontSize));return {top:parseFloat(getComputedStyle(a).marginTop),answer:ps[0],reason:ps[1]};});
   assert.ok(h3.top===0&&h3.reason<h3.answer,JSON.stringify(h3));
   await open(f,'grammarIndex-1',version);const recall=f.page.locator('#grammarIndex-1 .grammar-recall>details').first();
   assert.ok((await recall.locator('summary').boundingBox()).height>=44);
   await recall.locator('summary').focus();await f.page.keyboard.press('Enter');assert.notEqual(await recall.getAttribute('open'),null);
   await open(f,'u03-study1',version);const signin=f.page.locator('#u03-study1 .manabi-example-signin').first();await signin.waitFor();
   assert.ok((await signin.boundingBox()).height>=44);
   await check(f,`answer-reading-${version.slice(0,2)}-390`);
  }
  // 고른 뒤 이유 확인(신판): 정답 줄 > 이유 문단 ≥ 오답 목록 — 원고 18px 그대로면 이유가 정답과 같은 크기로 읽힌다.
  await open(f,'guide-katakana-long');const review=await expand('#guide-katakana-long','details.review-answers');
  const order=await review.evaluate(b=>{const a=[...b.querySelectorAll('.answer')].find(x=>x.querySelector(':scope>ul')),fs=el=>parseFloat(getComputedStyle(el).fontSize);
   return {answer:fs(a.querySelector(':scope>p:has(>strong)')),reason:fs(a.querySelector(':scope>p:not(:has(>strong))')),wrong:fs(a.querySelector(':scope>ul'))};});
  assert.ok(order.answer>order.reason&&order.reason>=order.wrong,JSON.stringify(order));
 }finally{await f.context.close();}
});
