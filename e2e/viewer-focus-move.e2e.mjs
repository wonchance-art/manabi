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
// utf16Spans: 한국어 저장 분석처럼 토큰마다 원문 UTF-16 범위를 둔다(#1346 — 한국어 문장 단어 목록은 정확한 출처가 있는 저장 토큰만 쓴다).
function build(lines,{utf16Spans=false}={}) {
 const texts=lines.map(l=>l.map(w=>w[0]).join(''));
 const sequence=[],dictionary={};
 let offset=0;
 const span=text=>{const start=offset;offset+=text.length;return utf16Spans?{sourceSpan:{start,end:offset,unit:'utf16'}}:{};};
 lines.forEach((words,line)=>{
  words.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]={text,base_form:text,furigana,meaning,pos:/^[。，、.,!?！？]$/.test(text)?'기호':'명사',...span(text)};});
  if(line<lines.length-1){const id=`id_${line}_${words.length}`;sequence.push(id);dictionary[id]={text:'\n',base_form:'',furigana:'',meaning:'',pos:'개행',...span('\n')};}
 });
 return {texts,sequence,dictionary};
}
const zh=build(lines),texts=zh.texts;

async function open(width,height=844,prefs={focusMode:true,autoSpeakOnClick:false},{language='Chinese',material=zh,meta={translations:{[texts[0]]:'눈앞의 경기장은 사진보다 더 웅장하다.'}},common,visibility,guest=false,uiLocale}={}) {
 const f=await fixture({width,guest});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(({language,prefs,common,uiLocale})=>{
  // 새 컨텍스트에 한 번만 심는다 — 이후에는 UI가 실제로 저장한 값을 읽는다.
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,...(common?{common}:{}),languages:{[language]:prefs}}));
  if(uiLocale&&!localStorage.getItem('viewer_language:v1'))localStorage.setItem('viewer_language:v1',JSON.stringify({version:1,uiLocale,explanationLocale:'ko'}));
 },{language,prefs,common,uiLocale:uiLocale||null});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 f.requests=[];
 await f.context.route('**/api/gemini',r=>{f.requests.push({url:'/api/gemini',body:r.request().postData()||''});return r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용 맥락'})});});
 await f.context.route(/\/api\/analyze(\/korean)?$/,r=>{f.requests.push({url:new URL(r.request().url()).pathname,body:r.request().postData()||''});return r.fulfill({contentType:'application/json',body:JSON.stringify({results:[]})});});
 f.rows.push({id:94131,user_id:owner,...(visibility?{visibility,owner_id:owner}:{}),title:'문장 집중 이동 검수',raw_text:material.texts.join('\n'),source_type:'text',created_at:new Date().toISOString(),
  processed_json:{status:'completed',metadata:{language,...meta},sequence:material.sequence,dictionary:material.dictionary}});
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
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  await f.page.getByRole('tab',{name:'학습 표시',exact:true}).click();
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

// AD-R2 Aa(정본 §5 Aa · 설계 §6.1 viewerSettingsMinimal ③ · §6.2 「Aa 창 높이 고정」「표시 탭 평평 · 범례」 · Q6~Q8 제안값).
// R0 버그 10의 「성조·문법·한자 표시」 묶음 개수 뱃지는 묶음과 함께 사라진다 — 숨기는 곳이 없어 셀 것도 없다.
// 설정 저장 경로·키는 그대로다: 쓰기 뒤에도 언어별 키 집합이 같고, 쓸 수 없는 옵션 뒤의 저장값(범위 「복습할 것」)이 남는다.
const STORED_KEYS=['autoPace','autoSpeakOnClick','charGap','focusMode','fontFamily','fontSize','lineGap','paceCpm','paceStep','patternFilter','pinyinSize','pronDisplay','showHanjaKo','showPatterns','showToneColors','wordStateHl'];
for(const [width,height] of [[390,844],[1280,900],[320,640]])test(`${width}px: Aa — tabs on top, one window height for every tab, a flat display tab with legends and reasons`,{timeout:180000},async()=>{
 const f=await open(width,height,{focusMode:true,showToneColors:true,showPatterns:false,patternFilter:'due',autoSpeakOnClick:false});
 try{
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  const dialog=f.page.getByRole('dialog',{name:'읽기 설정',exact:true});await dialog.waitFor();
  await f.page.evaluate(()=>document.fonts.ready);
  assert.equal(await dialog.locator('.reader-modal__body').evaluate(b=>b.firstElementChild?.getAttribute('role')),'tablist','the tabs are the first thing in the window');
  const geometry=()=>dialog.evaluate(d=>{const r=d.getBoundingClientRect();return {h:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right,sw:d.scrollWidth,cw:d.clientWidth,vw:innerWidth,vh:innerHeight};});
  const heights=[];
  for(const tab of ['글자·배경','학습 표시','읽기 진행','학습 표시']){
   await dialog.getByRole('tab',{name:tab,exact:true}).click();await f.page.waitForTimeout(120);
   const g=await geometry();heights.push(g.h);
   assert.ok(g.left>=-.5&&g.right<=g.vw+.5&&g.top>=-.5&&g.bottom<=g.vh+.5,`${tab}: the window stays inside the viewport ${JSON.stringify(g)}`);
   assert.ok(g.sw<=g.cw+1,`${tab}: no horizontal overflow`);
  }
  assert.equal(Math.max(...heights)-Math.min(...heights),0,`one window height for every tab: ${heights}`);
  assert.ok(heights[0]<=720.5,`window height is capped at 720px: ${heights[0]}`);
  // 「표시」 탭: 접힌 묶음 없이 모든 옵션이 바로 보인다 — 맨 아래는 언어 선택 상자 둘.
  const pane=dialog.getByRole('tabpanel');
  assert.equal(await dialog.locator('details.reader-settings__more').count(),0,'the display tab has no collapsed group');
  for(const [role,name] of [['group','읽기 모드'],['group','발음 표기'],['checkbox','단어 상태'],['checkbox','성조 색상'],['checkbox','한자 대조'],['checkbox','문법 표시'],['group','문법 표시 범위'],['combobox','화면 언어'],['combobox','설명 언어']]){
   const el=pane.getByRole(role,{name,exact:true});await el.scrollIntoViewIfNeeded();
   assert.ok(await el.isVisible(),`${name} is visible without opening anything`);
  }
  // 창 높이가 고정이므로 넘치는 내용은 탭 본문만 스크롤한다 — 탭·미리보기·하단은 제자리.
  const fixedParts=()=>dialog.evaluate(d=>({tabs:d.querySelector('[role=tablist]').getBoundingClientRect().top,footer:d.querySelector('.reader-modal__footer').getBoundingClientRect().bottom,dialog:d.getBoundingClientRect().bottom,
   bodyOverflow:(b=>b.scrollHeight-b.clientHeight)(d.querySelector('.reader-modal__body')),pane:getComputedStyle(d.querySelector('[role=tabpanel]')).overflowY}));
  await pane.evaluate(p=>p.scrollTo({top:0,behavior:'instant'}));const top=await fixedParts();
  await pane.evaluate(p=>p.scrollTo({top:p.scrollHeight,behavior:'instant'}));const bottom=await fixedParts();
  assert.equal(top.pane,'auto');assert.ok(top.bodyOverflow<=1&&bottom.bodyOverflow<=1,'only the tab panel scrolls');
  assert.equal(bottom.tabs,top.tabs,'tabs stay at the top while the panel scrolls');
  assert.ok(bottom.footer<=bottom.dialog+.5,'footer stays inside the window');
  // 범례: 본문과 같은 클래스로 그린 상태 견본 셋 + 성조 견본 넷. 옵션이 꺼져 있어도 보인다.
  // 모양 = 띠 색 | 밑줄(두께·선·색 — 두께 0이거나 투명이면 none). 글자색(currentColor)은 모양에 넣지 않는다.
  const legend=await pane.locator('.reader-settings__legend .word-token').evaluateAll(ts=>ts.map(t=>{const s=getComputedStyle(t.querySelector('.surface'),'::before'),line=s.borderBottomWidth==='0px'||s.borderBottomColor==='rgba(0, 0, 0, 0)'?'none':`${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`;return {text:t.textContent,look:`${s.backgroundColor}|${line}`};}));
  assert.deepEqual(legend.map(l=>l.text),['새 단어','학습 중','복습']);
  assert.equal(new Set(legend.map(l=>l.look)).size,3,`three distinct state marks: ${JSON.stringify(legend)}`);
  for(const l of legend)assert.notEqual(l.look,'rgba(0, 0, 0, 0)|none',`${l.text} is visibly marked`);
  const tones=await pane.locator('.reader-settings__tones .rt-an').evaluateAll(es=>es.map(e=>getComputedStyle(e).color));
  assert.equal(tones.length,4);assert.equal(new Set(tones).size,4,`four tone colours: ${tones}`);
  // 같은 CSS — 「단어 상태」를 켜면 본문 새 단어가 범례의 「새 단어」와 같은 모양이다.
  await pane.getByRole('checkbox',{name:'단어 상태',exact:true}).check();
  const bodyNew=await f.page.locator('.reader-area .word-token--new:not(.word-token--picked) .surface').first().evaluate(e=>{const s=getComputedStyle(e,'::before'),line=s.borderBottomWidth==='0px'||s.borderBottomColor==='rgba(0, 0, 0, 0)'?'none':`${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`;return `${s.backgroundColor}|${line}`;});
  assert.equal(bodyNew,legend[0].look,'the legend new-word mark is the body new-word mark');
  await pane.getByRole('checkbox',{name:'단어 상태',exact:true}).uncheck();
  // 쓸 수 없는 옵션: 문법 표시가 꺼져 있으면 범위는 흐린 채 남고 이유를 적는다. 저장된 범위는 그대로 보인다.
  const range=pane.getByRole('group',{name:'문법 표시 범위',exact:true}),reason=pane.getByText('문법 표시를 켜면 고를 수 있어요',{exact:true});
  for(const b of await range.getByRole('button').all())assert.equal(await b.isDisabled(),true,'range is unavailable while grammar marks are off');
  assert.equal(await range.getByRole('button',{name:'복습할 것',exact:true}).getAttribute('aria-pressed'),'true','the stored range stays visible');
  assert.ok(await reason.isVisible());
  await pane.getByRole('checkbox',{name:'문법 표시',exact:true}).check();
  assert.equal(await range.getByRole('button',{name:'전체',exact:true}).isDisabled(),false);assert.equal(await reason.count(),0);
  await pane.getByRole('checkbox',{name:'문법 표시',exact:true}).uncheck();
  // 중국어 자료는 설명 언어가 한국어 하나 — 설명 상자는 꺼진 채 이유를 적고, 화면 언어는 고를 수 있다.
  const explanation=pane.getByRole('combobox',{name:'설명 언어',exact:true});
  assert.equal(await explanation.isDisabled(),true);assert.equal(await explanation.inputValue(),'ko');
  assert.ok(await pane.getByText('이 자료의 설명 언어는 한국어로 제공돼요.',{exact:true}).isVisible());
  assert.equal(await pane.getByRole('combobox',{name:'화면 언어',exact:true}).isDisabled(),false);
  // 하단은 보이는 글자, 잘림 0. 창 안 글자 덩어리는 창 밖으로 나가지 않는다.
  const footer=await dialog.locator('.reader-modal__footer button').evaluateAll(bs=>bs.map(b=>({text:b.innerText.trim(),clip:b.scrollWidth>b.clientWidth+1,h:b.getBoundingClientRect().height})));
  assert.deepEqual(footer.map(b=>b.text),['이 탭 기본값','이번 변경 되돌리기']);
  for(const b of footer)assert.ok(!b.clip&&b.h>=44,`${b.text}: ${JSON.stringify(b)}`);
  for(const tab of ['글자·배경','학습 표시','읽기 진행']){
   await dialog.getByRole('tab',{name:tab,exact:true}).click();
   const clipped=await dialog.evaluate(d=>{const box=d.getBoundingClientRect();return [...d.querySelectorAll('b,button,select,small,label,.reader-settings__legend,.reader-settings__tones,.reader-setting-note')].filter(e=>e.getClientRects().length&&e.textContent.trim())
    .filter(e=>{const r=e.getBoundingClientRect(),block=getComputedStyle(e).display!=='inline';return r.left<box.left-.5||r.right>box.right+.5||(block&&e.scrollWidth>e.clientWidth+1);}).map(e=>e.textContent.trim().slice(0,24));});
   assert.deepEqual(clipped,[],`${tab}: no clipped label`);
  }
  await f.page.keyboard.press('Escape');
  const stored=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('viewer_preferences_v2')).languages.Chinese);
  assert.deepEqual(Object.keys(stored).sort(),STORED_KEYS,'no preference key added or removed');
  assert.equal(stored.patternFilter,'due');assert.equal(stored.showPatterns,false);assert.equal(stored.showToneColors,true);assert.equal(stored.focusMode,true);assert.equal(stored.wordStateHl,false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 메인 검수 보완 ① — 막대가 떠 있는 동안 본문 끝(마지막 문장·「다 읽었다면」 줄)이 막대 위로 드러나고,
// ^/v로 화면 아래쪽 문장까지 내려가도 지정 문장이 막대에 가리지 않는다. 비공개 자료(댓글 없음)라
// 「다 읽었다면」이 본문 맨 끝이다 — 가장 빠듯한 경우.
const longZh=build(Array.from({length:24},(_,i)=>lines[i%lines.length]));
for(const [width,height] of [[390,844],[1280,900]])test(`${width}px: the move bar never covers the end of the text or the designated sentence`,{timeout:240000},async()=>{
 const f=await open(width,height,undefined,{material:longZh,meta:{},visibility:'private'});
 try{
  await token(f,0,0).click();await bar(f).waitFor();
  const barTop=async()=>(await bar(f).boundingBox()).y;
  const sentenceBottom=()=>f.page.locator('.word-token--picked').evaluateAll(els=>Math.max(...els.map(el=>el.getBoundingClientRect().bottom)));
  await f.page.evaluate(()=>scrollTo({top:document.scrollingElement.scrollHeight,behavior:'instant'}));await f.page.waitForTimeout(200);
  const end=await f.page.evaluate(()=>{
   const actions=document.querySelector('.post-reading-actions')?.getBoundingClientRect();
   const tokens=[...document.querySelectorAll('[data-source-token^="id_23_"]')].map(el=>el.getBoundingClientRect().bottom);
   const center=document.querySelector('.viewer-center'),last=[...center.children].filter(el=>el.getClientRects().length).at(-1).getBoundingClientRect();
   return {actions:actions?.bottom,lastLine:Math.max(...tokens),last:last.bottom};
  });
  const top=await barTop();
  assert.ok(end.actions!=null,'「다 읽었다면」 row is rendered');
  assert.ok(end.actions<=top,`「다 읽었다면」 row bottom ${end.actions} <= bar top ${top}`);
  assert.ok(end.lastLine<=top,`last sentence bottom ${end.lastLine} <= bar top ${top}`);
  assert.ok(end.last<=top,`last reader block bottom ${end.last} <= bar top ${top}`);
  await f.page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await f.page.waitForTimeout(100);
  const down=bar(f).getByRole('button',{name:'아래 문장',exact:true}),up=bar(f).getByRole('button',{name:'위 문장',exact:true});
  for(let line=1;line<24;line++){
   await down.click();await f.page.waitForTimeout(80);
   assert.deepEqual(await pickedLines(f),[String(line)]);
   const b=await sentenceBottom(),t=await barTop();
   assert.ok(b<=t,`line ${line}: designated sentence bottom ${b} <= bar top ${t}`);
  }
  for(let line=22;line>=19;line--){
   await up.click();await f.page.waitForTimeout(80);
   const b=await sentenceBottom(),t=await barTop();
   assert.ok(b<=t,`back to line ${line}: ${b} <= ${t}`);
  }
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 메인 검수 보완 ②(a) — 막대의 계산색 대비: 글자 ≥4.5:1, 아이콘·테두리 ≥3:1(종이·어둡게).
// 비활성 버튼은 WCAG 예외라 하한 대신 「활성보다 흐리다」만 고정하고 값을 남긴다.
for(const theme of ['sepia','dark'])test(`${theme}: move bar text, icon and edge contrast`,{timeout:180000},async()=>{
 const f=await open(390,844,undefined,{common:{theme,ttsRate:'normal'}});
 try{
  assert.equal(await f.page.locator('.viewer-layout').getAttribute('data-reader-theme'),theme);
  await token(f,0,0).click();await bar(f).waitFor();
  const c=await bar(f).evaluate(barEl=>{
   const parse=s=>{let m=s.match(/rgba?\(([^)]+)\)/);if(m){const p=m[1].split(/[\s,/]+/).filter(Boolean).map(Number);return [p[0],p[1],p[2],p[3]??1];}
    m=s.match(/color\(srgb ([^)]+)\)/);if(m){const p=m[1].split(/[\s/]+/).filter(Boolean).map(Number);return [p[0]*255,p[1]*255,p[2]*255,p[3]??1];}
    throw new Error('unparsed colour '+s);};
   const lum=([r,g,b])=>[r,g,b].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   const over=(fg,bg,alpha=1)=>{const a=fg[3]*alpha;return [0,1,2].map(i=>fg[i]*a+bg[i]*(1-a));};
   const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   const cs=el=>getComputedStyle(el);
   const bg=parse(cs(barEl).backgroundColor),page=parse(cs(barEl.closest('.viewer-layout')).backgroundColor);
   const btn=name=>barEl.querySelector(`button[aria-label="${name}"]`)||[...barEl.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
   const fgOf=el=>over(parse(cs(el).color),bg,Number(cs(el).opacity));
   const translate=btn('번역');
   return {
    pos:ratio(fgOf(barEl.querySelector('.sentence-move-bar__pos')),bg),
    translateText:ratio(fgOf(translate),bg),
    translateEdge:ratio(over(parse(cs(translate).borderTopColor),bg),bg),
    barEdgeOnBar:ratio(over(parse(cs(barEl).borderTopColor),bg),bg),
    barEdgeOnPage:ratio(over(parse(cs(barEl).borderTopColor),page),page),
    down:ratio(fgOf(btn('아래 문장')),bg),close:ratio(fgOf(btn('문장 지정 해제')),bg),
    upDisabled:btn('위 문장').disabled?ratio(fgOf(btn('위 문장')),bg):null,
   };
  });
  console.log(`[move-bar-contrast] ${theme} ${JSON.stringify(Object.fromEntries(Object.entries(c).map(([k,v])=>[k,v&&Math.round(v*100)/100])))}`);
  for(const k of ['pos','translateText'])assert.ok(c[k]>=4.5,`${theme} ${k} text ${c[k]} >= 4.5`);
  for(const k of ['translateEdge','barEdgeOnBar','barEdgeOnPage','down','close'])assert.ok(c[k]>=3,`${theme} ${k} ${c[k]} >= 3`);
  assert.ok(c.upDisabled!=null&&c.upDisabled<c.down,'disabled ^ is visibly dimmer than enabled v');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 메인 검수 보완 ③ — 일본어·한국어 자료에서도 막대가 렌더되고 ^/v·번역이 동작한다.
// 번역은 기존 경로(문장 맥락 요청 1회 + 단어 분석 1회)로만 나간다.
const ja=build([
 [['今日','きょう','오늘'],['は','','은'],['友達','ともだち','친구'],['と','','와'],['駅前','えきまえ','역 앞'],['の','','의'],['喫茶店','きっさてん','찻집'],['で','','에서'],['会いました','あいました','만났습니다'],['。','','마침표']],
 [['紅茶','こうちゃ','홍차'],['を','','을'],['飲みました','のみました','마셨습니다'],['。','','마침표']],
 [['店','みせ','가게'],['は','','은'],['静か','しずか','조용함'],['でした','','이었습니다'],['。','','마침표']],
]);
const ko=build([
 [['오늘은','','오늘'],['친구와','','친구'],['공원에','','공원'],['갔어요','','가다'],['.','','마침표']],
 [['날씨가','','날씨'],['아주','','매우'],['좋았어요','','좋다'],['.','','마침표']],
 [['내일도','','내일'],['또','','다시'],['만나요','','만나다'],['.','','마침표']],
],{utf16Spans:true});
for(const [language,material,analyzePath] of [['Japanese',ja,'/api/analyze'],['Korean',ko,'/api/analyze/korean']])test(`${language}: move bar renders, ^/v move and 번역 uses the existing sentence path once`,{timeout:180000},async()=>{
 const f=await open(390,844,{focusMode:true,autoSpeakOnClick:false},{language,material,meta:{}});
 try{
  await token(f,0,2).click();await bar(f).waitFor();
  assert.deepEqual(await pickedLines(f),['0']);assert.deepEqual(await visibleInspectors(f),[]);
  assert.equal(await bar(f).getByText('1 / 3',{exact:true}).count(),1);
  await bar(f).getByRole('button',{name:'아래 문장',exact:true}).click();
  assert.deepEqual(await pickedLines(f),['1']);
  await bar(f).getByRole('button',{name:'아래 문장',exact:true}).click();
  await bar(f).getByRole('button',{name:'위 문장',exact:true}).click();
  assert.deepEqual(await pickedLines(f),['1']);
  assert.equal(f.requests.length,0,'pure moves send no request');
  await bar(f).getByRole('button',{name:'번역',exact:true}).click();
  await f.page.locator('#inspector-sentence-tab[aria-selected="true"]').waitFor();
  await f.page.waitForTimeout(1000);
  const sentence=material.texts[1];
  const gemini=f.requests.filter(r=>r.url==='/api/gemini'),analysis=f.requests.filter(r=>r.url===analyzePath);
  assert.equal(gemini.length,1,'one sentence-context request');
  assert.ok(gemini[0].body.includes(sentence),'context request carries the designated sentence');
  if(language==='Korean'){
   // #1346(한국어 기본형 뜻): 한국어 문장 단어 목록은 그 줄의 저장 토큰(정확한 출처)으로 만들고, 저장 분석과 설명 언어가
   // 같으면 /api/analyze/korean을 다시 부르지 않는다(설명 언어가 다를 때만 그 줄을 재분석 — korean-word-meaning e2e).
   assert.equal(analysis.length,0,`same explanation locale: no word-analysis request on ${analyzePath}`);
   assert.deepEqual(await f.page.locator('.pdf-word-item__text').allTextContents(),['날씨가','아주','좋았어요'],'the list is the designated sentence\'s own tokens');
   assert.equal(f.requests.length,1,'no other AI/analysis request');
  }else{
   assert.equal(analysis.length,1,`one word-analysis request on ${analyzePath}`);
   assert.deepEqual(JSON.parse(analysis[0].body).lines,[sentence]);
   assert.equal(f.requests.length,2,'no other AI/analysis request');
  }
  assert.equal(await bar(f).count(),0);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 뷰어 v2 AE-R2 PR ② — 문장 번역 단일 키 + 선처리(설계서 docs/manabi-viewer-v2-ae-r2.md §2·§4·§6.2, 정본 §4).
// 같은 문장·같은 설정 = 같은 키 = 요청 1회. 카드가 열린 채 같은 줄에 0.3초 머물면 선처리 1회(light·재시도 0),
// [문장] 탭은 선처리 전이라도 누르는 즉시 같은 키로 시작한다. 교재 맵·0.3초 안 닫기·게스트는 요청 0.
// 학습 이벤트 0: review_events 쓰기·/api/analyze 0. 1280px 옆 패널(390px 시트는 아래 줄을 덮는다 — #1362 선례).
async function sentenceAi(f,{delay=0,material=zh}={}){
 f.ai=[];f.learning=[];
 f.page.on('request',req=>{
  const url=req.url();
  if(/\/api\/analyze/.test(url)||(/review_events/.test(url)&&req.method()!=='GET'))f.learning.push(`${req.method()} ${new URL(url).pathname}`);
 });
 await f.page.route('**/api/gemini',async r=>{
  const body=r.request().postDataJSON()||{},prompt=body.contents?.[0]?.parts?.[0]?.text||'';
  const line=material.texts.findIndex(t=>prompt.includes(t));
  f.ai.push({line,purpose:body.purpose??null,tier:body.tier??null,at:Date.now()});
  if(delay)await new Promise(res=>setTimeout(res,delay));
  return r.fulfill({contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text:`**번역**\n문장 번역 표지 ${line}`}]}}]})}).catch(()=>{});
 });
}
const aiFor=(f,line)=>f.ai.filter(r=>r.line===line);
const leftPanel=f=>f.page.locator('[data-panel="left"]').filter({visible:true});
const sentenceTab=f=>f.page.locator('#inspector-sentence-tab').filter({visible:true});
const closePanel=f=>f.page.getByRole('button',{name:'보조 패널 닫기',exact:true}).filter({visible:true}).click();
const cardOpen=(f,line,i)=>f.page.locator('.word-detail-card__meaning').filter({visible:true}).getByText(zh.dictionary[`id_${line}_${i}`].meaning,{exact:true}).waitFor();
const noFocus={focusMode:false,autoSpeakOnClick:false};

test('AE-R2 ②: dwelling 0.3s on a card prefetches its sentence once; the [문장] tab then sends nothing new',{timeout:180000},async()=>{
 const f=await open(1280,900,noFocus);
 try{
  await sentenceAi(f);
  // 같은 줄 단어 세 개를 차례로 — 줄이 같으면 타이머를 다시 세지 않고 1회만.
  await token(f,1,1).click();await cardOpen(f,1,1);
  await token(f,1,3).click();await cardOpen(f,1,3);
  await token(f,1,6).click();await cardOpen(f,1,6);
  await f.page.waitForTimeout(1200);
  assert.equal(f.ai.length,1,`one AI request after dwelling on line 1: ${JSON.stringify(f.ai)}`);
  assert.deepEqual([f.ai[0].line,f.ai[0].purpose,f.ai[0].tier],[1,'viewer-sentence-prefetch','light'],'prefetch carries its purpose and the light tier');
  // [문장] 탭 = 이미 준비된 같은 키 — 새 요청 0, 번역이 바로 보인다.
  await sentenceTab(f).click();
  await leftPanel(f).getByText('문장 번역 표지 1').first().waitFor({timeout:1000});
  await f.page.waitForTimeout(500);
  assert.equal(f.ai.length,1,'the sentence tab reuses the prefetched translation');
  // 같은 문장 반복 열람(닫고 다른 단어로 다시) = 여전히 1회.
  await closePanel(f);
  await token(f,1,0).click();await cardOpen(f,1,0);
  await f.page.waitForTimeout(600);
  await sentenceTab(f).click();
  await leftPanel(f).getByText('문장 번역 표지 1').first().waitFor({timeout:1000});
  assert.equal(aiFor(f,1).length,1,'reopening the same sentence sends no request');
  // 교재 맵이 있는 줄(0)은 머물러도 요청 0.
  await token(f,0,2).click();await cardOpen(f,0,2);
  await f.page.waitForTimeout(1000);
  assert.equal(aiFor(f,0).length,0,'a textbook translation needs no request');
  // 0.3초 안에 닫으면 0.
  await token(f,2,1).click();await cardOpen(f,2,1);
  await closePanel(f);
  await f.page.waitForTimeout(1000);
  assert.equal(aiFor(f,2).length,0,'closing within 0.3s sends nothing');
  assert.equal(f.ai.length,1,'no other AI request');
  assert.deepEqual(f.learning,[],'no learning events or reanalysis');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R2 ②: the [문장] tab starts at once under the same key, and a started translation survives tapping away',{timeout:180000},async()=>{
 const f=await open(1280,900,noFocus);
 try{
  await sentenceAi(f,{delay:800});
  // 시작한 번역은 다른 줄 단어를 눌러도 끝까지 받아 저장 — 다시 열면 요청 0.
  await token(f,2,0).click();await cardOpen(f,2,0);
  await sentenceTab(f).click();
  await token(f,0,0).click();await cardOpen(f,0,0);
  await f.page.waitForTimeout(1500);
  await token(f,2,3).click();await cardOpen(f,2,3);
  await sentenceTab(f).click();
  await f.page.waitForTimeout(1200);
  await leftPanel(f).getByText('문장 번역 표지 2').first().waitFor();
  assert.equal(aiFor(f,2).length,1,`same sentence = one request even after tapping away: ${JSON.stringify(aiFor(f,2))}`);
  // 0.3초 전에 [문장] 탭 — 선처리를 기다리지 않고 사용자 요청으로 바로 시작, 이어지는 선처리는 그 요청에 합류.
  await token(f,3,0).click();await cardOpen(f,3,0);
  const tapped=Date.now();
  await sentenceTab(f).click();
  await f.page.waitForTimeout(1500);
  assert.equal(aiFor(f,3).length,1,`one request for line 3: ${JSON.stringify(f.ai)}`);
  assert.equal(aiFor(f,3)[0].purpose,'viewer-sentence','the tab itself started the request (no 0.3s wait)');
  assert.ok(aiFor(f,3)[0].at-tapped<300,`started immediately: ${aiFor(f,3)[0].at-tapped}ms`);
  await leftPanel(f).getByText('문장 번역 표지 3').first().waitFor();
  assert.deepEqual(f.learning,[],'no learning events or reanalysis');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R2 ②: guests get no prefetch request',{timeout:180000},async()=>{
 const f=await open(1280,900,noFocus,{guest:true,visibility:'public'});
 try{
  await sentenceAi(f);
  await token(f,1,1).click();await cardOpen(f,1,1);
  await f.page.waitForTimeout(1200);
  assert.equal(f.ai.length,0,'guests send no prefetch request');
  assert.deepEqual(f.learning,[]);
 }finally{await f.context.close();}
});

// 뷰어 v2 AE-R2 PR ③ — [문장] 탭 재배치(설계서 docs/manabi-viewer-v2-ae-r2.md §3·§11 목업, 정본 §4 「[문장] 탭」).
// 순서: 원문 줄(누른 단어만 칠, 120자 자르기 없음) → 번역(진행 표시는 이 칸에만) → [더 쉽게][자세히] → 문형 → 단어별 뜻.
// 단어별 뜻은 자료 토큰에서(요청 0·만남 0). 게스트는 캐시·교재 맵이 없으면 AI 대신 로그인 안내. 「AI」 표시 0.
const sentenceBox=(f,sel)=>leftPanel(f).locator(sel).first().evaluate(el=>{const b=el.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};});
const glossTexts=f=>leftPanel(f).locator('.reader-sentence__glosses li').allInnerTexts();

test('AE-R2 ③: [문장] tab reads original (tapped word marked) → translation → [더 쉽게][자세히] → 문형 → 단어별 뜻, no AI label',{timeout:240000},async()=>{
 const f=await open(1280,900,{...noFocus,showPatterns:true,patternFilter:'all'});
 try{
  await sentenceAi(f);
  await token(f,0,3).click();await cardOpen(f,0,3);
  await sentenceTab(f).click();
  await leftPanel(f).getByText('눈앞의 경기장은 사진보다 더 웅장하다.').first().waitFor();
  const original=leftPanel(f).locator('.pdf-context__original');
  assert.equal((await original.innerText()).trim(),texts[0],'the whole line, no quotes, no 120-char cut');
  assert.deepEqual(await original.locator('mark').allInnerTexts(),['比'],'only the tapped word is marked');
  await leftPanel(f).getByText('📘 교재에 실린 뜻이에요.').first().waitFor();
  await leftPanel(f).locator('.reader-sentence__patterns').getByText(/比/).first().waitFor({timeout:30000});
  assert.deepEqual(await glossTexts(f),['眼前 yǎnqián 눈앞','的 de ~의','体育场 tǐyùchǎng 경기장','比 bǐ ~보다','照片 zhàopiàn 사진','上 shàng 위','更 gèng 더','壮观 zhuàngguān 웅장하다'],'word glosses from the material tokens, punctuation excluded');
  const y={original:await sentenceBox(f,'.pdf-context__original'),translation:await sentenceBox(f,'.reader-sentence__translation'),
   actions:await sentenceBox(f,'.reader-sentence__actions'),patterns:await sentenceBox(f,'.reader-sentence__patterns'),glosses:await sentenceBox(f,'.reader-sentence__glosses')};
  assert.ok(y.original.bottom<=y.translation.top+.5&&y.translation.bottom<=y.actions.top+.5&&y.actions.bottom<=y.patterns.top+.5&&y.patterns.bottom<=y.glosses.top+.5,`section order ${JSON.stringify(y)}`);
  const toggles=leftPanel(f).locator('.reader-sentence__actions .grammar-detail__toggle');
  assert.equal(await toggles.count(),2,'[더 쉽게][자세히] side by side');
  const [easy,detail]=[await toggles.nth(0).boundingBox(),await toggles.nth(1).boundingBox()];
  assert.ok(Math.abs(easy.y-detail.y)<1&&easy.x<detail.x,'the two buttons share one row');
  for(const b of [easy,detail])assert.ok(b.height>=44,'44px targets');
  // 문형 줄을 누르면 그 자리에 문형 카드(카드의 「문형 한 줄」과 같은 PatternCard).
  await leftPanel(f).locator('.reader-sentence__patterns button').first().click();
  await leftPanel(f).locator('.pattern-card').first().waitFor({timeout:30000});
  assert.doesNotMatch(await leftPanel(f).innerText(),/\bAI\b/,'no AI label in the sentence tab');
  assert.equal(f.ai.length,0,'a textbook line needs no request');
  assert.deepEqual(f.learning,[],'glosses and patterns send no reanalysis or learning event');
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R2 ③: before the translation arrives only its slot shows 「번역 중…」; nothing above moves; another line never shows the old translation',{timeout:240000},async()=>{
 const f=await open(1280,900,noFocus);
 try{
  await sentenceAi(f,{delay:1500});
  await token(f,1,6).click();await cardOpen(f,1,6);
  await sentenceTab(f).click();
  await leftPanel(f).getByText('번역 중…',{exact:true}).waitFor({timeout:1000});
  assert.deepEqual(await leftPanel(f).locator('.pdf-context__original mark').allInnerTexts(),['爱惜'],'original line is drawn at T0');
  assert.equal((await glossTexts(f)).length,7,'word glosses are drawn before the translation');
  assert.equal(await leftPanel(f).locator('.reader-sentence__actions .grammar-detail__toggle').first().isEnabled(),true,'[더 쉽게] is ready at T0');
  const before={original:await sentenceBox(f,'.pdf-context__original'),head:await sentenceBox(f,'.reader-sentence__translation .pdf-detail-heading')};
  await leftPanel(f).getByText('문장 번역 표지 1').first().waitFor();
  assert.equal(await leftPanel(f).getByText('번역 중…',{exact:true}).count(),0);
  const after={original:await sentenceBox(f,'.pdf-context__original'),head:await sentenceBox(f,'.reader-sentence__translation .pdf-detail-heading')};
  assert.ok(Math.abs(before.original.top-after.original.top)<.5&&Math.abs(before.head.top-after.head.top)<.5,`original and translation head stay put: ${JSON.stringify({before,after})}`);
  // 다른 줄 단어의 [문장] 탭 = 그 줄. 앞 문장 번역이 남지 않는다(설계서 §1.2·§6.2).
  await token(f,2,3).click();await cardOpen(f,2,3);
  await sentenceTab(f).click();
  assert.equal((await leftPanel(f).locator('.pdf-context__original').innerText()).trim(),texts[2]);
  assert.deepEqual(await leftPanel(f).locator('.pdf-context__original mark').allInnerTexts(),['公园']);
  assert.equal(await leftPanel(f).getByText('문장 번역 표지 1').count(),0,'the previous sentence translation is gone');
  await leftPanel(f).getByText('문장 번역 표지 2').first().waitFor();
  assert.deepEqual(f.learning,[]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R2 ③: guests see a login prompt instead of an AI request; textbook lines still show',{timeout:240000},async()=>{
 const f=await open(1280,900,noFocus,{guest:true,visibility:'public'});
 try{
  await sentenceAi(f);
  await token(f,1,1).click();await cardOpen(f,1,1);
  await sentenceTab(f).click();
  const login=leftPanel(f).getByRole('link',{name:'로그인하면 이 문장의 번역을 볼 수 있어요 →',exact:true});
  await login.waitFor({timeout:5000});
  assert.equal(new URL(await login.evaluate(a=>a.href)).pathname,'/auth');
  assert.ok((await login.boundingBox()).height>=44,'login prompt keeps a 44px target');
  assert.equal((await glossTexts(f)).length,7,'word glosses still show for guests');
  await f.page.waitForTimeout(800);
  assert.equal(f.ai.length,0,'guests send no AI request');
  assert.equal(await leftPanel(f).getByText('설명을 가져오지 못했어요',{exact:false}).count(),0);
  await token(f,0,2).click();await cardOpen(f,0,2);
  await sentenceTab(f).click();
  await leftPanel(f).getByText('눈앞의 경기장은 사진보다 더 웅장하다.').first().waitFor();
  assert.equal(await login.count(),0,'a textbook translation needs no login');
  assert.equal(f.ai.length,0);
  assert.deepEqual(f.learning,[]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 한국어·일본어·영어 자료 각 1건 — 같은 배치(원문 칠·번역·단어별 뜻), 학습 이벤트 0.
const spaced=lines=>{const m=build(lines);m.texts=lines.map(l=>l.map(w=>w[0]).join(' ').replace(/ ([.,!?])/g,'$1'));return m;};
for(const [language,material,line,i,mark,glosses] of [
 ['Japanese',build([[['今日','きょう','오늘'],['は','','은'],['天気','てんき','날씨'],['が','','이'],['いい','','좋다'],['。','','마침표']],[['紅茶','こうちゃ','홍차'],['を','','을'],['飲みました','のみました','마셨습니다'],['。','','마침표']]]),1,2,'飲みました',['紅茶 こうちゃ 홍차','を 을','飲みました のみました 마셨습니다']],
 ['Korean',spaced([[['오늘은','','오늘'],['날씨가','','날씨'],['좋아요','','좋다'],['.','','마침표']],[['친구와','','친구'],['공원에','','공원'],['갔어요','','가다'],['.','','마침표']]]),1,1,'공원에',['친구와 친구','공원에 공원','갔어요 가다']],
 ['English',spaced([[['It','','그것'],['is','','이다'],['sunny','','화창한'],['.','','마침표']],[['We','','우리'],['walked','','걸었다'],['home','','집으로'],['.','','마침표']]]),1,1,'walked',['We 우리','walked 걸었다','home 집으로']],
])test(`AE-R2 ③: ${language} [문장] tab keeps the same layout`,{timeout:240000},async()=>{
 const f=await open(1280,900,noFocus,{language,material,meta:{}});
 try{
  await sentenceAi(f,{material});
  await token(f,line,i).click();
  await f.page.locator('#inspector-word .reader-card-sentence').filter({visible:true}).waitFor();
  await sentenceTab(f).click();
  await leftPanel(f).getByText(`문장 번역 표지 ${line}`).first().waitFor();
  assert.equal((await leftPanel(f).locator('.pdf-context__original').innerText()).trim(),material.texts[line]);
  assert.deepEqual(await leftPanel(f).locator('.pdf-context__original mark').allInnerTexts(),[mark]);
  assert.deepEqual(await glossTexts(f),glosses);
  assert.doesNotMatch(await leftPanel(f).innerText(),/\bAI\b/);
  assert.deepEqual(f.learning,[],'no reanalysis or learning event');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 뷰어 v2 AE-R2 PR ① — [문장] 탭의 문장 키 결과는 그 결과를 만든 문장에만 붙는다(설계서 §5·§1.2).
// AI 응답은 「종류 표지 줄번호」로 돌려 어느 문장의 결과가 화면에 남았는지 가린다(합성 자료·계정 쓰기 없음).
const aiKind=body=>body.includes('의 문법을 한국어로 해설')?'문법 해설':body.includes('더 쉬운 어휘')?'쉬운 문장':'문장 번역';
async function aiByLine(f,material=zh){
 f.ai=[];
 await f.page.route('**/api/gemini',r=>{
  const body=r.request().postData()||'',line=material.texts.findIndex(t=>body.includes(t)),text=`${aiKind(body)} 표지 ${line}`;
  f.ai.push(text);
  return r.fulfill({contentType:'application/json',body:JSON.stringify({candidates:[{content:{parts:[{text}]}}]})});
 });
}
const pick=(f,line)=>f.page.getByRole('button',{name:'문장 전체 분석',exact:true}).nth(line);
const sentencePanel=f=>f.page.locator('[data-panel="left"]').filter({visible:true});
const openSentenceTab=f=>f.page.locator('#inspector-sentence-tab').filter({visible:true}).click();
const unfocused={focusMode:false,autoSpeakOnClick:false};
const book0='눈앞의 경기장은 사진보다 더 웅장하다.';

test('AE-R2 §5.1: 더 쉽게·자세히 results do not linger under another sentence',{timeout:180000},async()=>{
 const f=await open(1280,900,unfocused);
 try{
  await aiByLine(f);
  const left=sentencePanel(f);
  await pick(f,0).click();
  await left.getByText(book0).first().waitFor();
  await left.getByRole('button',{name:'🔤 더 쉽게 ▾',exact:true}).click();
  await left.getByText('쉬운 문장 표지 0',{exact:true}).waitFor();
  await left.getByRole('button',{name:'자세히 ▾',exact:true}).click();
  await left.getByText('문법 해설 표지 0',{exact:true}).waitFor();
  await pick(f,2).click();
  await left.getByText('문장 번역 표지 2').first().waitFor();
  assert.equal(await left.getByText('문법 해설 표지 0').count(),0,'sentence 0 grammar is gone under sentence 2');
  assert.equal(await left.getByText('쉬운 문장 표지 0').count(),0,'sentence 0 easier text is gone under sentence 2');
  assert.equal(await left.getByRole('button',{name:'자세히 ▾',exact:true}).count(),1,'자세히 is closed again');
  assert.equal(await left.getByRole('button',{name:'🔤 더 쉽게 ▾',exact:true}).count(),1,'더 쉽게 is closed again');
  // 다시 열면 그 문장(2)의 결과가 온다.
  await left.getByRole('button',{name:'자세히 ▾',exact:true}).click();
  await left.getByText('문법 해설 표지 2',{exact:true}).waitFor();
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const [language,material,meta,first] of [['Chinese',zh,undefined,book0],['Japanese',ja,{},'문장 번역 표지 0']])test(`AE-R2 §1.2 ${language}: tapping a word on another line does not show the previous sentence translation`,{timeout:180000},async()=>{
 const f=await open(1280,900,unfocused,{language,material,...(meta?{meta}:{})});
 try{
  await aiByLine(f,material);
  const left=sentencePanel(f);
  await pick(f,0).click();
  await left.getByText(first).first().waitFor();
  // 같은 줄 단어 = 그 줄의 번역이라 남는다(보존).
  await token(f,0,2).click();
  await f.page.locator('.word-detail-card__meaning').filter({visible:true}).getByText(material.dictionary.id_0_2.meaning,{exact:true}).waitFor();
  await openSentenceTab(f);
  await left.getByText(first).first().waitFor();
  // 다른 줄 단어 = 앞 문장(0)의 번역이 [문장] 탭에 남지 않는다.
  await token(f,2,1).click();
  await f.page.locator('.word-detail-card__meaning').filter({visible:true}).getByText(material.dictionary.id_2_1.meaning,{exact:true}).waitFor();
  await openSentenceTab(f);
  await f.page.waitForTimeout(200);
  assert.equal(await left.getByText(first).count(),0,'line 0 translation is not shown for a line 2 word');
  assert.equal(await left.getByText(material.texts[0]).count(),0,'line 0 original is not shown either');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('AE-R2 §5.2: a grammar note saves the sentence its explanation was made from',{timeout:180000},async()=>{
 const f=await open(1280,900,unfocused);
 try{
  await aiByLine(f);
  const notes=[];
  await f.page.route('**/rest/v1/grammar_notes**',r=>{
   const req=r.request();
   if(req.method()==='POST'){const body=req.postDataJSON();notes.push(Array.isArray(body)?body[0]:body);}
   return r.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
  });
  const left=sentencePanel(f);
  // 막대로 문장 0을 지정(selectedRangeText = 문장 0) → 다른 줄(2) 단어창에서 [문장] 탭(단어창 「번역」 버튼 자리 — AE-R1 PR②) → [자세히] → 저장.
  await pick(f,0).click();
  await left.getByText(book0).first().waitFor();
  await token(f,2,1).click();
  await f.page.locator('.word-detail-card__meaning').filter({visible:true}).getByText('내일',{exact:true}).waitFor();
  await openSentenceTab(f);
  await left.getByText('문장 번역 표지 2').first().waitFor();
  await left.getByRole('button',{name:'자세히 ▾',exact:true}).click();
  await left.getByText('문법 해설 표지 2',{exact:true}).waitFor();
  await left.getByRole('button',{name:'노트에 저장',exact:true}).click();
  await left.getByRole('button',{name:'✓ 저장됨',exact:true}).waitFor();
  assert.equal(notes.length,1);
  assert.equal(notes[0].selected_text,texts[2],'the note keeps the explained sentence, not the earlier designation');
  assert.ok(notes[0].explanation.includes('문법 해설 표지 2'));
  assert.equal(String(notes[0].material_id),'94131');
  // 다음 문장의 해설은 다시 저장할 수 있고, 그 문장으로 저장된다.
  await pick(f,1).click();
  await left.getByText('문장 번역 표지 1').first().waitFor();
  await left.getByRole('button',{name:'자세히 ▾',exact:true}).click();
  await left.getByText('문법 해설 표지 1',{exact:true}).waitFor();
  await left.getByRole('button',{name:'노트에 저장',exact:true}).click();
  await left.getByRole('button',{name:'✓ 저장됨',exact:true}).waitFor();
  assert.equal(notes.length,2);
  assert.equal(notes[1].selected_text,texts[1]);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 뷰어 v2 AD-R2 PR ① 읽기 크롬(VIEWER-V2-ROUNDS-001 §5, 설계서 docs/manabi-viewer-v2-ad-r2.md §2.1·§9 제안값 Q1~Q5).
// 툴바 = 보이는 라벨(듣기 · Aa · 학습), ⋯ 자료 관리는 「학습」 창 안, 영문 크롬 0, 본문 테두리 카드 0.
const LABELS={ko:['듣기','Aa','학습'],'zh-CN':['朗读','Aa','学习'],'zh-TW':['朗讀','Aa','學習']};
const chromeFacts=f=>f.page.evaluate(()=>{
 const r=el=>el.getBoundingClientRect();
 const tools=[...document.querySelectorAll('.viewer-topbar__tools button')].filter(b=>b.getClientRects().length);
 const topbar=document.querySelector('.viewer-topbar'),area=document.querySelector('.reader-area');
 const chrome=[topbar,document.querySelector('.reader-edition'),document.querySelector('.viewer-badges')].filter(Boolean).map(el=>el.innerText).join('\n');
 return {labels:tools.map(b=>b.innerText.trim()),names:tools.map(b=>(b.getAttribute('aria-label')||b.innerText).trim()),boxes:tools.map(b=>({w:r(b).width,h:r(b).height,mid:r(b).top+r(b).height/2,right:r(b).right})),
  topbar:r(topbar).height,chrome,latin:(chrome.match(/[A-Za-z]{2,}/g)||[]).filter(w=>w!=='Aa'),
  areaBorder:getComputedStyle(area).borderTopWidth,areaBg:getComputedStyle(area).backgroundColor,pageBg:getComputedStyle(document.querySelector('.viewer-layout')).backgroundColor,
  titleLeft:r(document.querySelector('.viewer-titlerow .page-header__title')).left,textLeft:r(area).left+parseFloat(getComputedStyle(area).paddingLeft),
  overflow:document.documentElement.scrollWidth>innerWidth,vw:innerWidth};
});
for(const width of [390,1280])test(`${width}px: labelled one-row toolbar, no English chrome, no body card; 자료 관리 lives in the 학습 window`,{timeout:180000},async()=>{
 const f=await open(width,width<600?844:900,undefined,{visibility:'private'});
 try{
  const c=await chromeFacts(f);
  console.log(`[ad-r2-chrome] ${width} ${JSON.stringify({labels:c.labels,boxes:c.boxes.map(b=>Math.round(b.w)),topbar:c.topbar,titleLeft:c.titleLeft,textLeft:c.textLeft})}`);
  assert.deepEqual(c.labels,LABELS.ko,'every toolbar button shows a visible label');
  // WCAG 2.5.3 Label in Name — 보이는 라벨이 접근 이름 안에 든다(본문 전체 듣기 ⊃ 듣기 · Aa 읽기 설정 ⊃ Aa · 학습).
  c.labels.forEach((label,i)=>assert.ok(c.names[i].includes(label),`accessible name "${c.names[i]}" contains visible "${label}"`));
  assert.deepEqual(c.names,['본문 전체 듣기','Aa 읽기 설정','학습']);
  for(const b of c.boxes)assert.ok(b.w>=44&&b.h>=44,`toolbar target ${b.w}x${b.h} >= 44`);
  const mids=c.boxes.map(b=>b.mid);assert.ok(Math.max(...mids)-Math.min(...mids)<=2,`toolbar stays one row: ${mids}`);
  assert.ok(c.topbar<=60,`path row stays one line: ${c.topbar}px`);
  assert.ok(Math.max(...c.boxes.map(b=>b.right))<=c.vw,'toolbar fits the viewport');
  assert.deepEqual(c.latin,[],`no English chrome: ${c.chrome}`);
  assert.equal(c.areaBorder,'0px','no bordered card around the text');
  assert.equal(c.areaBg,c.pageBg,'text sits directly on the paper');
  assert.ok(Math.abs(c.textLeft-c.titleLeft)<=1,`text starts where the title starts: ${c.textLeft} vs ${c.titleLeft}`);
  assert.equal(await f.page.locator('.viewer-topbar').getByRole('button',{name:'자료 관리',exact:true}).count(),0,'no unlabeled ⋯ in the toolbar');
  await f.page.getByRole('button',{name:'학습',exact:true}).click();
  const manage=f.page.getByRole('dialog',{name:'학습'}).getByRole('button',{name:/^자료 관리/});
  await manage.click();
  await f.page.getByRole('dialog',{name:'자료 관리'}).getByRole('button',{name:/^전체 분석/}).waitFor();
  assert.equal(await f.page.getByRole('dialog',{name:'학습'}).count(),0,'학습 window yields to 자료 관리');
  assert.equal(c.overflow,false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
for(const locale of ['zh-CN','zh-TW'])test(`390px ${locale}: toolbar labels and chrome follow the screen language`,{timeout:180000},async()=>{
 const f=await open(390,844,undefined,{uiLocale:locale});
 try{
  const c=await chromeFacts(f);
  assert.deepEqual(c.labels,LABELS[locale]);
  c.labels.forEach((label,i)=>assert.ok(c.names[i].includes(label),`${locale}: accessible name "${c.names[i]}" contains visible "${label}"`));
  assert.deepEqual(c.latin,[],`no English chrome: ${c.chrome}`);
  assert.doesNotMatch(c.chrome,/[가-힣]/,`no Korean left in ${locale} chrome: ${c.chrome}`);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 자동 진행 · 문장 이동 막대 한 자리(설계 Q3 A): 지정 없음 = 바닥 「▶ 자동 진행」, 지정 = 막대 안 ▶/■, 시트·창 열림 = 0개.
// 정본 §5 합격 「시트가 열려 있으면 자동 진행 버튼이 없다」. 목표 속도를 30자/분으로 낮춰(첫 문장 16초) 진행 중 상태를 붙잡는다.
const paceButtons=f=>f.page.locator('.viewer-pace-float button, .sentence-move-bar__pace').filter({visible:true});
const bottomOverlaps=f=>f.page.evaluate(()=>{
 const boxes=[...document.querySelectorAll('.sentence-move-bar, .viewer-pace-float, .viewer-inspector')].filter(el=>el.getClientRects().length).map(el=>({cls:el.className,...el.getBoundingClientRect().toJSON()}));
 const hits=[];
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)hits.push(`${a.cls} × ${b.cls}`);}
 return {hits,inView:boxes.every(b=>b.left>=0&&b.right<=innerWidth+.5&&b.bottom<=innerHeight+.5)};
});
for(const [width,height] of [[390,844],[1280,900]])test(`${width}px: auto-advance shares one bottom slot with the move bar and disappears while a sheet is open`,{timeout:240000},async()=>{
 const f=await open(width,height,{focusMode:true,autoPace:true,paceCpm:30,autoSpeakOnClick:false});
 try{
  // ⓐ 지정 없음 → 단독 버튼 하나(보이는 라벨 + 44px), 막대 없음
  const float=f.page.locator('.viewer-pace-float');
  await float.waitFor();
  assert.equal(await bar(f).count(),0);
  const start=float.getByRole('button',{name:'자동 진행 시작',exact:true});
  assert.equal((await start.innerText()).trim(),'자동 진행');
  const fb=await start.boundingBox();assert.ok(fb.width>=44&&fb.height>=44);
  assert.equal(await paceButtons(f).count(),1);
  assert.equal(await f.page.locator('.viewer-topbar').getByRole('button',{name:/자동 진행/}).count(),0,'not in the toolbar');
  // ⓑ 키보드로 시작 → 문장 지정 + 막대 안 ■로 포커스가 옮겨 간다(단독 버튼은 사라진다)
  await start.focus();await f.page.keyboard.press('Enter');
  await bar(f).waitFor();
  await f.page.locator('.reader-area--pacing').waitFor();
  assert.equal(await float.count(),0,'the floating button yields to the bar');
  assert.deepEqual(await pickedLines(f),['0']);
  const stop=bar(f).getByRole('button',{name:'자동 진행 중지',exact:true});
  assert.equal(await stop.count(),1,'bar carries ■ while running');
  assert.equal(await f.page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'자동 진행 중지','focus follows into the bar');
  const sb=await stop.boundingBox();assert.ok(sb.width>=44&&sb.height>=44);
  let o=await bottomOverlaps(f);assert.deepEqual(o.hits,[]);assert.ok(o.inView,'bottom controls stay in the viewport');
  const barBox=await bar(f).boundingBox();assert.ok(barBox.height<=60&&barBox.x+barBox.width<=width+.5,`bar stays one row inside ${width}px`);
  // 순서: ^ v ▶/■ 번역 × (번역 바로 앞)
  const order=await bar(f).locator('button').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')||b.textContent.trim()));
  assert.deepEqual(order,['위 문장','아래 문장','자동 진행 중지','번역','문장 지정 해제']);
  // ⓒ 진행 중 시트 열림(같은 문장 두 번째 탭) → 자동 진행 버튼 0개, 겹침 0
  await token(f,0,2).click();
  await f.page.locator('.word-detail-card__meaning').getByText('경기장',{exact:true}).waitFor();
  assert.equal(await paceButtons(f).count(),0,'no auto-advance button while the sheet is open');
  o=await bottomOverlaps(f);assert.deepEqual(o.hits,[]);
  // ⓓ 시트를 닫으면 막대와 ■가 돌아오고, Enter로 멈추면 ▶(이름 「자동 진행 시작」)
  await f.page.getByRole('button',{name:'보조 패널 닫기',exact:true}).click();
  await bar(f).waitFor();
  assert.equal(await paceButtons(f).count(),1);
  await bar(f).getByRole('button',{name:/^자동 진행/}).focus();await f.page.keyboard.press('Enter');
  await bar(f).getByRole('button',{name:'자동 진행 시작',exact:true}).waitFor();
  assert.equal(await f.page.locator('.reader-area--pacing').count(),0,'stopped');
  // ⓔ 지정 해제(×) → 막대가 사라지고 단독 버튼이 같은 바닥 자리로 돌아온다
  await bar(f).getByRole('button',{name:'문장 지정 해제',exact:true}).click();
  await bar(f).waitFor({state:'detached'});
  await float.waitFor();
  assert.equal(await paceButtons(f).count(),1);
  // ⓕ 창(학습 모달)이 열리면 단독 버튼도 없다 — 막대는 #1356대로 모달 뒤에 남으므로 지정 없는 상태에서 본다
  await f.page.getByRole('button',{name:'학습',exact:true}).click();
  await f.page.getByRole('dialog',{name:'학습'}).waitFor();
  assert.equal(await paceButtons(f).count(),0,'no floating auto-advance button behind a modal');
  await f.page.keyboard.press('Escape');
  await f.page.getByRole('dialog',{name:'학습'}).waitFor({state:'detached'});
  await float.waitFor();
  // 단어 탭(집중 해제 상태 아님 — 첫 탭은 순수 이동)으로 지정해도 막대 안 ▶로 옮겨 간다
  await token(f,1,1).click();await bar(f).waitFor();
  assert.equal(await float.count(),0);
  assert.equal(await bar(f).getByRole('button',{name:'자동 진행 시작',exact:true}).count(),1);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

// 검수 보완 ① — 접힌 시트(문장 번역을 본 뒤 패널을 닫으면 내용이 남아 바닥에 머문다)에서도 자동 진행을 시작·정지할 수 있다.
// main은 툴바 ▶가 늘 있었다. 1120 미만 = 남은 머리줄 안 ▶, 1120 이상 = 접힌 시트가 통째로 숨으므로 바닥 단독 버튼. 겹침 0 · 가림 0 · 키보드.
for(const [width,height] of [[390,844],[1280,900]])test(`${width}px: auto-advance stays reachable while the sheet is collapsed`,{timeout:240000},async()=>{
 const f=await open(width,height,{focusMode:true,autoPace:true,paceCpm:30,autoSpeakOnClick:false});
 try{
  await token(f,0,0).click();await bar(f).waitFor();
  await bar(f).getByRole('button',{name:'번역',exact:true}).click();
  await f.page.locator('#inspector-sentence').getByText('눈앞의 경기장은 사진보다 더 웅장하다.').first().waitFor();
  assert.equal(await paceButtons(f).count(),0,'open sheet: no auto-advance button');
  await f.page.getByRole('button',{name:'보조 패널 닫기',exact:true}).click();
  await f.page.locator('.viewer-inspector.is-collapsed').waitFor({state:'attached'});
  assert.equal(await bar(f).count(),0,'the collapsed sheet keeps the bottom slot (no move bar)');
  assert.deepEqual(await pickedLines(f),['0']);
  const visible=paceButtons(f).or(f.page.locator('.viewer-inspector__pace').filter({visible:true}));
  assert.equal(await visible.count(),1,'exactly one auto-advance control while collapsed');
  const where=await visible.evaluate(b=>b.closest('.viewer-inspector')?'strip':b.closest('.viewer-pace-float')?'float':'other');
  assert.equal(where,width<1120?'strip':'float',`collapsed control lives in the ${width<1120?'sheet strip':'floating slot'}`);
  const box=await visible.boundingBox();assert.ok(box.width>=44&&box.height>=44,'44px target');
  let o=await bottomOverlaps(f);assert.deepEqual(o.hits,[]);assert.ok(o.inView);
  // 키보드: Enter로 시작(지정 문장 그대로 · 진행 중 표시) → Enter로 정지
  await visible.focus();await f.page.keyboard.press('Enter');
  await f.page.locator('.reader-area--pacing').waitFor();
  assert.deepEqual(await pickedLines(f),['0']);
  const stop=f.page.getByRole('button',{name:'자동 진행 중지',exact:true}).filter({visible:true});
  assert.equal(await stop.count(),1,'running state shows ■ in the same place');
  await stop.focus();await f.page.keyboard.press('Enter');
  await f.page.getByRole('button',{name:'자동 진행 시작',exact:true}).filter({visible:true}).waitFor();
  assert.equal(await f.page.locator('.reader-area--pacing').count(),0);
  o=await bottomOverlaps(f);assert.deepEqual(o.hits,[]);
  // 가림 0: 지정 문장과 본문 끝이 바닥 요소 위로 드러난다(이동 막대 여백 규칙과 같은 기준)
  const bottomTop=()=>f.page.evaluate(()=>Math.min(innerHeight,...[...document.querySelectorAll('.viewer-inspector, .viewer-pace-float, .sentence-move-bar')].filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().top)));
  const sentenceBottom=await f.page.locator('.word-token--picked').evaluateAll(els=>Math.max(...els.map(el=>el.getBoundingClientRect().bottom)));
  assert.ok(sentenceBottom<=await bottomTop(),'designated sentence is not covered');
  await f.page.evaluate(()=>scrollTo({top:document.scrollingElement.scrollHeight,behavior:'instant'}));await f.page.waitForTimeout(200);
  const last=await f.page.evaluate(()=>{const c=document.querySelector('.viewer-center');return [...c.children].filter(el=>el.getClientRects().length).at(-1).getBoundingClientRect().bottom;});
  const top=await bottomTop();
  assert.ok(last<=top,`end of the page ${last} <= bottom control top ${top}`);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
