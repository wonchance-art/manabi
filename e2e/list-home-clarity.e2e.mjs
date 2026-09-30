// Local synthetic accounts only. Verify destinations and state distinctions, not copy counts.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture} from './fixtures/material-editing-backend.mjs';

const edition='8a8c1c1fd452773810abaf8c';
async function capture(f,name){
 assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(f.errors,[]);
 console.info(JSON.stringify({screen:name,...await f.page.evaluate(()=>({width:innerWidth,jsHeapBytes:performance.memory?.usedJSHeapSize??null}))}));
 if(process.env.COMPOSER_SCREENSHOTS){await mkdir(process.env.COMPOSER_SCREENSHOTS,{recursive:true});await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/${name}.png`,fullPage:false});}
}
const go=(f,path)=>f.page.goto(path,{waitUntil:'domcontentloaded',timeout:120000});

test('new guest can start the published book and use its tools without two identical first-lesson actions',async()=>{
 const f=await fixture({guest:true,width:320});try{
  await go(f,'/home');await f.page.getByRole('heading',{name:'오늘',exact:true}).waitFor();
  const start=f.page.getByRole('link',{name:'첫 페이지 열기',exact:true});await start.waitFor();
  assert.match(await start.getAttribute('href'),new RegExp(`${edition}#u01-start`));await capture(f,'home-new-320');
  await go(f,'/lessons');await f.page.getByRole('link',{name:'공부 시작하기 →',exact:true}).waitFor();
  await f.page.getByRole('button',{name:'영어',exact:true}).click();
  const reading=f.page.getByRole('link',{name:'이 언어의 공개 읽을거리',exact:true});await reading.waitFor();assert.match(await reading.getAttribute('href'),/lang=English/);
  await capture(f,'books-unpublished-320');await go(f,`/books/japanese-n5?edition=${edition}`);
  await f.page.getByRole('link',{name:'첫 과부터 시작하기 →',exact:true}).waitFor();
  assert.equal(await f.page.getByRole('link',{name:'01과 처음부터',exact:true}).count(),0);
  assert.equal(await f.page.getByRole('link',{name:'담은 표현',exact:true}).count(),1);
  await f.page.getByText('교재 안내',{exact:true}).click();await f.page.getByText(`판본 ${edition.slice(0,8)} · 42과`,{exact:true}).waitFor();
  await capture(f,'book-tools-new-320');assert.equal(f.analysisCalls,0);
 }finally{await f.context.close();}
});

test('returning reader keeps exact edition/page and can restart only when that is a different destination',async()=>{
 const f=await fixture({guest:true,width:390});try{
  await f.context.addInitScript(({edition})=>localStorage.setItem(`manabi-book-progress:${edition}:guest`,JSON.stringify({page:'u42-message-reading',completed:['u01'],updatedAt:new Date().toISOString()})),{edition});
  await go(f,'/home');const next=f.page.getByRole('link',{name:'이어서 읽기',exact:true});await next.waitFor();
  assert.match(await next.getAttribute('href'),new RegExp(`${edition}#u42-message-reading`));await capture(f,'home-returning-390');
  await go(f,`/books/japanese-n5?edition=${edition}`);
  const resume=f.page.getByRole('link',{name:'42과 이어 읽기 →',exact:true});await resume.waitFor();
  assert.match(await resume.getAttribute('href'),/#u42-message-reading$/);
  assert.match(await f.page.getByRole('link',{name:'42과 처음부터',exact:true}).getAttribute('href'),/#u42-start$/);
  await capture(f,'book-tools-returning-390');await resume.click();await f.page.locator('#u42-message-reading').waitFor();
  await f.page.getByRole('link',{name:'← 책 목차',exact:true}).click();await resume.waitFor();assert.match(await resume.getAttribute('href'),/#u42-message-reading$/);
 }finally{await f.context.close();}
});

test('home separates no expressions, not-yet-due expressions, due work and failed data with retry',async()=>{
 const f=await fixture({width:1280});try{
  let state='empty',writes=0;
  await f.context.route('**/rest/v1/user_vocabulary*',r=>{
   const req=r.request();if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes++;
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,HEAD,OPTIONS','access-control-expose-headers':'content-range'};
   if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
   if(state==='error')return r.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({message:'fixture unavailable'})});
   if(req.method()==='HEAD')return r.fulfill({status:200,headers:{...headers,'content-range':`*/${state==='due'?1:0}`}});
   return r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(state==='empty'?[]:[{word_text:'駅',language:'Japanese',interval:1,last_reviewed_at:null}])});
  });
  for(const [value,message] of [['empty','예문 아래 ‘예문 담기’로 시작하세요.'],['scheduled','지금 복습할 표현은 없어요.'],['due','복습할 표현이 있어요. 오늘 분량은 복습에서 확인하세요.']]){
   state=value;await go(f,'/home');await f.page.locator('.today-review').getByText(message,{exact:true}).waitFor();
   assert.equal(await f.page.locator('.today-review').getByRole('link',{name:'복습',exact:true}).getAttribute('href'),'/vocab');
   await capture(f,`home-${value}-1280`);
  }
  state='error';await go(f,'/home');await f.page.getByRole('button',{name:'다시 불러오기',exact:true}).waitFor({timeout:30000});await capture(f,'home-error-1280');
  state='scheduled';await f.page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await f.page.getByText('지금 복습할 표현은 없어요.',{exact:true}).waitFor();
  assert.equal(writes,0);
 }finally{await f.context.close();}
});

test('discovery retains language destinations, search reset, source labels and browser return',async()=>{
 const f=await fixture({guest:true,width:390});try{
  await go(f,'/discover');await f.page.getByRole('heading',{name:'발견',exact:true}).waitFor();
  assert.match(await f.page.locator('.discovery-language-links').getByRole('link',{name:'일본어',exact:true}).getAttribute('href'),/lang=Japanese/);
  await f.page.getByRole('searchbox',{name:'제목·소개 검색'}).fill('존재하지않는자료xyz');await f.page.getByRole('button',{name:'찾기',exact:true}).click();
  await f.page.getByText('이 조합의 글은 아직 없어요.',{exact:true}).waitFor();await capture(f,'discover-empty-390');
  await f.page.getByRole('button',{name:'전체 글 보기 →',exact:true}).click();await f.page.locator('.discovery-reading-item').first().waitFor();
  const item=f.page.locator('.discovery-reading-item').first();const href=await item.getAttribute('href');assert.ok(await item.locator('.discovery-reading-item__source').innerText());
  await item.scrollIntoViewIfNeeded();await capture(f,'discover-list-390');await item.click();await f.page.waitForURL(url=>url.pathname===href);await f.page.goBack();await item.waitFor();
  assert.equal(new URL(f.page.url()).searchParams.get('q'),null);await capture(f,'discover-return-390');assert.equal(f.analysisCalls,0);
  await go(f,'/materials');await f.page.getByRole('heading',{name:'내 서재',exact:true}).waitFor();
  assert.equal(await f.page.locator('.shelf-guest').getByRole('link',{name:'로그인',exact:true}).getAttribute('href'),'/auth?from=/materials');await capture(f,'library-guest-390');
 }finally{await f.context.close();}
});
