/** Isolated PostgreSQL verification; no network or live DB connection (EVENT-SOURCE-001 후속, 2026-11-04 KST).
 * 관리자 「콘텐츠 건강」(admin_content_health)이 답 아닌 기록(level · hanzi 자기 확인, practice, dict, assist)을 오답률에 넣던 것을
 * 정답률 정본과 같은 출처로 좁힌다. 적용 전 재현 → 적용 → 같은 바탕에서 결과 · 권한 · 속성 확인 → 복원 SQL로 예전 그대로 돌아오는지.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/admin-content-health-answers.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const admin = '20000000-0000-0000-0000-000000000001', learner = '20000000-0000-0000-0000-000000000002';
const MIGRATION = new URL('../migrations/20261104110000_admin_content_health_answers.sql', import.meta.url);
const ROLLBACK = new URL('../../docs/sql/admin-content-health-rollback.sql', import.meta.url);
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(role, user = '') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec(`set role ${role}`); }
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const health = async () => { await as('authenticated', admin); const r = await rows('select item_key, exposures::int n, wrong_rate::float8 w from public.admin_content_health(30, 10)'); await db.exec('reset role'); return r; };
const attrs = async () => (await rows(`select p.prosecdef, p.proacl::text acl, p.provolatile, p.proconfig::text config
  from pg_proc p where p.oid = to_regprocedure('public.admin_content_health(integer,integer)')`))[0];

try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table public.profiles(id uuid primary key, role text default 'student');
  create table public.review_events(id bigserial primary key, user_id uuid, lang text, source text, item_key text, correct boolean, detail jsonb, created_at timestamptz default now());
  create schema fsrs_private;
  create table fsrs_private.settings(contract_hash text); insert into fsrs_private.settings values ('core');
  create table fsrs_private.manual_save_settings(contract_hash text); insert into fsrs_private.manual_save_settings values ('manual');
  create table fsrs_private.admission_settings(contract_hash text); insert into fsrs_private.admission_settings values ('admission');
  create table fsrs_private.activity_settings(profile_contract_hash text); insert into fsrs_private.activity_settings values ('activity');
  create function fsrs_private.contract_hash() returns text language sql as $$ select 'core' $$;
  create function fsrs_private.manual_contract_hash() returns text language sql as $$ select 'manual' $$;
  create function fsrs_private.admission_contract_hash() returns text language sql as $$ select 'admission' $$;
  create function fsrs_private.activity_profile_hash() returns text language sql as $$ select 'activity' $$;
  insert into public.profiles values ('${admin}','admin'),('${learner}','student');`);
  // 적용 전 = 운영 본문(복원 SQL과 같은 본문) + 운영과 같은 실행권(public · anon 회수, authenticated · service_role).
  await db.exec(await fs.readFile(ROLLBACK, 'utf8'));
  await db.exec(`revoke execute on function public.admin_content_health(integer,integer) from public, anon;
  grant execute on function public.admin_content_health(integer,integer) to authenticated, service_role;`);
  // 진짜 채점 문항(vocab · grammar)과, 답 아닌 기록이 오답만 잔뜩 쌓인 키들.
  const ev = (source, key, correct, n) => Array.from({ length: n }, () => `('${learner}','zh','${source}','${key}',${correct})`).join(',');
  await db.exec(`insert into public.review_events(user_id,lang,source,item_key,correct) values
    ${ev('vocab', '猫', false, 3)}, ${ev('vocab', '猫', true, 1)},
    ${ev('grammar', 'ch3', false, 2)}, ${ev('grammar', 'ch3', true, 2)},
    ${ev('level', '狗', false, 6)}, ${ev('hanzi', '水', false, 5)}, ${ev('practice', 'w-42', false, 4)},
    ${ev('dict', '火', false, 4)}, ${ev('assist', '山', false, 4)}, ${ev('ui', '木', false, 9)};`);
  const before = await attrs();

  await check('적용 전 재현: 자기 확인 · 연습 · 사전 · 도움 요청이 「고장 난 콘텐츠」 위에 선다', async () => {
    const keys = (await health()).map(r => r.item_key);
    assert.deepEqual(keys.slice(0, 5).sort(), ['山', '水', '火', '狗', 'w-42'].sort());
    assert.ok(!keys.includes('木'), 'ui는 예전에도 빠졌다');
  });

  await check('지문이 이미 어긋나 있으면 아무것도 바꾸지 않고 멈춘다', async () => {
    await db.exec("update fsrs_private.activity_settings set profile_contract_hash='drifted'");
    await db.exec('begin');
    await assert.rejects(db.exec(await fs.readFile(MIGRATION, 'utf8')), /learning contracts already drifted/);
    await db.exec('rollback');
    await db.exec("update fsrs_private.activity_settings set profile_contract_hash='activity'");
    assert.equal((await health())[0].item_key !== '猫', true);
  });

  await check('적용: 채점 문항만 남는다(vocab 3/4 · grammar 2/4) — 정렬 · 최소 노출 3 그대로', async () => {
    await db.exec('begin'); await db.exec(await fs.readFile(MIGRATION, 'utf8')); await db.exec('commit');
    assert.deepEqual(await health(), [{ item_key: '猫', n: 4, w: 0.75 }, { item_key: 'ch3', n: 4, w: 0.5 }]);
  });

  await check('속성 · 실행권 그대로 — 관리자만 · anon 실행 불가', async () => {
    assert.deepEqual(await attrs(), before);
    assert.equal((await rows("select has_function_privilege('anon','public.admin_content_health(integer,integer)','EXECUTE') ok"))[0].ok, false);
    await as('authenticated', learner);
    await assert.rejects(db.query('select * from public.admin_content_health(30,10)'), /admin only/);
    await db.exec('reset role');
  });

  await check('다시 적용해도 같다(멱등)', async () => {
    await db.exec('begin'); await db.exec(await fs.readFile(MIGRATION, 'utf8')); await db.exec('commit');
    assert.equal((await health()).length, 2);
  });

  await check('복원 SQL: 예전 결과 그대로 · 속성 그대로', async () => {
    await db.exec('begin'); await db.exec(await fs.readFile(ROLLBACK, 'utf8')); await db.exec('commit');
    assert.ok((await health()).map(r => r.item_key).includes('狗'));
    assert.deepEqual(await attrs(), before);
  });
  console.log(`admin-content-health-answers: ${checks} checks passed`);
} finally {
  await db.close();
}
