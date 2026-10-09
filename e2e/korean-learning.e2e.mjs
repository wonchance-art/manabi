// Synthetic browser integration only. The integration owner supplies an isolated production
// server; this suite never starts a server or establishes live DB/account readiness.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import config from '../playwright.config.mjs';
import { legacyLearningSnapshot, inactiveLearningAdmission, inactiveFsrsStatus } from './fixtures/learning-snapshot.mjs';
const base = process.env.QA_BASE;
assert.ok(base, 'QA_BASE must identify the integration owner\'s isolated app server');
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.QA_OUT || '/tmp/manabi-korean-learning-qa';
const owner = '00000000-0000-4000-8000-000000000172';
const cardId = '10000000-0000-4000-8000-000000000133';
const contextId = '20000000-0000-4000-8000-000000000133';
const exclusionId = '30000000-0000-4000-8000-000000000133';
const raw = '학교에 갔어요.\r\n학교에 갔어요.';
const material = { id: 98133, owner_id: owner, visibility: 'private', title: 'Korean integrated fixture', raw_text: raw,
  created_at: '2026-10-01T00:00:00Z', processed_json: { status: 'completed', metadata: { language: 'Korean', explanationLocale: 'zh-CN' },
    sequence: ['id_0_0','id_0_1','id_0_2','id_0_3','id_0_4','id_1_0','id_1_1','id_1_2','id_1_3'], dictionary: {
      id_0_0: { text: '학교에', base_form: '학교', meaning: '到学校', pos: '명사', sourceSpan: {start:0,end:3,unit:'utf16'} },
      id_0_1: { text: ' ', pos: '공백', sourceSpan: {start:3,end:4,unit:'utf16'} },
      id_0_2: { text: '갔어요', base_form: '가다', meaning: '去了', pos: '동사', sourceSpan: {start:4,end:7,unit:'utf16'} },
      id_0_3: { text: '.', pos: '기호', sourceSpan: {start:7,end:8,unit:'utf16'} },
      id_0_4: { text: '\r\n', pos: '개행', sourceSpan: {start:8,end:10,unit:'utf16'} },
      id_1_0: { text: '학교에', base_form: '학교', meaning: '到学校', pos: '명사', sourceSpan: {start:10,end:13,unit:'utf16'} },
      id_1_1: { text: ' ', pos: '공백', sourceSpan: {start:13,end:14,unit:'utf16'} },
      id_1_2: { text: '갔어요', base_form: '가다', meaning: '去了', pos: '동사', sourceSpan: {start:14,end:17,unit:'utf16'} },
      id_1_3: { text: '.', pos: '기호', sourceSpan: {start:17,end:18,unit:'utf16'} },
    } } };
const cors = { 'access-control-allow-origin':'*', 'access-control-allow-headers':'*', 'access-control-allow-methods':'*', 'access-control-expose-headers':'content-range' };
let browser;
before(async () => { await mkdir(output,{recursive:true}); browser = await chromium.launch(config.use.launchOptions); });
after(async () => { await browser?.close(); });

