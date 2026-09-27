// Existing product reader against local synthetic roles; no real account/DB.
import {chromium,webkit} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixtureSession} from './fixtures/n5-revision-backend.mjs';

const base=process.env.QA_BASE||'http://127.0.0.1:48991';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Synthetic roles require localhost');
const revision='54f70824da508cbcea7dd578',old='e146271b705f753e1971c163';
const out=process.env.QA_OUT||'.qa/n5-reading-review/browser';fs.mkdirSync(out,{recursive:true});
const plan=JSON.parse(fs.readFileSync(new URL('../scripts/textbook/n5-reading-review.json',import.meta.url),'utf8'));
const report={revision,scope:'Synthetic admin/member/guest; current product reader, real fonts; not real authentication or physical iPad.',engines:[]};
const url=(id,edition=revision)=>`${base}/books/japanese-n5?edition=${edition}#${id}`;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
 const row={engine:name,checks:[],layouts:[],errors:[],writes:[]};report.engines.push(row);
 try{
  const anon=await browser.newContext({baseURL:base,serviceWorkers:'block'});
  assert.equal((await anon.request.get(`/api/books/japanese-n5/${revision}/asset?file=index.html`)).status(),401);
  await anon.addCookies([{name:'sb-127-auth-token',value:fixtureSession('student'),url:base,sameSite:'Lax'}]);
  assert.equal((await anon.request.get(`/api/books/japanese-n5/${revision}/asset?file=index.html`)).status(),404);
  await anon.close();row.checks.push('unpublished candidate denies guest and ordinary member');
  const context=await browser.newContext({baseURL:base,viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addCookies([{name:'sb-127-auth-token',value:fixtureSession(),url:base,sameSite:'Lax'}]);
  const page=await context.newPage();
  page.on('pageerror',e=>row.errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')row.errors.push(e.text());});
  page.on('request',req=>{if(['POST','PATCH','DELETE'].includes(req.method())&&!req.url().endsWith('/rpc/is_admin'))row.writes.push(new URL(req.url()).pathname);});
  const compact=text=>text.replace(/\s/g,'');
  const ids=[...new Set(plan.edits.flatMap(e=>e.render.map(r=>r.target)))];
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const id of ids){
    await page.goto(url(id));const section=page.locator('#'+id);await section.waitFor();await page.evaluate(()=>document.fonts.ready);
    assert(await page.getByText('관리자 미리보기 · 발행 전 원고입니다.',{exact:true}).isVisible());
    const reading=await section.evaluate(el=>{const clone=el.cloneNode(true);clone.querySelectorAll('rt').forEach(rt=>rt.remove());return clone.textContent;});
    for(const edit of plan.edits.filter(e=>e.render.some(r=>r.target===id)))assert(compact(reading).includes(compact(edit.after)),`copy missing ${id}`);
    const details=section.locator('details.answers');
    assert.equal(await details.getAttribute('open'),null);
    await details.locator('summary').focus();await page.keyboard.press('Enter');
    assert.notEqual(await details.getAttribute('open'),null);
    const layout=await section.evaluate(el=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,contentWidth:el.clientWidth,scrollWidth:el.scrollWidth,boxes:el.querySelectorAll('.examples').length}));
    assert(layout.documentWidth<=width+1&&layout.scrollWidth<=layout.contentWidth+1,`overflow ${id}/${width}`);
    assert(layout.boxes>0);row.layouts.push({id,...layout});
    if(width!==320)await section.screenshot({path:path.join(out,`${name}-${id}-${width}.png`)});
   }
  }
  row.checks.push('three changed pages at 1440/390/320; hidden rationales opened with keyboard; ruby/boxes/overflow inspected');
  const input='textarea[data-save="u42-review-유형 10 · 정보 검색"]';
  await page.goto(url('u42-review6',old));await page.locator(input).fill('이전 판본 답');
  await page.getByText('답안을 이 브라우저에 저장했어요.',{exact:true}).waitFor();
  await page.goto(url('u42-review6'));assert.equal(await page.locator(input).inputValue(),'');
  await page.locator(input).fill('③ C');
  await page.getByText('답안을 이 브라우저에 저장했어요.',{exact:true}).waitFor();await page.reload();
  await page.waitForFunction(selector=>document.querySelector(selector)?.value==='③ C',input,{timeout:5000});
  await page.locator('#u42-review6 a[href="#u39-start"]').click();await page.waitForURL('**#u39-start');
  await page.goBack();await page.waitForURL('**#u42-review6');
  await page.waitForFunction(selector=>document.querySelector(selector)?.value==='③ C',input,{timeout:5000});
  await page.goto(url('u42-review6',old));
  await page.waitForFunction(selector=>document.querySelector(selector)?.value==='이전 판본 답',input,{timeout:5000});
  row.checks.push('candidate answer survives reload and help-link return; previous-edition answer remains separate');
  assert.deepEqual(row.writes,[]);assert.deepEqual(row.errors,[]);
  row.checks.push('no server writes or runtime/console errors');await context.close();
 }catch(error){row.failure=error.stack;throw error;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
console.log(JSON.stringify(report,null,2));
