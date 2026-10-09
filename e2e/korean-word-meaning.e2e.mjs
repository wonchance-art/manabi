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
const output = process.env.QA_OUT || '/tmp/manabi-korean-word-meaning-qa';
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

async function fixture({ ready = true, existing = false, holdCapabilities = false, meaningResponse, meaningDelay = 0 } = {}) {
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
  const requests = [];
  await context.route('**/api/gemini', async route => {
    const prompt = route.request().postDataJSON()?.contents?.[0]?.parts?.[0]?.text || '';
    requests.push(prompt);
    if (!prompt.includes('lexicalMeaning')) {
      const reply = prompt.includes('\"translation\"') ? {translation:'去了学校。',context:'QA'}
        : {meaning:prompt.includes('natural Korean') ? '갔다' : prompt.includes('Taiwan') ? '去了（臺灣）' : '去了',morphology:[]};
      return send(route,{candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}]});
    }
    if (meaningDelay) await new Promise(resolve => setTimeout(resolve, meaningDelay));
    const input = JSON.parse(prompt.split('INPUT_JSON=').at(-1));
    const meaning = input.lemma === '학교' ? (input.locale === 'zh-TW' ? '學校' : input.locale === 'ko' ? '교육 기관' : '学校')
      : input.locale === 'ko' ? '다른 곳으로 이동하다' : input.locale === 'zh-TW' ? '前往' : '去';
    const reply = meaningResponse ? meaningResponse(input) : {lemma:input.lemma,lemmaStatus:'matched',lexicalMeaning:meaning};
    return send(route,{candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}]});
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
  return {context,page,actions,open,select,cards,contexts,writes,errors,known,exclusions,events,requests,release:()=>release?.()};
}

