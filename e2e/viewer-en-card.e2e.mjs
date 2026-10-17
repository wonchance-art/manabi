// 영어 단어 카드(EN-CARD-E2E, 2026-10-17 KST) — 실제 뷰어, 합성 자료만. 계정 · 제공자 · 운영 DB 쓰기 없음.
// 공개 영어 자료는 모두 분석 전이라 IPA 줄 · 영어 카드를 실데이터로 볼 수 없었다. 운영의 분석된 영어 자료(표본 10편 · 752토큰,
// 읽기 전용 조회)의 processed_json **모양**을 그대로 옮긴다 — 문장은 공개 가능한 합성 문장이다(개인 문장 0).
//  · 토큰 id = id_{줄}_{번호}_{분석 시각}, 개행 = br_{줄}_{분석 시각} · {text:'\n', pos:'개행'}(다른 칸 없음)
//  · furigana = IPA를 /…/째 저장(/ˈvɪz.ɪt/) — 기호 · 숫자 일부는 null. reading 칸은 없다.
//  · base_form = 소문자 기본형(visits → visit, The → the), pos = 한국어 품사, pos_all(겸류 「동사·명사」)은 있을 때만.
//  · meaning = 문자열(기호는 ''). 사전 행(morpheme_dictionary English) = reading IPA + meanings 배열(pos · meaning · priority · en_pos_v).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const AT='1791900000000';
const LINES=[
 [['The','the','관사','/ðiː/','그'],['reader','reader','명사','/ˈriː.dər/','독자'],['visits','visit','동사','/ˈvɪz.ɪt/','방문하다','동사·명사'],
  ['the','the','관사','/ðiː/','그'],['library','library','명사','/ˈlaɪ.brer.i/','도서관','명사·형용사'],['.','.','기호',null,'']],
 [['A','a','관사','/ə/','하나의','관사·수사'],['quiet','quiet','형용사','/ˈkwaɪ.ət/','조용한'],['reader','reader','명사','/ˈriː.dər/','독자'],
  ['opens','open','동사','/ˈoʊ.pən/','열다','동사·형용사'],['2','2','수사',null,'2, 둘'],['notebooks','notebook','명사','/ˈnoʊt.bʊk/','공책'],['.','.','기호',null,'']],
];
const id=(line,i)=>`id_${line}_${i}_${AT}`;
function material(){
 const sequence=[],dictionary={};
 LINES.forEach((row,line)=>{
  row.forEach(([text,base_form,pos,furigana,meaning,pos_all],i)=>{sequence.push(id(line,i));dictionary[id(line,i)]={text,base_form,pos,furigana,meaning,...(pos_all?{pos_all}:{})};});
  if(line<LINES.length-1){const br=`br_${line}_${AT}`;sequence.push(br);dictionary[br]={text:'\n',pos:'개행'};}
 });
 return {sequence,dictionary,raw:LINES.map(row=>row.map(w=>w[0]).join(' ').replace(/ \./g,'.')).join('\n')};
}
// 운영 사전 행과 같은 모양(notebook은 행 없음 — 카드가 토큰 값으로 서는 경로).
const DICT={
 visit:{reading:'/ˈvɪz.ɪt/',pos:'동사·명사',meanings:[{pos:'동사',meaning:'방문하다',en_pos_v:1,priority:1},{pos:'명사',meaning:'방문',priority:2}]},
 open:{reading:'/ˈoʊ.pən/',pos:'동사·형용사',meanings:[{pos:'동사',meaning:'열다',en_pos_v:1,priority:1},{pos:'형용사',meaning:'열린',priority:2}]},
 library:{reading:'/ˈlaɪ.brer.i/',pos:'명사',meanings:[{pos:'명사',meaning:'도서관',en_pos_v:1,priority:1}]},
 the:{reading:'/ðiː/',pos:'관사',meanings:[{pos:'관사',meaning:'그',en_pos_v:1,priority:1}]},
 a:{reading:'/ə/',pos:'관사',meanings:[{pos:'관사',meaning:'하나의',en_pos_v:1,priority:1}]},
 reader:{reading:'/ˈriː.dər/',pos:'명사',meanings:[{pos:'명사',meaning:'독자',en_pos_v:1,priority:1}]},
 quiet:{reading:'/ˈkwaɪ.ət/',pos:'형용사',meanings:[{pos:'형용사',meaning:'조용한',en_pos_v:1,priority:1}]},
};

