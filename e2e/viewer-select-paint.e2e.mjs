// 낱말 고르기는 그리기만 바꾼다(VIEWER-TAP-INP-002) — 실제 뷰어, 합성 자료만. 계정 · 제공자 · 운영 DB 없음.
// 낱말을 누르면 본문 안에서 바뀌는 것은 고른 낱말 · 직전 낱말의 data-selected 둘뿐이다. 예전에는 그 표시가 낱말에
// position:relative + ::before 상자를 새로 만들어, 쪽 넘김(다단) 보기에서 본문 전체가 다시 배치됐다 — 300줄 자료에서
// 탭 한 번에 250ms 넘게(390 · CPU×4). 이 계약은 시간이 아니라 Chromium의 배치 횟수(CDP Performance LayoutCount)로 잰다:
// 고름 표시를 켜고 끄는 동안 배치가 한 번도 일어나지 않아야 한다(시간 상한은 CI 러너 흔들림에 약해 두지 않는다).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';
import {legacyLearningSnapshot} from './fixtures/learning-snapshot.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
const words=[['私','わたし','나'],['は','','은/는'],['毎朝','まいあさ','매일 아침'],['駅','えき','역'],['まで','','까지'],['歩いて','あるいて','걸어서'],['行きます','いきます','갑니다'],['。','','']];
// 긴 자료(120줄 · 약 1,000낱말) — 다단 재배치 비용이 자료 길이에 비례하던 결함이라 짧은 자료로는 드러나지 않는다.
function material(lines=120){
 const sequence=[],dictionary={},texts=[];
 for(let line=0;line<lines;line++){
  const row=[...words.slice(0,7).slice(line%7),...words.slice(0,7).slice(0,line%7),words[7]];texts.push(row.map(w=>w[0]).join(''));
  row.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]={text,base_form:text,furigana,meaning,pos:text==='。'?'기호':'명사'};});
  if(line<lines-1){const id=`id_${line}_${row.length}`;sequence.push(id);dictionary[id]={text:'\n',base_form:'',pos:'개행'};}
 }
 return {id:94301,owner_id:owner,user_id:owner,visibility:'private',title:'고르기 그리기 검수',raw_text:texts.join('\n'),source_type:'text',created_at:new Date().toISOString(),
  processed_json:{status:'completed',metadata:{language:'Japanese'},sequence,dictionary}};
}

async function open(width,view){
 const f=await fixture({width,height:844});
 f.rows.push(material());
 await f.context.addInitScript(view=>{localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,common:{readerView:view},languages:{Japanese:{focusMode:false,autoSpeakOnClick:false,wordStateHl:true}}}));},view);
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 // 담은 낱말 둘(복습 시점 · 아직) — 학습 중 · 복습 띠와 밑줄이 있는 낱말도 같은 계약이다.
 const now=Date.now(),vocab=[['駅','역',-1],['歩いて','걸어서',5]].map(([word_text,meaning,days],i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,user_id:owner,word_text,meaning,language:'Japanese',interval:3,ease_factor:2.5,repetitions:2,next_review_at:new Date(now+days*86400000).toISOString(),last_reviewed_at:new Date(now-4*86400000).toISOString(),created_at:'2026-01-01'}));
 await f.context.route('**/rest/v1/user_vocabulary*',r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers:cors}):r.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(vocab)}));
 await f.context.route('**/api/learning/vocabulary**',r=>{const url=new URL(r.request().url());if(url.searchParams.get('view')!=='learning')return r.fallback();return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(legacyLearningSnapshot({actorId:owner,rows:vocab,known:[],exclusions:[],fields:url.searchParams.get('fields'),ids:url.searchParams.get('ids')}))});});
 await f.page.goto('/viewer/94301');
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 await f.page.locator('.reader-area .word-token--saved').first().waitFor();
 await f.page.waitForTimeout(1500);
 const cdp=await f.context.newCDPSession(f.page);await cdp.send('Performance.enable');
 const layouts=async()=>(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value;
 return {f,layouts};
}

// 상태가 다른 낱말들(새 단어 · 학습 중 · 복습 시점 · 줄 첫 낱말)을 차례로 골랐다 풀며, 매번 강제로 배치를 요구한다.
const toggle=(page,ids)=>page.evaluate(ids=>{
 const out=[];
 for(const id of ids){
  const t=document.querySelector(`[data-source-token="${id}"]`);
  const before=t.getBoundingClientRect();
  t.setAttribute('data-selected','true');document.body.offsetHeight;
  const after=t.getBoundingClientRect(),frame=t.querySelector('.surface > .word-frame:last-child');
  out.push({id,cls:t.className,moved:Math.abs(after.left-before.left)+Math.abs(after.top-before.top)+Math.abs(after.width-before.width),
   outline:frame&&getComputedStyle(frame).visibility==='visible'&&getComputedStyle(frame).outlineStyle,frameW:frame?Math.round(frame.getBoundingClientRect().width):-1,surfaceW:Math.round(t.querySelector('.surface').getBoundingClientRect().width)});
  t.removeAttribute('data-selected');document.body.offsetHeight;
 }
 return out;
},ids);

for(const [width,view] of [[390,'paged'],[1280,'paged'],[390,'scroll']]) test(`${width} ${view}: 낱말을 골라도 본문은 다시 배치되지 않는다(그리기만)`,{timeout:120000},async()=>{
 const {f,layouts}=await open(width,view);
 try{
  const ids=['id_0_2','id_0_3','id_0_5','id_0_0','id_1_3','id_2_5'];
  const states=await toggle(f.page,ids); // 한 번 데워 둔다(첫 스타일 계산)
  assert.ok(states.some(s=>/word-token--new/.test(s.cls))&&states.some(s=>/word-token--saved/.test(s.cls))&&states.some(s=>/word-token--due/.test(s.cls)),`전제: 새 단어 · 학습 중 · 복습 시점 낱말 — ${states.map(s=>s.cls).join(' / ')}`);
  for(const s of states){
   assert.equal(s.outline,'solid',`${s.id}: 고른 낱말의 테두리(.surface 마지막 칸 .word-frame)가 켜진다`);
   assert.equal(s.frameW,s.surfaceW,`${s.id}: 테두리 폭 = 글자 상자 폭`);
   assert.ok(s.moved<0.01,`${s.id}: 고르면 낱말 상자가 움직였다 ${s.moved}`);
  }
  const before=await layouts();
  await toggle(f.page,ids);
  const after=await layouts();
  assert.equal(after-before,0,`고르기 ${ids.length}번 · 풀기 ${ids.length}번 동안 배치 ${after-before}회 — 고름 표시가 배치 속성을 건드렸다`);
  // 검사 자체가 배치를 잡아내는지: 예전 방식(고르면 position:relative)을 덧씌우면 배치가 생긴다.
  await f.page.addStyleTag({content:'.viewer-layout .word-token[data-selected="true"]{position:relative}'});
  await f.page.evaluate(()=>document.body.offsetHeight);
  const b2=await layouts();await toggle(f.page,ids.slice(0,2));const a2=await layouts();
  assert.ok(a2-b2>0,'대조: 배치 속성을 바꾸는 고름 표시는 LayoutCount로 잡힌다');
 }finally{await f.context.close();}
});
