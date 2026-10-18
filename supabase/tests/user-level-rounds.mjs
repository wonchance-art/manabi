// 단어 목록 바퀴 표(user_level_rounds, LEVEL-ROUND-001 ②) PGlite 검수. 일회용 DB만 사용하며 운영 연결/계정 상태를 읽지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a = '10000000-0000-0000-0000-000000000001', b = '10000000-0000-0000-0000-000000000002';
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']); await db.exec(`set role ${id ? 'authenticated' : 'anon'}`); }
const insert = (user, view, round, scope = 'all', level = 'H1') => db.query(`insert into user_level_rounds(user_id,lang,level,view,round_no,scope) values($1,'zh',$2,$3,$4,$5)`, [user, level, view, round, scope]);
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create table auth.users(id uuid primary key);grant usage on schema auth to anon,authenticated;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table public.profiles(id uuid primary key);
  insert into auth.users values('${a}'),('${b}');`);
  const sql = await fs.readFile(new URL('../migrations/20261019020000_user_level_rounds.sql', import.meta.url), 'utf8');
  const profileTriggers = async () => (await rows("select count(*)::int n from pg_trigger where tgrelid='public.profiles'::regclass"))[0].n;
  const before = await profileTriggers();
  await db.exec(sql);
  await db.exec(sql); // 재실행 안전
  await check('profiles에 트리거 · FK가 생기지 않는다(10-16 장애 선례 — auth.users만 참조)', async () => {
    assert.equal(await profileTriggers(), before);
    assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /profiles/i);
  });
  await check('본인 바퀴 쓰기 · 읽기 · 지우기, 같은 보기 · 바퀴 번호는 한 줄', async () => {
    await as(a);
    await insert(a, 'all', 1);
    await insert(a, 'all', 2, 'missed');
    await insert(a, 'meaning', 1);
    await assert.rejects(insert(a, 'all', 2));
    assert.deepEqual(await rows("select view, round_no, scope from user_level_rounds order by view, round_no"),
      [{ view: 'all', round_no: 1, scope: 'all' }, { view: 'all', round_no: 2, scope: 'missed' }, { view: 'meaning', round_no: 1, scope: 'all' }]);
    await db.query("delete from user_level_rounds where user_id=$1 and level='H1' and view='all' and round_no=2", [a]);
    assert.equal((await rows('select * from user_level_rounds')).length, 2);
  });
  await check('고치기는 없다(시작 기록은 지우고 다시 쓴다)', async () => {
    await as(a);
    await assert.rejects(db.query("update user_level_rounds set scope='missed' where user_id=$1", [a]));
  });
  await check('다른 계정 줄은 안 보이고 못 쓰고 못 지운다', async () => {
    await as(b);
    assert.equal((await rows('select * from user_level_rounds')).length, 0);
    await assert.rejects(insert(a, 'word', 1));
    await db.query('delete from user_level_rounds where user_id=$1', [a]);
    await as(a);
    assert.equal((await rows('select * from user_level_rounds')).length, 2);
  });
  await check('게스트(anon)는 읽기 · 쓰기 모두 차단', async () => {
    await as(null);
    await assert.rejects(rows('select * from user_level_rounds'));
  });
  await check('모르는 보기 · 범위 · 언어 · 바퀴 번호는 거부', async () => {
    await as(a);
    await assert.rejects(insert(a, 'grade', 3));
    await assert.rejects(insert(a, 'word', 3, 'some'));
    await assert.rejects(insert(a, 'word', 0));
    await assert.rejects(db.query(`insert into user_level_rounds(user_id,lang,level,view,round_no,scope) values($1,'ZH','h1','word',5,'all')`, [a]));
  });
  console.log(`${checks} checks passed`);
} finally { await db.close(); }