async function open(width,height){
 const f=await fixture({width,height});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(()=>{if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{English:{focusMode:false,autoSpeakOnClick:false}}}));});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용'})}));
 await f.context.route(/\/api\/analyze(\/korean)?$/,r=>r.fulfill({contentType:'application/json',body:JSON.stringify({results:[]})}));
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 f.bulk=[];f.vocab=[];
 await f.context.route('**/rest/v1/morpheme_dictionary**',route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  assert.equal(req.method(),'GET','dictionary is read-only here');
  const filter=url.searchParams.get('base_form')||'';
  const send=body=>route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
  if(filter.startsWith('in.(')){
   const keys=filter.slice(4,-1).split(',').map(k=>k.replace(/^"|"$/g,''));
   f.bulk.push({keys,language:url.searchParams.get('language')});
   return send(keys.filter(k=>DICT[k]).map(k=>({base_form:k,...DICT[k]})));
  }
  const row=DICT[filter.slice(3)]?{base_form:filter.slice(3),...DICT[filter.slice(3)]}:null;
  return send(req.headers().accept?.includes('vnd.pgrst.object')?row:row?[row]:[]);
 });
 // 저장(비활성 FSRS = 기존 단어장 REST 경로) — 보낸 행을 그대로 받아 둔다.
 await f.context.route('**/rest/v1/user_vocabulary**',route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(req.method()==='POST'){const body=req.postDataJSON();const rows=(Array.isArray(body)?body:[body]).map((row,i)=>({...row,id:`00000000-0000-4000-8000-${String(89001+f.vocab.length+i).padStart(12,'0')}`,created_at:new Date().toISOString()}));f.vocab.push(...rows);return route.fulfill({status:201,contentType:'application/json',headers:cors,body:JSON.stringify(rows)});}
  return route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify(f.vocab)});
 });
 const m=material();
 f.rows.push({id:94501,user_id:owner,title:'영어 단어 카드 검수',raw_text:m.raw,source_type:'text',created_at:new Date().toISOString(),
  processed_json:{status:'completed',last_idx:m.sequence.length-1,failed_indices:[],metadata:{language:'English',viewerCorrections:{}},sequence:m.sequence,dictionary:m.dictionary}});
 await f.page.goto('/viewer/94501',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator(`[data-source-token="${id(0,0)}"]`).waitFor();
 return f;
}
const until=async(check,ms=10000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,50));}assert.fail('condition not met in time');};
const card=f=>f.page.locator('.word-detail-card').filter({visible:true}).first();
async function tap(f,tokenId,meaning){
 const close=f.page.getByRole('button',{name:'보조 패널 닫기',exact:true});
 if(await close.count()&&await close.isVisible())await close.click();
 await f.page.locator(`[data-source-token="${tokenId}"]`).click();
 await card(f).locator('.word-detail-card__meaning').getByText(meaning,{exact:true}).waitFor();
}
// 표제어 글자만(같은 칸 안의 IPA 줄은 뺀다).
const headword=f=>card(f).locator('.reader-card-lexeme').evaluate(el=>{const c=el.cloneNode(true);c.querySelectorAll('.reader-card-pronunciation').forEach(x=>x.remove());return c.textContent.replace(/\s+/g,' ').trim();});
const pron=f=>card(f).locator('.reader-card-pronunciation');
const GRADES=['다시','어려움','알맞음','쉬움'];

