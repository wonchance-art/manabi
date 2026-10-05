// Synthetic local production app only. Use E2E_PUBLISHED_EDITION=8a8c1c1fd452773810abaf8c
// with e2e/server-fetch-mock.mjs; RELOAD_BROWSER=webkit runs the same assertions in WebKit.
import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {chromium, webkit} from 'playwright-core';
import config from '../playwright.config.mjs';
import {fixtureSession} from './fixtures/n5-revision-backend.mjs';

const baseURL=process.env.COMPOSER_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || config.use.baseURL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(baseURL).hostname));
const editions=['8a8c1c1fd452773810abaf8c','7f572327dc67893e9453246c'];
const owner='00000000-0000-4000-8000-000000000042',other='00000000-0000-4000-8000-000000000043';
const engine=process.env.RELOAD_BROWSER==='webkit'?webkit:chromium;
const progressKey=(edition,account=owner)=>`manabi-book-progress:${edition}:${account}`;
const draftKey=edition=>`manabi-book-answers:${edition}:${owner}`;
let browser;
before(async()=>{browser=await engine.launch(engine===chromium?config.use.launchOptions:{headless:true});});
after(async()=>{await browser?.close();});

async function fixture(width,account=owner){
 const context=await browser.newContext({baseURL,viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 // Reuse the synthetic session, including its server-side publication access.
 const session=JSON.parse(Buffer.from(fixtureSession('learner').slice(7),'base64url').toString());
 const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());
 session.user.id=account;claims.sub=account;
 session.access_token=session.access_token.split('.')[0]+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic';
 await context.addCookies([{name:'sb-e2e-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:baseURL,sameSite:'Lax'}]);
 const writes=[],errors=[],user=session.user;
 const json=(route,body)=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(body)});
 await context.route('**/auth/v1/**',route=>json(route,new URL(route.request().url()).pathname.endsWith('/user')?user:session));
 await context.route('**/rest/v1/**',route=>{
  const request=route.request(),table=new URL(request.url()).pathname.split('/').at(-1);
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(!['GET','HEAD'].includes(request.method())&&table!=='is_admin')writes.push({table,method:request.method(),body:request.postDataJSON()});
  if(table==='profiles')return json(route,{id:account,role:'learner',onboarded:true,last_login_at:new Date().toISOString(),streak_count:1});
  if(table==='is_admin')return json(route,false);
  return json(route,[]);
 });
 await context.addInitScript(()=>{
  window.__readingWrites=[];const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(String(key).startsWith('manabi-book-progress:'))window.__readingWrites.push({key,value});return original.call(this,key,value);};
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 return {page,context,writes,errors};
}
function href(edition,anchor='u03-start',reference=false){
 return `/books/japanese-n5?edition=${edition}&returnTo=${encodeURIComponent('/lessons?lang=Japanese')}${reference?'&reference=1':''}#${anchor}`;
}
async function settled(page,id){
 await page.locator(`#${id}`).waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(id=>{
  const saved=window.history.state?.manabiBookPosition,node=document.getElementById(id),bar=document.querySelector('.manabi-reader-toolbar');
  return saved?.page===id&&saved.document===performance.timeOrigin&&saved.href===location.href&&node&&bar
   &&Math.abs(node.getBoundingClientRect().top-bar.getBoundingClientRect().bottom-saved.offset)<2;
 },id);
}
async function scrollToArticle(page,id){
 await page.locator(`#${id}`).evaluate(node=>{
  node.scrollIntoView({block:'start',behavior:'instant'});
  scrollBy(0,node.getBoundingClientRect().top-document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom-12);
 });
 await settled(page,id);
}
async function captureOffset(page,id){
 await settled(page,id);
 return page.locator(`#${id}`).evaluate(node=>node.getBoundingClientRect().top-document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom);
}
async function retainedOffset(page,id,expected){
 await settled(page,id);
 const actual=await page.locator(`#${id}`).evaluate(node=>({
  dom:node.getBoundingClientRect().top-document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom,
  saved:history.state.manabiBookPosition.offset,
 }));
 assert.ok(Math.abs(actual.dom-expected)<2,JSON.stringify({id,expected,...actual}));
 assert.ok(Math.abs(actual.saved-expected)<2,JSON.stringify({id,expected,...actual}));
}
async function visiblePosition(page,id){
 const geometry=await page.locator(`#${id}`).evaluate(node=>({top:node.getBoundingClientRect().top,toolbar:document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom,width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth}));
 assert.ok(geometry.top>=geometry.toolbar-1,JSON.stringify(geometry));
 assert.ok(geometry.top<Math.min(240,geometry.height*.32),JSON.stringify(geometry));
 assert.ok(geometry.documentWidth<=geometry.width+1,JSON.stringify(geometry));
}
async function seed(page){
 // Initialize only once on a valid HTTP document; reload must preserve storage.
 await page.goto('/lessons',{waitUntil:'domcontentloaded'});
 await page.evaluate(({editions,owner,other})=>{
  for(const edition of editions){
   for(const account of [owner,other,'guest'])localStorage.setItem(`manabi-book-progress:${edition}:${account}`,JSON.stringify({page:'u17-patterns',completed:['u01','u02'],updatedAt:'2026-10-01T00:00:00.000Z'}));
   localStorage.setItem(`manabi-book-answers:${edition}:${owner}`,JSON.stringify({'preserved-answer':'kept'}));
  }
 },{editions,owner,other});
}
async function storage(page){
 return page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>/^manabi-book-(progress|answers):/.test(key)).sort().map(key=>[key,localStorage.getItem(key)])));
}

