// Real React screens with isolated HTTP fixtures; production data is read-only and
// may optionally be supplied from a local file. No test content is sent to the DB.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.QA_BASE || 'http://localhost:3105';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out = process.env.QA_OUT || '/private/tmp/manabi-recommendations-qa'; mkdirSync(out, { recursive: true });
const synthetic = { id: '11111111-1111-4111-8111-111111111111', date: '2026-09-11', source: 'nhk_science',
  video_id: 'nhk_cat3_digest_2026-09-11', title: '今日のニュース：毎日少しずつ読む', language: 'Japanese',
  channel_name: 'NHK ニュース', level: 'N3', transcript: '今日のニュース（NHK）\n\n【1】ことばを読む\n毎日、少しずつ読んでいます。\n\n【2】学びを続ける\n新しい表現をノートに書きます。', material_id: null };
const suggestions = process.env.QA_DATA ? JSON.parse(readFileSync(process.env.QA_DATA, 'utf8')) : [synthetic];
const item = suggestions[0];
const rows = [], errors = [], checks = [];
let failNextSave = false, failRead = false, unknown = false, inserts = 0;
const owner = '00000000-0000-4000-8000-000000000079';
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: 'chrome' }), headless: true });
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now()/1000);
const user = { id: owner, aud: 'authenticated', role: 'authenticated', email: 'suggestion-fixture@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: '검수 학습자' }, created_at: new Date().toISOString() };
const session = { access_token: `${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:owner,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})}.e2e`, refresh_token: 'fixture-refresh', expires_in:3600, expires_at:now+3600, token_type:'bearer', user };
async function surface(signed = false) {
  const context = await browser.newContext({ viewport:{width:1440,height:1000}, serviceWorkers:'block', reducedMotion:'reduce' });
  if(signed) await context.addCookies([{name:'sb-e2e-auth-token',value:`base64-${enc(session)}`,url:base,sameSite:'Lax'}]);
  const cors = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS,HEAD','access-control-expose-headers':'content-range'};
  const send=(r,json,status=200)=>r.fulfill({status,json,headers:cors});
  await context.route('**/auth/v1/**',r=>send(r,new URL(r.request().url()).pathname.endsWith('/user')?user:session));
  await context.route('**/rest/v1/**',async r=>{
    const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').at(-1);
    if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
    if(table==='profiles')return send(r,{id:owner,display_name:'검수 학습자',role:'learner',onboarded:true,learning_language:['Japanese'],last_login_at:new Date().toISOString()});
    if(table==='reading_materials'){
      if(req.method()==='POST'){
        inserts++;
        const input=req.postDataJSON(),data=Array.isArray(input)?input[0]:input;
        const existing=rows.find(row=>row.owner_id===data.owner_id&&row.processed_json.metadata.importAttempt===data.processed_json.metadata.importAttempt);
        if(existing)return send(r,{code:'23505'},409);
        rows.push({...data,id:94001+rows.length,created_at:new Date().toISOString()});
        if(failNextSave){failNextSave=false;return r.abort('failed');}
        return send(r,[{id:rows.at(-1).id}]);
      }
      const found=rows.filter(row=>[...url.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(key.includes('importAttempt')?row.processed_json.metadata.importAttempt:row[key])===value.slice(3)));
      return send(r,req.headers().accept?.includes('vnd.pgrst.object')?found[0]||null:found);
    }
    if(req.method()==='HEAD')return r.fulfill({status:200,headers:{...cors,'content-range':'*/0'}});
    return send(r,[]);
  });
  await context.route('**/api/suggestions/**',r=>{
    if(r.request().url().endsWith('/today'))return send(r,suggestions);
    if(failRead)return send(r,{error:'temporary'},503);
    if(unknown)return send(r,{error:'missing'},404);
    return send(r,suggestions.find(s=>r.request().url().includes(s.id))||item);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push({url:page.url(),message:e.message}));
  return {context,page};
}
const check=message=>{checks.push(message);console.log(message);};
try {
  const {context,page}=await surface();
  await page.goto(base+'/home');
  await page.locator('.today-story').first().click();
  await page.waitForURL('**/suggestions/**');
  await page.getByRole('heading',{name:item.title,exact:true}).waitFor();
  assert.match(page.url(),/\/suggestions\//);
  assert.equal(await page.locator('textarea,input:not([type="hidden"]),[contenteditable=true]').count(),0);
  assert.equal(rows.length,0);check('home → ready reading; no editor or write');
  const login=await page.getByRole('link',{name:'로그인하고 서재에 담기'}).getAttribute('href');
  assert.ok(new URL(login,base).searchParams.get('from').startsWith(`/suggestions/${item.id}`));
  check('guest reads immediately and login preserves the article');
  for(const width of [1440,768,390,360]){
    await page.setViewportSize({width,height:1000});
    while(await page.getByRole('button',{name:'글자 크게',exact:true}).isEnabled())await page.getByRole('button',{name:'글자 크게',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${out}/reading-${width}.png`,fullPage:true});
    check(`reading ${width}px at maximum text size: no horizontal overflow`);
  }
  if(suggestions[1]){
    await page.goto(`${base}/suggestions/${suggestions[1].id}`);
    await page.getByRole('heading',{name:suggestions[1].title,exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${out}/reading-long-title.png`,fullPage:true});
    check('long English title and article on a narrow screen');
  }
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>['A','BUTTON'].includes(document.activeElement.tagName)));
  await page.goto(`${base}/materials/add?suggestion=${item.id}`);
  await page.waitForURL('**/suggestions/**');
  await page.getByRole('heading',{name:item.title,exact:true}).waitFor();
  check('legacy new-material URL redirects to reader');
  failRead=true;await page.reload();await page.getByRole('button',{name:'다시 불러오기'}).waitFor();
  failRead=false;await page.getByRole('button',{name:'다시 불러오기'}).click();await page.getByRole('heading',{name:item.title,exact:true}).waitFor();
  unknown=true;await page.reload();await page.getByRole('heading',{name:'추천 자료를 찾을 수 없어요.'}).waitFor();unknown=false;
  check('failure retry and missing-article state');
  await context.close();
  const signed=await surface(true);const p=signed.page;
  await p.goto(`${base}/suggestions/${item.id}`);
  await p.getByRole('button',{name:'내 서재에 담기',exact:true}).waitFor();
  failNextSave=true;await p.getByRole('button',{name:'내 서재에 담기',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'서재에 담지 못했어요'}).waitFor();
  await p.getByRole('button',{name:'내 서재에 담기',exact:true}).click();
  await p.getByRole('button',{name:'✓ 서재에 담았어요',exact:true}).waitFor();
  assert.equal(rows.length,1);assert.equal(inserts,1);
  assert.equal(rows[0].raw_text,item.transcript);assert.equal(rows[0].visibility,'private');assert.equal(rows[0].owner_id,owner);
  assert.equal(rows[0].processed_json.metadata.language,item.language);
  check('lost save reply reconciled; one private original with exact text and language');
  await p.reload();await p.getByRole('button',{name:'내 서재에 담기',exact:true}).click();await p.getByRole('button',{name:'✓ 서재에 담았어요',exact:true}).waitFor();
  assert.equal(rows.length,1);assert.equal(inserts,1);
  await p.getByRole('link',{name:'단어 학습',exact:false}).click();
  await p.getByRole('button',{name:'본문 분석하기',exact:true}).waitFor();
  assert.match(p.url(),/\/viewer\/94001\?study=1/);
  check('repeat keep has no duplicate; existing word-study viewer remains available');
  await signed.context.close();
  writeFileSync(`${out}/report.json`,JSON.stringify({checks,errors,productionWrites:0,savedRows:rows.length},null,2));
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
