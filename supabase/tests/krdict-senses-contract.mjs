/** 한국어기초사전 설치 SQL × 운영 학습 계약 카탈로그 검사(PGlite 일회용 DB). 운영 DB에 연결하지 않는다.
 * node supabase/tests/krdict-senses-contract.mjs
 * 기준선(architecture-and-handoff §4.9-1): 10-03 M09 관측 fixture → korean-learning-support.sql →
 * 10-10 M09 운영 학습 계약 fixture(FSRS core·manual·admission·activity, #1399). krdict-senses.mjs(legacy 기준선)가
 * 못 보는 연쇄 — capability 지문 → FSRS core 지문 → fsrs_vocabulary_snapshot — 를 운영 정의 위에서 단언한다.
 * 이 설치 SQL은 지문 범위를 건드리지 않으므로 capability 상수 재게시가 없어야 한다: 상수·본문·FSRS 게시값이
 * 적용·거부·복원 전후 모두 그대로이고, 한국어 학습은 계속 켜져 있어야 한다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
const install = await read('../../docs/sql/krdict-senses.sql');
const rollback = await read('../../docs/sql/krdict-senses-rollback.sql');
const support = await read('../../docs/sql/korean-learning-support.sql');
const contracts = await read('./fixtures/m09-learning-contracts-20261010.sql');
const learningTest = await read('./korean-learning-support.mjs');
const fixtureStart = 'const modernFixtureSql = `';
const modernFixture = learningTest.slice(learningTest.indexOf(fixtureStart) + fixtureStart.length,
  learningTest.indexOf('\n`;\n\nasync function verifyModernCatalog'));
assert.ok(modernFixture.startsWith('-- M09 modern learning catalog fixture') && !modernFixture.includes('${'));

const a = '10000000-0000-0000-0000-000000000001';
const b = '10000000-0000-0000-0000-000000000002';
const tables = ['krdict_releases', 'krdict_senses', 'vocabulary_krdict_senses'];
const READY = { save: true, review: true, known: true, exclude: true };
const PINNED = { core: true, manual: true, admission: true, activity: true };
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const db = new PGlite();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
async function identity(id) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  if (id) await db.exec('SET ROLE authenticated');
}
async function korean() {
  await identity(a);
  const flags = (await rows('SELECT public.learning_language_capabilities() AS r'))[0].r.languages.Korean;
  await identity(null);
  return flags;
}
// FSRS 계약 넷: 게시값 = 실측(korean-source-passage.mjs·learning-contract-catalog.mjs와 같은 질의).
const pins = async () => (await rows(`SELECT
  (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AS core,
  (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() AS manual,
  (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() AS admission,
  (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() AS activity`))[0];
// 게시된 계약 상수 자체(값이 바뀌지 않았다 = 재게시 없음).
const published = async () => (await rows(`SELECT
  (SELECT contract_hash FROM fsrs_private.settings) AS core,
  (SELECT contract_hash FROM fsrs_private.manual_save_settings) AS manual,
  (SELECT contract_hash FROM fsrs_private.admission_settings) AS admission,
  (SELECT profile_contract_hash FROM fsrs_private.activity_settings) AS activity`))[0];
// capability RPC: 상수를 뺀 본문(template)과 게시 상수(published), 정의 전체(FSRS core 지문이 넣는 대상).
const capability = async () => (await rows(`SELECT md5(regexp_replace(prosrc, 'ready:=live_hash= ''[0-9a-f]{32}''', '')) AS template,
  substring(prosrc FROM 'ready:=live_hash= ''([0-9a-f]{32})''') AS published,
  md5(pg_get_functiondef(oid)) AS definition FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`))[0];
async function fsrs() {
  await identity(null);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [a]);
  const { now, ...rest } = (await rows('SELECT public.fsrs_vocabulary_snapshot($1) AS v', [a]))[0].v;
  assert.ok(now);
  await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
  return rest;
}
// 학습 계약 함수 전부(public·fsrs_private)의 본문·속성·권한 — 이 설치 SQL은 함수를 하나도 바꾸지 않는다.
const functions = () => rows(`SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args, md5(p.prosrc) AS body,
  p.proowner, p.proacl::text, p.prosecdef, p.proconfig, p.provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','fsrs_private') ORDER BY 1,2,3`);
const learningRows = async () => ({
  vocabulary: await rows('SELECT * FROM public.user_vocabulary ORDER BY id'),
  contexts: await rows('SELECT * FROM public.vocabulary_contexts ORDER BY id'),
  events: await rows('SELECT * FROM public.review_events ORDER BY created_at,item_key'),
});
const installed = async () => (await rows(`SELECT t, to_regclass('public.'||t) IS NOT NULL AS present,
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)), false) AS rls FROM unnest($1::text[]) t ORDER BY t`, [tables]));
const state = async () => ({ korean: await korean(), pins: await pins(), published: await published(), capability: await capability(),
  fsrs: await fsrs(), functions: await functions(), learning: await learningRows() });

try {
  await db.exec(modernFixture);
  await db.exec(support);
  await db.exec(contracts);
  await db.exec(`INSERT INTO auth.users(id) VALUES('${a}'),('${b}'); INSERT INTO public.profiles(id) VALUES('${a}'),('${b}');`);
  const material = (await rows(`INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json)
    VALUES($1,'private','내 글','파리가 날아요.',$2) RETURNING id`, [a, { status: 'completed', metadata: { language: 'Korean' } }]))[0].id;
  // 한국어 카드 하나를 운영 저장 RPC로 만들어 FSRS snapshot이 빈 목록이 아닌 상태에서 비교한다.
  await identity(a);
  const saved = (await rows('SELECT public.save_vocabulary_context($1,$2,NULL,NULL) AS r', [
    { word_text: '파리', meaning: '날아다니는 작은 곤충.', language: 'Korean' },
    { kind: 'reading', materialId: String(material), quote: '파리가 날아요.', locator: { tokenId: '파리', surface: '파리', sourceRevision: 'r1', start: 0, end: 2 } },
  ]))[0].r;
  await identity(null);
  assert.equal(saved.created, true);

  const before = await state();
  await check('기준선: 운영 계약 카탈로그 위 한국어 학습 all-true, FSRS 계약 넷 게시=실측, snapshot에 한국어 카드가 있다', async () => {
    assert.deepEqual(before.korean, READY);
    assert.deepEqual(before.pins, PINNED);
    assert.ok(before.fsrs.rows.length >= 1);
    assert.deepEqual((await installed()).map(r => r.present), [false, false, false]);
  });

  await db.exec(install);
  await check('설치: krdict 표 3개 생성(RLS 켬) — capability 상수·본문·정의, FSRS 게시값·지문, 함수 전부, snapshot, 학습 행 그대로', async () => {
    assert.deepEqual(await installed(), tables.map(t => ({ t, present: true, rls: true })).sort((x, y) => x.t.localeCompare(y.t)));
    const after = await state();
    assert.deepEqual(after.korean, READY);
    assert.deepEqual(after.pins, PINNED);
    assert.deepEqual(after.published, before.published);
    assert.deepEqual(after.capability, before.capability); // 상수 재게시 없음 — 지문 범위 밖에서만 바꿨다
    assert.deepEqual(after.fsrs, before.fsrs);
    assert.deepEqual(after.functions, before.functions);
    assert.deepEqual(after.learning, before.learning);
  });

  await check('설치 뒤에도 한국어 저장 RPC가 동작하고 FSRS snapshot이 그 카드를 포함한다(트랜잭션 안에서 확인 후 되돌림)', async () => {
    await db.exec('BEGIN');
    await identity(a);
    const next = (await rows('SELECT public.save_vocabulary_context($1,$2,NULL,NULL) AS r', [
      { word_text: '날다', meaning: '공중에 떠서 움직이다.', language: 'Korean' },
      { kind: 'reading', materialId: String(material), quote: '파리가 날아요.', locator: { tokenId: '날아요', surface: '날아요', sourceRevision: 'r1', start: 4, end: 7 } },
    ]))[0].r;
    await identity(null);
    assert.equal(next.created, true);
    assert.equal((await fsrs()).rows.length, before.fsrs.rows.length + 1);
    assert.deepEqual(await pins(), PINNED);
    await db.exec('ROLLBACK');
    assert.deepEqual(await learningRows(), before.learning);
  });

  const installedState = await state();
  await check('재실행은 krdict_already_installed로 전체 중단 — 계약·학습 상태 무변화', async () => {
    await assert.rejects(db.exec(install), /krdict_already_installed/);
    await db.exec('ROLLBACK').catch(() => {});
    const after = await state();
    assert.deepEqual({ ...after, learning: null }, { ...installedState, learning: null });
    assert.deepEqual(after.korean, READY);
    assert.deepEqual(after.pins, PINNED);
  });

  await db.exec(rollback);
  await check('복원: krdict 표만 사라지고 capability·FSRS 계약·함수·snapshot이 설치 전과 같다', async () => {
    assert.deepEqual((await installed()).map(r => r.present), [false, false, false]);
    const after = await state();
    assert.deepEqual(after.korean, READY);
    assert.deepEqual(after.pins, PINNED);
    assert.deepEqual(after.published, before.published);
    assert.deepEqual(after.capability, before.capability);
    assert.deepEqual(after.functions, before.functions);
    assert.deepEqual(after.fsrs, before.fsrs);
  });

  console.log(`krdict-senses-contract: ${checks} checks passed; no live database touched.`);
} finally { await db.close(); }
