// Local production app with existing synthetic fixtures; no hosted account or DB.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture} from './fixtures/material-editing-backend.mjs';
import {legacyLearningSnapshot} from './fixtures/learning-snapshot.mjs';

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
  // REV-SCOPE-R1A: 도구막대 「담은 표현」은 채점 없는 목록 대신 교재 범위의 채점 복습방으로 간다(같은 범위 주소 정본).
  const review=f.page.getByRole('link',{name:'이 교재 표현 복습 →',exact:true});await review.waitFor();
  const toolbar=f.page.locator('.manabi-reader-toolbar').getByRole('link',{name:'담은 표현',exact:true});await toolbar.waitFor();
  const toolbarUrl=new URL(await toolbar.getAttribute('href'),f.page.url());assert.equal(toolbarUrl.pathname,'/vocab');
  assert.equal(toolbarUrl.searchParams.get('lang'),'Japanese');assert.equal(toolbarUrl.searchParams.get('src'),'book:japanese-n5:1-42');
  assert.match(toolbarUrl.searchParams.get('returnTo'),new RegExp(`${edition}#u42-`));
  const url=new URL(await review.getAttribute('href'),f.page.url());assert.equal(url.pathname,'/vocab');assert.equal(url.searchParams.get('src'),'book:japanese-n5:1-42');
  assert.match(url.searchParams.get('returnTo'),new RegExp(`${edition}#u42-`));
  // 과 끝 「이 과 표현 복습」 = 그 과 하나의 범위
  const lesson=f.page.getByRole('link',{name:'이 과 표현 복습 →',exact:true});await lesson.waitFor();
  const lessonUrl=new URL(await lesson.getAttribute('href'),f.page.url());assert.equal(lessonUrl.searchParams.get('src'),'book:japanese-n5:42-42');assert.equal(lessonUrl.searchParams.get('lang'),'Japanese');
  await check(f,'book-review-destination');assert.equal(f.analysisCalls,0);
 }finally{await f.context.close();}
});

test('language is the first review scope axis: list chips, count and start follow one scope; search stays list-only',async()=>{
 const f=await fixture({width:390});try{
  const words=['駅','bonjour'].map((text,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,word_text:text,meaning:i?'안녕':'역',language:i?'French':'Japanese',interval:1,ease_factor:5,repetitions:1,next_review_at:'2026-01-02',last_reviewed_at:'2026-01-01',created_at:'2026-01-01'}));
  let writes=0;
  await f.context.route('**/rest/v1/user_vocabulary*',r=>{if(r.request().method()!=='GET')writes++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(words)});});
  await f.context.route('**/rest/v1/vocabulary_with_exclusions*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(words.map(word=>({...word,is_excluded:false})))}));
  await f.context.route('**/api/learning/vocabulary**',r=>{
   const url=new URL(r.request().url());
   if(url.searchParams.get('view')!=='learning')return r.fallback();
   assert.equal(r.request().method(),'GET','The expression list snapshot must be read only');
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(legacyLearningSnapshot({actorId:'00000000-0000-4000-8000-000000000172',rows:words,known:[],exclusions:[],fields:url.searchParams.get('fields')}))});
  });
  await f.page.goto('/vocab',{waitUntil:'domcontentloaded',timeout:120000});
  // 언어 칩 숫자 = 그 언어만의 오늘 개수 · 시작 버튼 숫자 = 지금 범위(일본어)의 줄 길이 — 다른 언어는 섞이지 않는다.
  const languages=f.page.getByRole('group',{name:'복습 언어'});
  await languages.getByRole('button',{name:'일본어 1',exact:true}).waitFor();assert.equal(await languages.getByRole('button',{name:'일본어 1',exact:true}).getAttribute('aria-pressed'),'true');
  await languages.getByRole('button',{name:'프랑스어 1',exact:true}).waitFor();
  const start=f.page.getByRole('button',{name:'표현 1개 복습 →',exact:true});await start.waitFor();
  assert.equal(await f.page.getByRole('link',{name:'학습 통계',exact:true}).count(),0);
  await f.page.getByRole('button',{name:'전체 보기 →',exact:true}).click();await f.page.getByRole('heading',{name:'담은 표현',exact:true}).waitFor();
  await f.page.getByText('역',{exact:true}).waitFor();assert.equal(await f.page.getByText('bonjour',{exact:true}).count(),0);
  await f.page.getByRole('group',{name:'표현 목록 언어'}).getByRole('button',{name:'프랑스어',exact:true}).click();
  await f.page.getByRole('textbox',{name:'표현 목록 검색'}).fill('bon');await f.page.getByText('안녕',{exact:true}).waitFor();assert.equal(await f.page.getByText('역',{exact:true}).count(),0);
  await check(f,'expression-list-390');await f.page.getByRole('button',{name:'← 돌아가기',exact:true}).click();await start.waitFor();
  assert.equal(await languages.getByRole('button',{name:'프랑스어 1',exact:true}).getAttribute('aria-pressed'),'true');
  // 명시 주소가 없는 복습방이라 고른 범위를 저장한다(명시 범위는 저장 설정을 덮지 않는다 — n5 범위 검사).
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('vocab_reviewScope')),'lang=French');
  assert.equal(writes,0);await check(f,'review-scope-390');
  // 범위 시트(설계 §5-2)도 390px에서 가로로 넘치지 않고, Esc로 닫히며 초점이 돌아간다.
  const add=f.page.getByRole('button',{name:'＋ 범위',exact:true});await add.click();
  const sheet=f.page.getByRole('dialog',{name:'범위 고르기 · 프랑스어'});await sheet.waitFor();
  await sheet.getByRole('group',{name:'급수'}).count();await sheet.getByText('급수는 중국어만 고를 수 있어요. 일본어 N급은 준비 중이에요.',{exact:true}).waitFor();
  await check(f,'review-scope-sheet-390');
  await f.page.keyboard.press('Escape');await sheet.waitFor({state:'detached'});assert.equal(await add.evaluate(node=>node===document.activeElement),true);
  // 명시 주소로 들어와 범위를 바꾸면 주소도 같은 범위가 되고, 새로고침해도 그 범위가 남는다 — 저장 설정은 그대로(M09 6152793665).
  await f.page.goto('/vocab?lang=French',{waitUntil:'domcontentloaded',timeout:120000});
  await languages.getByRole('button',{name:'일본어 1',exact:true}).click();
  await f.page.waitForURL(url=>url.pathname==='/vocab'&&url.search==='?lang=Japanese');
  await f.page.reload({waitUntil:'domcontentloaded'});
  await languages.getByRole('button',{name:'일본어 1',exact:true}).waitFor();assert.equal(await languages.getByRole('button',{name:'일본어 1',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('vocab_reviewScope')),'lang=French');
 }finally{await f.context.close();}
});

