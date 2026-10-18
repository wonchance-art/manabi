// Real app + local Postgres. No production login, source upload, or personal records.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir} from 'node:fs/promises';
import {fixture,OWNER} from './fixtures/library-v4-backend.mjs';
const shots=process.env.COMPOSER_SCREENSHOTS;
function seed(f,n=5){for(let i=1;i<=n;i++)f.rows.push({id:i,owner_id:OWNER,visibility:'private',title:`자료 ${String(i).padStart(3,'0')}`,raw_text:'This source stays intact.',processed_json:{status:'note',metadata:{language:'English',composer:{version:1,assets:[]}}},created_at:`2026-09-${String((i%28)+1).padStart(2,'0')}T10:00:00Z`});}
async function enter(f){await f.page.goto('/materials',{waitUntil:'domcontentloaded',timeout:120000});await f.page.locator('.shelf-row').first().waitFor();}
async function overflow(f){assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(f.errors,[]);}
async function capture(f,name){if(shots){await mkdir(shots,{recursive:true});await f.page.screenshot({path:`${shots}/${name}.png`,fullPage:true});}}
async function createFolder(f,name,parent=''){await f.page.getByRole('button',{name:'폴더 관리',exact:true}).click();await f.page.locator('#collection-name').fill(name);if(parent)await f.page.locator('#folder-parent').selectOption({label:parent});await f.page.getByRole('button',{name:'만들기',exact:true}).click();await f.page.locator('#collection-name').filter({hasText:''}).waitFor();await f.page.waitForFunction(()=>document.querySelector('#collection-name')?.value==='');await f.page.getByRole('button',{name:'닫기',exact:true}).click();}

