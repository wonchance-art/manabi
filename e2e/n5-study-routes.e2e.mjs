// Production Next build + local synthetic HTTP/Auth. No real account or DB writes.
import {chromium,webkit} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixtureSession,revision} from './fixtures/n5-revision-backend.mjs';
const base=process.env.QA_BASE||'http://127.0.0.1:48991';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Synthetic roles require localhost');
const out=process.env.QA_OUT||'.qa/n5-routes/browser';fs.mkdirSync(out,{recursive:true});
const report={scope:'Actual Next.js book reader with local synthetic admin/member/guest; not a live DB or physical-device test.',revision,engines:[]};
const url=(anchor,edition=revision)=>`${base}/books/japanese-n5?edition=${edition}#${anchor}`;
const old='7f572327dc67893e9453246c';
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
 const row={engine:name,checks:[],layouts:[],errors:[],writes:[]};report.engines.push(row);
 try{
  const guest=await browser.newContext({baseURL:base,serviceWorkers:'block'});
  assert.equal((await guest.request.get(`/api/books/japanese-n5/${revision}/asset?file=index.html`)).status(),401);
  assert.equal((await guest.request.get(`/api/books/japanese-n5/${old}/reading?unit=u42`)).status(),200);
  await guest.addCookies([{name:'sb-127-auth-token',value:fixtureSession('student'),url:base,sameSite:'Lax'}]);
  assert.equal((await guest.request.get(`/api/books/japanese-n5/${revision}/asset?file=index.html`)).status(),404);
  row.checks.push('original is readable; unpublished revision denies guest and ordinary member');await guest.close();
  const context=await browser.newContext({baseURL:base,viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addCookies([{name:'sb-127-auth-token',value:fixtureSession(),url:base,sameSite:'Lax'}]);
  const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text());});
  page.on('request',req=>{if(['POST','PATCH','DELETE'].includes(req.method())&&!req.url().endsWith('/rpc/is_admin'))row.writes.push({method:req.method(),path:new URL(req.url()).pathname,body:req.postDataJSON()});});
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const unit of ['u20','u23','u32','u35','u42']){
    await page.goto(url(unit+'-route'));await page.locator('#'+unit+'-route').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert(await page.getByText('관리자 미리보기 · 발행 전 원고입니다.',{exact:true}).isVisible());
    const layout=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,routeWidth:document.querySelector('.book-route')?.getBoundingClientRect().width}));
    assert(layout.documentWidth<=width+1,`${unit}/${width} overflows`);row.layouts.push({unit,...layout});
    const stage=page.locator('#'+unit+'-route a.page-jump').first(),target=await stage.getAttribute('href');
    await stage.focus();await page.keyboard.press('Enter');await page.waitForURL('**'+target);
    await page.waitForFunction(id=>{const top=document.getElementById(id)?.getBoundingClientRect().top;return top>=0&&top<220;},target.slice(1));
    assert.equal(new URL(page.url()).searchParams.get('edition'),revision);
    if(width===1440||width===390){
     await page.goto(url(unit+'-route'));await page.locator('#'+unit+'-route').waitFor();
     await page.locator('#'+unit+'-route').screenshot({path:path.join(out,`${name}-${unit}-route-${width}.png`)});
    }
   }
  }
  row.checks.push('five routes at 1440/390/320; keyboard start retains edition');
  const aids=[['u32-review2','写真','しゃしん'],['u37-practice','持って','もって'],['u41-patterns','聞きながら','ききながら'],['u41-dialogue','名前','なまえ'],['u42-review3','多い','おおい'],['u42-review5','今度','こんど']];
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const [section,word,reading] of aids){
    await page.goto(url(section));const help=page.locator('#'+section+' .book-reading-help');await help.waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await help.locator('rt').textContent(),reading);assert((await help.innerText()).includes(word));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert(await help.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    row.layouts.push({unit:section,width,documentWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
    if(section==='u37-practice'&&width!==320){await help.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${name}-reading-help-${width}.png`)});}
   }
  }
  row.checks.push('six targeted reading aids remain visible without overflow at 1440/390/320');
  await page.goto(url('u32-review1'));await page.locator('#u32-review1').waitFor();
  assert(!(await page.locator('#u32-review1').innerText()).includes('복습'));
  assert((await page.locator('#u32-review1').innerText()).includes('연습 12'));
  const saved=page.getByRole('link',{name:'담은 표현',exact:true});assert(await saved.isVisible());
  assert((await saved.getAttribute('href')).startsWith('/books/japanese-n5/review?'));
  assert(await page.locator('a[href="/vocab"]').filter({hasText:'복습'}).count()>0);
  await page.goto(url('u42-review2'));await page.locator('#u42-review2').waitFor();
  assert.equal(await page.locator('#u42-review2 .review-task ruby').filter({hasText:/本|休/}).count(),0);
  row.checks.push('practice labels and saved-expression review are distinct; reading/spelling answers stay unaided');
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const section of ['u39-mission','u39-recall','u39-review1']){
    await page.goto(url(section));await page.locator('#'+section).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    row.layouts.push({unit:section,width,documentWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
    if(width!==320&&section==='u39-review1')await page.locator('#'+section).screenshot({path:path.join(out,`${name}-${section}-${width}.png`)});
   }
  }
  await page.goto(url('u32-practice'));await page.locator('#u32-practice .book-study-pause a').click();
  await page.waitForURL('**#u32-review1');
  assert((await page.locator('#u32-review1').innerText()).includes('이 두 내용을 각각 한 문장으로'));
  await page.locator('#u32-review1 .book-recall-links a').filter({hasText:'연습 12'}).click();
  await page.waitForURL('**#u29-patterns');await page.locator('#u29-patterns').waitFor();await page.goBack();
  await page.locator('#u32-review1').waitFor();row.checks.push('lesson 32 main learning → cumulative recall → relevant past form → back');
  await page.goto(url('u39-mission'));await page.locator('#u39-mission .book-study-pause a').click();
  await page.waitForURL('**#u39-recall');assert((await page.locator('#u39-recall').innerText()).includes('다음 날에는 설명과 답을 보기 전에 이 과의 세 문항'));
  assert((await page.locator('#u39-recall').innerText()).includes('“먹으면 안 된다”는 뜻인지도'));
  await page.locator('#u39-recall .book-study-pause a').click();await page.waitForURL('**#u39-review1');
  const recall=page.locator('#u39-review1 textarea').first();await recall.fill('누적 복습 · 내가 만든 문장');
  const helper=page.locator('#u39-review1 .book-recall-links a').filter({hasText:'이유 말하기'});
  await helper.focus();await page.keyboard.press('Enter');await page.waitForURL('**#u35-patterns');
  await page.locator('#u35-patterns').waitFor();await page.goBack();await page.locator('#u39-review1').waitFor();
  assert.equal(await recall.inputValue(),'누적 복습 · 내가 만든 문장');await page.reload();await recall.waitFor();
  assert.equal(await recall.inputValue(),'누적 복습 · 내가 만든 문장');
  row.checks.push('lesson 39 optional practice can be skipped; next-day → cumulative recall → prerequisite preserves draft after back/reload');
  await page.setViewportSize({width:390,height:900});
  await page.goto(url('u42-practice'));await page.locator('#u42-practice').waitFor();
  await page.locator('#u42-practice .book-study-pause a').click();await page.waitForURL('**#u42-review1');
  await page.locator('#u42-review1 .book-recall-links a').filter({hasText:'40과'}).click();await page.waitForURL('**#u40-quantity');
  await page.locator('#u40-quantity').waitFor();await page.goBack();await page.locator('#u42-review1').waitFor();
  assert.equal(new URL(page.url()).hash,'#u42-review1');row.checks.push('new learning → cumulative recall → prerequisite → browser back');
  const area=page.locator('#u42-review1 textarea').first();await area.fill('합성 검수 · 내 문장');
  const key=await area.getAttribute('data-save');await page.reload();await page.locator('#u42-review1 textarea').first().waitFor();
  assert.equal(await page.locator('#u42-review1 textarea').first().inputValue(),'합성 검수 · 내 문장');
  await page.goto(url('u42-review1',old));await page.locator('#u42-review1 textarea').first().waitFor();
  assert.equal(await page.locator(`textarea[data-save="${key}"]`).inputValue(),'');row.checks.push('draft survives reload and never leaks into original edition');
  await page.goto(url('u42-review3'));await page.locator('#u42-review3').waitFor();
  const question=page.locator('#u42-review3 .review-task').last();assert((await question.innerText()).includes('今日は'));
  await page.locator('#u42-review3 summary').click();assert((await page.locator('#u42-review3 .answer').last().innerText()).includes('평소의 모습'));
  row.checks.push('revised contrast and rationale are rendered; original input key works');
  await page.locator('.manabi-mobile-toc summary').click();
  await page.locator('.manabi-mobile-toc').getByRole('link',{name:'내 속도로 나누어 배워요',exact:true}).click();await page.waitForURL('**#u42-route');
  assert.equal(await page.locator('.manabi-mobile-toc').getAttribute('open'),null);row.checks.push('mobile contents opens the new route and closes');
  await page.goto(url('u20-patterns'));await page.locator('#u20-patterns .examples').first().waitFor();
  const border=await page.locator('#u20-patterns .examples').first().evaluate(el=>({width:parseFloat(getComputedStyle(el).borderLeftWidth),background:getComputedStyle(el).backgroundColor}));
  // The approved app shell uses a light 1px box; the legacy artifact used 4px.
  assert(border.width>=1);assert.notEqual(border.background,'rgba(0, 0, 0, 0)');
  await page.screenshot({path:path.join(out,`${name}-examples-mobile.png`)});row.checks.push('example boxes and ruby remain in real reading layout');
  await page.goto(url('u42-route'));await page.locator('#u42-route').waitFor();
  await page.getByRole('button',{name:'집중 읽기',exact:true}).click();assert.equal(await page.locator('.gnb').isVisible(),false);
  await page.getByRole('button',{name:'기본 보기',exact:true}).click();assert.equal(await page.locator('.gnb').isVisible(),true);row.checks.push('focus reading returns to normal chrome');
  assert.deepEqual(row.errors,[]);
  for(const write of row.writes){assert.equal(write.method,'POST');assert.equal(write.path,'/rest/v1/library_reading_activity');assert.equal(write.body.target_kind,'edition');assert.equal(write.body.target_id,old);assert.equal(write.body.owner_id,'00000000-0000-4000-8000-000000000042');}
  row.checks.push('preview causes no server write; original visit logs only its own reading activity');await context.close();
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}
console.log(JSON.stringify({revision,engines:report.engines.map(e=>({name:e.engine,checks:e.checks.length,layouts:e.layouts.length,errors:e.errors.length,writes:e.writes.length}))}));
