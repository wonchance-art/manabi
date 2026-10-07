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

async function open(width,height=844,prefs={focusMode:true,autoSpeakOnClick:false},{language='Chinese',material=zh,meta={translations:{[texts[0]]:'눈앞의 경기장은 사진보다 더 웅장하다.'}},common,visibility,guest=false}={}) {
 const f=await fixture({width,guest});
 await f.page.setViewportSize({width,height});
 await f.context.addInitScript(({language,prefs,common})=>{
  // 새 컨텍스트에 한 번만 심는다 — 이후에는 UI가 실제로 저장한 값을 읽는다.
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,...(common?{common}:{}),languages:{[language]:prefs}}));
 },{language,prefs,common});
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
