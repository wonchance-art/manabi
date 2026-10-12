// Actual viewer with disposable fixture data (ZH-GRID-001 — owner-approved mockup 2026-10-12). No live identity,
// provider or DB writes. Chinese body text sits on one column grid like a Chinese publication: every hanzi and
// full-width punctuation mark takes one equal cell, half-width runs (2024 · iPhone) take whole cells, there is no
// extra gap between words, and closing punctuation never starts a line (禁则). Box geometry only — the runner may
// lack Noto CJK, and cell boxes have fixed widths whatever the font.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const shots=process.env.ZH_GRID_SHOTS, phase=process.env.ZH_GRID_PHASE||'after';
if(shots)mkdirSync(shots,{recursive:true});
// Line 0 is the approved mockup sentence; line 1 mixes digits, Latin, quotes and stacked closing marks; line 2 is
// long and comma-dense so the 禁则 sweep meets many wrap points.
const LINES=[
 [['眼前','yǎn qián'],['的','de'],['体育场','tǐ yù chǎng'],['比','bǐ'],['照片','zhào piàn'],['上','shàng'],['更','gèng'],['壮观','zhuàng guān'],['，',''],['我们','wǒ men'],['明天','míng tiān'],['去','qù'],['公园','gōng yuán'],['散步','sàn bù'],['。','']],
 [['2024',''],['年','nián'],['我','wǒ'],['买了','mǎi le'],['一部','yí bù'],['iPhone',''],['，',''],['他','tā'],['说','shuō'],['：',''],['「',''],['真','zhēn'],['好看','hǎo kàn'],['！',''],['」',''],['我们','wǒ men'],['一起','yì qǐ'],['去','qù'],['看看','kàn kan'],['吧','ba'],['。','']],
 [['今天','jīn tiān'],['天气','tiān qì'],['很','hěn'],['好','hǎo'],['，',''],['我','wǒ'],['和','hé'],['朋友','péng you'],['去','qù'],['图书馆','tú shū guǎn'],['，',''],['看','kàn'],['了','le'],['两','liǎng'],['本','běn'],['书','shū'],['、',''],['一','yì'],['份','fèn'],['报纸','bào zhǐ'],['；',''],['然后','rán hòu'],['我们','wǒ men'],['在','zài'],['咖啡馆','kā fēi guǎn'],['喝','hē'],['咖啡','kā fēi'],['，',''],['聊','liáo'],['到','dào'],['晚上','wǎn shang'],['。',''],['你','nǐ'],['呢','ne'],['？','']],
];
const CLOSING=/^[。，、；：？！）》」』…]/;
const tid=(l,i)=>`id_${l}_${i}`;
const prefs=zh=>({version:2,common:{theme:'sepia',ttsRate:'normal'},languages:{Chinese:{fontSize:1.6,pinyinSize:0.75,lineGap:15,fontFamily:'sans',pronDisplay:'all',autoSpeakOnClick:false,showToneColors:false,focusMode:false,wordStateHl:false,showPatterns:false,autoPace:false,...zh}}});

