import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export async function installBoardCloudFixture({context,db,uid,cors,report}){
 await db.exec(`RESET ROLE;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,UNIQUE(bucket_id,name));
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260916030644_teaching_board_cloud.sql',import.meta.url),'utf8'));
 await db.exec('SET ROLE authenticated');
 const files=new Map(),state={offline:false,loseResponse:false,expectedErrors:0,writes:0};
 // WebKit's Playwright request payload omits Blob file bytes (size 0).
 // Observe that browser's actual Blob before fetch; use it only for this fixture.
 const browserFiles=new Map();
 if(context.browser().browserType().name()==='webkit'){
  await context.exposeBinding('__boardFixtureUpload',(_source,path,text)=>browserFiles.set(path,text));
  await context.addInitScript(()=>{const fetch=window.fetch.bind(window);window.fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input?.url||String(input);
   if(url.includes('/storage/v1/object/teaching-board-pages/')&&(init?.method||input?.method||'GET').toUpperCase()==='POST'){
    const form=await new Request(input,init).formData(),file=[...form.values()].find(value=>typeof value!=='string');
    if(file)await window.__boardFixtureUpload(decodeURIComponent(new URL(url,location.href).pathname.split('/teaching-board-pages/')[1]),await file.text());
   }
   return fetch(input,init);
  };});
 }
 const row=async day=>(await db.query('select id,owner_id,root_id,day::text,revision,manifest,updated_at from class_teaching_boards where root_id=1 and day=$1',[day])).rows[0]||null;
 const save=async(day,document)=>{
  const b=(await db.query('select teaching_board_prepare(1,$1) b',[day])).rows[0].b,pages=[];
  for(const p of document.pages){const text=JSON.stringify(p),hash=createHash('sha256').update(text).digest('hex'),path=`${uid}/${b.id}/${hash}.json`,bytes=Buffer.byteLength(text);files.set(path,text);await db.query("insert into storage.objects(bucket_id,name,metadata) values('teaching-board-pages',$1,$2) ON CONFLICT(bucket_id,name) DO NOTHING",[path,{size:bytes}]);pages.push({id:p.id,hash,bytes});}
  return (await db.query('select teaching_board_commit(1,$1,$2,$3,$4) b',[day,b.revision,crypto.randomUUID(),{version:1,activePage:document.activePage,pages}])).rows[0].b;
 };
 await context.route('**/api/classroom/boards*',async route=>{
  const req=route.request(),p=new URL(req.url()).searchParams;const send=(json,status=200)=>route.fulfill({json,status});
  if(state.offline){state.expectedErrors++;report.expectedTransport.push('intentional board connection failure');return send({error:'연결이 끊겼어요. 기기의 필기는 보관되어 있습니다.'},503);}
  try{
   if(req.method()==='GET'){
    if(p.has('day')){const gate=state.readGate;state.readGate=null;if(gate){gate.entered=true;await gate.wait;}return send({board:await row(p.get('day'))});}
    const rows=(await db.query('select id,day::text,manifest,updated_at from class_teaching_boards where root_id=1 and manifest is not null order by day desc')).rows;return send({boards:rows.map(b=>({id:b.id,day:b.day,pages:b.manifest.pages.length,updatedAt:b.updated_at}))});
   }
   const body=req.postDataJSON();
   if(req.method()==='POST')return send({board:(await db.query('select teaching_board_prepare(1,$1) b',[body.day])).rows[0].b});
   const b=(await db.query('select teaching_board_commit(1,$1,$2,$3,$4) b',[body.day,body.revision,body.operation,body.manifest])).rows[0].b;state.writes++;
   if(state.loseResponse){state.loseResponse=false;state.expectedErrors++;report.expectedTransport.push('intentional lost successful board response');return route.abort('failed');}
   return send({board:b});
  }catch(error){if(error.code!=='40001')report.errors.push('unexpected board SQL error: '+error.message);state.expectedErrors++;report.expectedTransport.push(error.code==='40001'?'intentional board revision conflict':error.message);return send({error:'다른 기기에서 수정한 판이 있어요.'},409);}
 });
 await context.route('**/storage/v1/object/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=decodeURIComponent(url.pathname.split('/teaching-board-pages/')[1]||'');
  if(!url.pathname.includes('teaching-board-pages'))return route.fallback();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(req.method()==='POST'){
   const raw=req.postDataBuffer();const body=req.headers()['content-type']||'';let text=raw.toString();
   if(body.includes('multipart/form-data')){const form=await new Request(req.url(),{method:'POST',headers:{'content-type':body},body:raw}).formData();const file=[...form.values()].find(value=>typeof value!=='string');assert(file,'uploaded page Blob');text=await file.text();}
   if(!text&&browserFiles.has(path))text=browserFiles.get(path);
   assert(text,'uploaded page bytes must be observable');
   if(files.has(path)){state.expectedErrors++;return route.fulfill({headers:cors,status:400,json:{message:'The resource already exists',statusCode:'400',error:'Duplicate'}});}
   files.set(path,text);await db.query("insert into storage.objects(bucket_id,name,metadata) values('teaching-board-pages',$1,$2)",[path,{size:Buffer.byteLength(text)}]);return route.fulfill({headers:cors,json:{Key:'teaching-board-pages/'+path}});
  }
  if(!files.has(path))return route.fulfill({status:404,headers:cors,json:{message:'missing'}});
  return route.fulfill({headers:cors,contentType:'application/json',body:files.get(path)});
 });
 return {state,row,save,files};
}
export async function verifyBoardCloud({page,base,day,cloud,check,waitFor,saveScreen,menus,readBoards,uid}){
 const board=page.getByRole('region',{name:'선생님 설명판'}),hud=menus.hud;
 await page.goto(base+`/viewer/10?class=fixture-class&day=${day}&board=1`);await board.locator('canvas').first().waitFor();
 const status=async()=>{await hud.getByRole('button',{name:'저장 상태',exact:true}).click();return hud.locator('#board-menu-status');};
 let panel=await status();await panel.getByRole('button',{name:'지금 저장',exact:true}).click();await waitFor(async()=>!!(await cloud.row(day))?.manifest);
 await panel.getByText('계정에 저장됨',{exact:true}).waitFor();await saveScreen('cloud-saved');await menus.close();
 const before=await cloud.row(day);assert(before.manifest.pages.length>=1);check('teacher drawings upload to private pages and confirm the account revision');
 // A clean device has no IndexedDB copy. Reload must download the actual pages.
 await page.goto(base+'/home');await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('manabi-teaching-boards');r.onsuccess=()=>resolve(r.result);});await new Promise((resolve,reject)=>{const tx=db.transaction('boards','readwrite');tx.objectStore('boards').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();});
 await page.goto(base+`/viewer/10?class=fixture-class&day=${day}&board=1`);await board.locator('canvas').first().waitFor();await waitFor(async()=>(await readBoards()).some(r=>r.document.accountBoard?.revision===before.revision));
 check('a device without local drafts restores the private account board and every page');
 const cached=(await readBoards()).find(r=>r.document.accountBoard),document=structuredClone(cached.document);delete document.accountBoard;
 const earlier='2026-09-09';await cloud.save(earlier,document);await menus.open('main');await hud.getByRole('button',{name:'지난 설명판',exact:true}).click();
 const history=hud.locator('#board-menu-history');await history.getByRole('button',{name:new RegExp(earlier)}).waitFor();await saveScreen('cloud-history');await history.getByRole('button',{name:new RegExp(earlier)}).click();await page.waitForURL('**day=2026-09-09**');await board.locator('canvas').first().waitFor();
 check('the board menu opens a past lesson without a team selector or losing the current drawing');
 await page.goto(base+`/viewer/10?class=fixture-class&day=${day}&board=1`);await board.locator('canvas').first().waitFor();
 // Simulate another device committing while this device still has the prior revision.
 await cloud.save(day,{...document,pages:[...document.pages,{id:'remote-page',elements:[],camera:{scrollX:0,scrollY:0,zoom:{value:1}}}]});
 await menus.action('main','페이지 메뉴');await hud.getByRole('button',{name:'새 판',exact:true}).click();panel=await status();await panel.getByRole('button',{name:'지금 저장',exact:true}).click();await panel.getByRole('button',{name:'내 초안 보관 후 최신 판 열기',exact:true}).waitFor();await saveScreen('cloud-conflict');
 assert((await readBoards()).some(r=>r.id.includes(':recovery:')));await panel.getByRole('button',{name:'내 초안 보관 후 최신 판 열기',exact:true}).click();await board.locator('canvas').first().waitFor();
 await menus.open('main');await hud.getByRole('button',{name:'충돌본 1 불러오기',exact:true}).waitFor();await menus.close();
 check('concurrent device edits preserve a recoverable local draft before loading the newer account board');
 cloud.state.offline=true;await menus.action('main','페이지 메뉴');await hud.getByRole('button',{name:'새 판',exact:true}).click();panel=await status();await panel.getByRole('button',{name:'지금 저장',exact:true}).click();await waitFor(()=>panel.getByText('이 기기에 보관됨 · 계정 저장 확인 필요',{exact:true}).isVisible());
 const offline=(await readBoards()).find(r=>r.id===r.scope&&r.document.accountBoard?.dirty);assert(offline);await saveScreen('cloud-offline');page.once('dialog',dialog=>dialog.accept());await page.reload();await board.locator('canvas').first().waitFor();assert((await readBoards()).some(r=>r.document.accountBoard?.dirty&&r.document.pages.length===offline.document.pages.length));panel=await status();cloud.state.offline=false;await panel.getByRole('button',{name:'지금 저장',exact:true}).click();await panel.getByText('계정에 저장됨',{exact:true}).waitFor();
 check('offline edits survive reload in the device draft and sync after reconnection');
 await menus.close();await menus.action('main','페이지 메뉴');await hud.getByRole('button',{name:'새 판',exact:true}).click();cloud.state.loseResponse=true;panel=await status();await panel.getByRole('button',{name:'지금 저장',exact:true}).click();await panel.getByText('계정에 저장됨',{exact:true}).waitFor();
 const count=(await cloud.row(day)).manifest.pages.length;await panel.getByRole('button',{name:'지금 저장',exact:true}).click();assert.equal((await cloud.row(day)).manifest.pages.length,count);
 check('a lost successful save response is reconciled without duplicate boards or pages');
 // A user can keep drawing while a slow 'latest board' download is in flight.
 let releaseRead;const gate={entered:false,wait:new Promise(resolve=>{releaseRead=resolve;})};cloud.state.readGate=gate;
 await panel.getByRole('button',{name:'최신 판 확인',exact:true}).click();await waitFor(()=>gate.entered);
 await menus.close();await menus.action('main','페이지 메뉴');await hud.getByRole('button',{name:'새 판',exact:true}).click();
 await waitFor(async()=>(await readBoards()).some(r=>r.id===r.scope&&r.document.accountBoard&&r.document.pages.length===count+1));releaseRead();panel=await status();await panel.getByText(/확인하는 동안 필기가 변경됐어요/).waitFor();
 assert((await readBoards()).some(r=>r.id===r.scope&&r.document.accountBoard&&r.document.pages.length===count+1));
 await panel.getByRole('button',{name:'지금 저장',exact:true}).click();await panel.getByText('계정에 저장됨',{exact:true}).waitFor();assert.equal((await cloud.row(day)).manifest.pages.length,count+1);
 check('edits made during a slow latest-board download are preserved instead of being replaced');
 for(const [width,height]of [[390,844],[1024,768]]){await page.setViewportSize({width,height});await saveScreen('cloud-status-'+width);assert(await page.locator('.viewer-layout').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 check('account status and recovery menus fit phone and tablet widths');
 await menus.close();const legacyDay='2026-09-08',legacyScope=JSON.stringify(['teaching-board',uid,'fixture-class',legacyDay]);
 await page.evaluate(async({scope,document})=>{const db=await new Promise(resolve=>{const r=indexedDB.open('manabi-teaching-boards');r.onsuccess=()=>resolve(r.result);});await new Promise((resolve,reject)=>{const tx=db.transaction('boards','readwrite');tx.objectStore('boards').put({id:scope,scope,document,revision:crypto.randomUUID(),updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();},{scope:legacyScope,document});
 await page.goto(base+`/viewer/10?class=fixture-class&day=${legacyDay}&board=1`);await board.locator('canvas').first().waitFor();await waitFor(async()=>!!(await cloud.row(legacyDay))?.manifest);assert.deepEqual((await readBoards()).find(r=>r.id===legacyScope).document,document);check('legacy device-only boards migrate to the account while the original local copy remains unchanged');
}
