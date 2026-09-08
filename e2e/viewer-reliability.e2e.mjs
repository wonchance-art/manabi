// Stateful HTTP fixtures exercise real page code without touching personal data or AI services.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.QA_BASE||'http://127.0.0.1:8897',out=process.env.QA_OUT||'/private/tmp/manabi-viewer-reliability-qa';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
context.setDefaultTimeout(12000);context.setDefaultNavigationTimeout(180000);
const report={base,checks:[],errors:[]},uid='00000000-0000-4000-8000-000000000088';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'reading-fixture@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
let records=[],vocab=[],reads=[],contexts=[],analysisMode='fail',saveFail=false,writeFail=false,analysisCalls=0;
const writes=[];
await context.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
await context.route(base+'/**',async route=>{
 if(new URL(route.request().url()).pathname.startsWith('/_next/static/'))return route.continue();
 try {const response=await route.fetch({headers:{...route.request().headers(),cookie:''},timeout:180000});await route.fulfill({response});}catch(e){if(!/closed|disposed/.test(e.message))throw e;}
});
await context.route('**/api/**', r=>r.fulfill({json:{}}));
await context.route('**/auth/v1/**',r=>r.fulfill({status:r.request().method()==='OPTIONS'?204:200,headers:cors,json:r.request().url().includes('/user')?user:session}));
await context.route('**/rest/v1/**',async r=>{
 const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),method=req.method(),object=req.headers().accept?.includes('vnd.pgrst.object');
 const send=(data,status=200)=>r.fulfill({status,headers:cors,json:data});
 if(method==='OPTIONS')return r.fulfill({status:204,headers:cors});
 if(method==='HEAD')return r.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
 if(table==='profiles')return send({id:uid,display_name:'읽기 검수',role:'user',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['Chinese']});
 if(['POST','PATCH','DELETE'].includes(method)){
  const body=req.postDataJSON();writes.push({table,method,body});
  if(table==='viewer_undo_vocabulary_save'){
   const row=vocab.find(v=>v.id===body.p_id);
   if(!row||JSON.stringify(row)!==JSON.stringify(body.p_expected)) return send({code:'40001',message:'이후 학습이나 수정이 있어 취소하지 않았어요.'},409);
   vocab=vocab.filter(v=>v.id!==body.p_id);contexts=contexts.filter(c=>c.vocabulary_id!==body.p_id);return send(true);
  }
  if(table==='viewer_replace_analysis'){
   const row=records.find(v=>String(v.id)===String(body.p_id));
   if(writeFail||row.raw_text!==body.p_expected_raw||JSON.stringify(row.processed_json)!==JSON.stringify(body.p_expected_json))return send({code:'40001',message:'다른 창에서 자료가 바뀌었어요.'},409);
   Object.assign(row,{raw_text:body.p_raw,processed_json:body.p_json});return send({material:row});
  }
  if(table==='reading_materials'&&method==='POST'){
   if(saveFail)return send({message:'fixture storage unavailable'},503);
   const rows=(Array.isArray(body)?body:[body]).map(row=>({...row,id:92000+records.length+1,created_at:new Date().toISOString()}));records.push(...rows);return send(rows.map(row=>({id:row.id})),201);
  }
  if(table==='reading_materials'&&method==='PATCH'){
   if(writeFail)return send({message:'fixture result save unavailable'},503);
   const rows=records.filter(row=>String(row.id)===url.searchParams.get('id')?.slice(3));rows.forEach(row=>Object.assign(row,body));return send(rows.map(row=>({id:row.id})));
  }
  if(table==='reading_progress'){const row=Array.isArray(body)?body[0]:body;reads=reads.filter(r=>String(r.material_id)!==String(row.material_id));reads.push({...row,is_completed:false,updated_at:new Date().toISOString()});return send([row]);}
  if(table==='user_vocabulary'){
   if(method==='POST'){const rows=(Array.isArray(body)?body:[body]).map(row=>({...row,id:89001+vocab.length,created_at:new Date().toISOString()}));vocab.push(...rows);return send(rows);}
   const rows=vocab.filter(row=>String(row.id)===url.searchParams.get('id')?.slice(3));rows.forEach(row=>Object.assign(row,body));return send(rows);
  }
  return send([]);
 }
 if(table==='reading_materials'){
  let rows=records;
  for(const key of ['id','owner_id','visibility']){const f=url.searchParams.get(key);if(f?.startsWith('eq.'))rows=rows.filter(row=>String(row[key])===f.slice(3));}
  const attempt=url.searchParams.get('processed_json->metadata->>importAttempt');if(attempt)rows=rows.filter(row=>row.processed_json.metadata.importAttempt===attempt.slice(3));
  const q=url.searchParams.getAll('title').find(value=>value.startsWith('ilike.'));if(q)rows=rows.filter(row=>row.title.includes(q.slice(6).replaceAll('%','')));
  if(url.searchParams.has('processed_json->metadata->book'))rows=rows.filter(row=>row.processed_json.metadata.book);
  return send(object?(rows[0]||null):rows);
 }
 if(table==='reading_progress'){
  let rows=reads.map(row=>({...row,reading_materials:records.find(m=>String(m.id)===String(row.material_id))}));
  const id=url.searchParams.get('material_id');if(id)rows=rows.filter(row=>String(row.material_id)===id.slice(3));
  return send(object?(rows[0]||null):rows);
 }
 if(table==='user_vocabulary')return send(vocab);
 if(table==='vocabulary_contexts')return send(contexts.filter(c=>!url.searchParams.has('vocabulary_id')||String(c.vocabulary_id)===url.searchParams.get('vocabulary_id').slice(3)));
 return send(object?null:[]);
});
await context.route('**/api/suggestions/today',r=>r.fulfill({json:[]}));
await context.route('**/api/analyze',async r=>{
 analysisCalls++;if(analysisMode==='slow')await new Promise(resolve=>setTimeout(resolve,1800));
 if(analysisMode==='fail')return r.fulfill({status:503,json:{error:'fixture analysis unavailable'}});
 const {lines}=r.request().postDataJSON();return r.fulfill({json:{results:lines.map(line=>({sequence:['word'],dictionary:{word:{text:line,base_form:line,meaning:'읽기 검수 예문',pos:'명사'}}}))}});
});
await context.route('**/api/gemini',r=>r.fulfill({json:{text:'검수용 설명'}}));
await context.route('**/api/learning/**',r=>{
 if(r.request().method()==='POST'){
  const payload=r.request().postDataJSON();const word=vocab.find(v=>v.word_text===payload.word?.word_text)||vocab.at(-1);contexts.push({id:'context-1',user_id:uid,vocabulary_id:word?.id,material_id:payload.source?.materialId,quote:payload.source?.quote,locator:{tokenId:payload.source?.tokenId}});return r.fulfill({json:{ok:true,context:{id:'context-1'},vocabulary:{id:word?.id}}});
 }
 return r.fulfill({json:{contexts:contexts.map((payload,i)=>({id:`source-${i}`,kind:'reading',quote:payload.source?.quote||'검수 예문',href:`/viewer/${payload.source?.materialId||records[0]?.id}?sourceToken=${encodeURIComponent(payload.source?.tokenId||records[0]?.processed_json.sequence[0]||'')}`})),links:[]}});
});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
async function check(label){await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');report.checks.push(label);console.log(label);}
async function shot(name){await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:out+'/'+name+'.png',fullPage:false});}
// Production must exercise the original early click, without waiting for Home's h1.
const prefetches=[];page.on('request',req=>{if(req.url().startsWith(base)&&req.headers()['next-router-prefetch']==='1')prefetches.push(new URL(req.url()).pathname);});

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const lines=[
 [['你','nǐ','너'],['要','yào','해야 한다'],['爱惜','ài xī','아끼다'],['身体','shēn tǐ','몸'],['，','','쉼표'],['尽量','jǐn liàng','가능한 한'],['别','bié','하지 말다'],['熬夜','áo yè','밤을 새우다'],['。','','마침표']],
 [['周末','zhōu mò','주말'],['我们','wǒ men','우리'],['去','qù','가다'],['公园','gōng yuán','공원'],['散步','sàn bù','산책하다'],['。','','마침표']],
 [['他','tā','그'],['向','xiàng','~에게'],['朋友','péng you','친구'],['道','dào','사과하다','道歉'],['了','le','완료'],['歉','qiàn','사과','歉','道歉'],['。','','마침표']],
 [['这','zhè','이'],['扇','shàn','양사'],['窗','chuāng','창문'],['外','wài','밖'],['的','de','관형'],['双','shuāng','한 쌍'],['层','céng','층'],['装饰','zhuāng shì','장식'],['很','hěn','매우'],['漂亮','piào liang','예쁘다'],['。','','마침표']],
 [['她','tā','그녀'],['盛','chéng','담다'],['粥','zhōu','죽'],['。','','마침표']]
];
const sequence=[],dictionary={},raw=[];
for(let l=0;l<28;l++){
 const row=lines[l%lines.length];raw.push(row.map(w=>w[0]).join(''));
 [...row,['\n','','']].forEach(([text,furigana,meaning,base,sep],i)=>{
  const tid=`id_${l}_${i}_audit`;sequence.push(tid);dictionary[tid]={text,furigana,meaning,base_form:base||text,pos:text==='\n'?'개행':/[。，]/.test(text)?'기호':'명사',...(sep?{sep_link:sep}:{})};
 });
}
records=[{id:94001,title:'중국어 뷰어 검수 — 긴 문장과 선택 동작을 확인하는 자체 작성 자료',owner_id:uid,visibility:'private',direction:'read',created_at:new Date().toISOString(),raw_text:raw.join('\n'),processed_json:{status:'completed',sequence,dictionary,metadata:{language:'Chinese',level:'HSK5'}}}];
let race=false, detailWait=0,analysisFail=false,readingInvalid=false,reanalysis=false,readingPrompt='';
await context.route('**/api/gemini',async r=>{
 const prompt=r.request().postDataJSON()?.contents?.[0]?.parts?.[0]?.text||'';
 if(prompt.includes('evidence')){
  readingPrompt=prompt;return r.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({questions:Array.from({length:5},(_,i)=>({type:'mcq',question:`第${i+1}题：周末我们去哪里？`,options:['公园','学校','医院','机场'],answer:readingInvalid?9:0,explanation:'원문에서 공원에 간다고 설명합니다.',evidence:raw[1]}))})}]}}]}});
 }
 const syn=prompt.includes('유의어와 반의어');
 if(race&&!syn)await delay(prompt.includes('爱惜')?1700:120);
 const text=syn?JSON.stringify({syn:[{w:'珍惜',r:'zhēnxī',ko:'소중히 여기다'},{w:'爱护',r:'àihù',ko:'보호하다'},{w:'珍爱',r:'zhēnài',ko:'소중히 아끼다'},{w:'珍视',r:'zhēnshì',ko:'귀중히 여기다'}],ant:[{w:'浪费',r:'làngfèi',ko:'낭비하다'},{w:'糟蹋',r:'zāotà',ko:'허비하다'}]}):prompt.includes('爱惜')?'A문장-爱惜-설명':'B문장-周末-설명';
 await r.fulfill({json:{candidates:[{content:{parts:[{text}]}}]}});
});
await context.route('**/api/word-detail?**',async r=>{
 const word=new URL(r.request().url()).searchParams.get('base_form');
 if(detailWait&&word==='爱惜')await delay(detailWait);
 await r.fulfill({json:{detail:`상세설명-대상-${word}`}});
});
await context.route('**/api/analyze',async r=>{
 const ls=r.request().postDataJSON()?.lines||[];
 if(analysisFail)return r.abort('failed');
 if(reanalysis){if(analysisMode==='slow')await delay(1800);return r.fulfill({json:{results:ls.map(line=>({sequence:['w'],dictionary:{w:{text:line,meaning:'검수용 새 분석',pos:'명사'}}}))}});}
 if(race)await delay(ls.join('').includes('爱惜')?1650:100);
 const word=ls.join('').includes('爱惜')?'爱惜':'周末';
 await r.fulfill({json:{results:ls.map(line=>({sequence:['w'],dictionary:{w:{text:word,base_form:word,furigana:word==='爱惜'?'ài xī':'zhōu mò',meaning:`검수-${word}`,pos:'명사'}}}))}});
});