async function locale(page,field,value) {
  // AD-R2 Aa(#1375): 언어는 「Aa 읽기 설정」 창의 「표시」 탭 맨 아래 선택 상자 둘이다(viewer-language-settings e2e와 같은 조작).
  const labels={ko:{settings:'읽기 설정',close:'읽기 설정 닫기',display:'학습 표시',uiLocale:'화면 언어',explanationLocale:'설명 언어'},
    'zh-CN':{settings:'阅读设置',close:'关闭阅读设置',display:'学习显示',uiLocale:'界面语言',explanationLocale:'讲解语言'},
    'zh-TW':{settings:'閱讀設定',close:'關閉閱讀設定',display:'學習顯示',uiLocale:'介面語言',explanationLocale:'解說語言'}};
  let ui=await page.locator('.viewer-layout').getAttribute('data-ui-locale');
  await page.getByRole('button',{name:`Aa ${labels[ui].settings}`,exact:true}).click();
  const dialog=page.locator('dialog[open]');
  await dialog.getByRole('tab',{name:labels[ui].display,exact:true}).click();
  const box=dialog.getByRole('combobox',{name:labels[ui][field],exact:true});
  await box.focus(); await box.selectOption(value);
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
async function audit(f,name) { await writeFile(`${output}/${name}.json`,JSON.stringify({synthetic:true,liveDatabaseVerified:false,cards:f.cards,contexts:f.contexts,writes:f.writes,events:f.events,errors:f.errors,requests:f.requests,screenText:await f.page.locator('body').innerText()},null,2)); }
async function noKoreanLegacyEditor(page) {
  assert.equal(await page.locator('.word-detail-card__edit').count(),0,'Korean capability must not expose the legacy meaning/pronunciation editor');
  assert.equal(await page.locator('.token-edit').count(),0,'Korean must not mount the legacy token editor/global-promotion panel');
}

test('lexical meaning survives save, reload, review reveal and exact source return',async()=>{
  const f=await fixture();
  try {
    await f.open();
    await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText('去',{exact:true}).waitFor();
    await f.page.locator('[data-korean-context-meaning]').filter({visible:true}).getByText('去了',{exact:true}).waitFor();
    await f.actions.locator('.save-grade .review-score-btn').nth(0).click();
    await f.page.waitForFunction(()=>document.querySelector('.word-token--saved'));
    assert.equal(f.cards.length,1); assert.equal(f.cards[0].meaning,'去');
    const write=f.writes.find(w=>w.path==='/api/learning/vocabulary');
    assert.equal(write.body.word.meaningCandidate.lexicalMeaning,'去');
    assert.equal(write.body.word.meaningCandidate.locale,'zh-CN');
    assert.deepEqual(write.body.source.sourceSpan,{start:14,end:17,unit:'utf16'});
    assert.equal(write.body.initialGrade,1);
    await f.open();
    await f.page.locator('[data-korean-saved-meaning]').filter({visible:true}).getByText('去',{exact:true}).waitFor();
    assert.equal(f.requests.filter(p=>p.includes('lexicalMeaning')).length,1,'validated warm cache needs no second generation');
    await f.page.addInitScript(()=>localStorage.setItem('as_review_mode','flash'));
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    await f.page.getByRole('button',{name:'표현 1개 복습 →',exact:true}).click();
    await f.page.getByRole('heading',{name:'가다',exact:true}).waitFor();
    assert.equal(await f.page.locator('.review-card__answer').count(),0);
    await f.page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
    await f.page.locator('.review-card__meaning').waitFor();
    assert.equal((await f.page.locator('.review-card__meaning').textContent()).trim(),'去');
    assert.equal(f.events.length,0);
    await f.page.goto('/vocab',{waitUntil:'domcontentloaded'});
    await f.page.locator('.review-sec--vocab .review-sec__row').filter({hasText:'가다'}).click();
    const link=f.page.getByRole('link',{name:'이 문장 열기 ↗',exact:true}); await link.waitFor();
    await f.page.goto(await link.getAttribute('href'),{waitUntil:'domcontentloaded'});
    await f.page.locator('[data-source-token="id_1_2"].learning-source-highlight').waitFor();
    assert.equal(await f.page.locator('[data-source-token="id_0_2"].learning-source-highlight').count(),0);
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-save-review-source');}
});

test('list rows re-analyze each occurrence line in another explanation locale and the card still saves that occurrence',async()=>{
  const f=await fixture();
  const analyses=[];
  await f.context.route('**/api/analyze/korean',route=>{
    const body=route.request().postDataJSON(); analyses.push(body);
    const gloss={'학교에':{ko:'학교로','zh-CN':'到学校','zh-TW':'到學校（臺灣）'},'갔어요':{ko:'갔다','zh-CN':'去了','zh-TW':'去了（臺灣）'}};
    const results=body.lines.map((line,lineIndex)=>{
      const tokens=[...line.matchAll(/[^\s.]+|\s+|\./g)];
      const sequence=tokens.map((_,index)=>`ko_${lineIndex}_${index}`);
      const dictionary=Object.fromEntries(tokens.map((match,index)=>[sequence[index],{text:match[0],surface:match[0],meaning:gloss[match[0]]?.[body.explanationLocale]||'',
        explanationLocale:body.explanationLocale,sourceSpan:{start:match.index,end:match.index+match[0].length,unit:'utf16',lineIndex},morphology:[]}]));
      return {sequence,dictionary};
    });
    return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},json:{results,metadata:{language:'Korean',explanationLocale:body.explanationLocale}}});
  });
  await f.page.addInitScript(()=>localStorage.setItem('viewer_language:v1',JSON.stringify({version:1,uiLocale:'ko',explanationLocale:'zh-TW'})));
  const rows=()=>f.page.locator('.pdf-word-item').filter({visible:true});
  const pickSecondLine=async()=>{
    await f.page.locator('.line-pick').nth(1).click();
    await f.page.getByRole('tab',{name:'단어',exact:true}).click();
    await rows().filter({hasText:'갔어요'}).first().waitFor();
  };
  // The list stops showing its analysis notice only after any reanalysis request was settled.
  const settled=()=>f.page.waitForFunction(()=>![...document.querySelectorAll('div')].some(el=>el.textContent==='분석 중...'&&el.offsetParent));
  try {
    await f.page.goto('/viewer/98133',{waitUntil:'domcontentloaded'});
    await f.page.locator('[data-source-token="id_1_2"]').waitFor();
    await pickSecondLine();
    // Stored analysis is zh-CN; the zh-TW reader gets current-locale help for each occurrence row.
    await rows().filter({hasText:'갔어요'}).first().locator('.pdf-word-item__meaning').getByText('去了（臺灣）',{exact:true}).waitFor();
    await rows().filter({hasText:'학교에'}).first().locator('.pdf-word-item__meaning').getByText('到學校（臺灣）',{exact:true}).waitFor();
    await settled();
    // main parity: a Korean list row is reading help only; saving happens from the word card.
    assert.equal(await rows().locator('button').count(),0,'Korean list rows expose no one-click save/add/dismiss controls');
    assert.deepEqual(await rows().locator('.pdf-word-item__text').allTextContents(),['학교에','갔어요']);
    assert.deepEqual(analyses,[{lines:['학교에 갔어요.'],language:'Korean',explanationLocale:'zh-TW'}]);
    // The stored zh-CN analysis already is the current-locale help: no redundant source analysis.
    await locale(f.page,'explanationLocale','zh-CN');
    await pickSecondLine();
    await rows().filter({hasText:'갔어요'}).first().locator('.pdf-word-item__meaning').getByText('去了',{exact:true}).waitFor();
    await settled();
    assert.equal(analyses.length,1);
    assert.equal(f.writes.length,0);
    // A list row keeps its exact occurrence, so the word card saves the second sentence's source.
    await rows().filter({hasText:'갔어요'}).first().locator('.pdf-word-item__text').click();
    await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText('去',{exact:true}).waitFor();
    await f.actions.locator('.save-grade .review-score-btn').nth(0).click();
    await f.page.waitForFunction(()=>document.querySelector('.word-token--saved'));
    assert.equal(f.cards.length,1); assert.equal(f.cards[0].meaning,'去');
    const write=f.writes.find(w=>w.path==='/api/learning/vocabulary');
    assert.deepEqual(write.body.source.sourceSpan,{start:14,end:17,unit:'utf16'});
    assert.equal(write.body.word.meaningCandidate.locale,'zh-CN');
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-list-cross-locale');}
});

