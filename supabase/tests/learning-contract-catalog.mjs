// Local, disposable PGlite only. This verifier never connects to Supabase.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
// Evaluate only the existing, trusted repository string literal, without executing
// its test module or introducing a duplicate copy of the 10-03 fixture.
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');
const [applyPath, rollbackPath, ...extra] = process.argv.slice(2);
assert.equal(extra.length, 0);
assert.equal(Boolean(applyPath), Boolean(rollbackPath), 'optional exact apply and rollback paths must be supplied together');

const db = new PGlite();
const actor = '00000000-0000-4000-8000-000000000001'; // Synthetic local actor.
const queryOne = async sql => (await db.query(sql)).rows[0];
const pins = () => queryOne(`SELECT
 (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() core,
 (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() manual,
 (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() admission,
 (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() activity`);
const snapshot = async () => (await db.query('SELECT public.fsrs_vocabulary_snapshot($1) value', [actor])).rows[0].value;
const korean = async () => (await queryOne('SELECT public.learning_language_capabilities() value')).value.languages.Korean;
const ready = { save: true, review: true, known: true, exclude: true };
try {
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  assert.deepEqual(await pins(), { core: true, manual: true, admission: true, activity: true });

  // Captured bodies are archived unchanged. Only the capability scalar is localized.
  let bodies = 0;
  for (const [, md5, name] of fixture.matchAll(/-- Observed prosrc MD5 ([a-f0-9]{32}); production OID \d+\.\n\nCREATE OR REPLACE FUNCTION ([a-z_]+\.[a-z_]+)/g)) {
    if (name === 'public.learning_language_capabilities') continue;
    const [schema, fn] = name.split('.');
    const rows = (await db.query(`SELECT md5(p.prosrc) md5 FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname=$2`, [schema, fn])).rows;
    assert.equal(rows.length, 1, name);
    assert.equal(rows[0].md5, md5, name);
    bodies++;
  }
  assert.equal(bodies, 72, 'observed body count');
  const masked = (await db.query(`SELECT md5(regexp_replace(prosrc,$1,$2)) md5 FROM pg_proc
    WHERE oid='public.learning_language_capabilities()'::regprocedure`,
  ["ready:=live_hash= '([0-9a-f]{32})'", "ready:=live_hash= '<hash>'"])).rows[0].md5;
  assert.equal(masked, '4a497440fb53bc1a27c1975875c7d737', 'capability body except published scalar');
  // Contract setup must not import any learner, receipt, policy or baseline rows.
  const relations = (await db.query(`SELECT n.nspname schema,c.relname name FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'
    AND n.nspname IN ('public','fsrs_private','auth') ORDER BY 1,2`)).rows;
  const config = new Set(['settings','manual_save_settings','admission_settings','activity_settings']);
  for (const r of relations) {
    const count = (await queryOne(`SELECT count(*)::int count FROM "${r.schema}"."${r.name}"`)).count;
    assert.equal(count, r.schema==='fsrs_private' && config.has(r.name) ? 1 : 0, `${r.schema}.${r.name} seed count`);
  }

  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [actor]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor]);
  assert.deepEqual(await korean(), ready);
  const before = await snapshot();
  assert.equal(before.enabled, true);
  assert.equal(before.registryAvailable, true);
  assert.deepEqual(before.rows, []);
  assert.deepEqual(before.registry, []);

  // Prove the coupled contract failure without weakening either fingerprint.
  // Its own published capability scalar is absent from the capability fingerprint,
  // but present in the complete function definition hashed by FSRS core.
  await db.exec(`BEGIN;
    DO $drift$ DECLARE definition text; BEGIN
      SELECT pg_get_functiondef('public.learning_language_capabilities()'::regprocedure) INTO definition;
      EXECUTE regexp_replace(definition, 'ready:=live_hash= ''[0-9a-f]{32}''',
        'ready:=live_hash= ''00000000000000000000000000000000''');
    END $drift$;`);
  assert.equal((await pins()).core, false);
  await assert.rejects(snapshot(), e => e.code==='55000' && e.message==='learning_admission_unavailable');
  await db.exec('ROLLBACK');
  assert.deepEqual(await pins(), { core: true, manual: true, admission: true, activity: true });
  assert.deepEqual(await korean(), ready);
  const { now: restoredTime, ...restored } = await snapshot();
  const { now: initialTime, ...initial } = before;
  assert.ok(restoredTime && initialTime);
  assert.deepEqual(restored, initial);

  if (applyPath) {
    const apply = await readFile(applyPath, 'utf8');
    const rollback = await readFile(rollbackPath, 'utf8');
    await db.exec(apply);
    assert.deepEqual(await korean(), ready);
    assert.equal((await pins()).core, false);
    await assert.rejects(snapshot(), e => e.code==='55000' && e.message==='learning_admission_unavailable');
    await db.exec(rollback);
    assert.deepEqual(await pins(), { core: true, manual: true, admission: true, activity: true });
    assert.deepEqual(await korean(), ready);
    const { now: afterTime, ...after } = await snapshot();
    const { now: beforeTime, ...original } = before;
    assert.ok(afterTime && beforeTime);
    assert.deepEqual(after, original);
    console.log('Exact candidate: Korean ready / FSRS 55000 reproduced; rollback restores snapshot.');
  }

  // A second install with learners present must abort before touching any object.
  await assert.rejects(db.exec(fixture), e => e.message==='m09_fixture_requires_empty_auth');
  await db.exec('ROLLBACK');
  assert.deepEqual(await pins(), { core: true, manual: true, admission: true, activity: true });
  console.log(`PASS: ${bodies} exact bodies; four pins; no learner seeds; snapshot; coupled drift/rollback; populated-DB refusal.`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
