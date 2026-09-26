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
 const row={engine:name,checks:[],layouts:[],errors:[],writes:[],prefetches:[]};report.engines.push(row);
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
  page.on('request',req=>{if(req.headers()['next-router-prefetch']==='1'&&/^\/books\/japanese-n5\/(materials|review)$/.test(new URL(req.url()).pathname))row.prefetches.push(new URL(req.url()).pathname);});
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
  const indexBundle=JSON.parse(fs.readFileSync(new URL(`../src/content/textbookEditions/${revision}/bundle.json`,import.meta.url),'utf8'));
  const copyEdits=JSON.parse(fs.readFileSync(new URL('../scripts/textbook/n5-copy-edits.json',import.meta.url),'utf8')).edits;
  const changedPages=[...new Set(copyEdits.flatMap(edit=>edit.render.map(item=>item.target)))].filter(id=>id!=='cover');
  // The application has its own book home; the packaged cover is an artifact.
  const artifact=await context.request.get(`/api/books/japanese-n5/${revision}/asset?file=index.html`);assert.equal(artifact.status(),200);
  const artifactHtml=await artifact.text();
  for(const edit of copyEdits.filter(e=>e.render.some(r=>r.target==='cover')))assert(artifactHtml.includes(edit.after));
  const compact=text=>text.replace(/\s/g,'');
  for(const id of changedPages){
   await page.goto(url(id));const section=page.locator('#'+id);await section.waitFor();
   const rendered=compact(await section.textContent());
   for(const edit of copyEdits.filter(e=>e.render.some(r=>r.target===id)))assert(rendered.includes(compact(edit.after)),`missing reviewed copy: ${id}/${edit.path}`);
  }
  row.checks.push('all scoped reading copy rendered, including hidden rationales; packaged cover separately verified');
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const id of ['guide-katakana','u14-start','u17-start','u39-start','colophon']){
    await page.goto(url(id));const section=page.locator('#'+id);await section.waitFor();await page.evaluate(()=>document.fonts.ready);
    const layout=await section.evaluate(el=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,contentWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
    assert(layout.documentWidth<=width+1&&layout.scrollWidth<=layout.contentWidth+1,`copy overflow ${id}/${width}`);
    row.layouts.push({unit:id,...layout});
    if(width!==320)await section.screenshot({path:path.join(out,`${name}-copy-${id}-${width}.png`)});
   }
  }
  row.checks.push('reviewed kana, question, lesson and edition guidance readable at 1440/390/320');
  const written=JSON.parse(fs.readFileSync(new URL('../scripts/textbook/n5-written-practice.json',import.meta.url),'utf8'));
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});
   for(const model of written.pages){
    await page.goto(url(model.id));const section=page.locator('#'+model.id);await section.waitFor();await page.evaluate(()=>document.fonts.ready);
    const layout=await section.evaluate(el=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,contentWidth:el.clientWidth,scrollWidth:el.scrollWidth,minOption:Math.min(...[...el.querySelectorAll('.check label')].map(x=>x.getBoundingClientRect().height))}));
    assert(layout.documentWidth<=width+1&&layout.scrollWidth<=layout.contentWidth+1,`practice overflow ${model.id}/${width}`);
    assert(layout.minOption>=44,`small radio target ${model.id}/${width}`);row.layouts.push({unit:model.id,...layout});
    assert.equal(await section.locator('.check').count(),3);assert.equal(await section.locator('input[type=radio]').count(),12);
    assert.equal(await section.locator('.review-answers').getAttribute('open'),null);
    const first=model.tasks[0],input=section.locator(`input[data-save="${first.id}"][value="${first.options.indexOf(first.answer)}"]`);
    await input.check();await page.reload();await section.waitFor();
    // The page is inserted before the reading effect restores saved inputs.
    await page.waitForFunction(({id,value})=>document.querySelector(`input[data-save="${id}"][value="${value}"]`)?.checked,{id:first.id,value:String(first.options.indexOf(first.answer))},{timeout:5000});
    assert(await input.isChecked());
    await section.locator('.review-answers summary').click();
    assert((await section.locator('.review-answers').innerText()).includes(first.why));
    if(width!==320)await section.screenshot({path:path.join(out,`${name}-written-${model.id}-${width}.png`)});
   }
  }
  row.checks.push('five added pages / fifteen radio groups, folded answers, complete rationales, 44px targets and draft reload at 1440/390/320');
  for(const link of written.entryLinks){
   await page.goto(url(link.from));await page.locator('#'+link.from).waitFor();
   const entry=page.locator('#'+link.from).getByRole('link',{name:link.label+' →',exact:true});
   await entry.focus();await page.keyboard.press('Enter');await page.waitForURL('**#'+link.target);await page.locator('#'+link.target).waitFor();
   assert.equal(new URL(page.url()).searchParams.get('edition'),revision);
   await page.goBack();await page.locator('#'+link.from).waitFor();
  }
  row.checks.push('all five new entries work with keyboard and return to their original section');
  for(const model of written.pages){
   await page.goto(url(model.id));const section=page.locator('#'+model.id);await section.waitFor();
   for(const link of model.help){
    await section.getByRole('link',{name:link.label+' →',exact:true}).click();await page.waitForURL('**#'+link.target);await page.locator('#'+link.target).waitFor();
    await page.goBack();await section.waitFor();
   }
  }
  await page.goto(url('guide-katakana-small'));await page.locator('#guide-katakana-small').waitFor();
  await page.locator('#guide-katakana-small .practice-preparation summary').click();
  await page.locator('#guide-katakana-small a[href="#lex-329"]').click();await page.waitForURL('**#lex-329');await page.locator('#lex-329').waitFor();
  await page.goBack();await page.locator('#guide-katakana-small').waitFor();assert(await page.locator('input[data-save="kp-small-1"][value="2"]').isChecked());
  row.checks.push('all new prerequisites and vocabulary evidence return to the selected answer');
  await page.goto(url('guide-katakana',written.baseEdition));await page.locator('#guide-katakana').waitFor();
  assert.equal(await page.locator('input[data-save^="kp-"]').count(),0);
  row.checks.push('old copy-review edition keeps its original guide and never receives new question groups');
  const linked=indexBundle.manuscript.kanjiIndex.filter(e=>e.readingLink);
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});await page.goto(url('kanji-540d'));await page.locator('#kanji-540d').waitFor();
   await page.waitForFunction(()=>{const card=document.querySelector('#kanji-540d').getBoundingClientRect(),bar=document.querySelector('.manabi-reader-toolbar').getBoundingClientRect();return card.top>=bar.bottom&&card.top<260;});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.equal(await page.locator('.kanji-card').count(),103);
   assert.equal(await page.locator('.kanji-reading-link').count(),38);
   for(const id of ['kanji-540d','kanji-4e2d','kanji-805e']){
    const card=page.locator('#'+id);await card.scrollIntoViewIfNeeded();
    const box=await card.evaluate(el=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,cardWidth:el.clientWidth,scrollWidth:el.scrollWidth,minTarget:Math.min(...[...el.querySelectorAll('a')].map(a=>a.getBoundingClientRect().height))}));
    assert(box.scrollWidth<=box.cardWidth+1);assert(box.minTarget>=44);row.layouts.push({unit:id,...box});
   }
   await page.locator('#kanji-540d').scrollIntoViewIfNeeded();
   if(width!==320)await page.screenshot({path:path.join(out,`${name}-kanji-links-${width}.png`)});
  }
  row.checks.push('103 cards / 38 verified reading links; same/form/usage layouts and 44px targets at 1440/390/320');
  for(const entry of linked){
   await page.goto(url(entry.id));const link=page.locator('#'+entry.id+' .kanji-reading-link');await link.waitFor();
   // The reader restores focus to the destination card after fonts settle.
   // Verify that arrival before moving keyboard focus into its reading link.
   await page.waitForFunction(id=>document.activeElement?.id===id,entry.id);
   await link.focus();await page.keyboard.press('Enter');await page.waitForURL('**#'+entry.readingLink.target);await page.locator('#'+entry.readingLink.target).waitFor();
   assert.equal(new URL(page.url()).searchParams.get('edition'),revision);
   await page.goBack();await page.locator('#'+entry.id).waitFor();
  }
  row.checks.push('all 38 index → actual reading destination → browser back routes preserve edition');
  await page.goto(url('reference-start'));const search=page.getByRole('searchbox',{name:'어휘·문형·한자 검색'});await search.waitFor();
  for(const term of ['名前','なまえ','이름']){
   await search.fill(term);await page.locator('#kanji-540d').waitFor();assert(await page.locator('#kanji-540d').isVisible());
  }
  await search.fill('〜です');await page.locator('#gram-001').waitFor();
  await search.fill('검색결과없음xyz');await page.getByText('일치하는 항목이 없어요. 다른 말로 찾아보세요.',{exact:true}).waitFor();
  assert.equal(await page.locator('.kanji-card:visible').count(),0);
  await search.fill('');assert.equal(await page.locator('.kanji-card:visible').count(),103);
  await search.fill('名前');await page.locator('#kanji-540d .kanji-reading-link').click();await page.waitForURL('**#u41-dialogue');
  await page.goBack();await page.locator('#kanji-540d').waitFor();
  assert.equal(await search.inputValue(),'');
  await page.waitForURL('**#kanji-540d');
  await page.waitForFunction(()=>document.activeElement?.id==='kanji-540d');
  row.checks.push('kanji/kana/Korean and grammar search, empty result, clear, destination and back');
  await page.goto(url('kanji-540d'));const toggle=page.locator('#kanjiIndex-7 .hide-meanings');await toggle.waitFor();
  await toggle.click();assert.equal(await toggle.textContent(),'읽기·뜻 보기');assert.equal(await page.locator('#kanji-540d .meaning').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await toggle.click();assert.equal(await toggle.textContent(),'읽기·뜻 가리기');
  row.checks.push('kanji reading/meaning toggle keeps accurate label and restores content');

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
  await page.setViewportSize({width:1440,height:1000});
  assert.deepEqual(row.prefetches,[]);
  // Companion screens intentionally accept only published editions.
  await page.goto(url('u42-start',old));await page.locator('#u42-start').waitFor();
  await page.getByRole('link',{name:'함께 읽기 ↗',exact:true}).click();await page.waitForURL('**/materials?edition='+old);
  await page.getByRole('heading',{name:'책 밖으로 이어 읽기.',exact:true}).waitFor();
  await page.waitForLoadState('networkidle');
  await page.goBack();await page.locator('#u42-start').waitFor();
  await page.getByRole('link',{name:'담은 표현',exact:true}).click();await page.waitForURL('**/review?edition='+old);
  await page.getByRole('heading',{name:'다시 꺼내 보는 문장.',exact:true}).waitFor();
  await page.getByRole('heading',{name:'첫 문장을 담아 볼까요?',exact:true}).waitFor();
  await page.waitForLoadState('networkidle');
  await page.goBack();await page.locator('#u42-start').waitFor();
  row.checks.push('reader causes no automatic materials/review prefetch; published companion navigation and return remain available');
  assert.deepEqual(row.errors,[]);
  for(const write of row.writes){assert.equal(write.method,'POST');assert.equal(write.path,'/rest/v1/library_reading_activity');assert.equal(write.body.target_kind,'edition');assert.equal(write.body.target_id,old);assert.equal(write.body.owner_id,'00000000-0000-4000-8000-000000000042');}
  row.checks.push('preview causes no server write; original visit logs only its own reading activity');await context.close();
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}
console.log(JSON.stringify({revision,engines:report.engines.map(e=>({name:e.engine,checks:e.checks.length,layouts:e.layouts.length,errors:e.errors.length,writes:e.writes.length}))}));
