/** Isolated PostgreSQL verification; no network or live DB connection (CANON-SERVER-ANALYSIS-001).
 * 서버 분석 작업 표: 관리자는 자기 작업만 읽고, 처음 상태로만 시작하고, 멈추기만 한다. 도는 작업은 한 사람당 하나.
 * 저장 함수: service role만 · 작업이 도는(또는 막 멈춘) 중 · 작업 관리자 소유 · 작업 책 key · 비공개 장일 때만, 뷰어 저장과 같은 비교 저장.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/canonical-analysis-jobs.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const MIGRATION = new URL('../migrations/20261024120000_canonical_analysis_jobs.sql', import.meta.url);
const admin = '10000000-0000-0000-0000-000000000001', admin2 = '10000000-0000-0000-0000-000000000002', reader = '10000000-0000-0000-0000-000000000003';
const ATTEMPT = '20000000-0000-0000-0000-000000000001';
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const pending = (key, order) => ({ status: 'pending', metadata: { book: { key, order } } });
const analyzed = (key, order, revision = ATTEMPT) => ({ status: 'completed', sequence: ['id_0_0'], dictionary: { id_0_0: { text: 'x' } }, metadata: { book: { key, order }, viewerRevision: revision } });

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table profiles(id uuid primary key, role text default 'user');
create function public.is_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
grant execute on function public.is_admin() to anon, authenticated;
create table reading_materials(id bigint primary key, title text, raw_text text, processed_json jsonb, visibility text default 'private', owner_id uuid);
alter table reading_materials enable row level security;
grant all on reading_materials to anon, authenticated;
insert into auth.users values ('${admin}'),('${admin2}'),('${reader}');
insert into profiles values ('${admin}','admin'),('${admin2}','admin'),('${reader}','user');`);
const as = async (role, user = '') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]); await db.exec(`set role ${role}`); };
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const rejects = async (sql, params, pattern) => assert.rejects(() => db.query(sql, params), pattern);
const save = (job, id, expectedRaw, expectedJson, raw, json, attempt = ATTEMPT) => db.query(
  'select canonical_analysis_save($1,$2,$3,$4,$5,$6,$7) as result', [job, id, expectedRaw, JSON.stringify(expectedJson), raw, JSON.stringify(json), attempt]);

try {
  await db.query(`insert into reading_materials(id,title,raw_text,processed_json,visibility,owner_id) values
    (11,'라쇼몬 1','原文一',$1,'private','${admin}'),
    (12,'라쇼몬 2','原文二',$2,'public','${admin}'),
    (21,'다른 책 1','原文',$3,'private','${admin}'),
    (31,'남의 장','原文',$4,'private','${admin2}')`,
  [JSON.stringify(pending('aozora-rashomon', 1)), JSON.stringify(pending('aozora-rashomon', 2)), JSON.stringify(pending('aozora-other', 1)), JSON.stringify(pending('aozora-rashomon', 1))]);
  const sql = await fs.readFile(MIGRATION, 'utf8');
  await db.exec(sql);
  await db.exec(sql); // 재실행 안전

  let job;
  await check('an admin starts a job only in its first state, as themself', async () => {
    await as('authenticated', admin);
    [{ id: job }] = await rows(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'literature', '{aozora-rashomon}') returning id`);
    await rejects(`insert into canonical_analysis_jobs(owner_id, kind, book_keys, chapters_done) values ('${admin2}', 'literature', '{x}', 0)`, [], /row-level security/);
    await as('authenticated', admin2);
    await rejects(`insert into canonical_analysis_jobs(owner_id, kind, book_keys, chapters_done) values ('${admin2}', 'literature', '{x}', 5)`, [], /row-level security/);
    await rejects(`insert into canonical_analysis_jobs(owner_id, kind, book_keys, lease_until) values ('${admin2}', 'literature', '{x}', now())`, [], /row-level security/);
    await as('authenticated', reader);
    await rejects(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${reader}', 'literature', '{x}')`, [], /row-level security/);
    await as('anon');
    await rejects(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'literature', '{x}')`, [], /permission denied/);
  });
  await check('one running job per admin', async () => {
    await as('authenticated', admin);
    await rejects(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'art', '{art-x}')`, [], /duplicate key|unique/);
  });
  await check('admins read only their own jobs; others and guests read none', async () => {
    await as('authenticated', admin);
    assert.deepEqual((await rows('select id, status from canonical_analysis_jobs')).map((row) => row.id), [job]);
    await as('authenticated', admin2);
    assert.equal((await rows('select * from canonical_analysis_jobs')).length, 0);
    await as('authenticated', reader);
    assert.equal((await rows('select * from canonical_analysis_jobs')).length, 0);
    await as('anon');
    await rejects('select * from canonical_analysis_jobs', [], /permission denied/);
  });
  await check('only the server role (not admins) runs the save function', async () => {
    await as('authenticated', admin);
    await rejects('select canonical_analysis_save(1,11,$1,$2,$1,$2,$3)', ['原文一', JSON.stringify(pending('aozora-rashomon', 1)), ATTEMPT], /permission denied/);
    await as('anon');
    await rejects('select canonical_analysis_save(1,11,$1,$2,$1,$2,$3)', ['原文一', JSON.stringify(pending('aozora-rashomon', 1)), ATTEMPT], /permission denied/);
  });
  await check('the server saves a private chapter of the job book (compare-and-swap like the viewer save)', async () => {
    await as('service_role');
    const before = pending('aozora-rashomon', 1), after = analyzed('aozora-rashomon', 1);
    await rejects('select canonical_analysis_save($1,11,$2,$3,$2,$4,$5)', [job, '原文一', JSON.stringify({ ...before, status: 'analyzing' }), JSON.stringify(after), ATTEMPT], /바뀌었어요/);
    const [{ result }] = (await save(job, 11, '原文一', before, '原文一', after)).rows;
    assert.equal(result.material.processed_json.status, 'completed');
    // 응답 유실 뒤 같은 시도 재전송은 성공(두 번 쓰지 않는다)
    assert.equal((await save(job, 11, '原文一', before, '原文一', after)).rows[0].result.material.id, 11);
    await rejects('select canonical_analysis_save($1,11,$2,$3,$2,$4,$5)', [job, '原文一', JSON.stringify(after), JSON.stringify({ ...after, metadata: { ...after.metadata, viewerRevision: 'x' } }), '20000000-0000-0000-0000-000000000002'], /확인하지 못했어요/);
  });
  await check('the server never writes a public chapter, another book, or another owner\'s chapter', async () => {
    await as('service_role');
    await rejects('select canonical_analysis_save($1,12,$2,$3,$2,$4,$5)', [job, '原文二', JSON.stringify(pending('aozora-rashomon', 2)), JSON.stringify(analyzed('aozora-rashomon', 2)), ATTEMPT], /비공개 장이 아니에요/);
    await rejects('select canonical_analysis_save($1,21,$2,$3,$2,$4,$5)', [job, '原文', JSON.stringify(pending('aozora-other', 1)), JSON.stringify(analyzed('aozora-other', 1)), ATTEMPT], /비공개 장이 아니에요/);
    await rejects('select canonical_analysis_save($1,31,$2,$3,$2,$4,$5)', [job, '原文', JSON.stringify(pending('aozora-rashomon', 1)), JSON.stringify(analyzed('aozora-rashomon', 1)), ATTEMPT], /비공개 장이 아니에요/);
  });
  await check('an admin can only pause (not finish, reset progress, or touch the lease)', async () => {
    await as('authenticated', admin);
    await rejects(`update canonical_analysis_jobs set chapters_done = 9 where id = ${job}`, [], /permission denied/);
    await rejects(`update canonical_analysis_jobs set lease_until = now() where id = ${job}`, [], /permission denied/);
    await rejects(`update canonical_analysis_jobs set status = 'done' where id = ${job}`, [], /row-level security/);
    assert.equal((await rows(`update canonical_analysis_jobs set status = 'paused', updated_at = now() where id = ${job} returning status`))[0].status, 'paused');
    // 멈춘 작업을 관리자가 다시 돌리지는 못한다(새 작업으로 시작 — 시도 수가 새로 센다)
    assert.equal((await rows(`update canonical_analysis_jobs set status = 'running' where id = ${job} returning id`)).length, 0);
    const [{ id: next }] = await rows(`insert into canonical_analysis_jobs(owner_id, kind, book_keys) values ('${admin}', 'literature', '{aozora-rashomon}') returning id`);
    assert.ok(next > job);
  });
  await check('a paused job still saves the chapter it was finishing; a finished job saves nothing', async () => {
    await db.exec('reset role');
    await db.query(`update reading_materials set processed_json = $1 where id = 21`, [JSON.stringify(pending('aozora-other', 1))]);
    const [{ id: paused }] = await rows(`insert into canonical_analysis_jobs(owner_id, kind, book_keys, status) values ('${admin}', 'literature', '{aozora-other}', 'paused') returning id`);
    const [{ id: done }] = await rows(`insert into canonical_analysis_jobs(owner_id, kind, book_keys, status) values ('${admin}', 'literature', '{aozora-other}', 'done') returning id`);
    await as('service_role');
    await rejects('select canonical_analysis_save($1,21,$2,$3,$2,$4,$5)', [done, '原文', JSON.stringify(pending('aozora-other', 1)), JSON.stringify(analyzed('aozora-other', 1)), ATTEMPT], /작업이 끝났어요/);
    assert.equal((await save(paused, 21, '原文', pending('aozora-other', 1), '原文', analyzed('aozora-other', 1))).rows[0].result.material.id, 21);
  });
  await check('function runs as definer with a fixed search_path', async () => {
    await db.exec('reset role');
    const [fn] = await rows("select prosecdef, proconfig from pg_proc where proname = 'canonical_analysis_save'");
    assert.deepEqual(fn, { prosecdef: true, proconfig: ['search_path=pg_catalog, public'] });
  });

  console.log(`canonical-analysis-jobs: ${checks} checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
