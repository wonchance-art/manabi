import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture} from './fixtures/library-v4-backend.mjs';
const shots=process.env.COMPOSER_SCREENSHOTS;
async function setup(options={}){
 const f=await fixture({...options,sourcePassages:true});let calls=0,fail=false;
 const vocab=[],contexts=[],writes=[];
 await f.context.route('**/rest/v1/user_vocabulary?*',async r=>{
  const method=r.request().method(),p=method==='POST'||method==='PATCH'?r.request().postDataJSON():null;
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  if(method==='OPTIONS')return r.fulfill({status:204,headers});
  if(p){writes.push({method,p});if(method==='POST')vocab.push(...(Array.isArray(p)?p:[p]).map(row=>({...row,id:89001+vocab.length,created_at:new Date().toISOString()})));else vocab.forEach(row=>Object.assign(row,p));}
  return r.fulfill({json:vocab,headers});
 });
 await f.context.route('**/api/learning/**',r=>{
  if(r.request().method()==='POST'){contexts.push(r.request().postDataJSON());return r.fulfill({json:{ok:true,context:{id:'source-1'},vocabulary:{id:89001}}});}
  return r.fulfill({json:{contexts:contexts.map(p=>({id:'source-1',kind:'reading',quote:p.source.quote,href:`/viewer/${p.source.materialId}?sourceToken=${encodeURIComponent(p.source.tokenId)}`})),links:[]}});
 });
 await f.context.route('**/api/analyze',async r=>{calls++;const p=r.request().postDataJSON();
  if(fail)return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic interruption'})});
  const results=p.lines.map(line=>{const words=line.split(/\s+/).filter(Boolean);return {sequence:words.map((_,i)=>`w${i}`),dictionary:Object.fromEntries(words.map((text,i)=>[`w${i}`,{text,meaning:'검수 표현',pos:'명사',base_form:text,reading:text}]))};});
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results})});
 });
 return {...f,vocab,contexts,writes,get calls(){return calls;},fail:value=>{fail=value;}};
}
async function create(f,files=[]){
 await f.page.goto('/materials/add');await f.page.locator('#composer-title').fill('다시 펼치는 오후의 문장');await f.page.locator('#composer-body').fill('A quiet afternoon.\nAnother page to read.\nOne word at a time.');
 if(files.length)await f.page.locator('input[type=file]').setInputFiles(files.map(kind=>new URL(`./fixtures/composer/reading.${kind}`,import.meta.url).pathname));
 await f.page.locator('.composer-options summary').click();await f.page.locator('#composer-language').selectOption('English');await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
 return f.rows[0];
}
async function pick(f){await f.page.getByRole('button',{name:'학습할 부분 고르기',exact:true}).click();await f.page.getByRole('button',{name:'1번째 글 선택',exact:true}).click();}
async function start(f){await f.page.getByRole('button',{name:'이 부분 공부하기',exact:true}).click();await f.page.locator('.reader-area').waitFor();await f.page.waitForFunction(()=>document.querySelectorAll('[data-source-token]').length>0);await f.page.locator('.analyzing-banner').waitFor({state:'hidden'});}
async function noOverflow(f){assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(f.errors,[]);}

