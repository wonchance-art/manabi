/** Local, disposable PGlite only — never connects to Supabase (PERF-SNAPSHOT P4).
 * 20261016191600_vocabulary_snapshot_set_flags: snapshot registry 플래그를 집합 연산 한 번으로. 같은 파일에서 manual → core → admission 재게시.
 * 증명: 전 사용자 출력 동일(가장자리 학습자 포함) · 모든 카드 vocabulary_registry_entry = snapshot.registry · 받는 상태는 191500 직후와
 * 이미 적용(no-op)뿐 · 동치가 아닌 본문 거부 · 복원(docs/sql/vocabulary-snapshot-set-flags-rollback.sql) 뒤 원문 · 게시값 정확 복귀.
 *   node supabase/tests/vocabulary-snapshot-set-flags.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';

const md5 = s => createHash('md5').update(s).digest('hex');
const FILE = '../migrations/20261016191600_vocabulary_snapshot_set_flags.sql';
const RESTORE = '../../docs/sql/vocabulary-snapshot-set-flags-rollback.sql';
const REG = 'fsrs_private.vocabulary_registry_entry(uuid,uuid)', SNAP = 'public.fsrs_vocabulary_snapshot(uuid)';
const MD5 = { regOld: '771d6c4f3ecc170b6ae0eb685771ce4e', snapOld: 'f31dd8681a092d3df84746a0dfea9c79', snapP4: '90cb5fb52d43d00eeb4b5c5a41ba8b19' };
const migration = await read(FILE), restore = await read(RESTORE);
const ACTORS = [A, B, C];
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
const timing = {};

async function prepared() {
  const h = await setup({ timing: true });
  await seedEdgeActor(h);
  h.outputs = async () => { const o = {}; for (const u of ACTORS) { const { now, ...rest } = (await h.one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v; o[u] = rest; } return o; };
  h.parity = async () => { let n = 0; for (const u of ACTORS) for (const e of (await h.one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v.registry) {
    assert.deepEqual((await h.one(`SELECT fsrs_private.vocabulary_registry_entry($1,$2) e`, [u, e.cardId])).e, e, `parity ${e.cardId}`); n++; } return n; };
  h.base4 = await h.outputs();
  h.cards = (await h.one('SELECT count(*)::int n FROM public.user_vocabulary')).n;
  return h;
}

try {
  await check('migration shape: one db-push transaction, two states only (no P2 · P3 paths), three re-pins, two post-check gates, temp objects dropped', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.match(migration, /DO \$runner\$[\s\S]*SET LOCAL not in effect/);
    for (const m of Object.values(MD5)) assert.ok(migration.includes(m), m);
    const code = migration.replace(/--[^\n]*/g, '');
    for (const dead of ['19f73b572cac7603571fdbbb0a8c71d7', '0ef9f99ce888b4733314704dbc5b5bca', "'index:user_known_words:'"]) assert.ok(!code.includes(dead), `no dead P2/P3 path: ${dead}`);
    assert.match(migration, /PERFORM pg_temp\.perf_repin\('manual'\);\s*PERFORM pg_temp\.perf_repin\('core'\);\s*PERFORM pg_temp\.perf_repin\('admission'\);/);
    assert.match(migration, /fsrs_vocabulary_snapshot\(b\.actor\) - 'now'\) IS DISTINCT FROM b\.body/);
    assert.match(migration, /fsrs_private\.vocabulary_registry_entry\(s\.actor, \(e\.x->>'cardId'\)::uuid\) IS DISTINCT FROM e\.x/);
    assert.ok(!migration.replace(/--[^\n]*/g, '').includes('9dcbdd2614642e67911d4fcf2055b42d'), 'only the post-KO-CAP core value in code');
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), name);
    assert.match(migration, /DROP TABLE pg_temp\.perf_fn_before, pg_temp\.perf_state_before, pg_temp\.perf_snapshot_before;\s*$/);
  });

  // ── KO-CAP-REPIN 직후(지금 운영이 갈 상태)
  {
    const h = await prepared();
    const { db, LOCAL } = h;
    const local = h.localize(migration), localRestore = h.localize(restore);
    const cap = await h.capability();
    assert.equal(await h.parity(), h.cards, 'baseline parity (registry is registry_entry itself)');
    timing.before = await h.snapshotMs();

    await check('a non-equivalent set body (base_form branch dropped) is caught by the output gate and rolls back', async () => {
      const good = migration.match(/CREATE OR REPLACE FUNCTION public\.fsrs_vocabulary_snapshot[\s\S]*? AS \$fn\$([\s\S]*?)\$fn\$;/)[1];
      assert.equal(md5(good), MD5.snapP4);
      const bad = good.replace(/\(k1\.w IS NOT NULL OR k2\.w IS NOT NULL\)/, '(k1.w IS NOT NULL)');
      assert.notEqual(bad, good);
      const before = { pins: await h.pins(), snap: await h.fnmd5(SNAP) };
      await h.expectFail(local.replace(good, bad).replaceAll(MD5.snapP4, md5(bad)), /snapshot output changed for \d+ of 3 actor/);
      assert.deepEqual({ pins: await h.pins(), snap: await h.fnmd5(SNAP) }, before);
      assert.equal(await h.tempLeft(), 0);
    });

    await check('refuses states that are not reachable now (P2 registry body, P3 index) — nothing changes', async () => {
      const before = { pins: await h.pins(), snap: await h.fnmd5(SNAP), reg: await h.fnmd5(REG) };
      await db.exec('BEGIN');
      await db.exec(`DO $x$ DECLARE d text; BEGIN SELECT pg_get_functiondef('${REG}'::regprocedure) INTO d;
        EXECUTE replace(d, 'RETURN jsonb_build_object(', 'RETURN pg_catalog.jsonb_build_object('); END $x$;
        UPDATE fsrs_private.manual_save_settings SET contract_hash=fsrs_private.manual_contract_hash();
        UPDATE fsrs_private.settings SET contract_hash=fsrs_private.contract_hash();
        UPDATE fsrs_private.admission_settings SET contract_hash=fsrs_private.admission_contract_hash();`);
      await assert.rejects(db.exec(local), e => /vocabulary_registry_entry is not the reviewed body/.test(e.message));
      await db.exec('ROLLBACK');
      await h.expectFail(`CREATE INDEX user_known_words_norm_word_idx ON public.user_known_words (user_id, lang, normalize(btrim(word_text), NFC));\n${local}`, /Korean capability is not ready|unexpected index/);
      assert.deepEqual({ pins: await h.pins(), snap: await h.fnmd5(SNAP), reg: await h.fnmd5(REG) }, before);
    });

    let after;
    await check('applies right after KO-CAP-REPIN: P4 body, manual/core/admission re-pinned, registry_entry · capability · profile unchanged, outputs identical, parity on every card', async () => {
      await db.exec(local);
      assert.deepEqual([await h.fnmd5(SNAP), await h.fnmd5(REG)], [MD5.snapP4, MD5.regOld]);
      const p = await h.pins();
      assert.equal(p.ok, true);
      assert.notEqual(p.manual, LOCAL.manual); assert.notEqual(p.admission, LOCAL.admission); assert.notEqual(p.core, LOCAL.coreAfterKo);
      assert.equal(p.profile, LOCAL.profile);
      assert.deepEqual(await h.capability(), cap);
      assert.equal(await h.koreanReady(), true);
      assert.deepEqual(await h.outputs(), h.base4);
      assert.equal(await h.parity(), h.cards);
      assert.equal(await h.tempLeft(), 0);
      timing.afterP4 = await h.snapshotMs();
      after = p;
    });

    await check('after P4: the registry_entry ≡ snapshot.registry gate fires when a (re-pinned) change touches only one definition', async () => {
      const gate = migration.match(/DO \$parity\$[\s\S]*?END \$parity\$;/)[0];
      await db.exec('BEGIN');
      await db.exec(`CREATE TEMP TABLE perf_snapshot_before ON COMMIT DROP AS SELECT DISTINCT user_id AS actor FROM public.user_vocabulary`);
      await db.exec(`DO $x$ DECLARE d text; BEGIN SELECT pg_get_functiondef('${REG}'::regprocedure) INTO d;
        EXECUTE replace(d, '''known'',is_known,', '''known'',false,'); END $x$;`);
      // a properly re-pinned future change to one definition only — the contracts pass, only the parity gate can catch it
      await db.exec(`UPDATE fsrs_private.manual_save_settings SET contract_hash=fsrs_private.manual_contract_hash();
        UPDATE fsrs_private.settings SET contract_hash=fsrs_private.contract_hash();
        UPDATE fsrs_private.admission_settings SET contract_hash=fsrs_private.admission_contract_hash();`);
      await assert.rejects(db.exec(gate), e => /registry_entry differs from snapshot\.registry for \d+ of \d+ card/.test(e.message));
      await db.exec('ROLLBACK');
      assert.equal(await h.fnmd5(REG), MD5.regOld);
      assert.deepEqual(await h.pins(), after);
    });

    await check('already applied: second run is a clean no-op', async () => {
      await db.exec(local);
      assert.deepEqual(await h.pins(), after);
      assert.deepEqual(await h.outputs(), h.base4);
    });

    await check('restore: back to the original snapshot body, all four pins back exactly, outputs identical', async () => {
      await db.exec(localRestore);
      assert.deepEqual([await h.fnmd5(SNAP), await h.fnmd5(REG)], [MD5.snapOld, MD5.regOld]);
      const p = await h.pins();
      assert.deepEqual([p.ok, p.manual, p.admission, p.core, p.profile], [true, LOCAL.manual, LOCAL.admission, LOCAL.coreAfterKo, LOCAL.profile]);
      assert.deepEqual(await h.outputs(), h.base4);
      assert.equal(await h.tempLeft(), 0);
      await h.expectFail(localRestore, /snapshot is not the P4 body/);
      await db.exec(local); // re-apply after restore
      assert.deepEqual(await h.pins(), after);
    });
    await db.close();
  }

  console.log(`TIMING snapshot(1,232 words, PGlite median of 5): ${JSON.stringify(timing)}`);
  console.log(`PASS vocabulary-snapshot-set-flags: ${checks} checks`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
}
