// Local production app with existing synthetic fixtures; no hosted account or DB.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture} from './fixtures/material-editing-backend.mjs';

const edition='8a8c1c1fd452773810abaf8c';
const old='7f572327dc67893e9453246c';
async function check(f,name){
  assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(f.errors,[]);
  if(process.env.COMPOSER_SCREENSHOTS){await mkdir(process.env.COMPOSER_SCREENSHOTS,{recursive:true});await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/${name}.png`,fullPage:false});}
}

test('direct book entry has no invented library return; real context survives cover and chapter links',async()=>{
 const f=await fixture({guest:true,width:320});try{
  for(const version of [old,edition]){
   await f.page.goto(`/books/japanese-n5?edition=${version}`,{waitUntil:'domcontentloaded',timeout:120000});
   await f.page.getByRole('link',{name:'첫 과부터 시작하기 →',exact:true}).waitFor();
   assert.equal(await f.page.getByRole('link',{name:'← 내 서재',exact:true}).count(),0);
  }
  await f.page.goto(`/books/japanese-n5?edition=${edition}&returnTo=${encodeURIComponent('https://evil.test')}`,{waitUntil:'domcontentloaded',timeout:120000});
  await f.page.getByRole('link',{name:'첫 과부터 시작하기 →',exact:true}).waitFor();assert.equal(await f.page.getByRole('link',{name:'← 내 서재',exact:true}).count(),0);
  const back='/materials?tab=public&q=school&shown=40&restoreY=520';
  await f.page.goto(`/books/japanese-n5?edition=${edition}&returnTo=${encodeURIComponent(back)}`,{waitUntil:'domcontentloaded',timeout:120000});
  const discover=f.page.getByRole('link',{name:'← 발견',exact:true});await discover.waitFor();assert.equal(await discover.getAttribute('href'),back);
  await f.page.getByRole('link',{name:'첫 과부터 시작하기 →',exact:true}).click();await f.page.locator('#u01-start').waitFor();
  assert.equal(await f.page.getByRole('link',{name:'← 발견',exact:true}).getAttribute('href'),back);
  const cover=f.page.getByRole('link',{name:'← 책 목차',exact:true});assert.equal(new URL(await cover.getAttribute('href'),f.page.url()).searchParams.get('returnTo'),back);
  await check(f,'book-context-320');await cover.click();await f.page.getByRole('link',{name:/과 이어 읽기/}).waitFor();assert.equal(await discover.getAttribute('href'),back);
 }finally{await f.context.close();}
});

test('final chapter offers review preparation for this book and exact edition, without starting a session',async()=>{
 const f=await fixture({guest:true});try{
  await f.page.goto(`/books/japanese-n5?edition=${edition}#u42-message-reading`,{waitUntil:'domcontentloaded',timeout:120000});
  const list=f.page.getByRole('link',{name:'담은 표현',exact:true});await list.waitFor();assert.match(await list.getAttribute('href'),/\/books\/japanese-n5\/review/);
  const review=f.page.getByRole('link',{name:'이 교재 표현 복습 →',exact:true});await review.waitFor();
  const url=new URL(await review.getAttribute('href'),f.page.url());assert.equal(url.pathname,'/vocab');assert.equal(url.searchParams.get('book'),'japanese-n5');
  assert.match(url.searchParams.get('returnTo'),new RegExp(`${edition}#u42-`));
  await check(f,'book-review-destination');assert.equal(f.analysisCalls,0);
 }finally{await f.context.close();}
});

test('expression language search changes only the list; review preparation retains its explicit scope',async()=>{
 const f=await fixture({width:390});try{
  const words=['駅','bonjour'].map((text,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,word_text:text,meaning:i?'안녕':'역',language:i?'French':'Japanese',interval:1,ease_factor:5,repetitions:1,next_review_at:'2026-01-02',last_reviewed_at:'2026-01-01',created_at:'2026-01-01'}));
  let writes=0;
  await f.context.route('**/rest/v1/user_vocabulary*',r=>{if(r.request().method()!=='GET')writes++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(words)});});
  await f.context.route('**/rest/v1/vocabulary_with_exclusions*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(words.map(word=>({...word,is_excluded:false})))}));
  await f.page.goto('/vocab',{waitUntil:'domcontentloaded',timeout:120000});
  const start=f.page.getByRole('button',{name:'표현 2개 복습 →',exact:true});await start.waitFor();await f.page.getByText('복습 범위 · 전체 표현',{exact:true}).waitFor();
  assert.equal(await f.page.getByRole('link',{name:'학습 통계',exact:true}).count(),0);
  await f.page.getByRole('button',{name:'전체 보기 →',exact:true}).click();await f.page.getByRole('heading',{name:'담은 표현',exact:true}).waitFor();
  await f.page.getByRole('group',{name:'표현 목록 언어'}).getByRole('button',{name:'일본어',exact:true}).click();
  await f.page.getByRole('textbox',{name:'표현 목록 검색'}).fill('駅');await f.page.getByText('역',{exact:true}).waitFor();assert.equal(await f.page.getByText('bonjour',{exact:true}).count(),0);
  await check(f,'expression-list-390');await f.page.getByRole('button',{name:'← 돌아가기',exact:true}).click();await start.waitFor();await f.page.getByText('복습 범위 · 전체 표현',{exact:true}).waitFor();
  assert.equal(writes,0);await check(f,'review-scope-390');
 }finally{await f.context.close();}
});
