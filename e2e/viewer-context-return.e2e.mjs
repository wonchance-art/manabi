// Browser requests use synthetic account/material fixtures; no personal records are changed.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.QA_BASE||'http://127.0.0.1:8897',out=process.env.QA_OUT||'/private/tmp/manabi-context-browser';
fs.mkdirSync(out,{recursive:true});
const uid='00000000-0000-4000-8000-000000000089',cid='00000000-0000-4000-8000-000000000091',vid='00000000-0000-4000-8000-000000000092';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'context-fixture@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1138,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
context.setDefaultTimeout(12000);context.setDefaultNavigationTimeout(180000);
const dictionary={},sequence=[],lines=[['眼前','有','山','。'],['眼前','有','海','。'],['周末','我们','散步','。']];
for(let row=0;row<28;row++) {
 const words=lines[row%3];
 [...words,'\n'].forEach((text,i)=>{const id=`id_${row}_${i}_context`;sequence.push(id);dictionary[id]={text,base_form:text,meaning:({眼前:'눈앞',有:'있다',山:'산',海:'바다',周末:'주말',我们:'우리',散步:'산책하다'})[text]||'',furigana:({眼前:'yǎn qián',山:'shān',海:'hǎi',周末:'zhōu mò'})[text]||'',pos:text==='\n'?'개행':text==='。'?'기호':'명사'};});
}
const material={id:94041,title:'문맥 복귀 검수용 자료',owner_id:uid,visibility:'private',created_at:new Date().toISOString(),raw_text:Array.from({length:28},(_,i)=>lines[i%3].join('')).join('\n'),processed_json:{status:'completed',sequence,dictionary,metadata:{language:'Chinese',level:'HSK6'}}};
let vocab=[],saved=[],contextFail=false,contextDelay=0,selectedContext={id:cid,kind:'reading',material_id:94041,locator:{tokenId:'id_1_0_context',surface:'眼前'},quote:'眼前有海。'};
const writes=[],checks=[],errors=[];
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
await context.route(base+'/**',async r=>{
 if(new URL(r.request().url()).pathname.startsWith('/_next/static/'))return r.continue();
 try{const response=await r.fetch({headers:{...r.request().headers(),cookie:''},timeout:180000});await r.fulfill({response});}catch(e){if(!/closed|disposed/.test(e.message))throw e;}
});
await context.route('**/api/**',r=>r.fulfill({json:{}}));
await context.route('**/auth/v1/**',r=>r.fulfill({status:r.request().method()==='OPTIONS'?204:200,headers:cors,json:r.request().url().includes('/user')?user:session}));
await context.route('**/rest/v1/**',r=>{
 const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),object=req.headers().accept?.includes('vnd.pgrst.object');
 const send=data=>r.fulfill({headers:cors,json:data});
 if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
 if(req.method()==='HEAD')return r.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
 if(table==='profiles')return send({id:uid,display_name:'문맥 검수',role:'user',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['Chinese']});
 if(['POST','PATCH','DELETE'].includes(req.method())) {
  const body=req.postDataJSON();writes.push({table,method:req.method(),body});
  if(table==='user_vocabulary'&&req.method()==='POST') {
   const rows=(Array.isArray(body)?body:[body]).filter(row=>!vocab.some(v=>v.word_text===row.word_text)).map(row=>({...row,id:vid,created_at:new Date().toISOString()}));vocab.push(...rows);return send(rows);
  }
  return send([]);
 }
 if(table==='reading_materials')return send(object?material:[material]);
 if(table==='user_vocabulary')return send(object?vocab.find(v=>v.id===url.searchParams.get('id')?.slice(3))||null:vocab);
 if(table==='morpheme_dictionary')return send(null);
 if(table==='reading_progress')return send(object?null:[]);
 if(table==='vocabulary_contexts')return send(saved);
 return send(object?null:[]);
});
await context.route('**/api/learning/vocabulary?**',async r=>{
 const url=new URL(r.request().url());
 if(url.searchParams.has('contextId')){
  if(contextDelay)await new Promise(resolve=>setTimeout(resolve,contextDelay));
  return r.fulfill({status:contextFail?404:200,json:contextFail?{error:'unavailable'}:{context:structuredClone(selectedContext)}});
 }
 return r.fulfill({json:{contexts:saved}});
});
await context.route('**/api/learning/vocabulary',r=>{
 const body=r.request().postDataJSON();
 if(body?.word){const tokenId=body.source.tokenId;const line=Number(tokenId?.split('_')[1]||0);const row={...selectedContext,locator:{tokenId,surface:dictionary[tokenId]?.text||body.source.surface},quote:lines[line%3].join(''),vocabulary_id:vid,href:`/viewer/94041?sourceContext=${cid}`};saved=[row];selectedContext=row;return r.fulfill({json:{vocabularyId:vid,contextAdded:true}});}
 return r.fulfill({json:{contexts:saved}});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const pass=name=>{checks.push(name);console.log('PASS '+name);};
const token=id=>page.locator(`[data-source-token="${id}"]`);
async function open(suffix=''){await page.goto(base+'/viewer/94041'+suffix);await token('id_0_0_context').waitFor();}
async function screenshot(name){await page.screenshot({path:out+'/'+name+'.png'});}
try {
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 await open(`?sourceContext=${cid}`);
 await token('id_1_0_context').locator('xpath=self::*[contains(@class,"learning-source-highlight")]').waitFor();
 assert.equal(await page.locator('.learning-source-highlight').count(),1);pass('saved context focuses the exact occurrence among repeated words');
 selectedContext={...selectedContext,locator:{tokenId:'stale',surface:'眼前'}};
 await open(`?sourceContext=${cid}&case=ambiguous`);
 await page.getByText('예문의 위치가 바뀌었거나 같은 표현이 여러 곳에 있어요. 저장한 문맥과 함께 확인해 주세요.',{exact:true}).waitFor();
 assert.equal(await page.locator('.learning-source-highlight').count(),0);pass('ambiguous quote never focuses an arbitrary occurrence');
 contextFail=true;await open(`?sourceContext=${cid}&case=revoked`);
 await page.getByText('이 문맥의 원문을 더 이상 열 수 없어요.',{exact:false}).waitFor();
 contextFail=false;selectedContext={...selectedContext,locator:{tokenId:'id_1_0_context',surface:'眼前'}};
 await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.locator('.learning-source-highlight').waitFor();pass('unavailable context has a recoverable error and retry');
 contextDelay=1800;
 const pending=page.waitForRequest(r=>r.url().includes('contextId='));
 await open(`?sourceContext=${cid}&case=late`);await pending;
 await token('id_0_0_context').click();await page.waitForTimeout(2200);
 assert.equal(await page.locator('.learning-source-highlight').count(),0);pass('late source response cannot override intentional word selection');
 contextDelay=0;
 for(const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:900});await open();
  await token('id_0_0_context').click();if(!await page.locator('.viewer-inspector').isVisible())await token('id_0_0_context').click();
  await page.locator('.viewer-inspector').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const panel=await page.locator('.viewer-inspector').boundingBox();assert(panel.height<=windowHeight(width));
  await screenshot('context-'+width);pass('minimal inspector remains usable at '+width+'px');
 }
 const linked=page.waitForResponse(r=>r.url().endsWith('/api/learning/vocabulary')&&r.request().method()==='POST');
 await page.locator('.save-grade .review-score-btn--again').click();await linked;
 assert.equal(vocab.length,1);assert.equal(vocab[0].meaning,'눈앞');assert.equal(vocab[0].source_sentence,'眼前有山。');assert.equal(saved.length,1);
 assert(!JSON.stringify(vocab[0]).includes('Japanese'));pass('save retains the shown meaning and original sentence');
 await page.goto(base+'/vocab');await page.getByLabel('단어장 도구',{exact:true}).click();await page.getByRole('combobox',{name:'복습 방식',exact:true}).selectOption('flash');await page.locator('.review-room-start').click();
 await page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
 await page.getByRole('link',{name:'이 문장 열기 ↗',exact:true}).waitFor();
 assert.equal(await page.locator('.review-card__source').count(),1);assert.equal(await page.getByRole('link',{name:'원문 열기 ↗',exact:true}).count(),0);
 const beforeReview=vocab[0].next_review_at;
 const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'이 문장 열기 ↗',exact:true}).click();const popup=await popupPromise;
 await popup.locator('[data-source-token="id_0_0_context"].learning-source-highlight').waitFor();
 await popup.close();assert.equal(vocab[0].next_review_at,beforeReview);assert(await page.locator('.review-card__meaning').isVisible());
 await screenshot('review-source');pass('review shows one source, opens its exact sentence, and preserves the ungraded card');
 assert.deepEqual(errors,[]);
} catch(error) {
 await screenshot('failure');fs.writeFileSync(out+'/failure.txt',await page.locator('body').innerText());throw error;
} finally {
 fs.writeFileSync(out+'/report.json',JSON.stringify({base,checks,errors,writes:writes.map(w=>({table:w.table,method:w.method}))},null,2));
 await browser.close();
}
function windowHeight(){return 900;}
