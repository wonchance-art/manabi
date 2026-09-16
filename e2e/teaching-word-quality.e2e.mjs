import {createServer} from 'vite';
import {chromium,webkit} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=process.env.QA_OUT||'/private/tmp/manabi-word-quality',engine=process.env.QA_BROWSER||'chromium';fs.mkdirSync(out,{recursive:true});
const server=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:3122,strictPort:true},oxc:{jsx:{runtime:'automatic'}},optimizeDeps:{include:['react','react-dom/client','react/jsx-dev-runtime','react/jsx-runtime']},logLevel:'error'});await server.listen();
const browser=await (engine==='webkit'?webkit:chromium).launch(engine==='chromium'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}:{headless:true});
const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:3122/e2e/word-quality-fixture.html');await page.locator('[data-case]').last().waitFor();await page.waitForFunction(()=>document.querySelectorAll('.teaching-word-graphic').length===20);
 await page.waitForTimeout(150);
 const baseline=await page.locator('.teaching-word-graphic').evaluateAll(es=>es.map(e=>e.getAttribute('viewBox')));
 for(let mask=0;mask<8;mask++)for(const card of [false,true]){
  await page.evaluate(({mask,card})=>window.setWordQuality(mask,card),{mask,card});await page.waitForFunction(({mask,card})=>document.querySelector('main').dataset.mask===String(mask)&&document.querySelector('main').dataset.card===String(card),{mask,card});
  assert.deepEqual(await page.locator('.teaching-word-graphic').evaluateAll(es=>es.map(e=>e.getAttribute('viewBox'))),baseline);
  const readings=await page.locator('.teaching-word-part--reading').evaluateAll(es=>es.map(e=>getComputedStyle(e).visibility));assert(readings.every(v=>v===(mask&1?'visible':'hidden')));
  const hun=await page.locator('.teaching-word-part--hun').evaluateAll(es=>es.map(e=>getComputedStyle(e).visibility));assert(hun.every(v=>v===(mask&2?'visible':'hidden')));
  const meanings=await page.locator('.teaching-word-part--meaning').evaluateAll(es=>es.map(e=>getComputedStyle(e).visibility));assert(meanings.every(v=>v===(mask&4?'visible':'hidden')));
 }
 await page.evaluate(()=>window.setWordQuality(7,false));
 for(const width of [390,768,1024]){await page.setViewportSize({width,height:844});await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${out}/words-${width}.png`,fullPage:true});for(const id of ['ja-1','zh-5','zh-17'])await page.locator(`[data-case="${id}"]`).screenshot({path:`${out}/${id}-${width}.png`});}
 const grouped=await page.locator('[data-case="ja-22"] .reader-settings__preview ruby').allTextContents();assert.deepEqual(grouped,['食べるくう']);
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({engine,cases:10,masks:8,appearances:2,surfaces:['viewer preview','word inspector','presentation'],widths:[390,768,1024],errors},null,2));console.log('PASS: 10 cases × 8 masks × 2 appearances; viewer/inspector/presentation; 3 widths; no page errors');
}finally{await browser.close();await server.close();}
