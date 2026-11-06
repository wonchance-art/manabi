/** Isolated PostgreSQL verification; no network or live DB connection (WORLD-IP-RETENTION-001, 2026-11-06 KST).
 * world_sessions.ip가 비정상 퇴장(행이 남음) 뒤 기한 없이 남던 것을, 마지막 하트비트 24시간 뒤 입장 경로(claim_world_session_v2)에서
 * 지우고 적용 순간 한 번 지운다. 적용 전 재현 → 사전 검사 거절 → 적용 → 데이터 · 임대 동작 · 권한 · 속성 → 입장 때 청소 → 재적용(멱등)
 * → 복원 SQL → 다시 적용. 월드 표가 없는 바탕(학습 계약 fixture 사슬)은 42P01로 건너뛴다.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/world-sessions-ip-retention.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');
const MIGRATION = '../migrations/20261106160000_world_sessions_ip_retention.sql';
const ROLLBACK = '../../docs/sql/world-sessions-ip-retention-rollback.sql';
const BASE = ['../migrations/20260710000100_world_sessions.sql', '../migrations/20260712000300_world_multiplayer.sql', '../migrations/20260712000400_world_open_all_users.sql'];
const U = (n) => `30000000-0000-4000-8000-00000000000${n}`;
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }

const db = new PGlite();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
async function as(role, user = '') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec(`set role ${role}`); }
const claim = async (user, ip) => { await as('authenticated', user); try { return (await rows('select public.claim_world_session_v2($1) r', [ip]))[0].r; } finally { await db.exec('reset role'); } };
const ips = async () => Object.fromEntries((await rows('select user_id::text u, ip from public.world_sessions order by 1')).map((r) => [r.u, r.ip]));
const sessionRows = async () => rows('select user_id::text, session_token::text, heartbeat_at::text, created_at::text from public.world_sessions order by 1');
const claimSrc = async () => (await rows("select prosrc from pg_proc where oid = to_regprocedure('public.claim_world_session_v2(text)')"))[0].prosrc;
const claimAttrs = async () => (await rows(`select p.oid::int, p.prosecdef, p.proconfig::text config, p.proacl::text acl, p.proowner::int
  from pg_proc p where p.oid = to_regprocedure('public.claim_world_session_v2(text)')`))[0];
async function apply(path) { await db.exec('begin'); try { await db.exec(await read(path)); await db.exec('commit'); } catch (e) { await db.exec('rollback'); throw e; } }

try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  create schema realtime; create table realtime.messages(topic text, extension text);
  create function realtime.topic() returns text language sql stable as $$ select 'world-plaza' $$;
  -- 학습 계약 지문 · capability 자리(사후 검사가 재는 함수 — 값이 그대로여야 한다)
  create schema fsrs_private;
  create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core' $$;
  create function fsrs_private.manual_contract_hash_live() returns text language sql as $$ select 'manual' $$;
  create function fsrs_private.admission_contract_hash_live() returns text language sql as $$ select 'admission' $$;
  create function fsrs_private.activity_profile_hash_live() returns text language sql as $$ select 'activity' $$;
  create function public.learning_language_capabilities() returns jsonb language sql as $$ select '{}'::jsonb $$;
  insert into auth.users values ('${U(1)}'),('${U(2)}'),('${U(3)}'),('${U(4)}'),('${U(5)}'),('${U(6)}');`);

  await check('월드 표가 없는 바탕에서는 42P01로 멈춘다(학습 fixture 사슬은 건너뛴다)', async () => {
    await assert.rejects(apply(MIGRATION), (e) => e.code === '42P01');
  });

  for (const path of BASE) await db.exec(await read(path));
  const v0400 = await claimSrc();
  // u1 살아 있음 · u2 2일 전 비정상 퇴장 · u3 23시간 전(상한 안) · u4 3일 전 · ip 없음
  await db.exec(`insert into public.world_sessions(user_id, session_token, ip, heartbeat_at, created_at) values
    ('${U(1)}', gen_random_uuid(), '198.51.100.1', now(), now() - interval '1 hour'),
    ('${U(2)}', gen_random_uuid(), '198.51.100.2', now() - interval '2 days', now() - interval '2 days'),
    ('${U(3)}', gen_random_uuid(), '198.51.100.3', now() - interval '23 hours', now() - interval '23 hours'),
    ('${U(4)}', gen_random_uuid(), null, now() - interval '3 days', now() - interval '3 days');`);

  await check('적용 전 재현: 다른 사람이 들어와도 2일 전 비정상 퇴장의 ip가 남는다', async () => {
    assert.ok((await claim(U(5), '198.51.100.5')).token);
    assert.equal((await ips())[U(2)], '198.51.100.2');
    await db.exec(`delete from public.world_sessions where user_id = '${U(5)}'`);
  });
  const before = await sessionRows(), attrsBefore = await claimAttrs();

  await check('사전 검사: claim v2가 옛 duplicate-ip 판(20260712000300)이면 아무것도 바꾸지 않고 멈춘다', async () => {
    await db.exec('begin');
    await db.exec(await read('../migrations/20260712000300_world_multiplayer.sql'));
    await assert.rejects(db.exec(await read(MIGRATION)), /not the 20260712000400 version/);
    await db.exec('rollback');
    assert.equal(await claimSrc(), v0400);
    assert.equal((await ips())[U(2)], '198.51.100.2');
  });

  await check('적용: 24시간 넘게 끊긴 행의 ip만 지운다 — 행 · 토큰 · 시각 · 살아 있는 행의 ip 그대로', async () => {
    await apply(MIGRATION);
    assert.deepEqual(await ips(), { [U(1)]: '198.51.100.1', [U(2)]: null, [U(3)]: '198.51.100.3', [U(4)]: null });
    assert.deepEqual(await sessionRows(), before);
  });

  await check('claim v2 본문 = 0400 본문 + 청소 호출 한 줄, 속성 · 실행권 그대로', async () => {
    const src = await claimSrc();
    assert.ok(src.includes('PERFORM public.world_sessions_purge_stale_ip();'));
    assert.ok(!src.includes("'duplicate-ip'"), 'db-postconditions 신버전 검사(quoted duplicate-ip 부재) 유지');
    assert.equal(src.replace(/\n  -- IP 보관 상한[^\n]*\n  PERFORM public\.world_sessions_purge_stale_ip\(\);\n/, ''), v0400);
    assert.deepEqual(await claimAttrs(), attrsBefore);
  });

  await check('권한: 청소 함수는 아무 역할도 직접 못 부른다 · claim v2는 authenticated만 · 표 직접 접근 차단 그대로', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await rows(`select has_function_privilege('${role}','public.world_sessions_purge_stale_ip()','EXECUTE') ok`))[0].ok, false, role);
    }
    await as('authenticated', U(1));
    await assert.rejects(db.query('select public.world_sessions_purge_stale_ip()'), /permission denied/);
    await assert.rejects(db.query('select * from public.world_sessions'), /permission denied/);
    await db.exec('reset role');
    await as('anon');
    await assert.rejects(db.query("select public.claim_world_session_v2('203.0.113.9')"), /permission denied/);
    await db.exec('reset role');
  });

  await check('입장 때 청소: 23시간 행이 24시간을 넘기면 다음 누군가의 입장(거절이어도)에서 ip가 지워진다', async () => {
    await db.exec(`update public.world_sessions set heartbeat_at = now() - interval '25 hours' where user_id = '${U(3)}'`);
    const r = await claim(U(1), '198.51.100.1'); // u1은 살아 있어 거절되지만 청소는 먼저 돈다
    assert.deepEqual(r, { token: null, reason: 'duplicate-account' });
    assert.equal((await ips())[U(3)], null);
    assert.equal((await ips())[U(1)], '198.51.100.1');
  });

  await check('임대 동작 그대로: 만료 인수 · 새 ip 기록 · 같은 ip 다른 계정 허용 · 살아 있는 계정 거절', async () => {
    const t2 = await claim(U(2), '198.51.100.20');
    assert.ok(t2.token && t2.reason === null);
    assert.equal((await ips())[U(2)], '198.51.100.20');
    const t6 = await claim(U(6), '198.51.100.20');
    assert.ok(t6.token, '같은 IP 다중 접속 허용(0400) 유지');
    assert.equal((await claim(U(6), '198.51.100.20')).reason, 'duplicate-account');
    await as('authenticated', U(6));
    assert.equal((await rows('select public.heartbeat_world_session($1) ok', [t6.token]))[0].ok, true);
    await rows('select public.release_world_session($1)', [t6.token]);
    await db.exec('reset role');
    assert.equal((await ips())[U(6)], undefined);
  });

  await check('다시 적용해도 같다(멱등) — 바뀔 것이 없으면 아무것도 안 바뀐다', async () => {
    const [src, data, attrs] = [await claimSrc(), await sessionRows(), await claimAttrs()];
    await apply(MIGRATION);
    assert.equal(await claimSrc(), src);
    assert.deepEqual(await sessionRows(), data);
    assert.deepEqual(await claimAttrs(), attrs);
  });

  await check('지문 넷이나 capability 정의가 적용 중 바뀌면 전부 롤백된다', async () => {
    const sql = (await read(MIGRATION)).replace('-- ⑶ 이미 쌓인 오래된 ip', "create or replace function fsrs_private.contract_hash_live() returns text language sql as $x$ select 'drift' $x$;\n-- ⑶ 이미 쌓인 오래된 ip");
    await db.exec('begin');
    await assert.rejects(db.exec(sql), /learning contract fingerprints changed/);
    await db.exec('rollback');
    assert.equal((await rows('select fsrs_private.contract_hash_live() v'))[0].v, 'core');
  });

  await check('복원 SQL: claim v2가 0400 본문 그대로 · 청소 함수 없음 · 실행권 그대로 → 다시 적용 가능', async () => {
    await apply(ROLLBACK);
    assert.equal(await claimSrc(), v0400);
    assert.equal((await rows("select to_regprocedure('public.world_sessions_purge_stale_ip()') is null gone"))[0].gone, true);
    assert.deepEqual(await claimAttrs(), attrsBefore);
    await apply(MIGRATION);
    assert.ok((await claimSrc()).includes('PERFORM public.world_sessions_purge_stale_ip();'));
  });

  console.log(`world-sessions-ip-retention: ${checks} checks passed`);
} finally {
  await db.close();
}
