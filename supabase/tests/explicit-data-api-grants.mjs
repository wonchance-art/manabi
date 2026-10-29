// Data API 권한 명시(GRANTS-EXPLICIT-001) — 자동 권한이 없는 새 DB(PGlite: 기본 권한 없음 = Supabase 2026-10-30 뒤 새 테이블과 같다)에서
// 복습 테이블 둘을 만든 그대로(마이그레이션 원문) 세우고, 명시 권한 전에는 막히고 뒤에는 본인 행 조회 · 저장이 되는지 본다.
// 일회용 DB만 사용하며 운영 연결/계정 상태를 읽지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a = '10000000-0000-0000-0000-000000000001', b = '10000000-0000-0000-0000-000000000002';
const migration = name => fs.readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
}
const denied = async (sql, params = []) => assert.rejects(db.query(sql, params), /permission denied/);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key); grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('${a}'),('${b}');`);
  await db.exec(await migration('20260701000100_grammar_review.sql'));

  await check('명시 권한 전 — 자동 권한 없는 새 DB에서는 로그인 학습자도 복습 조회 · 저장이 막힌다(음성 대조)', async () => {
    await as(a);
    await denied('select * from grammar_review');
    await denied("insert into review_events(user_id,lang,source,item_key,correct) values($1,'Japanese','vocab','食べる',true)", [a]);
  });

  // 나머지 테이블은 이 DB에 없다 — 이름만 같은 빈 표 · 시퀀스를 두고 명시 권한 파일을 원문 그대로 끝까지 실행한다(문장 하나도 빠지지 않게).
  await db.exec('reset role');
  const others = ['grammar_notes', 'reading_progress', 'uploaded_pdfs', 'user_achievements', 'push_subscriptions', 'study_paragraphs',
    'study_plan_progress', 'user_ref_progress', 'cohort_members', 'cohort_teams', 'cohorts', 'content_reports', 'notifications',
    'content_sources', 'daily_suggestions', 'token_corrections', 'forum_posts', 'forum_comments', 'forum_post_likes',
    'forum_comment_likes', 'material_comments', 'vocab_decks', 'vocab_deck_words', 'writing_practice', 'morpheme_dictionary'];
  await db.exec(others.map(t => `create table public.${t}(id int);`).join('')
    + 'create sequence public.grammar_notes_id_seq; create sequence public.reading_progress_id_seq; create sequence public.morpheme_dictionary_id_seq;');
  await db.exec(await migration('20261029060000_explicit_data_api_grants.sql'));

  await check('명시 권한 뒤 — 문법 복습은 본인 행 조회 · 저장 · 갱신 · 삭제, 남의 행은 RLS가 그대로 가린다', async () => {
    await as(a);
    await db.query("insert into grammar_review(user_id,lang,slug) values($1,'Japanese','n5-01')", [a]);
    await db.query("update grammar_review set repetitions=1 where user_id=$1", [a]);
    assert.equal((await db.query('select count(*)::int n from grammar_review')).rows[0].n, 1);
    await assert.rejects(db.query("insert into grammar_review(user_id,lang,slug) values($1,'Japanese','n5-01')", [b]), /row-level security/);
    await as(b);
    assert.equal((await db.query('select count(*)::int n from grammar_review')).rows[0].n, 0);
    await as(a);
    await db.query("delete from grammar_review where user_id=$1", [a]);
  });

  await check('명시 권한 뒤 — 오답 이벤트는 본인 조회 · 추가만(append-only: 고치기 · 지우기는 권한부터 없다)', async () => {
    await as(a);
    await db.query("insert into review_events(user_id,lang,source,item_key,correct) values($1,'Japanese','vocab','食べる',false)", [a]);
    assert.equal((await db.query('select count(*)::int n from review_events')).rows[0].n, 1);
    await denied("update review_events set correct=true where user_id=$1", [a]);
    await denied("delete from review_events where user_id=$1", [a]);
    await as(b);
    assert.equal((await db.query('select count(*)::int n from review_events')).rows[0].n, 0);
  });

  await check('손님(anon)은 복습 테이블 둘 다 권한이 없다 · 서버(service_role)는 넷 다', async () => {
    await as(null);
    await denied('select * from grammar_review');
    await denied('select * from review_events');
    await db.exec('reset role');
    const grants = (await db.query(`select table_name, string_agg(privilege_type, ',' order by privilege_type) p
      from information_schema.role_table_grants where grantee='service_role' and table_name in ('grammar_review','review_events') group by 1 order by 1`)).rows;
    assert.deepEqual(grants, [{ table_name: 'grammar_review', p: 'DELETE,INSERT,SELECT,UPDATE' }, { table_name: 'review_events', p: 'DELETE,INSERT,SELECT,UPDATE' }]);
  });
  await check('운영에 적용해도 무변화 — 운영 relacl(2026-10-29 KST)과 같은 표에 복습 GRANT를 다시 해도 aclitem이 그대로다(학습 지문 불변)', async () => {
    await db.exec('reset role');
    await db.exec(`create table public.prod_review_events(id int); revoke all on public.prod_review_events from public;
      grant select, insert, update, delete, references, trigger, maintain on public.prod_review_events to authenticated;
      grant all on public.prod_review_events to service_role;`);
    const acl = async () => (await db.query("select relacl::text a from pg_class where oid='public.prod_review_events'::regclass")).rows[0].a;
    const before = await acl();
    assert.match(before, /authenticated=arwdxtm\//);
    const sql = (await migration('20261029060000_explicit_data_api_grants.sql')).replace(/--[^\n]*/g, '');
    for (const statement of sql.split(';').filter(s => /review_events/.test(s))) await db.exec(`${statement.replaceAll('public.review_events', 'public.prod_review_events')};`);
    assert.equal(await acl(), before);
  });
  console.log(`explicit-data-api-grants: ${checks} checks passed`);
} finally {
  await db.close();
}
