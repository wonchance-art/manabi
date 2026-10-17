/** Shared local PGlite setup for the snapshot migration checks (PERF-SNAPSHOT P4) — never connects to Supabase.
 * M09 observed-contract fixture (#1399) + synthetic learners, then the production chain up to 20261016191500 (KO-CAP-REPIN-001).
 * Production expectation constants in a migration are swapped for this fixture's values with the shared localize
 * (lib/production-constants.mjs): the states the constants describe are fixed here — before 191500 (pin · core) and after it
 * (live = pinned · core = PROD_LATER.core) — so a re-run sees the same branch production would.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { localize } from './lib/production-constants.mjs';

export const read = path => readFile(new URL(path, import.meta.url), 'utf8');
export const A = '00000000-0000-4000-8000-0000000000a1'; // synthetic: 1,232 words like the largest production learner
export const B = '00000000-0000-4000-8000-0000000000b2'; // synthetic: small learner

export async function setup({ timing = false } = {}) {
  const originalTest = await read('./korean-learning-support.mjs');
  const marker = 'const modernFixtureSql = ';
  const start = originalTest.indexOf(marker) + marker.length;
  const end = originalTest.indexOf('\n`;', start);
  assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
  const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
  const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');
  const ko = await read('../migrations/20261016191500_korean_capability_repin.sql');
  const db = new PGlite();
  const one = async (sql, p) => (await db.query(sql, p)).rows[0];
  const as = u => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [u]);
  const h = {
    db, one, as,
    pins: () => one(`SELECT (SELECT contract_hash FROM fsrs_private.settings) core,(SELECT contract_hash FROM fsrs_private.manual_save_settings) manual,
      (SELECT contract_hash FROM fsrs_private.admission_settings) admission,(SELECT profile_contract_hash FROM fsrs_private.activity_settings) profile,
      (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AND (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash()
      AND (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() AND (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() ok`),
    capability: () => one(`SELECT substring(prosrc from 'ready:=live_hash= ''([0-9a-f]{32})''') pinned, proacl::text acl, proowner::regrole::text owner
      FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`),
    fnmd5: async sig => (await one('SELECT md5(prosrc) m FROM pg_proc WHERE oid=$1::regprocedure', [sig])).m,
    index: async () => (await one("SELECT pg_get_indexdef(to_regclass('public.user_known_words_norm_word_idx')) d")).d,
    koreanReady: async () => { await as(A); const k = (await one('SELECT public.learning_language_capabilities() value')).value.languages.Korean; return Object.values(k).every(Boolean); },
    snaps: async () => { const out = {}; for (const u of [A, B]) { const { now, ...rest } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v; assert.ok(now); out[u] = rest; } return out; },
    tempLeft: async () => (await one(`SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND p.proname LIKE 'perf\\_%')
      + (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp%' AND c.relname LIKE 'perf\\_%') n`)).n,
    expectFail: async (sql, re) => { await assert.rejects(db.exec(sql), e => { assert.match(e.message, re); return true; }); await db.exec('ROLLBACK').catch(() => {}); },
    /** median wall time (ms) of fsrs_vocabulary_snapshot for the 1,232-word learner */
    snapshotMs: async (runs = 5) => {
      const t = [];
      for (let i = 0; i < runs; i++) { const s = performance.now(); await one('SELECT length(public.fsrs_vocabulary_snapshot($1)::text) n', [A]); t.push(performance.now() - s); }
      return Math.round(t.sort((x, y) => x - y)[Math.floor(runs / 2)]);
    },
  };
  // core fingerprint SELECT (observed production body) with only the capability scalar swapped — the production prediction method
  const coreBody = fixture.match(/CREATE OR REPLACE FUNCTION fsrs_private\.contract_hash\(\)[\s\S]*?AS \$function\$\n([\s\S]*?FROM objects)\n\$function\$;/)[1];
  const fnLine = 'jsonb_build_array(pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_proc p JOIN pg_namespace n';
  assert.equal(coreBody.split(fnLine).length, 2);
  h.predictCore = async (from, to) => {
    const sql = coreBody.replace(fnLine, `jsonb_build_array(CASE WHEN p.oid=to_regprocedure('public.learning_language_capabilities()') THEN replace(pg_get_functiondef(p.oid),'ready:=live_hash= ''${from}''','ready:=live_hash= ''${to}''') ELSE pg_get_functiondef(p.oid) END,p.proacl,p.proowner) FROM pg_proc p JOIN pg_namespace n`);
    await db.exec("BEGIN READ ONLY; SET LOCAL search_path='';");
    try { return { now: (await one(coreBody)).md5, predicted: (await one(sql)).md5 }; } finally { await db.exec('ROLLBACK'); }
  };

  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  for (const u of [A, B]) { await db.query('INSERT INTO auth.users(id) VALUES ($1)', [u]); await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [u]); }
  // edge cases (A): plain · known(word · base_form · whitespace) · excluded(card · language+word · retired card) · known+excluded; B: other user's known word must not leak
  const edge = [
    ['10000000-0000-4000-8000-000000000001', A, 'Japanese', '猫', null], ['10000000-0000-4000-8000-000000000002', A, 'Japanese', '犬', null],
    ['10000000-0000-4000-8000-000000000003', A, 'Japanese', '食べた', '食べる'], ['10000000-0000-4000-8000-000000000004', A, 'Japanese', '鳥', null],
    ['10000000-0000-4000-8000-000000000005', A, 'Chinese', '学校', null], ['10000000-0000-4000-8000-000000000006', A, 'Korean', '사과', null],
    ['10000000-0000-4000-8000-000000000007', A, 'English', ' apple ', null], ['10000000-0000-4000-8000-000000000008', A, 'French', 'chat', null],
    ['20000000-0000-4000-8000-000000000001', B, 'Japanese', '犬', null], ['20000000-0000-4000-8000-000000000002', B, 'Korean', '책', null],
  ];
  for (const [id, u, lang, w, base] of edge) { await as(u); await db.query('INSERT INTO public.user_vocabulary(id,user_id,language,word_text,base_form) VALUES ($1,$2,$3,$4,$5)', [id, u, lang, w, base]); }
  if (timing) {
    // bulk shaped like the largest production learner (2026-10-17 KST, aggregate counts only): 1,232 words —
    // Chinese 1,129 · French 98 · a few others — and 223 known words, all zh (each also auto-excluded by the known-word trigger)
    await as(A);
    await db.query(`INSERT INTO public.user_vocabulary(user_id,language,word_text,base_form)
      SELECT $1, CASE WHEN g <= 1121 THEN 'Chinese' WHEN g <= 1219 THEN 'French' ELSE 'English' END, 'w' || g,
             CASE WHEN g % 7 = 0 THEN 'b' || g END FROM generate_series(1, 1224) g`, [A]);
    await db.query(`INSERT INTO public.user_known_words(user_id,lang,word_text)
      SELECT $1, 'zh', CASE WHEN g % 7 = 0 THEN 'b' || g ELSE 'w' || g END FROM generate_series(1, 1121) g WHERE g % 5 = 0 LIMIT 222`, [A]);
    await db.exec('ANALYZE');
  }
  for (const [u, lang, w] of [[A, 'ja', '犬'], [A, 'ja', '食べる'], [A, 'ko', '사과'], [A, 'en', 'apple'], [B, 'zh', '学校']]) {
    await as(u); await db.query('INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES ($1,$2,$3)', [u, lang, w]);
  }
  for (const [u, lang, w, vid, retired] of [[A, 'Japanese', '鳥', '10000000-0000-4000-8000-000000000004', '{}'], [A, 'Chinese', '学校', null, '{}'],
    [A, 'Korean', '사과', null, '{}'], [A, 'French', 'chien', null, '{10000000-0000-4000-8000-000000000008}']]) {
    await as(u); await db.query('INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [u, lang, w, vid, retired]);
  }
  h.base = await h.snaps();
  const LOCAL = { pin: (await h.capability()).pinned, ...(({ ok, ...p }) => p)(await h.pins()) };

  // production chain: #1504 → admin_set_user_role → KO-CAP-REPIN-001
  await db.exec(await read('../migrations/20261016150000_anon_book_catalog.sql'));
  await db.exec(await read('../migrations/20261016171800_admin_set_user_role.sql'));
  assert.equal(await h.koreanReady(), false, '#1504 turns Korean off (reproduced)');
  const fp = ko.match(/CREATE FUNCTION pg_temp\.perf_korean_live_hash\(\) RETURNS text [^\n]*\$q\$\n([\s\S]*?)\n\$q\$;/)[1];
  await db.exec("BEGIN READ ONLY; SET LOCAL search_path='';"); LOCAL.live = (await one(fp)).md5; await db.exec('ROLLBACK');
  const prediction = await h.predictCore(LOCAL.pin, LOCAL.live);
  assert.equal(prediction.now, LOCAL.core, 'prediction method reproduces the current core pin');
  // 191500 적용 전: core = 그 전 값. 적용 뒤: core 나중 값(PROD_LATER.core) · 실제 = 게시(PROD.live) — 같은 core 양을 그 시점 값으로.
  h.localize = text => localize(text, { ...LOCAL, core: LOCAL.coreAfterKo || LOCAL.core });
  await db.exec(h.localize(ko));
  assert.equal(await h.koreanReady(), true, 'KO-CAP-REPIN-001 applied');
  LOCAL.coreAfterKo = (await h.pins()).core;
  assert.equal(prediction.predicted, LOCAL.coreAfterKo, 'predicted post-KO-CAP core pin = actual (validates the production prediction)');
  assert.deepEqual(await h.snaps(), h.base);
  h.LOCAL = LOCAL;
  return h;
}

