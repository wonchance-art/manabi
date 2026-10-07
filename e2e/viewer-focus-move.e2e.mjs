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
function build(lines) {
 const texts=lines.map(l=>l.map(w=>w[0]).join(''));
 const sequence=[],dictionary={};
 lines.forEach((words,line)=>{
  words.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]={text,base_form:text,furigana,meaning,pos:/^[。，、.,!?！？]$/.test(text)?'기호':'명사'};});
  if(line<lines.length-1){const id=`id_${line}_${words.length}`;sequence.push(id);dictionary[id]={text:'\n',base_form:'',furigana:'',meaning:'',pos:'개행'};}
 });
 return {texts,sequence,dictionary};
}
const zh=build(lines),texts=zh.texts;

async function open(width,height=844,prefs={focusMode:true,autoSpeakOnClick:false},{language='Chinese',material=zh,meta={translations:{[texts[0]]:'눈앞의 경기장은 사진보다 더 웅장하다.'}},common,visibility,uiLocale}={}) {
 const f=await fixture({width});
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
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
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
]);
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
  assert.equal(analysis.length,1,`one word-analysis request on ${analyzePath}`);
  assert.deepEqual(JSON.parse(analysis[0].body).lines,[sentence]);
  assert.equal(f.requests.length,2,'no other AI/analysis request');
  assert.equal(await bar(f).count(),0);
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
