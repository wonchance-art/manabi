// 뷰어 v2 AD-R3 PR③ — 「이 자료」 한 단어로 묶기 · 나누기 · 되돌리기(설계서 docs/manabi-viewer-v2-ad-r3.md §4·§6·§9 PR③).
// 실제 뷰어 + 합성 백엔드만(계정·제공자·운영 DB 없음). 쓰기는 viewer_replace_analysis RPC(원자 교체 — 여기서는 기대값
// 비교·소유자 확인을 흉내 낸 합성 RPC)와 token_corrections 이력뿐이어야 한다. 저장 단어·FSRS·평가 이력·개인 뜻·출처·
// 사전·전역 승격 쓰기는 요청 감시로 0을 고정한다. /api/analyze는 PR② 서버 계약(boundaries → boundaryApplied)을 흉내 낸다.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';
import {legacyLearningSnapshot} from './fixtures/learning-snapshot.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const ID=94321;
const w=(text,furigana,meaning,pos='명사')=>({text,base_form:text,furigana,meaning,pos});
const LINES={
 Chinese:[
  [w('运动员','yùn dòng yuán','운동선수'),w('的','de','~의','조사'),w('身体','shēn tǐ','몸'),w('素质','sù zhì','자질'),w('非常','fēi cháng','매우','부사'),w('好','hǎo','좋다','형용사'),w('。','','','기호')],
  [w('他','tā','그','대명사'),w('是','shì','~이다','동사'),w('我','wǒ','나','대명사'),w('的','de','~의','조사'),w('朋友','péng you','친구'),w('。','','','기호')],
 ],
 English:[
  [w('I','','나','대명사'),{text:'picked',base_form:'pick',furigana:'',meaning:'골랐다',pos:'동사'},w('up','','위로','부사'),w('the','','그','관사'),w('book','','책'),w('.','','','기호')],
 ],
 Japanese:[
  [w('明日','あした','내일'),w('は','','~은','조사'),w('天気','てんき','날씨'),w('予報','よほう','예보'),w('を','','~을','조사'),{text:'見る',base_form:'見る',furigana:'みる',meaning:'보다',pos:'동사'},w('。','','','기호')],
 ],
 Korean:[
  [{text:'오늘은',base_form:'오늘',furigana:'',meaning:'today',pos:'명사'},{text:'날씨가',base_form:'날씨',furigana:'',meaning:'weather',pos:'명사'},{text:'좋다.',base_form:'좋다',furigana:'',meaning:'good',pos:'형용사'}],
 ],
};
const MEANINGS={身体素质:'신체 조건',非常好:'아주 좋다',天気予報:'일기 예보','picked up':'집어 올렸다'};
const join=(language,tokens)=>tokens.map(t=>t.text).join(language==='English'||language==='Korean'?' ':'');
const compact=s=>String(s).replace(/\s+/g,'');

function build(language,{edits=null,tokens=null}={}) {
 const lines=LINES[language];
 const texts=lines.map(l=>join(language,l));
 const sequence=[],dictionary={};
 lines.forEach((words,line)=>{
  const list=tokens?.[line]||words.map((t,i)=>({id:`id_${line}_${i}`,token:t}));
  for(const {id,token} of list){sequence.push(id);dictionary[id]=token;}
  if(line<lines.length-1){const id=`br_${line}_0`;sequence.push(id);dictionary[id]={text:'\n',pos:'개행'};}
 });
 return {texts,raw:texts.join('\n'),language,json:{status:'completed',metadata:{language,...(edits?{viewerBoundaries:{version:1,edits}}:{})},sequence,dictionary}};
}
// 身体素质를 미리 묶어 둔 자료(나누기·되돌리기 시험용) — PR①의 기록 형식 그대로.
function mergedZh() {
 const base=LINES.Chinese[0];
 const merged={text:'身体素质',base_form:'身体素质',furigana:'shēn tǐ sù zhì',meaning:'신체 조건',pos:'명사',boundary:'user'};
 const tokens=[[{id:'id_0_0',token:base[0]},{id:'id_0_1',token:base[1]},{id:'id_0_e2_seed0001',token:merged},{id:'id_0_4',token:base[4]},{id:'id_0_5',token:base[5]},{id:'id_0_6',token:base[6]}]];
 tokens[1]=LINES.Chinese[1].map((t,i)=>({id:`id_1_${i}`,token:t}));
 const edits=[{id:'b_0_4_8',line:0,start:4,end:8,text:'身体素质',cuts:[],base:[{id:'id_0_2',token:base[2]},{id:'id_0_3',token:base[3]}],status:'applied'}];
 return build('Chinese',{edits,tokens});
}

