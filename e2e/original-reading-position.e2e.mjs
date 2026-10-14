import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/library-v4-backend.mjs';
const options={sourcePassages:true,originalPositions:true};
const shots=process.env.COMPOSER_SCREENSHOTS;
const longBody=Array.from({length:60},(_,i)=>`${String(i+1).padStart(2,'0')} 😀 Une page à retrouver. Reading a little each day gives these words a place in everyday life. We can begin again from the same sentence, even when the screen is smaller.`).join('\n\n');
async function create(f,{body='A quiet page to read.',files=['pdf','epub']}={}){
 await f.page.goto('/materials/add');await f.page.locator('#composer-title').fill('어디서든 이어지는 문장');await f.page.locator('#composer-body').fill(body);
 if(files.length)await f.page.locator('input[type=file]').setInputFiles(files.map(kind=>new URL(`./fixtures/composer/reading.${kind}`,import.meta.url).pathname));
 await f.page.getByRole('button',{name:body?'저장만':'저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();if(body)await f.page.locator('.original-writing').waitFor();
 await f.page.getByText('읽던 위치가 계정에 저장돼요.',{exact:true}).waitFor();return f.rows[0];
}
// 글만 있는 자료의 본문은 기본이 쪽 넘김(READER-PAGED-001)이다. 세로 스크롤 위치를 재는 검사는 스크롤 보기를 고른 사람으로 연다.
async function scrollView(f){await f.context.addInitScript(()=>{if(!localStorage.getItem('viewer_preferences_v2'))localStorage.setItem('viewer_preferences_v2',JSON.stringify({version:2,common:{readerView:'scroll'},languages:{}}));});}
async function rows(f){await f.shared.queueState.queue;return (await f.db.query('select * from original_reading_positions order by version desc')).rows;}
async function position(f,predicate){const end=Date.now()+15000;while(Date.now()<end){const data=await rows(f);if(predicate(data))return data;await new Promise(r=>setTimeout(r,100));}throw new Error(`Position condition not met: ${JSON.stringify(await rows(f))}`);}
async function focus(f){await f.page.evaluate(()=>window.dispatchEvent(new Event('focus')));}
async function pdfPage(f,n){await f.page.locator(`.pdfjs-page--current[data-page-number="${n}"] .textLayer span`).first().waitFor();}
async function noOverflow(f){assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(f.errors,[]);}

test('two independent devices restore PDF page and offer a later remote position without moving the reader',async()=>{
 const a=await fixture({...options,width:390});let b;
 try{
  const root=await create(a),original=JSON.stringify(root.processed_json);await pdfPage(a,1);await a.page.locator('.pdf-nav button').last().click();await pdfPage(a,2);await position(a,r=>r[0]?.source.kind==='pdf'&&r[0].locator.page===2);
  b=await fixture({...options,shared:a.shared,width:1280});await b.page.goto(`/viewer/${root.id}`);await pdfPage(b,2);
  assert.equal(await b.page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('manabi-original-sync:')).length),1);
  await b.page.locator('.pdf-nav button').first().click();await pdfPage(b,1);await position(a,r=>r[0]?.locator.page===1);
  await focus(a);await a.page.getByRole('button',{name:'그곳에서 이어 읽기',exact:true}).waitFor();assert.equal(await a.page.locator('.pdfjs-page--current').getAttribute('data-page-number'),'2');
  for(const width of [320,390,768,1280]){await a.page.setViewportSize({width,height:900});await noOverflow(a);assert.ok(await a.page.locator('.original-position-notice.is-conflict').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height<240));}
  await a.page.setViewportSize({width:390,height:844});if(shots)await a.page.screenshot({path:`${shots}/sync-mobile-conflict.png`});
  const notice=a.page.locator('.original-position-notice.is-floating');
  await notice.evaluate(el=>{const nodes=[el,...el.querySelectorAll('*')],sizes=nodes.map(node=>parseFloat(getComputedStyle(node).fontSize));nodes.forEach((node,i)=>{node.dataset.originalStyle=node.getAttribute('style')||'';node.style.setProperty('font-size',`${sizes[i]*2}px`,'important');});});
  await noOverflow(a);assert.ok(await notice.evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height<400));
  if(shots)await a.page.screenshot({path:`${shots}/sync-mobile-large-text.png`});
  await notice.evaluate(el=>{for(const node of [el,...el.querySelectorAll('*')])node.setAttribute('style',node.dataset.originalStyle);});
  await a.page.getByRole('button',{name:'그곳에서 이어 읽기',exact:true}).click();await pdfPage(a,1);assert.equal(JSON.stringify(root.processed_json),original);assert.equal((await a.db.query('select * from reading_progress')).rows.length,0);assert.equal(a.analysisCalls,0);
 }finally{await b?.close();await a.close();}
});

