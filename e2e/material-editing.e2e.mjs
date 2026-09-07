// The real app, with an isolated synthetic Supabase boundary. No personal data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fixture } from './fixtures/material-editing-backend.mjs';
const shots=process.env.COMPOSER_SCREENSHOTS;
const original='Hello.\n\nThis is the first source.';
async function seed(f,{file=false}={}){
 await f.page.goto('/materials/add');await f.page.locator('#composer-title').fill('비 오는 오후의 독서');await f.page.locator('#composer-body').fill(original);
 if(file)await f.page.locator('input[type=file]').setInputFiles(new URL('./fixtures/composer/reading.epub',import.meta.url).pathname);
 await f.page.locator('.composer-options summary').click();await f.page.locator('#composer-language').selectOption('English');
 await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();return f.rows[0].id;
}
async function edit(f){await f.page.getByRole('link',{name:'수정',exact:true}).click();try { await f.page.locator('#composer-title').waitFor(); } catch (error) { console.error(await f.page.locator('main').innerText()); throw error; }}
async function save(f){await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();}
async function overflow(f){assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(f.errors,[]);}

test('desktop: current document edits, same address, old source intact, new study source reused',async()=>{
 const f=await fixture();try{
  const id=await seed(f,{file:true}),before=JSON.stringify(f.rows[0].processed_json);await edit(f);
  assert.equal(await f.page.locator('#composer-body').inputValue(),original);
  await f.page.locator('#composer-title').fill('비 오는 오후, 다시 읽는 문장');await f.page.locator('#composer-body').fill('Bonjour.\n\nUn nouveau départ.');
  await f.page.locator('.composer-options summary').click();await f.page.locator('#composer-language').selectOption('French');
  await f.page.getByText('이 기기에 초안 보관됨',{exact:true}).waitFor();await f.page.reload();await f.page.locator('#composer-body').waitFor();
  assert.equal(await f.page.locator('#composer-body').inputValue(),'Bonjour.\n\nUn nouveau départ.');
  if(shots)await f.page.screenshot({path:`${shots}/editing-desktop.png`,fullPage:true});await save(f);
  assert.equal(f.rows.length,1);assert.equal(f.rows[0].raw_text,original);assert.equal(JSON.stringify(f.rows[0].processed_json),before);
  assert.equal(await f.page.locator('.original-writing').textContent(),'Bonjour.\n\nUn nouveau départ.');assert.equal(f.analysisCalls,0);await overflow(f);
  await f.page.locator('.original-study summary').click();await f.page.getByRole('button',{name:'본문 학습하기 ↗'}).click();
  await f.page.waitForURL(/viewer\/94001/);await f.page.getByRole('link',{name:'현재 글과 첨부 원본 ↗'}).click();await f.page.locator('.original-reader').waitFor();
  await f.page.locator('.original-study summary').click();await f.page.getByRole('button',{name:'본문 학습하기 ↗'}).click();await f.page.waitForURL(/viewer\/94001/);
  assert.equal(f.rows.length,2);assert.equal(f.rows[1].raw_text,'Bonjour.\n\nUn nouveau départ.');
  await f.page.goto(`/viewer/${id}?study=1&sourceToken=id_0_0&sourceText=Hello`);await f.page.getByRole('link',{name:'현재 글과 첨부 원본 ↗'}).waitFor();
  assert.equal(await f.page.locator('.original-reader').count(),0);assert.equal(f.rows[0].raw_text,original);
  await f.page.goto('/materials?view=owned&lang=French');await f.page.locator('.mat-card').waitFor();assert.equal(await f.page.locator('.mat-card').count(),1);
  assert.ok((await f.page.locator('.mat-card').innerText()).includes('비 오는 오후, 다시 읽는 문장'));assert.equal(f.analysisCalls,0);
  await f.page.locator('.mat-card .mat-menu summary').click();await f.page.getByRole('menuitem',{name:'수정',exact:true}).click();await f.page.locator('#composer-title').waitFor();
  await f.page.locator('#composer-title').fill('수정하고 돌아오는 글');await save(f);
  assert.ok(new URL(f.page.url()).searchParams.get('returnTo').includes('lang=French'));
 }finally{await f.context.close();}
});

test('mobile: replace attachment, remove link, keyboard/save return, scoped fresh edit',async()=>{
 const f=await fixture({width:390});try{
  await seed(f,{file:true});await edit(f);
  await f.page.getByRole('button',{name:'reading.epub 첨부 취소'}).click();await f.page.locator('input[type=file]').setInputFiles(new URL('./fixtures/composer/reading.pdf',import.meta.url).pathname);
  await f.page.getByRole('button',{name:'↗ 링크',exact:true}).click();await f.page.locator('#composer-link').fill('https://example.org/reading');await f.page.locator('#composer-link').press('Enter');
  await f.page.locator('#composer-title').fill('길게 적은 제목도 잘 읽히는 나의 독서 기록 '.repeat(4));await overflow(f);
  await f.page.setViewportSize({width:320,height:800});await overflow(f);assert.ok(await f.page.locator('#composer-title').evaluate(el=>el.scrollHeight<=el.clientHeight+1));await f.page.setViewportSize({width:390,height:1000});
  if(shots){ await f.page.locator('#composer-title').blur(); await f.page.evaluate(()=>scrollTo(0,0)); await f.page.screenshot({path:`${shots}/editing-mobile.png`}); await f.page.locator('.composer-save').scrollIntoViewIfNeeded(); await f.page.screenshot({path:`${shots}/editing-mobile-save.png`}); }await save(f);await f.page.locator('.pdfjs-page canvas').first().waitFor();await overflow(f);
  assert.equal(f.objects.size,2);assert.equal(f.rows[0].document_json.assets[0].kind,'pdf');assert.equal(f.rows[0].document_json.retainedAssets[0].kind,'epub');
  await edit(f);await f.page.getByRole('button',{name:'example.org 링크 취소'}).click();await save(f);assert.deepEqual(f.rows[0].document_json.links,[]);
 }finally{await f.context.close();}
});

