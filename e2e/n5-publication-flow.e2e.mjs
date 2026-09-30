// Actual Next UI, synthetic admin/guest and isolated draft API responses. No hosted writes.
import {chromium,webkit} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fixtureSession,revisionBackend} from './fixtures/n5-revision-backend.mjs';
// Next's local middleware canonicalizes loopback redirects to localhost.
const base=process.env.QA_BASE||'http://localhost:48991';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'synthetic authentication is local only');
const out=process.env.QA_OUT||'.qa/runs/n5-publication-flow/browser';fs.mkdirSync(out,{recursive:true});
const oldId='7f572327dc67893e9453246c',id='8a8c1c1fd452773810abaf8c';
const bundles=Object.fromEntries([oldId,id].map(key=>[key,JSON.parse(fs.readFileSync(`src/content/textbookEditions/${key}/bundle.json`))]));
const path=(anchor='cover')=>`/books/japanese-n5?edition=${id}#${anchor}`;
const report={scope:'Synthetic UI only; PostgreSQL/API semantics are covered by publicationFlow.test.js',engines:[]};
const backendPort=48996,backend=revisionBackend({port:backendPort,app:base});
await backend.start();
try {
for(const [engine,type]of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:true});
 await context.route('https://e2e.supabase.co/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:`http://127.0.0.1:${backendPort}${url.pathname}${url.search}`});await route.fulfill({response});});
 const row={engine,checks:[],layouts:[],errors:[]};report.engines.push(row);
 await context.addCookies([{name:'sb-e2e-auth-token',value:fixtureSession(),url:base,sameSite:'Lax'}]);
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>row.errors.push(error.message));
 let reviewRequests=0;page.on('request',req=>{if(req.url().includes('/api/learning/book-review'))reviewRequests++;});
 const layout=async label=>{
  await page.evaluate(()=>document.fonts.ready);
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(dimensions.scroll<=dimensions.width+1,label);
  row.layouts.push({label,...dimensions});await page.screenshot({path:`${out}/${engine}-${label}.png`});
 };
 try{
  await page.goto(base+path());await page.waitForLoadState('networkidle');await page.getByText('JAPANESE · N5 / 검수 중인 교재',{exact:true}).filter({visible:true}).waitFor();
  // The resume label changes only after the reader's first client effect.
  await page.getByRole('link',{name:'첫 과부터 시작하기 →',exact:true}).waitFor();
  await page.getByRole('button',{name:'내 계정',exact:true}).waitFor();
  await page.getByRole('link',{name:'담은 표현 복습하기 ↗',exact:true}).click();await page.getByRole('heading',{name:'발행 후 표현을 담을 수 있어요.'}).waitFor();await page.waitForLoadState('networkidle');
  assert.equal(reviewRequests,0);await page.getByRole('link',{name:'검수 중인 교재로 돌아가기 →'}).click();await page.locator('#u01-start').waitFor();
  assert(page.url().includes(id));await page.getByRole('link',{name:'← 책으로',exact:true}).click();await page.getByRole('link',{name:'함께 읽기 · 내 자료 ↗',exact:true}).click();
  await page.getByRole('status').filter({hasText:'내 자료 연결은 발행 후'}).waitFor();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await layout(`preview-materials-${width}`);}
  const culture=page.locator('.manabi-culture-card').first();const href=await culture.getAttribute('href');await culture.click();await page.locator('#'+href.split('#')[1]).waitFor();assert(page.url().includes(id));
  row.checks.push('candidate home → review notice → same candidate → culture → same candidate; no private review request');
  await page.goto(base+`/books/japanese-n5/review?edition=${id}`);await page.getByRole('heading',{name:'발행 후 표현을 담을 수 있어요.'}).waitFor();await page.waitForLoadState('networkidle');await layout('preview-review-320');

  let draft={manuscript:structuredClone(bundles[oldId].manuscript),content_hash:'a'.repeat(64),version:7};draft.manuscript.lessons[0].title='보존할 교사 초안';
  const original=structuredClone(draft),writes=[];let failSave=true,failLoad=false;
  await page.route('**/api/admin/books/japanese-n5*',async route=>{
   const req=route.request();
   if(req.method()==='POST'){
    const body=req.postDataJSON();writes.push(body);
    assert.equal(body.action,'save');assert.equal(body.editionId,id);assert.equal(body.replaceDraftHash,original.content_hash);assert.equal(body.expectedDraftVersion,7);
    if(failSave){failSave=false;return route.fulfill({status:409,json:{error:'검수용 동시 저장 충돌 · 입력을 유지해요.'}});}
    draft={manuscript:body.manuscript,content_hash:bundles[id].contentHash,version:8};return route.fulfill({json:{ok:true,draft}});
   }
   if(failLoad){failLoad=false;return route.fulfill({status:503,json:{error:'검수용 연결 실패'}});}
   const selected=new URL(req.url()).searchParams.get('edition')||id,b=bundles[selected];
   return route.fulfill({json:{base:b.manuscript,draft,release:{edition_id:oldId,version:1},history:[],candidates:[{editionId:id,pages:bundles[id].pages.length},{editionId:oldId,pages:489}],candidate:{editionId:selected,contentHash:b.contentHash,pages:b.pages.length,pdfEnabled:false}}});
  });
  await page.goto(base+'/admin/books/japanese-n5');await page.getByRole('heading',{name:'일본어 N5 · 한 권 편집'}).waitFor();
  const selector=page.getByRole('combobox',{name:'검수할 판본',exact:true}),title=page.getByRole('textbox',{name:'제목',exact:true});
  await title.waitFor();assert.equal(await selector.inputValue(),id);assert.equal(await title.inputValue(),original.manuscript.lessons[0].title);
  assert.equal(await page.getByRole('button',{name:'검수 원고로 편집 시작',exact:true}).isEnabled(),false);
  assert.equal(await page.getByRole('button',{name:'검수한 판본 발행',exact:true}).isEnabled(),false);
  failLoad=true;await selector.selectOption(oldId);await page.getByRole('alert').filter({hasText:'검수용 연결 실패'}).waitFor();assert.equal(await title.inputValue(),original.manuscript.lessons[0].title);
  await selector.selectOption(oldId);await page.waitForFunction(edition=>document.querySelector('.book-toolbar a[target="_blank"]')?.href.includes(edition),oldId);
  assert.equal(await title.inputValue(),original.manuscript.lessons[0].title);
  await selector.selectOption(id);await page.waitForFunction(edition=>document.querySelector('.book-toolbar a[target="_blank"]')?.href.includes(edition),id);assert.equal(writes.length,0);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await layout(`editor-preserved-draft-${width}`);}
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'저장된 초안 내려받기'}).press('Enter');const downloaded=await downloadEvent;
  assert.deepEqual(JSON.parse(fs.readFileSync(await downloaded.path(),'utf8')),original.manuscript);
  await title.fill('보관 이후 추가한 미저장 입력');
  assert.equal(await page.getByRole('button',{name:'검수 원고로 편집 시작'}).isEnabled(),false);
  assert.equal(await title.inputValue(),'보관 이후 추가한 미저장 입력');assert.equal(writes.length,0);
  // Explicitly abandon this synthetic unsaved edit through the existing reload confirmation.
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'최신 초안 불러오기',exact:true}).click();
  await page.waitForFunction(expected=>document.querySelectorAll('.book-editor__field textarea')[1]?.value===expected,original.manuscript.lessons[0].title);
  const backupAgain=page.waitForEvent('download');await page.getByRole('button',{name:'저장된 초안 내려받기'}).press('Enter');await backupAgain;
  await page.getByRole('button',{name:'검수 원고로 편집 시작'}).press('Enter');assert.equal(await title.inputValue(),bundles[id].manuscript.lessons[0].title);
  assert.equal(await page.getByRole('button',{name:'검수 원고로 편집 시작'}).isEnabled(),false);assert.equal(await selector.isEnabled(),false);assert.equal(writes.length,0);
  await page.getByRole('button',{name:'초안 저장',exact:true}).click();await page.getByRole('alert').filter({hasText:'동시 저장 충돌'}).waitFor();assert.equal(await title.inputValue(),bundles[id].manuscript.lessons[0].title);
  await page.getByRole('button',{name:'초안 저장',exact:true}).click();await page.getByRole('status').filter({hasText:'비공개 초안을 저장했어요'}).waitFor();assert.equal(await page.getByRole('button',{name:'검수한 판본 발행',exact:true}).isEnabled(),true);assert.equal(writes.length,2);
  row.checks.push('candidate switching and failed load preserve draft; backup matches original; unsaved edits block replacement; keyboard adoption writes nothing until save; conflict preserves input; matching draft enables publication');

  const guest=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const guestPage=await guest.newPage();
  await guestPage.goto(`${base}/books/japanese-n5?edition=${oldId}#u03-study1`);const signin=guestPage.locator('#u03-study1 .manabi-example-signin').first();await signin.waitFor();
  const authHref=await signin.getAttribute('href'),from=new URL(authHref,base).searchParams.get('from');assert.equal(from,`/books/japanese-n5?edition=${oldId}#u03-study1`);
  await signin.click();await guestPage.getByRole('heading',{name:'로그인',exact:true}).waitFor();assert.equal(new URL(guestPage.url()).searchParams.get('from'),from);
  row.checks.push('guest example sign-in preserves exact published edition and source paragraph');
  for(const destination of ['/admin/books/japanese-n5','/admin/textbooks?lang=Japanese&section=grammar']){
   await guestPage.goto(base+destination);await guestPage.getByRole('heading',{name:'로그인',exact:true}).waitFor();
   const target=new URL(guestPage.url());assert.equal(target.origin,new URL(base).origin);assert.equal(target.pathname,'/auth');assert.equal(target.searchParams.get('from'),destination);
  }
  await guestPage.evaluate(()=>document.fonts.ready);
  const guestDimensions=await guestPage.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(guestDimensions.scroll<=guestDimensions.width+1);
  row.layouts.push({label:'admin-login-return-390',...guestDimensions});await guestPage.screenshot({path:`${out}/${engine}-admin-login-return-390.png`});
  await guest.close();row.checks.push('anonymous admin editor and filtered textbook entry preserve exact internal destinations on the real login screen');
  assert.deepEqual(row.errors,[]);
 }catch(error){await page.screenshot({path:`${out}/${engine}-failure.png`}).catch(()=>{});row.failure=error.message;row.url=page.url();throw error;}
 finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
}
} finally { await backend.close(); }
console.log(JSON.stringify(report));