test('body passage: real SQL creation, one-click analysis, source return, reuse and shelf grouping',async()=>{
 const f=await setup();try{
  const root=await create(f),original=JSON.stringify(root.processed_json);await pick(f);assert.equal(f.calls,0);await start(f);assert.equal(f.rows.length,2);assert.equal(f.calls,1);
  const child=f.rows[1];assert.equal(child.raw_text,'A quiet afternoon.');assert.equal(child.processed_json.status,'completed');
  await f.page.getByRole('link',{name:'원본의 작성한 본문으로 ↗'}).click();await f.page.locator('.original-reader').waitFor();await f.page.getByText('원본에서 해당 구간을 표시했어요.',{exact:true}).waitFor();
  await f.page.getByText('학습 구간 1',{exact:true}).click();await f.page.locator('.passage-sources li').waitFor();
  await pick(f);await start(f);assert.equal(f.rows.length,2);assert.equal(f.calls,1);assert.equal(JSON.stringify(root.processed_json),original);
  await f.page.goto('/materials');await f.page.locator('.shelf-row').waitFor();assert.equal(await f.page.locator('.shelf-row').count(),1);await noOverflow(f);
  await f.page.goto(`/viewer/${root.id}`);await f.page.getByRole('link',{name:'수정',exact:true}).click();await f.page.locator('#composer-body').fill('A new current version.');await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
  await f.page.goto(`/viewer/${child.id}?study=1`);await f.page.getByRole('link',{name:'원본의 작성한 본문으로 ↗'}).click();await f.page.locator('.passage-return-notice blockquote').waitFor();assert.equal(await f.page.locator('.passage-return-notice blockquote').innerText(),'A quiet afternoon.');assert.equal(await f.page.getByText('원본에서 해당 구간을 표시했어요.',{exact:true}).count(),0);assert.equal(child.raw_text,'A quiet afternoon.');
 }finally{await f.close();}
});

test('mobile PDF page and EPUB chapter are selected and reopen the exact attachment',async()=>{
 const f=await setup({width:390});try{
  const root=await create(f,['pdf','epub']);await f.page.locator('.pdfjs-page--current .textLayer span').first().waitFor();
  await f.page.locator('.pdf-nav button').last().click();await f.page.locator('.pdfjs-page--current[data-page-number="2"] .textLayer span').first().waitFor();
  await f.page.getByRole('button',{name:'학습할 부분 고르기',exact:true}).click();
  await f.page.getByLabel('구간을 고를 위치',{exact:true}).selectOption({label:'작성한 본문'});assert.equal(await f.page.getByRole('button',{name:'1번째 글 선택',exact:true}).innerText(),'A quiet afternoon.');
  await f.page.getByLabel('구간을 고를 위치',{exact:true}).selectOption({label:'reading.pdf · 2쪽'});await f.page.getByRole('button',{name:'1번째 글 선택',exact:true}).click();if(shots)await f.page.screenshot({path:`${shots}/passage-mobile.png`,fullPage:false});await start(f);assert.equal(f.rows[1].processed_json.metadata.composer.passage.page,2);
  await f.page.getByRole('link',{name:'원본의 2쪽으로 ↗'}).click();await f.page.locator('.pdfjs-page--current[data-page-number="2"]').waitFor();
  await f.page.locator('#original-file-select').selectOption('1');await f.page.locator('.original-epub').waitFor();await f.page.locator('.original-chapter-nav button').last().click();await f.page.locator('.original-chapter-nav').getByText('2 / 2',{exact:true}).waitFor();
  await pick(f);await start(f);const epub=f.rows[2];assert.equal(epub.processed_json.metadata.composer.passage.chapter,2);assert.ok(epub.processed_json.metadata.composer.passage.spinePath);
  await f.page.getByRole('link',{name:'원본의 2장으로 ↗'}).click();await f.page.locator('.original-epub').waitFor();assert.equal(await f.page.locator('.original-chapter-nav').innerText(),'← 이전 장\n2 / 2\n다음 장 →');
  assert.equal(f.rows.length,3);assert.equal(root.raw_text,'A quiet afternoon.\nAnother page to read.\nOne word at a time.');await noOverflow(f);
 }finally{await f.close();}
});