test('uncertain lemma retains reading help and blocks all automatic grade saves',async()=>{
  const f=await fixture({meaningResponse:()=>({lemma:'오다',lemmaStatus:'matched',lexicalMeaning:'来'})});
  try {
    await f.open();
    await f.page.getByRole('button',{name:'설명을 다시 불러오기',exact:true}).filter({visible:true}).waitFor();
    assert.equal(await f.actions.locator('.save-grade .review-score-btn:enabled').count(),0);
    for (const key of ['1','2','3','4']) await f.page.keyboard.press(key);
    assert.equal(f.writes.length,0); assert.equal(f.cards.length,0);
    await f.page.locator('[data-korean-context-meaning]').filter({visible:true}).getByText('去了',{exact:true}).waitFor();
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-uncertain');}
});

test('an earlier locale response cannot supply a later save',async()=>{
  const f=await fixture({meaningDelay:300});
  try {
    await f.open();
    await locale(f.page,'explanationLocale','zh-TW');
    await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText('前往',{exact:true}).waitFor();
    await f.actions.locator('.save-grade .review-score-btn').nth(1).click();
    await f.page.waitForFunction(()=>document.querySelector('.word-token--saved'));
    assert.equal(f.cards[0].meaning,'前往');
    assert.equal(f.writes[0].body.word.meaningCandidate.locale,'zh-TW');
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-locale-race');}
});

test('ko explanation is held: no lexical candidate is requested or shown and the main save path is unchanged',async()=>{
  const f=await fixture();
  try {
    await f.open();
    await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText('去',{exact:true}).waitFor();
    const lexical=()=>f.requests.filter(p=>p.includes('lexicalMeaning')).length, before=lexical();
    await locale(f.page,'explanationLocale','ko');
    await f.page.locator('[data-korean-context-meaning]').filter({visible:true}).getByText('갔다',{exact:true}).waitFor();
    assert.equal(await f.page.locator('[data-korean-lexical-meaning]').count(),0,'ko shows no generated lexical meaning');
    assert.equal(lexical(),before,'ko requests no lexical candidate');
    await f.actions.locator('.save-grade .review-score-btn').nth(0).click();
    await f.page.waitForFunction(()=>document.querySelector('.word-token--saved'));
    // main behavior: the current-locale contextual meaning, without a lexical envelope.
    assert.equal(f.cards.length,1); assert.equal(f.cards[0].meaning,'갔다');
    const write=f.writes.find(w=>w.path==='/api/learning/vocabulary');
    assert.ok(!Object.hasOwn(write.body.word,'meaningCandidate'),'ko save carries no lexical envelope');
    assert.deepEqual(write.body.source.sourceSpan,{start:14,end:17,unit:'utf16'});
    assert.equal(lexical(),before);
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-ko-held');}
});

test('an existing card keeps its meaning: add-context reuses it without generation or a false conflict',async()=>{
  const f=await fixture({existing:true});
  f.cards[0].next_review_at='2099-01-01T00:00:00Z';
  try {
    const before=structuredClone(f.cards), sources=structuredClone(f.contexts);
    await f.page.goto('/viewer/98133',{waitUntil:'domcontentloaded'});
    // The first occurrence is a new source for the card already saved from the second sentence.
    await f.page.locator('[data-source-token="id_0_2"]').click(); await f.actions.waitFor();
    await f.page.locator('[data-korean-saved-meaning]').filter({visible:true}).getByText('Learner edited meaning',{exact:true}).waitFor();
    assert.equal(await f.page.locator('[data-korean-lexical-meaning]').count(),0,'a saved card needs no newly generated candidate');
    await f.actions.getByRole('button',{name:'이 문맥 추가',exact:true}).click();
    await f.actions.getByText('출처와 함께 담았어요. 기존 복습 일정은 유지됩니다.',{exact:true}).waitFor();
    assert.equal(await f.actions.locator('.learning-context-confirm').count(),0,'the saved meaning raises no false meaning conflict');
    const write=f.writes.at(-1);
    assert.equal(write.body.word.meaning,'Learner edited meaning');
    assert.ok(!Object.hasOwn(write.body.word,'meaningCandidate'),'the existing meaning is not presented as a generated candidate');
    assert.ok(!Object.hasOwn(write.body,'confirmMeaning'));
    assert.deepEqual(write.body.source.sourceSpan,{start:4,end:7,unit:'utf16'});
    assert.deepEqual(f.cards,before,'meaning, schedule and history of the existing card are unchanged');
    assert.equal(f.contexts.length,sources.length+1);
    assert.equal(f.requests.filter(p=>p.includes('lexicalMeaning')).length,0);
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-existing-preservation');}
});

test('a card saved elsewhere after the page loaded still goes through the explicit meaning confirmation and keeps its meaning',async()=>{
  const f=await fixture();
  try {
    await f.open();
    await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText('去',{exact:true}).waitFor();
    // 다른 탭·기기에서 같은 기본형이 다른 뜻으로 먼저 저장됐다(이 화면의 단어장 조회 이후).
    f.cards.push({id:cardId,user_id:owner,word_text:'가다',base_form:'가다',meaning:'Another tab meaning',language:'Korean',
      interval:8,ease_factor:2.5,repetitions:4,next_review_at:'2099-01-01T00:00:00Z',last_reviewed_at:'2019-01-01T00:00:00Z',
      created_at:'2019-01-01T00:00:00Z',source_sentence:raw.slice(10),source_material_id:98133});
    const before=structuredClone(f.cards);
    await f.actions.locator('.save-grade .review-score-btn').nth(0).click();
    // 등급 저장은 뜻 충돌로 거절되고, 같은 뜻인지 묻는 단계로만 이어진다.
    await f.actions.getByRole('button',{name:'이 문맥 추가',exact:true}).click();
    const confirm=f.actions.locator('.learning-context-confirm');await confirm.waitFor();
    await confirm.getByText('Another tab meaning',{exact:true}).waitFor();await confirm.getByText('去',{exact:true}).waitFor();
    assert.deepEqual(f.cards,before,'a refused save changes nothing');assert.equal(f.contexts.length,0);
    // 취소하면 아무것도 쓰지 않는다.
    const count=f.writes.length;
    await confirm.getByRole('button',{name:'취소',exact:true}).click();await confirm.waitFor({state:'detached'});
    assert.equal(f.writes.length,count);
    // 같은 뜻이라고 확인하면 기존 카드의 뜻을 그대로 두고 문맥만 더한다(직전에 보여 준 payload 재사용, 재생성 없음).
    await f.actions.getByRole('button',{name:'이 문맥 추가',exact:true}).click();await confirm.waitFor();
    const generated=f.requests.filter(p=>p.includes('lexicalMeaning')).length;
    await confirm.getByRole('button',{name:'같은 뜻이에요 · 문맥 추가',exact:true}).click();
    // 성공하면 충돌 단추가 닫힌다(main과 같은 onSaved 동작) — 화면 문구 대신 실제 쓰기와 저장 상태로 확인한다.
    await confirm.waitFor({state:'detached'});
    await f.page.waitForFunction(()=>document.querySelector('.word-token--saved'));
    const write=f.writes.at(-1);
    assert.equal(write.body.confirmId,cardId);assert.equal(write.body.confirmMeaning,'Another tab meaning');
    assert.deepEqual(f.cards,before,'meaning, schedule and history of the card saved elsewhere are unchanged');
    assert.equal(f.contexts.length,1);assert.deepEqual(f.contexts[0].locator.sourceSpan,{start:14,end:17,unit:'utf16'});
    assert.equal(f.requests.filter(p=>p.includes('lexicalMeaning')).length,generated,'confirmation reuses the shown payload without another generation');
    assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-concurrent-conflict');}
});

test('the lexical section follows the zh explanation locale without a stale value and is absent for held ko',async()=>{
  const f=await fixture();
  const shown=async()=>(await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).locator('p').allTextContents()).map(text=>text.trim());
  try {
    await f.page.goto('/viewer/98133',{waitUntil:'domcontentloaded'});
    await f.page.locator('[data-source-token="id_1_0"]').click(); await f.actions.waitFor();
    for (const [code,value] of [['zh-CN','学校'],['zh-TW','學校']]) {
      if (code!=='zh-CN') await locale(f.page,'explanationLocale',code);
      await f.page.locator('[data-korean-lexical-meaning]').filter({visible:true}).getByText(value,{exact:true}).waitFor();
      assert.deepEqual(await shown(),[value],`${code}: only the current locale's lexical meaning is shown`);
    }
    await locale(f.page,'explanationLocale','ko');
    // The fixture's ko word explanation is '갔다' for every word; it proves the ko card finished rendering.
    await f.page.locator('[data-korean-context-meaning]').filter({visible:true}).getByText('갔다',{exact:true}).waitFor();
    assert.equal(await f.page.locator('[data-korean-lexical-meaning]').count(),0,'ko: no lexical section, no stale zh value');
    const locales=f.requests.filter(p=>p.includes('lexicalMeaning')).map(p=>JSON.parse(p.split('INPUT_JSON=').at(-1)).locale);
    assert.deepEqual(locales,['zh-CN','zh-TW'],'one lexical request per zh locale and none for ko');
    assert.equal(f.writes.length,0); assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-locale-follow');}
});

test('a reader who cannot save makes no lexical generation call',async()=>{
  const f=await fixture({ready:false});
  try {
    await f.page.goto('/viewer/98133',{waitUntil:'domcontentloaded'});
    await f.page.locator('[data-source-token="id_1_2"]').click();
    await f.page.locator('[data-korean-context-meaning]').filter({visible:true}).getByText('去了',{exact:true}).waitFor();
    assert.equal(await f.page.locator('[data-korean-lexical-meaning]').count(),0,'no lexical section without save capability');
    assert.equal(await f.page.locator('.save-grade .review-score-btn').count(),0);
    assert.equal(f.requests.filter(p=>p.includes('lexicalMeaning')).length,0,'no /api/gemini lexical call without save capability');
    assert.equal(f.writes.length,0); assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-cannot-save');}
});

test('lexical/context labels and save controls remain reachable at narrow widths and enlarged text',async()=>{
  const f=await fixture();
  try {
    for (const width of [320,390,1440]) {
      await f.page.setViewportSize({width,height:960}); await f.open();
      await f.page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
      const card=f.page.locator('.word-detail-card').filter({visible:true}).first();
      await card.locator('[data-korean-lexical-meaning]').getByText('去',{exact:true}).waitFor();
      assert.ok(await card.locator('[data-korean-context-meaning]').isVisible());
      await card.locator('[data-korean-lexical-meaning]').scrollIntoViewIfNeeded();
      await f.page.screenshot({path:`${output}/lexical-meaning-${width}-200pct.png`,fullPage:true});
      await f.actions.locator('.save-grade .review-score-btn').nth(2).scrollIntoViewIfNeeded();
      assert.ok(await f.actions.locator('.save-grade .review-score-btn').nth(2).isEnabled());
      await f.page.screenshot({path:`${output}/lexical-${width}-200pct.png`,fullPage:true});
    }
    assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);
  } finally {await finish(f,'lexical-layout');}
});