for(const [width,height] of [[390,844],[1440,900]]){
 test(`EN card ${width}: IPA line (stored /…/ as is) · base-form headword · meaning · dictionary senses · 4 grades · save carries the IPA (with or without a dictionary row)`,{timeout:180000},async()=>{
  const f=await open(width,height);
  try{
   await until(()=>f.bulk.length>=1);
   assert.equal(f.bulk[0].language,'eq.English');
   assert.ok(f.bulk[0].keys.includes('visit')&&!f.bulk[0].keys.includes('visits'),'headwords are base forms');
   assert.ok(!f.bulk.some(b=>b.keys.includes('\n')||b.keys.includes('.')),'newline and punctuation are not headwords');

   // ① 활용형(visits → visit): 표제어는 기본형, IPA 줄은 저장값 그대로 한 줄, 뜻 · 사전 뜻 목록 · 4등급
   await tap(f,id(0,2),'방문하다');
   assert.equal(await headword(f),'visit');
   assert.equal(await pron(f).count(),1);
   assert.equal(await pron(f).innerText(),'/ˈvɪz.ɪt/','IPA as stored — not re-wrapped');
   assert.ok(await card(f).locator('.word-detail-card__meaningrow--tight').count()===1,'meaning row tightens under the IPA line');
   const sentence=card(f).locator('.reader-card-sentence');
   assert.equal((await sentence.innerText()).trim(),'The reader visits the library.');
   assert.deepEqual(await sentence.locator('mark').allTextContents(),['visits']);
   const senses=card(f).locator('.reader-card-senses');
   await senses.waitFor();
   const senseText=await senses.innerText();
   assert.ok(senseText.includes('방문하다')&&senseText.includes('방문'),`dictionary senses: ${senseText}`);
   const actions=card(f).locator('.reader-card-actions');
   for(const grade of GRADES)assert.equal(await actions.getByRole('button',{name:new RegExp(`^${grade}`)}).count(),1,grade);

   // ② IPA 없는 토큰(숫자 2 — 운영 수사 7개 중 5개가 null): 줄 없음, 뜻 줄 간격 기본
   await tap(f,id(1,4),'2, 둘');
   assert.equal(await pron(f).count(),0,'no IPA → no line');
   assert.equal(await card(f).locator('.word-detail-card__meaningrow--tight').count(),0);

   // ③ 사전 행 없는 낱말(notebooks → notebook): 토큰 IPA · 뜻으로 카드가 선다
   await tap(f,id(1,5),'공책');
   assert.equal(await headword(f),'notebook');
   assert.equal(await pron(f).innerText(),'/ˈnoʊt.bʊk/');

   // ④ 대문자 관사(The → the)도 같은 길
   await tap(f,id(0,0),'그');
   assert.equal(await headword(f),'the');
   assert.equal(await pron(f).innerText(),'/ðiː/');

   // ⑤ 저장(알맞음) — 단어장 행: 기본형 · IPA(사전 읽기) · 영어 · 뜻 · 품사 · 출처 자료
   await tap(f,id(1,3),'열다');
   assert.equal(await headword(f),'open');
   await actions.getByRole('button',{name:/^알맞음/}).click();
   await until(()=>f.vocab.length===1);
   const row=f.vocab[0];
   assert.equal(row.base_form,'open');
   assert.equal(row.furigana,'/ˈoʊ.pən/','English keeps the IPA in the furigana column');
   assert.equal(row.language,'English');
   assert.equal(row.meaning,'열다');
   assert.equal(row.pos,'동사');
   assert.equal(String(row.source_material_id),'94501');
   assert.ok(row.next_review_at,'graded save carries an initial schedule');

   // ⑥ 사전 행 없는 활용형(notebooks → notebook) 저장 — 영어는 토큰의 기본형 IPA로 채운다(EN-SAVE-IPA-001).
   //    비면 복습 카드에서도 발음이 사라졌다(사전 읽기만 보던 저장).
   await tap(f,id(1,5),'공책');
   assert.equal(await headword(f),'notebook');
   await actions.getByRole('button',{name:/^알맞음/}).click();
   await until(()=>f.vocab.length===2);
   assert.equal(f.vocab[1].base_form,'notebook');
   assert.equal(f.vocab[1].furigana,'/ˈnoʊt.bʊk/','no dictionary row: the token IPA (already the base form) is saved');
   assert.equal(f.vocab[1].language,'English');
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 });
}
