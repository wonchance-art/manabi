// 단어창 AE-R1(VIEWER-V2-ROUNDS-001 §2·§3, 설계서 docs/manabi-viewer-v2-ae-r1.md) — 실제 뷰어, 합성 자료만.
// 계정·제공자·DB 쓰기 없음. PR ①: 표제어 일괄 조회(§5.3) — 자료를 열 때 고유 표제어를 100개씩 받아
// 카드의 ['token-dict', lang, key] 캐시를 채운다. 요청 수 = ⌈고유 표제어/100⌉, 카드를 열 때 단건 조회 0,
// 실패하면 조용히 기존 단건 경로, 비로그인·한국어는 요청 0. 화면 출력은 바뀌지 않는다(같은 데이터를 더 일찍).
// PR ②(골격·제거·계약, 설계서 §7.3): 첫 화면 기하(390 시트 440px · 1280 옆 패널) · 경로 보류 · 이동 0 ·
// 접힘 0 · 버튼 0 · 문장 줄 한 문장 단위 · 한·일·영 회귀를 이 파일에 더한다.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';
import {legacyLearningSnapshot} from './fixtures/learning-snapshot.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const punct=/^[。，、.,!?！？]$/;
// 고유 표제어 255개(250 + 他·道歉·了·景色·壮观) — 이합사(道·歉 → 道歉) + 壮观 + 반복(了) — 문장부호·개행은 표제어가 아니다.
function zhMaterial() {
 const words=Array.from({length:250},(_,i)=>String.fromCodePoint(0x4e00+i*3,0x4e01+i*3));
 const lines=[];
 for(let i=0;i<words.length;i+=25)lines.push([...words.slice(i,i+25).map(w=>({text:w,base_form:w,furigana:'',meaning:`뜻${w}`,pos:'명사'})),{text:'。',base_form:'。',pos:'기호'}]);
 lines.push([
  {text:'他',base_form:'他',furigana:'tā',meaning:'그',pos:'대명사'},
  {text:'道',base_form:'道',sep_link:'道歉',furigana:'dào',meaning:'사과하다',pos:'동사'},
  {text:'了',base_form:'了',furigana:'le',meaning:'~했다',pos:'조사'},
  {text:'歉',base_form:'歉',sep_link:'道歉',furigana:'qiàn',meaning:'사과하다',pos:'동사'},
  {text:'，',base_form:'，',pos:'기호'},
  {text:'景色',base_form:'景色',furigana:'jǐng sè',meaning:'경치',pos:'명사'},
  {text:'壮观',base_form:'壮观',furigana:'zhuàng guān',meaning:'웅장하다, 장관이다',pos:'형용사'},
  {text:'了',base_form:'了',furigana:'le',meaning:'~했다',pos:'조사'},
  {text:'。',base_form:'。',pos:'기호'},
 ]);
 return build(lines,'Chinese');
}
function build(lines,language) {
 const texts=lines.map(l=>l.map(w=>w.text).join(language==='English'||language==='Korean'?' ':''));
 const sequence=[],dictionary={},keys=[];
 lines.forEach((words,line)=>{
  words.forEach((w,i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]=w;const key=w.sep_link||w.base_form||w.text;if(!punct.test(w.text)&&!keys.includes(key))keys.push(key);});
  if(line<lines.length-1){const id=`id_${line}_${words.length}`;sequence.push(id);dictionary[id]={text:'\n',base_form:'',furigana:'',meaning:'',pos:'개행'};}
 });
 return {texts,sequence,dictionary,keys,language};
}
const dictRows={
 Chinese:{道歉:{meanings:[{meaning:'사과하다',priority:1,pos:'동사'}],reading:'dào qiàn',pos:'동사'},
  壮观:{meanings:[{meaning:'(경관이) 웅장하다, 장관이다',priority:1,pos:'형용사'}],reading:'zhuàng guān',pos:'형용사·명사'}},
 Japanese:{食べる:{meanings:[{meaning:'먹다',priority:1}],reading:'たべる',pos:'동사'}},
};

const SENTENCE_PREFETCH='viewer-sentence-prefetch';
const notPrefetch=r=>r.purpose!==SENTENCE_PREFETCH;
async function open(material,{guest=false,dict='ok',prefs={focusMode:false,autoSpeakOnClick:false},width=390,height=844,saved=null,own=false,rows:rowOverride=null,details={}}={}) {
 const f=await fixture({width,guest});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(({language,prefs})=>{
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{[language]:prefs}}));
 },{language:material.language,prefs});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용'})}));
 await f.context.route(/\/api\/analyze(\/korean)?$/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify({results:[]})}));
 // 픽스처 뒤에 등록한 경로가 먼저 받는다 — morpheme_dictionary 요청만 세고 합성 행으로 답한다.
 // PR ③: 공유 detail_text 지연 조회(select=detail_text)는 f.detail로 따로 센다 — f.single은 카드 사전 행(뜻·읽기) 단건 조회만.
 f.bulk=[];f.single=[];f.detail=[];f.requests=[];
 // AE-R2 PR②: 카드가 0.3초 열려 있으면 그 줄 번역 선처리(/api/gemini, purpose 'viewer-sentence-prefetch')가 1회 나간다 —
 // 쓰기도 단어 설명 AI도 아니라 아래 「쓰기 0」·「AI 호출 0」 단언에서 그것만 뺀다(다른 AI 호출은 그대로 잡는다).
 f.page.on('request',req=>{
  let purpose;
  if(/\/api\/gemini/.test(req.url()))try{purpose=req.postDataJSON()?.purpose;}catch{purpose=undefined;}
  f.requests.push({method:req.method(),url:req.url(),...(purpose===SENTENCE_PREFETCH?{purpose}:{})});
 });
 const rows=rowOverride||dictRows[material.language]||{};
 await f.context.route('**/rest/v1/morpheme_dictionary**',route=>{
  const req=route.request(),url=new URL(req.url());
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  assert.equal(req.method(),'GET','dictionary is read-only here');
  const filter=url.searchParams.get('base_form')||'';
  const send=body=>route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
  if(filter.startsWith('in.(')){
   const keys=filter.slice(4,-1).split(',').map(k=>k.replace(/^"|"$/g,''));
   f.bulk.push({keys,language:url.searchParams.get('language'),select:url.searchParams.get('select')});
   if(dict==='fail')return route.fulfill({status:503,contentType:'application/json',headers:cors,body:JSON.stringify({message:'fixture outage'})});
   return send(keys.filter(k=>rows[k]).map(k=>({base_form:k,...rows[k]})));
  }
  const key=filter.slice(3);
  if(url.searchParams.get('select')==='detail_text'){
   f.detail.push(key);const d=details[key]?{detail_text:details[key]}:null;
   return send(req.headers().accept?.includes('vnd.pgrst.object')?d:d?[d]:[]);
  }
  f.single.push(key);
  const row=rows[key]||null;
  return send(req.headers().accept?.includes('vnd.pgrst.object')?row:row?[row]:[]);
 });
 // 저장 상태(합성) — 설계서 §7.3: legacyLearningSnapshot에 행을 넣어 「저장(복습 전)」을 만든다.
 if(saved)await f.context.route('**/api/learning/vocabulary**',route=>{
  const url=new URL(route.request().url());
  if(route.request().method()!=='GET'||url.searchParams.get('view')!=='learning')return route.fallback();
  return route.fulfill({contentType:'application/json',body:JSON.stringify(legacyLearningSnapshot({actorId:owner,rows:saved,fields:url.searchParams.get('fields')}))});
 });
 f.rows.push({id:94171,user_id:owner,...(own?{owner_id:owner}:{}),title:'표제어 일괄 조회 검수',raw_text:material.texts.join('\n'),source_type:'text',created_at:new Date().toISOString(),
  processed_json:{status:'completed',metadata:{language:material.language},sequence:material.sequence,dictionary:material.dictionary}});
 await f.page.goto('/viewer/94171',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 return f;
}
const lastLine=m=>m.texts.length-1;
const tap=async(f,id,meaning)=>{
 // 390px 시트가 본문 아래쪽을 덮으므로 앞 카드를 닫고 누른다.
 const close=f.page.getByRole('button',{name:'보조 패널 닫기',exact:true});
 if(await close.count()&&await close.isVisible())await close.click();
 await f.page.locator(`[data-source-token="${id}"]`).click();
 await f.page.locator('.word-detail-card__meaning').getByText(meaning,{exact:true}).waitFor();
};
const until=async(check,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,50));}assert.fail('condition not met in time');};

