/** Isolated PostgreSQL verification; no network or live DB connection (ERROR-OBSERVE-001, 2026-11-06 KST).
 * 운영 오류 기록 표 observe.error_events와 쓰기 함수 public.observe_record_error — 적용(로그인 맥락 없음 = db push) → 접근 행렬(anon ·
 * authenticated 읽기 · 쓰기 · 실행 거절, service_role은 실행만) → 정리(길이 · 쿼리 · 모양) → 같은 오류 한 줄 · 횟수 → 분당 · 하루 상한 →
 * 30일 보존 → 멱등 → 복원 SQL → 다시 적용. PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/error-events.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const MIGRATION = new URL('../migrations/20261106180000_error_events.sql', import.meta.url);
const ROLLBACK = new URL('../../docs/sql/error-events-20261106-rollback.sql', import.meta.url);
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
async function as(role) { await db.exec('reset role'); await db.exec(`set role ${role}`); }
const apply = async (file = MIGRATION) => { await db.exec('reset role'); await db.exec('begin'); await db.exec(await fs.readFile(file, 'utf8')); await db.exec('commit'); };
const record = async (args = {}) => {
  const a = { source: 'client', kind: 'boundary.root', message: 'TypeError: x is not a function', stack: null, digest: null, route: '/home', release: 'abc1234', browser: 'chrome', ...args };
  await as('service_role');
  const r = await rows('select public.observe_record_error($1,$2,$3,$4,$5,$6,$7,$8) as r', [a.source, a.kind, a.message, a.stack, a.digest, a.route, a.release, a.browser]);
  await db.exec('reset role');
  return r[0].r;
};
const all = async () => rows('select source, kind, message, stack, digest, route, release, browser, hits from observe.error_events order by id');

try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
  grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  -- 지문 측정이 부르는 _live 넷과 capability 정의(값은 대역) — 측정이 로그인 맥락 없이 돈다는 것만 본다. 실제 지문은 post-observation-migrations.mjs.
  create schema fsrs_private;
  create function fsrs_private.contract_hash_live() returns text language sql as $$ select 'core' $$;
  create function fsrs_private.manual_contract_hash_live() returns text language sql as $$ select 'manual' $$;
  create function fsrs_private.admission_contract_hash_live() returns text language sql as $$ select 'admission' $$;
  create function fsrs_private.activity_profile_hash_live() returns text language sql as $$ select 'activity' $$;
  create function public.learning_language_capabilities() returns jsonb language plpgsql as $$ begin
    if auth.uid() is null then raise exception 'login_required' using errcode = '42501'; end if; return '{}'::jsonb; end $$;`);

  await check('적용: 로그인 맥락 없이(db push) 한 트랜잭션 — capability를 부르지 않는다', async () => {
    await apply();
    assert.equal((await rows("select count(*)::int n from pg_namespace where nspname='observe'"))[0].n, 1);
  });

  await check('접근 행렬: anon · authenticated는 표 · 스키마 · 함수 모두 거절, service_role은 실행만(표 직접 읽기 거절)', async () => {
    for (const role of ['anon', 'authenticated']) {
      await as(role);
      await assert.rejects(db.query('select * from observe.error_events'), /permission denied/, `${role} select`);
      await assert.rejects(db.query("insert into observe.error_events(bucket,fingerprint,source,kind,message) values(now(),md5('x'),'client','x','x')"), /permission denied/, `${role} insert`);
      await assert.rejects(db.query("select public.observe_record_error('client','boundary.root','x',null,null,'/',null,null)"), /permission denied/, `${role} rpc`);
    }
    await as('service_role');
    await assert.rejects(db.query('select * from observe.error_events'), /permission denied/, 'service_role select');
    await db.exec('reset role');
    const [{ rls, policies }] = await rows("select c.relrowsecurity rls, (select count(*)::int from pg_policy where polrelid=c.oid) policies from pg_class c where c.oid='observe.error_events'::regclass");
    assert.equal(rls, true); assert.equal(policies, 0);
    const [{ secdef, config }] = await rows("select prosecdef secdef, proconfig[1] config from pg_proc where oid='public.observe_record_error(text,text,text,text,text,text,text,text)'::regprocedure");
    assert.equal(secdef, true); assert.equal(config, 'search_path=""');
  });

  await check('같은 오류는 한 시간 칸에 한 줄 — 두 번째는 횟수만 오른다', async () => {
    assert.equal(await record(), 'recorded');
    assert.equal(await record(), 'counted');
    const r = await all();
    assert.equal(r.length, 1); assert.equal(r[0].hits, 2);
    assert.equal(await record({ digest: '1234567890' }), 'recorded', 'digest가 다르면 다른 줄(오류 ID로 찾을 수 있게)');
  });

  await check('함수가 다시 자른다: 메시지 500 · 스택 1000 · 경로 쿼리/조각 제거 · 모양이 틀린 digest · 판 · 브라우저는 비움', async () => {
    await db.exec('delete from observe.error_events');
    assert.equal(await record({ message: `  a\n\tb ${'x'.repeat(900)}`, stack: 's'.repeat(1500), route: '/viewer/abc?token=secret#frag',
      digest: 'bad digest!', release: 'NOT A SHA', browser: 'Mozilla/5.0 (full UA)' }), 'recorded');
    const [r] = await all();
    assert.equal(r.message.length, 500); assert.ok(r.message.startsWith('a b x'));
    assert.equal(r.stack.length, 1000);
    assert.equal(r.route, '/viewer/abc');
    assert.equal(r.digest, null); assert.equal(r.release, null); assert.equal(r.browser, null);
    assert.equal(await record({ route: 'https://evil.example/x?q=1' }), 'recorded');
    assert.equal((await all())[1].route, null, '/로 시작하지 않는 주소는 버린다');
  });

  await check('잘못된 입력은 invalid(줄 없음) — 출처 · 종류 모양 · 빈 메시지', async () => {
    await db.exec('delete from observe.error_events');
    assert.equal(await record({ source: 'admin' }), 'invalid');
    assert.equal(await record({ kind: 'Boundary Root' }), 'invalid');
    assert.equal(await record({ message: '   ' }), 'invalid');
    assert.equal(await record({ message: null }), 'invalid');
    assert.equal((await all()).length, 0);
  });

  await check('쏟아짐 상한: 새 줄 분당 30 — 넘으면 dropped, 이미 있는 줄의 횟수는 계속 오른다', async () => {
    await db.exec('delete from observe.error_events');
    for (let i = 0; i < 30; i++) assert.equal(await record({ message: `flood ${i}` }), 'recorded');
    assert.equal(await record({ message: 'flood 30' }), 'dropped');
    assert.equal(await record({ message: 'flood 0' }), 'counted');
    assert.equal((await all()).length, 30);
  });

  await check('하루 상한 1000 — 분당 상한 밖(1분 넘은) 줄로도 하루 1000이면 dropped', async () => {
    await db.exec(`delete from observe.error_events;
      insert into observe.error_events(created_at, last_seen_at, bucket, fingerprint, source, kind, message)
      select now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours', md5('day' || g), 'server', 'server.render', 'm' || g from generate_series(1, 1000) g;`);
    assert.equal(await record({ message: 'day overflow' }), 'dropped');
  });

  await check('보존 30일: 새 줄을 쓸 때 30일 지난 줄을 200줄씩 지운다', async () => {
    await db.exec(`delete from observe.error_events;
      insert into observe.error_events(created_at, last_seen_at, bucket, fingerprint, source, kind, message)
      select now() - interval '31 days', now() - interval '31 days', now() - interval '31 days' + g * interval '1 second', md5('old' || g), 'client', 'window.error', 'old' || g from generate_series(1, 250) g;
      insert into observe.error_events(created_at, last_seen_at, bucket, fingerprint, source, kind, message)
      values (now() - interval '29 days', now() - interval '29 days', now() - interval '29 days', md5('keep'), 'client', 'window.error', 'keep');`);
    assert.equal(await record({ message: 'fresh' }), 'recorded');
    const left = await rows("select count(*) filter (where created_at < now() - interval '30 days')::int old, count(*)::int n from observe.error_events");
    assert.deepEqual(left[0], { old: 50, n: 52 }, '250 − 200 = 50 남음 + 29일 된 줄 + 새 줄');
    assert.equal(await record({ message: 'fresh 2' }), 'recorded');
    assert.equal((await rows("select count(*)::int n from observe.error_events where created_at < now() - interval '30 days'"))[0].n, 0);
  });

  await check('멱등: 다시 적용해도 거절 없이 같은 모양 · 기록 보존', async () => {
    const before = (await all()).length;
    await apply();
    assert.equal((await all()).length, before);
    await as('anon');
    await assert.rejects(db.query('select * from observe.error_events'), /permission denied/);
    await db.exec('reset role');
  });

  await check('다른 모양의 표가 이미 있으면 멈춘다(사전 검사)', async () => {
    await db.exec('alter table observe.error_events add column extra text');
    await db.exec('begin');
    await assert.rejects(db.exec(await fs.readFile(MIGRATION, 'utf8')), /different shape/);
    await db.exec('rollback');
    await db.exec('alter table observe.error_events drop column extra');
  });

  await check('복원 SQL: 함수 · 표 · 스키마가 사라지고, 다시 적용하면 처음과 같다', async () => {
    await apply(ROLLBACK);
    assert.equal((await rows("select count(*)::int n from pg_namespace where nspname='observe'"))[0].n, 0);
    assert.equal((await rows("select count(*)::int n from pg_proc where proname='observe_record_error'"))[0].n, 0);
    await apply();
    assert.equal(await record(), 'recorded');
  });

  console.log(`error-events: ${checks}/${checks} PASS`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.close();
}