test('EPUB last attachment and chapter sync; an explicit PDF URL remains explicit',async()=>{
 const a=await fixture(options);let b;
 try{
  const root=await create(a);await pdfPage(a,1);await a.page.locator('#original-file-select').selectOption('1');await a.page.locator('.original-epub').waitFor();await a.page.locator('.original-chapter-nav button').last().click();
  await position(a,r=>r[0]?.source.kind==='epub'&&r[0].locator.chapter===2);
  b=await fixture({...options,shared:a.shared,width:390});await b.page.goto(`/viewer/${root.id}`);await b.page.locator('.original-epub').waitFor();assert.equal(await b.page.locator('.original-chapter-nav').innerText(),'← 이전 장\n2 / 2\n다음 장 →');
  const pdf=root.processed_json.metadata.composer.assets.find(a=>a.kind==='pdf');await b.page.goto(`/viewer/${root.id}?asset=${pdf.hash}`);await pdfPage(b,1);assert.equal(await b.page.locator('.original-epub').count(),0);
  await a.page.goto('/materials');await a.page.locator('.shelf-recent-card').waitFor();assert.match(await a.page.locator('.shelf-recent-card').innerText(),/읽던 위치에서 이어 읽기/);await a.page.locator('.shelf-recent-card').click();await a.page.locator('.original-epub').waitFor();assert.equal(a.rows.length,1);await noOverflow(a);await noOverflow(b);
 }finally{await b?.close();await a.close();}
});

test('a Unicode body anchor restores across screen widths without pixel-based progress',async()=>{
 const a=await fixture({...options,width:1280});let b;
 try{
  await scrollView(a);
  const root=await create(a,{body:longBody,files:[]});await a.page.locator('.original-writing').hover();await a.page.mouse.wheel(0,2600);
  const saved=(await position(a,r=>r[0]?.source.kind==='body'&&r[0].locator.offset>1000))[0];
  b=await fixture({...options,shared:a.shared,width:390});await scrollView(b);await b.page.goto(`/viewer/${root.id}`);await b.page.locator('.original-writing').waitFor();
  await b.page.waitForFunction(offset=>{const el=document.querySelector('.original-writing');if(!el)return false;const chars=Array.from(el.textContent),r=document.createRange();r.setStart(el.firstChild,chars.slice(0,offset).join('').length);r.setEnd(el.firstChild,chars.slice(0,offset+1).join('').length);return Math.abs(r.getBoundingClientRect().top-104)<3;},saved.locator.offset);
  assert.deepEqual(Object.keys(saved.locator),['offset']);assert.equal(root.raw_text,longBody);assert.equal(a.analysisCalls+b.analysisCalls,0);await noOverflow(a);await noOverflow(b);
  await b.page.locator('.original-writing').evaluate(el=>{el.style.fontSize=`${parseFloat(getComputedStyle(el).fontSize)*2}px`;});await noOverflow(b);
 }finally{await b?.close();await a.close();}
});

test('an offline stale location is retained locally and requires an explicit choice over another source',async()=>{
 const a=await fixture(options);let b;
 try{
  const root=await create(a);await pdfPage(a,1);await a.page.locator('.pdf-nav button').last().click();await position(a,r=>r[0]?.locator.page===2);
  a.setPositionFailure(true);await a.page.locator('.pdf-nav button').first().click();await a.page.getByRole('button',{name:'동기화 다시 시도',exact:true}).waitFor();
  b=await fixture({...options,shared:a.shared});await b.page.goto(`/viewer/${root.id}`);await pdfPage(b,2);await b.page.locator('#original-file-select').selectOption('1');await b.page.locator('.original-epub').waitFor();await b.page.locator('.original-chapter-nav button').last().click();await position(a,r=>r[0]?.source.kind==='epub');
  a.setPositionFailure(false);await a.page.getByRole('button',{name:'동기화 다시 시도',exact:true}).click();await a.page.getByRole('button',{name:'현재 위치 유지',exact:true}).waitFor();assert.equal((await rows(a))[0].source.kind,'epub');await pdfPage(a,1);
  if(shots)await a.page.screenshot({path:`${shots}/sync-desktop-conflict.png`});
  await a.page.getByRole('button',{name:'현재 위치 유지',exact:true}).focus();await a.page.keyboard.press('Enter');await position(a,r=>r[0]?.source.kind==='pdf'&&r[0].locator.page===1);assert.equal(a.rows.length,1);assert.equal(a.objects.size,2);await noOverflow(a);
 }finally{await b?.close();await a.close();}
});

