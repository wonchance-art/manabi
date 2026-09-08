// Browser → actual Postgres RPC/RLS → JSON → real components. Synthetic, localhost-only fixture.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture as editingFixture} from './material-editing-backend.mjs';
const modules=process.env.COMPOSER_TEST_MODULES;
if(!modules)throw new Error('COMPOSER_TEST_MODULES required');
const {PGlite}=await import(pathToFileURL(resolve(modules,'@electric-sql/pglite/dist/index.js')).href);
export const OWNER='00000000-0000-4000-8000-000000000172';
const tables={library_collections:['id','owner_id','name','created_at'],library_collection_items:['owner_id','collection_id','target_kind','target_id','created_at'],library_reading_activity:['owner_id','target_kind','target_id','context','opened_at'],library_bookmarks:['owner_id','material_id','created_at']};
const conflicts={library_collections:'id',library_collection_items:'owner_id,collection_id,target_kind,target_id',library_reading_activity:'owner_id,target_kind,target_id',library_bookmarks:'owner_id,material_id'};
export async function fixture(options={}){
 const f=await editingFixture(options),db=new PGlite();
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
 const edition=JSON.parse(await readFile(new URL('../../src/content/textbookEditions/index.json',import.meta.url),'utf8')).current;
 await db.query('insert into textbook_book_editions values($1,$2)',['japanese-n5',edition]);
 let failMembership=false,failList=false,failRecent=false;
 const requests=[];
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-expose-headers':'content-range'};
 const json=(r,value,status=200)=>r.fulfill({status,contentType:'application/json',headers:cors,body:JSON.stringify(value)});
 let queue=Promise.resolve();
 async function sync(){await db.exec('reset role;');for(const m of f.rows){await db.query(`insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json,document_json,source_pdf_id,page_start,direction,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(id) do update set visibility=excluded.visibility,title=excluded.title,raw_text=excluded.raw_text,processed_json=excluded.processed_json,document_json=excluded.document_json`,[m.id,m.owner_id,m.visibility,m.title,m.raw_text,m.processed_json,m.document_json||null,m.source_pdf_id||null,m.page_start||null,m.direction||null,m.created_at||new Date().toISOString()]);}await db.exec(`set role authenticated;set test.uid='${OWNER}';`);}
 await f.context.route('**/rest/v1/**',async r=>{
  const req=r.request(),url=new URL(req.url()),table=url.pathname.split('/').pop();
  if(!tables[table]&&!['personal_library_page','personal_library_children'].includes(table))return r.fallback();
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
  const task=async()=>{try{
   await sync();requests.push({table,method:req.method(),payload:req.method()==='POST'?req.postDataJSON():null});
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
    for(const [k,v]of url.searchParams){if(tables[table].includes(k)&&v.startsWith('eq.')){values.push(v.slice(3));predicates.push(`${k}=$${values.length}`);}}
    const where=predicates.length?' where '+predicates.join(' and '):'';
    if(req.method()==='DELETE')result=await db.query(`delete from ${table}${where} returning *`,values);
    else if(req.method()==='PATCH'){const p=req.postDataJSON();const keys=Object.keys(p).filter(k=>tables[table].includes(k));const sets=keys.map(k=>{values.push(p[k]);return `${k}=$${values.length}`;});result=await db.query(`update ${table} set ${sets.join(',')}${where} returning *`,values);}
    else result=await db.query(`select * from ${table}${where}${table==='library_collections'?' order by created_at':''}`,values);
   }
   return json(r,req.headers().accept?.includes('vnd.pgrst.object')?result.rows[0]||null:result.rows);
  }catch(e){return json(r,{message:e.message,code:e.code},400);}};
  queue=queue.then(task,task);await queue;
 });
 return {...f,db,requests,edition,get analysisCalls(){return f.analysisCalls;},failMembership:()=>{failMembership=true;},setListFailure:value=>{failList=value;},setRecentFailure:value=>{failRecent=value;},close:async()=>{await f.context.close();await queue;await db.close();}};
}
