// Isolated member fixtures; no real account, backend mutations or production bypass.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.QA_BASE || 'http://localhost:8881';
const out = process.env.QA_OUT || '/private/tmp/manabi-review-qa';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
context.setDefaultTimeout(60000); context.setDefaultNavigationTimeout(180000);
const report = { base, checks: [], errors: [] };
const uid = '00000000-0000-4000-8000-000000000088';
const user = { id: uid, aud:'authenticated', role:'authenticated', email:'review-fixture@example.com', email_confirmed_at:new Date().toISOString(), app_metadata:{provider:'email'}, user_metadata:{}, identities:[] };
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const now = Math.floor(Date.now()/1000);
const session = {user, access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const cors = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
let state='due', grammarFail=false;
let rows = [
 {id:88001,user_id:uid,word_text:'きっかけ',meaning:'계기',language:'Japanese',furigana:'',source_ref:'일본어 · N5',source_sentence:'日本語を学ぶきっかけは何ですか。',source_material_id:91001,interval:1,ease_factor:5,repetitions:0,last_reviewed_at:'2026-01-01',next_review_at:'2026-01-02',created_at:'2026-01-01'},
 {id:88002,user_id:uid,word_text:'大切にする',meaning:'소중히 여기다',language:'Japanese',furigana:'たいせつにする',interval:1,ease_factor:5,repetitions:0,last_reviewed_at:'2026-01-01',next_review_at:'2026-01-02',created_at:'2026-01-01'},
];
const writes=[];
await context.route(base+'/**',async route=>{
 if (new URL(route.request().url()).pathname.startsWith('/_next/static/')) return route.continue();
 try {const response=await route.fetch({headers:{...route.request().headers(),cookie:''},timeout:180000});await route.fulfill({response});}catch(error){if(!/closed|disposed/.test(error.message))throw error;}
});
await context.route('**/auth/v1/**',route=>route.fulfill({status:route.request().method()==='OPTIONS'?204:200,headers:cors,json:route.request().url().includes('/user')?user:session}));
await context.route('**/rest/v1/**',async route=>{
 const req=route.request(), url=new URL(req.url()), table=url.pathname.split('/').pop(), method=req.method();
 if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(table==='profiles')return route.fulfill({headers:cors,json:{id:uid,display_name:'복습 검수',role:'user',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['Japanese']}});
 if(method==='HEAD')return route.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
 if(['POST','PATCH','DELETE'].includes(method)){
  const body=req.postDataJSON(); writes.push({table,method,body});
  if(table==='user_vocabulary'&&method==='PATCH') {const id=Number(url.searchParams.get('id')?.replace('eq.','')); rows=rows.map(r=>r.id===id?{...r,...body}:r);}
  return route.fulfill({headers:cors,json:[]});
 }
 if((table==='user_vocabulary'&&state==='error')||(table==='grammar_review'&&grammarFail))return route.fulfill({status:503,headers:cors,json:{message:'fixture offline'}});
 if(table==='user_vocabulary')return route.fulfill({headers:cors,json:state==='empty'?[]:state==='done'?rows.map(r=>({...r,next_review_at:'2099-01-01'})):rows});
 if(table==='grammar_review')return route.fulfill({headers:cors,json:state==='due'?[{next_review_at:'2026-01-02'}]:[]});
 if(table==='reading_materials')return route.fulfill({headers:cors,json:[{id:91001,title:'읽다가 기억한 문장'}]});
 return route.fulfill({headers:cors,json:[]});
});
await context.route('**/api/learning/vocabulary?*',route=>route.fulfill({json:{contexts:[{id:'source-1',kind:'textbook',quote:'日本語を学ぶきっかけは何ですか。',translation:'일본어를 배우는 계기가 무엇인가요?',href:'/books/japanese-n5#u29-patterns'}]}}));
await context.route('**/api/suggestions/today',route=>route.fulfill({json:[]}));
await context.addInitScript(()=>{localStorage.setItem('as_review_mode','flash');});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
async function check(label) { await page.evaluate(()=>document.fonts.ready); const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})); assert(size.scroll<=size.width+1,`${label}: overflow ${JSON.stringify(size)}`);report.checks.push(label); console.log(label); }
try {
 await page.goto(base+'/vocab');
 await page.getByRole('link',{name:'로그인하고 단어장 쓰기',exact:true}).waitFor();
 await check('guest has working review and login destinations');
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 await page.goto(base+'/vocab');await page.getByRole('button',{name:'단어만 2개 →',exact:true}).waitFor();
 assert.equal((await page.locator('.vocab-hero__num').innerText()).trim(),'2');
 await page.getByRole('link',{name:'문법만 1개 →',exact:true}).waitFor();
 await check('separate vocabulary and grammar counts');
 await page.screenshot({path:out+'/review-desktop.png',fullPage:true});
 for(const width of [320,390,768,1440]) {await page.setViewportSize({width,height:950});await check('entrance width '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/review-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'단어만 2개 →',exact:true}).click();await page.getByRole('button',{name:'정답 확인하기',exact:true}).waitFor();
 assert.equal(await page.getByText('계기',{exact:true}).count(),0,'answer must be hidden');
 await check('flash recall hides answer');
 await page.getByRole('button',{name:'← 나가기',exact:true}).click();await page.getByRole('button',{name:/멈춘 복습 이어가기/}).click();await page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
 await page.getByText('계기',{exact:true}).waitFor();
 await page.locator('.learning-links summary').click();
 assert.equal(await page.getByRole('button',{name:'이 문맥만 지우기',exact:true}).count(),0);
 const link=page.getByRole('link',{name:'교재 예문 열기 ↗',exact:true});await link.waitFor();assert.equal(await link.getAttribute('target'),'_blank');
 const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;assert(popup.url().includes('/books/japanese-n5'));await popup.close();
 assert.equal(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length,0,'source navigation must not grade');
 await page.getByText('계기',{exact:true}).waitFor();await check('source opens separately; same card and answer retained without grading');
 await page.screenshot({path:out+'/answer-mobile.png',fullPage:true});
 await page.getByRole('button',{name:/알맞음/}).click();await page.getByRole('heading',{name:'大切にする',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.review-topbar__count')?.textContent.trim()==='1 / 2');
 await page.waitForTimeout(500);
 const grades=writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH');assert.equal(grades.length,1);for(const key of ['interval','ease_factor','repetitions','next_review_at'])assert(key in grades[0].body);
 await check('one grade reaches canonical FSRS payload and advances once');
 await page.keyboard.press('Meta+z');await page.getByRole('heading',{name:'きっかけ',exact:true}).waitFor();await check('keyboard undo restores prior card');
 state='done';await page.goto(base+'/vocab');await page.getByRole('heading',{name:'잠시, 읽기로 돌아가요.',exact:true}).waitFor();await check('completed state keeps return to reading');
 state='empty';await page.reload();await page.getByRole('heading',{name:'첫 표현을 담아 보세요.',exact:true}).waitFor();await check('first-expression state distinct from completed');
 await page.screenshot({path:out+'/empty-mobile.png',fullPage:true});
 // Clear this fixture's offline snapshot: exercise genuine request failure, not valid offline recovery.
 state='error';await page.evaluate(async()=>{for(const db of await indexedDB.databases())indexedDB.deleteDatabase(db.name);});await page.reload();
 await page.getByRole('heading',{name:'표현을 불러오지 못했어요.',exact:true}).waitFor();await check('failure is not an empty/completed state');
 state='empty';await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await page.getByRole('heading',{name:'첫 표현을 담아 보세요.',exact:true}).waitFor();await check('retry recovers');
 grammarFail=true;await page.reload();await page.getByRole('alert').filter({hasText:'문법 일정을 불러오지 못했어요.'}).waitFor();await check('independent grammar failure');
 assert.deepEqual(report.errors,[]);
} finally {fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
