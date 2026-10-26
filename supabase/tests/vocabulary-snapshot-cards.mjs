/** Local, disposable PGlite only — never connects to Supabase (SNAPSHOT-CARDS-001).
 * 20261026020000_vocabulary_snapshot_cards: 저장 · 채점 뒤 색인 패치용 좁은 읽기 public.fsrs_vocabulary_snapshot_cards(actor, ids).
 * 증명: 모든 학습자(A · B · 가장자리 C · 3,000단어 H) × 여러 id 묶음(한 장씩 · 50장 묶음으로 전부 · 판정이 붙은 칸 · 중복 · 남의 id · 없는 id)에서
 * SQL cards(ids) = SQL snapshot을 그 id로 거른 것(머리 · rows · registry 전체 칸 · 같은 순서) · 남의 id는 빠지고 남의 행을 알리지 않음 ·
 * 그 결과로 색인을 패치하면(mergeVocabularyWordIndexCards) 전체 snapshot으로 다시 만든 색인과 같음 · core만 재게시(manual · admission ·
 * profile · capability · snapshot · light 본문 불변) · 권한 = service_role만 · 계정 검사 같은 오류 코드 · 요청 검사(22023) · 동치가 아닌 본문은
 * 사후 검사가 잡아 전체 롤백 · 검토하지 않은 snapshot 본문 위에는 적용하지 않음 · 재실행 no-op ·
 * 복원(docs/sql/vocabulary-snapshot-cards-rollback.sql) 뒤 core 정확 복귀 · 다시 적용됨.
 *   node supabase/tests/vocabulary-snapshot-cards.mjs
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';
import { buildVocabularyWordIndex, mergeVocabularyWordIndexCards } from '../../src/lib/vocabularyDueIndex.js';

const md5 = s => createHash('md5').update(s).digest('hex');
const FILE = '20261026020000_vocabulary_snapshot_cards.sql';
const SIG = 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])';
const LIGHT = 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)';
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/vocabulary-snapshot-cards-rollback.sql');
const BODY = migration.match(/CREATE OR REPLACE FUNCTION public\.fsrs_vocabulary_snapshot_cards[\s\S]*? AS \$fn\$([\s\S]*?)\$fn\$;/)[1];
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const H = '00000000-0000-4000-8000-0000000000d4'; // synthetic: 3,000 words shaped like e2e/fixtures/heavy-account (ja 80% · zh 20%)
const GHOST = '00000000-0000-4000-8000-00000000beef';
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
await seedEdgeActor(h);
const { db, one } = h;
// 운영 순서대로 관측 뒤 마이그레이션(191500 이후 · 이 파일 전 — light · cohort revoke · profiles privacy 포함)을 올린다. fixture 범위 밖은 건너뛴다.
// profiles privacy(20261026010000)는 public_profiles view가 먼저 있어야 한다 — setup이 올리지 않는 그 둘(191500 전)을 앞에 둔다.
const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
for (const f of [...PROFILES_VIEW, ...(await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort()]) {
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
assert.notEqual((await one(`SELECT to_regprocedure('${LIGHT}') f`)).f, null, 'light is in the chain before this file');

// 3,000단어 학습자 H — vocabulary-snapshot-light.mjs와 같은 모양(뜻 · 읽기 · 품사 · 출처 문장 · 옛 일정, 아는 단어 120 · 제외 30). 로컬 fixture만.
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
const cards = async (u, ids) => (await one('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [u, ids])).v;
const outputs = async () => { const o = {}; for (const u of ACTORS) { const { now, ...rest } = await snapshot(u); o[u] = rest; } return o; };
const md5s = async () => Object.fromEntries((await db.query(`SELECT p.oid::regprocedure::text sig, md5(p.prosrc) m FROM pg_proc p
  WHERE p.oid IN ('public.fsrs_vocabulary_snapshot(uuid)'::regprocedure, '${LIGHT}'::regprocedure, 'public.learning_language_capabilities()'::regprocedure)`)).rows.map(r => [r.sig, r.m]));
const ms = async (sql, params, runs = 5) => { const t = []; for (let i = 0; i < runs; i++) { const s = performance.now(); await db.query(sql, params); t.push(performance.now() - s); } return Math.round(t.sort((x, y) => x - y)[Math.floor(runs / 2)]); };
const bytes = async (sql, params) => (await one(sql, params)).n;
/** snapshot을 그 id로 거른 것 — 비교 기준(같은 순서). */
const filtered = (full, ids) => { const want = new Set(ids); return { ...full, rows: full.rows.filter(r => want.has(r.id)), registry: full.registry.filter(e => want.has(e.cardId)) }; };
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const judgedIds = full => full.registry.filter(e => e.enrolled || e.known || e.excluded).map(e => e.cardId);