const baseline=structuredClone(records),checks=[];
const wordA=()=>page.locator('[data-tid="id_0_2_audit"]'),wordB=()=>page.locator('[data-tid="id_1_0_audit"]');
async function tap(loc){await loc.evaluate(e=>window.scrollBy(0,e.getBoundingClientRect().top-180));await loc.click();}
async function fresh(width=1138,height=900){
 race=false;detailWait=0;analysisFail=false;reanalysis=false;analysisMode='ok';readingInvalid=false;writeFail=false;records=structuredClone(baseline);vocab=[];contexts=[];reads=[];writes.length=0;
 await page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('pdf_cache:')||k.startsWith('viewer_')||k.startsWith('reading_test'))localStorage.removeItem(k);}).catch(()=>{});
 await page.setViewportSize({width,height});await page.goto(base+'/viewer/94001');await wordA().waitFor();await page.evaluate(()=>document.fonts.ready);
}
function pass(name){checks.push(name);console.log('PASS '+name);}
async function shotAt(name){await page.screenshot({path:out+'/'+name+'.png'});}
await context.addInitScript(()=>{window.SpeechRecognition=class{start(){window.__speechLang=this.lang;}stop(){this.onend?.();}abort(){this.onend?.();}};});
try {
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 await fresh();await tap(page.locator('[data-tid="id_4_1_audit"]'));await page.locator('.viewer-sheet').getByText('담다',{exact:true}).waitFor();
 await page.locator('.viewer-sheet details summary').waitFor();assert.equal(await page.locator('.viewer-sheet details').getAttribute('open'),null);assert((await page.locator('.viewer-sheet details summary').innerText()).includes('사전의 다른 뜻'));pass('contextual meaning remains primary; unrelated dictionary example is collapsed');await shotAt('context-meaning');
 await fresh();await tap(wordA());await page.locator('.viewer-sheet .save-grade button').first().waitFor();
 await page.getByRole('button',{name:'시트 닫기',exact:true}).click();await page.keyboard.press('1');await delay(150);assert.equal(vocab.length,0);pass('closed sheet ignores grade hotkeys');
 await fresh();detailWait=1000;await tap(wordA());await page.locator('.viewer-sheet').getByRole('button',{name:'상세 설명 보기',exact:true}).click();await delay(100);await tap(wordB());await delay(1300);
 assert((await page.locator('.viewer-sheet .word-fit').evaluate(e=>{const copy=e.cloneNode(true);copy.querySelectorAll('rt,.rt-an,.rt-hun').forEach(n=>n.remove());return copy.textContent.replace(/\s/g,'');})).includes('周末'));assert(!(await page.locator('.viewer-sheet').innerText()).includes('상세설명-대상-爱惜'));pass('late detail A never appears on B');
 await fresh();race=true;await tap(page.locator('[data-tid="id_0_0_audit"] .line-pick'));await delay(120);await tap(page.locator('[data-tid="id_1_0_audit"] .line-pick'));await delay(2100);
 assert((await page.locator('.viewer-sheet').innerText()).includes('B문장'));assert(!(await page.locator('.viewer-sheet').innerText()).includes('A문장'));pass('late sentence A cannot overwrite B');
 await fresh();await tap(wordA());await page.locator('.viewer-sheet .save-grade button').last().click();await tap(wordB());await page.getByRole('button',{name:/저장 취소 ·/}).waitFor();await delay(1000);
 assert((await page.locator('.viewer-sheet .word-fit').evaluate(e=>{const copy=e.cloneNode(true);copy.querySelectorAll('rt,.rt-an,.rt-hun').forEach(n=>n.remove());return copy.textContent.replace(/\s/g,'');})).includes('周末'));assert.equal(vocab.length,1);assert.equal(vocab[0].meaning,'아끼다');assert.equal(vocab[0].furigana,'ài xī');
 await page.getByRole('button',{name:/저장 취소 ·/}).click();await delay(200);assert.equal(vocab.length,0);assert.equal(contexts.length,0);pass('save A keeps B open; exact A snapshot undo');await shotAt('desktop-save-undo');
 await fresh(390,844);await tap(wordA());await page.locator('.viewer-sheet__sections').evaluate(e=>e.scrollTop=e.scrollHeight);await tap(wordB());await delay(200);
 assert.equal(await page.locator('.viewer-sheet__sections').evaluate(e=>e.scrollTop),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));pass('mobile new word resets real scroll container, no overflow');await shotAt('mobile-word');
 await fresh();analysisFail=true;await tap(page.locator('[data-tid="id_0_0_audit"] .line-pick'));await delay(1200);assert((await page.locator('.toast-container').innerText()).includes('단어 분석을 가져오지 못했어요'));assert(!(await page.locator('.viewer-sheet').innerText()).includes('단어 추출 중'));pass('failed sentence request ends loading visibly');
 await fresh();await page.getByRole('button',{name:'리딩 테스트',exact:true}).click();await page.locator('.reading-test__question').first().waitFor();
 assert.equal(await page.locator('.reading-test__question').count(),5);assert(readingPrompt.includes('질문과 선택지는 중국어'));assert.equal(await page.getByRole('heading',{name:'읽기 확인',exact:true}).count(),1);assert.equal(await page.getByText('IELTS Reading Test',{exact:true}).count(),0);pass('Chinese reading check uses Chinese questions and source evidence');await shotAt('chinese-reading-check');
 await fresh();readingInvalid=true;await page.getByRole('button',{name:'리딩 테스트',exact:true}).click();await page.locator('.reading-test [role="alert"]').waitFor();assert.equal(await page.locator('.reading-test__question').count(),0);readingInvalid=false;await page.getByRole('button',{name:'다시 시도',exact:true}).click();await page.locator('.reading-test__question').first().waitFor();pass('malformed reading answer is rejected and retry recovers');
 await fresh();await page.getByRole('button',{name:'회화 연습',exact:true}).click();await page.getByRole('button',{name:'대화 시작',exact:true}).click();await page.getByRole('button',{name:'음성 입력',exact:true}).click();assert.equal(await page.evaluate(()=>window.__speechLang),'zh-CN');pass('Chinese speech input selects zh-CN without real recording');
 async function menu(){await page.getByRole('button',{name:'읽기 설정',exact:true}).click();await page.getByRole('tab',{name:'도구',exact:true}).click();await page.getByRole('button',{name:/^재분석/}).click();}
 const materialWrites=()=>writes.filter(w=>w.table==='reading_materials'||w.table==='viewer_replace_analysis');
 await fresh();analysisFail=true;await menu();await page.getByRole('button',{name:/^전체 분석/}).click();await page.getByRole('button',{name:'분석 중단',exact:true}).waitFor({state:'hidden'});assert.deepEqual(records,baseline);assert.equal(materialWrites().length,0);pass('failed reanalysis preserves entire prior source and analysis');
 await fresh();reanalysis=true;analysisMode='slow';await menu();await page.getByRole('button',{name:/^전체 분석/}).click();await page.getByRole('button',{name:'분석 중단',exact:true}).click();await delay(2000);assert.deepEqual(records,baseline);assert.equal(materialWrites().length,0);pass('cancelled reanalysis has zero material writes');
 await fresh();reanalysis=true;await menu();await page.getByRole('button',{name:/^전체 분석/}).click();await page.getByRole('button',{name:'분석 중단',exact:true}).waitFor({state:'hidden'});await delay(250);assert.equal(materialWrites().length,1);assert.equal(materialWrites()[0].table,'viewer_replace_analysis');assert.equal(records[0].raw_text,baseline[0].raw_text);assert.equal(records[0].processed_json.status,'completed');pass('successful reanalysis uses one conditional atomic replacement');
 await fresh();analysisFail=true;await menu();await page.getByRole('button',{name:/^원문 수정/}).click();const draft=baseline[0].raw_text+'\n今天下雨。';await page.getByRole('textbox',{name:'원문 텍스트',exact:true}).fill(draft);await delay(350);await page.getByRole('dialog',{name:'원문 수정',exact:true}).getByRole('button',{name:/분석 후 저장/}).click();await page.getByRole('textbox',{name:'원문 텍스트',exact:true}).waitFor();await delay(500);assert.equal(await page.getByRole('textbox',{name:'원문 텍스트',exact:true}).inputValue(),draft);assert.deepEqual(records,baseline);assert.equal(materialWrites().length,0);pass('source edit analysis failure keeps draft and previous saved source');await shotAt('source-draft-preserved');
 await fresh(1440,1000);await tap(wordA());await page.locator('.viewer-side--right .word-detail-card').waitFor();assert(await page.locator('.viewer-side--right .word-detail-card').isVisible());await page.keyboard.press('4');await page.getByRole('button',{name:/저장 취소 ·/}).waitFor();assert.equal(vocab.length,1);assert.equal(vocab[0].word_text,'爱惜');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));pass('wide desktop card keyboard save and overflow check');await shotAt('desktop-wide');

} catch(e){report.errors.push(e.stack);await shotAt('failure').catch(()=>{});process.exitCode=1;console.error(e.stack);}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify({checks,errors:report.errors},null,2));await browser.close();}