for(const edition of editions)for(const width of [320,390,1440])test(`${engine.name()} ${edition.slice(0,2)} ${width}: reload restores current article with explicit URL, drafts and completion intact`,async()=>{
 const f=await fixture(width);try{
  await seed(f.page);const initial=await storage(f.page);
  await f.page.goto(href(edition));await settled(f.page,'u03-start');
  // Preserve an unrelated state property as well as Next's routing fields.
  await f.page.evaluate(()=>history.replaceState({...history.state,reloadSentinel:{keep:true}},'',location.href));
  const state=await f.page.evaluate(()=>({__NA:history.state.__NA,__PRIVATE_NEXTJS_INTERNALS_TREE:history.state.__PRIVATE_NEXTJS_INTERNALS_TREE}));
  await scrollToArticle(f.page,'u03-practice');await visiblePosition(f.page,'u03-practice');
  await f.page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{}').page==='u03-practice',progressKey(edition));
  const offset=await captureOffset(f.page,'u03-practice');
  const before=await storage(f.page),url=f.page.url();assert.equal(new URL(url).hash,'#u03-start');
  // Delay the body response on reload; no transient start progress may be persisted.
  let delay=true;await f.page.route('**/api/books/**/reading?*',async route=>{if(delay){delay=false;await new Promise(resolve=>setTimeout(resolve,250));}await route.continue();});
  await f.page.reload({waitUntil:'domcontentloaded'});await retainedOffset(f.page,'u03-practice',offset);await visiblePosition(f.page,'u03-practice');
  assert.equal(f.page.url(),url);const reloaded=await storage(f.page);
  for(const key of Object.keys(before))if(key!==progressKey(edition))assert.equal(reloaded[key],before[key],key);
  const primary=JSON.parse(reloaded[progressKey(edition)]),previous=JSON.parse(before[progressKey(edition)]);
  assert.equal(primary.page,previous.page);assert.deepEqual(primary.completed,previous.completed);
  assert.ok(Date.parse(primary.updatedAt)>=Date.parse(previous.updatedAt));
  assert.deepEqual(await f.page.evaluate(key=>window.__readingWrites.filter(write=>write.key===key).map(write=>JSON.parse(write.value).page).filter(page=>page!=='u03-practice'),progressKey(edition)),[]);
  const after=await f.page.evaluate(()=>({sentinel:history.state.reloadSentinel,__NA:history.state.__NA,__PRIVATE_NEXTJS_INTERNALS_TREE:history.state.__PRIVATE_NEXTJS_INTERNALS_TREE}));
  assert.deepEqual(after.sentinel,{keep:true});assert.equal(after.__NA,state.__NA);assert.deepEqual(after.__PRIVATE_NEXTJS_INTERNALS_TREE,state.__PRIVATE_NEXTJS_INTERNALS_TREE);
  const saved=await storage(f.page);assert.equal(saved[draftKey(edition)],initial[draftKey(edition)]);
  assert.deepEqual(JSON.parse(saved[progressKey(edition)]).completed,['u01','u02']);
  for(const key of Object.keys(initial))if(key!==progressKey(edition))assert.equal(saved[key],initial[key],key);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test(`${engine.name()}: explicit anchors, same-hash history and persisted pageshow retain their own positions`,async()=>{
 const f=await fixture(390),edition=editions[0];try{
  await f.page.goto(href(edition));await settled(f.page,'u03-start');await scrollToArticle(f.page,'u03-practice');
  const practiceOffset=await captureOffset(f.page,'u03-practice');
  // An explicit TOC click creates another entry with the same hash and starts there.
  await f.page.locator('.manabi-reader-outline a[href$="#u03-start"]').evaluate(link=>link.click());await settled(f.page,'u03-start');assert.ok(await f.page.evaluate(()=>scrollY<5));
  await scrollToArticle(f.page,'u03-dialogue');const dialogueOffset=await captureOffset(f.page,'u03-dialogue');
  await f.page.evaluate(()=>history.back());await retainedOffset(f.page,'u03-practice',practiceOffset);await visiblePosition(f.page,'u03-practice');
  await f.page.evaluate(()=>history.forward());await retainedOffset(f.page,'u03-dialogue',dialogueOffset);await visiblePosition(f.page,'u03-dialogue');
  // DOM activation keeps the actual Next Link behavior without automation scrolling first.
  const reviewOffset=await captureOffset(f.page,'u03-dialogue');
  await f.page.getByRole('link',{name:'담은 표현',exact:true}).evaluate(link=>link.click());
  await f.page.waitForURL(url=>url.pathname.endsWith('/review'));
  await f.page.goBack();await retainedOffset(f.page,'u03-dialogue',reviewOffset);await visiblePosition(f.page,'u03-dialogue');
  // A fresh Next return link honors its explicit source anchor.
  await f.page.evaluate(()=>scrollBy(0,340));await settled(f.page,'u03-dialogue');
  assert.ok(await f.page.locator('#u03-dialogue').evaluate(node=>node.getBoundingClientRect().top<document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom));
  await f.page.getByRole('link',{name:'담은 표현',exact:true}).evaluate(link=>link.click());
  await f.page.waitForURL(url=>url.pathname.endsWith('/review'));
  const returnLink=f.page.getByRole('link',{name:/교재로 돌아가기/}).first();
  await returnLink.waitFor();await returnLink.evaluate(link=>link.click());await settled(f.page,'u03-dialogue');
  assert.ok(await f.page.locator('#u03-dialogue').evaluate(node=>node.getBoundingClientRect().top>=document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom-1));
  const persistedOffset=await captureOffset(f.page,'u03-dialogue');
  // Exercise persisted lifecycle handlers even when automation disables real bfcache.
  await f.page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));scrollTo(0,0);dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  await retainedOffset(f.page,'u03-dialogue',persistedOffset);await visiblePosition(f.page,'u03-dialogue');
  await f.page.goto(href(edition,'u03-patterns'));await settled(f.page,'u03-patterns');
  assert.equal(new URL(f.page.url()).hash,'#u03-patterns');
  // A newly opened source/TOC URL gets its explicit anchor, not the prior entry.
  const fresh=await f.context.newPage();await fresh.goto(href(edition));await settled(fresh,'u03-start');assert.ok(await fresh.evaluate(()=>scrollY<5));await fresh.close();
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test(`${engine.name()}: reference reload and history preserve all primary positions and send zero recent-reading or grade writes`,async()=>{
 const f=await fixture(320);try{
  await seed(f.page);const before=await storage(f.page);f.writes.length=0;
  for(const edition of editions){
   await f.page.goto(href(edition,'u03-start',true));await settled(f.page,'u03-start');await scrollToArticle(f.page,'u03-practice');
   const offset=await captureOffset(f.page,'u03-practice');
   await f.page.reload();await retainedOffset(f.page,'u03-practice',offset);await visiblePosition(f.page,'u03-practice');
   assert.equal(new URL(f.page.url()).searchParams.get('reference'),'1');
   assert.deepEqual(await storage(f.page),before);
   await f.page.locator('.manabi-reader-outline a[href$="#u03-start"]').evaluate(link=>link.click());
   await settled(f.page,'u03-start');await f.page.evaluate(()=>history.back());
   await retainedOffset(f.page,'u03-practice',offset);await visiblePosition(f.page,'u03-practice');
   assert.deepEqual(await storage(f.page),before);
  }
  assert.deepEqual(f.writes.filter(write=>['library_reading_activity','user_vocabulary','save_vocabulary_context','review_events'].includes(write.table)),[]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test(`${engine.name()}: reload rejects a previous account snapshot and honors the explicit anchor`,async()=>{
 const f=await fixture(390,other),edition=editions[0];try{
  await seed(f.page);await f.page.goto(href(edition));await settled(f.page,'u03-start');
  const preserved=await f.page.evaluate(key=>localStorage.getItem(key),progressKey(edition,owner));
  await f.page.evaluate(({owner})=>history.replaceState({...history.state,manabiBookPosition:{...history.state.manabiBookPosition,account:owner,page:'u03-practice'}},'',location.href),{owner});
  await f.page.reload();await settled(f.page,'u03-start');assert.ok(await f.page.evaluate(()=>scrollY<5));
  assert.equal(await f.page.evaluate(key=>localStorage.getItem(key),progressKey(edition,owner)),preserved);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});


test(`${engine.name()}: a mid-article reload retains the visible passage rather than jumping to its heading`,async()=>{
 const f=await fixture(390),edition=editions[0];try{
  await f.page.goto(href(edition));await settled(f.page,'u03-start');await scrollToArticle(f.page,'u03-practice');
  await f.page.evaluate(()=>scrollBy(0,340));await settled(f.page,'u03-practice');
  const offset=await captureOffset(f.page,'u03-practice');
  const before=await f.page.locator('#u03-practice').evaluate(node=>({top:node.getBoundingClientRect().top,y:scrollY}));
  assert.ok(before.top<0);await f.page.reload();await retainedOffset(f.page,'u03-practice',offset);
  const after=await f.page.locator('#u03-practice').evaluate(node=>({top:node.getBoundingClientRect().top,y:scrollY,bottom:node.getBoundingClientRect().bottom,toolbar:document.querySelector('.manabi-reader-toolbar').getBoundingClientRect().bottom}));
  assert.ok(Math.abs(after.top-before.top)<2,JSON.stringify({before,after}));assert.ok(after.bottom>after.toolbar);
  assert.equal(JSON.parse((await storage(f.page))[progressKey(edition)]).page,'u03-practice');assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test(`${engine.name()}: reload rejects wrong-edition and missing-article snapshots`,async()=>{
 const f=await fixture(390),edition=editions[0];try{
  for(const invalid of [{edition:editions[1],page:'u03-practice'},{edition,page:'u03-deleted-article'}]){
   await f.page.goto(href(edition));await settled(f.page,'u03-start');
   await f.page.evaluate(invalid=>history.replaceState({...history.state,manabiBookPosition:{...history.state.manabiBookPosition,...invalid}},'',location.href),invalid);
   await f.page.reload();await settled(f.page,'u03-start');assert.ok(await f.page.evaluate(()=>scrollY<5));
   assert.equal(JSON.parse((await storage(f.page))[progressKey(edition)]).page,'u03-start');
  }
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
