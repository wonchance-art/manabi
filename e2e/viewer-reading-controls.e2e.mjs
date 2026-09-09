// Stateful HTTP fixtures exercise real page code without touching personal data or AI services.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {vocabEncounterStorageKey} from '../src/lib/world/storageSchema.js';
const base=process.env.QA_BASE||'http://127.0.0.1:8898',out=process.env.QA_OUT||'/private/tmp/manabi-viewer-controls-qa';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.QA_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
context.setDefaultTimeout(12000);context.setDefaultNavigationTimeout(180000);
const report={base,checks:[],errors:[]},uid='00000000-0000-4000-8000-000000000088';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'reading-fixture@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
let known=[],records=[],vocab=[],reads=[],contexts=[],analysisMode='fail',saveFail=false,writeFail=false,analysisCalls=0;
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
 if(table==='user_known_words')return send(known);
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
page.on('console',m=>{if(m.type()==='error'&&/same key|unique "key"|Hydration failed|hydration mismatch/i.test(m.text()))report.errors.push(m.text());});
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
 race=false;detailWait=0;analysisFail=false;reanalysis=false;analysisMode='ok';readingInvalid=false;writeFail=false;records=structuredClone(baseline);known=[];vocab=[];contexts=[];reads=[];writes.length=0;
 await page.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('pdf_cache:')||k.startsWith('viewer_')||k.startsWith('reading_test'))localStorage.removeItem(k);}).catch(()=>{});
 await page.setViewportSize({width,height});await page.goto(base+'/viewer/94001');await wordA().waitFor();await page.evaluate(()=>document.fonts.ready);
}
function pass(name){checks.push(name);console.log('PASS '+name);}
async function shotAt(name){await page.screenshot({path:out+'/'+name+'.png'});}
await context.addInitScript(()=>{window.SpeechRecognition=class{start(){window.__speechLang=this.lang;}stop(){this.onend?.();}abort(){this.onend?.();}};});
async function aa(tab){await page.getByRole('button',{name:'읽기 설정',exact:true}).click();if(tab)await page.getByRole('tab',{name:tab,exact:true}).click();}
async function closeAa(){await page.getByRole('button',{name:'읽기 설정 닫기',exact:true}).click();}
const dialog=()=>page.getByRole('dialog',{name:'읽기 설정',exact:true});
const panel=()=>page.locator('.viewer-inspector');
const pref=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('viewer_preferences_v2')));
async function range(name,value){const input=page.getByRole('slider',{name,exact:true});await input.evaluate((el,v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,String(v));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);}
const selectedLine=()=>page.locator('.reader-area .word-token--picked').first().getAttribute('data-tid');
try {
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 // Exercise the actual pointer gesture and Aa projection with five real record states.
 const sampleSelector='.reader-area [data-tid^="id_0_"]';
 const colors=selector=>page.locator(selector).evaluateAll(ts=>ts.map(t=>({
  class:t.className.trim().split(/\s+/).filter(c=>/^word-token--(new|met|saved|due|picked)$/.test(c)).sort().join(' '),
  color:getComputedStyle(t.querySelector('.surface'),'::before').backgroundColor,
  band:['top','height'].map(p=>getComputedStyle(t.querySelector('.surface'),'::before')[p]),
 })));
 for(const [theme,name,width] of [['light','밝게',1440],['sepia','종이',1440],['dark','어둡게',1440],['light','밝게',390]]){
  if(process.env.QA_SELECTION_WIDTH&&width!==Number(process.env.QA_SELECTION_WIDTH))continue;
  await fresh(width,900);
  known=[{word_text:'要',lang:'zh'}];
  vocab=[['身体',1],['尽量',-1]].map(([word,days],i)=>({id:88001+i,user_id:uid,word_text:word,base_form:word,language:'Chinese',meaning:'상태 검수',next_review_at:new Date(Date.now()+days*86400000).toISOString(),repetitions:2}));
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify(['你'])),vocabEncounterStorageKey('zh'));
  await page.reload();await wordA().waitFor();
  await aa('글자·배경');await page.getByRole('button',{name,exact:true}).click();await page.getByRole('tab',{name:'학습 표시',exact:true}).click();await page.getByRole('checkbox',{name:/^단어 상태/}).check();await delay(250);
  const before=await colors(sampleSelector);
  assert.deepEqual(before.filter((_,i)=>[0,1,2,3,5].includes(i)).map(t=>t.class),['word-token--met','','word-token--new','word-token--saved','word-token--due word-token--saved']);
  assert.deepEqual(await colors('.reader-settings__preview .word-token'),before,'Aa must show the same real learning states as the body');
  assert.equal(await page.locator('.reader-settings__preview [data-tid], .reader-settings__preview [data-source-token], .reader-settings__preview button').count(),0);
  await shotAt(`selection-${theme}-${width}-aa-before`);await closeAa();
  const first=page.locator(sampleSelector).first(),last=page.locator(sampleSelector).last();
  await first.evaluate(e=>scrollBy(0,e.getBoundingClientRect().top-190));
  const a=await first.boundingBox(),b=await last.boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height*.7,{steps:20});await delay(250);
  const during=await colors(sampleSelector);
  const left=await first.boundingBox();assert(left.x>=12,'reader must retain an inner margin');
  const grips=await page.locator('.range-grip').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right};}));
  assert(grips.length===2&&grips.every(r=>r.left>=0&&r.right<=width),'both drag handles must remain inside the viewport');
  assert.equal(during.filter(t=>t.class.includes('picked')).length,before.length,'drag must select the full range');
  for(let i=0;i<before.length;i++)assert.notEqual(during[i].color,before[i].color,`drag color unchanged at token ${i}`);
  await shotAt(`selection-${theme}-${width}-drag`);await page.mouse.up();await delay(300);
  assert.deepEqual(await colors(sampleSelector),during,'releasing the drag retains the selected state colors');
  await aa('학습 표시');await delay(250);assert.deepEqual(await colors('.reader-settings__preview .word-token'),during,'Aa must preserve the current selected range and colors');
  await shotAt(`selection-${theme}-${width}-aa-picked`);
  const annotationColors=selector=>page.locator(selector).evaluateAll(es=>es.map(e=>getComputedStyle(e).color));
  const annotationBefore=await annotationColors('.reader-settings__preview .rt-an');
  assert.deepEqual(annotationBefore,await annotationColors(sampleSelector+' .rt-an'));
  await dialog().getByText('성조·문법·한자 표시',{exact:true}).click();
  await page.getByRole('checkbox',{name:/^성조 색상/}).check();await delay(250);
  const annotationToned=await annotationColors('.reader-settings__preview .rt-an');
  assert.deepEqual(annotationToned,await annotationColors(sampleSelector+' .rt-an'));
  assert.notDeepEqual(annotationToned,annotationBefore);assert(new Set(annotationToned).size>=4);
  assert.deepEqual(await colors('.reader-settings__preview .word-token'),during,'tone colors must not erase learning-state fills');
  await page.getByRole('checkbox',{name:/^성조 색상/}).uncheck();await delay(250);
  assert.deepEqual(await annotationColors('.reader-settings__preview .rt-an'),annotationBefore);
  await page.getByRole('checkbox',{name:/^단어 상태/}).uncheck();await delay(250);
  assert.equal(new Set((await colors('.reader-settings__preview .word-token')).map(t=>t.color)).size,1);
  await page.getByRole('checkbox',{name:/^단어 상태/}).check();await closeAa();await page.keyboard.press('Escape');await delay(250);
  assert.deepEqual(await colors(sampleSelector),before,'Escape restores state fills');
  assert.equal(writes.filter(w=>['user_vocabulary','user_known_words','viewer_replace_analysis'].includes(w.table)).length,0);
  assert.deepEqual(records,baseline);
  // Reverse drag on a later line must preview that line, not default to line 0.
  const later=page.locator('.reader-area [data-tid^="id_1_"]');
  await later.first().evaluate(e=>scrollBy(0,e.getBoundingClientRect().top-190));
  const c=await later.first().boundingBox(),d=await later.last().boundingBox();
  await page.mouse.move(d.x+d.width/2,d.y+d.height*.7);await page.mouse.down();await page.mouse.move(c.x+c.width/2,c.y+c.height*.7,{steps:20});await page.mouse.up();await delay(250);
  await aa('학습 표시');await delay(250);
  assert.deepEqual(await colors('.reader-settings__preview .word-token'),await colors('.reader-area [data-tid^="id_1_"]'));
  assert((await page.locator('.reader-settings__preview').innerText()).includes('周'));
  await closeAa();await page.keyboard.press('Escape');await check(`selection ${theme} ${width}`);
  pass(`real drag and Aa preserve five learning states: ${theme} ${width}`);
 }
 if(!process.env.QA_SELECTION_ONLY){
 await fresh(1440,1000);await tap(wordA());await page.locator('.viewer-inspector .word-detail-card').waitFor();await shotAt('desktop-word');
 assert.equal(await page.locator('.word-detail-card').count(),1);assert.equal(await panel().evaluate(e=>getComputedStyle(e).position),'sticky');pass('desktop has one inspector and one word card');
 await aa();assert(await panel().isHidden());assert(await dialog().evaluate(e=>e.matches(':modal')));assert((await dialog().innerText()).includes('글자·배경'));await shotAt('desktop-aa');
 await range('본문 크기',2);await range('병음 크기',1);await range('줄 사이',30);await range('글자 사이',.3);
 const previewLayout=await page.evaluate(()=>{
  const preview=document.querySelector('.reader-settings__preview'),body=document.querySelector('.reader-area');
  const sizes=el=>{const s=getComputedStyle(el),r=el.querySelector('ruby[data-pinyin]');return {font:s.fontSize,row:s.rowGap,column:s.columnGap,cell:r.getBoundingClientRect().width,pinyin:getComputedStyle(r.querySelector('.rt-an')).fontSize};};
  return {preview:sizes(preview),body:sizes(body),interactive:preview.querySelectorAll('[data-tid],[data-source-token],button,input').length};
 });
 assert.deepEqual(previewLayout.preview,previewLayout.body,'Aa preview reflects the actual body font, spacing and pinyin grid');assert.equal(previewLayout.interactive,0);
 await page.getByRole('tab',{name:'학습 표시',exact:true}).click();await page.getByRole('checkbox',{name:'단어 상태',exact:false}).check();await page.getByRole('button',{name:'이번 변경 되돌리기',exact:true}).click();assert.equal((await pref()).languages.Chinese.fontSize,1.6);assert.equal((await pref()).languages.Chinese.wordStateHl,false);pass('opening snapshot survives tab changes and restores all preferences');
 await page.getByRole('checkbox',{name:'단어 상태',exact:false}).check();await page.getByRole('tab',{name:'글자·배경',exact:true}).click();await range('본문 크기',2.4);await page.getByRole('button',{name:'이 탭 기본값',exact:true}).click();assert.equal((await pref()).languages.Chinese.fontSize,1.6);assert.equal((await pref()).languages.Chinese.wordStateHl,true);await closeAa();assert(await panel().isVisible());pass('tab reset leaves another tab intact; inspector resumes');
 // Pinyin is readable and identical across syllables; revealing never changes widths.
 await fresh(390,844);await aa('글자·배경');await range('본문 크기',.8);await range('병음 크기',1);await closeAa();
 const metrics=await page.locator('.reader-area ruby[data-pinyin]').evaluateAll(nodes=>nodes.map(n=>{const a=n.querySelector('.rt-an'),r=n.getBoundingClientRect(),ar=a.getBoundingClientRect();return {cell:r.width,font:parseFloat(getComputedStyle(a).fontSize),width:ar.width};}));
 assert(metrics.length>20);assert(metrics.every(m=>m.font>=15.9&&m.width<=m.cell+1));assert.equal(new Set(metrics.map(m=>Math.round(m.cell))).size,1);await shotAt('mobile-pinyin-large');pass('16px pinyin stays uniform and contained with minimum body size');
 await aa('학습 표시');await page.getByRole('button',{name:'숨김',exact:true}).click();await page.getByRole('checkbox',{name:/탭하면 발음 보기/}).check();await closeAa();
 const widthBefore=await wordA().evaluate(e=>e.getBoundingClientRect().width);await tap(wordA());assert.equal(await page.locator('.word-detail-card').count(),0);const widthAfter=await wordA().evaluate(e=>e.getBoundingClientRect().width);assert(Math.abs(widthBefore-widthAfter)<1);await tap(wordA());assert(await panel().isVisible());pass('hidden reading reveals on first tap without reflow; second opens card');
 // Grade controls stay within the same visible panel, even with expanded information.
 await fresh(390,844);
 const lowWord=page.locator('[data-tid="id_12_0_audit"]');
 await lowWord.evaluate(e=>scrollBy(0,e.getBoundingClientRect().top-560));await lowWord.click();await panel().waitFor();await delay(150);
 const visibleSelected=async()=>{const r=await lowWord.boundingBox(),p=await panel().boundingBox(),t=await page.locator('.viewer-topbar').boundingBox();assert(r.y>=t.y+t.height+7&&r.y+r.height<=p.y-7,`selected word ${JSON.stringify(r)} is covered by toolbar/sheet ${JSON.stringify(p)}`);};
 await visibleSelected();await aa();await range('본문 크기',1.8);await closeAa();await delay(150);await visibleSelected();
 await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await page.getByRole('button',{name:'패널 줄이기',exact:true}).click();await delay(150);await visibleSelected();
 await shotAt('mobile-selected-source-visible');pass('low word selection, Aa return and sheet resize keep the source above the inspector');
 await page.mouse.move(220,250);await page.mouse.wheel(0,250);await delay(250);const manualY=await page.evaluate(()=>scrollY);
 await page.setViewportSize({width:390,height:820});await delay(150);assert(Math.abs(await page.evaluate(()=>scrollY)-manualY)<2);pass('manual reading scroll wins over a later sheet resize');
 await fresh(390,844);await tap(wordA());await page.locator('.reader-card-body').getByText('유의어·반의어',{exact:true}).click();await page.locator('.syn-ant__chip').first().waitFor();
 const controls=await page.locator('.save-grade').boundingBox(),panelBounds=await panel().boundingBox(),tabs=await page.locator('.viewer-inspector__tabs').boundingBox();assert(controls.y>=panelBounds.y&&controls.y+controls.height<=tabs.y+1);await shotAt('mobile-card-actions');pass('mobile card grades remain visible above tabs and below scrolling details');
 await page.getByRole('button',{name:'읽기 설정',exact:true}).click();await page.keyboard.press('1');assert.equal(vocab.length,0);await page.keyboard.press('Escape');assert(await panel().isVisible());await page.getByRole('button',{name:'보조 패널 닫기',exact:true}).click();await page.keyboard.press('1');assert.equal(vocab.length,0);pass('modal and closed inspector cannot grade a hidden card');
 // Theme changes reach the body, native modal and inspector surfaces.
 for(const [choice,name] of [['dark','어둡게'],['light','밝게'],['sepia','종이']]){
  await aa('글자·배경');await page.getByRole('button',{name,exact:true}).click();const surface=await dialog().evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(surface,'rgba(0, 0, 0, 0)');await closeAa();await tap(wordA());assert.equal(await panel().evaluate(e=>getComputedStyle(e).backgroundColor),surface);assert.equal(await page.locator('.viewer-layout').getAttribute('data-reader-theme'),choice);await shotAt('mobile-theme-'+choice);await page.getByRole('button',{name:'보조 패널 닫기',exact:true}).click();
 }pass('three opaque themes propagate to reader, dialog and inspector');
 // Opening settings does not start the pacer; explicit start and holds are independent.
 await fresh(1138,900);await aa('읽기 진행');await page.getByRole('checkbox',{name:/문장 집중/}).check();await page.getByRole('checkbox',{name:/자동 진행 허용/}).check();await closeAa();
 assert.equal(await page.locator('.reader-area--pacing').count(),0);await page.getByRole('button',{name:'자동 진행 시작',exact:true}).click();await page.locator('.reader-area--pacing').waitFor();const first=await selectedLine();await aa('읽기 진행');await delay(1600);assert.equal(await selectedLine(),first);await closeAa();await delay(300);assert.equal(await selectedLine(),first);await page.getByRole('button',{name:'자동 진행 중지',exact:true}).click();await aa();await closeAa();assert.equal(await page.locator('.reader-area--pacing').count(),0);pass('explicit pacer start, modal hold, resume grace and manual stop');
 // Dictation dialog replaces activity chooser; no answer in underlying accessibility tree.
 await page.getByRole('button',{name:'학습',exact:true}).click();await page.getByRole('button',{name:/^받아쓰기/}).click();await page.getByRole('button',{name:'▷ 듣고 시작',exact:true}).first().click();await page.getByRole('textbox',{name:'받아쓰기 입력',exact:true}).fill('초안 보관');
 assert(await page.locator('.viewer-center').evaluate(e=>e.inert&&getComputedStyle(e).visibility==='hidden'));assert.equal(await page.locator('dialog[open]').count(),1);await shotAt('dictation-answer-hidden');await page.getByRole('button',{name:'받아쓰기 닫기',exact:true}).click();assert(!(await page.locator('.viewer-center').evaluate(e=>e.inert)));
 await page.getByRole('button',{name:'학습',exact:true}).click();await page.getByRole('button',{name:/^받아쓰기/}).click();await page.getByRole('button',{name:'▷ 듣고 시작',exact:true}).first().click();assert.equal(await page.getByRole('textbox',{name:'받아쓰기 입력',exact:true}).inputValue(),'초안 보관');await page.getByRole('button',{name:'원문 보기',exact:true}).click();await page.getByRole('button',{name:'채점',exact:true}).click();assert((await page.getByRole('dialog',{name:'받아쓰기',exact:true}).innerText()).includes('원문을 참고한 연습'));await page.keyboard.press('Escape');pass('dictation hides the source and preserves draft; revealed attempts are labeled');
 // Width/short viewport sweep and enlarged text.
 for(const [width,height] of [[320,640],[390,844],[768,900],[1024,768],[1138,900],[1440,1000],[844,390]]){
  await fresh(width,height);await tap(wordA());await check('layout '+width+'x'+height);await aa();assert(await dialog().isVisible());await check('Aa '+width+'x'+height);await page.keyboard.press('Escape');
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='200%');await aa();await check('200% root text');await shotAt('text-200');await page.keyboard.press('Escape');

 await page.evaluate(()=>document.documentElement.style.fontSize='');
 // A long legacy token and mixed writing must remain readable without changing analysis.
 await fresh(390,844);
 const oldRaw=records[0].raw_text;
 const token=records[0].processed_json.dictionary.id_0_2_audit;
 token.text='T恤2026'+ '中国語学習'.repeat(18);token.furigana='invalid pronunciation does not become a global cell width';
 records[0].raw_text=records[0].raw_text.replace('爱惜',token.text);await page.reload();await wordA().waitFor();await tap(wordA());await check('long mixed token and malformed pronunciation');
 assert.equal(records[0].processed_json.dictionary.id_0_2_audit.text,token.text);assert.equal(writes.filter(w=>w.table==='viewer_replace_analysis').length,0);pass('legacy mixed and long tokens wrap without rewriting analysis');
 // Unsupported reading controls do not leak into English/French; JP keeps half-size ruby.
 for(const [language,text,reading] of [['Japanese','勉強','べんきょう'],['English','reading',''],['French','lecture','']]){
  await fresh(768,900);records[0].processed_json={status:'completed',metadata:{language},sequence:['id_0_0_test'],dictionary:{id_0_0_test:{text,furigana:reading,meaning:'읽기 검수',pos:'명사'}}};records[0].raw_text=text;await page.reload();await page.locator('[data-tid="id_0_0_test"]').waitFor();await aa('글자·배경');assert.equal(await page.getByRole('slider',{name:'병음 크기',exact:true}).count(),0);
  await page.getByRole('tab',{name:'학습 표시',exact:true}).click();assert.equal(await page.getByRole('group',{name:'발음 표기',exact:true}).count(),language==='Japanese'?1:0);await closeAa();
  if(language==='Japanese'){const size=await page.locator('.reader-area ruby[data-yomi] .rt-an').evaluate(e=>({ruby:parseFloat(getComputedStyle(e).fontSize),body:parseFloat(getComputedStyle(e.parentElement).fontSize)}));assert(Math.abs(size.ruby/size.body-.5)<.01);}
 }pass('Japanese yomi retained; English/French have no pronunciation controls');
 await fresh(390,844);await page.evaluate(()=>document.documentElement.style.fontSize='200%');await aa();await check('390px with 200% text');await page.getByRole('button',{name:'현재 문장 미리보기 접기',exact:true}).click();await dialog().getByRole('button',{name:'이번 변경 되돌리기',exact:true}).scrollIntoViewIfNeeded();await shotAt('mobile-200');await page.keyboard.press('Escape');await page.evaluate(()=>document.documentElement.style.fontSize='');
 // Failure to persist never blocks the in-memory setting or pretends to have saved.
 await fresh();await page.evaluate(()=>{window.__originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='viewer_preferences_v2')throw new DOMException('quota','QuotaExceededError');return window.__originalStorageSet.call(this,k,v);};});await aa();await range('본문 크기',2);await page.getByText('이 브라우저에 저장하지 못했어요.',{exact:false}).waitFor();assert.equal(await page.locator('.reader-area').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),32);await closeAa();await page.evaluate(()=>{Storage.prototype.setItem=window.__originalStorageSet;});pass('storage failure keeps applied settings and shows a truthful notice');
 // Read mid-document, resize in Aa, then close: the same source token stays visible.
 await fresh(390,844);await page.locator('[data-tid="id_12_0_audit"]').evaluate(e=>scrollBy(0,e.getBoundingClientRect().top-170));
 const anchor=await page.evaluate(()=>{const top=document.querySelector('.viewer-topbar').getBoundingClientRect().bottom+8;const e=[...document.querySelectorAll('[data-source-token]')].find(e=>e.getBoundingClientRect().top>=top);return {id:e.dataset.sourceToken,top:e.getBoundingClientRect().top};});
 await aa();await range('본문 크기',2);await closeAa();await delay(350);
 const anchorTop=await page.locator(`[data-source-token="${anchor.id}"]`).evaluate(e=>e.getBoundingClientRect().top);
 assert(Math.abs(anchorTop-anchor.top)<36,`source anchor shifted ${anchorTop-anchor.top}px`);pass('body size changes preserve the visible source location');
 // Simulate a mobile keyboard's visual viewport without touching a user's keyboard.
 await fresh(390,844);await tap(wordA());await page.evaluate(()=>{const vv=window.visualViewport;Object.defineProperty(vv,'height',{configurable:true,value:440});vv.dispatchEvent(new Event('resize'));});await delay(80);
 assert((await panel().boundingBox()).y+(await panel().boundingBox()).height<=441);await shotAt('mobile-keyboard');await aa();const modalBox=await dialog().boundingBox();assert(modalBox.y+modalBox.height<=441);await page.keyboard.press('Escape');await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});pass('visual viewport changes keep inspector actions and modal above the keyboard');
 // Retrying a failed answer must not append the student's message again.
 await fresh();await page.evaluate(()=>localStorage.removeItem('conversation:94001'));
 let conversationFails=true,conversationPrompts=[];
 await context.route('**/api/gemini',r=>{const prompt=r.request().postDataJSON()?.contents?.[0]?.parts?.[0]?.text||'';if(!prompt.includes('language tutor'))return r.fallback();conversationPrompts.push(prompt);return conversationFails?r.fulfill({status:500,json:{error:{message:'fixture answer error'}}}):r.fulfill({json:{candidates:[{content:{parts:[{text:'周末你喜欢做什么？'}]}}]}});});
 await page.getByRole('button',{name:'학습',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/^회화 연습/}).click();await page.getByRole('button',{name:'대화 시작',exact:true}).click();await page.getByRole('button',{name:'답변 다시 받기',exact:true}).waitFor();conversationFails=false;await page.getByRole('button',{name:'답변 다시 받기',exact:true}).click();await page.getByPlaceholder('중국어로 자유롭게 답변해 보세요').waitFor();await page.getByText('周末你喜欢做什么？',{exact:true}).waitFor();
 conversationFails=true;await page.getByPlaceholder('중국어로 자유롭게 답변해 보세요').fill('我喜欢读书。');await page.getByRole('button',{name:'보내기',exact:true}).click();await page.getByRole('button',{name:'답변 다시 받기',exact:true}).waitFor();conversationFails=false;await page.getByRole('button',{name:'답변 다시 받기',exact:true}).click();await page.locator('.conversation-msg--ai').last().getByText('周末你喜欢做什么？',{exact:true}).waitFor();assert.equal(await page.locator('.conversation-msg--user').count(),1);assert.equal((conversationPrompts.at(-1).match(/Student: 我喜欢读书。/g)||[]).length,1);await page.keyboard.press('Escape');pass('conversation start and answer retry preserve a single student message');
 if(process.env.QA_REAL_FONTS==='1'){
  await fresh(1440,1000);const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const fontEvidence=async(selector='[data-tid="id_0_2_audit"] .surface ruby[data-pinyin]')=>{const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});return (await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;};
  const sans=await fontEvidence();assert(sans.some(f=>/Noto ?Sans ?SC/i.test(f.familyName)),JSON.stringify(sans));
  await aa();await page.getByRole('button',{name:'명조',exact:true}).click();await page.waitForFunction(()=>[...document.fonts].some(f=>/Noto.*Serif.*SC/i.test(f.family)&&f.status==='loaded'),null,{timeout:60000});await page.evaluate(()=>document.fonts.ready);
  const previewSerif=await fontEvidence('.reader-settings__preview .surface ruby[data-pinyin]');assert(previewSerif.some(f=>/Noto ?Serif ?SC/i.test(f.familyName)),JSON.stringify(previewSerif));await shotAt('desktop-aa-serif-real');await closeAa();await page.evaluate(()=>document.fonts.ready);
  const serif=await fontEvidence();assert(serif.some(f=>/Noto ?Serif ?SC/i.test(f.familyName)),JSON.stringify(serif));await shotAt('desktop-serif-real');
  fs.writeFileSync(out+'/real-fonts.json',JSON.stringify({sans,serif,previewSerif},null,2));await cdp.detach();pass('deployed Chinese glyphs use real Noto Sans SC and Noto Serif SC faces');
 }
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify({checks,errors:report.errors}));
} finally {await page.screenshot({path:out+'/last.png'}).catch(()=>{});fs.writeFileSync(out+'/report.json',JSON.stringify({checks,layoutChecks:report.checks,errors:report.errors},null,2));await browser.close();}
