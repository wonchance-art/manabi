import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,OWNER} from './fixtures/library-v4-backend.mjs';
const shots=process.env.COMPOSER_SCREENSHOTS;
const meta=(language='English')=>({status:'note',metadata:{language},sequence:[],dictionary:{}});
function seed(f,n=30){for(let i=1;i<=n;i++)f.rows.push({id:i,owner_id:OWNER,visibility:'private',title:`${String(i).padStart(2,'0')} · 오후의 작은 독서 기록`,raw_text:'One page at a time.\n읽고 싶었던 문장을 다시 꺼내 봅니다.',processed_json:meta(['Japanese','Chinese','English','French'][i%4]),created_at:new Date(Date.UTC(2026,0,i)).toISOString()});}
async function enter(f){await f.page.goto('/materials');await f.page.locator('.shelf-header').waitFor();}
async function createCollection(f,name){await f.page.getByRole('button',{name:'모음집 만들기',exact:true}).click();await f.page.getByLabel('새 모음집',{exact:true}).fill(name);await f.page.getByRole('button',{name:'만들기',exact:true}).click();await f.page.getByRole('button',{name:`${name} 이름 변경`}).waitFor();await f.page.getByRole('button',{name:'닫기',exact:true}).click();}
async function overflow(f){assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(f.errors,[]);}

test('single shelf: 20 root page, search, clear, grouped chapter, filenames, load more',async()=>{
 const f=await fixture();try{seed(f,30);f.rows.push({id:101,owner_id:OWNER,visibility:'private',title:'Chapter hidden treasure',raw_text:'hello',processed_json:{metadata:{language:'French',book:{key:'legacy-book',title:'파리에서 온 문장들',order:1}}},created_at:'2026-02-01'});
 await enter(f);await f.page.locator('.shelf-row').first().waitFor();assert.equal(await f.page.locator('.shelf-row').count(),20);
 await f.page.getByRole('button',{name:/더 보기 · 11개/}).click();await f.page.locator('.shelf-list-end').waitFor();assert.equal(await f.page.locator('.shelf-row').count(),31);
 await f.page.getByLabel('제목·파일명 검색').fill('treasure');await f.page.getByRole('button',{name:'검색',exact:true}).click();await f.page.waitForFunction(()=>document.querySelectorAll('.shelf-row').length===1);assert.equal(await f.page.locator('.shelf-row').count(),1);assert.equal(await f.page.locator('.shelf-child-match').getAttribute('href'),'/viewer/101?returnTo=%2Fmaterials%3Fq%3Dtreasure');
 await f.page.getByRole('button',{name:'조건 지우기'}).click();await f.page.locator('.shelf-row').nth(19).waitFor();if(shots)await f.page.screenshot({path:`${shots}/library-desktop.png`,fullPage:false});await overflow(f);
 }finally{await f.close();}
});

test('collection create, reference add, reader return, rename and delete keep originals',async()=>{
 const f=await fixture();try{seed(f,3);await enter(f);await createCollection(f,'주말의 문장');
 await f.page.locator('.shelf-row-menu').first().click();await f.page.getByRole('button',{name:'모음집에 담기',exact:true}).click();await f.page.getByRole('checkbox',{name:'주말의 문장'}).check();await f.page.getByRole('button',{name:'닫기',exact:true}).click();
 await f.page.getByRole('button',{name:'주말의 문장',exact:true}).click();await f.page.getByText('1개 자료',{exact:true}).waitFor();
 const back=new URL(f.page.url()).search;
 await f.page.locator('.shelf-row-link').click();try{await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();}catch(e){console.error({url:f.page.url(),text:await f.page.locator('body').innerText(),errors:f.errors});throw e;}await f.page.locator('.shelf-row').first().waitFor();assert.equal(new URL(f.page.url()).searchParams.get('collection'),new URLSearchParams(back).get('collection'));
 await f.page.getByRole('button',{name:'모음집 관리',exact:true}).click();await f.page.getByRole('button',{name:'주말의 문장 이름 변경'}).click();await f.page.getByLabel('새 모음집 이름',{exact:true}).fill('다시 읽을 문장');await f.page.getByRole('button',{name:'이름 저장',exact:true}).click();await f.page.getByRole('button',{name:'다시 읽을 문장 모음집 삭제'}).click();await f.page.getByRole('button',{name:'모음집 삭제',exact:true}).click();await f.page.getByRole('button',{name:'닫기',exact:true}).click();await f.page.locator('.shelf-row').nth(2).waitFor();assert.equal(f.rows.length,3);await overflow(f);
 }finally{await f.close();}
});