test('saved response loss and refresh preserve one revision; changed body does not inherit an old anchor',async()=>{
 const a=await fixture(options);
 try{
  await scrollView(a);
  const root=await create(a,{files:[],body:longBody});a.losePositionReply();await a.page.locator('.original-writing').hover();await a.page.mouse.wheel(0,1800);await a.page.getByRole('button',{name:'동기화 다시 시도',exact:true}).waitFor();const before=(await rows(a))[0];
  await a.page.getByRole('button',{name:'동기화 다시 시도',exact:true}).click();await a.page.getByText('읽던 위치가 계정에 저장돼요.',{exact:true}).waitFor();assert.equal((await rows(a))[0].version,before.version);
  await a.page.reload();await a.page.locator('.original-writing').waitFor();assert.equal((await rows(a))[0].version,before.version);
  await a.page.getByRole('link',{name:'수정',exact:true}).click();await a.page.locator('#composer-body').fill('A newly written short body.');await a.page.getByRole('button',{name:'변경 저장',exact:true}).click();await a.page.locator('.original-writing').waitFor();
  assert.equal(await a.page.locator('.original-writing').innerText(),'A newly written short body.');assert.equal(root.raw_text,longBody);assert.equal(a.rows.length,1);assert.equal((await rows(a))[0].source.revision,null);await noOverflow(a);
 }finally{await a.close();}
});

// 쪽 넘김 보기(READER-PAGED-001) — 글만 있는 자료의 본문을 화면 단위 쪽으로. 위치 정본은 그대로 글자 위치(코드 포인트)이고,
// 기준은 넘긴 쪽의 첫 글자다. 다른 폭의 기기에서 열면 그 글자가 있는 쪽이 열린다(쪽 번호는 저장하지 않는다).
test('paged body: turning pages saves the first character offset and another width opens the page holding it',async()=>{
 const a=await fixture({...options,width:1280});let b;
 try{
  const root=await create(a,{body:longBody,files:[]});
  const pages=a.page.locator('.original-pages[data-reader-pages="paged"]');await pages.waitFor();
  const label=f=>f.page.locator('.original-pagebar .reader-pagebar__pos').textContent();
  await a.page.waitForFunction(()=>/^1 \/ \d+쪽/.test(document.querySelector('.original-pagebar .reader-pagebar__pos')?.textContent||''));
  const count=+(await label(a)).match(/\/ (\d+)쪽/)[1];assert.ok(count>=3,`long body spans pages (${count})`);
  await a.page.getByRole('button',{name:'다음 쪽',exact:true}).click();await a.page.keyboard.press('ArrowRight');
  await a.page.waitForFunction(()=>/^3 \//.test(document.querySelector('.original-pagebar .reader-pagebar__pos')?.textContent||''));
  const saved=(await position(a,r=>r[0]?.source.kind==='body'&&r[0].locator.offset>100))[0];
  assert.deepEqual(Object.keys(saved.locator),['offset']);
  const visible=(f,offset)=>f.page.evaluate(offset=>{const el=document.querySelector('.original-writing'),box=el.closest('[data-reader-pages]').getBoundingClientRect(),chars=Array.from(el.textContent),r=document.createRange();r.setStart(el.firstChild,chars.slice(0,offset).join('').length);r.setEnd(el.firstChild,chars.slice(0,offset+1).join('').length);const rect=r.getBoundingClientRect();return rect.left>=box.left-1&&rect.right<=box.right+1&&rect.top>=box.top-1&&rect.bottom<=box.bottom+1;},offset);
  // 다시 열어 복원할 때는 그 글자가 화면 안, 사이트 머리 밑에 깔리지 않은 자리에 보여야 한다.
  const onScreen=(f,offset)=>f.page.evaluate(offset=>{const el=document.querySelector('.original-writing'),chars=Array.from(el.textContent),r=document.createRange();r.setStart(el.firstChild,chars.slice(0,offset).join('').length);r.setEnd(el.firstChild,chars.slice(0,offset+1).join('').length);const rect=r.getBoundingClientRect(),head=document.querySelector('.gnb')?.getBoundingClientRect().bottom||0;return rect.top>=head&&rect.bottom<=innerHeight;},offset);
  assert.ok(await visible(a,saved.locator.offset),'the saved character is the first one on the current page');
  b=await fixture({...options,shared:a.shared,width:390});await b.page.goto(`/viewer/${root.id}`);await b.page.locator('.original-pages[data-reader-pages="paged"]').waitFor();
  const until=Date.now()+15000;while(!(await visible(b,saved.locator.offset))&&Date.now()<until)await b.page.waitForTimeout(150);
  assert.ok(await visible(b,saved.locator.offset),'another width opens the page that holds the saved character');
  assert.ok(await onScreen(b,saved.locator.offset),'the restored character is on screen below the site header');
  const bar=await b.page.locator('.original-pagebar').boundingBox();assert.ok(bar&&bar.y+bar.height<=b.page.viewportSize().height+1,'the page bar stays on screen with the page');
  if(shots)await b.page.screenshot({path:`${shots}/original-paged-390.png`});
  assert.equal(root.raw_text,longBody);assert.equal(a.analysisCalls+b.analysisCalls,0);await noOverflow(a);await noOverflow(b);
 }finally{await b?.close();await a.close();}
});
