// Stateful HTTP fixtures exercise real page code without touching personal data or AI services.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.QA_BASE||'http://127.0.0.1:8883',out=process.env.QA_OUT||'/private/tmp/manabi-reading-loop-qa';
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
async function shot(name){await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:out+'/'+name+'.png',fullPage:true});}
try {
 await page.goto(base+'/materials');await page.getByRole('link',{name:'자료 검색',exact:true}).click();await page.locator('#library-search').waitFor();assert.match(page.url(),/tab=public/);assert(await page.locator('#library-search').evaluate(el=>document.activeElement===el));await check('guest search opens a focused, working public search');
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 await page.getByRole('link',{name:'자료 검색',exact:true}).click();await page.locator('#library-search').waitFor();assert.match(page.url(),/view=owned/);await check('member search opens owned materials');
 await page.goto(base+'/materials/add');await page.locator('.form-textarea').fill('あさです。\n\nひるです。\n\nよるです。');await page.locator('.form-input').first().fill('내가 가져온 하루');
 saveFail=true;await page.getByRole('button',{name:'저장하고 읽기 준비',exact:true}).click();await page.getByRole('alert').filter({hasText:'저장 오류'}).waitFor();assert.equal(await page.locator('.form-textarea').inputValue(),'あさです。\n\nひるです。\n\nよるです。');assert.equal(records.length,0);await check('save failure preserves the input and creates no row');
 saveFail=false;await page.getByRole('button',{name:'저장하고 읽기 준비',exact:true}).click();await page.getByRole('button',{name:'분석 다시 시도',exact:true}).waitFor();assert.equal(records.length,1);assert.equal(records[0].visibility,'private');assert.equal(records[0].processed_json.status,'failed');await check('analysis failure keeps one private original and exposes retry');
 await page.setViewportSize({width:390,height:844});await shot('import-failure-mobile');await check('import failure mobile 390');
 analysisMode='ok';await page.getByRole('button',{name:'분석 다시 시도',exact:true}).click();await page.getByText('원문과 읽기 도구가 준비됐어요.',{exact:true}).waitFor();assert.equal(records.length,1);assert.equal(records[0].processed_json.status,'completed');await check('retry finishes on the same material ID');
 await shot('import-ready-mobile');await page.getByRole('button',{name:'지금 바로 읽기',exact:true}).click();await page.waitForURL('**/viewer/'+records[0].id);await page.locator('.word-token').first().waitFor();await check('saved original opens with actual analysis tokens');
 await page.setViewportSize({width:1440,height:1000});await page.locator('.word-token').last().click();
 const saveGrade=page.locator('.save-grade button').first();await saveGrade.waitFor();await saveGrade.click();await page.waitForFunction(()=>document.body.innerText.includes('저장됨'));assert.equal(vocab.length,1);assert.equal(String(vocab[0].source_material_id),String(records[0].id));await check('expression save preserves its original material source');
 await page.locator('.viewer-back-link').click();await page.getByRole('heading',{name:'내가 펼친 세계.',exact:true}).waitFor();await page.waitForTimeout(250);assert(reads.some(row=>row.last_token_idx>0));await check('leaving before debounce flushes the saved token position');
 // The clock is advanced only in this fixture so the just-saved expression is due.
 vocab[0].next_review_at='2026-01-01';vocab[0].interval=1;
 await page.goto(base+'/vocab');await page.locator('.review-room-settings summary').click();await page.getByLabel('복습 방식',{exact:true}).selectOption('flash');await page.getByRole('button',{name:'단어만 1개 →',exact:true}).click();
 await page.getByRole('button',{name:'정답 확인하기',exact:true}).click();await page.locator('.learning-links summary').click();
 const gradesBefore=writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length;
 const popupEvent=page.waitForEvent('popup');await page.getByRole('link',{name:'자료 속 문장 열기 ↗',exact:true}).click();
 const popup=await popupEvent;
 try {await popup.locator('.learning-source-highlight').waitFor();} catch(error) {
   const debug=await popup.evaluate(()=>({url:location.href,text:document.body.innerText.slice(-2500),tokens:[...document.querySelectorAll('[data-source-token]')].map(el=>({id:el.dataset.sourceToken,text:el.dataset.sourceText,cls:el.className}))}));
   console.log(JSON.stringify({sourceDebug:debug,expected:contexts[0]}));await popup.screenshot({path:out+'/source-failure.png',fullPage:true});throw error;
 }
 assert.equal(await popup.locator('.learning-source-highlight').getAttribute('data-source-token'),contexts[0].source.tokenId);
 await popup.close();assert.equal(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length,gradesBefore);
 await page.getByText('읽기 검수 예문',{exact:true}).waitFor();await check('review opens the exact saved source in a separate tab without grading');
 await page.getByRole('button',{name:/알맞음/}).click();await page.waitForTimeout(300);
 assert.equal(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length,gradesBefore+1);await check('review grade reaches the existing FSRS writer once');
 // Long titles and a deep list verify the explicit in-reader return link, not only browser Back.
 const original=records[0];records=[...Array.from({length:32},(_,i)=>({...structuredClone(original),id:93000+i,title:`읽기 목록 ${String(i).padStart(2,'0')} · ${'긴 제목 '.repeat(6)}`})),original];
 await page.goto(base+'/materials?view=owned&q=읽기&shown=48');await page.locator('.mat-card').nth(27).waitFor();await page.locator('.mat-card').nth(27).scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await page.locator('.mat-card').nth(27).locator('h3 a').click();await page.locator('.viewer-back-link').waitFor();assert.match(page.url(),/returnTo=/);
 await page.locator('.viewer-back-link').click();await page.locator('.mat-card').nth(27).waitFor();await page.waitForFunction(target=>Math.abs(scrollY-target)<6,y);assert.equal(await page.locator('#library-search').inputValue(),'읽기');await check('reader back restores filters, expanded list and exact scroll');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await check('long titles and return links width '+width);}
 await page.goto(base+'/materials/add');await page.locator('.form-textarea').fill('あさです。\n\nひるです。');analysisMode='slow';await page.getByRole('button',{name:'저장하고 읽기 준비',exact:true}).click();await page.getByRole('button',{name:'분석 중단',exact:true}).waitFor();await page.getByRole('button',{name:'지금 바로 읽기',exact:true}).click();await page.locator('.viewer-back-link').waitFor();const early=records.at(-1);assert(['pending','partial'].includes(early.processed_json.status));await page.getByText(/원문은 그대로 읽을 수 있어요/).waitFor();await check('open during analysis stops the old writer and keeps raw text readable');
 analysisMode='ok';writeFail=true;await page.getByRole('button',{name:'이 챕터 분석하기',exact:true}).click();
 await page.getByText(/분석 실패: fixture result save unavailable/).waitFor();assert.equal(early.processed_json.status,'pending');await check('reader reanalysis reports persistence failure without claiming success');
 writeFail=false;await page.getByRole('button',{name:'이 챕터 분석하기',exact:true}).click();await page.locator('.word-token').first().waitFor();assert.equal(early.processed_json.status,'completed');await check('reader retries analysis on the same saved original');
 await page.goto(base+'/materials/add?direction=write');await page.locator('.form-textarea').fill('내가 직접 쓴 비공개 노트');const callsBefore=analysisCalls;await page.getByRole('button',{name:'노트 저장하기',exact:true}).click();await page.getByText('노트를 저장했어요.',{exact:true}).waitFor();assert.equal(analysisCalls,callsBefore);assert.equal(records.at(-1).direction,'write');assert.equal(records.at(-1).visibility,'private');await check('notes remain private and never invoke analysis');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/materials/add');await page.locator('.form-textarea').waitFor();await shot('import-desktop');await page.setViewportSize({width:390,height:844});await shot('import-mobile');await check('final import layout mobile');
 assert.deepEqual(report.errors,[]);
} catch(e){report.failure=e.message;await shot('failure').catch(()=>{});throw e;}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
