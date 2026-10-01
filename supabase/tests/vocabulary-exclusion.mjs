// 기존 PGlite SQL 검수 방식. 일회용 DB만 사용하며 운영 연결/계정 상태를 읽지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002';
const rows=async(sql,p=[]) => (await db.query(sql,p)).rows;
let checks=0;
async function check(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
async function owner(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(`set role ${id?'authenticated':'anon'}`);}
const toggle=async({lang=null,word=null,id=null,excluded=true,entry=null}={}) =>
 (await rows('select public.set_vocabulary_exclusion($1,$2,$3,$4,$5) as result',[lang,word,id,excluded,entry]))[0].result;
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);grant usage on schema auth to anon,authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table user_vocabulary(id uuid primary key default gen_random_uuid(),user_id uuid,word_text text,base_form text,meaning text,language text,source_sentence text,interval real default 0,ease_factor real default 2.5,repetitions int default 0,next_review_at timestamptz,last_reviewed_at timestamptz,unique(user_id,word_text));
 create table review_events(user_id uuid,lang text,source text,item_key text,correct boolean,detail jsonb,created_at timestamptz default now());
 alter table review_events enable row level security;
 create policy event_owner on review_events for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant select,insert on review_events to authenticated;
 alter table user_vocabulary enable row level security;
 create policy vocab_owner on user_vocabulary for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant select,insert,update,delete on user_vocabulary to authenticated;
 insert into auth.users values('${a}'),('${b}');
 insert into user_vocabulary(user_id,word_text,base_form,meaning,language,source_sentence,interval,ease_factor,repetitions,next_review_at,last_reviewed_at)
 values('${a}','books','book','개인 뜻','English','my source',30,2.6,7,'2026-01-01','2025-12-01'),('${b}','book','book','B meaning','English','B source',10,3,2,'2026-01-01','2025-12-01');`);
 await db.exec(await fs.readFile(new URL('../../docs/sql/vocabulary-exclusion.sql',import.meta.url),'utf8'));
 await owner(a);
 const before=(await rows('select * from user_vocabulary'))[0];
 const saved=await toggle({lang:'English',word:'book'});
 await check('저장 카드 제외는 모든 원래 열을 보존',async()=>{
  assert.equal(saved.entry.vocabulary_id,before.id);assert.deepEqual((await rows('select * from user_vocabulary'))[0],before);
  assert.equal((await rows('select * from active_vocabulary')).length,0);
  assert.equal((await rows('select is_excluded from vocabulary_with_exclusions'))[0].is_excluded,true);
 });
 await check('제외 동안 오래된 채점 요청 거부, 개인 뜻 편집은 유지',async()=>{
  await assert.rejects(db.query('update user_vocabulary set interval=80 where id=$1',[before.id]),/vocabulary_excluded/);
  await assert.rejects(db.query("insert into review_events(user_id,lang,source,item_key,correct,detail) values($1,'English','vocab','books',true,$2)",[a,{word_id:before.id}]),/vocabulary_excluded/);
  assert.equal((await rows('select * from review_events')).length,0);
  await db.query('update user_vocabulary set meaning=$1 where id=$2',['수정한 개인 뜻',before.id]);
 });
 await check('표기 편집 후에도 연결 카드만 제외',async()=>{
  await db.query("update user_vocabulary set word_text='volume',base_form='volume' where id=$1",[before.id]);
  assert.equal((await rows('select * from active_vocabulary')).length,0);
  await db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language,next_review_at) values($1,'book','book','새 카드','English','2026-01-02')",[a]);
  assert.deepEqual((await rows('select word_text from active_vocabulary')).map(v=>v.word_text),['book']);
 });
 await check('해제는 과거 예정일 그대로 정상 도래',async()=>{
  await toggle({entry:saved.entry.id,excluded:false});
  assert.equal((await rows('select * from active_vocabulary')).length,2);
  const after=(await rows('select * from user_vocabulary where id=$1',[before.id]))[0];
  for(const key of ['interval','ease_factor','repetitions','next_review_at','last_reviewed_at','source_sentence'])assert.deepEqual(after[key],before[key]);
 });
 let unsaved;
 await check('미저장 단어 제외는 가짜 카드/평가를 만들지 않음',async()=>{
  unsaved=await toggle({lang:'Chinese',word:'和'});assert.equal(unsaved.entry.vocabulary_id,null);
  assert.equal((await rows('select * from user_vocabulary')).length,2);
  await assert.rejects(db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'和','和','뜻','Chinese')",[a]),/vocabulary_excluded/);
 });
 await check('같은 글자의 다른 언어는 제외하지 않음',async()=>{
  await db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'和','和','다른 언어','Japanese')",[a]);
  assert.equal((await rows("select * from active_vocabulary where language='Japanese'")).length,1);
 });
 await check('중복 제외는 멱등이며 미저장 항목도 해제 가능',async()=>{
  assert.equal((await toggle({lang:'Chinese',word:'和'})).entry.id,unsaved.entry.id);
  await toggle({entry:unsaved.entry.id,excluded:false});assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
 });
 await check('언어 미상은 ID로만 제외하고 언어를 수정하지 않음',async()=>{
  const legacy=(await rows("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'未知','未知','미상',null) returning *",[a]))[0];
  const result=await toggle({id:legacy.id});assert.equal(result.entry.language,'Unknown');
  assert.equal((await rows('select language from user_vocabulary where id=$1',[legacy.id]))[0].language,null);
  await toggle({entry:result.entry.id,excluded:false});
 });
 await check('같은 기본형의 구형 카드도 삭제를 막지 않고 제외 해제 경로 보존',async()=>{
  const twins=await rows("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'ran','run','뜻1','English'),($1,'running','run','뜻2','English') returning *",[a]);
  await assert.rejects(toggle({lang:'English',word:'run'}),/vocabulary_ambiguous_match/);
  const first=await toggle({id:twins[0].id}),second=await toggle({id:twins[1].id});
  assert.equal(first.entry.id,second.entry.id);
  assert.equal((await rows("select * from active_vocabulary where base_form='run'")).length,0);
  await assert.rejects(db.query("insert into review_events(user_id,lang,source,item_key,correct,detail) values($1,'English','vocab','running',true,$2)",[a,{word_id:twins[1].id}]),/vocabulary_excluded/);
  // 직접 삽입된 중복 상태도 카드 삭제를 막지 않고 단일 해제 항목으로 보존한다.
  await db.query("insert into vocabulary_exclusions(user_id,language,word_text,vocabulary_id) values($1,'English','run',$2)",[a,twins[1].id]);
  await db.query('delete from user_vocabulary where id=$1',[twins[0].id]);
  await db.query('delete from user_vocabulary where id=$1',[twins[1].id]);
  const kept=await rows("select * from vocabulary_exclusions where word_text='run'");
  assert.equal(kept.length,1);assert.equal(kept[0].vocabulary_id,null);
  for(const twin of twins) await assert.rejects(db.query("insert into review_events(user_id,lang,source,item_key,correct,detail) values($1,'English','vocab',$2,true,$3)",[a,twin.word_text,{word_id:twin.id}]),/vocabulary_excluded/);
  await assert.rejects(db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'runs','run','뜻','English')",[a]),/vocabulary_excluded/);
  await toggle({entry:kept[0].id,excluded:false});
  await db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'runs','run','새 뜻','English')",[a]);
 });
 await check('표기 편집으로 제외 키가 겹쳐도 한 번에 계정 범위를 해제',async()=>{
  const linked=await toggle({id:before.id});await toggle({lang:'English',word:'shelf'});
  const prior=(await rows('select * from user_vocabulary where id=$1',[before.id]))[0];
  await db.query("update user_vocabulary set word_text='shelf',base_form='shelf' where id=$1",[before.id]);
  assert.equal((await rows("select * from vocabulary_exclusions where language='English' and word_text='shelf'")).length,2);
  await toggle({entry:linked.entry.id,excluded:false});
  assert.equal((await rows("select * from vocabulary_exclusions where language='English' and word_text='shelf'")).length,0);
  assert.equal((await rows('select * from active_vocabulary where id=$1',[before.id])).length,1);
  const after=(await rows('select * from user_vocabulary where id=$1',[before.id]))[0];
  for(const key of ['meaning','interval','ease_factor','repetitions','next_review_at','last_reviewed_at','source_sentence'])assert.deepEqual(after[key],prior[key]);
 });
 await check('RLS와 두 view는 다른 계정 단어/제외를 반환하지 않음',async()=>{
  await toggle({id:before.id});await owner(b);
  assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
  assert.equal((await rows('select * from vocabulary_with_exclusions')).length,1);
  assert.equal((await rows('select * from active_vocabulary')).length,1);
  await assert.rejects(toggle({id:before.id}),/word_not_available/);
  await assert.rejects(toggle({entry:saved.entry.id,excluded:false}),/exclusion_not_available/);
 });
 await check('다른 소유자의 카드 연결/소유자 위조 거부',async()=>{
  await assert.rejects(db.query("insert into vocabulary_exclusions(user_id,language,word_text,vocabulary_id) values($1,'English','secret',$2)",[b,before.id]),/row-level security/);
  await assert.rejects(db.query("insert into vocabulary_exclusions(user_id,language,word_text) values($1,'English','secret')",[a]),/row-level security/);
 });
 await check('익명은 상태/뷰/RPC 접근 불가',async()=>{
  await owner(null);for(const table of ['vocabulary_exclusions','active_vocabulary','vocabulary_with_exclusions'])await assert.rejects(rows(`select * from ${table}`),/permission denied/);
  await assert.rejects(toggle({lang:'English',word:'book'}),/permission denied/);
 });
 console.log(`${checks} PostgreSQL checks passed; no live database touched.`);
} finally {await db.close();}