test('composer saves once, failed membership retries reference only, recent original participates',async()=>{
 const f=await fixture();try{await enter(f);await createCollection(f,'낱장 모음');await f.page.getByRole('button',{name:'낱장 모음',exact:true}).click();await f.page.waitForFunction(()=>document.querySelector('.shelf-collections button[aria-pressed=true]')?.textContent==='낱장 모음');await f.page.locator('.shelf-header .manabi-button').click();
 await f.page.locator('#composer-title').fill('하루 한 장, 비 오는 날에도');await f.page.locator('#composer-body').fill('A small note.');f.failMembership();await f.page.getByRole('button',{name:'저장',exact:true}).click();try{await f.page.getByText('자료는 저장했지만 모음집에 담지 못했어요.',{exact:false}).waitFor();}catch(e){console.error({url:f.page.url(),text:await f.page.locator('main').innerText(),requests:f.requests.filter(r=>r.method==='POST'),rows:f.rows.length});throw e;}assert.equal(f.rows.length,1);await f.page.getByRole('button',{name:'모음집에 담기 다시 시도'}).click();await f.page.locator('.original-reader').waitFor();assert.equal(f.rows.length,1);
 await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();await f.page.locator('.shelf-row').first().waitFor();await f.page.getByRole('button',{name:'전체',exact:true}).click();await f.page.locator('.shelf-recent-card').waitFor();assert.equal(await f.page.locator('.shelf-row').count(),1);assert.equal(f.analysisCalls,0);await overflow(f);
 }finally{await f.close();}
});

test('mobile dimensions, long titles, native filter dialog, keyboard dismissal and zoom',async()=>{
 const f=await fixture({width:390});try{seed(f,3);f.rows[2].title='아주긴한중일제목과파일이름'.repeat(18);await enter(f);await f.page.locator('.shelf-row').first().waitFor();
 for(const width of [320,354,390,768,1280]){await f.page.setViewportSize({width,height:844});await overflow(f);if(shots&&width===390)await f.page.screenshot({path:`${shots}/library-mobile.png`,fullPage:false});}
 await f.page.setViewportSize({width:390,height:844});await f.page.getByRole('button',{name:'자료 필터'}).click();await f.page.getByLabel('언어',{exact:true}).selectOption('French');await f.page.getByRole('button',{name:'적용',exact:true}).click();await f.page.getByText('1개 자료',{exact:true}).waitFor();await overflow(f);
 await f.page.getByRole('button',{name:'모음집 만들기',exact:true}).click();await f.page.keyboard.press('Escape');assert.equal(await f.page.locator('dialog[open]').count(),0);await f.page.waitForFunction(()=>document.activeElement?.textContent?.includes('모음집 만들기'));await f.page.keyboard.press('Tab');assert.notEqual(await f.page.evaluate(()=>document.activeElement===document.body),true);
 await f.page.addStyleTag({content:'body{zoom:2!important}'});await overflow(f);
 }finally{await f.close();}
});

test('independent recent failure keeps actual list; list failure offers retry, not empty state',async()=>{
 const f=await fixture();try{seed(f,1);f.setRecentFailure(true);await enter(f);await f.page.locator('.shelf-row').first().waitFor();await f.page.getByText('읽던 곳 · 불러오지 못했어요.',{exact:false}).waitFor();assert.equal(await f.page.locator('.shelf-empty').count(),0);
 f.setRecentFailure(false);f.setListFailure(true);await f.page.reload();await f.page.getByText('자료 목록 · 불러오지 못했어요.',{exact:false}).waitFor();assert.equal(await f.page.locator('.shelf-empty').count(),0);f.setListFailure(false);await f.page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await f.page.locator('.shelf-row').first().waitFor();await overflow(f);
 }finally{await f.close();}
});


test('EPUB original: recent resumes the selected attachment and chapter without automatic study',async()=>{
 const f=await fixture();try{
  await f.page.goto('/materials/add');await f.page.locator('#composer-title').fill('쪽과 장을 기억하는 서재');await f.page.locator('#composer-body').fill('Read with the original file.');
  await f.page.locator('input[type=file]').setInputFiles(new URL('./fixtures/composer/reading.epub',import.meta.url).pathname);await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.locator('.original-epub').waitFor();
  await f.page.locator('.original-file select').selectOption('1');await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();await f.page.locator('.shelf-recent-card').waitFor();
  assert.match(await f.page.locator('.shelf-recent-card').innerText(),/2장부터/);await f.page.locator('.shelf-recent-card').click();await f.page.locator('.original-epub').waitFor();assert.equal(await f.page.locator('.original-file select').inputValue(),'1');assert.equal(f.rows.length,1);assert.equal(f.analysisCalls,0);await overflow(f);
 }finally{await f.close();}
});


