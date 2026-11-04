/** Isolated PostgreSQL verification; no network or live DB connection (ADMIN-METRICS-DAY-001, 2026-11-05 KST).
 * 관리자 「일별 추이 · 가입 퍼널」을 학습자 화면과 같은 셈(04시 학습일 · 답만 · 채점 답 정답률)으로. 적용 전 재현 → 적용 → 결과 ·
 * 권한 · 속성 → 멱등 → 복원 SQL로 예전 그대로. PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/admin-metrics-learning-day.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const admin = '20000000-0000-0000-0000-000000000001', a = '20000000-0000-0000-0000-000000000002', b = '20000000-0000-0000-0000-000000000003';
const MIGRATION = new URL('../migrations/20261105010000_admin_metrics_learning_day.sql', import.meta.url);
const ROLLBACK = new URL('../../docs/sql/admin-metrics-learning-day-rollback.sql', import.meta.url);
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(role, user = '') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec(`set role ${role}`); }
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const daily = async () => { await as('authenticated', admin); const r = await rows("select day::text, active_users::int au, accuracy::float8 acc from public.admin_daily_metrics(30) where day >= (now() - interval '10 days')::date order by 1"); await db.exec('reset role'); return r; };
const funnel = async () => { await as('authenticated', admin); const r = await rows('select signups::int s, reached_first_session::int r, d1_return::int d1, d7_retained::int d7 from public.admin_funnel(30)'); await db.exec('reset role'); return r[0]; };
const attrs = async () => rows(`select p.proname, p.prosecdef, p.proacl::text acl, p.provolatile, p.proconfig::text config from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('admin_daily_metrics','admin_funnel') order by 1`);

try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table auth.users(id uuid primary key, created_at timestamptz);
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
  insert into public.profiles values ('${admin}','admin'),('${a}','student'),('${b}','student');`);
  // 기준 날 D = 사흘 전(KST). 시각은 KST로 적는다.
  const D = (await rows("select ((now() at time zone 'Asia/Seoul')::date - 3)::text d"))[0].d;
  const at = (dayOffset, hhmm) => `('${D}'::date + ${dayOffset} + time '${hhmm}') at time zone 'Asia/Seoul'`;
  // 가입: a는 D 12:00 KST, b는 D 02:00 KST(학습일로는 D-1, UTC로도 D-1).
  await db.exec(`insert into auth.users values ('${a}', ${at(0, '12:00')}), ('${b}', ${at(0, '02:00')});
  insert into public.review_events(user_id, source, item_key, correct, created_at) values
    ('${a}', 'vocab', 'w1', true,  ${at(0, '13:00')}),   -- D 낮 — 두 셈 모두 D
    ('${a}', 'grammar', 'g1', false, ${at(0, '14:00')}), -- 문법 오답 — 예전 정답률엔 안 들어감
    ('${a}', 'assist', 'w9', false, ${at(0, '14:30')}),  -- 도움 열람 — 예전엔 활성 · 정답률 몫 없음(vocab만), 새 셈에선 답 아님
    ('${a}', 'vocab', 'w2', true,  ${at(1, '06:00')}),   -- D+1 06시 KST = UTC로는 D 21시 → 예전엔 D, 새 셈은 D+1(가입 다음 학습일)
    ('${b}', 'ui', 'tap', true,    ${at(1, '15:00')}),   -- b는 화면 계측만 — 예전엔 활성, 새 셈은 아님
    ('${b}', 'level', 'w3', false, ${at(2, '10:00')});   -- 단어 목록 자기 확인 — 활성은 맞고 정답률에는 안 들어감`);
  await db.exec(await fs.readFile(ROLLBACK, 'utf8')); // 적용 전 = 운영 본문(복원 SQL과 같은 본문 · md5 대조는 계약 시험)
  await db.exec(`revoke execute on function public.admin_daily_metrics(integer), public.admin_funnel(integer) from public, anon;
  grant execute on function public.admin_daily_metrics(integer), public.admin_funnel(integer) to authenticated, service_role;`);
  const before = await attrs();
  const d = n => new Date(Date.parse(`${D}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

  await check('적용 전 재현: UTC 날짜 · 화면 계측도 활성 · 정답률은 vocab만', async () => {
    const r = await daily();
    // D: a의 vocab 2건(낮 1 + 다음날 06시가 UTC로 D) → 정답률 1.0, 문법 오답은 빠짐
    assert.deepEqual(r.find(x => x.day === d(0)), { day: d(0), au: 1, acc: 1 });
    assert.equal(r.find(x => x.day === d(1))?.au, 1, 'b의 ui만 있는 날이 활성 1');
    // 예전 D1 = 0: a의 다음날 06시 답은 UTC로 가입 같은 날(D), b의 ui는 UTC 가입 +2일. 새 셈은 a가 가입 다음 학습일에 답해 D1 = 1.
    assert.deepEqual(await funnel(), { s: 2, r: 2, d1: 0, d7: 0 });
  });

  await check('지문이 이미 어긋나 있으면 멈춘다', async () => {
    await db.exec("update fsrs_private.activity_settings set profile_contract_hash='drifted'");
    await db.exec('begin');
    await assert.rejects(db.exec(await fs.readFile(MIGRATION, 'utf8')), /learning contracts already drifted/);
    await db.exec('rollback');
    await db.exec("update fsrs_private.activity_settings set profile_contract_hash='activity'");
  });

  await check('적용: 04시 학습일 · 답한 사람만 활성 · 채점 답 정답률', async () => {
    await db.exec('begin'); await db.exec(await fs.readFile(MIGRATION, 'utf8')); await db.exec('commit');
    const r = await daily();
    assert.deepEqual(r.find(x => x.day === d(0)), { day: d(0), au: 1, acc: 0.5 }, 'D: vocab 정답 + 문법 오답(도움 열람 제외)');
    assert.deepEqual(r.find(x => x.day === d(1)), { day: d(1), au: 1, acc: 1 }, 'D+1: a의 06시 vocab만 — b의 ui는 활성 아님');
    assert.deepEqual(r.find(x => x.day === d(2)), { day: d(2), au: 1, acc: null }, 'D+2: b의 level 확인 — 활성이지만 정답률 밖');
    const f = await funnel();
    assert.deepEqual(f, { s: 2, r: 2, d1: 1, d7: 0 }, '첫 세션 = 답한 사람(a · b), D1 = a(가입 D → D+1 06시 답)');
  });

  await check('속성 · 실행권 그대로 — 관리자만 · anon 실행 불가', async () => {
    assert.deepEqual(await attrs(), before);
    for (const fn of ['admin_daily_metrics(integer)', 'admin_funnel(integer)'])
      assert.equal((await rows(`select has_function_privilege('anon','public.${fn}','EXECUTE') ok`))[0].ok, false);
    await as('authenticated', a);
    await assert.rejects(db.query('select * from public.admin_daily_metrics(30)'), /admin only/);
    await assert.rejects(db.query('select * from public.admin_funnel(30)'), /admin only/);
    await db.exec('reset role');
  });

  await check('다시 적용해도 같다(멱등)', async () => {
    await db.exec('begin'); await db.exec(await fs.readFile(MIGRATION, 'utf8')); await db.exec('commit');
    assert.equal((await daily()).length, 3);
  });

  await check('복원 SQL: 예전 결과 그대로 · 속성 그대로', async () => {
    await db.exec('begin'); await db.exec(await fs.readFile(ROLLBACK, 'utf8')); await db.exec('commit');
    assert.deepEqual((await daily()).find(x => x.day === d(0)), { day: d(0), au: 1, acc: 1 });
    assert.deepEqual(await attrs(), before);
  });
  console.log(`admin-metrics-learning-day: ${checks} checks passed`);
} finally {
  await db.close();
}