// /api/analyze 흉내 — 줄을 LINES 그대로 토큰화하고 boundaries(문단 안 줄 번호)를 PR② 규칙(글자·양 끝 경계 일치 → applied)으로 적용한다.
// suggest: AD-R4 PR④ 서버 경계 검수 켜짐 흉내 — 표식 없는 身体에 미등재 묶음 후보(boundarySuggest)를 다시 단다.
function analyzeLine(language,text,boundaries,{pendingAll=false,suggest=false}={}) {
 const lines=LINES[language]||[];
 const words=lines.find(l=>join(language,l)===text);
 if(!words)return {sequence:[],dictionary:{}};
 let at=0;const spans=words.map(t=>{const s={token:t,start:at,end:at+compact(t.text).length};at=s.end;return s;});
 const flat=spans.map(s=>compact(s.token.text)).join('');
 const out=[];const applied=[];
 const regions=[];
 for(const b of boundaries){
  const okEdges=spans.some(s=>s.start===b.start)&&spans.some(s=>s.end===b.end);
  if(pendingAll||flat.slice(b.start,b.end)!==b.text||!okEdges){applied.push({id:b.id,status:'pending',reason:'text_mismatch',base:[]});continue;}
  regions.push(b);
  applied.push({id:b.id,status:'applied',start:b.start,end:b.end,cuts:b.cuts,base:spans.filter(s=>s.start>=b.start&&s.end<=b.end).map(s=>s.token)});
 }
 for(const s of spans){
  const r=regions.find(b=>s.start>=b.start&&s.end<=b.end);
  if(!r){out.push(suggest&&s.token.text==='身体'?{...s.token,boundarySuggest:'身体素质'}:s.token);continue;}
  if(s.start!==r.start)continue;
  const points=[r.start,...r.cuts,r.end];
  for(let k=0;k+1<points.length;k++){
   const same=spans.find(x=>x.start===points[k]&&x.end===points[k+1]);
   if(same){out.push({...same.token,boundary:'user'});continue;}
   const parts=spans.filter(x=>x.start>=points[k]&&x.end<=points[k+1]);
   const piece=parts.map(x=>x.token.text).join(language==='English'?' ':'');
   out.push({text:piece,base_form:language==='English'?'pick up':piece,furigana:parts.map(x=>x.token.furigana).filter(Boolean).join(language==='Japanese'?'':' '),meaning:MEANINGS[piece]||`${piece}의 뜻`,pos:'명사',boundary:'user'});
  }
 }
 const sequence=out.map((_,i)=>`s${i}`),dictionary=Object.fromEntries(out.map((t,i)=>[`s${i}`,t]));
 return {sequence,dictionary,...(boundaries.length?{boundaryApplied:applied}:{})};
}

const stable=v=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')}}`:JSON.stringify(v??null);

