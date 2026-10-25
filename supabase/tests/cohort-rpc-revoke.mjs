/** Isolated PostgreSQL verification; no network or live DB connection (SECDEF-HARDEN-002).
 * 잠든 기수 기능의 RPC 실행권 회수 — join_cohort는 service_role만, 정책 헬퍼 셋은 anon만 회수(authenticated 정책은 그대로 돈다).
 * 적용 전 악용 경로(로그인 사용자가 cohorts에서 join_code를 읽어 아무 기수에 가입 → 멤버 목록 열람)를 먼저 재현하고, 적용 뒤 닫혔는지 본다.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/cohort-rpc-revoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const admin = '20000000-0000-0000-0000-000000000001', leader = '20000000-0000-0000-0000-000000000002';
const member = '20000000-0000-0000-0000-000000000003', outsider = '20000000-0000-0000-0000-000000000004';
const cohort = '30000000-0000-0000-0000-000000000001', team = '30000000-0000-0000-0000-000000000002';
const MIGRATION = new URL('../migrations/20261026000000_cohort_rpc_revoke.sql', import.meta.url);
const ROLLBACK = new URL('../../docs/sql/cohort-rpc-revoke-rollback.sql', import.meta.url);
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(role, user = '') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec(`set role ${role}`); }
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const denied = async (sql, params = []) => {
  try { await db.query(sql, params); } catch (error) { assert.equal(error.code, '42501', `${sql}: ${error.message}`); return; }
  assert.fail(`${sql}: 실행권 없이 통과했다`);
};
const can = async (role, fn) => (await rows("select has_function_privilege($1, $2, 'EXECUTE') ok", [role, fn]))[0].ok;
const FUNCTIONS = ['public.join_cohort(text)', 'public.is_admin_user()', 'public.is_cohort_member(uuid)', 'public.can_view_member_progress(uuid)'];
const acl = async () => Object.fromEntries((await rows(`select p.oid::regprocedure::text fn, p.proacl::text acl from pg_proc p
  where p.pronamespace='public'::regnamespace and p.proname in ('join_cohort','is_admin_user','is_cohort_member','can_view_member_progress','is_admin') order by 1`)).map(r => [r.fn, r.acl]));

try {
  // 운영과 같은 모양의 최소 바탕: 역할 · auth.uid() · profiles · user_ref_progress(본인 정책) · 지문 넷(stub, 같은 값).
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table public.profiles(id uuid primary key references auth.users(id), role text default 'student');
  create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
  grant execute on function public.is_admin() to anon, authenticated, service_role;
  create table public.user_ref_progress(user_id uuid not null, ref text not null);
  alter table public.user_ref_progress enable row level security;
  create policy own_progress on public.user_ref_progress for select to authenticated using (user_id = auth.uid());
  grant select on public.user_ref_progress to anon, authenticated;
  create schema fsrs_private;
  create table fsrs_private.settings(contract_hash text); insert into fsrs_private.settings values ('core');
  create table fsrs_private.manual_save_settings(contract_hash text); insert into fsrs_private.manual_save_settings values ('manual');
  create table fsrs_private.admission_settings(contract_hash text); insert into fsrs_private.admission_settings values ('admission');
  create table fsrs_private.activity_settings(profile_contract_hash text); insert into fsrs_private.activity_settings values ('activity');
  create function fsrs_private.contract_hash() returns text language sql as $$ select 'core' $$;
  create function fsrs_private.manual_contract_hash() returns text language sql as $$ select 'manual' $$;
  create function fsrs_private.admission_contract_hash() returns text language sql as $$ select 'admission' $$;
  create function fsrs_private.activity_profile_hash() returns text language sql as $$ select 'activity' $$;`);
  // 기수 원본 마이그레이션 그대로 + Supabase 기본 권한(public 함수 → anon · authenticated · service_role EXECUTE, 표 → ALL).
  await db.exec(await fs.readFile(new URL('../migrations/20260613000100_cohorts.sql', import.meta.url), 'utf8'));
  await db.exec(`grant execute on function ${FUNCTIONS.join(', ')} to anon, authenticated, service_role;
  grant all on public.cohorts, public.cohort_teams, public.cohort_members to anon, authenticated, service_role;`);
  await db.exec(`insert into auth.users values ('${admin}'),('${leader}'),('${member}'),('${outsider}');
  insert into public.profiles values ('${admin}','admin'),('${leader}','student'),('${member}','student'),('${outsider}','student');
  insert into public.cohorts(id,name,lang,level,start_date,join_code,status) values ('${cohort}','1기','Japanese','N3','2026-11-01','SECRET7','recruiting');
  insert into public.cohort_teams(id,cohort_id,name,leader_id) values ('${team}','${cohort}','A','${leader}');
  insert into public.cohort_members(cohort_id,user_id,team_id) values ('${cohort}','${leader}','${team}'),('${cohort}','${member}','${team}');
  insert into public.user_ref_progress values ('${member}','n3-01'),('${outsider}','n3-02');`);
  const before = await acl();

  await check('적용 전 재현: 로그인 사용자 누구나 join_code를 읽고 가입해 멤버 목록을 본다(초대 코드 무의미)', async () => {
    await as('authenticated', outsider);
    const [{ join_code: code }] = await rows('select join_code from public.cohorts');
    assert.equal(code, 'SECRET7');
    assert.equal((await rows('select public.join_cohort($1) id', [code]))[0].id, cohort);
    assert.equal((await rows('select user_id from public.cohort_members')).length, 3);
    await db.exec('reset role');
    await db.query('delete from public.cohort_members where user_id=$1', [outsider]);
  });

  await check('지문이 이미 어긋나 있으면 아무것도 바꾸지 않고 멈춘다', async () => {
    await db.exec('reset role');
    await db.exec("update fsrs_private.activity_settings set profile_contract_hash='drifted'");
    await db.exec('begin');
    await assert.rejects(db.exec(await fs.readFile(MIGRATION, 'utf8')), /learning contracts already drifted/);
    await db.exec('rollback');
    await db.exec("update fsrs_private.activity_settings set profile_contract_hash='activity'");
    assert.deepEqual(await acl(), before);
  });

  await db.exec('reset role');
  await db.exec(await fs.readFile(MIGRATION, 'utf8'));
  await db.exec(await fs.readFile(MIGRATION, 'utf8')); // 재실행 안전

  await check('실행권: join_cohort는 service_role만 · 헬퍼 셋은 anon · PUBLIC 회수, authenticated · service_role 유지 · is_admin 무변경', async () => {
    await db.exec('reset role');
    for (const role of ['anon', 'authenticated']) assert.equal(await can(role, 'public.join_cohort(text)'), false, role);
    assert.equal(await can('service_role', 'public.join_cohort(text)'), true);
    for (const fn of FUNCTIONS.slice(1)) {
      assert.equal(await can('anon', fn), false, fn);
      assert.equal(await can('authenticated', fn), true, fn);
      assert.equal(await can('service_role', fn), true, fn);
    }
    const after = await acl();
    for (const fn of ['join_cohort(text)', 'is_admin_user()', 'is_cohort_member(uuid)', 'can_view_member_progress(uuid)']) {
      assert.equal(/(^|[{,])=X/.test(after[fn]), false, `${fn} PUBLIC 남음: ${after[fn]}`);
    }
    assert.equal(after['is_admin()'], before['is_admin()'], 'is_admin()은 손님 reading_materials 정책이 쓰므로 그대로');
  });

  await check('로그인 사용자 · 손님의 RPC 가입은 permission denied, 서버(service_role) 경로만 남는다', async () => {
    await as('authenticated', outsider);
    await denied('select public.join_cohort($1)', ['SECRET7']);
    await as('anon');
    await denied('select public.join_cohort($1)', ['SECRET7']);
    await denied('select public.is_cohort_member($1)', [cohort]);
    await db.exec('reset role');
    assert.equal((await rows('select user_id from public.cohort_members where user_id=$1', [outsider])).length, 0);
  });

  await check('authenticated 정책은 그대로: 멤버는 같은 기수 멤버 · 팀, 리더는 팀원 진도, 관리자는 전체, 바깥 사람은 0행', async () => {
    await as('authenticated', member);
    assert.equal((await rows('select user_id from public.cohort_members')).length, 2);
    assert.equal((await rows('select id from public.cohort_teams')).length, 1);
    await as('authenticated', leader);
    assert.deepEqual((await rows('select user_id, ref from public.user_ref_progress order by ref')), [{ user_id: member, ref: 'n3-01' }]);
    await as('authenticated', admin);
    assert.equal((await rows('select user_id from public.user_ref_progress')).length, 2);
    assert.equal((await rows('select user_id from public.cohort_members')).length, 2);
    await as('authenticated', outsider);
    assert.equal((await rows('select user_id from public.cohort_members')).length, 0);
    assert.deepEqual((await rows('select ref from public.user_ref_progress')), [{ ref: 'n3-02' }]);
  });

  await check('손님(anon)은 이 표들에 authenticated 정책이 없어 0행 — 헬퍼 실행권 없이도 오류 없이 0행', async () => {
    await as('anon');
    assert.equal((await rows('select ref from public.user_ref_progress')).length, 0);
    assert.equal((await rows('select user_id from public.cohort_members')).length, 0);
  });

  await check('복원 SQL은 적용 전 실행권으로 정확히 되돌린다', async () => {
    await db.exec('reset role');
    await db.exec(await fs.readFile(ROLLBACK, 'utf8'));
    const restored = await acl();
    for (const fn of Object.keys(before)) {
      const norm = s => s.replace(/^\{|\}$/g, '').split(',').sort().join(',');
      assert.equal(norm(restored[fn]), norm(before[fn]), fn);
    }
  });
  console.log(`cohort-rpc-revoke: ${checks} checks passed`);
} catch (error) {
  console.error('FAIL', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
