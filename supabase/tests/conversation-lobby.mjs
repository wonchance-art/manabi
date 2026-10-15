// 모두의 대화방(CONV-LOBBY-001) 접근 규칙 — 기존 PGlite SQL 검수 방식. 일회용 DB만 쓰고 운영에 연결하지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const [a, b, c, d, admin] = ['1', '2', '3', '4', '9'].map((n) => `20000000-0000-0000-0000-00000000000${n}`);
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec(`set role ${id ? 'authenticated' : 'anon'}`);
}
const say = (lang, body) => db.query('insert into public.conversation_lobby_messages(language,body) values($1,$2) returning id', [lang, body]);
const fails = async (p, re) => { await assert.rejects(p, re); };
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table public.profiles(id uuid primary key, display_name text, role text default 'student');
  grant usage on schema public to anon,authenticated;
  create function public.is_admin() returns boolean language sql security definer stable set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
  insert into public.profiles(id,display_name,role) values('${a}','민지','student'),('${b}','B','student'),('${c}','C','student'),('${d}','D','student'),('${admin}','관리자','admin');`);
  const sql = (name) => fs.readFile(new URL(`../../docs/sql/${name}`, import.meta.url), 'utf8');
  await db.exec(await sql('conversation-lobby.sql'));

  let first;
  await check('로그인한 사람은 자기 이름으로 쓰고, 공백은 다듬어진다', async () => {
    await as(a);
    first = (await say('Japanese', '  今日もがんばろう！ ')).rows[0].id;
    const [row] = await rows('select user_id,body,language from public.conversation_lobby_messages where id=$1', [first]);
    assert.deepEqual(row, { user_id: a, body: '今日もがんばろう！', language: 'Japanese' });
  });
  await check('남의 이름으로 쓰기 · 빈 말 · 300자 초과 · 모르는 언어는 거절', async () => {
    await as(a);
    await fails(db.query('insert into public.conversation_lobby_messages(language,body,user_id) values($1,$2,$3)', ['Japanese', 'x', b]), /row-level security/);
    await fails(say('Japanese', '   '), /check constraint/);
    await fails(say('Japanese', 'あ'.repeat(301)), /check constraint/);
    await fails(say('Korean', 'x'), /check constraint/);
  });
  await check('로그인하지 않으면 읽지도 쓰지도 못한다', async () => {
    await as(null);
    await fails(rows('select * from public.conversation_lobby_messages'), /permission denied/);
    await fails(say('Japanese', 'x'), /permission denied/);
  });
  await check('다른 사람은 읽지만 고치거나 지우지 못한다', async () => {
    await as(b);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [first])).length, 1);
    await fails(db.query('update public.conversation_lobby_messages set body=$1 where id=$2', ['바꿈', first]), /permission denied/);
    await db.query('delete from public.conversation_lobby_messages where id=$1', [first]);
    await as(a);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [first])).length, 1);
  });
  await check('10초에 5건을 넘으면 거절(도배 막기)', async () => {
    await as(b);
    for (let i = 0; i < 5; i++) await say('English', `hi ${i}`);
    await fails(say('English', 'too many'), /lobby_rate_limited/);
  });
  await check('서로 다른 3명이 신고하면 가려지고, 쓴 사람·관리자만 본다', async () => {
    for (const who of [b, c]) { await as(who); await db.query('insert into public.conversation_lobby_reports(message_id) values($1)', [first]); }
    await as(d);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [first])).length, 1);
    await db.query('insert into public.conversation_lobby_reports(message_id) values($1)', [first]);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [first])).length, 0);
    await fails(db.query('insert into public.conversation_lobby_reports(message_id) values($1)', [first]), /duplicate key/);
    await as(a);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1 and hidden_at is not null', [first])).length, 1);
    await as(admin);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [first])).length, 1);
  });
  await check('신고 기록은 신고한 사람만 본다', async () => {
    await as(b);
    assert.equal((await rows('select * from public.conversation_lobby_reports')).length, 1);
    await fails(db.query('insert into public.conversation_lobby_reports(message_id,reporter_id) values($1,$2)', [first, a]), /row-level security/);
  });
  await check('자기 말은 지우고, 관리자는 어떤 말이든 지운다', async () => {
    await as(c);
    const mine = (await say('French', 'bonjour')).rows[0].id;
    await db.query('delete from public.conversation_lobby_messages where id=$1', [mine]);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [mine])).length, 0);
    await as(admin);
    await db.query('delete from public.conversation_lobby_messages where id=$1', [first]);
    await as(a);
    assert.equal((await rows('select id from public.conversation_lobby_messages where id=$1', [first])).length, 0);
  });
  await check('되돌리기는 이 두 표·두 함수만 지우고, 다시 적용할 수 있다', async () => {
    await db.exec('reset role');
    await db.exec(await sql('conversation-lobby-rollback.sql'));
    const left = await rows("select tablename from pg_tables where schemaname='public' order by 1");
    assert.deepEqual(left.map((r) => r.tablename), ['profiles']);
    assert.equal((await rows("select 1 from pg_proc where proname like 'conversation_lobby%'")).length, 0);
    await db.exec(await sql('conversation-lobby.sql'));
    assert.equal((await rows('select count(*)::int n from public.conversation_lobby_messages'))[0].n, 0);
  });
  console.log(`conversation-lobby: ${checks} checks passed`);
} finally {
  await db.close();
}
