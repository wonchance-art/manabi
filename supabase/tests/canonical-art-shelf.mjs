/** Isolated PostgreSQL verification; no network or live DB connection (DISCOVER-ART-001).
 * 그림 구간 작품별 서가: 발행 기록이 있는 그림 책(art-)의, 그 기록 관리자 소유 공개 장만 작품 · 순서 · 자료 id로 돌려준다.
 * 위조 공개 글(다른 소유자) · 비공개 장 · 문학 책 · 그림 출처가 아닌 장은 빠진다.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node supabase/tests/canonical-art-shelf.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const MIGRATIONS = ['20261022081000_canonical_book_releases.sql', '20261023161000_canonical_art_shelf.sql']
  .map((name) => new URL(`../migrations/${name}`, import.meta.url));
const admin = '10000000-0000-0000-0000-000000000001', other = '10000000-0000-0000-0000-000000000002', reader = '10000000-0000-0000-0000-000000000003';
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const chapter = (key, order, work, provider = 'art') => JSON.stringify({ status: 'completed', metadata: { book: { key, title: key, order }, literature: { provider, work } } });

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
-- 운영처럼 anon은 책 장을 직접 읽지 못한다(BOOK-GUEST-GATE-1) — 서가 함수는 그래도 열 자료 id를 준다.
create policy anon_book_chapters_hidden on reading_materials as restrictive for select to anon using (nullif(processed_json #>> '{metadata,book,key}', '') is null);
grant all on reading_materials to anon, authenticated;
insert into auth.users values ('${admin}'),('${other}'),('${reader}');
insert into profiles values ('${admin}','admin'),('${other}','user'),('${reader}','user');`);
const as = async (user) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']); await db.exec(`set role ${user ? 'authenticated' : 'anon'}`); };
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const seed = (list) => db.query(`insert into reading_materials(id,title,raw_text,processed_json,visibility,owner_id) values ${list.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},'x',$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',')}`, list.flat());

try {
  await seed([
    [11, '명화 2', chapter('art-famous', 2, 'monet-water-lilies'), 'public', admin],
    [12, '명화 1', chapter('art-famous', 1, 'van-gogh-bedroom'), 'public', admin],
    [13, '명화 3', chapter('art-famous', 3, 'seurat-grande-jatte'), 'private', admin],
    [21, '판화 1', chapter('art-ukiyoe', 1, 'hokusai-kanagawa-oki-nami-ura'), 'public', admin],
    [31, '羅生門 1', chapter('aozora-000879-000127', 1, null, 'aozora'), 'public', admin],
  ]);
  for (const migration of MIGRATIONS) await db.exec(await fs.readFile(migration, 'utf8'));
  await db.exec(await fs.readFile(MIGRATIONS[1], 'utf8')); // 재실행 안전
  // 채우기가 관리자 소유 · 장 전부 공개인 책을 기록했다(art-ukiyoe · 라쇼몬). art-famous는 발행 도중(비공개 장)이라 관리자가 기록한다.
  await as(admin);
  await rows(`insert into canonical_book_releases(book_key, owner_id) values ('art-famous', '${admin}')`);

  await check('anyone gets released art chapters by book order with their work id (private chapters and literature books left out)', async () => {
    for (const user of [null, reader]) {
      await as(user);
      assert.deepEqual(await rows('select * from canonical_art_shelf()'), [
        { book_key: 'art-famous', work: 'van-gogh-bedroom', chapter_order: 1, material_id: 12 },
        { book_key: 'art-famous', work: 'monet-water-lilies', chapter_order: 2, material_id: 11 },
        { book_key: 'art-ukiyoe', work: 'hokusai-kanagawa-oki-nami-ura', chapter_order: 1, material_id: 21 },
      ]);
    }
  });
  await check('a forged public chapter with a released art key never joins (owner must match the record)', async () => {
    await db.exec('reset role');
    await seed([[41, '가짜 명화', chapter('art-famous', 1, 'van-gogh-bedroom'), 'public', other]]);
    await as(null);
    assert.deepEqual((await rows("select material_id from canonical_art_shelf() where book_key = 'art-famous'")).map((row) => row.material_id), [12, 11]);
  });
  await check('an art key chapter without the art provider is left out', async () => {
    await db.exec('reset role');
    await seed([[14, '출처 없는 장', chapter('art-famous', 4, 'x', 'aozora'), 'public', admin]]);
    await as(reader);
    assert.equal((await rows("select * from canonical_art_shelf() where material_id = 14")).length, 0);
  });
  await check('function runs as definer with a fixed search_path', async () => {
    await db.exec('reset role');
    const [fn] = await rows("select prosecdef, proconfig from pg_proc where proname = 'canonical_art_shelf'");
    assert.deepEqual(fn, { prosecdef: true, proconfig: ['search_path=public'] });
  });

  console.log(`canonical-art-shelf: ${checks} checks passed`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
