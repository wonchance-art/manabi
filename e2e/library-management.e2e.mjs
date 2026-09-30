// Real app + local Postgres. No production login, source upload, or personal records.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture,OWNER} from './fixtures/library-v4-backend.mjs';
const shots=process.env.COMPOSER_SCREENSHOTS;
function seed(f,n=5){for(let i=1;i<=n;i++)f.rows.push({id:i,owner_id:OWNER,visibility:'private',title:`자료 ${String(i).padStart(3,'0')}`,raw_text:'This source stays intact.',processed_json:{status:'note',metadata:{language:'English',composer:{version:1,assets:[]}}},created_at:`2026-09-${String((i%28)+1).padStart(2,'0')}T10:00:00Z`});}
async function enter(f){await f.page.goto('/materials',{waitUntil:'domcontentloaded'});await f.page.locator('.shelf-row').first().waitFor();}
async function overflow(f){assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(f.errors,[]);}
async function capture(f,name){if(shots){await mkdir(shots,{recursive:true});await f.page.screenshot({path:`${shots}/${name}.png`,fullPage:true});}}
async function createFolder(f,name,parent=''){await f.page.getByRole('button',{name:'폴더 관리',exact:true}).click();await f.page.locator('#collection-name').fill(name);if(parent)await f.page.locator('#folder-parent').selectOption({label:parent});await f.page.getByRole('button',{name:'만들기',exact:true}).click();await f.page.locator('#collection-name').filter({hasText:''}).waitFor();await f.page.waitForFunction(()=>document.querySelector('#collection-name')?.value==='');await f.page.getByRole('button',{name:'닫기',exact:true}).click();}

