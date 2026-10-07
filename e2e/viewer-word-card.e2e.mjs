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

async function open(material,{guest=false,dict='ok',prefs={focusMode:false,autoSpeakOnClick:false},width=390,height=844,saved=null}={}) {
 const f=await fixture({width,guest});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(({language,prefs})=>{
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{[language]:prefs}}));
 },{language:material.language,prefs});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용'})}));
 await f.context.route(/\/api\/analyze(\/korean)?$/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify({results:[]})}));
 // 픽스처 뒤에 등록한 경로가 먼저 받는다 — morpheme_dictionary 요청만 세고 합성 행으로 답한다.
 f.bulk=[];f.single=[];
 const rows=dictRows[material.language]||{};
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
  const key=filter.slice(3);f.single.push(key);
  const row=rows[key]||null;
  return send(req.headers().accept?.includes('vnd.pgrst.object')?row:row?[row]:[]);
 });
 // 저장 상태(합성) — 설계서 §7.3: legacyLearningSnapshot에 행을 넣어 「저장(복습 전)」을 만든다.
 if(saved)await f.context.route('**/api/learning/vocabulary**',route=>{
  const url=new URL(route.request().url());
  if(route.request().method()!=='GET'||url.searchParams.get('view')!=='learning')return route.fallback();
  return route.fulfill({contentType:'application/json',body:JSON.stringify(legacyLearningSnapshot({actorId:owner,rows:saved,fields:url.searchParams.get('fields')}))});
 });
 f.rows.push({id:94171,user_id:owner,title:'표제어 일괄 조회 검수',raw_text:material.texts.join('\n'),source_type:'text',created_at:new Date().toISOString(),
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
     meaningText:q('.word-detail-card__meaning')?.textContent,
     grades:document.querySelectorAll('#inspector-word .reader-card-actions .review-score-btn').length,hun:document.querySelectorAll('#inspector-word .word-fit__hun').length});
   }));
  }));
  const tops=()=>f.page.evaluate(()=>{const q=s=>document.querySelector(`#inspector-word ${s}`);const top=el=>el&&el.getClientRects().length?el.getBoundingClientRect().top:null;
   return {sentence:top(q('.reader-card-sentence')),chips:top(q('.word-detail-card__actions')),head:top(q('.reader-card-headword')),meaning:top(q('.word-detail-card__meaning'))};});
  for(const k of UPPER)assert.notEqual(t0[k],null,`${k} is in the first frame with the network held`);
  assert.equal(t0.meaningText,'경기장');
  assert.equal(t0.grades,4,'grades in the first frame');
  assert.equal(t0.hun,3,'hun ruby in the first frame (tables were loaded when the material opened)');
  const frames=[];
  await f.page.waitForTimeout(300);frames.push(await tops());
  await f.page.waitForTimeout(700);frames.push(await tops());
  // 늦게 풀어 준다 — 사전·번역·AI 응답이 와도 위쪽은 그대로여야 한다.
  await f.context.unroute('**/rest/v1/**',hold);await f.context.unroute('**/api/**',hold);
  for(const route of held.splice(0))await route.fallback().catch(()=>{});
  await f.page.waitForTimeout(2000);frames.push(await tops());
  for(const frame of frames)for(const k of UPPER)assert.equal(frame[k],t0[k],`${k} moved: ${t0[k]} → ${frame[k]}`);
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