export const C = '00000000-0000-4000-8000-0000000000c3'; // synthetic edge-case learner
/** Edge-case learner C: NFD/NFC parity, whitespace, empty base_form, NULL / unmapped language, retired ids with NULL,
 *  exclusion by (language, base_form-or-word), enrolled cards (sub-ms due, abandoned attempt, sub-ms receipt). Local fixture only. */
export async function seedEdgeActor(h) {
  const { db, as } = h;
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [C]); await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [C]);
  await as(C);
  for (const [id, lang, w, base] of [
    ['30000000-0000-4000-8000-000000000001', 'French', 'café', null], ['30000000-0000-4000-8000-000000000002', 'French', 'thé', ''],
    ['30000000-0000-4000-8000-000000000003', null, 'nolang', null], ['30000000-0000-4000-8000-000000000004', 'German', 'Haus', null],
    ['30000000-0000-4000-8000-000000000005', 'English', '  run ', 'ran'], ['30000000-0000-4000-8000-000000000006', 'Japanese', '山', null],
    ['30000000-0000-4000-8000-000000000007', 'Japanese', '川', null], ['30000000-0000-4000-8000-000000000008', 'Japanese', '空', null],
    ['30000000-0000-4000-8000-000000000009', 'English', 'plain', null], ['30000000-0000-4000-8000-00000000000a', 'English', 'Run', 'café'],
  ]) await db.query('INSERT INTO public.user_vocabulary(id,user_id,language,word_text,base_form) VALUES ($1,$2,$3,$4,$5)', [id, C, lang, w, base]);
  await db.query("INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES ($1,'fr',$2), ($1,'en','x-none')", [C, 'café']);
  await db.exec('SET session_replication_role = replica'); // local fixture only: seed exclusions / FSRS rows without app guards
  await db.query(`INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids) VALUES
    ($1,'French','thé',NULL,'{}'), ($1,'English','ran',NULL,'{}'), ($1,'Japanese','zzz',NULL,ARRAY[NULL,'30000000-0000-4000-8000-000000000008']::uuid[])`, [C]);
  const card = due => JSON.stringify({ version: 1, engine: 'v5.3.2 using FSRS-6.0', policyVersion: 'anki-seconds-v1', timeZone: 'Asia/Seoul', rolloverHour: 4,
    introducedAt: '2026-10-01T00:00:00Z', revision: 0, state: 'New', step: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0, due, lastReview: null, scheduledDays: 0, elapsedDays: 0 });
  h.card = card;
  await db.query(`INSERT INTO public.fsrs_cards(card_id,user_id,card,attempt) VALUES
    ('30000000-0000-4000-8000-000000000006',$1,$2,NULL),
    ('30000000-0000-4000-8000-000000000007',$1,$3,'{"phase":"abandoned","questionAt":"2026-10-21T00:00:00.1234Z","revealedAt":"2026-10-21T00:00:05Z"}'),
    ('30000000-0000-4000-8000-000000000008',$1,$4,NULL)`, [C, card('2026-10-20T01:02:03.456789Z'), card('2026-10-19T00:00:00Z'), card('2026-10-18T00:00:00Z')]);
  await db.query(`INSERT INTO public.fsrs_new_receipts(card_id,user_id,operation_id,learning_day,question_at)
    VALUES ('30000000-0000-4000-8000-000000000008',$1,'op-edge-1','2026-10-02','2026-10-02T00:00:00.000500Z')`, [C]);
  await db.exec('RESET session_replication_role');
  await db.exec('ANALYZE');
}