test('zh 255 headwords → 3 bulk requests of ≤100; opening cards reads the cache (0 single lookups)',{timeout:180000},async()=>{
 const m=zhMaterial();
 const f=await open(m);
 try{
  const expected=Math.ceil(m.keys.length/100);
  assert.equal(m.keys.length,255,'250 words + 他 · 道歉 · 了 · 景色 · 壮观');
  await until(()=>f.bulk.length>=expected);
  await f.page.waitForTimeout(500);
  assert.equal(f.bulk.length,expected,`requests = ceil(${m.keys.length}/100)`);
  assert.ok(f.bulk.every(b=>b.keys.length<=100&&b.language==='eq.Chinese'));
  assert.deepEqual(f.bulk.map(b=>b.select),Array(expected).fill('base_form,meanings,reading,pos'));
  const asked=f.bulk.flatMap(b=>b.keys);
  assert.deepEqual([...asked].sort(),[...m.keys].sort(),'each unique headword exactly once (sep_link → 道歉, no punctuation/newline)');
  assert.ok(asked.includes('道歉')&&!asked.includes('道')&&!asked.includes('歉')&&!asked.includes('。'));
  // 카드: 사전 행이 있는 단어·없는 단어·이합사 조각 모두 단건 조회 없이 그린다.
  const line=lastLine(m);
  await tap(f,`id_${line}_6`,'웅장하다, 장관이다');
  await tap(f,'id_0_3',`뜻${String.fromCodePoint(0x4e09,0x4e0a)}`);
  await tap(f,`id_${line}_1`,'사과하다');
  const head=f.page.locator('.reader-card-headword');
  await until(async()=>(await head.locator('.rt-an').allTextContents()).join(' ').includes('qiàn'));
  assert.deepEqual(await head.locator('.rt-an').allTextContents(),['dào','qiàn'],'base-form reading from the prefetched row');
  assert.equal(await f.page.locator('.word-detail-card__base').count(),0,'no 기본형 fallback label — the row was already there');
  await f.page.waitForTimeout(800);
  assert.deepEqual(f.single,[],'no single morpheme_dictionary lookup while cards open');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('bulk failure is silent: the card falls back to its existing single lookup and draws the same headword',{timeout:180000},async()=>{
 const m=zhMaterial();
 const f=await open(m,{dict:'fail'});
 try{
  await until(()=>f.bulk.length>=1);
  await f.page.waitForTimeout(500);
  assert.equal(f.bulk.length,1,'stops after the first failed chunk (no retry storm)');
  await tap(f,`id_${lastLine(m)}_1`,'사과하다');
  const head=f.page.locator('.reader-card-headword');
  await until(async()=>(await head.locator('.rt-an').allTextContents()).join(' ').includes('qiàn'));
  assert.deepEqual(await head.locator('.rt-an').allTextContents(),['dào','qiàn']);
  assert.deepEqual(f.single,['道歉'],'existing single path still serves the card');
  assert.equal(await f.page.locator('[role="alert"], .toast--error').filter({hasText:/사전|dictionary/}).count(),0,'no error surfaced');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('guest: no bulk request (RLS reads dictionary for authenticated users only)',{timeout:180000},async()=>{
 const m=zhMaterial();
 const f=await open(m,{guest:true});
 try{
  await f.page.waitForTimeout(1500);
  assert.equal(f.bulk.length,0);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('ja: one bulk request; conjugated token shows the dictionary-form reading without a single lookup',{timeout:180000},async()=>{
 const m=build([[
  {text:'今日',base_form:'今日',furigana:'きょう',meaning:'오늘',pos:'명사'},
  {text:'は',base_form:'は',furigana:'',meaning:'~은',pos:'조사'},
  {text:'寿司',base_form:'寿司',furigana:'すし',meaning:'초밥',pos:'명사'},
  {text:'を',base_form:'を',furigana:'',meaning:'~을',pos:'조사'},
  {text:'食べた',base_form:'食べる',furigana:'たべた',meaning:'먹었다',pos:'동사'},
  {text:'。',base_form:'。',pos:'기호'},
 ]],'Japanese');
 const f=await open(m);
 try{
  await until(()=>f.bulk.length>=1);
  await f.page.waitForTimeout(500);
  assert.equal(f.bulk.length,1);
  assert.deepEqual([...f.bulk[0].keys].sort(),[...m.keys].sort());
  assert.ok(f.bulk[0].keys.includes('食べる')&&!f.bulk[0].keys.includes('食べた'));
  await tap(f,'id_0_4','먹었다');
  const glyphs=()=>f.page.locator('.reader-card-headword .word-fit').evaluate(el=>{const c=el.cloneNode(true);c.querySelectorAll('.rt-an').forEach(x=>x.remove());return c.textContent;});
  await until(async()=>(await glyphs())==='食べる');
  await until(async()=>(await f.page.locator('.reader-card-headword .rt-an').allTextContents()).join('')==='た');
  await f.page.waitForTimeout(800);
  assert.equal(await f.page.locator('.word-detail-card__base').count(),0,'reading came from the prefetched row');
  assert.deepEqual(f.single,[]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('ko: no dictionary request at all (morpheme_dictionary does not serve Korean)',{timeout:180000},async()=>{
 const m=build([[
  {text:'오늘',base_form:'오늘',furigana:'',meaning:'today',pos:'명사'},
  {text:'날씨가',base_form:'날씨',furigana:'',meaning:'weather',pos:'명사'},
  {text:'좋다',base_form:'좋다',furigana:'',meaning:'good',pos:'형용사'},
  {text:'.',base_form:'.',pos:'기호'},
 ]],'Korean');
 const f=await open(m);
 try{
  await f.page.waitForTimeout(1500);
  assert.equal(f.bulk.length,0);
  assert.deepEqual(f.single,[]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// ───────────────────────── PR ② 단어창 골격(설계서 §7.3 · 정본 §3 합격) ─────────────────────────
// 합성 자료: 정본 목업 문장(眼前的体育场比照片上更壮观。) + 같은 단어가 두 문장에 나오는 줄(문장 줄 단위 검사).
function cardMaterial() {
 const w=(text,furigana,meaning,pos='명사')=>({text,base_form:text,furigana,meaning,pos});
 return build([
  [w('眼前','yǎn qián','눈앞'),w('的','de','~의','조사'),w('体育场','tǐ yù chǎng','경기장'),w('比','bǐ','~보다','전치사'),w('照片','zhào piàn','사진'),w('上','shàng','위'),w('更','gèng','더','부사'),w('壮观','zhuàng guān','웅장하다, 장관이다','형용사'),w('。','','','기호')],
  [w('我们','wǒ men','우리','대명사'),w('去','qù','가다','동사'),w('公园','gōng yuán','공원'),w('。','','','기호'),w('我们','wǒ men','우리','대명사'),w('明天','míng tiān','내일'),w('去','qù','가다','동사'),w('公园','gōng yuán','공원'),w('。','','','기호')],
  // 3줄 예산(60자)을 넘는 한 문장 — 앞뒤 …로 줄이고도 문장 3줄 + 뜻 1줄이 첫 화면에 든다(설계서 §5.1·§10.2).
  (()=>{const s='虽然今天早上的天气非常不好而且外面还一直在下着很大的雨但是我们还是决定按照原来的计划一起去市中心新建的体育场看一场非常精彩的足球比赛';
   const out=[];for(let i=0;i<s.length;){if(s.startsWith('体育场',i)){out.push(w('体育场','tǐ yù chǎng','경기장'));i+=3;}else{out.push(w(s[i],'','글자','명사'));i+=1;}}out.push(w('。','','','기호'));return out;})(),
 ],'Chinese');
}
const zhPrefs={focusMode:false,autoSpeakOnClick:false,showHanjaKo:true};
const UPPER=['sentence','chips','head','meaning'];
// 패널 안 첫 화면 요소의 사각형 — 보이는 패널 하나만 본다.
const measure=page=>page.evaluate(()=>{
 const panel=[...document.querySelectorAll('.viewer-inspector')].find(el=>el.getClientRects().length);
 if(!panel)return null;
 const r=el=>{if(!el||!el.getClientRects().length)return null;const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,height:b.height};};
 const q=s=>panel.querySelector(`#inspector-word ${s}`);
 const body=q('.reader-card-body');
 return {sheet:r(panel),body:r(body),scrollTop:body?.scrollTop??-1,vh:innerHeight,vw:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,
  sentence:r(q('.reader-card-sentence')),chips:r(q('.word-detail-card__actions')),head:r(q('.reader-card-headword')),meaning:r(q('.word-detail-card__meaning')),
  grades:[...panel.querySelectorAll('#inspector-word .reader-card-actions .review-score-btn')].filter(b=>b.getClientRects().length).map(r),
  savedRow:r(q('.save-grade__saved'))};
});
function assertFirstScreen(g,{label,side=false,bottom='grades'}) {
 assert.ok(g,`${label}: a visible panel`);
 assert.equal(g.scrollTop,0,`${label}: no scroll`);
 assert.equal(g.overflow,0,`${label}: no horizontal page overflow`);
 if(!side)assert.ok(Math.abs(g.sheet.height-440)<=1,`${label}: sheet is 440px (${g.sheet.height})`);
 const view={top:g.body.top,bottom:side?Math.min(g.vh,g.body.bottom):g.body.bottom};
 for(const k of UPPER){
  assert.ok(g[k],`${label}: ${k} rendered`);
  assert.ok(g[k].top>=view.top-.5&&g[k].bottom<=view.bottom+.5,`${label}: ${k} inside the visible body ${JSON.stringify(g[k])} / ${JSON.stringify(view)}`);
 }
 assert.ok(g.sentence.bottom<=g.chips.top+.5&&g.chips.bottom<=g.head.top+.5&&g.head.bottom<=g.meaning.top+.5,`${label}: sentence → chips → headword → meaning`);
 const limit=Math.min(g.sheet.bottom,g.vh)+.5;
 if(bottom==='grades'){
  assert.equal(g.grades.length,4,`${label}: four grade buttons`);
  for(const b of g.grades)assert.ok(b.top>=g.sheet.top&&b.bottom<=limit,`${label}: grade button visible without scrolling`);
 }else{
  assert.equal(g.grades.length,0,`${label}: saved word shows the saved row instead of grades`);
  assert.ok(g.savedRow&&g.savedRow.top>=g.sheet.top&&g.savedRow.bottom<=limit,`${label}: saved row visible without scrolling`);
 }
}
// 접힘 0 · 버튼 0 · 문구 0(정본 §2.1 「없어지는 것」, §3 합격) — 일반 모드 단어 탭 안.
async function assertNoFoldsNoLegacyButtons(f,label) {
 const word=f.page.locator('#inspector-word').filter({visible:true});
 assert.equal(await word.locator('details').count(),0,`${label}: no <details> in the word tab`);
 assert.equal(await word.locator('[aria-expanded="false"]').count(),0,`${label}: no collapsed control in the word tab`);
 for(const name of ['번역','문장 번역','이 문장에서는?'])assert.equal(await word.getByRole('button',{name,exact:true}).count(),0,`${label}: no 「${name}」 button in the word tab`);
 const text=await word.innerText();
 for(const gone of ['이 문장에서','문맥상 · 사전','해석','문장 속 쓰임','상세 설명 보기','관련 문형 후보'])assert.ok(!text.includes(gone),`${label}: 「${gone}」 is gone`);
}

test('390px zh unsaved: sentence line · chips · headword(+hun ruby) · meaning · 4 grades on the first screen, no folds, no legacy buttons',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs});
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_7','웅장하다, 장관이다');
  await f.page.locator('#inspector-word .word-fit__hun').first().waitFor();
  assertFirstScreen(await measure(f.page),{label:'zh 390 unsaved'});
  const line=f.page.locator('#inspector-word .reader-card-sentence');
  assert.equal(await line.innerText(),'眼前的体育场比照片上更壮观。');
  assert.deepEqual(await line.locator('mark').allTextContents(),['壮观'],'only the tapped spot is highlighted');
  assert.equal(await line.locator('button').count(),0,'sentence line has no buttons');
  assert.deepEqual(await f.page.locator('#inspector-word .word-fit__hun').evaluateAll(els=>els.map(e=>e.dataset.label)),['씩씩할 장','볼 관']);
  // 발음 듣기는 칩 줄 끝(정본 §2.1 칩 줄) — 표제어 줄에는 없다.
  assert.equal(await f.page.locator('#inspector-word .word-detail-card__actions').getByRole('button',{name:'발음 듣기',exact:true}).count(),1);
  assert.equal(await f.page.locator('#inspector-word .reader-card-headword').getByRole('button',{name:'발음 듣기',exact:true}).count(),0);
  // 별도 훈음 목록은 없다(루비로 복귀).
  assert.equal(await f.page.locator('.reader-hun').count(),0);
  // 사전 뜻 목록: 이 문장 뜻과 같은 줄을 칠하고 「문맥상」.
  const senses=f.page.locator('#inspector-word .reader-card-senses');
  await senses.waitFor();
  assert.equal(await senses.locator('.reader-card-sense.is-current').count(),1);
  assert.ok((await senses.locator('.reader-card-sense.is-current').innerText()).includes('문맥상'));
  // 더 알아보기 = 요청 버튼(캐시 없음).
  for(const name of ['✦ 비슷한 말 찾기','✦ 자세한 설명'])assert.equal(await f.page.locator('#inspector-word').getByRole('button',{name,exact:true}).count(),1,name);
  await assertNoFoldsNoLegacyButtons(f,'zh 390');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/card-zh-390.png`});
  // 긴 문장: 한 문장을 3줄 예산으로 줄여(양 끝 …) 누른 자리를 남기고, 첫 화면 계약은 그대로.
  const longId=m.sequence.find(id=>id.startsWith('id_2_')&&m.dictionary[id].text==='体育场');
  await tap(f,longId,'경기장');
  const long=await line.innerText();
  assert.ok(long.includes('…')&&long.includes('体育场')&&[...long].length<=62,long);
  assert.deepEqual(await line.locator('mark').allTextContents(),['体育场']);
  const g=await measure(f.page);
  assert.ok(g.sentence.height<=3*24+1,`sentence line ≤ 3 lines: ${g.sentence.height}`);
  assertFirstScreen(g,{label:'zh 390 long sentence'});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('sentence line is one sentence and only the tapped occurrence is highlighted',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs});
 try{
  await tap(f,'id_1_7','공원');
  const line=f.page.locator('#inspector-word .reader-card-sentence');
  assert.equal(await line.innerText(),'我们明天去公园。','the second sentence only — not the whole raw line');
  assert.equal(await line.locator('mark').count(),1);
  const markAt=await line.evaluate(el=>{const mark=el.querySelector('mark');let at=0;for(const n of el.childNodes){if(n===mark)return at;at+=n.textContent.length;}return -1;});
  assert.equal(markAt,'我们明天去'.length,'the tapped 公园, not the first one');
  await tap(f,'id_1_2','공원');
  assert.equal(await line.innerText(),'我们去公园。');
  assert.deepEqual(await line.locator('mark').allTextContents(),['公园']);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('390px zh saved (before review): the saved row with the next review date replaces the grades on the first screen',{timeout:180000},async()=>{
 const m=cardMaterial();
 const day=86400000,now=Date.now();
 const f=await open(m,{prefs:zhPrefs,saved:[{id:'card-tiyuchang',word_text:'体育场',base_form:'体育场',meaning:'경기장',language:'Chinese',created_at:new Date(now-day).toISOString(),interval:3,ease_factor:2.5,repetitions:1,last_reviewed_at:new Date(now-day).toISOString(),next_review_at:new Date(now+5*day).toISOString(),source_material_id:94171}]});
 try{
  await tap(f,'id_0_2','경기장');
  const row=f.page.locator('#inspector-word .save-grade__saved');
  await row.waitFor();
  assert.equal(await row.getByRole('button',{name:'✓ 단어장에 있음',exact:true}).count(),1);
  assert.match(await row.innerText(),/다음 복습 \d+월 \d+일/);
  assert.equal(await row.getByRole('button',{name:'아는 단어',exact:true}).count(),1,'known toggle sits in the saved row');
  assertFirstScreen(await measure(f.page),{label:'zh 390 saved',bottom:'saved'});
  await assertNoFoldsNoLegacyButtons(f,'zh 390 saved');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/card-zh-390-saved.png`});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('390px ja unsaved: first screen and one-sentence line',{timeout:180000},async()=>{
 const m=build([[
  {text:'今日',base_form:'今日',furigana:'きょう',meaning:'오늘',pos:'명사'},{text:'は',base_form:'は',furigana:'',meaning:'~은',pos:'조사'},
  {text:'天気',base_form:'天気',furigana:'てんき',meaning:'날씨',pos:'명사'},{text:'が',base_form:'が',furigana:'',meaning:'~이',pos:'조사'},
  {text:'いい',base_form:'いい',furigana:'',meaning:'좋다',pos:'형용사'},{text:'です',base_form:'です',furigana:'',meaning:'~입니다',pos:'조동사'},{text:'。',base_form:'。',pos:'기호'},
  {text:'寿司',base_form:'寿司',furigana:'すし',meaning:'초밥',pos:'명사'},{text:'を',base_form:'を',furigana:'',meaning:'~을',pos:'조사'},
  {text:'食べた',base_form:'食べる',furigana:'たべた',meaning:'먹었다',pos:'동사'},{text:'。',base_form:'。',pos:'기호'},
 ]],'Japanese');
 const f=await open(m);
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_2','날씨');
  assertFirstScreen(await measure(f.page),{label:'ja 390 unsaved'});
  assert.equal(await f.page.locator('#inspector-word .reader-card-sentence').innerText(),'今日は天気がいいです。');
  assert.equal(await f.page.locator('#inspector-word .word-fit__hun').count(),0,'hun ruby is Chinese only');
  await tap(f,'id_0_9','먹었다');
  assert.equal(await f.page.locator('#inspector-word .reader-card-sentence').innerText(),'寿司を食べた。');
  // 사전 뜻 목록(ja: 뜻별 품사 없음 → 행 품사로 묶음)
  await f.page.locator('#inspector-word .reader-card-senses').getByText('먹다',{exact:true}).waitFor();
  await assertNoFoldsNoLegacyButtons(f,'ja 390');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/card-ja-390.png`});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('1280px side panel: the same upper blocks and grades in the panel',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs,width:1280,height:900});
 try{
  await tap(f,'id_0_7','웅장하다, 장관이다');
  await f.page.locator('#inspector-word .word-fit__hun').first().waitFor();
  assertFirstScreen(await measure(f.page),{label:'zh 1280 panel',side:true});
  await assertNoFoldsNoLegacyButtons(f,'zh 1280');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/card-zh-1280.png`});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('network held: the upper blocks are in the first frame and do not move from T0 to T3 (0px)',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs});
 try{
  await until(()=>f.bulk.length>=1);
  await f.page.locator('[data-source-token="id_0_0"]').waitFor();
  await f.page.waitForTimeout(800);
  // 미리 받기 뒤 모든 REST·API 응답을 붙잡는다(JS 청크 /_next/는 그대로 — 정본 §2.2 전제).
  const held=[];
  const hold=route=>{held.push(route);};
  await f.context.route('**/rest/v1/**',hold);
  await f.context.route('**/api/**',hold);
  const t0=await f.page.evaluate(()=>new Promise(resolve=>{
   document.querySelector('[data-source-token="id_0_2"]').click();
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const q=s=>document.querySelector(`#inspector-word ${s}`);
    const top=el=>el&&el.getClientRects().length?el.getBoundingClientRect().top:null;
    resolve({sentence:top(q('.reader-card-sentence')),chips:top(q('.word-detail-card__actions')),head:top(q('.reader-card-headword')),meaning:top(q('.word-detail-card__meaning')),
     meaningText:q('.word-detail-card__meaning')?.textContent,glyph:top(q('.reader-card-glyph')),glyphText:q('.reader-card-glyph')?.textContent,
     grades:document.querySelectorAll('#inspector-word .reader-card-actions .review-score-btn').length,hun:document.querySelectorAll('#inspector-word .word-fit__hun').length});
   }));
  }));
  const tops=()=>f.page.evaluate(()=>{const q=s=>document.querySelector(`#inspector-word ${s}`);const top=el=>el&&el.getClientRects().length?el.getBoundingClientRect().top:null;
   return {sentence:top(q('.reader-card-sentence')),chips:top(q('.word-detail-card__actions')),head:top(q('.reader-card-headword')),meaning:top(q('.word-detail-card__meaning')),glyph:top(q('.reader-card-glyph'))};});
  for(const k of UPPER)assert.notEqual(t0[k],null,`${k} is in the first frame with the network held`);
  assert.equal(t0.meaningText,'경기장');
  assert.equal(t0.grades,4,'grades in the first frame');
  assert.equal(t0.hun,3,'hun ruby in the first frame (tables were loaded when the material opened)');
  // AE-R3 PR②(설계서 §7.3 「T0~T3 첫 화면 위쪽 이동 0 — 자형 열 포함」): 정체 표는 자료를 열 때 받았으므로 正 줄도 첫 프레임에 있다.
  assert.notEqual(t0.glyph,null,'glyph column in the first frame');
  assert.ok(/正\s*體育場/.test(t0.glyphText),t0.glyphText);
  const frames=[];
  await f.page.waitForTimeout(300);frames.push(await tops());
  await f.page.waitForTimeout(700);frames.push(await tops());
  // 늦게 풀어 준다 — 사전·번역·AI 응답이 와도 위쪽은 그대로여야 한다.
  await f.context.unroute('**/rest/v1/**',hold);await f.context.unroute('**/api/**',hold);
  for(const route of held.splice(0))await route.fallback().catch(()=>{});
  await f.page.waitForTimeout(2000);frames.push(await tops());
  for(const frame of frames)for(const k of [...UPPER,'glyph'])assert.equal(frame[k],t0[k],`${k} moved: ${t0[k]} → ${frame[k]}`);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('ko and en materials: sentence line · headword · meaning · bottom render (regression)',{timeout:180000},async()=>{
 const ko=build([[
  {text:'오늘은',base_form:'오늘',furigana:'',meaning:'today',pos:'명사'},{text:'날씨가',base_form:'날씨',furigana:'',meaning:'weather',pos:'명사'},
  {text:'좋다.',base_form:'좋다',furigana:'',meaning:'good',pos:'형용사'},
  {text:'내일도',base_form:'내일',furigana:'',meaning:'tomorrow',pos:'명사'},{text:'좋다.',base_form:'좋다',furigana:'',meaning:'good',pos:'형용사'},
 ]],'Korean');
 let f=await open(ko);
 try{
  await f.page.locator('[data-source-token="id_0_3"]').click();
  const line=f.page.locator('#inspector-word .reader-card-sentence');
  await line.waitFor();
  assert.equal(await line.innerText(),'내일도 좋다.');
  assert.deepEqual(await line.locator('mark').allTextContents(),['내일도']);
  await f.page.locator('#inspector-word .reader-card-headword').waitFor();
  await f.page.locator('#inspector-word .word-detail-card__meaningrow').waitFor();
  await f.page.locator('#inspector-word .reader-card-actions').waitFor();
  assert.equal(await f.page.locator('#inspector-word .reader-card-senses').count(),0,'no dictionary sense list for Korean');
  await assertNoFoldsNoLegacyButtons(f,'ko');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 const en=build([[
  {text:'I',base_form:'I',furigana:'',meaning:'나',pos:'대명사'},{text:'met',base_form:'meet',furigana:'',meaning:'만났다',pos:'동사'},
  {text:'Dr.',base_form:'Dr.',furigana:'',meaning:'박사',pos:'명사'},{text:'Kim',base_form:'Kim',furigana:'',meaning:'김',pos:'명사'},
  {text:'today.',base_form:'today',furigana:'',meaning:'오늘',pos:'명사'},{text:'He',base_form:'he',furigana:'',meaning:'그',pos:'대명사'},
  {text:'was',base_form:'be',furigana:'',meaning:'~였다',pos:'동사'},{text:'late.',base_form:'late',furigana:'',meaning:'늦은',pos:'형용사'},
 ]],'English');
 f=await open(en);
 try{
  await tap(f,'id_0_3','김');
  const line=f.page.locator('#inspector-word .reader-card-sentence');
  assert.equal(await line.innerText(),'I met Dr. Kim today.','abbreviation is not a boundary');
  await tap(f,'id_0_6','~였다');
  assert.equal(await line.innerText(),'He was late.');
  assert.deepEqual(await line.locator('mark').allTextContents(),['was']);
  assertFirstScreen(await measure(f.page),{label:'en 390 unsaved'});
  await assertNoFoldsNoLegacyButtons(f,'en');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// ───────────────────────── PR ③ 이 자리 뜻 교정·되돌리기 · ⋯ 메뉴 · 공유 detail_text(설계서 §3.4·§7.3·§8) ─────────────────────────
// 쓰기는 기존 correctTokenMutation(processed_json PATCH + token_corrections 이력) 하나 — 전역 승격(/api/dict-correct)·
// 단어장(user_vocabulary)·FSRS·사전 쓰기는 0이어야 한다(정본 §0.2). 합성 백엔드(f.rows)만 바뀐다.
const twoSenses={...dictRows.Chinese,壮观:{meanings:[{meaning:'웅장하다, 장관이다',priority:1,pos:'형용사'},{meaning:'장관, 웅장한 경관',priority:2,pos:'명사'}],reading:'zhuàng guān',pos:'형용사·명사'}};
const writesSince=(f,mark)=>f.requests.slice(mark).filter(r=>!['GET','HEAD','OPTIONS'].includes(r.method)&&notPrefetch(r));
const visibleHeader=f=>f.page.locator('.viewer-inspector__header').filter({visible:true});

test('owner: tapping another dictionary sense corrects this spot only; 「되돌리기」 restores the previous value',{timeout:180000},async()=>{
 const m=cardMaterial();
 const original=structuredClone(m.dictionary.id_0_7);
 const f=await open(m,{prefs:zhPrefs,own:true,rows:twoSenses});
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_7','웅장하다, 장관이다');
  const senses=f.page.locator('#inspector-word .reader-card-senses');
  await senses.waitFor();
  assert.equal(await senses.locator('.reader-card-sense').count(),2);
  assert.equal(await senses.locator('.reader-card-sense.is-current button').count(),0,'the current sense is not pressable');
  const pick=senses.getByRole('button',{name:/장관, 웅장한 경관/});
  assert.equal(await pick.count(),1,'the other sense is a button');
  const box=await pick.boundingBox();
  assert.ok(box.height>=44,`sense row target ≥ 44px: ${box.height}`);
  const stored=()=>f.rows.find(r=>r.id===94171).processed_json.dictionary.id_0_7;
  const mark=f.requests.length;
  await pick.click();
  const meaning=f.page.locator('#inspector-word .word-detail-card__meaning');
  await meaning.getByText('장관, 웅장한 경관',{exact:true}).waitFor();
  const undoLine=f.page.locator('#inspector-word .reader-card-sense-undo');
  await undoLine.waitFor();
  assert.match(await undoLine.innerText(),/뜻을 바꿨어요/);
  assert.ok((await senses.locator('.reader-card-sense.is-current').innerText()).includes('장관, 웅장한 경관'),'the chosen line is now the 문맥상 line');
  await until(()=>stored().meaning==='장관, 웅장한 경관');
  assert.equal(stored().pos,'명사','the sense pos travels with the meaning (TokenEditPanel chip rule)');
  assert.equal(stored().furigana,original.furigana,'reading untouched');
  assert.equal(await f.page.getByText('수정이 저장됐어요!',{exact:true}).count(),0,'the inline line replaces the toast');
  await undoLine.getByRole('button',{name:'되돌리기',exact:true}).click();
  await meaning.getByText('웅장하다, 장관이다',{exact:true}).waitFor();
  await until(()=>stored().meaning==='웅장하다, 장관이다');
  assert.deepEqual(stored(),original,'undo restores the previous token exactly');
  await until(async()=>(await undoLine.count())===0);
  assert.ok((await senses.locator('.reader-card-sense.is-current').innerText()).includes('웅장하다, 장관이다'));
  await f.page.waitForTimeout(500);
  const writes=writesSince(f,mark);
  assert.equal(writes.filter(r=>r.method==='PATCH'&&r.url.includes('/rest/v1/reading_materials')).length,2,'one write to correct, one to undo');
  assert.equal(writes.filter(r=>r.method==='POST'&&r.url.includes('/rest/v1/token_corrections')).length,2,'correction history for both');
  const other=writes.filter(r=>!r.url.includes('/rest/v1/reading_materials')&&!r.url.includes('/rest/v1/token_corrections'));
  assert.deepEqual(other,[],'no dict-correct, vocabulary, FSRS or dictionary writes');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('not the owner: dictionary senses are display-only and there is no ⋯ menu',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs,rows:twoSenses});
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_7','웅장하다, 장관이다');
  const senses=f.page.locator('#inspector-word .reader-card-senses');
  await senses.waitFor();
  assert.equal(await senses.locator('.reader-card-sense').count(),2);
  assert.equal(await senses.locator('button').count(),0,'no pressable sense line');
  const mark=f.requests.length;
  await senses.getByText('장관, 웅장한 경관',{exact:true}).click();
  await f.page.waitForTimeout(600);
  assert.deepEqual(writesSince(f,mark),[],'no write');
  assert.equal(await f.page.locator('#inspector-word .word-detail-card__meaning').innerText(),'웅장하다, 장관이다');
  assert.equal(await f.page.locator('#inspector-word .reader-card-sense-undo').count(),0);
  assert.equal(await visibleHeader(f).getByRole('button',{name:'분석 고치기',exact:true}).count(),0,'no ⋯ when there is nothing to fix');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('⋯ menu: 44px, keyboard open · move · Esc closes and returns focus, the item opens the editor; one header row at 390 and 320',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs,own:true,rows:twoSenses});
 try{
  await tap(f,'id_0_7','웅장하다, 장관이다');
  const more=visibleHeader(f).getByRole('button',{name:'분석 고치기',exact:true});
  await more.waitFor();
  assert.equal(await more.getAttribute('aria-haspopup'),'menu');
  assert.equal(await more.getAttribute('aria-expanded'),'false');
  const b=await more.boundingBox();
  assert.ok(b.width>=44&&b.height>=44,`⋯ target ${b.width}×${b.height}`);
  assert.ok((await visibleHeader(f).boundingBox()).height<=56,'390 header stays one row with ⋯');
  const active=()=>f.page.evaluate(()=>({role:document.activeElement?.getAttribute('role'),label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.textContent?.trim()}));
  await more.focus();
  await f.page.keyboard.press('Enter');
  const menu=f.page.getByRole('menu');
  await menu.waitFor();
  assert.equal(await more.getAttribute('aria-expanded'),'true');
  // AD-R3 PR③(설계서 docs/manabi-viewer-v2-ad-r3.md §6.1 — ⋯에 「옆 단어와 묶기」·「나누기」를 더한다, AE-R1 §2 예고): 첫 항목은 그대로 「뜻·발음 수정」.
  assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),['뜻·발음 수정','옆 단어와 묶기','나누기']);
  assert.deepEqual(await active(),{role:'menuitem',label:null,text:'뜻·발음 수정'},'focus moves to the first item');
  await f.page.keyboard.press('ArrowDown');
  assert.equal((await active()).role,'menuitem','arrow keys stay inside the menu');
  await f.page.keyboard.press('Escape');
  await until(async()=>(await menu.count())===0);
  assert.equal((await active()).label,'분석 고치기','focus returns to ⋯');
  assert.ok(await f.page.locator('#inspector-word').isVisible(),'Esc closes the menu, not the sheet');
  await f.page.keyboard.press('ArrowDown');
  await menu.waitFor();
  await f.page.keyboard.press('Enter');
  await f.page.locator('#inspector-word .token-edit').waitFor();
  assert.equal(await menu.count(),0,'choosing an item closes the menu');
  // [문장] 탭에는 ⋯이 없다(단어 탭 전용).
  await f.page.getByRole('tab',{name:'문장 번역'}).click();
  await until(async()=>(await visibleHeader(f).getByRole('button',{name:'분석 고치기',exact:true}).count())===0);
  await f.page.getByRole('tab',{name:'단어'}).click();
  await more.waitFor();
  // 320px: ⤢를 숨겨 한 줄을 지킨다(설계서 §6 — 끌어 올리기로 대신).
  await f.page.setViewportSize({width:320,height:700});
  await f.page.waitForTimeout(400);
  const g=await f.page.evaluate(()=>{const h=[...document.querySelectorAll('.viewer-inspector__header')].find(el=>el.getClientRects().length);const r=h.getBoundingClientRect();
   const btn=h.querySelector('[aria-label="분석 고치기"]').getBoundingClientRect();const ex=h.querySelector('.viewer-inspector__expand');
   return {height:r.height,right:r.right,btnRight:btn.right,btnW:btn.width,expand:ex?ex.getClientRects().length:0,overflow:document.documentElement.scrollWidth-innerWidth};});
  assert.ok(g.height<=56,`320 header one row: ${g.height}`);
  assert.equal(g.overflow,0,'no horizontal page overflow at 320');
  assert.ok(g.btnRight<=g.right+.5&&g.btnW>=44,`⋯ inside the header at 320 ${JSON.stringify(g)}`);
  assert.equal(g.expand,0,'⤢ hidden at 320 when ⋯ is present');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('「자세한 설명」: shared detail_text is read once per card when 더 알아보기 comes into view; reopening makes 0 requests',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs,rows:twoSenses,details:{壮观:'**뜻**\n1. 웅장하다\n\n**뉘앙스**\n공유 설명 검수용.'}});
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_7','웅장하다, 장관이다');
  const learn=f.page.locator('#inspector-word .reader-card-learn');
  await learn.waitFor({state:'attached'});
  await f.page.waitForTimeout(700);
  const below=await learn.evaluate(el=>el.getBoundingClientRect().top>=el.closest('.reader-card-body').getBoundingClientRect().bottom);
  assert.equal(below,true,'더 알아보기 starts below the 390 first screen');
  assert.deepEqual(f.detail,[],'no detail_text request before the section is in view');
  await learn.scrollIntoViewIfNeeded();
  await learn.getByText('공유 설명 검수용.').waitFor();
  assert.equal(await learn.getByRole('button',{name:'✦ 자세한 설명',exact:true}).count(),0,'content instead of the button');
  assert.deepEqual(f.detail,['壮观']);
  // 설명이 없는 단어: 1회 조회 뒤 버튼 그대로(조용히).
  await tap(f,'id_0_2','경기장');
  await learn.scrollIntoViewIfNeeded();
  await until(()=>f.detail.length===2);
  await f.page.waitForTimeout(300);
  assert.equal(await learn.getByRole('button',{name:'✦ 자세한 설명',exact:true}).count(),1);
  // 같은 단어 재열람 = 메모리 캐시, 0요청.
  await tap(f,'id_0_7','웅장하다, 장관이다');
  await learn.scrollIntoViewIfNeeded();
  await learn.getByText('공유 설명 검수용.').waitFor();
  await tap(f,'id_0_2','경기장');
  await learn.scrollIntoViewIfNeeded();
  await f.page.waitForTimeout(700);
  assert.deepEqual(f.detail,['壮观','体育场'],'reopening the same words adds no request');
  assert.equal(f.requests.filter(r=>(r.url.includes('/api/word-detail')||r.url.includes('/api/gemini'))&&notPrefetch(r)).length,0,'no AI or word-detail API call');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// ───────────────────────── AE-R3 PR ② 자형 열(正 · 日) · 일본어 대조 블록 교체 · 출처(설계서 docs/manabi-viewer-v2-ae-r3.md §4·§5·§6·§7.3) ─────────────────────────
// 표시만(쓰기 0). 정본 §6 합격: 正은 다를 때만 · 日은 확인된 단어만 요미와 함께 · 2자 안 1, 넘치면 안 2 · 요미 문자열 안 줄바꿈 0 ·
// 안 1 세로 가운데 ±2px · 日 요미가 JMdict에서 온 카드에 출처 줄. 사전 행(합성): 体育场 = 사전 ja(같은 단어) · 老师 = diff · 汽车 = diff+warn · 尽量 = ja null.
const glyphRows={...dictRows.Chinese,
 体育场:{meanings:[{meaning:'경기장',priority:1,pos:'명사',ja:{form:'体育場',yomi:'たいいくじょう',warn:null}}],reading:'tǐ yù chǎng',pos:'명사'},
 老师:{meanings:[{meaning:'선생님',priority:1,pos:'명사',ja:{form:'先生',yomi:'せんせい',diff:true,warn:null}}],reading:'lǎo shī',pos:'명사'},
 汽车:{meanings:[{meaning:'자동차',priority:1,pos:'명사',ja:{form:'自動車',yomi:'じどうしゃ',diff:true,warn:'기차'}}],reading:'qì chē',pos:'명사'},
 尽量:{meanings:[{meaning:'되도록',priority:1,pos:'부사',ja:null}],reading:'jǐn liàng',pos:'부사'},
};
function glyphMaterial() {
 const w=(text,furigana,meaning,pos='명사')=>({text,base_form:text,furigana,meaning,pos});
 return build([
  [w('眼前','yǎn qián','눈앞'),w('的','de','~의','조사'),w('体育场','tǐ yù chǎng','경기장'),w('比','bǐ','~보다','전치사'),w('照片','zhào piàn','사진'),w('上','shàng','위'),w('更','gèng','더','부사'),w('壮观','zhuàng guān','웅장하다, 장관이다','형용사'),w('。','','','기호')],
  [w('老师','lǎo shī','선생님'),w('坐','zuò','타다','동사'),w('汽车','qì chē','자동차'),w('，','','','기호'),w('她','tā','그녀','대명사'),w('尽量','jǐn liàng','되도록','부사'),w('早','zǎo','일찍','부사'),w('来','lái','오다','동사'),w('。','','','기호')],
 ],'Chinese');
}
// 보이는 단어창의 자형 열 기하 — 행 텍스트 · lang · 칠 · 첫 글자 줄 가운데와 열 가운데 · 표 칸 정렬.
const glyphGeometry=page=>page.evaluate(()=>{
 const card=[...document.querySelectorAll('#inspector-word')].find(el=>el.getClientRects().length);
 const col=card?.querySelector('.reader-card-glyph');
 if(!col)return null;
 const box=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2};};
 const row=kind=>{const el=col.querySelector(`.reader-card-glyph__row--${kind}`);if(!el)return null;const form=el.querySelector('.reader-card-glyph__form'),yomi=el.querySelector('.reader-card-glyph__yomi');
  return {text:form.textContent,lang:form.getAttribute('lang'),ghost:el.classList.contains('is-ghost'),cells:[...el.querySelectorAll('.reader-card-glyph__ch')].map(c=>({...box(c),diff:c.classList.contains('is-diff'),opacity:getComputedStyle(c).opacity,color:getComputedStyle(c).color,underline:getComputedStyle(c).textDecorationStyle})),
   yomi:yomi?{text:yomi.textContent,lang:yomi.getAttribute('lang'),lines:yomi.getClientRects().length,...box(yomi)}:null};};
 const glyphs=[...card.querySelectorAll('.word-fit [data-glyph-i]')].map(box);
 const fit=card.querySelector('.word-fit'),body=card.querySelector('.reader-card-body');
 return {layout:col.dataset.layout,col:box(col),zheng:row('zheng'),ja:row('ja'),glyphs,fit:box(fit),body:box(body),accent:getComputedStyle(card.closest('.viewer-layout')).getPropertyValue('--reader-accent').trim(),
  hun:[...card.querySelectorAll('.word-fit__hun')].map(box),pinyin:[...card.querySelectorAll('.word-fit .rt-an')].map(box),
  credit:card.querySelector('.reader-card-credit a')?.getAttribute('href')||null,creditText:card.querySelector('.reader-card-credit')?.innerText||'',
  learnJa:card.querySelector('.reader-card-learn__ja')?.innerText||null,text:card.innerText,old:card.querySelectorAll('.reader-card-comparison,.reader-japanese').length};
});
const overlaps=(a,b)=>a.left<b.right-.5&&b.left<a.right-.5&&a.top<b.bottom-.5&&b.top<a.bottom-.5;

test('AE-R3 390 · 1440: 壮观 안 1 — 正 壯觀 · 日 壮観 そうかん, 세로 가운데 ±2px, 표제어·훈음·병음과 겹침 0, JMdict 출처 줄 · 「AI」 0 · 대조 블록 0',{timeout:180000},async()=>{
 for(const [width,height] of [[390,844],[1440,900]]){
  const f=await open(glyphMaterial(),{prefs:zhPrefs,rows:glyphRows,width,height});
  try{
   await until(()=>f.bulk.length>=1);
   await tap(f,'id_0_7','웅장하다, 장관이다');
   await f.page.locator('#inspector-word .reader-card-glyph').filter({visible:true}).waitFor();
   await f.page.locator('#inspector-word .word-fit__hun').filter({visible:true}).first().waitFor();
   await f.page.waitForTimeout(300);
   const g=await glyphGeometry(f.page);
   const label=`壮观 ${width}`;
   assert.equal(g.layout,'side',`${label}: 2-char word is 안 1`);
   assert.equal(g.zheng.text,'壯觀');assert.equal(g.zheng.lang,'zh-Hant-TW');
   assert.equal(g.ja.text,'壮観');assert.equal(g.ja.lang,'ja');
   assert.equal(g.ja.yomi.text,'そうかん');assert.equal(g.ja.yomi.lang,'ja');assert.equal(g.ja.yomi.lines,1,`${label}: yomi on one line`);
   assert.deepEqual(g.zheng.cells.map(c=>c.diff),[true,true]);assert.deepEqual(g.ja.cells.map(c=>c.diff),[false,true],'only 観 differs from 观');
   assert.ok(g.zheng.cells.every(c=>c.underline==='dotted'),`${label}: differing glyphs are dotted-underlined`);
   assert.notEqual(g.ja.cells[0].underline,'dotted','same glyph is not underlined');
   const mid=g.glyphs[0].cy;
   assert.ok(Math.abs(g.col.cy-mid)<=2,`${label}: column middle ${g.col.cy} vs glyph row middle ${mid}`);
   for(const b of [...g.glyphs,...g.hun,...g.pinyin])assert.ok(!overlaps(g.col,b),`${label}: column overlaps the headword ${JSON.stringify(b)}`);
   assert.ok(g.col.left>=g.fit.right,`${label}: column is right of the headword`);
   assert.ok(g.col.right<=g.body.right+.5,`${label}: column inside the card`);
   assert.equal(g.credit,'/credits#jmdict',`${label}: JMdict credit line (日 from the JMdict table)`);
   assert.ok(g.creditText.includes('JMdict (EDRDG)')&&g.creditText.includes('CC BY-SA 4.0'));
   assert.equal(g.learnJa,null,'日 shown → no 「일본어로는」 line');
   assert.equal(g.old,0,'the Japanese comparison block is gone');
   assert.ok(!/\bAI\b/.test(g.text),`${label}: no 「AI」 label in the card`);
   for(const gone of ['일본어 대조','일본식 자형','같은 뜻','기존 사전'])assert.ok(!g.text.includes(gone),`${label}: 「${gone}」 gone`);
   assertFirstScreen(await measure(f.page),{label,side:width>=1280});
   if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/glyph-zhuangguan-${width}.png`});
   // 眼前 = 日만(正 없음 — 간체 = 정체), 다른 글자 0
   await tap(f,'id_0_0','눈앞');
   await f.page.waitForTimeout(300);
   const e=await glyphGeometry(f.page);
   assert.equal(e.zheng,null,'眼前: no 正 row');assert.equal(e.ja.text,'眼前');assert.equal(e.ja.yomi.text,'がんぜん');assert.ok(e.ja.cells.every(c=>!c.diff));
   assert.ok(Math.abs(e.col.cy-e.glyphs[0].cy)<=2,`眼前 ${width}: column middle`);
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 }
});

test('AE-R3 390: 体育场(사전 ja) 안 2 — 글자 칸 정렬 ±2px, 같은 글자 흐림 0.45 · 다른 글자 초록, 요미 한 줄, 출처 줄 없음(사전 행), 첫 화면',{timeout:180000},async()=>{
 const f=await open(glyphMaterial(),{prefs:zhPrefs,rows:glyphRows});
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_2','경기장');
  await f.page.locator('#inspector-word .reader-card-glyph[data-layout="table"]').filter({visible:true}).waitFor();
  await f.page.waitForTimeout(300);
  const g=await glyphGeometry(f.page);
  assert.equal(g.zheng.text,'體育場');assert.equal(g.ja.text,'体育場');assert.equal(g.ja.yomi.text,'たいいくじょう');
  assert.equal(g.ja.yomi.lines,1,'yomi string does not break');
  assert.ok(g.ja.yomi.height<=16*1.6,`yomi is one line high: ${g.ja.yomi.height}`);
  for(const r of [g.zheng,g.ja])r.cells.forEach((c,i)=>assert.ok(Math.abs(c.cx-g.glyphs[i].cx)<=2,`${r.text}[${i}] x ${c.cx} vs headword ${g.glyphs[i].cx}`));
  assert.deepEqual(g.zheng.cells.map(c=>c.diff),[true,false,true]);assert.deepEqual(g.ja.cells.map(c=>c.diff),[false,false,true]);
  for(const c of [...g.zheng.cells,...g.ja.cells])assert.equal(c.opacity,c.diff?'1':'0.45');
  assert.notEqual(g.zheng.cells[0].color,g.zheng.cells[1].color,'differing glyph is painted');
  assert.ok(g.zheng.cells[0].top>=Math.max(...g.glyphs.map(b=>b.bottom),...g.hun.map(b=>b.bottom))-.5,'table rows are below the headword and hun ruby');
  for(const b of [...g.glyphs,...g.hun,...g.pinyin])for(const c of [...g.zheng.cells,...g.ja.cells])assert.ok(!overlaps(c,b),'table cell overlaps the headword');
  assert.equal(g.credit,null,'日 from the dictionary row → no JMdict credit line');
  assertFirstScreen(await measure(f.page),{label:'体育场 table 390'});
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/glyph-tiyuchang-390.png`});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 메인 세션 결정(10-08): 안 2가 390 첫 화면 계약(표제어·이 문장 뜻 줄·하단)을 깨면 결함 — 우선순위 표제어·뜻·하단 > 자형 표.
// 3줄 문장 속 体育场(사전 ja → 안 2): 1단계 문장 줄 2줄 예산, 그래도 넘치면 2단계 자형 표를 뜻 줄 아래로(표제어 옆엔 正 한 칸).
test('AE-R3 390 첫 화면 우선: 3줄 문장 + 体育场(안 2) — 표제어·뜻 줄·4등급이 스크롤 없이, 자형 줄은 뜻 줄 아래(접힘 0)',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs,rows:glyphRows});
 try{
  await until(()=>f.bulk.length>=1);
  const longId=m.sequence.find(id=>id.startsWith('id_2_')&&m.dictionary[id].text==='体育场');
  await tap(f,longId,'경기장');
  await f.page.waitForTimeout(400);
  assertFirstScreen(await measure(f.page),{label:'3-line + 体育场 table 390'});
  const s=await f.page.evaluate(()=>{
   const card=[...document.querySelectorAll('#inspector-word')].find(el=>el.getClientRects().length);
   const meaning=card.querySelector('.word-detail-card__meaning').getBoundingClientRect();
   const below=card.querySelector('.reader-card-glyph--below');
   const beside=card.querySelector('.word-fit-wrap > .reader-card-glyph');
   return {tight:card.querySelector('.reader-card-sentence')?.hasAttribute('data-tight'),
    below:below?{top:below.getBoundingClientRect().top,text:below.textContent,layout:below.dataset.layout}:null,meaningBottom:meaning.bottom,
    beside:beside?{layout:beside.dataset.layout,text:beside.textContent}:null,details:card.querySelectorAll('details,[aria-expanded="false"]').length};
  });
  assert.equal(s.tight,true,'step 1: the sentence line drops to the 2-line budget');
  assert.ok(s.below,'step 2: the glyph rows move below the meaning line');
  assert.ok(s.below.top>=s.meaningBottom-.5,'below block is under the meaning line');
  assert.ok(s.below.text.includes('体育場')&&s.below.text.includes('たいいくじょう'),s.below.text);
  if(s.beside){assert.equal(s.beside.layout,'side');assert.equal(s.beside.text,'正體育場','beside the headword: the 正 row only');assert.ok(!s.below.text.includes('體育場'));}
  else assert.ok(s.below.text.includes('體育場'),'正 row goes below when it does not fit beside');
  assert.equal(s.details,0,'no folds');
  // 다른 단어로 가면 단계가 0으로 — 짧은 문장의 体育场은 문장 줄 3줄 예산 · 표제어 아래 표(안 2) 그대로
  await tap(f,'id_0_2','경기장');
  await f.page.waitForTimeout(400);
  const t=await glyphGeometry(f.page);
  assert.equal(t.layout,'table');
  assertFirstScreen(await measure(f.page),{label:'1-line + 体育场 table 390'});
  assert.equal(await f.page.locator('#inspector-word .reader-card-glyph--below').filter({visible:true}).count(),0);
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/glyph-budget-390.png`});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R3: 老师(diff) · 汽车(warn) → 日 숨김 · 「일본어로는」 줄, 尽量(ja null) → 正만 + [✦ 일본어로는?](기존 클라 AI, 「AI」 표 0, 사전 쓰기 0) · 일본어 자료엔 자형 열 0',{timeout:180000},async()=>{
 const f=await open(glyphMaterial(),{prefs:zhPrefs,rows:glyphRows});
 try{
  await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({form:'できるだけ',warn:null})}]}}]})}));
  await until(()=>f.bulk.length>=1);
  const learn=f.page.locator('#inspector-word .reader-card-learn').filter({visible:true});
  await tap(f,'id_1_0','선생님');
  await learn.locator('.reader-card-learn__ja').waitFor({state:'attached'});
  let g=await glyphGeometry(f.page);
  assert.equal(g.zheng.text,'老師');assert.equal(g.ja,null,'老师: 日 hidden (diff)');assert.equal(g.credit,null);
  assert.ok(/일본어로는\s*先生\s*せんせい/.test(g.learnJa),g.learnJa);
  await tap(f,'id_1_2','자동차');
  await learn.locator('.reader-card-learn__ja').getByText('自動車',{exact:true}).waitFor({state:'attached'});
  g=await glyphGeometry(f.page);
  assert.equal(g.ja,null,'汽车: 日 hidden (warn)');
  assert.ok(g.learnJa.includes('自動車')&&g.learnJa.includes('じどうしゃ')&&g.learnJa.includes('같은 한자 표기는 일본어에서 ‘기차’라는 뜻이에요.'),g.learnJa);
  await tap(f,'id_1_5','되도록');
  const ask=learn.getByRole('button',{name:'✦ 일본어로는?',exact:true});
  await ask.waitFor({state:'attached'});
  g=await glyphGeometry(f.page);
  assert.equal(g.zheng.text,'儘量');assert.equal(g.ja,null);assert.equal(g.learnJa,null);
  assert.equal(f.requests.filter(r=>r.url.includes('/api/gemini')&&notPrefetch(r)).length,0,'no AI call before the button');
  await ask.scrollIntoViewIfNeeded();await ask.click();
  await learn.locator('.reader-card-learn__ja').getByText('できるだけ',{exact:true}).waitFor();
  assert.equal(f.requests.filter(r=>r.url.includes('/api/gemini')&&notPrefetch(r)).length,1);
  const text=await f.page.locator('#inspector-word').filter({visible:true}).innerText();
  assert.ok(!/\bAI\b/.test(text),'no 「AI」 label');
  assert.equal(f.requests.filter(r=>r.url.includes('/rest/v1/morpheme_dictionary')&&r.method!=='GET'&&r.method!=='OPTIONS').length,0,'no dictionary writes');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 // 일본어 자료: 자형 열·일본어 표 0(회귀 없음)
 const ja=build([[{text:'天気',base_form:'天気',furigana:'てんき',meaning:'날씨',pos:'명사'},{text:'。',base_form:'。',pos:'기호'}]],'Japanese');
 const j=await open(ja);
 try{
  await tap(j,'id_0_0','날씨');
  await j.page.waitForTimeout(300);
  assert.equal(await j.page.locator('#inspector-word .reader-card-glyph').count(),0);
  assert.equal(await j.page.locator('#inspector-word .reader-card-credit').count(),0);
  assert.deepEqual(j.errors,[]);
 }finally{await j.context.close();}
});

// ───────────────────────── AE-R4 PR ② 한자 창(팝오버) · 글자 카드 교체(설계서 docs/manabi-viewer-v2-ae-r4.md §4·§7.2 · 정본 §9 합격) ─────────────────────────
// 표시만(쓰기 0). 중국어 일반 모드에서 표제어 한자를 누르면 글자 카드 대신 비모달 한자 창. 합격: 창 안 모든 줄 한 줄 · 열기·닫기·드릴다운·
// 다른 글자 사이 카드 요소 이동 0px · 창 크기 불변 · Esc·바깥 누르기로 닫고 포커스가 그 글자로 · 390 첫 화면에서 등급 4버튼을 가리지 않음
// (창 아래 끝 ≤ 등급 버튼 위 − 3px, 시안 여유) · 창 전체가 보임 · 키보드만으로 열기·드릴다운·닫기 · 일본어 자료는 글자 카드 그대로.
const savedCanguan=()=>{const day=86400000,now=Date.now();return [{id:'card-canguan',word_text:'参观',base_form:'参观',meaning:'참관하다',language:'Chinese',created_at:new Date(now-day).toISOString(),interval:3,ease_factor:2.5,repetitions:1,last_reviewed_at:new Date(now-day).toISOString(),next_review_at:new Date(now+5*day).toISOString(),source_material_id:94171}];};
const visibleCard=page=>page.locator('#inspector-word').filter({visible:true});
const popOf=page=>visibleCard(page).locator('.hanja-pop');
// 카드 요소(문장 줄 · 칩 · 표제어 글자 · 훈음 · 뜻 · 등급) 사각형 — 창을 열고 닫아도 0px.
// 재기 전에 포인터를 카드 밖(좌상단)으로 치운다: 등급 버튼은 :hover에서 translateY(-1px)라, 카드를 연 탭 자리가 마침 등급 버튼
// 위면 「열기 전」만 1px 떠 보인다(CI 실측 780 → 781 — 창과 무관한 hover 변형). 레이아웃 이동만 비교한다.
const cardBoxes=async page=>{await page.mouse.move(0,0);return page.evaluate(()=>{
 const card=[...document.querySelectorAll('#inspector-word')].find(el=>el.getClientRects().length);
 const r=el=>{const b=el.getBoundingClientRect();return [b.left,b.top,b.width,b.height].map(v=>Math.round(v*10)/10).join(',');};
 return ['.reader-card-sentence','.word-detail-card__actions','.word-fit [data-glyph-i]','.word-fit__hun','.word-detail-card__meaning','.reader-card-actions .review-score-btn,.save-grade__saved']
  .flatMap(s=>[...card.querySelectorAll(s)].filter(el=>el.getClientRects().length).map(el=>`${s}:${r(el)}`));
});};
// 창 기하 — 크기 · 한 줄 · 넘침 · 보임 · 등급 버튼과의 거리 · 포커스.
const popGeometry=page=>page.evaluate(()=>{
 const card=[...document.querySelectorAll('#inspector-word')].find(el=>el.getClientRects().length);
 const pop=card?.querySelector('.hanja-pop');
 if(!pop||!pop.getClientRects().length)return null;
 const b=el=>{const x=el.getBoundingClientRect();return {top:x.top,bottom:x.bottom,left:x.left,right:x.right,width:x.width,height:x.height};};
 const p=b(pop),body=b(card.querySelector('.reader-card-body')),cardBox=b(card.querySelector('.word-detail-card')||card);
 const grade=[...card.querySelectorAll('.reader-card-actions :is(.review-score-btn,.save-grade__saved)')].find(el=>el.getClientRects().length);
 const rows=[...pop.querySelectorAll('.hanja-pop__head,.hanja-pop__parts,.hanja-pop__tile > span,.hanja-pop__fam,.hanja-pop__note')].filter(el=>el.getClientRects().length);
 const lines=el=>{const range=document.createRange();range.selectNodeContents(el);let n=0,bottom=-Infinity;for(const r of [...range.getClientRects()].filter(r=>r.width>0).sort((a,b)=>a.top-b.top)){if(r.top>=bottom-1){n++;bottom=r.bottom;}else bottom=Math.max(bottom,r.bottom);}return n;}; // 줄 상자 수 — 세로로 겹치지 않는 사각형 무리
 const multi=[...pop.querySelectorAll('.hanja-pop__hun,.hanja-pop__pl,.hanja-pop__tile > span,.hanja-pop__note,.hanja-pop__fc > *,.hanja-pop__unknown')].filter(el=>el.getClientRects().length&&el.textContent.trim()&&lines(el)>1).map(el=>el.className+':'+el.textContent);
 const over=rows.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className+':'+el.textContent);
 const content=[...pop.children].filter(el=>el.getClientRects().length&&!el.classList.contains('hanja-pop__arrow')&&!el.classList.contains('hanja-pop__close')).map(b);
 const anchor=card.querySelector('.word-fit__char--active');
 const arrow=pop.querySelector('.hanja-pop__arrow');
 return {pop:p,body,card:cardBox,vh:innerHeight,vw:innerWidth,gradeTop:grade?b(grade).top:null,multi,over,contentBottom:Math.max(...content.map(c=>c.bottom)),
  anchor:anchor?b(anchor):null,arrowX:arrow&&getComputedStyle(arrow).display!=='none'?b(arrow).left+b(arrow).width/2:null,view:pop.dataset.view,compact:pop.dataset.compact||null,shifted:pop.dataset.shifted||null,
  focus:document.activeElement===pop?'pop':document.activeElement?.closest?.('.hanja-pop')?document.activeElement.className:document.activeElement?.dataset?.inspectKey!=null?`char:${document.activeElement.textContent}`:document.activeElement?.tagName,
  text:pop.innerText,dialog:{role:pop.getAttribute('role'),modal:pop.getAttribute('aria-modal'),label:document.getElementById(pop.getAttribute('aria-labelledby'))?.textContent||null},
  oldCard:card.querySelectorAll('.char-inspect').length};
});
function assertPopGeometry(g,{label,width}) {
 assert.ok(g,`${label}: popover visible`);
 assert.equal(g.dialog.role,'dialog');assert.equal(g.dialog.modal,'false');assert.ok(g.dialog.label,`${label}: labelled by its head`);
 assert.ok(Math.abs(g.pop.width-width)<=1,`${label}: width ${g.pop.width} (expected ${width})`);
 assert.ok([170,152].some(h=>Math.abs(g.pop.height-h)<=1),`${label}: fixed height ${g.pop.height}`);
 assert.deepEqual(g.multi,[],`${label}: every line in the popover is one line`);
 assert.deepEqual(g.over,[],`${label}: no row overflows its box`);
 assert.ok(g.contentBottom<=g.pop.bottom+.5,`${label}: content stays inside the fixed box (${g.contentBottom} / ${g.pop.bottom})`);
 assert.ok(g.pop.left>=g.body.left-.5&&g.pop.right<=g.body.right+.5,`${label}: inside the card horizontally`);
 assert.ok(g.pop.top>=g.body.top-.5&&g.pop.bottom<=Math.min(g.vh,g.card.bottom)+.5,`${label}: the whole popover is visible (no clipping) ${JSON.stringify(g.pop)}`);
 if(g.gradeTop!==null)assert.ok(g.pop.bottom<=g.gradeTop-3+.5,`${label}: does not cover the grade buttons (${g.pop.bottom} ≤ ${g.gradeTop} − 3)`);
 assert.equal(g.oldCard,0,`${label}: no character card in Chinese general mode`);
 assert.ok(!/\bAI\b/.test(g.text),`${label}: no 「AI」 label`);
}
// 색 대비 — 머리 훈(뜻 색)·음(소리 색)·뜻 조각 글자·표지가 그 바탕 위에서 4.5:1 이상(종이·밝게·어둡게).
const popContrast=page=>page.evaluate(()=>{
 const card=[...document.querySelectorAll('#inspector-word')].find(el=>el.getClientRects().length);
 const pop=card.querySelector('.hanja-pop');
 const parse=s=>{let m=s.match(/rgba?\(([^)]+)\)/);if(m){const v=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {rgb:v.slice(0,3),a:v[3]??1};}
  m=s.match(/color\(srgb ([^)]+)\)/);if(m){const v=m[1].split(/[ /]+/).filter(Boolean).map(Number);return {rgb:v.slice(0,3).map(x=>x*255),a:v[3]??1};}return null;};
 const lum=([r,g,b])=>{const f=c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>=.99)return c.rgb;}return [255,255,255];};
 const pair=sel=>{const el=pop.querySelector(sel);if(!el)return null;const c=parse(getComputedStyle(el).color);return {sel,color:getComputedStyle(el).color,ratio:Math.round(ratio(c.rgb,bgOf(el))*100)/100};};
 const same=(a,b)=>getComputedStyle(pop.querySelector(a)).color===getComputedStyle(pop.querySelector(b)).color;
 return {pairs:['.hanja-pop__hun .is-meaning','.hanja-pop__hun .is-sound','.hanja-pop__piece.is-meaning','.hanja-pop__piece.is-meaning i','.hanja-pop__piece.is-sound strong','.hanja-pop__piece.is-sound i','.hanja-pop__ch--zheng','.hanja-pop__tile em'].map(pair),
  meaningLinked:same('.hanja-pop__hun .is-meaning','.hanja-pop__piece.is-meaning b'),soundLinked:same('.hanja-pop__hun .is-sound','.hanja-pop__piece.is-sound strong'),
  meaningVsSound:getComputedStyle(pop.querySelector('.hanja-pop__hun .is-meaning')).color!==getComputedStyle(pop.querySelector('.hanja-pop__hun .is-sound')).color};
});

test('AE-R4 390 · 1440: 壮观의 观 → 한자 창(머리 · 구성 · 같은 한자어) — 한 줄 · 크기 고정 · 이동 0 · 등급 가림 0 · 키보드로 열기·드릴다운·닫기 · Esc·바깥·같은 글자로 닫힘 · 색 대비',{timeout:240000},async()=>{
 for(const [width,height,popWidth] of [[390,844,346],[1440,900,318]]){
  const f=await open(glyphMaterial(),{prefs:zhPrefs,rows:glyphRows,width,height,saved:savedCanguan()});
  const label=`观 ${width}`;
  try{
   await until(()=>f.bulk.length>=1);
   await tap(f,'id_0_7','웅장하다, 장관이다');
   await visibleCard(f.page).locator('.word-fit__hun').first().waitFor();
   await f.page.waitForTimeout(400);
   const before=await cardBoxes(f.page);
   const mark=f.requests.length;
   // 키보드만: 표제어 글자에 포커스 → Enter로 연다 → 창으로 포커스
   const guan=visibleCard(f.page).locator('.word-fit__char',{hasText:'观'});
   await guan.focus();await f.page.keyboard.press('Enter');
   const pop=popOf(f.page);
   await pop.waitFor();
   await pop.locator('.hanja-pop__tile').nth(2).waitFor();
   await pop.locator('.hanja-pop__piece.is-sound').waitFor();
   await f.page.waitForTimeout(200);
   let g=await popGeometry(f.page);
   assertPopGeometry(g,{label,width:popWidth});
   assert.equal(g.focus,'pop',`${label}: focus moves into the popover`);
   assert.ok(g.arrowX!==null&&Math.abs(g.arrowX-(g.anchor.left+g.anchor.width/2))<=1.5,`${label}: arrow points at the tapped glyph`);
   const size=[g.pop.width,g.pop.height].join('x'),place=[g.pop.left,g.pop.top].join(',');
   assert.deepEqual(await cardBoxes(f.page),before,`${label}: opening moves no card element`);
   assert.equal(await pop.locator('.hanja-pop__head').innerText().then(t=>t.replace(/\s+/g,' ').trim()),'观 guān → 觀 볼 관');
   assert.equal(await pop.locator('.hanja-pop__piece.is-meaning').getAttribute('aria-label'),'見 볼 견, 뜻 조각');
   assert.equal(await pop.locator('.hanja-pop__piece.is-sound').getAttribute('aria-label'),'雚 황새 관, 소리 조각');
   const tiles=await pop.locator('.hanja-pop__tile .hanja-pop__tzh').allInnerTexts();
   assert.ok(tiles.length===3&&tiles[0]==='参观'&&!tiles.includes('壮观'),`${label}: 3 tiles, my word first, current word excluded: ${tiles}`);
   assert.equal(await pop.locator('.hanja-pop__tile').first().locator('.hanja-pop__mine').innerText(),'내 단어');
   assert.equal(await pop.locator('.hanja-pop__tile').first().locator('em').allInnerTexts().then(x=>x.join('|')),'guān|观|관');
   assert.equal(await pop.locator('.hanja-pop__parts .hanja-pop__py').count(),0,'no pinyin on the pieces');
   // 색 연결 · 대비(종이 · 밝게 · 어둡게)
   for(const theme of ['sepia','light','dark']){
    await f.page.evaluate(t=>document.querySelector('.viewer-layout').setAttribute('data-reader-theme',t),theme);
    const c=await popContrast(f.page);
    assert.ok(c.meaningLinked&&c.soundLinked&&c.meaningVsSound,`${label} ${theme}: head hun/eum colors = piece colors ${JSON.stringify(c)}`);
    for(const p of c.pairs)assert.ok(p&&p.ratio>=4.5,`${label} ${theme}: contrast ${JSON.stringify(p)}`);
   }
   await f.page.evaluate(()=>document.querySelector('.viewer-layout').setAttribute('data-reader-theme','sepia'));
   if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/hanja-pop-guan-${width}.png`});
   // 키보드 드릴다운: Tab → 見(뜻 조각) → Tab → 雚(소리 조각) → Enter → 같은 소리 글자 화면, 포커스는 ‹
   await f.page.keyboard.press('Tab');
   assert.equal(await f.page.evaluate(()=>document.activeElement?.dataset?.piece),'見');
   await f.page.keyboard.press('Tab');
   assert.equal(await f.page.evaluate(()=>document.activeElement?.dataset?.piece),'雚');
   await f.page.keyboard.press('Enter');
   await pop.locator('.hanja-pop__fc').nth(4).waitFor();
   g=await popGeometry(f.page);
   assertPopGeometry(g,{label:`${label} drill`,width:popWidth});
   assert.equal(g.view,'sound');assert.equal([g.pop.width,g.pop.height].join('x'),size,'drilldown keeps the size');assert.equal([g.pop.left,g.pop.top].join(','),place,'drilldown keeps the place');
   assert.equal(await f.page.evaluate(()=>document.activeElement?.classList.contains('hanja-pop__back')),true,'focus on ‹');
   assert.deepEqual(await pop.locator('.hanja-pop__fc b').allInnerTexts(),['觀','權','歡','勸','灌']);
   assert.equal(await pop.locator('.hanja-pop__fc .hanja-pop__fpy').first().innerText(),'guān');
   assert.equal(await pop.locator('.hanja-pop__note').innerText(),'雚이 들면 대개 관·권·환 (guan·quan·huan)');
   assert.deepEqual(await cardBoxes(f.page),before,`${label}: drilldown moves no card element`);
   if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/hanja-pop-drill-${width}.png`});
   await f.page.keyboard.press('Enter'); // ‹
   await pop.locator('.hanja-pop__piece.is-sound').waitFor();
   await until(()=>f.page.evaluate(()=>document.activeElement?.dataset?.piece==='雚'));
   // 뜻 조각 → 그 글자의 창(見 → 见으로 단어를 찾는다), ‹로 돌아간다
   await f.page.keyboard.press('Shift+Tab');await f.page.keyboard.press('Enter');
   await visibleCard(f.page).locator('.hanja-pop[data-view="char"]').waitFor();
   g=await popGeometry(f.page);
   assertPopGeometry(g,{label:`${label} 見`,width:popWidth});
   assert.equal([g.pop.width,g.pop.height].join('x'),size);
   assert.match(await pop.locator('.hanja-pop__head').innerText(),/見\s*jiàn\s*볼 견/);
   const jianTiles=await pop.locator('.hanja-pop__tile .hanja-pop__tzh').allInnerTexts();
   assert.ok(jianTiles.length>0&&jianTiles.every(w=>w.includes('见')),`見 window finds words with 见: ${jianTiles}`);
   await f.page.keyboard.press('Enter'); // ‹
   await pop.locator('.hanja-pop__piece.is-meaning').waitFor();
   // Esc → 닫히고 포커스가 观으로
   await f.page.keyboard.press('Escape');
   await pop.waitFor({state:'detached'});
   assert.equal(await f.page.evaluate(()=>document.activeElement?.textContent),'观','Esc returns focus to the glyph');
   assert.equal(await visibleCard(f.page).locator('.word-detail-card__meaning').count(),1,'Esc closes only the popover, not the word card');
   assert.deepEqual(await cardBoxes(f.page),before,`${label}: closing moves no card element`);
   // 마우스: 열기 → 다른 글자(壮)는 내용만 바뀌고 크기 그대로 → 같은 글자 다시 → 닫힘
   await guan.click();await pop.locator('.hanja-pop__tile').first().waitFor();
   const zhuang=visibleCard(f.page).locator('.word-fit__char',{hasText:'壮'});
   await zhuang.click();
   await until(async()=>(await pop.locator('.hanja-pop__head').innerText()).includes('壯'));
   g=await popGeometry(f.page);
   assertPopGeometry(g,{label:`${label} 壮`,width:popWidth});
   assert.equal([g.pop.width,g.pop.height].join('x'),size,'another glyph keeps the size');
   assert.ok(Math.abs(g.arrowX-(g.anchor.left+g.anchor.width/2))<=1.5,'arrow follows the new glyph');
   assert.deepEqual(await cardBoxes(f.page),before,`${label}: switching glyphs moves no card element`);
   await zhuang.click();
   await pop.waitFor({state:'detached'});
   // 바깥 누르기 → 닫히고 포커스가 그 글자로
   await guan.click();await pop.waitFor();
   await visibleCard(f.page).locator('.reader-card-sentence').click();
   await pop.waitFor({state:'detached'});
   // 복귀는 누른 몸짓(click)이 끝난 뒤다 — 그 사이 카드 상자(tabIndex=-1)로 간 기본 포커스를 글자로 되돌린다.
   await until(()=>f.page.evaluate(()=>document.activeElement?.textContent==='观'),2000).catch(async()=>assert.fail(`outside press returns focus to the glyph (active: ${await f.page.evaluate(()=>document.activeElement?.className)})`));
   assert.deepEqual(await cardBoxes(f.page),before);
   // ✕
   await guan.click();await pop.waitFor();
   await pop.getByRole('button',{name:'닫기',exact:true}).click();
   await pop.waitFor({state:'detached'});
   assert.deepEqual(writesSince(f,mark).filter(r=>/\/rest\/v1\/(?!rpc\/)|\/api\/(learning|dict-correct)/.test(r.url)),[],'display only: no writes while the popover is used');
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 }
});

test('AE-R4 390 첫 화면 우선: 3줄 문장 속 体育场의 场 · 技术의 术(역할 미상) — 창이 등급 버튼을 가리지 않고 다 보이며, 닫으면 첫 화면 계약 그대로',{timeout:180000},async()=>{
 const m=cardMaterial();
 const f=await open(m,{prefs:zhPrefs,rows:glyphRows});
 try{
  await until(()=>f.bulk.length>=1);
  const longId=m.sequence.find(id=>id.startsWith('id_2_')&&m.dictionary[id].text==='体育场');
  await tap(f,longId,'경기장');
  await f.page.waitForTimeout(400);
  const before=await cardBoxes(f.page);
  await visibleCard(f.page).locator('.word-fit__char',{hasText:'场'}).click();
  const pop=popOf(f.page);
  await pop.locator('.hanja-pop__head').waitFor();
  await f.page.waitForTimeout(300);
  const g=await popGeometry(f.page);
  assertPopGeometry(g,{label:'场 3-line 390',width:346});
  assert.deepEqual(await cardBoxes(f.page),before,'opening moves no card element');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/hanja-pop-budget-390.png`});
  await f.page.keyboard.press('Escape');await pop.waitFor({state:'detached'});
  assertFirstScreen(await measure(f.page),{label:'3-line + 体育场 after the popover'});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 const t=build([[{text:'技术',base_form:'技术',furigana:'jì shù',meaning:'기술',pos:'명사'},{text:'。',base_form:'。',pos:'기호'}]],'Chinese');
 const h=await open(t,{prefs:zhPrefs,width:1440,height:900});
 try{
  await tap(h,'id_0_0','기술');
  await visibleCard(h.page).locator('.word-fit__char',{hasText:'术'}).click();
  const pop=popOf(h.page);
  await pop.locator('.hanja-pop__parts.is-unknown').waitFor();
  const g=await popGeometry(h.page);
  assertPopGeometry(g,{label:'术 1440',width:318});
  assert.equal((await pop.locator('.hanja-pop__head').innerText()).replace(/\s+/g,' ').trim(),'术 shù → 術 재주 술');
  assert.equal(await pop.locator('.hanja-pop__head .is-meaning, .hanja-pop__head .is-sound, .hanja-pop__parts .is-meaning, .hanja-pop__parts .is-sound').count(),0,'unknown role: no role colors');
  assert.ok((await pop.locator('.hanja-pop__parts').innerText()).includes('역할 미상'));
  assert.equal(await pop.locator('.hanja-pop__parts [title="삽주뿌리 출"]').count(),1,'original hun of 术 stays in the title');
  if(process.env.COMPOSER_SCREENSHOTS)await h.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/hanja-pop-shu-1440.png`});
  assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});

// M09 V7 FAIL(2026-10-09, #1337 6074340330): 창을 연 채 화면이 390×844 → 320×640으로 줄면 창이 등급 버튼을 덮고 화면 아래로
// 20px 넘쳤다(닫았다 다시 열면 정상). 크기 맞춤(한 단계 작게 · 위로 올림)을 글자를 열 때 한 번만 정해, 창 크기가 바뀌어도 옛 값을 썼기 때문.
test('AE-R4: 창을 연 채 화면이 390×844 → 320×640으로 줄어도 다 보이고 등급 버튼을 가리지 않는다(다시 연 것과 같은 자리)',{timeout:180000},async()=>{
 const geometryOk=(g,label)=>{
  assert.ok(g,`${label}: popover visible`);
  assert.ok(g.pop.left>=g.body.left-.5&&g.pop.right<=g.body.right+.5,`${label}: inside the card horizontally`);
  assert.ok(g.pop.top>=g.body.top-.5&&g.pop.bottom<=Math.min(g.vh,g.card.bottom)+.5,`${label}: the whole popover is visible ${JSON.stringify({pop:g.pop,body:g.body,card:g.card,vh:g.vh})}`);
  if(g.gradeTop!==null)assert.ok(g.pop.bottom<=g.gradeTop-3+.5,`${label}: does not cover the grade buttons (${g.pop.bottom} ≤ ${g.gradeTop} − 3)`);
 };
 const f=await open(glyphMaterial(),{prefs:zhPrefs,rows:glyphRows,width:390,height:844,saved:savedCanguan()});
 try{
  await until(()=>f.bulk.length>=1);
  await tap(f,'id_0_7','웅장하다, 장관이다');
  await visibleCard(f.page).locator('.word-fit__hun').first().waitFor();
  await visibleCard(f.page).locator('.word-fit__char',{hasText:'观'}).click();
  const pop=popOf(f.page);
  await pop.locator('.hanja-pop__head').waitFor();
  await f.page.waitForTimeout(300);
  geometryOk(await popGeometry(f.page),'观 opened at 390×844');
  await f.page.setViewportSize({width:320,height:640});
  await f.page.waitForTimeout(500);
  const resized=await popGeometry(f.page);
  geometryOk(resized,'观 still open after 390×844 → 320×640');
  await f.page.keyboard.press('Escape');await pop.waitFor({state:'detached'});
  await visibleCard(f.page).locator('.word-fit__char',{hasText:'观'}).click();
  await pop.locator('.hanja-pop__head').waitFor();
  await f.page.waitForTimeout(300);
  const fresh=await popGeometry(f.page);
  geometryOk(fresh,'观 reopened at 320×640');
  assert.ok(Math.abs(resized.pop.top-fresh.pop.top)<=1&&Math.abs(resized.pop.height-fresh.pop.height)<=1,`resized popover matches a fresh open (${resized.pop.top}/${resized.pop.height} vs ${fresh.pop.top}/${fresh.pop.height})`);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R4: 일본어 자료는 글자 카드 그대로(한자 창 0)',{timeout:180000},async()=>{
 const ja=build([[{text:'天気',base_form:'天気',furigana:'てんき',meaning:'날씨',pos:'명사'},{text:'。',base_form:'。',pos:'기호'}]],'Japanese');
 const j=await open(ja);
 try{
  await tap(j,'id_0_0','날씨');
  await visibleCard(j.page).locator('.word-fit__char',{hasText:'天'}).click();
  await visibleCard(j.page).locator('.char-inspect').waitFor();
  assert.equal(await visibleCard(j.page).locator('.hanja-pop').count(),0);
  assert.deepEqual(j.errors,[]);
 }finally{await j.context.close();}
});

// ───────────────────────── AD-R4 PR③ 「뜻 확인 필요 N개」 줄 · 목록 · 카드 ⓘ(설계서 docs/manabi-viewer-v2-ad-r4.md §6·§7·§9.1·§10) ─────────────────────────
// 서버 상수 ZH_SENSE_REVIEW는 꺼진 채라 운영 자료에는 표식이 없다 — 여기서는 meaningCheck가 실린 처리 결과(합성 픽스처)로 화면을 잰다.
// 쓰기는 AE-R1 PR③ 사전 뜻 교정 경로(correctTokenMutation: processed_json PATCH + token_corrections 이력) 하나 — 단어장·FSRS·
// 공유 사전·전역 승격(/api/dict-correct) 쓰기 0. 「AI」 표시 0. 정본 목업 문장: 我给妈妈打了一个电话。他吃醋了。/ 运动员的身体素质非常好。
function senseMaterial({flags=true}={}) {
 const w=(text,furigana,meaning,pos='명사',extra={})=>({text,base_form:text,furigana,meaning,pos,...(flags?extra:{})});
 return build([
  [w('我','wǒ','나','대명사'),w('给','gěi','~에게','전치사'),w('妈妈','mā ma','엄마'),w('打','dǎ','(전화를) 걸다','동사',{meaningCheck:'doubt'}),w('了','le','~했다','조사'),w('一个','yí gè','한 개','수량사'),w('电话','diàn huà','전화'),w('。','','','기호'),
   w('他','tā','그','대명사'),w('吃醋','chī cù','질투하다','동사',{meaningCheck:'ctx'}),w('了','le','~했다','조사'),w('。','','','기호')],
  [w('运动员','yùn dòng yuán','운동선수'),w('的','de','~의','조사'),w('身体','shēn tǐ','몸'),w('素质','sù zhì','자질'),w('非常','fēi cháng','매우','부사'),w('好','hǎo','좋다','형용사'),w('。','','','기호')],
 ],'Chinese');
}
const senseRows={
 打:{meanings:[{meaning:'때리다, 치다',priority:1,pos:'동사'},{meaning:'(전화를) 걸다',priority:2,pos:'동사'},{meaning:'(운동을) 하다',priority:3,pos:'동사'}],reading:'dǎ',pos:'동사'},
 吃醋:{meanings:[{meaning:'식초를 먹다',priority:1,pos:'동사'}],reading:'chī cù',pos:'동사'},
};
const reviewLine=f=>f.page.locator('.viewer-sense-review-line');
const reviewList=f=>f.page.locator('#inspector-sentence .viewer-sense-review').filter({visible:true});
const storedToken=(f,id)=>f.rows.find(r=>r.id===94171).processed_json.dictionary[id];
const closeSheet=async f=>{const close=f.page.getByRole('button',{name:'보조 패널 닫기',exact:true});if(await close.count()&&await close.isVisible())await close.click();};

test('AD-R4 390 owner: 「뜻 확인 필요 2개 [보기]」 → 시트 [문장] 탭 자리 목록 · 후보 교정 1회 → 표식 삭제 · N 감소 · [이대로 둘게요] → N 0 · 카드 ⓘ · 단어장 쓰기 0',{timeout:240000},async()=>{
 const m=senseMaterial();
 const f=await open(m,{prefs:zhPrefs,own:true,rows:senseRows});
 try{
  await until(()=>f.bulk.length>=1);
  const line=reviewLine(f);
  await line.waitFor();
  assert.equal((await line.innerText()).replace(/\s+/g,' ').trim(),'ⓘ 뜻 확인 필요 2개 보기','one line: ⓘ · count · [보기] · ✕(icon)');
  for(const name of ['보기','뜻 확인 필요 알림 닫기']){
   const box=await line.getByRole('button',{name,exact:true}).boundingBox();
   assert.ok(box.height>=44&&box.width>=44,`${name} target ≥ 44px: ${JSON.stringify(box)}`);
  }
  // 자리: 통계 줄(viewer-badges) 아래, 본문 위
  const geo=await f.page.evaluate(()=>{const r=s=>document.querySelector(s)?.getBoundingClientRect();return {badges:r('.viewer-badges'),line:r('.viewer-sense-review-line'),reader:r('.reader-area')};});
  if(geo.badges)assert.ok(geo.line.top>=geo.badges.bottom-.5,'below the stats line');
  assert.ok(geo.line.bottom<=geo.reader.top+.5,'above the text');
  // 카드 ⓘ: 표식이 있는 단어만, 뜻 줄 아래 — 첫 화면 계약 그대로
  await tap(f,'id_0_9','질투하다');
  await f.page.locator('#inspector-word .word-fit__hun').first().waitFor();
  const tip=f.page.locator('#inspector-word .reader-card-meaning-check').filter({visible:true});
  assert.equal(await tip.innerText(),'ⓘ 문맥과 다를 수 있어요');
  const g=await measure(f.page);
  assertFirstScreen(g,{label:'zh 390 card with ⓘ'});
  const tipBox=await tip.boundingBox();
  assert.ok(tipBox.y>=g.meaning.bottom-.5,'ⓘ sits under the meaning line');
  const senses=f.page.locator('#inspector-word .reader-card-senses');
  await senses.waitFor();
  assert.equal(await senses.locator('.reader-card-sense.is-current').count(),0,'context meaning outside the dictionary list: no painted line');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/sense-review-card-390.png`});
  await tap(f,'id_0_6','전화');
  assert.equal(await f.page.locator('#inspector-word .reader-card-meaning-check').count(),0,'no ⓘ without the marker');
  // [보기] → 목록(새 화면 아님 — 시트 [문장] 탭 자리)
  await closeSheet(f);
  await line.getByRole('button',{name:'보기',exact:true}).click();
  const list=reviewList(f);
  await list.waitFor();
  assert.equal(await f.page.locator('#inspector-sentence-tab').getAttribute('aria-selected'),'true','the [문장] tab holds the list');
  await until(async()=>(await f.page.evaluate(()=>document.activeElement?.id))==='viewer-sense-review-title');
  assert.equal(await list.locator('h2').innerText(),'뜻 확인 필요 · 2개');
  const rows=list.locator('.viewer-sense-review__row');
  assert.equal(await rows.count(),2,'sentence order: 打 then 吃醋');
  const [da,cu]=[rows.nth(0),rows.nth(1)];
  assert.equal(await da.locator('mark').innerText(),'打');
  assert.equal(await da.locator('.viewer-sense-review__sentence').innerText(),'我给妈妈打了一个电话。');
  assert.equal(await da.locator('.viewer-sense-review__now').innerText(),'지금: (전화를) 걸다');
  await da.locator('.viewer-sense-review__option').first().waitFor();
  assert.deepEqual(await da.locator('.viewer-sense-review__option').evaluateAll(els=>els.map(e=>[e.dataset.meaning,e.getAttribute('aria-pressed')])),
   [['때리다, 치다','false'],['(전화를) 걸다','true'],['(운동을) 하다','false']]);
  assert.equal(await cu.locator('mark').innerText(),'吃醋');
  assert.equal(await cu.locator('.viewer-sense-review__now').innerText(),'지금: 질투하다','context meaning shown as is (no tag)');
  assert.deepEqual(await cu.locator('.viewer-sense-review__option').evaluateAll(els=>els.map(e=>[e.dataset.meaning,e.getAttribute('aria-pressed')])),[['식초를 먹다','false']]);
  for(const b of await list.locator('button').all()){const box=await b.boundingBox();assert.ok(box.height>=44,`list target ≥ 44px: ${await b.innerText()} ${box.height}`);}
  const listText=await list.innerText();
  assert.doesNotMatch(listText+(await line.innerText()),/\bAI\b|인공지능/,'no 「AI」 label');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/sense-review-list-390.png`});
  // 후보 교정 1회 → 그 토큰의 표식 삭제 · N 감소, 쓰기는 기존 교정 경로 하나
  const mark=f.requests.length;
  await da.getByRole('button',{name:'때리다, 치다'}).click();
  await until(()=>storedToken(f,'id_0_3').meaning==='때리다, 치다');
  assert.ok(!Object.hasOwn(storedToken(f,'id_0_3'),'meaningCheck'),'the marker is removed with the same PATCH');
  assert.equal(storedToken(f,'id_0_3').pos,'동사');
  assert.equal(storedToken(f,'id_0_3').furigana,'dǎ','reading untouched');
  assert.equal(storedToken(f,'id_0_9').meaningCheck,'ctx','other tokens keep their marker');
  await until(async()=>(await line.innerText()).includes('뜻 확인 필요 1개'));
  await until(async()=>(await list.locator('h2').innerText())==='뜻 확인 필요 · 1개');
  assert.equal(await da.locator('.viewer-sense-review__now').innerText(),'지금: 때리다, 치다');
  assert.equal(await da.locator('.viewer-sense-review__option[aria-pressed="true"]').getAttribute('data-meaning'),'때리다, 치다');
  assert.equal(await da.locator('.viewer-sense-review__done').innerText(),'확인했어요','the fixed row stays in place');
  await f.page.waitForTimeout(400);
  let writes=writesSince(f,mark);
  assert.equal(writes.filter(r=>r.method==='PATCH'&&r.url.includes('/rest/v1/reading_materials')).length,1,'one correction write');
  assert.equal(writes.filter(r=>r.method==='POST'&&r.url.includes('/rest/v1/token_corrections')).length,1,'correction history');
  assert.deepEqual(writes.filter(r=>!r.url.includes('/rest/v1/reading_materials')&&!r.url.includes('/rest/v1/token_corrections')&&!r.url.includes('/rest/v1/library_reading_activity')),[],'no vocabulary, FSRS, dict-correct or dictionary writes');
  // [이대로 둘게요] = 지금 뜻을 확정 교정 → 표식 삭제 → N 0이면 줄이 없다
  const mark2=f.requests.length;
  await cu.getByRole('button',{name:'이대로 둘게요',exact:true}).click();
  await until(()=>!Object.hasOwn(storedToken(f,'id_0_9'),'meaningCheck'));
  assert.equal(storedToken(f,'id_0_9').meaning,'질투하다','the current meaning is kept');
  assert.equal(storedToken(f,'id_0_3').meaning,'때리다, 치다','the earlier correction is not overwritten by a stale copy');
  await until(async()=>(await line.count())===0);
  assert.equal(await cu.locator('.viewer-sense-review__done').innerText(),'확인했어요');
  await f.page.waitForTimeout(400);
  writes=writesSince(f,mark2);
  assert.equal(writes.filter(r=>r.method==='PATCH'&&r.url.includes('/rest/v1/reading_materials')).length,1);
  assert.equal(writes.filter(r=>r.method==='POST'&&r.url.includes('/rest/v1/token_corrections')).length,1);
  assert.deepEqual(writes.filter(r=>!r.url.includes('/rest/v1/reading_materials')&&!r.url.includes('/rest/v1/token_corrections')&&!r.url.includes('/rest/v1/library_reading_activity')),[]);
  // 카드 ⓘ도 사라진다
  await tap(f,'id_0_9','질투하다');
  assert.equal(await f.page.locator('#inspector-word .reader-card-meaning-check').count(),0,'ⓘ disappears once confirmed');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AD-R4: 열람자는 줄 0(카드 ⓘ만) · 소유자라도 N=0이면 줄 0 · ✕는 그 viewerRevision 동안 다시 띄우지 않는다',{timeout:240000},async()=>{
 const viewer=await open(senseMaterial(),{prefs:zhPrefs,rows:senseRows});
 try{
  await until(()=>viewer.bulk.length>=1);
  await viewer.page.waitForTimeout(800);
  assert.equal(await reviewLine(viewer).count(),0,'not the owner: no line');
  await tap(viewer,'id_0_9','질투하다');
  assert.equal(await viewer.page.locator('#inspector-word .reader-card-meaning-check').filter({visible:true}).innerText(),'ⓘ 문맥과 다를 수 있어요','viewers still see the card ⓘ');
  assert.equal(await viewer.page.locator('#inspector-word .reader-card-sense__pick').count(),0,'and cannot correct');
  assert.deepEqual(viewer.errors,[]);
 }finally{await viewer.context.close();}
 const clean=await open(senseMaterial({flags:false}),{prefs:zhPrefs,own:true,rows:senseRows});
 try{
  await until(()=>clean.bulk.length>=1);
  await clean.page.waitForTimeout(800);
  assert.equal(await reviewLine(clean).count(),0,'owner with N = 0: no line');
  await tap(clean,'id_0_3','(전화를) 걸다');
  assert.equal(await clean.page.locator('#inspector-word .reader-card-meaning-check').count(),0);
  assert.deepEqual(clean.errors,[]);
 }finally{await clean.context.close();}
 const own=await open(senseMaterial(),{prefs:zhPrefs,own:true,rows:senseRows});
 try{
  await reviewLine(own).waitFor();
  const mark=own.requests.length;
  await reviewLine(own).getByRole('button',{name:'뜻 확인 필요 알림 닫기',exact:true}).click();
  await until(async()=>(await reviewLine(own).count())===0);
  assert.equal(await own.page.evaluate(()=>localStorage.getItem('viewer_sense_review_dismissed:94171:0')),'1');
  // 자료를 열 때의 읽기 활동 기록(library_reading_activity)은 시점이 늦게 올 수 있어 뺀다 — 닫기 자체는 쓰기 0.
  assert.deepEqual(writesSince(own,mark).filter(r=>!r.url.includes('/rest/v1/library_reading_activity')),[],'dismiss is local only');
  await own.page.reload({waitUntil:'domcontentloaded'});
  await own.page.locator('[data-source-token="id_0_0"]').waitFor();
  await own.page.waitForTimeout(800);
  assert.equal(await reviewLine(own).count(),0,'stays dismissed for this revision');
  assert.deepEqual(own.errors,[]);
 }finally{await own.context.close();}
});

test('AD-R4 1280 owner: 옆 패널 [문장] 탭 자리 목록 — 후보는 한 줄에 하나, 누름 영역 44px',{timeout:240000},async()=>{
 const f=await open(senseMaterial(),{prefs:zhPrefs,own:true,rows:senseRows,width:1280,height:900});
 try{
  await until(()=>f.bulk.length>=1);
  await reviewLine(f).getByRole('button',{name:'보기',exact:true}).click();
  const list=reviewList(f);
  await list.waitFor();
  const panel=await f.page.locator('.viewer-inspector').filter({visible:true}).boundingBox();
  assert.ok(panel.width<=400,`side panel, not a sheet: ${panel.width}`);
  const opts=list.locator('.viewer-sense-review__row').first().locator('.viewer-sense-review__option');
  await opts.first().waitFor();
  const boxes=await opts.evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return {x:b.left,y:b.top,h:b.height};}));
  assert.equal(boxes.length,3);
  assert.ok(boxes.every(b=>Math.abs(b.x-boxes[0].x)<1&&b.h>=44),`stacked one per line: ${JSON.stringify(boxes)}`);
  assert.ok(boxes[1].y>boxes[0].y&&boxes[2].y>boxes[1].y);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'no horizontal overflow');
  if(process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/sense-review-list-1280.png`});
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
