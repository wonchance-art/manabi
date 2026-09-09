// Real PostgreSQL execution in an isolated in-memory database; no network or user records.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const modules=process.env.COMPOSER_TEST_MODULES;
if(!modules)throw new Error('COMPOSER_TEST_MODULES required');
const {PGlite}=await import(pathToFileURL(resolve(modules,'@electric-sql/pglite/dist/index.js')).href);
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const pdf='00000000-0000-4000-8000-000000000003';
const collection='00000000-0000-4000-8000-000000000004';
const edition='a'.repeat(24);
try {
 await db.exec(`create role authenticated;create role anon;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
 create table reading_materials(id bigint primary key,owner_id uuid,visibility text,title text,raw_text text,processed_json jsonb,document_json jsonb,source_pdf_id uuid,page_start int,direction text,created_at timestamptz default now());
 create table reading_progress(material_id bigint,user_id uuid,is_completed boolean,last_token_idx int,updated_at timestamptz);
 create table uploaded_pdfs(id uuid primary key,owner_id uuid,title text,filename text,language text,lang text,level text,created_at timestamptz default now(),last_page_read int default 1);
 create table textbook_book_editions(book_id text,edition_id text);
 insert into textbook_book_editions values('japanese-n5','${edition}');
 alter table reading_materials enable row level security;alter table uploaded_pdfs enable row level security;alter table reading_progress enable row level security;
 create policy m_read on reading_materials for select using(owner_id=auth.uid() or visibility='public');
 create policy pdf_own on uploaded_pdfs for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
 create policy rp_own on reading_progress for all using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant usage on schema auth,public to authenticated,anon;grant select on reading_materials,uploaded_pdfs,reading_progress,textbook_book_editions to authenticated,anon;
 insert into uploaded_pdfs(id,owner_id,title,filename) values('${pdf}','${owner}','No extracted pages','empty-source.pdf');
 insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json) values
 (1,'${owner}','private','Memo','raw-original','{"status":"note","metadata":{"language":"English","composer":{"version":1,"assets":[]}}}'),
 (2,'${owner}','private','Chapter alpha','chapter source','{"metadata":{"language":"French","book":{"key":"book-a","title":"Collected chapters","order":1}}}'),
 (3,'${owner}','private','Chapter beta','chapter source','{"metadata":{"language":"French","book":{"key":"book-a","title":"Collected chapters","order":2}}}'),
 (4,'${other}','private','Other private','do not expose','{}'),
 (5,'${other}','public','Public reader','public original','{}'),
 (6,'${owner}','private','Study copy','study source','{"metadata":{"composer":{"role":"study","parentId":"1"}}}');
 update reading_materials set document_json='{"version":1,"revision":"rev","language":"English","excerpt":"current memo","assets":[{"name":"unique-file.epub","kind":"epub","hash":"${'b'.repeat(64)}","path":"PRIVATE-PATH"}],"links":[]}' where id=1;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20260908025511_personal_library_catalog.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;set test.uid='${owner}';`);
 const page=async(args={})=>(await db.query(`select personal_library_page(p_query=>$1,p_collection=>$2,p_offset=>$3,p_limit=>$4,p_recent=>$5) result`,[args.q||'',args.collection||null,args.offset||0,args.limit||20,!!args.recent])).rows[0].result;
 let result=await page();assert.equal(result.total,3);assert.equal(result.items.length,3);
 assert.equal(result.items.some(x=>x.title==='Study copy'),false);assert.equal(result.items.some(x=>x.title==='Other private'),false);
 assert.equal((await page({q:'unique-file'})).total,1);assert.equal((await page({q:'empty-source'})).total,1);
 result=await page({q:'beta'});assert.equal(result.total,1);assert.equal(result.items[0].match_child.id,'3');
 assert.equal(JSON.stringify(await page()).includes('PRIVATE-PATH'),false);
 assert.equal(JSON.stringify((await db.query('select * from library_catalog_rows()')).rows).includes('PRIVATE-PATH'),false);
 assert.equal((await page({recent:true})).total,0);
 await db.query('insert into library_collections(id,name) values($1,$2)',[collection,'Travel']);
 await db.query("insert into library_collection_items(collection_id,target_kind,target_id) values($1,'material','1')",[collection]);
 await assert.rejects(db.query("insert into library_collection_items(collection_id,target_kind,target_id) values($1,'material','4')",[collection]),/row-level security/);
 assert.equal((await page({collection})).total,1);
 await db.query("insert into library_reading_activity(target_kind,target_id,context,opened_at) values('material','1',$1,'2000-01-01')",[{materialId:'6',mode:'study'}]);
 result=await page({recent:true});assert.equal(result.total,1);assert.equal(result.items[0].context.materialId,'6');assert.ok(new Date(result.items[0].opened_at).getFullYear()>2000);
 await assert.rejects(db.query("insert into library_reading_activity(target_kind,target_id,context) values('material','1',$1) on conflict(owner_id,target_kind,target_id) do update set context=excluded.context",[{materialId:'4',mode:'text'}]),/library_source_unavailable/);
 await assert.rejects(db.query("update library_reading_activity set context=$1",[{materialId:'1',mode:'original',assetHash:'unknown'}]),/invalid_library_asset/);
 await db.query("insert into library_bookmarks(material_id) values(5)");assert.equal((await page()).total,4);
 await db.query("insert into library_collection_items(collection_id,target_kind,target_id) values($1,'edition',$2)",[collection,edition]);assert.equal((await page({collection})).total,2);
 await db.exec(`set test.uid='${other}';`);assert.equal((await db.query('select * from library_collections')).rows.length,0);assert.equal((await db.query('select * from library_reading_activity')).rows.length,0);
 await assert.rejects(db.query("insert into library_collection_items(collection_id,target_kind,target_id) values($1,'material','4')",[collection]),/foreign key/);
 await db.exec(`set test.uid='${owner}';delete from library_collections;`);assert.equal((await db.query('select * from library_collection_items')).rows.length,0);
 assert.equal((await db.query('select raw_text from reading_materials where id=1')).rows[0].raw_text,'raw-original');assert.equal((await db.query('select * from reading_progress')).rows.length,0);
 await db.exec('reset role;update reading_materials set visibility=\'private\' where id=5;set role authenticated;');assert.equal((await page()).total,3);assert.equal((await page()).unavailable,1);
 await db.exec('reset role;');
 await db.query("insert into reading_materials(id,owner_id,visibility,title,processed_json) values(70,$1,'public','[N5 grammar #1] Retired lesson','{}')",[owner]);
 await db.exec('set role authenticated;');assert.equal((await page()).total,3);
 await db.query("insert into library_bookmarks(material_id) values(70)");assert.equal((await page()).total,4);
 await db.exec('reset role;');
 await db.query("insert into reading_materials(id,owner_id,visibility,title,source_pdf_id,processed_json) values(71,$1,'public','Shared excerpt',$2,'{}')",[other,other]);
 await db.query("insert into reading_progress(material_id,user_id,last_token_idx,is_completed,updated_at) values(71,$1,2,false,now())",[owner]);
 await db.exec('set role authenticated;');
 assert.equal((await page({recent:true})).items.find(item=>item.target_id==='71')?.target_kind,'material');
 await db.query("insert into library_reading_activity(target_kind,target_id,context) values('material','71',$1)",[{materialId:'71',mode:'text'}]);
 assert.equal((await page({recent:true})).items.find(item=>item.target_id==='71')?.context.materialId,'71');
 await db.exec('reset role;set role anon;');await assert.rejects(page(),/permission denied/);
 await db.exec('reset role;');
 for(const size of [0,1,30,300,3000]){
  await db.exec(`truncate reading_materials cascade;truncate uploaded_pdfs;truncate library_reading_activity;truncate library_bookmarks;insert into reading_materials(id,owner_id,visibility,title,raw_text,processed_json,created_at) select i,'${owner}','private','Title '||lpad(i::text,4,'0'),'body','{}', '2026-01-01'::timestamptz+i*interval '1 second' from generate_series(1,${size}) i;set role authenticated;set test.uid='${owner}';`);
  const started=performance.now();result=await page();assert.equal(result.total,size);assert.equal(result.items.length,Math.min(size,20));
  if(size>20){const next=await page({offset:20});assert.equal(next.items.length,Math.min(size-20,20));assert.equal(new Set([...result.items,...next.items].map(x=>x.target_id)).size,result.items.length+next.items.length);}
  console.log(`PASS ${size} roots: first page ${Math.round(performance.now()-started)}ms, ${JSON.stringify(result).length} bytes`);await db.exec('reset role;');
 }
 console.log('PASS: SQL grouping, current filenames, PDF zero chapters, child match, paginated roots, no private paths, collection lifecycle, public permissions, source invariants, recent context, server time, anon denial.');
} finally {await db.close();}