test('lost edit response and reload: one revision, attachments and draft recover',async()=>{
 const f=await fixture();try{
  await seed(f);await edit(f);await f.page.locator('#composer-body').fill('Edited after a lost reply.');f.loseEdit();
  await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.composer-error').waitFor();const revision=f.rows[0].document_json.revision;
  await f.page.reload();await f.page.getByRole('button',{name:'다시 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
  assert.equal(f.rows.length,1);assert.equal(f.rows[0].document_json.revision,revision);assert.equal(await f.page.locator('.original-writing').textContent(),'Edited after a lost reply.');
 }finally{await f.context.close();}
});

test('concurrent device conflict retains local draft and requires latest-version review',async()=>{
 const f=await fixture();try{
  await seed(f);await edit(f);await f.page.locator('#composer-body').fill('My unsubmitted edit.');
  f.rows[0].document_json={version:1,revision:'00000000-0000-4000-8000-000000000999',body:'Other device won.',language:'English',assets:[],links:[],retainedAssets:[]};
  await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.getByRole('button',{name:'최신 글로 다시 수정'}).waitFor();
  assert.equal(await f.page.locator('#composer-body').inputValue(),'My unsubmitted edit.');assert.equal(f.rows[0].document_json.body,'Other device won.');
  const download=f.page.waitForEvent('download');await f.page.getByRole('button',{name:'내 초안 텍스트 내려받기'}).click();assert.ok((await readFile(await(await download).path(),'utf8')).includes('My unsubmitted edit.'));
  await f.page.getByRole('button',{name:'최신 글로 다시 수정'}).click();await f.page.getByText('최신 글을 불러왔어요.',{exact:true}).waitFor();assert.equal(await f.page.locator('#composer-body').inputValue(),'Other device won.');
 }finally{await f.context.close();}
});

test('new draft and saved editing can coexist; another editor for same item is locked',async()=>{
 const f=await fixture();try{
  const id=await seed(f);await edit(f);await f.page.locator('#composer-body').fill('Editing this material.');await f.page.getByText('이 기기에 초안 보관됨',{exact:true}).waitFor();
  const newPage=await f.context.newPage();await newPage.goto('/materials/add');await newPage.getByRole('button',{name:'새 자료 작성',exact:true}).click();await newPage.locator('#composer-body').fill('A separate new draft.');await newPage.getByText('이 기기에 초안 보관됨',{exact:true}).waitFor();
  const second=await f.context.newPage();await second.goto(`/materials/${id}/edit`);await second.getByRole('heading',{name:'다른 탭에서 작성 중이에요.'}).waitFor();await second.close();
  await save(f);await newPage.reload();assert.equal(await newPage.locator('#composer-body').inputValue(),'A separate new draft.');await newPage.close();
 }finally{await f.context.close();}
});

test('schema missing, absent owner and read errors do not expose editable private content',async()=>{
 const f=await fixture({schema:false});try{
  await seed(f);await editSchemaGate(f);assert.equal(await f.page.locator('#composer-body').count(),0);
  await f.page.goto('/materials/99999/edit');await f.page.getByRole('heading',{name:'자료를 열지 못했어요.'}).waitFor();
  await f.context.clearCookies();await f.page.reload();await f.page.getByRole('link',{name:'로그인하고 수정하기 ↗'}).waitFor();
 }finally{await f.context.close();}
});
async function editSchemaGate(f){await f.page.getByRole('link',{name:'수정',exact:true}).click();await f.page.getByRole('heading',{name:'수정 기능을 준비하고 있어요.'}).waitFor();}

test('failed update retains current document and retries the same edit',async()=>{
 const f=await fixture();try{
  await seed(f);await edit(f);await f.page.locator('#composer-body').fill('Saved only after retry.');f.failEdit();
  await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.composer-error').waitFor();
  assert.equal(f.rows[0].document_json,null);assert.equal(f.rows[0].raw_text,original);
  assert.equal(await f.page.locator('#composer-body').inputValue(),'Saved only after retry.');
  await f.page.getByRole('button',{name:'다시 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
  assert.equal(f.rows.length,1);assert.equal(f.rows[0].document_json.body,'Saved only after retry.');
 }finally{await f.context.close();}
});
