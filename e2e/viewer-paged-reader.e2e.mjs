// 쪽 넘김 보기(READER-PAGED-001, 오너 승인 목업 A·C·D·E) — 실제 뷰어, 합성 자료만. 계정·제공자·운영 DB 없음.
// 기본 보기 = 쪽 넘김: 화면 높이만큼 채운 쪽을 밀기·키보드·쪽 막대·여백 띠로 넘기고, 본문 탭은 언제나 단어창이다.
// 위치는 쪽 번호가 아니라 토큰 번호(reading_progress.last_token_idx)로 저장·복원하고, 글자를 키워도 같은 토큰으로 돌아온다.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const shots=process.env.PAGED_SCREENSHOTS;
const words=[['眼前','yǎn qián','눈앞'],['的','de','~의'],['体育场','tǐ yù chǎng','경기장'],['比','bǐ','~보다'],['照片','zhào piàn','사진'],['上','shàng','위'],['更','gèng','더'],['壮观','zhuàng guān','웅장하다'],['，','','쉼표'],['我们','wǒ men','우리'],['明天','míng tiān','내일'],['去','qù','가다'],['公园','gōng yuán','공원'],['散步','sàn bù','산책하다'],['。','','마침표']];
function build(count=48){
 const sequence=[],dictionary={},texts=[];
 for(let line=0;line<count;line++){
  const row=[...words.slice(line%5),...words.slice(0,line%5)];texts.push(row.map(w=>w[0]).join(''));
  row.forEach(([text,furigana,meaning],i)=>{const id=`id_${line}_${i}`;sequence.push(id);dictionary[id]={text,base_form:text,furigana,meaning,pos:/^[。，]$/.test(text)?'기호':'명사'};});
  if(line<count-1){const id=`id_${line}_${row.length}`;sequence.push(id);dictionary[id]={text:'\n',base_form:'',furigana:'',meaning:'',pos:'개행'};}
 }
 return {texts,sequence,dictionary};
}
const material=build();

async function open(width,height,{progress=null,common=null,shared=null}={}){
 const f=await fixture({width,shared});
 await f.page.setViewportSize({width,height});
 f.progress=shared?.progress||{row:progress};
 await f.context.addInitScript(({common})=>{
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,...(common?{common}:{}),languages:{Chinese:{autoSpeakOnClick:false}}}));
 },{common});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.context.route('**/api/gemini',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({text:'검수용 맥락'})}));
 // 읽던 위치 — 운영과 같은 upsert·조회(행 하나). 나중에 붙인 route가 먼저 잡는다.
 await f.context.route('**/rest/v1/reading_progress**',route=>{
  const req=route.request(),cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(req.method()==='POST'){const body=req.postDataJSON();f.progress.row={...(Array.isArray(body)?body[0]:body),is_completed:false};return route.fulfill({status:201,headers:cors,contentType:'application/json',body:'[]'});}
  const object=req.headers().accept?.includes('vnd.pgrst.object');
  return route.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify(object?f.progress.row:(f.progress.row?[f.progress.row]:[]))});
 });
 if(!f.rows.some(row=>row.id===94201))f.rows.push({id:94201,owner_id:owner,user_id:owner,visibility:'private',title:'쪽 넘김 검수 — 화면을 채우면 다음 쪽으로',raw_text:material.texts.join('\n'),source_type:'text',created_at:new Date().toISOString(),
  processed_json:{status:'completed',metadata:{language:'Chinese'},sequence:material.sequence,dictionary:material.dictionary}});
 await f.page.goto('/viewer/94201',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 return f;
}
const pages=f=>f.page.locator('[data-reader-pages="paged"]');
const bar=f=>f.page.getByRole('navigation',{name:'쪽 이동',exact:true});
async function position(f){
 // 단어창·문장 이동 막대가 바닥을 차지하면 쪽 막대는 그 밑에 숨는다(visibility) — 글자는 그대로 읽는다.
 const text=(await f.page.locator('.reader-pagebar__pos').textContent()).trim();
 const m=text.match(/^(\d+) \/ (\d+)쪽 · (\d+)%$/);assert.ok(m,`page label: ${text}`);
 return {page:+m[1],count:+m[2],percent:+m[3]};
}
async function waitPage(f,page){await f.page.waitForFunction(p=>new RegExp(`^${p} / \\d+쪽`).test(document.querySelector('.reader-pagebar__pos')?.textContent||''),page);}
/** 지금 쪽(상자 안)에 보이는 첫 토큰 — 다단의 다른 단은 상자 밖(가로)에 있다. */
const firstVisible=f=>f.page.evaluate(()=>{
 const box=document.querySelector('[data-reader-pages="paged"]').getBoundingClientRect();
 return [...document.querySelectorAll('[data-reader-pages="paged"] [data-source-token]')].find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=box.left-1&&r.right<=box.right+1;})?.dataset.sourceToken||null;
});
const tokenVisible=(f,id)=>f.page.evaluate(id=>{
 const box=document.querySelector('[data-reader-pages="paged"]').getBoundingClientRect(),r=document.querySelector(`[data-source-token="${id}"]`)?.getBoundingClientRect();
 return !!r&&r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;
},id);
async function swipe(f,dx){
 await pages(f).evaluate((el,dx)=>{
  const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,opts={bubbles:true,pointerId:7,pointerType:'touch',isPrimary:true};
  el.dispatchEvent(new PointerEvent('pointerdown',{...opts,clientX:x,clientY:y}));
  el.dispatchEvent(new PointerEvent('pointerup',{...opts,clientX:x+dx,clientY:y+6}));
 },dx);
}
async function noPageScroll(f){
 const {scroll,width}=await f.page.evaluate(()=>({scroll:document.documentElement.scrollHeight-innerHeight,width:document.documentElement.scrollWidth-innerWidth}));
 assert.ok(scroll<=2,`the window does not scroll in paged view (${scroll}px)`);assert.ok(width<=1,`no horizontal page overflow (${width}px)`);
}

