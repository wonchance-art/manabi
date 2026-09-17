import {build} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Continue the teacher's *actual UI writes* against the same disposable DB.
// Auth identities/network transport are synthetic; the copy route, SQL, RLS,
// signed-token verification and student React pages are production code.
export async function verifyClassRelease({browser,db,uid,day,base,out,report,check}){
 const student='00000000-0000-4000-8000-000000000088',teamKey='fixture-class';
 await db.exec('RESET ROLE');await db.query('INSERT INTO auth.users VALUES($1)',[student]);
 const rows=(await db.query('select * from reading_materials where owner_id=$1',[uid])).rows;
 const root=rows.find(r=>r.processed_json.metadata?.team?.root),team=root.processed_json.metadata.team;
 const note=rows.find(r=>r.processed_json.metadata?.team?.day===day);
 const before=JSON.stringify(note),boards=(await db.query('select * from class_teaching_boards')).rows;
 assert(boards.some(b=>b.manifest),'teacher private cloud board exists before student verification');
 const execAs=(role,who,fn)=>db.transaction(async tx=>{await tx.exec(`SET LOCAL ROLE ${role}`);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who]);return fn(tx);});
 const mine=(sql,args=[])=>execAs('authenticated',student,tx=>tx.query(sql,args));
 const service=(sql,args=[])=>execAs('service_role',student,tx=>tx.query(sql,args));
 const admin={rpc:async(name,a)=>{
  assert(['classroom_copy_state','classroom_update_copy'].includes(name));
  try{const args=[a.p_owner,a.p_root,a.p_generation,a.p_source,...(name==='classroom_copy_state'?[a.p_create,a.p_preferred]:[a.p_expected,a.p_source_revision,a.p_next])];
   return {data:(await service(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result};
  }catch(error){return {error:{code:error.code,message:error.message}};}
 },from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:[]})};return q;}};
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const user={id:student,aud:'authenticated',role:'authenticated',email:'release-student@example.com',app_metadata:{provider:'email'},user_metadata:{},identities:[]};
 const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:student,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
 const entry=path.join(out,'release-entry.js');
 if(!fs.existsSync(path.join(out,'node_modules')))fs.symlinkSync(path.resolve('node_modules'),path.join(out,'node_modules'),'dir');
 fs.writeFileSync(entry,[
  `export * from ${JSON.stringify(path.resolve('src/lib/server/classIndex.js'))};`,
  `export * from ${JSON.stringify(path.resolve('src/lib/server/classAccess.js'))};`,
  `export * from ${JSON.stringify(path.resolve('src/lib/classStudyHistory.js'))};`,
  `export {POST as copyPost} from ${JSON.stringify(path.resolve('src/app/api/class/[team]/copy/route.js'))};`,
 ].join('\n'));
 await build({configFile:false,publicDir:false,logLevel:'error',resolve:{alias:{'@':path.resolve('src')}},build:{ssr:entry,minify:false,outDir:out,emptyOutDir:false,rollupOptions:{output:{entryFileNames:'release-contracts.mjs'}}},plugins:[{name:'fixture-identities-only',transform(code,id){
  if(id.endsWith('/src/lib/server/auth.js'))return 'export async function requireUser(){return {user:globalThis.__releaseQA.user}}';
  if(id.endsWith('/src/app/api/class/[team]/route.js'))return 'export async function authorizeTeamRequest(request){return globalThis.__releaseQA.authorize(request)}';
 }}]});
 const contracts=await import(path.join(out,'release-contracts.mjs'));
 const secret='synthetic-release-token-secret-only',exp=Date.now()+600000;
 const token=contracts.signToken({team:teamKey,gen:team.pwGen,exp},secret);
 const authorize=request=>{const v=contracts.verifyToken(request.headers.get('x-class-token'),secret);return v.ok&&v.team===teamKey&&v.gen===team.pwGen?{admin,root,team}:{error:Response.json({error:'unauthorized'},{status:401})};};
 globalThis.__releaseQA={user,authorize};
 const ownerRows=()=>service('select * from reading_materials where owner_id=$1',[uid]).then(r=>r.rows);
 const index=async()=>{const all=await ownerRows();return contracts.indexFromRows({team,chapterRows:all.filter(r=>r.processed_json.metadata?.book),noteRows:all.filter(r=>r.processed_json.metadata?.team)});};
 const context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'});context.setDefaultTimeout(25000);
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await context.route(base+'/**',r=>r.continue({headers:{...r.request().headers(),cookie:''}}));
 await context.route('**/api/**',r=>r.fulfill({json:{}}));
 await context.route('**/auth/v1/**',r=>r.fulfill({headers:cors,json:r.request().url().includes('/user')?user:session}));
 await context.route('**/rest/v1/**',async r=>{
  const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),single=req.headers().accept?.includes('vnd.pgrst.object');
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
  if(req.method()==='HEAD')return r.fulfill({headers:{...cors,'content-range':'*/0'},body:''});
  if(table==='profiles')return r.fulfill({headers:cors,json:{id:student,display_name:'학생 검수',role:'student',onboarded:true,last_login_at:new Date().toISOString(),learning_language:['Chinese']}});
  let data=[];
  if(table==='reading_materials'){
   data=(await mine('select * from reading_materials')).rows;
   for(const key of ['id','owner_id','visibility']){const value=url.searchParams.get(key);if(value?.startsWith('eq.'))data=data.filter(row=>String(row[key])===value.slice(3));}
   for(const key of ['key','day','root']){const value=url.searchParams.get(`processed_json->metadata->team->>${key}`);if(value?.startsWith('eq.'))data=data.filter(row=>String(row.processed_json.metadata.team?.[key])===value.slice(3));}
   if(url.searchParams.get('select')?.includes('source_ref'))data=data.filter(r=>r.processed_json.metadata.source_ref).map(r=>({...r,source_ref:r.processed_json.metadata.source_ref}));
  }
  return r.fulfill({headers:cors,json:single?data[0]||null:data});
 });
 await context.route('**/api/class/fixture-class**',async r=>{
  const req=r.request(),url=new URL(req.url()),access=authorize(new Request(req.url(),{headers:req.headers()}));
  if(access.error)return r.fulfill({status:401,json:{error:'unauthorized'}});
  if(url.pathname.endsWith('/copy')){const response=await contracts.copyPost(new Request(req.url(),{method:'POST',headers:req.headers(),body:req.postData()}),{params:Promise.resolve({team:teamKey})});return r.fulfill({status:response.status,json:await response.json()});}
  const list=await index();
  if(url.pathname.endsWith('/history')){
   const all=await ownerRows(),notes=list.notes.map(n=>({...n,entries:contracts.classHistoryEntries(all.find(r=>r.id===n.id),list.chapters.map(c=>c.id))}));
   return r.fulfill({json:{notes:contracts.filterClassHistory(notes,url.searchParams.get('q')||'',url.searchParams.get('extras')==='true'),coverage:[],next:null}});
  }
  return r.fulfill({json:list});
 });
 await context.addInitScript(({token,exp})=>localStorage.setItem('class_unlock:fixture-class',JSON.stringify({token,exp,pwGen:1,name:'목요일의 중국어'})),{token,exp});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push('student: '+e.message));
 try{
  await page.goto(base+'/auth');await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'로그인',exact:true}).last().click();await page.waitForURL('**/home');await page.waitForLoadState('networkidle');
  await page.goto(base+'/class/fixture-class?view=history');await page.getByRole('heading',{name:'목요일의 중국어',exact:true}).waitFor();
  const history=page.getByRole('region',{name:'수업 돌아보기'});await history.getByText('学习',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'설정',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'수업 시작',exact:true}).count(),0);
  for(const meaning of ['복습하다','연습'])await history.getByText(meaning,{exact:true}).waitFor();
  await page.screenshot({path:out+'/student-published-history.png'});report.screens.push('student-published-history.png');
  check('separate student account sees the teacher UI-published meanings in the correct day, without teacher controls');
  await history.getByRole('button',{name:'노트 열기 →',exact:true}).click();await page.waitForURL(/\/viewer\/\d+/);
  const copyId=page.url().match(/viewer\/(\d+)/)[1];assert.notEqual(copyId,String(note.id));
  const copy=(await mine('select * from reading_materials where id=$1',[copyId])).rows[0];assert.equal(copy.owner_id,student);assert.equal(copy.visibility,'private');assert.equal(copy.raw_text,note.raw_text);
  const tokenId=copy.processed_json.sequence.find(id=>copy.processed_json.dictionary[id]?.text==='学习');
  await page.locator(`[data-tid="${tokenId}"]`).click();await page.locator('.viewer-inspector').waitFor();
  const inspector=page.locator('.viewer-inspector');
  await inspector.getByText('배우다, 공부하다',{exact:true}).waitFor();
  assert.deepEqual((await inspector.locator('.reader-card-headword .rt-an').allTextContents()).map(s=>s.trim()),['xué','xí']);
  assert.equal(copy.processed_json.dictionary[tokenId].meaning,'배우다, 공부하다');
  assert.equal(copy.processed_json.dictionary[tokenId].furigana,'xué xí');
  assert.equal(await page.getByRole('region',{name:'선생님 설명판'}).count(),0);
  assert.equal(await page.getByRole('complementary',{name:'교재 안 수업 도구'}).count(),0);
  await page.screenshot({path:out+'/student-expression-inspector.png'});report.screens.push('student-expression-inspector.png');
  await page.getByRole('link',{name:'← 수업으로',exact:true}).click();await history.getByRole('button',{name:'노트 열기 →',exact:true}).click();await page.waitForURL(new RegExp('/viewer/'+copyId));
  assert.equal((await mine("select count(*)::int n from reading_materials where processed_json#>>'{metadata,source_ref}'=$1",[String(note.id)])).rows[0].n,1);
  check('student private copy and inspector retain teacher-selected meaning/reading after analysis; return and reopening reuse one canonical identity');
  assert.equal((await mine('select * from reading_materials where owner_id=$1',[uid])).rows.length,0);
  assert.equal((await mine('select * from class_teaching_boards')).rows.length,0);
  assert.equal((await mine("select * from storage.objects where bucket_id='teaching-board-pages'")).rows.length,0);
  await assert.rejects(mine('select classroom_append_entry(1,$1,$2,$3)',[day,'student intrusion',crypto.randomUUID()]),{code:'42501'});
  await assert.rejects(mine('select teaching_board_prepare(1,$1)',[day]),{code:'42501',message:'teacher_required'});
  check('actual student RLS denies teacher originals, board rows and storage objects; direct teaching mutation RPCs reject the student');
  const original=(await service('select * from reading_materials where id=$1',[note.id])).rows[0];assert.equal(JSON.stringify(original),before);
  assert.deepEqual((await db.query('select * from class_teaching_boards')).rows,boards);
  assert.equal((await index()).notes.some(n=>String(n.id)===copyId),false);
  check('student reading leaves teacher records and private boards unchanged; the student copy never becomes a shared class source');
 }finally{await context.close();delete globalThis.__releaseQA;await db.exec('SET ROLE authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);}
}
