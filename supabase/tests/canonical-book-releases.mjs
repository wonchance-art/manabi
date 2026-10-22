/** Isolated PostgreSQL verification; no network or live DB connection (CANON-RELEASE-001).
 * 정본 발행 기록: 누구나 읽고, 관리자 본인 이름으로만 쓰며, 서가 함수는 발행 기록 + 그 관리자의 공개 장만 돌려준다.
 * 채우기는 관리자 소유 · 장 전부 공개인 정본 책만, 소유자가 둘인 key가 있으면 멈춘다.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/canonical-book-releases.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const MIGRATION = new URL('../migrations/20261022081000_canonical_book_releases.sql', import.meta.url);
const admin = '10000000-0000-0000-0000-000000000001', other = '10000000-0000-0000-0000-000000000002', reader = '10000000-0000-0000-0000-000000000003';
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const chapter = (key, order) => JSON.stringify({ status: 'completed', metadata: { book: { key, title: key, order } } });

async function fresh(extraAdmins = []) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table profiles(id uuid primary key, role text default 'user');
  create function public.is_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
  grant execute on function public.is_admin() to anon, authenticated;
  create table reading_materials(id bigint primary key, title text, raw_text text, processed_json jsonb, created_at timestamptz default now(), visibility text default 'private', owner_id uuid);
  alter table reading_materials enable row level security;
  create policy "Users can read public or own materials" on reading_materials for select using ((visibility = 'public') or (owner_id = auth.uid()));
  grant all on reading_materials to anon, authenticated;
  insert into auth.users values ('${admin}'),('${other}'),('${reader}');
  insert into profiles values ('${admin}','admin'),('${other}','${extraAdmins.includes(other) ? 'admin' : 'user'}'),('${reader}','user');`);
  return db;
}
const as = async (db, user) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']); await db.exec(`set role ${user ? 'authenticated' : 'anon'}`); };
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const seed = (db, list) => db.query(`insert into reading_materials(id,title,raw_text,processed_json,created_at,visibility,owner_id) values ${list.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},'x',$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(',')}`, list.flat());
const migrate = async (db) => db.exec(await fs.readFile(MIGRATION, 'utf8'));

try {
  const db = await fresh();
  await seed(db, [
    // 관리자 · 장 전부 공개 → 채운다(첫 장 = order 1, 발행 때 = 가장 이른 장)
    [1, '羅生門 1', chapter('aozora-000879-000127', 2), '2026-10-20T02:00:00Z', 'public', admin],
    [2, '羅生門 2', chapter('aozora-000879-000127', 1), '2026-10-20T01:00:00Z', 'public', admin],
    // 관리자 · 일부 비공개 → 채우지 않는다(공개 도중)
    [3, '鼻 1', chapter('aozora-000879-000042', 1), '2026-10-20T03:00:00Z', 'public', admin],
    [4, '鼻 2', chapter('aozora-000879-000042', 2), '2026-10-20T03:00:00Z', 'private', admin],
    // 관리자가 아닌 사용자가 정본 key를 단 공개 글 → 채우지 않는다(위조)
    [5, '가짜 Alice', chapter('se-lewis-carroll_alices-adventures-in-wonderland', 1), '2026-10-20T04:00:00Z', 'public', other],
    // 사용자 책 key(bk_) → 정본 아님
    [6, '내 책', chapter('bk_abc', 1), '2026-10-20T05:00:00Z', 'public', admin],
  ]);
  await migrate(db);
  await migrate(db); // 재실행 안전

  await check('backfill records only admin-owned, fully public canonical books', async () => {
    await db.exec('reset role');
    assert.deepEqual(await rows(db, 'select book_key, owner_id, released_at from canonical_book_releases order by 1'),
      [{ book_key: 'aozora-000879-000127', owner_id: admin, released_at: new Date('2026-10-20T01:00:00Z') }]);
  });
  await check('anyone reads release records; shelf gives first chapter by order, count, no text', async () => {
    for (const user of [null, reader]) {
      await as(db, user);
      assert.equal((await rows(db, 'select * from canonical_book_releases')).length, 1);
      const shelf = await rows(db, 'select * from canonical_book_shelf()');
      assert.deepEqual(shelf, [{ book_key: 'aozora-000879-000127', first_material_id: 2, chapters: 2, released_at: new Date('2026-10-20T01:00:00Z') }]);
    }
  });
  await check('non-admin cannot record a release (even for own forged rows)', async () => {
    await as(db, other);
    await assert.rejects(rows(db, `insert into canonical_book_releases(book_key, owner_id) values ('se-lewis-carroll_alices-adventures-in-wonderland', '${other}')`), /row-level security/);
  });
  await check('admin records only in own name; update · delete are not granted', async () => {
    await as(db, admin);
    await assert.rejects(rows(db, `insert into canonical_book_releases(book_key, owner_id) values ('aozora-000879-000042', '${other}')`), /row-level security/);
    await rows(db, `insert into canonical_book_releases(book_key, owner_id) values ('aozora-000879-000042', '${admin}') on conflict (book_key) do nothing`);
    await rows(db, `insert into canonical_book_releases(book_key, owner_id) values ('aozora-000879-000042', '${admin}') on conflict (book_key) do nothing`); // 멱등
    await assert.rejects(rows(db, `update canonical_book_releases set owner_id = '${admin}'`), /permission denied/);
    await assert.rejects(rows(db, 'delete from canonical_book_releases'), /permission denied/);
    await as(db, null);
    await assert.rejects(rows(db, `insert into canonical_book_releases(book_key, owner_id) values ('pd-x', '${admin}')`), /permission denied/);
  });
  await check('shelf lists a recorded book only with its owner\'s public chapters (private ones are not counted)', async () => {
    await as(db, null);
    const shelf = await rows(db, 'select book_key, first_material_id, chapters from canonical_book_shelf() order by 1');
    assert.deepEqual(shelf, [
      { book_key: 'aozora-000879-000042', first_material_id: 3, chapters: 1 },
      { book_key: 'aozora-000879-000127', first_material_id: 2, chapters: 2 },
    ]);
  });
  await check('a forged public book with a recorded key never joins the shelf (owner must match the record)', async () => {
    await db.exec('reset role');
    await seed(db, [[7, '가짜 羅生門', chapter('aozora-000879-000127', 0), '2026-10-19T00:00:00Z', 'public', other]]);
    await as(db, reader);
    const [row] = await rows(db, "select first_material_id, chapters from canonical_book_shelf() where book_key = 'aozora-000879-000127'");
    assert.deepEqual(row, { first_material_id: 2, chapters: 2 });
  });
  await check('key shape is enforced (canonical prefixes only)', async () => {
    await db.exec('reset role');
    for (const key of ['bk_abc', 'aozora-', 'AOZORA-1', 'se-a b', `pd-${'x'.repeat(161)}`]) {
      await assert.rejects(rows(db, 'insert into canonical_book_releases(book_key, owner_id) values ($1, $2)', [key, admin]), /canonical_book_releases_key_shape/, key);
    }
  });

  const twoOwners = await fresh([other]);
  await seed(twoOwners, [
    [1, 'A', chapter('aozora-000879-000127', 1), '2026-10-20T01:00:00Z', 'public', admin],
    [2, 'B', chapter('aozora-000879-000127', 1), '2026-10-20T01:00:00Z', 'public', other],
  ]);
  await check('backfill stops when one key has two admin owners (nothing recorded)', async () => {
    await assert.rejects(migrate(twoOwners), /more than one admin owner — aozora-000879-000127/);
    assert.equal((await rows(twoOwners, "select to_regclass('public.canonical_book_releases') as t"))[0].t, null);
  });

  console.log(`canonical-book-releases: ${checks} checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
