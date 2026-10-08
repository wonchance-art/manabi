// Actual viewer with disposable fixture data (VIEWER-R0 display bugs 1·2·7·8). No live identity, provider or DB writes.
// Computed styles and box geometry from the production build; the runner has no Noto CJK, so geometry is box-based.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/material-editing-backend.mjs';

const owner='00000000-0000-4000-8000-000000000172';
// Pattern lines from the handoff: 比 (H2-98) and 尽量 (H4-344) are detected by the bundled pattern index.
const LINES=[
 [['眼前','yǎn qián','눈앞'],['的','de','관형'],['体育场','tǐ yù chǎng','경기장'],['比','bǐ','~보다'],['照片','zhào piàn','사진'],['上','shàng','위'],['更','gèng','더'],['壮观','zhuàng guān','장관이다'],['。','','마침표']],
 [['她','tā','그녀'],['尽量','jǐn liàng','가능한 한'],['别','bié','하지 마라'],['熬夜','áo yè','밤새다'],['，','','쉼표'],['要','yào','해야 한다'],['爱惜','ài xī','아끼다'],['身体','shēn tǐ','몸'],['。','','마침표']],
];
const tid=(l,i)=>`id_${l}_${i}`;
// Every reading option on (handoff 31–37). Auto-speak is off only to keep the run silent; it has no display effect.
const prefs=(common={},zh={})=>({version:2,common:{theme:'sepia',ttsRate:'normal',...common},languages:{Chinese:{fontSize:1.6,pinyinSize:0.75,lineGap:15,charGap:0.25,fontFamily:'sans',pronDisplay:'all',pronReveal:false,autoSpeakOnClick:false,showHanjaKo:true,showToneColors:true,focusMode:true,wordStateHl:true,showPatterns:true,patternFilter:'all',autoPace:true,paceCpm:null,paceStep:0,...zh}}});

