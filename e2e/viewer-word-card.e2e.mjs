// 단어창 AE-R1(VIEWER-V2-ROUNDS-001 §2·§3, 설계서 docs/manabi-viewer-v2-ae-r1.md) — 실제 뷰어, 합성 자료만.
// 계정·제공자·DB 쓰기 없음. PR ①: 표제어 일괄 조회(§5.3) — 자료를 열 때 고유 표제어를 100개씩 받아
// 카드의 ['token-dict', lang, key] 캐시를 채운다. 요청 수 = ⌈고유 표제어/100⌉, 카드를 열 때 단건 조회 0,
// 실패하면 조용히 기존 단건 경로, 비로그인·한국어는 요청 0. 화면 출력은 바뀌지 않는다(같은 데이터를 더 일찍).
// PR ②가 첫 화면 기하·경로 보류·이동 0 계약을 이 파일에 더한다.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

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
 const texts=lines.map(l=>l.map(w=>w.text).join(language==='English'?' ':''));
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

async function open(material,{guest=false,dict='ok',prefs={focusMode:false,autoSpeakOnClick:false}}={}) {
 const f=await fixture({width:390,guest});
 await f.page.setViewportSize({width:390,height:844});
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
