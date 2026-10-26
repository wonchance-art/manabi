/** Local, disposable PGlite only — never connects to Supabase (PROFILES-PRIVACY-001 ②).
 * 20261026010000_profiles_privacy: profiles를 본인 · 관리자만 읽고(anon 0행), 사용자는 자기 행의 열 14개만 고친다 · activity profile → admission 재게시.
 * 증명: 적용 전 구멍 재현(anon이 모든 행 · 모든 열을 읽음 · 학습자가 자기 xp · 연속 기록을 고침) → 적용 뒤 막힘 / 앱이 쓰는 PostgREST 모양
 * (select('*') 본인 · 온보딩 · 내 정보 · 목표 · 로그인 시각 · 행 없을 때 upsert) 그대로 통과 / 관리자 전체 읽기 · 역할 RPC /
 * public_profiles는 anon도 이름을 읽음 / update_streak · award_xp(service_role) · 가입 트리거 그대로 / core · manual · capability ·
 * snapshot 출력 불변 · 캐시 유효 / 어긋난 상태에서는 아무것도 바꾸지 않고 거부 / 재실행 no-op / 복원(docs/sql/profiles-privacy-rollback.sql)
 * 뒤 카탈로그가 바이트 그대로 · oid를 뺀 profile 지문이 처음과 같음 · 복원 재실행 no-op · 다시 적용 가능.
 *   node supabase/tests/profiles-privacy.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';
import { PROD } from './lib/production-constants.mjs';

const FILE = '20261026010000_profiles_privacy.sql';
const raw = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/profiles-privacy-rollback.sql');
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const UPDATABLE = ['display_name', 'onboarded', 'learning_language', 'learning_level_japanese', 'learning_level_english', 'learning_level_french',
  'learning_level_chinese', 'last_login_at', 'goal_review', 'goal_words', 'dday_date', 'dday_label', 'goal_lang', 'goal_level'];
const SERVER_ONLY = ['id', 'role', 'level', 'streak_count', 'created_at', 'avatar_url', 'learning_level', 'last_streak_date', 'xp', 'goal_read',
  'active_lang', 'streak_freeze_count'];
// 합성 계정(로컬 fixture만): 학습자 L · L2, 관리자 ADM, 가입 트리거로 만들 새 계정 NEW, 행이 빠진 계정 GAP.
const L = '00000000-0000-4000-8000-00000000e101', L2 = '00000000-0000-4000-8000-00000000e102', ADM = '00000000-0000-4000-8000-00000000e1ad';
const NEW = '00000000-0000-4000-8000-00000000e1a1', GAP = '00000000-0000-4000-8000-00000000e1a2';
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
await seedEdgeActor(h);
const { db, one } = h;
// 운영 순서대로: ① view(165910 · 170000 — setup 사슬 밖) + 191500 뒤 · 이 파일 전 마이그레이션. fixture 범위 밖(대화방 등)은 건너뛴다.
const chain = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql',
  ...(await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort()];
for (const f of chain) {
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
const migration = h.localize(raw);
assert.notEqual(migration, raw, 'the production profile pin (PROD.profile) is swapped for this fixture\'s value');

// 운영에 있는 두 정의자 함수(관측 fixture 밖) — 2026-10-26 KST 운영 pg_get_functiondef 그대로 · 같은 권한.
await db.exec(`CREATE OR REPLACE FUNCTION public.award_xp(uid uuid, amount integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE profiles
  SET xp = COALESCE(xp, 0) + amount
  WHERE id = uid;
END;
$function$;
REVOKE ALL ON FUNCTION public.award_xp(uuid, integer) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.award_xp(uuid, integer) TO service_role;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
  BEGIN
    INSERT INTO public.profiles (id, display_name, role, streak_count, last_login_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', '새로운 학습자'),
      'student',
      1,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    -- 프로필 생성 실패해도 회원가입은 통과
    RETURN NEW;
  END;
  $function$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`);
// 합성 계정. 관리자 역할은 역할 가드 트리거를 끈 채 심는다(운영의 관리자 1명과 같은 모양).
for (const u of [L, L2, ADM]) await db.query('INSERT INTO auth.users(id) VALUES ($1)', [u]);
await db.exec(`BEGIN; SET LOCAL session_replication_role = replica;
  UPDATE public.profiles SET role='admin', display_name='관리자' WHERE id='${ADM}';
  UPDATE public.profiles SET display_name='학습자 L', dday_label='비밀 시험 메모', xp=10, streak_count=3 WHERE id='${L}';
  UPDATE public.profiles SET display_name='학습자 L2' WHERE id='${L2}'; COMMIT;`);
const pinsOk = await h.pins();
assert.equal(pinsOk.ok, true, 'chain + production definer functions leave the four contracts consistent');

/** 한 역할로 실행하고 늘 되돌린다(PostgREST 요청 하나 = 트랜잭션 하나). sub 없으면 anon. */
const as = async (sub, work, { role } = {}) => {
  await db.exec('BEGIN');
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', '', true)", [sub || '']);
    await db.exec(`SET LOCAL ROLE ${role || (sub ? 'authenticated' : 'anon')}`);
    return await work();
  } finally { await db.exec('ROLLBACK'); }
};
const code = async promise => { try { await promise; return 'ok'; } catch (e) { return e.code; } };
// PostgREST(v12) 모양: PATCH ?id=eq.<id> (return=minimal) · POST upsert(ignoreDuplicates) · GET select=*.
const patch = (id, body) => db.query(`WITH pgrst_source AS (UPDATE "public"."profiles" SET ${Object.keys(body).map(k => `"${k}" = "pgrst_body"."${k}"`).join(', ')}
  FROM (SELECT $1::json AS json_data) pgrst_payload, LATERAL (SELECT ${Object.keys(body).map(k => `"${k}"`).join(', ')}
  FROM json_populate_record(null::"public"."profiles", pgrst_payload.json_data) _) pgrst_body
  WHERE "public"."profiles"."id" = $2 RETURNING 1) SELECT count(*)::int AS n FROM pgrst_source`, [JSON.stringify(body), id]).then(r => r.rows[0].n);
