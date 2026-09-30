// Browser → actual Postgres RPC/RLS → JSON → real components. Synthetic, localhost-only fixture.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture as editingFixture} from './material-editing-backend.mjs';
const modules=process.env.COMPOSER_TEST_MODULES;
if(!modules)throw new Error('COMPOSER_TEST_MODULES required');
const {PGlite}=await import(pathToFileURL(resolve(modules,'@electric-sql/pglite/dist/index.js')).href);
export const OWNER='00000000-0000-4000-8000-000000000172';
const tables={library_item_state:['owner_id','target_kind','target_id','state','display_title','favorite','revision'],library_collections:['id','owner_id','name','created_at','parent_id','revision','deleted_at'],library_collection_items:['owner_id','collection_id','target_kind','target_id','created_at'],library_reading_activity:['owner_id','target_kind','target_id','context','opened_at'],library_bookmarks:['owner_id','material_id','created_at']};
const conflicts={library_collections:'id',library_collection_items:'owner_id,collection_id,target_kind,target_id',library_reading_activity:'owner_id,target_kind,target_id',library_bookmarks:'owner_id,material_id'};
export async function fixture(options={}){
 const f=await editingFixture(options),db=options.shared?.db||new PGlite();
 if(!options.shared){
 await db.exec(`create role authenticated;create role anon;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key);insert into auth.users values('${OWNER}');
 create table reading_materials(id bigint primary key,owner_id uuid,visibility text,title text,raw_text text,processed_json jsonb,document_json jsonb,source_pdf_id uuid,page_start int,direction text,created_at timestamptz default now());
 create table reading_progress(material_id bigint,user_id uuid,is_completed boolean,last_token_idx int,updated_at timestamptz);
 create table uploaded_pdfs(id uuid primary key,owner_id uuid,title text,filename text,language text,lang text,level text,created_at timestamptz default now(),last_page_read int default 1);
 create table textbook_book_editions(book_id text,edition_id text);
 alter table reading_materials enable row level security;alter table uploaded_pdfs enable row level security;alter table reading_progress enable row level security;
 create policy m_read on reading_materials for select using(owner_id=auth.uid() or visibility='public');
 create policy pdf_own on uploaded_pdfs for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 create policy rp_own on reading_progress for all using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant usage on schema auth,public to authenticated,anon;grant select on reading_materials,uploaded_pdfs,reading_progress,textbook_book_editions to authenticated,anon;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20260908025511_personal_library_catalog.sql',import.meta.url),'utf8'));
 if(options.management){
 await db.exec("create schema storage;create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;alter table uploaded_pdfs add column storage_path text,add column thumbnail_path text;");
 await db.exec(await readFile(new URL('../../supabase/migrations/20260930135103_personal_library_management.sql',import.meta.url),'utf8'));
 }
 if(options.bookChapters){
  await db.exec(`create sequence chapter_fixture_id start 98000;alter table reading_materials alter column id set default nextval('chapter_fixture_id');grant usage on sequence chapter_fixture_id to authenticated;grant insert,update on reading_materials to authenticated;create policy chapter_write on reading_materials for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260930154448_library_book_chapters.sql',import.meta.url),'utf8'));
 }
 if(options.sourcePassages){
  await db.exec(`create sequence passage_fixture_id start 97000;
   alter table reading_materials alter column id set default nextval('passage_fixture_id');
   create policy passage_write on reading_materials for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
   grant insert,update on reading_materials to authenticated;grant usage on sequence passage_fixture_id to authenticated;
   create unique index passage_import_once on reading_materials(owner_id,(processed_json->'metadata'->>'importAttempt'));`);
  for(const file of ['20260907221311_material_document_editing.sql','20260908060607_source_passage_study.sql','20260908070150_source_passage_token_correction.sql'])await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'));
 }
 if(options.originalPositions)await db.exec(await readFile(new URL('../../supabase/migrations/20260908083442_original_reading_positions.sql',import.meta.url),'utf8'));
 }
 const edition=JSON.parse(await readFile(new URL('../../src/content/textbookEditions/index.json',import.meta.url),'utf8')).current;
 if(!options.shared)await db.query('insert into textbook_book_editions values($1,$2)',['japanese-n5',edition]);
 let failMembership=false,failList=false,failRecent=false,losePassageReply=false,failPositions=false,losePositionReply=false;
 const requests=[];
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-expose-headers':'content-range'};
 const json=(r,value,status=200)=>r.fulfill({status,contentType:'application/json',headers:cors,body:JSON.stringify(value)});
 const queueState=options.shared?.queueState||{queue:Promise.resolve()};
 async function sync(){await db.exec('reset role;');for(const m of f.rows){if((await db.query('select 1 from reading_materials where id=$1',[m.id])).rows.length){await db.query('update reading_materials set visibility=$1,title=$2,raw_text=$3,processed_json=$4,document_json=$5 where id=$6',[m.visibility,m.title,m.raw_text,m.processed_json,m.document_json||null,m.id]);continue;}await db.query(`insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json,document_json,source_pdf_id,page_start,direction,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do update set visibility=excluded.visibility,title=excluded.title,raw_text=excluded.raw_text,processed_json=excluded.processed_json,document_json=excluded.document_json`,[m.id,m.owner_id,m.visibility,m.title,m.raw_text,m.processed_json,m.document_json||null,m.source_pdf_id||null,m.page_start||null,m.direction||null,m.created_at||new Date().toISOString()]);}await db.exec(`set role authenticated;set test.uid='${OWNER}';`);}
 await f.context.route('**/rest/v1/**',async r=>{
  const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();
  const managementRpc=options.management&&['personal_library_page_v2','library_selection','library_operation_status','library_operation_prepare','library_operation_apply','library_canonical_target','library_folder_change','library_folder_undo',...(options.bookChapters?['library_book_chapters','library_book_add_chapters','library_book_set_order']:[])].includes(table);
  const passageSelect=options.sourcePassages&&table==='reading_materials'&&url.searchParams.get('select')?.includes('passage:');
  const chapterSelect=options.bookChapters&&table==='reading_materials'&&(url.searchParams.get('select')?.includes('processed_json->metadata->book')||url.searchParams.has('processed_json->metadata->book->>key'));
  const positionRpc=options.originalPositions&&['get_original_reading_positions','save_original_reading_position'].includes(table);
  const passageRpc=options.sourcePassages&&['open_source_passage','source_passage_analysis','correct_source_passage_token'].includes(table);
  if(!tables[table]&&!['personal_library_page','personal_library_children'].includes(table)&&!passageSelect&&!chapterSelect&&!passageRpc&&!positionRpc&&!managementRpc)return r.fallback();
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
  const task=async()=>{try{
   await sync();requests.push({table,method:req.method(),payload:req.method()==='POST'?req.postDataJSON():null});
   if(chapterSelect){const key=url.searchParams.get('processed_json->metadata->book->>key')?.slice(3)||null,owner=url.searchParams.get('owner_id')?.slice(3);return json(r,(await db.query("select id,title,raw_text,created_at,processed_json->>'status' status,processed_json#>>'{metadata,language}' language,processed_json#>>'{metadata,level}' level,processed_json#>'{metadata,book}' book from reading_materials where ($1::text is null or processed_json#>>'{metadata,book,key}'=$1) and processed_json#>'{metadata,book}' is not null and owner_id=$2 order by created_at desc,id desc limit $3",[key,owner,Number(url.searchParams.get('limit')||500)])).rows);}
   if(managementRpc){
    const p=req.postDataJSON(),keys=Object.keys(p).filter(k=>/^p_[a-z_]+$/.test(k));
    if(table==='personal_library_page_v2'&&((failRecent&&p.p_filters?.recent)||(failList&&!p.p_filters?.recent)))return json(r,{message:'fixture read failure'},503);
    const result=await db.query(`select ${table}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) data`,keys.map(k=>Array.isArray(p[k])?JSON.stringify(p[k]):p[k]));
    if(['library_book_add_chapters','library_book_set_order'].includes(table)){const records=(await db.query('select * from reading_materials')).rows;for(const record of records){const old=f.rows.find(item=>String(item.id)===String(record.id));if(old)Object.assign(old,record);else f.rows.push(record);}if(options.loseChapterReply?.())return r.abort('failed');}
    if(table==='library_operation_apply'&&options.loseLibraryReply?.()){return r.abort('failed');}
    return json(r,result.rows[0].data);
   }
   if(positionRpc){
    if(failPositions)return json(r,{message:'offline position service'},503);
    const p=req.postDataJSON();
    const result=table==='get_original_reading_positions'?await db.query('select get_original_reading_positions($1,$2,$3) data',[p.p_owner,p.p_material,p.p_keys]):await db.query('select save_original_reading_position($1,$2,$3,$4,$5,$6) data',[p.p_owner,p.p_material,p.p_source,p.p_locator,p.p_version,p.p_write]);
    if(table==='save_original_reading_position'&&losePositionReply){losePositionReply=false;return r.abort('failed');}
    return json(r,result.rows[0].data);
   }
   if(passageRpc){
    const p=req.postDataJSON();
    const result=table==='correct_source_passage_token'?await db.query('select correct_source_passage_token($1,$2,$3,$4) data',[p.p_id,p.p_token,p.p_before,p.p_corrections]):table==='open_source_passage'?await db.query('select open_source_passage($1,$2,$3,$4) data',[p.p_parent,p.p_source,p.p_text,p.p_language]):await db.query('select source_passage_analysis($1,$2,$3) data',[p.p_id,p.p_attempt,p.p_json]);
    const data=result.rows[0].data,record=data.material||data;
    const old=f.rows.find(item=>String(item.id)===String(record.id));if(old)Object.assign(old,record);else f.rows.push(record);
    if(table==='open_source_passage'&&losePassageReply){losePassageReply=false;return r.abort('failed');}
    return json(r,data);
   }
   if(passageSelect){
    const parent=url.searchParams.get('processed_json->metadata->composer->>parentId')?.slice(3);
    const all=(await db.query(`select id,title,raw_text,processed_json->'metadata'->>'language' language,processed_json->'metadata'->'composer'->'passage' passage,processed_json->>'status' status from reading_materials where processed_json->'metadata'->'composer'->>'parentId'=$1 and processed_json->'metadata'->'composer'->'passage' is not null order by created_at desc,id desc`,[parent])).rows;
    const offset=Number(url.searchParams.get('offset')||0),items=all.slice(offset,offset+20);
    return r.fulfill({status:200,contentType:'application/json',headers:{...cors,'content-range':`${offset}-${offset+items.length-1}/${all.length}`},body:JSON.stringify(items)});
   }
   if(table==='personal_library_page'){
    const p=req.postDataJSON();if((failRecent&&p.p_recent)||(failList&&!p.p_recent))return json(r,{message:'fixture read failure'},503);
    const keys=Object.keys(p).filter(k=>/^p_(query|language|kind|collection|sort|state|level|offset|limit|recent|pinned)$/.test(k));
    const result=await db.query(`select personal_library_page(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) data`,keys.map(k=>p[k]));return json(r,result.rows[0].data);
   }
   if(table==='personal_library_children'){const p=req.postDataJSON();const result=await db.query('select personal_library_children($1,$2,$3) data',[p.p_kind,p.p_id,p.p_offset]);return json(r,result.rows[0].data);}
   let result;
   if(req.method()==='POST'){
    if(table==='library_collection_items'&&failMembership){failMembership=false;return json(r,{message:'fixture membership failure'},503);}
    const p=req.postDataJSON(),keys=Object.keys(p).filter(k=>tables[table].includes(k));
    const mode=req.headers().prefer?.includes('resolution=ignore-duplicates')?'do nothing':`do update set ${keys.filter(k=>!conflicts[table].split(',').includes(k)).map(k=>`${k}=excluded.${k}`).join(',')}`;
    result=await db.query(`insert into ${table}(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')}) on conflict(${conflicts[table]}) ${mode==='do update set '?'do nothing':mode} returning *`,keys.map(k=>p[k]));
   }else{
    const predicates=[],values=[];
    for(const [k,v]of url.searchParams){if(tables[table].includes(k)&&v==='is.null'){predicates.push(`${k} is null`);continue;}if(tables[table].includes(k)&&v.startsWith('neq.')){values.push(v.slice(4));predicates.push(`${k}<>$${values.length}`);continue;}if(tables[table].includes(k)&&v.startsWith('eq.')){values.push(v.slice(3));predicates.push(`${k}=$${values.length}`);}}
    const where=predicates.length?' where '+predicates.join(' and '):'';
    if(req.method()==='DELETE')result=await db.query(`delete from ${table}${where} returning *`,values);
    else if(req.method()==='PATCH'){const p=req.postDataJSON();const keys=Object.keys(p).filter(k=>tables[table].includes(k));const sets=keys.map(k=>{values.push(p[k]);return `${k}=$${values.length}`;});result=await db.query(`update ${table} set ${sets.join(',')}${where} returning *`,values);}
    else result=await db.query(`select * from ${table}${where}${table==='library_collections'?' order by created_at':''}`,values);
   }
   return json(r,req.headers().accept?.includes('vnd.pgrst.object')?result.rows[0]||null:result.rows);
  }catch(e){return json(r,{message:e.message,code:e.code,details:e.detail},400);}};
  queueState.queue=queueState.queue.then(task,task);await queueState.queue;
 });
 return {...f,db,requests,edition,shared:{db,rows:f.rows,objects:f.objects,queueState},setPositionFailure:value=>{failPositions=value;},losePositionReply:()=>{losePositionReply=true;},losePassageReply:()=>{losePassageReply=true;},get analysisCalls(){return f.analysisCalls;},failMembership:()=>{failMembership=true;},setListFailure:value=>{failList=value;},setRecentFailure:value=>{failRecent=value;},close:async()=>{await f.context.close();await queueState.queue;if(!options.shared)await db.close();}};
}
