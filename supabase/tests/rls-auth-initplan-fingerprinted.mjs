/** Local, disposable PGlite only — never connects to Supabase (RLS-INITPLAN-001 2단계 · 2026-11-04 KST).
 * 20261104060000_rls_auth_initplan_fingerprinted: 학습 계약 지문 범위 6개 테이블의 정책 17개에서 맨 auth.uid()를 (select auth.uid())로 감싸고
 * 같은 트랜잭션에서 capability 상수 → FSRS core → activity profile → admission을 재게시한다.
 * 운영과 같은 사슬(관측 fixture → 191500 → 그 뒤 마이그레이션 · anki-v2 → … → 이 파일 직전)에서 시작한다.
 * 증명:
 *   ⓪ 파일 모양 — 트랜잭션 제어 없음 · 운영 해시 상수 없음 · ALTER POLICY 17개 = 대상 표 · 지문 SELECT가 capability 본문과 바이트 동일 · 임시 객체 DROP
 *   ① 사전 거부 — 섞인 상태 · 검토 밖 맨 호출 정책 · 계약 어긋남이면 RAISE하고 아무것도 바꾸지 않음
 *   ② 적용 — Korean ready(실제 RPC) · 네 핀 = 실측(캐시 · _live) · manual 불변 · capability 속성 불변 · 17개 감쌈(되돌리면 원래 식) ·
 *      6개 테이블 맨 호출 0 · 정책 수 불변 · 합성 학습자 snapshot 동일 · RLS 동작(행위자별 보이는 행 · 남의 행 쓰기 거부) 동일 · 캐시 유효
 *   ③ 재실행 no-op   ④ 복원(감싼 호출 되돌림 + 같은 재게시) 뒤 원래 식 · 계약 · ready · snapshot 그대로 → 다시 적용
 *   node supabase/tests/rls-auth-initplan-fingerprinted.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';
import { containsProductionConstants } from './lib/production-constants.mjs';

const FILE = '20261104060000_rls_auth_initplan_fingerprinted.sql';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const TABLES = ['profiles', 'reading_materials', 'review_events', 'uploaded_pdfs', 'user_known_words', 'user_vocabulary'];
const WRAPPED = /\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)/g;
const migration = await read(`../migrations/${FILE}`);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 대상 표(마이그레이션의 ri2_target VALUES) — 원래 식. SQL 문자열 리터럴만 풀어 읽는다.
const lit = s => (s === 'NULL' ? null : s.slice(1, -1).replace(/''/g, "'"));
const targetBlock = migration.slice(migration.indexOf('INSERT INTO pg_temp.ri2_target'), migration.indexOf(';\n', migration.indexOf('INSERT INTO pg_temp.ri2_target')));
const TARGETS = [...targetBlock.matchAll(/\('(\w+)', '([^']+)', '(\w+)', ((?:'(?:[^']|'')*')|NULL), ((?:'(?:[^']|'')*')|NULL)\)/g)]
  .map(([, tbl, pol, cmd, qual, withCheck]) => ({ tbl, pol, cmd, qual: lit(qual), with_check: lit(withCheck) }));
const wrap = s => s && s.replaceAll('auth.uid()', '( SELECT auth.uid() AS uid)');
const unwrap = s => s && s.replace(WRAPPED, 'auth.$1()');
const ident = s => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s}"`);
// 재게시만(마이그레이션의 도구 그대로): capability 상수 → core → profile → admission을 _live 값으로.
const REPIN = [
  migration.slice(migration.indexOf('CREATE FUNCTION pg_temp.ri2_korean_live_hash()'), migration.indexOf('CREATE FUNCTION pg_temp.ri2_korean_unwrapped_hash()')),
  `CREATE FUNCTION pg_temp.ri2_korean_unwrapped_hash() RETURNS text LANGUAGE sql STABLE AS $q$ SELECT NULL::text $q$;`,
  migration.slice(migration.indexOf('-- capability 상태:'), migration.indexOf('DO $pre$')),
  `DO $r$ BEGIN PERFORM pg_temp.ri2_repin_capability();
    UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
    UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash_live() WHERE profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash_live();
    UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live(); END $r$;`,
  'DROP FUNCTION pg_temp.ri2_repin_capability(); DROP FUNCTION pg_temp.ri2_contracts(); DROP FUNCTION pg_temp.ri2_korean_ready(); DROP FUNCTION pg_temp.ri2_cap();',
  'DROP FUNCTION pg_temp.ri2_korean_unwrapped_hash(); DROP FUNCTION pg_temp.ri2_korean_live_hash();',
].join('\n');
// 복원 SQL(쓸 일 없음 — 마이그레이션 머리 주석의 복원 경로를 그대로 실행): 17개를 원래 식으로 + 같은 재게시.
const RESTORE = [
  "SET LOCAL search_path = '';",
  ...TARGETS.map(t => `ALTER POLICY ${ident(t.pol)} ON public.${t.tbl}${t.qual ? ` USING (${t.qual})` : ''}${t.with_check ? ` WITH CHECK (${t.with_check})` : ''};`),
  REPIN,
].join('\n');

const h = await setup();
await seedEdgeActor(h);
const { db, one, as } = h;
try {
  // 운영 순서대로: view(165910 · 170000 — setup 사슬 밖) + 191500 뒤 · 이 파일 전 마이그레이션(anki-v2는 운영처럼 그 자리에서). fixture 밖은 건너뛴다.
  const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
  const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
  let ankiV2 = false;
  for (const f of [...PROFILES_VIEW, ...chain]) {
    if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
    try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
    catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
  }
  assert.ok(chain.includes('20261101130000_streak_learning_day.sql') && chain.includes('20261103000000_rls_auth_initplan.sql'), 'chain reaches the production order');

  // 합성 자료 · PDF · 복습 기록(RLS 동작 비교용 — 로컬 fixture만, 앱 가드 없이).
  await db.exec('SET session_replication_role = replica');
  await db.query(`INSERT INTO public.reading_materials(id,owner_id,visibility,title) VALUES
    (91001,$1,'public','a-public'),(91002,$1,'private','a-private'),(91003,$2,'private','b-private'),(91004,NULL,'public','shared')`, [A, B]);
  await db.query(`INSERT INTO public.uploaded_pdfs(owner_id,title,filename,storage_path) VALUES ($1,'a','a.pdf','a/a.pdf'),($2,'b','b.pdf','b/b.pdf')`, [A, B]);
  await db.query(`INSERT INTO public.review_events(user_id,lang,source,item_key,correct) VALUES ($1,'Japanese','ui','-',true),($2,'Japanese','ui','-',true),($2,'English','ui','-',false)`, [A, B]);
  await db.exec('RESET session_replication_role');

  const pins = async () => one(`SELECT (SELECT contract_hash FROM fsrs_private.settings) core,(SELECT contract_hash FROM fsrs_private.manual_save_settings) manual,
    (SELECT contract_hash FROM fsrs_private.admission_settings) admission,(SELECT profile_contract_hash FROM fsrs_private.activity_settings) profile,
    (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AND (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash()
    AND (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() AND (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() ok,
    (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash_live() AND (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash_live()
    AND (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash_live() AND (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash_live() live_ok`);
  const capability = async () => one(`SELECT substring(prosrc from 'ready:=live_hash= ''([0-9a-f]{32})''') pinned, oid::int, proacl::text acl, proowner::regrole::text owner,
    prosecdef, proconfig::text config, provolatile, md5(regexp_replace(prosrc,'ready:=live_hash= ''([0-9a-f]{32})''','ready:=live_hash= ''<hash>''')) template
    FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`);
  const fingerprint = migration.match(/CREATE FUNCTION pg_temp\.ri2_korean_live_hash\(\) RETURNS text [^\n]*\$q\$\n([\s\S]*?)\n\$q\$;/)[1];
  const live = async () => { await db.exec("BEGIN READ ONLY; SET LOCAL search_path='';"); try { return (await one(fingerprint)).md5; } finally { await db.exec('ROLLBACK'); } };
  const languages = async () => { await as(A); return (await one('SELECT public.learning_language_capabilities() v')).v.languages; };
  const allReady = async () => { const l = await languages(); return Object.keys(l).length > 0 && Object.values(l).every(f => Object.values(f).every(v => v === true)); };
  const snaps = async () => { const out = {}; for (const u of [A, B, C]) { const { now, ...rest } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v; assert.ok(now); out[u] = rest; } return out; };
  const policies = async () => (await db.query(`SELECT tablename::text tbl, policyname::text pol, cmd, permissive, roles::text[] roles, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND tablename = ANY($1) ORDER BY 1, 2`, [TABLES])).rows;
  const bare = async () => (await policies()).filter(p => /auth\.(uid|role|jwt)\(\)/.test(`${p.qual ?? ''} ${p.with_check ?? ''}`.replace(WRAPPED, ''))).map(p => `${p.tbl}:${p.pol}`);
  const tempLeft = async () => (await one(`SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'ri2\\_%')
    + (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp%' AND c.relname LIKE 'ri2\\_%') n`)).n;
  // RLS 동작: 행위자(A · B · C · 손님)마다 6개 테이블에서 보이는 행 수, 그리고 남의 user_id · owner_id로 쓰기가 거부되는지(전부 되돌림).
  const behaviour = async () => {
    const out = {};
    for (const [label, role, sub] of [['A', 'authenticated', A], ['B', 'authenticated', B], ['C', 'authenticated', C], ['anon', 'anon', '']]) {
      await db.exec('BEGIN');
      try {
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [sub]);
        await db.exec(`SET LOCAL ROLE ${role}`);
        const row = {};
        for (const t of TABLES) {
          await db.exec('SAVEPOINT r');
          row[t] = await one(`SELECT count(*)::int n FROM public.${t}`).then(r => r.n, e => `error ${e.code}`);
          await db.exec('ROLLBACK TO SAVEPOINT r');
        }
        if (role === 'authenticated') {
          const other = sub === A ? B : A;
          for (const [name, sql] of [['review_events', `INSERT INTO public.review_events(user_id,lang,source,item_key,correct) VALUES ('${other}','Japanese','ui','-',true)`],
            ['uploaded_pdfs', `INSERT INTO public.uploaded_pdfs(owner_id,title,filename,storage_path) VALUES ('${other}','x','x.pdf','x/x.pdf')`],
            ['user_known_words', `INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES ('${other}','ja','zz')`]]) {
            await db.exec('SAVEPOINT w');
            row[`write_other_${name}`] = await db.exec(sql).then(() => 'allowed', e => (e.code === '42501' ? 'denied' : `error ${e.code}`));
            await db.exec('ROLLBACK TO SAVEPOINT w');
          }
          row.update_others_materials = (await db.query(`UPDATE public.reading_materials SET title = title WHERE owner_id IS DISTINCT FROM '${sub}'`)).affectedRows;
        }
        out[label] = row;
      } finally { await db.exec('ROLLBACK'); }
    }
    return out;
  };

  const before = { pins: await pins(), cap: await capability(), live: await live(), policies: await policies(), snaps: await snaps(), behaviour: await behaviour() };
  assert.equal(before.pins.ok && before.pins.live_ok, true, 'chain state: four contracts consistent');
  assert.equal(before.cap.pinned, before.live, 'chain state: Korean pinned = live');
  assert.equal(await allReady(), true);

  await check('⓪ 파일 모양 — 한 트랜잭션 · 운영 해시 상수 없음 · ALTER 17개 = 대상 표 · 지문 SELECT = capability 본문 · 임시 객체 DROP', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.doesNotMatch(migration, /\bCONCURRENTLY\b/i);
    assert.equal(containsProductionConstants(migration), false, 'no production hash constant — pre-check is pinned == live, post-check recomputes');
    assert.equal(TARGETS.length, 17);
    assert.deepEqual([...new Set(TARGETS.map(t => t.tbl))].sort(), TABLES);
    const alters = [...migration.matchAll(/^ {2}ALTER POLICY ("[^"]+"|\w+) ON public\.(\w+) (.*);$/gm)].map(([, pol, tbl, body]) => ({ pol: pol.replace(/"/g, ''), tbl, body }));
    assert.equal(alters.length, 17);
    for (const t of TARGETS) {
      const a = alters.find(x => x.pol === t.pol && x.tbl === t.tbl);
      assert.ok(a, `${t.tbl}:${t.pol} altered`);
      const want = `${t.qual ? `USING (${t.qual.replaceAll('auth.uid()', '(select auth.uid())')})` : ''}${t.qual && t.with_check ? ' ' : ''}${t.with_check ? `WITH CHECK (${t.with_check.replaceAll('auth.uid()', '(select auth.uid())')})` : ''}`;
      assert.equal(a.body, want, `${t.pol}: only the select-wrap, same clauses`);
    }
    const body = (await one("SELECT prosrc FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure")).prosrc;
    assert.equal(body.match(/(WITH RECURSIVE .*FROM objects) INTO live_hash;/s)[1], fingerprint, 'fingerprint SELECT byte-identical to the capability body');
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), `${name} dropped`);
    for (const [, name] of migration.matchAll(/CREATE TEMP TABLE (\w+)/g)) assert.match(migration, new RegExp(`DROP TABLE [^;]*pg_temp\\.${name}\\b`), `${name} dropped`);
  });

  await check('① 사전 거부 — 섞인 상태 · 검토 밖 맨 호출 · 계약 어긋남이면 RAISE · 아무것도 바뀌지 않음', async () => {
    const same = async () => { assert.deepEqual(await pins(), before.pins); assert.deepEqual(await capability(), before.cap); assert.deepEqual(await policies(), before.policies); assert.equal(await tempLeft(), 0); };
    // 운영이 다른 경로로 정책을 바꾸고 지문까지 재게시해 둔 경우(계약은 맞지만 정책이 검토한 모양이 아님) — 정책 검사가 멈춘다.
    const repinnedDrift = async (ddl, re) => {
      await db.exec('BEGIN'); await db.exec(`SET LOCAL search_path = '';\n${ddl}\n${REPIN}`);
      await assert.rejects(db.exec(migration), e => { assert.match(e.message, re); return true; });
      await db.exec('ROLLBACK');
    };
    await repinnedDrift('ALTER POLICY review_events_select_own ON public.review_events USING (((select auth.uid()) = user_id));', /neither all original nor all wrapped/);
    await same();
    await repinnedDrift('ALTER POLICY review_events_select_own ON public.review_events USING (((auth.uid() = user_id) AND true));', /neither all original nor all wrapped/);
    await same();
    await repinnedDrift('CREATE POLICY extra_bare ON public.review_events FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));', /unreviewed bare auth\.\* policies/);
    await same();
    await repinnedDrift('DROP POLICY owner_delete_material ON public.reading_materials;', /target policies missing/);
    await same();
    // 지문 범위를 건드리고 재게시하지 않은 상태(#1504 모양) — 한국어가 이미 꺼져 있으면 멈춘다.
    await h.expectFail(`CREATE POLICY extra_drift ON public.reading_materials AS RESTRICTIVE FOR SELECT TO anon USING (true);\n${migration}`, /Korean capability not ready before change/);
    await same();
    await h.expectFail(`UPDATE fsrs_private.manual_save_settings SET contract_hash = md5('drift');\n${migration}`, /learning contracts already drifted/);
    await same();
  });

  let after;
  await check('② 적용 — Korean ready · 네 핀 = 실측 · manual 불변 · 17개 감쌈 · 맨 호출 0 · snapshot · RLS 동작 동일 · 캐시 유효', async () => {
    const notices = [];
    await db.exec('BEGIN'); await db.exec(migration, { onNotice: n => notices.push(n.message) }); await db.exec('COMMIT');
    assert.ok(notices.some(m => /needs change/.test(m)) && notices.some(m => /ok — 17 policies wrapped/.test(m)), notices.join('\n'));
    console.log(`NOTICE ${notices.at(-1)}`);
    after = { pins: await pins(), cap: await capability(), live: await live() };
    assert.equal(after.pins.ok && after.pins.live_ok, true);
    assert.equal(await allReady(), true, 'all languages ready via the real RPC');
    assert.equal(after.cap.pinned, after.live);
    assert.notEqual(after.cap.pinned, before.cap.pinned, 'Korean constant re-published');
    assert.deepEqual({ ...after.cap, pinned: null }, { ...before.cap, pinned: null }, 'same oid / owner / ACL / attributes / template');
    assert.notEqual(after.pins.core, before.pins.core); assert.notEqual(after.pins.profile, before.pins.profile); assert.notEqual(after.pins.admission, before.pins.admission);
    assert.equal(after.pins.manual, before.pins.manual);
    const now = await policies();
    assert.equal(now.length, before.policies.length);
    for (const [i, p] of now.entries()) {
      const o = before.policies[i], t = TARGETS.find(x => x.tbl === p.tbl && x.pol === p.pol);
      assert.deepEqual([p.tbl, p.pol, p.cmd, p.permissive, p.roles], [o.tbl, o.pol, o.cmd, o.permissive, o.roles]);
      if (t) {
        assert.deepEqual([p.qual, p.with_check], [wrap(t.qual), wrap(t.with_check)], `${p.pol} wrapped`);
        assert.deepEqual([unwrap(p.qual), unwrap(p.with_check)], [o.qual, o.with_check], `${p.pol} unwraps to the original`);
      } else assert.deepEqual([p.qual, p.with_check], [o.qual, o.with_check], `${p.pol} untouched`);
    }
    assert.deepEqual(await bare(), []);
    assert.deepEqual(await snaps(), before.snaps);
    assert.deepEqual(await behaviour(), before.behaviour);
    const k = await one('SELECT valid, core, manual, admission, profile FROM fsrs_private.contract_cache');
    assert.deepEqual(k, { valid: true, core: after.pins.core, manual: after.pins.manual, admission: after.pins.admission, profile: after.pins.profile });
    assert.equal(await tempLeft(), 0);
  });

  await check('③ 재실행 no-op — 핀 · capability · 정책 그대로', async () => {
    const pol = await policies(), notices = [];
    await db.exec('BEGIN'); await db.exec(migration, { onNotice: n => notices.push(n.message) }); await db.exec('COMMIT');
    assert.ok(notices.some(m => /already applied .* no-op/.test(m)) && notices.some(m => /ok — already applied, nothing changed/.test(m)), notices.join('\n'));
    assert.deepEqual({ pins: await pins(), cap: await capability(), live: await live() }, after);
    assert.deepEqual(await policies(), pol);
    assert.equal(await allReady(), true);
    assert.equal(await tempLeft(), 0);
  });

  await check('④ 복원(머리 주석의 경로) — 원래 식 · 계약 · ready · snapshot · 동작 그대로 → 다시 적용', async () => {
    await db.exec('BEGIN'); await db.exec(RESTORE); await db.exec('COMMIT');
    assert.deepEqual(await policies(), before.policies, 'policies byte-identical to before');
    const p = await pins();
    assert.equal(p.ok && p.live_ok, true);
    assert.equal((await capability()).pinned, await live());
    assert.equal(await allReady(), true);
    assert.deepEqual(await snaps(), before.snaps);
    assert.deepEqual(await behaviour(), before.behaviour);
    await db.exec('BEGIN'); await db.exec(migration); await db.exec('COMMIT');
    assert.equal((await pins()).ok, true);
    assert.equal(await allReady(), true);
    assert.deepEqual(await bare(), []);
    assert.deepEqual(await snaps(), before.snaps);
  });
  console.log(`PASS rls-auth-initplan-fingerprinted: ${checks} checks`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
