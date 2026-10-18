// Actual viewer with disposable fixture data (JA-KINSOKU — mockup viewer-lang-4 §4, owner 「권장대로」 2026-10-17 KST).
// No live identity, provider or DB writes. Japanese closing marks (。、」！？ …) never start a line: each token is a flex
// item, so the browser's own line-break rules never see the boundary between a word and its 。 — the same 禁则 marks as
// Chinese (ZH-GRID-001, zhKinsokuMarks) hold the word together with its marks. Box geometry only.
// JA_KINSOKU_MEASURE=1 also prints line-head marks and page counts with the rule switched off (= the layout before).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
const measure=process.env.JA_KINSOKU_MEASURE==='1';
// Mockup sentence first (友達が来ます。彼は来ない。…), then quotes, commas and stacked closing marks.
const PARAGRAPH=[
 [['友達','ともだち'],['が',''],['来','き'],['ます',''],['。',''],['彼','かれ'],['は',''],['来','こ'],['ない',''],['。',''],['パン',''],['を',''],['食べ','たべ'],['た',''],['。',''],['映画','えいが'],['を',''],['見','み'],['に',''],['行き','いき'],['ましょう',''],['。','']],
 [['「',''],['今日','きょう'],['は',''],['いい',''],['天気','てんき'],['です',''],['ね',''],['」',''],['と',''],['先生','せんせい'],['が',''],['言い','いい'],['ました',''],['。',''],['私','わたし'],['も',''],['そう',''],['思い','おもい'],['ます',''],['、',''],['本当','ほんとう'],['に',''],['。','']],
 [['昨日','きのう'],['、',''],['駅','えき'],['の',''],['近く','ちかく'],['の',''],['本屋','ほんや'],['で',''],['、',''],['日本語','にほんご'],['の',''],['雑誌','ざっし'],['を',''],['二','に'],['冊','さつ'],['買い','かい'],['ました',''],['。',''],['それ',''],['から',''],['、',''],['喫茶店','きっさてん'],['で',''],['コーヒー',''],['を',''],['飲み','のみ'],['ながら',''],['、',''],['友達','ともだち'],['と',''],['話し','はなし'],['ました',''],['。',''],['楽しかった','たのしかった'],['です',''],['！',''],['また',''],['行き','いき'],['たい',''],['です',''],['ね',''],['？','']],
];
const LINES=Array.from({length:8},()=>PARAGRAPH).flat();
const CLOSING=/^[。、，．！？）」』…・ー]/;
const tid=(l,i)=>`id_${l}_${i}`;
const LAST=tid(LINES.length-1,LINES.at(-1).length-1);
const prefs=(ja,view)=>({version:2,common:{theme:'sepia',ttsRate:'normal',readerView:view},languages:{Japanese:{fontSize:1.4,pinyinSize:0.6,lineGap:12,fontFamily:'sans',pronDisplay:'all',autoSpeakOnClick:false,focusMode:false,wordStateHl:false,showPatterns:false,autoPace:false,...ja}}});
// The rule switched off = the layout before JA-KINSOKU (Japanese tokens had no margins of their own).
const OFF='.viewer-layout[data-language="Japanese"] :is(.reader-area,.reader-settings__preview) .word-token{margin-left:0!important;margin-right:0!important}';

async function open({width,ja={},view='scroll',off=false,guest=false}) {
 const f=await fixture({width,guest});
 await f.context.addInitScript(([value,css])=>{
  if(!sessionStorage.getItem('ja-kinsoku-seeded')){localStorage.setItem('viewer_preferences_v2',value);sessionStorage.setItem('ja-kinsoku-seeded','1');}
  if(css)document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.append(s);});
 },[JSON.stringify(prefs(ja,view)),off?OFF:'']);
 const sequence=[],dictionary={};
 LINES.forEach((row,l)=>{[...row,['\n','']].forEach(([text,furigana],i)=>{sequence.push(tid(l,i));dictionary[tid(l,i)]={text,base_form:text,furigana,meaning:text==='\n'?'':'뜻',pos:text==='\n'?'개행':/^[\p{P}]+$/u.test(text)?'기호':'명사'};});});
 f.rows.push({id:94401,user_id:owner,owner_id:owner,visibility:'public',title:'일본어 줄머리 금칙 검수',raw_text:LINES.map(r=>r.map(w=>w[0]).join('')).join('\n'),source_type:'text',created_at:new Date().toISOString(),processed_json:{status:'completed',metadata:{language:'Japanese'},sequence,dictionary}});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.page.goto('/viewer/94401',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator(`[data-source-token="${tid(0,4)}"]`).waitFor();
 await f.page.evaluate(()=>document.fonts.ready);
 await f.page.waitForTimeout(200);
 return f;
}

