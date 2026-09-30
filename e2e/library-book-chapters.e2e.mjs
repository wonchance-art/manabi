import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture,OWNER} from './fixtures/library-v4-backend.mjs';
const shots=process.env.COMPOSER_SCREENSHOTS;
function seed(f){f.rows.push({id:1,owner_id:OWNER,visibility:'private',title:'HSK 문장 — 1과',raw_text:'原文。',processed_json:{status:'pending',sequence:[],dictionary:{},metadata:{language:'Chinese',book:{key:'book',title:'HSK 문장',order:1}}},created_at:'2026-09-01T10:00:00Z'});}
async function enter(f){await f.page.goto('/materials',{waitUntil:'domcontentloaded',timeout:120000});await f.page.getByRole('button',{name:/담긴 글 보기/}).click();await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).waitFor();}
async function add(f,order,title=''){await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).click();await f.page.getByLabel('과 번호',{exact:true}).fill(String(order));await f.page.getByLabel('과 제목',{exact:true}).fill(title);await f.page.getByLabel('과 내용',{exact:true}).fill('这是新加的一课。');await f.page.getByRole('button',{name:'추가',exact:true}).click();await f.page.locator('dialog[open]').waitFor({state:'detached'});}
async function orders(f){await f.page.waitForFunction(()=>!document.querySelector('dialog[open]'));return f.page.locator('.shelf-chapter-order').allTextContents();}
async function capture(f,name){if(shots){await mkdir(shots,{recursive:true});await f.page.screenshot({path:`${shots}/${name}.png`,fullPage:true});}}

test('out-of-order entry, duplicate correction, renumber and reconnect',async()=>{
 const f=await fixture({management:true,bookChapters:true});try{
  seed(f);await enter(f);await add(f,8,'여행');await add(f,3,'학교생활');await add(f,5,'약속');
  await f.page.getByText('5과',{exact:true}).waitFor();assert.deepEqual(await orders(f),['1과','3과','5과','8과']);await capture(f,'chapters-desktop');
  await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).click();await f.page.getByLabel('과 번호',{exact:true}).fill('5');await f.page.getByLabel('과 내용',{exact:true}).fill('같은 번호');await f.page.getByRole('button',{name:'추가',exact:true}).click();await f.page.getByRole('alert').filter({hasText:'5과가 있어요'}).waitFor();assert.equal(f.rows.length,4);
  await f.page.keyboard.press('Escape');await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).focus();
  await f.page.getByRole('button',{name:'8과 더보기'}).click();await f.page.getByRole('button',{name:'과 번호 수정',exact:true}).click();await f.page.getByLabel('과 번호',{exact:true}).fill('2');await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.getByText('2과',{exact:true}).waitFor();assert.deepEqual(await orders(f),['1과','2과','3과','5과']);
  await f.page.reload({waitUntil:'domcontentloaded',timeout:120000});await f.page.getByRole('button',{name:/담긴 글 보기/}).click();await f.page.getByText('2과',{exact:true}).waitFor();assert.deepEqual(await orders(f),['1과','2과','3과','5과']);
  await f.page.getByRole('button',{name:'2과 더보기'}).click();await f.page.getByRole('button',{name:'과 번호 수정',exact:true}).click();await f.page.keyboard.press('Escape');await f.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='2과 더보기');
  const third=f.rows.find(row=>row.processed_json.metadata.book.order===3);
  await f.page.locator('.shelf-book-chapters li>a').filter({hasText:'2과'}).click();await f.page.locator(`a.next-lesson-card[href="/viewer/${third.id}"]`).waitFor();
  assert.equal(f.rows[0].raw_text,'原文。');assert.equal(f.analysisCalls,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('lost save reply resumes exactly once after reload; draft and keyboard on 320px',async()=>{
 let lose=true;const f=await fixture({management:true,bookChapters:true,width:320,loseChapterReply:()=>{if(lose){lose=false;return true;}return false;}});try{
  seed(f);await enter(f);await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).click();await f.page.getByLabel('과 번호',{exact:true}).fill('8');await f.page.getByLabel('과 제목',{exact:true}).fill('아주 긴 제목으로 여러 줄에 걸치는 여행과 학교 이야기');await f.page.getByLabel('과 내용',{exact:true}).fill('保存的内容。');await capture(f,'chapter-form-320');
  await f.page.getByRole('button',{name:'추가',exact:true}).click();await f.page.getByRole('button',{name:'다시 확인',exact:true}).waitFor();assert.equal(f.rows.length,2);
  await f.page.reload({waitUntil:'domcontentloaded',timeout:120000});await f.page.getByRole('button',{name:/담긴 글 보기/}).click();await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).click();await f.page.getByRole('button',{name:'다시 확인',exact:true}).click();await f.page.locator('dialog[open]').waitFor({state:'detached'});await f.page.getByText('8과',{exact:true}).waitFor();assert.equal(f.rows.length,2);
  for(const width of [320,390,768,1280]){await f.page.setViewportSize({width,height:900});assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await f.page.setViewportSize({width:320,height:900});await capture(f,'chapters-320');await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).click();await f.page.keyboard.press('Escape');await f.page.waitForFunction(()=>document.activeElement?.textContent==='+ 과 추가');assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('split chapter numbers remain editable and saves a nonconsecutive batch',async()=>{
 const f=await fixture({management:true,bookChapters:true});try{
  seed(f);await enter(f);await f.page.getByRole('button',{name:'+ 과 추가',exact:true}).click();await f.page.getByLabel('과 번호',{exact:true}).fill('3');await f.page.getByLabel('과 내용',{exact:true}).fill('我在学校。\n明天见。');await f.page.getByText('여러 과로 나누기',{exact:true}).click();await f.page.getByLabel('과당 문장 수').fill('1');await f.page.getByRole('button',{name:'나누기',exact:true}).click();await f.page.getByLabel('2번째 과 번호').fill('8');await f.page.getByRole('button',{name:'추가',exact:true}).click();await f.page.getByText('8과',{exact:true}).waitFor();assert.deepEqual(await orders(f),['1과','3과','8과']);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});

test('legacy append starts after the highest number and shares the same book',async()=>{
 const f=await fixture({management:true,bookChapters:true});try{
  seed(f);await enter(f);await add(f,8,'여행');
  await f.page.goto('/materials/add?book=book',{waitUntil:'domcontentloaded',timeout:120000});
  await f.page.locator('#sentence-text').fill('明天一起去学校。');await f.page.locator('#sentence-per-chapter').fill('1');
  await f.page.getByRole('button',{name:'9과로 나누기',exact:true}).click();await f.page.getByText('책에 이어 등록 — 현재 2과',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'이어 등록 (1과)',exact:true}).click();await f.page.getByRole('link',{name:'바로 읽기',exact:true}).waitFor();
  assert.deepEqual(f.rows.map(row=>row.processed_json.metadata.book.order).sort((a,b)=>a-b),[1,8,9]);
  const added=f.rows.find(row=>row.processed_json.metadata.book.order===9);assert.equal(added.visibility,'private');assert.equal(added.processed_json.status,'pending');assert.equal(added.processed_json.metadata.book.key,'book');
  assert.equal(f.analysisCalls,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