async function open(m,{width=390,height=844,own=true,saved=[],pendingAll=false,suggest=false}={}) {
 const f=await fixture({width});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(({language})=>{
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{[language]:{focusMode:false,autoSpeakOnClick:false}}}));
 },{language:m.language});
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS,HEAD'};
 const send=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
 f.analyze=[];f.rpc=[];f.corrections=[];f.requests=[];
 f.page.on('request',req=>f.requests.push({method:req.method(),url:req.url()}));
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용 번역'})}));
 await f.context.route('**/rest/v1/morpheme_dictionary**',r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers:cors}):send(r,[]));
 await f.context.route(/\/api\/analyze(\/korean)?$/,route=>{
  const body=route.request().postDataJSON();
  f.analyze.push(body);
  const results=(body.lines||[]).map((text,li)=>analyzeLine(body.language,text,(body.boundaries||[]).filter(b=>b.line===li),{pendingAll,suggest}));
  return send(route,{results});
 });
 await f.context.route('**/rest/v1/rpc/viewer_replace_analysis',route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  const a=req.postDataJSON();f.rpc.push(a);
  const row=f.rows.find(r=>String(r.id)===String(a.p_id));
  if(!row||row.owner_id!==owner)return send(route,{code:'42501',message:'자료가 없거나 수정 권한이 없습니다.'},403);
  if(row.raw_text!==a.p_expected_raw||stable(row.processed_json)!==stable(a.p_expected_json))return send(route,{code:'40001',message:'다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.'},409);
  if(a.p_json?.metadata?.viewerRevision!==a.p_attempt)return send(route,{code:'22023',message:'분석 결과를 확인하지 못했어요.'},400);
  row.raw_text=a.p_raw;row.processed_json=a.p_json;
  return send(route,{material:row});
 });
 await f.context.route('**/rest/v1/token_corrections**',route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(req.method()==='POST'){const v=req.postDataJSON();f.corrections.push(...(Array.isArray(v)?v:[v]));return send(route,[]);}
  return send(route,f.corrections.map(({token_id,after_value})=>({token_id,after_value})));
 });
 await f.context.route('**/api/learning/vocabulary**',route=>{
  const url=new URL(route.request().url());
  if(route.request().method()!=='GET'||url.searchParams.get('view')!=='learning')return route.fallback();
  return route.fulfill({contentType:'application/json',body:JSON.stringify(legacyLearningSnapshot({actorId:owner,rows:saved,fields:url.searchParams.get('fields')}))});
 });
 f.rows.push({id:ID,user_id:owner,...(own?{owner_id:owner}:{}),title:'단어 경계 검수',raw_text:m.raw,source_type:'text',created_at:new Date().toISOString(),processed_json:structuredClone(m.json)});
 await f.page.goto(`/viewer/${ID}`,{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator(`[data-source-token="${m.json.sequence[0]}"]`).waitFor();
 f.mark=f.requests.length;
 return f;
}
const row=f=>f.rows.find(r=>r.id===ID);
const tokenTexts=async(f,line)=>f.page.evaluate(l=>[...document.querySelectorAll('[data-source-token]')].filter(e=>new RegExp(`^(id|failed)_${l}_`).test(e.dataset.sourceToken)).map(e=>e.dataset.sourceToken),line);
const bodyLine=async(f,line)=>{const ids=await tokenTexts(f,line);return ids.map(id=>row(f).processed_json.dictionary[id]?.text);};
const until=async(check,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,60));}assert.fail('condition not met in time');};
const closeSheet=async f=>{const close=f.page.getByRole('button',{name:'보조 패널 닫기',exact:true});if(await close.count()&&await close.isVisible())await close.click();};
async function drag(f,fromId,toId) {
 await closeSheet(f);
 const a=await f.page.locator(`[data-source-token="${fromId}"]`).boundingBox(),b=await f.page.locator(`[data-source-token="${toId}"]`).boundingBox();
 await f.page.mouse.move(a.x+a.width/2,a.y+a.height*.7);await f.page.mouse.down();
 await f.page.mouse.move(b.x+b.width/2,b.y+b.height*.7,{steps:12});await f.page.waitForTimeout(150);
 await f.page.mouse.up();await f.page.waitForTimeout(250);
}
const sentencePanel=f=>f.page.locator('#inspector-sentence').filter({visible:true});
const card=f=>f.page.locator('#inspector-word').filter({visible:true});
// 허용된 쓰기만: 원자 교체 RPC · 교정 이력 · 분석 요청 · 번역 요청 · 읽기 활동/위치(기존 동작). 저장 단어·FSRS·출처·사전·전역 승격은 0.
const ALLOWED=[/\/rest\/v1\/rpc\/viewer_replace_analysis$/,/\/rest\/v1\/token_corrections/,/\/api\/analyze$/,/\/api\/gemini$/,/\/rest\/v1\/library_reading_activity/,/\/rest\/v1\/reading_progress/,/\/rest\/v1\/rpc\/fsrs_legacy_boundary$/];
const writes=(f,from=f.mark)=>f.requests.slice(from).filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method));
function assertOnlyBoundaryWrites(f,label,from) {
 const bad=writes(f,from).filter(r=>!ALLOWED.some(p=>p.test(new URL(r.url).pathname)));
 assert.deepEqual(bad,[],`${label}: no vocabulary · FSRS · review · context · dictionary · dict-correct · reading_materials PATCH writes`);
}
const measure=page=>page.evaluate(()=>{
 const panel=[...document.querySelectorAll('.viewer-inspector')].find(el=>el.getClientRects().length);
 const r=el=>{if(!el||!el.getClientRects().length)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height};};
 const q=s=>panel?.querySelector(`#inspector-word ${s}`);
 return {sheet:r(panel),body:r(q('.reader-card-body')),scrollTop:q('.reader-card-body')?.scrollTop??-1,vh:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
  head:r(q('.reader-card-headword')),meaning:r(q('.word-detail-card__meaning')),
  grades:[...(panel?.querySelectorAll('#inspector-word .reader-card-actions .review-score-btn')||[])].filter(b=>b.getClientRects().length).map(r)};
});
function assertFirstScreen(g,label) {
 assert.ok(g?.sheet,`${label}: a visible panel`);
 assert.equal(g.scrollTop,0,`${label}: no scroll`);
 assert.equal(g.overflow,0,`${label}: no horizontal overflow`);
 for(const k of ['head','meaning'])assert.ok(g[k]&&g[k].top>=g.body.top-.5&&g[k].bottom<=g.body.bottom+.5,`${label}: ${k} visible ${JSON.stringify(g[k])}`);
 assert.equal(g.grades.length,4,`${label}: four grade buttons`);
 for(const b of g.grades)assert.ok(b.top>=g.sheet.top&&b.bottom<=Math.min(g.sheet.bottom,g.vh)+.5,`${label}: grades visible`);
}
const shot=async(f,name)=>{if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/${name}.png`});};
const savedShenti=[{id:'card-shenti',word_text:'身体',base_form:'身体',meaning:'몸',language:'Chinese',created_at:new Date(Date.now()-86400000).toISOString(),interval:3,ease_factor:2.5,repetitions:1,
 last_reviewed_at:new Date(Date.now()-86400000).toISOString(),next_review_at:new Date(Date.now()+4*86400000).toISOString(),source_material_id:ID}];

test('390 owner zh: 드래그 → [한 단어로 묶기] → 확인 줄(이 자료만 · 단어장 안내) → 카드 身体素质 · 직접 묶은 단어 → 새로고침 → 전체 재분석 → 유지, 쓰기는 RPC·이력뿐',{timeout:240000},async()=>{
 const m=build('Chinese');
 const f=await open(m,{saved:savedShenti});
 try{
  await drag(f,'id_0_2','id_0_3');
  const merge=sentencePanel(f).getByRole('button',{name:'한 단어로 묶기',exact:true});
  await merge.waitFor();
  assert.equal(await f.page.locator('#inspector-sentence-tab').getAttribute('aria-selected'),'true','the [문장] tab holds the merge row');
  assert.equal(await merge.isEnabled(),true);
  const box=await merge.boundingBox();assert.ok(box.height>=44,`merge target ≥ 44px: ${box.height}`);
  // 자리: 문장 원문 줄 아래, 번역 위(목업)
  const order=await f.page.evaluate(()=>{const p=[...document.querySelectorAll('#inspector-sentence')].find(e=>e.getClientRects().length);const y=s=>p.querySelector(s)?.getBoundingClientRect().top??null;return {orig:y('.pdf-context__original'),merge:y('.viewer-boundary-merge'),text:y('.pdf-context__text')};});
  if(order.orig!==null)assert.ok(order.orig<order.merge,'below the sentence');
  if(order.text!==null)assert.ok(order.merge<order.text,'above the translation');
  await shot(f,'boundary-merge-row-390');
  await merge.click();
  const confirm=sentencePanel(f).locator('.viewer-boundary-confirm');
  await confirm.waitFor();
  assert.equal((await confirm.locator('.viewer-boundary-confirm__preview').innerText()).replace(/\s+/g,' ').trim(),'身体 + 素质 → 身体素质');
  const scope=confirm.getByRole('radio',{name:'이 자료만'});
  assert.equal(await scope.isChecked(),true,'scope ① only');
  assert.equal(await confirm.getByRole('radio').count(),1,'no ②③ scope in PR③');
  assert.equal((await confirm.locator('.viewer-boundary-confirm__note').innerText()).trim(),'단어장의 身体은(는) 그대로 있어요.');
  for(const name of ['묶기','취소']){const b=await confirm.getByRole('button',{name,exact:true}).boundingBox();assert.ok(b.height>=44,`${name} ≥ 44px`);}
  assert.doesNotMatch(await confirm.innerText(),/\bAI\b/);
  await shot(f,'boundary-confirm-390');
  const mark=f.requests.length;
  await confirm.getByRole('button',{name:'묶기',exact:true}).click();
  await card(f).locator('.word-detail-card__meaning').getByText('신체 조건',{exact:true}).waitFor();
  assert.equal((await card(f).locator('.reader-card-headword [data-glyph-i]').allTextContents()).join(''),'身体素质','headword is the merged word');
  const origin=card(f).locator('.reader-card-boundary');
  assert.equal((await origin.innerText()).replace(/\s+/g,' ').trim(),'직접 묶은 단어 · 나누기');
  const undo=card(f).locator('.reader-card-boundary-undo');
  assert.equal((await undo.innerText()).replace(/\s+/g,' ').trim(),'묶었어요 · 되돌리기');
  assert.doesNotMatch(await card(f).innerText(),/\bAI\b/,'no 「AI」 label');
  await shot(f,'boundary-merged-card-390');
  assertFirstScreen(await measure(f.page),'zh 390 merged card');
  await until(async()=>(await bodyLine(f,0)).length===6);
  assert.deepEqual(await bodyLine(f,0),['运动员','的','身体素质','非常','好','。']);
  // 저장: RPC 1회(원문 그대로) · 이력 1행 · 그 줄만 분석
  assert.equal(f.rpc.length,1);
  assert.equal(f.rpc[0].p_raw,m.raw);assert.equal(f.rpc[0].p_expected_raw,m.raw);
  assert.deepEqual(f.analyze.at(-1).boundaries,[{line:0,start:4,end:8,text:'身体素质',cuts:[],id:'b_0_4_8'}]);
  assert.deepEqual(f.analyze.at(-1).lines,['运动员的身体素质非常好。']);
  assert.equal(f.corrections.length,1);
  assert.deepEqual(f.corrections[0].after_value,{source:'boundary_edit',id:'b_0_4_8',cuts:[],scope:'material'});
  assert.equal(row(f).processed_json.metadata.viewerBoundaries.edits[0].status,'applied');
  assert.equal(row(f).raw_text,m.raw,'source text untouched');
  await f.page.waitForTimeout(400);
  assertOnlyBoundaryWrites(f,'merge',mark);
  // 새로고침 → 유지
  await f.page.reload({waitUntil:'domcontentloaded'});
  await f.page.locator('[data-source-token="id_0_0"]').waitFor();
  assert.deepEqual(await bodyLine(f,0),['运动员','的','身体素质','非常','好','。'],'kept after reload');
  // 전체 재분석 → 서버 적용으로 유지(기록 applied, 묶은 토큰 id 승계)
  const mergedId=(await tokenTexts(f,0))[2];
  const mark2=f.requests.length;
  await f.page.getByRole('button',{name:'학습',exact:true}).click();await f.page.getByRole('dialog',{name:'학습'}).getByRole('button',{name:/^자료 관리/}).click(); // AD-R2 Q1 ③: 툴바 ⋯ → 「학습」 창 항목
  await f.page.locator('.reanalyze-panel__item').filter({hasText:'전체 분석'}).click();
  await f.page.getByText('분석 완료!',{exact:true}).waitFor({timeout:30000});
  assert.ok(f.analyze.some(b=>b.boundaries?.some(x=>x.text==='身体素质')),'reanalysis carries the record');
  await until(async()=>(await tokenTexts(f,0))[2]===mergedId);
  assert.deepEqual(await bodyLine(f,0),['运动员','的','身体素质','非常','好','。'],'kept after reanalysis');
  assert.equal(row(f).processed_json.metadata.viewerBoundaries.edits[0].status,'applied');
  assert.equal(row(f).raw_text,m.raw);
  await f.page.waitForTimeout(400);
  assertOnlyBoundaryWrites(f,'reanalysis',mark2);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('390 owner zh: ⋯ 「나누기」(원래 칼선 = 서버 0) → 원래 토큰 · 「되돌리기」 → 다시 묶음 · ⋯ 「옆 단어와 묶기」 → 非常好',{timeout:240000},async()=>{
 const m=mergedZh();
 const f=await open(m);
 try{
  await f.page.locator('[data-source-token="id_0_e2_seed0001"]').click();
  await card(f).locator('.word-detail-card__meaning').getByText('신체 조건',{exact:true}).waitFor();
  assert.equal(await card(f).locator('.reader-card-boundary-undo').count(),0,'no undo line before an edit');
  const more=f.page.locator('.viewer-inspector__header').filter({visible:true}).getByRole('button',{name:'분석 고치기',exact:true});
  await more.click();
  const menu=f.page.getByRole('menu');await menu.waitFor();
  assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),['뜻·발음 수정','옆 단어와 묶기','나누기']);
  await menu.getByRole('menuitem',{name:'나누기',exact:true}).click();
  const split=card(f).locator('.viewer-boundary-split');
  await split.waitFor();
  assert.equal((await split.locator('h3').innerText()).trim(),'어디서 나눌까요?');
  const cuts=split.locator('.viewer-boundary-split__cut');
  assert.equal(await cuts.count(),3,'one cut slot between each character');
  for(const c of await cuts.all()){const b=await c.boundingBox();assert.ok(b.width>=44&&b.height>=44,`cut slot 44px: ${JSON.stringify(b)}`);}
  const go=split.getByRole('button',{name:'나누기',exact:true});
  assert.equal(await go.isDisabled(),true,'no cut → [나누기] off');
  await split.getByRole('button',{name:'体와(과) 素 사이에서 나누기',exact:true}).click();
  assert.equal(await split.getByRole('button',{name:'体와(과) 素 사이에서 나누기',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal((await split.locator('.viewer-boundary-split__preview').innerText()).replace(/\s+/g,' ').trim(),'身体 │ 素质');
  await shot(f,'boundary-split-390');
  const mark=f.requests.length,calls=f.analyze.length;
  await go.click();
  await until(async()=>(await tokenTexts(f,0)).join(',')==='id_0_0,id_0_1,id_0_2,id_0_3,id_0_4,id_0_5,id_0_6');
  assert.equal(f.analyze.length,calls,'restoring the original cut needs no analysis');
  assert.equal(row(f).processed_json.metadata.viewerBoundaries,undefined,'no record left');
  assert.deepEqual(row(f).processed_json.dictionary.id_0_2,LINES.Chinese[0][2],'the original token object is back');
  await card(f).locator('.word-detail-card__meaning').getByText('몸',{exact:true}).waitFor();
  const undo=card(f).locator('.reader-card-boundary-undo');
  assert.equal((await undo.innerText()).replace(/\s+/g,' ').trim(),'나눴어요 · 되돌리기');
  await undo.getByRole('button',{name:'되돌리기',exact:true}).click();
  await until(async()=>(await tokenTexts(f,0))[2]==='id_0_e2_seed0001');
  assert.deepEqual(row(f).processed_json.metadata.viewerBoundaries.edits.map(e=>e.id),['b_0_4_8']);
  assert.equal(f.analyze.length,calls,'undo needs no analysis');
  await card(f).locator('.word-detail-card__meaning').getByText('신체 조건',{exact:true}).waitFor();
  // ⋯ 옆 단어와 묶기 — 非常 + 好(뒤 단어)
  await closeSheet(f);
  await f.page.locator('[data-source-token="id_0_4"]').click();
  await card(f).locator('.word-detail-card__meaning').getByText('매우',{exact:true}).waitFor();
  await more.click();await menu.waitFor();
  await menu.getByRole('menuitem',{name:'옆 단어와 묶기',exact:true}).click();
  const confirm=card(f).locator('.viewer-boundary-confirm');
  await confirm.waitFor();
  const next=confirm.getByRole('button',{name:'뒤 단어와',exact:true});
  assert.equal(await next.getAttribute('aria-pressed'),'true','reading order: the next word first');
  assert.equal((await confirm.locator('.viewer-boundary-confirm__preview').innerText()).replace(/\s+/g,' ').trim(),'非常 + 好 → 非常好');
  const prev=confirm.getByRole('button',{name:'앞 단어와',exact:true});
  await prev.click();
  assert.equal((await confirm.locator('.viewer-boundary-confirm__preview').innerText()).replace(/\s+/g,' ').trim(),'身体素质 + 非常 → 身体素质非常');
  await next.click();
  await confirm.getByRole('button',{name:'묶기',exact:true}).click();
  await card(f).locator('.word-detail-card__meaning').getByText('아주 좋다',{exact:true}).waitFor();
  await until(async()=>(await bodyLine(f,0)).includes('非常好'));
  assert.deepEqual(await bodyLine(f,0),['运动员','的','身体素质','非常好','。']);
  assert.equal(f.rpc.length,3,'split · undo · merge — three atomic writes');
  assert.equal(f.corrections.length,3,'one history row each');
  assert.ok(f.corrections.every(c=>c.after_value.source==='boundary_edit'));
  await f.page.waitForTimeout(400);
  assertOnlyBoundaryWrites(f,'split · undo · neighbor merge',mark);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('1280 owner zh: 옆 패널에서 드래그 묶기 · 카드 [나누기] 패널',{timeout:240000},async()=>{
 const m=build('Chinese');
 const f=await open(m,{width:1280,height:900});
 try{
  await drag(f,'id_0_2','id_0_3');
  await sentencePanel(f).getByRole('button',{name:'한 단어로 묶기',exact:true}).click();
  await sentencePanel(f).locator('.viewer-boundary-confirm').getByRole('button',{name:'묶기',exact:true}).click();
  await card(f).locator('.word-detail-card__meaning').getByText('신체 조건',{exact:true}).waitFor();
  await shot(f,'boundary-merged-card-1280');
  await card(f).locator('.reader-card-boundary').getByRole('button',{name:'나누기',exact:true}).click();
  const split=card(f).locator('.viewer-boundary-split');
  await split.waitFor();
  const g=await f.page.evaluate(()=>{const p=[...document.querySelectorAll('.viewer-inspector')].find(e=>e.getClientRects().length);return {w:p.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth,
   split:document.querySelector('.viewer-boundary-split').getBoundingClientRect().width};});
  assert.ok(g.split<=g.w,'the split panel fits the side panel');
  assert.equal(g.overflow,0);
  await shot(f,'boundary-split-1280');
  await split.getByRole('button',{name:'취소',exact:true}).click();
  assert.equal(await split.count(),0);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('진입점 0: 비소유자(드래그·⋯·카드) · 한국어 자료(소유자)',{timeout:240000},async()=>{
 const viewer=await open(mergedZh(),{own:false});
 try{
  await drag(viewer,'id_0_0','id_0_1');
  await sentencePanel(viewer).locator('.pdf-context__text, .pdf-side__empty').first().waitFor();
  assert.equal(await viewer.page.getByRole('button',{name:'한 단어로 묶기'}).count(),0,'no merge for a non-owner');
  await closeSheet(viewer);
  await viewer.page.locator('[data-source-token="id_0_e2_seed0001"]').click();
  await card(viewer).locator('.word-detail-card__meaning').getByText('신체 조건',{exact:true}).waitFor();
  assert.equal(await viewer.page.locator('.viewer-inspector__header').filter({visible:true}).getByRole('button',{name:'분석 고치기'}).count(),0,'no ⋯');
  assert.equal(await card(viewer).locator('.reader-card-boundary').count(),0,'no 「직접 묶은 단어 · 나누기」 for a non-owner');
  assert.equal(await card(viewer).getByRole('button',{name:'나누기'}).count(),0);
  assert.deepEqual(writes(viewer).filter(r=>/viewer_replace_analysis|token_corrections/.test(r.url)),[]);
  assert.deepEqual(viewer.errors,[]);
 }finally{await viewer.context.close();}
 const ko=await open(build('Korean'));
 try{
  await drag(ko,'id_0_0','id_0_2');
  await ko.page.waitForTimeout(600);
  assert.equal(await ko.page.getByRole('button',{name:'한 단어로 묶기'}).count(),0,'Korean: no merge');
  await closeSheet(ko);
  await ko.page.locator('[data-source-token="id_0_2"]').click();
  await card(ko).waitFor();
  await ko.page.waitForTimeout(400);
  assert.equal(await ko.page.getByRole('menuitem',{name:'나누기'}).count(),0);
  assert.equal(await card(ko).getByRole('button',{name:'나누기'}).count(),0,'Korean: no split');
  assert.deepEqual(writes(ko).filter(r=>/viewer_replace_analysis|token_corrections/.test(r.url)),[]);
 }finally{await ko.context.close();}
});

test('재분석에서 적용하지 못한 경계: 목업 알림 + [보기] → [문장] 탭 목록 · 겹치는 드래그는 꺼진 버튼 + 이유 한 줄',{timeout:240000},async()=>{
 const m=mergedZh();
 const f=await open(m,{pendingAll:true});
 try{
  await f.page.getByRole('button',{name:'학습',exact:true}).click();await f.page.getByRole('dialog',{name:'학습'}).getByRole('button',{name:/^자료 관리/}).click(); // AD-R2 Q1 ③: 툴바 ⋯ → 「학습」 창 항목
  await f.page.locator('.reanalyze-panel__item').filter({hasText:'전체 분석'}).click();
  const toast=f.page.getByText('분석을 다시 했어요. 직접 고친 단어 경계 1개는 이번 분석에 적용하지 못했어요.',{exact:false});
  await toast.waitFor({timeout:30000});
  await until(()=>row(f).processed_json.metadata.viewerBoundaries?.edits?.[0]?.status==='pending');
  await f.page.getByRole('button',{name:'보기',exact:true}).last().click();
  const list=sentencePanel(f).locator('.viewer-boundary-pending');
  await list.waitFor();
  assert.equal((await list.locator('h2').innerText()).trim(),'적용하지 못한 단어 경계 · 1개');
  assert.match(await list.innerText(),/身体素质/);
  assert.match(await list.innerText(),/运动员的身体素质非常好。/);
  await shot(f,'boundary-pending-list-390');
  // 분석기 토큰(身体|素质)이 다시 나왔고 기록은 pending — 그 자리를 덮는 드래그는 꺼진 버튼 + 이유
  await until(async()=>(await bodyLine(f,0)).join('|')==='运动员|的|身体|素质|非常|好|。');
  const ids=await tokenTexts(f,0);
  await drag(f,ids[2],ids[3]);
  const merge=sentencePanel(f).getByRole('button',{name:'한 단어로 묶기',exact:true});
  await merge.waitFor();
  assert.equal(await merge.isDisabled(),true);
  assert.equal((await sentencePanel(f).locator('.viewer-boundary__reason').innerText()).trim(),'적용하지 못한 단어 경계와 겹쳐서 고칠 수 없어요');
  // 문장부호를 넘는 드래그도 꺼진 버튼 + 이유
  await drag(f,ids[5],ids[6]);
  await sentencePanel(f).getByRole('button',{name:'한 단어로 묶기',exact:true}).waitFor();
  await until(async()=>(await sentencePanel(f).locator('.viewer-boundary__reason').innerText()).trim()==='문장부호를 넘어서는 묶을 수 없어요');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('영어 picked up · 일본어 天気予報 묶기(390) — 공백 든 토큰 · 읽기 이어 붙임',{timeout:240000},async()=>{
 const en=await open(build('English'));
 try{
  await drag(en,'id_0_1','id_0_2');
  await sentencePanel(en).getByRole('button',{name:'한 단어로 묶기',exact:true}).click();
  const confirm=sentencePanel(en).locator('.viewer-boundary-confirm');
  assert.equal((await confirm.locator('.viewer-boundary-confirm__preview').innerText()).replace(/\s+/g,' ').trim(),'picked + up → picked up');
  await confirm.getByRole('button',{name:'묶기',exact:true}).click();
  await card(en).locator('.word-detail-card__meaning').getByText('집어 올렸다',{exact:true}).waitFor();
  await until(async()=>(await bodyLine(en,0)).length===5);
  assert.deepEqual(await bodyLine(en,0),['I','picked up','the','book','.']);
  assert.equal(en.rpc[0].p_raw,build('English').raw);
  const text=await en.page.evaluate(()=>document.querySelector('.reader-area').innerText.replace(/\s+/g,' '));
  assert.match(text,/I picked up the book/,'word spacing kept around the spaced token');
  await shot(en,'boundary-en-390');
  assertOnlyBoundaryWrites(en,'en merge');
  assert.deepEqual(en.errors,[]);
 }finally{await en.context.close();}
 const ja=await open(build('Japanese'));
 try{
  await drag(ja,'id_0_2','id_0_3');
  await sentencePanel(ja).getByRole('button',{name:'한 단어로 묶기',exact:true}).click();
  await sentencePanel(ja).locator('.viewer-boundary-confirm').getByRole('button',{name:'묶기',exact:true}).click();
  await card(ja).locator('.word-detail-card__meaning').getByText('일기 예보',{exact:true}).waitFor();
  await until(async()=>(await bodyLine(ja,0)).includes('天気予報'));
  assert.deepEqual(await bodyLine(ja,0),['明日','は','天気予報','を','見る','。']);
  assertOnlyBoundaryWrites(ja,'ja merge');
  assert.deepEqual(ja.errors,[]);
 }finally{await ja.context.close();}
});

// ───────────────────────── AD-R4 PR④ 경계 후보 「한 단어로 묶을까요?」(설계서 docs/manabi-viewer-v2-ad-r4.md §5.2·§6.2·§6.4·§10 PR④) ─────────────────────────
// 서버 상수 ZH_BOUNDARY_REVIEW는 꺼진 채라 운영 자료에는 후보 표식이 없다 — 여기서는 미등재 쌍 身体+素质의 앞 토큰에 boundarySuggest가 실린
// 처리 결과(합성 픽스처)로 화면을 잰다. [묶기]는 AD-R3 확인 줄(같은 RPC·이력·그 줄 분석), [아니요]는 같은 원자 RPC로 그 꼴을 접는다.
function suggestZh() {
 const tokens=[LINES.Chinese[0].map((t,i)=>({id:`id_0_${i}`,token:i===2?{...t,boundarySuggest:'身体素质'}:t})),LINES.Chinese[1].map((t,i)=>({id:`id_1_${i}`,token:t}))];
 return build('Chinese',{tokens});
}
const reviewLine=f=>f.page.locator('.viewer-sense-review-line');
const reviewList=f=>sentencePanel(f).locator('.viewer-sense-review');
const suggestRow=f=>reviewList(f).locator('[data-boundary-suggest="身体素质"]');

test('AD-R4 PR④ 390 owner zh: 「뜻 확인 필요 1개」 → 목록 경계 후보 줄 → [묶기] → AD-R3 확인 줄 → 묶음(RPC·이력·그 줄 분석) · 줄 「묶었어요」 · N 0',{timeout:240000},async()=>{
 const m=suggestZh();
 const f=await open(m);
 try{
  const line=reviewLine(f);
  await line.waitFor();
  assert.equal((await line.innerText()).replace(/\s+/g,' ').trim(),'ⓘ 뜻 확인 필요 1개 보기','N counts the boundary suggestion');
  await line.getByRole('button',{name:'보기',exact:true}).click();
  const list=reviewList(f);
  await list.waitFor();
  assert.equal(await f.page.locator('#inspector-sentence-tab').getAttribute('aria-selected'),'true','the list opens in the [문장] tab');
  assert.equal((await list.locator('h2').innerText()).trim(),'뜻 확인 필요 · 1개');
  const item=suggestRow(f);
  assert.equal((await item.locator('.viewer-sense-review__sentence').innerText()).trim(),'运动员的身体 素质非常好。');
  assert.equal((await item.locator('mark').innerText()).trim(),'身体 素质');
  assert.equal((await item.locator('.viewer-sense-review__ask').innerText()).trim(),'한 단어로 묶을까요?');
  for(const name of ['묶기','아니요']){const b=await item.getByRole('button',{name,exact:true}).boundingBox();assert.ok(b.height>=44,`${name} ≥ 44px: ${JSON.stringify(b)}`);}
  assert.doesNotMatch(await list.innerText(),/\bAI\b/,'no 「AI」 label');
  const g=await f.page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth}));
  assert.equal(g.overflow,0);
  await shot(f,'boundary-suggest-row-390');
  const mark=f.requests.length;
  await item.getByRole('button',{name:'묶기',exact:true}).click();
  const confirm=item.locator('.viewer-boundary-confirm');
  await confirm.waitFor();
  assert.equal((await confirm.locator('.viewer-boundary-confirm__preview').innerText()).replace(/\s+/g,' ').trim(),'身体 + 素质 → 身体素质');
  assert.equal(await confirm.getByRole('radio',{name:'이 자료만'}).isChecked(),true);
  await shot(f,'boundary-suggest-confirm-390');
  assert.equal(f.rpc.length,0,'opening the confirm row writes nothing');
  await confirm.getByRole('button',{name:'묶기',exact:true}).click();
  await card(f).locator('.word-detail-card__meaning').getByText('신체 조건',{exact:true}).waitFor();
  await until(async()=>(await bodyLine(f,0)).length===6);
  assert.deepEqual(await bodyLine(f,0),['运动员','的','身体素质','非常','好','。']);
  // AD-R3 묶기 흐름 그대로: 그 줄만 boundaries와 함께 분석 · RPC 1회(원문 그대로) · 이력 1행
  assert.deepEqual(f.analyze.at(-1).boundaries,[{line:0,start:4,end:8,text:'身体素质',cuts:[],id:'b_0_4_8'}]);
  assert.equal(f.rpc.length,1);
  assert.equal(f.rpc[0].p_raw,m.raw);
  assert.equal(f.corrections.length,1);
  assert.deepEqual(f.corrections[0].after_value,{source:'boundary_edit',id:'b_0_4_8',cuts:[],scope:'material'});
  assert.equal(row(f).processed_json.metadata.viewerBoundaries.edits[0].status,'applied');
  // 후보가 사라져 N = 0 — 본문 위 줄이 없고, 목록 줄은 「묶었어요」로 남는다
  await until(async()=>(await reviewLine(f).count())===0);
  await f.page.locator('#inspector-sentence-tab').click();
  await suggestRow(f).getByText('묶었어요',{exact:true}).waitFor();
  assert.equal(await suggestRow(f).getByRole('button',{name:'묶기',exact:true}).count(),0);
  await f.page.waitForTimeout(400);
  assertOnlyBoundaryWrites(f,'suggest merge',mark);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AD-R4 PR④ 390 owner zh: [아니요] → 원자 RPC 1회로 그 꼴만 접음(토큰·원문 그대로) → 새로고침 · 전체 재분석(서버가 후보를 다시 달아도) 뒤에도 접힌 채 · 열람자는 줄 0',{timeout:240000},async()=>{
 const m=suggestZh();
 const f=await open(m,{suggest:true});
 try{
  await reviewLine(f).waitFor();
  await reviewLine(f).getByRole('button',{name:'보기',exact:true}).click();
  await suggestRow(f).waitFor();
  const mark=f.requests.length;
  const before=structuredClone(row(f).processed_json);
  await suggestRow(f).getByRole('button',{name:'아니요',exact:true}).click();
  await suggestRow(f).getByText('확인했어요',{exact:true}).waitFor();
  assert.equal(f.rpc.length,1,'one atomic write');
  assert.equal(f.rpc[0].p_raw,m.raw);
  assert.deepEqual(f.rpc[0].p_json.metadata.viewerBoundaryDismissed,['身体素质']);
  assert.deepEqual(f.rpc[0].p_json.dictionary,before.dictionary,'tokens untouched');
  assert.deepEqual(f.rpc[0].p_json.sequence,before.sequence);
  assert.equal(f.analyze.length,0,'no analysis');
  assert.equal(f.corrections.length,0,'no correction history row');
  await until(async()=>(await reviewLine(f).count())===0);
  await f.page.waitForTimeout(400);
  assertOnlyBoundaryWrites(f,'suggest dismiss',mark);
  // 새로고침 → 그대로 접힘
  await f.page.reload({waitUntil:'domcontentloaded'});
  await f.page.locator('[data-source-token="id_0_0"]').waitFor();
  await f.page.waitForTimeout(600);
  assert.equal(await reviewLine(f).count(),0,'still dismissed after reload');
  // 전체 재분석 — 서버(흉내)가 身体에 후보 표식을 다시 달아도 접은 꼴은 접힌 채(원래 metadata를 이어 쓴다)
  await f.page.getByRole('button',{name:'학습',exact:true}).click();await f.page.getByRole('dialog',{name:'학습'}).getByRole('button',{name:/^자료 관리/}).click(); // AD-R2 Q1 ③: 툴바 ⋯ → 「학습」 창 항목
  await f.page.locator('.reanalyze-panel__item').filter({hasText:'전체 분석'}).click();
  await f.page.getByText('분석 완료!',{exact:true}).waitFor({timeout:30000});
  await until(()=>Object.values(row(f).processed_json.dictionary).some(t=>t.boundarySuggest==='身体素质'));
  assert.deepEqual(row(f).processed_json.metadata.viewerBoundaryDismissed,['身体素质']);
  await f.page.waitForTimeout(600);
  assert.equal(await reviewLine(f).count(),0,'still dismissed after reanalysis');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 const viewer=await open(suggestZh(),{own:false});
 try{
  await viewer.page.waitForTimeout(800);
  assert.equal(await reviewLine(viewer).count(),0,'no line for a non-owner');
  assert.deepEqual(writes(viewer).filter(r=>/viewer_replace_analysis|token_corrections/.test(r.url)),[]);
 }finally{await viewer.context.close();}
});

test('AD-R4 PR④ 1280 owner zh: 옆 패널 목록의 경계 후보 줄 · [묶기] 확인 줄이 패널 안에',{timeout:240000},async()=>{
 const f=await open(suggestZh(),{width:1280,height:900});
 try{
  await reviewLine(f).getByRole('button',{name:'보기',exact:true}).click();
  await suggestRow(f).getByRole('button',{name:'묶기',exact:true}).click();
  const confirm=suggestRow(f).locator('.viewer-boundary-confirm');
  await confirm.waitFor();
  const g=await f.page.evaluate(()=>{const p=[...document.querySelectorAll('.viewer-inspector')].find(e=>e.getClientRects().length);const row=document.querySelector('[data-boundary-suggest]');
   return {w:p.getBoundingClientRect().right,row:row.getBoundingClientRect().right,overflow:document.documentElement.scrollWidth-innerWidth};});
  assert.ok(g.row<=g.w+.5,'the row fits the side panel');
  assert.equal(g.overflow,0);
  await shot(f,'boundary-suggest-confirm-1280');
  await confirm.getByRole('button',{name:'취소',exact:true}).click();
  await suggestRow(f).getByText('한 단어로 묶을까요?',{exact:true}).waitFor();
  assert.equal(f.rpc.length,0);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