// REV-SCOPE-R1B-1: 한 줄(두 엔진 공통 카드) · 앞면 읽기 없음 · 뒷면 뜻 + 읽기 · 처음 보는 표현 · 이어 하기(새로고침) · 끝 화면 ·
// 집중 연습(일정 무변경, 연습 기록만) · 뜻 없는 표현 제외 — 390px 가로 넘침 0.
test('review session: one line, card faces, first-seen card, resume after reload, end screen and focus practice at 390px',async()=>{
 const f=await fixture({width:390});try{
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const base={language:'Japanese',ease_factor:5,repetitions:1,created_at:'2026-01-01',last_reviewed_at:'2026-01-01'};
  const words=[
   {...base,id:id(11),word_text:'駅',furigana:'えき',meaning:'역',interval:1,next_review_at:'2026-01-02'},
   {...base,id:id(12),word_text:'学校',furigana:'がっこう',meaning:'학교',interval:3,next_review_at:'2026-01-03'},
   {...base,id:id(13),word_text:'電車',furigana:'でんしゃ',meaning:'전철',interval:0,repetitions:0,last_reviewed_at:null,next_review_at:'2026-01-01'},
   {...base,id:id(14),word_text:'ノート',furigana:'',meaning:'',interval:0,repetitions:0,last_reviewed_at:null,next_review_at:'2026-01-01'},
  ];
  const patches=[],events=[];
  const until=async(cond,label)=>{for(let i=0;i<100&&!cond();i++)await f.page.waitForTimeout(100);assert.ok(cond(),label);};
  await f.context.route('**/rest/v1/user_vocabulary*',r=>{if(r.request().method()!=='GET')patches.push(r.request().postDataJSON());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r.request().method()==='GET'?words:[])});});
  await f.context.route('**/rest/v1/vocabulary_with_exclusions*',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(words.map(word=>({...word,is_excluded:false})))}));
  await f.context.route('**/rest/v1/review_events*',r=>{if(r.request().method()==='POST'){const body=r.request().postDataJSON();events.push(...(Array.isArray(body)?body:[body]));}return r.fulfill({status:201,contentType:'application/json',body:'[]'});});
  await f.context.route('**/api/learning/vocabulary**',r=>{
   const url=new URL(r.request().url());
   if(url.searchParams.get('view')!=='learning')return r.fallback();
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(legacyLearningSnapshot({actorId:'00000000-0000-4000-8000-000000000172',rows:words,known:[],exclusions:[],fields:url.searchParams.get('fields')}))});
  });
  await f.page.goto('/vocab?lang=Japanese',{waitUntil:'domcontentloaded',timeout:120000});
  // 뜻 없는 표현은 줄에서 빠진다 — 보이는 개수 = 시작하는 줄 길이 = 3.
  const start=f.page.getByRole('button',{name:'표현 3개 복습 →',exact:true});await start.waitFor();
  await f.page.getByText('뜻이 없는 표현 1개는 복습에서 빠져요.',{exact:false}).waitFor();
  await f.page.getByRole('button',{name:'집중 연습',exact:true}).waitFor();
  await check(f,'r1b-room-390');
  await start.click();
  const count=f.page.locator('.review-topbar__count');await f.page.waitForFunction(()=>document.querySelector('.review-topbar__count')?.textContent.trim()==='0 / 3');
  // 앞면: 글자만 — 읽기 · 뜻 없음, 채점 막대는 잠김.
  await f.page.getByRole('heading',{name:'駅',exact:true}).waitFor();
  assert.equal(await f.page.getByText('역',{exact:true}).count(),0);assert.equal(await f.page.locator('.review-card__word rt').count(),0);
  assert.equal(await f.page.locator('.review-score-btn--good').isDisabled(),true);
  await check(f,'r1b-card-front-390');
  // Space = 뒷면: 뜻 + 한자 위 후리가나 + 발음 판정 문구.
  await f.page.keyboard.press('Space');await f.page.getByText('역',{exact:true}).waitFor();
  assert.equal((await f.page.locator('.review-card__word rt').textContent()).trim(),'えき');
  await f.page.getByText('뜻이나 발음 중 하나라도 막혔다면 다시',{exact:false}).waitFor();
  await check(f,'r1b-card-back-390');
  await f.page.setViewportSize({width:1440,height:1000});await check(f,'r1b-card-back-1440');await f.page.setViewportSize({width:390,height:1000});
  await f.page.locator('.review-score-btn--good').click();
  await f.page.getByRole('heading',{name:'学校',exact:true}).waitFor();assert.equal((await count.textContent()).trim(),'1 / 3');
  await until(()=>patches.length===1,'first grade persisted');
  // 새로고침 → 「멈춘 복습 이어 하기 (1 / 3)」(세션 저장소). 이미 끝낸 카드는 다시 나오지 않는다.
  await f.page.reload({waitUntil:'domcontentloaded'});
  const resume=f.page.getByRole('button',{name:'멈춘 복습 이어 하기 (1 / 3) →',exact:true});await resume.waitFor();await resume.click();
  await f.page.getByRole('heading',{name:'学校',exact:true}).waitFor();assert.equal((await count.textContent()).trim(),'1 / 3');
  await f.page.keyboard.press('Space');await f.page.getByText('학교',{exact:true}).waitFor();await f.page.locator('.review-score-btn--good').click();
  // 새 표현의 첫 등장 = 채점 없는 「처음 보는 표현」, 넘기면 같은 세션에서 다시 묻는다(예전 일정 = 세션 내 재질문).
  await f.page.getByText('처음 보는 표현',{exact:true}).waitFor();await f.page.getByText('전철',{exact:true}).waitFor();
  await until(()=>patches.length===2,'second grade persisted');await check(f,'r1b-first-seen-390');
  await f.page.getByRole('button',{name:'다음 →',exact:true}).click();
  await f.page.getByRole('heading',{name:'電車',exact:true}).waitFor();assert.equal(await f.page.getByText('전철',{exact:true}).count(),0);
  await f.page.keyboard.press('Space');await f.page.getByText('전철',{exact:true}).waitFor();await f.page.locator('.review-score-btn--hard').click();
  await f.page.getByRole('heading',{name:'오늘 몫 끝',exact:true}).waitFor();await f.page.getByText('3개',{exact:true}).waitFor();
  await until(()=>patches.length===3,'re-asked new card graded once');await check(f,'r1b-end-390');
  await f.page.setViewportSize({width:1440,height:1000});await check(f,'r1b-end-1440');await f.page.setViewportSize({width:390,height:1000});
  // 집중 연습: 일정 · 한도 0회, 연습 기록(source practice, item_key = 단어 id, word_id 없음)만.
  await f.page.getByRole('button',{name:'목록으로',exact:true}).click();await f.page.getByRole('button',{name:'집중 연습',exact:true}).click();
  await f.page.getByText('집중 연습 · 일정은 바뀌지 않아요',{exact:true}).waitFor();await f.page.getByRole('group',{name:'연습 방식'}).waitFor();
  await check(f,'r1b-practice-390');
  await f.page.setViewportSize({width:1440,height:1000});await check(f,'r1b-practice-1440');await f.page.setViewportSize({width:390,height:1000});
  await f.page.keyboard.press('Space');await f.page.getByRole('button',{name:/몰랐어요/}).click();
  await until(()=>events.some(e=>e.source==='practice'),'practice record sent');
  const practice=events.find(e=>e.source==='practice');assert.ok(practice,'practice record');
  assert.equal(practice.correct,false);assert.deepEqual(Object.keys(practice.detail).sort(),['qtype','result','scope']);assert.equal(practice.detail.result,'unknown');
  assert.ok(words.some(word=>word.id===practice.item_key));assert.equal(patches.length,3,'focus practice never writes a schedule');
 }finally{await f.context.close();}
});