/** Every token surface in reading order with its row (page:bottom — furigana raises a surface top, never its bottom) — paged view lays pages out side by side as columns. */
const tokens=(f,root='.reader-area')=>f.page.locator(root).evaluate(area=>{
 const out=[];
 const pages=area.closest('[data-reader-pages="paged"]');
 let step=0,pageLeft=0;
 if(pages){const ps=getComputedStyle(pages),pr=pages.getBoundingClientRect();pageLeft=pr.left+parseFloat(ps.paddingLeft);step=(pages.clientWidth-parseFloat(ps.paddingLeft)-parseFloat(ps.paddingRight))+(parseFloat(ps.columnGap)||0);}
 for(const t of area.querySelectorAll('.word-token')){
  const s=t.querySelector('.surface');if(!s)continue;
  const b=s.getBoundingClientRect(),text=(t.dataset.text??s.textContent).trim();
  if(!text||!b.width)continue;
  const page=step?Math.floor((b.left-pageLeft+1)/step):0;
  out.push({text,left:b.left,right:b.right,top:Math.round(b.bottom),page,id:t.dataset.sourceToken,hold:t.style.getPropertyValue('--zh-hold'),pull:t.style.getPropertyValue('--zh-pull')});
 }
 const r=area.getBoundingClientRect(),cs=getComputedStyle(area);
 return {tokens:out,step,contentRight:r.right-parseFloat(cs.paddingRight)};
});
const rowsOf=list=>{const m=new Map();for(const g of list){const k=`${g.page}:${g.top}`;if(!m.has(k))m.set(k,[]);m.get(k).push(g);}return [...m.values()];};
const heads=data=>rowsOf(data.tokens).map(row=>row[0]).filter(g=>CLOSING.test(g.text));
const pageCount=async f=>{
 const text=await f.page.locator('.reader-pagebar__pos').textContent();
 const m=text?.match(/^(\d+) \/ (\d+)쪽/);assert.ok(m,`page label: ${text}`);return Number(m[2]);
};