test('selection, keyboard cancel, length bound and failed analysis retry preserve the source',async()=>{
 const f=await setup();try{
  await create(f);await f.page.locator('.original-writing').evaluate(el=>{const range=document.createRange();range.setStart(el.firstChild,0);range.setEnd(el.firstChild,17);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
  await f.page.getByRole('button',{name:'선택한 부분 공부하기',exact:true}).click();assert.equal(await f.page.locator('.passage-quote').innerText(),'A quiet afternoon');
  await f.page.keyboard.press('Escape');assert.equal(await f.page.locator('dialog[open]').count(),0);assert.equal(f.rows.length,1);
  await f.page.getByRole('button',{name:/^(선택한 부분 공부하기|학습할 부분 고르기)$/}).click();await f.page.getByRole('button',{name:'내용 다듬기',exact:true}).click();await f.page.getByLabel('학습할 내용',{exact:true}).fill('x'.repeat(1501));assert.equal(await f.page.getByRole('button',{name:'이 부분 공부하기',exact:true}).isDisabled(),true);
  await f.page.getByLabel('학습할 내용',{exact:true}).fill('A quiet afternoon.');f.fail(true);await f.page.getByRole('button',{name:'이 부분 공부하기',exact:true}).click();await f.page.getByRole('button',{name:'재분석',exact:true}).waitFor();assert.equal(f.rows.length,2);
  f.fail(false);await f.page.getByRole('button',{name:'재분석',exact:true}).click();await f.page.waitForFunction(()=>document.querySelectorAll('[data-source-token]').length>0);assert.equal(f.rows.length,2);assert.equal(f.rows[1].raw_text,'A quiet afternoon.');await noOverflow(f);
 }finally{await f.close();}
});


test('lost response reuses one snapshot; small screens, keyboard and manual input stay usable',async()=>{
 const f=await setup();try{
  await create(f);await pick(f);
  for(const width of [320,390,768,1280]){await f.page.setViewportSize({width,height:900});await noOverflow(f);assert.ok(await f.page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));}
  await f.page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await noOverflow(f);await f.page.evaluate(()=>{document.documentElement.style.fontSize='';});
  assert.ok(await f.page.locator('dialog').evaluate(el=>Math.abs(el.getBoundingClientRect().left-(innerWidth-el.getBoundingClientRect().width)/2)<2));
  if(shots)await f.page.screenshot({path:`${shots}/passage-desktop.png`});
  f.losePassageReply();await f.page.getByRole('button',{name:'이 부분 공부하기',exact:true}).click();await f.page.getByRole('alert').filter({hasText:'구간을 열지 못했어요'}).waitFor();assert.equal(f.rows.length,2);assert.equal(f.calls,0);
  await start(f);assert.equal(f.rows.length,2);assert.equal(f.calls,1);
  await f.page.getByRole('link',{name:'원본의 작성한 본문으로 ↗'}).click();await f.page.locator('.original-reader').waitFor();
  const open=f.page.getByRole('button',{name:'학습할 부분 고르기',exact:true});await open.focus();await f.page.keyboard.press('Enter');await f.page.keyboard.press('Escape');assert.equal(await open.evaluate(el=>el===document.activeElement),true);
  await open.click();await f.page.getByRole('button',{name:'추출된 글이 어색한가요? 직접 입력',exact:true}).click();await f.page.getByLabel('학습할 내용',{exact:true}).fill('A sentence I transcribed.');
  await f.page.locator('dialog').getByLabel('학습 언어',{exact:true}).selectOption('');assert.equal(await f.page.getByRole('button',{name:'이 부분 공부하기',exact:true}).isDisabled(),true);await f.page.locator('dialog').getByLabel('학습 언어',{exact:true}).selectOption('English');await start(f);
  assert.equal(f.rows[2].processed_json.metadata.composer.passage.manual,true);assert.equal(f.rows[2].processed_json.metadata.composer.passage.quote,undefined);
 }finally{await f.close();}
});

test('PDF selection rejects crossing pages; removing the attachment preserves its old study source',async()=>{
 const f=await setup();try{
  const root=await create(f,['pdf']);await f.page.locator('.pdfjs-page[data-page-number="2"] .textLayer span').first().waitFor();
  await f.page.locator('.original-pdf').evaluate(el=>{const a=el.querySelector('[data-page-number="1"] .textLayer span').firstChild,b=el.querySelector('[data-page-number="2"] .textLayer span').firstChild,r=document.createRange();r.setStart(a,0);r.setEnd(b,b.length);getSelection().removeAllRanges();getSelection().addRange(r);});
  await f.page.getByText('한 쪽이나 한 장 안에서 구간을 골라 주세요.',{exact:true}).waitFor();assert.equal(await f.page.getByRole('button',{name:'선택한 부분 공부하기',exact:true}).count(),0);
  await f.page.locator('.pdfjs-page[data-page-number="2"] .textLayer span').first().evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);});
  await f.page.getByRole('button',{name:'선택한 부분 공부하기',exact:true}).click();await start(f);const child=f.rows[1];assert.equal(child.processed_json.metadata.composer.passage.page,2);
  await f.page.getByRole('link',{name:'원본의 2쪽으로 ↗'}).click();await f.page.locator('.pdfjs-page--current[data-page-number="2"]').waitFor();
  await f.page.getByRole('link',{name:'수정',exact:true}).click();await f.page.getByRole('button',{name:'reading.pdf 첨부 취소',exact:true}).click();await f.page.locator('#composer-body').fill('A different current body.');await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
  assert.equal(root.document_json.assets.length,0);assert.equal(root.document_json.retainedAssets.length,1);
  await f.page.goto(`/viewer/${child.id}?study=1`);await f.page.getByRole('link',{name:'원본의 2쪽으로 ↗'}).click();await f.page.locator('.pdfjs-page--current[data-page-number="2"] .textLayer span').first().waitFor();await f.page.getByText('원본에서 해당 구간을 표시했어요.',{exact:true}).waitFor();assert.equal(f.objects.size,1);await noOverflow(f);
 }finally{await f.close();}
});

