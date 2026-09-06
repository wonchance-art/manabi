// Isolated member fixtures; no real account, backend mutations or production bypass.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.QA_BASE || 'http://localhost:8882';
const out = process.env.QA_OUT || '/private/tmp/manabi-library-discovery-qa';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
context.setDefaultTimeout(60000); context.setDefaultNavigationTimeout(180000);
const report = { base, checks: [], errors: [] };
const uid = '00000000-0000-4000-8000-000000000088';
const user = { id: uid, aud:'authenticated', role:'authenticated', email:'review-fixture@example.com', email_confirmed_at:new Date().toISOString(), app_metadata:{provider:'email'}, user_metadata:{}, identities:[] };
const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const now = Math.floor(Date.now()/1000);
const session = {user, access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
const cors = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','access-control-expose-headers':'content-range'};
let state='populated', pdfFail=false, readingFail=false;
const records = [
 {id:91001,title:'프랑스어로 읽는 나의 첫 번째 아침',visibility:'private',owner_id:uid,direction:'read',created_at:'2026-09-05',processed_json:{status:'completed',metadata:{language:'French',level:'A1 기초'},sequence:['t0','t1','t2'],dictionary:{t0:{text:'Bonjour',pos:'감탄사',meaning:'안녕하세요'},t1:{text:'le',pos:'관사'},t2:{text:'monde',pos:'명사',meaning:'세상'}}},raw_text:'Bonjour le monde'},
 {id:91002,title:'내가 직접 적은 짧은 노트',visibility:'private',owner_id:uid,direction:'write',created_at:'2026-09-05',processed_json:{status:'note',metadata:{language:'Japanese'}}},
 {id:91003,title:'공개로 나눈 긴 제목의 읽을거리 — '.repeat(5),visibility:'public',owner_id:uid,direction:'read',created_at:'2026-09-05',processed_json:{status:'completed',metadata:{language:'Japanese',level:'N5'}}},
 {id:91004,title:'완독한 글',visibility:'private',owner_id:uid,direction:'read',created_at:'2026-09-04',processed_json:{status:'completed',metadata:{language:'Chinese',level:'H1'}}},
];
const pdf={id:'00000000-0000-4000-8000-000000000099',title:'내가 가져온 PDF',last_page_read:7,page_count:20,created_at:'2026-09-05'};
const reads=[{material_id:91001,last_token_idx:1,is_completed:false,updated_at:'2026-09-06',reading_materials:{...records[0],metadata:records[0].processed_json.metadata}},{material_id:91004,last_token_idx:2,is_completed:true,reading_materials:records[3]},{material_id:91999,last_token_idx:2,is_completed:false,reading_materials:null}];
const queries=[],writes=[];
await context.route(base+'/**',async route=>{
 if(new URL(route.request().url()).pathname.startsWith('/_next/static/'))return route.continue();
 try {const response=await route.fetch({headers:{...route.request().headers(),cookie:''},timeout:180000});await route.fulfill({response});}catch(error){if(!/closed|disposed/.test(error.message))throw error;}
});
await context.route('**/auth/v1/**',route=>route.fulfill({status:route.request().method()==='OPTIONS'?204:200,headers:cors,json:route.request().url().includes('/user')?user:session}));
await context.route('**/rest/v1/**',async route=>{
 const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),method=req.method();
 if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
 if(table==='profiles')return route.fulfill({headers:cors,json:{id:uid,display_name:'서재 검수',role:'user',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['French']}});
 if(method==='HEAD')return route.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
 if(['POST','PATCH','DELETE'].includes(method)){writes.push({table,method,body:req.postDataJSON()});return route.fulfill({headers:cors,json:[]});}
 queries.push({table,params:Object.fromEntries(url.searchParams)});
 if((table==='reading_progress'&&readingFail)||(table==='uploaded_pdfs'&&pdfFail)||(table==='reading_materials'&&state==='error'))return route.fulfill({status:503,headers:cors,json:{message:'fixture unavailable'}});
 if(table==='reading_progress')return route.fulfill({headers:cors,json:state==='empty'?[]:reads});
 if(table==='uploaded_pdfs')return route.fulfill({headers:cors,json:state==='empty'?[]:[pdf]});
 if(table==='reading_materials'){
  let rows=state==='empty'?[]:records;
  for(const key of ['id','owner_id','visibility']){const value=url.searchParams.get(key);if(value?.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3));}
  for(const key of ['language','level']){const value=url.searchParams.get(`processed_json->metadata->>${key}`);if(value?.startsWith('eq.'))rows=rows.filter(r=>r.processed_json.metadata[key]===value.slice(3));}
  const q=url.searchParams.get('title');if(q?.startsWith('ilike.'))rows=rows.filter(r=>r.title.includes(q.slice(6).replaceAll('%','')));
  return route.fulfill({headers:cors,json:req.headers().accept?.includes('vnd.pgrst.object')?(rows[0]||null):rows});
 }
 return route.fulfill({headers:cors,json:[]});
});
await context.route('**/api/suggestions/today',route=>route.fulfill({json:[]}));
await context.route('**/api/learning/**',route=>route.fulfill({json:{contexts:[],links:[]}}));
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
async function check(label){await page.evaluate(()=>document.fonts.ready);const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width+1,`${label}: overflow ${JSON.stringify(size)}`);report.checks.push(label);console.log(label);}
try {
 await page.goto(base+'/discover');await page.getByRole('heading',{name:'궁금한 곳부터, 한 편씩.'}).waitFor();await check('public regional reading index loads from real registry');
 await page.screenshot({path:out+'/discover-desktop.png',fullPage:true});
 await page.getByLabel('지역',{exact:true}).selectOption('france');await page.getByRole('button',{name:'문화',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.discovery-reading-item').length===1);assert.match(page.url(),/region=france/);assert.match(page.url(),/topic=culture/);
 const article=page.locator('.discovery-reading-item').first(),href=await article.getAttribute('href');await article.click();await page.waitForURL('**'+href);await page.getByRole('heading',{level:1}).waitFor();await page.goBack();await page.locator('.discovery-reading-item').first().waitFor();assert.equal(await page.getByLabel('지역',{exact:true}).inputValue(),'france');await check('article navigation and back retain region/topic filters');
 await page.getByLabel('제목·소개 검색').fill('없는검색어XYZ');await page.getByRole('button',{name:'찾기 ↗',exact:true}).click();await page.getByRole('heading',{name:'이 조합의 글은 아직 없어요.'}).waitFor();await check('combined no-results has reset');
 await page.getByRole('button',{name:'필터 초기화',exact:true}).click();await page.locator('.discovery-reading-item').first().waitFor();
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await check('discovery width '+width);}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/discover-mobile.png',fullPage:true});
 await page.locator('.discovery-language-links a').filter({hasText:'French'}).click();await page.getByRole('textbox',{name:'자료 제목 검색'}).waitFor();await page.getByRole('button',{name:'프랑스어',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'프랑스어',exact:true}).getAttribute('aria-pressed'),'true');await check('French public reading destination retains language');
 await page.goto(base+'/materials');await page.getByRole('heading',{name:'읽던 곳을 서재에 남겨요.'}).waitFor();await check('guest library is explicit and has working next actions');
 await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');
 await page.goto(base+'/materials');await page.getByRole('heading',{name:records[0].title,exact:true}).waitFor();await page.getByRole('heading',{name:pdf.title,exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'완독한 글',exact:true}).count(),0);await check('member continues unfinished accessible material and owned PDF only');
 assert.equal(await page.locator('.library-reading-row').filter({hasText:pdf.title}).getAttribute('href'),`/pdf/${pdf.id}?page=7`);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:out+'/library-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/library-mobile.png',fullPage:true});for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});const title=await page.locator('.library-book-mark h2').boundingBox();assert(title.width>=100&&title.height<300,'book title must not collapse into vertical text');await check('library typography width '+width);}await page.setViewportSize({width:390,height:844});
 await page.getByRole('navigation',{name:'서재 분류'}).getByRole('link',{name:'내 자료',exact:true}).click();await page.getByRole('heading',{name:records[0].title,exact:true}).waitFor();await page.getByRole('heading',{name:records[2].title,exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:records[1].title,exact:true}).count(),0);await check('owned shelf includes my public materials and excludes notes');
 await page.setViewportSize({width:320,height:844});await check('owned long title at 320px');await page.screenshot({path:out+'/owned-mobile.png',fullPage:true});
 await page.getByRole('navigation',{name:'서재 분류'}).getByRole('link',{name:'내 노트',exact:true}).click();await page.getByRole('heading',{name:records[1].title,exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:records[0].title,exact:true}).count(),0);assert.equal(await page.getByText(pdf.title,{exact:true}).count(),0);await check('notes have their own shelf without PDFs or reading cards');
 await page.goto(base+'/materials?view=owned');await page.getByRole('textbox',{name:'자료 제목 검색'}).fill('프랑스');await page.waitForURL('**q=*');await page.reload();assert.equal(await page.getByRole('textbox',{name:'자료 제목 검색'}).inputValue(),'프랑스');await check('library search survives reload');
 await page.getByRole('link',{name:records[0].title,exact:true}).click();await page.waitForURL('**/viewer/91001');await page.getByRole('heading',{name:records[0].title,exact:true}).waitFor();await page.goBack();await page.getByRole('textbox',{name:'자료 제목 검색'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'자료 제목 검색'}).inputValue(),'프랑스');await check('material reader and back retain library query');
 readingFail=true;await page.goto(base+'/materials');await page.getByRole('alert').filter({hasText:'글의 읽던 위치를 불러오지 못했어요.'}).waitFor();await page.getByRole('heading',{name:pdf.title,exact:true}).waitFor();await check('reading failure is explicit while PDF still works');
 readingFail=false;state='empty';await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await page.reload();await page.getByRole('heading',{name:'다음으로 읽을 글을 골라 보세요.'}).waitFor();await check('retry and honest new member state');
 state='populated';pdfFail=true;await page.reload();await page.getByRole('alert').filter({hasText:'PDF의 읽던 위치를 불러오지 못했어요.'}).waitFor();await page.getByRole('heading',{name:records[0].title,exact:true}).waitFor();await check('PDF failure leaves reading available');
 for(const q of queries.filter(q=>['reading_progress','uploaded_pdfs'].includes(q.table)))assert.equal(q.params[q.table==='uploaded_pdfs'?'owner_id':'user_id'],'eq.'+uid,'personal query is owner scoped');
 assert.equal(writes.filter(w=>w.table==='user_vocabulary').length,0,'library visits must not alter review schedules');
 await page.goto(base+'/discover?shown=16#reading-index');await page.waitForFunction(()=>document.querySelectorAll('.discovery-reading-item').length===16);const later=page.locator('.discovery-reading-item').nth(10);await later.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);const laterHref=await later.getAttribute('href');await later.click();await page.waitForURL('**'+laterHref);await page.getByRole('heading',{level:1}).waitFor();await page.goBack();await page.waitForFunction(()=>document.querySelectorAll('.discovery-reading-item').length===16);await page.waitForTimeout(500);const after=await page.evaluate(()=>scrollY);report.scrollRestoration={before,after};assert(Math.abs(before-after)<20,`scroll restoration ${before} -> ${after}`);await check('expanded discovery list and scroll survive article round trip');
 await page.goto(base+'/books/japanese-n5#u03-study1');await page.locator('#u03-study1').waitFor();await page.goto(base+'/materials');const resumeLink=page.getByRole('link',{name:'교재 이어 읽기 ↗',exact:true});await resumeLink.waitFor();assert.match(await resumeLink.getAttribute('href'),/#u03-study1/);await check('real N5 book position resumes with edition and anchor');
 state='empty';pdfFail=false;await page.goto(base+'/materials?view=notes');const noteLink=page.getByRole('link',{name:'첫 노트 쓰기 →',exact:true});await noteLink.waitFor();await noteLink.click();await page.getByRole('button',{name:'내 노트',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'내 노트',exact:true}).getAttribute('aria-pressed'),'true');await check('empty notes link starts the real private note form');
 assert.deepEqual(report.errors,[]);
} finally {fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
