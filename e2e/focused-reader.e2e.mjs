// Stateful HTTP fixtures exercise real page code without touching personal data or AI services.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.QA_BASE||'http://127.0.0.1:8886',out=process.env.QA_OUT||'/private/tmp/manabi-focused-reader-qa';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(180000);
const report={base,checks:[],errors:[]},uid='00000000-0000-4000-8000-000000000088';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'reading-fixture@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
let records=[],vocab=[],reads=[],contexts=[],analysisMode='fail',saveFail=false,writeFail=false,analysisCalls=0;
const writes=[];
await context.route(base+'/**',async route=>{
 if(new URL(route.request().url()).pathname.startsWith('/_next/static/'))return route.continue();
 try {const response=await route.fetch({headers:{...route.request().headers(),cookie:''},timeout:180000});await route.fulfill({response});}catch(e){if(!/closed|disposed/.test(e.message))throw e;}
});
await context.route('**/auth/v1/**',r=>r.fulfill({status:r.request().method()==='OPTIONS'?204:200,headers:cors,json:r.request().url().includes('/user')?user:session}));
await context.route('**/rest/v1/**',async r=>{
 const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),method=req.method(),object=req.headers().accept?.includes('vnd.pgrst.object');
 const send=(data,status=200)=>r.fulfill({status,headers:cors,json:data});
 if(method==='OPTIONS')return r.fulfill({status:204,headers:cors});
 if(method==='HEAD')return r.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
 if(table==='profiles')return send({id:uid,display_name:'읽기 검수',role:'user',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['Japanese']});
 if(['POST','PATCH','DELETE'].includes(method)){
  const body=req.postDataJSON();writes.push({table,method,body});
  if(table==='reading_materials'&&method==='POST'){
   if(saveFail)return send({message:'fixture storage unavailable'},503);
   const rows=(Array.isArray(body)?body:[body]).map(row=>({...row,id:92000+records.length+1,created_at:new Date().toISOString()}));records.push(...rows);return send(rows.map(row=>({id:row.id})),201);
  }
  if(table==='reading_materials'&&method==='PATCH'){
   if(writeFail)return send({message:'fixture result save unavailable'},503);
   const rows=records.filter(row=>String(row.id)===url.searchParams.get('id')?.slice(3));rows.forEach(row=>Object.assign(row,body));return send(rows.map(row=>({id:row.id})));
  }
  if(table==='reading_progress'){const row=Array.isArray(body)?body[0]:body;reads=reads.filter(r=>String(r.material_id)!==String(row.material_id));reads.push({...row,is_completed:false,updated_at:new Date().toISOString()});return send([row]);}
  if(table==='user_vocabulary'){
   if(method==='POST'){const rows=(Array.isArray(body)?body:[body]).map(row=>({...row,id:89001+vocab.length,created_at:new Date().toISOString()}));vocab.push(...rows);return send(rows);}
   const rows=vocab.filter(row=>String(row.id)===url.searchParams.get('id')?.slice(3));rows.forEach(row=>Object.assign(row,body));return send(rows);
  }
  return send([]);
 }
 if(table==='reading_materials'){
  let rows=records;
  for(const key of ['id','owner_id','visibility']){const f=url.searchParams.get(key);if(f?.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===f.slice(3));}
  const attempt=url.searchParams.get('processed_json->metadata->>importAttempt');if(attempt)rows=rows.filter(row=>row.processed_json.metadata.importAttempt===attempt.slice(3));
  const q=url.searchParams.getAll('title').find(value=>value.startsWith('ilike.'));if(q)rows=rows.filter(row=>row.title.includes(q.slice(6).replaceAll('%','')));
  if(url.searchParams.has('processed_json->metadata->book'))rows=rows.filter(row=>row.processed_json.metadata.book);
  return send(object?(rows[0]||null):rows);
 }
 if(table==='reading_progress'){
  let rows=reads.map(row=>({...row,reading_materials:records.find(m=>String(m.id)===String(row.material_id))}));
  const id=url.searchParams.get('material_id');if(id)rows=rows.filter(row=>String(row.material_id)===id.slice(3));
  return send(object?(rows[0]||null):rows);
 }
 if(table==='user_vocabulary')return send(vocab);
 return send(object?null:[]);
});
await context.route('**/api/suggestions/today',r=>r.fulfill({json:[]}));
await context.route('**/api/analyze',async r=>{
 analysisCalls++;if(analysisMode==='slow')await new Promise(resolve=>setTimeout(resolve,1800));
 if(analysisMode==='fail')return r.fulfill({status:503,json:{error:'fixture analysis unavailable'}});
 const {lines}=r.request().postDataJSON();return r.fulfill({json:{results:lines.map(line=>({sequence:['word'],dictionary:{word:{text:line,base_form:line,meaning:'읽기 검수 예문',pos:'명사'}}}))}});
});
await context.route('**/api/gemini',r=>r.fulfill({json:{text:'검수용 설명'}}));
await context.route('**/api/learning/**',r=>{
 if(r.request().method()==='POST'){
  const payload=r.request().postDataJSON();contexts.push(payload);return r.fulfill({json:{ok:true,context:{id:'context-1'},vocabulary:{id:89001}}});
 }
 return r.fulfill({json:{contexts:contexts.map((payload,i)=>({id:`source-${i}`,kind:'reading',quote:payload.source?.quote||'검수 예문',href:`/viewer/${payload.source?.materialId||records[0]?.id}?sourceToken=${encodeURIComponent(payload.source?.tokenId||records[0]?.processed_json.sequence[0]||'')}`})),links:[]}});
});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
async function check(label){await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');report.checks.push(label);console.log(label);}
async function shot(name){await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:out+'/'+name+'.png',fullPage:false});}
// Production must exercise the original early click, without waiting for Home's h1.
const prefetches=[];page.on('request',req=>{if(req.url().startsWith(base)&&req.headers()['next-router-prefetch']==='1')prefetches.push(new URL(req.url()).pathname);});
const sequence=[],dictionary={};
for(let line=0;line<38;line++){
 const words=[['今日','きょう','오늘'],['公園','こうえん','공원'],['歩きます','あるきます','걷습니다'],['。','','마침표'],['\n','','']];
 words.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]={text,furigana,meaning,base_form:text,pos:i===4?'개행':i===3?'기호':'명사'};});
}
records=[{id:94001,title:'잠깐 멈춰 읽는 하루 — 작은 문장으로 이어 가는 긴 이야기',owner_id:uid,visibility:'private',direction:'read',created_at:new Date().toISOString(),raw_text:Array(38).fill('今日、公園を歩きます。').join('\n'),processed_json:{status:'completed',sequence,dictionary,metadata:{language:'Japanese',level:'N5'}}}];
try {
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 await page.getByRole('link',{name:'자료 검색',exact:true}).click();await page.locator('#library-search').waitFor();await check('early login navigation resolves the search page, not stale Home');
 assert(!prefetches.includes('/home'),'Home must not prefetch across authentication');
 await page.goto(base+'/viewer/94001');await page.locator('.word-token').first().waitFor();assert.equal(await page.locator('main').count(),1);assert(await page.locator('.gnb__nav').isHidden());assert(await page.locator('.viewer-side--right').isHidden());assert.equal(await page.locator('.viewer-sheet-bar').count(),0);await check('reader starts without empty panels or a second main landmark');
 const menu=page.locator('.reader-site-menu summary');await menu.focus();await page.keyboard.press('Enter');await page.getByRole('navigation',{name:'읽기 화면 내비게이션'}).getByRole('link',{name:'교재',exact:true}).waitFor();await page.keyboard.press('Escape');assert(await menu.evaluate(el=>document.activeElement===el));await check('compact menu opens by keyboard and Escape restores focus');
 await shot('reader-desktop');
 const target=page.locator('[data-source-token="id_15_0"]');await target.scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 const before=await page.locator('.reader-area').boundingBox();await target.click();await page.locator('.save-grade button').first().waitFor();const after=await page.locator('.reader-area').boundingBox();assert.equal(before.width,after.width);assert.equal(before.x,after.x);await check('word tools open without moving or resizing the text column');
 const toolbar=await page.locator('.viewer-topbar').boundingBox();assert(toolbar.y>=55&&toolbar.y<70,'reading toolbar stays reachable while scrolling');
 const visible=await page.evaluate(()=>[...document.querySelectorAll('[data-source-token]')].find(el=>{const r=el.getBoundingClientRect();return r.bottom>130&&r.top<innerHeight&&r.width>0;})?.dataset.sourceToken);
 await page.getByRole('button',{name:'읽기 설정',exact:true}).click();await page.locator('dialog.rsheet[open]').waitFor();assert(await page.getByRole('button',{name:'설정 닫기'}).evaluate(el=>document.activeElement===el));
 const anchor=page.locator(`[data-source-token="${visible}"]`),anchorBefore=(await anchor.boundingBox()).y;
 const size=page.getByRole('slider',{name:'글자 크기'});await size.fill('2.15');await page.waitForTimeout(150);assert(Math.abs((await anchor.boundingBox()).y-anchorBefore)<5,`font context ${visible}: ${anchorBefore} -> ${(await anchor.boundingBox()).y}`);
 const writesBefore=writes.length;await page.getByRole('button',{name:'설정 닫기'}).focus();await page.keyboard.press('1');assert.equal(writes.length,writesBefore,'modal key must not grade the word behind it');
 // Native modal navigation may focus browser chrome (body), but never a background page control.
 await page.keyboard.press('Shift+Tab');assert(await page.locator('dialog.rsheet').evaluate(el=>document.activeElement===document.body||el.contains(document.activeElement)));await page.keyboard.press('Tab');await page.keyboard.press('Escape');await page.locator('dialog.rsheet').waitFor({state:'detached'});assert(await page.getByRole('button',{name:'읽기 설정',exact:true}).evaluate(el=>document.activeElement===el));await check('settings traps focus, protects grading shortcuts, preserves text position and closes with Escape');
 await page.locator('.save-grade button').first().click();await page.waitForFunction(()=>document.body.innerText.includes('저장됨'));assert.equal(vocab.length,1);assert.equal(String(vocab[0].source_material_id),'94001');await check('existing expression writer retains source and writes once');
 await page.getByRole('button',{name:'읽기 설정',exact:true}).click();await page.getByRole('slider',{name:'글자 크기'}).fill('1.6');await page.keyboard.press('Escape');
 for(const width of [320,390,768,1180,1440]){await page.setViewportSize({width,height:844});await check('reader controls and long title width '+width);}
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/viewer/94001');await page.locator('.word-token').first().waitFor();await shot('reader-mobile');assert(await page.locator('.mobile-nav').isHidden());assert.equal(await page.locator('.viewer-sheet-bar').count(),0);
 await page.locator('[data-source-token="id_3_1"]').click();await page.locator('.viewer-sheet').waitFor();await page.locator('.viewer-sheet .word-detail-card').waitFor();await shot('word-mobile');await page.getByRole('button',{name:'시트 닫기',exact:true}).click();await page.locator('.viewer-sheet').waitFor({state:'detached'});await check('mobile selection opens the existing word sheet and closes normally');
 await page.getByRole('button',{name:'읽기 설정',exact:true}).click();await page.locator('dialog.rsheet[open]').waitFor();await shot('settings-mobile');await page.keyboard.press('Escape');await check('mobile settings remain within viewport');
 await page.locator('.viewer-back-link').click();await page.getByRole('heading',{name:'내가 펼친 세계.',exact:true}).waitFor();assert(await page.locator('.mobile-nav').isVisible());await check('leaving the reader restores the normal five-menu shell');
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=e.message;await shot('failure').catch(()=>{});throw e;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