test('select, nested folders, move, trash, restore and undo preserve originals',async()=>{
 const f=await fixture({management:true});try{
 seed(f);const originals=JSON.stringify(f.rows);await enter(f);await createFolder(f,'여행');await createFolder(f,'기차','여행');await capture(f,'library-default-desktop');
 await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();
 await f.page.getByRole('button',{name:'폴더에 추가',exact:true}).click();await f.page.getByLabel('대상 폴더').selectOption({label:'여행 / 기차'});await f.page.getByRole('button',{name:'추가',exact:true}).click();await f.page.getByText('5개 완료',{exact:true}).waitFor();
 await f.page.getByRole('button',{name:'여행 / 기차',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();
 await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();await f.page.getByRole('button',{name:'이동',exact:true}).click();await f.page.getByLabel('대상 폴더').selectOption({label:'여행'});await f.page.getByRole('button',{name:'이동',exact:true}).last().click();await f.page.locator('.shelf-empty').waitFor();
 await f.page.getByRole('button',{name:'실행 취소',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();
 await f.page.getByRole('button',{name:'전체',exact:true}).click();await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();await f.page.getByRole('button',{name:'휴지통',exact:true}).last().click();await f.page.getByRole('button',{name:'이동',exact:true}).click();await f.page.locator('.shelf-empty').waitFor();
 await f.page.getByRole('button',{name:'휴지통',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();await f.page.getByRole('button',{name:'복원',exact:true}).click();await f.page.locator('.shelf-empty').waitFor();
 await f.page.getByRole('button',{name:'여행 / 기차',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();assert.equal(JSON.stringify(f.rows),originals);await overflow(f);
 }finally{await f.close();}
});

test('all filtered results include unloaded rows but exclude newly arriving matches; lost reply recovers',async()=>{
 let lose=true;const f=await fixture({management:true,loseLibraryReply:()=>{if(lose){lose=false;return true;}return false;}});try{
 seed(f,65);await enter(f);assert.equal(await f.page.locator('.shelf-row').count(),20);
 await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('button',{name:'검색 결과 65개 선택'}).click();await f.page.getByText('65개 선택',{exact:true}).waitFor();
 f.rows.push({...f.rows[0],id:99,title:'뒤늦게 들어온 자료'});
 await f.page.getByRole('button',{name:'휴지통',exact:true}).last().click();await f.page.getByRole('button',{name:'이동',exact:true}).click();await f.page.getByRole('button',{name:'다시 확인',exact:true}).waitFor();
 await f.page.reload({waitUntil:'domcontentloaded'});await f.page.getByRole('button',{name:'다시 확인',exact:true}).click();await f.page.getByText('65개 완료',{exact:true}).waitFor();assert.equal(await f.page.locator('.shelf-row').count(),1);assert.match(await f.page.locator('.shelf-row').innerText(),/뒤늦게/);
 lose=true;await f.page.getByRole('button',{name:'실행 취소',exact:true}).click();await f.page.getByRole('button',{name:'다시 확인',exact:true}).waitFor();
 await f.page.reload({waitUntil:'domcontentloaded'});await f.page.getByRole('button',{name:'다시 확인',exact:true}).click();await f.page.getByText('65개 취소됨',{exact:true}).waitFor();assert.equal((await f.db.query("select count(*)::int n from library_item_state where state='trashed'")).rows[0].n,0);await overflow(f);
 }finally{await f.close();}
});

test('personal rename, favorites, revision conflict and minimum 320px keyboard controls',async()=>{
 const f=await fixture({management:true,width:390});try{
 seed(f,4);f.rows[0].title='긴제목과파일이름'.repeat(25);await enter(f);await capture(f,'library-default-mobile');
 await f.page.locator('.shelf-row-menu').first().click();await f.page.getByRole('button',{name:'이름 변경',exact:true}).click();await f.page.getByLabel('내 서재 표시 이름').fill('개인 제목');await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.getByRole('heading',{name:'개인 제목',exact:true}).waitFor();assert.equal(f.rows.some(r=>r.title==='개인 제목'),false);
 await f.page.locator('.shelf-row-menu').first().click();await f.page.getByRole('dialog').getByRole('button',{name:'즐겨찾기',exact:true}).click();await f.page.locator('dialog[open]').waitFor({state:'detached'});await f.page.getByRole('navigation',{name:'서재 위치'}).getByRole('button',{name:'즐겨찾기',exact:true}).click();await f.page.waitForFunction(()=>document.querySelectorAll('.shelf-row').length===1);assert.equal(await f.page.locator('.shelf-row').count(),1);
 await f.page.getByRole('button',{name:'전체',exact:true}).click();await f.page.locator('.shelf-row').nth(3).waitFor();await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();
 const before=(await f.db.query('select target_id from library_item_state limit 1')).rows[0].target_id;
 await f.db.query("update library_item_state set display_title='다른 탭 수정' where target_id=$1",[before]);
 await f.page.getByRole('button',{name:'휴지통',exact:true}).last().click();await f.page.getByRole('button',{name:'이동',exact:true}).click();await f.page.getByText(/^3개 완료 · 일부 자료/).waitFor();await f.page.getByRole('button',{name:'실패 항목 다시 선택'}).click();await f.page.getByText('1개 선택',{exact:true}).waitFor();
 for(const width of [320,390,768,1280]){await f.page.setViewportSize({width,height:900});await overflow(f);const closeTarget=await f.page.getByRole('button',{name:'선택 해제'}).boundingBox();assert.ok(closeTarget.width>=44&&closeTarget.height>=44);if(shots){await mkdir(shots,{recursive:true});await f.page.screenshot({path:`${shots}/library-${width}.png`,fullPage:true});}}
 await f.page.getByRole('button',{name:'자료 필터'}).click();await f.page.keyboard.press('Escape');await f.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='자료 필터');assert.equal(await f.page.locator('dialog[open]').count(),0);
 await f.page.getByRole('button',{name:'선택 해제'}).click();await f.page.locator('.shelf-row-link').first().focus();await f.page.keyboard.press('Control+a');await f.page.getByText('1개 선택',{exact:true}).waitFor();await overflow(f);
 }finally{await f.close();}
});