for(const width of [390,1440])for(const pron of ['all','none'])test(`JA-KINSOKU — ${width}px · furigana ${pron==='all'?'on':'off'}: no line starts with 。、」！？, positions unchanged by the marks`,{timeout:180000},async()=>{
 const f=await open({width,ja:{pronDisplay:pron}});
 try{
  const data=await tokens(f),rows=rowsOf(data.tokens);
  assert.ok(rows.length>=LINES.length,`fixture premise: the text wraps (${rows.length} rows)`);
  assert.deepEqual(heads(data).map(g=>`${g.text} (${g.id})`),[],'a line starts with closing punctuation');
  // The marks are a margin pair that cancels: within a row, a held word and its mark keep the normal flex gap.
  const gap=await f.page.locator('.reader-area').evaluate(a=>parseFloat(getComputedStyle(a).columnGap)||0);
  for(const row of rows)for(let i=1;i<row.length;i++)if(row[i].pull)assert.ok(Math.abs(row[i].left-row[i-1].right-gap)<=1.5,`${row[i-1].text}→${row[i].text}: ${(row[i].left-row[i-1].right).toFixed(1)}px vs gap ${gap}`);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('JA-KINSOKU — rule holds at every wrap width and actually engages (a word moves down with its 。); guest view too',{timeout:300000},async()=>{
 for(const guest of [false,true]){
  const f=await open({width:390,guest});
  try{
   let engaged=0;const bad=[];
   for(let width=320;width<=460;width+=4){
    await f.page.setViewportSize({width,height:1000});await f.page.waitForTimeout(50);
    const data=await tokens(f),rows=rowsOf(data.tokens);
    bad.push(...heads(data).map(g=>`${width}px${guest?' guest':''}: ${g.text} (${g.id})`));
    for(let i=1;i<rows.length;i++){
     const head=rows[i][0];if(!head.hold||rows[i-1][0].page!==head.page)continue;
     // The held word would itself have fitted on the previous row — the rule moved it down with its mark.
     const prevEnd=Math.max(...rows[i-1].map(g=>g.right));
     if(prevEnd+(head.right-head.left)<=data.contentRight+.5)engaged++;
    }
   }
   assert.deepEqual([...new Set(bad)],[],bad.join('\n'));
   assert.ok(engaged>=1,'the sweep must meet at least one wrap where the rule moved a word down with its punctuation');
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 }
});

test('JA-KINSOKU — Aa preview carries the same marks; selection frame stays on the word (390px)',{timeout:180000},async()=>{
 const f=await open({width:390});
 try{
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  const preview=f.page.locator('.reader-settings__preview');
  await preview.locator('.word-token').first().waitFor();
  const marks=await preview.evaluate(p=>[...p.querySelectorAll('.word-token')].map(t=>[t.textContent,t.style.getPropertyValue('--zh-hold'),t.style.getPropertyValue('--zh-pull')]));
  const at=marks.findIndex(([text])=>/^[。、！？」]/.test(text.trim()));
  assert.ok(at>0,`fixture premise: the preview has a closing mark (${JSON.stringify(marks)})`);
  assert.equal(marks[at-1][1],'1',`preview: the word before ${marks[at][0]} is held`);
  assert.equal(marks[at][2],'1',`preview: ${marks[at][0]} gives the hold back`);
  await f.page.keyboard.press('Escape');
  const t=f.page.locator(`.reader-area [data-source-token="${tid(0,3)}"]`);// ます before 。
  await t.locator('.surface[role="button"]').focus();await f.page.keyboard.press('Enter');
  await f.page.waitForFunction(id=>document.querySelector(`.reader-area [data-source-token="${id}"]`)?.getAttribute('data-selected')==='true',tid(0,3));
  const frame=await t.evaluate(e=>{const s=e.querySelector('.surface').getBoundingClientRect(),b=getComputedStyle(e,'::before');return {surface:s.width,frame:parseFloat(b.width),hold:e.style.getPropertyValue('--zh-hold')};});
  assert.equal(frame.hold,'1','fixture premise: ます is held with its 。');
  if(Number.isFinite(frame.frame))assert.ok(Math.abs(frame.frame-frame.surface)<=1,`selection frame ${frame.frame}px vs word ${frame.surface}px`);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('JA-KINSOKU — paged view: no page line starts with a closing mark; page count stays within one page of the old layout',{timeout:300000},async()=>{
 const report=[];
 for(const width of [390,1440]){
  const before=await open({width,view:'paged',off:true});
  let b;try{await before.page.waitForSelector('.reader-pagebar[data-ready]');b={pages:await pageCount(before),heads:heads(await tokens(before)).length};}finally{await before.context.close();}
  const after=await open({width,view:'paged'});
  try{
   await after.page.waitForSelector('.reader-pagebar[data-ready]');
   const a={pages:await pageCount(after),heads:heads(await tokens(after)).length};
   report.push(`${width}px paged: line-head marks ${b.heads} → ${a.heads}, pages ${b.pages} → ${a.pages}`);
   assert.equal(a.heads,0,`${width}px paged: line-head marks after`);
   assert.ok(Math.abs(a.pages-b.pages)<=1,`${width}px: pages ${b.pages} → ${a.pages}`);
   assert.deepEqual(after.errors,[]);
  }finally{await after.context.close();}
 }
 if(measure){
  for(const width of [390,1440]){
   const before=await open({width,off:true});let n;try{n=heads(await tokens(before)).length;}finally{await before.context.close();}
   report.push(`${width}px scroll: line-head marks with the rule off ${n}`);
  }
  // Paged sweep (narrow phones): line-head marks and page counts, rule off → on, at each width.
  const sweep={};
  for(const off of [true,false]){
   const f=await open({width:390,view:'paged',off});
   try{
    for(let width=320;width<=460;width+=10){
     await f.page.setViewportSize({width,height:1000});await f.page.waitForTimeout(250);
     await f.page.waitForSelector('.reader-pagebar[data-ready]');
     (sweep[width]??=[]).push({heads:heads(await tokens(f)).length,pages:await pageCount(f)});
    }
   }finally{await f.context.close();}
  }
  for(const [w,[b,a]] of Object.entries(sweep))report.push(`${w}px paged sweep: line-head marks ${b.heads} → ${a.heads}, pages ${b.pages} → ${a.pages}`);
  console.log(`JA-KINSOKU measure\n${report.join('\n')}`);
 }
});