async function fixture({ ready = true, existing = false, holdCapabilities = false } = {}) {
  const context = await browser.newContext({ baseURL:base, viewport:{width:1280,height:960}, serviceWorkers:'block', reducedMotion:'reduce' });
  const writes = [], errors = [], contexts = [], exclusions = [], known = [], events = [];
  const cards = existing ? [{id:cardId,user_id:owner,word_text:'가다',base_form:'가다',meaning:'Learner edited meaning',language:'Korean',
    interval:8,ease_factor:2.5,repetitions:4,next_review_at:'2020-01-01T00:00:00Z',last_reviewed_at:'2019-01-01T00:00:00Z',
    created_at:'2019-01-01T00:00:00Z',source_sentence:raw.slice(10),source_material_id:98133}] : [];
  if (existing) contexts.push({id:contextId,kind:'reading',lang:'Korean',material_id:98133,
    locator:{version:1,sourceRevision:'reading-source:v2:'+createHash('sha256').update(JSON.stringify(['raw-utf16-v1',raw])).digest('hex'),
      sourceSpan:{start:14,end:17,unit:'utf16'},quoteSpan:{start:10,end:18,unit:'utf16'},surface:'갔어요'},quote:raw.slice(10),href:`/viewer/98133?sourceContext=${contextId}`});
  const now = Math.floor(Date.now()/1000), encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const user = {id:owner,aud:'authenticated',role:'authenticated',email:'korean-synthetic@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],email_confirmed_at:'2026-01-01T00:00:00Z'};
  const session = {user,access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:owner,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
  const send = (route,data,status=200) => route.fulfill({status,headers:cors,json:data});
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  // Authentication is synthetic in the browser; page/RSC requests do not forward fixture credentials.
  await context.route(base+'/**', async route => {
    if (new URL(route.request().url()).pathname.startsWith('/_next/static/')) return route.continue();
    const response = await route.fetch({headers:{...route.request().headers(),cookie:''}});
    await route.fulfill({response});
  });
  await context.route('**/auth/v1/**', route => send(route,new URL(route.request().url()).pathname.endsWith('/user')?user:session));
  let release;
  const waiting = holdCapabilities ? new Promise(resolve => { release = resolve; }) : null;
  await context.route('**/api/learning/capabilities', async route => {
    if (waiting) await waiting;
    return send(route,{version:1,languages:{Korean:{save:ready,review:ready,known:ready,exclude:ready}}});
  });
  await context.route('**/api/**', route => send(route,{}));
  // Playwright routes run in reverse registration order; restore the capability handler.
  await context.route('**/api/learning/capabilities', async route => {
    if (waiting) await waiting;
    return send(route,{version:1,languages:{Korean:{save:ready,review:ready,known:ready,exclude:ready}}});
  });
  // 한국어 저장 ready/blocked와 별개인 설치 완료·비활성 FSRS 계약.
  await context.route('**/api/learning/fsrs', route => {
    assert.equal(route.request().method(),'GET','Inactive FSRS fixture must not receive a mutation');
    return send(route,inactiveFsrsStatus({actorId:owner}));
  });
  await context.route('**/api/learning/admission', route => {
    assert.equal(route.request().method(),'GET','Inactive admission fixture must not receive a mutation');
    return send(route,inactiveLearningAdmission({actorId:owner}));
  });
  await context.route('**/api/gemini', route => {
    const prompt = route.request().postDataJSON()?.contents?.[0]?.parts?.[0]?.text || '';
    if (prompt.includes('lexicalMeaning')) {
      const input = JSON.parse(prompt.split('INPUT_JSON=').at(-1));
      const lexicalMeaning = input.locale === 'ko' ? '다른 곳으로 이동하다' : input.locale === 'zh-TW' ? '前往' : '去';
      return send(route,{candidates:[{content:{parts:[{text:JSON.stringify({lemma:input.lemma,lemmaStatus:'matched',lexicalMeaning})}]}}]});
    }
    const meaning = prompt.includes('Taiwan Traditional') ? '去了（台灣）' : prompt.includes('mainland Simplified') ? '去了' : '가다의 뜻';
    return send(route,{candidates:[{content:{parts:[{text:JSON.stringify({meaning,morphology:[]})}]}}]});
  });
  const activeCards = () => cards.map(card => ({...card,is_excluded:exclusions.some(e=>e.word_text===card.word_text)}));
  await context.route('**/api/learning/exclusions', route => {
    if (route.request().method()==='GET') return send(route,{items:exclusions});
    const body = route.request().postDataJSON(); writes.push({path:'/api/learning/exclusions',body});
    const entry = exclusions.find(e=>e.id===body.exclusionId);
    if (!entry) return send(route,{error:'missing exclusion'},404);
    exclusions.splice(0,exclusions.length); known.splice(0,known.length);
    return send(route,{excluded:false,entry});
  });
  await context.route('**/api/learning/vocabulary**', route => {
    const request=route.request(), url=new URL(request.url());
    if(request.method()==='GET'&&url.searchParams.get('view')==='learning')return send(route,legacyLearningSnapshot({actorId:owner,rows:cards,known,exclusions,fields:url.searchParams.get('fields')}));
    if(request.method()==='GET') return send(route,url.searchParams.has('contextId')?{context:contexts.find(c=>c.id===url.searchParams.get('contextId'))}:{contexts});
    const body=request.postDataJSON();
    assert.notEqual(body?.action,'save','Inactive FSRS fixture must not receive an atomic manual save');
    writes.push({path:'/api/learning/vocabulary',body});
    if(!ready) return send(route,{error:'storage unavailable'},503);
    const existingCard=cards.find(card=>card.word_text===body.word.word_text);
    if(existingCard && existingCard.meaning!==body.word.meaning && !(body.confirmId===existingCard.id && body.confirmMeaning===existingCard.meaning)) {
      return send(route,{code:'meaning_conflict',error:'같은 뜻인지 확인해 주세요.',existing:{id:existingCard.id,meaning:existingCard.meaning},incomingMeaning:body.word.meaning},409);
    }
    if(!existingCard) cards.push({id:cardId,user_id:owner,word_text:body.word.word_text,base_form:body.word.base_form,language:'Korean',meaning:body.word.meaning,
      interval:0,ease_factor:2.5,repetitions:0,next_review_at:'2020-01-01T00:00:00Z',last_reviewed_at:null,created_at:new Date().toISOString(),source_sentence:body.source.quote,source_material_id:98133});
    const source=body.source, locator={version:1,sourceRevision:source.sourceRevision,sourceSpan:source.sourceSpan,quoteSpan:source.quoteSpan,surface:source.surface};
    const added=!contexts.some(c=>JSON.stringify(c.locator)===JSON.stringify(locator));
    if(added) contexts.push({id:contextId,kind:'reading',lang:'Korean',material_id:98133,locator,quote:source.quote,href:`/viewer/98133?sourceContext=${contextId}`});
    return send(route,{vocabularyId:cardId,created:!existingCard,contextAdded:added,vocabulary:{...cards[0]}});
  });
  await context.route('**/rest/v1/**', route => {
    const request=route.request(),url=new URL(request.url()),table=url.pathname.split('/').pop(),method=request.method();
    const object=request.headers().accept?.includes('vnd.pgrst.object');
    if(method==='OPTIONS') return route.fulfill({status:204,headers:cors});
    if(url.pathname.endsWith('/rpc/fsrs_legacy_boundary')&&method==='POST') return send(route,{version:1,actorId:owner,enrolled:false});
    if(method==='HEAD') return route.fulfill({status:200,headers:{...cors,'content-range':'*/0'}});
    if(['POST','PATCH','DELETE'].includes(method)) {
      const body=method==='DELETE'?null:request.postDataJSON();
      if(['user_vocabulary','review_events','user_known_words'].includes(table)) writes.push({table,method,body});
      if(table==='user_known_words') {
        if(method==='POST') { known.push(body); exclusions.push({id:exclusionId,language:'Korean',word_text:body.word_text,vocabulary_id:cardId,known_word_keys:[body.word_text]}); }
        else { known.splice(0,known.length); exclusions.splice(0,exclusions.length); }
      }
      if(table==='user_vocabulary' && method==='PATCH') Object.assign(cards[0],body);
      if(table==='review_events') events.push(...(Array.isArray(body)?body:[body]));
      return send(route,table==='user_vocabulary'?cards:[]);
    }
    if(table==='profiles') return send(route,{id:owner,display_name:'Synthetic',role:'user',onboarded:true,last_login_at:new Date().toISOString(),streak_count:1});
    if(table==='reading_materials') return send(route,object?material:[material]);
    if(table==='user_known_words') return send(route,known);
    if(table==='vocabulary_exclusions') return send(route,exclusions);
    if(['user_vocabulary','vocabulary_with_exclusions'].includes(table)) return send(route,activeCards());
    if(table==='active_vocabulary') return send(route,activeCards().filter(card=>!card.is_excluded));
    if(table==='review_events') return send(route,events);
    return send(route,object?null:[]);
  });
  const project=new URL(config.webServer.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  await context.addCookies([{name:`sb-${project}-auth-token`,value:`base64-${encode(session)}`,url:base,sameSite:'Lax'}]);
  await context.addInitScript(() => localStorage.setItem('viewer_language:v1',JSON.stringify({version:1,uiLocale:'ko',explanationLocale:'zh-CN'})));
  const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
  const actions=page.locator('.reader-card-actions').filter({visible:true}).first();
  async function select() { await page.locator('[data-source-token="id_1_2"]').click(); await actions.waitFor(); }
  async function open() { await page.goto('/viewer/98133',{waitUntil:'domcontentloaded'});await page.locator('[data-source-token="id_1_2"]').waitFor();await select(); }
  return {context,page,actions,open,select,cards,contexts,writes,errors,known,exclusions,events,release:()=>release?.()};
}

async function locale(page,field,value) {
  const labels={ko:{settings:'읽기 설정',close:'읽기 설정 닫기',uiLocale:'화면 언어',explanationLocale:'설명 언어',display:'학습 표시'},
    'zh-CN':{settings:'阅读设置',close:'关闭阅读设置',uiLocale:'界面语言',explanationLocale:'讲解语言',display:'学习显示'},
    'zh-TW':{settings:'閱讀設定',close:'關閉閱讀設定',uiLocale:'介面語言',explanationLocale:'解說語言',display:'學習顯示'}};
  let ui=await page.locator('.viewer-layout').getAttribute('data-ui-locale');
  await page.getByRole('button',{name:`Aa ${labels[ui].settings}`,exact:true}).click();
  // AD-R2 Aa(정본 §5 Aa): 언어는 「표시」 탭 맨 아래 선택 상자다. 선택지 표기는 「한국어 · 简体中文 · 繁體中文」.
  await page.getByRole('tab',{name:labels[ui].display,exact:true}).click();
  const box=page.getByRole('combobox',{name:labels[ui][field],exact:true});
  assert.deepEqual(await box.locator('option').allTextContents(),['한국어','简体中文','繁體中文']);
  await box.selectOption(value);
  if(field==='uiLocale') ui=value;
  await page.getByRole('button',{name:labels[ui].close,exact:true}).click();
  await page.locator(`[data-${field==='uiLocale'?'ui-locale':'explanation-locale'}="${value}"]`).waitFor();
}

async function finish(f,name) {
  await audit(f,name);
  await f.page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  // Stop client retries before removing synthetic API routes.
  await f.context.route('**/*',route=>route.abort());
  await Promise.all(f.context.pages().map(page=>page.close()));
  await f.context.unrouteAll({behavior:'ignoreErrors'});
  await f.context.close();
}
async function audit(f,name) { await writeFile(`${output}/${name}.json`,JSON.stringify({synthetic:true,liveDatabaseVerified:false,cards:f.cards,contexts:f.contexts,writes:f.writes,events:f.events,errors:f.errors},null,2)); }
async function noKoreanLegacyEditor(page) {
  assert.equal(await page.locator('.word-detail-card__edit').count(),0,'Korean capability must not expose the legacy meaning/pronunciation editor');
  assert.equal(await page.locator('.token-edit').count(),0,'Korean must not mount the legacy token editor/global-promotion panel');
}

test('Korean controls stay blocked before readiness and for an unavailable storage contract',async()=>{
  const f=await fixture({ready:false,existing:true,holdCapabilities:true});
  try {
    await f.open();
    assert.equal(await f.actions.locator('.review-score-btn:enabled').count(),0);
    for(const key of ['1','2','3','4']) await f.page.keyboard.press(key);
    assert.equal(f.writes.length,0);
    f.release();
    const before=structuredClone(f.cards), sources=structuredClone(f.contexts);
    await f.page.goto(`/viewer/98133?sourceContext=${contextId}`,{waitUntil:'domcontentloaded'});
    await f.page.locator('[data-source-token="id_1_2"].learning-source-highlight').waitFor();
    assert.equal(await f.page.locator('[data-source-token="id_0_2"].learning-source-highlight').count(),0);
    await f.select();
    assert.equal(await f.actions.locator('.review-score-btn:enabled').count(),0);
    for(const key of ['1','2','3','4']) await f.page.keyboard.press(key);
    assert.equal(f.writes.length,0);assert.deepEqual(f.cards,before);assert.deepEqual(f.contexts,sources);
    assert.equal(f.events.length,0,'unavailable review capability preserves saved schedule/events');
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    await f.page.locator('summary[aria-label="단어장 도구"]').click();
    await f.page.getByRole('button',{name:'단어 직접 추가',exact:true}).click();
    assert.equal(await f.page.getByRole('button',{name:'Korean',exact:true}).count(),0);
    assert.equal(f.writes.length,0); await audit(f,'not-ready'); assert.deepEqual(f.errors,[]);
  } finally { f.release();await finish(f,'not-ready'); }
});

test('Korean atomic save, known/exclusion restore, locale conflict, due review and exact source return',async()=>{
  const f=await fixture();
  try {
    await f.open(); await f.actions.locator('.review-score-btn').first().waitFor({state:'visible'});
    await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText('去',{exact:true}).waitFor();
    assert(await f.actions.locator('.review-score-btn').first().isEnabled(),'verified Korean atomic save stays available');
    await noKoreanLegacyEditor(f.page);
    await f.actions.locator('.review-score-btn').first().click();
    await f.page.waitForFunction(()=>document.querySelector('.word-token--saved'));
    assert.equal(f.cards.length,1);assert.equal(f.cards[0].word_text,'가다');assert.equal(f.cards[0].meaning,'去');
    const first=f.writes.find(write=>write.path==='/api/learning/vocabulary');
    assert.equal(first.body.initialGrade,1);assert.equal(first.body.source.surface,'갔어요');
    assert.deepEqual(first.body.source.sourceSpan,{start:14,end:17,unit:'utf16'});
    assert.equal(first.body.source.quote,raw.slice(10));assert.equal(f.contexts.length,1);
    assert.ok(!Object.hasOwn(f.contexts[0].locator,'tokenId'));
    assert.equal(f.cards[0].last_reviewed_at,null,'saving a fresh card does not invent a first review');
    assert.equal(await f.actions.locator('.save-grade--inline').count(),0,'fresh cards enter their first question through the review session');
    const saved=structuredClone(f.cards), source=structuredClone(f.contexts);
    await f.actions.getByRole('button',{name:'아는 단어',exact:true}).click();
    await f.actions.getByRole('button',{name:'✓ 아는 단어',exact:true}).waitFor();
    assert.equal(f.known[0].lang,'ko');assert.equal(f.exclusions[0].language,'Korean');
    for(const key of ['1','2','3','4']) await f.page.keyboard.press(key);
    assert.deepEqual(f.cards,saved);assert.deepEqual(f.contexts,source);assert.equal(f.events.length,0);
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    const known=f.page.locator('.vocabulary-known-words').filter({visible:true}).first();
    await known.locator('summary').click();await known.getByRole('button',{name:'표시 해제',exact:true}).click();
    await known.waitFor({state:'detached'});assert.equal(f.exclusions.length,0);assert.deepEqual(f.cards,saved);
    f.cards[0].next_review_at='2099-01-01T00:00:00Z';saved[0].next_review_at=f.cards[0].next_review_at;
    await f.open(); const count=f.writes.length;
    await locale(f.page,'uiLocale','zh-TW');await locale(f.page,'explanationLocale','zh-TW');
    await f.page.locator('.word-detail-card__meaning').filter({visible:true}).first().getByText('去了（台灣）',{exact:true}).waitFor();
    await noKoreanLegacyEditor(f.page);
    assert.equal(f.writes.length,count);assert.deepEqual(f.cards,saved);assert.deepEqual(f.contexts,source);
    // The saved card's meaning is reused for add-context: no regenerated candidate, so no false locale conflict.
    await f.actions.locator('.learning-context-save button').first().click();
    await f.actions.locator('.learning-context-save').getByText('이미 담아둔 문맥이에요.',{exact:true}).waitFor();
    assert.equal(await f.actions.locator('.learning-context-confirm').count(),0,'an existing card meaning raises no locale conflict');
    assert.deepEqual(f.cards,saved);assert.deepEqual(f.contexts,source);
    assert.equal(f.writes.at(-1).body.word.meaning,'去');assert.ok(!Object.hasOwn(f.writes.at(-1).body,'confirmMeaning'));
    // Use the same saved card's canonical review path; save did not create a review event.
    f.cards[0].next_review_at='2020-01-01T00:00:00Z';await f.open();
    assert.equal(f.cards[0].last_reviewed_at,null);assert.equal(f.events.length,0);
    assert.equal(await f.actions.locator('.save-grade--inline').count(),0,'a past due date alone cannot make a fresh card eligible for inline review');
    const previousDue=f.cards[0].next_review_at;
    await f.page.addInitScript(()=>localStorage.setItem('as_review_mode','flash'));
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    await f.page.getByRole('button',{name:'표현 1개 복습 →',exact:true}).click();
    await f.page.getByRole('heading',{name:'가다',exact:true}).waitFor();
    assert.equal(await f.page.locator('.review-card__answer').count(),0,'first question keeps its answer hidden until reveal');
    await f.page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
    await f.page.locator('.review-card__meaning').waitFor();
    assert.equal((await f.page.locator('.review-card__meaning').textContent()).trim(),'去');
    const scored=f.page.waitForResponse(response=>response.url().includes('/rest/v1/user_vocabulary')&&response.request().method()==='PATCH');
    await f.page.locator('.review-score-btn--good').click();
    const committed=await scored;assert.equal(committed.status(),200);
    await f.page.getByRole('heading',{name:'이번 표현 복습을 마쳤어요',exact:true}).waitFor();
    assert.ok(Number.isFinite(Date.parse(f.cards[0].last_reviewed_at)),'only the committed grade records the first review');
    assert.equal(committed.request().postDataJSON().last_reviewed_at,f.cards[0].last_reviewed_at);
    assert.notEqual(f.cards[0].next_review_at,previousDue);
    await f.open();
    await f.page.waitForFunction(()=>!document.querySelector('.word-token--due'));
    assert.equal(f.cards[0].id,cardId);assert.equal(f.cards[0].meaning,'去');assert.equal(f.cards[0].source_sentence,raw.slice(10));
    assert.ok(f.events.some(event=>event.lang==='Korean'&&event.detail?.word_id===cardId));
    assert.ok(f.writes.every(write=>write.table!=='user_vocabulary'||write.method==='PATCH'));
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    await f.page.locator('.review-sec--vocab .review-sec__row').filter({hasText:'가다'}).click();
    const sourceLink=f.page.getByRole('link',{name:'이 문장 열기 ↗',exact:true});await sourceLink.waitFor();
    const href=await sourceLink.getAttribute('href');assert.ok(href.includes(`sourceContext=${contextId}`));assert.ok(!href.includes(encodeURIComponent('갔어요')));
    await f.page.goto(href,{waitUntil:'domcontentloaded'});
    await f.page.locator('[data-source-token="id_1_2"].learning-source-highlight').waitFor();
    assert.equal(await f.page.locator('[data-source-token="id_0_2"].learning-source-highlight').count(),0);
    assert.deepEqual(f.contexts,source);await audit(f,'integrated-ready');assert.deepEqual(f.errors,[]);
  } finally { await finish(f,'integrated-ready'); }
});


test('Verified Korean due queue reviews the existing edited card without resaving it',async()=>{
  const f=await fixture({existing:true});
  try {
    const before=structuredClone(f.cards[0]), sources=structuredClone(f.contexts);
    await f.page.addInitScript(()=>localStorage.setItem('as_review_mode','flash'));
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    await f.page.getByRole('button',{name:'표현 1개 복습 →',exact:true}).click();
    await f.page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
    const scored=f.page.waitForResponse(response=>response.url().includes('/rest/v1/user_vocabulary')&&response.request().method()==='PATCH');
    await f.page.locator('.review-score-btn--good').click();await scored;
    await f.page.getByRole('heading',{name:'이번 표현 복습을 마쳤어요',exact:true}).waitFor();
    assert.equal(f.cards[0].id,before.id);assert.equal(f.cards[0].meaning,before.meaning);
    assert.equal(f.cards[0].source_sentence,before.source_sentence);assert.equal(f.cards[0].source_material_id,before.source_material_id);
    assert.notEqual(f.cards[0].next_review_at,before.next_review_at);assert.deepEqual(f.contexts,sources);
    assert.ok(f.events.some(event=>event.lang==='Korean'&&event.detail?.word_id===cardId));
    assert.equal(f.writes.filter(write=>write.path==='/api/learning/vocabulary').length,0);
    assert.ok(f.writes.every(write=>write.table!=='user_vocabulary'||write.method==='PATCH'));
    await audit(f,'existing-due-queue');assert.deepEqual(f.errors,[]);
  } finally { await finish(f,'existing-due-queue'); }
});
