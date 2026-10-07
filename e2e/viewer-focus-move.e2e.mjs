// 문장 집중 첫 탭 = 순수 이동(오너 확정 2026-08-20) — 실제 뷰어, 합성 자료만. 계정·제공자·DB 쓰기 없음.
// VIEWER-R0-BUGS-001 버그 4: 첫 탭에 빈 보조 패널(탭 머리만) 대신 작은 문장 이동 막대만 뜨고,
// 같은 문장 안 두 번째 탭의 단어창은 390px에서 머리 한 줄(≤56px)로 표제어·뜻·등급 4버튼을 스크롤 없이 보인다.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const lines=[
 [['眼前','yǎn qián','눈앞'],['的','de','~의'],['体育场','tǐ yù chǎng','경기장'],['比','bǐ','~보다'],['照片','zhào piàn','사진'],['上','shàng','위'],['更','gèng','더'],['壮观','zhuàng guān','웅장하다'],['。','','마침표']],
 [['她','tā','그녀'],['尽量','jǐn liàng','되도록'],['别','bié','~하지 마라'],['熬夜','áo yè','밤을 새다'],['，','','쉼표'],['要','yào','~해야 한다'],['爱惜','ài xī','아끼다'],['身体','shēn tǐ','몸'],['。','','마침표']],
 [['我们','wǒ men','우리'],['明天','míng tiān','내일'],['去','qù','가다'],['公园','gōng yuán','공원'],['。','','마침표']],
 [['今天','jīn tiān','오늘'],['天气','tiān qì','날씨'],['很','hěn','매우'],['好','hǎo','좋다'],['。','','마침표']],
];
const texts=lines.map(l=>l.map(w=>w[0]).join(''));
const sequence=[],dictionary={};
lines.forEach((words,line)=>{
 words.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]={text,base_form:text,furigana,meaning,pos:/[。，]/.test(text)?'기호':'명사'};});
 if(line<lines.length-1){const id=`id_${line}_${words.length}`;sequence.push(id);dictionary[id]={text:'\n',base_form:'',furigana:'',meaning:'',pos:'개행'};}
});

async function open(width,height=844,prefs={focusMode:true,autoSpeakOnClick:false}) {
 const f=await fixture({width});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(prefs=>{
  // 새 컨텍스트에 한 번만 심는다 — 이후에는 UI가 실제로 저장한 값을 읽는다.
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{Chinese:prefs}}));
 },prefs);
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용 맥락'})}));
 f.rows.push({id:94131,user_id:owner,title:'문장 집중 이동 검수',raw_text:texts.join('\n'),source_type:'text',created_at:new Date().toISOString(),
  processed_json:{status:'completed',metadata:{language:'Chinese',translations:{[texts[0]]:'눈앞의 경기장은 사진보다 더 웅장하다.'}},sequence,dictionary}});
 await f.page.goto('/viewer/94131',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 return f;
}
const token=(f,line,i)=>f.page.locator(`[data-source-token="id_${line}_${i}"]`);
const pickedLines=f=>f.page.locator('.word-token--picked').evaluateAll(els=>[...new Set(els.map(el=>el.dataset.sourceToken?.split('_')[1]))]);
const bar=f=>f.page.getByRole('toolbar',{name:'문장 이동',exact:true});
const visibleInspectors=f=>f.page.locator('.viewer-inspector').evaluateAll(els=>els.filter(el=>el.getClientRects().length>0).map(el=>Math.round(el.getBoundingClientRect().height)));

