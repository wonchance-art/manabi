// Browser requests use synthetic account/material fixtures; no personal records are changed.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.QA_BASE||'http://127.0.0.1:8899',out=process.env.QA_OUT||'/private/tmp/manabi-analysis-resume-browser';
fs.mkdirSync(out,{recursive:true});
const uid='00000000-0000-4000-8000-000000000089';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'context-fixture@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1138,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
context.setDefaultTimeout(12000);context.setDefaultNavigationTimeout(180000);
const original = () => {
 const sequence=[],dictionary={},lines=[];
 for(let line=0;line<35;line++) {
  const text=line%2?'我们散步。':'眼前有山。';lines.push(text);
  if(line!==1) {
   const id=`id_${line}_0_resume`;sequence.push(id);
   dictionary[id]={text,meaning:line===0?'직접 고친 뜻':'산책 예문',furigana:line===0?'yǎn qián yǒu shān':'wǒ men sàn bù',pos:'명사',...(line===2?{failed:true}:{})};
  }
  if(line<34){const id=`br_${line}_resume`;sequence.push(id);dictionary[id]={text:'\n',pos:'개행'};}
 }
 return {id:94051,title:'분석 복구 검수용 중국어 자료',owner_id:uid,visibility:'private',raw_text:lines.join('\n'),processed_json:{status:'analyzing',failed_indices:[2],sequence,dictionary,metadata:{language:'Chinese',updated_at:'2026-01-01',viewerCorrections:{id_0_0_resume:['meaning','furigana']}}}};
};
let material=original(),mode='success',calls=0,commits=0;
const checks=[],errors=[],writes=[];
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
await context.route(base+'/**',async r=>{
 if(new URL(r.request().url()).pathname.startsWith('/_next/static/'))return r.continue();
 try{const response=await r.fetch({headers:{...r.request().headers(),cookie:''},timeout:180000});await r.fulfill({response});}catch(e){if(!/closed|disposed/.test(e.message))throw e;}
});
await context.route('**/api/**',r=>r.fulfill({json:{}}));
await context.route('**/auth/v1/**',r=>r.fulfill({status:r.request().method()==='OPTIONS'?204:200,headers:cors,json:r.request().url().includes('/user')?user:session}));
await context.route('**/rest/v1/**',async r=>{
 const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),object=req.headers().accept?.includes('vnd.pgrst.object');
 const send=(json,status=200)=>r.fulfill({headers:cors,json,status});
 if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
 if(req.method()==='HEAD')return r.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
 if(table==='profiles')return send({id:uid,display_name:'복구 검수',role:'user',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['Chinese']});
 if(['POST','PATCH','DELETE'].includes(req.method())) {
  const body=req.postDataJSON();writes.push({table,method:req.method()});
  if(table==='viewer_replace_analysis') {
   commits++;
   if(mode==='conflict') return send({code:'40001',message:'다른 창에서 자료가 바뀌었어요.'},409);
   assert.equal(body.p_expected_raw,material.raw_text);assert.deepEqual(body.p_expected_json,material.processed_json);
   material={...material,raw_text:body.p_raw,processed_json:body.p_json};return send({material});
  }
  return send([]);
 }
 if(table==='reading_materials')return send(object?material:[material]);
 if(table==='reading_progress')return send(object?null:[]);
 return send(object?null:[]);
});
await context.route('**/api/analyze',async r=>{
 calls++;
 if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,1200));
 if(mode==='fail')return r.fulfill({status:503,json:{error:'fixture analysis unavailable'}});
 const {lines}=r.request().postDataJSON();
 try{await r.fulfill({json:{results:lines.map(text=>({sequence:['a'],dictionary:{a:{text,meaning:'새 분석 뜻',furigana:'xīn',pos:'명사'}}}))}});}catch(e){if(!/closed|disposed|Invalid Interception/.test(e.message))throw e;}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/same key|unique "key"|Hydration failed/i.test(m.text()))errors.push(m.text());});
const resume=()=>page.getByRole('button',{name:'▶ 이어서 분석',exact:true});
const token=()=>page.locator('[data-source-token="id_0_0_resume"]');
async function open(label) {await page.goto(base+'/viewer/94051?case='+label);await token().waitFor();}
async function pass(label) {assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');checks.push(label);console.log('PASS '+label);}
async function shot(label){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:out+'/'+label+'.png'});}
try {
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 for(const width of [320,390,768,1440]) {
  material=original();mode='slow';await page.setViewportSize({width,height:900});await open('width'+width);
  await page.getByText('분석이 끝나지 않은 부분이 2곳 있어요.',{exact:true}).waitFor();
  const rect=await resume().boundingBox();assert(rect.height>=44);await shot('before-'+width);
  const before=structuredClone(material.processed_json.dictionary.id_0_0_resume),start=commits;
  await resume().focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'⏹ 중단',exact:true}).waitFor();
  await shot('during-'+width);
  await page.waitForFunction(()=>!document.querySelector('.analyzing-banner'));
  assert.equal(commits,start+1);assert.deepEqual(material.processed_json.dictionary.id_0_0_resume,before);
  assert.equal(material.processed_json.sequence.length,new Set(material.processed_json.sequence).size);
  assert(!material.processed_json.failed_indices.length);await token().click();await page.getByText('직접 고친 뜻',{exact:true}).waitFor();
  await shot('after-'+width);await pass('resume preserves corrections and panel at '+width+'px');
 }
 material=original();mode='slow';await open('abort');const before=structuredClone(material),beforeCommit=commits;
 await resume().click();await page.getByRole('button',{name:'⏹ 중단',exact:true}).click();await resume().waitFor();
 await page.waitForTimeout(1500);assert.equal(commits,beforeCommit);assert.deepEqual(material,before);await pass('stop never replaces the old source');
 material=original();mode='slow';await open('read-during-recovery');await resume().click();
 const reading=page.locator('[data-source-token="id_12_0_resume"]');
 await reading.scrollIntoViewIfNeeded();const topBefore=(await reading.boundingBox()).y;
 await page.waitForFunction(()=>!document.querySelector('.analyzing-banner'));
 const topAfter=(await reading.boundingBox()).y;
 assert(Math.abs(topBefore-topAfter)<160,`reading position moved ${topAfter-topBefore}px`);await pass('reading during recovery keeps the same source near the viewport');
 for(const failure of ['fail','conflict']) {
  material=original();mode=failure;await open(failure);const snapshot=structuredClone(material);
  await resume().click();await page.getByText(/분석 실패:/).waitFor();await resume().waitFor();assert.deepEqual(material,snapshot);await pass(failure+' keeps prior source and enables retry');
 }
 material=original();mode='success';material.processed_json.status='completed';await open('completed-but-missing');await resume().click();await page.waitForFunction(()=>!document.querySelector('.analyzing-banner'));await pass('completed status with missing text offers recovery');
 material.processed_json.status='analyzing';material.processed_json.metadata.updated_at='2026-01-01';await open('status-only');const previousCalls=calls;await resume().click();await page.waitForFunction(()=>!document.querySelector('.analyzing-banner'));assert.equal(calls,previousCalls);await pass('status-only recovery makes no AI request');
 await open('source-return');assert.equal(await resume().count(),0);await pass('healthy completed material has no recovery banner');
 assert.equal(errors.length,0,JSON.stringify(errors));assert(!writes.some(w=>['user_vocabulary','review_events'].includes(w.table)));
 fs.writeFileSync(out+'/report.json',JSON.stringify({base,checks,errors,analysisCalls:calls,commits},null,2));
} finally {await browser.close();}
