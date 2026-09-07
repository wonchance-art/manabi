// Synthetic local backend only; it cannot contact production or alter personal records.
// Start the E2E build/server with e2e/server-fetch-mock.mjs, then set COMPOSER_BASE_URL.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
const baseURL = process.env.COMPOSER_BASE_URL || 'http://localhost:8870';
assert.ok(['127.0.0.1','localhost'].includes(new URL(baseURL).hostname));
const screenshots = process.env.COMPOSER_SCREENSHOTS;
let browser;
const owner = '00000000-0000-4000-8000-000000000172';
const bytes = Object.fromEntries(await Promise.all(['pdf','epub'].map(async kind=>[kind,await readFile(new URL(`./fixtures/composer/reading.${kind}`,import.meta.url))])));
const hashBytes = new Map(Object.entries(bytes).map(([kind,buffer])=>[createHash('sha256').update(buffer).digest('hex'),{kind,buffer}]));
before(async()=>{ browser=await chromium.launch(config.use.launchOptions);if(screenshots)await mkdir(screenshots,{recursive:true}); });
after(async()=>{await browser?.close();});

async function fixture({width=1440,guest=false}={}) {
 const context=await browser.newContext({baseURL,viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 const now=Math.floor(Date.now()/1000), user={id:owner,aud:'authenticated',role:'authenticated',email:'composer-fixture@example.com',email_confirmed_at:new Date().toISOString(),confirmed_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{display_name:'E2E 학습자'},created_at:new Date().toISOString()};
 const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const session={access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:owner,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})}.e2e`,refresh_token:'e2e-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer',user};
 if(!guest)await context.addCookies([{name:'sb-e2e-auth-token',value:`base64-${enc(session)}`,url:baseURL,sameSite:'Lax'}]);
 const rows=[], objects=new Map(), errors=[];
 let failNextInsert=false,loseNextReply=false,failUpload=false,analysisCalls=0;
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS,HEAD','access-control-expose-headers':'content-range'};
 const json=(route,value,status=200,extra={})=>route.fulfill({status,contentType:'application/json',headers:{...cors,...extra},body:JSON.stringify(value)});
 await context.route('**/auth/v1/**',r=>json(r,new URL(r.request().url()).pathname.endsWith('/user')?user:session));
 await context.route('**/api/analyze',r=>{analysisCalls++;return json(r,{error:'NO_AUTOMATIC_ANALYSIS'},500);});
 await context.route('**/rest/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(table==='profiles')return json(route,{id:owner,display_name:'E2E 학습자',role:'learner',onboarded:true,last_login_at:new Date().toISOString(),streak_count:1});
  if(table==='reading_materials'){
   if(req.method()==='POST'){
    if(failNextInsert){failNextInsert=false;return json(route,{message:'fixture write failure'},503);}
    const input=req.postDataJSON();const payload=Array.isArray(input)?input[0]:input;
    const duplicate=rows.find(row=>row.processed_json.metadata.importAttempt===payload.processed_json.metadata.importAttempt);
    if(duplicate)return json(route,{code:'23505'},409);
    const row={...payload,id:94000+rows.length,created_at:new Date().toISOString()};rows.push(row);
    if(loseNextReply){loseNextReply=false;return route.abort('failed');}
    return json(route,[{id:row.id}]);
   }
   let found=rows.filter(row=>[...url.searchParams].every(([key,value])=>{
    if(!value.startsWith('eq.'))return true;
    if(key.includes('importAttempt'))return row.processed_json.metadata.importAttempt===value.slice(3);
    if(key==='processed_json')return JSON.stringify(row.processed_json)===value.slice(3);
    return String(row[key])===value.slice(3);
   }));
   if(req.method()==='PATCH'){found.forEach(row=>Object.assign(row,req.postDataJSON()));return json(route,found.map(row=>({id:row.id})));}
   if(req.method()==='HEAD')return route.fulfill({status:200,headers:{...cors,'content-range':`0-${Math.max(0,found.length-1)}/${found.length}`}});
   return json(route,req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found);
  }
  if(req.method()==='HEAD')return route.fulfill({status:200,headers:{...cors,'content-range':'*/0'}});
  return json(route,[]);
 });
 await context.route('**/storage/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(p.includes('/object/list/')){
   const {prefix}=req.postDataJSON();return json(route,[...objects].filter(([path])=>path.startsWith(prefix+'/')).map(([path,file])=>({name:path.split('/').pop(),metadata:{size:file.buffer.length}})));
  }
  if(p.includes('/object/sign/')&&req.method()==='POST')return json(route,{signedURL:`/object/sign/material-originals/${p.split('/material-originals/')[1]}?token=fixture`});
  const path=p.split('/material-originals/')[1],hash=path?.split('/').pop()?.split('.')[0];
  if(req.method()==='POST'){
   if(failUpload)return json(route,{message:'fixture upload failure'},503);
   objects.set(path,hashBytes.get(hash));return json(route,{Key:path});
  }
  const file=objects.get(path);
  return file?route.fulfill({status:200,headers:cors,contentType:file.kind==='pdf'?'application/pdf':'application/epub+zip',body:file.buffer}):json(route,{error:'missing original'},404);
 });
 const page=await context.newPage();
 page.on('pageerror',err=>errors.push(err.message));
 page.on('dialog',dialog=>dialog.accept());
 return {context,page,rows,objects,errors,get analysisCalls(){return analysisCalls;},lose:()=>{loseNextReply=true;},failInsert:()=>{failNextInsert=true;},failUpload:()=>{failUpload=true;}};
}
async function editor(f){await f.page.goto('/materials/add');await f.page.locator('#composer-title').waitFor();}
async function saved(f){await f.page.locator('.original-reader').waitFor();assert.equal(f.analysisCalls,0);assert.deepEqual(f.errors,[]);}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}

test('single editor: private text, draft recovery, exact body, library round trip and no automatic analysis',async()=>{
 const f=await fixture();try{
  await editor(f);assert.equal(await f.page.getByRole('button',{name:'저장',exact:true}).count(),1);
  await f.page.locator('#composer-title').fill('창가에서 읽는 프랑스어');await f.page.locator('#composer-body').fill('Bonjour.\n\n  내가 쓴 문장은 그대로 남습니다.');
  await f.page.getByText('이 기기에 초안 보관됨',{exact:true}).waitFor();await f.page.reload();
  assert.equal(await f.page.locator('#composer-body').inputValue(),'Bonjour.\n\n  내가 쓴 문장은 그대로 남습니다.');
  if(screenshots)await f.page.screenshot({path:`${screenshots}/editor-desktop.png`,fullPage:true});
  await f.page.getByRole('button',{name:'저장',exact:true}).click();await saved(f);
  assert.equal(f.rows.length,1);assert.equal(f.rows[0].visibility,'private');assert.equal(f.rows[0].processed_json.metadata.language,null);
  assert.equal(await f.page.locator('.original-writing').textContent(),f.rows[0].raw_text);
  await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();await f.page.locator('.mat-card').filter({hasText:'창가에서 읽는 프랑스어'}).getByRole('link').first().click();await saved(f);
 }finally{await f.context.close();}
});

test('PDF only: one item, direct original, page controls and no empty article',async()=>{
 const f=await fixture({width:390});try{
  await editor(f);await f.page.locator('input[type=file]').setInputFiles({name:'reading.pdf',mimeType:'application/pdf',buffer:bytes.pdf});
  await f.page.locator('.composer-attachment').waitFor();await f.page.getByRole('button',{name:'저장',exact:true}).click();await saved(f);
  await f.page.locator('.pdfjs-page canvas').first().waitFor();assert.equal(f.rows.length,1);assert.equal(f.rows[0].raw_text,'');assert.equal(await f.page.locator('.original-writing').count(),0);
  await noOverflow(f.page);if(screenshots)await f.page.screenshot({path:`${screenshots}/pdf-mobile.png`,fullPage:true});
  await f.page.getByRole('button',{name:'→',exact:true}).click();await f.page.locator('.pdf-nav').getByText('2 / 2',{exact:true}).waitFor();
  await f.page.reload();await f.page.locator('.pdf-nav').getByText('2 / 2',{exact:true}).waitFor();
 }finally{await f.context.close();}
});

test('EPUB plus body and link: preserves authored content; stores original; safe chapter rendering',async()=>{
 const f=await fixture();try{
  await editor(f);await f.page.locator('#composer-title').fill('내가 정한 제목');await f.page.locator('#composer-body').fill('내가 쓴 글.');
  await f.page.locator('input[type=file]').setInputFiles({name:'reading.epub',mimeType:'application/epub+zip',buffer:bytes.epub});await f.page.locator('.composer-attachment').waitFor();
  assert.equal(await f.page.locator('#composer-title').inputValue(),'내가 정한 제목');assert.equal(await f.page.locator('#composer-body').inputValue(),'내가 쓴 글.');
  await f.page.getByRole('button',{name:'↗ 링크',exact:true}).click();await f.page.locator('#composer-link').fill('https://example.org/reading');
  await f.page.getByRole('button',{name:'저장',exact:true}).click();await saved(f);await f.page.locator('.original-epub').waitFor();
  assert.equal(f.rows.length,1);assert.equal(f.objects.size,1);assert.equal(await f.page.evaluate(()=>window.EPUB_EXECUTED),undefined);
  await f.page.getByRole('combobox',{name:'목차',exact:true}).selectOption('1');await f.page.getByRole('heading',{name:'Another day',exact:true}).waitFor();
  assert.equal(await f.page.locator('.original-writing').textContent(),'내가 쓴 글.');
  if(screenshots)await f.page.screenshot({path:`${screenshots}/epub-desktop.png`,fullPage:true});
 }finally{await f.context.close();}
});

test('URL only and narrow/mobile keyboard UI: no forced language and long source safely wraps',async()=>{
 const f=await fixture({width:320});try{
  await editor(f);await f.page.getByRole('button',{name:'↗ 링크',exact:true}).click();await f.page.locator('#composer-link').fill(`https://example.org/${'long-source-'.repeat(20)}`);await f.page.locator('#composer-link').press('Enter');
  await f.page.getByRole('button',{name:'저장',exact:true}).click();await saved(f);await noOverflow(f.page);
  assert.equal(await f.page.locator('.original-links a').count(),1);assert.equal(await f.page.locator('.original-writing').count(),0);assert.equal(await f.page.locator('.original-study').count(),0);
  if(screenshots)await f.page.screenshot({path:`${screenshots}/link-mobile.png`,fullPage:true});
 }finally{await f.context.close();}
});

