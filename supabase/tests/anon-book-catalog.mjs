/** Isolated PostgreSQL verification; no network or live DB connection (BOOK-GUEST-GATE-1).
 * 비로그인(anon)은 책 장을 읽지 못하고, 목록용 함수는 메타만 돌려준다. 로그인 사용자 · 낱개 공개 글은 무변경.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/anon-book-catalog.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const admin = '10000000-0000-0000-0000-000000000001', reader = '10000000-0000-0000-0000-000000000002';
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function identity(user) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']); await db.exec(`set role ${user ? 'authenticated' : 'anon'}`); }
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const chapter = (key, order, extra = {}) => JSON.stringify({
  status: 'completed', last_idx: 3, sequence: ['t0', 't1'], dictionary: { t0: { text: 'Alice', meaning: '앨리스' } },
  metadata: { language: 'English', level: 'B1 중급', book: { key, title: 'Alice', order, total: 2 },
    literature: { provider: 'standardebooks', author: 'Lewis Carroll' }, viewerBoundaries: { edits: [{ line: 0, start: 0, end: 5 }] },
    literatureReview: { reviewedAt: '2026-10-16T00:00:00Z' }, ...extra },
});
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create function public.is_admin() returns boolean language sql stable as $$ select false $$;
  create table reading_materials(id bigint primary key, title text, raw_text text, processed_json jsonb, created_at timestamptz default now(), visibility text default 'private', owner_id uuid);
  alter table reading_materials enable row level security;
  -- 운영 정책 그대로(m09 스냅샷): anon 전부 허용(옛 정책) + 공개·본인 허용 + 공개·본인·관리자 제한 정책
  create policy "Enable Read for All" on reading_materials for select to anon using (true);
  create policy "Users can read public or own materials" on reading_materials for select using ((visibility = 'public') or (owner_id = auth.uid()));
  create policy learning_material_visibility_guard on reading_materials as restrictive for select to anon, authenticated using ((visibility = 'public') or (owner_id = (select auth.uid())) or (select is_admin()));
  grant all on reading_materials to anon, authenticated;
  insert into auth.users values ('${admin}'),('${reader}');`);
  await db.query(`insert into reading_materials(id,title,raw_text,processed_json,created_at,visibility,owner_id) values
    (1,'Alice — I','Alice was beginning to get very tired',$1,'2026-10-16T01:00:00Z','public',$5),
    (2,'Alice — II','Curiouser and curiouser!',$2,'2026-10-16T02:00:00Z','public',$5),
    (3,'Holmes — I','To Sherlock Holmes she is always the woman.',$3,'2026-10-16T03:00:00Z','private',$5),
    (4,'공개 낱개 글','A short public article.','{"status":"completed","sequence":["a"],"dictionary":{"a":{}},"metadata":{"language":"English"}}','2026-10-16T04:00:00Z','public',$6),
    (5,'빈 책 키','Empty key is not a book.',$4,'2026-10-16T05:00:00Z','public',$6)`,
  [chapter('se-alice', 1), chapter('se-alice', 2), chapter('se-holmes', 1), chapter('', 1)].concat([admin, reader]));
  await db.exec(await fs.readFile(new URL('../migrations/20261016150000_anon_book_catalog.sql', import.meta.url), 'utf8'));
  // 재실행 안전 — 같은 파일을 한 번 더 적용해도 깨지지 않는다
  await db.exec(await fs.readFile(new URL('../migrations/20261016150000_anon_book_catalog.sql', import.meta.url), 'utf8'));

  await check('anon cannot read book chapters even when public (only non-book public rows)', async () => {
    await identity(null);
    assert.deepEqual((await rows('select id from reading_materials order by id')).map((r) => r.id), [4, 5]);
    assert.equal((await rows("select id from reading_materials where id=1")).length, 0);
  });
  await check('logged-in reader still reads public book chapters with full content', async () => {
    await identity(reader);
    const found = await rows('select id, raw_text, processed_json from reading_materials order by id');
    assert.deepEqual(found.map((r) => r.id), [1, 2, 4, 5]);
    assert.equal(found[0].raw_text, 'Alice was beginning to get very tired');
    assert.deepEqual(found[0].processed_json.sequence, ['t0', 't1']);
  });
  await check('owner still reads own private book chapter', async () => {
    await identity(admin);
    assert.deepEqual((await rows('select id from reading_materials order by id')).map((r) => r.id), [1, 2, 3, 4, 5]);
  });
  await check('anon catalog lists public book chapters, newest first, metadata only', async () => {
    await identity(null);
    const list = await rows('select * from public_book_catalog()');
    assert.deepEqual(list.map((r) => r.id), [2, 1]);
    const [row] = list;
    assert.deepEqual(Object.keys(row).sort(), ['created_at', 'id', 'owner_id', 'processed_json', 'title', 'visibility']);
    assert.deepEqual(Object.keys(row.processed_json).sort(), ['metadata', 'status']);
    assert.deepEqual(Object.keys(row.processed_json.metadata).sort(), ['book', 'language', 'level', 'literature']);
    assert.equal(row.processed_json.status, 'completed');
    assert.deepEqual(row.processed_json.metadata.book, { key: 'se-alice', title: 'Alice', order: 2, total: 2 });
    assert.equal(row.processed_json.metadata.literature.provider, 'standardebooks');
    const text = JSON.stringify(list);
    for (const leaked of ['Curiouser', 'Alice was beginning', 'sequence', 'dictionary', '앨리스', 'viewerBoundaries', 'literatureReview']) {
      assert.equal(text.includes(leaked), false, `catalog leaks ${leaked}`);
    }
  });
  await check('catalog by id: public book chapter → one row; private book, single article, missing → none', async () => {
    await identity(null);
    assert.deepEqual(await rows('select id, title from public_book_catalog(1)'), [{ id: 1, title: 'Alice — I' }]);
    for (const id of [3, 4, 5, 99]) assert.equal((await rows('select id from public_book_catalog($1)', [id])).length, 0, `id ${id}`);
  });
  await check('catalog grant: anon and authenticated may execute, PUBLIC may not', async () => {
    await db.exec('reset role');
    const grant = async (role) => (await rows("select has_function_privilege($1, 'public.public_book_catalog(bigint)', 'execute') as ok", [role]))[0].ok;
    assert.equal(await grant('anon'), true);
    assert.equal(await grant('authenticated'), true);
    const acl = (await rows("select proacl::text as acl from pg_proc where proname='public_book_catalog'"))[0].acl;
    assert.equal(/(^|[{,])=X/.test(acl), false, `PUBLIC execute present: ${acl}`);
  });
  await check('policy is restrictive and scoped to anon only', async () => {
    await db.exec('reset role');
    const [policy] = await rows("select permissive, roles::text as roles, cmd from pg_policies where tablename='reading_materials' and policyname='anon_book_chapters_hidden'");
    assert.deepEqual(policy, { permissive: 'RESTRICTIVE', roles: '{anon}', cmd: 'SELECT' });
  });
  console.log(`anon-book-catalog: ${checks} checks passed`);
} finally {
  await db.close();
}
