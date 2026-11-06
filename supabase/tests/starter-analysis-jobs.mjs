/** Isolated PostgreSQL verification; no network or live DB connection (STARTER-ANALYSIS-001 · 2026-11-06 KST).
 * 20261106190000_starter_analysis_jobs: 서버 분석 작업에 공개 시드(starter) 종류.
 * 증명: ① 작업 한 줄이 관리자 「일괄 분석」 패널과 같은 대상(공개 · idle/pending/saved · 원문 있음 · 수업 팀 · 정본 책 아님 · 일 · 영)을 id 차례로 고른다
 *       ② 저장 함수: starter 작업은 그 작업의 material_ids 안 · 관리자 소유 · 공개 자료만, 책 작업은 그대로 비공개 장만 · service role만
 *       ③ CHECK: starter = 책 key 비움 + material_ids 1~200, 책 = material_ids 없음 ④ 재실행은 두 번째 작업을 만들지 않는다
 *       ⑤ 관리자에게 도는 작업이 있으면 만들지 않는다 ⑥ 복원 SQL
 *   node supabase/tests/starter-analysis-jobs.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const BASE = await fs.readFile(new URL('../migrations/20261024120000_canonical_analysis_jobs.sql', import.meta.url), 'utf8');
const MIGRATION = await fs.readFile(new URL('../migrations/20261106190000_starter_analysis_jobs.sql', import.meta.url), 'utf8');
const ROLLBACK = await fs.readFile(new URL('../../docs/sql/starter-analysis-jobs-20261106-rollback.sql', import.meta.url), 'utf8');
const admin = '10000000-0000-0000-0000-000000000001';
const ATTEMPT = '20000000-0000-0000-0000-000000000001';
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const meta = (language, extra = {}) => ({ language, ...extra });
const pj = (status, metadata) => JSON.stringify({ status, sequence: [], dictionary: {}, metadata });
const analyzed = (language) => ({ status: 'completed', sequence: ['id_0_0'], dictionary: { id_0_0: { text: 'x' } }, metadata: { language, viewerRevision: ATTEMPT } });

async function fresh({ runningJob = false } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table profiles(id uuid primary key, role text default 'user');
    create function public.is_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
    grant execute on function public.is_admin() to anon, authenticated;
    create table reading_materials(id bigint primary key, title text, raw_text text, processed_json jsonb, visibility text default 'private', owner_id uuid);
    insert into auth.users values ('${admin}'); insert into profiles values ('${admin}','admin');`);
  await db.exec(BASE);
  await db.query(`insert into reading_materials(id,title,raw_text,processed_json,visibility,owner_id) values
    (50,'ja seed','本文です。',$1,'public','${admin}'),
    (113,'en seed','Hello there.',$2,'public','${admin}'),
    (60,'ja pending','本文。',$3,'public','${admin}'),
    (70,'zh seed','你好。',$4,'public','${admin}'),
    (80,'team root','x',$5,'public','${admin}'),
    (90,'book chapter','x',$6,'public','${admin}'),
    (95,'done seed','x',$7,'public','${admin}'),
    (96,'empty seed','  ',$8,'public','${admin}'),
    (97,'private idle','x',$9,'private','${admin}')`,
    [pj('idle', meta('Japanese')), pj('idle', meta('English')), pj('pending', meta('Japanese')), pj('idle', meta('Chinese')),
     pj('idle', meta('Japanese', { team: { key: 't1', root: true } })), pj('idle', meta('Japanese', { book: { key: 'aozora-x', order: 1 } })),
     JSON.stringify(analyzed('Japanese')), pj('idle', meta('English')), pj('idle', meta('Japanese'))]);
  if (runningJob) await db.exec(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'literature', '{aozora-x}')`);
  return db;
}
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const save = (db, job, id, expectedRaw, expectedJson, raw, json) => db.query(
  'select canonical_analysis_save($1,$2,$3,$4,$5,$6,$7) as result', [job, id, expectedRaw, JSON.stringify(expectedJson), raw, JSON.stringify(json), ATTEMPT]);

const db = await fresh();
await db.exec(MIGRATION);
const [job] = await rows(db, `select id, kind, book_keys, material_ids, status, llm_usage from canonical_analysis_jobs where kind = 'starter'`);

await check('① 작업 한 줄 — 패널과 같은 대상(공개 · 분석 전 · 원문 · 팀/책 아님 · 일 · 영)을 id 차례로', async () => {
  assert.ok(job, 'starter job created');
  assert.deepEqual(job.material_ids.map(Number), [50, 60, 113]);
  assert.deepEqual(job.book_keys, []);
  assert.equal(job.status, 'running');
  assert.deepEqual(job.llm_usage, {});
});

await check('② 저장 — starter는 목록 안 공개 자료만 · 목록 밖 · 비공개 · 다른 작업 종류는 거절', async () => {
  const [m] = await rows(db, 'select raw_text, processed_json from reading_materials where id = 50');
  const r = await save(db, job.id, 50, m.raw_text, m.processed_json, m.raw_text, analyzed('Japanese'));
  assert.equal(r.rows[0].result.material.id, 50);
  assert.equal((await rows(db, `select processed_json->>'status' s from reading_materials where id = 50`))[0].s, 'completed');
  for (const id of [70, 97]) {
    const [x] = await rows(db, 'select raw_text, processed_json from reading_materials where id = $1', [id]);
    await assert.rejects(save(db, job.id, id, x.raw_text, x.processed_json, x.raw_text, analyzed('Japanese')), e => e.code === '42501', `id ${id} refused`);
  }
  // 책 작업은 공개 자료를 쓰지 못한다(그대로).
  await db.exec(`update canonical_analysis_jobs set status = 'paused' where id = ${job.id}`);
  const [book] = await rows(db, `insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'literature', '{aozora-x}') returning id`);
  const [c] = await rows(db, 'select raw_text, processed_json from reading_materials where id = 90');
  await assert.rejects(save(db, book.id, 90, c.raw_text, c.processed_json, c.raw_text, analyzed('Japanese')), /비공개 장이 아니에요/);
  await db.exec(`delete from canonical_analysis_jobs where id = ${book.id}; update canonical_analysis_jobs set status = 'running' where id = ${job.id}`);
  const priv = (await rows(db, `select has_function_privilege('anon','canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid)','execute') a,
    has_function_privilege('authenticated','canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid)','execute') b,
    has_function_privilege('service_role','canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid)','execute') c`))[0];
  assert.deepEqual({ ...priv }, { a: false, b: false, c: true });
});

await check('③ CHECK — starter는 책 key 비움 + material_ids 1~200 · 책은 material_ids 없음', async () => {
  await db.exec(`update canonical_analysis_jobs set status = 'paused' where id = ${job.id}`);
  for (const sql of [
    `insert into canonical_analysis_jobs(owner_id, kind, book_keys, material_ids) values ('${admin}', 'starter', '{a}', '{1}')`,
    `insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'starter', '{}')`,
    `insert into canonical_analysis_jobs(owner_id, kind, book_keys, material_ids) values ('${admin}', 'starter', '{}', '{}')`,
    `insert into canonical_analysis_jobs(owner_id, kind, book_keys, material_ids) values ('${admin}', 'literature', '{a}', '{1}')`,
    `insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'bogus', '{a}')`,
  ]) await assert.rejects(db.query(sql), e => e.code === '23514', sql);
  await db.exec(`update canonical_analysis_jobs set status = 'running' where id = ${job.id}`);
});

await check('④ 재실행 — 두 번째 작업을 만들지 않는다(표 · 함수는 그대로 다시)', async () => {
  await db.exec(MIGRATION);
  assert.equal((await rows(db, `select count(*)::int n from canonical_analysis_jobs where kind = 'starter'`))[0].n, 1);
});

await check('⑤ 관리자에게 도는 작업이 있으면 만들지 않는다', async () => {
  const db2 = await fresh({ runningJob: true });
  await db2.exec(MIGRATION);
  assert.equal((await rows(db2, `select count(*)::int n from canonical_analysis_jobs where kind = 'starter'`))[0].n, 0);
  await db2.close();
});

await check('⑥ 복원 SQL — starter 줄 삭제 · 제약 · 열 · 함수 되돌림(저장한 분석은 그대로)', async () => {
  await db.exec(ROLLBACK);
  const cols = (await rows(db, `select column_name from information_schema.columns where table_name = 'canonical_analysis_jobs' and column_name in ('material_ids','llm_usage')`)).length;
  assert.equal(cols, 0);
  assert.equal((await rows(db, `select count(*)::int n from canonical_analysis_jobs`))[0].n, 0);
  await assert.rejects(db.query(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'starter', '{a}')`), e => e.code === '23514');
  assert.equal((await rows(db, `select processed_json->>'status' s from reading_materials where id = 50`))[0].s, 'completed');
});

await db.close();
console.log(`starter-analysis-jobs: ${checks} checks passed`);
