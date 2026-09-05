/** Isolated PostgreSQL verification; no network or live DB connection.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/textbook-material-contexts.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002';
const pdfA='20000000-0000-0000-0000-000000000001',pdfB='20000000-0000-0000-0000-000000000002';
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
async function identity(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(`set role ${user?'authenticated':'anon'}`);}
const rows=async(sql,params=[]) => (await db.query(sql,params)).rows;
const word={word_text:'book',meaning:'책',language:'English'};
const textbook={kind:'textbook',chapterSlug:'a1-book',quote:'I read a book.',translation:'책을 읽어요.',locator:{blockId:'tb-example-123',revision:'r1'}};
const rpc=async(w=word,s=textbook,id=null,meaning=null)=>(await rows('select public.save_vocabulary_context($1::jsonb,$2::jsonb,$3::uuid,$4::text) as result',[JSON.stringify(w),JSON.stringify(s),id,meaning]))[0].result;
try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function public.is_admin() returns boolean language sql stable as $$ select false $$;
 create table reading_materials(id bigint primary key, owner_id uuid,visibility text,title text);
 create table uploaded_pdfs(id uuid primary key,owner_id uuid,title text);
 create table user_vocabulary(id uuid primary key default gen_random_uuid(),user_id uuid,word_text text,base_form text,meaning text,furigana text,pos text,language text,source_sentence text,source_material_id bigint,interval real default 0,ease_factor real default 2.5,repetitions int default 0,next_review_at timestamptz,last_reviewed_at timestamptz,unique(user_id,word_text));
 alter table reading_materials enable row level security;alter table uploaded_pdfs enable row level security;alter table user_vocabulary enable row level security;
 create policy "Enable Read for All" on reading_materials for select using (true);
 create policy pdf_own on uploaded_pdfs for all using (owner_id=auth.uid()) with check (owner_id=auth.uid());
 create policy vocab_own on user_vocabulary for all using (user_id=auth.uid()) with check (user_id=auth.uid());
 grant select,insert,update,delete on reading_materials,uploaded_pdfs,user_vocabulary to authenticated; grant select on reading_materials to anon;
 insert into auth.users values ('${a}'),('${b}');
 insert into reading_materials values(1,'${a}','private','A private'),(2,'${b}','private','B private'),(3,'${b}','public','Public');
 insert into uploaded_pdfs values('${pdfA}','${a}','A PDF'),('${pdfB}','${b}','B PDF');`);
 await db.exec('alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant execute on functions to anon,authenticated;');
 await db.exec(await fs.readFile(new URL('../migrations/20260905065205_textbook_material_contexts.sql',import.meta.url),'utf8'));
 await check('production default ALL grants are reduced to SELECT INSERT DELETE',async()=>{for(const table of ['textbook_material_links','vocabulary_contexts']){for(const privilege of ['SELECT','INSERT','DELETE'])assert.equal((await rows('select has_table_privilege($1,$2,$3) as allowed',['authenticated',table,privilege]))[0].allowed,true);for(const privilege of ['UPDATE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await rows('select has_table_privilege($1,$2,$3) as allowed',['authenticated',table,privilege]))[0].allowed,false);for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await rows('select has_table_privilege($1,$2,$3) as allowed',['anon',table,privilege]))[0].allowed,false);}});
 await check('anon sees public only despite old SELECT true policy',async()=>{await identity(null);assert.deepEqual((await rows('select id from reading_materials order by id')).map(r=>r.id),[3]);});
 await check('owner sees own and public; other private remains hidden',async()=>{await identity(a);assert.deepEqual((await rows('select id from reading_materials order by id')).map(r=>r.id),[1,3]);});
 const saved=await rpc();
 await check('new card and first context are created atomically',async()=>{assert.equal(saved.created,true);assert.equal(saved.contextAdded,true);assert.equal((await rows('select * from vocabulary_contexts')).length,1);});
 await db.query('update user_vocabulary set interval=27,ease_factor=2.9,repetitions=8,next_review_at=$1,last_reviewed_at=$2 where id=$3',['2026-10-05T00:00:00Z','2026-09-01T00:00:00Z',saved.vocabularyId]);
 const before=(await rows('select * from user_vocabulary'))[0];
 const reading={kind:'reading',materialId:'1',quote:'This book is good.',locator:{tokenId:'t1',surface:'book'}};
 const pdf={kind:'pdf',pdfId:pdfA,quote:'Open the book.',locator:{page:12,userSelected:true}};
 await check('reading and PDF contexts reuse the card and preserve every existing column',async()=>{assert.equal((await rpc(word,reading)).created,false);await rpc(word,pdf);assert.equal((await rows('select * from vocabulary_contexts')).length,3);assert.deepEqual((await rows('select * from user_vocabulary'))[0],before);});
 await check('repeated save is idempotent even when translation changes',async()=>{assert.equal((await rpc(word,{...textbook,translation:'수정된 번역'})).contextAdded,false);assert.equal((await rows('select * from vocabulary_contexts')).length,3);});
 const otherMeaning={...word,meaning:'예약하다'};
 await check('meaning mismatch requires confirmation and makes no changes',async()=>{await assert.rejects(rpc(otherMeaning,{...reading,quote:'Book a table.'}),/vocabulary_meaning_conflict/);assert.equal((await rows('select * from vocabulary_contexts')).length,3);});
 await check('stale meaning confirmation is rejected',async()=>{await assert.rejects(rpc(otherMeaning,{...reading,quote:'Book a table.'},saved.vocabularyId,'옛 뜻'),/vocabulary_meaning_conflict/);});
 await check('explicit current-card confirmation adds context without changing meaning or FSRS',async()=>{await rpc(otherMeaning,{...reading,quote:'Book a table.'},saved.vocabularyId,'책');assert.deepEqual((await rows('select * from user_vocabulary'))[0],before);});
 await check('cross-language homograph is never silently merged',async()=>{await assert.rejects(rpc({...word,language:'French'},textbook,saved.vocabularyId,'책'),/vocabulary_language_conflict/);});
 await check('unauthorized source rolls back a newly inserted card',async()=>{await assert.rejects(rpc({...word,word_text:'secret'},{...reading,materialId:'2'}),/row-level security/);assert.equal((await rows("select * from user_vocabulary where word_text='secret'")).length,0);});
 await check('foreign PDF context is blocked',async()=>{await assert.rejects(rpc(word,{...pdf,pdfId:pdfB}),/row-level security/);});
 await check('own chapter links allow reading, public reading and own PDF',async()=>{await db.query("insert into textbook_material_links(user_id,lang,chapter_slug,material_id) values($1,'English','a1-book',1),($1,'English','a1-book',3)",[a]);await db.query("insert into textbook_material_links(user_id,lang,chapter_slug,pdf_id) values($1,'English','a1-book',$2)",[a,pdfA]);assert.equal((await rows('select * from textbook_material_links')).length,3);});
 await check('foreign private links and forged owner are blocked',async()=>{await assert.rejects(db.query("insert into textbook_material_links(user_id,lang,chapter_slug,material_id) values($1,'English','a1-book',2)",[a]),/row-level security/);await assert.rejects(db.query("insert into textbook_material_links(user_id,lang,chapter_slug,material_id) values($1,'English','a1-book',1)",[b]),/row-level security/);});
 await check('another user cannot read or delete contexts and links',async()=>{await identity(b);assert.equal((await rows('select * from vocabulary_contexts')).length,0);assert.equal((await rows('select * from textbook_material_links')).length,0);await db.exec('delete from vocabulary_contexts;delete from textbook_material_links');await identity(a);assert.equal((await rows('select * from vocabulary_contexts')).length,4);assert.equal((await rows('select * from textbook_material_links')).length,3);});
 await check('making a public material private hides associated contexts and links',async()=>{await rpc(word,{...reading,materialId:'3'});await db.exec('reset role');await db.exec("update reading_materials set visibility='private' where id=3");await identity(a);assert.equal((await rows('select * from vocabulary_contexts where material_id=3')).length,0);assert.equal((await rows('select * from textbook_material_links where material_id=3')).length,0);});
 await check('context/link deletion leaves card, schedule and material untouched',async()=>{await db.exec("delete from vocabulary_contexts where material_id=1;delete from textbook_material_links where material_id=1");assert.deepEqual((await rows('select * from user_vocabulary'))[0],before);assert.equal((await rows('select * from reading_materials where id=1')).length,1);});
 await check('legacy inflected card is reused without creating a duplicate',async()=>{await db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language,interval,repetitions) values($1,'cats','cat','고양이','English',30,6)",[a]);const beforeLegacy=(await rows("select * from user_vocabulary where word_text='cats'"))[0];const result=await rpc({...word,word_text:'cat',meaning:'고양이'},{...reading,quote:'A cat.'});assert.equal(result.vocabularyId,beforeLegacy.id);assert.equal(result.created,false);assert.equal((await rows("select * from user_vocabulary where word_text='cat'")).length,0);assert.deepEqual((await rows("select * from user_vocabulary where word_text='cats'"))[0],beforeLegacy);});
 await check('ambiguous legacy cards never trigger a guessed merge or new duplicate',async()=>{await db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'dogs','dog','개','English'),($1,'doggy','dog','개','English')",[a]);await assert.rejects(rpc({...word,word_text:'dog',meaning:'개'},{...reading,quote:'A dog.'}),/vocabulary_ambiguous_match/);assert.equal((await rows("select * from user_vocabulary where word_text='dog'")).length,0);});
 await check('anonymous cannot execute save RPC',async()=>{await identity(null);await assert.rejects(rpc(),/permission denied/);});
 console.log(`${checks} PostgreSQL checks passed; no live database touched.`);
} finally {await db.close();}
