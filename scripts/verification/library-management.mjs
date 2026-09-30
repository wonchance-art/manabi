// Disposable PostgreSQL: lifecycle, owner boundaries, retries, undo and preserved source records.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const folder='00000000-0000-4000-8000-000000000004',child='00000000-0000-4000-8000-000000000005';
const uuid=()=>crypto.randomUUID();
const query=async(sql,args=[])=>db.query(sql,args);
const rpc=async(name,args)=> (await query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
const page=(filters={})=>rpc('personal_library_page_v2',[filters,0,100]);
const target=async(id)=>{const r=(await page()).items.find(x=>x.target_id===String(id));return {target_kind:r.target_kind,target_id:r.target_id,revision:r.revision};};
const run=async(action,keys,options={})=>{const id=uuid();await rpc('library_operation_prepare',[id,action,keys,options]);return rpc('library_operation_apply',[id,false]);};
try{
 await db.exec(`create role authenticated;create role anon;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
 create table reading_materials(id bigint primary key,owner_id uuid,visibility text,title text,raw_text text,processed_json jsonb,document_json jsonb,source_pdf_id uuid,page_start int,direction text,created_at timestamptz default now());
 create table reading_progress(material_id bigint,user_id uuid,is_completed boolean,last_token_idx int,updated_at timestamptz);
 create table uploaded_pdfs(id uuid primary key,owner_id uuid,title text,filename text,language text,lang text,level text,created_at timestamptz default now(),storage_path text,thumbnail_path text);
 create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create table textbook_book_editions(book_id text,edition_id text);insert into textbook_book_editions values('japanese-n5','old'),('japanese-n5','new');
 create table user_vocabulary(id int,meaning text,fsrs jsonb);insert into user_vocabulary values(1,'my meaning','{"due":"2027-01-01","stability":4}');
 alter table reading_materials enable row level security;alter table uploaded_pdfs enable row level security;alter table reading_progress enable row level security;
 create policy m_read on reading_materials for select using(owner_id=auth.uid() or visibility='public');
 create policy pdf_read on uploaded_pdfs for select using(owner_id=auth.uid());
 create policy rp_read on reading_progress for select using(user_id=auth.uid());
 grant usage on schema auth,public to authenticated,anon;grant select on reading_materials,uploaded_pdfs,reading_progress,textbook_book_editions,user_vocabulary to authenticated,anon;
 insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json) values
 (1,'${owner}','private','Original one','unchanged original','{"metadata":{"composer":{"version":1,"assets":[]}}}'),
 (2,'${owner}','private','Original two','second original','{}'),
 (3,'${other}','public','Public title','public body','{}'),
 (4,'${other}','private','Secret title','secret body','{}'),
 (5,'${owner}','private','Study copy','copy','{"metadata":{"composer":{"role":"study","parentId":"1"}}}');
 insert into reading_progress values(1,'${owner}',false,8,now());`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20260908025511_personal_library_catalog.sql',import.meta.url),'utf8'));
 // Existing duplicate folder names must survive migration.
 await db.exec(`set role authenticated;set test.uid='${owner}';insert into library_collections(name) values('Legacy'),('Legacy');reset role;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20260930125229_personal_library_management.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;set test.uid='${owner}';`);
 const originals=JSON.stringify((await query('select * from reading_materials order by id')).rows);
 const progress=JSON.stringify((await query('select * from reading_progress')).rows);
 const fsrs=JSON.stringify((await query('select * from user_vocabulary')).rows);
 assert.equal((await page()).total,2);
 await rpc('library_folder_change',[uuid(),'create',folder,0,'Travel',null]);
 await rpc('library_folder_change',[uuid(),'create',child,0,'Train',folder]);
 await assert.rejects(rpc('library_folder_change',[uuid(),'move',folder,1,null,child]),/cycle/);
 await assert.rejects(rpc('library_folder_change',[uuid(),'create',uuid(),0,'Travel',null]),/duplicate/);
 let result=await run('add',[await target(1)],{folder});assert.equal(result.items[0].status,'success');
 await run('add',[await target(1)],{folder:child});
 result=await run('trash',[await target(1)]);assert.equal(result.items[0].status,'success');
 assert.equal((await page()).total,1);assert.equal((await page({scope:'trash'})).total,1);
 assert.equal((await rpc('personal_library_page',[])).total,1);
 await query("insert into library_reading_activity(target_kind,target_id,context) values('material','1','{\"materialId\":\"1\",\"mode\":\"original\"}')");
 assert.equal((await page({recent:true})).total,0);assert.equal((await rpc('personal_library_page',['','','',null,'newest','','',0,20,true,null])).total,0);
 await rpc('library_operation_apply',[result.id,true]);assert.equal((await page()).total,2);
 assert.equal((await page({collection:child})).total,1);
 const stale=await target(1);
 await run('rename',[stale],{title:'My alias'});assert.equal((await page({query:'My alias'})).total,1);assert.equal((await page({query:'Original one'})).total,1);
 result=await run('trash',[stale,await target(2)]);assert.deepEqual(result.items.map(x=>x.status),['conflict','success']);
 assert.deepEqual(await rpc('library_operation_apply',[result.id,false]),result);
 await run('rename',[await target(1)],{title:'A newer alias'});
 await rpc('library_operation_apply',[result.id,true]);assert.equal((await page()).items.find(x=>x.target_id==='1').title,'A newer alias');
 result=await run('favorite',[await target(1)],{value:true});await run('rename',[await target(1)],{title:'After favorite'});
 assert.equal((await rpc('library_operation_apply',[result.id,true])).items[0].status,'undo_conflict');
 // Atomic folder movement preserves other memberships; undo removes only added destination.
 const third=uuid();await rpc('library_folder_change',[uuid(),'create',third,0,'Third',null]);
 result=await run('move',[await target(1)],{source:folder,folder:third});assert.equal(result.items[0].status,'success');
 assert.equal((await page({collection:folder})).total,0);assert.equal((await page({collection:child})).total,1);
 await rpc('library_operation_apply',[result.id,true]);assert.equal((await page({collection:folder})).total,1);assert.equal((await page({collection:third})).total,0);
 const del=await rpc('library_folder_change',[uuid(),'trash',folder,1,null,null]);assert.equal((await page({collection:child})).total,0);assert.equal((await page({scope:'unfiled'})).total,2);
 await rpc('library_folder_undo',[del.id]);assert.equal((await page({collection:child})).total,1);
 // Non-canonical study keys and private/foreign targets cannot become new library roots.
 await assert.rejects(run('trash',[{target_kind:'material',target_id:'5',revision:0}]),/invalid_library_target/);
 assert.equal((await run('save',[{target_kind:'material',target_id:'4',revision:0}])).items[0].status,'unavailable');
 await run('save',[{target_kind:'material',target_id:'3',revision:0}]);
 await db.exec("reset role;update reading_materials set visibility='private' where id=3;set role authenticated;");
 const missing=(await page()).items.find(x=>x.target_id==='3');assert.equal(missing.unavailable,true);assert.ok(!JSON.stringify(missing).includes('Public title'));
 result=await run('trash',[await target(3)]);assert.equal(result.items[0].status,'success');
 assert.equal((await run('restore',[{target_kind:'material',target_id:'3',revision:result.items[0].revision}])).items[0].status,'unavailable');
 // Same request ID must retain its payload.
 const attempt=uuid(),keys=[await target(1)];await rpc('library_operation_prepare',[attempt,'trash',keys,{}]);
 await assert.rejects(rpc('library_operation_prepare',[attempt,'favorite',keys,{value:true}]),/request_conflict/);
 await db.exec(`set test.uid='${other}';`);assert.equal(await rpc('library_operation_status',[attempt]),null);
 await assert.rejects(rpc('library_folder_change',[uuid(),'create',uuid(),0,'Foreign child',folder]),/unavailable/);
 assert.equal((await query('update library_item_state set owner_id=$1 returning *',[owner])).rows.length,0);
 await assert.rejects(query("insert into library_item_state(owner_id,target_kind,target_id) values($1,'material','4')",[owner]),/row-level security|library_owner/);
 await db.exec(`set test.uid='${owner}';`);
 // Two immutable editions remain separate entries; no content cloning.
 await run('save',[{target_kind:'edition',target_id:'old',revision:0},{target_kind:'edition',target_id:'new',revision:0}]);assert.equal((await page()).items.filter(x=>x.target_kind==='edition').length,2);
 assert.equal(JSON.stringify((await query('select * from reading_materials where id<>3 order by id')).rows),JSON.stringify(JSON.parse(originals).filter(x=>x.id!==3)));
 assert.equal(JSON.stringify((await query('select * from reading_progress')).rows),progress);assert.equal(JSON.stringify((await query('select * from user_vocabulary')).rows),fsrs);
 // An old tab must not delete the database source or a referenced PDF file.
 await db.exec(`reset role;grant delete on reading_materials,uploaded_pdfs to authenticated;
 create policy m_delete on reading_materials for delete to authenticated using(owner_id=auth.uid());
 create policy pdf_delete on uploaded_pdfs for delete to authenticated using(owner_id=auth.uid());
 grant usage on schema storage to authenticated;grant select,delete on storage.objects to authenticated;
 create policy object_read on storage.objects for select to authenticated using(true);
 create policy object_delete on storage.objects for delete to authenticated using(true);
 insert into uploaded_pdfs(id,owner_id,storage_path,thumbnail_path) values('00000000-0000-4000-8000-000000000010','${owner}','original.pdf','thumb.png');
 insert into storage.objects values('user-pdfs','original.pdf'),('user-pdfs','thumb.png'),('user-pdfs','failed-upload.pdf');
 set role authenticated;`);
 await assert.rejects(query('delete from reading_materials where id=1'),/library_use_trash/);
 await assert.rejects(query('delete from uploaded_pdfs'),/library_use_trash/);
 assert.equal((await query("delete from storage.objects where bucket_id='user-pdfs' returning name")).rows.length,1);
 assert.equal((await query('select * from storage.objects')).rows.length,2);
 // Selection uses all matches, freezes versions, and excludes later arrivals.
 await db.exec(`reset role;insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json) select i,'${owner}','private','Batch '||i,'preserved','{}' from generate_series(100,230) i;set role authenticated;`);
 const frozen=await rpc('library_selection',[{query:'Batch'}]);assert.equal(frozen.length,131);
 await db.exec(`reset role;insert into reading_materials(id,owner_id,visibility,title,processed_json) values(231,'${owner}','private','Batch late','{}');set role authenticated;`);
 const batchId=uuid();await rpc('library_operation_prepare',[batchId,'trash',frozen,{}]);
 let batch=await rpc('library_operation_apply',[batchId,false]);assert.equal(batch.items.filter(x=>x.status==='success').length,100);assert.equal(batch.items.filter(x=>x.status==='pending').length,31);
 batch=await rpc('library_operation_apply',[batchId,false]);assert.equal(batch.items.filter(x=>x.status==='success').length,131);
 assert.deepEqual(await rpc('library_operation_apply',[batchId,false]),batch);assert.equal((await page({query:'Batch'})).total,1);
 batch=await rpc('library_operation_apply',[batchId,true]);assert.equal(batch.items.filter(x=>x.status==='undone').length,100);
 batch=await rpc('library_operation_apply',[batchId,true]);assert.equal(batch.items.filter(x=>x.status==='undone').length,131);
 // Undoing a first explicit save must remove the new listing without deleting the source.
 await db.exec("reset role;insert into textbook_book_editions values('japanese-n5','never-saved');set role authenticated;");
 result=await run('save',[{target_kind:'edition',target_id:'never-saved',revision:0}]);
 await rpc('library_operation_apply',[result.id,true]);assert.equal((await page({kind:'book'})).items.some(x=>x.target_id==='never-saved'),false);
 const started=performance.now();
 await db.exec(`reset role;insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json) select i,'${owner}','private','Large '||i,'preserved','{}' from generate_series(1000,3999) i;set role authenticated;`);
 const large=await rpc('library_selection',[{query:'Large'}]);assert.equal(large.length,3000);
 const largeId=uuid();await rpc('library_operation_prepare',[largeId,'trash',large,{}]);
 const slice=await rpc('library_operation_apply',[largeId,false]);assert.equal(slice.items.filter(x=>x.status==='success').length,100);assert.equal(slice.items.filter(x=>x.status==='pending').length,2900);
 console.log(`PASS 3000-root selection + prepare + 100-item apply: ${Math.round(performance.now()-started)}ms, result ${JSON.stringify(slice).length} bytes`);
 await db.exec(`reset role;insert into reading_materials(id,owner_id,visibility,title,processed_json) select i,'${owner}','private','Limit '||i,'{}' from generate_series(5000,10000) i;set role authenticated;`);
 await assert.rejects(rpc('library_selection',[{query:'Limit'}]),/library_selection_limit/);
 // Pre-migration membership-only references stay accessible when their folder is removed.
 const legacy=uuid();await rpc('library_folder_change',[uuid(),'create',legacy,0,'Old references',null]);
 await db.exec(`reset role;insert into reading_materials(id,owner_id,visibility,title,processed_json) values(30000,'${other}','public','Legacy public reference','{}');insert into textbook_book_editions values('japanese-n5','legacy-edition');alter table library_collection_items disable trigger library_membership_guard;set role authenticated;`);
 await query("insert into library_collection_items(collection_id,target_kind,target_id) values($1,'material','30000'),($1,'edition','legacy-edition')",[legacy]);
 await db.exec('reset role;alter table library_collection_items enable trigger library_membership_guard;set role authenticated;');
 await rpc('library_folder_change',[uuid(),'trash',legacy,1,null,null]);
 assert.equal((await page({scope:'unfiled',query:'Legacy public reference'})).items[0].unavailable,false);
 assert.equal((await page({scope:'unfiled',kind:'book'})).items.some(x=>x.target_id==='legacy-edition'&&!x.unavailable),true);
 result=await run('favorite',[{target_kind:'material',target_id:'30000',revision:0}],{value:true});await rpc('library_operation_apply',[result.id,true]);
 assert.equal((await page({query:'Legacy public reference'})).total,1);
 await db.exec(`reset role;insert into reading_materials(id,owner_id,visibility,title,processed_json) values
 (30001,'${owner}','private','First chapter','{"metadata":{"book":{"key":"search-book","title":"Search book","order":1}}}'),
 (30002,'${owner}','private','Matching chapter','{"metadata":{"book":{"key":"search-book","title":"Search book","order":2}}}');set role authenticated;`);
 assert.equal((await page({query:'Matching chapter'})).items[0].match_child.id,'30002');
 await db.exec('reset role;set role anon;');await assert.rejects(page(),/permission denied/);
 // Existing privileged account deletion must not be blocked or recreate personal state.
 await db.exec('reset role;');await query('delete from auth.users where id=$1',[owner]);
 for(const table of ['library_item_state','library_collections','library_collection_items','library_private.operations','library_private.folder_operations'])assert.equal((await query(`select count(*)::int n from ${table} where owner_id=$1`,[owner])).rows[0].n,0);
 console.log('PASS: trash/restore, late activity, legacy filtering, folder tree, rename/search, partial conflict, retry, CAS undo, move delta, folder undo, canonical roots, revoked access, isolation, editions, source/progress/FSRS preservation.');
}catch(error){console.error({message:error.message,code:error.code,where:error.where,position:error.position,stack:error.code==='ERR_ASSERTION'?error.stack:undefined});process.exitCode=1;}finally{await db.close();}