test('lost response -> refresh -> retry reconciles one saved original',async()=>{
 const f=await fixture();try{
  await editor(f);await f.page.locator('#composer-body').fill('Keep this exact original.');f.lose();
  await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.locator('.composer-error').waitFor();assert.equal(f.rows.length,1);
  await f.page.reload();await f.page.getByRole('button',{name:'다시 저장',exact:true}).click();await saved(f);assert.equal(f.rows.length,1);
 }finally{await f.context.close();}
});

test('second editor tab cannot overwrite first draft; new guest sees no private draft',async()=>{
 const f=await fixture();try{
  await editor(f);await f.page.locator('#composer-body').fill('한 탭의 초안');await f.page.getByText('이 기기에 초안 보관됨',{exact:true}).waitFor();
  const other=await f.context.newPage();await other.goto('/materials/add');await other.getByRole('heading',{name:'다른 탭에서 작성 중이에요.'}).waitFor();await other.close();
  await f.context.clearCookies();await f.page.reload();await f.page.getByRole('link',{name:'로그인하고 작성하기 ↗'}).waitFor();assert.equal(await f.page.locator('#composer-body').count(),0);
 }finally{await f.context.close();}
});

test('upload failure keeps authored text and creates no broken library item',async()=>{
 const f=await fixture({width:390});try{
  await editor(f);await f.page.locator('#composer-title').fill('원본과 함께 보관');await f.page.locator('#composer-body').fill('파일 오류가 나도 남을 글.');
  await f.page.locator('input[type=file]').setInputFiles({name:'reading.pdf',mimeType:'application/pdf',buffer:bytes.pdf});await f.page.locator('.composer-attachment').waitFor();f.failUpload();
  await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.locator('.composer-error').waitFor();
  assert.equal(f.rows.length,0);assert.equal(await f.page.locator('#composer-body').inputValue(),'파일 오류가 나도 남을 글.');
  await f.page.reload();assert.equal(await f.page.locator('#composer-title').inputValue(),'원본과 함께 보관');assert.equal(await f.page.locator('.composer-attachment').count(),1);await noOverflow(f.page);
 }finally{await f.context.close();}
});

