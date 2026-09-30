// Run against a local production build with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:49002.
// Only this synthetic HTTP backend receives writes. No real accounts or hosted DB.
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
import { fixtureSession, revision } from './fixtures/n5-revision-backend.mjs';
const base=process.env.QA_BASE || 'http://127.0.0.1:49001';
const out=process.env.QA_OUT || '/private/tmp/manabi-n5-review-return-qa';
fs.mkdirSync(out,{recursive:true});
const old='7f572327dc67893e9453246c',uid='00000000-0000-4000-8000-000000000042';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const bundles=Object.fromEntries([old,revision].map(x=>[x,JSON.parse(fs.readFileSync(new URL(`../src/content/textbookEditions/${x}/bundle.json`,import.meta.url),'utf8'))]));
let words=[],contexts=[],scopeFail=false,scopeEmpty=false;
const writes=[],reads=[];
function word(n,text,language='Japanese'){return {id:id(n),user_id:uid,word_text:text,meaning:`뜻 ${text}`,language,furigana:'',interval:1,ease_factor:5,repetitions:1,last_reviewed_at:'2026-01-01',next_review_at:'2026-01-02',created_at:'2026-01-01'};}
function source(n,wordId,edition=revision,page='u01-start'){return {id:id(100+n),vocabulary_id:wordId,user_id:uid,kind:'textbook',lang:'Japanese',chapter_slug:'n5-book-u01',locator:{bookId:'japanese-n5',editionId:edition,pageId:page},quote:'駅は どこですか。',translation:'역은 어디인가요?',created_at:'2026-01-01'};}
function reset(){words=[word(1,'駅'),word(2,'電車'),word(3,'別の資料'),word(4,'bonjour','French')];contexts=[source(1,id(1),old),source(2,id(1)),source(3,id(2))];scopeFail=false;scopeEmpty=false;writes.length=0;reads.length=0;}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:49002'),table=url.pathname.split('/').at(-1);
 const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
 const send=(data,status=200)=>{res.writeHead(status,headers);res.end(JSON.stringify(data));};
 if(req.method==='OPTIONS'){res.writeHead(204,headers);return res.end();}
 let body=null;if(['POST','PATCH','DELETE'].includes(req.method)){let raw='';for await(const chunk of req)raw+=chunk;if(raw)body=JSON.parse(raw);writes.push({table,method:req.method,body,target:url.searchParams.get('id')?.replace('eq.','')});}
 if(table==='user')return send({id:uid,email:'n5-fixture@example.invalid',email_confirmed_at:'2026-01-01',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}});
 if(table==='is_admin')return send(false);
 if(table==='profiles')return send({id:uid,role:'learner',display_name:'학습 흐름 검수',onboarded:true,last_login_at:new Date().toISOString(),streak_count:1,learning_language:['Japanese']});
 if(table==='textbook_book_releases')return send({book_id:'japanese-n5',edition_id:revision,version:2});
 if(table==='textbook_book_editions'){
  const edition=url.searchParams.get('edition_id')?.replace('eq.',''),bundle=bundles[edition];
  return send(bundle?{book_id:'japanese-n5',edition_id:edition,content_hash:bundle.contentHash,manuscript:bundle.manuscript,artifact_manifest:bundle.artifactManifest}:null);
 }
 if(table==='user_vocabulary'){
  if(req.method==='PATCH'){const target=url.searchParams.get('id')?.replace('eq.','');words=words.map(w=>w.id===target?{...w,...body}:w);return send([]);}
  return send(words);
 }
 if(table==='save_vocabulary_context'){
  assert.equal(body.p_source.locator.bookId,'japanese-n5');assert.equal(body.p_source.locator.editionId,revision);
  const existing=words.find(w=>w.word_text===body.p_word.word_text);
  if(existing)return send({contextAdded:false,vocabularyId:existing.id});
  const added={...word(5,body.p_word.word_text),...body.p_word};words.push(added);
  contexts.push({...source(4,added.id),chapter_slug:body.p_source.chapterSlug,quote:body.p_source.quote,translation:body.p_source.translation,locator:body.p_source.locator});
  return send({contextAdded:true,vocabularyId:added.id});
 }
 if(table==='vocabulary_contexts'){
  const scoped=url.searchParams.get('locator->>bookId')==='eq.japanese-n5';
  if(scoped){
   reads.push(Object.fromEntries(url.searchParams));
   assert.equal(url.searchParams.get('user_id'),'eq.'+uid);assert.equal(url.searchParams.get('user_vocabulary.user_id'),'eq.'+uid);
   if(scopeFail)return send({message:'synthetic scope offline'},503);
   if(scopeEmpty)return send([]);
  }
  let rows=contexts;
  const wordId=url.searchParams.get('vocabulary_id')?.replace('eq.','');if(wordId)rows=rows.filter(c=>c.vocabulary_id===wordId);
  const start=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||50);
  return send(rows.slice(start,start+limit).map(c=>({...c,user_vocabulary:words.find(w=>w.id===c.vocabulary_id)})));
 }
 if(req.method==='HEAD'){res.writeHead(200,{...headers,'content-range':'*/0'});return res.end();}
 return send(req.headers.accept?.includes('vnd.pgrst.object')?null:[]);
});
await new Promise(resolve=>server.listen(49002,'127.0.0.1',resolve));
const reports=[];
try {for(const engine of (process.env.QA_ENGINE==='chromium'?[chromium]:[chromium,webkit])){
 reset();const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block',reducedMotion:'reduce'});
 context.setDefaultTimeout(20000);
 await context.addCookies([{name:'sb-127-auth-token',value:fixtureSession('learner'),url:base}]);
 const page=await context.newPage(),report={engine:engine.name(),checks:[],errors:[]};reports.push(report);
 page.on('pageerror',e=>report.errors.push(e.message));
 context.on('page',opened=>opened.on('pageerror',e=>report.errors.push(e.message)));
 const progressKey=`manabi-book-progress:${revision}:${uid}`,oldKey=`manabi-book-progress:${old}:${uid}`;
 const reading=`/books/japanese-n5?edition=${revision}#u42-message-reading`;
 async function check(label){assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=await page.evaluate(()=>innerWidth+1),label+': overflow');report.checks.push(label);console.log(engine.name()+': '+label);}
 try{
  // 실제 첫 저장 상태: 예문 전체가 한 카드이며 신·구판 출처만 두 개다.
  // 이전 검사는 flash 설정을 미리 넣어 기본 auto 모드의 빈 문장을 놓쳤다.
  const sentence='もう 本を 読みましたか。まだ 読んでいません。';
  words=[{...word(1,sentence),source_sentence:sentence,meaning:'벌써 책을 읽었어요? 아직 읽지 않았어요.',last_reviewed_at:null}];
  contexts=[source(1,id(1),old,'u42-study1'),source(2,id(1),revision,'u42-study1')];
  await page.goto(base+'/vocab?book=japanese-n5&returnTo='+encodeURIComponent(reading));
  await page.getByRole('button',{name:'표현 1개 복습 →',exact:true}).click();
  await page.getByRole('heading',{name:sentence,exact:true}).waitFor();
  await page.getByRole('button',{name:'정답 확인하기',exact:true}).waitFor();
  assert.equal(await page.getByRole('group',{name:'문맥에 맞는 뜻 고르기'}).count(),0);
  // 기존 화면은 복원한 기본 auto를 저장한다. 카드별 flash 전환이 설정을 바꾸면 안 된다.
  assert.equal(await page.evaluate(()=>localStorage.getItem('as_review_mode')),'auto');
  for(const width of [1440,320]){await page.setViewportSize({width,height:960});await check(`default first saved sentence remains visible at ${width}px`);await page.screenshot({path:`${out}/${engine.name()}-first-sentence-${width}.png`,fullPage:false});}
  assert.equal(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length,0);
  reset();await page.setViewportSize({width:1440,height:960});
  await page.goto(base+reading);await page.locator('#u42-message-reading').waitFor();await page.getByRole('link',{name:'담은 표현',exact:true}).waitFor();
  await page.evaluate(({oldKey})=>{localStorage.setItem('vocab_seriesFilter','french-old');localStorage.setItem('vocab_langFilter','French');localStorage.setItem('vocab_levelFilter','H6');localStorage.setItem('as_review_mode','flash');localStorage.setItem(oldKey,JSON.stringify({page:'u29-patterns',completed:['u01'],updatedAt:1}));},{oldKey});
  const save=page.locator('.book-example-save button').first();await save.click();await page.getByRole('status').filter({hasText:'출처와 함께 담았어요'}).waitFor();
  await save.click();await page.getByRole('status').filter({hasText:'이미 담아둔 문맥'}).waitFor();
  assert.equal(words.length,5);assert.equal(contexts.length,4);
  const answerField=page.locator('[data-save]').first();
  if(['radio','checkbox'].includes(await answerField.getAttribute('type')))await answerField.check();else await answerField.fill('합성 답안');
  const answerKey=`manabi-book-answers:${revision}:${uid}`,savedAnswer=await page.evaluate(key=>localStorage.getItem(key),answerKey);assert(savedAnswer);

  await page.getByRole('link',{name:'담은 표현',exact:true}).click();
  const reviewLink=page.getByRole('link',{name:'이 교재 표현 복습 →',exact:true});await reviewLink.waitFor();
  const scopeHref=await reviewLink.getAttribute('href'),returnTo=new URL(scopeHref,base).searchParams.get('returnTo');assert(returnTo.includes(revision));assert(returnTo.includes('#u42-'));
  const storedBefore=await page.evaluate(({progressKey,oldKey})=>[localStorage.getItem(progressKey),localStorage.getItem(oldKey)],{progressKey,oldKey});
  const beforeWords=structuredClone(words);
  // The first page contains only repeated card 1; other cards must come from the next page.
  contexts=[...Array.from({length:201},(_,n)=>({...source(n+10,id(1),n%2?old:revision),quote:`저장 문맥 ${n}`})),contexts[2],contexts[3]];
  const readCount=writes.filter(w=>w.table==='library_reading_activity').length;
  await reviewLink.click();await page.getByRole('button',{name:'표현 3개 복습 →',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'문법도 한 번 더.'}).count(),0);assert.equal(await page.getByText('bonjour',{exact:true}).count(),0);assert.equal(await page.getByText('別の資料',{exact:true}).count(),0);
  assert.deepEqual(await page.evaluate(()=>['vocab_seriesFilter','vocab_langFilter','vocab_levelFilter'].map(k=>localStorage.getItem(k))),['french-old','French','H6']);
  await check('save and duplicate protection → explicit N5 scope wins over old filters; 3 unique cards across paginated, repeated edition sources');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:960});await check(`book review entrance ${width}px`);await page.screenshot({path:`${out}/${engine.name()}-scope-${width}.png`,fullPage:true});}
  // Keyboard entry, and an actual source popup rather than a URL-only assertion.
  const start=page.getByRole('button',{name:'표현 3개 복습 →',exact:true});await start.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
  const sourceLink=page.getByRole('link',{name:'이 문장 열기 ↗',exact:true});await sourceLink.waitFor();
  const popupPromise=page.waitForEvent('popup');await sourceLink.click();const popup=await popupPromise;await popup.setViewportSize({width:320,height:960});await popup.getByRole('note').filter({hasText:'복습 원문 참고'}).waitFor();assert(popup.url().includes('reference=1'));
  await popup.locator('article[data-unit-page]').first().waitFor();await popup.locator('.book-example-save button').first().waitFor();await popup.evaluate(()=>document.fonts.ready);
  await popup.evaluate(()=>scrollBy(0,600));await popup.waitForTimeout(400);await popup.reload();await popup.getByRole('note').filter({hasText:'복습 원문 참고'}).waitFor();
  await popup.locator('article[data-unit-page]').first().waitFor();await popup.locator('.book-example-save button').first().waitFor();await popup.evaluate(()=>document.fonts.ready);await popup.evaluate(()=>scrollBy(0,450));await popup.waitForTimeout(400);
  assert.deepEqual(await popup.evaluate(({progressKey,oldKey})=>[localStorage.getItem(progressKey),localStorage.getItem(oldKey)],{progressKey,oldKey}),storedBefore);
  assert.equal(writes.filter(w=>w.table==='library_reading_activity').length,readCount);assert.equal(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length,0);assert.deepEqual(words,beforeWords);
  assert(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'reference at 320px overflows');
  await popup.screenshot({path:`${out}/${engine.name()}-reference-320.png`,fullPage:false});
  await popup.close();await page.getByRole('button',{name:/알맞음/}).waitFor();await check('source reference + scroll + reload preserve both editions’ main reading and server activity, with zero grades');
  for(let i=0;i<3;i++){
   if(i>0)await page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
   const persisted=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname==='/rest/v1/user_vocabulary');
   await page.getByRole('button',{name:/알맞음/}).click();assert.equal((await persisted).status(),200);
  }
  await page.getByRole('heading',{name:'이번 표현 복습을 마쳤어요',exact:true}).waitFor();
  assert.equal(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').length,3);
  assert.deepEqual(new Set(writes.filter(w=>w.table==='user_vocabulary'&&w.method==='PATCH').map(w=>w.target)),new Set([id(1),id(2),id(5)]));
  assert.deepEqual(words.filter(w=>[id(3),id(4)].includes(w.id)),beforeWords.filter(w=>[id(3),id(4)].includes(w.id)));
  assert.deepEqual(words.map(w=>w.meaning),beforeWords.map(w=>w.meaning));assert(reads.some(r=>r.offset==='200'));
  const doneLink=page.getByRole('link',{name:/읽던 교재로 돌아가기/}).last();assert.equal(await doneLink.getAttribute('href'),returnTo);
  await page.screenshot({path:`${out}/${engine.name()}-done-320.png`,fullPage:true});await doneLink.click();await page.locator('#'+returnTo.split('#')[1]).waitFor();assert.equal(new URL(page.url()).searchParams.get('reference'),null);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),answerKey),savedAnswer);
  await check('only the three scoped cards graded; answers preserved; completion returns to the original edition and paragraph');
  // Explicitly continuing from the reference is the only opt-in to moving the main position.
  await page.goto(base+`/books/japanese-n5?edition=${revision}&reference=1#u01-start`);await page.getByRole('link',{name:'여기부터 이어읽기 →'}).click();
  await page.waitForURL(url=>!url.searchParams.has('reference'));
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'{}').page?.startsWith('u01'),progressKey);await check('explicit continue from source changes the main reading position');
  scopeFail=true;await page.goto(base+scopeHref);await page.getByRole('heading',{name:'이 교재의 표현 범위를 불러오지 못했어요.'}).waitFor();assert.equal(await page.locator('.review-room-start').count(),0);await check('scope failure cannot start or fall back to unrelated cards');
  scopeFail=false;scopeEmpty=true;await page.getByRole('button',{name:'범위 다시 불러오기'}).click();await page.getByRole('heading',{name:'첫 표현을 담아 보세요.'}).waitFor();assert.equal(await page.locator('.review-room-start').count(),0);await check('empty book scope is distinct from failed scope and does not include global cards');
  scopeEmpty=false;await page.goto(base+'/vocab');await page.getByRole('heading',{name:'복습',exact:true}).waitFor();assert.equal(await page.locator('[aria-label="복습 범위"]').count(),0);await page.getByRole('heading',{name:'문법도 한 번 더.'}).waitFor();await check('global review remains a separate explicit destination');
  await context.clearCookies();await page.goto(base+scopeHref);await page.getByRole('link',{name:'로그인하고 이어가기 →'}).waitFor();assert.equal(await page.locator('.review-card').count(),0);await check('signed-out account cannot reuse the prior scoped queue');
  assert.deepEqual(report.errors,[]);
 }finally{await context.close();await browser.close();}
}}
finally{await new Promise(resolve=>server.close(resolve));fs.writeFileSync(out+'/report.json',JSON.stringify(reports,null,2));}
