import {build} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Continue the teacher's *actual UI writes* against the same disposable DB.
// Auth identities/network transport are synthetic; the vocabulary route, SQL, RLS,
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
  assert(['classroom_copy_state','classroom_update_copy','classroom_save_vocabulary'].includes(name));
  try{const args=name==='classroom_save_vocabulary'?[a.p_owner,a.p_root,a.p_generation,a.p_material,a.p_expected_raw,a.p_expected_json,a.p_word,a.p_source,a.p_initial,a.p_confirm_id,a.p_confirm_meaning]:[a.p_owner,a.p_root,a.p_generation,a.p_source,...(name==='classroom_copy_state'?[a.p_create,a.p_preferred]:[a.p_expected,a.p_source_revision,a.p_next])];
   return {data:(await service(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result};
  }catch(error){return {error:{code:error.code,message:error.message,details:error.detail}};}
 },from:table=>{const filters=[];const run=async()=>{try{assert(['reading_materials','user_vocabulary','vocabulary_contexts','token_corrections'].includes(table));if(table==='token_corrections')return {data:[]};
   const found=await service(`select * from ${table}`);return {data:found.rows.filter(row=>filters.every(([key,value])=>String(row[key])===String(value)))};
  }catch(error){return {error:{code:error.code,message:error.message}};}};
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,range:run,maybeSingle:async()=>{const r=await run();return {...r,data:r.data?.[0]||null};},then:(ok,bad)=>run().then(ok,bad)};return q;}};
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
 const user={id:student,aud:'authenticated',role:'authenticated',email:'release-student@example.com',email_confirmed_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{},identities:[]};
 const session={user,access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:student,aud:'authenticated',role:'authenticated',exp:now+3600,iat:now})}.fixture`,refresh_token:'fixture',expires_at:now+3600,expires_in:3600,token_type:'bearer'};
 const entry=path.join(out,'release-entry.js');
 if(!fs.existsSync(path.join(out,'node_modules')))fs.symlinkSync(path.resolve('node_modules'),path.join(out,'node_modules'),'dir');
 fs.writeFileSync(entry,[
  `export * from ${JSON.stringify(path.resolve('src/lib/server/classIndex.js'))};`,
  `export * from ${JSON.stringify(path.resolve('src/lib/server/classAccess.js'))};`,
  `export * from ${JSON.stringify(path.resolve('src/lib/classStudyHistory.js'))};`,
  `export * from ${JSON.stringify(path.resolve('src/lib/learningSources.js'))};`,
  `export {saveClassroomMetadata,classMeaningPatch,classroomEntries} from ${JSON.stringify(path.resolve('src/lib/classroomModel.js'))};`,
  `export {POST as wordPost,GET as contextGet} from ${JSON.stringify(path.resolve('src/app/api/class/[team]/vocabulary/route.js'))};`,
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
 report.classRequests=[];context.on('response',response=>{const url=new URL(response.url());if(url.pathname.includes('/api/class/')||url.pathname.includes('/rest/v1/reading_materials'))report.classRequests.push({path:url.pathname+url.search,status:response.status()});});
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
  if(['user_vocabulary','vocabulary_contexts'].includes(table)){data=(await mine(`select * from ${table}`)).rows;for(const key of ['id','vocabulary_id','user_id']){const value=url.searchParams.get(key);if(value?.startsWith('eq.'))data=data.filter(row=>String(row[key])===value.slice(3));}}
  return r.fulfill({headers:cors,json:single?data[0]||null:data});
 });
 await context.route('**/api/class/fixture-class**',async r=>{
  const req=r.request(),url=new URL(req.url()),access=authorize(new Request(req.url(),{headers:req.headers()}));
  if(access.error)return r.fulfill({status:401,json:{error:'unauthorized'}});
  if(url.pathname.endsWith('/copy')){const response=await contracts.copyPost(new Request(req.url(),{method:'POST',headers:req.headers(),body:req.postData()}),{params:Promise.resolve({team:teamKey})});return r.fulfill({status:response.status,json:await response.json()});}
  if(url.pathname.includes('/material/')){const row=(await ownerRows()).find(row=>String(row.id)===url.pathname.split('/').pop()),kind=contracts.materialBelongsToTeam(row,team,root);return r.fulfill(kind?{json:{...contracts.toPayload(row,kind),textbookAnnotations:[]}}:{status:404,json:{error:'not_found'}});}
  if(url.pathname.endsWith('/vocabulary')){const fn=req.method()==='GET'?contracts.contextGet:contracts.wordPost;const response=await fn(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}: {})}),{params:Promise.resolve({team:teamKey})});return r.fulfill({status:response.status,json:await response.json()});}
  const list=await index();
  if(url.pathname.endsWith('/history')){
   const all=await ownerRows(),notes=list.notes.map(n=>({...n,entries:contracts.classHistoryEntries(all.find(r=>r.id===n.id),list.chapters.map(c=>c.id))}));
   return r.fulfill({json:{notes:contracts.filterClassHistory(notes,url.searchParams.get('q')||'',url.searchParams.get('extras')==='true'),coverage:[],next:null}});
  }
  return r.fulfill({json:list});
 });
 await context.route('**/api/learning/vocabulary?*',async r=>{const id=new URL(r.request().url()).searchParams.get('id');const rows=(await mine('select * from vocabulary_contexts where vocabulary_id=$1',[id])).rows;return r.fulfill({json:{contexts:rows.map(c=>({...c,href:contracts.sourceHref(c)}))}});});
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
  await history.getByRole('button',{name:'노트 열기 →',exact:true}).click();await page.waitForURL(/\/viewer\/local(?:%3A|:)\d+/i);
  assert.equal((await mine('select * from reading_materials')).rows.length,0);
  const copy=contracts.toPayload(note,'note');
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
  await inspector.getByRole('button',{name:/알맞음.*2일 뒤/}).click();
  await page.getByRole('button',{name:'이 문맥 추가',exact:true}).waitFor();
  const saved=(await mine('select * from user_vocabulary')).rows;assert.equal(saved.length,1);assert.equal(saved[0].meaning,'배우다, 공부하다');assert(saved[0].interval>0);assert.equal(saved[0].source_material_id,null);
  const contexts=(await mine('select * from vocabulary_contexts')).rows;assert.equal(contexts.length,1);assert.equal(contexts[0].kind,'class');assert.equal(contexts[0].locator.materialId,String(note.id));
  const originalWord=JSON.stringify(saved[0]);
  await page.getByRole('button',{name:'이 문맥 추가',exact:true}).click();await page.getByText('이미 담아둔 문맥이에요.',{exact:true}).waitFor();
  assert.equal(JSON.stringify((await mine('select * from user_vocabulary')).rows[0]),originalWord);
  await page.getByRole('link',{name:'← 팀 페이지',exact:true}).click();await page.getByRole('button',{name:'수업 기록',exact:true}).click();await history.getByRole('button',{name:'노트 열기 →',exact:true}).click();await page.waitForURL(/\/viewer\/local(?:%3A|:)\d+/i);
  check('student reads class original, saves a graded word+class context atomically, and reopens with zero personal copies; repeats preserve the SRS row');
  // Simulate its due date in this disposable DB, then use the actual review UI.
  await mine("update user_vocabulary set next_review_at=now()-interval '1 minute' where id=$1",[saved[0].id]);
  await page.goto(base+'/vocab');
  await page.locator('summary[aria-label="단어장 도구"]').click();
  await page.getByRole('combobox',{name:'복습 방식',exact:true}).selectOption('flash');
  await page.getByRole('button',{name:'단어만 1개 →',exact:true}).click();
  await page.getByRole('progressbar',{name:'복습 진행'}).waitFor();
  // Source is on the revealed answer card; do not grade it during this return test.
  await page.getByRole('button',{name:'정답 확인하기',exact:true}).click();
  const returnLink=page.getByRole('link',{name:'이 문장 열기 ↗',exact:true});await returnLink.waitFor();
  const href=await returnLink.getAttribute('href');assert.equal(href,contracts.sourceHref(contexts[0]));
  await page.screenshot({path:out+'/student-review-class-source.png'});report.screens.push('student-review-class-source.png');
  const popupPromise=page.waitForEvent('popup');await returnLink.click();const returned=await popupPromise;
  await returned.locator('.learning-source-highlight[data-source-token="'+tokenId+'"]').waitFor();
  try{
   await returned.locator('.learning-source-highlight[data-source-token="'+tokenId+'"] .surface').click();
   await returned.locator('.viewer-inspector').getByText('배우다, 공부하다',{exact:true}).waitFor();
  }catch(error){await returned.screenshot({path:out+'/student-return-failure.png'});fs.writeFileSync(out+'/student-return-failure.txt',await returned.locator('body').innerText());throw error;}
  await returned.screenshot({path:out+'/student-direct-context-return.png'});report.screens.push('student-direct-context-return.png');await returned.close();
  check('real review answer displays the saved class context and opens its exact source in a new tab without replacing the review');
  assert.equal((await mine('select * from reading_materials where owner_id=$1',[uid])).rows.length,0);
  assert.equal((await mine('select * from class_teaching_boards')).rows.length,0);
  assert.equal((await mine("select * from storage.objects where bucket_id='teaching-board-pages'")).rows.length,0);
  await assert.rejects(mine('select classroom_append_entry(1,$1,$2,$3)',[day,'student intrusion',crypto.randomUUID()]),{code:'42501'});
  await assert.rejects(mine('select teaching_board_prepare(1,$1)',[day]),{code:'42501',message:'teacher_required'});
  check('actual student RLS denies teacher originals, board rows and storage objects; direct teaching mutation RPCs reject the student');
  const original=(await service('select * from reading_materials where id=$1',[note.id])).rows[0];assert.equal(JSON.stringify(original),before);
  assert.deepEqual((await db.query('select * from class_teaching_boards')).rows,boards);
  assert.equal((await mine('select * from reading_materials')).rows.length,0);
  check('student reading leaves teacher records and private boards unchanged; no personal material was created');
  const teacherClient={rpc:async(name,args)=>{assert.equal(name,'viewer_replace_analysis');return {data:(await execAs('authenticated',uid,tx=>tx.query('select viewer_replace_analysis($1,$2,$3,$4,$5,$6) result',[args.p_id,args.p_expected_raw,args.p_expected_json,args.p_raw,args.p_json,args.p_attempt]))).rows[0].result};}};
  const entry=contracts.classroomEntries(original).find(e=>e.text==='学习');
  const changed=await contracts.saveClassroomMetadata(teacherClient,original,contracts.classMeaningPatch(original,entry,'본받다, 배우다'));
  assert.equal(changed.processed_json.dictionary[tokenId].meaning,'본받다, 배우다');
  await page.goto(base+href);await page.locator('.learning-source-highlight[data-source-token="'+tokenId+'"] .surface').click();
  await page.locator('.viewer-inspector').getByText('본받다, 배우다',{exact:true}).waitFor();
  // The due fixture uses the inline review controls; the direct API conflict is
  // checked here against the same UI-published source and private student word.
  const requestBody={source:{kind:'class',team:teamKey,materialId:String(note.id),tokenId,revision:contracts.revisionOf(original)},word:{word_text:'学习',meaning:'배우다, 공부하다',language:'Chinese'}};
  const post=async payload=>contracts.wordPost(new Request('https://manabi.invalid/api/class/fixture-class/vocabulary',{method:'POST',headers:{'x-class-token':token},body:JSON.stringify(payload)}),{params:Promise.resolve({team:teamKey})});
  assert.equal((await post(requestBody)).status,409);
  requestBody.source.revision=contracts.revisionOf(changed);
  const conflict=await post(requestBody);assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'meaning_conflict');
  assert.equal((await mine('select meaning from user_vocabulary where id=$1',[saved[0].id])).rows[0].meaning,'배우다, 공부하다');
  const beforeConfirmation=(await mine('select * from user_vocabulary where id=$1',[saved[0].id])).rows[0];
  await page.getByRole('button',{name:'이 문맥 추가',exact:true}).click();
  const meaningCheck=page.getByRole('group',{name:'뜻 확인'});await meaningCheck.getByText('본받다, 배우다',{exact:true}).waitFor();
  await meaningCheck.getByRole('button',{name:'같은 뜻이에요 · 문맥 추가',exact:true}).click();await page.getByText('이미 담아둔 문맥이에요.',{exact:true}).waitFor();
  assert.deepEqual((await mine('select * from user_vocabulary where id=$1',[saved[0].id])).rows[0],beforeConfirmation);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/student-direct-mobile.png'});report.screens.push('student-direct-mobile.png');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('later teacher edits reach the mobile reader; stale saves and conflicting personal meanings fail safely');

 }catch(error){await page.screenshot({path:out+'/student-failure.png'});fs.writeFileSync(out+'/student-failure.txt',page.url()+'\n'+await page.locator('body').innerText()+'\n'+JSON.stringify(report.classRequests,null,2));throw error;}finally{await context.close();delete globalThis.__releaseQA;await db.exec('SET ROLE authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);}
}