test('focused editor at 390px: hidden native picker, visible save, four languages, keyboard link and no overflow',async()=>{
 const f=await fixture({width:390});try{
  await editor(f);assert.ok((await f.page.locator('input[type=file]').boundingBox()).width<=1);
  await f.page.locator('#composer-title').fill('길어도 줄이 깨지지 않는 읽기 자료 제목 '.repeat(6));await f.page.locator('#composer-body').fill('새로운 문장 하나를 남깁니다.');
  await f.page.getByText('학습 정보',{exact:false}).first().click();
  for(const language of ['Japanese','Chinese','English','French'])assert.equal(await f.page.locator(`#composer-language option[value=${language}]`).count(),1);
  await f.page.locator('#composer-language').selectOption('French');
  await f.page.getByRole('button',{name:'↗ 링크',exact:true}).click();assert.equal(await f.page.locator('#composer-link').evaluate(el=>el===document.activeElement),true);
  await f.page.locator('#composer-link').press('Escape');await noOverflow(f.page);
  if(screenshots)await f.page.screenshot({path:`${screenshots}/editor-mobile.png`,fullPage:true});
  await f.page.getByRole('button',{name:'저장',exact:true}).click();await saved(f);await noOverflow(f.page);assert.equal(f.rows[0].processed_json.metadata.language,'French');
 }finally{await f.context.close();}
});
