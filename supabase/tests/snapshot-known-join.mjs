/** Local, disposable PGlite only — never connects to Supabase (PERF-SNAPSHOT-KNOWN-001 · 2026-11-04 KST).
 * 20261104090000_snapshot_known_join: 단어장 snapshot 셋(fsrs_vocabulary_snapshot · _light · _cards)의 아는 단어 판정을 LEFT JOIN kw k1/k2 →
 * 행마다 키(vv) + EXISTS로 바꾸고, 같은 트랜잭션에서 core · manual · admission을 재게시한다(출력은 바이트 그대로).
 * 운영과 같은 사슬(관측 fixture → 191500 → 그 뒤 마이그레이션 · anki-v2 → … → 이 파일 직전)에서 시작한다. 합성 학습자 넷:
 *   A · B(보통 · 아는 단어 · 제외 3종) · C(가장자리 — NFD/NFC · 공백 · 빈 base_form · NULL/목록 밖 언어 · NULL 섞인 retired · 카드 3장) ·
 *   D(무거운 학습자 — 운영 최대 학습자 모양: 단어 1,664 · 아는 단어 241(word_text로 · base_form으로 · NFD · 공백) · 제외(id · retired id · 단어) · 카드 24장)
 * 증명:
 *   ⓪ 파일 모양 — 트랜잭션 제어 없음 · 운영 해시 상수 없음 · 세 본문에 LEFT JOIN kw 없음 · 임시 객체 DROP
 *   ① 사전 거부 — 검토 밖 본문 · 계약 어긋남 · 한국어 꺼짐이면 RAISE하고 아무것도 바꾸지 않음
 *   ② 적용 — 출력 셋(snapshot · light 언어 NULL/각 언어/없는 언어 × 요약/전체 · cards 여러 묶음 · 오류 코드) 전원 동일 · 네 핀 = 실측(캐시 · _live) ·
 *      core · manual · admission만 움직임(profile 불변) · 한국어 ready(실제 RPC) · capability 불변 · 세 함수 속성 · 권한 불변 · 새 md5 · 캐시 유효
 *   ③ 재실행 no-op   ④ 복원(옛 본문 셋 + 같은 재게시) 뒤 옛 md5 · 처음 핀 그대로 · 출력 동일 → 다시 적용
 *   + 시간 비교(무거운 학습자 D, 정보용): 첫 호출과 같은 custom plan(plan_cache_mode=force_custom_plan)과 기본(auto)에서 옛 본문 vs 새 본문
 *   node supabase/tests/snapshot-known-join.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, B, C } from './perf-snapshot-fixture.mjs';
import { containsProductionConstants } from './lib/production-constants.mjs';

const FILE = '20261104090000_snapshot_known_join.sql';
const PREVIOUS = '20261101120000_fsrs_card_kinds.sql'; // 세 본문을 마지막으로 정의한 파일 = 복원 원문
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const D = '00000000-0000-4000-8000-0000000000d4'; // synthetic heavy learner (local fixture only)
const SIGS = ['public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])'];
const migration = await read(`../migrations/${FILE}`);
const previous = await read(`../migrations/${PREVIOUS}`);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 세 CREATE OR REPLACE 원문(복원 = 옛 파일의 그 셋) · 이 파일의 재게시 블록(복원은 같은 재게시를 되풀이한다).
const blocks = sql => ['public.fsrs_vocabulary_snapshot(p_actor uuid)', 'public.fsrs_vocabulary_snapshot_light(p_actor uuid, p_language text, p_summary boolean)',
  'public.fsrs_vocabulary_snapshot_cards(p_actor uuid, p_ids uuid[])'].map(sig => {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${sig}\n`);
  assert.ok(start >= 0, sig);
  return sql.slice(start, sql.indexOf('END $function$;\n', start) + 'END $function$;\n'.length);
});
const REPIN = migration.slice(migration.indexOf('DO $change$'), migration.indexOf('END $change$;') + 'END $change$;'.length);
const RESTORE = ["SET LOCAL search_path = '';", ...blocks(previous), REPIN].join('\n');

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
  assert.ok(chain.includes(PREVIOUS) && chain.includes('20261104060000_rls_auth_initplan_fingerprinted.sql'), 'chain reaches the production order');

  // 무거운 학습자 D(운영 최대 학습자 모양 · 합성): 1,664단어 — 일본어 1,300 · 중국어 250 · 영어 70 · 한국어 20 · 언어 NULL 14 · 목록 밖(German) 10.
  // base_form: 3의 배수 = 'b'||g(다른 형태) · 3k+1 = '' · 나머지 NULL. 일부 단어는 NFD · 앞뒤 공백.
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [D]); await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [D]);
  await as(D);
  await db.query(`INSERT INTO public.user_vocabulary(id,user_id,language,word_text,base_form)
    SELECT ('40000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, $1,
      CASE WHEN g <= 1300 THEN 'Japanese' WHEN g <= 1550 THEN 'Chinese' WHEN g <= 1620 THEN 'English' WHEN g <= 1640 THEN 'Korean' WHEN g <= 1654 THEN NULL ELSE 'German' END,
      CASE WHEN g % 97 = 0 THEN ' w' || g || 'e' || chr(769) || ' ' ELSE 'w' || g END,
      CASE WHEN g % 3 = 0 THEN CASE WHEN g % 111 = 0 THEN '  b' || g || ' ' ELSE 'b' || g END WHEN g % 3 = 1 THEN '' END
    FROM generate_series(1, 1664) g`, [D]);
  // 아는 단어 241: 7의 배수 · 101k+1 행 — 짝수는 base_form으로(있으면), 홀수는 word_text로(NFD 행은 NFC로 적어 정규화가 맞춰야 한다). 언어 코드는 행 언어대로.
  await db.query(`INSERT INTO public.user_known_words(user_id,lang,word_text)
    SELECT $1, CASE WHEN g <= 1300 THEN 'ja' WHEN g <= 1550 THEN 'zh' WHEN g <= 1620 THEN 'en' ELSE 'ko' END,
      CASE WHEN g % 2 = 0 AND g % 3 = 0 THEN 'b' || g WHEN g % 97 = 0 THEN normalize('w' || g || 'e' || chr(769), NFC) ELSE 'w' || g END
    FROM generate_series(1, 1640) g WHERE g % 7 = 0 OR g % 101 = 1 ORDER BY g LIMIT 241`, [D]);
  await db.exec('SET session_replication_role = replica'); // local fixture only: seed exclusions / FSRS rows without app guards
  // 제외: 카드 id 20개 · retired id 묶음 하나(NULL 섞임) · (언어, base_form 또는 단어) 15개 — 아는 단어 트리거가 만든 제외와 함께.
  await db.query(`INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids)
    SELECT $1, v.language, normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC), v.id, '{}' FROM public.user_vocabulary v
    WHERE v.user_id = $1 AND v.language IS NOT NULL AND v.language <> 'German' ORDER BY v.id OFFSET 5 LIMIT 20 ON CONFLICT DO NOTHING`, [D]);
  await db.query(`INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids)
    SELECT $1, 'Japanese', 'retired-bundle', NULL, array_append(array_agg(v.id), NULL) FROM (SELECT id FROM public.user_vocabulary WHERE user_id = $1 ORDER BY id DESC LIMIT 12) v`, [D]);
  await db.query(`INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id,retired_vocabulary_ids)
    SELECT $1, v.language, normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC), NULL, '{}' FROM public.user_vocabulary v
    WHERE v.user_id = $1 AND v.language IN ('Chinese','English') AND v.id::text LIKE '%5' ORDER BY v.id LIMIT 15 ON CONFLICT DO NOTHING`, [D]);
  // 카드 24장(단어 → 뜻 — 번호 137k · 137k+6): 아는 단어 · 제외 행 몇 장 포함(판정이 등록 칸과 함께 나와야 한다).
  await db.query(`INSERT INTO public.fsrs_cards(card_id,vocabulary_id,user_id,card,attempt)
    SELECT v.id, v.id, $1, $2::jsonb, NULL FROM public.user_vocabulary v WHERE v.user_id = $1 AND ('x' || right(v.id::text, 3))::bit(12)::int % 137 IN (0, 6) ORDER BY v.id LIMIT 24`,
    [D, h.card('2026-10-20T01:02:03.456789Z')]);
  await db.exec('RESET session_replication_role');
  await db.exec('ANALYZE');
  const LEARNERS = [A, B, C, D];
  const counts = await one(`SELECT (SELECT count(*)::int FROM public.user_vocabulary WHERE user_id=$1) words, (SELECT count(*)::int FROM public.user_known_words WHERE user_id=$1) known,
    (SELECT count(*)::int FROM public.vocabulary_exclusions WHERE user_id=$1) exclusions, (SELECT count(*)::int FROM public.fsrs_cards WHERE user_id=$1) cards`, [D]);
  assert.deepEqual([counts.words, counts.known], [1664, 241]);
  assert.ok(counts.exclusions >= 241 + 30 && counts.cards >= 8, JSON.stringify(counts));
  console.log(`SEED heavy learner D ${JSON.stringify(counts)}`);

  const pins = async () => one(`SELECT (SELECT contract_hash FROM fsrs_private.settings) core,(SELECT contract_hash FROM fsrs_private.manual_save_settings) manual,
    (SELECT contract_hash FROM fsrs_private.admission_settings) admission,(SELECT profile_contract_hash FROM fsrs_private.activity_settings) profile,
    (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AND (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash()
    AND (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() AND (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() ok,
    (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash_live() AND (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash_live()
    AND (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash_live() AND (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash_live() live_ok`);
  const capability = async () => one(`SELECT substring(prosrc from 'ready:=live_hash= ''([0-9a-f]{32})''') pinned, oid::int, proacl::text acl, proowner::regrole::text owner,
    prosecdef, proconfig::text config, provolatile, md5(prosrc) body FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`);
  const fingerprint = migration.match(/CREATE FUNCTION pg_temp\.skj_korean_live_hash\(\) RETURNS text [^\n]*\$q\$\n([\s\S]*?)\n\$q\$;/)[1];
  const live = async () => { await db.exec("BEGIN READ ONLY; SET LOCAL search_path='';"); try { return (await one(fingerprint)).md5; } finally { await db.exec('ROLLBACK'); } };
  const allReady = async () => { await as(A); const l = (await one('SELECT public.learning_language_capabilities() v')).v.languages; return Object.keys(l).length > 0 && Object.values(l).every(f => Object.values(f).every(v => v === true)); };
  const fns = async () => (await db.query(`SELECT oid::regprocedure::text sig, md5(prosrc) md5, oid::int, proowner::regrole::text owner, prosecdef, proconfig::text config,
    provolatile, proparallel, proacl::text acl FROM pg_proc WHERE oid = ANY($1::regprocedure[]) ORDER BY 1`, [SIGS])).rows;
  const tempLeft = async () => (await one(`SELECT (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'pg_temp%' AND (p.proname LIKE 'skj\\_%' OR p.proname LIKE 'perf\\_%'))
    + (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp%' AND (c.relname LIKE 'skj\\_%' OR c.relname LIKE 'perf\\_%')) n`)).n;
  // 출력 셋(now 제외): snapshot · light(NULL · 각 언어 · 없는 언어 'French'/'Korean' × 두 모양) · cards(여러 묶음 — 앞 50 · 뒤 50 · 아는 단어/제외 50 · 남의 id · 없는 id) ·
  // 오류(행위자 NULL · 없는 행위자 · light 모양 NULL · cards 요청 모양). 같은 인자로 앞뒤를 부른다.
  const ids = async u => (await db.query('SELECT id FROM public.user_vocabulary WHERE user_id=$1 ORDER BY id', [u])).rows.map(r => r.id);
  const call = async (sql, p) => { try { const { v } = await one(sql, p); assert.ok(v.now, 'now present'); const { now, ...rest } = v; return rest; } catch (e) { return `error ${e.code} ${e.message}`; } };
  const batchesFor = async u => {
    const all = await ids(u), snap = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v;
    const flagged = snap.registry.filter(e => e.known || e.excluded || e.enrolled).map(e => e.cardId);
    const other = (await ids(u === A ? B : A))[0];
    return [all.slice(0, 50), all.slice(-50), flagged.slice(0, 50), flagged.slice(-50), [...flagged.slice(0, 3), other, '99999999-0000-4000-8000-000000000000']].filter(b => b.length);
  };
  const BATCHES = {}; for (const u of LEARNERS) BATCHES[u] = await batchesFor(u);
  const outputs = async () => {
    const out = {};
    for (const u of LEARNERS) {
      const langs = (await db.query('SELECT DISTINCT language l FROM public.user_vocabulary WHERE user_id=$1 ORDER BY 1', [u])).rows.map(r => r.l);
      const o = { snapshot: await call('SELECT public.fsrs_vocabulary_snapshot($1) v', [u]), light: {}, cards: [] };
      for (const l of [null, ...langs.filter(Boolean), 'French', 'Korean']) for (const s of [false, true]) o.light[`${l}|${s}`] = await call('SELECT public.fsrs_vocabulary_snapshot_light($1,$2,$3) v', [u, l, s]);
      for (const b of BATCHES[u]) o.cards.push(await call('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [u, b]));
      out[u] = o;
    }
    const nobody = '00000000-0000-4000-8000-00000000dead';
    out.errors = [
      await call('SELECT public.fsrs_vocabulary_snapshot($1) v', [null]), await call('SELECT public.fsrs_vocabulary_snapshot($1) v', [nobody]),
      await call('SELECT public.fsrs_vocabulary_snapshot_light($1,NULL,NULL) v', [A]), await call('SELECT public.fsrs_vocabulary_snapshot_light($1,NULL,true) v', [nobody]),
      await call("SELECT public.fsrs_vocabulary_snapshot_cards($1,'{}'::uuid[]) v", [A]), await call('SELECT public.fsrs_vocabulary_snapshot_cards($1,NULL) v', [A]),
      await call('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [A, [(await ids(A))[0], null]]),
      await call('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [D, (await ids(D)).slice(0, 51)]),
      await call('SELECT public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[]) v', [nobody, (await ids(A)).slice(0, 2)]),
    ];
    return out;
  };
  // 무거운 학습자 D의 시간(정보용): 중앙값 ms. force_custom_plan = 연결마다 첫 호출(운영 측정과 같은 custom plan), auto = 같은 연결에서 되풀이.
  const timing = async () => {
    const out = {};
    const jaIds = (await ids(D)).slice(0, 50);
    for (const mode of ['force_custom_plan', 'auto']) {
      await db.exec(`SET plan_cache_mode = ${mode}`);
      for (const [name, sql, p] of [['snapshot', 'SELECT length(public.fsrs_vocabulary_snapshot($1)::text) n', [D]],
        ['light all rows', 'SELECT length(public.fsrs_vocabulary_snapshot_light($1,NULL,false)::text) n', [D]],
        ['light Japanese summary', "SELECT length(public.fsrs_vocabulary_snapshot_light($1,'Japanese',true)::text) n", [D]],
        ['cards 50', 'SELECT length(public.fsrs_vocabulary_snapshot_cards($1,$2::uuid[])::text) n', [D, jaIds]]]) {
        const t = [];
        for (let i = 0; i < 9; i++) { const s = performance.now(); await one(sql, p); t.push(performance.now() - s); }
        out[`${name} (${mode})`] = Math.round(t.sort((x, y) => x - y)[4] * 10) / 10;
      }
    }
    await db.exec('RESET plan_cache_mode');
    return out;
  };

  const before = { pins: await pins(), cap: await capability(), live: await live(), fns: await fns(), outputs: await outputs(), time: await timing() };
  assert.equal(before.pins.ok && before.pins.live_ok, true, 'chain state: four contracts consistent');
  assert.equal(before.cap.pinned, before.live, 'chain state: Korean pinned = live');
  assert.equal(await allReady(), true);
  const oldMd5 = Object.fromEntries(before.fns.map(f => [f.sig, f.md5]));
  assert.deepEqual(oldMd5, { 'fsrs_vocabulary_snapshot(uuid)': '32647a452dc4c8a8c5449ab6a93c4eb9', 'fsrs_vocabulary_snapshot_light(uuid,text,boolean)': '32401c0c1e32163215c7edbbf692c7ba',
    'fsrs_vocabulary_snapshot_cards(uuid,uuid[])': 'd33e1c2c65571c80bc4109fc0c5f0dae' }, 'chain bodies = the card-kinds bodies the migration expects');
  const dSnap = before.outputs[D].snapshot;
  const knownD = dSnap.registry.filter(e => e.known).length, excludedOnlyD = dSnap.registry.filter(e => e.excluded && !e.known).length;
  assert.ok(knownD >= 200 && excludedOnlyD >= 20, `D flags: known ${knownD} · excluded-only ${excludedOnlyD}`);
  // 아는 단어가 base_form으로만 맞는 행 · NFD/공백 행이 실제로 known이다(판정이 바뀌면 그 행에서 드러난다).
  const byId = new Map(dSnap.rows.map(r => [r.id, r]));
  assert.ok(dSnap.registry.some(e => e.known && byId.get(e.cardId).base_form?.startsWith('b')), 'known via base_form');
  assert.ok(dSnap.registry.some(e => e.known && /́/.test(byId.get(e.cardId).word_text)), 'known via NFD word_text');
  assert.ok(dSnap.registry.some(e => e.known && e.enrolled) || dSnap.registry.some(e => e.excluded && e.enrolled), 'a flagged card is enrolled');
  assert.ok(typeof before.outputs.errors[0] === 'string' && before.outputs.errors.every(e => typeof e === 'string'), 'error cases raise');

  await check('⓪ 파일 모양 — 한 트랜잭션 · 운영 해시 상수 없음 · 세 본문 = vv + EXISTS(LEFT JOIN kw 없음) · 지문 SELECT = capability 본문 · 임시 객체 DROP', async () => {
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT|START TRANSACTION|ROLLBACK)\s*;/im);
    assert.equal(containsProductionConstants(migration), false, 'no production hash constant — pre-check is pinned == live, post-check recomputes');
    const mine = blocks(migration);
    assert.equal(mine.length, 3);
    for (const b of mine) {
      assert.doesNotMatch(b, /LEFT JOIN kw/);
      assert.match(b, /\n vv AS \(SELECT v\.id, CASE v\.language /);
      assert.match(b, /\(EXISTS\(SELECT 1 FROM kw WHERE kw\.lang=vv\.lc AND kw\.w=vv\.nw\) OR EXISTS\(SELECT 1 FROM kw WHERE kw\.lang=vv\.lc AND kw\.w=vv\.nb\)\) AS is_known,/);
      assert.match(b, /\n {2}JOIN vv ON vv\.id=v\.id\n/);
    }
    const body = (await one("SELECT prosrc FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure")).prosrc;
    assert.equal(body.match(/(WITH RECURSIVE .*FROM objects) INTO live_hash;/s)[1], fingerprint, 'fingerprint SELECT byte-identical to the capability body');
    for (const [, name] of migration.matchAll(/CREATE FUNCTION (pg_temp\.\w+)\(/g)) assert.ok(migration.includes(`DROP FUNCTION ${name}(`), `${name} dropped`);
    for (const [, name] of migration.matchAll(/CREATE TEMP TABLE (\w+)/g)) assert.match(migration, new RegExp(`DROP TABLE [^;]*pg_temp\\.${name}\\b`), `${name} dropped`);
  });

  await check('① 사전 거부 — 검토 밖 본문 · 계약 어긋남 · 한국어 꺼짐이면 RAISE · 아무것도 바뀌지 않음', async () => {
    const same = async () => { assert.deepEqual(await pins(), before.pins); assert.deepEqual(await capability(), before.cap); assert.deepEqual(await fns(), before.fns); assert.equal(await tempLeft(), 0); };
    // 운영이 다른 경로로 본문을 바꾸고 지문까지 재게시해 둔 경우(계약은 맞지만 본문이 검토한 모양이 아님) — 본문 검사가 멈춘다.
    const drift = blocks(previous)[1].replace('-- only the language filter on x,', '-- (drift) only the language filter on x,');
    await db.exec('BEGIN'); await db.exec(`SET LOCAL search_path = '';\n${drift}\n${REPIN}`);
    await assert.rejects(db.exec(migration), e => { assert.match(e.message, /unreviewed function bodies/); return true; });
    await db.exec('ROLLBACK');
    await same();
    await h.expectFail(`UPDATE fsrs_private.manual_save_settings SET contract_hash = md5('drift');\n${migration}`, /learning contracts already drifted/);
    await same();
    // 지문 범위를 건드리고 재게시하지 않은 상태(#1504 모양) — 한국어가 이미 꺼져 있으면 멈춘다.
    await h.expectFail(`CREATE POLICY extra_drift ON public.reading_materials AS RESTRICTIVE FOR SELECT TO anon USING (true);\n${migration}`, /Korean capability not ready before change/);
    await same();
  });

  let after;
  await check('② 적용 — 출력 셋 전원 동일 · 네 핀 = 실측 · core/manual/admission만 재게시 · Korean ready · capability · 속성 · 권한 불변 · 캐시 유효', async () => {
    const notices = [];
    await db.exec('BEGIN'); await db.exec(migration, { onNotice: n => notices.push(n.message) }); await db.exec('COMMIT');
    assert.ok(notices.some(m => /needs change/.test(m)) && notices.some(m => /contracts ok — three bodies rewritten/.test(m)), notices.join('\n'));
    assert.ok(notices.some(m => new RegExp(`${LEARNERS.length} learners — snapshot · light · cards output unchanged`).test(m)), notices.join('\n'));
    for (const m of notices.filter(x => /learners —|snapshot pass|registry_entry =/.test(x))) console.log(`NOTICE ${m}`);
    after = { pins: await pins(), cap: await capability(), live: await live(), fns: await fns() };
    assert.equal(after.pins.ok && after.pins.live_ok, true);
    assert.notEqual(after.pins.core, before.pins.core); assert.notEqual(after.pins.manual, before.pins.manual); assert.notEqual(after.pins.admission, before.pins.admission);
    assert.equal(after.pins.profile, before.pins.profile, 'activity profile is out of scope');
    assert.deepEqual(after.cap, before.cap, 'Korean capability untouched (constant · body · oid · ACL)');
    assert.equal(after.live, before.live);
    assert.equal(await allReady(), true, 'all languages ready via the real RPC');
    const strip = rows => rows.map(({ md5, ...rest }) => rest);
    assert.deepEqual(strip(after.fns), strip(before.fns), 'same oid / owner / SECURITY DEFINER / search_path / STABLE / ACL');
    const want = Object.fromEntries([...migration.matchAll(/^-- (public\.fsrs_vocabulary_snapshot\w*\([^)]*\)): 본문 md5 ([0-9a-f]{32}) → ([0-9a-f]{32})$/gm)].map(m => [m[1].replace('public.', ''), m[3]]));
    assert.deepEqual(Object.fromEntries(after.fns.map(f => [f.sig, f.md5])), want);
    assert.deepEqual(await outputs(), before.outputs, 'snapshot · light · cards · errors byte-identical for every learner');
    const k = await one('SELECT valid, core, manual, admission, profile FROM fsrs_private.contract_cache');
    assert.deepEqual(k, { valid: true, core: after.pins.core, manual: after.pins.manual, admission: after.pins.admission, profile: after.pins.profile });
    assert.equal(await tempLeft(), 0);
    after.time = await timing();
    console.log('TIME heavy learner D (median ms, informational — PGlite):');
    for (const key of Object.keys(before.time)) console.log(`  ${key.padEnd(40)} ${String(before.time[key]).padStart(7)} → ${after.time[key]}`);
  });

  await check('③ 재실행 no-op — 핀 · capability · 본문 그대로', async () => {
    const notices = [];
    await db.exec('BEGIN'); await db.exec(migration, { onNotice: n => notices.push(n.message) }); await db.exec('COMMIT');
    assert.ok(notices.some(m => /already applied .* no-op/.test(m)) && notices.some(m => /contracts ok — already applied, nothing changed/.test(m)), notices.join('\n'));
    assert.deepEqual({ pins: await pins(), cap: await capability(), live: await live(), fns: await fns() }, { pins: after.pins, cap: after.cap, live: after.live, fns: after.fns });
    assert.equal(await allReady(), true);
    assert.equal(await tempLeft(), 0);
  });

  await check('④ 복원(머리 주석의 경로 — 옛 본문 셋 + 같은 재게시) — 옛 md5 · 처음 핀 그대로 · 출력 동일 → 다시 적용', async () => {
    await db.exec('BEGIN'); await db.exec(RESTORE); await db.exec('COMMIT');
    assert.deepEqual(await fns(), before.fns, 'bodies and attributes byte-identical to before');
    assert.deepEqual(await pins(), before.pins, 'pins return to the pre-migration values');
    assert.equal((await capability()).pinned, await live());
    assert.equal(await allReady(), true);
    assert.deepEqual(await outputs(), before.outputs);
    await db.exec('BEGIN'); await db.exec(migration); await db.exec('COMMIT');
    assert.deepEqual(await pins(), after.pins);
    assert.deepEqual(await fns(), after.fns);
    assert.equal(await allReady(), true);
    assert.deepEqual(await outputs(), before.outputs);
  });
  console.log(`PASS snapshot-known-join: ${checks} checks`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