async function firstTapIsPureMove(f) {
 const before=await f.page.locator('.reader-area').boundingBox();
 await token(f,0,2).click();
 await f.page.locator('[data-source-token="id_0_2"].word-token--picked').waitFor();
 await f.page.waitForTimeout(300);
 assert.deepEqual(await pickedLines(f),['0'],'first tap designates the sentence');
 assert.deepEqual(await visibleInspectors(f),[],'no empty word/sentence panel after the first tap');
 await bar(f).waitFor();
 assert.equal(await f.page.locator('.word-detail-card').count(),0,'first tap opens no word card');
 const after=await f.page.locator('.reader-area').boundingBox();
 assert.equal(before.width,after.width);assert.equal(before.x,after.x);
 const b=await bar(f).boundingBox();
 assert.ok(b.height<=60,`move bar stays small: ${b.height}`);
 assert.ok(b.x>=0&&b.x+b.width<=await f.page.evaluate(()=>innerWidth)+.5,'move bar fits the viewport');
 assert.equal(await bar(f).getByText('1 / 4',{exact:true}).count(),1);
 for(const name of ['위 문장','아래 문장','번역','문장 지정 해제']){
  const box=await bar(f).getByRole('button',{name,exact:true}).boundingBox();
  assert.ok(box.width>=44&&box.height>=44,`${name} keeps a 44px target`);
 }
 assert.equal(await bar(f).getByRole('button',{name:'위 문장',exact:true}).isDisabled(),true,'no wrap above the first sentence');
}