const upsert = rows => db.query(`WITH pgrst_source AS (INSERT INTO "public"."profiles"(${Object.keys(rows[0]).map(k => `"${k}"`).join(',')})
  SELECT ${Object.keys(rows[0]).map(k => `"pgrst_body"."${k}"`).join(',')} FROM (SELECT $1::json AS json_data) pgrst_payload,
  LATERAL (SELECT * FROM json_populate_recordset(null::"public"."profiles", pgrst_payload.json_data)) pgrst_body
  ON CONFLICT("id") DO NOTHING RETURNING 1) SELECT count(*)::int AS n FROM pgrst_source`, [JSON.stringify(rows)]).then(r => r.rows[0].n);
const selectAll = (id) => db.query(`SELECT "public"."profiles".* FROM "public"."profiles" ${id ? 'WHERE "public"."profiles"."id" = $1' : ''}`, id ? [id] : []).then(r => r.rows);
// 앱이 사용자 세션으로 보내는 profiles 쓰기 전부(src 전수 — 열 이름은 각 파일 그대로).
const APP_WRITES = {
  'OnboardingModal(fr/zh 포함)': { display_name: '새 이름', learning_language: ['Japanese', 'Chinese'], learning_level_japanese: 'N4 초급', learning_level_english: 'B1 중급',
    onboarded: true, learning_level_french: 'A1', learning_level_chinese: 'HSK2' },
  'MyPage 닉네임': { display_name: '닉네임' },
  'MyPage 학습 언어': { learning_language: ['English'], learning_level_japanese: 'N3 중급', learning_level_english: 'B2', learning_level_french: 'A2', learning_level_chinese: 'HSK3' },
  'ProfileStats 하루 목표': { goal_review: 7, goal_words: 9 },
  'ProfileStats 목표 날짜 · 과정': { dday_date: '2026-12-06', dday_label: 'JLPT', goal_review: 5, goal_words: 5, goal_lang: 'Japanese', goal_level: 'N3' },
  'ProfileStats 기기 끌어올림': { dday_date: '2026-12-06', dday_label: null },
  'learningActivity 로그인 시각': { last_login_at: '2026-10-26T01:00:00.000Z' },
};
const totalRows = async () => Number((await one('SELECT count(*) n FROM public.profiles')).n);
const catalog = async () => (await one(`SELECT jsonb_build_object(
  'policies', (SELECT jsonb_agg(jsonb_build_array(polname, polcmd, polpermissive, polroles::regrole[]::text[], pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)) ORDER BY polname COLLATE "C") FROM pg_policy WHERE polrelid='public.profiles'::regclass),
  'relacl', (SELECT relacl::text FROM pg_class WHERE oid='public.profiles'::regclass),
  'attacl', (SELECT coalesce(jsonb_object_agg(attname, attacl::text), '{}') FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attnum>0 AND attacl IS NOT NULL)) c`)).c;