async function open({width,zh={}}) {
 const f=await fixture({width});
 await f.context.addInitScript(value=>{if(!sessionStorage.getItem('zh-grid-seeded')){localStorage.setItem('viewer_preferences_v2',value);sessionStorage.setItem('zh-grid-seeded','1');}},JSON.stringify(prefs(zh)));
 const sequence=[],dictionary={};
 LINES.forEach((row,l)=>{[...row,['\n','']].forEach(([text,furigana],i)=>{sequence.push(tid(l,i));dictionary[tid(l,i)]={text,base_form:text,furigana,meaning:text==='\n'?'':'뜻',pos:text==='\n'?'개행':/^[\p{P}]+$/u.test(text)?'기호':'명사'};});});
 f.rows.push({id:94301,user_id:owner,title:'중국어 격자 검수',raw_text:LINES.map(r=>r.map(w=>w[0]).join('')).join('\n'),source_type:'text',created_at:new Date().toISOString(),processed_json:{status:'completed',metadata:{language:'Chinese'},sequence,dictionary}});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.page.goto('/viewer/94301',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator(`[data-source-token="${tid(2,34)}"]`).waitFor();
 await f.page.evaluate(()=>document.fonts.ready);
 await f.page.waitForTimeout(150);
 return f;
}

/** Every glyph box in reading order: hanzi cells (ruby), punctuation cells and half-width runs, with their row. */
const glyphs=(f,root='.reader-area')=>f.page.locator(root).evaluate(area=>{
 const out=[];
 for(const t of area.querySelectorAll('.word-token')){
  const s=t.querySelector('.surface');if(!s)continue;
  const units=s.querySelectorAll('ruby[data-pinyin],.zh-cell,.zh-run');
  const list=units.length?[...units]:[s];// before the grid: plain punctuation/digits are the whole surface
  for(const u of list){
   const b=u.getBoundingClientRect(),text=(u.matches('ruby')?u.firstChild.textContent:u.textContent).trim();
   out.push({text,left:b.left,right:b.right,width:b.width,top:Math.round(s.getBoundingClientRect().top),run:u.classList.contains('zh-run')||!u.matches('ruby,.zh-cell')&&/^[\x21-\x7e]+$/.test(text),token:t.dataset.text,hold:t.style.getPropertyValue('--zh-hold')});
  }
 }
 const area_=area.getBoundingClientRect(),cs=getComputedStyle(area);
 // 쪽 넘김 보기(READER-PAGED-001)는 본문을 단(쪽)으로 가로로 늘어놓는다 — 쪽마다 왼쪽 끝에서 격자가 다시 시작하므로
 // 글자의 쪽 번호와 쪽 간격(단 폭 + 단 간격, usePagedReader.measure와 같은 식)을 함께 돌려준다. 스크롤 보기는 한 쪽.
 const pages=area.closest('[data-reader-pages="paged"]');
 let step=0,pageLeft=0;
 if(pages){const ps=getComputedStyle(pages),pr=pages.getBoundingClientRect();pageLeft=pr.left+parseFloat(ps.paddingLeft);step=(pages.clientWidth-parseFloat(ps.paddingLeft)-parseFloat(ps.paddingRight))+(parseFloat(ps.columnGap)||0);}
 for(const g of out){g.page=step?Math.floor((g.left-pageLeft+1)/step):0;g.x=g.left-g.page*step;}
 return {glyphs:out,step,contentLeft:area_.left+parseFloat(cs.paddingLeft),contentRight:area_.right-parseFloat(cs.paddingRight)};
});
const rowsOf=list=>{const m=new Map();for(const g of list){const k=`${g.page??0}:${g.top}`;if(!m.has(k))m.set(k,[]);m.get(k).push(g);}return [...m.values()];};

function checkGrid(data,label) {
 const bad=[],cells=data.glyphs.filter(g=>!g.run);
 const cell=cells[0].width;
 for(const g of cells)if(Math.abs(g.width-cell)>.5)bad.push(`${label}: ${g.text} is ${g.width.toFixed(1)}px wide, cell ${cell.toFixed(1)}px`);
 // Pitch = the step between two hanzi of one word (体育场).
 const word=cells.filter(g=>g.token==='体育场');
 const pitch=word[1].left-word[0].left;
 // 쪽 안 좌표(g.x)로 잰다 — 쪽 넘김 보기에서 두 번째 쪽부터는 쪽 간격만큼 오른쪽에 놓이고, 격자는 쪽마다 같은 자리에서 시작한다.
 const x0=Math.min(...data.glyphs.map(g=>g.x??g.left));
 for(const g of data.glyphs){
  const off=(((g.x??g.left)-x0)%pitch+pitch)%pitch;
  if(Math.min(off,pitch-off)>1)bad.push(`${label}: ${g.text} (${g.token}) at x ${g.left.toFixed(1)} is ${off.toFixed(1)}px off the ${pitch.toFixed(1)}px column grid`);
  if(g.run){const k=Math.round((g.width+pitch-cell)/pitch);if(Math.abs(k*pitch-(pitch-cell)-g.width)>1)bad.push(`${label}: half-width run ${g.text} is ${g.width.toFixed(1)}px, not a whole number of cells`);}
 }
 const rows=rowsOf(data.glyphs);
 for(const row of rows){const first=row[0];if(CLOSING.test(first.text))bad.push(`${label}: a line starts with ${first.text}`);}
 return {bad:[...new Set(bad)],pitch,cell,rows:rows.length};
}

// Full-page clip of the body at scroll 0, so the sticky header does not cover the first lines.
const shot=async(f,name)=>{if(!shots)return;await f.page.evaluate(()=>scrollTo(0,0));const b=await f.page.locator('.reader-area').boundingBox();await f.page.screenshot({path:`${shots}/${phase}-${name}.png`,fullPage:true,clip:{x:b.x,y:b.y,width:b.width,height:b.height}});};

for(const width of [390,1280])for(const pron of ['all','none'])test(`ZH-GRID-001 — ${width}px · pinyin ${pron==='all'?'on':'off'}: every hanzi and punctuation glyph sits on one column grid, no line starts with closing punctuation`,{timeout:180000},async()=>{
 const f=await open({width,zh:{pronDisplay:pron}});
 try{
  await shot(f,`${width}-${pron==='all'?'pinyin':'plain'}`);
  const data=await glyphs(f);
  const r=checkGrid(data,`${width}px`);
  assert.ok(r.rows>=3,`fixture premise: the text wraps (${r.rows} rows)`);
  // Default Chinese gap is 0: the pitch is exactly one cell (pinyin cell when shown, 1em when hidden).
  assert.ok(Math.abs(r.pitch-r.cell)<=.5,`no extra gap between cells: pitch ${r.pitch} vs cell ${r.cell}`);
  const em=await f.page.locator('.reader-area').evaluate(a=>parseFloat(getComputedStyle(a).fontSize));
  if(pron==='none')assert.ok(Math.abs(r.cell-em)<=.5,`pinyin off: the cell is 1em (${r.cell} vs ${em})`);
  else assert.ok(r.cell>em,`pinyin on: the cell is the pinyin cell (${r.cell} > ${em})`);
  assert.deepEqual(r.bad,[],r.bad.join('\n'));
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('ZH-GRID-001 — 「글자 간격」 spaces every cell equally, so the grid survives a custom gap (390px · 0.5rem · pinyin on)',{timeout:180000},async()=>{
 const f=await open({width:390,zh:{charGap:0.5}});
 try{
  const data=await glyphs(f),r=checkGrid(data,'gap 0.5rem');
  const gap=await f.page.locator('.reader-area').evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)*.5);
  assert.ok(Math.abs(r.pitch-r.cell-gap)<=.5,`pitch = cell + gap: ${r.pitch} vs ${r.cell}+${gap}`);
  // Between words the step is the same pitch — the gap is per cell, not per token.
  const steps=new Set();
  for(const row of rowsOf(data.glyphs))for(let i=1;i<row.length;i++)if(!row[i-1].run)steps.add(Math.round(row[i].left-row[i-1].left));
  const odd=[];for(const row of rowsOf(data.glyphs))for(let i=1;i<row.length;i++)if(!row[i-1].run&&Math.round(row[i].left-row[i-1].left)!==Math.round(r.pitch))odd.push(`${row[i-1].text}(${row[i-1].token})→${row[i].text}(${row[i].token}) ${(row[i].left-row[i-1].left).toFixed(1)}`);
  assert.deepEqual([...steps],[Math.round(r.pitch)],`one step between all neighbouring cells: ${[...steps]} — ${odd.join(' · ')}`);
  assert.deepEqual(r.bad,[],r.bad.join('\n'));
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('ZH-GRID-001 — 禁则 holds at every wrap width, and actually engages (a word moves down with its comma)',{timeout:240000},async()=>{
 const f=await open({width:390});
 try{
  let engaged=0;const bad=[];
  for(let width=340;width<=460;width+=6){
   await f.page.setViewportSize({width,height:1000});await f.page.waitForTimeout(60);
   const data=await glyphs(f),r=checkGrid(data,`${width}px`);bad.push(...r.bad);
   const rows=rowsOf(data.glyphs);
   for(let i=1;i<rows.length;i++){
    const head=rows[i][0];if((rows[i-1][0].page??0)!==(head.page??0))continue;// 쪽이 바뀌는 자리는 줄바꿈이 아니다
    const prevEnd=Math.max(...rows[i-1].map(g=>g.right-(g.page??0)*data.step));
    // The head word is followed by closing punctuation and would itself have fitted on the previous row.
    const headWidth=Math.max(...rows[i].filter(g=>g.token===head.token).map(g=>g.right))-head.left;
    if(head.hold&&prevEnd+(r.pitch-r.cell)+headWidth<=data.contentRight+.5)engaged++;
   }
  }
  assert.deepEqual([...new Set(bad)],[],bad.join('\n'));
  assert.ok(engaged>=1,'the sweep must meet at least one wrap where the rule moved a word down with its punctuation');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('ZH-GRID-001 — Aa preview follows the body grid; word selection frame stays on the word (390px)',{timeout:180000},async()=>{
 const f=await open({width:390});
 try{
  const body=await glyphs(f);
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  await f.page.locator('.reader-settings__preview .zh-cell').first().waitFor();
  const prev=await glyphs(f,'.reader-settings__preview');
  const cells=prev.glyphs.filter(g=>!g.run),bodyCell=body.glyphs.find(g=>!g.run).width;
  for(const g of cells)assert.ok(Math.abs(g.width-bodyCell)<=.5,`preview ${g.text}: ${g.width} vs body cell ${bodyCell}`);
  const row=rowsOf(prev.glyphs)[0];
  for(let i=1;i<row.length;i++)assert.ok(Math.abs(row[i].left-row[i-1].left-bodyCell)<=1,`preview step ${row[i-1].text}→${row[i].text}: ${(row[i].left-row[i-1].left).toFixed(1)}px`);
  await f.page.keyboard.press('Escape');
  // A word followed by a comma carries the 禁则 hold margin; its selection frame must still be the word's box.
  const t=f.page.locator(`.reader-area [data-source-token="${tid(0,7)}"]`);
  // 단어 조작은 안쪽 .surface가 받는다(#1323 이식, #1413) — 바깥 토큰은 초점을 받지 않는다.
  await t.locator('.surface[role="button"]').focus();await f.page.keyboard.press('Enter');
  await f.page.waitForFunction(id=>document.querySelector(`.reader-area [data-source-token="${id}"]`)?.getAttribute('data-selected')==='true',tid(0,7));
  const frame=await t.evaluate(e=>{const s=e.querySelector('.surface').getBoundingClientRect(),b=getComputedStyle(e,'::before');return {surface:s.width,frame:parseFloat(b.width),hold:e.style.getPropertyValue('--zh-hold')};});
  assert.equal(frame.hold,'1','fixture premise: 壮观 is held with its comma');
  assert.ok(Math.abs(frame.frame-frame.surface)<=1,`selection frame ${frame.frame}px vs word ${frame.surface}px`);
  await shot(f,'390-selected');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
