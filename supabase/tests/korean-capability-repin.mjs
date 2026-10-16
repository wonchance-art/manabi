/** Local, disposable PGlite only — never connects to Supabase (KO-CAP-REPIN-001).
 * #1504(anon_book_chapters_hidden)가 끈 한국어 capability를 20261016191500_korean_capability_repin이 되살리는지,
 * 운영 관측 계약 fixture(M09, #1399) 위에서 db push와 같은 「한 트랜잭션」으로 적용해 확인한다(§4.9-1 규칙).
 * 운영 고정 기대값(게시 · 실제 지문, 네 계약 게시값)만 이 fixture의 지역값으로 바꾸고, 나머지 본문은 파일 그대로 실행한다.
 *   node supabase/tests/korean-capability-repin.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { PROD, localize } from './lib/production-constants.mjs'; // post-observation-migrations.mjs와 같은 치환

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const MIGRATION = './../migrations/20261016191500_korean_capability_repin.sql';
const A = '00000000-0000-4000-8000-0000000000a1'; // synthetic local learners
const B = '00000000-0000-4000-8000-0000000000b2';

const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const migration = await read(MIGRATION);
const db = new PGlite();
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
const one = async (sql, p) => (await db.query(sql, p)).rows[0];
const pins = () => one(`SELECT (SELECT contract_hash FROM fsrs_private.settings) core,(SELECT contract_hash FROM fsrs_private.manual_save_settings) manual,
 (SELECT contract_hash FROM fsrs_private.admission_settings) admission,(SELECT profile_contract_hash FROM fsrs_private.activity_settings) profile,
 (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AND (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash()
 AND (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() AND (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() ok`);
const capability = () => one(`SELECT substring(prosrc from 'ready:=live_hash= ''([0-9a-f]{32})''') pinned, md5(regexp_replace(prosrc,'ready:=live_hash= ''([0-9a-f]{32})''','ready:=live_hash= ''<hash>''')) template,
 proacl::text acl, proowner::regrole::text owner, prosecdef, proconfig::text config, provolatile FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`);
const fingerprint = migration.match(/CREATE FUNCTION pg_temp\.perf_korean_live_hash\(\) RETURNS text [^\n]*\$q\$\n([\s\S]*?)\n\$q\$;/)[1];
const live = async () => { await db.exec("BEGIN; SET LOCAL search_path='';"); try { return (await one(fingerprint)).md5; } finally { await db.exec('COMMIT'); } };
const as = u => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [u]);
const koreanReady = async () => { await as(A); const k = (await one('SELECT public.learning_language_capabilities() value')).value.languages.Korean; return Object.values(k).every(Boolean); };
const snaps = async () => { const out = {}; for (const u of [A, B]) { const { now, ...rest } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v; assert.ok(now); out[u] = rest; } return out; };
const tempLeft = async () => (await one(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'perf\\_%'`)).n
  + (await one(`SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp%' AND c.relname LIKE 'perf\\_%'`)).n;
const expectFail = async (sql, re) => { await assert.rejects(db.exec(sql), e => { assert.match(e.message, re); return true; }); await db.exec('ROLLBACK').catch(() => {}); };

try {
  await check('migration shape: one db-push transaction, guards kept, temp objects dropped', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im, 'db push wraps the file — no explicit transaction control');
    assert.doesNotMatch(migration, /\bCONCURRENTLY\b/i, 'nothing the CLI would split out of the transaction');
    for (const k of Object.values(PROD)) assert.ok(migration.includes(k), `production expectation ${k} present`);
    for (const s of [
      /SET LOCAL search_path = ''/, /SET LOCAL lock_timeout = '5s'/, /SET LOCAL statement_timeout = '180s'/,
      /DO \$runner\$[\s\S]*SET LOCAL not in effect/,
      /IF k->>'pinned' = '1c25422c[0-9a-f]{24}' THEN/, /ELSIF k->>'pinned' = 'da2c7548[0-9a-f]{24}' THEN/, /ELSE\s+RAISE EXCEPTION 'korean_capability_repin: pinned value is neither/, /already-repaired run must not change anything/, /k->>'live' IS DISTINCT FROM 'da2c7548[0-9a-f]{24}'/,
      /perf_korean_live_hash_without\('policy:reading_materials:anon_book_chapters_hidden'\) IS DISTINCT FROM '1c25422c/,
      /PERFORM pg_temp\.perf_repin_capability\(NULL\);\s*PERFORM pg_temp\.perf_repin\('core'\);/,
      /perf_korean_ready\(\) IS DISTINCT FROM true/, /NOT \(c->>'ok'\)::boolean THEN RAISE/, /diffs <> 0 THEN RAISE/,
      /manual\/admission pin moved/, /activity profile pin moved/,
    ]) assert.match(migration, s);
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), `${name} dropped`);
    assert.match(migration, /DROP TABLE pg_temp\.perf_state_before, pg_temp\.perf_snapshot_before;\s*$/);
  });

  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(await read('./fixtures/m09-learning-contracts-20261010.sql'));
  for (const u of [A, B]) { await db.query('INSERT INTO auth.users(id) VALUES ($1)', [u]); await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [u]); }
  // [id, user, language, word_text, base_form] — 평범 · 아는 단어(본문 · 기본형 · 공백) · 제외(카드 · 언어+단어 · 옛 카드) · 둘 다 · 다른 사용자
  for (const [id, u, lang, w, base] of [
    ['10000000-0000-4000-8000-000000000001', A, 'Japanese', '猫', null], ['10000000-0000-4000-8000-000000000002', A, 'Japanese', '犬', null],
    ['10000000-0000-4000-8000-000000000003', A, 'Japanese', '食べた', '食べる'], ['10000000-0000-4000-8000-000000000004', A, 'Japanese', '鳥', null],
    ['10000000-0000-4000-8000-000000000005', A, 'Chinese', '学校', null], ['10000000-0000-4000-8000-000000000006', A, 'Korean', '사과', null],
    ['10000000-0000-4000-8000-000000000007', A, 'English', ' apple ', null], ['10000000-0000-4000-8000-000000000008', A, 'French', 'chat', null],
    ['20000000-0000-4000-8000-000000000001', B, 'Japanese', '犬', null], ['20000000-0000-4000-8000-000000000002', B, 'Korean', '책', null],
  ]) { await as(u); await db.query('INSERT INTO public.user_vocabulary(id,user_id,language,word_text,base_form) VALUES ($1,$2,$3,$4,$5)', [id, u, lang, w, base]); }
  for (const [u, lang, w] of [[A, 'ja', '犬'], [A, 'ja', '食べる'], [A, 'ko', '사과'], [A, 'en', 'apple'], [B, 'zh', '学校']]) {
    await as(u); await db.query('INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES ($1,$2,$3)', [u, lang, w]);
  }
  for (const [u, lang, w, vid, retired] of [[A, 'Japanese', '鳥', '10000000-0000-4000-8000-000000000004', '{}'], [A, 'Chinese', '学校', null, '{}'],
    [A, 'Korean', '사과', null, '{}'], [A, 'French', 'chien', null, '{10000000-0000-4000-8000-000000000008}']]) {
    await as(u); await db.query('INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [u, lang, w, vid, retired]);
  }
  const base = await snaps();
  assert.equal(base[A].rows.length, 8);
  assert.ok(base[A].registry.some(r => r.known) && base[A].registry.some(r => r.excluded && !r.known));
  const LOCAL = { pin: (await capability()).pinned, ...(({ ok, ...p }) => p)(await pins()) };
  const capBefore = await capability();

  await check('#1504 policy turns Korean off; FSRS pins untouched (reproduced)', async () => {
    assert.equal(await koreanReady(), true);
    await db.exec(await read('../migrations/20261016150000_anon_book_catalog.sql'));
    assert.equal(await koreanReady(), false);
    const p = await pins(); assert.equal(p.ok, true); assert.equal(p.core, LOCAL.core);
    LOCAL.live = await live();
    assert.notEqual(LOCAL.live, LOCAL.pin);
  });

  await check('admin_set_user_role (applied just before in the same push) moves no pin and not the Korean fingerprint', async () => {
    await db.exec(await read('../migrations/20261016171800_admin_set_user_role.sql'));
    assert.ok((await one("SELECT to_regprocedure('public.admin_set_user_role(uuid,text)') IS NOT NULL v")).v);
    assert.deepEqual(await pins(), { ...(({ pin, live, ...x }) => x)(LOCAL), ok: true });
    assert.equal(await live(), LOCAL.live);
    assert.equal(await koreanReady(), false);
  });

  const local = localize(migration, LOCAL);

  await check('refuses (and changes nothing) when the drift is more than the #1504 policy', async () => {
    await expectFail(`CREATE POLICY extra_drift ON public.reading_materials FOR SELECT TO anon USING (false);\n${local}`, /live value is not the reviewed #1504 state/);
    assert.equal((await capability()).pinned, LOCAL.pin);
    assert.deepEqual(await pins(), { ...(({ pin, live, ...x }) => x)(LOCAL), ok: true });
    assert.equal(await tempLeft(), 0);
  });

  await check('applies as one transaction (needs-repair state): Korean ready, four pins consistent, only core re-pinned, snapshot identical', async () => {
    await db.exec(local);
    assert.equal(await koreanReady(), true);
    const cap = await capability();
    assert.equal(cap.pinned, LOCAL.live);
    assert.equal(cap.template, '4a497440fb53bc1a27c1975875c7d737');
    assert.deepEqual({ ...cap, pinned: null }, { ...capBefore, pinned: null }, 'same owner / ACL / attributes / body except the scalar');
    const p = await pins();
    assert.equal(p.ok, true); assert.notEqual(p.core, LOCAL.core);
    assert.deepEqual([p.manual, p.admission, p.profile], [LOCAL.manual, LOCAL.admission, LOCAL.profile]);
    assert.deepEqual(await snaps(), base);
    assert.equal(await tempLeft(), 0);
  });

  await check('already repaired (e.g. owner ran it in the SQL Editor first): db push run is a clean no-op', async () => {
    const before = { cap: await capability(), pins: await pins(), live: await live() };
    await db.exec(local);
    assert.deepEqual({ cap: await capability(), pins: await pins(), live: await live() }, before);
    assert.equal(await koreanReady(), true);
    assert.deepEqual(await snaps(), base);
    assert.equal(await tempLeft(), 0);
  });

  await check('anything else still refuses: capability re-pinned without the core pin', async () => {
    await db.exec('BEGIN');
    await db.exec(`DO $x$ DECLARE d text; BEGIN SELECT pg_get_functiondef('public.learning_language_capabilities()'::regprocedure) INTO d;
      EXECUTE replace(d, quote_literal('${LOCAL.live}'), quote_literal('${LOCAL.pin}')); END $x$;`); // back to the old scalar, core left re-pinned
    await assert.rejects(db.exec(local), e => /learning contracts already drifted/.test(e.message));
    await db.exec('ROLLBACK');
    assert.equal((await capability()).pinned, LOCAL.live);
    assert.equal((await pins()).ok, true);
  });

  await check('the coupled FSRS learning reads still work for both learners after the re-pin', async () => {
    for (const u of [A, B]) {
      await as(u);
      const s = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v;
      assert.equal(s.registryAvailable, true); assert.equal(s.rows.length, s.registry.length);
    }
  });
  console.log(`PASS korean-capability-repin: ${checks} checks`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