test('public discovery stays in Discover; personal bookmark is independent of expressions and offline pin',async()=>{
 const f=await fixture();try{f.rows.push({id:90,owner_id:'00000000-0000-4000-8000-000000000090',visibility:'public',title:'Une fenêtre ouverte',raw_text:'Bonjour. Une fenêtre ouverte.',processed_json:{status:'pending',metadata:{language:'French'},sequence:[],dictionary:{}},created_at:'2026-01-01'});
  await f.page.goto('/discover?view=reading&lang=French');await f.page.locator('#library-search').waitFor();assert.equal(new URL(f.page.url()).pathname,'/discover');
  await f.page.locator('a[href^="/viewer/90"]').first().click();await f.page.getByRole('button',{name:'서재에 담기',exact:true}).click();await f.page.getByRole('button',{name:'서재에 담김 ✓',exact:true}).waitFor();
  await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();await f.page.locator('#library-search').waitFor();assert.equal(new URL(f.page.url()).pathname,'/discover');
  await f.page.goto('/materials');await f.page.locator('.shelf-row').waitFor();await f.page.locator('.shelf-row-menu').click();await f.page.getByRole('button',{name:'서재 보관 해제',exact:true}).click();await f.page.locator('.shelf-empty').waitFor();assert.equal(f.rows.length,1);assert.equal(f.rows[0].raw_text,'Bonjour. Une fenêtre ouverte.');assert.equal((await f.db.query('select count(*)::int n from library_bookmarks')).rows[0].n,0);await overflow(f);
 }finally{await f.close();}
});

test('textbook reading keeps edition and local lesson; adding its reference does not clone chapters',async()=>{
 const f=await fixture();try{
  await f.page.goto(`/books/japanese-n5?edition=${f.edition}#u03-study1`);await f.page.locator('article[data-unit-page]').first().waitFor();
  await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();await f.page.locator('.shelf-recent-card').waitFor();assert.match(await f.page.locator('.shelf-recent-card').getAttribute('href'),new RegExp(`edition=${f.edition}`));assert.equal(await f.page.locator('.shelf-row').count(),0);
  await f.page.locator('.shelf-recent-card').click();await f.page.locator('article[data-unit-page]').first().waitFor();assert.equal(new URL(f.page.url()).searchParams.get('edition'),f.edition);assert.equal(f.rows.length,0);assert.equal(f.analysisCalls,0);await overflow(f);
 }finally{await f.close();}
});

test('shelf edit action keeps source and returns under the same filter; study child stays grouped',async()=>{
 const f=await fixture();try{
  await f.page.goto('/materials/add');await f.page.locator('#composer-title').fill('처음 남긴 문장');await f.page.locator('#composer-body').fill('The first source.');await f.page.getByRole('button',{name:'저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
  const before=JSON.stringify(f.rows[0].processed_json);await f.page.getByRole('link',{name:'수정',exact:true}).click();await f.page.locator('#composer-body').fill('Bonjour, une nouvelle page.');await f.page.locator('.composer-options summary').click();await f.page.locator('#composer-language').selectOption('French');await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();
  await f.page.locator('.original-study summary').click();await f.page.getByRole('button',{name:'본문 학습하기 ↗'}).click();await f.page.getByRole('link',{name:'현재 글과 첨부 원본 ↗'}).waitFor();assert.equal(f.rows.length,2);
  await f.page.goto('/materials?lang=French');await f.page.locator('.shelf-row').waitFor();assert.equal(await f.page.locator('.shelf-row').count(),1);await f.page.locator('.shelf-row-menu').click();await f.page.getByRole('link',{name:'글과 첨부 수정 ↗'}).click();await f.page.locator('#composer-title').fill('고쳐 읽는 프랑스어');await f.page.getByRole('button',{name:'변경 저장',exact:true}).click();await f.page.locator('.original-reader').waitFor();await f.page.getByRole('link',{name:'← 내 서재',exact:true}).first().click();await f.page.locator('.shelf-row').waitFor();assert.equal(new URL(f.page.url()).searchParams.get('lang'),'French');assert.equal(f.rows[0].raw_text,'The first source.');assert.equal(JSON.stringify(f.rows[0].processed_json),before);assert.equal(f.rows.length,2);await overflow(f);
 }finally{await f.close();}
});