for(const [width,height] of [[390,844],[1280,900]]){
 test(`${width}px: pages fill the screen and turn by swipe, keys, buttons and margins; a tap opens the word card only`,{timeout:240000},async()=>{
  const f=await open(width,height);
  try{
   await bar(f).waitFor();await waitPage(f,1);
   const start=await position(f);
   assert.ok(start.count>=3,`a long material spans several pages (${start.count})`);
   assert.equal(start.percent,Math.round(100/start.count));
   await noPageScroll(f);
   // 쪽 상자 = 상단 막대 아래 ~ 쪽 막대 위(목업 A·B). 쪽 막대는 화면 바닥에 붙는다.
   const box=await pages(f).boundingBox(),barBox=await bar(f).boundingBox();
   assert.ok(Math.abs(box.y+box.height-barBox.y)<=2,'the page bar sits right under the page');
   assert.ok(barBox.y+barBox.height<=height+1&&barBox.y+barBox.height>=height-40,'the page bar is at the bottom of the screen');
   for(const name of ['이전 쪽','다음 쪽']){const b=await bar(f).getByRole('button',{name,exact:true}).boundingBox();assert.ok(b.width>=44&&b.height>=44,`${name} keeps a 44px target`);}
   if(shots)await f.page.screenshot({path:`${shots}/paged-${width}-first.png`});
   // 키보드 → / PageDown / Space / ← / Home / End
   await f.page.keyboard.press('ArrowRight');await waitPage(f,2);
   await f.page.keyboard.press('PageDown');await waitPage(f,3);
   await f.page.keyboard.press('Shift+Space');await waitPage(f,2);
   await f.page.keyboard.press('ArrowLeft');await waitPage(f,1);
   await f.page.keyboard.press('End');await waitPage(f,start.count);
   // 마지막 쪽(목업 D) — 「다 읽었다면」 줄이 그 쪽 안에 보이고 진행률은 100%.
   assert.equal((await position(f)).percent,100);
   const done=await f.page.locator('.post-reading').evaluate(el=>{const box=document.querySelector('[data-reader-pages="paged"]').getBoundingClientRect(),r=el.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.top<box.bottom;});
   assert.ok(done,'the end-of-reading row lands on the last page');
   await f.page.getByRole('button',{name:'✓ 읽기 완료',exact:true}).waitFor();
   if(shots)await f.page.screenshot({path:`${shots}/paged-${width}-last.png`});
   await f.page.keyboard.press('Home');await waitPage(f,1);
   // 쪽 막대 버튼
   await bar(f).getByRole('button',{name:'다음 쪽',exact:true}).click();await waitPage(f,2);
   await bar(f).getByRole('button',{name:'다음 쪽',exact:true}).click();await waitPage(f,3);
   await bar(f).getByRole('button',{name:'이전 쪽',exact:true}).click();await waitPage(f,2);
   // 밀기 — 왼쪽 = 다음, 오른쪽 = 이전
   await swipe(f,-140);await waitPage(f,3);
   await swipe(f,140);await waitPage(f,2);
   // 여백 띠(PC) — 본문 단 바깥. 폰에서는 없다.
   const strip=f.page.locator('.reader-page-strip--next');
   if(width>=1000){
    const s=await strip.boundingBox(),p=await pages(f).boundingBox();
    assert.ok(s&&s.width>=44&&s.x>=p.x+p.width-1,'the next-page strip sits outside the text column');
    await strip.click();await waitPage(f,3);
    await f.page.locator('.reader-page-strip--prev').click();await waitPage(f,2);
   }else assert.equal(await strip.isVisible(),false);
   // 본문 탭 = 단어창만(쪽은 그대로). 단어창이 열린 동안 밀기는 무시한다.
   const id=await firstVisible(f);
   await f.page.locator(`[data-source-token="${id}"]`).click();
   await f.page.locator('.word-detail-card').first().waitFor();
   assert.equal((await position(f)).page,2,'tapping a word does not turn the page');
   assert.ok(await tokenVisible(f,id),'the tapped word stays visible');
   await swipe(f,-140);await f.page.waitForTimeout(250);
   const sheetOpen=await f.page.locator('.viewer-inspector:not(.is-collapsed)').count();
   if(sheetOpen)assert.equal(await f.page.locator('.reader-pagebar__pos').textContent().then(t=>t.startsWith('2 /')),true,'a swipe is ignored while the word card is open');
   if(width<1120){
    // 바닥 시트가 본문을 다시 흘리지 않는다(목업 C) — 쪽 상자 크기 그대로.
    const after=await pages(f).boundingBox();assert.equal(Math.round(after.height),Math.round(box.height),'the sheet does not reflow the text');
    if(shots)await f.page.screenshot({path:`${shots}/paged-${width}-card.png`});
   }
   await noPageScroll(f);
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 });
}

test('390px: reload restores the anchor token, 200% text keeps it, and the scroll view stays selectable',{timeout:240000},async()=>{
 const f=await open(390,844);
 try{
  await bar(f).waitFor();await waitPage(f,1);
  for(let i=0;i<3;i++)await f.page.keyboard.press('ArrowRight');
  await waitPage(f,4);
  const anchor=await firstVisible(f);
  // 쪽 번호가 아니라 그 쪽 첫 토큰 번호를 저장한다(2초 지연 쓰기).
  const index=material.sequence.indexOf(anchor);
  const until=Date.now()+8000;while(f.progress.row?.last_token_idx!==index&&Date.now()<until)await f.page.waitForTimeout(100);
  assert.equal(f.progress.row?.last_token_idx,index,'the first token of the turned-to page is saved');
  // 다시 열면 그 토큰이 있는 쪽
  await f.page.reload({waitUntil:'domcontentloaded'});await bar(f).waitFor();
  await f.page.waitForFunction(id=>{const box=document.querySelector('[data-reader-pages="paged"]')?.getBoundingClientRect(),r=document.querySelector(`[data-source-token="${id}"]`)?.getBoundingClientRect();return box&&r&&r.left>=box.left-1&&r.right<=box.right+1;},anchor,{timeout:15000});
  assert.equal(await firstVisible(f),anchor,'reload returns to the same anchor token');
  // 200% 글자 — 쪽이 다시 나뉘어도 기준 토큰이 보이는 쪽으로 돌아온다.
  const before=await position(f);
  await f.page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  await f.page.waitForFunction(count=>{const m=(document.querySelector('.reader-pagebar__pos')?.textContent||'').match(/\/ (\d+)쪽/);return m&&+m[1]>count;},before.count,{timeout:15000});
  await f.page.waitForTimeout(300);
  assert.ok(await tokenVisible(f,anchor),'200% text keeps the anchor token on screen');
  if(shots)await f.page.screenshot({path:`${shots}/paged-390-200pct.png`});
  await noPageScroll(f);
  await f.page.evaluate(()=>{document.documentElement.style.fontSize='';});
  // Aa 「보기」 한 줄(목업 E) — 스크롤을 고르면 지금 그대로의 세로 스크롤, 같은 토큰이 화면에.
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  const view=f.page.getByRole('group',{name:'보기',exact:true});
  assert.equal(await view.getByRole('button',{name:'쪽 넘김',exact:true}).getAttribute('aria-pressed'),'true','paged is the default view');
  await view.getByRole('button',{name:'스크롤',exact:true}).click();
  await f.page.keyboard.press('Escape');
  await f.page.locator('[data-reader-pages="scroll"]').waitFor();
  assert.equal(await bar(f).count(),0,'the scroll view has no page bar');
  await f.page.waitForFunction(id=>{const r=document.querySelector(`[data-source-token="${id}"]`)?.getBoundingClientRect();return r&&r.top>=0&&r.bottom<=innerHeight;},anchor,{timeout:5000});
  assert.ok(await f.page.evaluate(()=>scrollY>0),'the scroll view scrolls the window to the anchor');
  const stored=await f.page.evaluate(()=>JSON.parse(localStorage.getItem('viewer_preferences_v2')).common.readerView);
  assert.equal(stored,'scroll','the choice is saved with the viewer preferences');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