test('explicit expression saving keeps the passage source; review returns to the quote without grading',async()=>{
 const f=await setup();try{
  await create(f);await pick(f);await start(f);assert.equal(f.vocab.length,0);
  const child=f.rows[1];await f.page.locator('.word-token').first().click();
  await f.page.getByRole('button',{name:'뜻·발음 수정',exact:true}).first().click();await f.page.locator('.token-edit__input').first().fill('자료 안에서 고친 뜻');await f.page.locator('.token-edit__actions').getByRole('button',{name:'저장',exact:true}).click();await f.page.getByText('수정이 저장됐어요!',{exact:true}).waitFor();assert.ok(Object.values(child.processed_json.dictionary).some(token=>token.meaning==='자료 안에서 고친 뜻'));
  await f.page.locator('.save-grade button').first().click();await f.page.getByRole('button',{name:'저장됨',exact:true}).first().waitFor();
  assert.equal(f.vocab.length,1);assert.equal(String(f.vocab[0].source_material_id),String(child.id));assert.equal(String(f.contexts[0].source.materialId),String(child.id));
  f.vocab[0].next_review_at='2026-01-01';f.vocab[0].interval=1;
  await f.page.goto('/vocab');await f.page.locator('.review-room-settings summary').click();await f.page.getByLabel('복습 방식',{exact:true}).selectOption('flash');await f.page.getByRole('button',{name:'단어만 1개 →',exact:true}).click();await f.page.getByRole('button',{name:'정답 확인하기',exact:true}).click();await f.page.locator('.learning-links summary').click();
  const before=f.writes.filter(w=>w.method==='PATCH').length,popupPromise=f.page.waitForEvent('popup');await f.page.getByRole('link',{name:'자료 속 문장 열기 ↗',exact:true}).click();const popup=await popupPromise;
  await popup.locator('.learning-source-highlight').waitFor();await popup.getByRole('link',{name:'원본의 작성한 본문으로 ↗'}).click();await popup.getByText('원본에서 해당 구간을 표시했어요.',{exact:true}).waitFor();await popup.close();
  assert.equal(f.writes.filter(w=>w.method==='PATCH').length,before);assert.equal(f.rows.length,2);await noOverflow(f);
 }finally{await f.close();}
});