const outputs = async () => { const o = {}; for (const u of [A, B, C]) { const { now, ...rest } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v; o[u] = rest; } return o; };
// oid를 뺀 profile 지문 — 지문 본문(운영 원문)에서 정책 열쇠만 oid → 이름으로 바꿔 같은 SELECT를 search_path ''에서.
const liveBody = (await one(`SELECT prosrc FROM pg_proc WHERE oid='fsrs_private.activity_profile_hash_live()'::regprocedure`)).prosrc;
assert.equal(liveBody.split("SELECT 'policy:'||oid,").length, 2, 'policy key in the profile fingerprint body');
const normalizedProfile = async () => {
  await db.exec("BEGIN READ ONLY; SET LOCAL search_path='';");
  try { return Object.values(await one(liveBody.replace("SELECT 'policy:'||oid,", "SELECT 'policy:'||polname,")))[0]; } finally { await db.exec('ROLLBACK'); }
};

const before = { pins: pinsOk, catalog: await catalog(), out: await outputs(), cap: await h.capability(), total: await totalRows(), norm: await normalizedProfile() };

try {
  await check('migration shape: one db-push transaction, production profile pin in the pre-check, profile → admission re-pins only, no function/table DDL, temp objects dropped', async () => {
    assert.doesNotMatch(raw, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.match(raw, /DO \$runner\$[\s\S]*SET LOCAL not in effect/);
    assert.equal(PROD.profile, 'e892069f4a99f5ba9565c54d72226740');
    assert.ok(raw.includes(`'${PROD.profile}'`), 'pre-check pins the reviewed production profile value');
    const code = raw.replace(/--[^\n]*/g, '');
    assert.match(code, /PERFORM pg_temp\.pp_repin\('profile'\);\s*PERFORM pg_temp\.pp_repin\('admission'\);/);
    assert.match(code, /UPDATE fsrs_private\.activity_settings SET profile_contract_hash = fsrs_private\.activity_profile_hash\(\)/);
    assert.match(code, /UPDATE fsrs_private\.admission_settings SET contract_hash = fsrs_private\.admission_contract_hash\(\)/);
    assert.doesNotMatch(code, /UPDATE fsrs_private\.(settings|manual_save_settings)\b/, 'core · manual are not moved');
    assert.doesNotMatch(code, /\b(CREATE|ALTER|DROP)\s+(OR\s+REPLACE\s+)?(FUNCTION|TABLE|VIEW|TRIGGER|INDEX)\s+(?!pg_temp\.)/i, 'only pg_temp helpers are created / dropped');
    assert.match(code, /DROP POLICY "anyone_read_basic_profile" ON public\.profiles;\s*DROP POLICY "profiles_select" ON public\.profiles;/);
    const granted = code.match(/GRANT UPDATE \(([^)]*)\) ON TABLE public\.profiles TO authenticated;/)[1].split(',').map(s => s.trim());
    assert.deepEqual(granted, UPDATABLE);
    assert.match(code, /GRANT INSERT \(id, display_name\) ON TABLE public\.profiles TO authenticated;/);
    assert.match(raw, /SET CONSTRAINTS fsrs_private\.contract_cache_refresh IMMEDIATE;/);
    for (const [, name] of raw.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(raw.includes(`DROP FUNCTION ${name}(`), name);
    for (const [, name] of restore.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(restore.includes(`DROP FUNCTION ${name}(`), name);
    assert.doesNotMatch(restore, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
  });

  await check('before (exploit reproduced): anon reads every row and every column; a learner rewrites their own xp and streak; reads another learner\'s free-text label', async () => {
    const rows = await as(null, () => selectAll());
    assert.equal(rows.length, before.total);
    assert.ok(rows.some(r => r.id === ADM && r.role === 'admin') && rows.some(r => r.id === L && r.dday_label === '비밀 시험 메모' && r.xp === 10));
    assert.equal(await as(L, () => patch(L, { xp: 99999, streak_count: 365, streak_freeze_count: 2, last_streak_date: '2026-10-26' })), 1);
    assert.equal((await as(L2, () => selectAll(L)))[0].dday_label, '비밀 시험 메모');
  });

  await check('refuses on drift and changes nothing: an extra profiles policy (re-pinned so contracts agree) · a drifted pin', async () => {
    await db.exec(`BEGIN; CREATE POLICY extra_probe ON public.profiles FOR SELECT TO anon USING (false);
      UPDATE fsrs_private.activity_settings SET profile_contract_hash=fsrs_private.activity_profile_hash();
      UPDATE fsrs_private.admission_settings SET contract_hash=fsrs_private.admission_contract_hash();`);
    await assert.rejects(db.exec(migration), e => /neither the reviewed current set nor the applied set/.test(e.message));
    await db.exec('ROLLBACK');
    await db.exec(`BEGIN; UPDATE fsrs_private.activity_settings SET profile_contract_hash=md5('drift');`);
    await assert.rejects(db.exec(migration), e => /learning contracts already drifted/.test(e.message));
    await db.exec('ROLLBACK');
    assert.deepEqual(await h.pins(), before.pins);
    assert.deepEqual(await catalog(), before.catalog);
  });

  await check('a migrated body that leaves xp writable is caught by the post-check and rolls back everything', async () => {
    const bad = migration.replace('learning_level_chinese, last_login_at, goal_review', 'learning_level_chinese, last_login_at, xp, goal_review');
    assert.notEqual(bad, migration);
    await assert.rejects(db.exec(bad), e => /profiles catalog is not the intended one/.test(e.message));
    await db.exec('ROLLBACK').catch(() => {});
    assert.deepEqual(await catalog(), before.catalog);
    assert.deepEqual(await h.pins(), before.pins);
  });

  let applied, appliedCatalog;
  await check('applies: profile + admission re-pinned, core · manual · capability · snapshot outputs unchanged, cache valid, Korean ready, update_streak works', async () => {
    await db.exec(migration);
    const p = await h.pins();
    assert.equal(p.ok, true);
    assert.deepEqual([p.core, p.manual], [before.pins.core, before.pins.manual]);
    assert.notEqual(p.profile, before.pins.profile); assert.notEqual(p.admission, before.pins.admission);
    assert.deepEqual(await h.capability(), before.cap);
    assert.equal(await h.koreanReady(), true);
    assert.deepEqual(await outputs(), before.out);
    const k = await one('SELECT * FROM fsrs_private.contract_cache');
    assert.equal(k.valid, true); assert.equal(k.profile, p.profile); assert.equal(k.admission, p.admission);
    await db.query('SELECT fsrs_private.require_admission_integrity()');
    // 연속 기록: 본인 JWT로 update_streak(운영 앱 경로 src/lib/streak.js) — activity_catalog_drift 없이 연속 기록이 오른다.
    const streak = await as(L, async () => { await db.query('SELECT public.update_streak($1)', [L]); return (await selectAll(L))[0].streak_count; });
    assert.ok(streak >= 1, `update_streak ran (${streak})`);
    assert.equal(await as(L, () => code(db.query('SELECT public.update_streak($1)', [L2]))), '42501', 'still only for yourself');
    assert.equal(Number((await one(`SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'pp\\_%'`)).n), 0);
    applied = p;
  });

  await check('after: anon gets 0 rows (no error), cannot write, but public_profiles still shows every name', async () => {
    assert.deepEqual(await as(null, () => selectAll()), []);
    assert.equal(await as(null, () => code(patch(L, { display_name: 'x' }))), '42501');
    assert.equal(await as(null, () => code(upsert([{ id: L, display_name: 'x' }]))), '42501');
    assert.equal(await as(null, () => code(db.query('DELETE FROM public.profiles'))), '42501');
    const names = await as(null, () => db.query('SELECT * FROM public.public_profiles ORDER BY id').then(r => r.rows));
    assert.equal(names.length, before.total);
    assert.deepEqual(Object.keys(names[0]).sort(), ['avatar_url', 'display_name', 'id']);
    assert.equal(names.find(r => r.id === L).display_name, '학습자 L');
  });

  await check('after: a learner reads only their own row (select=*), every app write shape passes on their row, nobody else\'s row moves', async () => {
    const own = await as(L, () => selectAll());
    assert.deepEqual(own.map(r => r.id), [L]);
    assert.equal(own[0].dday_label, '비밀 시험 메모', 'own free-text label still readable by its owner');
    assert.deepEqual(await as(L, () => selectAll(L2)), []);
    for (const [name, body] of Object.entries(APP_WRITES)) {
      const result = await as(L, async () => ({ n: await patch(L, body), row: (await selectAll(L))[0] }));
      assert.equal(result.n, 1, name);
      for (const [k, v] of Object.entries(body)) {
        const got = result.row[k];
        const norm = got instanceof Date ? (k === 'dday_date' ? got.toISOString().slice(0, 10) : got.toISOString()) : got;
        assert.deepEqual(norm, v, `${name}: ${k}`);
      }
    }
    assert.equal(await as(L, () => patch(L2, { display_name: '남의 이름' })), 0, 'another learner\'s row is invisible to UPDATE');
    assert.equal(await as(L, () => patch(ADM, { goal_review: 1 })), 0);
  });

  await check('after: server-maintained columns are not writable by the owner (xp · streak · role · avatar_url · …) — insufficient_privilege, nothing changes', async () => {
    for (const col of SERVER_ONLY) {
      const value = { id: L, role: 'admin', level: 'x', streak_count: 999, created_at: '2020-01-01T00:00:00Z', avatar_url: 'https://x.test/a.png',
        learning_level: 'N1', last_streak_date: '2026-10-26', xp: 99999, goal_read: 9, active_lang: 'French', streak_freeze_count: 2 }[col];
      assert.equal(await as(L, () => code(patch(L, { [col]: value }))), '42501', col);
    }
    assert.equal(await as(L, () => code(patch(L, { display_name: '이름', xp: 1 }))), '42501', 'a mixed payload is refused as a whole');
    const row = (await as(L, () => selectAll(L)))[0];
    assert.equal(row.role, 'student');
  });

  await check('after: signup paths — the auth trigger creates the row (definer); a missing row is re-created by the login upsert (id · display_name) as student; xp/role in an insert are refused', async () => {
    await db.query(`INSERT INTO auth.users(id, raw_user_meta_data) VALUES ($1, '{"display_name":"새 계정"}')`, [NEW]);
    const created = await one('SELECT display_name, role, streak_count FROM public.profiles WHERE id=$1', [NEW]);
    assert.deepEqual(created, { display_name: '새 계정', role: 'student', streak_count: 1 });
    await db.query('INSERT INTO auth.users(id) VALUES ($1)', [GAP]);
    await db.query('DELETE FROM public.profiles WHERE id=$1', [GAP]);
    const regained = await as(GAP, async () => ({ n: await upsert([{ id: GAP, display_name: '새로운 학습자' }]), row: (await selectAll(GAP))[0] }));
    assert.equal(regained.n, 1);
    assert.equal(regained.row.role, 'student');
    assert.equal(await as(L, () => upsert([{ id: L, display_name: '이미 있음' }])), 0, 'existing row: DO NOTHING, no error');
    assert.equal(await as(GAP, () => code(upsert([{ id: GAP, display_name: 'x', xp: 5 }]))), '42501');
    assert.equal(await as(GAP, () => code(upsert([{ id: GAP, role: 'admin' }]))), '42501');
    assert.equal(await as(GAP, () => code(upsert([{ id: L2, display_name: '남' }]))), '42501', 'someone else\'s id (RLS WITH CHECK)');
  });

  await check('after: the admin reads every row (AdminPage fetchAllUsers · world report names), role changes go through admin_set_user_role, learners cannot call award_xp', async () => {
    const all = await as(ADM, () => db.query(`SELECT id, display_name, role, streak_count, last_login_at FROM public.profiles ORDER BY last_login_at DESC NULLS LAST`).then(r => r.rows));
    assert.equal(all.length, await totalRows());
    const names = await as(ADM, () => db.query('SELECT id, display_name FROM public.profiles WHERE id = ANY($1)', [[L, L2]]).then(r => r.rows));
    assert.equal(names.length, 2);
    assert.equal(await as(ADM, () => db.query(`SELECT public.admin_set_user_role($1, 'host') v`, [L2]).then(r => r.rows[0].v)), 'student');
    assert.equal(await as(ADM, () => code(patch(L2, { role: 'host' }))), '42501', 'direct role writes are closed even for admins');
    assert.equal(await as(ADM, () => patch(ADM, { display_name: '관리자 2' })), 1, 'admins edit their own allowed columns');
    assert.equal(await as(L, () => code(db.query(`SELECT public.admin_set_user_role($1, 'admin')`, [L]))), '42501');
    assert.equal(await as(L, () => code(db.query('SELECT public.award_xp($1, 5)', [L]))), '42501');
    const xp = await as(null, async () => { await db.query('SELECT public.award_xp($1, 5)', [L]); return (await db.query('SELECT xp FROM public.profiles WHERE id=$1', [L])).rows[0].xp; }, { role: 'service_role' });
    assert.equal(xp, 15, 'award_xp (service_role) still updates xp');
  });

  await check('already applied: a second run changes nothing (no DDL)', async () => {
    const cat = await catalog();
    appliedCatalog = cat;
    const oids = (await db.query(`SELECT oid::int FROM pg_policy WHERE polrelid='public.profiles'::regclass ORDER BY 1`)).rows;
    await db.exec(migration);
    assert.deepEqual(await h.pins(), applied);
    assert.deepEqual(await catalog(), cat);
    assert.deepEqual((await db.query(`SELECT oid::int FROM pg_policy WHERE polrelid='public.profiles'::regclass ORDER BY 1`)).rows, oids);
  });

  await check('restore (docs/sql/profiles-privacy-rollback.sql): catalog byte-for-byte as before, oid-free profile fingerprint identical, core · manual untouched, exploit surface back; re-run no-op; re-apply works', async () => {
    await db.exec(restore);
    assert.deepEqual(await catalog(), before.catalog);
    const p = await h.pins();
    assert.equal(p.ok, true);
    assert.deepEqual([p.core, p.manual], [before.pins.core, before.pins.manual]);
    assert.equal(await normalizedProfile(), before.norm, 'only the two re-created policy oids differ from the original fingerprint');
    assert.equal((await as(null, () => selectAll())).length, await totalRows(), 'anon reads everything again (restored as it was)');
    assert.equal(await as(L, () => patch(L, { xp: 1 })), 1);
    assert.deepEqual(await outputs(), before.out);
    assert.equal(await h.koreanReady(), true);
    const restored = await h.pins();
    await db.exec(restore);
    assert.deepEqual(await h.pins(), restored, 'rollback re-run is a no-op');
    assert.equal((await one('SELECT valid FROM fsrs_private.contract_cache')).valid, true);
    // 복원 뒤 운영 profile 게시값은 새 값이다 — 다시 적용하려면 사전 검사의 운영 상수(e892…)를 그 값으로 바꾼 검토본이 필요하다(의도: 검토 없이 재적용 금지).
    await assert.rejects(db.exec(migration), e => /activity profile pin is not the reviewed one/.test(e.message));
    await db.exec('ROLLBACK').catch(() => {});
    await db.exec(migration.replaceAll(before.pins.profile, restored.profile));
    assert.equal((await h.pins()).ok, true);
    assert.deepEqual(await catalog(), appliedCatalog);
    assert.deepEqual(await as(null, () => selectAll()), []);
  });

  console.log(`OK ${checks} checks`);
} finally {
  await db.close();
}