test('390px: first tap shows only the move bar; touch and keyboard move; second tap opens a one-row word sheet',{timeout:180000},async()=>{
 const f=await open(390);
 try{
  await firstTapIsPureMove(f);
  // 포인터(탭)로 이동 — 순수 이동이라 패널·카드가 생기지 않는다.
  await bar(f).getByRole('button',{name:'아래 문장',exact:true}).click();
  assert.deepEqual(await pickedLines(f),['1']);
  assert.equal(await bar(f).getByText('2 / 4',{exact:true}).count(),1);
  assert.deepEqual(await visibleInspectors(f),[]);
  // 키보드: 막대 버튼 Enter, 전역 Alt+↓/Alt+↑, 경계에서 포커스 유지, 막대 안 Esc = 해제.
  const up=bar(f).getByRole('button',{name:'위 문장',exact:true});
  await up.focus();await f.page.keyboard.press('Enter');
  assert.deepEqual(await pickedLines(f),['0']);
  assert.equal(await f.page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'아래 문장','focus moves off the button disabled at the boundary');
  await token(f,0,2).focus();
  await f.page.keyboard.press('Alt+ArrowDown');await f.page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual(await pickedLines(f),['2']);
  await f.page.keyboard.press('Alt+ArrowUp');
  assert.deepEqual(await pickedLines(f),['1']);
  assert.deepEqual(await visibleInspectors(f),[],'keyboard moves stay pure moves');
  // 같은 문장 안 두 번째 탭 = 단어창(규칙 유지).
  await token(f,1,1).click();
  await f.page.locator('.word-detail-card__meaning').getByText('되도록',{exact:true}).waitFor();
  assert.equal(await bar(f).count(),0,'the sheet carries ^/v while it has content');
  const header=await f.page.locator('.viewer-inspector__header').boundingBox();
  assert.ok(header.height<=56,`sheet header is one row: ${header.height}px`);
  const nav=await f.page.locator('.viewer-inspector__header').getByRole('button',{name:'아래 문장',exact:true}).boundingBox();
  const tab=await f.page.locator('#inspector-word-tab').boundingBox();
  assert.ok(Math.abs((nav.y+nav.height/2)-(tab.y+tab.height/2))<4,'^/v share the tab row');
  const geometry=await f.page.locator('.viewer-inspector').evaluate(sheet=>{
   const r=el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom};};
   const body=sheet.querySelector('.reader-card-body');
   return {sheet:r(sheet),body:r(body),scrollTop:body.scrollTop,vh:innerHeight,
    headword:r(sheet.querySelector('.reader-card-headword')),meaning:r(sheet.querySelector('.word-detail-card__meaning')),
    grades:[...sheet.querySelectorAll('.reader-card-actions .save-grade button, .reader-card-actions .review-score-btn')].filter(b=>b.getClientRects().length).map(r)};
  });
  assert.equal(geometry.scrollTop,0);
  for(const [name,box] of [['headword',geometry.headword],['meaning',geometry.meaning]])assert.ok(box.top>=geometry.body.top-.5&&box.bottom<=geometry.body.bottom+.5,`${name} visible without scrolling`);
  assert.ok(geometry.grades.length>=4,'four grade buttons rendered');
  for(const g of geometry.grades)assert.ok(g.top>=geometry.sheet.top&&g.bottom<=Math.min(geometry.sheet.bottom,geometry.vh)+.5,'grade button visible without scrolling');
  for(const grade of ['다시','어려움','알맞음','쉬움'])assert.ok(await f.page.locator('.reader-card-actions').filter({visible:true}).first().getByRole('button',{name:new RegExp(`^${grade}`)}).isVisible());
  // 단어창을 닫으면 지정은 남고 막대가 돌아온다 — 빈 패널이 남지 않는다.
  await f.page.getByRole('button',{name:'보조 패널 닫기',exact:true}).click();
  await bar(f).waitFor();
  assert.deepEqual(await visibleInspectors(f),[]);
  assert.deepEqual(await pickedLines(f),['1']);
  // 막대 안 Esc = 지정 해제(본문 빈 곳 탭과 같은 해제).
  await bar(f).getByRole('button',{name:'아래 문장',exact:true}).focus();await f.page.keyboard.press('Escape');
  await bar(f).waitFor({state:'detached'});
  assert.deepEqual(await pickedLines(f),[]);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('390px: 번역 reuses the sentence-bar analysis and opens the sentence tab; × releases the sentence',{timeout:180000},async()=>{
 const f=await open(390);
 try{
  await token(f,0,0).click();await bar(f).waitFor();
  await bar(f).getByRole('button',{name:'번역',exact:true}).click();
  await f.page.locator('#inspector-sentence').getByText('눈앞의 경기장은 사진보다 더 웅장하다.').first().waitFor();
  assert.equal(await f.page.locator('#inspector-sentence-tab').getAttribute('aria-selected'),'true');
  assert.equal(await bar(f).count(),0,'move bar yields to the open panel');
  assert.equal(await f.page.locator('.viewer-inspector__header').getByRole('button',{name:'아래 문장',exact:true}).count(),1);
  // 패널 안 이동 = 집중 모드 순수 이동: 분석이 비워지고 막대가 돌아온다.
  await f.page.locator('.viewer-inspector__header').getByRole('button',{name:'아래 문장',exact:true}).click();
  await bar(f).waitFor();
  assert.deepEqual(await pickedLines(f),['1']);
  assert.deepEqual(await visibleInspectors(f),[]);
  await bar(f).getByRole('button',{name:'문장 지정 해제',exact:true}).click();
  await bar(f).waitFor({state:'detached'});
  assert.deepEqual(await pickedLines(f),[]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('1280px: first tap keeps the column and shows the move bar; second tap opens the side panel with one header row',{timeout:180000},async()=>{
 const f=await open(1280,900);
 try{
  await firstTapIsPureMove(f);
  await token(f,0,2).click();
  await f.page.locator('.word-detail-card__meaning').getByText('경기장',{exact:true}).waitFor();
  assert.equal(await bar(f).count(),0);
  const inspectors=await visibleInspectors(f);assert.equal(inspectors.length,1,'side panel opens');
  const header=await f.page.locator('.viewer-inspector__header').boundingBox();
  // 데스크톱 옆 패널은 회귀 확인만 — 원래 한 줄(main 실측 57px)이고 그대로 한 줄이어야 한다.
  const nav=await f.page.locator('.viewer-inspector__header').getByRole('button',{name:'아래 문장',exact:true}).boundingBox();
  const tab=await f.page.locator('#inspector-word-tab').boundingBox();
  assert.ok(Math.abs((nav.y+nav.height/2)-(tab.y+tab.height/2))<4&&header.height<=60,`side panel header stays one row: ${header.height}px`);
  for(const grade of ['다시','어려움','알맞음','쉬움'])assert.ok(await f.page.locator('.reader-card-actions').filter({visible:true}).first().getByRole('button',{name:new RegExp(`^${grade}`)}).isVisible());
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// VIEWER-R0-BUGS-001 버그 9 — Y 설계 ③(#1077 5548350811): 「탭하면 발음 보기」·「암기 확인」 제거.
// 예전에 저장된 pronReveal:true는 무시되고(가려진 단어도 첫 탭에 카드), 다른 설정은 남는다.
test('saved pronReveal is ignored: a hidden-reading word opens its card on the first tap; other settings survive',{timeout:180000},async()=>{
 const f=await open(390,844,{pronDisplay:'none',pronReveal:true,showToneColors:true,focusMode:false,autoSpeakOnClick:false});
 try{
  assert.equal(await token(f,0,2).locator('.surface--furi-off').count(),1,'reading starts hidden (pronDisplay none)');
  await token(f,0,2).click();
  await f.page.locator('.word-detail-card__meaning').getByText('경기장',{exact:true}).waitFor({timeout:5000});
  assert.equal(await token(f,0,2).locator('.surface--furi-off').count(),1,'first tap opens the card instead of revealing the reading');
  await f.page.getByRole('button',{name:'보조 패널 닫기',exact:true}).click();
  await f.page.getByRole('button',{name:'읽기 설정',exact:true}).click();
  await f.page.getByRole('tab',{name:'학습 표시',exact:true}).click();
  await f.page.getByText('성조·문법·한자 표시',{exact:true}).click();
  assert.equal(await f.page.getByRole('checkbox',{name:'탭하면 발음 보기'}).count(),0,'reveal switch removed');
  const modes=await f.page.getByRole('group',{name:'읽기 모드',exact:true}).getByRole('button').evaluateAll(b=>b.map(x=>x.getAttribute('aria-label')));
  assert.deepEqual(modes,['몰입 읽기','학습 모드'],'recall preset removed');
  assert.equal(await f.page.getByRole('checkbox',{name:'성조 색상'}).isChecked(),true,'tone colours preserved');
  assert.equal(await f.page.getByRole('group',{name:'발음 표기',exact:true}).getByRole('button',{name:'숨김',exact:true}).getAttribute('aria-pressed'),'true','pronunciation display preserved');
  await f.page.getByRole('checkbox',{name:'한자 대조'}).click();
  const stored=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('viewer_preferences_v2')).languages.Chinese);
  assert.equal('pronReveal' in stored,false,'the next write drops the removed key');
  assert.equal(stored.showToneColors,true);assert.equal(stored.pronDisplay,'none');assert.equal(stored.showHanjaKo,true);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// VIEWER-R0-BUGS-001 버그 10 — 「성조·문법·한자 표시」 묶음의 변경 개수 = 그 묶음 안에 보이는 바뀐 항목 수.
// 읽기 진행 탭의 문장 집중(focusMode)과 제거된 pronReveal은 세지 않는다.
test('display detail badge counts only changed controls visible inside that group',{timeout:180000},async()=>{
 const f=await open(1280,900,{focusMode:true,pronReveal:true,showToneColors:true,autoSpeakOnClick:false});
 try{
  await f.page.getByRole('button',{name:'읽기 설정',exact:true}).click();
  await f.page.getByRole('tab',{name:'학습 표시',exact:true}).click();
  const group=f.page.locator('details.reader-settings__more').filter({hasText:'성조·문법·한자 표시'});
  const badge=async()=>{const el=group.locator('summary .reader-settings__changed');return await el.count()?Number(await el.textContent()):0;};
  const visibleChanged=()=>group.evaluate(details=>{
   details.open=true;
   const boxes=[...details.querySelectorAll('input[type=checkbox]')].filter(b=>b.getClientRects().length&&b.checked).length; // 묶음 안 스위치의 기본값은 모두 꺼짐
   const range=details.querySelector('[role=group][aria-label="문법 표시 범위"] [aria-pressed=true]');
   return boxes+(range&&range.getAttribute('aria-label')!=='전체'?1:0);
  });
  assert.equal(await badge(),1,'only 성조 색상 changed inside the group');
  assert.equal(await badge(),await visibleChanged());
  await group.getByRole('checkbox',{name:'문법 표시'}).click();
  await group.getByRole('group',{name:'문법 표시 범위',exact:true}).getByRole('button',{name:'복습할 것',exact:true}).click();
  assert.equal(await badge(),3);assert.equal(await badge(),await visibleChanged());
  await group.getByRole('checkbox',{name:'성조 색상'}).click();
  await group.getByRole('checkbox',{name:'문법 표시'}).click();
  assert.equal(await badge(),await visibleChanged(),'a filter hidden with its switch is not counted');
  assert.equal(await badge(),0);
  await f.page.getByRole('tab',{name:'읽기 진행',exact:true}).click();
  assert.equal(await f.page.getByRole('checkbox',{name:'문장 집중'}).isChecked(),true,'focus mode itself is untouched');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