async function open({width=1280,common,zh}={}) {
 const f=await fixture({width});
 await f.context.addInitScript(value=>{if(!sessionStorage.getItem('r0-seeded')){localStorage.setItem('viewer_preferences_v2',value);sessionStorage.setItem('r0-seeded','1');}},JSON.stringify(prefs(common,zh)));
 const sequence=[],dictionary={};
 LINES.forEach((row,l)=>{[...row,['\n','','']].forEach(([text,furigana,meaning],i)=>{sequence.push(tid(l,i));dictionary[tid(l,i)]={text,base_form:text,furigana,meaning,pos:text==='\n'?'개행':/[。，]/.test(text)?'기호':'명사'};});});
 f.rows.push({id:94201,user_id:owner,title:'R0 표시 검수',raw_text:LINES.map(r=>r.map(w=>w[0]).join('')).join('\n'),source_type:'text',created_at:new Date().toISOString(),processed_json:{status:'completed',metadata:{language:'Chinese'},sequence,dictionary}});
 await f.context.route('**/api/dict?**',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await f.page.goto('/viewer/94201',{waitUntil:'domcontentloaded',timeout:120000});
 await f.page.locator(`[data-source-token="${tid(0,0)}"]`).waitFor();
 return f;
}
const token=(f,l,i)=>f.page.locator(`.reader-area [data-source-token="${tid(l,i)}"]`);
/** Tap with the keyboard until the word card opens (focus mode: the first tap only moves the sentence pick). */
async function selectWord(f,l,i) {
 for(let n=0;n<2&&await token(f,l,i).getAttribute('data-selected')!=='true';n++){await token(f,l,i).focus();await f.page.keyboard.press('Enter');await f.page.waitForTimeout(200);}
 assert.equal(await token(f,l,i).getAttribute('data-selected'),'true',`${LINES[l][i][0]} did not open its word card`);
 await f.page.locator('.word-fit .rt-an').first().waitFor();
}

/** The grammar underline wherever it is drawn: a .pattern-mark element or the old .surface::after. Only a
 *  candidate painted in --pattern-line counts — the selection seam shares ::after and is not an underline. */
const patternLine=(f,l,i)=>token(f,l,i).evaluate(t=>{
 const s=t.querySelector('.surface'),probe=document.createElement('i');
 probe.style.cssText='position:absolute;width:0;height:0;background:var(--pattern-line)';s.append(probe);
 const want=getComputedStyle(probe).backgroundColor;probe.remove();
 const cands=[],m=s.querySelector('.pattern-mark');
 if(m){const r=m.getBoundingClientRect();cands.push({w:r.width,h:r.height,bg:getComputedStyle(m).backgroundColor});}
 const a=getComputedStyle(s,'::after');if(a.content!=='none')cands.push({w:parseFloat(a.width),h:parseFloat(a.height),bg:a.backgroundColor});
 return {want,width:s.getBoundingClientRect().width,classes:t.className,line:cands.find(c=>c.bg===want&&c.h>0)||null,cands};
});
function assertLine(m,label) {
 assert.notEqual(m.want,'rgba(0, 0, 0, 0)',`${label}: --pattern-line did not resolve`);
 assert.ok(m.line,`${label}: no grammar underline (${m.classes}) — candidates ${JSON.stringify(m.cands)}`);
 assert.ok(m.line.h>=1,`${label}: underline ${m.line.h}px < 1px`);
 assert.ok(m.line.w>=m.width*.8,`${label}: underline ${m.line.w}px < 80% of ${m.width}px`);
}

for(const width of [1280,390])test(`R0 bug 1 — grammar underline survives sentence pick, word selection, drag and auto-pace (${width}px)`,async()=>{
 const f=await open({width});
 try{
  await f.page.locator('.reader-area .word-token--pattern').nth(1).waitFor();
  const patterned=await f.page.locator('.reader-area .word-token--pattern').evaluateAll(ts=>ts.map(t=>t.dataset.text));
  assert.deepEqual(patterned,['比','尽量'],'fixture premise: the index marks 比 and 尽量');
  assertLine(await patternLine(f,0,3),'before picking 比');
  // Sentence pick (focus mode: the bar only moves the pick), then a second tap opens the word card.
  await token(f,0,0).locator('.line-pick').click({force:true});
  await f.page.waitForFunction(()=>document.querySelector('[data-source-token="id_0_3"]').classList.contains('word-token--picked'));
  assertLine(await patternLine(f,0,3),'sentence pick 比');
  await selectWord(f,0,3);
  assertLine(await patternLine(f,0,3),'word selection 比');
  // Auto-pace runs on the picked sentence.
  await f.page.keyboard.press('Escape');await f.page.waitForTimeout(150);
  // AD-R2 PR ①(VIEWER-V2-ROUNDS-001 §5, 설계 Q3 A): 자동 진행은 툴바가 아니라 바닥 한 자리 — 지정 문장이 있으면 문장 이동 막대 안
  // ▶이고, 시트가 열려 있으면 없다. 지정이 Esc 뒤에도 남아 있으면 ¦를 다시 누르지 않는다(지정 문장 ¦ 재탭 = 번역 시트).
  if(!await token(f,0,3).evaluate(t=>t.classList.contains('word-token--picked')))await token(f,0,0).locator('.line-pick').click({force:true});
  await f.page.getByRole('toolbar',{name:'문장 이동',exact:true}).getByRole('button',{name:'자동 진행 시작',exact:true}).click();
  await f.page.locator('.reader-area.reader-area--pacing').waitFor();
  assertLine(await patternLine(f,0,3),'auto-pace 比');
  await f.page.getByRole('button',{name:/자동 진행.*중지/}).click();
  await f.page.keyboard.press('Escape');await f.page.waitForTimeout(150);
  // Drag selection across the second sentence (same pointer gesture as the reader).
  const first=token(f,1,0),last=token(f,1,8);
  await first.evaluate(e=>scrollBy(0,e.getBoundingClientRect().top-200));
  const a=await first.boundingBox(),b=await last.boundingBox();
  await f.page.mouse.move(a.x+a.width/2,a.y+a.height*.7);await f.page.mouse.down();
  await f.page.mouse.move(b.x+b.width/2,b.y+b.height*.7,{steps:20});await f.page.waitForTimeout(250);
  assert.ok((await token(f,1,1).getAttribute('class')).includes('word-token--picked'),'drag must pick 尽量');
  assertLine(await patternLine(f,1,1),'during drag 尽量');
  await f.page.mouse.up();await f.page.waitForTimeout(250);
  assertLine(await patternLine(f,1,1),'after drag 尽量');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const theme of ['sepia','dark'])test(`R0 bug 2 — headword pinyin carries the same tone colors as the body (${theme}), and drops them when tone colors are off`,async()=>{
 const f=await open({common:{theme},zh:{focusMode:false}});
 try{
  const colors=sel=>f.page.locator(sel).evaluateAll(es=>es.map(e=>getComputedStyle(e).color));
  const body=await colors(`.reader-area [data-source-token="${tid(0,2)}"] .rt-an`);
  assert.equal(new Set(body).size,2,`body 体育场 (tǐ yù chǎng: 3·4·3) must show two tone colors: ${body}`);
  await selectWord(f,0,2);
  const card=await colors('.word-fit .rt-an');
  assert.deepEqual(card,body,'headword syllables must match the body syllables');
  // Tone colors off: the headword returns to one default color.
  await f.page.keyboard.press('Escape');
  await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
  await f.page.getByRole('tab',{name:'학습 표시',exact:true}).click();
  await f.page.getByRole('checkbox',{name:/^성조 색상/}).uncheck();
  await f.page.keyboard.press('Escape');
  await selectWord(f,0,2);
  const plain=await colors('.word-fit .rt-an');
  assert.equal(new Set(plain).size,1,`tone colors off must leave one default color: ${plain}`);
  assert.ok(!card.includes(plain[0]),'the default color is not one of the tone colors');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

/** Glyph and pinyin text rectangles per preview row, against the preview box. */
const previewRows=f=>f.page.locator('.reader-settings__preview').evaluate(box=>{
 const b=box.getBoundingClientRect(),cs=getComputedStyle(box);
 const rect=node=>{const r=document.createRange();r.selectNodeContents(node);return r.getBoundingClientRect();};
 const rows=new Map();
 for(const t of box.querySelectorAll('.word-token')){
  const s=t.querySelector('.surface'),key=Math.round(s.getBoundingClientRect().top);
  const row=rows.get(key)||{glyphTop:Infinity,glyphBottom:-Infinity,rtTop:Infinity,rtBottom:-Infinity};
  const walker=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){if(!n.textContent.trim())continue;const r=rect(n);
   if(n.parentElement.closest('.rt-an')){row.rtTop=Math.min(row.rtTop,r.top);row.rtBottom=Math.max(row.rtBottom,r.bottom);}
   else{row.glyphTop=Math.min(row.glyphTop,r.top);row.glyphBottom=Math.max(row.glyphBottom,r.bottom);}}
  rows.set(key,row);
 }
 // Fully opaque area ends where the fade starts (mask stop calc(100% - Npx)); without a mask, at the box bottom.
 const mask=cs.maskImage&&cs.maskImage!=='none'?cs.maskImage:(cs.webkitMaskImage||'none'),stop=mask.match(/calc\(100% - ([\d.]+)px\)/);
 return {top:b.top,bottom:b.bottom,opaqueBottom:stop?b.bottom-parseFloat(stop[1]):b.bottom,mask,rows:[...rows.values()]};
});

for(const width of [1280,390])test(`R0 bug 7 — the Aa preview shows only whole rows (glyphs and pinyin), up to the largest body size (${width}px)`,async()=>{
 const bad=[];
 for(const [fontSize,pinyinSize] of [[0.8,1],[1.6,0.75],[1.6,1],[2,1],[3,0.75],[3,1]]){
  const f=await open({width,zh:{fontSize,pinyinSize}});
  try{
   await f.page.getByRole('button',{name:'Aa 읽기 설정',exact:true}).click();
   await f.page.locator('.reader-settings__preview .rt-an').first().waitFor();
   await f.page.evaluate(()=>document.fonts.ready);
   const p=await previewRows(f),label=`${fontSize}rem · pinyin ${pinyinSize}rem`;
   const visibleBottom=p.opaqueBottom;
   const visible=p.rows.filter(r=>r.glyphBottom<=p.bottom);
   if(!visible.length)bad.push(`${label}: no visible row`);
   for(const r of p.rows){
    if(r.glyphBottom<=p.bottom){
     if(!(r.glyphTop>=p.top-.5&&r.glyphBottom<=visibleBottom+.5))bad.push(`${label}: visible row glyphs ${r.glyphTop.toFixed(1)}–${r.glyphBottom.toFixed(1)} leave ${p.top.toFixed(1)}–${visibleBottom.toFixed(1)}`);
     if(r.rtTop<Infinity&&!(r.rtTop>=p.top-.5&&r.rtBottom<=visibleBottom+.5))bad.push(`${label}: visible row pinyin ${r.rtTop.toFixed(1)}–${r.rtBottom.toFixed(1)} is cut by the box ${p.top.toFixed(1)}–${visibleBottom.toFixed(1)}`);
    } else if(Math.min(r.glyphTop,r.rtTop)<visibleBottom-.5)bad.push(`${label}: a row is cut (glyphs ${r.glyphTop.toFixed(1)}–${r.glyphBottom.toFixed(1)}, pinyin from ${r.rtTop.toFixed(1)}, box ${p.top.toFixed(1)}–${visibleBottom.toFixed(1)} before the fade)`);
   }
   if(p.rows.length>visible.length&&p.mask==='none')bad.push(`${label}: overflow must fade out`);
   assert.deepEqual(f.errors,[]);
  }finally{await f.context.close();}
 }
 assert.deepEqual(bad,[],`preview rows:\n${bad.join('\n')}`);
});

const contrastJs=()=>{
 const rgb=paint=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=paint;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3);};
 const lum=cs=>cs.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 window.__contrast=(a,b)=>{const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 window.__rgb=paint=>rgb(paint).join(',');
};
for(const width of [1280,390])test(`R0 bug 8 — the site header follows the dark reading theme (${width}px); paper and white headers stay as they were`,async()=>{
 const f=await open({width,common:{theme:'dark'}});
 try{
  await f.page.evaluate(contrastJs);
  const read=await f.page.evaluate(()=>{
   const gnb=document.querySelector('.gnb'),bg=getComputedStyle(gnb).backgroundColor,paper=getComputedStyle(document.querySelector('.reader-area')).backgroundColor;
   const texts=[...gnb.querySelectorAll('.gnb__logo,[data-icon-action],summary')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden')
    .map(e=>{const cs=getComputedStyle(e),fill=cs.webkitTextFillColor;return {name:e.getAttribute('aria-label')||e.className,color:fill&&fill!=='rgba(0, 0, 0, 0)'?fill:cs.color};});
   return {bg,paper,ratio:window.__contrast(bg,paper),texts:texts.map(t=>({...t,ratio:window.__contrast(t.color,bg)}))};
  });
  assert.ok(read.ratio<=1.3,`header ${read.bg} vs reading paper ${read.paper}: ${read.ratio.toFixed(2)}:1 > 1.3:1`);
  assert.ok(read.texts.length>=3,`header controls must be measured: ${JSON.stringify(read.texts)}`);
  for(const t of read.texts)assert.ok(t.ratio>=4.5,`header ${t.name} ${t.color} on ${read.bg}: ${t.ratio.toFixed(2)}:1 < 4.5:1`);
  // The reading menu (dropdown) belongs to the same header.
  await f.page.locator('.reader-site-menu summary').click();
  const menu=await f.page.locator('.reader-site-menu nav').evaluate(nav=>{const bg=getComputedStyle(nav).backgroundColor;return {bg,links:[...nav.querySelectorAll('a')].map(a=>({text:a.textContent,ratio:window.__contrast(getComputedStyle(a).color,bg)})),vsHeader:window.__contrast(bg,getComputedStyle(document.querySelector('.gnb')).backgroundColor)};});
  assert.ok(menu.links.length>=3);
  for(const l of menu.links)assert.ok(l.ratio>=4.5,`menu ${l.text}: ${l.ratio.toFixed(2)}:1 < 4.5:1 on ${menu.bg}`);
  assert.ok(menu.vsHeader<=1.3,`menu ${menu.bg} must stay in the dark header family (${menu.vsHeader.toFixed(2)}:1)`);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 // Paper and white reading themes keep the shell header (#f6f4ee).
 for(const theme of ['sepia','light']){
  const g=await open({width,common:{theme}});
  try{
   await g.page.evaluate(contrastJs);
   assert.equal(await g.page.evaluate(()=>window.__rgb(getComputedStyle(document.querySelector('.gnb')).backgroundColor)),'246,244,238',`${theme}: header must stay on the shell paper`);
  }finally{await g.context.close();}
 }
});
