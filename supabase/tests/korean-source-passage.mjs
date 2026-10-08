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
const a = '10000000-0000-0000-0000-000000000001';
const b = '10000000-0000-0000-0000-000000000002';
const BEFORE = { validate: '043b13610570a95efa49975299a123b2', open: '099b30885e28aa9d888567cade758f39' };
const AFTER = { validate: 'dbae2ddf1a7d5e40b54eb8ed7834e4b8', open: 'ac4f6a7f38a6a51b249acebae485b1a9' };
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

async function fresh() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  CREATE TABLE public.reading_materials(id bigserial PRIMARY KEY, owner_id uuid, visibility text, title text,
    raw_text text, processed_json jsonb, document_json jsonb);
  ALTER TABLE public.reading_materials ENABLE ROW LEVEL SECURITY;
  CREATE POLICY owner_rows ON public.reading_materials FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  GRANT SELECT, INSERT, UPDATE ON public.reading_materials TO authenticated;
  GRANT USAGE ON SEQUENCE public.reading_materials_id_seq TO authenticated;`);
  await db.exec(migration);
  const parents = {};
  for (const [owner, language, body] of [[a, 'Korean', '오늘은 도서관에서 신문을 읽었어요. 내일도 갈 거예요.'],
    [a, 'Japanese', '今日は図書館で新聞を読みました。'], [b, 'Korean', '남의 글이에요. 학교에 가요.']]) {
    const { rows } = await db.query(`INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json)
      VALUES($1,'private','내 글',$2,$3) RETURNING id`, [owner, body,
      { status: 'completed', metadata: { language, composer: { version: 1, role: 'source', hasBody: true } } }]);
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
  await identity(db, a);
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서 신문을 읽었어요.', 'Korean'), /PASSAGE_LANGUAGE/);
  await assert.rejects(db.query(`INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json) VALUES($1,'private','t','학교',$2)`,
    [a, { metadata: { language: 'Korean', composer: { version: 1, role: 'study', parentId: String(parents['a:Korean'].id),
      passage: { version: 1, kind: 'body', textVersion: 'plain-v1', manual: true } } } }]), /PASSAGE_INVALID/);
  await db.close();
});

await check('적용: 두 함수 본문은 언어 목록 한 줄만 바뀌고 소유자·권한·속성·트리거와 기존 행은 그대로', async () => {
  const { db } = await fresh();
  const beforeAttrs = await attrs(db);
  const beforeRows = await allMaterials(db);
  await db.exec(apply);
  assert.deepEqual(await md5s(db), AFTER);
  assert.deepEqual(await attrs(db), beforeAttrs);
  assert.deepEqual(await allMaterials(db), beforeRows);
  const [{ n }] = await rows(db, `SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='public.reading_materials'::regclass AND NOT tgisinternal`);
  assert.equal(n, 2);
  await db.exec(apply); // 재실행은 무변화
  assert.deepEqual(await md5s(db), AFTER);
  assert.deepEqual(await attrs(db), beforeAttrs);
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
  await db.exec(apply);
  await identity(db, a);
  await open(db, parents['a:Korean'], '내일도 갈 거예요.', 'Korean');
  await db.exec('RESET ROLE');
  const kept = await allMaterials(db);
  await db.exec(rollback);
  assert.deepEqual(await md5s(db), BEFORE);
  assert.deepEqual(await attrs(db), beforeAttrs);
  assert.deepEqual(await allMaterials(db), kept);
  await identity(db, a);
  await assert.rejects(open(db, parents['a:Korean'], '도서관에서 신문을 읽었어요.', 'Korean'), /PASSAGE_LANGUAGE/);
  await db.exec('RESET ROLE');
  await db.exec(rollback); // 재실행은 무변화
  assert.deepEqual(await md5s(db), BEFORE);
  await db.close();
});

console.log(`korean-source-passage: ${checks} checks passed`);
