/** Local, disposable PGlite only — never connects to Supabase (SNAPSHOT-LIGHT-001).
 * 20261025150000_vocabulary_snapshot_light: 서버 첫 화면 · /study 조립용 가벼운 읽기 public.fsrs_vocabulary_snapshot_light(actor, language, summary).
 * 증명: 모든 학습자(가장자리 C · 3,000단어 H 포함) · 모든 언어 · 두 모양에서 SQL light = compactVocabularySnapshot(SQL snapshot)
 * (JS 기준 구현) 이고 expandLightSnapshot으로 되돌리면 snapshot(그 언어)과 같다 · core만 재게시(manual · admission · profile · capability ·
 * snapshot 본문 불변) · 권한 = service_role만 · 계정 검사 같은 오류 코드 · 동치가 아닌 본문은 사후 검사가 잡아 전체 롤백 · 검토하지 않은
 * snapshot 본문 위에는 적용하지 않음 · 재실행 no-op · 복원(docs/sql/vocabulary-snapshot-light-rollback.sql) 뒤 core 정확 복귀.
 *   node supabase/tests/vocabulary-snapshot-light.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';
import { compactVocabularySnapshot, expandLightSnapshot, LIGHT_SUMMARY_COLUMNS } from '../../src/lib/vocabularySnapshotLight.js';

const md5 = s => createHash('md5').update(s).digest('hex');
const FILE = '20261025150000_vocabulary_snapshot_light.sql';
const SIG = 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)';
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/vocabulary-snapshot-light-rollback.sql');
const BODY = migration.match(/CREATE OR REPLACE FUNCTION public\.fsrs_vocabulary_snapshot_light[\s\S]*? AS \$fn\$([\s\S]*?)\$fn\$;/)[1];
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const H = '00000000-0000-4000-8000-0000000000d4'; // synthetic: 3,000 words shaped like e2e/fixtures/heavy-account (ja 80% · zh 20%)
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

// 3,000단어 학습자 H — 칸 모양은 운영 user_vocabulary(뜻 · 읽기 · 품사 · 출처 문장 · 옛 일정), 아는 단어 120 · 제외 30. 로컬 fixture만.
await db.query('INSERT INTO auth.users(id) VALUES ($1)', [H]); await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [H]);
await h.as(H);
await db.query(`INSERT INTO public.user_vocabulary(user_id,language,word_text,base_form,meaning,furigana,pos,source_sentence,created_at,interval,ease_factor,
    repetitions,last_reviewed_at,next_review_at,source_ref)
  SELECT $1, CASE WHEN g % 5 = 0 THEN 'Chinese' ELSE 'Japanese' END, '語' || g, '語' || g, '뜻풀이 ' || g || ' — 예시 설명이 붙은 뜻',
    'ご' || g, '명사', '例文' || g || 'を含む長めの文です。', now() - (g % 120) * interval '1 day', (g % 60) + 0.5, 2 + (g % 7), g % 4,
    CASE WHEN g % 8 = 0 THEN NULL ELSE now() - (g % 30) * interval '1 day' END, now() + ((g % 20) - 4) * interval '1 day',
    CASE WHEN g % 3 = 0 THEN 'level:N4' END
  FROM generate_series(1, 3000) g`, [H]);
await db.query(`INSERT INTO public.user_known_words(user_id,lang,word_text) SELECT $1, 'ja', '語' || g FROM generate_series(1, 3000) g WHERE g % 25 = 1`, [H]);
await db.query(`INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids)
  SELECT $1, 'Chinese', '語' || g, NULL, '{}' FROM generate_series(1, 3000) g WHERE g % 100 = 5`, [H]);
await db.exec('ANALYZE');

const ACTORS = [A, B, C, H];
const snapshot = async u => (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v;
const light = async (u, language, summary) => (await one('SELECT public.fsrs_vocabulary_snapshot_light($1,$2,$3) v', [u, language, summary])).v;
const outputs = async () => { const o = {}; for (const u of ACTORS) { const { now, ...rest } = await snapshot(u); o[u] = rest; } return o; };
const md5s = async () => Object.fromEntries((await db.query(`SELECT p.oid::regprocedure::text sig, md5(p.prosrc) m FROM pg_proc p
  WHERE p.oid IN ('public.fsrs_vocabulary_snapshot(uuid)'::regprocedure, 'public.learning_language_capabilities()'::regprocedure)`)).rows.map(r => [r.sig, r.m]));
const ms = async (sql, params, runs = 5) => { const t = []; for (let i = 0; i < runs; i++) { const s = performance.now(); await db.query(sql, params); t.push(performance.now() - s); } return Math.round(t.sort((x, y) => x - y)[Math.floor(runs / 2)]); };
const bytes = async (sql, params) => (await one(sql, params)).n;
const languagesOf = s => [null, ...new Set(s.rows.map(r => r.language).filter(Boolean))];

const before = { pins: await h.pins(), out: await outputs(), md5: await md5s(), cap: await h.capability() };
assert.equal(before.pins.ok, true, 'chain leaves the four contracts consistent');
assert.equal(before.md5['fsrs_vocabulary_snapshot(uuid)'], '90cb5fb52d43d00eeb4b5c5a41ba8b19', 'chain = the P4 snapshot body the migration mirrors');
assert.equal(before.out[H].rows.length, 3000);

try {
  await check('migration shape: one db-push transaction, own body md5 pinned, core-only re-pin, parity gate, cache refreshed before commit, temp objects dropped', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.match(migration, /DO \$runner\$[\s\S]*SET LOCAL not in effect/);
    assert.equal(migration.split(md5(BODY)).length - 1, 2, 'own body md5 in the pre and post checks');
    assert.ok(restore.includes(md5(BODY)), 'rollback refuses an unreviewed body');
    assert.ok(migration.includes('90cb5fb52d43d00eeb4b5c5a41ba8b19'));
    const code = migration.replace(/--[^\n]*/g, '');
    assert.match(code, /UPDATE fsrs_private\.settings SET contract_hash = fsrs_private\.contract_hash\(\)/);
    assert.doesNotMatch(code, /UPDATE fsrs_private\.(manual_save_settings|admission_settings|activity_settings)/, 'core is the only pin this file moves');
    assert.doesNotMatch(code, /\b(ALTER|DROP|CREATE)\s+(TABLE|POLICY|INDEX|TRIGGER|VIEW)\b(?!\s+pg_temp)/i, 'no table / policy / index / trigger changes');
    assert.match(code, /REVOKE ALL ON FUNCTION public\.fsrs_vocabulary_snapshot_light\(uuid,text,boolean\) FROM PUBLIC, anon, authenticated, service_role;\s*GRANT EXECUTE ON FUNCTION public\.fsrs_vocabulary_snapshot_light\(uuid,text,boolean\) TO service_role;/);
    assert.match(migration, /SET CONSTRAINTS fsrs_private\.contract_cache_refresh IMMEDIATE;/);
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), name);
    for (const [, name] of restore.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(restore.includes(`DROP FUNCTION ${name}(`), name);
  });

  await check('a non-equivalent body (base_form known-word branch dropped) is caught by the parity gate and rolls back everything', async () => {
    const bad = BODY.replace(/\(k1\.w IS NOT NULL OR k2\.w IS NOT NULL\)/, '(k1.w IS NOT NULL)');
    assert.notEqual(bad, BODY);
    await h.expectFail(migration.replace(BODY, bad).replaceAll(md5(BODY), md5(bad)), /light differs from snapshot for \d+ of \d+ actor/);
    assert.deepEqual(await h.pins(), before.pins);
    assert.equal(await one(`SELECT to_regprocedure('${SIG}') f`).then(r => r.f), null);
  });

  await check('a body whose sparse registry drops excluded-only rows (they would read as eligible) is caught too (registry gate)', async () => {
    const bad = BODY.replace('FILTER (WHERE x.fid IS NOT NULL OR x.is_known OR x.is_excluded_only)', 'FILTER (WHERE x.fid IS NOT NULL OR x.is_known)');
    assert.notEqual(bad, BODY);
    await h.expectFail(migration.replace(BODY, bad).replaceAll(md5(BODY), md5(bad)), /light differs from snapshot for \d+ of \d+ actor\(s\) \(first: registry/);
    assert.deepEqual(await h.pins(), before.pins);
  });

  await check('refuses an unreviewed snapshot body (the mirrored fragments would no longer be the snapshot\'s) — nothing changes', async () => {
    await db.exec('BEGIN');
    await db.exec(`DO $x$ DECLARE d text; BEGIN SELECT pg_get_functiondef('public.fsrs_vocabulary_snapshot(uuid)'::regprocedure) INTO d;
      EXECUTE replace(d, 'RETURN result;', 'RETURN result; -- drift'); END $x$;
      UPDATE fsrs_private.settings SET contract_hash=fsrs_private.contract_hash();
      UPDATE fsrs_private.manual_save_settings SET contract_hash=fsrs_private.manual_contract_hash();
      UPDATE fsrs_private.admission_settings SET contract_hash=fsrs_private.admission_contract_hash();`);
    await assert.rejects(db.exec(migration), e => /fsrs_vocabulary_snapshot is not the reviewed P4 body/.test(e.message));
    await db.exec('ROLLBACK');
    assert.deepEqual(await h.pins(), before.pins);
    assert.deepEqual(await md5s(), before.md5);
  });

  let applied;
  await check('applies: core re-pinned, manual · admission · profile · capability · snapshot body unchanged, outputs identical, cache valid, Korean ready', async () => {
    await db.exec(migration);
    const p = await h.pins();
    assert.equal(p.ok, true);
    assert.notEqual(p.core, before.pins.core, 'core covers public.fsrs_* — re-pinned');
    assert.deepEqual([p.manual, p.admission, p.profile], [before.pins.manual, before.pins.admission, before.pins.profile]);
    assert.deepEqual(await md5s(), before.md5);
    assert.deepEqual(await h.capability(), before.cap);
    assert.equal(await h.koreanReady(), true);
    assert.deepEqual(await outputs(), before.out);
    const k = await one('SELECT * FROM fsrs_private.contract_cache');
    assert.equal(k.valid, true); assert.equal(k.core, p.core);
    await db.query('SELECT fsrs_private.require_admission_integrity()');
    assert.equal((await one(`SELECT md5(prosrc) m FROM pg_proc WHERE oid='${SIG}'::regprocedure`)).m, md5(BODY));
    assert.equal(Number((await one(`SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'ls\\_%'`)).n), 0);
    applied = p;
  });

  await check('same attributes and grants as the snapshot: SECURITY DEFINER · STABLE · search_path \'\' · EXECUTE for service_role only', async () => {
    const attrs = sig => one(`SELECT prosecdef, provolatile, proconfig, proowner::regrole::text owner FROM pg_proc WHERE oid='${sig}'::regprocedure`);
    assert.deepEqual(await attrs(SIG), await attrs('public.fsrs_vocabulary_snapshot(uuid)'));
    const can = async role => (await one(`SELECT has_function_privilege('${role}', '${SIG}', 'EXECUTE') ok`)).ok;
    assert.deepEqual([await can('anon'), await can('authenticated'), await can('service_role')], [false, false, true]);
    const snapCan = async role => (await one(`SELECT has_function_privilege('${role}', 'public.fsrs_vocabulary_snapshot(uuid)', 'EXECUTE') ok`)).ok;
    assert.deepEqual([await snapCan('anon'), await snapCan('authenticated'), await snapCan('service_role')], [false, false, true]);
    await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
    await assert.rejects(db.query(`SELECT public.fsrs_vocabulary_snapshot_light('${A}', NULL, true)`), e => e.code === '42501');
    await db.exec('ROLLBACK');
  });

  await check('same account checks and error codes as the snapshot (unknown actor 42501 · NULL actor 42501) · NULL summary is a request error (22023)', async () => {
    const code = async sql => { try { await db.query(sql); return 'ok'; } catch (e) { return e.code; } };
    const ghost = '00000000-0000-4000-8000-0000000000ff';
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_light('${ghost}', NULL, false)`), await code(`SELECT public.fsrs_vocabulary_snapshot('${ghost}')`));
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_light(NULL, NULL, true)`), '42501');
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_light('${A}', NULL, NULL)`), '22023');
    // 계정 불일치(55000) — 남의 카드가 끼면 snapshot과 똑같이 막힌다.
    const inForeignCard = async sql => {
      await db.exec('BEGIN; SET LOCAL session_replication_role = replica;');
      await db.query(`UPDATE public.fsrs_cards SET user_id=$1 WHERE card_id='30000000-0000-4000-8000-000000000006'`, [A]);
      try { return await code(sql); } finally { await db.exec('ROLLBACK'); }
    };
    assert.equal(await inForeignCard(`SELECT public.fsrs_vocabulary_snapshot_light('${C}', 'Japanese', true)`), '55000');
    assert.equal(await inForeignCard(`SELECT public.fsrs_vocabulary_snapshot('${C}')`), '55000');
    assert.equal(await inForeignCard(`SELECT public.fsrs_vocabulary_snapshot_light('${C}', 'French', false)`), '55000', 'the account check is not narrowed by the language filter');
  });

  await check('every learner × every language (+ all) × both shapes: SQL light = compact(SQL snapshot), and expand(light) = snapshot rows/registry of that language', async () => {
    let compared = 0, sparse = 0;
    for (const u of ACTORS) {
      const full = await snapshot(u);
      for (const language of languagesOf(full)) for (const summary of [false, true]) {
        const got = await light(u, language, summary);
        const { now: _n, ...want } = compactVocabularySnapshot(full, { language, summary });
        const { now, ...rest } = got;
        assert.ok(typeof now === 'string');
        assert.deepEqual(rest, want, `${u} ${language} ${summary}`);
        // 되돌린 모양 = snapshot 원문(그 언어)의 행 · registry(요약이면 요약 칸 + user_id). 검증 · 투영은 vitest(vocabularySnapshotLight.test.js).
        const expanded = expandLightSnapshot(got, u, { language, summary });
        const rows = full.rows.filter(r => language === null || r.language === language);
        const pick = row => (summary ? Object.fromEntries(['user_id', ...LIGHT_SUMMARY_COLUMNS].map(k => [k, row[k]])) : row);
        const byId = new Map(full.registry.map(e => [e.cardId, e]));
        assert.deepEqual({ ...expanded, now: null }, { ...full, now: null, rows: rows.map(pick), registry: rows.map(r => byId.get(r.id)) }, `expand ${u} ${language} ${summary}`);
        compared++; sparse += got.registry.length;
      }
    }
    assert.ok(compared >= 20 && sparse > 0, `compared ${compared}, sparse registry entries ${sparse}`);
  });

  await check('already applied: second run is a clean no-op', async () => {
    await db.exec(migration);
    assert.deepEqual(await h.pins(), applied);
    assert.deepEqual(await outputs(), before.out);
  });

  const timing = {
    full: { ms: await ms('SELECT length(public.fsrs_vocabulary_snapshot($1)::text) n', [H]), bytes: await bytes('SELECT length(public.fsrs_vocabulary_snapshot($1)::text) n', [H]) },
    summaryAll: { ms: await ms('SELECT length(public.fsrs_vocabulary_snapshot_light($1,NULL,true)::text) n', [H]), bytes: await bytes('SELECT length(public.fsrs_vocabulary_snapshot_light($1,NULL,true)::text) n', [H]) },
    japaneseFull: { ms: await ms("SELECT length(public.fsrs_vocabulary_snapshot_light($1,'Japanese',false)::text) n", [H]), bytes: await bytes("SELECT length(public.fsrs_vocabulary_snapshot_light($1,'Japanese',false)::text) n", [H]) },
    chineseFull: { ms: await ms("SELECT length(public.fsrs_vocabulary_snapshot_light($1,'Chinese',false)::text) n", [H]), bytes: await bytes("SELECT length(public.fsrs_vocabulary_snapshot_light($1,'Chinese',false)::text) n", [H]) },
  };

  await check('restore (docs/sql/vocabulary-snapshot-light-rollback.sql): function gone, core back to the exact pre-migration pin, others untouched; re-apply works', async () => {
    await db.exec(restore);
    assert.deepEqual(await h.pins(), before.pins);
    assert.equal(await one(`SELECT to_regprocedure('${SIG}') f`).then(r => r.f), null);
    assert.deepEqual(await outputs(), before.out);
    assert.deepEqual(await md5s(), before.md5);
    await db.exec(restore); // 다시 실행해도(함수 없음) 같은 상태
    assert.deepEqual(await h.pins(), before.pins);
    await db.exec(migration);
    const again = await h.pins();
    // core 지문 열쇠에 함수 oid가 든다 — 다시 만든 함수는 oid가 달라 core 값도 다르다(그래서 이 파일은 core 값을 상수로 박지 않는다).
    assert.equal(again.ok, true);
    assert.notEqual(again.core, before.pins.core);
    assert.deepEqual([again.manual, again.admission, again.profile], [applied.manual, applied.admission, applied.profile]);
  });

  console.log(`TIMING (PGlite, 3,000-word learner H, median of 5) ${JSON.stringify(timing)}`);
  console.log(`OK ${checks} checks`);
} finally {
  await db.close();
}
