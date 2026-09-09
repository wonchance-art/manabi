// QA_BASE: server URL. QA_OUT: screenshots/report folder. QA_CHROME: Chrome executable.
// Uses a fresh guest browser and writes answers only to that isolated local storage.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.QA_BASE || 'http://127.0.0.1:8870';
const out = process.env.QA_OUT || path.join(os.tmpdir(), 'manabi-reading-qa');
fs.mkdirSync(out, {recursive:true});
(async()=>{
 const browser = await chromium.launch({executablePath:process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const page = await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report={base,layouts:[],flows:[],errors};
 const check=async(label)=>{
   await page.evaluate(()=>document.fonts.ready);
   const data=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,title:document.querySelector('main h1')?.innerText,articles:document.querySelectorAll('.book-reading-content article').length,examples:document.querySelectorAll('.book-reading-content .examples').length}));
   assert(data.documentWidth<=data.width+1,`${label}: overflow ${data.documentWidth}/${data.width}`);report.layouts.push({label,...data});
 };
 await page.goto(base+'/lessons');await page.locator('.manabi-bookshelf h1').waitFor();await check('shelf-desktop');await page.screenshot({path:out+'/shelf-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'일본어 N5 책 둘러보기',exact:true}).click();await page.getByRole('button',{name:'전체 42과',exact:true}).waitFor();await page.getByRole('button',{name:'전체 42과',exact:true}).click();
 assert.equal(await page.locator('.manabi-toc-group li').count(),42);report.flows.push('all-42-table-of-contents');
 await page.goto(base+'/books/japanese-n5#u29-patterns');await page.locator('.book-reading-content #u29-patterns').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.getElementById('u29-patterns')?.getBoundingClientRect().top < 220);
 const pos=await page.locator('#u29-patterns').boundingBox();assert(pos.y>=0&&pos.y<220,`source anchor not reached ${pos.y}`);report.flows.push('direct-source-anchor');
 assert((await page.locator('.book-example-save a').count())>0);report.flows.push('example-save-controls');await check('u29-patterns-desktop');await page.screenshot({path:out+'/reader-examples-desktop.png'});
 await page.locator('.manabi-reader-toolbar').getByRole('button',{name:'집중 읽기'}).click();assert.equal(await page.locator('.gnb').isVisible(),false);await page.getByRole('button',{name:'기본 보기'}).click();assert.equal(await page.locator('.gnb').isVisible(),true);report.flows.push('focus-and-return');
 await page.goto(base+'/books/japanese-n5#u01-practice');await page.locator('#u01-practice').waitFor();
 const radio=page.locator('input[type=radio]').first();await radio.check();const radioKey=await radio.getAttribute('data-save');const radioValue=await radio.getAttribute('value');
 const area=page.locator('textarea[data-save]').first();await area.fill('로컬 검수 답안');const areaKey=await area.getAttribute('data-save');await page.reload();await page.locator('#u01-practice').waitFor();
 await page.waitForFunction(({key,value})=>[...document.querySelectorAll('input[data-save]')].some(input=>input.dataset.save===key&&input.value===value&&input.checked),{key:radioKey,value:radioValue});assert.equal(await page.locator(`input[data-save="${radioKey}"][value="${radioValue}"]`).isChecked(),true);assert.equal(await page.locator(`textarea[data-save="${areaKey}"]`).inputValue(),'로컬 검수 답안');report.flows.push('radio-and-written-answer-reload');
 await page.getByRole('button',{name:'이 과 학습 완료',exact:true}).click();await page.getByRole('button',{name:'학습한 과예요 ✓',exact:true}).waitFor();report.flows.push('lesson-completion');
 for(const width of [390,320,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const unit of ['u07','u19','u25','u30','u35','u39','u42']){
   await page.goto(base+'/books/japanese-n5#'+unit+'-start');await page.locator('.book-reading-content #'+unit+'-start').waitFor();await check(unit+'-'+width);
   if(width===390&&unit==='u30')await page.screenshot({path:out+'/reader-mobile.png'});
  }
 }
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ['/lessons','/books/japanese-n5','/books/japanese-n5/review','/books/japanese-n5/materials','/vocab','/materials']){
   await page.goto(base+route);await page.locator('main').waitFor();await check(route+'-'+width);
   if(width===390&&route==='/lessons')await page.screenshot({path:out+'/shelf-mobile.png',fullPage:true});
  }
 }
 await page.goto(base+'/books/japanese-n5/materials');await page.getByRole('link',{name:/이름을 부르는 거리/}).click();await page.locator('#culture-1').waitFor();report.flows.push('culture-back-to-book');
 await page.goto(base+'/books/japanese-n5#reference-start');await page.locator('.lex-card').first().waitFor();await page.getByRole('searchbox',{name:'어휘·문형·한자 검색'}).fill('ZZZZNORESULT');assert.equal(await page.locator('.lex-card:visible').count(),0);await page.getByRole('searchbox',{name:'어휘·문형·한자 검색'}).fill('');assert((await page.locator('.lex-card:visible').count())>0);report.flows.push('reference-search');
 const meanings = page.locator('.hide-meanings').first(); await meanings.click(); assert.equal(await meanings.getAttribute('aria-pressed'),'true'); assert.equal(await meanings.locator('xpath=ancestor::article').locator('.meaning').first().evaluate(el=>getComputedStyle(el).visibility),'hidden'); await meanings.click(); report.flows.push('reference-meaning-toggle');
 await page.goto(base+'/books/japanese-n5#u29-dialogue'); await page.locator('#u29-dialogue .translation').waitFor(); const translation=page.locator('#u29-dialogue .translation'); await translation.click(); assert.equal(await page.locator('#u29-dialogue .dialogue .ko').first().isVisible(),false); await translation.click(); assert.equal(await page.locator('#u29-dialogue .dialogue .ko').first().isVisible(),true); report.flows.push('dialogue-translation-toggle');
 const units=[];for(let n=1;n<=42;n++){const unit='u'+String(n).padStart(2,'0');const r=await page.request.get(base+`/api/books/japanese-n5/7f572327dc67893e9453246c/reading?unit=${unit}`);assert.equal(r.status(),200);const b=await r.json();assert(b.sections.length>=4);assert(b.sections.every(s=>s.unit===unit));units.push({unit,sections:b.sections.length});}report.units=units;
 for(const path of ['/japanese/grammar/n5-04-desu-da','/chinese/vocab/hsk1','/english/bunkei/a1','/french','/admin/legacy-textbooks']){const r=await page.request.get(base+path,{maxRedirects:0});assert.equal(r.status(),307);report.flows.push(path+' -> '+r.headers().location);}
 for(const path of ['/api/learning/book-review','/api/admin/books/japanese-n5']){const r=await page.request.get(base+path);assert.equal(r.status(),401);report.flows.push(path+' denies guest');}
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({layouts:report.layouts.length,flows:report.flows,units:units.length,errors}));await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
