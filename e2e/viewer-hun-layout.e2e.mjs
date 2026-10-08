// Actual viewer with disposable fixture data. No live identity, provider or DB writes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const entries=[
 ['连弩','lián nǔ','연발 쇠뇌'],['俑','','부장 인형'],['T恤','T xù','티셔츠'],['弩弩弩弩','nǔ nǔ nǔ nǔ','반복 글자 검수'],['技术','jì shù','기술'],['一点','yì diǎn','조금'],
];
async function open(width) {
 const f=await fixture({width});
 await f.context.addInitScript(()=>{
  // Seed a fresh context once; reload must exercise the preference actually saved by the UI.
  if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,languages:{Chinese:{showHanjaKo:true,autoSpeakOnClick:false}}}));
 });
 f.rows.push({id:94102,user_id:owner,title:'훈음 배치 검수',raw_text:entries.map(e=>e[0]).join(' '),source_type:'text',created_at:new Date().toISOString(),processed_json:{status:'completed',metadata:{language:'Chinese'},sequence:entries.map((_,i)=>`id_0_${i}`),dictionary:Object.fromEntries(entries.map(([text,furigana,meaning],i)=>[`id_0_${i}`,{text,base_form:text,furigana,meaning,pos:'명사'}]))}});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.page.goto('/viewer/94102',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator('[data-source-token="id_0_0"]').waitFor();
 return f;
}
// AE-R1(VIEWER-V2-ROUNDS-001 §2.1 표제어 덩어리): 훈음은 별도 목록(.reader-hun)이 아니라 한자 아래 루비 셀
// (.word-fit__hun)이다. 겹침 0 = 글자와 그 훈음 셀, 이웃 칸의 훈음·글자끼리 사각형이 겹치지 않고, 셀이 카드 밖으로
// 나가지 않으며, 뜻 줄은 훈음 아래에서 시작한다. 1440·390·320 × 글자 200%(#1333 계약 유지·확장).
async function select(f,index) {
 const token=f.page.locator(`[data-source-token="id_0_${index}"]`);
 await token.focus();await f.page.keyboard.press('Enter');
 await f.page.locator('.word-detail-card__meaning').getByText(entries[index][2],{exact:true}).waitFor();
 await f.page.locator('#inspector-word .word-fit__hun').first().waitFor();
}
const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
async function checkGeometry(f) {
 const data=await f.page.locator('#inspector-word .reader-card-headword').evaluate(head=>{
  const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom}};
  const card=head.closest('.word-detail-card');
  const glyphOf=col=>{const g=col.querySelector('.word-fit__char,.word-fit__glyph');if(!g)return null;const range=document.createRange();range.selectNodeContents(g);const b=range.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom};};
  return {body:r(card.querySelector('.reader-card-body')),meaning:r(card.querySelector('.word-detail-card__meaning')),
   cols:[...head.querySelectorAll('.word-fit__col')].map(col=>({glyph:glyphOf(col),huns:[...col.querySelectorAll('.word-fit__hun')].map(r)})),
   huns:[...head.querySelectorAll('.word-fit__hun')].map(e=>({...r(e),style:getComputedStyle(e)})).map(({style,...b})=>({...b,position:style.position,overflow:style.overflow,textOverflow:style.textOverflow})),
   overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert.ok(data.huns.length>0,'hun ruby cells rendered');
 for(const h of data.huns){
  assert.notEqual(h.position,'absolute','hun cell is in flow — no absolute positioning');
  assert.equal(h.textOverflow,'clip');assert.equal(h.overflow,'visible','hun cell is not clipped');
  assert.ok(h.x>=data.body.x-.5&&h.right<=data.body.right+.5,`hun cell stays inside the card ${JSON.stringify(h)} / ${JSON.stringify(data.body)}`);
  assert.ok(h.bottom<=data.meaning.y+.5,'meaning starts below the hun row');
 }
 for(const {glyph,huns} of data.cols)for(const h of huns)if(glyph)assert.ok(h.y>=glyph.bottom-.5,`hun label sits below its glyph ${JSON.stringify({glyph,h})}`);
 const glyphs=data.cols.map(c=>c.glyph).filter(Boolean);
 for(let i=0;i<data.huns.length;i++){
  for(let j=i+1;j<data.huns.length;j++)assert.ok(!overlap(data.huns[i],data.huns[j]),`hun cells ${i}/${j} overlap`);
  for(const g of glyphs)assert.ok(!overlap(data.huns[i],g),`hun cell ${i} overlaps a glyph`);
 }
 assert.equal(data.overflow,0);
 const actions=f.page.locator('.reader-card-actions').filter({visible:true}).first();
 for(const grade of ['다시','어려움','알맞음','쉬움'])assert.equal(await actions.getByRole('button',{name:new RegExp(`^${grade}`)}).count(),1);
 assert.equal(await f.page.getByRole('button',{name:'발음 듣기',exact:true}).filter({visible:true}).count(),1);
 assert.deepEqual(f.errors,[]);
}
for(const width of [1440,390,320])test(`viewer Korean labels/${width}px: long, absent reading, mixed and repeated characters`,async()=>{
 const f=await open(width);
 try{
  for(let i=0;i<entries.length;i++){
   await select(f,i);await checkGeometry(f);
   if(i===1)assert.equal(await f.page.locator('#inspector-word .word-fit__hun').count(),1);
   if(i===2)assert.equal(await f.page.locator('#inspector-word .word-fit__col:has(.word-fit__hun) .word-fit__char').textContent(),'恤');
   if(i===3)assert.equal(await f.page.locator('#inspector-word .word-fit__hun').count(),4);
   if(i===0&&process.env.COMPOSER_SCREENSHOTS)await f.page.screenshot({path:`${process.env.COMPOSER_SCREENSHOTS}/hun-${width}.png`,fullPage:true});
  }
  await f.page.evaluate(()=>document.documentElement.style.fontSize='200%');
  await checkGeometry(f);
  await f.page.evaluate(()=>document.documentElement.style.fontSize='');
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  await f.page.getByRole('tab',{name:'학습 표시',exact:true}).click();
  const toggle=f.page.getByRole('checkbox',{name:'한자 대조'});
  await toggle.click();await f.page.locator('#inspector-word .word-fit__hun').waitFor({state:'detached'});
  await f.page.keyboard.press('Escape');
  assert.equal(await f.page.locator('#inspector-word .word-fit__hun').count(),0);
  await f.page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await f.page.evaluate(()=>JSON.parse(localStorage.getItem('viewer_preferences_v2')).languages.Chinese.showHanjaKo),false);
  await f.page.locator('[data-source-token="id_0_0"]').focus();await f.page.keyboard.press('Enter');
  await f.page.locator('.word-detail-card__meaning').getByText(entries[0][2],{exact:true}).waitFor();
  assert.equal(await f.page.locator('#inspector-word .word-fit__hun').count(),0,'disabled preference survives reload');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
// R0+(VIEWER-V2-ROUNDS-001 §1): 간체 동형 옛 글자(术 '삽주뿌리 출') 대신 정체 꼴(術 '재주 술')로 찾는다.
// 단어창 훈음 줄과 한자 창(AE-R4 — 중국어 일반 모드의 글자 카드 대체)이 같은 조회를 쓰므로 같은 값을 보인다.
test('viewer Korean labels: traditional-form lookup in the word card and the character card',async()=>{
 const f=await open(390);
 try{
  const index=entries.findIndex(e=>e[0]==='技术');
  await select(f,index);
  const labels=await f.page.locator('#inspector-word .word-fit__hun').evaluateAll(els=>els.map(e=>e.dataset.label));
  assert.ok(labels.includes('재주 술'),labels.join(' / '));
  assert.ok(!labels.some(l=>l.includes('삽주뿌리')),labels.join(' / '));
  // AE-R4 PR②(설계서 docs/manabi-viewer-v2-ae-r4.md §7.1 · 정본 §9): 중국어 일반 모드의 글자 탭은 글자 카드 대신 한자 창 —
  // 창 머리 훈음도 같은 정체 조회(hanjaPanelModel → hanjaReadingsOf)라 같은 값(재주 술)을 보인다.
  await f.page.locator('.word-fit__char',{hasText:'术'}).first().click();
  await f.page.locator('.hanja-pop__hun').filter({hasText:'재주 술'}).waitFor();
  assert.equal(await f.page.locator('.char-inspect').count(),0);
  // 같은 음 글자는 지금 훈음 유지(화면 악화 0) — 点은 정체 點 '더러울 점'이 아니라 지금 '검은 점 점'
  await select(f,entries.findIndex(e=>e[0]==='一点'));
  const dot=await f.page.locator('#inspector-word .word-fit__hun').evaluateAll(els=>els.map(e=>e.dataset.label));
  assert.ok(dot.includes('검은 점 점'),dot.join(' / '));
  assert.ok(!dot.some(l=>l.includes('더러울')),dot.join(' / '));
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