test('select, nested folders, move, trash, restore and undo preserve originals',async()=>{
 const f=await fixture({management:true});try{
 seed(f);const originals=JSON.stringify(f.rows);await enter(f);await createFolder(f,'여행');await createFolder(f,'기차','여행');await capture(f,'library-default-desktop');
 await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();
 await f.page.getByRole('button',{name:'폴더에 추가',exact:true}).click();await f.page.getByLabel('대상 폴더').selectOption({label:'여행 / 기차'});await f.page.getByRole('button',{name:'추가',exact:true}).click();await f.page.locator('.shelf-notice').getByText('5개 완료',{exact:true}).waitFor();
 await f.page.getByRole('button',{name:'여행 / 기차',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();
 await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();await f.page.getByRole('button',{name:'이동',exact:true}).click();await f.page.getByLabel('대상 폴더').selectOption({label:'여행'});await f.page.getByRole('button',{name:'이동',exact:true}).last().click();await f.page.locator('.shelf-empty').waitFor();
 await f.page.getByRole('button',{name:'되돌리기',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();
 await f.page.getByRole('button',{name:'전체',exact:true}).click();await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();await f.page.getByRole('button',{name:'휴지통',exact:true}).last().click();await f.page.getByRole('button',{name:'휴지통으로',exact:true}).click();await f.page.locator('.shelf-empty').waitFor();
 await f.page.getByRole('navigation',{name:'서재 위치'}).getByRole('button',{name:'휴지통',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();await f.page.getByRole('button',{name:'복원',exact:true}).click();await f.page.locator('.shelf-empty').waitFor();
 await f.page.getByRole('button',{name:'여행 / 기차',exact:true}).click();await f.page.locator('.shelf-row').nth(4).waitFor();assert.equal(JSON.stringify(f.rows),originals);await overflow(f);
 }finally{await f.close();}
});

test('all filtered results include unloaded rows but exclude newly arriving matches; lost reply recovers',async()=>{
 let lose=true;const f=await fixture({management:true,loseLibraryReply:()=>{if(lose){lose=false;return true;}return false;}});try{
 seed(f,65);await enter(f);assert.equal(await f.page.locator('.shelf-row').count(),20);
 await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('button',{name:'검색 결과 65개 선택'}).click();await f.page.getByText('65개 선택',{exact:true}).waitFor();
 f.rows.push({...f.rows[0],id:99,title:'뒤늦게 들어온 자료'});
 await f.page.getByRole('button',{name:'휴지통',exact:true}).last().click();await f.page.getByRole('button',{name:'휴지통으로',exact:true}).click();await f.page.getByRole('button',{name:'다시 시도',exact:true}).waitFor();
 await f.page.reload({waitUntil:'domcontentloaded',timeout:120000});await f.page.getByRole('button',{name:'다시 시도',exact:true}).click();await f.page.locator('.shelf-notice').getByText('65개 완료',{exact:true}).waitFor();assert.equal(await f.page.locator('.shelf-row').count(),1);assert.match(await f.page.locator('.shelf-row').innerText(),/뒤늦게/);
 lose=true;await f.page.getByRole('button',{name:'되돌리기',exact:true}).click();await f.page.getByRole('button',{name:'다시 시도',exact:true}).waitFor();
 await f.page.reload({waitUntil:'domcontentloaded',timeout:120000});await f.page.getByRole('button',{name:'다시 시도',exact:true}).click();await f.page.locator('.shelf-notice').getByText('65개 취소됨',{exact:true}).waitFor();assert.equal((await f.db.query("select count(*)::int n from library_item_state where state='trashed'")).rows[0].n,0);await overflow(f);
 }finally{await f.close();}
});

// REVIEW-SHELF-CLS-001: 서버 미리 받기를 놓친 서재(e2e는 늘 이 경로)는 읽던 곳 · 대화 · 목록 첫 쪽이 정해진 뒤 세 칸을 한 번에 그린다 —
// 칸마다 풀리면 읽던 곳 골격(157px)이 사라지고 대화 골격이 줄며 목록을 끌어올렸다(390 CLS 0.14–0.15). 한 칸이 실패해도 나머지는 막히지 않는다.
test('shelf body appears at once after recent, conversations and first page settle; a failed section does not block the rest at 390px',async()=>{
 for(const failRecent of [false,true]){
  const f=await fixture({management:true,width:390,reducedMotion:'no-preference'});try{
   seed(f,5);f.setRecentFailure(failRecent);
   await f.context.addInitScript(()=>{window.__bodyShifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())for(const s of e.sources||[]){const el=s.node?.nodeType===1?s.node:s.node?.parentElement;if(el?.closest('.shelf-content'))window.__bodyShifts.push(`${el.tagName}.${el.className} ${e.value.toFixed(4)} ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`);}}).observe({type:'layout-shift',buffered:true});});
   await enter(f);await f.page.locator('.shelf-row').nth(4).waitFor();
   if(failRecent)await f.page.locator('.shelf-query-error').getByText('읽던 곳',{exact:false}).waitFor();
   await f.page.waitForTimeout(600);
   assert.equal(await f.page.locator('.shelf-row').count(),5);assert.equal(await f.page.locator('.shelf-conversations').count(),1);
   assert.equal(await f.page.locator('.shelf-content .skeleton').count(),0,'no skeleton left');
   if(!failRecent)assert.deepEqual(await f.page.evaluate(()=>window.__bodyShifts),[],'shelf body moved after first paint');
   await overflow(f);
  }finally{await f.close();}
 }
});

test('personal rename, favorites, revision conflict and minimum 320px keyboard controls',async()=>{
 const f=await fixture({management:true,width:390});try{
 seed(f,4);f.rows[0].title='긴제목과파일이름'.repeat(25);await enter(f);await capture(f,'library-default-mobile');
 await f.page.locator('.shelf-row-menu').first().click();await f.page.getByRole('button',{name:'이름 변경',exact:true}).click();await f.page.getByLabel('내 서재 표시 이름').fill('개인 제목');await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.getByRole('heading',{name:'개인 제목',exact:true}).waitFor();assert.equal(f.rows.some(r=>r.title==='개인 제목'),false);
 await f.page.locator('.shelf-row-menu').first().click();await f.page.getByRole('dialog').getByRole('button',{name:'즐겨찾기',exact:true}).click();await f.page.locator('dialog[open]').waitFor({state:'detached'});await f.page.getByRole('navigation',{name:'서재 위치'}).getByRole('button',{name:'즐겨찾기',exact:true}).click();await f.page.waitForFunction(()=>document.querySelectorAll('.shelf-row').length===1);assert.equal(await f.page.locator('.shelf-row').count(),1);
 await f.page.getByRole('button',{name:'전체',exact:true}).click();await f.page.locator('.shelf-row').nth(3).waitFor();await f.page.getByRole('button',{name:'선택',exact:true}).click();await f.page.getByRole('checkbox',{name:'현재 표시된 자료 선택'}).check();
 const before=(await f.db.query('select target_id from library_item_state limit 1')).rows[0].target_id;
 await f.db.query("update library_item_state set display_title='다른 탭 수정' where target_id=$1",[before]);
 await f.page.getByRole('button',{name:'휴지통',exact:true}).last().click();await f.page.getByRole('button',{name:'휴지통으로',exact:true}).click();await f.page.locator('.shelf-notice').getByText(/^3개 완료 · 일부 자료/).waitFor();await f.page.getByRole('button',{name:'실패 항목 다시 선택'}).click();await f.page.getByText('1개 선택',{exact:true}).waitFor();
 for(const width of [320,390,768,1280]){await f.page.setViewportSize({width,height:900});await overflow(f);const closeTarget=await f.page.getByRole('button',{name:'선택 해제'}).boundingBox();assert.ok(closeTarget.width>=44&&closeTarget.height>=44);if(shots){await mkdir(shots,{recursive:true});await f.page.screenshot({path:`${shots}/library-${width}.png`,fullPage:true});}}
 await f.page.getByRole('button',{name:'자료 필터'}).click();await f.page.keyboard.press('Escape');await f.page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='자료 필터');assert.equal(await f.page.locator('dialog[open]').count(),0);
 await f.page.getByRole('button',{name:'선택 해제'}).click();await f.page.locator('.shelf-row-link').first().focus();await f.page.keyboard.press('Control+a');await f.page.getByText('1개 선택',{exact:true}).waitFor();await overflow(f);
 }finally{await f.close();}
});

test('pressing a card shows the tab pending underline on that card only until the slow viewer reply; a second press is ignored (LIBRARY-PENDING-001)',async()=>{
 // 움직임 그대로(no-preference) — 공용 픽스처 기본은 동작 줄이기(reduce)라 밑줄이 정지판(nav-pending-still)으로 그려진다(그 판은 appFeelPending 계약).
 const f=await fixture({management:true,width:390,reducedMotion:'no-preference'});try{
 seed(f,3);let navigations=0;
 // 느린 서버: 뷰어로 가는 이동(RSC · prefetch 아님)만 1.2초 늦춘다
 await f.context.route(/\/viewer\/\d+/,async r=>{const h=r.request().headers();if(h.rsc&&!h['next-router-prefetch']){navigations++;await new Promise(res=>setTimeout(res,1200));}return r.fallback();});
 await enter(f);const card=f.page.locator('.shelf-row-link').first();
 await card.click();
 await card.locator('.nav-pending[data-pending]').waitFor({state:'attached',timeout:1000});
 assert.match(f.page.url(),/\/materials/); // 응답 전 — 아직 서재
 assert.equal(await f.page.locator('.nav-pending[data-pending]').count(),1); // 누른 카드만
 const look=await card.evaluate(a=>{const m=a.querySelector('.nav-pending'),s=getComputedStyle(m),mr=m.getBoundingClientRect(),ar=a.getBoundingClientRect();return {animation:s.animationName,delay:s.animationDelay,hidden:m.getAttribute('aria-hidden'),width:Math.round(mr.width-ar.width),bottom:Math.round(mr.bottom-ar.bottom),height:Math.round(mr.height)};});
 assert.deepEqual(look,{animation:'nav-pending',delay:'0.1s',hidden:'true',width:0,bottom:1,height:2}); // 탭과 같은 밑줄 · 행 밑줄 자리
 await card.click(); // 대기 중 같은 카드 — 무시
 await f.page.waitForURL(/\/viewer\/\d+/,{timeout:60000});
 assert.equal(navigations,1);
 await f.page.goBack();await f.page.waitForURL(/\/materials/,{timeout:15000}); // 기록이 두 줄이면 뷰어에 남는다
 await f.page.locator('.shelf-row').first().waitFor();assert.equal(await f.page.locator('.nav-pending[data-pending]').count(),0);
 }finally{await f.close();}
});
