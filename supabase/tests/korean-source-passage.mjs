/** Isolated PostgreSQL contract verification for docs/sql/korean-source-passage.sql (KO-PASSAGE-001).
 * Never connects to an external DB. node supabase/tests/korean-source-passage.mjs
 * PGLITE_MODULE may select an already installed local PGlite package.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
const migration = await read('../migrations/20260908060607_source_passage_study.sql');
const apply = await read('../../docs/sql/korean-source-passage.sql');
const rollback = await read('../../docs/sql/korean-source-passage-rollback.sql');
const diagnose = await read('../../docs/sql/korean-source-passage-diagnose.sql');
const a = '10000000-0000-0000-0000-000000000001';
const b = '10000000-0000-0000-0000-000000000002';
const BEFORE = { validate: '043b13610570a95efa49975299a123b2', open: '099b30885e28aa9d888567cade758f39' };
const AFTER = { validate: 'dbae2ddf1a7d5e40b54eb8ed7834e4b8', open: 'ac4f6a7f38a6a51b249acebae485b1a9' };
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 운영 카탈로그(korean-learning-support.mjs의 M09 관측 fixture) + korean-learning-support.sql 적용 상태에서 시작한다 —
// learning_language_capabilities()의 카탈로그 지문이 validate_source_passage() 본문을 포함하므로(r1 운영 FAIL 2026-10-09),
// 최소 스키마로는 그 연동을 검증할 수 없다. open_source_passage는 fixture에 없어 마이그레이션 원문 그대로 더한다.
const learningTest = await read('./korean-learning-support.mjs');
const fixtureStart = 'const modernFixtureSql = `';
const modernFixture = learningTest.slice(learningTest.indexOf(fixtureStart) + fixtureStart.length,
  learningTest.indexOf('\n`;\n\nasync function verifyModernCatalog'));
assert.ok(modernFixture.startsWith('-- M09 modern learning catalog fixture') && !modernFixture.includes('${'));
const support = await read('../../docs/sql/korean-learning-support.sql');
const openRpc = `${migration.match(/CREATE OR REPLACE FUNCTION public\.open_source_passage[\s\S]*?\n\$\$;/)[0]}
REVOKE ALL ON FUNCTION public.open_source_passage(bigint,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_source_passage(bigint,jsonb,text,text) TO authenticated;`;

async function fresh() {
  const db = new PGlite();
  await db.exec(modernFixture);
  await db.exec(`INSERT INTO auth.users VALUES('${a}'),('${b}'); INSERT INTO public.profiles VALUES('${a}'),('${b}');`);
  await db.exec(support);
  await db.exec(openRpc);
  const parents = {};
  for (const [owner, language, body] of [[a, 'Korean', '오늘은 도서관에서 신문을 읽었어요. 내일도 갈 거예요.'],
    [a, 'Japanese', '今日は図書館で新聞を読みました。'], [b, 'Korean', '남의 글이에요. 학교에 가요.']]) {
    const { rows } = await db.query(`INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json)
      VALUES($1,'private','내 글',$2,$3) RETURNING id`, [owner, body,
      { status: 'completed', metadata: { language, importAttempt: `qa-${owner}-${language}`, composer: { version: 1, role: 'source', hasBody: true } } }]);
    parents[`${owner === a ? 'a' : 'b'}:${language}`] = { id: rows[0].id, body };
  }
  return { db, parents };
}
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
async function identity(db, id) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec(`SET ROLE ${id ? 'authenticated' : 'anon'}`);
}
const md5s = async db => Object.fromEntries((await rows(db, `SELECT proname, md5(prosrc) AS h FROM pg_proc
  WHERE oid IN ('public.validate_source_passage()'::regprocedure, 'public.open_source_passage(bigint,jsonb,text,text)'::regprocedure)`))
  .map(r => [r.proname === 'validate_source_passage' ? 'validate' : 'open', r.h]));
// 한국어 학습 capability(저장·복습·아는 단어·제외) — 로그인 사용자로 읽는다.
async function korean(db) {
  await identity(db, a);
  const flags = (await rows(db, 'SELECT public.learning_language_capabilities() AS r'))[0].r.languages.Korean;
  await db.exec('RESET ROLE');
  return flags;
}
const READY = { save: true, review: true, known: true, exclude: true };
const OFF = { save: false, review: false, known: false, exclude: false };
const attrs = async db => rows(db, `SELECT proname, proowner, proacl::text, prosecdef, proconfig, provolatile, proparallel, proisstrict
  FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname`);
const quoteOf = (body, exact) => { const start = Array.from(body).join('').indexOf(exact); return { exact, start, end: start + exact.length, prefix: '', suffix: '' }; };
const sourceOf = (body, exact) => ({ kind: 'body', textVersion: 'plain-v1', quote: quoteOf(body, exact) });
async function open(db, parent, exact, language) {
  return (await rows(db, 'SELECT public.open_source_passage($1,$2,$3,$4) AS r', [parent.id, sourceOf(parent.body, exact), exact, language]))[0].r;
}
const allMaterials = db => rows(db, 'SELECT * FROM public.reading_materials ORDER BY id');

await check('적용 전: 한국어 구간은 RPC(PASSAGE_LANGUAGE)·트리거(PASSAGE_INVALID) 모두 거절 — 마이그레이션 본문 해시가 적용 SQL의 기대값과 같다', async () => {
  const { db, parents } = await fresh();
  assert.deepEqual(await md5s(db), BEFORE);
  assert.deepEqual(await korean(db), READY);
  await identity(db, a);
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서 신문을 읽었어요.', 'Korean'), /PASSAGE_LANGUAGE/);
  await assert.rejects(db.query(`INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json) VALUES($1,'private','t','학교',$2)`,
    [a, { metadata: { language: 'Korean', composer: { version: 1, role: 'study', parentId: String(parents['a:Korean'].id),
      passage: { version: 1, kind: 'body', textVersion: 'plain-v1', manual: true } } } }]), /PASSAGE_INVALID/);
  await db.close();
});

const capability = async db => (await rows(db, `SELECT md5(regexp_replace(prosrc, 'ready:=live_hash= ''[0-9a-f]{32}''', '')) AS template,
  substring(prosrc FROM 'ready:=live_hash= ''([0-9a-f]{32})''') AS published FROM pg_proc WHERE oid='public.learning_language_capabilities()'::regprocedure`))[0];
const triggers = db => rows(db, `SELECT tgname, pg_get_triggerdef(oid) AS def, tgenabled FROM pg_trigger
  WHERE tgrelid='public.reading_materials'::regclass AND NOT tgisinternal ORDER BY tgname`);

await check('적용: 두 함수 본문은 언어 목록 한 줄만, capability RPC는 지문 상수만 바뀌고 한국어 학습은 계속 켜져 있다 — 소유자·권한·속성·트리거·기존 행 그대로', async () => {
  const { db } = await fresh();
  const beforeAttrs = await attrs(db);
  const beforeRows = await allMaterials(db);
  const beforeTriggers = await triggers(db);
  const beforeCap = await capability(db);
  await db.exec(apply);
  assert.deepEqual(await md5s(db), AFTER);
  assert.deepEqual(await korean(db), READY); // r1은 여기서 OFF였다(운영 FAIL 2026-10-09)
  const afterCap = await capability(db);
  assert.equal(afterCap.template, beforeCap.template);
  assert.notEqual(afterCap.published, beforeCap.published);
  assert.deepEqual(await attrs(db), beforeAttrs);
  assert.deepEqual(await allMaterials(db), beforeRows);
  assert.deepEqual(await triggers(db), beforeTriggers);
  await db.exec(apply); // 재실행은 무변화
  assert.deepEqual(await md5s(db), AFTER);
  assert.deepEqual(await capability(db), afterCap);
  assert.deepEqual(await attrs(db), beforeAttrs);
  assert.deepEqual(await korean(db), READY);
  await db.close();
});

await check('이미 어긋난 카탈로그(r1만 적용된 운영 상태 등)는 다시 승인하지 않는다 — 전체 중단, 무변화, 한국어 학습은 꺼진 그대로', async () => {
  const { db } = await fresh();
  // r1: 지문 재게시 없이 트리거 본문만 바꾼 상태를 재현한다.
  await db.exec(`DO $r1$ DECLARE src text; BEGIN
    SELECT replace(prosrc, 'NOT IN (''Japanese'',''Chinese'',''English'',''French'')', 'NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'')')
      INTO src FROM pg_proc WHERE oid='public.validate_source_passage()'::regprocedure;
    EXECUTE format('CREATE OR REPLACE FUNCTION public.validate_source_passage() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS %L', src);
  END $r1$;`);
  assert.deepEqual(await korean(db), OFF);
  const before = { md5: await md5s(db), cap: await capability(db) };
  await assert.rejects(db.exec(apply), /korean_passage_capability_not_ready/);
  await db.exec('ROLLBACK');
  await assert.rejects(db.exec(rollback), /korean_passage_capability_not_ready/);
  await db.exec('ROLLBACK');
  assert.deepEqual({ md5: await md5s(db), cap: await capability(db) }, before);
  assert.deepEqual(await korean(db), OFF);
  // 운영 복구 경로(r1 복원 = 본문만 원래대로): 지문이 게시값으로 돌아와 한국어 학습이 다시 켜지고, 그 뒤 이 파일은 정상 적용된다.
  await db.exec(`DO $r1_restore$ DECLARE src text; BEGIN
    SELECT replace(prosrc, 'NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'')', 'NOT IN (''Japanese'',''Chinese'',''English'',''French'')')
      INTO src FROM pg_proc WHERE oid='public.validate_source_passage()'::regprocedure;
    EXECUTE format('CREATE OR REPLACE FUNCTION public.validate_source_passage() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS %L', src);
  END $r1_restore$;`);
  assert.deepEqual(await md5s(db), BEFORE);
  assert.deepEqual(await korean(db), READY);
  await db.exec(apply);
  assert.deepEqual(await md5s(db), AFTER);
  assert.deepEqual(await korean(db), READY);
  await db.close();
});

await check('capability RPC 본문이 검수한 형태와 다르면 전체 중단, 무변화', async () => {
  const { db } = await fresh();
  const def = (await rows(db, `SELECT pg_get_functiondef('public.learning_language_capabilities()'::regprocedure) AS d`))[0].d;
  await db.exec(def.replace("'save',ready", "'save',ready AND true"));
  const before = { md5: await md5s(db), cap: await capability(db) };
  await assert.rejects(db.exec(apply), /korean_passage_unexpected_capability_body/);
  await db.exec('ROLLBACK');
  assert.deepEqual({ md5: await md5s(db), cap: await capability(db) }, before);
  await db.close();
});

await check('적용 후: 내 한국어 글의 구간은 한국어 학습 행으로 열리고, 같은 요청은 같은 행을 돌려준다', async () => {
  const { db, parents } = await fresh();
  await db.exec(apply);
  await identity(db, a);
  const exact = '도서관에서 신문을 읽었어요.';
  const study = await open(db, parents['a:Korean'], exact, 'Korean');
  assert.equal(study.raw_text, exact);
  assert.equal(study.visibility, 'private');
  assert.equal(study.processed_json.metadata.language, 'Korean');
  assert.equal(study.processed_json.metadata.composer.role, 'study');
  assert.equal(study.processed_json.metadata.composer.parentId, String(parents['a:Korean'].id));
  assert.equal((await open(db, parents['a:Korean'], exact, 'Korean')).id, study.id);
  await db.close();
});

await check('적용 후에도 기존 경계는 그대로: 네 언어 정상, 목록 밖 언어·남의 글·익명은 거절', async () => {
  const { db, parents } = await fresh();
  await db.exec(apply);
  await identity(db, a);
  const ja = await open(db, parents['a:Japanese'], '図書館で新聞を読みました。', 'Japanese');
  assert.equal(ja.processed_json.metadata.language, 'Japanese');
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서', 'Spanish'), /PASSAGE_LANGUAGE/);
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서', 'korean'), /PASSAGE_LANGUAGE/);
  await assert.rejects(open(db, parents['b:Korean'], '학교에 가요.', 'Korean'), /PASSAGE_ACCESS/);
  await identity(db, null);
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서', 'Korean'), /permission denied/);
  await db.close();
});

await check('운영 본문이 예상과 다르면 트랜잭션 전체가 중단되고 아무것도 바뀌지 않는다', async () => {
  const { db } = await fresh();
  const altered = migration.match(/CREATE OR REPLACE FUNCTION public\.open_source_passage[\s\S]*?\n\$\$;/)[0]
    .replace("RAISE EXCEPTION 'PASSAGE_LENGTH'", "RAISE EXCEPTION 'PASSAGE_LENGTH_X'");
  await db.exec(altered);
  const before = await md5s(db);
  assert.notEqual(before.open, BEFORE.open);
  await assert.rejects(db.exec(apply), /korean_passage_unexpected_body/);
  await db.exec('ROLLBACK');
  assert.deepEqual(await md5s(db), before); // 앞 순서인 validate도 바뀌지 않았다
  await db.close();
});

await check('복원: 원래 본문 해시로 돌아가고, 이미 만든 한국어 구간 행은 남으며 새 한국어 구간만 다시 거절', async () => {
  const { db, parents } = await fresh();
  const beforeAttrs = await attrs(db);
  const beforeCap = await capability(db);
  await db.exec(apply);
  await identity(db, a);
  await open(db, parents['a:Korean'], '내일도 갈 거예요.', 'Korean');
  await db.exec('RESET ROLE');
  const kept = await allMaterials(db);
  await db.exec(rollback);
  assert.deepEqual(await md5s(db), BEFORE);
  assert.deepEqual(await korean(db), READY);
  assert.equal((await capability(db)).template, beforeCap.template);
  assert.deepEqual(await attrs(db), beforeAttrs);
  assert.deepEqual(await allMaterials(db), kept);
  await identity(db, a);
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서 신문을 읽었어요.', 'Korean'), /PASSAGE_LANGUAGE/);
  await db.exec('RESET ROLE');
  await db.exec(rollback); // 재실행은 무변화
  assert.deepEqual(await md5s(db), BEFORE);
  assert.deepEqual(await korean(db), READY);
  await db.close();
});

await check('진단 SQL: 적용 블록은 적용 파일과 바이트 동일, 두 역할의 응답·지문을 남기고 ROLLBACK — 아무것도 바뀌지 않는다', async () => {
  const block = sql => sql.slice(sql.indexOf('DO $apply$'), sql.indexOf('$apply$;\n', sql.indexOf('DO $apply$') + 10));
  assert.equal(block(diagnose), block(apply));
  assert.ok(diagnose.trimEnd().endsWith('ROLLBACK;') && !/^\s*COMMIT\s*;/m.test(diagnose));
  const { db } = await fresh();
  const before = { md5: await md5s(db), cap: await capability(db), attrs: await attrs(db), rows: await allMaterials(db) };
  const out = (await db.exec(diagnose)).filter(r => r.rows.length).map(r => r.rows);
  const answers = out.find(rs => rs[0]?.answer);
  assert.equal(answers.length, 4);
  for (const a of answers) assert.deepEqual(JSON.parse(a.answer).languages.Korean, READY);
  assert.deepEqual(out.find(rs => rs[0]?.before_h)?.map(r => r.key).length, 1); // r2가 바꾸는 키는 트리거 함수 하나
  assert.deepEqual({ md5: await md5s(db), cap: await capability(db), attrs: await attrs(db), rows: await allMaterials(db) }, before);
  assert.deepEqual(await korean(db), READY);
  await db.close();
});

console.log(`korean-source-passage: ${checks} checks passed`);