const before = { pins: await h.pins(), out: await outputs(), md5: await md5s(), cap: await h.capability() };
assert.equal(before.pins.ok, true, 'chain leaves the four contracts consistent');
assert.equal(before.md5['fsrs_vocabulary_snapshot(uuid)'], '90cb5fb52d43d00eeb4b5c5a41ba8b19', 'chain = the P4 snapshot body the migration mirrors');
assert.equal(before.out[H].rows.length, 3000);

try {
  await check('migration shape: one db-push transaction, own body md5 pinned, core-only re-pin, request + parity gates, cache refreshed before commit, temp objects dropped', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.match(migration, /DO \$runner\$[\s\S]*SET LOCAL not in effect/);
    assert.equal(migration.split(md5(BODY)).length - 1, 2, 'own body md5 in the pre and post checks');
    assert.ok(restore.includes(md5(BODY)), 'rollback refuses an unreviewed body');
    assert.ok(migration.includes('90cb5fb52d43d00eeb4b5c5a41ba8b19'));
    const code = migration.replace(/--[^\n]*/g, '');
    assert.match(code, /UPDATE fsrs_private\.settings SET contract_hash = fsrs_private\.contract_hash\(\)/);
    assert.doesNotMatch(code, /UPDATE fsrs_private\.(manual_save_settings|admission_settings|activity_settings)/, 'core is the only pin this file moves');
    assert.doesNotMatch(code, /\b(ALTER|DROP|CREATE)\s+(TABLE|POLICY|INDEX|TRIGGER|VIEW)\b(?!\s+pg_temp)/i, 'no table / policy / index / trigger changes');
    assert.match(code, /REVOKE ALL ON FUNCTION public\.fsrs_vocabulary_snapshot_cards\(uuid,uuid\[\]\) FROM PUBLIC, anon, authenticated, service_role;\s*GRANT EXECUTE ON FUNCTION public\.fsrs_vocabulary_snapshot_cards\(uuid,uuid\[\]\) TO service_role;/);
    assert.match(migration, /SET CONSTRAINTS fsrs_private\.contract_cache_refresh IMMEDIATE;/);
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), name);
    for (const [, name] of restore.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(restore.includes(`DROP FUNCTION ${name}(`), name);
  });

  const bodies = {
    'base_form known-word branch dropped': [/\(k1\.w IS NOT NULL OR k2\.w IS NOT NULL\)/, '(k1.w IS NOT NULL)', /cards differ from snapshot for \d+ of \d+ actor/],
    'ownership not checked (foreign ids leak)': ['  WHERE v.user_id=p_actor AND v.id=ANY(p_ids))', '  WHERE (v.user_id=p_actor OR v.user_id IS NOT NULL) AND v.id=ANY(p_ids))', /cards differ from snapshot for \d+ of \d+ actor/],
    'id cap not enforced': ['cardinality(p_ids) NOT BETWEEN 1 AND 50', 'cardinality(p_ids) NOT BETWEEN 1 AND 5000', /only 5 of 6 bad requests rejected/],
  };
  for (const [name, [from, to, error]] of Object.entries(bodies)) {
    await check(`a non-equivalent body (${name}) is caught by the gates and rolls back everything`, async () => {
      const bad = BODY.replace(from, to);
      assert.notEqual(bad, BODY);
      await h.expectFail(migration.replace(BODY, bad).replaceAll(md5(BODY), md5(bad)), error);
      assert.deepEqual(await h.pins(), before.pins);
      assert.equal(await one(`SELECT to_regprocedure('${SIG}') f`).then(r => r.f), null);
    });
  }

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
  await check('applies: core re-pinned, manual · admission · profile · capability · snapshot · light bodies unchanged, outputs identical, cache valid, Korean ready', async () => {
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
    assert.equal(Number((await one(`SELECT count(*) n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'sc\\_%'`)).n), 0);
    applied = p;
  });

  await check('same attributes and grants as the snapshot: SECURITY DEFINER · STABLE · search_path \'\' · EXECUTE for service_role only', async () => {
    const attrs = sig => one(`SELECT prosecdef, provolatile, proconfig, proowner::regrole::text owner FROM pg_proc WHERE oid='${sig}'::regprocedure`);
    assert.deepEqual(await attrs(SIG), await attrs('public.fsrs_vocabulary_snapshot(uuid)'));
    const can = async role => (await one(`SELECT has_function_privilege('${role}', '${SIG}', 'EXECUTE') ok`)).ok;
    assert.deepEqual([await can('anon'), await can('authenticated'), await can('service_role')], [false, false, true]);
    await db.exec('BEGIN; SET LOCAL ROLE authenticated;');
    await assert.rejects(db.query(`SELECT public.fsrs_vocabulary_snapshot_cards('${A}', ARRAY['10000000-0000-4000-8000-000000000001']::uuid[])`), e => e.code === '42501');
    await db.exec('ROLLBACK');
  });

  await check('same account checks and error codes as the snapshot (unknown · NULL actor 42501 · foreign card 55000 whatever ids are asked) · bad id lists are 22023', async () => {
    const code = async (sql, params) => { try { await db.query(sql, params); return 'ok'; } catch (e) { return e.code; } };
    const one1 = ['10000000-0000-4000-8000-000000000001'];
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_cards('${GHOST}', $1::uuid[])`, [one1]), await code(`SELECT public.fsrs_vocabulary_snapshot('${GHOST}')`));
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_cards(NULL, $1::uuid[])`, [one1]), '42501');
    const many = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
    for (const bad of [null, [], many, [null], [one1[0], null]]) {
      assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_cards('${A}', $1::uuid[])`, [bad]), '22023', JSON.stringify(bad)?.slice(0, 60));
    }
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_cards('${A}', ARRAY[ARRAY['${one1[0]}'::uuid]])`), '22023', '2-D');
    assert.equal(await code(`SELECT public.fsrs_vocabulary_snapshot_cards('${A}', $1::uuid[])`, [many.slice(0, 50)]), 'ok', '50 is the cap, inclusive');
    // 계정 불일치(55000) — 남의 카드가 끼면 snapshot과 똑같이 막힌다(묻는 id와 상관없이 — 계정 검사는 좁히지 않는다).
    const inForeignCard = async sql => {
      await db.exec('BEGIN; SET LOCAL session_replication_role = replica;');
      await db.query(`UPDATE public.fsrs_cards SET user_id=$1 WHERE card_id='30000000-0000-4000-8000-000000000006'`, [A]);
      try { return await code(sql); } finally { await db.exec('ROLLBACK'); }
    };
    assert.equal(await inForeignCard(`SELECT public.fsrs_vocabulary_snapshot_cards('${C}', ARRAY['30000000-0000-4000-8000-000000000001']::uuid[])`), '55000');
    assert.equal(await inForeignCard(`SELECT public.fsrs_vocabulary_snapshot('${C}')`), '55000');
  });

  await check('every learner: every card one by one (H: sampled) and in 50-card chunks (all) = snapshot filtered by id, exactly; judged cards too', async () => {
    let compared = 0;
    for (const u of ACTORS) {
      const { now: _n, ...full } = await snapshot(u);
      const ids = full.rows.map(r => r.id);
      const singles = u === H ? [...ids.filter((_, i) => i % 250 === 0), ids.at(-1), ...judgedIds(full).slice(0, 10)] : ids;
      const sets = [...singles.map(id => [id]), ...chunks(ids, 50), ...chunks(judgedIds(full), 50)];
      for (const set of sets) {
        const { now, ...got } = await cards(u, set);
        assert.equal(typeof now, 'string');
        assert.deepEqual(got, filtered(full, set), `${u} ${set.length} id(s) from ${set[0]}`);
        compared++;
      }
      if (u === H) assert.ok(judgedIds(full).length >= 150, 'H has known and excluded cards'); // 아는 단어 120 + 제외 30
    }
    assert.ok(compared >= 100, `compared ${compared}`);
  });

  await check('ids of another learner and ids that do not exist are left out (no foreign row, no hint) · duplicates count once', async () => {
    const fullA = (await snapshot(A)), fullC = await snapshot(C);
    const mine = fullA.rows[0].id, theirs = fullC.rows[0].id;
    const { now: _a, ...got } = await cards(A, [mine, mine, theirs, GHOST]);
    const { now: _f, ...want } = filtered(fullA, [mine]);
    assert.deepEqual(got, want);
    assert.equal(got.rows.length, 1);
    const { now: _b, ...none } = await cards(A, [theirs, GHOST]);
    assert.deepEqual(none.rows, []); assert.deepEqual(none.registry, []);
    assert.deepEqual((({ rows, registry, ...head }) => head)(none), (({ now, rows, registry, ...head }) => head)(fullA), 'same envelope even when empty');
  });

  await check('patching an index with cards(id) = rebuilding it from the full snapshot (new card · changed card · every C edge card · H samples)', async () => {
    let patched = 0;
    // C의 카드 하나는 마감이 마이크로초(2026-10-20T01:02:03.456789Z)라 서버 검사(validateVocabularyLearningSnapshot → validateFsrsCard)가
    // 받지 않는다 — 앱에 오는 모양(ms)으로 맞춘 트랜잭션 안에서만 비교하고 되돌린다(로컬 fixture만).
    await db.exec('BEGIN; SET LOCAL session_replication_role = replica;');
    await db.query(`UPDATE public.fsrs_cards SET card = jsonb_set(card, '{due}', to_jsonb(to_char((card->>'due')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      WHERE user_id = $1`, [C]);
    try {
    for (const u of ACTORS) {
      const full = await snapshot(u);
      const ids = full.rows.map(r => r.id);
      const picks = u === H ? [ids[0], ids[1234], ids.at(-1), ...judgedIds(full).slice(0, 3)] : ids;
      for (const id of picks) {
        const got = await cards(u, [id]);
        const at = Math.max(Date.parse(full.now), Date.parse(got.now)) + 1000;
        const want = buildVocabularyWordIndex(full, at);
        // 담기 전(그 카드 없음) → 담은 뒤
        const without = { ...full, rows: full.rows.filter(r => r.id !== id), registry: full.registry.filter(e => e.cardId !== id) };
        const added = mergeVocabularyWordIndexCards(buildVocabularyWordIndex(without, at), got, { ids: [id], at });
        assert.ok(added, `${u} ${id} merge`);
        for (const key of ['byKey', 'surfaces', 'bases', 'projectionsById', 'registryById', 'actorId', 'enabled', 'complete', 'registryAvailable', 'now']) {
          assert.deepEqual(added[key], want[key], `${u} ${id} added ${key}`);
        }
        // 뜻 · 일정이 바뀌기 전 → 뒤(교정 · 채점)
        const stale = { ...full, rows: full.rows.map(r => (r.id === id ? { ...r, meaning: `${r.meaning}·옛`, interval: 99 } : r)),
          registry: full.registry.map(e => (e.cardId === id ? { ...e, known: false, excluded: false, eligible: true, enrolled: false, card: null, nextQuestionAt: null, firstQuestionAt: null } : e)) };
        const changed = mergeVocabularyWordIndexCards(buildVocabularyWordIndex(stale, at), got, { ids: [id], at });
        for (const key of ['byKey', 'surfaces', 'bases', 'projectionsById', 'registryById']) assert.deepEqual(changed[key], want[key], `${u} ${id} changed ${key}`);
        patched++;
      }
    }
    } finally { await db.exec('ROLLBACK'); }
    assert.ok(patched > 20, `patched ${patched}`);
  });

  await check('already applied: second run is a clean no-op', async () => {
    await db.exec(migration);
    assert.deepEqual(await h.pins(), applied);
    assert.deepEqual(await outputs(), before.out);
  });

  const someH = (await snapshot(H)).rows.map(r => r.id);
  const timing = {
    full: { ms: await ms('SELECT length(public.fsrs_vocabulary_snapshot($1)::text) n', [H]), bytes: await bytes('SELECT length(public.fsrs_vocabulary_snapshot($1)::text) n', [H]) },
    cards1: { ms: await ms('SELECT length(public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[])::text) n', [H, [someH[1500]]]), bytes: await bytes('SELECT length(public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[])::text) n', [H, [someH[1500]]]) },
    cards50: { ms: await ms('SELECT length(public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[])::text) n', [H, someH.slice(0, 50)]), bytes: await bytes('SELECT length(public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[])::text) n', [H, someH.slice(0, 50)]) },
  };

  await check('restore (docs/sql/vocabulary-snapshot-cards-rollback.sql): function gone, core back to the exact pre-migration pin, others untouched; re-apply works', async () => {
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
