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
const mark=async(lang,word)=>db.query('insert into user_known_words(user_id,lang,word_text) values($1,$2,$3) on conflict do nothing',[a,lang,word]);
const unmark=async(lang,words)=>db.query('delete from user_known_words where user_id=$1 and lang=$2 and word_text=ANY($3)',[a,lang,words]);
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
 await db.exec(await fs.readFile(new URL('../migrations/20260823170000_user_known_words.sql',import.meta.url),'utf8'));
 await db.query("insert into user_known_words(user_id,lang,word_text) values($1,'en','books')",[a]);
 const initialKnown=await rows('select * from user_known_words');
 const initialVocab=await rows('select * from user_vocabulary order by id');
 await db.exec(await fs.readFile(new URL('../../docs/sql/known-word-controls.sql',import.meta.url),'utf8'));
 await owner(a);
 const card=(await rows('select * from user_vocabulary'))[0];
 await check('기존 known의 시각·뜻·출처·SRS는 보존하고 LIMIT 전 복습 제외',async()=>{
  assert.deepEqual(await rows('select * from user_known_words'),initialKnown);
  assert.deepEqual(await rows('select * from user_vocabulary'),initialVocab.filter(v=>v.user_id===a));
  assert.equal((await rows('select * from active_vocabulary limit 1')).length,0);
  assert.equal((await rows('select * from vocabulary_exclusions')).length,2);
 });
 await check('기존 표기 books와 기본형 book은 같은 리뷰를 보호',async()=>{
  await assert.rejects(db.query('update user_vocabulary set interval=80 where id=$1',[card.id]),/vocabulary_excluded/);
  await assert.rejects(db.query("insert into review_events(user_id,lang,source,item_key,correct,detail) values($1,'English','vocab','books',true,$2)",[a,{word_id:card.id}]),/vocabulary_excluded/);
  await assert.rejects(db.query("select set_vocabulary_exclusion('English','book',null,false,null)"),/known_word_active/);
  assert.equal((await rows('select * from review_events')).length,0);
 });
 await check('옛 클라이언트의 known 직접 삭제도 보호 상태를 원자적으로 해제',async()=>{
  await unmark('en',['books']);
  assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
  assert.deepEqual((await rows('select * from active_vocabulary'))[0],{...card,is_excluded:false});
 });
 await check('미저장 아는 단어는 카드·평가를 만들지 않고 언어를 구분',async()=>{
  await mark('zh','和');await mark('ja','和');
  await assert.rejects(db.query("insert into user_vocabulary(user_id,word_text,base_form,language) values($1,'和','和','Chinese')",[a]),/vocabulary_excluded/);
  await unmark('zh',['和']);
  assert.equal((await rows("select * from vocabulary_exclusions where language='Japanese'")).length,1);
  assert.equal((await rows('select * from user_vocabulary')).length,1);
  assert.equal((await rows('select * from review_events')).length,0);
  await unmark('ja',['和']);
 });
 await check('표시 실패는 known/보호 상태 양쪽을 롤백',async()=>{
  await assert.rejects(mark('en','   '),/invalid_known_word/);
  assert.equal((await rows("select * from user_known_words where word_text='   '")).length,0);
  assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
 });
 await check('NFC 원래 키 둘 중 하나만 해제해도 다른 표시는 보존',async()=>{
  await mark('fr','é');await mark('fr','e\u0301');await mark('fr','é');
  assert.equal((await rows("select * from vocabulary_exclusions where language='French'")).length,1);
  await unmark('fr',['é']);assert.equal((await rows('select * from vocabulary_exclusions')).length,1);
  await unmark('fr',['e\u0301']);assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
 });
 await check('같은 기본형의 여러 저장 카드도 모호한 RPC 없이 함께 빠짐',async()=>{
  await db.query("insert into user_vocabulary(user_id,word_text,base_form,meaning,language) values($1,'ran','run','뜻1','English'),($1,'running','run','뜻2','English')",[a]);
  await mark('en','run');assert.equal((await rows("select * from active_vocabulary where base_form='run'")).length,0);
  await unmark('en',['run']);assert.equal((await rows("select * from active_vocabulary where base_form='run'")).length,2);
 });
 await check('카드를 삭제해도 옛 표기의 해제와 삭제 ID의 오프라인 차단 유지',async()=>{
  await mark('en','books');await db.query('delete from user_vocabulary where id=$1',[card.id]);
  await assert.rejects(db.query("insert into review_events(user_id,lang,source,item_key,correct,detail) values($1,'English','vocab','books',true,$2)",[a,{word_id:card.id}]),/vocabulary_excluded/);
  await unmark('en',['books']);assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
 });
 await check('관련 과거 제외도 명시적으로 해제하되 무관한 제외는 보존',async()=>{
  await db.query("select set_vocabulary_exclusion('English','run',null,true,null)").catch(async error=>{
    if(!/ambiguous/.test(error.message))throw error;
    await db.query("select set_vocabulary_exclusion(null,null,(select id from user_vocabulary where word_text='ran'),true,null)");
  });
  await db.query("select set_vocabulary_exclusion('French','bonjour',null,true,null)");
  await mark('en','run');await unmark('en',['run']);
  assert.deepEqual((await rows('select language,word_text from vocabulary_exclusions')),[{language:'French',word_text:'bonjour'}]);
 });
 await check('카드의 개인 뜻 편집은 known 표시를 해제하지 않는다',async()=>{
  await mark('en','run');await db.query("update user_vocabulary set meaning='새 개인 뜻' where word_text='ran'");
  assert.equal((await rows("select * from active_vocabulary where base_form='run'")).length,0);
  await unmark('en',['run']);assert.equal((await rows("select * from active_vocabulary where base_form='run'")).length,2);
 });
 await check('미지원 known 언어는 변경하거나 추정하지 않음',async()=>{
  await mark('ko','책');assert.equal((await rows("select * from vocabulary_exclusions where word_text='책'")).length,0);
  await unmark('ko',['책']);
 });
 await check('다른 소유자 조회/표시 위조는 RLS로 차단',async()=>{
  await mark('en','run');await owner(b);
  assert.equal((await rows('select * from user_known_words')).length,0);
  assert.equal((await rows('select * from vocabulary_exclusions')).length,0);
  assert.equal((await rows('select * from active_vocabulary')).length,1);
  await assert.rejects(mark('en','run'),/row-level security/);
  await db.query('delete from user_known_words where user_id=$1',[a]);await owner(a);
  assert.equal((await rows('select * from user_known_words')).length,1);
 });
 await check('옛 RPC로 known 보호 행을 카드에 연결하거나 직접 키를 지울 수 없음',async()=>{
  const id=(await rows("select id from user_vocabulary where word_text='ran'"))[0].id;
  await assert.rejects(db.query('select set_vocabulary_exclusion(null,null,$1,true,null)',[id]),/known_word_active/);
  await assert.rejects(db.query("update vocabulary_exclusions set known_word_keys='{}' where word_text='run'"),/known_word_active/);
  await db.query('delete from user_vocabulary where id=$1',[id]);
  assert.equal((await rows("select * from vocabulary_exclusions where word_text='run'"))[0].known_word_keys.includes('run'),true);
  await assert.rejects(rows('select sync_known_word_review_exclusion()'),/permission denied/);
 });
 await check('인증 계정 삭제의 FK cascade를 막지 않는다',async()=>{
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a]);
  assert.equal((await rows('select * from user_known_words where user_id=$1',[a])).length,0);
  assert.equal((await rows('select * from vocabulary_exclusions where user_id=$1',[a])).length,0);
 });
 await check('익명·직접 트리거 호출은 권한을 얻지 못한다',async()=>{
  await owner(null);await assert.rejects(rows('select * from user_known_words'),/permission denied/);
  await assert.rejects(rows('select sync_known_word_review_exclusion()'),/permission denied/);
 });
 console.log(`${checks} PostgreSQL checks passed; no live database touched.`);
} finally {await db.close();}
