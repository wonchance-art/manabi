/** Local, disposable PGlite only — never connects to Supabase (ACCOUNT-DELETE-003 · 2026-11-06 KST).
 * 20261106200000_author_fk_set_null: 관리자 · 교사 작성자 열 5개의 auth.users FK가 NO ACTION이라 계정 탈퇴가 막히던 것.
 * 원래 정의는 원본 마이그레이션 문장을 그대로 잘라 쓴다(손으로 다시 쓰지 않는다).
 * 증명: ① 고치기 전 — 작성자가 있는 계정 삭제가 23503으로 막힌다(교사는 주석 이력 하나만으로도)
 *       ② 적용 — 다섯 FK SET NULL · 넷 NULL 허용 · 계정 삭제 완료 · 교재 판 · 공개 · 주석 이력 · 수정본 행은 그대로, 작성자만 NULL
 *          · 다른 작성자의 행은 그대로 ③ 재실행은 사전 검사가 거절 ④ 복원 SQL(NULL이 없을 때) → NO ACTION · NOT NULL
 *   node supabase/tests/author-fk-set-null.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
const migration = await read('../migrations/20261106200000_author_fk_set_null.sql');
const rollback = await read('../../docs/sql/author-fk-set-null-20261106-rollback.sql');
const editions = await read('../migrations/20260906024758_textbook_book_editions.sql');
const overrides = await read('../migrations/20260712000100_content_overrides.sql');
const annotations = await read('../migrations/20260910070535_textbook_teaching_annotations.sql');
const stmt = (src, start) => { const i = src.indexOf(start); assert.ok(i >= 0, start); return src.slice(i, src.indexOf(';', i) + 1); };
const ORIGINAL = [
  stmt(overrides, 'CREATE TABLE IF NOT EXISTS content_overrides ('),
  stmt(editions, 'create table public.textbook_book_drafts ('),
  stmt(editions, 'create table public.textbook_book_editions ('),
  stmt(editions, 'create table public.textbook_book_releases ('),
  stmt(annotations, 'CREATE TABLE public.textbook_annotations ('),
  stmt(annotations, 'CREATE TABLE public.textbook_annotation_revisions ('),
].join('\n');

const ADMIN = '00000000-0000-4000-8000-0000000000ad', TEACHER = '00000000-0000-4000-8000-00000000007e', OTHER = '00000000-0000-4000-8000-0000000000b2';
const HASH = 'a'.repeat(64), ED = 'b'.repeat(24);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

async function fresh() {
  const db = new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create table public.reading_materials(id bigint primary key);
    insert into auth.users values ('${ADMIN}'), ('${TEACHER}'), ('${OTHER}'); insert into public.reading_materials values (1);`);
  await db.exec(ORIGINAL);
  await db.exec(`
    insert into content_overrides(lang, slug, data, updated_by) values ('ja', 'n5-1', '{}', '${ADMIN}'), ('ja', 'n5-2', '{}', '${OTHER}');
    insert into public.textbook_book_drafts(book_id, manuscript, content_hash, updated_by) values ('japanese-n5', '{}', '${HASH}', '${ADMIN}');
    insert into public.textbook_book_editions(book_id, edition_id, content_hash, manuscript, artifact_manifest, published_by) values ('japanese-n5', '${ED}', '${HASH}', '{}', '{}', '${ADMIN}');
    insert into public.textbook_book_releases(book_id, edition_id, updated_by) values ('japanese-n5', '${ED}', '${ADMIN}');
    insert into public.textbook_annotations(id, material_id, anchor, body) values ('10000000-0000-4000-8000-000000000001', 1, '{}', '설명');
    insert into public.textbook_annotation_revisions(operation_id, annotation_id, actor_id, request, snapshot) values
      ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '${TEACHER}', '{}', '{}'),
      ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '${OTHER}', '{}', '{}');`);
  return db;
}
const fks = async (db) => (await db.query(`select c.conname, c.confdeltype::text del, a.attnotnull nn from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.contype = 'f' and c.confrelid = 'auth.users'::regclass order by 1`)).rows;
const counts = async (db) => (await db.query(`select
  (select count(*)::int from content_overrides) co, (select count(*)::int from public.textbook_book_drafts) dr,
  (select count(*)::int from public.textbook_book_editions) ed, (select count(*)::int from public.textbook_book_releases) re,
  (select count(*)::int from public.textbook_annotation_revisions) rv`)).rows[0];

const db = await fresh();
const beforeFks = await fks(db);
const beforeCounts = await counts(db);

await check('① 고치기 전 — 관리자 · 교사 계정 삭제가 작성자 FK에 막힌다(23503)', async () => {
  assert.equal(beforeFks.length, 5);
  assert.ok(beforeFks.every(f => f.del === 'a'), 'all NO ACTION');
  for (const who of [ADMIN, TEACHER]) {
    await assert.rejects(db.query('delete from auth.users where id = $1', [who]), e => e.code === '23503', `${who} blocked`);
  }
});

await db.exec(migration);
await check('② 적용 — 다섯 FK SET NULL · NULL 허용 · 탈퇴 완료 · 내용 행 그대로 · 작성자만 NULL · 다른 작성자 그대로', async () => {
  const after = await fks(db);
  assert.deepEqual(after.map(f => [f.conname, f.del, f.nn]), beforeFks.map(f => [f.conname, 'n', false]));
  await db.query('delete from auth.users where id = $1', [ADMIN]);
  await db.query('delete from auth.users where id = $1', [TEACHER]);
  assert.deepEqual(await counts(db), beforeCounts, 'no content row lost');
  const authors = (await db.query(`select
    (select updated_by from content_overrides where slug = 'n5-1') co_admin, (select updated_by from content_overrides where slug = 'n5-2') co_other,
    (select updated_by from public.textbook_book_drafts) dr, (select published_by from public.textbook_book_editions) ed,
    (select updated_by from public.textbook_book_releases) re,
    (select actor_id from public.textbook_annotation_revisions where operation_id = '20000000-0000-4000-8000-000000000001') rv_teacher,
    (select actor_id from public.textbook_annotation_revisions where operation_id = '20000000-0000-4000-8000-000000000002') rv_other`)).rows[0];
  assert.deepEqual({ ...authors }, { co_admin: null, co_other: OTHER, dr: null, ed: null, re: null, rv_teacher: null, rv_other: OTHER });
});

await check('③ 재실행 — 사전 검사가 거절(이미 바뀜)', async () => {
  await assert.rejects(db.exec(migration), /already changed/);
  await db.exec('rollback').catch(() => {});
});
await db.close();

await check('④ 복원 SQL — NULL이 없을 때 NO ACTION · NOT NULL로 돌아간다', async () => {
  const db2 = await fresh();
  await db2.exec(migration);
  await db2.exec(rollback);
  assert.deepEqual((await fks(db2)).map(f => [f.conname, f.del, f.nn]), beforeFks.map(f => [f.conname, f.del, f.nn]));
  await db2.close();
});
console.log(`author-fk-set-null: ${checks} checks passed`);
