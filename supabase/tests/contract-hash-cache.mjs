/** Local, disposable PGlite only — never connects to Supabase (DB-LOAD C).
 * 20261023100000_contract_hash_cache: 학습 계약 지문 넷을 구조가 바뀔 때만 계산한다(캐시 + 이벤트 트리거 무효화 + 커밋 직전 재계산).
 * 증명: 적용 뒤 네 계약 동치 · 캐시 = 실제 지문 · snapshot 출력 동일 · 한국어 ready / 캐시가 실제로 쓰인다 / 계약 범위 DDL은
 * 커밋 전에도 뒤에도 그대로 막힌다(fail-closed 보존) / 임시 객체 DDL은 캐시를 건드리지 않고 읽기 전용 트랜잭션에서도 쓰인다 / DDL이 아닌
 * 역할 변경은 플랫폼 지문이 잡는다 / 재계산 실패는 DDL을 막지 않고 캐시를 무효로 둔다 / 재실행 no-op / 복원 뒤 원문 · 게시값 정확 복귀.
 *   node supabase/tests/contract-hash-cache.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';

const FILE = '20261023100000_contract_hash_cache.sql';
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/contract-hash-cache-rollback.sql');
const NAMES = ['contract_hash', 'manual_contract_hash', 'admission_contract_hash', 'activity_profile_hash'];
const ORIGINAL = { contract_hash: 'b43887acc3619ca718b0912b15f833af', manual_contract_hash: '9c59598d3a669aa34da38344f514fae6',
  admission_contract_hash: 'ef7227c3f7d3ff47760d9ce06c844231', activity_profile_hash: '2c3b288d2739925159418048da75a65d' };
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
await seedEdgeActor(h);
const { db, one } = h;
// 운영 순서대로 관측 뒤 마이그레이션(191500 이후 · 이 파일 전)을 올린다 — fixture 범위 밖(대화방 등)은 건너뛴다.
for (const f of (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort()) {
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
const outputs = async () => { const o = {}; for (const u of [A, B, C]) { const { now, ...rest } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v; o[u] = rest; } return o; };
const md5s = async () => Object.fromEntries((await db.query(`SELECT p.proname, md5(p.prosrc) m FROM pg_proc p WHERE p.pronamespace='fsrs_private'::regnamespace
  AND p.proname = ANY($1)`, [NAMES])).rows.map(r => [r.proname, r.m]));
const cache = () => one('SELECT * FROM fsrs_private.contract_cache');
const live = () => one(`SELECT fsrs_private.contract_hash_live() core, fsrs_private.manual_contract_hash_live() manual,
  fsrs_private.admission_contract_hash_live() admission, fsrs_private.activity_profile_hash_live() profile`);
const integrity = () => db.query('SELECT fsrs_private.require_admission_integrity()');
const unavailable = e => /learning_admission_unavailable/.test(e.message);
const ms = async (sql, runs = 5) => { const t = []; for (let i = 0; i < runs; i++) { const s = performance.now(); await db.query(sql); t.push(performance.now() - s); } return Math.round(t.sort((x, y) => x - y)[Math.floor(runs / 2)] * 10) / 10; };

const before = { pins: await h.pins(), md5: await md5s(), out: await outputs(), cap: await h.capability() };
assert.equal(before.pins.ok, true, 'chain leaves the four contracts consistent');
assert.deepEqual(before.md5, ORIGINAL, 'fixture + chain = the production bodies the migration accepts');
const timing = { before: { integrity: await ms('SELECT fsrs_private.require_admission_integrity()'), snapshot: await ms(`SELECT length(public.fsrs_vocabulary_snapshot('${A}')::text)`) } };

try {
  await check('migration shape: one db-push transaction, three re-pins, refresh run before commit, temp objects dropped', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.match(migration, /DO \$runner\$[\s\S]*SET LOCAL not in effect/);
    for (const m of Object.values(ORIGINAL)) assert.ok(migration.includes(m) && restore.includes(m), m);
    assert.match(migration, /PERFORM pg_temp\.cc_repin\('manual'\);\s*PERFORM pg_temp\.cc_repin\('core'\);\s*PERFORM pg_temp\.cc_repin\('admission'\);/);
    assert.match(migration, /SET CONSTRAINTS fsrs_private\.contract_cache_refresh IMMEDIATE;/);
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), name);
    for (const [, name] of restore.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(restore.includes(`DROP FUNCTION ${name}(`), name);
  });

  let applied;
  await check('applies: originals moved to _live, same oid/owner/ACL on the names, contracts re-pinned, cache valid after commit, outputs identical, Korean ready', async () => {
    const oids = (await db.query(`SELECT proname, oid::int, proacl::text acl FROM pg_proc WHERE pronamespace='fsrs_private'::regnamespace AND proname = ANY($1) ORDER BY 1`, [NAMES])).rows;
    await db.exec(migration);
    assert.deepEqual((await db.query(`SELECT proname, oid::int, proacl::text acl FROM pg_proc WHERE pronamespace='fsrs_private'::regnamespace AND proname = ANY($1) ORDER BY 1`, [NAMES])).rows, oids);
    for (const n of NAMES) assert.equal((await one(`SELECT md5(prosrc) m, proacl::text acl FROM pg_proc WHERE oid='fsrs_private.${n}_live()'::regprocedure`)).m, ORIGINAL[n]);
    const p = await h.pins();
    assert.equal(p.ok, true);
    assert.notEqual(p.core, before.pins.core); assert.notEqual(p.manual, before.pins.manual); assert.notEqual(p.admission, before.pins.admission);
    assert.equal(p.profile, before.pins.profile, 'activity profile is outside the change');
    const k = await cache(), l = await live();
    assert.equal(k.valid, true, 'refreshed before commit');
    assert.deepEqual({ core: k.core, manual: k.manual, admission: k.admission, profile: k.profile }, l);
    assert.deepEqual({ core: k.core, manual: k.manual, admission: k.admission, profile: k.profile }, { core: p.core, manual: p.manual, admission: p.admission, profile: p.profile });
    await integrity();
    assert.deepEqual(await outputs(), before.out);
    assert.equal(await h.koreanReady(), true);
    assert.deepEqual(await h.capability(), before.cap);
    assert.equal(Number((await one(`SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'cc\\_%'`)).n), 0);
    assert.equal((await one(`SELECT count(*)::int n FROM pg_event_trigger WHERE evtname LIKE 'fsrs\\_contract\\_cache\\_%' AND evtenabled='O'`)).n, 2);
    applied = { pins: p, cache: k };
    timing.after = { integrity: await ms('SELECT fsrs_private.require_admission_integrity()'), snapshot: await ms(`SELECT length(public.fsrs_vocabulary_snapshot('${A}')::text)`) };
  });

  await check('the cache is what the names return (a forged cached value makes the guard fail closed)', async () => {
    await db.exec('BEGIN');
    await db.exec("UPDATE fsrs_private.contract_cache SET core = md5('forged')");
    assert.equal((await one('SELECT fsrs_private.contract_hash() v')).v, (await one("SELECT md5('forged') v")).v);
    await assert.rejects(integrity(), unavailable);
    await db.exec('ROLLBACK');
    await integrity();
  });

  await check('contract-scope DDL without a re-pin is refused inside the transaction and after commit (fail-closed kept), and recovers on revert', async () => {
    const def = (await one(`SELECT pg_get_functiondef('fsrs_private.iso_milliseconds(timestamp with time zone)'::regprocedure) d`)).d;
    await db.exec('BEGIN');
    await db.exec(def.replace(/\$function\$\n/, '$function$\n -- drift\n'));
    await db.exec('SAVEPOINT probe');
    await assert.rejects(integrity(), unavailable, 'same transaction: cache invalid → live fingerprint ≠ pin');
    await db.exec('ROLLBACK TO SAVEPOINT probe');
    await db.exec('COMMIT');
    const k = await cache();
    assert.equal(k.valid, true, 'recomputed at commit');
    assert.notEqual(k.core, applied.cache.core);
    await assert.rejects(integrity(), unavailable, 'after commit: cached fingerprint (new) ≠ pin');
    await db.exec(def);
    assert.deepEqual(await cache().then(({ refreshed_at, ...r }) => r), (({ refreshed_at, ...r }) => r)(applied.cache));
    await integrity();
  });

  await check('GRANT (no object drop) on a contract table also invalidates and recomputes', async () => {
    await db.exec('GRANT SELECT ON fsrs_private.contract_cache TO anon');
    await assert.rejects(integrity(), unavailable);
    await db.exec('REVOKE SELECT ON fsrs_private.contract_cache FROM anon');
    await integrity();
    assert.equal((await cache()).core, applied.cache.core);
  });

  await check('temporary-object DDL leaves the cache alone; the cached path works in a read-only transaction', async () => {
    const k = await cache();
    await db.exec('CREATE TEMP TABLE cc_t(x int); ALTER TABLE cc_t ADD COLUMN y int; CREATE INDEX ON cc_t(x); DROP TABLE cc_t;');
    await db.exec('BEGIN READ ONLY; SELECT fsrs_private.require_admission_integrity(); COMMIT;'); // PostgREST가 STABLE RPC를 읽기 전용으로 부르는 길
    assert.deepEqual(await cache(), k, 'not invalidated, not recomputed');
  });

  await check('a role change (not DDL) is caught by the platform fingerprint and clears when reverted', async () => {
    const k = await cache();
    await db.exec('ALTER ROLE anon BYPASSRLS');
    assert.deepEqual(await cache(), k, 'no event trigger for role commands');
    assert.notEqual((await one('SELECT fsrs_private.contract_platform_fingerprint() f')).f, k.fingerprint);
    await assert.rejects(integrity(), unavailable, 'live contract fingerprint includes role attributes');
    await db.exec('ALTER ROLE anon NOBYPASSRLS');
    assert.equal((await one('SELECT fsrs_private.contract_platform_fingerprint() f')).f, k.fingerprint);
    await integrity();
  });

  await check('a failed refresh never aborts the DDL — the cache stays invalid (live path) until the next DDL recomputes it', async () => {
    await db.exec(`CREATE FUNCTION public.cc_break() RETURNS int LANGUAGE sql AS 'SELECT 1';
      ALTER FUNCTION fsrs_private.activity_profile_hash_live() RENAME TO activity_profile_hash_live_x;`); // refresh at commit fails (function missing)
    assert.equal((await cache()).valid, false);
    assert.ok(await one('SELECT 1 FROM pg_proc WHERE proname=\'cc_break\''), 'DDL committed');
    await db.exec('ALTER FUNCTION fsrs_private.activity_profile_hash_live_x() RENAME TO activity_profile_hash_live; DROP FUNCTION public.cc_break();');
    assert.equal((await cache()).valid, true);
    await integrity();
  });

  await check('already applied: second run re-validates and changes nothing', async () => {
    await db.exec(migration);
    const p = await h.pins();
    assert.deepEqual(p, applied.pins);
    assert.equal((await cache()).valid, true);
    assert.deepEqual(await outputs(), before.out);
  });

  await check('refuses an unreviewed hash body', async () => {
    await db.exec(restore);
    const def = (await one(`SELECT pg_get_functiondef('fsrs_private.manual_contract_hash()'::regprocedure) d`)).d;
    await db.exec('BEGIN');
    await db.exec(def.replace(/ SELECT md5\(jsonb_object_agg/, ' SELECT md5(jsonb_object_agg').replace('FROM objects', 'FROM objects WHERE true'));
    await db.exec(`UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash();
      UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash(); UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash();`);
    await assert.rejects(db.exec(migration), /manual_contract_hash\(\) is not the reviewed production body/);
    await db.exec('ROLLBACK');
  });

  await check('rollback: originals back on the same oids, cache objects gone, pins exactly the pre-migration values, outputs identical; re-apply works', async () => {
    assert.deepEqual(await md5s(), ORIGINAL);
    assert.deepEqual(await h.pins(), before.pins);
    assert.equal(await one(`SELECT to_regclass('fsrs_private.contract_cache') r`).then(r => r.r), null);
    assert.equal((await one(`SELECT count(*)::int n FROM pg_event_trigger WHERE evtname LIKE 'fsrs\\_contract\\_cache\\_%'`)).n, 0);
    assert.deepEqual(await outputs(), before.out);
    assert.equal(await h.koreanReady(), true);
    await db.exec(migration);
    // core는 객체 oid를 열쇠로 쓰므로 다시 만든 _live · 캐시 객체의 새 oid만큼 달라진다 — manual · admission · profile은 같은 값.
    const again = await h.pins();
    assert.equal(again.ok, true);
    assert.deepEqual({ manual: again.manual, admission: again.admission, profile: again.profile },
      { manual: applied.pins.manual, admission: applied.pins.admission, profile: applied.pins.profile });
    assert.equal((await cache()).valid, true);
    await integrity();
    assert.deepEqual(await outputs(), before.out);
  });
} finally {
  await db.close();
}
console.log(`timing (PGlite median ms): require_admission_integrity ${timing.before.integrity} → ${timing.after?.integrity}; snapshot ${timing.before.snapshot} → ${timing.after?.snapshot}`);
console.log(`${checks} checks passed`);
